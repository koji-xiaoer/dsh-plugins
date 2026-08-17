# sntf-5 — 会话完成提醒(Session Notify)

从 dsh-mods 补丁功能 **会话完成提醒**(`dsh-client-runtime-notify.patch` + ui-conversation 的 NotifyRow)迁移的动态 Cordis 插件。

- **pluginId**: `sntf-5`(idPrefix `sntf`),迁移时间 2026-08-18
- **原实现**: 安装包内 `dsh-client-runtime` 的 DshNotify 类 + 设置卡 NotifyRow

## 功能

- **Host**: 监听 `agent/status`,维护每会话 running 状态与完成序号(completedSeq,running→idle 递增);RPC `notify-state`
- **Client 引擎**(header.utilities order 20,渲染 null):800ms 轮询,检测完成事件 → 提示音 + 标题 ✓ 闪 8s + 右下角提醒卡片(4.2s);运行中标题 ●/○ 闪烁;空闲恢复原标题
- **声音**: chime(双音正弦 659.25/880Hz)/ bell(三角波 880/1318.51Hz)合成;custom dataURL(≤1 用 audio.volume,>1 走 WebAudio 增益节点);失败回退 chime;最终电平 = 音量 × 增益
- **设置卡**(settings.general.item id=notify order 40): 声音/标题开关、音色分段、试听、音量(0-100%)与增益(100-300%)滑块(250ms 防抖试听)、自定义音频上传(点击/拖放,≤1MB,MP3/WAV/OGG/WEBM)/移除
- **偏好持久化**: localStorage `dsh.notify.sound` / `.title` / `.source` / `.data` / `.name` / `.volume` / `.gain`,运行时现读,零服务跳转(与原版一致)

## 版本

| packageId | 说明 | 状态 |
|---|---|---|
| pkg-6 | 完整 DshNotify 行为 + NotifyRow 设置卡 | 运行中 |

## 依赖

| 类型 | 依赖 | 缺失影响 |
|---|---|---|
| 宿主事件 | `agent/status`(emit) | 无提醒 |
| 平台 | Host harness RPC + Client slots/timer | 界面不显示 |
| 浏览器全局 | `localStorage`/`Audio`/`document`/`FileReader`(均有守卫) | 相应功能降级 |
| 补丁 | dsh-client-runtime-notify = 替代;NotifyRow 同 cell(id=notify)替换;`dsh.notify.*` 键数据兼容 | 共存兼容 |

完整依赖关系与规则见 `docs/插件依赖关系.md`。
