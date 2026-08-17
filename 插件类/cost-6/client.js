return {
  inject: ['timer'],
  apply(ctx) {
    const fmtMoney = (v) => {
      const n = Number(v) || 0
      if (n >= 1) return '¥' + n.toFixed(2)
      if (n >= 0.01) return '¥' + n.toFixed(3).replace(/(\.\d*?[1-9])0+$/, '$1')
      if (n > 0) return '¥' + n.toFixed(4).replace(/(\.\d*?[1-9])0+$/, '$1')
      return '¥0'
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
    styles.insert('.cost-dock{display:flex;flex-direction:column;gap:6px;padding:8px 12px;border-radius:10px;font-size:12px;color:#aab4c0}.cost-dock-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cost-dock-total{font-weight:600;color:#dde3ea;font-variant-numeric:tabular-nums}.cost-dock-model{padding:1px 8px;border-radius:999px;background:rgba(120,140,170,.14);color:#9fb4d0}.cost-dock-toggle{cursor:pointer;opacity:.7}.cost-dock-toggle:hover{opacity:1}.cost-bars{display:flex;align-items:flex-end;gap:4px;height:120px;padding:4px 2px 0;overflow-x:auto}.cost-bar{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:26px;height:100%}.cost-bar-fill{width:18px;border-radius:4px 4px 0 0;background:#4a7dff;min-height:3px}.cost-bar-val{font-size:9px;color:#8fa0b8;line-height:1.4}.cost-bar-idx{font-size:9px;color:#6b7a90}.cost-pager{display:flex;align-items:center;gap:8px;font-size:11px}.cost-pager button{background:none;border:1px solid rgba(127,140,170,.35);color:inherit;border-radius:6px;padding:1px 8px;cursor:pointer;font-size:11px}.cost-pager button:disabled{opacity:.35;cursor:default}.cost-table{width:100%;border-collapse:collapse;font-size:12px}.cost-table th,.cost-table td{padding:4px 8px;text-align:left;border-bottom:1px solid rgba(127,140,170,.16);white-space:nowrap}.cost-table th{color:#8fa0b8;font-weight:500}.cost-table tr.clickable{cursor:pointer}.cost-table tr.clickable:hover{background:rgba(120,140,170,.1)}.cost-num{text-align:right;font-variant-numeric:tabular-nums}.cost-empty{color:#8fa0b8;padding:12px;text-align:center}')

    const ModelChip = (props) => {
      const m = props.model
      return React.createElement('span', { className: 'cost-dock-model' }, m, ' ', fmtMoney(props.cost))
    }
    const TurnBars = (props) => {
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
        return React.createElement('div', { key: String(t.turn), className: 'cost-bar', title: t.model + ' · ' + t.steps + ' 步 · ' + fmtMoney(t.cost) },
          React.createElement('div', { className: 'cost-bar-val' }, fmtMoney(t.cost)),
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
      const [data, setData] = React.useState(null)
      const [open, setOpen] = React.useState(false)
      React.useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            const r = await host.call('cost-session', { sessionId })
            if (alive && r !== null && typeof r === 'object' && r.ok === true) setData(r)
          } catch {}
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
          React.createElement('span', { className: 'cost-dock-total' }, '费用 ' + fmtMoney(data.cost)),
          React.createElement('span', null, '输入 ' + fmtTok(data.input + data.write)),
          React.createElement('span', null, '输出 ' + fmtTok(data.output)),
          models.slice(0, 3).map((kv) => React.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost })),
          turns.length > 0 ? React.createElement('span', { className: 'cost-dock-toggle', onClick: () => setOpen(!open) }, open ? '收起 ▲' : '每轮费用 ▼') : null),
        open && turns.length > 0 ? React.createElement(TurnBars, { turns }) : null)
    }
    const Drill = (props) => {
      const item = props.item
      const turns = item.turns || []
      const calls = item.calls || []
      return React.createElement('div', null,
        React.createElement('div', { className: 'cost-dock-row', style: { padding: '6px 0' } },
          React.createElement('span', null, '按模型:'),
          Object.entries(item.byModel || {}).map((kv) => React.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost }))),
        React.createElement('div', { className: 'cost-dock-row', style: { padding: '4px 0' } },
          React.createElement('span', null, '按日:'),
          Object.entries(item.byDay || {}).map((kv) => React.createElement('span', { key: kv[0], className: 'cost-dock-model' }, kv[0], ' ', fmtMoney(kv[1].cost)))),
        React.createElement('div', { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, '轮次明细(' + turns.length + ')'),
        React.createElement('table', { className: 'cost-table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, '轮次'), React.createElement('th', null, '步数'), React.createElement('th', null, '模型'),
            React.createElement('th', { className: 'cost-num' }, '输入'), React.createElement('th', { className: 'cost-num' }, '输出'), React.createElement('th', { className: 'cost-num' }, '费用'))),
          React.createElement('tbody', null, turns.slice(0, 10).map((t) => React.createElement('tr', { key: String(t.turn) },
            React.createElement('td', null, '#' + t.turn), React.createElement('td', null, t.steps), React.createElement('td', null, t.model),
            React.createElement('td', { className: 'cost-num' }, fmtTok(t.input + t.write)), React.createElement('td', { className: 'cost-num' }, fmtTok(t.output)),
            React.createElement('td', { className: 'cost-num' }, fmtMoney(t.cost)))))),
        React.createElement('div', { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, '逐笔明细(' + calls.length + ')'),
        React.createElement('table', { className: 'cost-table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, '时间'), React.createElement('th', null, '轮/步'), React.createElement('th', null, '模型'),
            React.createElement('th', { className: 'cost-num' }, '输入'), React.createElement('th', { className: 'cost-num' }, '输出'), React.createElement('th', { className: 'cost-num' }, '费用'))),
          React.createElement('tbody', null, calls.slice(0, 10).map((c, i) => React.createElement('tr', { key: String(i) },
            React.createElement('td', null, fmtTime(c.time)), React.createElement('td', null, '#' + c.turn + '.' + c.step), React.createElement('td', null, c.model),
            React.createElement('td', { className: 'cost-num' }, fmtTok(c.input + c.write)), React.createElement('td', { className: 'cost-num' }, fmtTok(c.output)),
            React.createElement('td', { className: 'cost-num' }, fmtMoney(c.cost)))))))
    }
    const BillingPage = (props) => {
      const [data, setData] = React.useState(null)
      const [expanded, setExpanded] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        const tick = async () => {
          try {
            const r = await host.call('cost-all', {})
            if (alive && r !== null && typeof r === 'object' && r.ok === true) setData(r)
          } catch {}
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
          React.createElement('span', { className: 'cost-dock-total' }, '总费用 ' + fmtMoney(total)),
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
              React.createElement('td', { className: 'cost-num' }, fmtMoney(it.cost))),
            expanded === it.sessionId ? React.createElement('tr', { key: 'd' + it.sessionId }, React.createElement('td', { colSpan: 7, style: { padding: '4px 8px 10px' } }, React.createElement(Drill, { item: it }))) : null
          ]))),
        React.createElement('div', { className: 'cost-empty', style: { marginTop: 10, fontSize: 11 } }, '费用按请求时刻计价(峰谷价表),每 5 秒刷新'))
    }
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.composer.dock', () => slots.register(
      { name: 'conversation.composer.dock', id: 'cost-meter', order: 0 },
      (props) => React.createElement(CostDock, { sessionId: props.sessionId })
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'billing-v2', order: 31, label: '总账单' },
      () => React.createElement(BillingPage, null)
    ))
  }
}
