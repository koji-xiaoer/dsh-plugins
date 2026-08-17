return {
  inject: ['timer'],
  apply(ctx) {
    const BILLING_CURRENCIES = [['CNY', '¥'], ['USD', '$'], ['EUR', '€'], ['GBP', '£'], ['JPY', '¥'], ['HKD', 'HK$'], ['SGD', 'S$'], ['AUD', 'A$'], ['CAD', 'C$'], ['CHF', 'Fr.'], ['KRW', '₩'], ['TWD', 'NT$'], ['INR', '₹'], ['RUB', '₽'], ['BRL', 'R$']]
    const CURRENCY_SYMBOLS = Object.fromEntries(BILLING_CURRENCIES)
    const RATE_CACHE_KEY = 'dsh.billing.currency.rates.v1'
    const PREF_KEY = 'dsh.billing.currency.v2'
    const readPrefs = () => {
      try {
        const raw = localStorage.getItem(PREF_KEY)
        if (raw !== null) {
          const p = JSON.parse(raw)
          return {
            code: typeof p.code === 'string' && CURRENCY_SYMBOLS[p.code] !== undefined ? p.code : 'CNY',
            manualRate: typeof p.manualRate === 'number' && p.manualRate > 0 ? p.manualRate : null
          }
        }
      } catch {}
      return { code: 'CNY', manualRate: null }
    }
    const writePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch {} }
    const readRateCache = () => {
      try {
        const raw = localStorage.getItem(RATE_CACHE_KEY)
        if (raw !== null) {
          const c = JSON.parse(raw)
          if (c !== null && typeof c === 'object' && c.rates !== null && typeof c.rates === 'object') return c
        }
      } catch {}
      return null
    }
    const writeRateCache = (rates, nextUpdate) => { try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, nextUpdate, fetchedAt: Date.now() })) } catch {} }
    let currency = { code: 'CNY', rate: 1, source: 'cny', symbol: '¥' }
    const currencyListeners = new Set()
    const syncCurrency = () => {
      const prefs = readPrefs()
      const cache = readRateCache()
      let rate = 1
      let source = 'cny'
      if (prefs.code !== 'CNY') {
        if (prefs.manualRate !== null) { rate = 1 / prefs.manualRate; source = 'manual' }
        else if (cache !== null && cache.rates[prefs.code] != null) { rate = cache.rates[prefs.code]; source = (cache.nextUpdate || 0) > Date.now() / 1000 ? 'auto' : 'stale' }
        else source = 'failed'
      }
      const next = { code: prefs.code, rate, source, symbol: CURRENCY_SYMBOLS[prefs.code] || '¥' }
      if (next.code !== currency.code || next.rate !== currency.rate || next.source !== currency.source || next.symbol !== currency.symbol) {
        currency = next
        for (const l of currencyListeners) l()
      }
      return currency
    }
    let ratesInflight = null
    const ensureRates = () => {
      const prefs = readPrefs()
      const cache = readRateCache()
      if (prefs.code === 'CNY' && prefs.manualRate === null) return null
      if (prefs.manualRate !== null) return null
      if (cache !== null && (cache.nextUpdate || 0) > Date.now() / 1000) return null
      if (ratesInflight !== null) return ratesInflight
      ratesInflight = (async () => {
        try {
          const r = await host.call('currency-rates', {})
          if (r !== null && typeof r === 'object' && r.ok === true && r.rates !== null && typeof r.rates === 'object') {
            writeRateCache(r.rates, typeof r.nextUpdate === 'number' ? r.nextUpdate : 0)
          }
        } catch {}
        ratesInflight = null
        syncCurrency()
      })()
      return ratesInflight
    }
    const useCurrency = () => {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const l = () => force((x) => x + 1)
        currencyListeners.add(l)
        return () => currencyListeners.delete(l)
      }, [])
      return currency
    }
    const fmtCost = (v, cur) => {
      const n = Number(v) || 0
      const display = n * (cur.rate || 1)
      const sym = cur.source === 'failed' || cur.code === 'CNY' ? '¥' : (cur.symbol || '¥')
      const s = display >= 1 ? display.toFixed(2) : display >= 0.01 ? display.toFixed(3).replace(/(\.\d*?[1-9])0+$/, '$1') : display > 0 ? display.toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1') : '0'
      return sym + s
    }
    const fmtTok = (n) => {
      const v = Number(n) || 0
      if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
      return String(v)
    }
    const fmtTime = (t) => {
      try {
        const d = new Date(t)
        if (Number.isNaN(d.getTime())) return ''
        return (d.getMonth() + 1) + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      } catch { return '' }
    }
    styles.insert('.cost-dock{display:flex;flex-direction:column;gap:6px;padding:8px 12px;border-radius:10px;font-size:12px;color:var(--dsw-alias-label-tertiary)}.cost-dock-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cost-dock-total{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.cost-dock-model{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.cost-dock-toggle{cursor:pointer;opacity:.7}.cost-dock-toggle:hover{opacity:1}.cost-bars{display:flex;align-items:flex-end;gap:4px;height:120px;padding:4px 2px 0;overflow-x:auto}.cost-bar{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:26px;height:100%}.cost-bar-fill{width:18px;border-radius:4px 4px 0 0;background:var(--dsw-alias-state-business-primary);min-height:3px}.cost-bar-val{font-size:9px;color:var(--dsw-alias-label-tertiary);line-height:1.4}.cost-bar-idx{font-size:9px;color:var(--dsw-alias-label-dimmed)}.cost-pager{display:flex;align-items:center;gap:8px;font-size:11px}.cost-pager button{background:none;border:1px solid var(--dsw-alias-border-l2);color:inherit;border-radius:6px;padding:1px 8px;cursor:pointer;font-size:11px}.cost-pager button:disabled{opacity:.35;cursor:default}.cost-table{width:100%;border-collapse:collapse;font-size:12px}.cost-table th,.cost-table td{padding:4px 8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}.cost-table th{color:var(--dsw-alias-label-tertiary);font-weight:500}.cost-table tr.clickable{cursor:pointer}.cost-table tr.clickable:hover{background:var(--dsw-alias-interactive-bg-hover)}.cost-num{text-align:right;font-variant-numeric:tabular-nums}.cost-empty{color:var(--dsw-alias-label-tertiary);padding:12px;text-align:center}.cost-settings{display:flex;flex-direction:column;gap:10px}.cost-settings-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.cost-settings-label{font-size:12px;color:var(--dsw-alias-label-tertiary)}.cost-price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.cost-price-cell{display:flex;flex-direction:column;gap:2px}.cost-price-cell span{font-size:10px;color:var(--dsw-alias-label-tertiary)}.cost-price-cell input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:12px;padding:3px 6px}.cost-curr{position:relative}.cost-curr-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px;line-height:20px;padding:4px 12px;display:inline-flex;align-items:center;gap:6px}.cost-curr-btn:hover{border-color:var(--dsw-alias-state-business-primary)}.cost-curr-menu{position:absolute;z-index:100;top:calc(100% + 4px);right:0;min-width:190px;max-height:240px;overflow-y:auto;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-inverted);box-shadow:var(--dsw-shadow-lv3);border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px}.cost-curr-item{background:none;border:none;border-radius:8px;box-sizing:border-box;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;line-height:20px;padding:5px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;white-space:nowrap}.cost-curr-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.cost-curr-active{color:var(--dsw-alias-label-primary);font-weight:600}.cost-curr-tick{color:var(--dsw-alias-state-business-primary);flex:none}.cost-curr-rate{display:flex;flex-direction:column;gap:2px}.cost-curr-rate-value{color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}.cost-curr-rate-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.cost-curr-manual{align-items:center;gap:8px;display:flex;flex-wrap:wrap}.cost-curr-manual label{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}.cost-curr-manual input{width:120px;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;padding:3px 8px}')

    const ModelChip = (props) => React.createElement('span', { className: 'cost-dock-model' }, props.model, ' ', fmtCost(props.cost, props.cur))
    const TurnBars = (props) => {
      const cur = useCurrency()
      const turns = props.turns || []
      const [page, setPage] = React.useState(0)
      const pageSize = 12
      const pages = Math.max(1, Math.ceil(turns.length / pageSize))
      const p = Math.min(page, pages - 1)
      const slice = turns.slice(p * pageSize, p * pageSize + pageSize)
      const sorted = slice.slice().sort((a, b) => b.cost - a.cost)
      const max = sorted.length > 0 ? Math.max.apply(null, sorted.map((t) => t.cost)) : 0
      const min = sorted.length > 0 ? Math.min.apply(null, sorted.map((t) => t.cost)) : 0
      const bars = sorted.map((t) => {
        let h = 2
        if (t.cost > 0 && max > 0) {
          if (min > 0 && max / min > 5) h = 2 + 98 * (Math.log(t.cost / min) / Math.log(max / min))
          else h = 2 + 98 * (t.cost / max)
        }
        return React.createElement('div', { key: String(t.turn), className: 'cost-bar', title: t.model + ' · ' + t.steps + ' 步 · ' + fmtCost(t.cost, cur) },
          React.createElement('div', { className: 'cost-bar-val' }, fmtCost(t.cost, cur)),
          React.createElement('div', { className: 'cost-bar-fill', style: { height: h + '%' } }),
          React.createElement('div', { className: 'cost-bar-idx' }, '#' + t.turn))
      })
      return React.createElement('div', { className: 'cost-dock' },
        React.createElement('div', { className: 'cost-bars' }, bars),
        pages > 1 ? React.createElement('div', { className: 'cost-pager' },
          React.createElement('button', { disabled: p === 0, onClick: () => setPage(p - 1) }, '上一页'),
          React.createElement('span', null, (p + 1) + ' / ' + pages),
          React.createElement('button', { disabled: p >= pages - 1, onClick: () => setPage(p + 1) }, '下一页'))
        : null)
    }
    const CostDock = (props) => {
      const sessionId = props.sessionId
      const cur = useCurrency()
      const [data, setData] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      React.useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            const r = await host.call('cost-session', { sessionId })
            if (alive && r !== null && typeof r === 'object' && r.ok === true) setData(r)
          } catch {}
          ensureRates()
          syncCurrency()
        }
        tick()
        const h = ctx.interval(tick, 3000)
        return () => { alive = false; h() }
      }, [sessionId])
      if (data === null) return null
      const models = Object.entries(data.byModel || {})
      const turns = data.turns || []
      return React.createElement('div', { className: 'cost-dock' },
        React.createElement('div', { className: 'cost-dock-row' },
          React.createElement('span', { className: 'cost-dock-total' }, '费用 ' + fmtCost(data.cost, cur)),
          React.createElement('span', null, '输入 ' + fmtTok(data.input + data.write)),
          React.createElement('span', null, '输出 ' + fmtTok(data.output)),
          models.slice(0, 3).map((kv) => React.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost, cur: cur })),
          turns.length > 0 ? React.createElement('span', { className: 'cost-dock-toggle', onClick: () => setOpen(!open) }, open ? '收起 ▲' : '每轮费用 ▼') : null),
        open && turns.length > 0 ? React.createElement(TurnBars, { turns }) : null)
    }
    const Drill = (props) => {
      const cur = useCurrency()
      const item = props.item
      const turns = item.turns || []
      const calls = item.calls || []
      return React.createElement('div', null,
        React.createElement('div', { className: 'cost-dock-row', style: { padding: '6px 0' } },
          React.createElement('span', null, '按模型:'),
          Object.entries(item.byModel || {}).map((kv) => React.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost, cur: cur }))),
        React.createElement('div', { className: 'cost-dock-row', style: { padding: '4px 0' } },
          React.createElement('span', null, '按日:'),
          Object.entries(item.byDay || {}).map((kv) => React.createElement('span', { key: kv[0], className: 'cost-dock-model' }, kv[0], ' ', fmtCost(kv[1].cost, cur)))),
        React.createElement('div', { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, '轮次明细(' + turns.length + ')'),
        React.createElement('table', { className: 'cost-table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, '轮次'), React.createElement('th', null, '步数'), React.createElement('th', null, '模型'),
            React.createElement('th', { className: 'cost-num' }, '输入'), React.createElement('th', { className: 'cost-num' }, '输出'), React.createElement('th', { className: 'cost-num' }, '费用'))),
          React.createElement('tbody', null, turns.slice(0, 10).map((t) => React.createElement('tr', { key: String(t.turn) },
            React.createElement('td', null, '#' + t.turn), React.createElement('td', null, t.steps), React.createElement('td', null, t.model),
            React.createElement('td', { className: 'cost-num' }, fmtTok(t.input + t.write)), React.createElement('td', { className: 'cost-num' }, fmtTok(t.output)),
            React.createElement('td', { className: 'cost-num' }, fmtCost(t.cost, cur)))))),
        React.createElement('div', { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, '逐笔明细(' + calls.length + ')'),
        React.createElement('table', { className: 'cost-table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, '时间'), React.createElement('th', null, '轮/步'), React.createElement('th', null, '模型'),
            React.createElement('th', { className: 'cost-num' }, '输入'), React.createElement('th', { className: 'cost-num' }, '输出'), React.createElement('th', { className: 'cost-num' }, '费用'))),
          React.createElement('tbody', null, calls.slice(0, 10).map((c, i) => React.createElement('tr', { key: String(i) },
            React.createElement('td', null, fmtTime(c.time)), React.createElement('td', null, '#' + c.turn + '.' + c.step), React.createElement('td', null, c.model),
            React.createElement('td', { className: 'cost-num' }, fmtTok(c.input + c.write)), React.createElement('td', { className: 'cost-num' }, fmtTok(c.output)),
            React.createElement('td', { className: 'cost-num' }, fmtCost(c.cost, cur)))))))
    }
    const BillingPage = (props) => {
      const cur = useCurrency()
      const [data, setData] = React.useState(null)
      const [expanded, setExpanded] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            const r = await host.call('cost-all', {})
            if (alive && r !== null && typeof r === 'object' && r.ok === true) setData(r)
          } catch {}
          ensureRates()
          syncCurrency()
        }
        tick()
        const h = ctx.interval(tick, 5000)
        return () => { alive = false; h() }
      }, [])
      if (data === null) return React.createElement('div', { className: 'cost-empty' }, '账单加载中…')
      const items = data.items || []
      let total = 0, totalIn = 0, totalOut = 0
      for (const it of items) { total += it.cost || 0; totalIn += it.input || 0; totalOut += it.output || 0 }
      return React.createElement('div', null,
        React.createElement('div', { className: 'cost-dock-row', style: { padding: '4px 0 10px' } },
          React.createElement('span', { className: 'cost-dock-total' }, '总费用 ' + fmtCost(total, cur)),
          React.createElement('span', null, '输入 ' + fmtTok(totalIn)), React.createElement('span', null, '输出 ' + fmtTok(totalOut))),
        items.length === 0 ? React.createElement('div', { className: 'cost-empty' }, '暂无账单数据') :
        React.createElement('table', { className: 'cost-table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, '会话'), React.createElement('th', null, '更新时间'), React.createElement('th', { className: 'cost-num' }, '轮次'), React.createElement('th', { className: 'cost-num' }, '步数'),
            React.createElement('th', { className: 'cost-num' }, '输入'), React.createElement('th', { className: 'cost-num' }, '输出'), React.createElement('th', { className: 'cost-num' }, '费用'))),
          React.createElement('tbody', null, items.map((it) => [
            React.createElement('tr', { key: 'h' + it.sessionId, className: 'clickable', onClick: () => setExpanded(expanded === it.sessionId ? null : it.sessionId) },
              React.createElement('td', null, (expanded === it.sessionId ? '▾ ' : '▸ ') + String(it.sessionId).slice(0, 12)),
              React.createElement('td', null, fmtTime(it.updatedAt)),
              React.createElement('td', { className: 'cost-num' }, (it.turns || []).length),
              React.createElement('td', { className: 'cost-num' }, (it.turns || []).reduce((a, t) => a + t.steps, 0)),
              React.createElement('td', { className: 'cost-num' }, fmtTok(it.input + it.write)),
              React.createElement('td', { className: 'cost-num' }, fmtTok(it.output)),
              React.createElement('td', { className: 'cost-num' }, fmtCost(it.cost, cur))),
            expanded === it.sessionId ? React.createElement('tr', { key: 'd' + it.sessionId }, React.createElement('td', { colSpan: 7, style: { padding: '4px 8px 10px' } }, React.createElement(Drill, { item: it }))) : null
          ]))),
        React.createElement('div', { className: 'cost-empty', style: { marginTop: 10, fontSize: 11 } }, '费用按请求时刻计价(峰谷价表),每 5 秒刷新'))
    }
    const CostSettings = (props) => {
      const [cfg, setCfg] = React.useState(null)
      const [draft, setDraft] = React.useState({})
      React.useEffect(() => {
        let alive = true
        const load = async () => {
          try {
            const r = await host.call('cost-config', {})
            if (alive && r !== null && typeof r === 'object' && r.ok === true) { setCfg(r); setDraft(r.prices || {}) }
          } catch {}
        }
        load()
        return () => { alive = false }
      }, [])
      if (cfg === null) return React.createElement('div', { className: 'cost-empty' }, '加载中…')
      const modelNames = Object.keys(cfg.builtin || {})
      const setPrice = (model, key, value) => {
        const next = Object.assign({}, draft, { [model]: Object.assign({}, draft[model] || {}, { [key]: value }) })
        setDraft(next)
        host.call('cost-config', { action: 'set', prices: next }).catch(() => {})
      }
      const resetAll = () => { setDraft({}); host.call('cost-config', { action: 'set', prices: {} }).catch(() => {}) }
      return React.createElement('div', { className: 'cost-settings' },
        React.createElement('div', { className: 'cost-settings-row' },
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 500, fontSize: 13, color: 'var(--dsw-alias-label-primary)' } }, '费用预估'),
            React.createElement('div', { className: 'cost-settings-label' }, '自定义 ¥/百万 token 价格,留空用内置峰谷价')),
          React.createElement('button', { className: 'cost-pager', onClick: resetAll, style: { padding: '3px 10px' } }, '恢复内置价')),
        modelNames.map((model) => React.createElement('div', { key: model },
          React.createElement('div', { className: 'cost-settings-label', style: { marginBottom: 4 } }, model),
          React.createElement('div', { className: 'cost-price-grid' },
            ['cacheRead', 'cacheMiss', 'output'].map((key) => {
              const v = draft[model] ? draft[model][key] : ''
              return React.createElement('div', { key: key, className: 'cost-price-cell' },
                React.createElement('span', null, key === 'cacheRead' ? '缓存读' : (key === 'cacheMiss' ? '未命中输入' : '输出')),
                React.createElement('input', {
                  type: 'number', min: 0, step: 0.01, placeholder: '内置', value: v === undefined ? '' : String(v),
                  onChange: (e) => setPrice(model, key, e.target.value === '' ? undefined : Number(e.target.value))
                }))
            })))),
        React.createElement('div', { className: 'cost-settings-label' }, '说明: 峰时 09-12/14-18(北京),按请求时刻计价;内置价见 deepseek-v4-flash/pro'))
    }
    const CurrencyCard = (props) => {
      const cur = useCurrency()
      const [menuOpen, setMenuOpen] = React.useState(false)
      const [manual, setManual] = React.useState(null)
      const prefs = readPrefs()
      const applyCode = (code) => { writePrefs({ code, manualRate: readPrefs().manualRate }); syncCurrency(); ensureRates() }
      const applyManual = (value) => {
        const p = readPrefs()
        const n = Number(value)
        writePrefs({ code: p.code, manualRate: Number.isFinite(n) && n > 0 ? n : null })
        setManual(value)
        syncCurrency()
      }
      const rateText = cur.code === 'CNY' ? '人民币 ¥(默认)' : (cur.source === 'manual' ? '手动汇率 1 ' + cur.code + ' = ' + (readPrefs().manualRate ?? 1) + ' CNY' : cur.source === 'auto' ? '汇率自动获取 · 1 CNY = ' + cur.rate.toFixed(4) + ' ' + cur.code : cur.source === 'stale' ? '汇率缓存已过期 · 1 CNY = ' + cur.rate.toFixed(4) + ' ' + cur.code : '汇率获取失败,暂按人民币显示')
      React.useEffect(() => { ensureRates() }, [])
      return React.createElement('div', { className: 'cost-settings' },
        React.createElement('div', { className: 'cost-settings-row' },
          React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 500, fontSize: 13, color: 'var(--dsw-alias-label-primary)' } }, '账单货币'),
            React.createElement('div', { className: 'cost-settings-label' }, '账单、费用预估与余额的显示货币;汇率自动获取,可手动覆盖')),
          React.createElement('div', { className: 'cost-curr' },
            React.createElement('button', { className: 'cost-curr-btn', onClick: () => setMenuOpen(!menuOpen) }, CURRENCY_SYMBOLS[prefs.code] + ' ' + prefs.code, ' ▾'),
            menuOpen ? React.createElement('div', { className: 'cost-curr-menu' },
              BILLING_CURRENCIES.map(([c, sym]) => React.createElement('button', { key: c, className: 'cost-curr-item' + (prefs.code === c ? ' cost-curr-active' : ''), onClick: () => { applyCode(c); setMenuOpen(false) } },
                React.createElement('span', null, c, ' ', sym),
                prefs.code === c ? React.createElement('span', { className: 'cost-curr-tick' }, '✓') : null)))
            : null)),
        React.createElement('div', { className: 'cost-curr-rate' },
          React.createElement('div', { className: 'cost-curr-rate-value' }, rateText),
          React.createElement('div', { className: 'cost-curr-rate-meta' }, '数据源: open.er-api.com(每日更新)')),
        React.createElement('div', { className: 'cost-curr-manual' },
          React.createElement('label', null, '手动汇率(1 ' + prefs.code + ' = ? CNY)'),
          React.createElement('input', { type: 'number', min: 0, step: 0.0001, placeholder: prefs.code === 'CNY' ? '—' : '自动', value: manual !== null ? manual : (prefs.manualRate !== null ? String(prefs.manualRate) : ''), onChange: (e) => applyManual(e.target.value) }),
          React.createElement('span', { className: 'cost-settings-label' }, '留空使用自动汇率')))
    }
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.composer.dock', () => slots.register(
      { name: 'conversation.composer.dock', id: 'cost-meter', order: 0 },
      (props) => React.createElement(CostDock, { sessionId: props.sessionId })
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'billing', order: 31, label: '总账单' },
      () => React.createElement(BillingPage, null)
    ))
    slots.inject('settings.general.item', () => slots.register(
      { name: 'settings.general.item', id: 'cost-estimate', order: 30 },
      () => React.createElement(CostSettings, null)
    ))
    slots.inject('settings.general.item', () => slots.register(
      { name: 'settings.general.item', id: 'billing-currency', order: 32 },
      () => React.createElement(CurrencyCard, null)
    ))
  }
}
