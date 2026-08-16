# dsh-plugins

存放 DeepSeek Harness（DSH）会话中由 AI 助手创建的**动态插件（Dynamic Cordis Plugin）源码**的仓库。

## 仓库用途

DSH 的动态插件是临时运行在 DSH 进程中的 Cordis 插件，由会话中的助手通过 `cordis_define` 定义。插件定义**不随进程重启保留**，因此本仓库用于：

- 持久化保存每个插件的 Host / Client 源码
- 记录插件的用途、运行状态与修复记录
- 需要时可通过源码在任何会话中重新创建（`cordis_define` + `cordis_run`）

## 目录结构

每个插件一个目录，以 `pluginId` 命名：

```
dsh-plugins/
├── README.md
└── <pluginId>/
    ├── README.md        # 插件用途、版本历史、运行说明
    ├── host.js          # Host 端源码（如有）
    └── client.js        # Client 端源码（如有）
```

## 如何使用

1. 在 DSH 会话中通过 `cordis_define` 创建或更新插件
2. 用 `cordis_inspect_self(pluginId, packageId)` 取出最新 Package 源码
3. 按上述结构保存到本仓库并提交

## 维护

- 使用 SSH 推送：`git@gitee.com:CGWP/dsh-plugins.git`
- 每次提交说明对应哪个插件、哪个 Package 版本
