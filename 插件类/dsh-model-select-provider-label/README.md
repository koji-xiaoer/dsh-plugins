# dsh-model-select-provider-label

**模型选择器增强(静态化常驻包)**

对话输入框的模型选择器增强:触发按钮直接显示 **提供商 · 模型 · 推理等级**,大提供商折叠为**级联面板**(类别 → 三级模型列表 + 返回),一眼分辨模型来自哪家、属于哪类。

> 静态化常驻包:挂载于 `~/.dsh/profiles/web/plugins/`,随 dsh web 启动自动加载,非动态插件(进程重启不丢失)。

## 功能

| 能力 | 说明 |
|---|---|
| 触发按钮显示提供商 | `DeepSeek · DeepSeek-V4-Flash High`——不用点开就知道模型来自哪家提供商 |
| 大分类折叠 | 模型数 > 8 的提供商折叠为一行 `提供商名 数量 ▸`,点击展开面板 |
| 类别三级菜单 | 面板内先列类别(对话/推理、多模态/视觉、代码、图像/视频生成、嵌入/向量、3D 生成),点击类别进入三级模型列表,顶部 `← 返回` 回类别 |
| 面板向上展开 | 锚定菜单底部、向上生长,超出页面底部自动钳制;右侧溢出自动翻转到左侧 |
| 小分类平铺 | ≤8 个模型的提供商保持直接平铺,不打断选择流程 |
| 分类规则 | 按模型 id 前缀/关键字归类(`embedding`/`code`/`seedream|seedance|wan`/`3d`/`vision`…),未匹配归「对话/推理」 |

## 文件结构

```
dsh-model-select-provider-label/
├── package.json   # 包声明(dsh.client 平台 web)
└── lib/
    ├── index.js   # host 半区(空)
    └── client.js  # client 半区:模型选择器替换实现
```

## 安装(部署到 dsh)

1. 将 `dsh-model-select-provider-label/` 目录放入 `~/.dsh/profiles/web/plugins/`
2. 复制一份到 `~/.dsh/profiles/web/node_modules/dsh-model-select-provider-label/`(file: 依赖的实际加载副本)
3. `~/.dsh/profiles/web/package.json` 的 dependencies 增加:
   `"dsh-model-select-provider-label": "file:plugins/dsh-model-select-provider-label"`
4. `~/.dsh/profiles/web/cordis.patch.yml` 增加:
   ```yaml
   - insert:
       - id: dsh-model-select-provider-label
         name: 'dsh-model-select-provider-label'
   ```
5. 重启 dsh web:`bash ~/.dsh/scripts/restart-dsh-web.sh`,浏览器强制刷新

## 修复记录

| 版本 | 问题 | 修复 |
|---|---|---|
| v1 | `TypeError: t is not a function` | 组件签名多了解构 `t` 参数,但静态版未通过 slot `locale:` 注入 → 去掉签名参数 |
| v2 | `ReferenceError: t is not defined` | `t` 定义在 `apply()` 内部,组件在模块顶层访问不到 → 提升为模块级函数,`apply()` 注入 `localeRef` |
| 槽位冲突 | `single slot "conversation.input.model" already has a registration at priority 0` | shipped `x6` 已占 priority 0,同一优先级重复注册抛错 → `register` 加 `priority: -1`(最低优先渲染,shadow 内置) |

## 备注

- 触发按钮替换 shipped `conversation.input.model` seat(单 occupant,`replaceRisk: shadows-shipped-ui`),数据仍走同一 `modelDirectories` 服务,选择状态与 `/model` 命令共享。
- 折叠阈值 `FOLD_THRESHOLD = 8` 在 client.js 内可调。
