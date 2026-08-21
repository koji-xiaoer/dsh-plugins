return {
  apply(ctx) {
    const query = ctx.get('sessionQuery')
    if (query === undefined) return
    const shares = new Map()
    const genId = () => 'shr-' + Math.random().toString(36).slice(2, 8)
    const textOfBlocks = (content) => {
      if (!Array.isArray(content)) return ''
      const parts = []
      for (const b of content) {
        if (b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string' && b.text !== '') parts.push(b.text)
      }
      return parts.join('\n').trim()
    }
    const truncate = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…(已截断' + (s.length - n) + '字)' : s)
    const foldMessages = (events, limit) => {
      const all = []
      let skippedSynthetic = 0
      for (const ev of events) {
        if (ev === null || typeof ev !== 'object') continue
        if (ev.type === 'user/message') {
          const d = ev.data
          const kind = d && d.source ? d.source.kind : undefined
          if (kind !== undefined && kind !== 'user') { skippedSynthetic += 1; continue }
          const text = textOfBlocks(d && d.content)
          if (text === '') continue
          all.push({ role: 'user', time: typeof ev.time === 'number' ? ev.time : 0, turn: 0, interrupted: false, text: text })
        } else if (ev.type === 'assistant/message') {
          const d = ev.data
          const text = textOfBlocks(d && d.message && d.message.content)
          if (text === '') continue
          all.push({ role: 'assistant', time: typeof ev.time === 'number' ? ev.time : 0, turn: d && typeof d.turn === 'number' ? d.turn : 0, interrupted: d !== null && typeof d === 'object' && d.interrupted === true, text: text })
        }
      }
      const total = all.length
      const lim = Math.max(1, Math.min(100, typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 20))
      return { total: total, skippedSynthetic: skippedSynthetic, messages: total > lim ? all.slice(total - lim) : all.slice() }
    }
    const titleOf = async (sessionId) => {
      try {
        const t = await query.readTitle(sessionId)
        return t !== null && typeof t === 'object' && typeof t.title === 'string' ? t.title : ''
      } catch { return '' }
    }
    const metaOf = (entry) => ({ shareId: entry.shareId, sessionId: entry.sessionId, note: entry.note, sharedAt: entry.sharedAt })
    const findBySession = (sessionId) => {
      for (const e of shares.values()) if (e.sessionId === sessionId) return e
      return undefined
    }
    const publish = (sessionId, note) => {
      const existing = findBySession(sessionId)
      if (existing !== undefined) { existing.note = note; return { ok: true, updated: true, shareId: existing.shareId, sessionId: existing.sessionId, note: existing.note, sharedAt: existing.sharedAt } }
      const entry = { shareId: genId(), sessionId: sessionId, note: note, sharedAt: Date.now() }
      shares.set(entry.shareId, entry)
      return { ok: true, updated: false, shareId: entry.shareId, sessionId: entry.sessionId, note: entry.note, sharedAt: entry.sharedAt }
    }
    const readShare = async (shareId, limit) => {
      const entry = shares.get(shareId)
      if (entry === undefined) return { ok: false, error: '分享不存在或已取消' }
      try {
        const snap = await query.readSession(entry.sessionId)
        const fold = foldMessages(snap !== null && typeof snap === 'object' && Array.isArray(snap.events) ? snap.events : [], limit)
        const title = await titleOf(entry.sessionId)
        const messages = []
        for (const m of fold.messages) messages.push({ role: m.role, time: m.time, turn: m.turn, interrupted: m.interrupted, text: truncate(m.text, 1500) })
        return { ok: true, shareId: entry.shareId, sessionId: entry.sessionId, note: entry.note, sharedAt: entry.sharedAt, title: title, totalMessages: fold.total, skippedSynthetic: fold.skippedSynthetic, messages: messages }
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
    }
    const listShares = async (keyword) => {
      const items = []
      for (const e of shares.values()) items.push(metaOf(e))
      const withTitles = []
      for (const it of items) {
        const title = await titleOf(it.sessionId)
        withTitles.push({ shareId: it.shareId, sessionId: it.sessionId, note: it.note, sharedAt: it.sharedAt, title: title })
      }
      withTitles.sort((a, b) => b.sharedAt - a.sharedAt)
      const kw = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
      const filtered = kw === '' ? withTitles : withTitles.filter((it) => (it.title + ' ' + it.note + ' ' + it.shareId).toLowerCase().includes(kw))
      return { ok: true, items: filtered }
    }

    harness.handle('share-publish', (args) => {
      const a = args !== null && typeof args === 'object' ? args : {}
      if (typeof a.sessionId !== 'string' || a.sessionId === '') return { ok: false, error: 'missing sessionId' }
      const note = typeof a.note === 'string' ? a.note.slice(0, 500) : ''
      return publish(a.sessionId, note)
    })
    harness.handle('share-unpublish', (args) => {
      const a = args !== null && typeof args === 'object' ? args : {}
      let target
      if (typeof a.shareId === 'string' && shares.has(a.shareId)) target = a.shareId
      else if (typeof a.sessionId === 'string') { const e = findBySession(a.sessionId); if (e !== undefined) target = e.shareId }
      if (target === undefined) return { ok: false, error: 'not found' }
      shares.delete(target)
      return { ok: true }
    })
    harness.handle('share-get', async (args) => {
      const a = args !== null && typeof args === 'object' ? args : {}
      if (typeof a.sessionId !== 'string') return { ok: false, error: 'missing sessionId' }
      const e = findBySession(a.sessionId)
      if (e === undefined) return { ok: true, shared: false }
      const title = await titleOf(a.sessionId)
      return { ok: true, shared: true, shareId: e.shareId, sessionId: e.sessionId, note: e.note, sharedAt: e.sharedAt, title: title }
    })
    harness.handle('share-list', async (args) => {
      const a = args !== null && typeof args === 'object' ? args : {}
      return listShares(a.keyword)
    })
    harness.handle('share-read', async (args) => {
      const a = args !== null && typeof args === 'object' ? args : {}
      if (typeof a.shareId !== 'string') return { ok: false, error: 'missing shareId' }
      return readShare(a.shareId, a.limit)
    })

    const fmtTime = (t) => {
      try {
        const d = new Date(t)
        if (Number.isNaN(d.getTime())) return ''
        return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      } catch { return '' }
    }
    const renderValue = (value) => {
      if (value === null || typeof value !== 'object') return String(value)
      if (value.ok !== true) return '读取失败: ' + String(value.error !== undefined ? value.error : 'unknown')
      if (Array.isArray(value.items)) {
        if (value.items.length === 0) return '当前没有任何已分享的会话。'
        const lines = ['共 ' + value.items.length + ' 个已分享会话:']
        for (const it of value.items) lines.push('- ' + it.shareId + ' | 《' + (it.title || '无标题') + '》 | 备注: ' + (it.note || '(无)') + ' | 分享于 ' + fmtTime(it.sharedAt))
        lines.push('传入 shareId 可读取某个分享的最近消息摘要。')
        return lines.join('\n')
      }
      if (Array.isArray(value.messages)) {
        const lines = ['会话《' + (value.title || '无标题') + '》(shareId: ' + value.shareId + ') 最近 ' + value.messages.length + '/' + value.totalMessages + ' 条消息' + (value.skippedSynthetic > 0 ? '(另有 ' + value.skippedSynthetic + ' 条系统注入未列入)' : '') + ':' + (value.note ? '\n分享者备注: ' + value.note : '')]
        for (const m of value.messages) {
          const who = m.role === 'user' ? '[用户 ' + fmtTime(m.time) + ']' : '[助手 #' + String(m.turn) + (m.interrupted === true ? ' 中断' : '') + ' ' + fmtTime(m.time) + ']'
          lines.push(who + ' ' + String(m.text))
        }
        return lines.join('\n\n')
      }
      return '未知结果'
    }
    const tool = harness.defineTool({
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
      output: { schema: { type: 'object', additionalProperties: true }, render: (args, value) => [{ type: 'text', text: renderValue(value) }] },
      execute: async (args) => {
        const a = args !== null && typeof args === 'object' ? args : {}
        if (typeof a.shareId === 'string' && a.shareId !== '') return readShare(a.shareId, a.limit)
        return listShares(a.keyword)
      }
    })
    ctx.effect(() => harness.registerTool(ctx, tool))
  }
}
