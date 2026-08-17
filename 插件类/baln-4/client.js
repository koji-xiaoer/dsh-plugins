return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert('.baln-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;line-height:20px;color:#8899aa;background:rgba(127,127,127,.12);cursor:default;white-space:nowrap;font-variant-numeric:tabular-nums}.baln-pill:hover{color:#b8c4d0}')
    slots.inject('conversation.session.header.utilities', () => slots.register(
      { name: 'conversation.session.header.utilities', id: 'baln-balance', order: 10 },
      (props) => {
        const [state, setState] = React.useState(null)
        React.useEffect(() => {
          let alive = true
          const tick = async () => {
            try {
              const result = await host.call('balance', {})
              if (alive) setState(result)
            } catch { if (alive) setState(null) }
          }
          tick()
          const dispose = ctx.interval(tick, 5000)
          return () => { alive = false; dispose() }
        }, [])
        if (state === null || typeof state !== 'object' || state.ok !== true || state.value === null || typeof state.value !== 'object') return null
        const v = state.value
        const total = Number(v.totalBalance) || 0
        const granted = Number(v.grantedBalance) || 0
        const topped = Number(v.toppedUpBalance) || 0
        const symbol = v.currency === 'CNY' ? '¥' : (v.currency || '') + ' '
        return React.createElement('span', {
          className: 'baln-pill',
          title: '总余额 ' + total.toFixed(2) + ' · 赠送 ' + granted.toFixed(2) + ' · 充值 ' + topped.toFixed(2) + ' · 每 5 秒刷新'
        }, symbol + total.toFixed(2))
      }
    ))
  }
}
