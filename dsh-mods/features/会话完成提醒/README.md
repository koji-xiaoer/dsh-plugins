# 会话完成提醒（Session Notify）

会话运行完成时在页面弹出提醒卡片（铃铛/窗口图标行 + 动画开关），可开启声音提示（Web Audio 振荡器）。

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-client-runtime-notify.patch` | `dsh-client-runtime/lib/client.js` | `notifyCompletion` / `Notify.ensureAudio`：完成提醒卡片、开关、音频提示 |
