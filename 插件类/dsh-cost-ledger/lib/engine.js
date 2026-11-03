/**
 * 费用账本引擎:会话折叠缓存、汇率采集、计价与价格取数。
 *
 * 设计要点:
 *  - 折叠结果(按日/路由/峰谷档/价格段 的 token 桶)持久化在 state.sessions,
 *    进程重启后不必重读全部会话日志;
 *  - 价格与汇率都是"版本化/按日"数据,金额在请求时现算,便于追溯;
 *  - 首次建账会在后台跑一遍全量折叠,期间请求会等待同一个 Promise。
 */

import { fetchDeepSeekPricing } from './pricing.js'
import { fetchFxRate } from './fx.js'
import { buildPriceIndex, foldSession, resolveRoute } from './fold.js'
import { neededFxPairs, priceOverview, priceSession } from './price.js'
import { localDate, recentDays } from './time.js'
import { scanSessionFiles, readLegacyEvents } from './legacy.js'

const EMPTY_TOKENS = () => ({ miss: 0, read: 0, write: 0, out: 0 })

/** 折叠数据结构版本:升级后强制全量重折一次(搜索/抓取的调用与 token 统计依赖新字段)。 */
const FOLD_VERSION = 3

let segmentSeq = 0
function makeSegmentId(model, tier) {
	segmentSeq += 1
	return `seg-${model}-${tier}-${Date.now().toString(36)}-${segmentSeq}`
}

/**
 * @param options.ctx cordis 宿主上下文。
 * @param options.state 已加载的状态对象(会被原地修改)。
 * @param options.save (state, opts?) => Promise。
 * @param options.logger 可选日志器。
 */
export function createEngine({ ctx, state, save, logger }) {
	// 旧折叠结果里没有搜索/抓取统计,版本不一致时强制全量重折一次。
	if (state.meta !== undefined && state.meta !== null && state.meta.foldVersion !== FOLD_VERSION) {
		state.refoldNeeded = true
	}

	let buildPromise = null
	let refreshPromise = null
	let lastLiveRefresh = 0
	let fxBusy = null

	const sessionsService = () => ctx.get('sessions')
	const persistenceService = () => ctx.get('sessionPersistence')
	const queryService = () => ctx.get('sessionQuery')

	/** 会话文件索引(id -> 文件/mtime/是否旧格式),用于增量折叠与旧格式兼容。 */
	let fileIndex = null
	function getFileIndex() {
		fileIndex ??= scanSessionFiles()
		return fileIndex
	}
	function refreshFileIndex() {
		fileIndex = scanSessionFiles()
		return fileIndex
	}

	/** 列出会话(id + 是否活跃),并补上 dsh 已不显示的旧格式会话。 */
	async function listSessions() {
		const listed = []
		const query = queryService()
		if (query !== undefined && typeof query.listSessions === 'function') {
			const records = await query.listSessions()
			for (const record of records) listed.push({ id: record.header.id, live: record.live === true })
		} else {
			const sessions = sessionsService()
			if (sessions !== undefined) for (const session of sessions.list()) listed.push({ id: session.id, live: true })
		}
		const index = refreshFileIndex()
		const seen = new Set(listed.map((entry) => entry.id))
		for (const [id, info] of index) {
			if (!seen.has(id)) listed.push({ id, live: false, legacy: info.legacy })
		}
		return listed
	}

	/** 读取一个会话的事件;活跃会话从内存快照取,旧格式会话用 zstd 解压。 */
	async function readEvents(id) {
		const sessions = sessionsService()
		const live = sessions?.get?.(id)
		if (live !== undefined) {
			if (typeof live.snapshotEvents === 'function') return live.snapshotEvents()
			if (Array.isArray(live.events)) return live.events
		}
		const info = getFileIndex().get(id)
		if (info !== undefined && info.legacy) return await readLegacyEvents(id, info)
		const persistence = persistenceService()
		if (persistence === undefined) throw new Error('会话持久化服务不可用')
		const handle = await persistence.open(id, 'read')
		try {
			const { events } = await handle.read(0, undefined)
			return events
		} finally {
			await handle.close()
		}
	}

	/** 折叠一个会话并写入缓存。 */
	async function foldOne(id, { live = false } = {}) {
		const events = await readEvents(id)
		const summary = foldSession(events, { state })
		state.sessions[id] = summary
		return summary
	}

	/** 全量折叠(后台建账 / 手动刷新)。 */
	async function foldAll({ force = false } = {}) {
		const started = Date.now()
		const list = await listSessions()
		const index = buildPriceIndex(state)
		const files = getFileIndex()
		let folded = 0
		let foldErrors = 0
		for (const { id, live } of list) {
			const cached = state.sessions[id]
			const info = files.get(id)
			const fileChanged = info !== undefined && cached !== undefined && info.mtimeMs > (cached.foldedAt ?? 0) + 1500
			const needs = force || cached === undefined || live === true || fileChanged || state.refoldNeeded === true
			if (!needs) continue
			try {
				const events = await readEvents(id)
				const summary = foldSession(events, { state, index })
				if (info !== undefined) {
					summary.sourceFile = info.file
					summary.sourceMtime = info.mtimeMs
					summary.legacy = info.legacy
				}
				state.sessions[id] = summary
				folded += 1
			} catch (error) {
				foldErrors += 1
				logger?.warn?.(`[cost-ledger] 折叠会话 ${id} 失败:${error instanceof Error ? error.message : String(error)}`)
			}
			if (folded > 0 && folded % 15 === 0) await save(state)
		}
		state.refoldNeeded = false
		state.meta.foldVersion = FOLD_VERSION
		state.meta.lastFoldAt = Date.now()
		state.meta.lastFoldMs = Date.now() - started
		state.meta.lastFoldSessions = folded
		state.meta.lastFoldErrors = foldErrors
		await save(state)
		prefetchFx()
		return { folded, total: list.length, ms: Date.now() - started }
	}

	/** 全量重算(带单飞锁,建账与手动刷新共用)。 */
	function bootFold({ force = true } = {}) {
		buildPromise ??= foldAll({ force }).finally(() => {
			buildPromise = null
		})
		return buildPromise
	}

	/** 确保建账完成;首次调用会触发全量折叠。 */
	async function ensureBuilt() {
		if (state.meta.lastFoldAt !== null && state.meta.lastFoldAt !== undefined) {
			await refreshLive(true)
			return
		}
		await bootFold()
	}

	/** 刷新活跃会话(节流);force=true 时忽略节流。 */
	async function refreshLive(force = false) {
		const now = Date.now()
		if (!force && now - lastLiveRefresh < 2000) return
		lastLiveRefresh = now
		refreshPromise ??= (async () => {
			try {
				const list = await listSessions()
				const index = buildPriceIndex(state)
				let changed = 0
				for (const { id, live } of list) {
					if (live !== true) continue
					try {
						const events = await readEvents(id)
						state.sessions[id] = foldSession(events, { state, index })
						changed += 1
					} catch {
						/* 单会话失败不影响其它 */
					}
				}
				if (changed > 0) await save(state)
			} finally {
				refreshPromise = null
			}
		})()
		await refreshPromise
	}

	/** 确保某个会话已折叠。 */
	async function ensureSession(id) {
		const cached = state.sessions[id]
		const sessions = sessionsService()
		const live = sessions?.get?.(id)
		if (cached !== undefined && live === undefined) return cached
		return await foldOne(id, { live: live !== undefined })
	}

	/** 读取会话文件信息(供诊断)。 */
	function fileInfo(id) {
		return getFileIndex().get(id)
	}

	/** 汇率读取(展示货币与原始货币相同则 1)。 */
	function fxRate(base, quote, day) {
		if (base === quote) return 1
		return state.fx?.[`${base}>${quote}`]?.[day]?.rate
	}

	/** usage 覆盖率:assistant/message 事件里带 usage 的比例(上游字段漂移时第一时间可见)。 */
	function coverageStats() {
		let assistantMessages = 0
		let usageMessages = 0
		let legacySessions = 0
		for (const summary of Object.values(state.sessions)) {
			assistantMessages += summary.assistantMessages ?? 0
			usageMessages += summary.usageMessages ?? 0
			if (summary.legacy === true) legacySessions += 1
		}
		return {
			assistantMessages,
			usageMessages,
			ratio: assistantMessages > 0 ? usageMessages / assistantMessages : 1,
			legacySessions,
		}
	}

	const fxInFlight = new Map()
	let fxBackground = null

	/** 采集单日汇率(带一次重试);失败不落盘。 */
	async function fetchOneFx({ base, quote, day }) {
		const pairKey = `${base}>${quote}`
		const key = `${pairKey}|${day}`
		if (base === quote) return true
		if (state.fx?.[pairKey]?.[day] !== undefined) return true
		if (fxInFlight.has(key)) {
			await fxInFlight.get(key)
			return state.fx?.[pairKey]?.[day] !== undefined
		}
		const job = (async () => {
			let lastError
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					const rate = await fetchFxRate({ base, quote, date: day })
					state.fx[pairKey] ??= {}
					state.fx[pairKey][day] = {
						base,
						quote,
						rate: rate.rate,
						asOf: rate.asOf,
						source: rate.source,
						fetchedAt: Date.now(),
					}
					return true
				} catch (error) {
					lastError = error
					if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600))
				}
			}
			logger?.warn?.(`[cost-ledger] 采集 ${day} 汇率失败:${lastError instanceof Error ? lastError.message : String(lastError)}`)
			return false
		})()
		fxInFlight.set(key, job)
		try {
			return await job
		} finally {
			fxInFlight.delete(key)
		}
	}

	/** 采集缺失的按日汇率(并发 2,最近的日期优先)。 */
	async function ensureFx(pairs, { limit } = {}) {
		const unique = []
		const seen = new Set()
		for (const pair of pairs) {
			const key = `${pair.base}>${pair.quote}|${pair.day}`
			if (seen.has(key)) continue
			seen.add(key)
			unique.push(pair)
		}
		unique.sort((left, right) => right.day.localeCompare(left.day))
		const slice = typeof limit === 'number' ? unique.slice(0, limit) : unique
		let fetched = 0
		let failed = 0
		let cursor = 0
		const workers = Array.from({ length: 2 }, async () => {
			while (cursor < slice.length) {
				const pair = slice[cursor]
				cursor += 1
				if (pair.base === pair.quote) continue
				const ok = await fetchOneFx(pair)
				if (ok) fetched += 1
				else failed += 1
			}
		})
		await Promise.all(workers)
		if (fetched > 0) await save(state)
		return { fetched, failed, remaining: unique.length - slice.length }
	}

	/** 后台补齐历史汇率(不阻塞请求)。 */
	function prefetchFx() {
		if (fxBackground !== null) return fxBackground
		fxBackground = (async () => {
			try {
				await ensureFx(neededFxPairs(state.sessions, state))
			} catch (error) {
				logger?.warn?.(`[cost-ledger] 后台采集汇率失败:${error instanceof Error ? error.message : String(error)}`)
			} finally {
				fxBackground = null
			}
		})()
		return fxBackground
	}

	/** 单个会话的费用明细。 */
	async function sessionCost(id) {
		const summary = await ensureSession(id)
		const pairs = neededFxPairs({ [id]: summary }, state)
		if (pairs.length > 0) {
			await ensureFx(pairs, { limit: 4 })
			if (pairs.length > 4) prefetchFx()
		}
		const priced = priceSession(summary, state, fxRate)
		return {
			ok: true,
			sessionId: id,
			displayCurrency: state.displayCurrency,
			total: priced.total,
			tokens: priced.tokens,
			turns: priced.turns,
			unpriced: priced.unpriced,
			pendingFx: priced.pendingFx,
			services: priced.services,
			serviceCost: priced.serviceCost,
			serviceBreakdown: priced.serviceBreakdown,
			toolTokens: priced.toolTokens,
			toolTokenCost: priced.toolTokenCost,
			lastSeq: summary.lastSeq,
			foldedAt: summary.foldedAt,
		}
	}

	/** 汇总面板数据:总额、近 N 日、按路由。 */
	async function overview({ days = 30, refresh = false } = {}) {
		await ensureBuilt()
		if (refresh) await bootFold()
		const pairs = neededFxPairs(state.sessions, state)
		if (pairs.length > 0) {
			const recent = localDate(Date.now() - 86400000)
			const urgent = pairs.filter((pair) => pair.day >= recent)
			if (urgent.length > 0) await ensureFx(urgent, { limit: 4 })
			if (pairs.length > urgent.length) prefetchFx()
		}
		const priced = priceOverview(state.sessions, state, fxRate)
		const series = recentDays(days).map((day) => ({
			day,
			total: priced.days[day]?.total ?? 0,
			tokens: priced.days[day]?.tokens ?? EMPTY_TOKENS(),
		}))
		let today = 0
		const todayKey = localDate(Date.now())
		let yesterday = 0
		const yesterdayKey = localDate(Date.now() - 86400000)
		for (const entry of series) {
			if (entry.day === todayKey) today = entry.total
			if (entry.day === yesterdayKey) yesterday = entry.total
		}
		return {
			ok: true,
			displayCurrency: state.displayCurrency,
			total: priced.total,
			tokens: priced.tokens,
			byRoute: priced.byRoute,
			unpriced: priced.unpriced,
			series,
			today,
			yesterday,
			services: priced.services,
			serviceBreakdown: priced.serviceBreakdown,
			toolTokens: priced.toolTokens,
			toolTokenCost: priced.toolTokenCost,
			pendingFx: priced.pendingFx,
			sessionCount: Object.keys(state.sessions).length,
			meta: state.meta,
			coverage: coverageStats(),
		}
	}

	/** 设置页数据:价格时段、汇率、路由、未定价项。 */
	async function settingsView() {
		await ensureBuilt()
		const unpriced = {}
		for (const summary of Object.values(state.sessions)) {
			for (const [key, bucket] of Object.entries(summary.unpriced ?? {})) {
				const entry = (unpriced[key] ??= { route: key, ...EMPTY_TOKENS(), events: 0 })
				for (const field of ['miss', 'read', 'write', 'out']) entry[field] += bucket[field]
				entry.events += bucket.events
			}
		}
		const models = Object.entries(state.priceModels).map(([name, model]) => ({
			name,
			label: model.label ?? name,
			version: model.version,
			currency: model.currency,
			source: model.source,
			tiers: ['peak', 'offpeak'].map((tier) => {
				const list = [...(model.segments?.[tier] ?? [])].sort((a, b) => a.from - b.from)
				return {
					tier,
					segments: list.map((segment, index) => ({ ...segment, to: list[index + 1]?.from ?? null })),
				}
			}),
		}))
		const fx = Object.entries(state.fx).map(([pair, days]) => ({
			pair,
			days: Object.entries(days)
				.sort((a, b) => b[0].localeCompare(a[0]))
				.map(([day, value]) => ({ day, ...value })),
		}))
		return {
			ok: true,
			displayCurrency: state.displayCurrency,
			currencies: state.currencies,
			models,
			routes: state.routes,
			fx,
			holidays: state.holidays,
			peakWindowsUtc: state.peakWindowsUtc,
			unpriced,
			meta: state.meta,
			sessionCount: Object.keys(state.sessions).length,
			coverage: coverageStats(),
		}
	}

	/** 兼容性自检:宿主服务、折叠覆盖率、价格/汇率状态。 */
	function health() {
		const services = {
			webServer: ctx.get('webServer') !== undefined,
			sessions: sessionsService() !== undefined,
			sessionPersistence: persistenceService() !== undefined,
			sessionQuery: queryService() !== undefined,
		}
		const coverage = coverageStats()
		const missing = Object.entries(services).filter(([, present]) => present !== true).map(([name]) => name)
		return {
			ok: missing.length === 0,
			plugin: 'dsh-cost-ledger',
			stateVersion: state.version,
			services,
			missingServices: missing,
			fold: {
				lastFoldAt: state.meta.lastFoldAt,
				lastFoldSessions: state.meta.lastFoldSessions,
				lastFoldMs: state.meta.lastFoldMs,
				errors: state.meta.lastFoldErrors ?? 0,
				sessions: Object.keys(state.sessions).length,
			},
			coverage,
			price: {
				lastFetchAt: state.meta.lastPriceFetchAt,
				ok: state.meta.lastPriceFetchOk,
				error: state.meta.lastPriceFetchError,
				models: Object.keys(state.priceModels).length,
			},
			fxDays: Object.keys(state.fx?.['USD>CNY'] ?? {}).length,
			displayCurrency: state.displayCurrency,
		}
	}

	/** 抓取官方价目并落成新的价格时段(会计式:旧价保留、新价从现在生效)。 */
	async function fetchPrices() {
		let snapshot
		try {
			snapshot = await fetchDeepSeekPricing()
		} catch (error) {
			state.meta.lastPriceFetchAt = Date.now()
			state.meta.lastPriceFetchOk = false
			state.meta.lastPriceFetchError = error instanceof Error ? error.message : String(error)
			await save(state)
			return { ok: false, error: state.meta.lastPriceFetchError }
		}
		const now = Date.now()
		const changes = []
		let initialImport = false
		for (const model of snapshot.models) {
			const target = (state.priceModels[model.id] ??= {
				currency: snapshot.currency,
				label: model.id,
				version: model.version,
				source: 'deepseek-docs',
				segments: { peak: [], offpeak: [] },
			})
			target.currency = snapshot.currency
			target.version = model.version ?? target.version
			for (const tier of ['peak', 'offpeak']) {
				const incoming = {
					cacheRead: model.hit[tier],
					cacheMiss: model.miss[tier],
					cacheWrite: model.miss[tier],
					output: model.output[tier],
				}
				const list = (target.segments[tier] ??= [])
				list.sort((a, b) => a.from - b.from)
				const latest = list.at(-1)
				if (latest === undefined) {
					list.push({
						id: makeSegmentId(model.id, tier),
						from: 0,
						...incoming,
						source: 'import',
						note: '初始导入:按官方当前文档价回溯',
						recordedAt: now,
					})
					initialImport = true
					changes.push({ model: model.id, tier, kind: 'import', from: 0, after: incoming })
					continue
				}
				const before = {
					cacheRead: latest.cacheRead,
					cacheMiss: latest.cacheMiss,
					cacheWrite: latest.cacheWrite ?? latest.cacheMiss,
					output: latest.output,
				}
				if (
					before.cacheRead === incoming.cacheRead
					&& before.cacheMiss === incoming.cacheMiss
					&& before.cacheWrite === incoming.cacheWrite
					&& before.output === incoming.output
				) continue
				list.push({
					id: makeSegmentId(model.id, tier),
					from: now,
					...incoming,
					source: 'fetch',
					note: `自动获取:命中 ${before.cacheRead}→${incoming.cacheRead},未命中 ${before.cacheMiss}→${incoming.cacheMiss},输出 ${before.output}→${incoming.output}`,
					recordedAt: now,
				})
				changes.push({ model: model.id, tier, kind: 'change', from: now, before, after: incoming })
			}
			const officialRoute = `deepseek-official/${model.id}`
			if (state.routes[officialRoute] === undefined) state.routes[officialRoute] = { priceModel: model.id }
		}
		state.meta.lastPriceFetchAt = now
		state.meta.lastPriceFetchOk = true
		state.meta.lastPriceFetchError = null
		state.meta.priceSourceUrl = snapshot.sourceUrl
		if (initialImport) state.refoldNeeded = true
		await save(state, { backupTag: 'price-fetch' })
		if (initialImport) await foldAll({ force: true })
		return {
			ok: true,
			changes,
			initialImport,
			fetchedAt: now,
			currency: snapshot.currency,
			models: snapshot.models,
		}
	}

	/** 切换展示货币。 */
	async function setCurrency(currency) {
		if (!state.currencies.includes(currency)) return { ok: false, error: `不支持的货币:${currency}` }
		state.displayCurrency = currency
		await save(state)
		return { ok: true, displayCurrency: currency }
	}

	/** 配置某条路由的计价方式(预留给其它家模型)。 */
	async function setRoute(route, value) {
		if (typeof route !== 'string' || route === '') return { ok: false, error: '缺少 route' }
		if (value === null || typeof value !== 'object') return { ok: false, error: '缺少配置' }
		if (value.mode !== undefined && !['free', 'unpriced', 'priced'].includes(value.mode)) return { ok: false, error: 'mode 只能是 free/unpriced/priced' }
		if (value.priceModel !== undefined && state.priceModels[value.priceModel] === undefined) return { ok: false, error: `没有价格模型 ${value.priceModel}` }
		state.routes[route] = { ...value }
		await save(state)
		return { ok: true, routes: state.routes }
	}

	/** 手动写入一个价格模型(预留给其它家模型,价格从 now 生效)。 */
	async function setManualPrice(name, { currency = 'USD', tiers } = {}) {
		if (typeof name !== 'string' || name === '') return { ok: false, error: '缺少价格模型名' }
		if (tiers === undefined || typeof tiers !== 'object') return { ok: false, error: '缺少 tiers' }
		const now = Date.now()
		const target = (state.priceModels[name] ??= { currency, label: name, source: 'manual', segments: { peak: [], offpeak: [] } })
		target.currency = currency
		target.source = 'manual'
		for (const tier of ['peak', 'offpeak']) {
			const prices = tiers[tier]
			if (prices === undefined) continue
			const list = (target.segments[tier] ??= [])
			list.sort((a, b) => a.from - b.from)
			list.push({
				id: makeSegmentId(name, tier),
				from: now,
				cacheRead: Number(prices.cacheRead) || 0,
				cacheMiss: Number(prices.cacheMiss) || 0,
				cacheWrite: Number(prices.cacheWrite ?? prices.cacheMiss) || 0,
				output: Number(prices.output) || 0,
				source: 'manual',
				note: '手动录入',
				recordedAt: now,
			})
		}
		await save(state, { backupTag: 'manual-price' })
		return { ok: true, name }
	}

	/** 手动触发全量重算(价格/路由调整后使用)。 */
	async function recompute() {
		state.refoldNeeded = true
		await foldAll({ force: true })
		return { ok: true, meta: state.meta }
	}

	return {
		state,
		listSessions,
		foldAll,
		bootFold,
		ensureBuilt,
		ensureSession,
		refreshLive,
		sessionCost,
		overview,
		settingsView,
		fetchPrices,
		setCurrency,
		setRoute,
		setManualPrice,
		recompute,
		health,
		fileInfo,
		fxRate,
		ensureFx,
	}
}
