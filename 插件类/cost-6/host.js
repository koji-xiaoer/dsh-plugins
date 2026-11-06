return {
  apply(ctx) {
    // 价表按时段键分段(元/百万 token)。键含义:
    //   current         2026-08-17 00:00 北京前(涨价前平价)
    //   peak/offpeak    2026-08-17 00:00 ~ 2026-09-10 12:00 北京(8/17 涨价档;8/23 起周末走 offpeak)
    //   peak2/offpeak2  2026-09-10 12:00 北京起(Flash 系列降价档,V4-Pro 官方价不变)
    // 历史事件按当时生效的价档计价,不用新价回溯,否则过去时段金额被改写。
    const ESTIMATED_PRICES = {
      'deepseek-v4-flash': {
        current: { cacheRead: 0.02, cacheMiss: 1, output: 2 },
        peak: { cacheRead: 0.1, cacheMiss: 3, output: 9 },
        offpeak: { cacheRead: 0.05, cacheMiss: 1.5, output: 4.5 },
        peak2: { cacheRead: 0.04, cacheMiss: 2, output: 8 },
        offpeak2: { cacheRead: 0.02, cacheMiss: 1, output: 4 }
      },
      'deepseek-v4-flash-vision-exp': {
        current: { cacheRead: 0.02, cacheMiss: 1, output: 2 },
        peak: { cacheRead: 0.1, cacheMiss: 3, output: 9 },
        offpeak: { cacheRead: 0.05, cacheMiss: 1.5, output: 4.5 },
        peak2: { cacheRead: 0.04, cacheMiss: 2, output: 8 },
        offpeak2: { cacheRead: 0.02, cacheMiss: 1, output: 4 }
      },
      'deepseek-v4-pro': {
        current: { cacheRead: 0.025, cacheMiss: 3, output: 6 },
        peak: { cacheRead: 0.3, cacheMiss: 9, output: 27 },
        offpeak: { cacheRead: 0.15, cacheMiss: 4.5, output: 13.5 },
        peak2: { cacheRead: 0.3, cacheMiss: 9, output: 27 },
        offpeak2: { cacheRead: 0.15, cacheMiss: 4.5, output: 13.5 }
      }
    }
    const FALLBACK_MODEL = 'deepseek-v4-flash'
    const PEAK_PRICE_SINCE = Date.parse('2026-08-16T16:00:00Z')
    // 周末低谷价生效时刻:2026-08-23 00:00 北京时间(周六/周日全天统一低谷价)
    const WEEKEND_OFFPEAK_SINCE = Date.parse('2026-08-22T16:00:00Z')
    // [billing-20260910] Flash 系列降价生效时刻:2026-09-10 12:00 北京时间。
    // 官方口径(9/9 公告):空闲 命中 0.05→0.02、未命中 1.5→1、输出 4.5→4;高峰为空闲 2 倍。
    // 适用 deepseek-v4-flash 与 deepseek-v4-flash-vision-exp;V4-Pro 官方价不变。
    const PRICE_CHANGE_20260910 = Date.parse('2026-09-10T04:00:00Z')
    // 时段键 → 旧档键(新增时段缺表时的回退,避免落到 current 这种跨代错价)
    const PERIOD_FALLBACK = { peak2: 'peak', offpeak2: 'offpeak' }
    const pricingPeriod = (now) => {
      if (now < PEAK_PRICE_SINCE) return 'current'
      const parts = {}
      for (const p of new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai' }).formatToParts(now)) parts[p.type] = p.value
      const h = Number(parts.hour)
      const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun'
      // [billing-weekend] 周末(北京时间周六/周日)全天低谷价,不再区分峰谷时段
      const peak = isWeekend && now >= WEEKEND_OFFPEAK_SINCE ? false : ((h >= 9 && h < 12) || (h >= 14 && h < 18))
      // [billing-20260910] 9/10 12:00 北京起走降价后的档位
      const tier2 = now >= PRICE_CHANGE_20260910
      if (peak) return tier2 ? 'peak2' : 'peak'
      return tier2 ? 'offpeak2' : 'offpeak'
    }
    const priceSetFor = (model, now, custom) => {
      const builtin = ESTIMATED_PRICES[model] ?? ESTIMATED_PRICES[FALLBACK_MODEL]
      const key = pricingPeriod(now)
      const base = builtin[key] ?? builtin[PERIOD_FALLBACK[key]] ?? builtin.current
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
    // [billing-20260910] 当前生效档单价(峰 + 谷两档),供界面区分"新价档"与过去时段的旧价档。
    // 注意:若只用当前时刻当锚点,谷时求到的 peak2 会是谷价(名称与数值不符),故峰谷各取一个锚点。
    const DAY_MS = 86400000
    // 北京时间当日 00:00 的 UTC 毫秒:北京为 UTC+8 固定偏移,回退 ((at+8h) mod 24h) 即可
    const dayStart = (at) => at - (((at + 8 * 3600000) % DAY_MS) + DAY_MS) % DAY_MS
    const dayOfWeek = (at) => new Date(at).getUTCDay()
    const anchorsFor = (now) => {
      // 峰/谷两档单价都要给全。若拿"当天"当锚,周末(全天谷)会把峰时档抹成谷价、名称与数值不符;
      // 谷时/峰时同理只能求到一档。故固定回退到最近一个工作日(北京时区)当锚。
      let start = dayStart(now)
      for (let i = 0; i < 7; i += 1) {
        const d = dayOfWeek(start + 12 * 3600000) // 该日正午取星期几(北京)
        if (d >= 1 && d <= 5) break
        start -= DAY_MS
      }
      return { peak2: start + 14 * 3600000, offpeak2: start + 21 * 3600000 }
    }
    const priceMapFor = (models, now, custom) => {
      const anchors = anchorsFor(now)
      const out = {}
      for (const model of models ?? []) {
        const m = {}
        for (const key of ['peak2', 'offpeak2']) m[key] = priceSetFor(model, anchors[key], custom)
        out[model] = m
      }
      return out
    }
    const eventOf = (rec) => (rec !== null && typeof rec === 'object' && rec.event !== undefined && typeof rec.event === 'object') ? rec.event : rec
    const foldEvents = (records, custom) => {
      let cost = 0, input = 0, read = 0, write = 0, output = 0
      const byModel = {}
      const byDay = {}
      const turnMap = {}
      const periodMap = {}
      const calls = []
      for (const rec of records) {
        const event = eventOf(rec)
        if (event === null || typeof event !== 'object' || event.type !== 'assistant/message' || event.data?.usage === undefined) continue
        const usage = event.data.usage
        const model = (typeof event.data.message?.source?.model === 'string' && event.data.message.source.model !== '') ? event.data.message.source.model : FALLBACK_MODEL
        const at = typeof event.time === 'number' && event.time > 0 ? event.time : Date.now()
        const b = { input: usage.inputTokens ?? 0, read: usage.cacheReadTokens ?? 0, write: usage.cacheWriteTokens ?? 0, output: usage.outputTokens ?? 0 }
        const period = pricingPeriod(at)
        const c = costOfBuckets(b, model, at, custom)
        cost += c; input += b.input; read += b.read; write += b.write; output += b.output
        const pr = periodMap[period] ?? (periodMap[period] = { calls: 0, cost: 0 })
        pr.calls += 1; pr.cost += c
        const m = byModel[model] ?? (byModel[model] = { cost: 0, input: 0, read: 0, write: 0, output: 0 })
        m.cost += c; m.input += b.input; m.read += b.read; m.write += b.write; m.output += b.output
        const day = new Date(at).toISOString().slice(0, 10)
        const d = byDay[day] ?? (byDay[day] = { cost: 0, input: 0, read: 0, write: 0, output: 0 })
        d.cost += c; d.input += b.input; d.read += b.read; d.write += b.write; d.output += b.output
        const turnNo = event.data.turn ?? 0
        const t = turnMap[turnNo] ?? (turnMap[turnNo] = { turn: turnNo, steps: 0, input: 0, read: 0, write: 0, output: 0, cost: 0, model })
        t.steps += 1; t.input += b.input; t.read += b.read; t.write += b.write; t.output += b.output; t.cost += c; t.model = model
        calls.push({ time: at, turn: turnNo, step: event.data.step ?? 0, model, input: b.input, read: b.read, write: b.write, output: b.output, cost: c, period })
      }
      const byModelSorted = Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost)
      const byDaySorted = Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1))
      return {
        cost, input, read, write, output,
        byModel: Object.fromEntries(byModelSorted),
        byDay: Object.fromEntries(byDaySorted),
        turns: Object.values(turnMap).sort((a, b) => b.turn - a.turn),
        calls: calls.reverse(),
        periods: periodMap,
        priceMap: priceMapFor(Object.keys(byModel), Date.now(), custom)
      }
    }
    const query = ctx.get('sessionQuery')
    if (query === undefined) return
    const foldCache = new Map()
    const sidOf = (s) => (typeof s.sessionId === 'string' ? s.sessionId : s.id)
    const updatedOf = (s) => (typeof s.updatedAt === 'number' ? s.updatedAt : String(s.updatedAt ?? ''))
    let customPrices = {}
    const foldSession = async (id) => {
      // 注意: sessionQuery.listEvents 返回轻量记录 {sessionId,seq,type,time,surface}(无 data),
      // 折叠必须用 readSession 的完整事件日志(2026-08-18 pkg-15 修复)
      const snapshot = await query.readSession(id)
      return foldEvents(snapshot?.events ?? [], customPrices)
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
    let ratesCache = null
    let ratesFetching = null
    harness.handle('currency-rates', async () => {
      if (ratesCache !== null && (ratesCache.nextUpdate || 0) > Date.now() / 1000) return { ok: true, ...ratesCache }
      if (ratesFetching !== null) return ratesFetching
      ratesFetching = (async () => {
        try {
          const response = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('rates timeout')), 10000)
            fetch('https://open.er-api.com/v6/latest/CNY').then((r) => { clearTimeout(timer); resolve(r) }, (e) => { clearTimeout(timer); reject(e) })
          })
          if (!response.ok) return { ok: false, error: 'HTTP ' + response.status }
          const json = await response.json()
          if (json?.result === 'success' && json.rates !== null && typeof json.rates === 'object') {
            ratesCache = { rates: json.rates, nextUpdate: json.time_next_update_unix ?? 0, fetchedAt: Date.now() }
            return { ok: true, ...ratesCache }
          }
          return { ok: false, error: 'bad payload' }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        } finally {
          ratesFetching = null
        }
      })()
      return ratesFetching
    })
  }
}
