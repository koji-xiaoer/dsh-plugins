/**
 * dsh-deepseek-status 宿主半:把 status.deepseek.com 的服务状态做成同源接口。
 *
 * 状态页的浏览器请求没有 CORS 头,客户端不能直接跨域抓,所以由宿主抓取 + 缓存,
 * 客户端胶囊只请求本站的 /deepseek-status/summary。
 *
 * 路由:
 *   GET /deepseek-status/summary            状态快照(服务端 60s 缓存)
 *   GET /deepseek-status/summary?refresh=1  跳过缓存立即抓取(调试用)
 */

import { createStatusService, SOURCE_URL } from './lib/status.js'

export default {
	inject: ['webServer'],

	apply(ctx) {
		const webServer = ctx.get('webServer')
		if (webServer === undefined) {
			ctx.logger?.warn?.('[deepseek-status] webServer 不可用,跳过挂载')
			return
		}

		const service = createStatusService({ logger: ctx.logger })

		const disposeRoute = webServer.register({
			kind: 'exact',
			path: '/deepseek-status/summary',
			handler: async (req, res) => {
				const send = (value, status = 200) => {
					if (res.headersSent === true) return
					res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
					res.end(JSON.stringify(value))
				}
				try {
					let force = false
					try {
						const url = new URL(req?.url ?? '/deepseek-status/summary', 'http://localhost')
						force = url.searchParams.get('refresh') === '1'
					} catch {
						/* 保留默认缓存策略 */
					}
					send(await service.get(force))
				} catch (error) {
					send({ ok: false, source: SOURCE_URL, error: error instanceof Error ? error.message : String(error) }, 500)
				}
			},
		})
		ctx.effect(() => disposeRoute, 'deepseek-status route')

		ctx.logger?.info?.('[deepseek-status] 已挂载 /deepseek-status/summary')
	},
}
