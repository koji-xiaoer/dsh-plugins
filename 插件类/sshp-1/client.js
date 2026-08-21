return {
  inject: ['timer'],
  apply(ctx) {
    styles.insert('.sshp-page{font-size:12px;color:var(--dsw-alias-label-secondary)}.sshp-desc{margin-bottom:10px;line-height:1.6}.sshp-table{width:100%;border-collapse:collapse;font-size:12px}.sshp-table th,.sshp-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}.sshp-table th{color:var(--dsw-alias-label-tertiary);font-weight:500}.sshp-empty{color:var(--dsw-alias-label-tertiary);padding:14px 0}.sshp-preview{margin:4px 0 14px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;max-height:340px;overflow:auto}.sshp-preview-title{font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:8px}.sshp-msg{margin-bottom:10px;font-size:12px;line-height:1.55}.sshp-msg-tag{font-weight:600;color:var(--dsw-alias-label-secondary);margin-right:6px}.sshp-msg-text{white-space:pre-wrap;color:var(--dsw-alias-label-primary);word-break:break-word}.sshp-mono{font-family:monospace}.sshp-foot{margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.6}.sshp-btn{background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:2px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary)}.sshp-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}.sshp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}.sshp-card{width:420px;max-width:calc(100vw - 48px);border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.18)}.sshp-card-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px}.sshp-card-desc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5;margin-bottom:12px;word-break:break-all}.sshp-input{width:100%;box-sizing:border-box;background:none;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;font-size:12px;color:var(--dsw-alias-label-primary);margin-bottom:14px}.sshp-actions{display:flex;justify-content:flex-end;gap:8px}.sshp-primary{color:#fff;background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}.sshp-badge-ok{font-size:11px;color:var(--dsw-alias-state-business-primary)}')

    const fmtTime = (t) => {
      try {
        const d = new Date(t)
        if (Number.isNaN(d.getTime())) return ''
        return (d.getMonth() + 1) + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      } catch { return '' }
    }

    const CopyBtn = (props) => {
      const copiedState = React.useState(false)
      const setCopied = copiedState[1]
      const doCopy = async () => {
        try { await navigator.clipboard.writeText(props.value); setCopied(true); ctx.timeout(() => setCopied(false), 1500) } catch { setCopied(false) }
      }
      return React.createElement('button', { className: 'sshp-btn', title: props.value, onClick: doCopy }, copiedState[0] ? '已复制✓' : '复制ID')
    }

    const Preview = (props) => {
      const data = props.data
      if (data === null) return React.createElement('div', { className: 'sshp-empty' }, '摘要加载中…')
      if (data.ok !== true) return React.createElement('div', { className: 'sshp-empty' }, '读取失败: ' + String(data.error !== undefined ? data.error : ''))
      const kids = []
      kids.push(React.createElement('div', { className: 'sshp-preview-title', key: 't' },
        '《' + (data.title || '无标题') + '》 最近 ' + data.messages.length + '/' + data.totalMessages + ' 条' +
        (data.skippedSynthetic > 0 ? ' · 另有 ' + data.skippedSynthetic + ' 条系统注入未列入' : '')))
      if (data.note) kids.push(React.createElement('div', { key: 'n', style: { marginBottom: 8, color: 'var(--dsw-alias-label-tertiary)' } }, '备注: ' + data.note))
      for (let i = 0; i < data.messages.length; i++) {
        const m = data.messages[i]
        const tag = m.role === 'user' ? '[用户 ' + fmtTime(m.time) + ']' : '[助手 #' + String(m.turn) + (m.interrupted === true ? ' 中断' : '') + ' ' + fmtTime(m.time) + ']'
        const msg = React.createElement('div', { className: 'sshp-msg', key: 'm' + i },
          React.createElement('span', { className: 'sshp-msg-tag' }, tag),
          React.createElement('span', { className: 'sshp-msg-text' }, m.text))
        kids.push(msg)
      }
      return React.createElement('div', { className: 'sshp-preview' }, kids)
    }

    const ShareDialog = () => {
      const targetState = React.useState(null)
      const target = targetState[0]
      const setTarget = targetState[1]
      const noteState = React.useState('')
      const note = noteState[0]
      const setNote = noteState[1]
      const sharedState = React.useState(null)
      const sharedInfo = sharedState[0]
      const setShared = sharedState[1]
      React.useEffect(() => {
        const onShare = (e) => {
          try {
            const d = e && e.detail ? e.detail : {}
            if (typeof d.sessionId !== 'string' || d.sessionId === '') return
            setTarget({ sessionId: d.sessionId, title: typeof d.title === 'string' ? d.title : '' })
            setNote('')
            setShared(null)
            host.call('share-get', { sessionId: d.sessionId }).then((r) => {
              if (r !== null && typeof r === 'object' && r.ok === true && r.shared === true) {
                setShared(r)
                setNote(typeof r.note === 'string' ? r.note : '')
              }
            }).catch(() => {})
          } catch {}
        }
        window.addEventListener('sshp:share-session', onShare)
        return () => window.removeEventListener('sshp:share-session', onShare)
      }, [])
      if (target === null) return null
      const close = () => setTarget(null)
      const publish = async () => {
        try { await host.call('share-publish', { sessionId: target.sessionId, note: note }) } catch {}
        setTarget(null)
      }
      const card = React.createElement('div', { className: 'sshp-card', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'sshp-card-title' }, sharedInfo !== null ? '更新分享' : '分享会话'),
        React.createElement('div', { className: 'sshp-card-desc' },
          '《' + (target.title || '无标题') + '》', sharedInfo !== null ? React.createElement('span', { className: 'sshp-badge-ok' }, ' · 已分享 ' + sharedInfo.shareId) : null,
          React.createElement('br'),
          '其他会话可通过 read_shared_session 工具或“设置 → 会话分享”页读取该会话的实时最近消息。'),
        React.createElement('input', { className: 'sshp-input', placeholder: '备注:值得其他会话看什么(可选)', value: note, onChange: (e) => setNote(e.target.value) }),
        React.createElement('div', { className: 'sshp-actions' },
          React.createElement('button', { className: 'sshp-btn', onClick: close }, '取消'),
          React.createElement('button', { className: 'sshp-btn sshp-primary', onClick: publish }, sharedInfo !== null ? '保存并保持分享' : '发布分享')))
      return React.createElement('div', { className: 'sshp-backdrop', onClick: close }, card)
    }

    const ShareManager = () => {
      const itemsState = React.useState(null)
      const items = itemsState[0]
      const setItems = itemsState[1]
      const previewState = React.useState(null)
      const preview = previewState[0]
      const setPreview = previewState[1]
      React.useEffect(() => {
        let alive = true
        const load = async () => {
          try {
            const r = await host.call('share-list', {})
            if (alive && r !== null && typeof r === 'object' && r.ok === true) setItems(r.items || [])
          } catch {}
        }
        load()
        const h = ctx.interval(load, 8000)
        return () => { alive = false; h() }
      }, [])
      const togglePreview = async (shareId) => {
        if (preview !== null && preview.shareId === shareId) { setPreview(null); return }
        setPreview({ shareId: shareId, data: null })
        try {
          const r = await host.call('share-read', { shareId: shareId, limit: 50 })
          setPreview({ shareId: shareId, data: r })
        } catch (e) { setPreview({ shareId: shareId, data: { ok: false, error: String(e) } }) }
      }
      const unpublish = async (shareId) => {
        try { await host.call('share-unpublish', { shareId: shareId }) } catch {}
        if (preview !== null && preview.shareId === shareId) setPreview(null)
        try {
          const r = await host.call('share-list', {})
          if (r !== null && typeof r === 'object' && r.ok === true) setItems(r.items || [])
        } catch {}
      }
      const desc = React.createElement('div', { className: 'sshp-desc', key: 'desc' },
        '在左侧会话行的“⋯”菜单里点“分享会话”登记分享,得到一个分享ID。其他会话可以:① 让模型调用 read_shared_session 工具读取摘要;② 或在本页直接预览。读取的是该会话实时的最近用户/助手消息。')
      const foot = React.createElement('div', { className: 'sshp-foot', key: 'foot' },
        '分享登记保存在本进程内存中:进程重启后登记消失(动态插件本身也不跨重启),需重新分享。读取方拿到的是读取时刻的实时摘要。')
      if (items === null) {
        const loading = React.createElement('div', { className: 'sshp-empty', key: 'loading' }, '加载中…')
        return React.createElement('div', { className: 'sshp-page' }, desc, loading, foot)
      }
      if (items.length === 0) {
        const empty = React.createElement('div', { className: 'sshp-empty', key: 'empty' }, '暂无已分享的会话 — 在左侧会话行的“⋯”菜单里点“分享会话”')
        return React.createElement('div', { className: 'sshp-page' }, desc, empty, foot)
      }
      const thLabels = ['分享ID', '会话标题', '备注', '分享时间', '操作']
      const ths = []
      for (const label of thLabels) ths.push(React.createElement('th', { key: label }, label))
      const thead = React.createElement('thead', null, React.createElement('tr', null, ths))
      const rows = []
      for (const it of items) {
        const actions = React.createElement('span', { style: { display: 'inline-flex', gap: 8 } },
          React.createElement(CopyBtn, { value: it.shareId }),
          React.createElement('button', { className: 'sshp-btn', onClick: () => togglePreview(it.shareId) }, preview !== null && preview.shareId === it.shareId ? '收起' : '预览摘要'),
          React.createElement('button', { className: 'sshp-btn', onClick: () => unpublish(it.shareId) }, '取消分享'))
        const noteTd = React.createElement('td', { style: { maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }, title: it.note }, it.note || '—')
        const row = React.createElement('tr', { key: it.shareId },
          React.createElement('td', { className: 'sshp-mono' }, it.shareId),
          React.createElement('td', null, it.title || '无标题'),
          noteTd,
          React.createElement('td', null, fmtTime(it.sharedAt)),
          React.createElement('td', null, actions))
        rows.push(row)
        if (preview !== null && preview.shareId === it.shareId) {
          const previewRow = React.createElement('tr', { key: 'p-' + it.shareId },
            React.createElement('td', { colSpan: 5 }, React.createElement(Preview, { data: preview.data })))
          rows.push(previewRow)
        }
      }
      const tbody = React.createElement('tbody', null, rows)
      const table = React.createElement('table', { className: 'sshp-table', key: 'tbl' }, thead, tbody)
      return React.createElement('div', { className: 'sshp-page' }, desc, table, foot)
    }

    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'session-share-dialog', order: 50 },
      () => React.createElement(ShareDialog, null)
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'session-share', order: 40, label: '会话分享' },
      () => React.createElement(ShareManager, null)
    ))
  }
}
