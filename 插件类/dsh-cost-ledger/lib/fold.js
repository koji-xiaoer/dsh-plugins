/**
 * 会话折叠:把会话日志里每条带 usage 的 assistant/message 归到
 * 本地日 / 路由 / 峰谷档 / 价格段 的 token 桶里。
 *
 * 折叠结果只存 token 与"当时适用哪个价格段",不存金额 —— 这样价格表、
 * 展示货币、汇率变化时都能直接重算,不必重读会话日志。
 *
 * 另外统计"按请求计费"的搜索 / 抓取调用(DeepSeek Search API / Fetch API,
 * 官方价每 1000 次成功请求 ¥5):从 tool/call + tool/result 配对统计,
 * 只记次数,金额同样在 price.js 里按当日汇率现算。
 *
 * 计费口径(与官方文档一致):
 *   - web_search:一次工具调用 = N 个查询 = N 次 Search 请求;仅当合并结果里
 *     至少有一条来源(非空结果列表)时才计费,N 取参数里的查询数(上界估计)。
 *   - web_fetch:一次调用 = 1 次 Fetch 请求;仅当结果 meta.statusCode === 200
 *     且没有报错时计费(失败、超时、非 200 不计费)。
 *
 * 另外估算"检索内容进入上下文"的 token(搜索/抓取结果的文本块):这部分 token
 * 已经包含在模型 usage 的输入里,单独记一份只用于拆分展示,不另计费。
 * 估算口径与 dsh 的 token-meter 一致(4 字符/token + 每块 4 + 消息框架 4)。
 */

import { isPeak, localDate } from './time.js'

/** 按请求计费的服务工具 → 服务键。 */
const SERVICE_TOOL = { web_search: "search", web_fetch: "fetch" }

/** token-meter 的影子价:4 字符/token,文本块 +4 结构开销,消息 +4 框架。 */
const CHARS_PER_TOKEN = 4

/** 估算一条 tool 结果消息在上下文里占用的 token(与 dsh token-meter 同口径)。 */
function estimateMessageTokens(message) {
	if (message === null || typeof message !== "object" || !Array.isArray(message.content)) return 0
	let tokens = 4
	for (const block of message.content) {
		if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
			tokens += Math.ceil(block.text.length / CHARS_PER_TOKEN) + 4
		} else {
			tokens += 4 + Math.ceil(JSON.stringify(block).length / CHARS_PER_TOKEN)
		}
	}
	return tokens
}

/** 一次 web_search 调用里的查询数(每个查询 = 一次 Search 请求)。 */
function searchQueryCount(args) {
	try {
		const parsed = typeof args === "string" ? JSON.parse(args) : args
		if (parsed !== null && typeof parsed === "object" && Array.isArray(parsed.queries) && parsed.queries.length > 0) return parsed.queries.length
	} catch {
		/* 参数不是 JSON 时按一次请求估算 */
	}
	return 1
}

/** web_search 是否产生了非空结果列表(空结果不计费)。 */
function searchHasSources(meta) {
	return meta !== null && typeof meta === "object" && Array.isArray(meta.sources) && meta.sources.length > 0
}

/** web_fetch 是否按官方口径计费(HTTP 200 且不是报错结果)。 */
function fetchBillable(meta, isError) {
	if (isError === true) return false
	return meta !== null && typeof meta === "object" && meta.statusCode === 200
}

/** 路由键:provider/model。 */
export function routeKey(provider, model) {
	return typeof provider === 'string' && provider !== '' ? `${provider}/${model}` : model
}

/** 解析路由的计价方式:free / priced / unpriced。 */
export function resolveRoute(state, key) {
	const route = state.routes?.[key]
	if (route !== undefined) {
		if (route.mode === 'free') return { mode: 'free' }
		if (route.mode === 'unpriced') return { mode: 'unpriced' }
		if (typeof route.priceModel === 'string' && state.priceModels?.[route.priceModel] !== undefined) {
			return { mode: 'priced', priceModel: route.priceModel, currency: state.priceModels[route.priceModel].currency ?? 'USD' }
		}
		return { mode: 'unpriced' }
	}
	if (typeof key === 'string' && key.endsWith(':free')) return { mode: 'free' }
	return { mode: 'unpriced' }
}

/** 构建价格段索引:{ priceModel: { peak: [...], offpeak: [...] } },数组按 from 升序。 */
export function buildPriceIndex(state) {
	const index = {}
	for (const [name, model] of Object.entries(state.priceModels ?? {})) {
		const tiers = {}
		for (const tier of ['peak', 'offpeak']) {
			const list = Array.isArray(model.segments?.[tier]) ? [...model.segments[tier]] : []
			list.sort((a, b) => a.from - b.from)
			tiers[tier] = list
		}
		index[name] = tiers
	}
	return index
}

/** 在索引里找 ts 时刻生效的价格段(最后一个 from <= ts)。 */
export function resolveSegment(index, priceModel, tier, ts) {
	const list = index?.[priceModel]?.[tier]
	if (!Array.isArray(list) || list.length === 0) return undefined
	let low = 0
	let high = list.length - 1
	let found
	while (low <= high) {
		const mid = (low + high) >> 1
		const segment = list[mid]
		if (segment.from <= ts) {
			found = segment
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	return found
}

/** 空折叠结果。 */
export function emptySummary() {
	return {
		lastSeq: 0,
		foldedAt: 0,
		days: {},
		turns: {},
		unpriced: {},
		messages: 0,
		assistantMessages: 0,
		usageMessages: 0,
		/** 按请求计费的服务调用次数(只统计可计费的成功请求)。 */
		services: { search: 0, fetch: 0 },
		/** 按日:servicesByDay['YYYY-MM-DD'] = { search, fetch }。 */
		servicesByDay: {},
		/** 按轮:turnServices[turn] = { search, fetch, day }。 */
		turnServices: {},
		/** 检索结果进入上下文占用的 token 估算(已含在模型 usage 里,仅用于拆分)。 */
		toolTokens: { search: 0, fetch: 0 },
		/** 按日:toolTokensByDay['YYYY-MM-DD'] = { search, fetch }。 */
		toolTokensByDay: {},
		/** 按轮:turnToolTokens[turn] = { search, fetch, day }。 */
		turnToolTokens: {},
	}
}

function addBuckets(target, usage) {
	target.miss += Number(usage.inputTokens) || 0
	target.read += Number(usage.cacheReadTokens) || 0
	target.write += Number(usage.cacheWriteTokens) || 0
	target.out += Number(usage.outputTokens) || 0
	target.events += 1
}

/**
 * 折叠一个会话的事件;纯函数,不读写磁盘。
 *
 * @param events 会话事件数组(按 seq 升序)。
 * @param options.state 账本状态(取路由/价格段/节假日/峰时段)。
 * @param options.index 预构建的价格段索引(不传则按 state 构建)。
 * @returns 折叠摘要。
 */
export function foldSession(events, { state, index = buildPriceIndex(state) }) {
	const summary = emptySummary()
	summary.foldedAt = Date.now()
	// 未收尾的工具调用:callId -> { service, turn, time, queries }
	const pendingCalls = new Map()
	const recordService = (call, result) => {
		const meta = result?.data?.meta
		const isError = result?.data?.message?.isError === true
		const day = localDate(call.time)
		// 检索内容 token:无论是否计费成功,只要结果文本进了上下文就估算一份。
		const tokens = estimateMessageTokens(result?.data?.message)
		if (tokens > 0) {
			summary.toolTokens[call.service] += tokens
			const tokenDay = (summary.toolTokensByDay[day] ??= { search: 0, fetch: 0 })
			tokenDay[call.service] += tokens
			if (typeof call.turn === "number") {
				const turnTokens = (summary.turnToolTokens[call.turn] ??= { search: 0, fetch: 0, day })
				turnTokens[call.service] += tokens
			}
		}
		// 按请求计费的成功次数。
		const billable = call.service === "search"
			? (searchHasSources(meta) ? call.queries : 0)
			: (fetchBillable(meta, isError) ? 1 : 0)
		if (billable <= 0) return
		summary.services[call.service] += billable
		const byDay = (summary.servicesByDay[day] ??= { search: 0, fetch: 0 })
		byDay[call.service] += billable
		if (typeof call.turn === "number") {
			const turnEntry = (summary.turnServices[call.turn] ??= { search: 0, fetch: 0, day })
			turnEntry[call.service] += billable
		}
	}
	for (const event of events) {
		if (typeof event?.seq === 'number' && event.seq > summary.lastSeq) summary.lastSeq = event.seq
		if (event?.type === "tool/call") {
			const service = SERVICE_TOOL[event.data?.name]
			const callId = event.data?.callId
			if (service !== undefined && typeof callId === "string") {
				pendingCalls.set(callId, {
					service,
					turn: event.data.turn,
					time: typeof event.time === "number" ? event.time : Date.now(),
					queries: service === "search" ? searchQueryCount(event.data.arguments) : 1,
				})
			}
			continue
		}
		if (event?.type === "tool/result") {
			const callId = event.data?.message?.toolCallId
			const call = typeof callId === "string" ? pendingCalls.get(callId) : undefined
			if (call !== undefined) {
				pendingCalls.delete(callId)
				recordService(call, event)
			}
			continue
		}
		if (event?.type !== 'assistant/message') continue
		summary.assistantMessages += 1
		const usage = event.data?.usage
		if (usage === undefined || usage === null) continue
		summary.usageMessages += 1
		const source = event.data?.message?.source
		const model = typeof source?.model === 'string' && source.model !== '' ? source.model : undefined
		if (model === undefined) continue
		const key = routeKey(source?.provider, model)
		const route = resolveRoute(state, key)
		const ts = typeof event.time === 'number' ? event.time : Date.now()
		const day = localDate(ts)
		const tier = isPeak(ts, { peakWindowsUtc: state.peakWindowsUtc, holidays: state.holidays }) ? 'peak' : 'offpeak'
		const segment = route.mode === 'priced' ? resolveSegment(index, route.priceModel, tier, ts) : undefined
		summary.messages += 1

		if (route.mode === 'unpriced' || (route.mode === 'priced' && segment === undefined)) {
			const bucket = (summary.unpriced[key] ??= { miss: 0, read: 0, write: 0, out: 0, events: 0 })
			addBuckets(bucket, usage)
		} else {
			const segId = route.mode === 'free' ? 'free' : segment.id
			const byDay = (summary.days[day] ??= {})
			const byRoute = (byDay[key] ??= {})
			const byTier = (byRoute[tier] ??= {})
			const bucket = (byTier[segId] ??= { miss: 0, read: 0, write: 0, out: 0, events: 0 })
			addBuckets(bucket, usage)
			const turn = event.data?.turn
			if (typeof turn === 'number') {
				const contributions = (summary.turns[turn] ??= [])
				contributions.push({
					route: key,
					tier,
					seg: segId,
					day,
					miss: Number(usage.inputTokens) || 0,
					read: Number(usage.cacheReadTokens) || 0,
					write: Number(usage.cacheWriteTokens) || 0,
					out: Number(usage.outputTokens) || 0,
				})
			}
		}
	}
	return summary
}
