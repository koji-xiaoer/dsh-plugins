return {
  apply(ctx) {
    const running = new Map()
    const completedSeq = new Map()
    ctx.on('agent/status', (payload) => {
      try {
        const id = payload?.agent?.id
        if (typeof id !== 'string' || id === '') return
        const status = payload?.status
        if (status !== 'running' && status !== 'idle') return
        const was = running.get(id) === true
        running.set(id, status === 'running')
        if (was && status === 'idle') completedSeq.set(id, (completedSeq.get(id) ?? 0) + 1)
      } catch { /* never break the loop */ }
    })
    harness.handle('notify-state', (args) => {
      const id = args?.sessionId
      let count = 0
      for (const v of running.values()) if (v === true) count++
      return {
        running: typeof id === 'string' && running.get(id) === true,
        runningCount: count,
        completedSeq: typeof id === 'string' ? (completedSeq.get(id) ?? 0) : 0
      }
    })
  }
}
