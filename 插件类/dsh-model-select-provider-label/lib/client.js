window.__ModuleLoader__.load({
	id: "dsh-model-select-provider-label",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		let react = require("react");
		const React = react;

		// ================= CSS 注入(产品模式,data-plugin-css 判重) =================
		const CSS_TAG = "dsh-model-select-provider-label/ui.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-select-provider-label";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = ".msp_root{min-width:0;position:relative}\n.msp_trigger{min-width:0;max-width:260px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:flex}\n.msp_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}\n.msp_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}\n.msp_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}\n.msp_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}\n.msp_triggerProvider{color:var(--dsw-alias-label-caption);flex:none;font-size:12px}\n.msp_triggerEffort{color:var(--dsw-alias-label-caption);flex:none}\n.msp_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}\n.msp_chevronOpen{transform:rotate(180deg)}\n.msp_menu{z-index:20;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);width:min(280px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 8px);right:0}\n.msp_menuDown{bottom:auto;top:calc(100% + 8px)}\n.msp_status,.msp_empty{color:var(--dsw-alias-label-tertiary);padding:10px;font-size:13px;line-height:20px}\n.msp_error,.msp_warning{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;padding:7px 8px;font-size:12px;line-height:18px;display:flex}\n.msp_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}\n.msp_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}\n.msp_groups{min-height:0;overflow-y:auto;border-radius:8px}\n.msp_group+.msp_group{margin-top:4px}\n.msp_groupTitle{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);padding:5px 8px 3px;font-size:12px;font-weight:500;line-height:18px;position:sticky;top:0}\n.msp_groupToggle{width:100%;display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:12px;font-weight:500;line-height:18px;color:var(--dsw-alias-label-tertiary);text-align:left;background:var(--dsw-specific-menu);border:none;border-radius:8px;outline:none;cursor:pointer}\n.msp_groupToggle:hover:not(:disabled),.msp_groupToggle:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}\n.msp_groupToggleName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.msp_groupToggleCount{color:var(--dsw-alias-label-caption);flex:none}\n.msp_option{width:100%;min-height:38px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:10px;outline:none;align-items:center;gap:8px;padding:6px 8px;display:flex}\n.msp_option:hover:not(:disabled),.msp_option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}\n.msp_selected{background:0 0}\n.msp_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}\n.msp_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}\n.msp_modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}\n.msp_description{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}\n.msp_check{color:var(--dsw-alias-label-primary);flex:0 0 18px;place-items:center;display:grid}\n.msp_cell{width:100%;height:40px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;gap:8px;padding:0 10px;font-size:14px;line-height:22px;display:flex}\n.msp_cell:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.msp_cellLabel{text-overflow:ellipsis;white-space:nowrap;flex:auto;min-width:0;overflow:hidden}\n.msp_cellValue{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:0 auto;overflow:hidden}\n.msp_cellChevron{color:var(--dsw-alias-label-tertiary);flex:none}\n.msp_toast{position:absolute;bottom:calc(100% + 8px);right:0;z-index:30;max-width:260px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-inverted);border-radius:10px;box-shadow:var(--dsw-shadow-lv3);padding:8px 12px;font-size:13px;line-height:18px}\n.msp_flyout{position:absolute;bottom:0;left:100%;width:min(280px,100vw - 32px);max-height:min(420px,100vh - 96px);background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-inverted);border-radius:12px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);z-index:21;flex-direction:column;padding:4px;display:flex}\n.msp_flyoutLeft{left:auto;right:100%}\n.msp_flyoutTitle{padding:5px 8px 3px;font-size:12px;font-weight:500;line-height:18px;color:var(--dsw-alias-label-tertiary)}\n.msp_flyoutBack{width:100%;display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:8px;outline:none;cursor:pointer}\n.msp_flyoutBack:hover:not(:disabled),.msp_flyoutBack:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}\n.msp_flyoutCatRow{width:100%;display:flex;align-items:center;gap:6px;padding:6px 8px;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:8px;outline:none;cursor:pointer}\n.msp_flyoutCatRow:hover:not(:disabled),.msp_flyoutCatRow:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}\n.msp_flyoutCatRowName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.msp_flyoutCatRowCount{color:var(--dsw-alias-label-caption);flex:none}\n.msp_flyoutList{min-height:0;overflow-y:auto;border-radius:8px}\n";
			document.head.appendChild(tag);
		}

		// ================= 文案(内联字典,跟随界面语言) =================
		const zhDict = {
			"trigger.fallback": "选择模型",
			"trigger.selectAria": "选择模型",
			"trigger.aria": "选择模型，当前 {model}",
			"trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
			"menu.aria": "模型与推理等级",
			"menu.model": "模型",
			"menu.effort": "推理等级",
			"effort.providerDefault": "Default",
			"status.loading": "正在刷新模型列表…",
			"error.action": "模型操作失败：{message}",
			"action.reload": "重新加载",
			"retry": "重试",
			"warning.groupLoad": "{name} 加载失败：{message}",
			"empty.models": "没有可用的模型。",
			"empty.efforts": "当前模型未提供推理等级。",
			"back": "返回",
			"cat.chat": "对话/推理",
			"cat.multimodal": "多模态/视觉",
			"cat.code": "代码",
			"cat.media": "图像/视频生成",
			"cat.embedding": "嵌入/向量",
			"cat.3d": "3D 生成"
		};
		const enDict = {
			"trigger.fallback": "Select model",
			"trigger.selectAria": "Select model",
			"trigger.aria": "Select model, current {model}",
			"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
			"menu.aria": "Model and reasoning effort",
			"menu.model": "Model",
			"menu.effort": "Effort",
			"effort.providerDefault": "Default",
			"status.loading": "Refreshing model list…",
			"error.action": "Model operation failed: {message}",
			"action.reload": "Reload",
			"retry": "Retry",
			"warning.groupLoad": "{name} failed to load: {message}",
			"empty.models": "No models available.",
			"empty.efforts": "This model provides no reasoning effort levels.",
			"back": "Back",
			"cat.chat": "Chat / Reasoning",
			"cat.multimodal": "Multimodal / Vision",
			"cat.code": "Code",
			"cat.media": "Image / Video Gen",
			"cat.embedding": "Embedding",
			"cat.3d": "3D"
		};

		// 按模型 id 前缀/关键字归类
		function categorizeModel(modelId) {
			const id = String(modelId).toLowerCase();
			if (/embedding/.test(id)) return "embedding";
			if (/code/.test(id)) return "code";
			if (/seedream|seedance|seededit|i2v|t2v|t2i|flf2v|wan/.test(id)) return "media";
			if (/seed3d|hitem3d|hyper3d|3d/.test(id)) return "3d";
			if (/vision|image|audio|multimodal/.test(id)) return "multimodal";
			return "chat";
		}

		const ChevronDown = () => React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none" }, React.createElement("path", { d: "M3.5 5.25L7 8.75L10.5 5.25", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		const ChevronRight = () => React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none" }, React.createElement("path", { d: "M5.25 3.5L8.75 7L5.25 10.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		const ChevronLeft = () => React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none" }, React.createElement("path", { d: "M8.75 3.5L5.25 7L8.75 10.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		const Check = () => React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" }, React.createElement("path", { d: "M3.5 8.5L6.5 11.5L12.5 4.5", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }));
		const Warn = () => React.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" }, React.createElement("path", { d: "M8 3.5L14 13H2L8 3.5Z", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" }), React.createElement("path", { d: "M8 7V10", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }));

		// 模块级翻译函数:locale 服务在 apply 时注入 localeRef,组件与 apply 共用
		let localeRef = null;
		function t(key, params) {
			const snapshot = localeRef !== null && typeof localeRef.getLocale === "function" ? localeRef.getLocale() : null;
			const active = snapshot && snapshot.active;
			const dict = active === "zh" ? zhDict : enDict;
			let text = dict[key] !== undefined ? dict[key] : key;
			if (params) {
				for (const name of Object.keys(params)) {
					text = text.split("{" + name + "}").join(String(params[name]));
				}
			}
			return text;
		}

		function ModelSelectWithProvider({ locked, available, directory, load, select }) {
			const FOLD_THRESHOLD = 8;
			const state = React.useSyncExternalStore((fn) => directory.subscribe(fn), () => directory.getSnapshot());
			const [open, setOpen] = React.useState(false);
			const [pane, setPane] = React.useState("root");
			const [menuDown, setMenuDown] = React.useState(false);
			const [flyoutGroupId, setFlyoutGroupId] = React.useState(null);
			const [flyoutPane, setFlyoutPane] = React.useState("cats");
			const [activeCategory, setActiveCategory] = React.useState(null);
			const [flyoutSide, setFlyoutSide] = React.useState("right");
			const lastActionRef = React.useRef("load");
			const [toast, setToast] = React.useState(null);
			const toastSeq = React.useRef(0);
			const rootRef = React.useRef(null);
			const triggerRef = React.useRef(null);
			const menuRef = React.useRef(null);
			const flyoutRef = React.useRef(null);
			const itemRefs = React.useRef([]);
			const id = React.useId();
			const choices = React.useMemo(() => state.groups.flatMap((group) => group.models.map((model) => ({
				group,
				model,
				selection: {
					provider: group.id,
					model: model.id,
					...model.reasoning && model.reasoning.defaultEffort !== undefined ? { reasoningEffort: model.reasoning.defaultEffort } : {}
				}
			}))), [state.groups]);
			const currentChoice = choices[state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current.provider && c.selection.model === state.current.model)];
			const reasoning = currentChoice && currentChoice.model.reasoning;
			const effectiveEffort = state.current && state.current.reasoningEffort !== undefined ? state.current.reasoningEffort : reasoning && reasoning.defaultEffort;
			const effortLabel = reasoning === undefined ? undefined : effectiveEffort === undefined ? t("effort.providerDefault") : (reasoning.efforts.find((level) => level.id === effectiveEffort) || {}).name || effectiveEffort;
			const effortChoices = React.useMemo(() => reasoning === undefined ? [] : [...reasoning.defaultEffort === undefined ? [{
				key: "provider-default",
				effort: undefined,
				label: t("effort.providerDefault")
			}] : [], ...reasoning.efforts.map((effort) => ({
				key: "effort:" + effort.id,
				effort: effort.id,
				label: effort.name,
				...effort.description === undefined ? {} : { description: effort.description }
			}))], [reasoning, t]);
			const busy = state.status === "selecting";
			const flyoutGroup = flyoutGroupId === null ? undefined : state.groups.find((group) => group.id === flyoutGroupId);
			const categoryGroups = React.useMemo(() => {
				if (flyoutGroup === undefined) return [];
				const map = new Map();
				for (const model of flyoutGroup.models) {
					const cat = categorizeModel(model.id);
					if (!map.has(cat)) map.set(cat, []);
					map.get(cat).push(model);
				}
				const order = ["chat", "multimodal", "code", "media", "embedding", "3d"];
				return Array.from(map.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
			}, [flyoutGroup]);
			const activeCategoryModels = activeCategory === null ? undefined : categoryGroups.find(([cat]) => cat === activeCategory)?.[1];
			const reload = () => {
				lastActionRef.current = "load";
				load();
			};
			React.useEffect(() => {
				if (available) {
					lastActionRef.current = "load";
					load();
				}
			}, [available, load]);
			React.useEffect(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => {
					document.removeEventListener("mousedown", closeOutside);
				};
			}, [open]);
			// 主菜单顶部空间不足时改为向下弹出
			React.useEffect(() => {
				if (!open || !menuRef.current) return;
				const rect = menuRef.current.getBoundingClientRect();
				const margin = 8;
				if (!menuDown && rect.top < margin) setMenuDown(true);
			}, [open, pane, menuDown, state.groups]);
			// 面板底部锚定向上生长;右侧溢出翻左
			React.useEffect(() => {
				if (flyoutGroupId === null || !open || pane !== "model" || !menuRef.current || !flyoutRef.current) return;
				const menuRect = menuRef.current.getBoundingClientRect();
				const flyoutRect = flyoutRef.current.getBoundingClientRect();
				const margin = 8;
				const rightOverflow = menuRect.right + flyoutRect.width + margin > window.innerWidth - margin;
				const leftSpace = menuRect.left - margin;
				setFlyoutSide(rightOverflow && leftSpace > flyoutRect.width ? "left" : "right");
			}, [flyoutGroupId, flyoutPane, activeCategory, open, pane, state.groups]);
			if (!available) return null;
			const show = () => {
				setPane("root");
				setOpen(true);
				reload();
			};
			const close = (restoreFocus) => {
				setOpen(false);
				setPane("root");
				setFlyoutGroupId(null);
				setFlyoutPane("cats");
				setActiveCategory(null);
				if (restoreFocus) queueMicrotask(() => {
					if (triggerRef.current) triggerRef.current.focus();
				});
			};
			const moveFocus = (offset) => {
				const items = itemRefs.current.filter((item) => item !== null);
				if (items.length === 0) return;
				const active = items.findIndex((item) => item === document.activeElement);
				items[(Math.max(active, 0) + offset + items.length) % items.length].focus();
			};
			const onRootKeyDown = (event) => {
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (flyoutGroupId !== null && flyoutPane === "models") {
						setFlyoutPane("cats");
						setActiveCategory(null);
						return;
					}
					if (flyoutGroupId !== null) {
						setFlyoutGroupId(null);
						return;
					}
					if (pane !== "root") setPane("root");
					else close(true);
					return;
				}
				if (!open) return;
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					moveFocus(event.key === "ArrowDown" ? 1 : -1);
				}
			};
			const onBlur = (event) => {
				if (event.relatedTarget instanceof Node && rootRef.current && rootRef.current.contains(event.relatedTarget)) return;
				close();
			};
			const onRootMouseLeave = (event) => {
				if (event.relatedTarget instanceof Node && rootRef.current && rootRef.current.contains(event.relatedTarget)) return;
				setFlyoutGroupId(null);
				setFlyoutPane("cats");
				setActiveCategory(null);
			};
			const settleSelection = (accepted) => {
				if (accepted) {
					if (rootRef.current !== null) close(true);
					return;
				}
				const message = directory.getSnapshot().error;
				if (message !== null) {
					toastSeq.current += 1;
					setToast({ seq: toastSeq.current, text: t("error.action", { message }) });
				}
			};
			const choose = (selection) => {
				if (state.current && state.current.provider === selection.provider && state.current.model === selection.model) {
					close(true);
					return;
				}
				lastActionRef.current = "select";
				select(selection).then(settleSelection);
			};
			const chooseEffort = (effort) => {
				if (state.current === null) return;
				if (effectiveEffort === effort) {
					close(true);
					return;
				}
				const selection = {
					provider: state.current.provider,
					model: state.current.model,
					...effort === undefined ? {} : { reasoningEffort: effort }
				};
				lastActionRef.current = "select";
				select(selection).then(settleSelection);
			};
			const isFoldable = (group) => group.models.length > FOLD_THRESHOLD;
			const openFlyout = (group) => {
				setFlyoutGroupId(group.id);
				setFlyoutPane("cats");
				setActiveCategory(null);
			};
			const toggleFlyout = (group) => {
				if (flyoutGroupId === group.id) {
					setFlyoutGroupId(null);
				} else {
					setFlyoutGroupId(group.id);
					setFlyoutPane("cats");
					setActiveCategory(null);
				}
			};
			const openCategory = (cat) => {
				setActiveCategory(cat);
				setFlyoutPane("models");
			};
			const providerName = currentChoice ? currentChoice.group.name : undefined;
			const modelLabel = currentChoice ? currentChoice.model.name : t("trigger.fallback");
			const triggerLabel = effortLabel === undefined ? modelLabel : modelLabel + " · " + effortLabel;
			const triggerAria = currentChoice === undefined ? t("trigger.selectAria") : effortLabel === undefined ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", { model: modelLabel, effort: effortLabel });
			itemRefs.current = [];
			let itemIndex = 0;
			const itemRef = () => {
				const at = itemIndex++;
				return (node) => {
					itemRefs.current[at] = node;
				};
			};
			return React.createElement("div", {
				ref: rootRef,
				className: "msp_root",
				onKeyDown: onRootKeyDown,
				onBlur: onBlur,
				onMouseLeave: onRootMouseLeave
			}, [
				React.createElement("button", {
					ref: triggerRef,
					type: "button",
					className: "msp_trigger",
					"aria-label": triggerAria,
					"aria-haspopup": "menu",
					"aria-expanded": open,
					"aria-controls": open ? id + "-menu" : undefined,
					title: triggerLabel,
					disabled: locked,
					onClick: () => {
						if (open) close();
						else show();
					}
				}, [
					providerName !== undefined && React.createElement("span", { className: "msp_triggerProvider", children: providerName + " ·" }),
					React.createElement("span", { className: "msp_triggerLabel", children: modelLabel }),
					effortLabel !== undefined && React.createElement("span", { className: "msp_triggerEffort", children: effortLabel }),
					React.createElement("span", { className: "msp_chevron" + (open ? " msp_chevronOpen" : ""), children: React.createElement(ChevronDown, {}) })
				]),
				open && React.createElement("div", {
					ref: menuRef,
					id: id + "-menu",
					className: "msp_menu" + (menuDown ? " msp_menuDown" : ""),
					role: "menu",
					"aria-label": t("menu.aria"),
					"aria-busy": state.status === "loading" || busy
				}, [
					pane === "root" && React.createElement(React.Fragment, null, [
						React.createElement("button", {
							ref: itemRef(),
							type: "button",
							role: "menuitem",
							className: "msp_cell",
							onClick: () => {
								setPane("model");
							}
						}, [
							React.createElement("span", { className: "msp_cellLabel", children: t("menu.model") }),
							React.createElement("span", { className: "msp_cellValue", children: providerName !== undefined ? providerName + " · " + modelLabel : modelLabel }),
							React.createElement("span", { className: "msp_cellChevron", children: React.createElement(ChevronRight, {}) })
						]),
						reasoning !== undefined && React.createElement("button", {
							ref: itemRef(),
							type: "button",
							role: "menuitem",
							className: "msp_cell",
							onClick: () => {
								setPane("effort");
							}
						}, [
							React.createElement("span", { className: "msp_cellLabel", children: t("menu.effort") }),
							React.createElement("span", { className: "msp_cellValue", children: effortLabel }),
							React.createElement("span", { className: "msp_cellChevron", children: React.createElement(ChevronRight, {}) })
						])
					]),
					pane === "model" && React.createElement(React.Fragment, null, [
						state.status === "loading" && React.createElement("div", { className: "msp_status", children: t("status.loading") }),
						state.error !== null && lastActionRef.current === "load" && React.createElement("div", { className: "msp_error" }, [
							React.createElement("span", { children: t("error.action", { message: state.error }) }),
							React.createElement("button", { type: "button", className: "msp_retry", onClick: reload, children: t("retry") })
						]),
						state.failures.map((failure) => React.createElement("div", { key: failure.id, className: "msp_warning" }, [
							React.createElement("span", { children: t("warning.groupLoad", { name: failure.name, message: failure.message }) }),
							React.createElement("button", { type: "button", className: "msp_retry", onClick: reload, children: t("retry") })
						])),
						React.createElement("div", { className: "msp_groups scrollable" }, state.groups.map((group) => {
							const headingId = id + "-" + group.id;
							const foldable = isFoldable(group);
							const flyoutOpen = flyoutGroupId === group.id;
							return React.createElement("section", { key: group.id, role: "group", "aria-labelledby": headingId, className: "msp_group" }, [
								foldable ? React.createElement("button", {
									ref: itemRef(),
									type: "button",
									role: "menuitem",
									"aria-haspopup": "menu",
									"aria-expanded": flyoutOpen,
									className: "msp_groupToggle" + (flyoutOpen ? " msp_selected" : ""),
									id: headingId,
									onClick: () => {
										toggleFlyout(group);
									}
								}, [
									React.createElement("span", { className: "msp_groupToggleName", children: group.name }),
									React.createElement("span", { className: "msp_groupToggleCount", children: String(group.models.length) }),
									React.createElement("span", { className: "msp_cellChevron", children: React.createElement(ChevronRight, {}) })
								]) : React.createElement("div", { className: "msp_groupTitle", id: headingId, children: group.name }),
								!foldable && group.models.map((model) => {
									const selected = state.current && state.current.provider === group.id && state.current.model === model.id;
									return React.createElement("button", {
										key: model.id,
										ref: itemRef(),
										type: "button",
										role: "menuitemradio",
										"aria-checked": selected,
										className: "msp_option" + (selected ? " msp_selected" : ""),
										title: model.name,
										disabled: busy,
										onClick: () => {
											choose({ provider: group.id, model: model.id });
										}
									}, [
										React.createElement("span", { className: "msp_optionCopy" }, [
											React.createElement("span", { className: "msp_modelName", children: model.name }),
											model.description !== undefined && React.createElement("span", { className: "msp_description", children: model.description })
										]),
										React.createElement("span", { className: "msp_check", children: selected ? React.createElement(Check, {}) : null })
									]);
								})
							]);
						})),
						state.status === "ready" && choices.length === 0 && React.createElement("div", { className: "msp_empty", children: t("empty.models") })
					]),
					pane === "effort" && React.createElement(React.Fragment, null, [
						state.error !== null && lastActionRef.current === "load" && React.createElement("div", { className: "msp_error" }, [
							React.createElement("span", { children: t("error.action", { message: state.error }) }),
							React.createElement("button", { type: "button", className: "msp_retry", onClick: reload, children: t("action.reload") })
						]),
						effortChoices.length === 0 ? React.createElement("div", { className: "msp_empty", children: t("empty.efforts") }) : effortChoices.map((level) => React.createElement("button", {
							key: level.key,
							ref: itemRef(),
							type: "button",
							role: "menuitemradio",
							"aria-checked": effectiveEffort === level.effort,
							className: "msp_option" + (effectiveEffort === level.effort ? " msp_selected" : ""),
							disabled: busy,
							onClick: () => {
								chooseEffort(level.effort);
							}
						}, [
							React.createElement("span", { className: "msp_optionCopy" }, [
								React.createElement("span", { className: "msp_modelName", children: level.label }),
								level.description !== undefined && React.createElement("span", { className: "msp_description", children: level.description })
							]),
							React.createElement("span", { className: "msp_check", children: effectiveEffort === level.effort ? React.createElement(Check, {}) : null })
						]))
					]),
					// 提供商面板:两个内部页(类别 → 模型+返回),底部锚定向上生长
					pane === "model" && flyoutGroup !== undefined && React.createElement("div", {
						ref: flyoutRef,
						className: "msp_flyout" + (flyoutSide === "left" ? " msp_flyoutLeft" : ""),
						role: "menu",
						"aria-label": flyoutGroup.name
					}, [
						flyoutPane === "cats" ? React.createElement(React.Fragment, null, [
							React.createElement("div", { className: "msp_flyoutTitle", children: flyoutGroup.name + " (" + String(flyoutGroup.models.length) + ")" }),
							categoryGroups.length > 1 ? React.createElement("div", { className: "msp_flyoutList scrollable" }, categoryGroups.map(([cat, catModels]) => React.createElement("button", {
								key: cat,
								ref: itemRef(),
								type: "button",
								role: "menuitem",
								"aria-haspopup": "menu",
								className: "msp_flyoutCatRow",
								onClick: () => {
									openCategory(cat);
								}
							}, [
								React.createElement("span", { className: "msp_flyoutCatRowName", children: t("cat." + cat) }),
								React.createElement("span", { className: "msp_flyoutCatRowCount", children: String(catModels.length) }),
								React.createElement("span", { className: "msp_cellChevron", children: React.createElement(ChevronRight, {}) })
							]))) : React.createElement("div", { className: "msp_flyoutList scrollable" }, categoryGroups[0] ? categoryGroups[0][1].map((model) => {
								const selected = state.current && state.current.provider === flyoutGroup.id && state.current.model === model.id;
								return React.createElement("button", {
									key: model.id,
									ref: itemRef(),
									type: "button",
									role: "menuitemradio",
									"aria-checked": selected,
									className: "msp_option" + (selected ? " msp_selected" : ""),
									title: model.name,
									disabled: busy,
									onClick: () => {
										choose({ provider: flyoutGroup.id, model: model.id });
									}
								}, [
									React.createElement("span", { className: "msp_optionCopy" }, [
										React.createElement("span", { className: "msp_modelName", children: model.name }),
										model.description !== undefined && React.createElement("span", { className: "msp_description", children: model.description })
									]),
									React.createElement("span", { className: "msp_check", children: selected ? React.createElement(Check, {}) : null })
								]);
							}) : null)
						]) : React.createElement(React.Fragment, null, [
							React.createElement("button", {
								ref: itemRef(),
								type: "button",
								role: "menuitem",
								className: "msp_flyoutBack",
								onClick: () => {
									setFlyoutPane("cats");
									setActiveCategory(null);
								}
							}, [
								React.createElement("span", { className: "msp_cellChevron", children: React.createElement(ChevronLeft, {}) }),
								React.createElement("span", { children: t("back") })
							]),
							React.createElement("div", { className: "msp_flyoutTitle", children: t("cat." + activeCategory) + " (" + String(activeCategoryModels ? activeCategoryModels.length : 0) + ")" }),
							React.createElement("div", { className: "msp_flyoutList scrollable" }, activeCategoryModels ? activeCategoryModels.map((model) => {
								const selected = state.current && state.current.provider === flyoutGroup.id && state.current.model === model.id;
								return React.createElement("button", {
									key: model.id,
									ref: itemRef(),
									type: "button",
									role: "menuitemradio",
									"aria-checked": selected,
									className: "msp_option" + (selected ? " msp_selected" : ""),
									title: model.name,
									disabled: busy,
									onClick: () => {
										choose({ provider: flyoutGroup.id, model: model.id });
									}
								}, [
									React.createElement("span", { className: "msp_optionCopy" }, [
										React.createElement("span", { className: "msp_modelName", children: model.name }),
										model.description !== undefined && React.createElement("span", { className: "msp_description", children: model.description })
									]),
									React.createElement("span", { className: "msp_check", children: selected ? React.createElement(Check, {}) : null })
								]);
							}) : null)
						])
					])
				]),
				toast !== null && React.createElement("div", { key: toast.seq, className: "msp_toast", role: "status" }, [
					React.createElement("span", { className: "msp_cellChevron", children: React.createElement(Warn, {}) }),
					React.createElement("span", { children: toast.text })
				])
			]);
		}

		function apply(ctx) {
			const slots = ctx.get("slots");
			const models = ctx.get("modelDirectories");
			const sessions = ctx.get("sessions");
			const locale = ctx.get("locale");
			if (slots === undefined || models === undefined || sessions === undefined || locale === undefined) return;
			localeRef = locale;
			slots.inject("conversation.input.model", () => slots.register({
				name: "conversation.input.model",
				priority: -1,
				inject: (sessionId) => {
					const directory = models.directoryFor(sessionId);
					const available = sessions.subagentAddress(sessionId) === undefined;
					return {
						available,
						directory: directory.store,
						load: () => {
							if (available) directory.load().catch(() => {});
						},
						select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
					};
				}
			}, ModelSelectWithProvider));
		}
		exports.apply = apply;
		exports.inject = ["slots", "locale", "sessions", "modelDirectories"];
		return module.exports;
	}
});
