import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

// ================= tokenUsageByModel 投影(原 tokm-1 host) =================
const zeroBuckets = () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
function bucketsFrom(usage) {
  return { uncachedInputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens ?? 0, cacheWriteTokens: usage.cacheWriteTokens ?? 0 }
}
function bucketsEqual(l, r) {
  return l.uncachedInputTokens === r.uncachedInputTokens && l.outputTokens === r.outputTokens && l.cacheReadTokens === r.cacheReadTokens && l.cacheWriteTokens === r.cacheWriteTokens
}
function addReplacing(totals, previous, next) {
  return {
    uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
    outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
    cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
    cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens
  }
}
const tokenUsageByModelDefinition = {
  key: 'tokenUsageByModel',
  schema: { parse: (value) => value },
  init: () => ({ totals: {}, last: null }),
  apply: (state, event) => {
    if (event.type !== 'assistant/message' || event.data.usage === undefined) return state
    const model = event.data.message?.source?.model
    if (typeof model !== 'string' || model === '') return state
    const { turn, step } = event.data
    const buckets = bucketsFrom(event.data.usage)
    const previous = state.last !== null && state.last.turn === turn && state.last.step === step && state.last.model === model ? state.last.buckets : undefined
    if (previous !== undefined && bucketsEqual(previous, buckets)) return state
    const prev = Object.prototype.hasOwnProperty.call(state.totals, model) ? state.totals[model] : undefined
    return {
      totals: Object.assign({}, state.totals, { [model]: addReplacing(prev ?? zeroBuckets(), previous, buckets) }),
      last: { turn, step, model, buckets }
    }
  },
  view: (state) => state.totals,
  stateVersion: 1
}

// ================= 图片转文字(原 imgr-3 host) =================
function base64FromBytes(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2]
    out += chars[b0 >> 2]
    out += chars[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)]
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)]
    out += b2 === undefined ? '=' : chars[b2 & 63]
  }
  return out
}
function fetchWithTimeout(url, options, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(url, options).then((r) => { clearTimeout(timer); resolve(r) }, (e) => { clearTimeout(timer); reject(e) })
  })
}

export default class DshModsEnhanced extends TypertRemoteService {
  static inject = ['sessionProjections']
  constructor(ctx, config = {}) {
    super(ctx, 'enhanced')
    this.ctx = ctx
    this.imageCache = new Map()
    this.running = new Map()
    this.completedSeq = new Map()

    // --- 会话完成提醒状态(原 sntf-5 host):agent/status 监听 ---
    ctx.on('agent/status', (payload) => {
      try {
        const id = payload?.agent?.id
        if (typeof id !== 'string' || id === '') return
        const status = payload?.status
        if (status !== 'running' && status !== 'idle') return
        const was = this.running.get(id) === true
        this.running.set(id, status === 'running')
        if (was && status === 'idle') this.completedSeq.set(id, (this.completedSeq.get(id) ?? 0) + 1)
      } catch { /* never break the loop */ }
    })

    // --- Token 用量投影 ---
    const projections = ctx.get('sessionProjections')
    if (projections !== undefined) projections.register(tokenUsageByModelDefinition)

    // --- 粘贴图片转文字:pre-step 拦截 ---
    ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
      const decision = await next()
      if (decision === null || typeof decision !== 'object' || decision.kind !== 'enter') return decision
      let changed = false
      const newMessages = []
      for (const message of decision.messages) {
        const content = message.content
        if (!Array.isArray(content) || !content.some((b) => b !== null && typeof b === 'object' && b.type === 'image')) {
          newMessages.push(message)
          continue
        }
        changed = true
        const newContent = []
        for (const block of content) {
          if (block === null || typeof block !== 'object' || block.type !== 'image') { newContent.push(block); continue }
          newContent.push({ type: 'text', text: await this.relayImage(ctx, block.attachment, signal) })
        }
        newMessages.push(Object.assign({}, message, { content: newContent }))
      }
      return changed ? { kind: 'enter', messages: newMessages } : decision
    })
  }

  async relayImage(ctx, attachment, signal) {
    if (attachment === null || typeof attachment !== 'object') return '【图片：用户粘贴了一张图片】'
    const cacheKey = attachment.attachmentId
    if (typeof cacheKey === 'string' && this.imageCache.has(cacheKey)) return this.imageCache.get(cacheKey)
    const credentials = ctx.get('credentials')
    let keyVal
    if (credentials !== undefined) {
      try {
        const resolved = await credentials.resolve('ZHIPU_API_KEY')
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) keyVal = resolved.value
      } catch { keyVal = undefined }
    }
    if (keyVal === undefined) return '【图片：用户粘贴了一张图片，但未配置 ZHIPU_API_KEY，无法转成文字】'
    const attachments = ctx.get('attachments')
    if (attachments === undefined) return '【图片：用户粘贴了一张图片】'
    let stored
    try { stored = await attachments.readImage(attachment, signal) } catch { return '【图片：用户粘贴了一张图片】' }
    const b64 = base64FromBytes(stored.data)
    const mime = typeof attachment.mediaType === 'string' ? attachment.mediaType : 'image/png'
    try {
      const body = JSON.stringify({
        model: 'glm-4v-flash',
        messages: [{ role: 'user', content: [
          { type: 'text', text: '这是用户粘贴到聊天里的一张图片，请用简洁的2-3句话客观描述图片内容，帮助只看文字的模型理解它。直接描述内容本身，不要加“这是一张图片”之类的开场白。' },
          { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } }
        ] }],
        max_tokens: 512
      })
      const response = await fetchWithTimeout('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + keyVal },
        body
      }, 8000)
      if (!response.ok) return '【图片：用户粘贴了一张图片】'
      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      const text = Array.isArray(content) ? content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('') : String(content ?? '')
      const result = text.trim() === '' ? '【图片：用户粘贴了一张图片】' : '【图片：' + text + '】'
      if (typeof cacheKey === 'string') {
        if (this.imageCache.size >= 200) this.imageCache.clear()
        this.imageCache.set(cacheKey, result)
      }
      return result
    } catch { return '【图片：用户粘贴了一张图片】' }
  }

}

