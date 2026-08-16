# 配置文件网页编辑器（cfgf-1）

在设置页新增「**配置文件**」页面：直接在网页内查看/编辑 `~/.dsh/settings.yaml`，
无需依赖系统原生打开器。

## 背景

设置页的「打开配置文件」按钮依赖 `xdg-open` 等系统原生打开器，在本机（无显示服务器环境，
`DISPLAY`/`WAYLAND_DISPLAY` 为空）必然失败。本插件提供网页内替代方案，同时保留原生按钮不动。

## 功能

- 设置页新增「配置文件」页面（`settings.section`，id: `config-file`，order: 30）
- **加载时移除原「打开配置文件」按钮**（覆盖 `settings.action` 的 `open-document` 席位为空实现；
  插件停止后原按钮自动恢复）
- 显示配置文件绝对路径；等宽字体编辑区，可编辑 YAML 并保存
- **密钥默认脱敏**：敏感字段（apiKey/token/secret/password 等）值在页面中显示为 `***`
- 「显示密钥值」：有敏感字段时切换为明文并显示警示条；**无敏感字段时提示
  「配置文件中未检测到敏感字段，当前显示完整内容」**（避免"点了没反应"的困惑）
- 保存时 `***` 行自动还原为原密钥值，网页编辑不会丢失或改写密钥
- 「重新加载」按钮重新读取磁盘内容

## 架构

| 端 | 方法 | 说明 |
|---|---|---|
| Host | `cfg.read` | `settings.prepareDocument()` 取路径 → `fs.readText` → 返回 `{ok, path, text, redacted}` |
| Host | `cfg.save` | 读取原文 → 合并（`***` 行还原原文）→ `fs.writeText`（带 sandbox 策略） |
| Client | `settings.section` 注册 | 页面 UI（React，无 JSX），Package 私有 RPC 调 Host |

## 恢复/运行方式

```text
cordis_define:  pluginId=cfgf-1（kind: new 或 existing），code.host=host.js，code.client=client.js
cordis_run:     pluginId=cfgf-1, packageId=<最新 packageId>, mode=run/update
```

## 版本历史

| Package | 内容 | 状态 |
|---|---|---|
| pkg-1 | 仅 Host 端定义 | 被 pkg-2 取代 |
| pkg-2 | Host + Client 完整版 | 被 pkg-3 取代 |
| pkg-3 | 移除「打开配置文件」按钮 + 显示密钥值区分有无敏感字段 | **当前运行**（run-7） |

## 安全设计

- 密钥值默认不离开 Host 的脱敏视图；明文仅在用户主动点击「显示密钥值」后进入编辑区
- 保存合并逻辑：编辑内容中值为 `***` 的行替换为原文件对应行，其余行以编辑内容为准
- 读取/写入均经由 `fs` 服务（受 sandbox 策略约束），Host 不把路径选择权交给浏览器
