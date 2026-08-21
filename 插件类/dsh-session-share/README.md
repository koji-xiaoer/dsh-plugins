# dsh-session-share

**会话分享(静态化常驻包)**

把任意会话登记为"已分享"得到一个短分享ID(`shr-xxxxxx`,不外露原始 sessionId),其他会话凭分享ID读取其实时最近对话摘要。人看有管理页,模型看有专用工具,双通道。

> 静态化常驻包:挂载于 `~/.dsh/profiles/web/plugins/`,随 dsh web 启动自动加载,非动态插件(进程重启不丢失插件本身;分享登记在内存中,重启后需重新分享)。

## 功能

| 能力 | 说明 |
|---|---|
| 会话行菜单入口 | 左侧会话行"⋯"菜单新增"分享会话"(位于"分叉会话"下方),点击弹出发布对话框 |
| 发布对话框 | 显示会话标题 + 备注输入(可选);已分享的会话再次打开显示分享ID并变为"保存并保持分享";发布成功后**自动复制分享ID到剪贴板**并弹出成功卡片(剪贴板不可用时兜底展示可手选的 ID) |
| 模型工具 `read_shared_session` | 其他会话的 agent 调用即可列出/读取分享;返回格式化的最近消息文本摘要 |
| 分享ID 自动识别 | 注册 `systemPrompt` 指引(order 110):其他会话的 agent 看到消息中的 `shr-xxxxxx` 自动调用工具读取,询问"有哪些分享"时自动列出 |
| 聊天气泡标签 | `conversation.chat.turnTail` 骑手:某轮用户消息含 `shr-*` 时,该轮尾部渲染显眼胶囊标签(🔗 会话分享 + ID + 标题/备注) |
| 读分享工具卡片 | `tool.call.toolview` keyed `read_shared_session`:agent 读取时工具卡片替换为专属样式(分享ID徽标 + 标题 + 摘要节选 + 展开/收起的"共N条·实时摘要"页脚) |
| 摘要层读取范围 | 最近 N 条用户/助手消息文本(默认 20,上限 100),系统注入消息(AGENTS.md/文件变更等)自动剔除只报数量,单条超 1500 字截断 |
| 管理页 | 设置 → 会话分享:复制 ID、预览摘要、取消分享,8 秒轮询刷新 |
| 实时性 | 读取的是读取时刻的实时状态,会话继续对话后摘要随之更新 |

## 文件结构

```
dsh-session-share/
├── package.json   # 包声明(dsh.client 平台 web)
└── lib/
    ├── index.js   # host 半区:分享登记表 + /sshp/* HTTP 路由 + read_shared_session 工具 + systemPrompt 识别指引
    └── client.js  # client 半区:发布对话框(shell.overlay,自动复制ID)+ 管理页(settings.section)
```

## 依赖与联动

- **UI 补丁**(必需):菜单入口由 `patches/dsh-client-ui-workspace-share.patch` 提供 ——
  给 `dsh-client-ui-workspace` 的会话行菜单加"分享会话"项,点击分发 `window` 事件
  `sshp:share-session`(携带 sessionId 与标题),本插件客户端监听该事件弹窗。
  补丁经 `scripts/reapply-dsh-mods.sh` 管理,升级后一键重放。
- **服务依赖**:host 半区 inject `sessionQuery`(读任意会话标题与日志)、
  `tools`(注册模型工具)、`webServer`(自有 `/sshp/*` JSON 路由)。

## 安装(部署到 dsh)

```bash
# 1. 复制本目录到 profile 插件区
cp -r 插件类/dsh-session-share ~/.dsh/profiles/web/plugins/

# 2. profile package.json dependencies 增加:
#    "dsh-session-share": "file:plugins/dsh-session-share"

# 3. ~/.dsh/profiles/web/cordis.patch.yml 增加:
#    - insert:
#        - id: dsh-session-share
#          name: 'dsh-session-share'

# 4. 应用 UI 补丁并重启
bash scripts/reapply-dsh-mods.sh
bash ~/.dsh/scripts/restart-dsh-web.sh
```

## 使用

1. 分享:左侧会话行悬停 → "⋯" → **分享会话** → 填一句备注(如"里面有完整的插件开发流程")→ 发布;
2. 模型读:在另一个会话里说"看看有哪些分享的会话"/"读一下 shr-xxx 的内容",agent 调用工具即得;
3. 人读:设置 → 会话分享 → 预览摘要。

## 边界

- 分享登记在服务进程内存中,dsh 重启后消失,需重新分享(读取侧拿到的是实时摘要,无快照语义);
- DSH 消息内容块无 video 类型,摘要只覆盖文本;图片以 `[图片]` 存在于消息中时不参与文本折叠。
