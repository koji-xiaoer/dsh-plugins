# baln-4 — 余额查询(Balance)

从 dsh-mods 补丁功能 **余额查询**(`dsh-host-schema.patch` + `dsh-client-connection.patch` + `dsh-fetch-client.patch`)迁移的动态 Cordis 插件。

- **pluginId**: `baln-4`(idPrefix `baln`),迁移时间 2026-08-18
- **原实现**: 安装包内 `dsh-host-apiproxy` 的 `host.balance` RPC + schema 三处注册

## 功能

- Host: `harness.handle('balance')` → `credentials.resolve('DEEPSEEK_API_KEY')`(无 process 全局,省略 env 回退)→ GET `https://api.deepseek.com/user/balance`(Bearer)→ 映射 `{isAvailable, currency, totalBalance, grantedBalance, toppedUpBalance}`,错误码对齐原实现(credential-missing / provider-error)
- Client: `conversation.session.header.utilities`(order 10)余额徽标(总余额,悬停显示赠送/充值),5 秒轮询,失败静默隐藏

## 版本

| packageId | 说明 | 状态 |
|---|---|---|
| pkg-5 | balance RPC + header 余额徽标 | 运行中 |
