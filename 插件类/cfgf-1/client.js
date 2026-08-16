return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    // 移除原「打开配置文件」按钮（无桌面环境下本就不可用）：
    // 覆盖 settings.action 的 open-document 席位为空实现；插件停止后自动恢复原按钮。
    slots.inject('settings.action', () => slots.register(
      { name: 'settings.action', id: 'open-document', order: 0 },
      () => null
    ))

    styles.insert(`
      .cfg-card {
        border-radius: 12px;
        border: 1px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-layer-1);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cfg-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .cfg-title {
        font-size: 14px;
        line-height: 22px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
      }
      .cfg-head-actions {
        display: flex;
        gap: 6px;
      }
      .cfg-path {
        font-family: var(--ds-font-family-code, ui-monospace, monospace);
        font-size: 12px;
        line-height: 18px;
        color: var(--dsw-alias-label-secondary);
        word-break: break-all;
      }
      .cfg-editor {
        width: 100%;
        min-height: 320px;
        max-height: 60vh;
        resize: vertical;
        box-sizing: border-box;
        border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: var(--dsw-alias-bg-base);
        color: var(--dsw-alias-label-primary);
        font-family: var(--ds-font-family-code, ui-monospace, monospace);
        font-size: 12px;
        line-height: 18px;
        font-variant-numeric: tabular-nums;
        padding: 8px;
        outline: none;
      }
      .cfg-editor:focus-visible {
        border-color: var(--dsw-alias-brand-primary);
      }
      .cfg-foot {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .cfg-btn {
        border-radius: 8px;
        border: 1px solid var(--dsw-alias-border-l1);
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
        padding: 4px 10px;
        cursor: pointer;
      }
      .cfg-btn:hover {
        color: var(--dsw-alias-label-primary);
        border-color: var(--dsw-alias-border-l2);
      }
      .cfg-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .cfg-btn-primary {
        background: var(--dsw-alias-brand-primary);
        border-color: transparent;
        color: var(--dsw-alias-bg-base);
        font-weight: 600;
      }
      .cfg-btn-warn {
        color: var(--dsw-alias-state-warn-primary);
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
      }
      .cfg-warnbar {
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent);
        color: var(--dsw-alias-state-warn-primary);
        font-size: 12px;
        line-height: 18px;
        padding: 6px 10px;
      }
      .cfg-msg-ok {
        color: var(--dsw-alias-state-success-primary);
        font-size: 12px;
      }
      .cfg-msg-err {
        color: var(--dsw-alias-state-error-primary);
        font-size: 12px;
      }
      .cfg-error {
        color: var(--dsw-alias-state-error-primary);
        font-size: 12px;
        line-height: 18px;
        padding: 6px 0;
      }
    `)

    function ConfigFileSection() {
      const [state, setState] = React.useState({ status: 'loading', path: '', text: '', redacted: '', error: '' })
      const [view, setView] = React.useState('redacted')
      const [draft, setDraft] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [msg, setMsg] = React.useState(null)
      // true: 文件里没有敏感字段，明文与脱敏内容相同
      const [noSecrets, setNoSecrets] = React.useState(false)

      const load = () => {
        setState((s) => ({ ...s, status: 'loading' }))
        host.call('cfg.read', {}).then((r) => {
          if (r && r.ok) {
            setState({ status: 'ready', path: r.path, text: r.text, redacted: r.redacted, error: '' })
            setNoSecrets(r.text === r.redacted)
            setView('redacted')
            setDraft(r.redacted)
            setMsg(null)
          } else {
            setState({ status: 'error', path: '', text: '', redacted: '', error: (r && r.error) || '读取配置文件失败' })
          }
        })
      }

      React.useEffect(() => { load() }, [])

      const toggleReveal = () => {
        if (view === 'redacted') {
          setView('reveal')
          setDraft(state.text)
        } else {
          setView('redacted')
          setDraft(state.redacted)
        }
      }

      const save = () => {
        setSaving(true)
        host.call('cfg.save', { content: draft }).then((r) => {
          setSaving(false)
          if (r && r.ok) {
            setMsg({ kind: 'ok', text: '已保存，配置文件已重新加载' })
            load()
          } else {
            setMsg({ kind: 'err', text: '保存失败：' + ((r && r.error) || '未知错误') })
          }
        })
      }

      return React.createElement('div', { className: 'cfg-card' },
        React.createElement('div', { className: 'cfg-head' },
          React.createElement('span', { className: 'cfg-title' }, '配置文件（网页编辑）'),
          React.createElement('div', { className: 'cfg-head-actions' },
            React.createElement('button', { className: 'cfg-btn', onClick: load, disabled: state.status === 'loading' }, '重新加载'),
            React.createElement('button', { className: 'cfg-btn cfg-btn-warn', onClick: toggleReveal, disabled: state.status !== 'ready' },
              view === 'redacted' ? '显示密钥值' : '隐藏密钥值'
            )
          )
        ),
        state.status === 'error'
          ? React.createElement('div', { className: 'cfg-error' }, '无法读取配置文件：' + state.error)
          : React.createElement('div', null,
              React.createElement('div', { className: 'cfg-path' }, state.status === 'loading' ? '加载中…' : state.path),
              view === 'reveal'
                ? React.createElement('div', { className: 'cfg-warnbar' },
                    noSecrets ? '配置文件中未检测到敏感字段，当前显示完整内容' : '当前显示明文密钥值，请勿在公共场合展示此页面'
                  )
                : null,
              React.createElement('textarea', {
                className: 'cfg-editor',
                value: draft,
                onChange: (e) => setDraft(e.target.value),
                spellCheck: false,
                disabled: state.status !== 'ready'
              }),
              React.createElement('div', { className: 'cfg-foot' },
                React.createElement('button', { className: 'cfg-btn cfg-btn-primary', onClick: save, disabled: saving || state.status !== 'ready' },
                  saving ? '保存中…' : '保存更改'
                ),
                msg ? React.createElement('span', { className: msg.kind === 'ok' ? 'cfg-msg-ok' : 'cfg-msg-err' }, msg.text) : null
              )
            )
      )
    }

    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'config-file', order: 30, label: '配置文件' },
      () => React.createElement(ConfigFileSection)
    ))
  },
}
