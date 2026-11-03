window.__ModuleLoader__.load({
	id: "dsh-cost-ledger",
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		let react = require("react")
		const React = react
		const h = React.createElement
		// 胶囊面板用 portal 挂到 document.body:输入框工具条所在的 .row 声明了
		// container-type: inline-size,现代 Chromium 会把它当成 fixed 子元素的包含块,
		// 挂在里面的浮层会被整体偏移到屏幕外。原生 Tooltip 没有 portal,所以三枚胶囊
		// 的提示/面板统一走 body 层。
		let createPortal = null
		try {
			const reactDom = require("react-dom")
			createPortal = reactDom === null || reactDom === undefined ? null : reactDom.createPortal
		} catch {
			createPortal = null
		}
		// 原生组件库:升级后接口改名时降级而不是整块崩掉
		let primitives = {}
		try {
			primitives = require("@deepseek-ai/dsh-client-ui-primitives") || {}
		} catch {
			primitives = {}
		}
		// 注意:primitives.Button / 部分图标是 forwardRef 对象而非函数,只能判 undefined,
		// 不能用 typeof === "function",否则会误判成缺失而退化成无样式按钮。
		const P = {
			Tooltip: primitives.Tooltip === undefined || primitives.Tooltip === null ? (props) => props.children : primitives.Tooltip,
			Menu: primitives.Menu === undefined || primitives.Menu === null ? null : primitives.Menu,
			Button: primitives.Button === undefined || primitives.Button === null ? (props) => React.createElement("button", { type: "button", disabled: props.disabled, onClick: props.onClick, className: props.className }, props.children) : primitives.Button,
			Chevron: primitives.IconChevronDownOutlineRegular === undefined || primitives.IconChevronDownOutlineRegular === null ? null : primitives.IconChevronDownOutlineRegular,
		}
		// 插槽自检:apply 时逐个登记,注入回调触发即视为该版本仍声明此插槽
		const slotStatus = {
			turnTail: false,
			headerUtilities: false,
			inputRight: false,
			settingsSection: false,
			since: Date.now(),
		}

		// ================= CSS =================
		const CSS_TAG = "dsh-cost-ledger/ui.css"
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style")
			tag.dataset.plugin = "dsh-cost-ledger"
			tag.dataset.pluginCss = CSS_TAG
			tag.textContent = [
				".dcl-pill{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);padding:0 6px;border-radius:999px;cursor:default;white-space:nowrap}",
				".dcl-pill:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".dcl-pill-strong{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
				".dcl-pill-free{color:var(--dsw-alias-state-business-primary)}",
				".dcl-panel{display:flex;flex-direction:column;gap:16px;font-size:13px;color:var(--dsw-alias-label-primary);line-height:1.6}",
				".dcl-card{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:12px;background:var(--dsw-alias-settings-card-fill);padding:14px 16px;display:flex;flex-direction:column;gap:10px}",
				".dcl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}",
				".dcl-muted{color:var(--dsw-alias-label-tertiary);font-size:12px}",
				".dcl-big{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.2px}",
				".dcl-kpis{display:flex;gap:24px;flex-wrap:wrap}",
				".dcl-kpi{display:flex;flex-direction:column;gap:2px;min-width:96px}",
				".dcl-kpi b{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}",
				".dcl-chart{display:flex;gap:10px;align-items:stretch;height:190px;padding-top:6px}",
				".dcl-chart-y{display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;text-align:right;min-width:64px}",
				".dcl-chart-main{flex:1;display:flex;flex-direction:column;min-width:0}",
				".dcl-bars{flex:1;display:flex;align-items:flex-end;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2);padding:0 2px}",
				".dcl-bar-slot{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0;position:relative}",
				".dcl-bar{width:70%;max-width:22px;min-height:2px;border-radius:3px 3px 0 0;background:var(--dsw-alias-state-business-primary);opacity:.85}",
				".dcl-bar-slot:hover .dcl-bar{opacity:1}",
				".dcl-bar-empty{background:var(--dsw-alias-border-l2);opacity:.45}",
				".dcl-bar-today{background:var(--dsw-alias-label-primary);opacity:.9}",
				".dcl-x{display:flex;gap:4px;padding:4px 2px 0}",
				".dcl-x-cell{flex:1;min-width:0;text-align:center;font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden}",
				".dcl-table{width:100%;border-collapse:collapse;font-size:12px}",
				".dcl-table th,.dcl-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top}",
				".dcl-table th{color:var(--dsw-alias-label-tertiary);font-weight:500;white-space:nowrap}",
				".dcl-table td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}",
				".dcl-tag{display:inline-block;font-size:11px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);margin-left:6px}",
				".dcl-error{color:var(--dsw-alias-state-error-primary,#d33);font-size:12px;white-space:pre-wrap}",
				".dcl-warn{color:var(--dsw-alias-state-warning-primary,#b26a00);font-size:12px;white-space:pre-wrap}",
				".dcl-native-select{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 10px;border:none;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:20px;cursor:pointer}",
				".dcl-native-select:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
				".dcl-native-select:disabled{opacity:.5;cursor:default}",
				".dcl-native-select svg{flex:none;opacity:.75}",
				".dcl-seg-price{font-variant-numeric:tabular-nums}",
				".dcl-models{display:flex;flex-direction:column;gap:12px}",
				".dcl-model{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}",
				".dcl-model-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}",
				".dcl-model-head b{font-size:13px}",
				".dcl-model-id{font-family:var(--ds-font-family-code,monospace);font-size:11px}",
				".dcl-price-table{table-layout:fixed;width:100%}",
				".dcl-price-table th,.dcl-price-table td{padding:4px 6px;white-space:nowrap}",
				".dcl-price-table th.num,.dcl-price-table td.num{text-align:right}",
				".dcl-price-table tbody tr:last-child td{border-bottom:none}",
				".dcl-note-row td{border-bottom:none;padding:0 6px 6px;font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:normal;line-height:1.5}",
				".dcl-toolbar-cost{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;height:22px;margin:0;padding:0 6px;border:0;border-radius:6px;background:transparent;font-family:inherit;font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer}",
				".dcl-toolbar-cost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
				".dcl-timechip{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:5px;height:22px;box-sizing:border-box;margin:0;padding:0 9px;border:0;border-radius:999px;font-family:inherit;font-size:12px;line-height:20px;white-space:nowrap;cursor:pointer;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform)}",
				".dcl-timechip:focus-visible,.dcl-toolbar-cost:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
				".dcl-timechip-off{background:rgba(34,197,94,.12)}",
				".dcl-timechip-off:hover{background:rgba(34,197,94,.2)}",
				".dcl-timechip-off .dcl-timechip-dot{background:var(--dsw-alias-state-success-primary,#22c55e)}",
				".dcl-timechip-peak{background:rgba(245,158,11,.12)}",
				".dcl-timechip-peak:hover{background:rgba(245,158,11,.2)}",
				".dcl-timechip-peak .dcl-timechip-dot{background:var(--dsw-alias-state-warn-primary,#f59e0b)}",
				".dcl-timechip-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary)}",
				// —— 胶囊悬浮面板:全部 dcl-hp-* 前缀,避免和设置菜单的 .dcl-panel/.dcl-row 撞名 ——
				".dcl-hp-panel{position:fixed;z-index:1100;box-sizing:border-box;width:352px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-menu-surface-fill,var(--dsw-alias-bg-layer-1));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(24px) saturate(1.4));color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.6;box-shadow:0 8px 24px rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.06);animation:dcl-hp-in .16s ease-out}",
				"@keyframes dcl-hp-in{0%{opacity:0;transform:translateY(3px)}100%{opacity:1;transform:translateY(0)}}",
				"@media (prefers-reduced-motion: reduce){.dcl-hp-panel{animation:none}}",
				".dcl-hp-head{display:flex;align-items:center;gap:8px}",
				".dcl-hp-dot{width:8px;height:8px;border-radius:50%;flex:none;background:currentColor}",
				".dcl-hp-title{font-size:13px;font-weight:600}",
				".dcl-hp-badge{display:inline-flex;align-items:center;height:20px;box-sizing:border-box;padding:0 8px;margin-left:auto;border-radius:999px;font-size:11px;line-height:18px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:color-mix(in srgb,currentColor 8%,transparent)}",
				".dcl-hp-sub{margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
				".dcl-hp-section{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}",
				".dcl-hp-section-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
				".dcl-hp-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:2px 0}",
				".dcl-hp-key{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px}",
				".dcl-hp-value{min-width:0;text-align:right;color:var(--dsw-alias-label-secondary)}",
				".dcl-hp-warn{margin-top:6px;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-warn-primary,#f59e0b)}",
				".dcl-hp-foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-tertiary)}",
				".dcl-hp-tone-ok{color:var(--dsw-alias-state-success-primary,#22c55e)}",
				".dcl-hp-tone-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}",
				".dcl-hp-tone-bad{color:var(--dsw-alias-state-error-primary,#ef4444)}",
				".dcl-hp-tone-brand{color:var(--dsw-alias-brand-primary,#4d6bfe)}",
				".dcl-hp-amount{margin-top:2px;font-size:22px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}",
				".dcl-hp-timeline{margin-top:8px}",
				".dcl-hp-track{position:relative;height:14px;border-radius:7px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 16%,transparent)}",
				".dcl-hp-band{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f59e0b) 34%,transparent)}",
				".dcl-hp-now{position:absolute;top:-2px;bottom:-2px;width:2px;transform:translateX(-1px);background:var(--dsw-alias-label-primary);box-shadow:0 0 0 1px var(--dsw-alias-bg-base)}",
				".dcl-hp-ticks{display:flex;justify-content:space-between;margin-top:3px;font-size:10px;color:var(--dsw-alias-label-tertiary)}",
				".dcl-hp-buckets{display:flex;flex-direction:column;gap:4px}",
				".dcl-hp-bucket{display:flex;align-items:center;gap:8px;height:20px}",
				".dcl-hp-bucket-name{width:66px;flex:none;color:var(--dsw-alias-label-secondary)}",
				".dcl-hp-bucket-track{flex:1;height:6px;border-radius:3px;overflow:hidden;background:var(--dsw-alias-border-l1)}",
				".dcl-hp-bucket-fill{height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary,#4d6bfe);opacity:.72}",
				".dcl-hp-bucket-value{width:56px;flex:none;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}",
			].join("")
			document.head.appendChild(tag)
		}

		// ================= RPC =================
		async function rpc(path, params) {
			const query = new URLSearchParams()
			for (const [key, value] of Object.entries(params || {})) {
				if (value !== undefined && value !== null) query.set(key, String(value))
			}
			const url = path + (query.toString() === "" ? "" : "?" + query.toString())
			const response = await fetch(url, { headers: { accept: "application/json" } })
			const text = await response.text()
			let payload
			try {
				payload = text === "" ? {} : JSON.parse(text)
			} catch {
				payload = { ok: false, error: "接口返回不是 JSON" }
			}
			return payload
		}

		// ================= 格式化 =================
		function symbolOf(currency) {
			return currency === "CNY" ? "¥" : currency === "USD" ? "$" : String(currency || "") + " "
		}
		function money(value, currency) {
			const symbol = symbolOf(currency)
			if (typeof value !== "number" || !Number.isFinite(value)) return symbol + "—"
			const abs = Math.abs(value)
			let digits = abs > 0 && abs < 0.01 ? 6 : abs > 0 && abs < 1 ? 4 : 2
			if (abs > 0 && abs < 0.000001) digits = 8
			let text = value.toFixed(digits)
			if (digits > 2) text = text.replace(/0+$/, "").replace(/\.$/, "")
			if (text.split(".")[1] === undefined || text.split(".")[1].length < 2) text = value.toFixed(2)
			return symbol + text
		}
		function priceText(value, currency) {
			const symbol = symbolOf(currency)
			if (typeof value !== 'number' || !Number.isFinite(value)) return symbol + '—'
			let text = value.toFixed(4)
			text = text.replace(/0+$/, '').replace(/\.$/, '')
			const fraction = text.split('.')[1] || ''
			if (fraction.length < 2) text = value.toFixed(2)
			return symbol + text
		}
		function compactTokens(value) {
			if (typeof value !== "number" || !Number.isFinite(value)) return "—"
			if (value >= 1e9) return (value / 1e9).toFixed(2) + "B"
			if (value >= 1e6) return (value / 1e6).toFixed(2) + "M"
			if (value >= 1e3) return (value / 1e3).toFixed(1) + "K"
			return String(value)
		}
		// 未计价路由:token 已计入,但没配置价格,金额会算成 0 —— 展示上必须显式区分,
		// 否则徽标会静默显示 ¥0.00,让人误以为没有费用。
		function unpricedBucket(data) {
			const unpriced = data !== null && typeof data === "object" && data.unpriced !== null && typeof data.unpriced === "object" ? data.unpriced : {}
			let tokens = 0
			const keys = Object.keys(unpriced)
			for (const key of keys) {
				const bucket = unpriced[key] ?? {}
				tokens += (Number(bucket.miss) || 0) + (Number(bucket.read) || 0) + (Number(bucket.write) || 0) + (Number(bucket.out) || 0)
			}
			return { keys, tokens, unpriced }
		}
		function unpricedLine(data) {
			const { keys, unpriced } = unpricedBucket(data)
			if (keys.length === 0) return undefined
			return "未配置价格、未计入金额:" + keys.map((key) => {
				const bucket = unpriced[key] ?? {}
				return key + "(未命中 " + compactTokens(bucket.miss) + " · 命中 " + compactTokens(bucket.read) + " · 输出 " + compactTokens(bucket.out) + ")"
			}).join("、")
		}
		function fmtDateTime(ms) {
			if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—"
			const d = new Date(ms)
			const pad = (n) => String(n).padStart(2, "0")
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
		}
		function fmtDay(day) {
			return typeof day === "string" && day.length === 10 ? day.slice(5) : String(day || "")
		}

		// ================= 数据缓存 =================
		const sessionCache = new Map()
		const SESSION_TTL = 8000
		function loadSession(sessionId, force) {
			const cached = sessionCache.get(sessionId)
			const now = Date.now()
			if (!force && cached !== undefined && now - cached.at < SESSION_TTL && cached.pending === undefined) return Promise.resolve(cached.data)
			if (cached !== undefined && cached.pending !== undefined) return cached.pending
			const pending = rpc("/cost-ledger/session", { sessionId })
				.then((data) => {
					sessionCache.set(sessionId, { at: Date.now(), data })
					return data
				})
				.catch(() => ({ ok: false, error: "读取失败" }))
			sessionCache.set(sessionId, { at: cached === undefined ? 0 : cached.at, data: cached === undefined ? undefined : cached.data, pending })
			return pending
		}

		// ================= 每轮费用徽标 =================
		function CostTurnPill(props) {
			const sessionId = props.sessionId
			// turnTail 的 owner prop 是 TurnLocation 对象({turn, start, end, steps,...}),取其中的 turn 序号。
			const turn = Number(props.turn !== null && typeof props.turn === 'object' ? props.turn.turn : props.turn)
			const [state, setState] = React.useState({ loading: true })
			React.useEffect(() => {
				let alive = true
				if (typeof sessionId !== "string" || sessionId === "" || !Number.isFinite(turn)) {
					setState({ loading: false, data: undefined })
					return () => { alive = false }
				}
				loadSession(sessionId, false).then((data) => {
					if (alive) setState({ loading: false, data })
				})
				return () => { alive = false }
			}, [sessionId, turn])
			if (state.loading) return null
			const data = state.data
			if (typeof sessionId !== 'string' || data === undefined || data.ok !== true) return null
			const entry = data.turns === undefined ? undefined : data.turns[turn]
			if (entry === undefined) return null
			const currency = data.displayCurrency
			const rate = typeof entry.native === "number" && entry.native > 0 && typeof entry.cost === "number" ? entry.cost / entry.native : undefined
			const title = [
				`本轮 tokens:未命中 ${compactTokens(entry.tokens.miss)} · 命中 ${compactTokens(entry.tokens.read)} · 写入 ${compactTokens(entry.tokens.write)} · 输出 ${compactTokens(entry.tokens.out)}`,
				entry.services !== undefined && ((entry.services.search ?? 0) > 0 || (entry.services.fetch ?? 0) > 0)
					? `服务调用:搜索 ${entry.services.search ?? 0} 次 · 抓取 ${entry.services.fetch ?? 0} 次(${money(entry.serviceCost ?? 0, currency)})`
					: undefined,
				typeof entry.toolTokens === "number" && entry.toolTokens > 0
					? `其中检索内容 ${compactTokens(entry.toolTokens)} tokens(约 ${money(entry.toolTokenCost?.miss ?? 0, currency)},已含在模型费用里)`
					: undefined,
				typeof entry.native === "number" ? `原始金额:${money(entry.native, "USD")}` : undefined,
				typeof rate === "number" && Math.abs(rate - 1) > 1e-9 ? `当日汇率:1 USD = ${rate.toFixed(4)} ${currency}` : undefined,
				entry.free === true ? "该轮全部为免费路由" : undefined,
				entry.priced === false ? "该轮含未定价/待采集汇率的模型,金额不完整" : undefined,
			].filter(Boolean).join("\n")
			const display = entry.priced === false && entry.free !== true && !(entry.cost > 0) ? "未定价" : money(entry.cost, currency)
			return React.createElement(P.Tooltip, { label: title, side: "top", portal: true },
				React.createElement("span", { className: "dcl-pill" }, "本轮 ", React.createElement("span", { className: "dcl-pill-strong" }, display)))
		}

		// ================= 会话累计徽标 =================
		function CostHeaderBadge(props) {
			const sessionId = props.sessionId
			const [state, setState] = React.useState({ loading: true })
			React.useEffect(() => {
				let alive = true
				if (typeof sessionId !== "string" || sessionId === "") {
					setState({ loading: false, data: undefined })
					return () => { alive = false }
				}
				loadSession(sessionId, false).then((data) => {
					if (alive) setState({ loading: false, data })
				})
				return () => { alive = false }
			}, [sessionId])
			if (state.loading) return null
			const data = state.data
			if (data === undefined || data.ok !== true) return null
			const currency = data.displayCurrency
			const title = [
				`本会话 tokens:未命中 ${compactTokens(data.tokens.miss)} · 命中 ${compactTokens(data.tokens.read)} · 写入 ${compactTokens(data.tokens.write)} · 输出 ${compactTokens(data.tokens.out)}`,
				data.services !== undefined && ((data.services.search ?? 0) > 0 || (data.services.fetch ?? 0) > 0)
					? `服务调用:搜索 ${data.services.search ?? 0} 次 · 抓取 ${data.services.fetch ?? 0} 次(${money(data.serviceCost ?? 0, currency)})`
					: undefined,
				unpricedLine(data),
				data.pendingFx !== undefined && data.pendingFx.length > 0 ? `汇率待采集:${data.pendingFx.join(", ")}` : undefined,
			].filter(Boolean).join("\n")
			const display = data.total === 0 && unpricedBucket(data).tokens > 0 ? "未定价" : money(data.total, currency)
			return React.createElement(P.Tooltip, { label: title, side: "top", portal: true },
				React.createElement("span", { className: "dcl-pill" }, "本会话 ", React.createElement("span", { className: "dcl-pill-strong" }, display)))
		}

		// ================= 模型选择器左侧的会话累计(只显示金额) =================
		// 悬停展开明细面板:费用合计、最近一轮、tokens 分桶、未定价与口径说明。
		function CostToolbarChip(props) {
			const sessionId = props.sessionId
			const [state, setState] = React.useState({ loading: true })
			React.useEffect(() => {
				if (typeof sessionId !== "string" || sessionId === "") {
					setState({ loading: false })
					return undefined
				}
				let alive = true
				const load = () => {
					loadSession(sessionId, true).then((data) => {
						if (alive) setState({ loading: false, data })
					})
				}
				load()
				const timer = setInterval(load, 6000)
				return () => {
					alive = false
					clearInterval(timer)
				}
			}, [sessionId])
			if (typeof sessionId !== "string" || sessionId === "") return null
			if (state.loading) return null
			const data = state.data
			if (data === undefined || data.ok !== true) return null
			const display = data.total === 0 && unpricedBucket(data).tokens > 0 ? "未定价" : money(data.total, data.displayCurrency)
			return h(HoverPanel, {
				triggerClass: "dcl-toolbar-cost",
				panelKind: "cost",
				ariaLabel: "本会话费用 " + display + ",点开查看计费明细",
				triggerContent: h("span", null, display),
				renderPanel: () => h(CostDetailPanel, { data }),
			})
		}

		// 面板:费用合计 + 最近一轮 + tokens 分桶 + 口径
		function CostDetailPanel(props) {
			const data = props.data
			const currency = data.displayCurrency
			const tokens = data.tokens !== null && typeof data.tokens === "object" ? data.tokens : {}
			const miss = Number(tokens.miss) || 0
			const read = Number(tokens.read) || 0
			const write = Number(tokens.write) || 0
			const out = Number(tokens.out) || 0
			const totalTokens = miss + read + write + out
			const unpriced = unpricedBucket(data)
			const unpricedOnly = data.total === 0 && unpriced.tokens > 0
			const buckets = [
				{ id: "miss", name: "未命中输入", value: miss },
				{ id: "read", name: "命中缓存", value: read },
				{ id: "write", name: "写入缓存", value: write },
				{ id: "out", name: "输出", value: out },
			]
			let max = 1
			for (const bucket of buckets) if (bucket.value > max) max = bucket.value
			const turns = data.turns !== null && typeof data.turns === "object" ? data.turns : {}
			const turnKeys = Object.keys(turns)
			const lastTurn = turnKeys.length === 0 ? undefined : turns[turnKeys[turnKeys.length - 1]]
			const lastTurnText = lastTurn !== undefined && typeof lastTurn.cost === "number" ? money(lastTurn.cost, currency) : "—"
			const tone = unpricedOnly ? "dcl-hp-tone-warn" : "dcl-hp-tone-brand"
			return h("div", null,
				h("div", { className: "dcl-hp-head " + tone },
					h("span", { className: "dcl-hp-dot" }),
					h("span", { className: "dcl-hp-title" }, "本会话费用"),
					h("span", { className: "dcl-hp-badge" }, unpricedOnly ? "未定价" : "估算")),
				h("div", { className: "dcl-hp-amount" }, unpricedOnly ? "未定价" : money(data.total, currency)),
				h("div", { className: "dcl-hp-sub" },
					totalTokens === 0
						? "本会话还没有可计费的使用记录"
						: "合计 " + compactTokens(totalTokens) + " tokens · 最近一轮 " + lastTurnText),
				totalTokens === 0 ? null : h("div", { className: "dcl-hp-section" },
					h("div", { className: "dcl-hp-section-head" }, h("span", null, "tokens 分桶"), h("span", null, "缓存三档")),
					h("div", { className: "dcl-hp-buckets" },
						buckets.map((bucket) => h("div", { key: bucket.id, className: "dcl-hp-bucket", "data-bucket": bucket.id },
							h("span", { className: "dcl-hp-bucket-name" }, bucket.name),
							h("span", { className: "dcl-hp-bucket-track" },
								h("span", { className: "dcl-hp-bucket-fill", style: { width: (bucket.value <= 0 ? 0 : Math.max(3, (bucket.value / max) * 100)) + "%" } })),
							h("span", { className: "dcl-hp-bucket-value" }, compactTokens(bucket.value)))))),
				data.services !== undefined && ((data.services.search ?? 0) > 0 || (data.services.fetch ?? 0) > 0)
					? h("div", { className: "dcl-hp-section", "data-panel-section": "services" },
							h("div", { className: "dcl-hp-section-head" }, h("span", null, "服务调用"), h("span", null, "按次计费")),
							h("div", { className: "dcl-hp-row" }, h("span", { className: "dcl-hp-key" }, "搜索"), h("span", { className: "dcl-hp-value" }, (data.services.search ?? 0) + " 次 · " + money(data.serviceBreakdown?.search ?? 0, currency))),
							h("div", { className: "dcl-hp-row" }, h("span", { className: "dcl-hp-key" }, "抓取"), h("span", { className: "dcl-hp-value" }, (data.services.fetch ?? 0) + " 次 · " + money(data.serviceBreakdown?.fetch ?? 0, currency))),
							h("div", { className: "dcl-hp-sub" }, "每 1000 次成功请求 ¥5,已含在合计金额里"))
					: null,
				data.toolTokens !== undefined && (data.toolTokens.total ?? 0) > 0
					? h("div", { className: "dcl-hp-section", "data-panel-section": "tool-tokens" },
							h("div", { className: "dcl-hp-section-head" }, h("span", null, "检索内容 tokens"), h("span", null, "拆分")),
							h("div", { className: "dcl-hp-row" }, h("span", { className: "dcl-hp-key" }, "搜索结果"), h("span", { className: "dcl-hp-value" }, compactTokens(data.toolTokens.search ?? 0) + " tokens")),
							h("div", { className: "dcl-hp-row" }, h("span", { className: "dcl-hp-key" }, "抓取内容"), h("span", { className: "dcl-hp-value" }, compactTokens(data.toolTokens.fetch ?? 0) + " tokens")),
							h("div", { className: "dcl-hp-sub" },
								"约 " + money(data.toolTokenCost?.miss ?? 0, currency) + "(按未命中输入价)" +
								" · 命中缓存价约 " + money(data.toolTokenCost?.read ?? 0, currency)),
							h("div", { className: "dcl-hp-sub" }, "这部分的钱已经包含在模型费用里,这里只是拆开看,不重复计费"))
					: null,
				unpriced.keys.length > 0 ? h("div", { className: "dcl-hp-warn" }, unpricedLine(data)) : null,
				Array.isArray(data.pendingFx) && data.pendingFx.length > 0
					? h("div", { className: "dcl-hp-warn" }, "汇率采集中,金额稍后补全:" + data.pendingFx.join("、"))
					: null,
				h("div", { className: "dcl-hp-foot" },
					h("span", null, "含缓存三档价格与费用发生当日汇率"),
					h("span", null, "每 6 秒刷新")))
		}

		// ================= 闲时 / 加价时段胶囊 =================
		// 口径与费用账本一致:官方高峰时段(UTC 周一至五 01:00-04:00、06:00-10:00,
		// 即北京时间 09:00-12:00、14:00-18:00)按加价计费;周末与节假日全天闲时。
		// 时段与节假日从费用账本读取,读取失败时退回内置默认值,胶囊始终可用。
		const DEFAULT_PEAK_WINDOWS_UTC = [
			{ startMinute: 60, endMinute: 240 },
			{ startMinute: 360, endMinute: 600 },
		]
		const PERIOD_REFRESH_MS = 5 * 60 * 1000
		const SHANGHAI_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" })
		const SHANGHAI_CLOCK = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false })
		const periodState = { at: 0, pending: undefined, peakWindowsUtc: DEFAULT_PEAK_WINDOWS_UTC, holidays: [], error: undefined }

		function shanghaiDay(ms) {
			return SHANGHAI_DAY.format(new Date(ms))
		}
		function shanghaiClock(ms) {
			return SHANGHAI_CLOCK.format(new Date(ms))
		}
		function loadPeriodSettings(force) {
			const now = Date.now()
			if (periodState.pending !== undefined) return periodState.pending
			if (!force && now - periodState.at < PERIOD_REFRESH_MS) return Promise.resolve(periodState)
			periodState.pending = rpc("/cost-ledger/settings")
				.then((data) => {
					if (data !== null && typeof data === "object" && data.ok === true) {
						const windows = Array.isArray(data.peakWindowsUtc)
							? data.peakWindowsUtc.filter((w) => w !== null && typeof w === "object" && Number.isFinite(w.startMinute) && Number.isFinite(w.endMinute))
							: []
						periodState.peakWindowsUtc = windows.length > 0 ? windows : DEFAULT_PEAK_WINDOWS_UTC
						periodState.holidays = Array.isArray(data.holidays) ? data.holidays.filter((day) => typeof day === "string") : []
						periodState.error = undefined
					} else {
						periodState.error = "读取费用账本时段失败,暂按内置默认时段判断"
					}
					periodState.at = Date.now()
					return periodState
				})
				.catch(() => {
					periodState.error = "读取费用账本时段失败,暂按内置默认时段判断"
					periodState.at = Date.now()
					return periodState
				})
				.finally(() => {
					periodState.pending = undefined
				})
			return periodState.pending
		}
		function isPeakAt(ms, windows, holidays) {
			const date = new Date(ms)
			const weekday = date.getUTCDay()
			if (weekday === 0 || weekday === 6) return false
			if (holidays.includes(shanghaiDay(ms))) return false
			const minute = date.getUTCHours() * 60 + date.getUTCMinutes()
			for (const window of windows) {
				if (minute >= window.startMinute && minute < window.endMinute) return true
			}
			return false
		}
		function nextPeriodChange(ms, windows, holidays) {
			const peak = isPeakAt(ms, windows, holidays)
			const minute = 60 * 1000
			const limit = ms + 8 * 24 * 60 * minute
			let cursor = Math.floor(ms / minute) * minute + minute
			while (cursor < limit) {
				if (isPeakAt(cursor, windows, holidays) !== peak) return { at: cursor, peak: !peak }
				cursor += minute
			}
			return undefined
		}
		function untilText(ms) {
			const minutes = Math.max(1, Math.ceil(ms / 60000))
			if (minutes < 60) return minutes + " 分钟"
			const hours = Math.floor(minutes / 60)
			const rest = minutes % 60
			if (hours < 24) return rest > 0 ? hours + " 小时 " + rest + " 分钟" : hours + " 小时"
			return Math.floor(hours / 24) + " 天 " + (hours % 24) + " 小时"
		}
		function periodWindowsText(windows) {
			const pad = (n) => String(n).padStart(2, "0")
			const clock = (utcMinute) => {
				const local = (utcMinute + 480) % 1440
				return pad(Math.floor(local / 60)) + ":" + pad(local % 60)
			}
			return windows.map((w) => clock(w.startMinute) + "–" + clock(w.endMinute)).join("、")
		}
		function periodTooltip(now, windows, holidays, error) {
			const peak = isPeakAt(now, windows, holidays)
			const lines = [
				peak ? "当前:加价时段,按高峰价计费" : "当前:闲时,价格约为高峰价的一半",
				"加价时段:周一至周五 " + periodWindowsText(windows) + "(北京时间)",
				"周末与节假日全天按闲时计价",
			]
			const next = nextPeriodChange(now, windows, holidays)
			if (next !== undefined) {
				lines.push("下次切换:" + shanghaiDay(next.at).slice(5) + " " + shanghaiClock(next.at) + " → " + (next.peak ? "加价" : "闲时") + "(约 " + untilText(next.at - now) + "后)")
			}
			if (error !== undefined) lines.push(error)
			return lines.join("\n")
		}
		// ================= 胶囊悬浮面板(通用) =================
		// 悬停 120ms 展开、移入面板保持、移开 240ms 收起;点击胶囊钉住、再点收起;
		// Esc / 点面板外关闭。面板 portal 到 body 并贴胶囊上方,放不下时翻到下方,
		// 两侧都放不下就贴边限高滚动,绝不盖住胶囊。
		function HoverPanel(props) {
			const [open, setOpen] = React.useState(false)
			const anchorRef = React.useRef(null)
			const panelRef = React.useRef(null)
			const openTimer = React.useRef(undefined)
			const closeTimer = React.useRef(undefined)
			const pinnedRef = React.useRef(false)
			const panelHover = React.useRef(false)
			const focusSuppressed = React.useRef(false)

			const clearOpenTimer = () => {
				if (openTimer.current !== undefined) {
					clearTimeout(openTimer.current)
					openTimer.current = undefined
				}
			}
			const clearCloseTimer = () => {
				if (closeTimer.current !== undefined) {
					clearTimeout(closeTimer.current)
					closeTimer.current = undefined
				}
			}
			const scheduleOpen = () => {
				clearCloseTimer()
				if (open === true || openTimer.current !== undefined) return
				openTimer.current = setTimeout(() => {
					openTimer.current = undefined
					setOpen(true)
				}, 120)
			}
			const scheduleClose = () => {
				clearOpenTimer()
				clearCloseTimer()
				if (pinnedRef.current === true) return
				closeTimer.current = setTimeout(() => {
					closeTimer.current = undefined
					if (pinnedRef.current !== true) setOpen(false)
				}, 240)
			}
			const closeNow = () => {
				clearOpenTimer()
				clearCloseTimer()
				pinnedRef.current = false
				setOpen(false)
			}

			React.useEffect(() => () => {
				clearOpenTimer()
				clearCloseTimer()
			}, [])

			React.useLayoutEffect(() => {
				if (open !== true) return undefined
				const place = () => {
					const anchor = anchorRef.current
					const panel = panelRef.current
					if (anchor === null || panel === null) return
					const box = anchor.getBoundingClientRect()
					const margin = 12
					const gap = 10
					const spaceAbove = box.top - gap - margin
					const spaceBelow = window.innerHeight - box.bottom - gap - margin
					panel.style.maxHeight = "none"
					const natural = panel.offsetHeight
					const width = panel.offsetWidth
					const left = Math.max(margin, Math.min(box.right - width, window.innerWidth - margin - width))
					let top
					if (natural <= spaceAbove) {
						panel.style.maxHeight = ""
						top = box.top - gap - natural
					} else if (natural <= spaceBelow) {
						panel.style.maxHeight = ""
						top = box.bottom + gap
					} else if (spaceAbove >= spaceBelow) {
						panel.style.maxHeight = Math.max(120, Math.floor(spaceAbove)) + "px"
						top = margin
					} else {
						panel.style.maxHeight = Math.max(120, Math.floor(spaceBelow)) + "px"
						top = box.bottom + gap
					}
					panel.style.left = Math.round(left) + "px"
					panel.style.top = Math.round(Math.max(margin, top)) + "px"
				}
				place()
				window.addEventListener("resize", place)
				window.addEventListener("scroll", place, true)
				return () => {
					window.removeEventListener("resize", place)
					window.removeEventListener("scroll", place, true)
				}
			}, [open])

			React.useEffect(() => {
				if (open !== true) return undefined
				const onPointerDown = (event) => {
					const anchor = anchorRef.current
					const panel = panelRef.current
					if (anchor !== null && anchor.contains(event.target)) return
					if (panel !== null && panel.contains(event.target)) return
					closeNow()
				}
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return
					event.preventDefault()
					event.stopPropagation()
					closeNow()
					if (anchorRef.current !== null) {
						focusSuppressed.current = true
						anchorRef.current.focus()
						setTimeout(() => {
							focusSuppressed.current = false
						}, 0)
					}
				}
				document.addEventListener("pointerdown", onPointerDown, true)
				document.addEventListener("keydown", onKeyDown, true)
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true)
					document.removeEventListener("keydown", onKeyDown, true)
				}
			}, [open])

			const panel = open === true && createPortal !== null
				? createPortal(
						h("div", {
							ref: panelRef,
							className: "dcl-hp-panel",
							role: "dialog",
							"aria-label": props.ariaLabel,
							"data-panel": props.panelKind,
							onMouseEnter: () => {
								panelHover.current = true
								clearCloseTimer()
							},
							onMouseLeave: () => {
								panelHover.current = false
								scheduleClose()
							},
						}, props.renderPanel()),
						document.body,
					)
				: null

			const attrs = {
				ref: anchorRef,
				type: "button",
				className: props.triggerClass,
				"aria-haspopup": "dialog",
				"aria-expanded": open === true ? "true" : "false",
				"aria-label": props.ariaLabel,
				onClick: () => {
					clearOpenTimer()
					clearCloseTimer()
					if (pinnedRef.current === true) {
						closeNow()
						return
					}
					pinnedRef.current = true
					setOpen(true)
				},
				onMouseEnter: scheduleOpen,
				onMouseLeave: scheduleClose,
				onFocus: (event) => {
					if (focusSuppressed.current === true) return
					// 鼠标按下也会 focus:只有键盘聚焦才自动展开,否则面板会在 mouseup 前弹出来挡住点击。
					const keyboard = typeof event.target.matches === "function" && event.target.matches(":focus-visible")
					if (keyboard !== true) return
					clearCloseTimer()
					setOpen(true)
				},
				onBlur: (event) => {
					const next = event.relatedTarget
					if (panelRef.current !== null && next !== null && next !== undefined && panelRef.current.contains(next)) return
					if (panelHover.current === true) return
					if (pinnedRef.current !== true) scheduleClose()
				},
			}
			if (props.triggerAttrs !== undefined && props.triggerAttrs !== null) Object.assign(attrs, props.triggerAttrs)
			return h(React.Fragment, null, h("button", attrs, props.triggerContent), panel)
		}

		function panelRow(key, value) {
			return h("div", { className: "dcl-hp-row" },
				h("span", { className: "dcl-hp-key" }, key),
				h("span", { className: "dcl-hp-value" }, value))
		}

		// "今天 / 明天 / MM-DD",用于说明下次时段切换发生在哪天。
		function periodDayText(targetMs, nowMs) {
			const day = shanghaiDay(targetMs)
			if (day === shanghaiDay(nowMs)) return "今天"
			if (day === shanghaiDay(nowMs + 24 * 60 * 60 * 1000)) return "明天"
			return day.slice(5)
		}

		// 面板:24 小时时段轴(北京时间)+ 当前时段 + 下次切换 + 规则
		function PeriodPanel(props) {
			const now = props.now
			const windows = props.windows
			const holidays = props.holidays
			const error = props.error
			const peak = isPeakAt(now, windows, holidays)
			const next = nextPeriodChange(now, windows, holidays)
			const restDay = (() => {
				const weekday = new Date(now).getUTCDay()
				if (weekday === 0 || weekday === 6) return true
				return holidays.includes(shanghaiDay(now))
			})()
			const tone = peak ? "dcl-hp-tone-warn" : "dcl-hp-tone-ok"
			const pad = (n) => String(n).padStart(2, "0")
			const localMinute = (utcMinute) => (utcMinute + 480) % 1440
			const clock = (utcMinute) => pad(Math.floor(localMinute(utcMinute) / 60)) + ":" + pad(localMinute(utcMinute) % 60)
			const nowMinute = Math.floor(((now + 8 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000)) / 60000)
			const bands = windows.map((window) => {
				const start = localMinute(window.startMinute)
				const end = localMinute(window.endMinute)
				return { left: (start / 1440) * 100, width: (Math.max(0, end - start) / 1440) * 100 }
			})
			return h("div", null,
				h("div", { className: "dcl-hp-head " + tone },
					h("span", { className: "dcl-hp-dot" }),
					h("span", { className: "dcl-hp-title" }, "计价时段"),
					h("span", { className: "dcl-hp-badge" }, peak ? "加价中" : "闲时")),
				h("div", { className: "dcl-hp-sub" },
					peak ? "当前按高峰价计费,约为此前闲时价的 2 倍" : "当前按低谷价计费,约为高峰价的一半"),
				h("div", { className: "dcl-hp-timeline" },
					h("div", { className: "dcl-hp-track", role: "img", "aria-label": "北京时间 24 小时时段轴,琥珀色为加价时段" },
						bands.map((band, index) => h("span", {
							key: "band-" + index,
							className: "dcl-hp-band",
							style: { left: band.left + "%", width: band.width + "%" },
						})),
						h("span", {
							className: "dcl-hp-now",
							style: { left: (nowMinute / 1440) * 100 + "%" },
							title: "现在 " + shanghaiClock(now) + "(北京时间)",
						})),
					h("div", { className: "dcl-hp-ticks" },
						["0:00", "6:00", "12:00", "18:00", "24:00"].map((label) => h("span", { key: label }, label)))),
				h("div", { className: "dcl-hp-section" },
					restDay ? panelRow("今天", "周末/节假日,全天按闲时计价") : null,
					panelRow("加价时段", "周一至周五 " + periodWindowsText(windows)),
					next === undefined ? null : panelRow("下次切换", periodDayText(next.at, now) + " " + shanghaiClock(next.at) + " → " + (next.peak ? "加价" : "闲时") + "(约 " + untilText(next.at - now) + "后)"),
					panelRow("周末与节假日", "全天按闲时计价" + (holidays.length > 0 ? " · 已记录 " + holidays.length + " 个节假日" : ""))),
				error === undefined ? null : h("div", { className: "dcl-hp-warn" }, error),
				h("div", { className: "dcl-hp-foot" },
					h("span", null, "北京时间 · 口径与按笔计价一致"),
					h("span", null, "每 15 秒重算")))
		}

		function PeriodPill() {
			const [now, setNow] = React.useState(() => Date.now())
			const [period, setPeriod] = React.useState({ peakWindowsUtc: DEFAULT_PEAK_WINDOWS_UTC, holidays: [], error: undefined })
			React.useEffect(() => {
				let alive = true
				const load = () => {
					loadPeriodSettings().then((state) => {
						if (!alive) return
						setPeriod({ peakWindowsUtc: state.peakWindowsUtc, holidays: state.holidays, error: state.error })
					})
				}
				load()
				const tick = setInterval(() => setNow(Date.now()), 15000)
				const reload = setInterval(load, PERIOD_REFRESH_MS)
				return () => {
					alive = false
					clearInterval(tick)
					clearInterval(reload)
				}
			}, [])
			const peak = isPeakAt(now, period.peakWindowsUtc, period.holidays)
			return h(HoverPanel, {
				triggerClass: "dcl-timechip " + (peak ? "dcl-timechip-peak" : "dcl-timechip-off"),
				triggerAttrs: { "data-period-state": peak ? "peak" : "offpeak", "data-period-now": String(now) },
				panelKind: "period",
				ariaLabel: "计费时段:" + (peak ? "加价中" : "闲时") + ",点开查看时段详情",
				triggerContent: [
					h("span", { key: "dot", className: "dcl-timechip-dot" }),
					h("span", { key: "label" }, peak ? "加价中" : "闲时"),
				],
				renderPanel: () => h(PeriodPanel, { now, windows: period.peakWindowsUtc, holidays: period.holidays, error: period.error }),
			})
		}

		// ================= 每日柱状图 =================
		function DailyBars(props) {
			const series = Array.isArray(props.series) ? props.series : []
			const currency = props.currency
			let max = 0
			for (const entry of series) if (typeof entry.total === "number" && entry.total > max) max = entry.total
			const scale = max > 0 ? max : 1
			const today = series.length > 0 ? series[series.length - 1].day : undefined
			const labelEvery = Math.max(1, Math.ceil(series.length / 7))
			return React.createElement("div", { className: "dcl-chart" },
				React.createElement("div", { className: "dcl-chart-y" },
					React.createElement("span", null, money(max, currency)),
					React.createElement("span", null, money(max / 2, currency)),
					React.createElement("span", null, money(0, currency))),
				React.createElement("div", { className: "dcl-chart-main" },
					React.createElement("div", { className: "dcl-bars", "data-days": series.length },
						series.map((entry) => {
							const value = typeof entry.total === "number" ? entry.total : 0
							const height = value > 0 ? Math.max(2, (value / scale) * 100) : 0
							const isToday = entry.day === today
							return React.createElement(P.Tooltip, {
								key: entry.day,
								side: "top",
								label: `${entry.day}  ${money(value, currency)}\n未命中 ${compactTokens(entry.tokens?.miss)} · 命中 ${compactTokens(entry.tokens?.read)} · 输出 ${compactTokens(entry.tokens?.out)}`,
							}, React.createElement("div", {
								className: "dcl-bar-slot",
							}, React.createElement("div", {
								className: "dcl-bar" + (value <= 0 ? " dcl-bar-empty" : "") + (isToday ? " dcl-bar-today" : ""),
								style: { height: (value > 0 ? height : 2) + "%" },
								"data-day": entry.day,
								"data-value": String(value),
							})))
						})),
					React.createElement("div", { className: "dcl-x" },
						series.map((entry, index) => React.createElement("div", { key: entry.day, className: "dcl-x-cell" },
							index % labelEvery === 0 || index === series.length - 1 ? fmtDay(entry.day) : "")))),
			)
		}

		// ================= 价格台账 =================
		function tierName(tier) {
			return tier === "peak" ? "高峰" : "低谷"
		}
		function PriceLedger(props) {
			const models = Array.isArray(props.models) ? props.models : []
			if (models.length === 0) return React.createElement("div", { className: "dcl-muted" }, "还没有价格表。点“获取最新价格”从官方价目页导入。")
			const sourceLabel = (source) => source === "import" ? "初始导入" : source === "fetch" ? "自动获取" : "手动录入"
			const moneyCell = (value, currency) => React.createElement("td", { className: "num" }, priceText(value, currency))
			return React.createElement("div", { className: "dcl-models" },
				models.map((model) => {
					const rows = []
					for (const tier of model.tiers || []) {
						for (const segment of tier.segments || []) {
							rows.push(React.createElement("tr", { key: model.name + ":" + tier.tier + ":" + segment.id },
								React.createElement("td", null, tierName(tier.tier)),
								React.createElement("td", { className: "dcl-period" },
									segment.from === 0 ? "起始" : fmtDateTime(segment.from),
									" ~ ",
									segment.to === null || segment.to === undefined ? "至今" : fmtDateTime(segment.to)),
								moneyCell(segment.cacheRead, model.currency),
								moneyCell(segment.cacheMiss, model.currency),
								moneyCell(segment.cacheWrite ?? segment.cacheMiss, model.currency),
								moneyCell(segment.output, model.currency)))
							if (segment.note !== undefined && segment.note !== "") {
								const note = String(segment.note).replace(/^(初始导入|自动获取|手动录入|手动)[:：]\s*/, "")
								rows.push(React.createElement("tr", { key: model.name + ":" + tier.tier + ":" + segment.id + ":note", className: "dcl-note-row" },
									React.createElement("td", { colSpan: 6 }, sourceLabel(segment.source) + (note === "" ? "" : " · " + note))))
							}
						}
					}
					return React.createElement("div", { className: "dcl-model", key: model.name },
						React.createElement("div", { className: "dcl-model-head" },
							React.createElement("b", null, model.label || model.name),
							React.createElement("span", { className: "dcl-tag" }, model.currency),
							model.version === undefined ? null : React.createElement("span", { className: "dcl-tag" }, model.version),
							model.name === (model.label || model.name) ? null : React.createElement("span", { className: "dcl-muted dcl-model-id" }, model.name)),
						React.createElement("table", { className: "dcl-table dcl-price-table" },
							React.createElement("colgroup", null,
								React.createElement("col", { style: { width: 40 } }),
								React.createElement("col", null),
								React.createElement("col", { style: { width: 64 } }),
								React.createElement("col", { style: { width: 64 } }),
								React.createElement("col", { style: { width: 64 } }),
								React.createElement("col", { style: { width: 64 } })),
							React.createElement("thead", null, React.createElement("tr", null,
								React.createElement("th", null, "档位"),
								React.createElement("th", null, "生效时段"),
								React.createElement("th", { className: "num" }, "命中"),
								React.createElement("th", { className: "num" }, "未命中"),
								React.createElement("th", { className: "num" }, "写入"),
								React.createElement("th", { className: "num" }, "输出"))),
							React.createElement("tbody", null, rows)),
						React.createElement("div", { className: "dcl-muted" }, "单位:" + model.currency + " / 百万 tokens"))
				}))
		}

		// ================= 汇率台账 =================
		function FxTable(props) {
			const fx = Array.isArray(props.fx) ? props.fx : []
			if (fx.length === 0) return React.createElement("div", { className: "dcl-muted" }, "还没有采集汇率。只有在“有费用的日子”才会采集,已有的不重复采集。")
			const rows = []
			for (const pair of fx) {
				for (const day of pair.days || []) {
					rows.push(React.createElement("tr", { key: pair.pair + day.day },
						React.createElement("td", null, pair.pair),
						React.createElement("td", null, day.day),
						React.createElement("td", { className: "num" }, typeof day.rate === "number" ? day.rate.toFixed(4) : "—"),
						React.createElement("td", null, day.asOf || "—"),
						React.createElement("td", null, day.source || "—"),
						React.createElement("td", { className: "dcl-muted" }, fmtDateTime(day.fetchedAt))))
				}
			}
			return React.createElement("div", { style: { overflowX: "auto", maxHeight: 260, overflowY: "auto" } },
				React.createElement("table", { className: "dcl-table" },
					React.createElement("thead", null, React.createElement("tr", null,
						React.createElement("th", null, "货币对"),
						React.createElement("th", null, "费用日"),
						React.createElement("th", null, "汇率"),
						React.createElement("th", null, "实际生效日"),
						React.createElement("th", null, "来源"),
						React.createElement("th", null, "采集时间"))),
					React.createElement("tbody", null, rows)))
		}

		// ================= 原生样式的下拉选择(Menu) =================
		function NativeSelect(props) {
			const [open, setOpen] = React.useState(false)
			const items = Array.isArray(props.items) ? props.items : []
			const selected = items.find((item) => item.id === props.value)
			if (P.Menu === null) {
				// 原生 Menu 不可用时退化为普通下拉,保证设置仍可操作
				return React.createElement("select", {
					className: "dcl-native-select",
					value: props.value,
					"aria-label": props.label,
					disabled: props.disabled === true,
					onChange: (event) => { if (typeof props.onSelect === "function") props.onSelect(event.target.value) },
				}, items.map((item) => React.createElement("option", { key: item.id, value: item.id }, item.label)))
			}
			return React.createElement(P.Menu, {
				open,
				items,
				selectedId: props.value,
				onSelect: (id) => {
					setOpen(false)
					if (id !== props.value && typeof props.onSelect === "function") props.onSelect(id)
				},
				onClose: () => setOpen(false),
				align: props.align || "end",
				portal: true,
				anchor: React.createElement("button", {
					type: "button",
					className: "dcl-native-select",
					"aria-haspopup": "menu",
					"aria-expanded": open,
					"aria-label": props.label,
					disabled: props.disabled === true,
					onClick: () => setOpen((value) => !value),
				},
					React.createElement("span", null, selected === undefined ? "" : selected.label),
					React.createElement(P.Chevron, { size: 14 })),
			})
		}

		// ================= 设置面板 =================
		function CostSettingsPanel() {
			const overviewState = React.useState(null)
			const overview = overviewState[0], setOverview = overviewState[1]
			const settingsState = React.useState(null)
			const settings = settingsState[0], setSettings = settingsState[1]
			const errorState = React.useState("")
			const error = errorState[0], setError = errorState[1]
			const busyState = React.useState("")
			const busy = busyState[0], setBusy = busyState[1]
			const noticeState = React.useState("")
			const notice = noticeState[0], setNotice = noticeState[1]
			const daysState = React.useState(30)
			const days = daysState[0], setDays = daysState[1]
			const healthState = React.useState(null)
			const health = healthState[0], setHealth = healthState[1]

			const load = React.useCallback(async (options) => {
				setError("")
				const [ov, st, hl] = await Promise.all([
					rpc("/cost-ledger/overview", { days, refresh: options && options.refresh ? 1 : undefined }),
					rpc("/cost-ledger/settings", {}),
					rpc("/cost-ledger/health", {}),
				])
				if (ov.ok === true) setOverview(ov)
				else setError(ov.error || "读取汇总失败")
				if (st.ok === true) setSettings(st)
				else setError(st.error || "读取价格表失败")
				if (hl.ok === true || hl.missingServices !== undefined) setHealth(hl)
			}, [days])

			React.useEffect(() => {
				load({})
			}, [load])

			// 汇率按需采集是异步的:还有缺口时自动轮询,金额会逐步补全。
			React.useEffect(() => {
				if (overview === null || !Array.isArray(overview.pendingFx) || overview.pendingFx.length === 0) return undefined
				const timer = setTimeout(() => load({}), 4000)
				return () => clearTimeout(timer)
			}, [overview, load])

			const fetchPrices = async () => {
				setBusy("prices")
				setNotice("")
				setError("")
				try {
					const result = await rpc("/cost-ledger/prices/fetch", {})
					if (result.ok !== true) {
						setError(result.error || "获取价格失败")
					} else if (result.initialImport === true) {
						setNotice("已导入初始价格(按当前官方文档价回溯)。")
					} else if (result.changes.length === 0) {
						setNotice("价格没有变化。")
					} else {
						setNotice("已记录 " + result.changes.length + " 条价格变更,新价格从 " + fmtDateTime(result.fetchedAt) + " 起生效。")
					}
					await load({})
				} catch (e) {
					setError(String(e && e.message ? e.message : e))
				} finally {
					setBusy("")
				}
			}

			const recompute = async () => {
				setBusy("recompute")
				setNotice("")
				try {
					await rpc("/cost-ledger/overview", { days, refresh: 1 })
					await load({})
					setNotice("已按当前价格表重算。")
				} finally {
					setBusy("")
				}
			}

			const changeCurrency = async (nextCurrency) => {
				const currency = nextCurrency
				setBusy("currency")
				try {
					const result = await rpc("/cost-ledger/currency", { currency })
					if (result.ok !== true) setError(result.error || "切换货币失败")
					await load({})
				} finally {
					setBusy("")
				}
			}

			if (overview === null || settings === null) {
				return React.createElement("div", { className: "dcl-panel" },
					error === "" ? React.createElement("div", { className: "dcl-muted" }, "正在建账与计价…(首次会扫描全部会话,请稍候)") : React.createElement("div", { className: "dcl-error" }, error))
			}

			const currency = overview.displayCurrency
			const meta = overview.meta || {}
			const lastFetch = meta.lastPriceFetchAt === null || meta.lastPriceFetchAt === undefined ? null : meta.lastPriceFetchAt
			const lastFetchError = meta.lastPriceFetchError
			const unpriced = overview.unpriced || {}
			const unpricedKeys = Object.keys(unpriced)
			const byRoute = overview.byRoute || {}
			const routeKeys = Object.keys(byRoute)

			const compatIssues = []
			if (health !== null && health !== undefined) {
				if (Array.isArray(health.missingServices) && health.missingServices.length > 0) compatIssues.push("宿主缺少服务:" + health.missingServices.join("、") + "(升级可能改了接口)")
				if (health.fold !== undefined && (health.fold.errors ?? 0) > 0) compatIssues.push("折叠失败 " + health.fold.errors + " 个会话")
				const cov = health.coverage
				if (cov !== undefined && cov.assistantMessages > 0 && cov.ratio < 0.995) {
					compatIssues.push("usage 覆盖 " + (cov.ratio * 100).toFixed(2) + "%(有 " + (cov.assistantMessages - cov.usageMessages) + " 条 assistant/message 缺 usage 字段,上游字段可能变更)")
				}
				if (health.fold !== undefined && health.fold.lastFoldAt === null) compatIssues.push("尚未完成建账")
			}
			const compatLine = React.createElement("div", { className: compatIssues.length > 0 ? "dcl-warn" : "dcl-muted" },
				"兼容性自检:" + (compatIssues.length === 0
					? "宿主接口齐全 · " + (health && health.coverage ? "usage 覆盖 " + (health.coverage.ratio * 100).toFixed(2) + "%" : "—") + " · " + (health && health.fold ? health.fold.sessions + " 个会话已折叠" : "—")
					: compatIssues.join(";")))

			const kpi = (label, value) => React.createElement("div", { className: "dcl-kpi" },
				React.createElement("span", { className: "dcl-muted" }, label),
				React.createElement("b", null, value))

			return React.createElement("div", { className: "dcl-panel" },
				React.createElement("div", { className: "dcl-card" },
					React.createElement("div", { className: "dcl-row" },
						React.createElement("div", { className: "dcl-kpis" },
							kpi("总消耗", React.createElement("span", { className: "dcl-big" }, money(overview.total, currency))),
							kpi("今日", money(overview.today, currency)),
							kpi("昨日", money(overview.yesterday, currency)),
							kpi("会话数", String(overview.sessionCount)),
							kpi("统计天数", String(days))),
						React.createElement("div", { className: "dcl-row", style: { gap: 8 } },
							React.createElement(NativeSelect, {
								value: currency,
								label: "显示货币",
								disabled: busy !== "",
								items: (settings.currencies || ["CNY", "USD"]).map((code) => ({ id: code, label: code === "CNY" ? "人民币 ¥" : code === "USD" ? "美元 $" : code })),
								onSelect: changeCurrency,
							}),
							React.createElement(NativeSelect, {
								value: String(days),
								label: "统计天数",
								items: [7, 30, 90, 180].map((n) => ({ id: String(n), label: "近 " + n + " 天" })),
								onSelect: (value) => setDays(Number(value)),
							}))),
					React.createElement("div", { className: "dcl-muted" },
						"合计 tokens:未命中 " + compactTokens(overview.tokens.miss) + " · 命中 " + compactTokens(overview.tokens.read) + " · 写入 " + compactTokens(overview.tokens.write) + " · 输出 " + compactTokens(overview.tokens.out),
						" · 价格源:DeepSeek 官方价目页 · 金额为估算,以官方账单为准"),
					overview.services !== undefined && ((overview.services.search ?? 0) > 0 || (overview.services.fetch ?? 0) > 0)
						? React.createElement("div", { className: "dcl-muted" },
								"服务调用:搜索 " + (overview.services.search ?? 0) + " 次 · 抓取 " + (overview.services.fetch ?? 0) + " 次 · " + money(overview.services.cost ?? 0, currency) + " · 已包含在总消耗里。口径:DeepSeek Search/Fetch API 每 1000 次成功请求 ¥5;搜索按查询条数计请求,抓取按 HTTP 200 计请求。")
						: null,
					overview.toolTokens !== undefined && (overview.toolTokens.total ?? 0) > 0
						? React.createElement("div", { className: "dcl-muted" },
								"检索内容 tokens:搜索 " + compactTokens(overview.toolTokens.search ?? 0) + " · 抓取 " + compactTokens(overview.toolTokens.fetch ?? 0) + " · 按未命中输入价约 " + money(overview.toolTokenCost?.miss ?? 0, currency) + "(命中缓存价约 " + money(overview.toolTokenCost?.read ?? 0, currency) + ")。这部分 token 已包含在模型 usage 里,不重复计费。")
						: null,
					health === null ? null : compatLine,
					error !== "" ? React.createElement("div", { className: "dcl-error" }, error) : null,
					notice !== "" ? React.createElement("div", { className: "dcl-muted" }, notice) : null,
					Array.isArray(overview.pendingFx) && overview.pendingFx.length > 0 ? React.createElement("div", { className: "dcl-muted" },
						"汇率采集中,以下日期的金额稍后补全:" + overview.pendingFx.join("、")) : null,
					unpricedKeys.length > 0 ? React.createElement("div", { className: "dcl-muted" },
						"未配置价格的路由(已计入 token,未计入金额):" + unpricedKeys.map((key) => " " + key + "(" + compactTokens((unpriced[key].miss || 0) + (unpriced[key].read || 0) + (unpriced[key].out || 0)) + ")").join("、"),
						" 可在本插件 state.json 的 routes/priceModels 里接入其它家价格。") : null),

				React.createElement("div", { className: "dcl-card" },
					React.createElement("div", { className: "dcl-row" },
						React.createElement("b", null, "每日消耗"),
						React.createElement("div", { className: "dcl-row", style: { gap: 8 } },
							React.createElement(P.Button, { variant: "outline", size: "sm", onClick: () => load({ refresh: true }), disabled: busy !== "" }, "刷新"),
							React.createElement(P.Button, { variant: "outline", size: "sm", onClick: recompute, disabled: busy !== "" }, busy === "recompute" ? "重算中…" : "按当前价格重算"))),
					React.createElement(DailyBars, { series: overview.series, currency }),
					React.createElement("div", { className: "dcl-muted" }, "每根柱子是本地日(Asia/Shanghai)的费用合计,线性刻度;灰色为无消耗日。")),

				React.createElement("div", { className: "dcl-card" },
					React.createElement("div", { className: "dcl-row" },
						React.createElement("b", null, "价格账本"),
						React.createElement("div", { className: "dcl-row", style: { gap: 8 } },
							React.createElement(P.Button, { variant: "primary", size: "sm", onClick: fetchPrices, disabled: busy !== "" }, busy === "prices" ? "获取中…" : "获取最新价格"),
							React.createElement("span", { className: "dcl-muted" }, lastFetch === null ? "尚未获取过价格" : "上次获取:" + fmtDateTime(lastFetch)))),
					lastFetchError ? React.createElement("div", { className: "dcl-error" }, "上次获取失败:" + lastFetchError) : null,
					React.createElement(PriceLedger, { models: settings.models || [] }),
					React.createElement("div", { className: "dcl-muted" }, "价格变更按“生效时段”标注:变更后从抓取时刻起生效,原价保留为上一时段;金额按每笔对话发生时的时段价格计算。")),

				React.createElement("div", { className: "dcl-card" },
					React.createElement("div", { className: "dcl-row" },
						React.createElement("b", null, "汇率记录(按费用产生日)"),
						React.createElement("span", { className: "dcl-muted" }, "仅采集有费用的日子;已有记录不重复采集")),
					React.createElement(FxTable, { fx: settings.fx || [] })),

				React.createElement("div", { className: "dcl-card" },
					React.createElement("div", { className: "dcl-row" }, React.createElement("b", null, "按路由")),
					routeKeys.length === 0 ? React.createElement("div", { className: "dcl-muted" }, "暂无数据") : React.createElement("div", { style: { overflowX: "auto" } },
						React.createElement("table", { className: "dcl-table" },
							React.createElement("thead", null, React.createElement("tr", null,
								React.createElement("th", null, "路由"),
								React.createElement("th", null, "计价方式"),
								React.createElement("th", null, "未命中"),
								React.createElement("th", null, "命中"),
								React.createElement("th", null, "输出"),
								React.createElement("th", null, "金额"))),
							React.createElement("tbody", null, routeKeys.map((key) => {
								const entry = byRoute[key]
								return React.createElement("tr", { key },
									React.createElement("td", null, key),
									React.createElement("td", null, entry.mode === "free" ? "免费" : entry.mode === "priced" ? "价格模型 " + (entry.priceModel || "") : "未定价"),
									React.createElement("td", { className: "num" }, compactTokens(entry.tokens.miss)),
									React.createElement("td", { className: "num" }, compactTokens(entry.tokens.read)),
									React.createElement("td", { className: "num" }, compactTokens(entry.tokens.out)),
									React.createElement("td", { className: "num" }, entry.mode === "priced" ? money(entry.total, currency) : entry.mode === "free" ? money(0, currency) : "—"))
							}))))),
				React.createElement("div", { className: "dcl-muted" },
					"数据位置:~/.dsh/storages/cost-ledger/state.json(每次写入前保留上一版 .bak 与 backups/ 快照)")
			)
		}

		// ================= 插件入口 =================
		function apply(ctx) {
			const slots = ctx.get("slots")
			if (slots === undefined) return
			slots.inject("conversation.chat.turnTail", () => {
				slotStatus.turnTail = true
				return slots.register({
					name: "conversation.chat.turnTail",
					id: "cost-turn",
					order: 30,
				}, CostTurnPill)
			})
			slots.inject("conversation.session.header.utilities", () => {
				slotStatus.headerUtilities = true
				return slots.register({
					name: "conversation.session.header.utilities",
					id: "cost-session-total",
					order: 30,
				}, CostHeaderBadge)
			})
			slots.inject("conversation.input.right", () => {
				slotStatus.inputRight = true
				const disposePeriod = slots.register({
					name: "conversation.input.right",
					id: "cost-period",
					order: 5,
				}, PeriodPill)
				const disposeCost = slots.register({
					name: "conversation.input.right",
					id: "cost-session-toolbar",
					order: 10,
				}, CostToolbarChip)
				return [disposePeriod, disposeCost]
			})
			slots.inject("settings.section", () => {
				slotStatus.settingsSection = true
				return slots.register({
					name: "settings.section",
					id: "cost-ledger",
					order: 45,
					label: "费用账本",
				}, CostSettingsPanel)
			})
		}
		exports.apply = apply
		exports.inject = ["slots"]
		return module.exports
	}
})
