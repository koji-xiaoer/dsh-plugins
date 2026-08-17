return {
  apply(ctx) {
    const projections = ctx.get('sessionProjections')
    if (projections === undefined) return
    const zeroBuckets = () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
    const bucketsFrom = (usage) => ({
      uncachedInputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.cacheWriteTokens ?? 0
    })
    const bucketsEqual = (l, r) => l.uncachedInputTokens === r.uncachedInputTokens && l.outputTokens === r.outputTokens && l.cacheReadTokens === r.cacheReadTokens && l.cacheWriteTokens === r.cacheWriteTokens
    const addReplacing = (totals, previous, next) => ({
      uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
      outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
      cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens
    })
    projections.register({
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
    })
    harness.handle('usage-by-model', async (args) => {
      const sessions = ctx.get('sessions')
      if (sessions === undefined) return null
      const session = sessions.get(args.sessionId)
      if (session === undefined) return null
      const snapshot = projections.snapshot(session)
      return snapshot.values?.tokenUsageByModel ?? null
    })
  }
}
