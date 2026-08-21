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

export default class DshModsEnhanced extends TypertRemoteService {
  static inject = ['sessionProjections']
  constructor(ctx, config = {}) {
    super(ctx, 'enhanced')
    this.ctx = ctx
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
  }
}

