return {
  apply(ctx) {
    // 敏感字段：值在网页里默认脱敏为 ***
    const SENSITIVE_KEY = /(api[_-]?key|secret|token|password|passwd|authorization|credential|zhipu|deepseek|access[_-]?key|private[_-]?key)/i

    const redact = (text) => text.split('\n').map((line) => {
      const m = line.match(/^(\s*[A-Za-z0-9_.-]+\s*:\s*)(.+)$/)
      if (m && SENSITIVE_KEY.test(m[1]) && m[2].trim() !== '' && m[2].trim() !== '***') {
        return m[1] + '***'
      }
      return line
    }).join('\n')

    // 保存时把编辑内容里的 *** 行还原为原文对应行（密钥不随网页编辑丢失）
    const restore = (original, edited) => {
      const o = original.split('\n')
      const e = edited.split('\n')
      const n = Math.max(o.length, e.length)
      const out = []
      for (let i = 0; i < n; i++) {
        const oe = e[i] ?? ''
        if (oe.trim() === '***' && o[i] !== undefined) out.push(o[i])
        else out.push(oe)
      }
      return out.join('\n')
    }

    const docPath = async () => {
      const settings = ctx.get('settings')
      if (!settings) throw new Error('settings service absent')
      const path = await settings.prepareDocument()
      return path
    }

    ctx.effect(() => harness.handle('cfg.read', async () => {
      try {
        const path = await docPath()
        if (!path) return { ok: false, error: 'settings provider has no local document' }
        const fs = ctx.get('fs')
        if (!fs) return { ok: false, error: 'fs service absent' }
        const target = await fs.resolve(path)
        const text = await fs.readText(target)
        return { ok: true, path, text, redacted: redact(text) }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }))

    ctx.effect(() => harness.handle('cfg.save', async (args) => {
      try {
        const content = (args && typeof args.content === 'string') ? args.content : ''
        const path = await docPath()
        if (!path) return { ok: false, error: 'settings provider has no local document' }
        const fs = ctx.get('fs')
        if (!fs) return { ok: false, error: 'fs service absent' }
        const target = await fs.resolve(path)
        const original = await fs.readText(target)
        const merged = restore(original, content)
        const policy = ctx.get('sandboxPolicy')
        await fs.writeText(target, merged, undefined, undefined, policy && policy.resolve ? policy.resolve() : undefined)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }))
  },
}
