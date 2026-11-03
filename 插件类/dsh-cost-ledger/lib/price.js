/**
 * 计价:把折叠摘要里的 token 桶乘以"当时生效"的价格段,并按当日汇率折算到展示货币。
 *
 * 金额口径(与上游 usage 语义一致):
 *   未命中输入 inputTokens × cacheMiss
 *   命中输入   cacheReadTokens × cacheRead
 *   写入缓存   cacheWriteTokens × cacheWrite(DeepSeek 默认按 cacheMiss)
 *   输出       outputTokens × output
 * 单位:价格表为 每百万 tokens 的货币金额。
 *
 * 另外计"按请求计费"的服务调用(搜索 / 抓取):DeepSeek Search API 与 Fetch API
 * 官方价均为每 1000 次成功请求 ¥5,即每次 ¥0.005;单价存在 state.servicePrices,
 * 可按需改价,金额同样按费用发生当日汇率折算。
 */

import { resolveRoute } from './fold.js'

/** 按请求计费的服务键(与 fold.js 里记录的字段一致)。 */
export const SERVICE_KEYS = ['search', 'fetch']

/** 默认服务单价:官方文档「每 1000 次成功请求 ¥5」。 */
const DEFAULT_SERVICE_PRICES = {
	search: { currency: 'CNY', perRequest: 0.005 },
	fetch: { currency: 'CNY', perRequest: 0.005 },
}

/**
 * 检索内容 token 的拆分计价:搜索/抓取结果文本进入上下文,占用的输入 token 已经
 * 包含在模型 usage 里,这里按该轮所用模型的输入价折算一份"其中有多少钱",
 * 只用于展示拆分,不重复计入总额。
 *
 * 同时给两种口径:未命中输入价(cacheMiss)/命中缓存价(cacheRead)。
 */
export function priceToolTokens(summary, state, fxRate) {
	const tokens = { search: 0, fetch: 0 }
	const cost = { miss: 0, read: 0 }
	const perTurn = {}
	const turnTokens = summary.turnToolTokens ?? {}
	for (const [turn, counts] of Object.entries(turnTokens)) {
		const search = Number(counts?.search) || 0
		const fetch = Number(counts?.fetch) || 0
		const total = search + fetch
		tokens.search += search
		tokens.fetch += fetch
		if (total <= 0) continue
		const contributions = summary.turns?.[turn]
		const first = Array.isArray(contributions) ? contributions[0] : undefined
		if (first === undefined) continue
		const route = resolveRoute(state, first.route)
		if (route.mode !== 'priced') continue
		const segment = findSegmentById(state.priceModels[route.priceModel], first.tier, first.seg)
		if (segment === undefined) continue
		const day = typeof counts.day === 'string' ? counts.day : first.day
		const rate = fxRate(route.currency, state.displayCurrency, day)
		if (rate === undefined) continue
		const miss = (total * (segment.cacheMiss ?? 0)) / 1e6 * rate
		const read = (total * (segment.cacheRead ?? segment.cacheMiss ?? 0)) / 1e6 * rate
		cost.miss += miss
		cost.read += read
		perTurn[turn] = { tokens: total, search, fetch, miss, read }
	}
	return { tokens: { search: tokens.search, fetch: tokens.fetch, total: tokens.search + tokens.fetch }, cost, perTurn }
}

/** 读取某服务的单价(缺省回退到官方价)。 */
export function servicePriceOf(state, service) {
	const configured = state?.servicePrices?.[service]
	const price = configured !== undefined && configured !== null ? configured : DEFAULT_SERVICE_PRICES[service]
	if (price === undefined) return undefined
	const perRequest = Number(price.perRequest)
	if (!Number.isFinite(perRequest) || perRequest < 0) return undefined
	return { currency: typeof price.currency === 'string' && price.currency !== '' ? price.currency : 'CNY', perRequest }
}

/** 在某个价格模型里按 id 找价格段。 */
export function findSegmentById(priceModel, tier, id) {
	if (id === 'free') return undefined
	const list = priceModel?.segments?.[tier]
	if (!Array.isArray(list)) return undefined
	return list.find((segment) => segment.id === id)
}

/** 由 token 桶算原始货币金额(元/百万 token)。 */
export function segmentCost(segment, bucket) {
	if (segment === undefined) return undefined
	const perMillion = 1e6
	return (
		(bucket.miss * (segment.cacheMiss ?? 0)
			+ bucket.read * (segment.cacheRead ?? 0)
			+ bucket.write * (segment.cacheWrite ?? segment.cacheMiss ?? 0)
			+ bucket.out * (segment.output ?? 0)) / perMillion
	)
}

/**
 * 计价单条归因。
 *
 * @param state 账本状态。
 * @param contribution 折叠产生的归因(route/tier/seg/day/桶)。
 * @param fxRate (base, quote, day) => number | undefined。
 */
export function priceContribution(state, contribution, fxRate) {
	const route = resolveRoute(state, contribution.route)
	const bucket = contribution
	if (route.mode === 'free') return { cost: 0, native: 0, rate: 1, currency: state.displayCurrency, free: true }
	if (route.mode !== 'priced') return { unpriced: true, bucket }
	const model = state.priceModels[route.priceModel]
	const segment = findSegmentById(model, contribution.tier, contribution.seg)
	if (segment === undefined) return { unpriced: true, bucket }
	const native = segmentCost(segment, contribution)
	const rate = fxRate(route.currency, state.displayCurrency, contribution.day)
	if (rate === undefined) return { pendingFx: contribution.day, native, currency: route.currency, bucket }
	return { cost: native * rate, native, rate, currency: state.displayCurrency, bucket }
}

/**
 * 给单个会话的折叠摘要计价。
 *
 * @returns {{turns: Record<number, {cost: number, native: number, currency: string, tokens: object, priced: boolean, free: boolean}>, total: number, tokens: object, unpriced: object, pendingFx: string[]}}
 */
export function priceSession(summary, state, fxRate) {
	const turns = {}
	let total = 0
	const tokens = { miss: 0, read: 0, write: 0, out: 0 }
	const pendingFx = new Set()
	for (const [turn, contributions] of Object.entries(summary.turns ?? {})) {
		let cost = 0
		let native = 0
		let priced = true
		let free = true
		const turnTokens = { miss: 0, read: 0, write: 0, out: 0 }
		for (const contribution of contributions) {
			turnTokens.miss += contribution.miss
			turnTokens.read += contribution.read
			turnTokens.write += contribution.write
			turnTokens.out += contribution.out
			const result = priceContribution(state, contribution, fxRate)
			if (result.unpriced === true || result.pendingFx !== undefined) {
				priced = false
				free = false
				if (result.pendingFx !== undefined) pendingFx.add(result.pendingFx)
				continue
			}
			cost += result.cost
			native += result.native
			if (result.free !== true) free = false
		}
		for (const key of ['miss', 'read', 'write', 'out']) tokens[key] += turnTokens[key]
		turns[turn] = {
			cost,
			native,
			currency: state.displayCurrency,
			tokens: turnTokens,
			priced,
			free: priced && free,
			services: { search: 0, fetch: 0 },
			serviceCost: 0,
		}
		total += cost
	}

	// 按请求计费的服务调用:搜索 / 抓取(每 1000 次成功请求 ¥5)
	const services = { search: 0, fetch: 0 }
	const serviceBreakdown = { search: 0, fetch: 0 }
	for (const [turn, counts] of Object.entries(summary.turnServices ?? {})) {
		const day = typeof counts.day === 'string' ? counts.day : undefined
		const entry = (turns[turn] ??= {
			cost: 0,
			native: 0,
			currency: state.displayCurrency,
			tokens: { miss: 0, read: 0, write: 0, out: 0 },
			priced: true,
			free: true,
			services: { search: 0, fetch: 0 },
			serviceCost: 0,
		})
		for (const key of SERVICE_KEYS) {
			const count = Number(counts[key]) || 0
			if (count <= 0) continue
			services[key] += count
			entry.services[key] = (entry.services[key] ?? 0) + count
			const price = servicePriceOf(state, key)
			if (price === undefined || day === undefined) continue
			const rate = fxRate(price.currency, state.displayCurrency, day)
			if (rate === undefined) {
				pendingFx.add(day)
				continue
			}
			const cost = count * price.perRequest * rate
			serviceBreakdown[key] += cost
			entry.cost += cost
			entry.serviceCost += cost
			entry.free = false
			total += cost
		}
	}
	// 检索内容 token(搜索/抓取结果进上下文):只做拆分,不额外计入 total
	const toolTokens = priceToolTokens(summary, state, fxRate)
	for (const [turn, info] of Object.entries(toolTokens.perTurn)) {
		const entry = turns[turn]
		if (entry === undefined) continue
		entry.toolTokens = info.tokens
		entry.toolTokenCost = { miss: info.miss, read: info.read }
	}
	return {
		turns,
		total,
		tokens,
		services,
		serviceCost: serviceBreakdown.search + serviceBreakdown.fetch,
		serviceBreakdown,
		toolTokens: toolTokens.tokens,
		toolTokenCost: toolTokens.cost,
		unpriced: summary.unpriced ?? {},
		pendingFx: [...pendingFx],
	}
}

/**
 * 给全部会话按日/按路由汇总。
 *
 * @param sessions 会话 id -> 折叠摘要。
 * @returns {{days: Record<string, {day: string, total: number, tokens: object, routes: object}>, total: number, tokens: object, byRoute: object, unpriced: object, pendingFx: string[]}}
 */
export function priceOverview(sessions, state, fxRate) {
	const days = {}
	const byRoute = {}
	const unpriced = {}
	const pendingFx = new Set()
	let total = 0
	const tokens = { miss: 0, read: 0, write: 0, out: 0 }
	const services = { search: 0, fetch: 0 }
	const serviceBreakdown = { search: 0, fetch: 0 }
	const toolTotals = { tokens: { search: 0, fetch: 0, total: 0 }, cost: { miss: 0, read: 0 } }
	for (const summary of Object.values(sessions)) {
		const tools = priceToolTokens(summary, state, fxRate)
		toolTotals.tokens.search += tools.tokens.search
		toolTotals.tokens.fetch += tools.tokens.fetch
		toolTotals.tokens.total += tools.tokens.total
		toolTotals.cost.miss += tools.cost.miss
		toolTotals.cost.read += tools.cost.read
		for (const [day, counts] of Object.entries(summary.servicesByDay ?? {})) {
			const dayEntry = (days[day] ??= { day, total: 0, tokens: { miss: 0, read: 0, write: 0, out: 0 }, routes: {} })
			let dayCost = 0
			for (const key of SERVICE_KEYS) {
				const count = Number(counts[key]) || 0
				if (count <= 0) continue
				services[key] += count
				const price = servicePriceOf(state, key)
				if (price === undefined) continue
				const rate = fxRate(price.currency, state.displayCurrency, day)
				if (rate === undefined) {
					pendingFx.add(day)
					continue
				}
				const cost = count * price.perRequest * rate
				serviceBreakdown[key] += cost
				dayCost += cost
				total += cost
			}
			dayEntry.total += dayCost
			dayEntry.services = { search: counts.search ?? 0, fetch: counts.fetch ?? 0, cost: dayCost }
		}
		for (const [day, routes] of Object.entries(summary.days ?? {})) {
			const dayEntry = (days[day] ??= { day, total: 0, tokens: { miss: 0, read: 0, write: 0, out: 0 }, routes: {} })
			for (const [routeKey, tiers] of Object.entries(routes)) {
				const route = resolveRoute(state, routeKey)
				const routeEntry = (byRoute[routeKey] ??= {
					route: routeKey,
					mode: route.mode,
					priceModel: route.priceModel,
					currency: route.currency ?? state.displayCurrency,
					total: 0,
					tokens: { miss: 0, read: 0, write: 0, out: 0 },
				})
				for (const [tier, segments] of Object.entries(tiers)) {
					for (const [segId, bucket] of Object.entries(segments)) {
						for (const key of ['miss', 'read', 'write', 'out']) {
							dayEntry.tokens[key] += bucket[key]
							routeEntry.tokens[key] += bucket[key]
							tokens[key] += bucket[key]
						}
						if (route.mode === 'free') {
							dayEntry.routes[routeKey] ??= 0
							routeEntry.mode = 'free'
							continue
						}
						if (route.mode !== 'priced') continue
						const model = state.priceModels[route.priceModel]
						const segment = findSegmentById(model, tier, segId)
						if (segment === undefined) continue
						const native = segmentCost(segment, bucket)
						const rate = fxRate(route.currency, state.displayCurrency, day)
						if (rate === undefined) {
							pendingFx.add(day)
							continue
						}
						const cost = native * rate
						dayEntry.total += cost
						dayEntry.routes[routeKey] = (dayEntry.routes[routeKey] ?? 0) + cost
						routeEntry.total += cost
						total += cost
					}
				}
			}
		}
		for (const [routeKey, bucket] of Object.entries(summary.unpriced ?? {})) {
			const entry = (unpriced[routeKey] ??= { route: routeKey, miss: 0, read: 0, write: 0, out: 0, events: 0 })
			for (const key of ['miss', 'read', 'write', 'out']) entry[key] += bucket[key]
			entry.events += bucket.events
		}
	}
	return {
		days,
		total,
		tokens,
		byRoute,
		unpriced,
		pendingFx: [...pendingFx],
		services: { search: services.search, fetch: services.fetch, cost: serviceBreakdown.search + serviceBreakdown.fetch },
		serviceBreakdown,
		toolTokens: { search: toolTotals.tokens.search, fetch: toolTotals.tokens.fetch, total: toolTotals.tokens.total },
		toolTokenCost: toolTotals.cost,
	}
}

/** 计算需要采集汇率的 (base, quote, day) 组合。 */
export function neededFxPairs(sessions, state) {
	const display = state.displayCurrency
	const pairs = new Set()
	const consider = (routeKey, day) => {
		const route = resolveRoute(state, routeKey)
		if (route.mode !== 'priced') return
		if (route.currency === display) return
		const key = `${route.currency}>${display}|${day}`
		if (state.fx?.[`${route.currency}>${display}`]?.[day] !== undefined) return
		pairs.add(key)
	}
	const considerService = (day) => {
		for (const key of SERVICE_KEYS) {
			const price = servicePriceOf(state, key)
			if (price === undefined || price.currency === display) continue
			if (state.fx?.[`${price.currency}>${display}`]?.[day] !== undefined) continue
			pairs.add(`${price.currency}>${display}|${day}`)
		}
	}
	for (const summary of Object.values(sessions)) {
		for (const [day, routes] of Object.entries(summary.days ?? {})) {
			for (const routeKey of Object.keys(routes)) consider(routeKey, day)
		}
		for (const day of Object.keys(summary.servicesByDay ?? {})) considerService(day)
	}
	return [...pairs].map((key) => {
		const [pair, day] = key.split('|')
		const [base, quote] = pair.split('>')
		return { base, quote, day }
	})
}
