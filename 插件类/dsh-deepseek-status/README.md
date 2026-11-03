# dsh-deepseek-status — DeepSeek 服务状态胶囊 + 悬浮面板

> **本目录是仓库发布副本**;本地运行版由 `plugin_manager` 以 bundle 形式装在 profile `web` 里
> (依赖 `link:` 指向本目录或本地工作副本)。安装/卸载见文末。

在输入框工具条里,在费用账本的「闲时 / 加价中」胶囊和「¥x.xx」会话计费胶囊**旁边**
(整组最左侧,`order: 2`)显示一枚 DeepSeek 服务状态胶囊:数据来自
[status.deepseek.com](https://status.deepseek.com/),每分钟刷新一次。

胶囊样式与费用账本插件的两枚胶囊使用同一套度量(高 22px、圆角 999px、12px/20px 字号、
平台底色、6px 圆点、12% 底色与 20% 悬停),三种状态配色沿用同一套设计令牌:

| 状态 | 文案(中文) | 颜色 |
|---|---|---|
| 运行正常 | DeepSeek 正常 | 绿点 + 绿色底(`--dsw-alias-state-success-primary`) |
| 性能下降 / 部分中断 | DeepSeek 降级 / 部分中断 | 琥珀点 + 琥珀底(`--dsw-alias-state-warn-primary`) |
| 服务中断 | DeepSeek 中断 | 红点(带呼吸外环)+ 红色底(`--dsw-alias-state-error-primary`) |
| 计划维护 | DeepSeek 维护中 | 蓝点 + 蓝色底(`--dsw-alias-brand-primary`) |
| 拿不到数据 | DeepSeek 状态未知 | 灰点 + 平台底色 |

## 悬停面板

悬停或点击胶囊展开一块结构化面板(与 dsh 自己的菜单同一套「毛玻璃」材质:
`--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter`,16px 圆角,`--dsw-alias-border-l2` 描边):

```
● DeepSeek 服务状态              [运行正常]  ↻
最近检查 11/03 20:52 · 每分钟刷新
────────────────────────────────
组件                                近 30 天
● V4 Pro API服务    ▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍●  99.40%
● V4.1 Flash API服务 ▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍▍ 99.26%
…(7 个组件,每行 30 格 = 近 30 天逐日状态,悬停看当天状态)
────────────────────────────────
最近事件                            3
● 已解决 · 2 小时前  DeepSeek 网页/API 部分中断（…）
● 已解决 · 7 天前    DeepSeek API 性能下降（…）
● 已解决 · 14 天前   搜索服务异常（…）
────────────────────────────────
数据源 status.deepseek.com        打开状态页 ↗
```

交互:

| 操作 | 行为 |
|---|---|
| 悬停胶囊 | 120ms 后展开面板 |
| 鼠标移入面板 | 保持展开(可点刷新、可滚动) |
| 移开 | 240ms 后收起 |
| 点击胶囊 | 钉住面板,再点一次收起 |
| Esc / 点面板外 | 收起 |
| 面板右上 ↻ | 带 `?refresh=1` 立即重拉(绕过服务端缓存) |
| 页脚「打开状态页」 | 新标签打开 status.deepseek.com |
| 键盘 Tab 聚焦胶囊 | 展开面板;`aria-expanded`/`aria-controls` 同步 |

面板定位:贴胶囊上沿、右对齐;上方放不下翻到下方,两侧都放不下时贴边并限制
`max-height` 滚动;**任何情况下都不会盖住胶囊本身**(点击/悬停都不受影响)。
面板通过 `react-dom` 的 `createPortal` 挂到 `document.body`:

> 输入框工具条所在的 `.row` 声明了 `container-type: inline-size`,现代 Chromium 会把它
> 当成 `position: fixed` 子元素的包含块,挂进去的浮层会被整体偏移到屏幕外;portal 之后
> 定位恢复正常。(费用账本两枚胶囊的原生 Tooltip 没有 portal,在本机浏览器里提示气泡
> 会跑到屏幕外,与本插件无关。)

## 数据链路

状态页的浏览器请求没有 CORS 头,客户端不能直接跨域抓取,因此由宿主半抓取 + 缓存,
客户端只请求同源接口:

```
浏览器胶囊  ──GET /deepseek-status/summary──▶  宿主半(缓存 60s)
                                                 │
                                                 ├─▶ /api/status-page/<page>/summary/active
                                                 ├─▶ /api/status-page/<page>/change/list      (近 30 天事件)
                                                 └─▶ /api/status-page/<page>/summary/structure(可用率 + 逐日影响,缓存 10min)
```

- 逐日格子:把 `structure.component_impacts` 按 Asia/Shanghai 切天,一天里最严重的影响
  决定该格状态;组件 `available_since_seconds` 之前的日子标记为未知。
- 上游抓取失败时:有旧快照就继续展示并在面板里标注「展示的是上一次成功的数据」;
  没有旧快照就是灰色「状态未知」胶囊,不会阻塞界面。
- 同一进程内所有标签页共用一个快照,不会翻倍打上游。

> 注意:宿主半是 Node 模块,改动后不会热更。**升级本插件宿主代码后需要重启一次
> `dsh-web`**,新的 `history` 字段才会出现在接口里(客户端会优雅降级:没有 `history`
> 时只是不画逐日格子,面板其余部分照常工作)。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主半:注册 `/deepseek-status/summary` 同源路由 |
| `lib/status.js` | 抓取 + 归一化(含逐日格子) + 缓存;`normalize()` 可单测 |
| `client.js` | 客户端:胶囊 + 悬浮面板,注册到 `conversation.input.right`,注入样式与中英字典 |
| `test/normalize.mjs` | 自测:固定样本(含逐日格子) + 线上真实接口 |
| `cordis.patch.yml` | bundle 补丁:插入宿主插件行 |

## 安装 / 卸载

安装(profile `web`,已安装):

```
plugin_manager action=install_bundle target=/home/claude/dsh-plugins/插件类/dsh-deepseek-status
```

卸载:

```
plugin_manager action=remove_bundle target=dsh-deepseek-status
```

自测:

```
node test/normalize.mjs
```

## 接口

```
GET /deepseek-status/summary            状态快照(服务端 60s 缓存)
GET /deepseek-status/summary?refresh=1  跳过缓存立即抓取(面板刷新按钮/调试用)
```

快照字段:

| 字段 | 说明 |
|---|---|
| `ok / source / checkedAt / cached / stale` | 快照元信息 |
| `overall` | `operational / degraded / partial_outage / full_outage / maintenance / unknown` |
| `components[]` | `{ id, name, sectionId, status, uptime, availableSince, history[] }` |
| `components[].history[]` | `{ day: "2026-11-03", status }`,长度 = `uptimeWindowDays`(30) |
| `activeChanges[]` | 当前事件:`{ id, type, status, title, startedAt, latestUpdate }` |
| `recentIncidents[]` | 最近 3 条已解决事件:`{ id, title, status, closedAt }` |
