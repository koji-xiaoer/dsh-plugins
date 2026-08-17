# Token 用量统计（CostMeter per-model projection）

> **状态：已迁移为动态插件 `插件类/tokm-1/`（并合入静态包 `插件类/dsh-mods-enhanced/`）**。
> 本目录补丁保留作历史归档与回退。

在原有 token 用量统计基础上增加**按模型维度**的会话用量投影：

- `tokenUsageByModel`：与 `tokenUsage` 相同的时间桶结构，按产出该步的模型分键
- 仅 `assistant/message` 事件携带模型（`message.source.model`）；chunk usage 样本无模型，跳过
- 最终样本为准，按模型合计可能略滞后于聚合值；单步只属于一个模型，`last` 槽安全

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-token-meter.patch` | `dsh-token-meter/lib/index.js` | `tokenUsageByModelProjectionDefinition` 投影定义与初始化 |
