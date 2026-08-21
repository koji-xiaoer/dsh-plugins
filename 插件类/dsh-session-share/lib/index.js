// dsh-session-share — host 半区。
// 会话分享登记表(进程内存)+ 自有 HTTP 路由(/sshp/*)+ read_shared_session 模型工具。
// 读取走 sessionQuery 的实时会话日志:摘要层 = 最近 N 条用户/助手消息文本,系统注入不计入。
// 菜单入口由 patches/dsh-client-ui-workspace-share.patch 提供(分发 window 事件 sshp:share-session)。

const MAX_LIMIT = 100
const NOTE_CLAMP = 500
const TEXT_CLAMP = 1500

function textOfBlocks(content) {
	if (!Array.isArray(content)) return ''
	const parts = []
	for (const block of content) {
		if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string' && block.text !== '') parts.push(block.text)
	}
	return parts.join('\n').trim()
}

function truncate(text, limit) {
	return typeof text === 'string' && text.length > limit ? text.slice(0, limit) + '…(已截断' + (text.length - limit) + '字)' : text
}

function foldMessages(events, limit) {
	const all = []
	let skippedSynthetic = 0
	for (const event of events) {
		if (event === null || typeof event !== 'object') continue
		if (event.type === 'user/message') {
			const data = event.data
			const kind = data && data.source ? data.source.kind : undefined
			// 系统注入(AGENTS.md/文件变更/skill 内容等)不进入摘要,只报数量
			if (kind !== undefined && kind !== 'user') { skippedSynthetic += 1; continue }
			const text = textOfBlocks(data && data.content)
			if (text === '') continue
			all.push({ role: 'user', time: typeof event.time === 'number' ? event.time : 0, turn: 0, interrupted: false, text })
		} else if (event.type === 'assistant/message') {
			const data = event.data
			const text = textOfBlocks(data && data.message && data.message.content)
			if (text === '') continue
			all.push({ role: 'assistant', time: typeof event.time === 'number' ? event.time : 0, turn: data && typeof data.turn === 'number' ? data.turn : 0, interrupted: data !== null && typeof data === 'object' && data.interrupted === true, text })
		}
	}
	const total = all.length
	const bounded = Math.max(1, Math.min(MAX_LIMIT, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 20))
	return { total, skippedSynthetic, messages: total > bounded ? all.slice(total - bounded) : all.slice() }
}

function fmtTime(timestamp) {
	try {
		const d = new Date(timestamp)
		if (Number.isNaN(d.getTime())) return ''
		return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
	} catch { return '' }
}

function renderToolValue(value) {
	if (value === null || typeof value !== 'object') return String(value)
	if (value.ok !== true) return '读取失败: ' + String(value.error !== undefined ? value.error : 'unknown')
	if (Array.isArray(value.items)) {
		if (value.items.length === 0) return '当前没有任何已分享的会话。'
		const lines = ['共 ' + value.items.length + ' 个已分享会话:']
		for (const item of value.items) lines.push('- ' + item.shareId + ' | 《' + (item.title || '无标题') + '》 | 备注: ' + (item.note || '(无)') + ' | 分享于 ' + fmtTime(item.sharedAt))
		lines.push('传入 shareId 可读取某个分享的最近消息摘要。')
		return lines.join('\n')
	}
	if (Array.isArray(value.messages)) {
		const lines = ['会话《' + (value.title || '无标题') + '》(shareId: ' + value.shareId + ') 最近 ' + value.messages.length + '/' + value.totalMessages + ' 条消息' + (value.skippedSynthetic > 0 ? '(另有 ' + value.skippedSynthetic + ' 条系统注入未列入)' : '') + ':' + (value.note ? '\n分享者备注: ' + value.note : '')]
		for (const message of value.messages) {
			const who = message.role === 'user' ? '[用户 ' + fmtTime(message.time) + ']' : '[助手 #' + String(message.turn) + (message.interrupted === true ? ' 中断' : '') + ' ' + fmtTime(message.time) + ']'
			lines.push(who + ' ' + String(message.text))
		}
		return lines.join('\n\n')
	}
	return '未知结果'
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = []
		let size = 0
		req.on('data', (chunk) => {
			size += chunk.length
			if (size > 1e6) { reject(new Error('body too large')); req.destroy(); return }
			chunks.push(chunk)
		})
		req.on('end', () => {
			try { resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (error) { reject(error) }
		})
		req.on('error', reject)
	})
}

export default {
	inject: ['sessionQuery', 'tools', 'webServer'],
	apply(ctx) {
		const query = ctx.get('sessionQuery')
		const tools = ctx.get('tools')
		const webServer = ctx.get('webServer')
		if (query === undefined || tools === undefined || webServer === undefined) return

		const shares = new Map()
		const genId = () => 'shr-' + Math.random().toString(36).slice(2, 8)
		const metaOf = (entry) => ({ shareId: entry.shareId, sessionId: entry.sessionId, note: entry.note, sharedAt: entry.sharedAt })
		const findBySession = (sessionId) => {
			for (const entry of shares.values()) if (entry.sessionId === sessionId) return entry
			return undefined
		}
		const titleOf = async (sessionId) => {
			try {
				const snapshot = await query.readTitle(sessionId)
				return snapshot !== null && typeof snapshot === 'object' && typeof snapshot.title === 'string' ? snapshot.title : ''
			} catch { return '' }
		}
		const publish = (sessionId, note) => {
			const existing = findBySession(sessionId)
			if (existing !== undefined) { existing.note = note; return { ok: true, updated: true, ...metaOf(existing) } }
			const entry = { shareId: genId(), sessionId, note, sharedAt: Date.now() }
			shares.set(entry.shareId, entry)
			return { ok: true, updated: false, ...metaOf(entry) }
		}
		const unpublish = (args) => {
			let target
			if (typeof args.shareId === 'string' && shares.has(args.shareId)) target = args.shareId
			else if (typeof args.sessionId === 'string') { const entry = findBySession(args.sessionId); if (entry !== undefined) target = entry.shareId }
			if (target === undefined) return { ok: false, error: 'not found' }
			shares.delete(target)
			return { ok: true }
		}
		const readShare = async (shareId, limit) => {
			const entry = shares.get(shareId)
			if (entry === undefined) return { ok: false, error: '分享不存在或已取消' }
			try {
				const snapshot = await query.readSession(entry.sessionId)
				const fold = foldMessages(snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.events) ? snapshot.events : [], limit)
				const title = await titleOf(entry.sessionId)
				const messages = []
				for (const message of fold.messages) messages.push({ role: message.role, time: message.time, turn: message.turn, interrupted: message.interrupted, text: truncate(message.text, TEXT_CLAMP) })
				return { ok: true, ...metaOf(entry), title, totalMessages: fold.total, skippedSynthetic: fold.skippedSynthetic, messages }
			} catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
		}
		const listShares = async (keyword) => {
			const withTitles = []
			for (const entry of shares.values()) withTitles.push({ ...metaOf(entry), title: await titleOf(entry.sessionId) })
			withTitles.sort((a, b) => b.sharedAt - a.sharedAt)
			const kw = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
			const filtered = kw === '' ? withTitles : withTitles.filter((item) => (item.title + ' ' + item.note + ' ' + item.shareId).toLowerCase().includes(kw))
			return { ok: true, items: filtered }
		}

		const sendJson = (res, value) => {
			const body = JSON.stringify(value)
			res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
			res.end(body)
		}
		const route = (path, handler) => {
			const disposer = webServer.register({ kind: 'exact', path, handler: async (req, res) => {
				let payload = {}
				try { payload = req.method === 'POST' ? await readBody(req) : Object.fromEntries(new URL(req.url, 'http://localhost').searchParams) } catch { sendJson(res, { ok: false, error: 'bad request' }); return }
				try { sendJson(res, await handler(payload)) } catch (error) { sendJson(res, { ok: false, error: error instanceof Error ? error.message : String(error) }) }
			} })
			ctx.effect(() => disposer, 'session-share ' + path)
		}
		route('/sshp/publish', (args) => {
			if (typeof args.sessionId !== 'string' || args.sessionId === '') return { ok: false, error: 'missing sessionId' }
			return publish(args.sessionId, typeof args.note === 'string' ? args.note.slice(0, NOTE_CLAMP) : '')
		})
		route('/sshp/unpublish', (args) => unpublish(args))
		route('/sshp/get', async (args) => {
			if (typeof args.sessionId !== 'string') return { ok: false, error: 'missing sessionId' }
			const entry = findBySession(args.sessionId)
			if (entry === undefined) return { ok: true, shared: false }
			return { ok: true, shared: true, ...metaOf(entry), title: await titleOf(args.sessionId) }
		})
		route('/sshp/list', (args) => listShares(args.keyword))
		route('/sshp/read', (args) => {
			if (typeof args.shareId !== 'string') return { ok: false, error: 'missing shareId' }
			return readShare(args.shareId, args.limit)
		})

		// 提示词规则:其他会话的 agent 看到分享ID自动调用工具(工具指引惯例 order 100-199)
		const systemPrompt = ctx.get('systemPrompt')
		if (systemPrompt !== undefined) {
			ctx.effect(() => systemPrompt.section({
				name: 'session-share-tool-guidance',
				order: 110,
				text: '跨会话分享:当用户消息中出现形如 shr-xxxxxx 的分享ID时,调用 read_shared_session 工具并传入 shareId 读取对应会话的最近消息摘要;当用户询问有哪些已分享的会话时,不带参数调用该工具列出列表。不要把分享ID当作普通文本忽略。'
			}), 'session-share prompt section')
		}

		// 模型工具:其他会话的 agent 由此读取分享摘要
		ctx.effect(() => tools.register({
			name: 'read_shared_session',
			description: '读取其他会话主动分享的对话内容。不带参数调用:列出全部已分享会话(shareId、标题、备注)。带 shareId 调用:返回该会话最近的用户/助手消息文本摘要,用于跨会话获取上下文。可选 keyword 按标题/备注筛选列表,limit 控制读取条数(默认20,最大100)。',
			parameters: {
				type: 'object',
				properties: {
					shareId: { type: 'string', description: '要读取的分享ID(形如 shr-xxxxxx);缺省时列出全部分享' },
					keyword: { type: 'string', description: '按标题/备注关键词筛选分享列表;仅在未提供 shareId 时生效' },
					limit: { type: 'number', description: '读取最近多少条消息,默认 20,最大 100' }
				}
			},
			output: { schema: { type: 'object', additionalProperties: true }, render: (args, value) => [{ type: 'text', text: renderToolValue(value) }] },
			execute: async (args) => {
				const payload = args !== null && typeof args === 'object' ? args : {}
				if (typeof payload.shareId === 'string' && payload.shareId !== '') return readShare(payload.shareId, payload.limit)
				return listShares(payload.keyword)
			}
		}), 'session-share tool')
	},
}
