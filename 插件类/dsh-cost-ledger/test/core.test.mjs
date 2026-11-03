/**
 * 纯函数单元测试:价格页解析、峰谷判定、折叠、计价、汇率缺口语义。
 * 运行:node --test test/
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { parsePricingHtml, parsePeakWindows } from '../lib/pricing.js'
import { isPeak, localDate, recentDays } from '../lib/time.js'
import { buildPriceIndex, foldSession, resolveSegment, routeKey, resolveRoute } from '../lib/fold.js'
import { priceOverview, priceSession, neededFxPairs, segmentCost } from '../lib/price.js'

const FIXTURE = fs.readFileSync(new URL('./fixtures/pricing.html', import.meta.url), 'utf8')

test('解析官方价目页:模型、两档价格、峰时段', () => {
	const parsed = parsePricingHtml(FIXTURE)
	assert.equal(parsed.currency, 'USD')
	assert.deepEqual(parsed.models.map((m) => m.id), ['deepseek-flash', 'deepseek-v4-pro'])
	assert.deepEqual(parsed.models[0].hit, { offpeak: 0.003, peak: 0.006 })
	assert.deepEqual(parsed.models[0].miss, { offpeak: 0.15, peak: 0.3 })
	assert.deepEqual(parsed.models[0].output, { offpeak: 0.6, peak: 1.2 })
	assert.deepEqual(parsed.models[1].miss, { offpeak: 0.66, peak: 1.32 })
	assert.deepEqual(parsed.peakWindowsUtc, [
		{ startMinute: 60, endMinute: 240 },
		{ startMinute: 360, endMinute: 600 },
	])
})

test('峰谷判定:UTC 工作日窗口内为峰,周末/节假日为谷', () => {
	// 2026-10-20 是周二。UTC 02:30 -> 峰;UTC 05:00 -> 谷。
	const peak = Date.parse('2026-10-20T02:30:00Z')
	const offpeak = Date.parse('2026-10-20T05:00:00Z')
	assert.equal(isPeak(peak), true)
	assert.equal(isPeak(offpeak), false)
	// 2026-10-17 是周六。
	assert.equal(isPeak(Date.parse('2026-10-17T02:30:00Z')), false)
	// 节假日(本地日)按低谷。
	assert.equal(isPeak(peak, { holidays: [localDate(peak)] }), false)
	assert.equal(localDate(Date.parse('2026-10-16T16:30:00Z')), '2026-10-17')
})

test('价格段解析:同一档位取 from <= ts 的最后一段', () => {
	const state = {
		priceModels: {
			m: {
				currency: 'USD',
				segments: {
					peak: [
						{ id: 'a', from: 0, cacheRead: 1, cacheMiss: 2, cacheWrite: 2, output: 3 },
						{ id: 'b', from: 1000, cacheRead: 4, cacheMiss: 5, cacheWrite: 5, output: 6 },
					],
					offpeak: [{ id: 'c', from: 0, cacheRead: 1, cacheMiss: 2, cacheWrite: 2, output: 3 }],
				},
			},
		},
	}
	const index = buildPriceIndex(state)
	assert.equal(resolveSegment(index, 'm', 'peak', 500).id, 'a')
	assert.equal(resolveSegment(index, 'm', 'peak', 1000).id, 'b')
	assert.equal(resolveSegment(index, 'm', 'peak', 0).id, 'a')
	assert.equal(resolveSegment(index, 'm', 'offpeak', 9999).id, 'c')
	assert.equal(resolveSegment(index, 'm', 'peak', -1), undefined)
})

test('折叠:按日/路由/档位/价格段分桶,并记录每轮归因', () => {
	const state = {
		displayCurrency: 'CNY',
		holidays: [],
		peakWindowsUtc: [
			{ startMinute: 60, endMinute: 240 },
			{ startMinute: 360, endMinute: 600 },
		],
		priceModels: {
			'deepseek-flash': {
				currency: 'USD',
				segments: {
					peak: [{ id: 'p1', from: 0, cacheRead: 0.006, cacheMiss: 0.3, cacheWrite: 0.3, output: 1.2 }],
					offpeak: [{ id: 'o1', from: 0, cacheRead: 0.003, cacheMiss: 0.15, cacheWrite: 0.15, output: 0.6 }],
				},
			},
		},
		routes: {
			'deepseek-official/deepseek-flash': { priceModel: 'deepseek-flash' },
			'openrouter/free-model:free': { mode: 'free' },
			'other/unpriced': { mode: 'unpriced' },
		},
	}
	const t = Date.parse('2026-10-20T02:30:00Z') // 周二 UTC 02:30 = 峰
	const events = [
		{ type: 'assistant/message', seq: 1, time: t, data: {
			turn: 1, step: 1,
			message: { source: { provider: 'deepseek-official', model: 'deepseek-flash' } },
			usage: { inputTokens: 1000, cacheReadTokens: 2000, cacheWriteTokens: 0, outputTokens: 300 },
		} },
		{ type: 'assistant/message', seq: 2, time: Date.parse('2026-10-20T05:00:00Z'), data: {
			turn: 2, step: 1,
			message: { source: { provider: 'deepseek-official', model: 'deepseek-flash' } },
			usage: { inputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 5, outputTokens: 30 },
		} },
		{ type: 'assistant/message', seq: 3, time: t, data: {
			turn: 2, step: 2,
			message: { source: { provider: 'openrouter', model: 'free-model:free' } },
			usage: { inputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 1 },
		} },
		{ type: 'assistant/message', seq: 4, time: t, data: {
			turn: 3, step: 1,
			message: { source: { provider: 'other', model: 'unpriced' } },
			usage: { inputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 9 },
		} },
	]
	const summary = foldSession(events, { state })
	assert.equal(summary.lastSeq, 4)
	const day = '2026-10-20'
	const peakBucket = summary.days[day]['deepseek-official/deepseek-flash'].peak.p1
	assert.deepEqual({ miss: peakBucket.miss, read: peakBucket.read, out: peakBucket.out }, { miss: 1000, read: 2000, out: 300 })
	const offBucket = summary.days[day]['deepseek-official/deepseek-flash'].offpeak.o1
	assert.deepEqual({ miss: offBucket.miss, read: offBucket.read, write: offBucket.write, out: offBucket.out }, { miss: 10, read: 20, write: 5, out: 30 })
	assert.equal(summary.days[day]['openrouter/free-model:free'].peak.free.events, 1)
	assert.equal(summary.unpriced['other/unpriced'].events, 1)
	assert.equal(summary.turns[1][0].seg, 'p1')
	assert.equal(summary.turns[2].length, 2)
})

test('计价:三档输入价 + 输出价,按当日汇率折算', () => {
	const state = {
		displayCurrency: 'CNY',
		currencies: ['CNY', 'USD'],
		holidays: [],
		peakWindowsUtc: [],
		priceModels: {
			'deepseek-flash': {
				currency: 'USD',
				segments: {
					peak: [{ id: 'p1', from: 0, cacheRead: 0.006, cacheMiss: 0.3, cacheWrite: 0.3, output: 1.2 }],
					offpeak: [{ id: 'o1', from: 0, cacheRead: 0.003, cacheMiss: 0.15, cacheWrite: 0.15, output: 0.6 }],
				},
			},
		},
		routes: { 'deepseek-official/deepseek-flash': { priceModel: 'deepseek-flash' } },
		fx: { 'USD>CNY': { '2026-10-20': { base: 'USD', quote: 'CNY', rate: 7, asOf: '2026-10-20' } } },
	}
	const summary = {
		days: {}, unpriced: {},
		turns: {
			1: [{ route: 'deepseek-official/deepseek-flash', tier: 'peak', seg: 'p1', day: '2026-10-20', miss: 1000000, read: 1000000, write: 0, out: 1000000 }],
			2: [{ route: 'deepseek-official/deepseek-flash', tier: 'offpeak', seg: 'o1', day: '2026-10-20', miss: 0, read: 0, write: 0, out: 1000000 }],
		},
	}
	const fxRate = (base, quote, day) => (base === quote ? 1 : state.fx[`${base}>${quote}`]?.[day]?.rate)
	const priced = priceSession(summary, state, fxRate)
	// 峰:0.3 + 0.006 + 1.2 = 1.506 USD -> 10.542 CNY
	assert.ok(Math.abs(priced.turns[1].native - 1.506) < 1e-9)
	assert.ok(Math.abs(priced.turns[1].cost - 1.506 * 7) < 1e-9)
	// 谷:0.6 USD -> 4.2 CNY
	assert.ok(Math.abs(priced.turns[2].cost - 0.6 * 7) < 1e-9)
	assert.ok(Math.abs(priced.total - (1.506 + 0.6) * 7) < 1e-9)
})

test('计价:缺少当日汇率时标为 pending,不硬算', () => {
	const state = {
		displayCurrency: 'CNY',
		holidays: [],
		peakWindowsUtc: [],
		priceModels: { m: { currency: 'USD', segments: { peak: [{ id: 's', from: 0, cacheRead: 1, cacheMiss: 1, cacheWrite: 1, output: 1 }], offpeak: [] } } },
		routes: { 'p/m': { priceModel: 'm' } },
		fx: {},
	}
	const summary = { days: {}, unpriced: {}, turns: { 1: [{ route: 'p/m', tier: 'peak', seg: 's', day: '2026-10-20', miss: 1, read: 0, write: 0, out: 0 }] } }
	const priced = priceSession(summary, state, (base, quote, day) => (base === quote ? 1 : undefined))
	assert.equal(priced.total, 0)
	assert.deepEqual(priced.pendingFx, ['2026-10-20'])
	assert.equal(priced.turns[1].priced, false)
})

test('汇率缺口:只为有费用的日子生成采集任务,已有汇率不重复', () => {
	const state = {
		displayCurrency: 'CNY',
		holidays: [],
		peakWindowsUtc: [],
		priceModels: { m: { currency: 'USD', segments: { peak: [{ id: 's', from: 0, cacheRead: 1, cacheMiss: 1, cacheWrite: 1, output: 1 }], offpeak: [] } } },
		routes: { 'p/m': { priceModel: 'm' } },
		fx: { 'USD>CNY': { '2026-10-19': { rate: 7 } } },
	}
	const sessions = {
		a: { days: { '2026-10-19': { 'p/m': { peak: { s: { miss: 1, read: 0, write: 0, out: 0, events: 1 } } } }, '2026-10-20': { 'p/m': { peak: { s: { miss: 1, read: 0, write: 0, out: 0, events: 1 } } } } }, unpriced: {} },
		b: { days: { '2026-10-20': { 'p/m': { peak: { s: { miss: 1, read: 0, write: 0, out: 0, events: 1 } } } } }, unpriced: {} },
	}
	const pairs = neededFxPairs(sessions, state)
	assert.deepEqual(pairs, [{ base: 'USD', quote: 'CNY', day: '2026-10-20' }])
})

test('每日汇总:按日聚合与按路由聚合一致', () => {
	const state = {
		displayCurrency: 'CNY',
		holidays: [],
		peakWindowsUtc: [],
		priceModels: { m: { currency: 'CNY', segments: { peak: [{ id: 's', from: 0, cacheRead: 1, cacheMiss: 2, cacheWrite: 2, output: 4 }], offpeak: [] } } },
		routes: { 'p/m': { priceModel: 'm' } },
		fx: {},
	}
	const bucket = { miss: 1000000, read: 1000000, write: 0, out: 1000000, events: 1 }
	const sessions = {
		a: { days: { '2026-10-19': { 'p/m': { peak: { s: bucket } } }, '2026-10-20': { 'p/m': { peak: { s: bucket } } } }, unpriced: {} },
		b: { days: { '2026-10-20': { 'p/m': { peak: { s: bucket } } } }, unpriced: {} },
	}
	const fxRate = (base, quote) => (base === quote ? 1 : undefined)
	const priced = priceOverview(sessions, state, fxRate)
	assert.equal(priced.total, 3 * (2 + 1 + 4))
	assert.equal(priced.days['2026-10-20'].total, 2 * (2 + 1 + 4))
	assert.equal(priced.byRoute['p/m'].total, priced.total)
})

test('价格段单段计算:cacheWrite 缺省按 cacheMiss', () => {
	const cost = segmentCost({ cacheRead: 1, cacheMiss: 2, output: 3 }, { miss: 1e6, read: 1e6, write: 1e6, out: 1e6 })
	assert.equal(cost, 1 + 2 + 2 + 3)
})

test('路由解析:free/未定价/带价格模型', () => {
	const state = {
		priceModels: { m: { currency: 'USD', segments: {} } },
		routes: { 'a/b': { priceModel: 'm' }, 'f/x:free': { mode: 'free' }, 'u/x': { mode: 'unpriced' } },
	}
	assert.equal(resolveRoute(state, 'a/b').mode, 'priced')
	assert.equal(resolveRoute(state, 'f/x:free').mode, 'free')
	assert.equal(resolveRoute(state, 'u/x').mode, 'unpriced')
	assert.equal(resolveRoute(state, 'x/y:free').mode, 'free')
	assert.equal(resolveRoute(state, 'unknown/model').mode, 'unpriced')
})

test('近 N 日序列:升序且以今天结尾', () => {
	const days = recentDays(3, Date.parse('2026-10-17T04:00:00Z'))
	assert.deepEqual(days, ['2026-10-15', '2026-10-16', '2026-10-17'])
})
