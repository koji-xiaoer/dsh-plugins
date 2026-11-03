window.__ModuleLoader__.load({
	id: "dsh-deepseek-status",
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		const React = require("react")
		const h = React.createElement

		// 面板通过 portal 挂到 document.body:输入框工具条所在的 .row 声明了
		// container-type: inline-size,现代 Chromium 会把它当成 fixed 子元素的包含块,
		// 挂在里面的浮层会被整体偏移到屏幕外。
		let createPortal = null
		try {
			const reactDom = require("react-dom")
			createPortal = reactDom === null || reactDom === undefined ? null : reactDom.createPortal
		} catch {
			createPortal = null
		}

		// ================= 常量 =================
		const SLOT = "conversation.input.right"
		const ID = "deepseek-status"
		// 与费用账本插件的两枚胶囊并排:闲时(5)/本会话费用(10)。ascending 即左→右,
		// 把服务状态放在整组最左边,计费相关的两枚保持相邻。
		const ORDER = 2
		const ENDPOINT = "/deepseek-status/summary"
		const SOURCE_URL = "https://status.deepseek.com/"
		const POLL_MS = 60 * 1000
		const OPEN_DELAY_MS = 120
		const CLOSE_DELAY_MS = 240
		const LOCALE_NS = "dshDeepseekStatus"
		const STYLE_TAG = "dsh-deepseek-status/ui.css"
		const PANEL_ID = "dsh-deepseek-status-panel"

		// ================= 文案 =================
		const zh = {
			"chip.operational": "DeepSeek 正常",
			"chip.degraded": "DeepSeek 降级",
			"chip.partial_outage": "DeepSeek 部分中断",
			"chip.full_outage": "DeepSeek 中断",
			"chip.maintenance": "DeepSeek 维护中",
			"chip.unknown": "DeepSeek 状态未知",
			"status.operational": "运行正常",
			"status.degraded": "性能下降",
			"status.partial_outage": "部分中断",
			"status.full_outage": "服务中断",
			"status.maintenance": "维护中",
			"status.unknown": "状态未知",
			"panel.title": "DeepSeek 服务状态",
			"panel.checked": "最近检查 {time} · 每分钟刷新",
			"panel.refresh": "立即刷新",
			"panel.components": "组件",
			"panel.window": "近 {days} 天",
			"panel.historyAria": "近 {days} 天逐日状态",
			"panel.uptime": "可用率 {pct}",
			"panel.events": "当前事件",
			"panel.recent": "最近事件",
			"panel.noEvents": "近 {days} 天没有影响服务的事件",
			"panel.loading": "正在读取状态页…",
			"panel.empty": "状态页暂无组件数据",
			"panel.stale": "刷新失败,展示上一次成功的数据",
			"panel.error": "错误:{error}",
			"panel.source": "数据源 status.deepseek.com",
			"panel.open": "打开状态页",
			"day.title": "{day} · {status}",
			"time.justNow": "刚刚",
			"time.minutes": "{n} 分钟前",
			"time.hours": "{n} 小时前",
			"time.days": "{n} 天前",
			"event.resolved": "已解决",
			"event.ongoing": "进行中",
			"event.update": "最新进展:{text}",
		}
		const en = {
			"chip.operational": "DeepSeek OK",
			"chip.degraded": "DeepSeek Degraded",
			"chip.partial_outage": "DeepSeek Partial Outage",
			"chip.full_outage": "DeepSeek Outage",
			"chip.maintenance": "DeepSeek Maintenance",
			"chip.unknown": "DeepSeek Status Unknown",
			"status.operational": "Operational",
			"status.degraded": "Degraded",
			"status.partial_outage": "Partial Outage",
			"status.full_outage": "Outage",
			"status.maintenance": "Under Maintenance",
			"status.unknown": "Unknown",
			"panel.title": "DeepSeek service status",
			"panel.checked": "Last checked {time} · refreshes every minute",
			"panel.refresh": "Refresh now",
			"panel.components": "Components",
			"panel.window": "last {days} days",
			"panel.historyAria": "Daily status for the last {days} days",
			"panel.uptime": "Uptime {pct}",
			"panel.events": "Active events",
			"panel.recent": "Recent events",
			"panel.noEvents": "No service-affecting event in the last {days} days",
			"panel.loading": "Reading the status page…",
			"panel.empty": "The status page reports no components",
			"panel.stale": "Refresh failed; showing the last successful data",
			"panel.error": "Error: {error}",
			"panel.source": "Source status.deepseek.com",
			"panel.open": "Open status page",
			"day.title": "{day} · {status}",
			"time.justNow": "just now",
			"time.minutes": "{n} min ago",
			"time.hours": "{n} h ago",
			"time.days": "{n} d ago",
			"event.resolved": "Resolved",
			"event.ongoing": "Ongoing",
			"event.update": "Latest update: {text}",
		}

		// locale 服务不可用时的兜底翻译(与界面默认中文一致)。
		function makeTranslate(dict) {
			return (key, params) => {
				const template = dict[key] === undefined ? key : dict[key]
				if (params === undefined || params === null || typeof params !== "object") return template
				return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
			}
		}
		const fallbackTranslate = makeTranslate(zh)

		// ================= 状态映射 =================
		const KNOWN_OVERALL = ["operational", "degraded", "partial_outage", "full_outage", "maintenance"]
		// 胶囊与面板共用一套状态色调:ok=绿 / warn=琥珀 / bad=红 / maint=蓝 / unknown=灰。
		const TONE_CLASS = {
			operational: "dss-ok",
			degraded: "dss-warn",
			partial_outage: "dss-warn",
			full_outage: "dss-bad",
			maintenance: "dss-maint",
			unknown: "dss-unknown",
		}
		const TONE_NAME = {
			operational: "ok",
			degraded: "warn",
			partial_outage: "warn",
			full_outage: "bad",
			maintenance: "maint",
			unknown: "unknown",
		}

		function normalizedKey(key) {
			return KNOWN_OVERALL.indexOf(key) === -1 ? "unknown" : key
		}

		function overallKey(data) {
			if (data === undefined || data === null || data.ok !== true) return "unknown"
			return normalizedKey(data.overall)
		}

		function statusLabel(t, key) {
			return t("status." + normalizedKey(key))
		}

		function toneName(key) {
			return TONE_NAME[normalizedKey(key)]
		}

		function shortName(name) {
			if (typeof name !== "string") return ""
			return name
				.replace(/^DeepSeek\s+/u, "")
				.replace(/\s*[（(][^）)]*[）)]\s*$/u, "")
				.trim()
		}

		function formatClock(ms) {
			if (typeof ms !== "number" || !Number.isFinite(ms)) return "—"
			try {
				return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms))
			} catch {
				return new Date(ms).toLocaleString()
			}
		}

		function formatDay(day) {
			// "2026-11-03" -> "11-03"
			return typeof day === "string" && day.length >= 10 ? day.slice(5) : String(day === undefined ? "" : day)
		}

		function relativeTime(ms, t) {
			if (typeof ms !== "number" || !Number.isFinite(ms)) return "—"
			const minutes = Math.floor((Date.now() - ms) / 60000)
			if (minutes < 1) return t("time.justNow")
			if (minutes < 60) return t("time.minutes", { n: minutes })
			const hours = Math.floor(minutes / 60)
			if (hours < 24) return t("time.hours", { n: hours })
			const days = Math.floor(hours / 24)
			if (days < 30) return t("time.days", { n: days })
			return formatClock(ms)
		}

		function percentText(value) {
			return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) + "%" : "—"
		}

		// ================= 样式 =================
		// 胶囊度量与费用账本的 .dcl-timechip 完全一致(高 22、圆角 999、12px/20px、
		// 6px 圆点、绿/琥珀底色 12% 与悬停 20%),保证三枚胶囊并排风格统一;
		// 面板按 ~/.dsh/UI-GUIDE.md 的卡片语言:12px 圆角、1px 描边、内衬底 + 细阴影,
		// 全部使用设计令牌(浅色/深色自适应)。
		const CSS = [
			// —— 胶囊 ——
			".dss-chip{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:5px;height:22px;box-sizing:border-box;margin:0;padding:0 9px;border:0;border-radius:999px;font-family:inherit;font-weight:inherit;font-size:12px;line-height:20px;white-space:nowrap;cursor:pointer;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);transition:background .16s ease,color .16s ease}",
			".dss-chip:hover{color:var(--dsw-alias-label-primary)}",
			".dss-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".dss-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary);transition:background .16s ease}",
			".dss-ok{background:rgba(34,197,94,.12)}",
			".dss-ok:hover{background:rgba(34,197,94,.2)}",
			".dss-ok .dss-dot{background:var(--dsw-alias-state-success-primary,#22c55e)}",
			".dss-warn{background:rgba(245,158,11,.12)}",
			".dss-warn:hover{background:rgba(245,158,11,.2)}",
			".dss-warn .dss-dot{background:var(--dsw-alias-state-warn-primary,#f59e0b)}",
			".dss-bad{background:rgba(239,68,68,.12)}",
			".dss-bad:hover{background:rgba(239,68,68,.2)}",
			".dss-bad .dss-dot{background:var(--dsw-alias-state-error-primary,#ef4444)}",
			".dss-maint{background:rgba(77,107,254,.12)}",
			".dss-maint:hover{background:rgba(77,107,254,.2)}",
			".dss-maint .dss-dot{background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dss-unknown{background:var(--dsw-alias-bg-module-platform)}",
			".dss-unknown .dss-dot{background:var(--dsw-alias-label-tertiary)}",
			".dss-bad .dss-dot{animation:dss-pulse 2.4s ease-out infinite}",
			"@keyframes dss-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.35)}70%{box-shadow:0 0 0 6px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}",
			"@media (prefers-reduced-motion: reduce){.dss-bad .dss-dot{animation:none}}",

			// —— 悬浮面板 ——
			".dss-panel{position:fixed;z-index:1100;box-sizing:border-box;width:352px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg,16px);background:var(--dsw-menu-surface-fill,var(--dsw-alias-bg-layer-1));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(24px) saturate(1.4));color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.6;box-shadow:0 8px 24px rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.06);animation:dss-panel-in .16s ease-out}",
			"@keyframes dss-panel-in{0%{opacity:0;transform:translateY(3px)}100%{opacity:1;transform:translateY(0)}}",
			"@media (prefers-reduced-motion: reduce){.dss-panel{animation:none}}",
			".dss-panel-head{display:flex;align-items:center;gap:8px}",
			".dss-panel-title{font-size:13px;font-weight:600;letter-spacing:.1px}",
			".dss-panel-dot{width:8px;height:8px;border-radius:50%;flex:none;background:currentColor}",
			".dss-panel-dot.dss-live{animation:dss-pulse 2.4s ease-out infinite}",
			".dss-badge{display:inline-flex;align-items:center;gap:5px;height:20px;box-sizing:border-box;padding:0 8px;margin-left:auto;border-radius:999px;font-size:11px;line-height:18px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:color-mix(in srgb,currentColor 8%,transparent)}",
			".dss-refresh{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
			".dss-refresh:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
			".dss-refresh:disabled{cursor:default;opacity:.6}",
			".dss-refresh[data-spinning]{animation:dss-spin .9s linear infinite}",
			"@keyframes dss-spin{100%{transform:rotate(360deg)}}",
			"@media (prefers-reduced-motion: reduce){.dss-refresh[data-spinning]{animation:none}}",
			".dss-panel-sub{display:flex;align-items:center;gap:6px;margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dss-banner{margin-top:8px;padding:6px 8px;border-radius:8px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:color-mix(in srgb,currentColor 8%,transparent);font-size:11px;line-height:1.5}",
			".dss-section{margin-top:8px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1)}",
			".dss-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dss-section-head b{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".dss-muted{color:var(--dsw-alias-label-tertiary)}",
			".dss-comp{display:flex;align-items:center;gap:8px;height:20px}",
			".dss-comp-dot{width:6px;height:6px;border-radius:50%;flex:none;background:currentColor}",
			".dss-comp-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}",
			".dss-history{display:flex;gap:1px;flex:none}",
			".dss-day{width:2px;height:10px;border-radius:1px;background:var(--dsw-alias-border-l1)}",
			".dss-day-ok{background:var(--dsw-alias-state-success-primary,#22c55e);opacity:.55}",
			".dss-day-warn{background:var(--dsw-alias-state-warn-primary,#f59e0b)}",
			".dss-day-bad{background:var(--dsw-alias-state-error-primary,#ef4444)}",
			".dss-day-maint{background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dss-day-unknown{background:var(--dsw-alias-border-l1)}",
			".dss-comp-pct{width:46px;flex:none;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}",
			".dss-ev{display:flex;gap:8px;padding:4px 0}",
			".dss-ev-dot{width:6px;height:6px;margin-top:6px;border-radius:50%;flex:none;background:currentColor}",
			".dss-ev-main{flex:1;min-width:0}",
			".dss-ev-title{color:var(--dsw-alias-label-secondary);line-height:18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
			".dss-ev-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dss-tag{display:inline-flex;align-items:center;height:16px;padding:0 6px;border-radius:999px;font-size:10px;line-height:14px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:color-mix(in srgb,currentColor 8%,transparent)}",
			".dss-ev-desc{margin-top:2px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
			".dss-empty{padding:2px 0;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dss-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dss-link{display:inline-flex;align-items:center;gap:3px;color:var(--dsw-alias-brand-primary);text-decoration:none;white-space:nowrap}",
			".dss-link:hover{text-decoration:underline}",
			// 状态色调:面板里所有 currentColor 元素(圆点/徽标/网格条)靠它取色。
			".dss-tone-ok{color:var(--dsw-alias-state-success-primary,#22c55e)}",
			".dss-tone-warn{color:var(--dsw-alias-state-warn-primary,#f59e0b)}",
			".dss-tone-bad{color:var(--dsw-alias-state-error-primary,#ef4444)}",
			".dss-tone-maint{color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dss-tone-unknown{color:var(--dsw-alias-label-tertiary)}",
		].join("")

		function ensureStyles() {
			if (typeof document === "undefined") return undefined
			const existing = document.querySelector('style[data-plugin-css="' + STYLE_TAG + '"]')
			if (existing !== null) return () => existing.remove()
			const tag = document.createElement("style")
			tag.dataset.plugin = "dsh-deepseek-status"
			tag.dataset.pluginCss = STYLE_TAG
			tag.textContent = CSS
			document.head.appendChild(tag)
			return () => tag.remove()
		}

		// ================= 面板小部件 =================
		function RefreshIcon() {
			return h(
				"svg",
				{ viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
				h("path", { d: "M13.2 8a5.2 5.2 0 1 1-1.5-3.7" }),
				h("path", { d: "M13.2 2.6v3.2H10" }),
			)
		}

		function ArrowIcon() {
			return h(
				"svg",
				{ viewBox: "0 0 12 12", width: 10, height: 10, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
				h("path", { d: "M3.2 8.8 8.8 3.2" }),
				h("path", { d: "M4.4 3.2h4.4v4.4" }),
			)
		}

		function ComponentRow({ t, item }) {
			const tone = toneName(item.status)
			const history = Array.isArray(item.history) ? item.history : []
			const name = shortName(item.name)
			const uptime = percentText(item.uptime)
			return h(
				"div",
				{ className: "dss-comp dss-tone-" + tone, "data-dss-component": item.id, "data-dss-state": item.status },
				h("span", { className: "dss-comp-dot", "aria-hidden": "true" }),
				h("span", { className: "dss-comp-name", title: item.name }, name === "" ? item.name : name),
				history.length === 0
					? null
					: h(
							"span",
							{ className: "dss-history", role: "img", "aria-label": t("panel.historyAria", { days: String(history.length) }) },
							history.map((entry) =>
								h("span", {
									key: entry.day,
									className: "dss-day dss-day-" + (TONE_NAME[entry.status] === undefined ? "unknown" : TONE_NAME[entry.status]),
									title: t("day.title", { day: formatDay(entry.day), status: statusLabel(t, entry.status) }),
								}),
							),
						),
				h("span", { className: "dss-comp-pct", title: t("panel.uptime", { pct: uptime }) }, uptime),
			)
		}

		function EventRow({ t, title, timeText, description, resolved }) {
			return h(
				"div",
				{ className: "dss-ev dss-tone-" + (resolved === true ? "ok" : "warn") },
				h("span", { className: "dss-ev-dot", "aria-hidden": "true" }),
				h(
					"div",
					{ className: "dss-ev-main" },
					h("div", { className: "dss-ev-title", title }, title),
					h("div", { className: "dss-ev-meta" }, h("span", { className: "dss-tag" }, resolved === true ? t("event.resolved") : t("event.ongoing")), h("span", null, timeText)),
					description === undefined || description === "" ? null : h("div", { className: "dss-ev-desc" }, t("event.update", { text: description })),
				),
			)
		}

		function StatusPanel({ t, state, overall, refreshing, pinned, onRefresh, panelRef, onMouseEnter, onMouseLeave }) {
			const data = state.data
			const hasData = data !== undefined && data !== null && data.ok === true
			const days = String(hasData && data.uptimeWindowDays !== undefined ? data.uptimeWindowDays : 30)
			const components = hasData && Array.isArray(data.components) ? data.components : []
			const active = hasData && Array.isArray(data.activeChanges) ? data.activeChanges : []
			const recent = hasData && Array.isArray(data.recentIncidents) ? data.recentIncidents : []
			const tone = toneName(overall)

			const head = h(
				"div",
				{ className: "dss-panel-head" },
				h("span", { className: "dss-panel-dot dss-tone-" + tone + (overall === "operational" || overall === "unknown" ? "" : " dss-live"), "aria-hidden": "true" }),
				h("span", { className: "dss-panel-title" }, t("panel.title")),
				h("span", { className: "dss-badge dss-tone-" + tone }, statusLabel(t, overall)),
				h(
					"button",
					{ type: "button", className: "dss-refresh", "aria-label": t("panel.refresh"), title: t("panel.refresh"), onClick: onRefresh, disabled: refreshing === true },
					h("span", { style: { display: "inline-flex" }, "data-spinning": refreshing === true ? "true" : undefined }, h(RefreshIcon, null)),
				),
			)

			const sub = h(
				"div",
				{ className: "dss-panel-sub" },
				h("span", null, t("panel.checked", { time: formatClock(hasData ? data.checkedAt : undefined) })),
				refreshing === true ? h("span", null, "·") : null,
				refreshing === true ? h("span", null, t("panel.refreshing") || "…") : null,
			)

			const stale = hasData && data.stale === true
			const showBanner = state.error !== undefined || stale
			const banner = showBanner
				? h(
						"div",
						{ className: "dss-banner dss-tone-" + (stale ? "warn" : "bad") },
						stale ? t("panel.stale") : null,
						state.error === undefined ? null : h("span", null, (stale ? " · " : "") + t("panel.error", { error: state.error })),
					)
				: null

			const componentsSection = h(
				"div",
				{ className: "dss-section", "data-dss-section": "components" },
				h("div", { className: "dss-section-head" }, h("b", null, t("panel.components")), h("span", null, t("panel.window", { days }))),
				components.length === 0
					? h("div", { className: "dss-empty" }, hasData ? t("panel.empty") : t("panel.loading"))
					: components.map((item) => h(ComponentRow, { key: item.id, t, item })),
			)

			const eventsSection = h(
				"div",
				{ className: "dss-section", "data-dss-section": "events" },
				h("div", { className: "dss-section-head" }, h("b", null, active.length > 0 ? t("panel.events") : t("panel.recent")), active.length > 0 ? h("span", null, String(active.length)) : null),
				active.map((item) =>
					h(EventRow, {
						key: "active:" + item.id,
						t,
						title: item.title,
						resolved: false,
						timeText: relativeTime(item.startedAt, t),
						description: item.latestUpdate === undefined ? undefined : item.latestUpdate.description,
					}),
				),
				active.length === 0
					? recent.map((item) => h(EventRow, { key: "recent:" + item.id, t, title: item.title, resolved: true, timeText: relativeTime(item.closedAt, t) }))
					: null,
				hasData && active.length === 0 && recent.length === 0 ? h("div", { className: "dss-empty" }, t("panel.noEvents", { days })) : null,
			)

			const foot = h(
				"div",
				{ className: "dss-foot" },
				h("span", null, t("panel.source")),
				h("a", { className: "dss-link", href: SOURCE_URL, target: "_blank", rel: "noopener noreferrer" }, t("panel.open"), h(ArrowIcon, null)),
			)

			return h(
				"div",
				{
					ref: panelRef,
					id: PANEL_ID,
					className: "dss-panel",
					role: "dialog",
					"aria-label": t("panel.title"),
					"data-dss-panel": overall,
					"data-dss-checked": hasData && data.checkedAt !== undefined ? String(data.checkedAt) : "",
					"data-dss-pinned": pinned === true ? "true" : undefined,
					onMouseEnter,
					onMouseLeave,
				},
				head,
				sub,
				banner,
				componentsSection,
				hasData ? eventsSection : null,
				foot,
			)
		}

		// ================= 胶囊 =================
		function StatusCapsule(props) {
			const t = typeof props.t === "function" ? props.t : fallbackTranslate
			const [state, setState] = React.useState({ loading: true, data: undefined, error: undefined })
			const [open, setOpen] = React.useState(false)
			const [pinned, setPinned] = React.useState(false)
			const [refreshing, setRefreshing] = React.useState(false)
			const anchorRef = React.useRef(null)
			const panelRef = React.useRef(null)
			const loadRef = React.useRef(null)
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
				}, OPEN_DELAY_MS)
			}
			const scheduleClose = () => {
				clearOpenTimer()
				clearCloseTimer()
				if (pinnedRef.current === true) return
				closeTimer.current = setTimeout(() => {
					closeTimer.current = undefined
					if (pinnedRef.current !== true) setOpen(false)
				}, CLOSE_DELAY_MS)
			}
			const closeNow = () => {
				clearOpenTimer()
				clearCloseTimer()
				pinnedRef.current = false
				setPinned(false)
				setOpen(false)
			}

			// 数据:挂载即拉一次,之后每分钟一次;切回标签页时补一次。
			React.useEffect(() => {
				let alive = true
				const load = (force) => {
					const url = force === true ? ENDPOINT + "?refresh=1" : ENDPOINT
					return fetch(url, { headers: { accept: "application/json" } })
						.then((response) => response.json())
						.then((payload) => {
							if (!alive) return
							if (payload !== null && typeof payload === "object" && payload.ok === true) {
								setState({ loading: false, data: payload, error: undefined })
								return
							}
							const message = payload !== null && typeof payload === "object" ? payload.error || payload.staleError : undefined
							setState((previous) => ({ loading: false, data: previous.data, error: message === undefined ? "bad response" : String(message) }))
						})
						.catch((error) => {
							if (!alive) return
							const message = error !== null && error !== undefined && error.message !== undefined ? String(error.message) : String(error)
							setState((previous) => ({ loading: false, data: previous.data, error: message }))
						})
				}
				loadRef.current = load
				load(false)
				const timer = setInterval(() => load(false), POLL_MS)
				const onVisibility = () => {
					if (typeof document !== "undefined" && document.visibilityState === "visible") load(false)
				}
				if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility)
				return () => {
					alive = false
					clearInterval(timer)
					if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility)
					clearOpenTimer()
					clearCloseTimer()
				}
			}, [])

			// 面板定位:贴胶囊上沿、右对齐;上方放不下时翻到下方,并始终夹在视口内。
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
					// 先量自然高度(不受上一次的限制影响)
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
						// 上下都放不下:贴在上方可用空间里滚动,绝不覆盖胶囊。
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
			}, [open, state.data, state.error, refreshing, t])

			// 打开时:Esc 关闭、点面板外部关闭。
			React.useEffect(() => {
				if (open !== true) return undefined
				const onPointerDown = (event) => {
					const anchor = anchorRef.current
					const panel = panelRef.current
					const target = event.target
					if (anchor !== null && anchor.contains(target)) return
					if (panel !== null && panel.contains(target)) return
					closeNow()
				}
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return
					event.preventDefault()
					event.stopPropagation()
					closeNow()
					if (anchorRef.current !== null) {
						// 焦点回到胶囊,但别让 onFocus 立刻又把面板打开。
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

			// 首次请求还没回来时先不占位,避免工具条跳动(与费用胶囊的行为一致)。
			if (state.loading === true && state.data === undefined) return null

			const key = overallKey(state.data)
			const label = t("chip." + key)
			const accentLabel = label + " · " + statusLabel(t, key)
			const panel =
				open === true && createPortal !== null && typeof document !== "undefined"
					? createPortal(
							h(StatusPanel, {
								t,
								state,
								overall: key,
								refreshing,
								pinned,
								panelRef,
								onRefresh: () => {
									if (loadRef.current === null) return
									setRefreshing(true)
									Promise.resolve(loadRef.current(true)).finally(() => setRefreshing(false))
								},
								onMouseEnter: () => {
									panelHover.current = true
									clearCloseTimer()
								},
								onMouseLeave: () => {
									panelHover.current = false
									scheduleClose()
								},
							}),
							document.body,
						)
					: null

			return h(
				React.Fragment,
				null,
				h(
					"button",
					{
						ref: anchorRef,
						type: "button",
						className: "dss-chip " + TONE_CLASS[key],
						"aria-haspopup": "dialog",
						"aria-expanded": open === true ? "true" : "false",
						"aria-controls": open === true ? PANEL_ID : undefined,
						"aria-label": accentLabel,
						"data-dss-status": key,
						onClick: () => {
							clearOpenTimer()
							clearCloseTimer()
							// 悬停已经打开了面板时,点击=钉住;再点一次收起。
							if (pinnedRef.current === true) {
								closeNow()
								return
							}
							pinnedRef.current = true
							setPinned(true)
							setOpen(true)
						},
						onMouseEnter: scheduleOpen,
						onMouseLeave: scheduleClose,
						onFocus: (event) => {
							if (focusSuppressed.current === true) return
							// 鼠标按下也会触发 focus,只有键盘聚焦才自动展开,否则面板会在
							// mouseup 之前弹出来挡住这次点击。
							const keyboard = typeof event.target.matches === "function" && event.target.matches(":focus-visible")
							if (keyboard !== true) return
							clearCloseTimer()
							setOpen(true)
						},
						onBlur: (event) => {
							const next = event.relatedTarget
							if (panelRef.current !== null && next !== null && next !== undefined && panelRef.current.contains(next)) return
							// 鼠标还在面板里(点击了面板空白处)时不要因为失焦而收起。
							if (panelHover.current === true) return
							if (pinnedRef.current !== true) scheduleClose()
						},
					},
					h("span", { className: "dss-dot", "aria-hidden": "true" }),
					h("span", null, label),
				),
				panel,
			)
		}

		// ================= 插件入口 =================
		function apply(ctx) {
			ctx.effect(() => ensureStyles(), "deepseek-status styles")

			const locale = typeof ctx.get === "function" ? ctx.get("locale") : undefined
			if (locale !== undefined && typeof locale.register === "function") {
				ctx.effect(() => {
					try {
						return locale.register(LOCALE_NS, { zh, en })
					} catch {
						// 热更新时旧 fiber 还没释放字典:沿用已注册的那份,不打断插件加载。
						return undefined
					}
				}, "deepseek-status dictionaries")
			}

			const options = { name: SLOT, id: ID, order: ORDER }
			if (locale !== undefined) options.locale = LOCALE_NS
			ctx.slots.inject(SLOT, () => ctx.slots.register(options, StatusCapsule))
		}

		exports.apply = apply
		exports.inject = ["slots"]
		return module.exports
	},
})
