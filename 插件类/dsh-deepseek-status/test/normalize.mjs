/**
 * 宿主半归一化自测:纯函数用固定样本,采集器用线上真实接口(失败即报错)。
 * 运行:node test/normalize.mjs
 */

import { normalize, createStatusService, SOURCE_URL } from '../lib/status.js'

let failed = 0
function check(name, ok, detail) {
	if (ok) {
		console.log('  ok   ' + name)
		return
	}
	failed += 1
	console.log('  FAIL ' + name + (detail === undefined ? '' : ' → ' + detail))
}

function component(id, name) {
	return { component_id: id, name, description: '', order_id: 1 }
}

// ---------- 1. 无当前事件 → operational ----------
const page = {
	components: [component('cmp-pro', 'DeepSeek V4 Pro API服务'), component('cmp-chat', '对话服务')],
	name: 'DeepSeek',
}
const empty = normalize({
	active: { data: { page, active_changes: [] } },
	changes: {
		data: {
			items: [
				{
					change_id: 1,
					type: 'incident',
					status: 'resolved',
					title: 'DeepSeek 网页/API 部分中断（DeepSeek Web/API Partially Unavailable）',
					close_at_seconds: 1000,
					updates: [{ at_seconds: 900, status: 'resolved', description: '已恢复' }],
				},
			],
		},
	},
	structure: { data: { component_uptimes: [{ component_id: 'cmp-pro', uptime: 99.4 }] } },
	now: 1234567890,
})
check('no active change → operational', empty.overall === 'operational', empty.overall)
check('components default to operational', empty.components.every((item) => item.status === 'operational'))
check('uptime joined to component', empty.components[0].uptime === 99.4)
check('recent incident kept and truncated', empty.recentIncidents.length === 1 && empty.recentIncidents[0].title.endsWith('…'))
check('checkedAt passthrough', empty.checkedAt === 1234567890)
check('source is the status page', empty.source === SOURCE_URL)

// ---------- 2. 当前事件:最严重组件状态决定整体 ----------
const activeChange = {
	change_id: 2,
	type: 'incident',
	status: 'investigating',
	title: 'DeepSeek API 故障',
	start_at_seconds: 2000,
	close_at_seconds: null,
	updates: [
		{ at_seconds: 2010, status: 'investigating', description: '排查中', component_changes: [{ component_id: 'cmp-chat', status: 'degraded' }] },
		{ at_seconds: 2020, status: 'identified', description: '已定位', component_changes: [{ component_id: 'cmp-pro', status: 'partial_outage' }] },
	],
}
const outage = normalize({
	active: { data: { page, active_changes: [activeChange] } },
	changes: { data: { items: [{ ...activeChange }] } },
	structure: undefined,
	now: 3000,
})
check('active incident → partial_outage (worst component status)', outage.overall === 'partial_outage', outage.overall)
check('active change published', outage.activeChanges.length === 1 && outage.activeChanges[0].title === 'DeepSeek API 故障')
check('latest update wins', outage.activeChanges[0].latestUpdate.status === 'identified')
check('component status from latest update', outage.components.find((item) => item.id === 'cmp-pro').status === 'partial_outage')
check('unaffected component stays operational', outage.components.find((item) => item.id === 'cmp-chat').status === 'operational')
check('no uptime when structure missing', outage.components[0].uptime === undefined)

// ---------- 3. 只有计划维护 → maintenance ----------
const maintenance = normalize({
	active: {
		data: {
			page,
			active_changes: [{ change_id: 3, type: 'maintenance', status: 'in_progress', title: '计划维护', close_at_seconds: null, updates: [] }],
		},
	},
	changes: { data: { items: [] } },
	structure: undefined,
	now: 4000,
})
check('maintenance only → maintenance', maintenance.overall === 'maintenance', maintenance.overall)

// ---------- 4. 活动事件缺 active_changes 时从事件列表兜底 ----------
const fallback = normalize({
	active: { data: { page } },
	changes: { data: { items: [activeChange] } },
	structure: undefined,
	now: 5000,
})
check('open item in list picked up as active', fallback.activeChanges.length === 1)
check('fallback overall', fallback.overall === 'partial_outage', fallback.overall)

// ---------- 4b. 逐日状态格子 ----------
const historyNow = Date.UTC(2026, 10, 3, 12, 0, 0) // 2026-11-03 20:00 +08
const sinceSeconds = Date.UTC(2026, 9, 30, 0, 0, 0) / 1000 // 2026-10-30 08:00 +08
const impact = {
	component_id: 'cmp-pro',
	status: 'degraded',
	start_at_seconds: Date.UTC(2026, 10, 1, 2, 0, 0) / 1000, // 2026-11-01 10:00 +08
	end_at_seconds: Date.UTC(2026, 10, 1, 4, 0, 0) / 1000,
}
const historyPage = { components: [{ ...component('cmp-pro', 'DeepSeek V4 Pro API服务'), available_since_seconds: sinceSeconds }], name: 'DeepSeek' }
const withHistory = normalize({
	active: { data: { page: historyPage, active_changes: [] } },
	changes: { data: { items: [] } },
	structure: { data: { component_uptimes: [{ component_id: 'cmp-pro', uptime: 99.4 }], component_impacts: [impact] } },
	now: historyNow,
})
const history = withHistory.components[0].history
const dayOf = (day) => history.find((entry) => entry.day === day)
check('30 天逐日格子', Array.isArray(history) && history.length === 30, history && history.length)
check('最后一格是今天(Asia/Shanghai)', history[29].day === '2026-11-03', history[29].day)
check('有影响的那天标 degraded', dayOf('2026-11-01').status === 'degraded', dayOf('2026-11-01').status)
check('无影响的日子标 operational', dayOf('2026-11-02').status === 'operational', dayOf('2026-11-02').status)
check('组件上线前的日子标 unknown', dayOf('2026-10-29').status === 'unknown', dayOf('2026-10-29').status)
check('上线当天标 operational', dayOf('2026-10-30').status === 'operational', dayOf('2026-10-30').status)

// ---------- 5. 线上真实接口 ----------
const service = createStatusService({})
const live = await service.get(true)
if (live.ok !== true) {
	failed += 1
	console.log('  FAIL live fetch → ' + live.error)
} else {
	const known = ['operational', 'degraded', 'partial_outage', 'full_outage', 'maintenance']
	check('live overall is a known value', known.indexOf(live.overall) !== -1, live.overall)
	check('live components non-empty', Array.isArray(live.components) && live.components.length > 0, String(live.components.length))
	check('live history is 30 days each', live.components.every((item) => Array.isArray(item.history) && item.history.length === 30))
	check('live checkedAt is recent', Math.abs(Date.now() - live.checkedAt) < 60 * 1000)
	const cached = await service.get(false)
	check('second read served from cache', cached.cached === true)
	console.log('\n  线上快照:' + JSON.stringify({ overall: live.overall, components: live.components.length, active: live.activeChanges.length, recent: live.recentIncidents.length }))
	for (const item of live.components) {
		console.log('    - ' + item.name + ' · ' + item.status + (item.uptime === undefined ? '' : ' · ' + item.uptime.toFixed(2) + '%'))
	}
	for (const item of live.recentIncidents) console.log('    * ' + new Date(item.closedAt).toISOString() + ' ' + item.title)
}

if (failed > 0) {
	console.error('\n' + failed + ' 项失败')
	process.exit(1)
}
console.log('\n全部通过')
