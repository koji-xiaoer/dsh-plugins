import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

// ================= 计价与折叠引擎(原 cost-6 host) =================
const ESTIMATED_PRICES = {
  'deepseek-v4-flash': { current: { cacheRead: 0.02, cacheMiss: 1, output: 2 }, peak: { cacheRead: 0.1, cacheMiss: 3, output: 9 }, offpeak: { cacheRead: 0.05, cacheMiss: 1.5, output: 4.5 } },
  'deepseek-v4-pro': { current: { cacheRead: 0.025, cacheMiss: 3, output: 6 }, peak: { cacheRead: 0.3, cacheMiss: 9, output: 27 }, offpeak: { cacheRead: 0.15, cacheMiss: 4.5, output: 13.5 } }
}
const FALLBACK_MODEL = 'deepseek-v4-flash'
const PEAK_PRICE_SINCE = Date.parse('2026-08-16T16:00:00Z')
function pricingPeriod(now) {
  if (now < PEAK_PRICE_SINCE) return 'current'
  let h = 0
  try { h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' }).format(now)) } catch { h = new Date(now).getHours() }
  if ((h >= 9 && h < 12) || (h >= 14 && h < 18)) return 'peak'
  return 'offpeak'
}
function priceSetFor(model, now, custom) {
  const builtin = ESTIMATED_PRICES[model] ?? ESTIMATED_PRICES[FALLBACK_MODEL]
  const base = builtin[pricingPeriod(now)] ?? builtin.current
  const c = (custom !== undefined && custom !== null && typeof custom === 'object') ? custom[model] : undefined
  if (c === undefined || c === null || typeof c !== 'object') return base
  const out = {}
  for (const key of ['cacheRead', 'cacheMiss', 'output']) out[key] = (typeof c[key] === 'number' && Number.isFinite(c[key])) ? c[key] : base[key]
  return out
}
function costOfBuckets(b, model, at, custom) {
  const p = priceSetFor(model, at, custom)
  return ((b.input + b.write) * p.cacheMiss + b.read * p.cacheRead + b.output * p.output) / 1e6
}
function foldEvents(records, custom) {
  let cost = 0, input = 0, read = 0, write = 0, output = 0
  const byModel = {}, byDay = {}, turnMap = {}, calls = []
  for (const rec of records) {
    const event = (rec !== null && typeof rec === 'object' && rec.event !== undefined && typeof rec.event === 'object') ? rec.event : rec
    if (event === null || typeof event !== 'object' || event.type !== 'assistant/message' || event.data?.usage === undefined) continue
    const usage = event.data.usage
    const model = (typeof event.data.message?.source?.model === 'string' && event.data.message.source.model !== '') ? event.data.message.source.model : FALLBACK_MODEL
    const at = typeof event.time === 'number' && event.time > 0 ? event.time : Date.now()
    const b = { input: usage.inputTokens ?? 0, read: usage.cacheReadTokens ?? 0, write: usage.cacheWriteTokens ?? 0, output: usage.outputTokens ?? 0 }
    const c = costOfBuckets(b, model, at, custom)
    cost += c; input += b.input; read += b.read; write += b.write; output += b.output
    const m = byModel[model] ?? (byModel[model] = { cost: 0, input: 0, read: 0, write: 0, output: 0 })
    m.cost += c; m.input += b.input; m.read += b.read; m.write += b.write; m.output += b.output
    const day = new Date(at).toISOString().slice(0, 10)
    const d = byDay[day] ?? (byDay[day] = { cost: 0, input: 0, read: 0, write: 0, output: 0 })
    d.cost += c; d.input += b.input; d.read += b.read; d.write += b.write; d.output += b.output
    const turnNo = event.data.turn ?? 0
    const t = turnMap[turnNo] ?? (turnMap[turnNo] = { turn: turnNo, steps: 0, input: 0, read: 0, write: 0, output: 0, cost: 0, model })
    t.steps += 1; t.input += b.input; t.read += b.read; t.write += b.write; t.output += b.output; t.cost += c; t.model = model
    calls.push({ time: at, turn: turnNo, step: event.data.step ?? 0, model, input: b.input, read: b.read, write: b.write, output: b.output, cost: c })
  }
  return {
    cost, input, read, write, output,
    byModel: Object.fromEntries(Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)),
    byDay: Object.fromEntries(Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1))),
    turns: Object.values(turnMap).sort((a, b) => b.turn - a.turn),
    calls: calls.reverse()
  }
}

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
  static inject = ['sessionProjections', 'sessionQuery', 'credentials', 'attachments', 'agents']
  constructor(ctx, config = {}) {
    super(ctx, 'enhanced')
    this.ctx = ctx
    this.foldCache = new Map()
    this.customPrices = {}
    this.ratesCache = null
    this.ratesFetching = null
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

  async foldSession(id) {
    const query = this.ctx.get('sessionQuery')
    const snapshot = await query.readSession(id)
    return foldEvents(snapshot?.events ?? [], this.customPrices)
  }

  async balance(agent) {
    const credentials = this.ctx.get('credentials')
    let apiKey
    if (credentials !== undefined) {
      try {
        const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
        if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) apiKey = resolved.value
      } catch { apiKey = undefined }
    }
    if (apiKey === undefined || apiKey.length === 0) return { ok: false, code: 'balance-credential-missing', message: 'DEEPSEEK_API_KEY is not configured' }
    try {
      const response = await fetchWithTimeout('https://api.deepseek.com/user/balance', { headers: { Authorization: 'Bearer ' + apiKey } }, 10000)
      if (!response.ok) return { ok: false, code: 'balance-provider-error', message: 'balance query failed: HTTP ' + response.status }
      const payload = await response.json()
      const info = payload?.balance_infos?.[0] ?? {}
      return {
        ok: true,
        value: {
          isAvailable: payload?.is_available === true,
          currency: typeof info.currency === 'string' ? info.currency : 'CNY',
          totalBalance: Number(info.total_balance ?? 0),
          grantedBalance: Number(info.granted_balance ?? 0),
          toppedUpBalance: Number(info.topped_up_balance ?? 0)
        }
      }
    } catch (e) {
      return { ok: false, code: 'balance-provider-error', message: e instanceof Error ? e.message : String(e) }
    }
  }

  async costSession(agent, args) {
    const id = args?.sessionId
    if (typeof id !== 'string') return { ok: false, error: 'missing sessionId' }
    try {
      return { ok: true, prices: ESTIMATED_PRICES, ...(await this.foldSession(id)) }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
  }

  async costAll(agent) {
    const query = this.ctx.get('sessionQuery')
    try {
      const sessions = await query.listSessions()
      const items = []
      for (const s of sessions) {
        if (s.origin === 'subagent') continue
        const id = typeof s.sessionId === 'string' ? s.sessionId : s.id
        const at = typeof s.updatedAt === 'number' ? s.updatedAt : String(s.updatedAt ?? '')
        const cached = this.foldCache.get(id)
        if (cached !== undefined && cached.at === at) { items.push({ sessionId: id, updatedAt: s.updatedAt, ...cached.fold }); continue }
        try {
          const fold = await this.foldSession(id)
          this.foldCache.set(id, { at, fold })
          if (this.foldCache.size > 500) this.foldCache.clear()
          items.push({ sessionId: id, updatedAt: s.updatedAt, ...fold })
        } catch { /* skip */ }
      }
      return { ok: true, prices: ESTIMATED_PRICES, items }
    } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
  }

  async costConfig(agent, args) {
    if (args !== null && typeof args === 'object' && args.action === 'set' && args.prices !== undefined && args.prices !== null && typeof args.prices === 'object') {
      this.customPrices = args.prices
      this.foldCache.clear()
    }
    return { ok: true, builtin: ESTIMATED_PRICES, prices: this.customPrices }
  }

  async currencyRates(agent) {
    if (this.ratesCache !== null && (this.ratesCache.nextUpdate || 0) > Date.now() / 1000) return { ok: true, ...this.ratesCache }
    if (this.ratesFetching !== null) return this.ratesFetching
    this.ratesFetching = (async () => {
      try {
        const response = await fetchWithTimeout('https://open.er-api.com/v6/latest/CNY', {}, 10000)
        if (!response.ok) return { ok: false, error: 'HTTP ' + response.status }
        const json = await response.json()
        if (json?.result === 'success' && json.rates !== null && typeof json.rates === 'object') {
          this.ratesCache = { rates: json.rates, nextUpdate: json.time_next_update_unix ?? 0, fetchedAt: Date.now() }
          return { ok: true, ...this.ratesCache }
        }
        return { ok: false, error: 'bad payload' }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      } finally {
        this.ratesFetching = null
      }
    })()
    return this.ratesFetching
  }

  async notifyState(agent, args) {
    const id = args?.sessionId
    let count = 0
    for (const v of this.running.values()) if (v === true) count++
    return {
      running: typeof id === 'string' && this.running.get(id) === true,
      runningCount: count,
      completedSeq: typeof id === 'string' ? (this.completedSeq.get(id) ?? 0) : 0
    }
  }

  async usageByModel(agent, args) {
    const id = args?.sessionId
    if (typeof id !== 'string') return null
    const sessions = this.ctx.get('sessions')
    if (sessions === undefined) return null
    const session = sessions.get(id)
    if (session === undefined) return null
    const projections = this.ctx.get('sessionProjections')
    const snapshot = projections.snapshot(session)
    return snapshot.values?.tokenUsageByModel ?? null
  }
}

// ================= Remote 方法手动标记(无构建管线,模拟 @Remote 装饰器) =================
// Remote(name) 返回装饰器;addMarkerInitializer 用 context.addInitializer 在实例化时
// mark(prototype, method, ...)。用假装饰器上下文 + 以类原型为原型的假对象触发回调。
{
  const __inits = []
  const __mark = (cls, method) => {
    Remote(method)(cls.prototype[method], {
      private: false,
      static: false,
      name: method,
      addInitializer: (fn) => __inits.push(fn)
    })
  }
  __mark(DshModsEnhanced, 'balance')
  __mark(DshModsEnhanced, 'costSession')
  __mark(DshModsEnhanced, 'costAll')
  __mark(DshModsEnhanced, 'costConfig')
  __mark(DshModsEnhanced, 'currencyRates')
  __mark(DshModsEnhanced, 'notifyState')
  __mark(DshModsEnhanced, 'usageByModel')
  const __probe = Object.create(DshModsEnhanced.prototype)
  for (const fn of __inits) fn.call(__probe)
}
