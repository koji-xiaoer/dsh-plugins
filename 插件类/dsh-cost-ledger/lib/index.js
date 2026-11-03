/**
 * dsh-cost-ledger 宿主半:费用账本的 HTTP 接口与后台建账。
 *
 * 路由(同源,浏览器直接 fetch):
 *   GET  /cost-ledger/session?sessionId=      单个会话的每轮费用与合计
 *   GET  /cost-ledger/overview?days=30        总额 / 近 N 日 / 按路由
 *   GET  /cost-ledger/settings                价格时段账本、汇率、路由、未定价项
 *   GET|POST /cost-ledger/prices/fetch        抓取官方最新价目并落成新价格时段
 *   GET  /cost-ledger/currency?currency=CNY   切换展示货币
 *   POST /cost-ledger/route                   配置某条路由的计价方式(预留其它家模型)
 *   POST /cost-ledger/prices/manual           手动写入价格模型(预留其它家模型)
 *   GET  /cost-ledger/recompute               全量重算
 */

import { createEngine } from './engine.js'
import { loadState, saveState } from './state.js'

/** 读取 JSON 请求体(限制 1MB)。 */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0
		const chunks = []
		req.on('data', (chunk) => {
			size += chunk.length
			if (size > 1024 * 1024) {
				reject(new Error('请求体过大'))
				req.destroy()
				return
			}
			chunks.push(chunk)
		})
		req.on('end', () => {
			try {
				resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
			} catch {
				reject(new Error('请求体不是合法 JSON'))
			}
		})
		req.on('error', reject)
	})
}

export default {
	/** 只强依赖 webServer;会话相关服务按可用性降级。 */
	inject: ['webServer'],

	apply(ctx) {
		const webServer = ctx.get('webServer')
		if (webServer === undefined) {
			ctx.logger?.warn?.('[cost-ledger] webServer 服务不可用,跳过挂载')
			return
		}
		const logger = ctx.logger
		const state = loadState()
		const engine = createEngine({
			ctx,
			state,
			logger,
			save: (current, options) => saveState(current, options),
		})

		// 后台建账:每次进程启动先跑一遍全量折叠(修复停机期间结束的会话),不阻塞首个请求。
		const bootId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		if (state.meta.bootId !== bootId) {
			state.meta.bootId = bootId
			setTimeout(() => {
				// 非强制:按会话文件 mtime 增量补折叠,进程重启不再全量重扫
				engine.bootFold({ force: false })
					.then((result) => logger?.info?.(`[cost-ledger] 建账完成:${result.folded}/${result.total} 个会话,${result.ms}ms`))
					.catch((error) => logger?.warn?.(`[cost-ledger] 建账失败:${error instanceof Error ? error.message : String(error)}`))
			}, 800)
		}

		const route = (path, handler) => {
			const disposer = webServer.register({
				kind: 'exact',
				path,
				handler: async (req, res) => {
					const send = (value, status = 200) => {
						res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
						res.end(JSON.stringify(value))
					}
					try {
						let params = {}
						try {
							params = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
						} catch {
							/* 保留空参数 */
						}
						let body = {}
						if (req.method === 'POST') body = await readJsonBody(req)
						const value = await handler({ ...params, ...body })
						send(value ?? { ok: false, error: 'empty response' })
					} catch (error) {
						send({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
					}
				},
			})
			ctx.effect(() => disposer, `cost-ledger ${path}`)
		}

		route('/cost-ledger/session', async (args) => {
			const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
			if (sessionId === '') return { ok: false, error: '缺少 sessionId' }
			return await engine.sessionCost(sessionId)
		})

		route('/cost-ledger/overview', async (args) => {
			const days = Number(args.days)
			return await engine.overview({
				days: Number.isFinite(days) && days > 0 && days <= 366 ? Math.floor(days) : 30,
				refresh: args.refresh === '1' || args.refresh === 'true',
			})
		})

		route('/cost-ledger/settings', async () => engine.settingsView())

		route('/cost-ledger/health', async () => engine.health())

		route('/cost-ledger/prices/fetch', async () => engine.fetchPrices())

		route('/cost-ledger/currency', async (args) => {
			const currency = typeof args.currency === 'string' ? args.currency : ''
			if (currency === '') return { ok: false, error: '缺少 currency' }
			return await engine.setCurrency(currency)
		})

		route('/cost-ledger/route', async (args) => {
			const routeKey = typeof args.route === 'string' ? args.route : ''
			const value = args.mode === undefined && args.priceModel === undefined
				? args
				: { mode: args.mode, priceModel: args.priceModel, note: args.note }
			return await engine.setRoute(routeKey, value)
		})

		route('/cost-ledger/prices/manual', async (args) => {
			const model = typeof args.model === 'string' ? args.model : ''
			const tiers = args.tiers ?? { peak: args.peak, offpeak: args.offpeak }
			return await engine.setManualPrice(model, {
				currency: typeof args.currency === 'string' ? args.currency : 'USD',
				tiers,
			})
		})

		route('/cost-ledger/recompute', async () => engine.recompute())

		logger?.info?.('[cost-ledger] 已挂载 /cost-ledger/*')
	},
}
