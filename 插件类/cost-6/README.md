# cost-6 — 费用预估与账单明细(Cost & Billing)

从 dsh-mods 补丁功能 **费用预估与账单明细**(`dsh-client-ui-conversation.patch`,197KB 最大补丁)迁移的动态 Cordis 插件。

- **pluginId**: `cost-6`(idPrefix `cost`),迁移时间 2026-08-18
- **原实现**: 安装包内 `dsh-client-ui-conversation/lib/client.js` 的 CostEstimateRow / CostMeter / BillingView / SessionBillView / CostTurnChart / FoldReplyPreview 等 11 个组件

## 架构

- **Host 折叠引擎**(替代 usageOnly 补丁的传输路径): `sessionQuery.listSessions/listEvents` 在宿主内折叠,只传聚合 JSON
  - 价表 ESTIMATED_PRICES(deepseek-v4-flash/pro,current/peak/offpeak)、峰谷判定(北京时区 09-12/14-18,PEAK_PRICE_SINCE 2026-08-17 00:00 北京时间)、按请求时刻计价
  - `cost-all`: 全会话费用(含 byModel/byDay/turns/calls),updatedAt 变化才重折叠(缓存)
  - `cost-session`: 单会话明细
- **Client v1**:
  - `conversation.composer.dock`(order 0)费用行: 总费用/输入/输出/按模型,展开每轮柱状图(对数刻度、费用降序、12 根/页)
  - `settings.section`(id billing-v2,order 31)总账单页: 全会话费用表,行展开轮次/逐笔明细(各 10 行)

## 版本

| packageId | 说明 | 状态 |
|---|---|---|
| pkg-7 | Host 折叠引擎(cost-all / cost-session) | 运行中 |
| pkg-8 | Client v1(费用行 + 总账单页) | 运行中 |

## 待办(与补丁功能的差距)

- [ ] 设置页「费用预估」卡片(启用开关 + 三行价格输入 + 恢复内置价)
- [ ] conversation.view billing 视图页(单会话账单 + 图表 + 分页明细)
- [ ] 账单明细弹窗(打开冻结 + beforeSeq 向前翻页)
- [ ] 折叠回复预览 FoldReplyPreview(turnTail)
- [ ] 输入栏 CostMeter 触发器(conversation.input.right)
- [ ] 设置卡 CSS 样式完善
- [ ] 补丁退役后将 billing-v2 改回 billing
