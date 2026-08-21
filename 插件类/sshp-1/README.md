# sshp-1 — 会话分享(动态插件源码归档)

> **本插件已静态化为 [`插件类/dsh-session-share/`](../dsh-session-share/)**,随 profile 常驻加载。
> 本目录仅归档动态插件源码(开发过程记录),不再需要 cordis_define 重建。

把任意会话登记为"已分享"得到短分享ID(`shr-xxxxxx`,不外露原始 sessionId),
其他会话凭分享ID读取其实时最近对话摘要 —— 人看(管理页)+ 模型看(`read_shared_session` 工具)双通道。

## 版本历史

| Package | 说明 |
|---|---|
| pkg-1 | 首版:composer.dock 分享条 + 管理页 + 工具。**失败**:工具 output schema 缺显式 `additionalProperties` |
| pkg-2 | 修复 schema(`additionalProperties: true`),运行成功 |
| pkg-3(最终) | 入口迁移:composer.dock 分享条移除,改为监听会话行菜单补丁的 `sshp:share-session` 事件弹发布对话框(shell.overlay) |

## 依赖

- **UI 补丁** `patches/dsh-client-ui-workspace-share.patch`:会话行"⋯"菜单加"分享会话"项,
  分发 `window` 事件 `sshp:share-session`(sessionId + 标题)
- Host 依赖 `sessionQuery`;Client 依赖 `timer`、`slots`
- 动态通道:`harness.handle`(share-publish/unpublish/get/list/read)+ `harness.defineTool/registerTool`

## 静态版差异

| 维度 | sshp-1(动态) | dsh-session-share(静态) |
|---|---|---|
| 生命周期 | 进程内,重启即失 | profile 常驻,重启自动加载 |
| RPC | `harness.handle` / `host.call`(包私有) | 自有 `/sshp/*` HTTP 路由 + fetch |
| 工具注册 | `harness.defineTool` + `harness.registerTool` | `tools.register`(真实 ToolDefinition) |
| 定时器 | `timer` 服务 `ctx.interval` | 原生 `setInterval` |
