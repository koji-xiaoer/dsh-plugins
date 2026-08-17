# imgr-3 — 粘贴图片转文字(Image Relay)

从 dsh-mods 补丁功能 **粘贴图片转文字**(`dsh-host-apiproxy.patch` `[image-relay-patch]` + `dsh-llm-deepseek.patch`)迁移的动态 Cordis 插件。

- **pluginId**: `imgr-3`(idPrefix `imgr`),迁移时间 2026-08-18
- **原实现**: 安装包内 dsh-host-apiproxy 在组装消息块时追加 hidden text 块 + DeepSeek 适配器放行 image

## 功能与实现差异

监听 `agent/pre-step` waterfall:对进入步骤的用户消息,把 `image` 内容块**替换**为智谱 GLM 的文字描述块(原补丁是保留 image + 追加 hidden text 并放行适配器;本插件在模型入口前完成替换,前端渲染仍来自会话事件流,图片照常显示,DeepSeek 适配器无需放行 → `dsh-llm-deepseek.patch` 可退役)。

- 字节读取: `attachments.readImage(block.attachment)`(attachmentId 为内容寻址,直接用作缓存键,免去 sha256)
- GLM 调用: 全局 `fetch` POST `https://open.bigmodel.cn/api/paas/v4/chat/completions`(model `glm-4v-flash`, max_tokens 512);8 秒超时用 `setTimeout` + `Promise.race`(动态宿主无 AbortSignal)
- 密钥: `credentials.resolve('ZHIPU_API_KEY')`(无 process 全局)
- 缓存: 内存 Map(attachmentId → 描述),上限 200 条
- 降级文案三级: 无 key / 请求失败或空内容 / 成功 `【图片:...】`

## 版本

| packageId | 说明 | 状态 |
|---|---|---|
| pkg-4 | agent/pre-step 拦截 + GLM 转文字 + 内容寻址缓存 | 运行中 |

## 依赖

| 类型 | 依赖 | 缺失影响 |
|---|---|---|
| 宿主事件 | `agent/pre-step`(waterfall) | 插件不生效 |
| 宿主服务 | `attachments`(ctx.get 可选) | 降级占位文案 |
| 宿主服务 | `credentials`(ctx.get 可选)+ `ZHIPU_API_KEY` | 降级「未配置」文案 |
| 平台 | Host 全局 `fetch`/`setTimeout`(无 AbortSignal) | 降级占位文案 |
| 补丁 | dsh-host-apiproxy `[image-relay-patch]` = 替代;dsh-llm-deepseek 放行 = 冗余可退役 | 共存兼容 |

完整依赖关系与规则见 `docs/插件依赖关系.md`。
