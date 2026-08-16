# 费用预估与账单明细（Cost Estimate & Billing UI）

会话界面费用能力的大头：

- **费用预估卡片**：分段模型切换 + 实时峰谷时段条（北京时区 09–12 / 14–18 峰时）+ 三行价格输入（内置价占位符、`¥/M` 单位、自定义清除/恢复内置价）
- **账单明细弹窗**：打开期间周期刷新、实时用量追平、按打开时点冻结明细 + 向前翻页（`beforeSeq` 取当前页最旧事件）
- **折叠回复预览**：`FoldReplyPreview`，长回复分组折叠

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-client-ui-conversation.patch` | `dsh-client-ui-conversation/lib/client.js` | `ESTIMATED_PRICES` 内置价表、`pricingPeriod` 峰谷判定、`CostEstimateRow` / `NotifyRow` 卡片、账单明细表、`FoldReplyPreview` |

> 设计规范见 `dsh-mods/UI-GUIDE.md`；设置持久化于 `~/.dsh/settings.yaml` 的 `ui-conversation` 命名空间。
