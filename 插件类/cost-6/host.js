return {
  apply(ctx) {
    const ESTIMATED_PRICES = {
      'deepseek-v4-flash': { current: { cacheRead: 0.02, cacheMiss: 1, output: 2 }, peak: { cacheRead: 0.1, cacheMiss: 3, output: 9 }, offpeak: { cacheRead: 0.05, cacheMiss: 1.5, output: 4.5 } },
      'deepseek-v4-pro': { current: { cacheRead: 0.025, cacheMiss: 3, output: 6 }, peak: { cacheRead: 0.3, cacheMiss: 9, output: 27 }, offpeak: { cacheRead: 0.15, cacheMiss: 4.5, output: 13.5 } }
    }
    const FALLBACK_MODEL = 'deepseek-v4-flash'
    const PEAK_PRICE_SINCE = Date.parse('2026-08-16T16:00:00Z')
    const pricingPeriod = (now) => {
      if (now < PEAK_PRICE_SINCE) return 'current'
      let h = 0
      try { h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' }).format(now)) } catch { h = new Date(now).getHours() }
      if ((h >= 9 && h < 12) || (h >= 14 && h < 18)) return 'peak'
      return 'offpeak'
    }
    const priceSetFor = (model, now, custom) => {
      const builtin = ESTIMATED_PRICES[model] ?? ESTIMATED_PRICES[FALLBACK_MODEL]
      const base = builtin[pricingPeriod(now)] ?? builtin.current
      const c = (custom !== undefined && custom !== null && typeof custom === 'object') ? custom[model] : undefined
      if (c === undefined || c === null || typeof c !== 'object') return base
      const out = {}
      for (const key of ['cacheRead', 'cacheMiss', 'output']) out[key] = (typeof c[key] === 'number' && Number.isFinite(c[key])) ? c[key] : base[key]
      return out
    }
    const costOfBuckets = (b, model, at, custom) => {
      const p = priceSetFor(model, at, custom)
      return ((b.input + b.write) * p.cacheMiss + b.read * p.cacheRead + b.output * p.output) / 1e6
    }
    const eventOf = (rec) => (rec !== null && typeof rec === 'object' && rec.event !== undefined && typeof rec.event === 'object') ? rec.event : rec
    const foldEvents = (records, custom) => {
      let cost = 0, input = 0, read = 0, write = 0, output = 0
      const byModel = {}
      const byDay = {}
      const turnMap = {}
      const calls = []
      for (const rec of records) {
        const event = eventOf(rec)
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
      const byModelSorted = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)
      const byDaySorted = Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1))
      return {
        cost, input, read, write, output,
        byModel: Object.fromEntries(byModelSorted),
        byDay: Object.fromEntries(byDaySorted),
        turns: Object.values(turnMap).sort((a, b) => b.turn - a.turn),
        calls: calls.reverse()
      }
    }
    const query = ctx.get('sessionQuery')
    if (query === undefined) return
    const foldCache = new Map()
    const sidOf = (s) => (typeof s.sessionId === 'string' ? s.sessionId : s.id)
    const updatedOf = (s) => (typeof s.updatedAt === 'number' ? s.updatedAt : String(s.updatedAt ?? ''))
    let customPrices = {}
    const foldSession = async (id) => {
      const records = await query.listEvents(id)
      return foldEvents(records, customPrices)
    }
    harness.handle('cost-config', (args) => {
      if (args !== null && typeof args === 'object' && args.action === 'set' && args.prices !== undefined && args.prices !== null && typeof args.prices === 'object') {
        customPrices = args.prices
        foldCache.clear()
      }
      return { ok: true, builtin: ESTIMATED_PRICES, prices: customPrices }
    })
    harness.handle('cost-all', async () => {
      try {
        const sessions = await query.listSessions()
        const items = []
        for (const s of sessions) {
          if (s.origin === 'subagent') continue
          const id = sidOf(s)
          const at = updatedOf(s)
          const cached = foldCache.get(id)
          if (cached !== undefined && cached.at === at) { items.push({ sessionId: id, updatedAt: s.updatedAt, ...cached.fold }); continue }
          try {
            const fold = await foldSession(id)
            foldCache.set(id, { at, fold })
            if (foldCache.size > 500) foldCache.clear()
            items.push({ sessionId: id, updatedAt: s.updatedAt, ...fold })
          } catch { /* skip broken session */ }
        }
        return { ok: true, prices: ESTIMATED_PRICES, items }
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
    })
    harness.handle('cost-session', async (args) => {
      const id = args?.sessionId
      if (typeof id !== 'string') return { ok: false, error: 'missing sessionId' }
      try {
        return { ok: true, prices: ESTIMATED_PRICES, ...(await foldSession(id)) }
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
    })
  }
}
