# DSH Web GUI 界面改动规范（设计语言 + 修改工作流）

> 用途：后续任何对网页界面（设置页、会话视图、账单等）的改动，都遵循本文件。
> 核心要求：**沿用"现代卡片"效果**（圆角卡片、动画开关、分段切换、状态条、价格显性展示），
> 全部使用设计令牌（`--dsw-alias-*`），浅色/深色主题自适应。

---

## 一、设计语言（本次确立的"效果"）

| 元素 | 规范 |
|---|---|
| 卡片容器 | `border-radius: 12px`；`border: 1px solid var(--dsw-alias-border-l2)`；背景 `var(--dsw-alias-bg-module-platform)`；内边距 `10px`；与设置列表其他行共用 `border-bottom` 分隔 |
| 动画开关 | 自定义 pill 开关（34×20，圆钮 14，checked 时 track 变 `--dsw-alias-state-business-primary`，钮 `translateX(14px)`，`.18s` 过渡 + `focus-visible` 外环）。**不要用原生 checkbox 样式** |
| 分段切换器 | 容器 `--dsw-alias-bg-base` + 圆角 8px + 2px 内衬；选中项 `--dsw-alias-bg-module-platform` + 细阴影 + `font-weight:600`；有自定义数据时显示小圆点 |
| 状态/时段条 | 圆角 9px 色条：`border: 1px solid color-mix(in srgb, currentColor 24%, transparent)`；`background: color-mix(in srgb, currentColor 8%, transparent)`；8px 呼吸脉冲圆点（`@keyframes …_pulse`，`box-shadow` 扩散 2.4s 循环）；主色随状态切换（业务蓝/警示琥珀/成功绿） |
| 价格/数值显性展示 | 输入框占位符 = 内置价数值；框内固定单位后缀（`¥/M`）；右侧常驻参考提示（`内置 ¥0.02`）；填入自定义值出现 `×` 清除钮 + 头部"恢复内置价"按钮 |
| 图标 | 用 `@deepseek-ai/dsh-client-ui-primitives` 的 Icon 组件；没有合适图标时手写 24 viewBox 内联 SVG（`fill="currentColor"`），套 30×30 圆角色块容器 |
| 字号层级 | 标题 14/22、说明 12/18、次级标签 11-12、代码字体 `var(--ds-font-family-code)` + `font-variant-numeric: tabular-nums` |
| 禁用态 | 整卡 `opacity:.45; filter:saturate(.35); pointer-events:none` + `.2s` 过渡（开关本体保持可点） |
| 动效 | 一律轻量（≤.2s）、尊重 `prefers-reduced-motion` 场景、不用弹跳类动画 |

**参考实现**：`dsh-client-ui-conversation` 包内 `CostEstimateRow` / `NotifyRow` 组件及其
CSS 模块（类名前缀 `f7cQ9_`，style 标签 id `@deepseek-ai/dsh-client-ui-conversation/CostPanel.module.css`）。
新 UI 直接复制这套类名与结构改造，保证观感统一。

## 二、代码位置（安装包内直接改）

- 包根：`/home/claude/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh/`
- 会话相关 UI：`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js`
  - `ESTIMATED_PRICES`：内置价表（current/peak/offpeak 三套）
  - `pricingPeriod(now)`：北京时区峰谷判定（8/17 前 current；09–12 / 14–18 峰时，其余谷时）
  - `estimatedPriceSet` / `resolvePrice` / `formatPrice`：取价与展示
  - `CostEstimateRow` / `NotifyRow`：设置页两行卡片
- 其他 UI 包：`node_modules/@deepseek-ai/dsh-client-ui-*` 下 `lib/client.js` 同理
- 设置持久化：`~/.dsh/settings.yaml` 的 `ui-conversation` 命名空间

## 三、修改与发布工作流（重要）

1. **直接编辑**安装包内编译后的 `client.js`（compiled JSX 风格：`(0, react_jsx_runtime.jsx)(...)` 调用；
   CSS 以模块字符串注入，改 `css$N`/`tagId$N` 时**必须换新 tagId**，否则旧样式不更新）。
2. **HMR 自动热更**：服务端每 500ms 轮询文件 mtime，改完无需重启、无需刷新即可在打开的网页生效；
   页面刷新也总能拿到最新 bundle（`/plugins/...` 每请求读盘）。
3. 改完必须 `node --check client.js` 通过。
4. **重新生成补丁**（升级后一键恢复，否则 dsh 升级会覆盖改动）：
   `bash ~/.dsh/scripts/reapply-dsh-mods.sh --capture`
5. 日常管理：`reapply-dsh-mods.sh`（apply/`--check`/`--revert`/`--capture`），补丁存于 `~/.dsh/patches/`。

## 四、视觉验证（推荐）

- playwright-core：`/home/claude/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`
- Chromium：`/home/claude/.cache/ms-playwright/chromium-1124/chrome-linux/chrome`（headless 需指定 executablePath）
- 打开 `http://127.0.0.1:3080/` → 点「设置」→ 截图对比；历史脚本在 `~/dsh-ui-work/` 可复用
- 验收要点：无横向溢出、深浅主题各截一张、交互（切换/输入/开关）逐项点测

## 五、本次改动的既有产物

- 费用预估卡片：分段模型切换 + 实时峰谷时段条 + 三行价格输入（内置价占位符 + `内置 ¥X` 提示 + `¥/M` 单位 + 自定义清除/恢复）
- 会话完成提醒卡片：铃铛/窗口图标行 + 动画开关
- 中英文案：`settings.cost.*`、`settings.notify.*`（zh/en 字典同文件内成对维护）
