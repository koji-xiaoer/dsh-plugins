window.__ModuleLoader__.load({
	id: "dsh-mods-enhanced",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require("react");

		// ================= CSS 注入(产品模式,data-plugin-css 判重) =================
		const CSS_TAG = "dsh-mods-enhanced/ui.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-mods-enhanced";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = ".baln-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;line-height:20px;color:#8899aa;background:rgba(127,127,127,.12);cursor:default;white-space:nowrap;font-variant-numeric:tabular-nums}.baln-pill:hover{color:#b8c4d0}.tokm-row{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 4px;align-items:center}.tokm-cell{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}.sntf-toast{position:fixed;right:20px;bottom:76px;z-index:9999;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:rgba(24,26,31,.92);color:#e8ecf2;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.35);animation:sntf-in .18s ease-out}.sntf-toast-icon{color:#3ecf8e;font-weight:700}@keyframes sntf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.sntf-card{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding:16px 0;display:flex}.sntf-row{align-items:center;gap:12px;display:flex}.sntf-head{flex:1;flex-direction:column;gap:2px;min-width:0;display:flex}.sntf-title{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.sntf-desc{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.sntf-switch{color:var(--dsw-alias-label-secondary);align-items:center;gap:8px;flex:none;font-size:13px;line-height:20px;display:inline-flex;cursor:pointer;user-select:none}.sntf-switch input{position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}.sntf-switch span{position:relative;background:var(--dsw-alias-border-l3);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;width:34px;height:20px;flex:none;transition:background .18s ease,border-color .18s ease}.sntf-switch span::after{content:\"\";position:absolute;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);border-radius:50%;top:2px;left:2px;width:14px;height:14px;transition:transform .18s cubic-bezier(.4,0,.2,1)}.sntf-switch input:checked+span{background:var(--dsw-alias-state-business-primary);border-color:transparent}.sntf-switch input:checked+span::after{transform:translateX(14px)}.sntf-switch input:focus-visible+span{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.sntf-sub{background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;flex-direction:column;gap:10px;padding:10px;display:flex}.sntf-segs{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;gap:2px;padding:2px;display:flex;min-width:0}.sntf-seg{background:none;border:none;border-radius:6px;color:var(--dsw-alias-label-tertiary);cursor:pointer;flex:1;justify-content:center;gap:6px;font:inherit;font-size:12px;line-height:24px;padding:0 10px;display:flex;transition:color .15s ease,background .15s ease}.sntf-seg:hover{color:var(--dsw-alias-label-secondary)}.sntf-seg-active{background:var(--dsw-alias-bg-module-platform);box-shadow:0 1px 2px rgba(0,0,0,.12);color:var(--dsw-alias-label-primary);font-weight:600}.sntf-preview{background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;font-size:12px;line-height:20px;padding:2px 12px;transition:color .15s ease,background .15s ease}.sntf-preview:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.sntf-slider-row{align-items:center;gap:10px;display:flex}.sntf-slider-row span:first-child{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap;width:32px}.sntf-slider-row input[type=range]{flex:1;accent-color:var(--dsw-alias-state-business-primary);min-width:0}.sntf-pct{color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;min-width:36px;text-align:right}.sntf-custom{flex-direction:column;gap:6px;display:flex}.sntf-pick{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,transparent);border-radius:10px;box-sizing:border-box;color:var(--dsw-alias-state-business-primary);cursor:pointer;justify-content:center;gap:8px;font-size:13px;line-height:20px;font-weight:500;min-height:44px;padding:10px 16px;display:flex;transition:border-color .15s ease,background .15s ease,color .15s ease}.sntf-pick:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent);border-color:var(--dsw-alias-state-business-primary)}.sntf-remove{background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:11px;line-height:18px;padding:2px 10px;align-self:flex-start;transition:color .15s ease,background .15s ease}.sntf-remove:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.sntf-fnote{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.sntf-divider{background:var(--dsw-alias-border-l2);height:1px;margin:2px 0}.cost-dock{display:flex;flex-direction:column;gap:6px;padding:8px 12px;border-radius:10px;font-size:12px;color:var(--dsw-alias-label-tertiary)}.cost-dock-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cost-dock-total{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}.cost-dock-model{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.cost-dock-toggle{cursor:pointer;opacity:.7}.cost-dock-toggle:hover{opacity:1}.cost-bars{display:flex;align-items:flex-end;gap:4px;height:120px;padding:4px 2px 0;overflow-x:auto}.cost-bar{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:26px;height:100%}.cost-bar-fill{width:18px;border-radius:4px 4px 0 0;background:var(--dsw-alias-state-business-primary);min-height:3px}.cost-bar-val{font-size:9px;color:var(--dsw-alias-label-tertiary);line-height:1.4}.cost-bar-idx{font-size:9px;color:var(--dsw-alias-label-dimmed)}.cost-pager{display:flex;align-items:center;gap:8px;font-size:11px}.cost-pager button{background:none;border:1px solid var(--dsw-alias-border-l2);color:inherit;border-radius:6px;padding:1px 8px;cursor:pointer;font-size:11px}.cost-pager button:disabled{opacity:.35;cursor:default}.cost-table{width:100%;border-collapse:collapse;font-size:12px}.cost-table th,.cost-table td{padding:4px 8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}.cost-table th{color:var(--dsw-alias-label-tertiary);font-weight:500}.cost-table tr.clickable{cursor:pointer}.cost-table tr.clickable:hover{background:var(--dsw-alias-interactive-bg-hover)}.cost-num{text-align:right;font-variant-numeric:tabular-nums}.cost-empty{color:var(--dsw-alias-label-tertiary);padding:12px;text-align:center}.cost-settings{display:flex;flex-direction:column;gap:10px}.cost-settings-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.cost-settings-label{font-size:12px;color:var(--dsw-alias-label-tertiary)}.cost-price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.cost-price-cell{display:flex;flex-direction:column;gap:2px}.cost-price-cell span{font-size:10px;color:var(--dsw-alias-label-tertiary)}.cost-price-cell input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:12px;padding:3px 6px}.cost-curr{position:relative}.cost-curr-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);cursor:pointer;font-size:13px;line-height:20px;padding:4px 12px;display:inline-flex;align-items:center;gap:6px}.cost-curr-btn:hover{border-color:var(--dsw-alias-state-business-primary)}.cost-curr-menu{position:absolute;z-index:100;top:calc(100% + 4px);right:0;min-width:190px;max-height:240px;overflow-y:auto;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-inverted);box-shadow:var(--dsw-shadow-lv3);border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px}.cost-curr-item{background:none;border:none;border-radius:8px;box-sizing:border-box;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;line-height:20px;padding:5px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;white-space:nowrap}.cost-curr-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.cost-curr-active{color:var(--dsw-alias-label-primary);font-weight:600}.cost-curr-tick{color:var(--dsw-alias-state-business-primary);flex:none}.cost-curr-rate{display:flex;flex-direction:column;gap:2px}.cost-curr-rate-value{color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}.cost-curr-rate-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}.cost-curr-manual{align-items:center;gap:8px;display:flex;flex-wrap:wrap}.cost-curr-manual label{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}.cost-curr-manual input{width:120px;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);font-size:12px;padding:3px 8px}";
			document.head.appendChild(tag);
		}

		// ================= 通用工具 =================
		let _ctx = null;
		const R = react;
		const BILLING_CURRENCIES = [["CNY", "¥"], ["USD", "$"], ["EUR", "€"], ["GBP", "£"], ["JPY", "¥"], ["HKD", "HK$"], ["SGD", "S$"], ["AUD", "A$"], ["CAD", "C$"], ["CHF", "Fr."], ["KRW", "₩"], ["TWD", "NT$"], ["INR", "₹"], ["RUB", "₽"], ["BRL", "R$"]];
		const CURRENCY_SYMBOLS = Object.fromEntries(BILLING_CURRENCIES);
		const RATE_CACHE_KEY = "dsh.billing.currency.rates.v1";
		const PREF_KEY = "dsh.billing.currency.v2";
		function readPrefs() { try { const raw = localStorage.getItem(PREF_KEY); if (raw !== null) { const p = JSON.parse(raw); return { code: typeof p.code === "string" && CURRENCY_SYMBOLS[p.code] !== undefined ? p.code : "CNY", manualRate: typeof p.manualRate === "number" && p.manualRate > 0 ? p.manualRate : null } } } catch {} return { code: "CNY", manualRate: null } }
		function writePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch {} }
		function readRateCache() { try { const raw = localStorage.getItem(RATE_CACHE_KEY); if (raw !== null) { const c = JSON.parse(raw); if (c !== null && typeof c === "object" && c.rates !== null && typeof c.rates === "object") return c } } catch {} return null }
		function writeRateCache(rates, nextUpdate) { try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, nextUpdate, fetchedAt: Date.now() })) } catch {} }
		let currency = { code: "CNY", rate: 1, source: "cny", symbol: "¥" };
		const currencyListeners = new Set();
		function syncCurrency() {
			const prefs = readPrefs(); const cache = readRateCache();
			let rate = 1, source = "cny";
			if (prefs.code !== "CNY") {
				if (prefs.manualRate !== null) { rate = 1 / prefs.manualRate; source = "manual" }
				else if (cache !== null && cache.rates[prefs.code] != null) { rate = cache.rates[prefs.code]; source = (cache.nextUpdate || 0) > Date.now() / 1000 ? "auto" : "stale" }
				else source = "failed";
			}
			const next = { code: prefs.code, rate, source, symbol: CURRENCY_SYMBOLS[prefs.code] || "¥" };
			if (next.code !== currency.code || next.rate !== currency.rate || next.source !== currency.source || next.symbol !== currency.symbol) { currency = next; for (const l of currencyListeners) l() }
			return currency;
		}
		let ratesInflight = null;
		function ensureRates(sessionId) {
			const prefs = readPrefs(); const cache = readRateCache();
			if (prefs.code === "CNY" && prefs.manualRate === null) return null;
			if (prefs.manualRate !== null) return null;
			if (cache !== null && (cache.nextUpdate || 0) > Date.now() / 1000) return null;
			if (ratesInflight !== null) return ratesInflight;
			ratesInflight = (async () => {
				try {
					const r = await _ctx.remote.enhanced.currencyRates(sessionId);
					if (r !== null && typeof r === "object" && r.ok === true && r.rates !== null && typeof r.rates === "object") writeRateCache(r.rates, typeof r.nextUpdate === "number" ? r.nextUpdate : 0);
				} catch {}
				ratesInflight = null; syncCurrency();
			})();
			return ratesInflight;
		}
		function useCurrency() {
			const [, force] = R.useState(0);
			R.useEffect(() => { const l = () => force((x) => x + 1); currencyListeners.add(l); return () => currencyListeners.delete(l); }, []);
			return currency;
		}
		function fmtCost(v, cur) {
			const n = Number(v) || 0; const display = n * (cur.rate || 1);
			const sym = cur.source === "failed" || cur.code === "CNY" ? "¥" : (cur.symbol || "¥");
			const s = display >= 1 ? display.toFixed(2) : display >= 0.01 ? display.toFixed(3).replace(/(\.\d*?[1-9])0+$/, "$1") : display > 0 ? display.toFixed(4).replace(/(\.\d*?[1-9])0+$/, "$1") : "0";
			return sym + s;
		}
		function fmtTok(n) { const v = Number(n) || 0; if (v >= 1e6) return (v / 1e6).toFixed(2) + "M"; if (v >= 1e3) return (v / 1e3).toFixed(1) + "k"; return String(v) }
		function fmtTime(t) { try { const d = new Date(t); if (Number.isNaN(d.getTime())) return ""; return (d.getMonth() + 1) + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") } catch { return "" } }

		// ================= 会话完成提醒偏好与音频(原 sntf-5) =================
		function readPref(k, def) { try { const v = (typeof localStorage !== "undefined") ? localStorage.getItem(k) : null; return v === null ? def : v !== "0" } catch { return def } }
		function writePref(k, on) { try { localStorage.setItem(k, on ? "1" : "0") } catch {} }
		function readSource() { try { const s = localStorage.getItem("dsh.notify.sound.source"); return (s === "bell" || s === "custom") ? s : "chime" } catch { return "chime" } }
		function writeSource(s) { try { localStorage.setItem("dsh.notify.sound.source", s) } catch {} }
		function readVolume() { try { const n = Number(localStorage.getItem("dsh.notify.sound.volume")); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8 } catch { return 0.8 } }
		function writeVolume(v) { try { localStorage.setItem("dsh.notify.sound.volume", String(v)) } catch {} }
		function readGain() { try { const n = Number(localStorage.getItem("dsh.notify.sound.gain")); return Number.isFinite(n) ? Math.min(3, Math.max(1, n)) : 1 } catch { return 1 } }
		function writeGain(g) { try { localStorage.setItem("dsh.notify.sound.gain", String(g)) } catch {} }
		function readData() { try { return localStorage.getItem("dsh.notify.sound.data") } catch { return null } }
		function writeData(d) { try { if (d === null || d === "") localStorage.removeItem("dsh.notify.sound.data"); else localStorage.setItem("dsh.notify.sound.data", d) } catch {} }
		function readName() { try { return localStorage.getItem("dsh.notify.sound.name") || "" } catch { return "" } }
		function writeName(n) { try { if (n === "") localStorage.removeItem("dsh.notify.sound.name"); else localStorage.setItem("dsh.notify.sound.name", n) } catch {} }
		let audioCtx = null;
		function ensureAudio() { try { if (typeof window === "undefined" || typeof AudioContext === "undefined") return null; if (audioCtx === null) audioCtx = new AudioContext(); if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {}); return audioCtx } catch { return null } }
		function playTone(notes, type, peak, level) { const ac = ensureAudio(); if (ac === null || ac.state !== "running") return; const now = ac.currentTime; for (const n of notes) { const freq = n[0], at = n[1], dur = n[2]; const osc = ac.createOscillator(); const gain = ac.createGain(); osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(0.0001, now + at); gain.gain.exponentialRampToValueAtTime(peak * level, now + at + 0.025); gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur); osc.connect(gain).connect(ac.destination); osc.start(now + at); osc.stop(now + at + dur + 0.05) } }
		function playChime(level) { playTone([[659.25, 0, 0.45], [880, 0.28, 0.8]], "sine", 0.12, level) }
		function playBell(level) { playTone([[880, 0, 0.35], [1318.51, 0.18, 0.55]], "triangle", 0.1, level) }
		function playCustom(data, level) { try { const audio = new Audio(data); if (level <= 1) { audio.volume = level; audio.play().catch(() => playChime(level)); return true } const ac = ensureAudio(); if (ac === null || ac.state !== "running") { audio.volume = 1; audio.play().catch(() => playChime(level)); return true } try { const src = ac.createMediaElementSource(audio); const g = ac.createGain(); g.gain.value = level; src.connect(g).connect(ac.destination); audio.volume = 1; audio.play().catch(() => playChime(level)) } catch { audio.volume = 1; audio.play().catch(() => playChime(level)) } return true } catch { return false } }
		function playSound() { const level = readVolume() * readGain(); const source = readSource(); if (source === "bell") { playBell(level); return } if (source === "custom") { const data = readData(); if (data !== null && data !== "" && playCustom(data, level)) return } playChime(level) }
		function playPreview(source, data, volume, gain) { const level = volume * gain; if (source === "custom" && data !== null && data !== "" && playCustom(data, level)) return; if (source === "bell") playBell(level); else playChime(level) }
		let baseTitle = null;
		function getBaseTitle() { try { if (typeof document === "undefined") return "DeepSeek Harness"; if (baseTitle === null || baseTitle === "") baseTitle = document.title || "DeepSeek Harness"; return baseTitle } catch { return "DeepSeek Harness" } }
		function isZh() { try { return typeof navigator !== "undefined" && typeof navigator.language === "string" && navigator.language.toLowerCase().startsWith("zh") } catch { return true } }
		function runningLabel(n) { return isZh() ? (n + " 个会话运行中") : (n + " session(s) running") }
		function doneLabel(n) { return isZh() ? (n > 1 ? (n + " 个会话已完成") : "会话已完成") : (n > 1 ? (n + " sessions done") : "Session done") }

		// ================= 组件 =================
		function BalancePill(props) {
			const [state, setState] = R.useState(null);
			const sessionId = props.sessionId;
			R.useEffect(() => {
				let alive = true;
				const tick = async () => { try { const result = await _ctx.remote.enhanced.balance(sessionId); if (alive) setState(result) } catch { if (alive) setState(null) } };
				tick();
				const h = setInterval(tick, 5000);
				return () => { alive = false; clearInterval(h) };
			}, [sessionId]);
			if (state === null || typeof state !== "object" || state.ok !== true || state.value === null || typeof state.value !== "object") return null;
			const v = state.value;
			const total = Number(v.totalBalance) || 0, granted = Number(v.grantedBalance) || 0, topped = Number(v.toppedUpBalance) || 0;
			const symbol = v.currency === "CNY" ? "¥" : (v.currency || "") + " ";
			return R.createElement("span", { className: "baln-pill", title: "总余额 " + total.toFixed(2) + " · 赠送 " + granted.toFixed(2) + " · 充值 " + topped.toFixed(2) + " · 每 5 秒刷新" }, symbol + total.toFixed(2));
		}

		let flashUntil = 0, flashCount = 0;
		function NotifyEngine(props) {
			const sessionId = props.sessionId;
			const [toast, setToast] = R.useState(null);
			const [flash, setFlash] = R.useState(null);
			R.useEffect(() => {
				let alive = true, lastRunning = false, lastSeq = 0, blink = false;
				const tick = async () => {
					let s = null;
					try { s = await _ctx.remote.enhanced.notifyState(sessionId, { sessionId }) } catch {}
					if (!alive || s === null || typeof s !== "object") return;
					const titleOn = readPref("dsh.notify.title", true);
					const now = Date.now();
					if (s.running === true) {
						if (titleOn) { blink = !blink; try { document.title = (blink ? "● " : "○ ") + runningLabel(s.runningCount) + " · " + getBaseTitle() } catch {} }
					} else if (lastRunning === true && s.completedSeq > lastSeq) {
						if (readPref("dsh.notify.sound", true)) playSound();
						const count = (now < flashUntil) ? flashCount + 1 : 1;
						flashUntil = now + 8000; flashCount = count;
						if (titleOn) { try { document.title = "✓ " + doneLabel(count) + " · " + getBaseTitle() } catch {} }
						setFlash({ until: flashUntil, count });
						setToast({ key: now, text: doneLabel(count) });
					} else if (s.runningCount === 0 && now >= flashUntil) {
						try { if (document.title !== getBaseTitle()) document.title = getBaseTitle() } catch {}
					}
					lastRunning = s.running === true; lastSeq = s.completedSeq;
				};
				tick();
				const h = setInterval(tick, 800);
				return () => { alive = false; clearInterval(h) };
			}, [sessionId]);
			R.useEffect(() => {
				if (flash === null) return;
				const wait = Math.max(0, flash.until - Date.now());
				const h = setTimeout(() => { try { if (document.title !== getBaseTitle()) document.title = getBaseTitle() } catch {} }, wait);
				return () => clearTimeout(h);
			}, [flash]);
			R.useEffect(() => {
				if (toast === null) return;
				const h = setTimeout(() => setToast(null), 4200);
				return () => clearTimeout(h);
			}, [toast]);
			if (toast === null) return null;
			return R.createElement("div", { className: "sntf-toast" }, R.createElement("span", { className: "sntf-toast-icon" }, "✓"), R.createElement("span", null, toast.text));
		}

		function segBtn(active, onClick, label) { return R.createElement("button", { className: "sntf-seg" + (active ? " sntf-seg-active" : ""), onClick }, label) }
		function NotifySettings() {
			const [tick, setTick] = R.useState(0);
			const rerender = () => setTick(tick + 1);
			const soundOn = readPref("dsh.notify.sound", true), titleOn = readPref("dsh.notify.title", true);
			const source = readSource(), volume = readVolume(), gain = readGain(), data = readData(), name = readName();
			const [previewTimer, setPreviewTimer] = R.useState(null);
			const [pickError, setPickError] = R.useState(null);
			const schedulePreview = () => { if (previewTimer !== null) { clearTimeout(previewTimer); setPreviewTimer(null) } const h = setTimeout(() => { setPreviewTimer(null); playPreview(readSource(), readData(), readVolume(), readGain()) }, 250); setPreviewTimer(h) };
			const handleFile = (file) => {
				if (file === null || file === undefined) return;
				if (file.size > 1024 * 1024) { setPickError("文件超过 1MB 上限"); return }
				if (typeof FileReader === "undefined") { setPickError("当前环境不支持文件读取"); return }
				const reader = new FileReader();
				reader.onload = () => { writeData(String(reader.result)); writeName(file.name); setPickError(null); rerender() };
				reader.onerror = () => setPickError("文件读取失败");
				reader.readAsDataURL(file);
			};
			const onPick = (e) => { const f = e.target.files && e.target.files[0]; if (f) handleFile(f); e.target.value = "" };
			const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f) };
			return R.createElement("div", { className: "sntf-card" },
				R.createElement("div", { className: "sntf-row" },
					R.createElement("div", { className: "sntf-head" },
						R.createElement("div", { className: "sntf-title" }, "会话完成提醒"),
						R.createElement("div", { className: "sntf-desc" }, "会话完成时播放提示音，并在网页标题动态显示运行状态")),
					R.createElement("label", { className: "sntf-switch" },
						R.createElement("input", { type: "checkbox", checked: soundOn, onChange: (e) => { writePref("dsh.notify.sound", e.target.checked); rerender() } }),
						R.createElement("span", null))),
				soundOn ? R.createElement("div", { className: "sntf-sub" },
					R.createElement("div", { className: "sntf-segs" },
						segBtn(source === "chime", () => { writeSource("chime"); rerender() }, "默认提示音"),
						segBtn(source === "bell", () => { writeSource("bell"); rerender() }, "清脆铃声"),
						segBtn(source === "custom", () => { writeSource("custom"); rerender() }, "自定义音频")),
					R.createElement("button", { className: "sntf-preview", onClick: () => playPreview(readSource(), readData(), readVolume(), readGain()) }, "试听"),
					R.createElement("div", { className: "sntf-slider-row" },
						R.createElement("span", null, "音量"),
						R.createElement("input", { type: "range", min: 0, max: 1, step: 0.05, value: volume, onChange: (e) => { writeVolume(Number(e.target.value)); rerender(); schedulePreview() } }),
						R.createElement("span", { className: "sntf-pct" }, Math.round(volume * 100) + "%")),
					R.createElement("div", { className: "sntf-slider-row" },
						R.createElement("span", null, "增益"),
						R.createElement("input", { type: "range", min: 1, max: 3, step: 0.05, value: gain, onChange: (e) => { writeGain(Number(e.target.value)); rerender(); schedulePreview() } }),
						R.createElement("span", { className: "sntf-pct" }, Math.round(gain * 100) + "%")),
					source === "custom" ? R.createElement("div", { className: "sntf-custom" },
						R.createElement("label", { className: "sntf-pick", onDragOver: (e) => e.preventDefault(), onDrop: onDrop },
							R.createElement("input", { type: "file", accept: ".mp3,.wav,.ogg,.webm,audio/*", style: { display: "none" }, onChange: onPick }),
							data !== null ? "已选择: " + (name || "音频") : "选择音频文件"),
						data !== null ? R.createElement("button", { className: "sntf-remove", onClick: () => { writeData(null); writeName(""); setPickError(null); rerender() } }, "移除") : null,
						R.createElement("div", { className: "sntf-fnote" }, pickError !== null ? pickError : ((name ? name + " · " : "") + "支持 MP3 / WAV / OGG / WEBM · 建议时长 ≤ 3 秒 · 文件 ≤ 1 MB")))
					: null)
				: null,
				R.createElement("div", { className: "sntf-divider" }),
				R.createElement("div", { className: "sntf-row" },
					R.createElement("div", { className: "sntf-head" },
						R.createElement("div", { className: "sntf-title" }, "动态网页标题"),
						R.createElement("div", { className: "sntf-desc" }, "运行中闪烁 ●/○，完成闪 ✓")),
					R.createElement("label", { className: "sntf-switch" },
						R.createElement("input", { type: "checkbox", checked: titleOn, onChange: (e) => { writePref("dsh.notify.title", e.target.checked); rerender() } }),
						R.createElement("span", null))));
		}

		function ModelChip(props) { return R.createElement("span", { className: "cost-dock-model" }, props.model, " ", fmtCost(props.cost, props.cur)) }
		function TurnBars(props) {
			const cur = useCurrency();
			const turns = props.turns || [];
			const [page, setPage] = R.useState(0);
			const pageSize = 12;
			const pages = Math.max(1, Math.ceil(turns.length / pageSize));
			const p = Math.min(page, pages - 1);
			const slice = turns.slice(p * pageSize, p * pageSize + pageSize);
			const sorted = slice.slice().sort((a, b) => b.cost - a.cost);
			const max = sorted.length > 0 ? Math.max.apply(null, sorted.map((t) => t.cost)) : 0;
			const min = sorted.length > 0 ? Math.min.apply(null, sorted.map((t) => t.cost)) : 0;
			const bars = sorted.map((t) => {
				let h = 2;
				if (t.cost > 0 && max > 0) { if (min > 0 && max / min > 5) h = 2 + 98 * (Math.log(t.cost / min) / Math.log(max / min)); else h = 2 + 98 * (t.cost / max) }
				return R.createElement("div", { key: String(t.turn), className: "cost-bar", title: t.model + " · " + t.steps + " 步 · " + fmtCost(t.cost, cur) },
					R.createElement("div", { className: "cost-bar-val" }, fmtCost(t.cost, cur)),
					R.createElement("div", { className: "cost-bar-fill", style: { height: h + "%" } }),
					R.createElement("div", { className: "cost-bar-idx" }, "#" + t.turn));
			});
			return R.createElement("div", { className: "cost-dock" },
				R.createElement("div", { className: "cost-bars" }, bars),
				pages > 1 ? R.createElement("div", { className: "cost-pager" },
					R.createElement("button", { disabled: p === 0, onClick: () => setPage(p - 1) }, "上一页"),
					R.createElement("span", null, (p + 1) + " / " + pages),
					R.createElement("button", { disabled: p >= pages - 1, onClick: () => setPage(p + 1) }, "下一页"))
				: null);
		}
		function CostDock(props) {
			const sessionId = props.sessionId;
			const cur = useCurrency();
			const [data, setData] = R.useState(null);
			const [open, setOpen] = R.useState(false);
			R.useEffect(() => {
				let alive = true;
				const tick = async () => {
					try { const r = await _ctx.remote.enhanced.costSession(sessionId, { sessionId }); if (alive && r !== null && typeof r === "object" && r.ok === true) setData(r) } catch {}
					ensureRates(sessionId);
					syncCurrency();
				};
				tick();
				const h = setInterval(tick, 3000);
				return () => { alive = false; clearInterval(h) };
			}, [sessionId]);
			if (data === null) return null;
			const models = Object.entries(data.byModel || {});
			const turns = data.turns || [];
			return R.createElement("div", { className: "cost-dock" },
				R.createElement("div", { className: "cost-dock-row" },
					R.createElement("span", { className: "cost-dock-total" }, "费用 " + fmtCost(data.cost, cur)),
					R.createElement("span", null, "输入 " + fmtTok(data.input + data.write)),
					R.createElement("span", null, "输出 " + fmtTok(data.output)),
					models.slice(0, 3).map((kv) => R.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost, cur: cur })),
					turns.length > 0 ? R.createElement("span", { className: "cost-dock-toggle", onClick: () => setOpen(!open) }, open ? "收起 ▲" : "每轮费用 ▼") : null),
				open && turns.length > 0 ? R.createElement(TurnBars, { turns }) : null);
		}
		function Drill(props) {
			const cur = useCurrency();
			const item = props.item;
			const turns = item.turns || [], calls = item.calls || [];
			return R.createElement("div", null,
				R.createElement("div", { className: "cost-dock-row", style: { padding: "6px 0" } },
					R.createElement("span", null, "按模型:"),
					Object.entries(item.byModel || {}).map((kv) => R.createElement(ModelChip, { key: kv[0], model: kv[0], cost: kv[1].cost, cur: cur }))),
				R.createElement("div", { className: "cost-dock-row", style: { padding: "4px 0" } },
					R.createElement("span", null, "按日:"),
					Object.entries(item.byDay || {}).map((kv) => R.createElement("span", { key: kv[0], className: "cost-dock-model" }, kv[0], " ", fmtCost(kv[1].cost, cur)))),
				R.createElement("div", { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, "轮次明细(" + turns.length + ")"),
				R.createElement("table", { className: "cost-table" },
					R.createElement("thead", null, R.createElement("tr", null,
						R.createElement("th", null, "轮次"), R.createElement("th", null, "步数"), R.createElement("th", null, "模型"),
						R.createElement("th", { className: "cost-num" }, "输入"), R.createElement("th", { className: "cost-num" }, "输出"), R.createElement("th", { className: "cost-num" }, "费用"))),
					R.createElement("tbody", null, turns.slice(0, 10).map((t) => R.createElement("tr", { key: String(t.turn) },
						R.createElement("td", null, "#" + t.turn), R.createElement("td", null, t.steps), R.createElement("td", null, t.model),
						R.createElement("td", { className: "cost-num" }, fmtTok(t.input + t.write)), R.createElement("td", { className: "cost-num" }, fmtTok(t.output)),
						R.createElement("td", { className: "cost-num" }, fmtCost(t.cost, cur)))))),
				R.createElement("div", { style: { marginTop: 6, fontWeight: 500, fontSize: 12 } }, "逐笔明细(" + calls.length + ")"),
				R.createElement("table", { className: "cost-table" },
					R.createElement("thead", null, R.createElement("tr", null,
						R.createElement("th", null, "时间"), R.createElement("th", null, "轮/步"), R.createElement("th", null, "模型"),
						R.createElement("th", { className: "cost-num" }, "输入"), R.createElement("th", { className: "cost-num" }, "输出"), R.createElement("th", { className: "cost-num" }, "费用"))),
					R.createElement("tbody", null, calls.slice(0, 10).map((c, i) => R.createElement("tr", { key: String(i) },
						R.createElement("td", null, fmtTime(c.time)), R.createElement("td", null, "#" + c.turn + "." + c.step), R.createElement("td", null, c.model),
						R.createElement("td", { className: "cost-num" }, fmtTok(c.input + c.write)), R.createElement("td", { className: "cost-num" }, fmtTok(c.output)),
						R.createElement("td", { className: "cost-num" }, fmtCost(c.cost, cur)))))));
		}
		function BillingPage(props) {
			const cur = useCurrency();
			const [data, setData] = R.useState(null);
			const [expanded, setExpanded] = R.useState(null);
			const useSessions = props.useSessions;
			const sessionId = useSessions((s) => s.current);
			R.useEffect(() => {
				let alive = true;
				const tick = async () => {
					try { const r = await _ctx.remote.enhanced.costAll(sessionId); if (alive && r !== null && typeof r === "object" && r.ok === true) setData(r) } catch {}
					ensureRates(sessionId);
					syncCurrency();
				};
				tick();
				const h = setInterval(tick, 5000);
				return () => { alive = false; clearInterval(h) };
			}, [sessionId]);
			if (data === null) return R.createElement("div", { className: "cost-empty" }, "账单加载中…");
			const items = data.items || [];
			let total = 0, totalIn = 0, totalOut = 0;
			for (const it of items) { total += it.cost || 0; totalIn += it.input || 0; totalOut += it.output || 0 }
			return R.createElement("div", null,
				R.createElement("div", { className: "cost-dock-row", style: { padding: "4px 0 10px" } },
					R.createElement("span", { className: "cost-dock-total" }, "总费用 " + fmtCost(total, cur)),
					R.createElement("span", null, "输入 " + fmtTok(totalIn)), R.createElement("span", null, "输出 " + fmtTok(totalOut))),
				items.length === 0 ? R.createElement("div", { className: "cost-empty" }, "暂无账单数据") :
				R.createElement("table", { className: "cost-table" },
					R.createElement("thead", null, R.createElement("tr", null,
						R.createElement("th", null, "会话"), R.createElement("th", null, "更新时间"), R.createElement("th", { className: "cost-num" }, "轮次"), R.createElement("th", { className: "cost-num" }, "步数"),
						R.createElement("th", { className: "cost-num" }, "输入"), R.createElement("th", { className: "cost-num" }, "输出"), R.createElement("th", { className: "cost-num" }, "费用"))),
					R.createElement("tbody", null, items.map((it) => [
						R.createElement("tr", { key: "h" + it.sessionId, className: "clickable", onClick: () => setExpanded(expanded === it.sessionId ? null : it.sessionId) },
							R.createElement("td", null, (expanded === it.sessionId ? "▾ " : "▸ ") + String(it.sessionId).slice(0, 12)),
							R.createElement("td", null, fmtTime(it.updatedAt)),
							R.createElement("td", { className: "cost-num" }, (it.turns || []).length),
							R.createElement("td", { className: "cost-num" }, (it.turns || []).reduce((a, t) => a + t.steps, 0)),
							R.createElement("td", { className: "cost-num" }, fmtTok(it.input + it.write)),
							R.createElement("td", { className: "cost-num" }, fmtTok(it.output)),
							R.createElement("td", { className: "cost-num" }, fmtCost(it.cost, cur))),
						expanded === it.sessionId ? R.createElement("tr", { key: "d" + it.sessionId }, R.createElement("td", { colSpan: 7, style: { padding: "4px 8px 10px" } }, R.createElement(Drill, { item: it }))) : null
					]))),
				R.createElement("div", { className: "cost-empty", style: { marginTop: 10, fontSize: 11 } }, "费用按请求时刻计价(峰谷价表),每 5 秒刷新"));
		}
		function CostSettings(props) {
			const [cfg, setCfg] = R.useState(null);
			const [draft, setDraft] = R.useState({});
			const [err, setErr] = R.useState(null);
			const useSessions = props.useSessions;
			const sessionId = useSessions((s) => s.current);
			R.useEffect(() => {
				let alive = true;
				const load = async () => {
					try {
						const r = await _ctx.remote.enhanced.costConfig(sessionId, {});
						if (!alive) return;
						if (r !== null && typeof r === "object" && r.ok === true) { setCfg(r); setDraft(r.prices || {}); setErr(null) }
						else setErr("配置读取失败");
					} catch { if (alive) setErr("配置读取失败(插件 Host 未运行?)") }
				};
				load();
				return () => { alive = false };
			}, [sessionId]);
			if (err !== null) return R.createElement("div", { className: "cost-empty" }, err);
			if (cfg === null) return R.createElement("div", { className: "cost-empty" }, "加载中…");
			const modelNames = Object.keys(cfg.builtin || {});
			const setPrice = (model, key, value) => {
				const next = Object.assign({}, draft, { [model]: Object.assign({}, draft[model] || {}, { [key]: value }) });
				setDraft(next);
				_ctx.remote.enhanced.costConfig(sessionId, { action: "set", prices: next }).catch(() => {});
			};
			const resetAll = () => { setDraft({}); _ctx.remote.enhanced.costConfig(sessionId, { action: "set", prices: {} }).catch(() => {}) };
			return R.createElement("div", { className: "cost-settings" },
				R.createElement("div", { className: "cost-settings-row" },
					R.createElement("div", null,
						R.createElement("div", { style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } }, "费用预估"),
						R.createElement("div", { className: "cost-settings-label" }, "自定义 ¥/百万 token 价格,留空用内置峰谷价")),
					R.createElement("button", { className: "cost-pager", onClick: resetAll, style: { padding: "3px 10px" } }, "恢复内置价")),
				modelNames.map((model) => R.createElement("div", { key: model },
					R.createElement("div", { className: "cost-settings-label", style: { marginBottom: 4 } }, model),
					R.createElement("div", { className: "cost-price-grid" },
						["cacheRead", "cacheMiss", "output"].map((key) => {
							const v = draft[model] ? draft[model][key] : "";
							return R.createElement("div", { key: key, className: "cost-price-cell" },
								R.createElement("span", null, key === "cacheRead" ? "缓存读" : (key === "cacheMiss" ? "未命中输入" : "输出")),
								R.createElement("input", {
									type: "number", min: 0, step: 0.01, placeholder: "内置", value: v === undefined ? "" : String(v),
									onChange: (e) => setPrice(model, key, e.target.value === "" ? undefined : Number(e.target.value))
								}));
						})))),
				R.createElement("div", { className: "cost-settings-label" }, "说明: 峰时 09-12/14-18(北京),按请求时刻计价;内置价见 deepseek-v4-flash/pro"));
		}
		function CurrencyCard(props) {
			const cur = useCurrency();
			const [menuOpen, setMenuOpen] = R.useState(false);
			const [manual, setManual] = R.useState(null);
			const useSessions = props.useSessions;
			const sessionId = useSessions((s) => s.current);
			const prefs = readPrefs();
			const applyCode = (code) => { writePrefs({ code, manualRate: readPrefs().manualRate }); syncCurrency(); ensureRates(sessionId) };
			const applyManual = (value) => {
				const p = readPrefs();
				const n = Number(value);
				writePrefs({ code: p.code, manualRate: Number.isFinite(n) && n > 0 ? n : null });
				setManual(value);
				syncCurrency();
			};
			const rateText = cur.code === "CNY" ? "人民币 ¥(默认)" : (cur.source === "manual" ? "手动汇率 1 " + cur.code + " = " + (readPrefs().manualRate ?? 1) + " CNY" : cur.source === "auto" ? "汇率自动获取 · 1 CNY = " + cur.rate.toFixed(4) + " " + cur.code : cur.source === "stale" ? "汇率缓存已过期 · 1 CNY = " + cur.rate.toFixed(4) + " " + cur.code : "汇率获取失败,暂按人民币显示");
			R.useEffect(() => { ensureRates(sessionId) }, []);
			return R.createElement("div", { className: "cost-settings" },
				R.createElement("div", { className: "cost-settings-row" },
					R.createElement("div", null,
						R.createElement("div", { style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary)" } }, "账单货币"),
						R.createElement("div", { className: "cost-settings-label" }, "账单、费用预估与余额的显示货币;汇率自动获取,可手动覆盖")),
					R.createElement("div", { className: "cost-curr" },
						R.createElement("button", { className: "cost-curr-btn", onClick: () => setMenuOpen(!menuOpen) }, CURRENCY_SYMBOLS[prefs.code] + " " + prefs.code, " ▾"),
						menuOpen ? R.createElement("div", { className: "cost-curr-menu" },
							BILLING_CURRENCIES.map(([c, sym]) => R.createElement("button", { key: c, className: "cost-curr-item" + (prefs.code === c ? " cost-curr-active" : ""), onClick: () => { applyCode(c); setMenuOpen(false) } },
								R.createElement("span", null, c, " ", sym),
								prefs.code === c ? R.createElement("span", { className: "cost-curr-tick" }, "✓") : null)))
						: null)),
				R.createElement("div", { className: "cost-curr-rate" },
					R.createElement("div", { className: "cost-curr-rate-value" }, rateText),
					R.createElement("div", { className: "cost-curr-rate-meta" }, "数据源: open.er-api.com(每日更新)")),
				R.createElement("div", { className: "cost-curr-manual" },
					R.createElement("label", null, "手动汇率(1 " + prefs.code + " = ? CNY)"),
					R.createElement("input", { type: "number", min: 0, step: 0.0001, placeholder: prefs.code === "CNY" ? "—" : "自动", value: manual !== null ? manual : (prefs.manualRate !== null ? String(prefs.manualRate) : ""), onChange: (e) => applyManual(e.target.value) }),
					R.createElement("span", { className: "cost-settings-label" }, "留空使用自动汇率")));
		}
		function TokmRow(props) {
			const sessionId = props.sessionId;
			const [data, setData] = R.useState(null);
			R.useEffect(() => {
				let alive = true;
				const tick = async () => { try { const value = await _ctx.remote.enhanced.usageByModel(sessionId, { sessionId }); if (alive) setData(value) } catch {} };
				tick();
				const h = setInterval(tick, 2000);
				return () => { alive = false; clearInterval(h) };
			}, [sessionId]);
			if (data === null || Object.keys(data).length === 0) return R.createElement("div", { className: "tokm-row" }, "按模型用量加载中…");
			const rows = Object.entries(data).map(([model, b]) => R.createElement("span", { key: model, className: "tokm-cell" },
				model + " " + (b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens) + " tok"));
			return R.createElement("div", { className: "tokm-row" }, rows);
		}

		// ================= 插件入口 =================
		function apply(ctx) {
			// dsh-mods-enhanced: 客户端 UI 已迁移回 ui-conversation,此处不再注册 slot。
			// 服务端非远程功能(imgr 图片转文字 / sntf 完成监听 / tokm 投影)仍在 index.js。
		}
		exports.apply = apply;
		exports.inject = [];
		return module.exports;
	}
});
