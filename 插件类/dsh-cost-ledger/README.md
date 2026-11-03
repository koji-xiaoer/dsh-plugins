# dsh-cost-ledger — 费用账本

> **本目录是仓库发布副本**;本地运行版装在 profile `web` 的 `plugins/dsh-cost-ledger`
> (由 profile 的 pnpm `file:` 依赖链接)。安装/卸载见文末。

在 dsh 0.2.0-rc.2 上,按**每轮对话**和**每个会话**计算模型费用,并在设置里提供账本式面板。

## 功能

- **每轮费用徽标**:会话每轮动作行前显示 `本轮 ¥0.0234`,悬停看 tokens 分桶、原始美元金额、当日汇率。
- **会话累计**:会话头部显示 `本会话 ¥1.27`;输入框工具条里、模型选择器左侧再显示一枚只带金额的 `¥x.xx`,每 6 秒随对话刷新。
- **闲时 / 加价胶囊**:输入框工具条右侧、`¥x.xx` 左边显示当前时段 `闲时`(绿点)/ `加价中`(橙点);每 15 秒重算、每 5 分钟从账本同步一次时段与节假日,判定口径与按笔计价完全一致。
- **胶囊悬浮面板**:工具条里的 `闲时` 与 `¥x.xx` 支持「悬停展开 / 点击钉住 / 再点收起 / Esc 或点外部关闭」:
  - 闲时面板 = 北京时间 24 小时时段轴(琥珀色为加价带、竖线为当前时刻、0/6/12/18/24 刻度)+ 当前计价说明 + 下次切换(今天/明天 + 时间 + 约多久)+ 周末/节假日说明(周末当天多一行「今天…全天闲时」);
  - 费用面板 = 合计金额 + 估算徽标 + 合计 tokens/最近一轮 + tokens 四桶比例条(未命中/命中缓存/写入缓存/输出)+ 未定价与汇率提示 + 口径脚注;空会话显示「还没有可计费的使用记录」。
  - 面板材质与 dsh 菜单一致(`--dsw-menu-surface-fill` + 毛玻璃、`--dsw-radius-lg` 圆角),并 `portal` 到 `document.body` 定位(输入框工具条所在的 `.row` 有 `container-type: inline-size`,不 portal 的浮层会被顶出屏幕);「本轮」「本会话」两处原生 Tooltip 也加了 `portal`。
  - **样式命名一律 `dcl-hp-*` 前缀**:设置菜单里的 `.dcl-panel`(账本面板根节点)是既有类名,面板绝不复用/覆盖它,所以费用账本菜单的布局与交互完全不受影响。
- **搜索 / 抓取按次计费(2026-11-03)**:DeepSeek Search API / Fetch API 按「成功请求」计费(官方每 1000 次 ¥5,即 ¥0.005/次)。折叠时从会话日志的 `tool/call` + `tool/result` 配对统计:
  - `web_search`:一次调用 = N 个查询 = N 次 Search 请求,仅当合并结果非空(有来源)才计;
  - `web_fetch`:每次调用 = 1 次 Fetch 请求,仅当结果 `statusCode === 200` 且非报错才计;
  - 单价存 `state.json` 的 `servicePrices`(可改价),金额按费用发生当日汇率折算,计入总消耗/每日柱状图/每轮与每会话金额;设置页与 `¥x.xx` 悬停面板会显示「服务调用:搜索 N 次 · 抓取 M 次 · ¥X」。
- **检索内容 token 拆分(2026-11-03)**:单独估算搜索/抓取结果文本进入上下文占用的 token(口径与 dsh token-meter 一致:4 字符/token + 块/消息结构开销),并按该轮模型价格段折算「未命中输入价 / 命中缓存价」两种口径。**这部分 token 本来就包含在模型 usage 里,只做拆分展示、不重复计费**,设置页与费用面板分别显示。
- **价格账本(版本化)**:每个模型按“高峰/低谷”两档保存价格时段;每次抓取最新价格时,旧价保留为上一时段、新价从抓取时刻起生效,设置面板里按“生效时段”列出变更前/变更后。初始导入按当前官方文档价回溯。
- **按日汇率**:费用以美元计价,展示货币换算用的汇率**按费用产生当日**采集并落盘;没有对话的日子不采集,已有记录的日期不重复采集。数据源为 frankfurter(ECB 参考汇率),记录实际生效日(asOf)。
- **设置面板**:总消耗、今日/昨日、每日消耗柱状图(线性刻度,真实错落)、按路由统计、未定价路由提示、汇率记录表、`获取最新价格` / `按当前价格重算` / 刷新、货币切换(CNY/USD)。
- **预留给其它家模型**:价格模型与路由分离。`state.json` 里 `routes` 可把任意 `provider/model` 指向某个价格模型、标记 `free`,或留作未定价;`POST /cost-ledger/prices/manual` 可手动写入价格模型,`POST /cost-ledger/route` 可改路由映射。

## 计价口径

```
费用 = 未命中输入 × cacheMiss
     + 命中缓存   × cacheRead
     + 写入缓存   × cacheWrite(默认 = cacheMiss)
     + 输出       × output
```

价格单位是 **每百万 tokens** 的原始货币金额;按每笔对话**发生时刻**判定高峰/低谷并取该时刻生效的价格段,再按**费用发生当日**的汇率折算到展示货币。高峰时段为 UTC 周一至周五 01:00–04:00、06:00–10:00(官方口径),周末与 `holidays` 里的日期按低谷。DeepSeek 不单独收缓存写入费,故默认 `cacheWrite = cacheMiss`。

## 数据位置与安全

- 状态:`$DSH_HOME/storages/cost-ledger/state.json`
- 每次写入前:上一版留 `state.json.bak`;价格抓取/手动改价另存 `backups/state-<时间>-<标签>.json`(保留最近 30 份)。
- 首次建账会扫描 `$DSH_HOME/sessions` 下全部会话(只读),按会话缓存折叠结果;之后只增量重读活跃会话。

## HTTP 接口(同源,供客户端调用)

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/cost-ledger/session?sessionId=` | 单会话每轮费用与合计 |
| GET | `/cost-ledger/overview?days=30` | 总额、每日、按路由 |
| GET | `/cost-ledger/settings` | 价格时段、汇率、路由、未定价 |
| GET/POST | `/cost-ledger/prices/fetch` | 抓官方价目并落新价格时段 |
| GET | `/cost-ledger/currency?currency=CNY` | 切换展示货币 |
| POST | `/cost-ledger/route` | 配置路由计价方式 |
| POST | `/cost-ledger/prices/manual` | 手动写入价格模型 |
| GET | `/cost-ledger/recompute` | 全量重算 |

## 安装(profile)

```bash
# 1) 插件目录与依赖
cp -a dsh-cost-ledger ~/.dsh/profiles/web/plugins/
cd ~/.dsh/profiles/web && pnpm add file:plugins/dsh-cost-ledger

# 2) 在 cordis.patch.yml 追加
# - insert:
#     - id: dsh-cost-ledger
#       name: 'dsh-cost-ledger'

# 3) 重启 dsh web(systemd)
systemctl --user restart dsh-web
```

> ⚠️ 本机 profile 里的 `node_modules/dsh-cost-ledger/` 是一份**实体拷贝**(不是指向 `plugins/` 的软链),
> 运行时与 HMR 监听的都是 `node_modules` 这一份。改完 `plugins/dsh-cost-ledger/lib/client.js` 后必须同步:
>
> ```bash
> cp ~/.dsh/profiles/web/plugins/dsh-cost-ledger/lib/client.js \
>    ~/.dsh/profiles/web/node_modules/dsh-cost-ledger/lib/client.js
> ```
>
> 只改 `plugins/` 不会生效;同步后由 `@deepseek-ai/dsh-client-hmr` 自动热重载浏览器插件,无需重启 dsh-web。

## 已知限制

- 价格页解析针对 DeepSeek 官方英文价目页(`api-docs.deepseek.com/quick_start/pricing`)的表格结构;页面改版时解析会报错并保留旧价,不会静默写坏账本。
- 中国法定节假日未内置(`state.holidays` 留空时按工作日全额峰谷计算),需要时把日期填进 `state.holidays`。
- 金额为估算,不包含官方可能给出的折扣/代金券;以官方账单为准。
- 历史价格变更无法回溯(初始导入只有当前价);从插件启用之日起,每次抓取都会留下时段记录。

## 升级与兼容性

本插件不修改 dsh 安装文件,数据独立存放在 `$DSH_HOME/storages/cost-ledger/`,dsh 升级不会改动账本数据。但 dsh 的扩展点/字段仍可能随版本变化,升级前后请按下面检查:

1. **升级前**:跑 `dsh-upgrade-rehearsal` 技能里的预演(隔离实例),把本插件一起挂上;
2. **升级后**看自检:
   ```bash
   curl -s http://127.0.0.1:3080/cost-ledger/health
   ```
   关注 `missingServices` 为空、`coverage.ratio` 接近 1、`fold.errors` 为 0;
3. 打开 设置 → 费用账本,顶部“兼容性自检”行正常显示即通过;
4. 打开一个会话,确认会话头、模型选择器左侧、每轮徽标都有金额;
5. 点一次“获取最新价格”,确认价格页解析仍可用(解析失败会保留旧价并提示,不会写坏账本)。

**可能被升级影响的点**(每项都有可观察症状):

| 依赖 | 变化后的症状 | 现在的兜底 |
|---|---|---|
| 客户端插槽改名/移除 | 对应位置的金额消失 | 自检行会显示宿主侧异常;组件本身不崩 |
| 宿主服务(`sessionPersistence` 等)改名 | 折叠 0 个会话、金额为 0 | `/health` 的 `missingServices` + 折叠失败计数 |
| `assistant/message` 的 `usage`/`source` 字段改名 | 有对话但金额缺失 | usage 覆盖率低于 99.5% 时自检行黄色告警 |
| primitives(`Menu`/`Tooltip`/`Button`)改名 | 下拉/悬浮样式退化 | 运行期降级:无 Tooltip 则不加气泡,无 Menu 则退化原生 select,不会整块崩 |
| 官方价目页改版 | “获取最新价格”报错 | 保留旧价与旧时段,不写坏账本 |

**回滚**:恢复升级前备份的 `~/.dsh/profiles` 目录,或删除 `profiles/web/{plugins,node_modules}/dsh-cost-ledger` 与 `cordis.patch.yml` 里那条 insert 后重启。
