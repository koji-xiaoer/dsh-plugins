# dsh-mods — 本机 DSH 界面自定义补丁集

本目录是**本机对 DeepSeek Harness (DSH) 安装包的自写改造**，按**实际功能**组织，一个功能一个名字。
这些改动不是官方插件，是直接修改安装包内编译产物实现的自定义功能。

> 原则：只归档**自己写/自己改**的内容；第三方插件与官方源码不在此仓库。

## 功能清单（一个功能一个名字）

| 功能 | 目录 | 说明 | 补丁数 |
|---|---|---|---|
| **余额查询** | `features/余额查询/` | `host.balance` API：总余额/赠送/充值余额查询 | 3 |
| **会话完成提醒** | `features/会话完成提醒/` | 完成提醒卡片 + 动画开关 + 声音提示 | 1 |
| **费用预估与账单明细** | `features/费用预估与账单明细/` | 预估卡片、峰谷时段条、价格输入、账单明细弹窗、折叠回复预览 | 1 |
| **账单接口优化** | `features/账单接口优化/` | `usageOnly` 折叠，历史拉取传输量降到千分之一 | 1 |
| **粘贴图片转文字** | `features/粘贴图片转文字/` | GLM 识别 + 图片字节缓存 + DeepSeek 适配器放行 | 2 |
| **Token 用量统计** | `features/Token用量统计/` | 按模型维度的 token 用量投影 | 1 |

每个功能目录内含 `README.md`（功能说明 + 补丁与改动位置对照）。

## 目录结构

```
dsh-mods/
├── README.md           # 本文件：功能清单与维护约定
├── UI-GUIDE.md         # 界面改动规范：设计语言、令牌用法、修改/HMR/补丁工作流
└── features/
    ├── 余额查询/            (balance-api)
    ├── 会话完成提醒/        (session-notify)
    ├── 费用预估与账单明细/  (cost-estimate-ui)
    ├── 账单接口优化/        (billing-usageonly)
    ├── 粘贴图片转文字/      (image-relay)
    └── Token用量统计/       (token-meter)
```

> 补丁文件名保留安装包原名（如 `dsh-client-ui-conversation.patch`），因为本机
> `~/.dsh/scripts/reapply-dsh-mods.sh` 按原名引用；功能划分体现在目录上。

## 使用方法

本机实际使用以 `~/.dsh/scripts/reapply-dsh-mods.sh` 为准（补丁在 `~/.dsh/patches/`，与仓库 features/ 内容同步）。
仓库副本可用于异地恢复：

```bash
DSH_PATCH_DIR=<本仓库>/增强主页类/dsh-mods/features/余额查询 bash dsh-mods/scripts/reapply-dsh-mods.sh 2>/dev/null \
  || DSH_PATCH_DIR=<本仓库>/增强主页类/dsh-mods/features/会话完成提醒 bash dsh-mods/scripts/reapply-dsh-mods.sh ...
```

> 注意：`reapply-dsh-mods.sh` 按补丁清单逐个应用，副本恢复时需按脚本内清单把各功能目录的补丁
> 汇总到同一 PATCH_DIR（`find 增强主页类/dsh-mods/features -name '*.patch' -exec cp {} <dir>/ \;`）再执行。

重放后需重启服务：`systemctl --user restart dsh-web`。

## 维护约定

- **dsh 升级会覆盖这些改动**：升级后重新执行 reapply 脚本即可恢复；
- **改了新界面功能**：`bash ~/.dsh/scripts/reapply-dsh-mods.sh --capture` 重新捕获补丁，并把更新后的
  `.patch` 同步回对应功能目录、`UI-GUIDE.md` 同步回本仓库提交；
- **改 UI 前**：先读 `UI-GUIDE.md`，遵循现代卡片设计语言与设计令牌，改完 `node --check` 并通过 HMR 验证。

## 涉及的本机路径（归档说明）

- 安装包根：`/home/claude/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh/`
- 补丁目标均为 `node_modules/@deepseek-ai/*/lib/client.js` 或 `lib/index.js` 等编译产物
- 设置持久化：`~/.dsh/settings.yaml` 的 `ui-conversation` 命名空间

---

## 迁移状态(2026-08-18)

以下功能已迁移为动态 Cordis 插件(`插件类/`),补丁保留作历史归档与回退:

| 功能 | 插件 | 状态 | 退役补丁 |
|---|---|---|---|
| 余额查询 | `插件类/baln-4/` | ✅ 运行中 | 余额查询 3 补丁 |
| 会话完成提醒 | `插件类/sntf-5/` | ✅ 运行中 | dsh-client-runtime-notify.patch |
| 粘贴图片转文字 | `插件类/imgr-3/` | ✅ 运行中(agent/pre-step 拦截) | dsh-host-apiproxy.patch、dsh-llm-deepseek.patch |
| Token 用量统计 | `插件类/tokm-1/` | ✅ 运行中(投影注册) | dsh-token-meter.patch |
| 费用预估与账单明细 | `插件类/cost-6/` | 🔄 v1 运行中(费用行/总账单),v2 待补 | dsh-client-ui-conversation.patch(部分) |
| 账单接口优化(usageOnly) | — | ❌ 不可迁移(宿主内部查询优化);费用 UI 改走 Host 折叠 RPC 后动机消失 | dsh-session-schema.patch |

迁移细节与可行性矩阵见 `docs/迁移为插件-梳理与计划.md`。
