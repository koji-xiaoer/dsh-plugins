/**
 * DeepSeek 服务状态采集与归一化(status.deepseek.com)。
 *
 * 数据源是 Flashcat 托管的状态页,浏览器端没有 CORS 头,所以只能由宿主半在服务端抓取,
 * 再通过同源路由交给客户端胶囊使用。这里只做三件事:
 *   1. 抓 active summary(组件清单 + 当前事件)、change list(近 30 天事件)、structure(组件可用率);
 *   2. 归一化成一个稳定的、与上游字段名解耦的快照对象;
 *   3. 带缓存,避免每次页面渲染都打上游(服务端 60s 快照、10min 可用率)。
 *
 * 上游字段变更时只需要改 normalize(),客户端胶囊只认快照里的 overall/components/…
 */

/** 状态页在当前状态页服务里的页面 ID(取自 status.deepseek.com 前端请求)。 */
const PAGE_ID = '6410630422455'
const ORIGIN = 'https://status.deepseek.com'
export const SOURCE_URL = ORIGIN + '/'

const REQUEST_TIMEOUT_MS = 8000
const SNAPSHOT_TTL_MS = 60 * 1000
const STRUCTURE_TTL_MS = 10 * 60 * 1000
const UPTIME_WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
// 状态页是面向国内的服务页,逐日格子按 Asia/Shanghai(UTC+8)切天。
const DAY_OFFSET_MS = 8 * 60 * 60 * 1000
const RECENT_INCIDENT_LIMIT = 3
const COMPONENT_LIMIT = 12
const TITLE_LIMIT = 56

/** 严重度排序:数值越大越严重。整体状态取"当前事件里最严重的组件状态"。 */
const SEVERITY = {
	operational: 0,
	maintenance: 1,
	degraded: 2,
	partial_outage: 3,
	full_outage: 4,
}

/** 上游把已结束的事件标成这些状态;其余状态一律视为未结束。 */
const CLOSED_STATUS = new Set(['resolved', 'completed', 'canceled', 'cancelled', 'postmortem'])

function asNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asString(value) {
	return typeof value === 'string' && value !== '' ? value : undefined
}

function severityOf(status) {
	return SEVERITY[status] === undefined ? -1 : SEVERITY[status]
}

async function getJson(url) {
	const response = await fetch(url, {
		headers: { accept: 'application/json' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
	if (response.ok !== true) throw new Error(`HTTP ${response.status} ${url}`)
	const payload = await response.json()
	if (payload === null || typeof payload !== 'object') throw new Error(`响应不是 JSON 对象 ${url}`)
	return payload
}

/** 近 N 天的秒级时间窗,供 change list / structure 使用。 */
function windowRange(nowMs) {
	const to = Math.floor(nowMs / 1000)
	const from = to - UPTIME_WINDOW_DAYS * 24 * 60 * 60
	return { from, to }
}

/** 事件的最新一条 update(按 at_seconds 取最大)。 */
function latestUpdate(change) {
	const updates = Array.isArray(change?.updates) ? change.updates.filter((item) => item !== null && typeof item === 'object') : []
	if (updates.length === 0) return undefined
	let best = updates[0]
	for (const item of updates) {
		if ((asNumber(item.at_seconds) ?? 0) >= (asNumber(best.at_seconds) ?? 0)) best = item
	}
	return best
}

/** 是否仍是当前事件:没有结束时间,且状态不是已解决。 */
function isOpenChange(change) {
	if (change === null || typeof change !== 'object') return false
	const closeAt = change.close_at_seconds
	if (closeAt !== null && closeAt !== undefined) return false
	const status = asString(change.status)
	if (status !== undefined && CLOSED_STATUS.has(status.toLowerCase())) return false
	return true
}

/**
 * 逐日状态格子:把 component_impacts 落到"最后 30 天,每天一格"的本地日上。
 * 一天里最严重的那次影响决定该格状态;组件上线前的日子标记 unknown。
 */
function localDayStart(ms) {
	return Math.floor((ms + DAY_OFFSET_MS) / DAY_MS) * DAY_MS - DAY_OFFSET_MS
}

function localDayKey(startMs) {
	return new Date(startMs + DAY_OFFSET_MS).toISOString().slice(0, 10)
}

function buildHistory(nowMs, impacts, availableSinceSeconds) {
	const history = []
	const todayStart = localDayStart(nowMs)
	const availableSinceMs = asNumber(availableSinceSeconds) === undefined ? undefined : availableSinceSeconds * 1000
	for (let offset = UPTIME_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
		const start = todayStart - offset * DAY_MS
		const end = start + DAY_MS
		let status = 'operational'
		for (const impact of impacts) {
			if (impact.endMs <= start || impact.startMs >= end) continue
			if (severityOf(impact.status) > severityOf(status)) status = impact.status
		}
		if (availableSinceMs !== undefined && end <= availableSinceMs) status = 'unknown'
		history.push({ day: localDayKey(start), status: SEVERITY[status] === undefined ? 'unknown' : status })
	}
	return history
}

/** component_id -> 影响区间(毫秒),按天聚合用。 */
function impactsByComponent(structure) {
	const map = new Map()
	const list = structure?.data?.component_impacts
	if (!Array.isArray(list)) return map
	for (const item of list) {
		const id = asString(item?.component_id)
		const startSeconds = asNumber(item?.start_at_seconds)
		const status = asString(item?.status)
		if (id === undefined || startSeconds === undefined || status === undefined) continue
		if (SEVERITY[status] === undefined) continue
		const endSeconds = asNumber(item?.end_at_seconds)
		if (!map.has(id)) map.set(id, [])
		map.get(id).push({
			startMs: startSeconds * 1000,
			endMs: endSeconds === undefined ? Number.MAX_SAFE_INTEGER : endSeconds * 1000,
			status,
		})
	}
	return map
}

/** 组件可用率表:component_id -> 百分比。 */
function uptimeMap(structure) {
	const map = new Map()
	const list = structure?.data?.component_uptimes
	if (!Array.isArray(list)) return map
	for (const item of list) {
		const id = asString(item?.component_id)
		const uptime = asNumber(item?.uptime)
		if (id !== undefined && uptime !== undefined) map.set(id, uptime)
	}
	return map
}

/** 从当前事件里推导每个组件此刻的状态(取最严重的一条)。 */
function componentStatusMap(activeChanges) {
	const map = new Map()
	for (const change of activeChanges) {
		const update = latestUpdate(change)
		const lists = [update?.component_changes, change?.affected_components]
		for (const list of lists) {
			if (!Array.isArray(list)) continue
			for (const item of list) {
				const id = asString(item?.component_id)
				const status = asString(item?.status)
				if (id === undefined || status === undefined) continue
				const normalized = status.toLowerCase()
				const current = map.get(id)
				if (current === undefined || severityOf(normalized) > severityOf(current)) map.set(id, normalized)
			}
		}
	}
	return map
}

function cutTitle(title) {
	if (typeof title !== 'string') return ''
	return title.length <= TITLE_LIMIT ? title : title.slice(0, TITLE_LIMIT - 1) + '…'
}

/**
 * 整体状态:
 *   没有当前事件 → operational
 *   只有计划维护 → maintenance
 *   有当前事件 → 取组件状态里最严重的一档;没有组件状态时至少算 degraded
 */
function overallOf(activeChanges, statusMap) {
	if (activeChanges.length === 0) return 'operational'
	const onlyMaintenance = activeChanges.every((change) => asString(change.type) === 'maintenance')
	let worst = 'operational'
	for (const status of statusMap.values()) {
		if (severityOf(status) > severityOf(worst)) worst = status
	}
	if (worst === 'operational') return onlyMaintenance ? 'maintenance' : 'degraded'
	if (worst === 'maintenance' && onlyMaintenance !== true) return 'degraded'
	return worst
}

function pickActiveChanges(activePayload, changesPayload) {
	const fromActive = Array.isArray(activePayload?.data?.active_changes) ? activePayload.data.active_changes.filter(isOpenChange) : []
	if (fromActive.length > 0) return fromActive
	// 兜底:active_changes 缺失时,从事件列表里找没结束的那条。
	const items = Array.isArray(changesPayload?.data?.items) ? changesPayload.data.items : []
	return items.filter(isOpenChange)
}

function recentIncidents(changesPayload) {
	const items = Array.isArray(changesPayload?.data?.items) ? changesPayload.data.items : []
	const incidents = []
	for (const item of items) {
		if (asString(item?.type) !== 'incident') continue
		const closedAt = asNumber(item?.close_at_seconds)
		if (closedAt === undefined) continue
		incidents.push({
			id: String(item?.change_id ?? ''),
			title: cutTitle(item?.title),
			status: asString(item?.status) ?? 'resolved',
			closedAt: closedAt * 1000,
		})
	}
	incidents.sort((a, b) => b.closedAt - a.closedAt)
	return incidents.slice(0, RECENT_INCIDENT_LIMIT)
}

/**
 * 归一化上游三份数据。导出给测试直接喂固定样本,避免测试依赖线上数据。
 * @returns 快照对象(客户端胶囊的完整输入)
 */
export function normalize({ active, changes, structure, now }) {
	const checkedAt = asNumber(now) ?? Date.now()
	const page = active?.data?.page ?? {}
	const activeChanges = pickActiveChanges(active, changes)
	const statusMap = componentStatusMap(activeChanges)
	const uptimes = uptimeMap(structure)
	const histories = impactsByComponent(structure)

	const rawComponents = Array.isArray(page.components) ? page.components : []
	const components = []
	for (const item of rawComponents) {
		const id = asString(item?.component_id)
		if (id === undefined) continue
		const status = statusMap.get(id) ?? 'operational'
		components.push({
			id,
			name: asString(item?.name) ?? id,
			sectionId: asString(item?.section_id) ?? '',
			status: SEVERITY[status] === undefined ? 'unknown' : status,
			uptime: uptimes.has(id) ? uptimes.get(id) : undefined,
			availableSince: asNumber(item?.available_since_seconds),
			history: buildHistory(checkedAt, histories.get(id) ?? [], asNumber(item?.available_since_seconds)),
		})
	}

	const activeList = activeChanges.map((change) => {
		const update = latestUpdate(change)
		const startedAt = asNumber(change?.start_at_seconds)
		return {
			id: String(change?.change_id ?? ''),
			type: asString(change?.type) ?? 'incident',
			status: asString(change?.status) ?? 'investigating',
			title: cutTitle(change?.title),
			startedAt: startedAt === undefined ? undefined : startedAt * 1000,
			latestUpdate:
				update === undefined
					? undefined
					: {
							status: asString(update?.status) ?? '',
							description: cutTitle(update?.description) === '' ? '' : String(update?.description ?? ''),
							at: asNumber(update?.at_seconds) === undefined ? undefined : asNumber(update.at_seconds) * 1000,
						},
		}
	})

	return {
		ok: true,
		source: SOURCE_URL,
		pageId: PAGE_ID,
		pageName: asString(page.name) ?? 'DeepSeek',
		overall: overallOf(activeChanges, statusMap),
		uptimeWindowDays: UPTIME_WINDOW_DAYS,
		components: components.slice(0, COMPONENT_LIMIT),
		activeChanges: activeList,
		recentIncidents: recentIncidents(changes),
		checkedAt,
		cached: false,
	}
}

/**
 * 带缓存的采集器:同一进程内所有浏览器标签共用一个快照。
 * get(force) 返回与 normalize() 同构的对象;失败时最多返回上一份成功快照并标记 stale。
 */
export function createStatusService(options = {}) {
	const logger = options.logger
	let snapshot
	let structureCache
	let inflight
	let structureInflight

	async function loadStructure(force) {
		const now = Date.now()
		if (force !== true && structureCache !== undefined && now - structureCache.at < STRUCTURE_TTL_MS) return structureCache.data
		if (structureInflight !== undefined) return structureInflight
		structureInflight = (async () => {
			const window = windowRange(Date.now())
			const url =
				`${ORIGIN}/api/status-page/${PAGE_ID}/summary/structure` +
				`?start_at_from_seconds=${window.from}&start_at_to_seconds=${window.to}`
			try {
				const data = await getJson(url)
				structureCache = { at: Date.now(), data }
				return data
			} catch (error) {
				// 可用率只是附加信息,拿不到不影响胶囊的主状态。
				logger?.warn?.(`[deepseek-status] 拉取可用率失败:${error instanceof Error ? error.message : String(error)}`)
				return undefined
			} finally {
				structureInflight = undefined
			}
		})()
		return structureInflight
	}

	async function collect(force) {
		const now = Date.now()
		if (force !== true && snapshot !== undefined && now - snapshot.at < SNAPSHOT_TTL_MS) {
			return { ...snapshot.payload, cached: true }
		}
		if (inflight !== undefined) return inflight
		inflight = (async () => {
			const window = windowRange(Date.now())
			try {
				const [active, changes] = await Promise.all([
					getJson(`${ORIGIN}/api/status-page/${PAGE_ID}/summary/active`),
					getJson(`${ORIGIN}/api/status-page/${PAGE_ID}/change/list?start_at_seconds=${window.from}&end_at_seconds=${window.to}`),
				])
				const structure = await loadStructure(force)
				const payload = normalize({ active, changes, structure, now: Date.now() })
				snapshot = { at: payload.checkedAt, payload }
				return payload
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				logger?.warn?.(`[deepseek-status] 拉取状态页失败:${message}`)
				if (snapshot !== undefined) return { ...snapshot.payload, cached: true, stale: true, staleError: message }
				return { ok: false, source: SOURCE_URL, error: message, checkedAt: Date.now() }
			} finally {
				inflight = undefined
			}
		})()
		return inflight
	}

	return {
		get: (force) => collect(force === true),
	}
}

export const STATUS_PAGE_ID = PAGE_ID
export const STATUS_ORIGIN = ORIGIN
export const STATUS_SEVERITY = SEVERITY
