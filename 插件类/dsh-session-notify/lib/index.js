/**
 * dsh-session-notify — 宿主半(静态常驻包)
 *
 * 职责:
 *  1. 监听 `agent/status`,维护每会话的 running 状态与完成序号(completedSeq);
 *     另维护一份全局序号(globalSeq)与最近完成信息,供客户端在拿不到 sessionId 时兜底。
 *  2. 通过自有的同源 HTTP 路由 `/dsnf/state` 暴露状态(客户端 800ms 轮询)。
 *
 * 为什么不用 `harness.handle`:那是**动态插件**(cordis_run)才有的门面;
 * 静态 bundle 插件只能用平台服务(这里用 `webServer`)或 TypertRemoteService。
 * 用同源 HTTP 路由的好处是零额外依赖、可在 0.1.1 / 0.2.0 两侧通吃。
 */

/** 客户端轮询的状态路由(精确匹配)。 */
export const STATE_PATH = '/dsnf/state'

export default {
	inject: ['webServer'],
	apply(ctx) {
		const webServer = ctx.get('webServer')
		if (webServer === undefined) return
		// 重复挂载保护:同一包被挂两次时,第二个实例只做状态跟踪,不再注册同名路由
		// (宿主侧不会热重载,所以用全局布尔即可;并在 fiber dispose 时释放,避免插件重启后无法重新挂载)
		const MOUNT_KEY = Symbol.for('dsh-session-notify.host-mounted')
		const alreadyMounted = globalThis[MOUNT_KEY] === true
		if (!alreadyMounted) {
			globalThis[MOUNT_KEY] = true
			ctx.effect(() => () => { globalThis[MOUNT_KEY] = false }, 'session-notify mount flag')
		}

		/** sessionId -> 是否正在运行 */
		const running = new Map()
		/** sessionId -> 完成次数(running -> idle 时 +1) */
		const completedSeq = new Map()
		/** 全局完成计数(任意会话) */
		let globalSeq = 0
		/** 最近一次完成:{ sessionId, at } */
		let lastCompleted = null

		ctx.on('agent/status', (payload) => {
			try {
				const id = payload?.agent?.id
				if (typeof id !== 'string' || id === '') return
				const status = payload?.status
				if (status !== 'running' && status !== 'idle') return
				const was = running.get(id) === true
				running.set(id, status === 'running')
				if (was && status === 'idle') {
					completedSeq.set(id, (completedSeq.get(id) ?? 0) + 1)
					globalSeq += 1
					lastCompleted = { sessionId: id, at: Date.now() }
				}
			} catch {
				/* 状态跟踪永不影响主循环 */
			}
		})

		const sendJson = (res, value) => {
			res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
			res.end(JSON.stringify(value))
		}

		const route = (path, handler) => {
			const disposer = webServer.register({
				kind: 'exact',
				path,
				handler: async (req, res) => {
					let payload = {}
					try {
						payload = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
					} catch {
						sendJson(res, { ok: false, error: 'bad request' })
						return
					}
					try {
						sendJson(res, await handler(payload))
					} catch (error) {
						sendJson(res, { ok: false, error: error instanceof Error ? error.message : String(error) })
					}
				}
			})
			ctx.effect(() => disposer, 'session-notify ' + path)
		}

		if (alreadyMounted) return

		route(STATE_PATH, (args) => {
			const sessionId = typeof args.sessionId === 'string' ? args.sessionId : ''
			let runningCount = 0
			for (const value of running.values()) if (value === true) runningCount += 1
			return {
				ok: true,
				sessionId,
				running: sessionId === '' ? runningCount > 0 : running.get(sessionId) === true,
				runningCount,
				completedSeq: sessionId === '' ? globalSeq : completedSeq.get(sessionId) ?? 0,
				globalSeq,
				lastCompleted
			}
		})
	}
}
