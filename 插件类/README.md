# 插件类 — 本助手创建的动态插件

存放 DSH 会话中由本助手通过 `cordis_define` 创建的**动态 Cordis 插件**源码。

> 原则：只提交**自己写**的插件；第三方/别人的插件不入库。

## 目录约定

每个插件一个子目录，以 `pluginId` 命名：

```
插件类/<pluginId>/
├── README.md        # 插件用途、版本历史、运行说明
├── host.js          # Host 端源码（如有）
└── client.js        # Client 端源码（如有）
```

## 归档流程

1. `cordis_define` 创建/更新插件 → `cordis_run` 运行验证
2. `cordis_inspect_self(pluginId, packageId)` 取出最新 Package 源码
3. 保存到本目录对应 `pluginId` 子目录，提交前运行 `scripts/check-secrets.sh --all` 审查
4. 推送

## 当前状态

| pluginId | 名称 | 版本 | 说明 |
|---|---|---|---|
| `cfgf-1` | 配置文件网页编辑器 | pkg-3（运行中） | 设置页新增「配置文件」页面，网页内查看/编辑 settings.yaml，密钥脱敏 |
| `baln-4` | 余额查询 | pkg-5（运行中） | Host `balance` RPC + 会话头部余额徽标（5s 轮询） |
| `sntf-5` | 会话完成提醒 | pkg-12 v2（运行中） | agent/status 监听 + 提示音/标题闪烁/提醒卡片 + 设置卡（.sntf-* 样式） |
| `tokm-1` | Token 用量统计 | pkg-14 v2（运行中） | `tokenUsageByModel` 投影注册 + composer.dock 用量行（样式令牌化） |
| `imgr-3` | 粘贴图片转文字 | pkg-4（运行中） | `agent/pre-step` 拦截替换 image 块 → GLM 识别，内容寻址缓存 |
| `cost-6` | 费用预估与账单明细 | pkg-16 v6（运行中） | Host 折叠引擎（cost-session/cost-all/cost-config）+ 费用行/总账单/货币卡/价格卡 |
| `sshp-1` | 会话分享 | pkg-3（运行中，已静态化） | 分享ID 登记 + 发布对话框（shell.overlay）+ 管理页 + `read_shared_session` 工具；**静态版见 `dsh-session-share/`** |
| `dsh-mods-enhanced` | 增强功能静态化常驻包 | 1.0.0 | **非动态插件**：5 个动态插件合并为 profile 静态插件，随 dsh web 启动自动加载 |
| `dsh-session-share` | 会话分享静态化常驻包 | 1.0.0 | **非动态插件**：sshp-1 的常驻版（自有 `/sshp/*` 路由 + 工具），配套 `patches/dsh-client-ui-workspace-share.patch` 菜单入口 |
| `dsh-model-select-provider-label` | 模型选择器增强 | 1.0.0 | **非动态插件**：触发按钮显示 提供商·模型·推理等级，级联面板 |

> 注：`dsh-mods-enhanced` / `dsh-session-share` / `dsh-model-select-provider-label` 是静态化常驻包
> （`~/.dsh/profiles/web/plugins/`），不是动态插件；随服务启动自动生效。

## 效果预览

各插件的界面效果见 `docs/screenshots/`（均为演示数据，金额/会话标题已替换或打码）：

| 插件 | 截图 |
|---|---|
| cost-6 费用行 / tokm-1 用量行 | ![统计栏](../docs/screenshots/1-cost-line.png) |
| cost-6 总账单页 | ![总账单](../docs/screenshots/2-billing.png) |
| cost-6 价格卡 | ![价格卡](../docs/screenshots/3-cost-settings.png) |
| cost-6 货币卡 | ![货币卡](../docs/screenshots/4-currency.png) |
| sntf-5 设置卡 | ![提醒卡](../docs/screenshots/5-notify.png) |
| imgr-3 图片转文字 | ![图片转文字](../docs/screenshots/6-imgr.png) |
| baln-4 余额徽标 | ![余额](../docs/screenshots/7-balance.png) |
