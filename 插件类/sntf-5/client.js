return {
  inject: ['timer'],
  apply(ctx) {
    const readPref = (k, def) => { try { const v = (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; return v === null ? def : v !== '0' } catch { return def } }
    const writePref = (k, on) => { try { localStorage.setItem(k, on ? '1' : '0') } catch {} }
    const readSource = () => { try { const s = localStorage.getItem('dsh.notify.sound.source'); return (s === 'bell' || s === 'custom') ? s : 'chime' } catch { return 'chime' } }
    const writeSource = (s) => { try { localStorage.setItem('dsh.notify.sound.source', s) } catch {} }
    const readVolume = () => { try { const n = Number(localStorage.getItem('dsh.notify.sound.volume')); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8 } catch { return 0.8 } }
    const writeVolume = (v) => { try { localStorage.setItem('dsh.notify.sound.volume', String(v)) } catch {} }
    const readGain = () => { try { const n = Number(localStorage.getItem('dsh.notify.sound.gain')); return Number.isFinite(n) ? Math.min(3, Math.max(1, n)) : 1 } catch { return 1 } }
    const writeGain = (g) => { try { localStorage.setItem('dsh.notify.sound.gain', String(g)) } catch {} }
    const readData = () => { try { return localStorage.getItem('dsh.notify.sound.data') } catch { return null } }
    const writeData = (d) => { try { if (d === null || d === '') localStorage.removeItem('dsh.notify.sound.data'); else localStorage.setItem('dsh.notify.sound.data', d) } catch {} }
    const readName = () => { try { return localStorage.getItem('dsh.notify.sound.name') || '' } catch { return '' } }
    const writeName = (n) => { try { if (n === '') localStorage.removeItem('dsh.notify.sound.name'); else localStorage.setItem('dsh.notify.sound.name', n) } catch {} }

    let audioCtx = null
    const ensureAudio = () => {
      try {
        if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
        if (audioCtx === null) audioCtx = new AudioContext()
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
        return audioCtx
      } catch { return null }
    }
    const playTone = (notes, type, peak, level) => {
      const ac = ensureAudio()
      if (ac === null || ac.state !== 'running') return
      const now = ac.currentTime
      for (const n of notes) {
        const freq = n[0], at = n[1], dur = n[2]
        const osc = ac.createOscillator()
        const gain = ac.createGain()
        osc.type = type
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + at)
        gain.gain.exponentialRampToValueAtTime(peak * level, now + at + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
        osc.connect(gain).connect(ac.destination)
        osc.start(now + at)
        osc.stop(now + at + dur + 0.05)
      }
    }
    const playChime = (level) => playTone([[659.25, 0, 0.45], [880, 0.28, 0.8]], 'sine', 0.12, level)
    const playBell = (level) => playTone([[880, 0, 0.35], [1318.51, 0.18, 0.55]], 'triangle', 0.1, level)
    const playCustom = (data, level) => {
      try {
        const audio = new Audio(data)
        if (level <= 1) { audio.volume = level; audio.play().catch(() => playChime(level)); return true }
        const ac = ensureAudio()
        if (ac === null || ac.state !== 'running') { audio.volume = 1; audio.play().catch(() => playChime(level)); return true }
        try {
          const src = ac.createMediaElementSource(audio)
          const g = ac.createGain()
          g.gain.value = level
          src.connect(g).connect(ac.destination)
          audio.volume = 1
          audio.play().catch(() => playChime(level))
        } catch { audio.volume = 1; audio.play().catch(() => playChime(level)) }
        return true
      } catch { return false }
    }
    const playSound = () => {
      const level = readVolume() * readGain()
      const source = readSource()
      if (source === 'bell') { playBell(level); return }
      if (source === 'custom') {
        const data = readData()
        if (data !== null && data !== '' && playCustom(data, level)) return
      }
      playChime(level)
    }
    const playPreview = (source, data, volume, gain) => {
      const level = volume * gain
      if (source === 'custom' && data !== null && data !== '' && playCustom(data, level)) return
      if (source === 'bell') playBell(level); else playChime(level)
    }

    let baseTitle = null
    const getBaseTitle = () => {
      try {
        if (typeof document === 'undefined') return 'DeepSeek Harness'
        if (baseTitle === null || baseTitle === '') baseTitle = document.title || 'DeepSeek Harness'
        return baseTitle
      } catch { return 'DeepSeek Harness' }
    }
    const isZh = () => { try { return typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.toLowerCase().startsWith('zh') } catch { return true } }
    const runningLabel = (n) => isZh() ? (n + ' 个会话运行中') : (n + ' session(s) running')
    const doneLabel = (n) => isZh() ? (n > 1 ? (n + ' 个会话已完成') : '会话已完成') : (n > 1 ? (n + ' sessions done') : 'Session done')

    styles.insert('.sntf-toast{position:fixed;right:20px;bottom:76px;z-index:9999;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:rgba(24,26,31,.92);color:#e8ecf2;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.35);animation:sntf-in .18s ease-out}.sntf-toast-icon{color:#3ecf8e;font-weight:700}@keyframes sntf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}')

    let flashUntil = 0
    let flashCount = 0
    const NotifyEngine = (props) => {
      const sessionId = props.sessionId
      const [toast, setToast] = React.useState(null)
      const [flash, setFlash] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        let lastRunning = false
        let lastSeq = 0
        let blink = false
        const tick = async () => {
          let s = null
          try { s = await host.call('notify-state', { sessionId }) } catch {}
          if (!alive || s === null || typeof s !== 'object') return
          const titleOn = readPref('dsh.notify.title', true)
          const now = Date.now()
          if (s.running === true) {
            if (titleOn) {
              blink = !blink
              try { document.title = (blink ? '● ' : '○ ') + runningLabel(s.runningCount) + ' · ' + getBaseTitle() } catch {}
            }
          } else if (lastRunning === true && s.completedSeq > lastSeq) {
            if (readPref('dsh.notify.sound', true)) playSound()
            const count = (now < flashUntil) ? flashCount + 1 : 1
            flashUntil = now + 8000
            flashCount = count
            if (titleOn) { try { document.title = '✓ ' + doneLabel(count) + ' · ' + getBaseTitle() } catch {} }
            setFlash({ until: flashUntil, count })
            setToast({ key: now, text: doneLabel(count) })
          } else if (s.runningCount === 0 && now >= flashUntil) {
            try { if (document.title !== getBaseTitle()) document.title = getBaseTitle() } catch {}
          }
          lastRunning = s.running === true
          lastSeq = s.completedSeq
        }
        tick()
        const h = ctx.interval(tick, 800)
        return () => { alive = false; h() }
      }, [sessionId])
      React.useEffect(() => {
        if (flash === null) return
        const wait = Math.max(0, flash.until - Date.now())
        const h = ctx.timeout(() => { try { if (document.title !== getBaseTitle()) document.title = getBaseTitle() } catch {} }, wait)
        return h
      }, [flash])
      React.useEffect(() => {
        if (toast === null) return
        const h = ctx.timeout(() => setToast(null), 4200)
        return h
      }, [toast])
      if (toast === null) return null
      return React.createElement('div', { className: 'sntf-toast' },
        React.createElement('span', { className: 'sntf-toast-icon' }, '✓'),
        React.createElement('span', null, toast.text))
    }

    const segBtn = (active, onClick, label) => React.createElement('button', {
      className: 'sntf-seg' + (active ? ' sntf-seg-active' : ''),
      onClick
    }, label)
    const NotifySettings = (props) => {
      const [tick, setTick] = React.useState(0)
      const rerender = () => setTick(tick + 1)
      const soundOn = readPref('dsh.notify.sound', true)
      const titleOn = readPref('dsh.notify.title', true)
      const source = readSource()
      const volume = readVolume()
      const gain = readGain()
      const data = readData()
      const name = readName()
      const [previewTimer, setPreviewTimer] = React.useState(null)
      const [pickError, setPickError] = React.useState(null)
      const schedulePreview = () => {
        if (previewTimer !== null) { previewTimer(); setPreviewTimer(null) }
        const h = ctx.timeout(() => { setPreviewTimer(null); playPreview(readSource(), readData(), readVolume(), readGain()) }, 250)
        setPreviewTimer(h)
      }
      const handleFile = (file) => {
        if (file === null || file === undefined) return
        if (file.size > 1024 * 1024) { setPickError('文件超过 1MB 上限'); return }
        if (typeof FileReader === 'undefined') { setPickError('当前环境不支持文件读取'); return }
        const reader = new FileReader()
        reader.onload = () => {
          writeData(String(reader.result)); writeName(file.name); setPickError(null); rerender()
        }
        reader.onerror = () => setPickError('文件读取失败')
        reader.readAsDataURL(file)
      }
      const onPick = (e) => { const f = e.target.files && e.target.files[0]; if (f) handleFile(f); e.target.value = '' }
      const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f) }
      return React.createElement('div', { className: 'sntf-card' },
        React.createElement('div', { className: 'sntf-row' },
          React.createElement('div', { className: 'sntf-head' },
            React.createElement('div', { className: 'sntf-title' }, '会话完成提醒'),
            React.createElement('div', { className: 'sntf-desc' }, '会话完成时播放提示音，并在网页标题动态显示运行状态')),
          React.createElement('label', { className: 'sntf-switch' },
            React.createElement('input', { type: 'checkbox', checked: soundOn, onChange: (e) => { writePref('dsh.notify.sound', e.target.checked); rerender() } }),
            React.createElement('span', null))),
        soundOn ? React.createElement('div', { className: 'sntf-sub' },
          React.createElement('div', { className: 'sntf-segs' },
            segBtn(source === 'chime', () => { writeSource('chime'); rerender() }, '默认提示音'),
            segBtn(source === 'bell', () => { writeSource('bell'); rerender() }, '清脆铃声'),
            segBtn(source === 'custom', () => { writeSource('custom'); rerender() }, '自定义音频')),
          React.createElement('button', { className: 'sntf-preview', onClick: () => playPreview(readSource(), readData(), readVolume(), readGain()) }, '试听'),
          React.createElement('div', { className: 'sntf-slider-row' },
            React.createElement('span', null, '音量'),
            React.createElement('input', { type: 'range', min: 0, max: 1, step: 0.05, value: volume, onChange: (e) => { writeVolume(Number(e.target.value)); rerender(); schedulePreview() } }),
            React.createElement('span', { className: 'sntf-pct' }, Math.round(volume * 100) + '%')),
          React.createElement('div', { className: 'sntf-slider-row' },
            React.createElement('span', null, '增益'),
            React.createElement('input', { type: 'range', min: 1, max: 3, step: 0.05, value: gain, onChange: (e) => { writeGain(Number(e.target.value)); rerender(); schedulePreview() } }),
            React.createElement('span', { className: 'sntf-pct' }, Math.round(gain * 100) + '%')),
          source === 'custom' ? React.createElement('div', { className: 'sntf-custom' },
            React.createElement('label', { className: 'sntf-pick', onDragOver: (e) => e.preventDefault(), onDrop: onDrop },
              React.createElement('input', { type: 'file', accept: '.mp3,.wav,.ogg,.webm,audio/*', style: { display: 'none' }, onChange: onPick }),
              data !== null ? '已选择: ' + (name || '音频') : '选择音频文件'),
            data !== null ? React.createElement('button', { className: 'sntf-remove', onClick: () => { writeData(null); writeName(''); setPickError(null); rerender() } }, '移除') : null,
            React.createElement('div', { className: 'sntf-fnote' }, pickError !== null ? pickError : ((name ? name + ' · ' : '') + '支持 MP3 / WAV / OGG / WEBM · 建议时长 ≤ 3 秒 · 文件 ≤ 1 MB')))
          : null)
        : null,
        React.createElement('div', { className: 'sntf-divider' }),
        React.createElement('div', { className: 'sntf-row' },
          React.createElement('div', { className: 'sntf-head' },
            React.createElement('div', { className: 'sntf-title' }, '动态网页标题'),
            React.createElement('div', { className: 'sntf-desc' }, '运行中闪烁 ●/○，完成闪 ✓')),
          React.createElement('label', { className: 'sntf-switch' },
            React.createElement('input', { type: 'checkbox', checked: titleOn, onChange: (e) => { writePref('dsh.notify.title', e.target.checked); rerender() } }),
            React.createElement('span', null))))
    }

    const slots = ctx.get('slots')
    if (slots === undefined) return
    slots.inject('settings.general.item', () => slots.register(
      { name: 'settings.general.item', id: 'notify', order: 40 },
      () => React.createElement(NotifySettings, null)
    ))
    slots.inject('conversation.session.header.utilities', () => slots.register(
      { name: 'conversation.session.header.utilities', id: 'sntf-status', order: 20 },
      (props) => React.createElement(NotifyEngine, { sessionId: props.sessionId })
    ))
  }
}
