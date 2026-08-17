return {
  apply(ctx) {
    const cache = new Map()
    const CACHE_MAX = 200
    let keyPromise = null
    const apiKey = () => {
      if (keyPromise !== null) return keyPromise
      keyPromise = (async () => {
        const credentials = ctx.get('credentials')
        if (credentials !== undefined) {
          try {
            const resolved = await credentials.resolve('ZHIPU_API_KEY')
            if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) return resolved.value
          } catch { /* fall through */ }
        }
        return undefined
      })()
      return keyPromise
    }
    const base64FromBytes = (bytes) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      let out = ''
      for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2]
        out += chars[b0 >> 2]
        out += chars[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)]
        out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)]
        out += b2 === undefined ? '=' : chars[b2 & 63]
      }
      return out
    }
    const fetchWithTimeout = (url, options, ms) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('image relay timeout')), ms)
      fetch(url, options).then((r) => { clearTimeout(timer); resolve(r) }, (e) => { clearTimeout(timer); reject(e) })
    })
    const relayImage = async (attachment, signal) => {
      if (attachment === null || typeof attachment !== 'object') return '【图片：用户粘贴了一张图片】'
      const cacheKey = attachment.attachmentId
      if (typeof cacheKey === 'string' && cache.has(cacheKey)) return cache.get(cacheKey)
      const keyVal = await apiKey()
      if (keyVal === undefined) return '【图片：用户粘贴了一张图片，但未配置 ZHIPU_API_KEY，无法转成文字】'
      const attachments = ctx.get('attachments')
      if (attachments === undefined) return '【图片：用户粘贴了一张图片】'
      let stored
      try {
        stored = await attachments.readImage(attachment, signal)
      } catch { return '【图片：用户粘贴了一张图片】' }
      const b64 = base64FromBytes(stored.data)
      const mime = typeof attachment.mediaType === 'string' ? attachment.mediaType : 'image/png'
      try {
        const body = JSON.stringify({
          model: 'glm-4v-flash',
          messages: [{ role: 'user', content: [
            { type: 'text', text: '这是用户粘贴到聊天里的一张图片，请用简洁的2-3句话客观描述图片内容，帮助只看文字的模型理解它。直接描述内容本身，不要加“这是一张图片”之类的开场白。' },
            { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } }
          ] }],
          max_tokens: 512
        })
        const response = await fetchWithTimeout('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + keyVal },
          body
        }, 8000)
        if (!response.ok) return '【图片：用户粘贴了一张图片】'
        const payload = await response.json()
        const content = payload?.choices?.[0]?.message?.content
        const text = Array.isArray(content)
          ? content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
          : String(content ?? '')
        const result = text.trim() === '' ? '【图片：用户粘贴了一张图片】' : '【图片：' + text + '】'
        if (typeof cacheKey === 'string') {
          if (cache.size >= CACHE_MAX) cache.clear()
          cache.set(cacheKey, result)
        }
        return result
      } catch { return '【图片：用户粘贴了一张图片】' }
    }
    ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
      const decision = await next()
      if (decision === null || typeof decision !== 'object' || decision.kind !== 'enter') return decision
      let changed = false
      const newMessages = []
      for (const message of decision.messages) {
        const content = message.content
        if (!Array.isArray(content) || !content.some((b) => b !== null && typeof b === 'object' && b.type === 'image')) {
          newMessages.push(message)
          continue
        }
        changed = true
        const newContent = []
        for (const block of content) {
          if (block === null || typeof block !== 'object' || block.type !== 'image') {
            newContent.push(block)
            continue
          }
          const text = await relayImage(block.attachment, signal)
          newContent.push({ type: 'text', text })
        }
        newMessages.push(Object.assign({}, message, { content: newContent }))
      }
      return changed ? { kind: 'enter', messages: newMessages } : decision
    })
  }
}
