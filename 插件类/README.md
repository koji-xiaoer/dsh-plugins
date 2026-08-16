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
| `cfgf-1` | 配置文件网页编辑器 | pkg-2（运行中） | 设置页新增「配置文件」页面，网页内查看/编辑 settings.yaml，密钥脱敏 |
