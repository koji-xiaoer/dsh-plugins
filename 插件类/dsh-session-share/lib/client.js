window.__ModuleLoader__.load({
	id: "dsh-session-share",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require("react");
		const React = react;

		// ================= CSS 注入(产品模式,data-plugin-css 判重) =================
		const CSS_TAG = "dsh-session-share/ui.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-share";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = ".sshp-page{font-size:12px;color:var(--dsw-alias-label-secondary)}.sshp-desc{margin-bottom:10px;line-height:1.6}.sshp-table{width:100%;border-collapse:collapse;font-size:12px}.sshp-table th,.sshp-table td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}.sshp-table th{color:var(--dsw-alias-label-tertiary);font-weight:500}.sshp-empty{color:var(--dsw-alias-label-tertiary);padding:14px 0}.sshp-preview{margin:4px 0 14px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;max-height:340px;overflow:auto}.sshp-preview-title{font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:8px}.sshp-msg{margin-bottom:10px;font-size:12px;line-height:1.55}.sshp-msg-tag{font-weight:600;color:var(--dsw-alias-label-secondary);margin-right:6px}.sshp-msg-text{white-space:pre-wrap;color:var(--dsw-alias-label-primary);word-break:break-word}.sshp-mono{font-family:var(--ds-font-family-code,monospace);font-variant-numeric:tabular-nums}.sshp-foot{margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.6}.sshp-btn{background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:2px 10px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary)}.sshp-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}.sshp-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}.sshp-card{width:420px;max-width:calc(100vw - 48px);border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.18)}.sshp-card-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);margin-bottom:4px}.sshp-card-desc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5;margin-bottom:12px;word-break:break-all}.sshp-input{width:100%;box-sizing:border-box;background:none;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;font-size:12px;color:var(--dsw-alias-label-primary);margin-bottom:14px}.sshp-actions{display:flex;justify-content:flex-end;gap:8px}.sshp-primary{color:#fff;background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}.sshp-badge-ok{font-size:11px;color:var(--dsw-alias-state-business-primary)}";
			document.head.appendChild(tag);
		}

		// ================= RPC(自有 /sshp/* 路由,同源 fetch) =================
		async function rpc(path, args) {
			const isPost = path === "/sshp/publish" || path === "/sshp/unpublish";
			const url = isPost ? path : path + "?" + new URLSearchParams(Object.entries(args || {}).map(([k, v]) => [k, String(v)])).toString();
			const response = await fetch(url, isPost ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args || {}) } : { method: "GET" });
			return await response.json();
		}

		function fmtTime(t) { try { const d = new Date(t); if (Number.isNaN(d.getTime())) return ""; return (d.getMonth() + 1) + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") } catch { return "" } }

		// ================= 组件:发布对话框(shell.overlay,菜单补丁事件触发) =================
		function ShareDialog() {
			const targetState = React.useState(null);
			const target = targetState[0], setTarget = targetState[1];
			const noteState = React.useState("");
			const note = noteState[0], setNote = noteState[1];
			const sharedState = React.useState(null);
			const sharedInfo = sharedState[0], setShared = sharedState[1];
			React.useEffect(() => {
				const onShare = (event) => {
					try {
						const detail = event && event.detail ? event.detail : {};
						if (typeof detail.sessionId !== "string" || detail.sessionId === "") return;
						setTarget({ sessionId: detail.sessionId, title: typeof detail.title === "string" ? detail.title : "" });
						setNote("");
						setShared(null);
						rpc("/sshp/get", { sessionId: detail.sessionId }).then((r) => {
							if (r !== null && typeof r === "object" && r.ok === true && r.shared === true) { setShared(r); setNote(typeof r.note === "string" ? r.note : "") }
						}).catch(() => {});
					} catch {}
				};
				window.addEventListener("sshp:share-session", onShare);
				return () => window.removeEventListener("sshp:share-session", onShare);
			}, []);
			if (target === null) return null;
			const close = () => setTarget(null);
			const publish = async () => { try { await rpc("/sshp/publish", { sessionId: target.sessionId, note: note }) } catch {} setTarget(null) };
			const card = React.createElement("div", { className: "sshp-card", onClick: (e) => e.stopPropagation() },
				React.createElement("div", { className: "sshp-card-title" }, sharedInfo !== null ? "更新分享" : "分享会话"),
				React.createElement("div", { className: "sshp-card-desc" },
					"《" + (target.title || "无标题") + "》",
					sharedInfo !== null ? React.createElement("span", { className: "sshp-badge-ok" }, " · 已分享 " + sharedInfo.shareId) : null,
					React.createElement("br"),
					"其他会话可通过 read_shared_session 工具或“设置 → 会话分享”页读取该会话的实时最近消息。"),
				React.createElement("input", { className: "sshp-input", placeholder: "备注:值得其他会话看什么(可选)", value: note, onChange: (e) => setNote(e.target.value) }),
				React.createElement("div", { className: "sshp-actions" },
					React.createElement("button", { className: "sshp-btn", onClick: close }, "取消"),
					React.createElement("button", { className: "sshp-btn sshp-primary", onClick: publish }, sharedInfo !== null ? "保存并保持分享" : "发布分享")));
			return React.createElement("div", { className: "sshp-backdrop", onClick: close }, card);
		}

		// ================= 组件:摘要预览 =================
		function Preview(props) {
			const data = props.data;
			if (data === null) return React.createElement("div", { className: "sshp-empty" }, "摘要加载中…");
			if (data.ok !== true) return React.createElement("div", { className: "sshp-empty" }, "读取失败: " + String(data.error !== undefined ? data.error : ""));
			const kids = [];
			kids.push(React.createElement("div", { className: "sshp-preview-title", key: "t" },
				"《" + (data.title || "无标题") + "》 最近 " + data.messages.length + "/" + data.totalMessages + " 条" +
				(data.skippedSynthetic > 0 ? " · 另有 " + data.skippedSynthetic + " 条系统注入未列入" : "")));
			if (data.note) kids.push(React.createElement("div", { key: "n", style: { marginBottom: 8, color: "var(--dsw-alias-label-tertiary)" } }, "备注: " + data.note));
			for (let i = 0; i < data.messages.length; i++) {
				const m = data.messages[i];
				const tag = m.role === "user" ? "[用户 " + fmtTime(m.time) + "]" : "[助手 #" + String(m.turn) + (m.interrupted === true ? " 中断" : "") + " " + fmtTime(m.time) + "]";
				kids.push(React.createElement("div", { className: "sshp-msg", key: "m" + i },
					React.createElement("span", { className: "sshp-msg-tag" }, tag),
					React.createElement("span", { className: "sshp-msg-text" }, m.text)));
			}
			return React.createElement("div", { className: "sshp-preview" }, kids);
		}

		// ================= 组件:管理页(settings.section) =================
		function CopyBtn(props) {
			const copiedState = React.useState(false);
			const setCopied = copiedState[1];
			const doCopy = async () => { try { await navigator.clipboard.writeText(props.value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setCopied(false) } };
			return React.createElement("button", { className: "sshp-btn", title: props.value, onClick: doCopy }, copiedState[0] ? "已复制✓" : "复制ID");
		}

		function ShareManager() {
			const itemsState = React.useState(null);
			const items = itemsState[0], setItems = itemsState[1];
			const previewState = React.useState(null);
			const preview = previewState[0], setPreview = previewState[1];
			React.useEffect(() => {
				let alive = true;
				const load = async () => {
					try { const r = await rpc("/sshp/list", {}); if (alive && r !== null && typeof r === "object" && r.ok === true) setItems(r.items || []) } catch {}
				};
				load();
				const h = setInterval(load, 8000);
				return () => { alive = false; clearInterval(h) };
			}, []);
			const togglePreview = async (shareId) => {
				if (preview !== null && preview.shareId === shareId) { setPreview(null); return }
				setPreview({ shareId, data: null });
				try { const r = await rpc("/sshp/read", { shareId, limit: 50 }); setPreview({ shareId, data: r }) } catch (e) { setPreview({ shareId, data: { ok: false, error: String(e) } }) }
			};
			const unpublish = async (shareId) => {
				try { await rpc("/sshp/unpublish", { shareId }) } catch {}
				if (preview !== null && preview.shareId === shareId) setPreview(null);
				try { const r = await rpc("/sshp/list", {}); if (r !== null && typeof r === "object" && r.ok === true) setItems(r.items || []) } catch {}
			};
			const desc = React.createElement("div", { className: "sshp-desc", key: "desc" },
				"在左侧会话行的“⋯”菜单里点“分享会话”登记分享,得到一个分享ID。其他会话可以:① 让模型调用 read_shared_session 工具读取摘要;② 或在本页直接预览。读取的是该会话实时的最近用户/助手消息。");
			const foot = React.createElement("div", { className: "sshp-foot", key: "foot" },
				"分享登记保存在服务进程内存中:重启 dsh 后需重新分享。读取方拿到的是读取时刻的实时摘要。");
			if (items === null) {
				return React.createElement("div", { className: "sshp-page" }, desc, React.createElement("div", { className: "sshp-empty" }, "加载中…"), foot);
			}
			if (items.length === 0) {
				return React.createElement("div", { className: "sshp-page" }, desc, React.createElement("div", { className: "sshp-empty" }, "暂无已分享的会话 — 在左侧会话行的“⋯”菜单里点“分享会话”"), foot);
			}
			const thLabels = ["分享ID", "会话标题", "备注", "分享时间", "操作"];
			const ths = [];
			for (const label of thLabels) ths.push(React.createElement("th", { key: label }, label));
			const thead = React.createElement("thead", null, React.createElement("tr", null, ths));
			const rows = [];
			for (const it of items) {
				const actions = React.createElement("span", { style: { display: "inline-flex", gap: 8 } },
					React.createElement(CopyBtn, { value: it.shareId }),
					React.createElement("button", { className: "sshp-btn", onClick: () => togglePreview(it.shareId) }, preview !== null && preview.shareId === it.shareId ? "收起" : "预览摘要"),
					React.createElement("button", { className: "sshp-btn", onClick: () => unpublish(it.shareId) }, "取消分享"));
				const row = React.createElement("tr", { key: it.shareId },
					React.createElement("td", { className: "sshp-mono" }, it.shareId),
					React.createElement("td", null, it.title || "无标题"),
					React.createElement("td", { style: { maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }, title: it.note }, it.note || "—"),
					React.createElement("td", null, fmtTime(it.sharedAt)),
					React.createElement("td", null, actions));
				rows.push(row);
				if (preview !== null && preview.shareId === it.shareId) {
					rows.push(React.createElement("tr", { key: "p-" + it.shareId },
						React.createElement("td", { colSpan: 5 }, React.createElement(Preview, { data: preview.data }))));
				}
			}
			const table = React.createElement("table", { className: "sshp-table", key: "tbl" }, thead, React.createElement("tbody", null, rows));
			return React.createElement("div", { className: "sshp-page" }, desc, table, foot);
		}

		// ================= 插件入口 =================
		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === undefined) return;
			slots.inject("shell.overlay", () => slots.register(
				{ name: "shell.overlay", id: "session-share-dialog", order: 50 },
				() => React.createElement(ShareDialog, null)
			));
			slots.inject("settings.section", () => slots.register(
				{ name: "settings.section", id: "session-share", order: 40, label: "会话分享" },
				() => React.createElement(ShareManager, null)
			));
		}
		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
