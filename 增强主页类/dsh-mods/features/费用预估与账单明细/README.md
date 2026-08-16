# 费用预估与账单明细（Cost Estimate & Billing UI）

会话界面费用能力的大头：

- **费用预估卡片**：分段模型切换 + 实时峰谷时段条（北京时区 09–12 / 14–18 峰时）+ 三行价格输入（内置价占位符、`¥/M` 单位、自定义清除/恢复内置价）
- **账单明细弹窗**：打开期间周期刷新、实时用量追平、按打开时点冻结明细 + 向前翻页（`beforeSeq` 取当前页最旧事件）
- **每轮费用柱状图**：`CostTurnChart` 竖排柱状图（柱高 ∝ 费用，颜色按模型区分，柱顶显示金额、柱底显示轮次 `#N`，悬停显示 模型·步数·金额），替换原横向长条；柱宽 34px、柱间间隔 = 柱宽 1/3，每页柱子数按容器宽度自适应（铺满约 85–90% 宽度、左右留白、整体居中），分页条与柱组对齐居中；高度 150px，柱高采用**对数刻度**（锚定最小值：2% + 98%·ln(v/min)÷ln(max/min)），费用集中时也能拉开明显高度差；柱子**按费用降序排列**（高→低阶梯，相同费用保持先后），图表下方有刻度说明文字
- **每轮费用分页**：超过一页时自动分页（上一页 / 第 x / y 页 / 下一页）
- **轮次明细分页**：`billing.col.turns` 轮次表超过 10 行自动分页，合计行始终为全量统计
- **逐笔明细分页**：`billing.callsTitle` 流水表超过 10 行自动分页，合计行始终显示在表尾
- **折叠回复预览**：`FoldReplyPreview`，长回复分组折叠
- **总账单页面（设置面板）**：全会话费用账单（会话/更新时间/轮次步数/输入/输出/预估费用表）
  - 入口从侧边栏底部（`sidebar.footer.action`，曾被 Cordis 插件按钮挤压掩盖）迁移到设置面板
    `settings.section`（id `billing`，order 31，紧挨「配置文件」之后），页面内直接渲染 `BillingView`
  - 字典键 `billing.nav`：zh「总账单」/ en「Billing」

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-client-ui-conversation.patch` | `dsh-client-ui-conversation/lib/client.js` | `ESTIMATED_PRICES` 内置价表、`pricingPeriod` 峰谷判定、`CostEstimateRow` / `NotifyRow` 卡片、账单明细表、`FoldReplyPreview`、`SettingsBillingSection`（总账单设置页） |

> 设计规范见 `dsh-mods/UI-GUIDE.md`；设置持久化于 `~/.dsh/settings.yaml` 的 `ui-conversation` 命名空间。
