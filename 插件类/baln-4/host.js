return {
  apply(ctx) {
    harness.handle('balance', async () => {
      const credentials = ctx.get('credentials')
      let apiKey
      if (credentials !== undefined) {
        try {
          const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
          if (resolved !== undefined && typeof resolved.value === 'string' && resolved.value.length > 0) apiKey = resolved.value
        } catch { apiKey = undefined }
      }
      if (apiKey === undefined || apiKey.length === 0) return { ok: false, code: 'balance-credential-missing', message: 'DEEPSEEK_API_KEY is not configured' }
      try {
        const response = await fetch('https://api.deepseek.com/user/balance', {
          headers: { Authorization: 'Bearer ' + apiKey }
        })
        if (!response.ok) return { ok: false, code: 'balance-provider-error', message: 'balance query failed: HTTP ' + response.status }
        const payload = await response.json()
        const info = payload?.balance_infos?.[0] ?? {}
        return {
          ok: true,
          value: {
            isAvailable: payload?.is_available === true,
            currency: typeof info.currency === 'string' ? info.currency : 'CNY',
            totalBalance: Number(info.total_balance ?? 0),
            grantedBalance: Number(info.granted_balance ?? 0),
            toppedUpBalance: Number(info.topped_up_balance ?? 0)
          }
        }
      } catch (e) {
        return { ok: false, code: 'balance-provider-error', message: e instanceof Error ? e.message : String(e) }
      }
    })
  }
}
