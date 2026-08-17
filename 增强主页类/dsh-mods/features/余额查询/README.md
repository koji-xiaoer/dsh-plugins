# 余额查询（Balance API）

> **状态：已迁移为动态插件 `插件类/baln-4/`（并合入静态包 `插件类/dsh-mods-enhanced/`）**。
> 本目录补丁保留作历史归档与回退。

在 DSH 界面提供账户余额查询能力（`host.balance`），UI 可展示总余额/赠送余额/充值余额。

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-client-connection.patch` | `dsh-client-connection/lib/client.js` | 客户端注册 `host.balance` 调用方法 |
| `dsh-fetch-client.patch` | `dsh-host-apiproxy/lib/types/fetch/client.js` | fetch 通道注册 `host.balance` |
| `dsh-host-schema.patch` | `dsh-host-apiproxy/lib/types/api/host.schema.js` | `hostBalanceRequestSchema` / `hostBalanceValueSchema`（isAvailable/currency/totalBalance/grantedBalance/toppedUpBalance） |
