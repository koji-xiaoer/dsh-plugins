return {
  inject: ['timer'],
  apply(ctx) {
    styles.insert('.tokm-row{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 4px;align-items:center}.tokm-cell{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}')
    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('conversation.composer.dock', () => slots.register(
      { name: 'conversation.composer.dock', id: 'tokm-usage', order: 10 },
      (props) => {
        const sessionId = props.sessionId
        const [data, setData] = React.useState(null)
        React.useEffect(() => {
          let alive = true
          const tick = async () => {
            try {
              const value = await host.call('usage-by-model', { sessionId })
              if (alive) setData(value)
            } catch (e) { /* transient */ }
          }
          tick()
          const dispose = ctx.interval(tick, 2000)
          return () => { alive = false; dispose() }
        }, [sessionId])
        if (data === null || Object.keys(data).length === 0) return React.createElement('div', { className: 'tokm-row' }, '按模型用量加载中…')
        const rows = Object.entries(data).map(([model, b]) => React.createElement('span', { key: model, className: 'tokm-cell' },
          model + ' ' + (b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens) + ' tok'))
        return React.createElement('div', { className: 'tokm-row' }, rows)
      }
    ))
  }
}
