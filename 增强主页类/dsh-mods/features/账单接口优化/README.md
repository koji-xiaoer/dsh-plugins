# 账单接口优化（Billing usageOnly）

拉取会话历史时新增 `usageOnly` 折叠模式：只返回计费所需的 `assistant/message` usage 样本（先过滤再分页），
避免拉取整条原始 chunk 流（会话越大越膨胀，可到数十万条/上百 MB），传输量降到千分之一。

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-session-schema.patch` | `dsh-host-apiproxy/lib/types/api/sessions.schema.js` | `usageOnly: boolean().optional()` 字段 |

> 服务端折叠逻辑实现在 `dsh-host-apiproxy/lib/index.js`（`[billing-patch]` 标记），该文件与图片转文字功能共用
> 一个补丁，归档在「粘贴图片转文字」目录。
