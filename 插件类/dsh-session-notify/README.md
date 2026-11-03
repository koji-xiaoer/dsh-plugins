# dsh-session-notify — 会话完成提醒(静态常驻包)

从动态插件 `sntf-5` + 补丁(`dsh-client-runtime-notify.patch` / ui-conversation 的 NotifyRow)
**改写为静态 bundle 插件**,不再依赖 `harness.handle` 与任何补丁 —— 目的是在 **0.2.0-rc.2** 上继续有完成提醒。

- **包名**:`dsh-session-notify`　**版本**:1.0.0
- **迁移时间**:2026-10-17(0.2.0-rc.2 升级预演期间)
- **前身**:`插件类/sntf-5`(动态插件,依赖 `harness.handle`)+ 2 个已失效补丁

## 为什么要重写(`sntf-5` 不能直接用)

| 依赖 | `sntf-5`(动态) | 本插件(静态) |
|---|---|---|
| 宿主 RPC | `harness.handle('notify-state')` —— 只有 cordis_run 动态宿主才有 | 自有同源 HTTP 路由 `GET /dsnf/state?sessionId=` |
| 客户端调用 | `host.call('notify-state', …)` | `fetch('/dsnf/state', …)` |
| 定时器 | `ctx.interval` / `ctx.timeout` | `setInterval` / `setTimeout`(React effect 内自管生命周期) |
| 样式 | 全局 `styles.insert()` | 自注入 `<style data-plugin-css="dsh-session-notify/ui.css">` |
| 加载方式 | 运行时动态安装(本机已无此通道) | profile bundle:静态挂载,重启即在 |

## 功能(与 sntf-5 / 原补丁逐项对齐)

- **宿主半**:监听 `agent/status`,维护每会话 running 状态与完成序号;另计全局序号兜底
- **引擎**(`conversation.session.header.utilities`,order 20,平时渲染 null):800ms 轮询
  - 运行中:标题闪烁 `● / ○` +「N 个会话运行中」
  - 完成:`✓ 会话已完成 · DeepSeek Harness` 闪 8 秒 + 右下角提醒卡(4.2s)+ 提示音
  - 空闲:标题恢复
- **声音**:chime(659.25/880Hz 正弦)/ bell(880/1318.51Hz 三角)/ 自定义音频(dataURL,>1 走 WebAudio 增益节点);最终电平 = 音量 × 增益
- **设置卡**(`settings.general.item`,id `notify`,order 40):声音/标题开关、音色分段、试听、音量 0–100%、增益 100–300%(250ms 防抖试听)、自定义音频上传(点击/拖放,≤1MB,MP3/WAV/OGG/WEBM)
- **偏好持久化**:沿用 `dsh.notify.sound` / `.title` / `.sound.source` / `.volume` / `.gain` / `.sound.data` / `.sound.name`
  —— 与原补丁/`sntf-5` **同一套键**,老配置自动继承

## 相对 `sntf-5` 的两处修正

1. **音量/增益默认值**:`Number(localStorage.getItem(k))` 在键不存在时得到 `0`(被当成「音量 0%」)。
   已改为「键缺失 → 0.8 / 1.0」,新环境开箱即可听到提示音。
2. **无 sessionId 也能提醒**:引擎的 `sessionId` 取自 slot props;取不到时路由回全局序号,
   不会因为 0.2.0 的 slot props 变化而静默失效。

## 实测证据(0.2.0-rc.2,隔离实例 3099)

| 项 | 结果 |
|---|---|
| `GET /dsnf/state` | `200 {"ok":true,"running":false,"runningCount":0,"completedSeq":0,…}`;`/dsnf/nonexistent` → 404 |
| 设置卡 | `.sntf-card` ×1、2 个标题、3 个音色分段、音量 80% / 增益 100%、2 个开关,**控制台零错误** |
| **真实会话完成** | 在页内发一轮真实请求(`回复两个字:好的` → 模型回「好的」),随后录到 `✓会话已完成` 提醒卡 + 标题 `✓ 会话已完成 · DeepSeek Harness`(8s 后恢复),宿主 `lastCompleted.sessionId` 为该真实 session,`globalSeq` +1 |
| 调试路由 | 已确认 404(合成转场用的 `/dsnf/debug-cycle` 只存在于测试副本,未进仓库) |

## 3. 0.2.0 的 slot 去重坑(2026-10-17 实战踩到并修好)

0.2.0 的 slot 注册规则变了:list slot 的 **同一个 `id` + 同一个 `priority`** 再注册一次会**直接抛错**,
整条 loader entry 失败,界面上就是「Failed to load plugins / failed to apply loader entry」:

```
list slot "settings.general.item" already has an entry with id "notify" at priority 0
(registered by <minified-module>) — register at a different priority to shadow it (lowest renders)
```

两条防线(都已实测):

1. **`priority: -1`** —— 两处注册(`settings.general.item` id `notify`、`conversation.session.header.utilities` id `sntf-status`)
   都带 `priority: -1`。规则是「优先级最低者渲染」,所以同 id 的旧实现(例如 0.1.x 的
   `dsh-client-ui-conversation.patch` 里那段 `id: "notify"` 的设置行,被 `patch` 以 fuzz 部分打到 0.2.0 上时仍会注册)
   会被**静默遮蔽**,而不是撞车报错。
2. **每次挂载用互不相同的 priority** —— 客户端维护 `mountSeq`,每个实例取 `priority = -1 - mountSeq++`:
   同一个包被挂两次(`cordis.patch.yml` 里两条 insert 行 / 0.2.0 启动重写 patch 层时又追加一条)时不会撞车,
   而且因为「最低优先级渲染」,**后挂载的实例赢、旧实例自动让位**;用计数器而不是布尔标志,
   客户端热重载后新实例照样能注册。
   宿主侧用 `globalThis[Symbol.for('dsh-session-notify.host-mounted')]` 防止重复注册 `/dsnf/state`,
   并在 `ctx.effect` 的 dispose 里释放,保证插件重启后还能重新挂载。

实测矩阵(隔离实例,0.2.0-rc.2):

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 有别的实现先占 `id=notify` @0 | `pageerror: already has an entry with id "notify" at priority 0` + 卡片消失 | 0 报错,`.sntf-card ×1`,旧实现被遮蔽(`.fake-notify-row ×0`) |
| 本插件被挂两次 + 有竞争者 | 同上(必然冲突) | 0 报错,卡片 ×1,`GET /dsnf/state` 仍 200(两种机制叠加验证) |
| 真实会话完成 | — | 提醒卡 `✓会话已完成` + 标题 `✓ 会话已完成 · DeepSeek Harness`,宿主 `globalSeq +1` |

## 依赖

| 类型 | 依赖 | 缺失影响 |
|---|---|---|
| 宿主服务 | `webServer`(`ctx.get('webServer')`) | 插件不挂载(静默返回) |
| 宿主事件 | `agent/status` | 无提醒 |
| 插件插槽 | `conversation.session.header.utilities` / `settings.general.item` | 相应 UI 不显示 |
| 浏览器全局 | `localStorage` / `Audio` / `AudioContext` / `document` / `FileReader`(均有守卫) | 相应能力降级 |

> `peerDependencies` 只声明 `@deepseek-ai/cordis`。**不要**在 peer 里写 `@deepseek-ai/dsh-*` 的旧版本范围 ——
> 0.2.0 的 peer 闸门(`dsh-app-boot`)会因此直接禁用插件。

## 安装

```bash
bash ~/dsh-plugins/scripts/install-session-notify.sh          # 自动备份 profile 后安装
# 或手动:拷到 <profile>/plugins 与 <profile>/node_modules,在 package.json 加
#   "dsh-session-notify": "file:plugins/dsh-session-notify"
# 并在 cordis.patch.yml 追加
#   - insert:
#       - id: dsh-session-notify
#         name: 'dsh-session-notify'
```

重启后验证:`curl -s http://127.0.0.1:3080/dsnf/state` 应返回 `{"ok":true,…}`;
设置 → 通用 里出现「会话完成提醒」卡。
