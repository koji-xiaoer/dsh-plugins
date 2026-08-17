# 移植规格：费用预估与账单明细（dsh-client-ui-conversation 补丁 → Cordis 动态插件）

> 依据文件：`/home/claude/dsh-plugins/增强主页类/dsh-mods/features/费用预估与账单明细/dsh-client-ui-conversation.patch`
> 该补丁是 `@deepseek-ai/dsh-client-ui-conversation/lib/client.js` 编译产物的统一 diff（197KB / 3085 行）。
> 以下 `+` 行为补丁新增实现，无前缀行为原版上下文（用于定位挂接点）。所有行号均为补丁文件行号。
> 服务端对应能力（`session.cost` / `session.costDetail` / `host.balance` / `session.history(usageOnly)`）已存在于本部署
> `dsh-host-apiproxy`（`node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js`），
> 本规格第 2/8 节给出其精确 schema，供插件 Host 侧 `harness.handle` 实现参考。

---

## 0. 补丁总览（改动区域索引）

| 补丁行区间 | 内容 | 性质 |
|---|---|---|
| 2357–2420（@@ -2357,6 +2357,64 @@） | `DEFAULT_COST_ESTIMATE`、`CostEstimateSettings` 类、`costEstimateSettings` 单例、`useCostEstimateConfig` hook | 新增 |
| 2845–2971（@@ -2787,6 +2845,111 @@） | 计价核心：`ESTIMATED_PRICES`、`pricingPeriod`、`estimatedPriceSet`、`lastActivityTime`、`formatPrice`、`resolvePrice`、`estimateCost`、`formatYuan` | 新增 |
| 2972–3052 | `StatsLine`（会话统计栏）改造：接 `tokenUsageByModel` + 预估费用行 + 模型明细 tooltip | 修改（+ 行） |
| 3267–3318 | `CostMeter.module.css`（css$22, tagId `CostMeter.module.css`） | 新增 |
| 3318–3491（@@ -3058,6 +3267,1650 @@） | `COST_METER_ROWS`、`collectCostBuckets`、`CostMeter` 组件 | 新增 |
| 3492–3560 | `BillingView.module.css`（css$23, tagId `BillingView.module.css`） | 新增 |
| 3560–3954 | `shortSessionId`、`billingModelColor`、`billingModelColorValue`、`BillingView` 组件（含 drill 下钻） | 新增 |
| 3955–4020 | `SessionBill.module.css`（css$24）、`BillingTabs.module.css`（css$25） | 新增 |
| 4021–4100 | `CostCharts.module.css?v4`（css$26, tagId 带 `?v4`） | 新增 |
| 4100–4290 | `COST_DONUT_RADIUS`、`CostTurnChart`、`CostDonut`、`CostDayChart` | 新增 |
| 4290–4890 | `foldTurnCosts`、`foldCallLedger`、`fetchUsageEntries`、`SessionBillView`、`SettingsBillingSection` | 新增 |
| 5712–5717（@@ -3859,6 +5712,11 @@） | `CostMeter` 挂入 `InputBar` trailing 行（`ContextMeter` 之后、interrupt 停止按钮之前） | 挂接 |
| 5873–8547（@@ -4015,6 +5873,674 @@） | `CostPanel.module.css?v4`（css$21）、`COST_EDIT_MODELS`、`COST_PRICE_KEYS`、`costPeriodKey`、`CostEstimateRow`；`dsh-notify` 段：`readNotify*`/`writeNotify*`、`playPreviewSound`、`schedulePreview`、`NotifyRow` | 新增 |
| 7432–7441（@@ -4906,8 +7432,10 @@） | image-relay 小改：`b.hidden === true` 的文本块不渲染 | 修改 |
| 7698–7713 | `ChatView.module.css` 追加 `foldGroup/foldBar/foldChevron/foldChevronOpen/foldText/foldBody` | 修改（- 行重写整条 css$11） |
| 7774–7833 | `FoldReplyPreview`（memo 组件） | 新增 |
| 7878–7996 | `FOLD_LEVEL2_KINDS`、`foldGroups`、`foldSummary`、`ChatView` 折叠改造 | 新增 |
| 8094–8155 | `renderSeat`、`renderFoldGroup`、`order.map` → `groups.map` | 修改（- 行删除原 map） |
| 8463–8555 | zh 字典新增键 | 新增 |
| 8728–8850 | en 字典新增键 | 新增 |
| 12296–12317（@@ -9460,6 +12296,7 @@） | `apply()` 内 `const connection = ctx.get("connection");` | 修改 |
| 12318–12367 | `costEstimateSettings` 实例化 + 4 处 Slot 注册（settings.general.item×2、conversation.view、settings.section） | 新增 |

---

## 1. 组件清单

### 1.1 CostEstimateSettings（状态类，非 UI）+ useCostEstimateConfig

- **作用**：会话统计栏费用预估的开关与自定义价表（`enabled` + 按模型按桶的 `prices`）的持久化状态。模式完全镜像原版 `ComposerSubmissionPolicy`（持久 scope + snapshot store + 实时 adopt）。
- **默认值**：`DEFAULT_COST_ESTIMATE = { enabled: true, prices: void 0 }`；`prices` 未编辑前保持 `undefined`，内置峰谷价表保持权威。
- **实现**：
  ```js
  var CostEstimateSettings = class {
    store = createSnapshotStore(DEFAULT_COST_ESTIMATE);
    constructor(host) { if (host) { host.subscribe(() => this.adopt(host)); this.adopt(host); } }
    adopt(host) { // 从 settings 快照 section.costEstimate?.enabled / .prices 合并进 store
      const section = host.getSnapshot().value;
      const next = { enabled: typeof section.costEstimate?.enabled === "boolean" ? section.costEstimate.enabled : current.enabled,
                     prices: section.costEstimate?.prices ?? current.prices };
      if (next.enabled !== current.enabled || next.prices !== current.prices) this.store.set(next);
    }
    setEnabled(enabled) { this.store.set({...current, enabled}); this.host?.set("costEstimate", {...current, enabled}); }
    setPrice(model, key, value) { /* prices[model][key]=value; store.set; host?.set("costEstimate", {...current, prices}) */ }
  };
  let costEstimateSettings = null; // 模块级单例,apply() 里赋值,未激活前为 null
  function useCostEstimateConfig() {
    return useSyncExternalStore(
      (listener) => costEstimateSettings === null ? () => {} : costEstimateSettings.store.subscribe(listener),
      () => costEstimateSettings === null ? DEFAULT_COST_ESTIMATE : costEstimateSettings.store.getSnapshot());
  }
  ```
- **挂接**：apply() 中 `costEstimateSettings = new CostEstimateSettings(ctx.settingsScope.bind({ namespace: CONVERSATION_SETTINGS_NAMESPACE }))`；`CONVERSATION_SETTINGS_NAMESPACE = "ui-conversation"`（原版常量，见 orig 文件 2288 行）。
- **持久化**：`host.set("costEstimate", {...})` → `~/.dsh/settings.yaml` 的 `ui-conversation.costEstimate`（见第 4 节）。

### 1.2 计价辅助函数（模块级纯函数，见第 3 节）

`ESTIMATED_PRICES` / `ESTIMATED_FALLBACK_MODEL` / `PEAK_PRICE_SINCE` / `pricingPeriod(now)` / `estimatedPriceSet(model, now)` / `lastActivityTime(timeline)` / `formatPrice(price)` / `resolvePrice(model, now, customPrices)` / `estimateCost(buckets, model, now, customPrices)` / `formatYuan(value)`。

### 1.3 StatsLine（原版会话统计栏，被修改）

- **位置**：会话头部统计行（`groups.join(" | ")` 渲染的 token/耗时统计）。
- **改动**：
  - 新增读取：`timeline = useSession((s) => s.chat.timeline)`、`usageByModel = useProjection("tokenUsageByModel")`、`costCfg = useCostEstimateConfig()`。
  - `const now = lastActivityTime(timeline);`（**计价参考时刻 = 会话最近一次请求时刻**，历史会话不再按打开当下时刻重估峰谷）。
  - 费用汇总：`costCfg.enabled` 时，优先遍历 `Object.keys(usageByModel)` 逐模型 `estimateCost(...)` 累加（`c > 0` 才算）；否则回退 `estimateCost(usage, null, now, prices)`（条件 `billedInputTokens(usage) > 0 || usage.outputTokens > 0`）。
  - `estimatedCost > 0` 时 `groups.push(t("stats.cost", { cost: formatYuan(estimatedCost) }))`。
  - `modelLines`：每个有正费用的模型一行 `t("stats.costModel", { model, input, read, output, cost })`，其中 `input = uncachedInputTokens + cacheWriteTokens`。
  - Tooltip：`label` 从字符串改为 JSX（`line` + 缩进的 `modelLines` 列表）；`disabled: !truncated && modelLines.length === 0`。
- **数据字段**：`s.chat.legacy.nodes`（原统计）、`s.chat.timeline`、projection `tokenUsage` / `tokenUsageByModel` / `sessionStats`。

### 1.4 CostMeter（输入栏 ¥ 触发器 + 费用面板）

- **作用**：会话统计栏旁的轻量费用仪表。触发按钮显示 `¥{total}`（glyph 用 `formatYuan(...).slice(1)` 去 ¥ 再拼 ¥），点击展开费用构成面板。
- **渲染位置**：`InputBar` 组件的 trailing 行（`InputBar_module_css_default.trailing`），紧跟 `ContextMeter`（token 计量器）之后、`interruptible` 停止按钮之前（原版 3859 行上下文）。
- **props**：`{ useProjection, useSession, t }`。
- **数据**：`useProjection("tokenUsage")`、`useProjection("tokenUsageByModel")`、`useSession((s) => s.chat.timeline)`、`useCostEstimateConfig()`。
- **核心逻辑** `collectCostBuckets(usage, usageByModel, now, customPrices)`：
  - 优先 per-model：对每个模型 `price = resolvePrice(key, now, customPrices)`；`input = uncachedInputTokens + cacheWriteTokens`、`read = cacheReadTokens`、`output = outputTokens`；`u = input*price.cacheMiss/1e6`、`r = read*price.cacheRead/1e6`、`o = output*price.output/1e6`；累加 `buckets.uncached/cacheRead/output`（金额）与 `tokensByBucket.*`（token 数）与 `tokens`；`models.push({model, cost: u+r+o})`；模型列表为空返回 null。
  - 回退：聚合 `usage` 按 fallback 模型价（`resolvePrice(null, now, customPrices)`）。
  - 返回 `{ uncached, cacheRead, output, tokens, tokensByBucket, total: 三者之和, models }`；无用量返回 null。
- **UI/交互**：
  - trigger：`span.ref=rootRef` > `Tooltip(label: t("cost.panelAria", {cost}), side:"top", delayMs:200, disabled:open)` > `button[aria-haspopup=dialog, aria-expanded=open]` > `span.glyph`。
  - panel（`role="dialog"`，`aria-label: t("cost.panelTitle")`）：header（headline 标题 + percent 总额 + figures `{tokens} tok`）；stacked bar（`COST_METER_ROWS` 三段，`width = bucket/total*100%`，仅 `>0` 段）；`dl.rows` 三行（swatch + `t(row.label)` + `dd`：`{formatTokens(tokensByBucket)} · {formatYuan(bucket)}`）；`models.length > 1` 时渲染 modelRows（model 名 + 金额）。
  - 外部 `pointerdown`（非 rootRef 内）或 `Escape` 关闭；`!available && open` 时自动关闭。
- **COST_METER_ROWS**（顺序即柱段/图例顺序）：
  ```js
  const COST_METER_ROWS = [
    { key: "uncached", label: "cost.uncached", color: colorUncached },
    { key: "cacheRead", label: "cost.cacheRead", color: colorCache },
    { key: "output",   label: "cost.output",   color: colorOutput }
  ];
  ```
  - 颜色：uncached → `var(--dsw-static-neutral-bluish-400)`；cacheRead → `var(--dsw-static-blue-450)`；output → `#a78bfa`（通过 `--meter-tint` 自定义属性注入，`segment`/`swatch` 用 `var(--meter-tint)`）。

### 1.5 CostEstimateRow（设置页"费用预估"卡片）

- **作用**：General 设置里启用/关闭统计栏费用预估、编辑两个模型的三档自定义价。
- **挂接**：`settings.general.item`，id `"cost-estimate"`，order 30（原版 `composer-enter` 为 order 20）。
- **inject**（由注册处提供）：`{ setEnabled, setPrice }`（透传 `costEstimateSettings.setEnabled/setPrice`）。
- **常量**：
  ```js
  const COST_EDIT_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];
  const COST_PRICE_KEYS = [
    ["cacheRead", "settings.cost.cacheRead"],
    ["cacheMiss", "settings.cost.cacheMiss"],
    ["output",    "settings.cost.output"]
  ];
  function costPeriodKey(period) {
    return period === "peak" ? "settings.cost.period.peak"
         : period === "offpeak" ? "settings.cost.period.offpeak"
         : "settings.cost.period.standard";
  }
  ```
- **state**：`model`（默认 `COST_EDIT_MODELS[0]`）、`now`（每 60s `setInterval` 刷新，驱动峰谷时段实时变化）。
- **UI/交互**：
  - header：`EnterBehaviorRow` 的 rowText/title/desc 类（复用原版设置行标题样式）渲染 `settings.cost.title` / `settings.cost.description` + 开关（`settings.cost.enable`，`checked: config.enabled`，onChange → `setEnabled`）。
  - panel（`enabled ? "" : panelOff`，panelOff 半透明 + `pointer-events:none`）：
    - toolbar：segmented 模型切换（`aria-pressed`，`segBtnActive` 高亮；`hasCustom(m)` 时显示 `segDot` 圆点标记）；`hasCustom(model)` 时显示 resetBtn（`IconRefreshOutline14` size 12 + `settings.cost.reset`，点击对三个 key 都 `setPrice(model, key, void 0)`）。
    - periodBar（`periodPeak`/`periodOffpeak`/`periodStandard` 配色类）：periodRow（periodDot 呼吸灯 + `settings.cost.period.now` + periodName）+ periodMeta（`period === "current" ? settings.cost.period.metaStandard : settings.cost.period.meta`）。
    - bucketList：每桶一行。`builtin = base[key]`（当前时段内置价）；input `type=number, step=any, min=0`，`value: customValue ?? ""`，`placeholder: formatPrice(builtin)`，title `settings.cost.builtinHint`（含时段名与内置价）；`onChange: raw === "" ? setPrice(model,key,void 0) : setPrice(model,key,Number(raw))`；有自定义值时显示 clearBtn（`IconCloseFill14`，title `settings.cost.clear`）；右侧 `unit`（`settings.cost.unit` = "¥/M"）与 `bucketHint`（`settings.cost.builtin` = "内置 ¥{price}"）。
    - footnote：`settings.cost.footnote`。
- **注意**：空白输入 = 使用内置价（保留占位符展示当前时段内置价）；自定义值一旦输入即为该模型该桶覆盖。

### 1.6 NotifyRow（设置页"会话完成提醒"卡片）⚠️ 可能与另一个补丁重复

- **作用**：会话完成提示音 + 动态网页标题两个开关；提示音可选手动 chime/bell/自定义音频（上传、拖放、音量、增益、试听）。
- **挂接**：`settings.general.item`，id `"notify"`，order 40，无 inject。
- **持久化**：全部走 `localStorage`（键见第 4 节）——与 `CostEstimateSettings`（settings.yaml）不同。
- **state**：`sound`、`dynamicTitle`、`source`（chime|bell|custom）、`customData`（data URL）、`fileName`、`pickError`、`volume`、`gain`。
- **UI**：两张 `card` 结构：
  1. 提示音行：bell SVG icon + `settings.notify.sound/soundDesc` + 开关（写 `dsh.notify.sound`）。`sound` 开启时展开子面板：
     - segmented 音源（`settings.notify.sourceChime/sourceBell/sourceCustom`，点击写 `dsh.notify.sound.source`）+ 试听按钮（`settings.notify.customPreview`，直接 `playPreviewSound(source, customData, volume, gain)`）。
     - 音量滑杆（range 0–1 step .05，写 `dsh.notify.sound.volume`，onChange 触发 `schedulePreview` 250ms 防抖试听）+ `%` 显示。
     - 增益滑杆（range 1–3 step .05，写 `dsh.notify.sound.gain`）+ `%` 显示。
     - `source === "custom"` 时：pickBtn（label 支持 drag&drop，`data-active: customData !== null`，内嵌隐藏 `<input type=file accept=".mp3,.wav,.ogg,.webm,audio/*">`，FileReader.readAsDataURL）+ 移除按钮（`settings.notify.customRemove`）；footnote 显示文件名或 `settings.notify.customFormat` / `customTooLarge` / `customReadError`。
  2. 分隔线 `notifyDivider` + 动态标题行：`settings.notify.dynamicTitle/titleDesc` + 开关（写 `dsh.notify.title`）。
- **音频实现**：
  - `NOTIFY_MAX_BYTES = 1024 * 1024`（1MB 上限，超出报 `customTooLarge`）。
  - `playPreviewSound`：custom → `new Audio(data)`，`level = clamp(volume,0,1) * clamp(gain,1,3)`；`level <= 1` 直接 `audio.volume=level; audio.play()`，否则 `playPreviewBoosted`（`AudioContext` + `createMediaElementSource` + GainNode）。
  - chime 音符：`[[659.25, 0, 0.45], [880, 0.28, 0.8]]`，sine；bell 音符：`[[880, 0, 0.35], [1318.51, 0.18, 0.55]]`，triangle；用 `exponentialRampToValueAtTime(0.12*level, ...)` 包络，2 秒后 `audio.close()`。
  - `schedulePreview` 防抖 250ms（拖滑杆时自动试听）。

### 1.7 BillingView（总账单：全会话费用表 + 会话下钻明细）

- **作用**：设置面板中的全量账单：顶部汇总卡（总额/会话数/总 token/账户余额）、模型占比条 + 图例、按日柱状图、三个 tab（按会话/按模型/按日期）表格；点行内"展开明细"下钻到该会话的逐轮/逐笔表。
- **props**：`{ api, t }`（`api = connection.api`）。
- **state**：`items`（session.list 结果）、`failed`、`tab`、`detail`（`{sessionId, title}`）、`detailData`、`detailBusy`、`detailError`、`balance`、`openTurns`（Set，逐轮折叠）、`costData`（session.cost 结果）。
- **轮询（3 个独立 effect，均 5s）**：
  ```js
  api.sessions.list({})  → setItems(result.value.items ?? [])     // 行数据
  api.host.balance({})   → setBalance(bal.value)                   // 余额(totalBalance)
  api.sessions.cost({})  → setCostData(result.value)               // 服务端费用聚合
  ```
- **行合并（rows memo）**：每行 `p = item.projections?.values`；`usage = p?.tokenUsage`、`usageByModel = p?.tokenUsageByModel`、`stats = p?.sessionStats`。
  - 金额优先取服务端 `costMap.get(item.sessionId)`（`fold.cost`、`fold.input + fold.write`、`fold.output`）；服务端缺该会话时回退投影估算（`estimateCost`，参考时刻 `rowNow = item.updatedAt > 0 ? item.updatedAt : Date.now()`）。
  - 行字段：`{ sessionId, updatedAt, parentSessionId, origin, title: p?.title || void 0, usage, usageByModel, cost, input, output, turns: stats?.turns, steps: stats?.steps, subCost: 0, subCount: 0 }`；`sort((a,b) => b.updatedAt - a.updatedAt)`。
  - **子代理折叠**：`origin === "subagent" && parentSessionId` 的行把 `cost` 累进父行 `subCost`（`subCount` 计数），并 `mainRows = rows.filter(r => r.origin !== "subagent")`。
  - 汇总：`totalCost / totalInput / totalOutput / withUsage`（cost>0 的行数）；`byModel`/`byDay` 来自服务端 `fold.byModel[model].cost/sessions/input+write/output` 与 `fold.byDay[day].cost/input+write/output`（注释：与明细同口径、按请求时刻与请求日）。
- **渲染**：
  - 失败 → `billing.error: {failed}`；rows null → `billing.loading`；mainRows 空 → `billing.empty`。
  - 汇总卡：`summaryTotal = formatYuan(totalCost)`、`billing.sessions {count, withUsage}`、`billing.totalTokens {input, output}`、`balance !== null` 时 `billing.balance {balance}`；模型占比条（`billingModelColor` 段）+ 图例（>1 模型时）；`dayEntries.length > 0` 时 `CostDayChart(entries: [...dayEntries].reverse().map(([day,e]) => [day, e.cost]), color: "var(--dsw-alias-label-tertiary)")`。
  - tab 按钮（`BillingTabs` 的 tab/tabActive）：`billing.tab.sessions/models/days`。
  - sessions 表列：`billing.col.session/updated/rounds/input/output/cost` + 空列（drill 按钮）；行显示 `title ?? shortSessionId(sessionId)`（title 属性含 "title (sessionId)"）、`formatMessageClock(updatedAt, t)`、`turns · steps`（缺则 `—`）、input/output token、cost（`subCost > 0` 时 `formatYuan(cost) + t("billing.attrSub", {cost})`）；行尾 `billing.drill` 按钮 → `setDetail({sessionId, title})`。
  - models 表列：model / `billing.col.usage`（sessions 数）/ uncached / output / cost。days 表列：day / usage / input / output / cost。每个 tab 表尾 `totalRow`（`billing.total`）。
- **下钻明细（detail 视图）**：
  - `detail !== null` 时整体替换为：返回按钮（`← billing.back`，`setDetail(null)`）+ 标题 + `detailBusy`/`detailError`/`detailData`。
  - effect（deps `[detail, api, costCfg.prices]`）：`fetchUsageEntries(api, detail.sessionId)` → `foldTurnCosts(allEntries, foldNow, prices)` + `foldCallLedger(allEntries, foldNow, prices)`；`capped === true` 显示 `billing.partial` 横幅。**明细按打开时点拉取一次（冻结），不随轮询刷新**。
  - 轮次表（`billing.col.turns`）：列 turn/model/steps/uncached/read/output/cost + chevron 列。行点击 `toggleTurn(line.turn)`；展开行 `colSpan=8` 内嵌逐笔表（`billing.col.time/step/model` + uncached/read/**write**/output/cost），行数据 `calls.filter(call => call.turn === line.turn)`。此视图**不分页**（整表渲染）。
- **辅助**：`shortSessionId(id)`：`id.length > 12 ? id.slice(0,4) + "…" + id.slice(-4) : id`；`billingModelColor(model)`：flash → colorFlash、pro → colorPro、其他 → colorOther。

### 1.8 SessionBillView（会话视图"账单"页：单会话账单 + 图表 + 分页明细）

- **挂接**：`conversation.view`，id `"billing"`，order 20，`label: () => t("view.billing")`（会话 Tab 名"账单"）。`inject: (sessionId) => ({ api: connection.api, t, sessionId })`。
- **props**：`{ api, sessionId, t }`。
- **轮询/重折叠（5s）**：
  ```js
  api.sessions.list({}) → find(item.sessionId === sessionId) → setRow
  if (found.updatedAt !== lastFoldedAtRef.current) { lastFoldedAtRef.current = found.updatedAt; await refold(); }
  refold(): fetchUsageEntries(api, sessionId) → setTurns(foldTurnCosts(...)), setCalls(foldCallLedger(...)), setCapped
  ```
  - **只有 updatedAt 变化（有新活动）才重拉明细重折叠**；不活跃会话不重复拉历史。
- **summary 金额口径**：优先逐笔折叠（`calls` 求和，按请求时刻计价）；折叠未就绪或明细为空时回退投影估算（`usageByModel` → 逐模型 `estimateCost(buckets, key, now, prices)`；否则聚合 `usage` 按 `resolvePrice(null, now, prices)` 手算），参考时刻 `now = row?.updatedAt > 0 ? row.updatedAt : new Date()`。
- **其他统计**：`totalInput = billedInputTokens(usage)`、`totalOutput = usage.outputTokens`、`cacheHit = usage.cacheReadTokens / totalInput * 100`（totalInput>0 时，round）、`bucketCost`（三桶金额）、`modelEntries`（按模型聚合，`sort((a,b) => (b.cost ?? 0) - (a.cost ?? 0))`）。
- **渲染顺序**：
  1. header：`billing.currentTitle` + meta（`p?.title || shortSessionId(sessionId)` · `formatMessageClock(row.updatedAt, t)`）。
  2. `capped` → `billing.partial`。
  3. summary 卡：总额 + `billing.totalTokens` + `cacheHit !== null` 时 `billing.cacheHit {percent}` + `stats.llmMs > 0 || stats.toolMs > 0` 时 `billing.timeStats {llm: formatDuration(stats.llmMs), tool: formatDuration(stats.toolMs)}`。
  4. 模型占比条 + 图例。
  5. `billing.bucketTitle` + `CostDonut`（segments：uncached=neutral-bluish-400 / cacheRead=blue-450 / output=#a78bfa，`total: totalCost`）。
  6. `billing.turnBars` + `CostTurnChart`（rows：`turns.map(line => ({ key: line.turn, label: `#${line.turn}`, value: line.cost, color: billingModelColorValue(line.model), tip: `${line.model} · ${line.steps}步 · ${formatYuan(line.cost)}` }))`）。
  7. 按模型表（`billing.col.model` + uncached/read/write/output/cost）：`modelEntries.length === 0 && usage` 时补一行 fallback 模型（`ESTIMATED_FALLBACK_MODEL`）合计；表尾 totalRow。
  8. `bucketCost !== null` 时桶金额表（`billing.bucketTitle` + cost 列，行用 `COST_METER_ROWS`）。
  9. 轮次表（`billing.col.turns`）：`turnSlice`（**每页 10 行**，`TURN_PAGE_SIZE = 10`），合计行恒为**全量**统计（`turns.reduce(...)`）；超过一页显示分页条（`turnPrev/turnPage/turnNext`，`turnCur = min(turnPage, turnTotal-1)`）。
  10. 逐笔表（`billing.callsTitle`）：`callSlice`（**每页 10 行**，`CALL_PAGE_SIZE = 10`），合计行显示在**表尾**（全量 `calls.reduce(...)`）；超过一页显示分页条。
- **状态分支**：failed → error；row null → loading；`usage === void 0 && usageByModel === void 0` → `billing.currentTitle` + `billing.noUsage`。

### 1.9 图表组件

**CostTurnChart（每轮费用柱状图）** — props `{ rows, t, pageSize = 10 }`，rows 元素 `{ key, label, value, color?, tip }`：
- 自适应列数：`pitch = 34 + 34/3`（柱宽 34px + 间隔 1/3 柱宽）；`effPageSize = fit > 0 ? Math.max(4, Math.min(40, Math.round((fit - 80) / pitch))) : pageSize`（两侧各留 ~40px）。
- 分页：`total = max(1, ceil(len/effPageSize))`、`cur = min(page, total-1)`、`slice = ordered.slice(cur*effPageSize, ...)`；`slice.length === 0` 返回 null；`ordered = rows`（**保持轮次顺序，不排序**——注意与 README 描述相反，见第 9 节）。
- **柱高（本补丁代码：自适应线性刻度）**：
  ```js
  const max  = slice.reduce((m, r) => Math.max(m, Math.max(0, r.value)), 0);
  const pos  = slice.map((r) => Math.max(0, r.value)).filter((v) => v > 0);
  const valMin = pos.length > 0 ? Math.min(...pos) : 0;
  const valMax = pos.length > 0 ? Math.max(...pos) : 0;
  const ratio  = valMin > 0 ? valMax / valMin : Infinity;
  const yMin = ratio <= 5 ? valMin * 0.95 : 0;   // 接近时锚定 [min*0.95, max*1.05] 拉开差异
  const yMax = ratio <= 5 ? valMax * 1.05 : valMax;
  const span = yMax - yMin;
  const barHeight = (v) => {
    if (max <= 0) return 0;
    if (!(v > 0)) return 2;                      // 零费用柱保留 2% 底座
    if (span <= 0) return 100;
    return Math.max(0, Math.min(100, (v - yMin) / span * 100));
  };
  ```
- 渲染：`div.turnChart`（height 150px、`gap: calc(var(--turn-bar-w,34px)/3)`、居中、flex-end）内每列 `div.turnCol`（width `var(--turn-bar-w,34px)`，`title={r.tip}` 原生 tooltip）依次为：`span.turnValue`（`formatYuan(r.value)`，柱顶金额）、`div.turnBarTrack > div.turnBarFill`（`height: barHeight%`，`style["--chart-color"] = r.color` 注入柱色）、`span.turnLabel`（`r.label`，如 `#3`）。图下刻度说明 `div.turnPager > span.turnPagerInfo`（`billing.turnScale`）；超一页时同容器渲染分页条（上/下一页按钮 + `billing.turnPage {page,total}`）。
- 容器宽度监听：`ResizeObserver`（不可用时退化 `window.resize`），deps `[rows.length]`。

**CostDonut（费用构成环图）** — props `{ segments: [{key, label, color, value}], total, t }`：
- `COST_DONUT_RADIUS = 28`；`dash = frac * C`、`offset = -acc * C`（`C = 2π*28`）；`svg viewBox="0 0 64 64" width/height 96`，circle `fill:none stroke={color} stroke-width=9 transform="rotate(-90 32 32)"`；中心 `donutCenter` = `formatYuan(total)`；右侧图例每项 `donutSwatch`（`--chart-color`）+ label + `{formatYuan(value)} · {round(value/total*100)}%`。全部段 value<=0 时返回 null。

**CostDayChart（按日柱状图）** — props `{ entries: [[day, value]], color }`：`max` 归一化 `dayBarFill height = value/max*100%`（`--chart-color`）；`dayLabel = day.slice(5)`（去掉 "YYYY-" 前缀，显示 MM-DD）；`title = ${day} · ${formatYuan(value)}`；列按 oldest-first 传入。

### 1.10 ChatView 折叠（FoldReplyPreview + 折叠分组）

- **FoldReplyPreview**（memo）：props `{ nodeKey, useSession, loadImage, fileMentions, t }`。`node = useSession(s => s.chat.nodes.get(nodeKey))`；`node.kind !== "assistant-step"` 返回 null；`blocks = node.data.blocks.filter(b => b.kind !== "reasoning")`（**只预览最终回复的文本块，推理折叠**）；渲染 `<AssistantMarkdown blocks streaming={false} interrupted={node.data.status === "interrupted"} loadImage mentions={void 0} t />`。
- **FOLD_LEVEL2_KINDS**：`new Set(["assistant-step", "tool-call", "tool-result", "model-retry", "turn-tail", "turn-error", "turn-max-tokens"])`。
- **foldGroups(order, nodeStore)**：以非 level2 kind 的节点（用户消息等）为锚点分组；若开头就是 level2 节点则进 `{ key: null, children: [...] }` 组。
- **foldSummary(children, nodeStore, t, previewKey)**：统计组内（排除 previewKey）各 kind 数量，文案 `labelOf(kind)`：assistant-step→`chat.fold.reply`、tool-call→`chat.fold.tool`、tool-result→`chat.fold.result`、model-retry→`chat.fold.retry`、turn-tail→`chat.fold.tail`、turn-error/turn-max-tokens→`chat.fold.error`；`parts.join(" · ")`。
- **ChatView 改造**：
  - `groups = useMemo(() => foldGroups(order, nodeStore), [order, nodeStore])`；`foldOpenKeys`（Set）；`lastGroupKey`（**最后一组永远展开**）；`isFoldOpen = key===null || key===lastGroupKey || foldOpenKeys.has(key)`。
  - `renderSeat(nodeKey)` = 原 `ChatNodeSeat` JSX。
  - `renderFoldGroup(group)`：`div.flowItem[data-chat-fold-group={group.key}]` > 锚点 `renderSeat(group.key)` + 折叠条 `button.foldBar`（`aria-expanded`，`aria-label` 用 `chat.fold.toggleOpen/toggleClose`，点击 `toggleFold`；内含 `span.foldChevron`（`IconChevronDownOutline14`，open 时加 `foldChevronOpen`）+ `span.foldText`（foldSummary））+ 展开时 `div.foldBody > children.map(renderSeat)` / 折叠时 `previewKey !== null` 渲染 `FoldReplyPreview`。
  - `lastReplyKey(children)`：组内最后一个 kind==="assistant-step" 的 key（作为折叠预览）。
  - 原 `order.map((nodeKey) => <ChatNodeSeat .../>)` 被替换为 `groups.map((group) => group.key === null ? group.children.map(renderSeat) : renderFoldGroup(group))`。

### 1.11 其他小改动

- **image-relay-patch**（7432 行）：`content` 循环中 `if (b.type === "text" && typeof b.text === "string")` 改为 `if (b.hidden !== true) texts.push(b.text)`——隐藏标记的文本块（图片的 GLM 描述）不渲染。
- **apply()**：新增 `const connection = ctx.get("connection");`（`connection.api` 供账单组件使用）。

---

## 2. 数据来源

### 2.1 conversation 视图 store（useSession 选择器）

| 字段 | 用途 | 出处 |
|---|---|---|
| `s.chat.timeline`（`timeline.turns` 为 **Map**） | 计价参考时刻：遍历 `turn.start?.time` / `turn.end?.time` 取最大 | `lastActivityTime(timeline)`（补丁 2958–2971） |
| `s.chat.nodes`（Map nodeKey→node） | `node.kind`（`"assistant-step"` 等）、`node.anchorSeq`、`node.data.blocks` / `node.data.status`（`"interrupted"`）、`node.data.message` | ChatView / FoldReplyPreview |
| `s.chat.order`（数组） | 折叠分组遍历顺序 | foldGroups |
| `s.chat.legacy.nodes` | StatsLine 原统计（`deriveStats` 回退） | 原版 |

### 2.2 Projection（useProjection）

| Projection 名 | 字段 |
|---|---|
| `"tokenUsage"` | `uncachedInputTokens`、`cacheReadTokens`、`cacheWriteTokens`、`outputTokens` |
| `"tokenUsageByModel"` | 对象：model 名 → 同上四个桶字段 |
| `"sessionStats"` | `turns`、`steps`、`llmMs`、`toolMs`（原版 `deriveStats` 产出，`billing.timeStats` 用） |

### 2.3 session.list 投影行（`item.projections?.values`）

`BillingView`/`SessionBillView` 从 `api.sessions.list({})` 的 `result.value.items[]` 读取：`sessionId`、`updatedAt`（ms）、`parentSessionId`、`origin`（`"subagent"` 判定）、`projections.values.tokenUsage / tokenUsageByModel / sessionStats / title`。

### 2.4 RPC（`connection.api`，Host 侧需实现或已由部署提供）

| 方法 | 请求 | 响应（本补丁消费的字段） |
|---|---|---|
| `api.sessions.list({})` | 空 | `{ok, value: {items: [...]}}`（见 2.3） |
| `api.sessions.history({sessionId, maxMessages: 100, usageOnly: true, beforeSeq?})` | `beforeSeq`/`maxMessages`/`usageOnly` 可选 | `{ok, value: {events: [{event: {...}, view: ...}], hasMore}}`；服务端 `usageOnly === true` 时**只返回 `event.type === "assistant/message" && event.data?.usage !== void 0` 的样本**（host-apiproxy 3086 行） |
| `api.sessions.cost({})` | `sessionIds?`、`prices?`（自定义价表覆盖） | `{ok, value: {prices: ESTIMATED_PRICES, totals, byModel, byDay, items}}`；`items[]`：`{sessionId, updatedAt, cost, input, read, write, output, byModel: {model: {cost,input,read,write,output}}, byDay: {day: {...}}}`（host-apiproxy 505–531 行 schema）；服务端按 `(updatedAt, 价表)` 缓存、按请求时刻计价、不活跃会话零成本。**本补丁客户端只消费 `items`，且未传 `prices`**（见第 9 节注意） |
| `api.host.balance({})` | 空对象 | `{ok, value: {isAvailable, currency, totalBalance, grantedBalance, toppedUpBalance}}`（host-apiproxy 3895–3925 行：请求 `https://api.deepseek.com/user/balance`，读 `balance_infos[0]`） |

### 2.5 明细折叠（fetchUsageEntries + foldTurnCosts + foldCallLedger）

- `fetchUsageEntries(api, sessionId)`（补丁 4376–4391 行）：
  ```js
  while (page < 60) {
    const r = await api.sessions.history({ sessionId, maxMessages: 100, usageOnly: true, ...(beforeSeq === void 0 ? {} : { beforeSeq }) });
    if (!result.ok) return { entries: allEntries, error, capped: false };
    for (const e of result.value.events) allEntries.push(e);
    if (allEntries.length >= 200000) return { entries, error: void 0, capped: true };
    if (!result.value.hasMore || result.value.events.length === 0) return { entries, error: void 0, capped: false };
    beforeSeq = result.value.events[0].event.seq;   // ← 取当前页最旧事件的 seq 向前翻页
  }
  return { entries: allEntries, error: void 0, capped: true };
  ```
  - 服务端 `paginate`（host-apiproxy 1205 行）：`window = events.filter(e => e.seq < beforeSeq)`，从尾部倒计 `maxMessages` 条 message 边界，返回页内**按 seq 升序**（页内最旧在前），故 `events[0].event.seq` 即本页最旧事件，`beforeSeq` 取它即可继续向前翻更早历史。上限：60 页 × 100 条 = 6000 条、硬上限 200000 条。
- `foldTurnCosts(entries, now, customPrices)`（4293–4332 行）：只收 `event.type === "assistant/message" && event.data?.usage !== void 0`；每笔 `buckets = { uncachedInputTokens: usage.inputTokens ?? 0, outputTokens, cacheReadTokens, cacheWriteTokens }`；`model = event.data.message?.source?.model`；**计价时刻 `at = typeof event.time === "number" && event.time > 0 ? event.time : now`（逐笔按请求时刻判定峰谷）**；`cost = estimateCost(buckets, model, at, customPrices) ?? 0`；按 `turn` 聚合 `{turn, steps: +1, input, read, write, output, cost, model: model ?? ESTIMATED_FALLBACK_MODEL}`；返回**按 turn 降序**。
- `foldCallLedger(entries, now, customPrices)`（4338–4367 行）：同一过滤与计价口径，每笔一行 `{time: event.time, turn, step, model, input, read, write, output, cost}`，时间顺序累加后 `calls.reverse()`（最新在前）。
- **事件字段**：`event.type`、`event.data.turn`、`event.data.step`、`event.data.usage.inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens`、`event.data.message?.source?.model`、`event.time`、`event.seq`。

---

## 3. 费用计算逻辑

### 3.1 ESTIMATED_PRICES 内置价表（元 / 百万 tokens）

```js
const ESTIMATED_PRICES = {
  "deepseek-v4-flash": {
    current: { cacheRead: 0.02,  cacheMiss: 1,    output: 2   },
    peak:    { cacheRead: 0.1,   cacheMiss: 3,    output: 9   },
    offpeak: { cacheRead: 0.05,  cacheMiss: 1.5,  output: 4.5 }
  },
  "deepseek-v4-pro": {
    current: { cacheRead: 0.025, cacheMiss: 3,    output: 6   },
    peak:    { cacheRead: 0.3,   cacheMiss: 9,    output: 27  },
    offpeak: { cacheRead: 0.15,  cacheMiss: 4.5,  output: 13.5 }
  }
};
const ESTIMATED_FALLBACK_MODEL = "deepseek-v4-flash";
const PEAK_PRICE_SINCE = Date.parse("2026-08-16T16:00:00Z");   // = 北京 2026-08-17 00:00
```
- 桶语义：`cacheRead` = 缓存命中输入；`cacheMiss` = 未命中输入（也覆盖缓存写入 cacheWrite）；`output` = 输出。
- 未知模型回退 v4-flash 表。

### 3.2 pricingPeriod 峰谷判定（北京时区）

```js
function pricingPeriod(now) {
  if (now < PEAK_PRICE_SINCE) return "current";   // 2026-08-17 00:00(北京)之前恒为 current
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric", hour12: false, timeZone: "Asia/Shanghai"
  }).format(now));
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18) ? "peak" : "offpeak";
}
```
- 峰时 09:00–12:00 / 14:00–18:00（北京时间），其余 offpeak；`hour` 可能为 "24"→Number 24 不会落入 9-12/14-18（安全）。

### 3.3 每轮/每笔费用计算

```js
function estimateCost(buckets, model, now, customPrices) {
  if (typeof buckets !== "object" || buckets === null) return null;
  const price = resolvePrice(model, now, customPrices);
  const input  = (buckets.uncachedInputTokens ?? 0) + (buckets.cacheWriteTokens ?? 0);
  const read   = buckets.cacheReadTokens ?? 0;
  const output = buckets.outputTokens ?? 0;
  return (input * price.cacheMiss + read * price.cacheRead + output * price.output) / 1e6;
}
function resolvePrice(model, now, customPrices) {
  const base = estimatedPriceSet(model, now);   // ESTIMATED_PRICES[model ?? flash][pricingPeriod(now)]
  const custom = customPrices?.[model];
  if (custom === void 0) return base;
  return { cacheRead: custom.cacheRead ?? base.cacheRead,
           cacheMiss: custom.cacheMiss ?? base.cacheMiss,
           output:    custom.output    ?? base.output };
}
```
- 计价参考时刻 `now` 的选取策略（三处不同）：
  1. **StatsLine / CostMeter（当前会话）**：`lastActivityTime(timeline)`——时间线最后一个 turn 的结束/开始时刻（`turn.end.time` 优先语义，usage 上报时刻）；无时间线回退 `Date.now()`。
  2. **BillingView 行回退 / SessionBillView summary 回退**：`item.updatedAt`（会话最后更新时间）。
  3. **逐笔/逐轮折叠**：每笔 `event.time`（`>0` 否则 `now`），与官方按请求时刻计费一致。
- 金额格式化 `formatYuan`：`!(value > 0) → "¥0"`；`< 0.01 → ¥{value.toFixed(4)}`；`< 1 → ¥{value.toFixed(3)}`；否则 `¥{value.toFixed(2)}`。`formatPrice`：`String(Number(price))`（无尾零）。

### 3.4 柱状图刻度

- **本补丁代码（CostTurnChart）**：自适应线性刻度，见 1.9 节公式。`ratio = max/min <= 5` 时锚定 `[min×0.95, max×1.05]`，否则 `[0, max]`；零值柱固定 2%；柱高 `clamp((v - yMin) / span * 100, 0, 100)`。刻度说明文案 `billing.turnScale`。
- **README 描述（更新版设计，补丁中未实现）**：对数刻度，锚定最小值：`height% = 2% + 98% · ln(v / min) / ln(max / min)`；柱子按费用降序排列（高→低阶梯，相同费用保持先后）。**移植时二选一，建议按 README 新版（对数刻度）实现**。

---

## 4. 设置持久化

### 4.1 settings.yaml（`~/.dsh/settings.yaml`）

- 命名空间：`ui-conversation`（`CONVERSATION_SETTINGS_NAMESPACE = "ui-conversation"`，orig 2288 行）。
- 字段（本补丁新增）：
  ```yaml
  ui-conversation:
    costEstimate:
      enabled: true            # 默认 true;缺失按 true 处理
      prices:                  # 未编辑时为 undefined/缺省
        deepseek-v4-flash:     # 模型名 → 桶覆盖;键缺失即用内置价
          cacheRead: 0.05
          cacheMiss: 1.5
          output: 4.5
        deepseek-v4-pro: { ... }
  ```
- 写入路径：`costEstimateSettings.setEnabled/setPrice` → `host.set("costEstimate", {...})`（settingsScope 快照合并）。读取路径：`adopt(host)` 从 `section.costEstimate?.enabled` / `?.prices` 合并。
- 同命名空间既有字段（勿覆盖）：`busyEnter`（原版 `ComposerSubmissionPolicy`）。

### 4.2 localStorage（仅 NotifyRow 使用）

| 键 | 取值 | 默认 |
|---|---|---|
| `dsh.notify.sound` | `"1"`/`"0"`（`readNotifyPref`：非 `"0"` 即 true） | true |
| `dsh.notify.title` | `"1"`/`"0"` | true |
| `dsh.notify.sound.source` | `"chime" \| "bell" \| "custom"`（未知回退 chime） | `"chime"` |
| `dsh.notify.sound.data` | 自定义音频 data URL（null 时 removeItem） | null |
| `dsh.notify.sound.name` | 上传文件名（"" 时 removeItem） | "" |
| `dsh.notify.sound.volume` | 0..1 数字字符串（clamp） | `0.8` |
| `dsh.notify.sound.gain` | 1..3 数字字符串（clamp） | `1` |

---

## 5. 字典键（zh / en）

> zh 字典（补丁 8463–8555 行区间新增），en 同键（8728–8850 行）。

| 键 | zh | en |
|---|---|---|
| `stats.cost` | 预估费用 {cost} | est. cost {cost} |
| `stats.costModel` | {model}：输入 {input} · 缓存 {read} · 输出 {output} · 约 {cost} | {model}: input {input} · cached {read} · output {output} · ≈{cost} |
| `cost.panelTitle` | 费用预估 | Estimated cost |
| `cost.panelAria` | 预估费用 {cost} | Estimated cost {cost} |
| `cost.uncached` | 输入（未命中） | Input (miss) |
| `cost.cacheRead` | 输入（缓存命中） | Input (cache read) |
| `cost.output` | 输出 | Output |
| `cost.write` | 缓存写入 | Cache write |
| `view.billing` | 账单 | Billing |
| `billing.nav` | 总账单 | Billing |
| `billing.title` | 费用账单 | Cost statement |
| `billing.subtitle` | 按会话汇总的预估费用（token 用量 × 价格表） | Estimated cost per session (token usage × price table) |
| `billing.col.session` | 会话 | Session |
| `billing.col.updated` | 更新时间 | Updated |
| `billing.col.rounds` | 轮次·步数 | Rounds·Steps |
| `billing.col.input` | 输入 | Input |
| `billing.col.output` | 输出 | Output |
| `billing.col.cost` | 预估费用 | Est. cost |
| `billing.col.model` | 模型 | Model |
| `billing.col.turn` | 轮次 | Turn |
| `billing.col.steps` | 步数 | Steps |
| `billing.col.time` | 时间 | Time |
| `billing.col.step` | 步 | Step |
| `billing.col.turns` | 轮次 | Rounds |
| `billing.col.usage` | 用量会话 | Usage sessions |
| `billing.total` | 合计 | Total |
| `billing.sessions` | {count} 个会话 · {withUsage} 个有用量 | {count} sessions · {withUsage} with usage |
| `billing.totalTokens` | 总输入 {input} · 总输出 {output} | Total input {input} · total output {output} |
| `billing.empty` | 暂无会话数据 | No session data yet |
| `billing.loading` | 加载中… | Loading… |
| `billing.error` | 账单加载失败 | Failed to load statement |
| `billing.noStats` | — | — |
| `billing.currentTitle` | 当前会话账单 | Current session statement |
| `billing.noUsage` | 该会话暂无用量记录 | No usage recorded for this session |
| `billing.cacheHit` | 缓存命中率 {percent}% | Cache hit {percent}% |
| `billing.timeStats` | LLM {llm} · 工具调用 {tool} | LLM {llm} · Tool {tool} |
| `billing.bucketTitle` | 费用构成 | Cost composition |
| `billing.tab.sessions` | 按会话 | By session |
| `billing.tab.models` | 按模型 | By model |
| `billing.tab.days` | 按日期 | By day |
| `billing.attrSub` | （含子代理 {cost}） | (incl. subagents {cost}) |
| `billing.drill` | 展开明细 | Expand detail |
| `billing.collapse` | 收起明细 | Collapse detail |
| `billing.callsTitle` | 逐笔明细 | Per-call detail |
| `billing.expandTurn` | 展开第 {turn} 轮明细 | Expand turn {turn} |
| `billing.collapseTurn` | 收起第 {turn} 轮明细 | Collapse turn {turn} |
| `billing.turnBars` | 每轮费用 | Cost per turn |
| `billing.turnScale` | 按轮次顺序 · 自适应刻度放大差异 · 悬停看明细 | In turn order · adaptive scale · hover for detail |
| `billing.turnPrev` | 上一页 | Prev |
| `billing.turnNext` | 下一页 | Next |
| `billing.turnPage` | 第 {page} / {total} 页 | Page {page} / {total} |
| `billing.partial` | 会话过大，仅显示最近活动明细（汇总为完整值） | Session too large — recent activity only (totals are complete) |
| `billing.closeLabel` | 关闭账单 | Close billing |
| `billing.back` | 返回账单 | Back to statement |
| `billing.balance` | 账户余额 {balance} | Account balance {balance} |
| `settings.cost.title` | 费用预估 | Cost estimate |
| `settings.cost.description` | 在会话统计栏显示预估费用；价格留空则用内置价（8/17 后按北京时区自动峰谷价） | Show an estimated cost in the conversation stats line; leave prices blank for built-in rates (auto peak/off-peak after Aug 17, Beijing time) |
| `settings.cost.enable` | 显示预估费用 | Show estimated cost |
| `settings.cost.cacheRead` | 缓存命中 | cache read |
| `settings.cost.cacheMiss` | 未命中 | cache miss |
| `settings.cost.output` | 输出 | output |
| `settings.cost.period.standard` | 标准价 | Standard rate |
| `settings.cost.period.peak` | 峰时价 | Peak rate |
| `settings.cost.period.offpeak` | 谷时价 | Off-peak rate |
| `settings.cost.period.now` | 当前适用： | Currently: |
| `settings.cost.period.meta` | 峰时 09:00–12:00 / 14:00–18:00（北京时间） | Peak 09:00–12:00 / 14:00–18:00 (Beijing time) |
| `settings.cost.period.metaStandard` | 8/17 起按北京时间自动切换峰谷价 | Auto peak/off-peak from Aug 17, Beijing time |
| `settings.cost.unit` | ¥/M | ¥/M |
| `settings.cost.builtinHint` | 内置价（{period}）：¥{price} / 百万 tokens | Built-in rate ({period}): ¥{price} per 1M tokens |
| `settings.cost.builtin` | 内置 ¥{price} | built-in ¥{price} |
| `settings.cost.reset` | 恢复内置价 | Reset to built-in |
| `settings.cost.clear` | 清除自定义价 | Clear custom price |
| `settings.cost.footnote` | 单位：元 / 百万 tokens；留空则使用内置价 | Unit: CNY per 1M tokens; blank = built-in rate |
| `settings.notify.title` | 会话完成提醒 | Session completion alerts |
| `settings.notify.description` | 会话完成时播放提示音，并在网页标题动态显示运行状态 | Play a completion chime and show live session status in the page title |
| `settings.notify.sound` | 提示音 | Notification sound |
| `settings.notify.dynamicTitle` | 动态标题 | Dynamic page title |
| `settings.notify.soundDesc` | 会话完成时播放提示音 | Play a chime when a session completes |
| `settings.notify.soundSource` | 提示音 | Sound |
| `settings.notify.soundSourceDesc` | 选择完成提示音；上传的音频保存在当前浏览器 | Pick the completion sound; uploaded audio is stored in this browser |
| `settings.notify.volume` | 音量 | Volume |
| `settings.notify.gain` | 增益 | Gain |
| `settings.notify.sourceChime` | 默认提示音 | Default chime |
| `settings.notify.sourceBell` | 清脆铃声 | Bell |
| `settings.notify.sourceCustom` | 自定义音频 | Custom audio |
| `settings.notify.customPick` | 选择音频文件 | Choose audio file |
| `settings.notify.customPreview` | 试听 | Preview |
| `settings.notify.customRemove` | 移除 | Remove |
| `settings.notify.customFormat` | 支持 MP3 / WAV / OGG / WEBM · 建议时长 ≤ 3 秒 · 文件 ≤ 1 MB | MP3 / WAV / OGG / WEBM · keep under 3 seconds · ≤ 1 MB |
| `settings.notify.customTooLarge` | 文件超过 1 MB，请换一个更短的音频 | File exceeds 1 MB — pick a shorter clip |
| `settings.notify.customReadError` | 读取音频文件失败，请重试 | Could not read the audio file — please retry |
| `settings.notify.titleDesc` | 网页标题实时显示运行状态 | Live session status in the page title |
| `chat.fold.reply` | 回复 | reply |
| `chat.fold.tool` | 工具调用 | tool call |
| `chat.fold.result` | 结果 | result |
| `chat.fold.retry` | 重试 | retry |
| `chat.fold.tail` | 收尾 | tail |
| `chat.fold.error` | 错误 | error |
| `chat.fold.toggleOpen` | 展开本轮详情 | Expand this turn |
| `chat.fold.toggleClose` | 收起本轮详情 | Collapse this turn |

---

## 6. CSS / 设计

### 6.1 CSS 模块注入机制（tagId 机制，补丁内每个模块都重复此样板）

```js
const tagId$22 = "@deepseek-ai/dsh-client-ui-conversation/CostMeter.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$22) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
  tag.dataset.pluginCss = tagId$22;
  tag.textContent = css$22;
  document.head.appendChild(tag);
}
```
- 幂等：`data-plugin-css` 选择器判重；`CostCharts` 与 `CostPanel` 的 tagId 带 `?v4`（版本化，改版后强制换发）。**插件移植时应把 tagId 换成自己的 pluginId 前缀以避免与已注入的同名 style 冲突，或用插件自身的 CSS 注入 API。**

### 6.2 新增模块与类名清单

| 模块（tagId） | 前缀 | 类名 |
|---|---|---|
| `CostMeter.module.css` | `Rk7vN3_` | trigger, glyph, panel, header, figures, percent, headline, bar, segment, swatch, colorUncached, colorCache, colorOutput, rows, row, modelRows, modelRow, modelName |
| `BillingView.module.css` | `Vb3nY2_` | view, partial, header, title, subtitle, summary, summaryRow, summaryTotal, summaryMeta, bar, segment, swatch, colorFlash, colorPro, colorOther, legend, legendItem, tableWrap, table, th, td, tdNum, cost, totalRow, empty, loading, error, turnFoldRow, turnFoldBody, turnFoldChevron, foldChevronOpen |
| `SessionBill.module.css` | `Qf4wN8_` | action, dialog, dialogHeader, dialogTitle, dialogClose, body, meta, detail |
| `BillingTabs.module.css` | `Bn9xV2_` | tabs, tab, tabActive, drillBtn, sectionTitle, row, drillPanel |
| `CostCharts.module.css?v4` | `Mk7wQ2_` | chartCard, donutWrap, donut, donutCenter, donutLegend, donutLegendItem, donutSwatch, donutLegendValue, bars, barRow, barLabel, barTrack, barFill, barValue, dayChart, dayCol, dayBarTrack, dayBarFill, dayLabel, turnChart, turnCol, turnValue, turnBarTrack, turnBarFill, turnLabel, turnPager, turnPagerBtn, turnPagerInfo |
| `CostPanel.module.css?v4` | `f7cQ9_` | card, header, switchWrap, switchLabel, switchInput, switchTrack, switchKnob, panel, panelOff, toolbar, segmented, segBtn, segBtnActive, segDot, resetBtn, periodBar, periodPeak, periodOffpeak, periodStandard, periodRow, periodDot, periodLabel, periodName, periodMeta, bucketList, bucketRow, bucketLabel, field, priceInput, clearBtn, unit, bucketHint, footnote, notifyRow, notifyIcon, notifyText, notifyTitle, notifyDesc, notifyDivider, pickBtn（+ `@keyframes f7cQ9_pulse`） |
| `ChatView.module.css`（修改追加） | `Md3f7G_` | foldGroup, foldBar, foldBody, foldChevron, foldChevronOpen, foldText |

### 6.3 关键样式要点

- **卡片（CostPanel）**：`card{border-bottom:1px solid var(--dsw-alias-border-l2);padding:16px 0;gap:10px;flex-column}`；`panel{background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px}`；`panelOff{opacity:.45;filter:saturate(.35);pointer-events:none}`（开关关闭时整块半透明禁点）。
- **开关**：`switchInput{position:absolute;opacity:0}`（隐藏原生 checkbox）；`switchTrack{width:34px;height:20px;border-radius:999px;background:var(--dsw-alias-border-l3)}`；`switchKnob{14px 白色圆点;transition:transform .18s cubic-bezier(.4,0,.2,1)}`；`:checked + track{background:var(--dsw-alias-state-business-primary);knob translateX(14px)}`；`:focus-visible + track{outline 2px}`。
- **分段切换器（segmented）**：`segmented{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;gap:2px;padding:2px;flex:1}`；`segBtn{flex:1;font-size:12px;line-height:24px}`；`segBtnActive{background:var(--dsw-alias-bg-module-platform);box-shadow:0 1px 2px rgba(0,0,0,.12);color:var(--dsw-alias-label-primary);font-weight:600}`；`segDot{6px 圆点,var(--dsw-alias-state-business-primary)}`（标记有自定义价）。
- **峰谷时段条（periodBar）**：`border:1px solid color-mix(in srgb,currentColor 24%,transparent);background:color-mix(in srgb,currentColor 8%,transparent);border-radius:9px`；配色类仅改 `color`：peak→`var(--dsw-alias-state-warn-primary)`、offpeak→`var(--dsw-alias-state-success-primary)`、standard→`var(--dsw-alias-state-business-primary)`；`periodDot{background:currentColor;animation:f7cQ9_pulse 2.4s ease-out infinite}`（呼吸灯扩散阴影）。
- **价格输入**：`priceInput{height:28px;border-radius:7px;font:400 12px/18px var(--ds-font-family-code);padding:0 36px 0 8px;width:100%;-moz-appearance:textfield}`（隐藏 spin button）；`unit` 绝对定位右 8px（`¥/M`）；`clearBtn` 绝对定位右 32px（16px 圆角方钮）。
- **柱状图（CostCharts）**：`turnChart{height:150px;gap:calc(var(--turn-bar-w,34px)/3);align-items:flex-end;justify-content:center}`；`turnCol{width:var(--turn-bar-w,34px)}`；`turnBarTrack{flex:1;min-height:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:4px 4px 2px 2px;position:relative}`；`turnBarFill{position:absolute;bottom:0;left:0;right:0;background:var(--chart-color,var(--dsw-alias-label-tertiary))}`——**填色必须通过 `--chart-color` 传真实颜色值，不能传类名**（`billingModelColorValue` 的注释明确：类名会让 `background:var(--chart-color,…)` 在计算值阶段失效、填充透明，只剩灰色轨道）。dayChart 同理（height 72px，dayBarTrack max-width 40px）。
- **分页条**：`turnPager{gap:8px;margin-top:8px;width:max-content;align-self:center}`（与柱组对齐居中）；`turnPagerBtn{height:24px;border-radius:12px;padding:0 10px;background:var(--dsw-alias-bg-module-platform)}`；`:disabled{opacity:.45}`。
- **表格（BillingView）**：`tableWrap{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}`；`table{table-layout:fixed}`；`th{height:34px;background:var(--dsw-specific-sidebar-fill);font-weight:500}`；`td{height:34px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid var(--dsw-alias-border-l1)}`；`totalRow .td{border-top:2px solid var(--dsw-alias-border-l2);font-weight:600}`；`turnFoldRow{cursor:pointer}:hover td{background:var(--dsw-alias-interactive-bg-hover)}`；`turnFoldBody{background:var(--dsw-alias-bg-module-platform);border-radius:8px;margin:2px 8px 6px;padding:8px 4px 8px 12px}`；`turnFoldChevron{transition:transform .12s}`、`foldChevronOpen{rotate(180deg)}`。
- **弹窗/设置页外壳（SessionBill）**：`dialog{width:min(960px,92vw);height:min(640px,80vh);flex-direction:column;overflow:hidden}`；`dialogHeader{height:56px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:0 16px 0 24px}`；`body{flex:1;min-height:0;overflow:auto}`；`meta`（时间戳灰字）；`detail` 表（th/td 高 30px，tabular-nums）。`SettingsBillingSection` 复用 `dialogHeader/dialogTitle/body` 类但内嵌在设置页（无对话框容器）。
- **折叠条（ChatView）**：`foldBar{width:100%;height:30px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}:hover{background:var(--dsw-alias-interactive-bg-active)}`；`foldText{ellipsis 单行}`；`foldGroup/foldBody{flex-column;gap:16px}`。
- **CostMeter**：`trigger{min-width:36px;height:28px;border-radius:999px;padding:0 8px;grid}`（hover 用 interactive-bg-hover）；`glyph{font:500 12px/16px var(--ds-font-family-code);tabular-nums}`；`panel{width:264px;border-radius:12px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);position:absolute;bottom:calc(100% + 8px);right:0;z-index:100}`（相对输入栏向上弹出）；`bar{height:4px;gap:1px;border-radius:999px}`；`segment{min-width:2px}`。

---

## 7. 与原版界面的挂接点（→ 插件 Slot 映射）

### 7.1 补丁中的注册（apply() 内，12318–12367 行）——移植时的地面真值

```js
const connection = ctx.get("connection");                       // 新增:connection 服务 → connection.api

costEstimateSettings = new CostEstimateSettings(ctx.settingsScope.bind({ namespace: CONVERSATION_SETTINGS_NAMESPACE })); // "ui-conversation"

ctx.slots.inject("settings.general.item", () => ctx.slots.register({
  name: "settings.general.item", id: "cost-estimate", order: 30, locale: NS,
  inject: () => ({ setEnabled: (e) => costEstimateSettings.setEnabled(e),
                   setPrice: (m, k, v) => costEstimateSettings.setPrice(m, k, v) })
}, CostEstimateRow));

ctx.slots.inject("settings.general.item", () => ctx.slots.register({
  name: "settings.general.item", id: "notify", order: 40, locale: NS
}, NotifyRow));

ctx.slots.inject("conversation.view", () => ctx.slots.register({
  name: "conversation.view", id: "billing", order: 20, locale: NS,
  label: () => t("view.billing"),
  inject: (sessionId) => ({ api: connection.api, t, sessionId })
}, SessionBillView));

ctx.slots.inject("settings.section", () => ctx.slots.register({
  name: "settings.section", id: "billing", order: 31, locale: NS,
  label: () => t("billing.nav"),
  inject: () => ({ api: connection.api, t })
}, SettingsBillingSection));
```

### 7.2 原版上下文揭示的结构

- `settings.general.item`：原版已有 `id: "composer-enter", order: 20`（EnterBehaviorRow）。补丁在其后追加 order 30 / 40。
- `conversation.view`：原版 `viewTabs()` 遍历 `slots.entries("conversation.view")` 生成 tab（`id` + 解析后的 `label`）；会话主区按 `renderSlot("conversation.view", {...})` 渲染（orig 7038 行）。注册 id `billing` order 20 即成为会话视图 Tab「账单」。
- `settings.section`：设置面板的导航分区 slot（`label` 即侧栏导航名，order 决定排序）。README 注明 id `billing`、order 31 **紧挨「配置文件」之后**；**入口从侧边栏底部 `sidebar.footer.action` 迁移而来**（曾与 Cordis 插件按钮互相挤压掩盖）。
- `InputBar` trailing 行：`ContextMeter`（token 计量器）之后、`interruptible && Tooltip("input.stop")` 之前直接 JSX 插入 `<CostMeter useProjection useSession t />`（原版 3859 行上下文）。
- `ChatView` flow：`order.map(nodeKey => <ChatNodeSeat .../>)` 整段替换为 `groups.map(...)`。
- `StatsLine`：统计行 `groups.join(" | ")` 前插入费用行；Tooltip label 字符串 → JSX。
- `ctx.get("connection")`：`connection.api` 是 RPC 门面（`api.sessions.list/history/cost`、`api.host.balance`）。

### 7.3 Cordis 插件移植的 Slot 映射建议

| 补丁组件 | 原版挂接点 | 插件注册目标 |
|---|---|---|
| CostEstimateRow | settings.general.item (id cost-estimate, order 30) | `settings.general.item` |
| NotifyRow | settings.general.item (id notify, order 40) | `settings.general.item`（若另一补丁已注册同名，合并/跳过） |
| SettingsBillingSection + BillingView | settings.section (id billing, order 31) | `settings.section` |
| SessionBillView | conversation.view (id billing, order 20, label `view.billing`) | `conversation.view` |
| CostMeter | InputBar trailing（ContextMeter 旁） | 参考 `conversation.composer.dock` / `conversation.input.dock`（若宿主无此 slot，可注入 composer 尾部区域） |
| StatsLine 费用行 | 会话统计栏内联 | 无直接 slot；可注入统计栏所在容器（如 `conversation.session.header`）或作为独立行 |
| ChatView 折叠 + FoldReplyPreview | ChatView 主渲染流（order.map 替换） | 需覆盖/增强会话聊天渲染；参考 `conversation.chat.turnTail` 等 chat 类 slot，或整体覆写渲染 |
| 账单明细弹窗（旧版） | 曾为 dialog | 现为 conversation.view 页 + settings.section 内联，无需 `shell.overlay` |

> 注：补丁直接改的是编译产物（无 Slot 抽象层处的硬编码 JSX）。插件化移植时凡"原版内联修改"处（InputBar、StatsLine、ChatView 主渲染）需找到宿主对应 Slot；若宿主 Slot 不足以承载，可选择注入覆盖组件或接受折衷。

---

## 8. 分页与弹窗交互

### 8.1 账单明细的打开/刷新/冻结/翻页

- **会话账单（SessionBillView，conversation.view 页）**：
  - 打开即加载；**每 5s 轮询 `sessions.list`**，仅当 `updatedAt` 变化（`lastFoldedAtRef` 比对）才重拉历史明细并重折叠（`fetchUsageEntries` → `foldTurnCosts`/`foldCallLedger`）——"实时用量追平"，不活跃会话不重复拉取。
  - 明细折叠按**请求时刻**（`event.time`）计价，与汇总同口径。
  - 每次折叠用 `costCfg.prices`（自定义价），deps 含 `costCfg.prices`，改价立即重折叠。
- **总账单下钻（BillingView detail）**：
  - 打开明细（`setDetail`）时拉取一次全部历史（`fetchUsageEntries`，≤60 页/200000 条），`capped` 时显示 `billing.partial` 横幅（"仅显示最近活动明细，汇总为完整值"）。
  - **按打开时点冻结明细**（effect deps `[detail, api, costCfg.prices]`，期间不再刷新）；外面的 sessions 列表照常 5s 轮询刷新（合计/总额追平，明细冻结）。
  - 打开明细时 `viewRef.current?.parentElement?.scrollTo({top: 0})` 回顶。
- **翻页（fetchUsageEntries 向前翻页）**：`beforeSeq = result.value.events[0].event.seq`（当前页最旧事件的 seq），服务端 `paginate` 只返回 `seq < beforeSeq` 的消息边界页；`hasMore === false` 或空页停止。页内事件按 seq 升序。

### 8.2 每轮费用柱状图分页（CostTurnChart）

- 每页柱子数自适应：`effPageSize = clamp(round((fit - 80) / (34 + 34/3)), 4, 40)`（fit 为容器 clientWidth，ResizeObserver + window.resize 监听，deps `[rows.length]`）；无测量时回退 `pageSize`（默认 10）。
- `total = max(1, ceil(len / effPageSize))`；`cur = min(page, total - 1)`；`slice = ordered.slice(cur * effPageSize, cur * effPageSize + effPageSize)`；`slice.length === 0` → null。
- 分页条（`turnPager`）仅 `len > effPageSize` 时渲染：上一页（`disabled: cur === 0`）/ `billing.turnPage {page: cur+1, total}` / 下一页（`disabled: cur >= total - 1`）。柱组 + 分页条整体居中（`align-self:center;width:max-content`）。刻度说明行始终渲染（`billing.turnScale`）。

### 8.3 轮次/逐笔明细分页（SessionBillView 内）

- 轮次表：`TURN_PAGE_SIZE = 10`；`turnTotal = max(1, ceil(turns.length / 10))`、`turnCur = min(turnPage, turnTotal - 1)`、`turnSlice`；仅 `turns.length > TURN_PAGE_SIZE` 显示分页条。**合计行恒为全量统计**（`turns.reduce(...)`，steps/input+write/read/output/cost）。
- 逐笔表：`CALL_PAGE_SIZE = 10`，逻辑同上；**合计行始终显示在表尾**（全量 `calls.reduce(...)`）。
- 翻页按钮点击 `setTurnPage/setCallPage`（clamp 到 `[0, total-1]`）。
- 轮次表行点击 = 折叠开关（`toggleTurn`），chevron 按钮 `stopPropagation` 防止误触行；展开后内嵌该轮逐笔子表（`calls.filter(call => call.turn === line.turn)`）。

---

## 9. 移植注意事项 / 风险点

1. **README 与补丁代码不一致（CostTurnChart）**：README 描述"柱高对数刻度（锚定最小值：2% + 98%·ln(v/min)÷ln(max/min)）+ 按费用降序排列"，而**本补丁代码**是"自适应线性刻度（ratio≤5 时锚定 [min×0.95, max×1.05]）+ 保持轮次顺序"（补丁 1121–1146 行注释与代码）。移植前需确认目标设计版本。
2. **自定义价与 `session.cost` 不一致**：客户端调用 `api.sessions.cost({})` **未传 `prices`**，服务端聚合用的是内置价表；只有回退路径和明细折叠用了 `costCfg.prices`。若要求自定义价全局生效，需向 `session.cost` 传 `prices: costCfg.prices`（服务端 schema 已支持）。
3. **`session.cost` / `host.balance` 依赖服务端**：Host 侧需要与 `dsh-host-apiproxy` 的 `session.cost`、`host.balance`、`session.history(usageOnly)` 对应实现（或确认部署已具备）；`host.balance` 需要 `DEEPSEEK_API_KEY`，缺失时返回 error（客户端 `setBalance(null)` 静默隐藏余额）。
4. **CSS tagId 冲突**：插件注入 CSS 时若沿用 `@deepseek-ai/dsh-client-ui-conversation/*` 的 tagId，会与宿主已注入的样式判重跳过。应改用插件自己的前缀/版本（如 `?vN` 机制）。
5. **`connection.api`**：插件 Host 侧需以 `harness.handle("sessions.cost", ...)` 等暴露同名方法，或从既有 api 门面取用；Client 侧统一走 `host.call` 包装（补丁里是 `api.sessions.xxx({})` 的 Promise 形式 `{result:{ok, value}}`）。
6. **`IconChevronDownOutline14` / `IconRefreshOutline14` / `IconCloseFill14` / `Tooltip` / `AssistantMarkdown` / `EnterBehaviorRow` 样式类**均来自宿主包（primitives / ui-conversation / 原版 CSS 类）；插件内不可直接引用编译产物私有类时需自带等价样式（如 `EnterBehaviorRow_module_css_default.rowText/title/desc` 的标题/描述排版）。
7. **轮询生命周期**：三个 5s 轮询 effect 都必须随组件卸载 `clearInterval` + `cancelled` 标志（补丁均遵守）；插件内同样处理，避免卸载后 setState。
8. **NotifyRow 与另一补丁可能重复**（用户要求标注即可）：localStorage 键与 dsh-notify 特性可能由独立补丁/插件提供，注册 id `"notify"` 前先探测是否已存在。
9. **`billing.collapse` / `billing.closeLabel` 字典键已定义但补丁代码中未见使用**（可能是旧弹窗版残留），可保留。
10. **设置页轮询**：`BillingView` 位于 `settings.section`（设置面板），5s 轮询在设置页打开期间持续；插件需确认设置页卸载时清理定时器。
