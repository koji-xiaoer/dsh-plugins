# tokm-1 — Token 用量统计(按模型投影)

从 dsh-mods 补丁功能 **Token 用量统计**(`dsh-token-meter.patch`)迁移而来的动态 Cordis 插件。

- **pluginId**: `tokm-1`(由 Host 分配,idPrefix `tokm`)
- **迁移时间**: 2026-08-18
- **原实现**: `增强主页类/dsh-mods/features/Token用量统计/dsh-token-meter.patch`(安装包内 `dsh-token-meter/lib/index.js` 直接修改)

## 功能

注册 `tokenUsageByModel` 会话投影单元(键名与宿主 token-meter 相同,stateVersion 1 共享单元):

- 仅消费 `assistant/message` 且带 `data.usage` 的事件(chunk 样本无模型,跳过)
- 模型取 `event.data.message.source.model`,按模型分键聚合桶 `{uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}`
- `last` 槽防双计:同 turn/step/model 幂等样本直接返回原状态
- 状态用**普通对象**(修复版,原补丁早期 Map 实现会导致投影缓存写路径 fail-soft,见 `backfill-projcache.py` 背景)
- schema 用透传 `{ parse: (v) => v }`(动态插件无 zod;`sessionProjections` 仅调用 `schema.parse(view(state))`)

Client 端在 `conversation.composer.dock`(order 10)显示当前会话按模型 token 用量,2 秒轮询 Host RPC `usage-by-model`。

## 运行

```
cordis_define(kind=new, idPrefix=tokm, ...) → cordis_run(pluginId=tokm-1, packageId=pkg-1, mode=run)
```

## 版本

| packageId | 说明 | 状态 |
|---|---|---|
| pkg-1 | 投影注册 + usage-by-model RPC + composer.dock 用量行 | 运行中 |

## 依赖

| 类型 | 依赖 | 缺失影响 |
|---|---|---|
| 宿主服务 | `sessionProjections`(ctx.get 可选) | 投影不注册 |
| 宿主服务 | `sessions`(ctx.get 可选) | 用量行无数据 |
| 平台 | Host harness RPC / Client slots+timer | 界面不显示 |
| 补丁 | dsh-token-meter.patch 同 key 共享单元(stateVersion 1,计数叠加) | 共存兼容 |

完整依赖关系与规则见 `docs/插件依赖关系.md`。
