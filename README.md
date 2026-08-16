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

## 提交审查（防密钥泄露）

本仓库是**公开**仓库：任何密钥一旦提交即视为泄露，必须立即吊销。提交前强制遵守：

1. **每次提交前运行扫描**：`scripts/check-secrets.sh --all`
   - 退出码 `1`（CRITICAL：私钥、`sk-` 开头的 DeepSeek/OpenAI 等平台 key、智谱 GLM 的 `<32位hex>.<密钥段>` 格式、JWT、百度 `bce-v3/ALTAK`、腾讯 `AKID`、GitHub/GitLab/Slack/AWS/Google token、硬编码的 Authorization、URL 内嵌账号密码）→ **禁止提交**，将密钥替换为 `<YOUR_XXX>` 占位符；
   - 退出码 `2`（WARNING：32/40 位十六进制串、`password`/`api_key`/`secret` 等敏感字段的赋值、`Bearer xxx` 等）→ **逐条人工审查**；
   - 确认为误报的，将 `相对路径:整行内容` 追加到 `scripts/secret-allowlist.txt`，并写一行 `# 理由`；
2. **插件源码规则**：不得硬编码任何密钥/token，一律使用 `<YOUR_XXX_TOKEN>` 占位符，运行时从环境变量或独立配置文件读取；
3. **本地自动拦截**：已启用 pre-commit 钩子（`git config core.hooksPath hooks`），每次 `git commit` 自动扫描暂存区，命中即中止提交；
4. **若怀疑密钥已泄露**：立即到 https://gitee.com/profile/personal_access_tokens 吊销对应令牌，再处理仓库历史。

## 如何使用

1. 在 DSH 会话中通过 `cordis_define` 创建或更新插件
2. 用 `cordis_inspect_self(pluginId, packageId)` 取出最新 Package 源码
3. 按上述结构保存到本仓库并提交

## 维护

- 使用 SSH 推送：`git@gitee.com:CGWP/dsh-plugins.git`
- 每次提交说明对应哪个插件、哪个 Package 版本
