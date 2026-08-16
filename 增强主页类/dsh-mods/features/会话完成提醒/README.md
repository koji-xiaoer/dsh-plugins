# 会话完成提醒（Session Notify）

会话运行完成时在页面弹出提醒卡片（铃铛/窗口图标行 + 动画开关），可开启声音提示。

## 功能

- **声音提示**（`dsh.notify.sound` 开关）：会话完成时播放提示音
- **动态标题**（`dsh.notify.title` 开关）：网页标题实时显示运行状态（运行中闪烁 ●/○、完成闪 ✓、完成数徽标）
- **可自定义提示音**（v2）：
  - 三种音色：**默认提示音**（双音正弦合成）、**清脆铃声**（三角波双音）、**自定义音频**（用户上传）
  - 分段切换器选择音色；「试听」按钮随时预览当前音色
  - 自定义音频：`选择音频文件`（accept 限定音频格式）→ FileReader 读为 dataURL → 存 localStorage
    `dsh.notify.sound.data`（文件名存 `dsh.notify.sound.name`）；「移除」可清除
  - **格式标注**：支持 MP3 / WAV / OGG / WEBM · 建议时长 ≤ 3 秒 · 文件 ≤ 1 MB（超限提示错误）
  - 播放分派：`bell` 用三角波合成；`custom` 用 `Audio(dataURL)` 播放，失败自动回退默认提示音
- 偏好全部存 localStorage（`dsh.notify.sound` / `dsh.notify.sound.source` / `dsh.notify.sound.data` /
  `dsh.notify.sound.name` / `dsh.notify.title`），设置页与运行时经 localStorage 同步，无服务跳转
- 每个 DOM/audio 访问都有守卫：bundle 在非浏览器测试宿主下不崩溃

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-client-runtime-notify.patch` | `dsh-client-runtime/lib/client.js` | `DshNotify`：`chime`/`bell` 合成、`playSound` 音色分派（含 custom dataURL 播放 + 回退）、`notifyCompletion`、动态标题 `tick` |
| `dsh-client-ui-conversation.patch` | `dsh-client-ui-conversation/lib/client.js` | `NotifyRow` 设置卡片：提示音/动态标题开关 + 音色分段切换 + 试听 + 上传/移除 + 格式时长提示（字典 `settings.notify.*`） |

> 设置页 UI 与「费用预估与账单明细」共用同一套卡片/分段切换/开关样式（`CostEstimateRow` CSS 模块），见 `dsh-mods/UI-GUIDE.md`。
