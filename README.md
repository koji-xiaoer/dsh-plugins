# dsh-plugins

存放 DeepSeek Harness（DSH）会话中由 AI 助手创建的**动态插件（Dynamic Cordis Plugin）源码**的仓库。

## 仓库用途

DSH 的动态插件是临时运行在 DSH 进程中的 Cordis 插件，由会话中的助手通过 `cordis_define` 定义。插件定义**不随进程重启保留**，因此本仓库用于：

- 持久化保存每个插件的 Host / Client 源码
- 记录插件的用途、运行状态与修复记录
- 需要时可通过源码在任何会话中重新创建（`cordis_define` + `cordis_run`）

## 目录结构（顶层分类）

```
dsh-plugins/
├── README.md            # 本文件
├── README.en.md         # 英文版说明
├── scripts/             # 仓库工具：密钥审查扫描、一键安装、任务花费预估
├── hooks/               # pre-commit 钩子
├── patches/             # 分发用补丁（ui-conversation.patch，配合 scripts/install.sh）
├── docs/                # 设计/依赖关系/迁移计划文档
├── 插件类/              # 动态插件：本助手创建的插件，每插件一个目录（按 pluginId）
│   └── dsh-mods-enhanced/  # 静态化常驻包：5 个动态插件的合并版（profile 静态插件）
├── 增强主页类/          # 界面/主页增强：自写界面改造
│   └── dsh-mods/        #   现有补丁集，按功能组织（余额查询/完成提醒/费用账单/图片转文字…）
└── 其他/                # 杂项：不属于以上两类的归档
```

**归档规则**：动态插件 → `插件类/`；界面/主页增强 → `增强主页类/`；其余 → `其他/`。
新插件结构（`插件类/<pluginId>/`）：

```
插件类/<pluginId>/
├── README.md        # 插件用途、版本历史、运行说明
├── host.js          # Host 端源码（如有）
└── client.js        # Client 端源码（如有）
```

**插件两种形态**：

| 形态 | 说明 | 例子 |
|---|---|---|
| 动态插件 | 会话内 `cordis_define` 定义、`cordis_run` 运行，进程重启即失 | `插件类/baln-4/` 等 |
| 静态化常驻包 | profile 静态插件，随 dsh web 启动自动加载，免手动运行 | `插件类/dsh-mods-enhanced/`（合并 baln-4/sntf-5/tokm-1/imgr-3/cost-6） |

## 提交审查（防密钥泄露）

本仓库是**公开**仓库：任何密钥一旦提交即视为泄露，必须立即吊销。提交前强制遵守：

1. **每次提交前运行扫描**：`scripts/check-secrets.sh --all`
   - 退出码 `1`（CRITICAL：私钥、`sk-` 开头的 DeepSeek/OpenAI 等平台 key、智谱 GLM 的 `<32位hex>.<密钥段>` 格式、JWT、百度 `bce-v3/ALTAK`、腾讯 `AKID`、GitHub/GitLab/Slack/AWS/Google token、硬编码的 Authorization、URL 内嵌账号密码）→ **禁止提交**，将密钥替换为 `<YOUR_XXX>` 占位符；
   - 退出码 `2`（WARNING：32/40 位十六进制串、`password`/`api_key`/`secret` 等敏感字段的赋值、`Bearer xxx` 等）→ **逐条人工审查**；
   - 确认为误报的，将 `相对路径:整行内容` 追加到 `scripts/secret-allowlist.txt`，并写一行 `# 理由`；
2. **插件源码规则**：不得硬编码任何密钥/token，一律使用 `<YOUR_XXX_TOKEN>` 占位符，运行时从环境变量或独立配置文件读取；
3. **本地自动拦截**：已启用 pre-commit 钩子（`git config core.hooksPath hooks`），每次 `git commit` 自动扫描暂存区，命中即中止提交；
4. **若怀疑密钥已泄露**：立即到 https://github.com/settings/tokens 吊销对应令牌，再处理仓库历史。

## 一键安装

本仓库根目录声明了 `dsh.bundle`(见 `package.json` + `cordis.patch.yml`),可作为 **DSH profile bundle** 标准安装:

```bash
dsh plugin --profile web add github:koji-xiaoer/dsh-plugins
```

该命令会通过 pnpm 安装本仓库(包名 `dsh-mods-enhanced`,即 `插件类/dsh-mods-enhanced` 的合并增强插件:余额查询 / 会话完成提醒 / 费用预估与账单明细 / 粘贴图片转文字 / Token 用量统计),自动将其插入 web profile,重启 `dsh web` 后生效(插件声明了 `dsh.client`,前端模块随之注入)。

> 注意:需要 PATH 上有 pnpm(Node.js >= 20 自带 corepack,`corepack enable` 即可)。

若需要同时应用 **ui-conversation 客户端增强补丁**(费用预估 / 账单 / 货币 / 通知 / 余额界面增强,属于对 dsh 安装文件的文本补丁,bundle 机制无法覆盖),再执行传统脚本:

```bash
git clone git@github.com:koji-xiaoer/dsh-plugins.git
cd dsh-plugins
bash scripts/install.sh
```

脚本会自动完成:

1. 安装 `@deepseek-ai/dsh@0.1.1-rc.1`
2. 应用 `patches/ui-conversation.patch` + `patches/dsh-host-apiproxy-0.1.1.patch`（费用预估 / 账单 / 货币 / 通知 / 余额；见 `scripts/reapply-dsh-mods.sh`）
3. 把 `dsh-mods-enhanced` 插件装进 web profile（完成提醒 / token 投影）
4. 配置 `package.json` + `cordis.patch.yml`

装完重启 `dsh web --port 3080` 即可。余额查询需 `DEEPSEEK_API_KEY`。

> 注意:补丁**锁定 dsh 0.1.1-rc.1**。0.1.1-rc.1 起原生支持多模态（`deepseek-v4-flash-vision-exp`），
> 粘贴图片可走原生视觉；本套补丁已**移除图片转文字中继与对话折叠功能**（不再维护）。

**2026-08-21 修复（费用实时刷新）**：账单/会话统计栏的费用此前在单个回合内不刷新——折叠缓存失效键用 `updatedAt`（仅用户发消息才推进），回合内 agent 连续产生的 LLM 调用费用会冻结在"最后一条用户消息"时刻（表现为"本次对话没有价格"）。已改为投影 `asOfSeq`（每条已提交事件推进）作为失效键（`session.cost` / `session.costDetail` 共 5 处），费用随 5 秒轮询实时更新；并修正 `scripts/reapply-dsh-mods.sh` 中 apiproxy 补丁原始备份文件名笔误（`index.orig.js` → `index.js.orig`）。

## 效果预览

> 截图取自本机实际运行画面,金额/会话标题等均已替换为**演示数据**或打码,不包含真实敏感信息。

| 功能 | 截图 | 说明 |
|---|---|---|
| 会话统计栏 | ![费用行](docs/screenshots/1-cost-line.png) | 轮次/时长/Token 用量/预估费用(对应 cost-6 费用行 + tokm-1 用量行) |
| 总账单 | ![总账单](docs/screenshots/2-billing.png) | 全会话费用表(费用预估与账单明细,cost-6) |
| 费用预估设置卡 | ![费用预估卡](docs/screenshots/3-cost-settings.png) | 自定义每模型价格 + 峰谷价说明(cost-6) |
| 账单货币卡 | ![货币卡](docs/screenshots/4-currency.png) | 15 币种切换/汇率(cost-6) |
| 会话完成提醒 | ![提醒设置卡](docs/screenshots/5-notify.png) | 音色/音量/增益/试听/自定义音频(sntf-5) |
| 粘贴图片转文字 | ![图片转文字](docs/screenshots/6-imgr.png) | 图片经 GLM 识别替换为文字描述(imgr-3) |
| 账户余额 | ![余额](docs/screenshots/7-balance.png) | 总账单页顶部余额徽标(金额打码,baln-4) |

## 如何使用

1. 在 DSH 会话中通过 `cordis_define` 创建或更新插件
2. 用 `cordis_inspect_self(pluginId, packageId)` 取出最新 Package 源码
3. 按上述结构保存到本仓库并提交

## 维护

- 使用 SSH 推送：`git@github.com:koji-xiaoer/dsh-plugins.git`
- 每次提交说明对应哪个插件、哪个 Package 版本

## 许可证

[MIT](LICENSE) © 2026 koji-xiaoer (CGWP)
