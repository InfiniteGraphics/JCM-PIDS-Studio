# JS PIDS Visual Editor — Development Notes

> 写给未来的自己看的开发文档。这里不追求对外宣传，而是记录当前实现、设计取舍、JCM 约束、代码结构和后续开发路线。

## 0. 项目定位

这个项目是一个 Web-first 的 JCM Scripted PIDS 可视化编辑器。目标不是做一个通用 JS IDE，而是做一个面向 PIDS preset 的低代码布局编辑器：

```text
可视化布局 -> Project JSON AST -> JCM JavaScript -> Resource Pack ZIP
```

核心设计原则：

1. **项目数据优先保存为 JSON AST**，不要以手写 JS 作为主数据源。
2. **JS 是 codegen 输出物**，用户可以看、导出、复制，但 editor 的 round-trip 应该依赖 project JSON 或 embedded metadata。
3. **PIDS row 是一等模型**，不要把 arrival rows 当成复制出来的静态元素。
4. **UI layer 顺序必须稳定映射到 JCM draw order / z-order**。
5. **Web MVP 先跑通全链路**，暂时不考虑 Tauri、本地文件夹写入和自动更新。

## 1. 重要参考资料

必须经常对照这两份文档，不要凭感觉猜 JCM API：

- JCM PIDS Scripting API: https://jcm.joban.org/v2.2/dev/scripting/type/pids/
- Scripted PIDS Preset Tutorial: https://jcm.joban.org/v2.2/dev/scripting/type/pids/tut/pids_tut/

文档里几个关键点会直接影响本项目架构：

- PIDS scripting 用 JavaScript 控制 Scripted PIDS Preset。
- JCM 会调用 `create(ctx, state, pids)`、`render(ctx, state, pids)`、`dispose(ctx, state, pids)`。
- `render` 是主绘制入口，通常每帧最多调用一次。
- `state` 是每个 PIDS block 独立的 JS object。
- `pids` 是 runtime object，提供 type、width、height、rows、arrivals、custom message、hide row、hide platform number 等信息。
- 绘制内容主要是 `Text` 和 `Texture`。
- draw order 很重要：后 draw 的元素在前面。
- Scripted PIDS Preset 通过 `joban_custom_resources.json` 里的 `scriptFiles` 或 `scriptTexts` 注册。
- 目前不能混用 Scripted PIDS Preset 和 JSON PIDS Preset。
- `ArrivalEntries.get(i)` 可能返回 `null`，而且 arrival 信息并不是无限数量。
- `getCustomMessage(i)`、`isRowHidden(i)`、`isPlatformNumberHidden()` 是做可发布 preset 时必须尊重的配置。

## 2. 当前技术栈

```text
React
Vite
TypeScript
SVG canvas
LocalStorage
Browser Blob download
Browser-side ZIP generation by hand-written minimal zip writer
```

当前刻意没有引入：

```text
Konva / Fabric
Monaco Editor
Zod
JSZip
Tauri
```

原因：先保持 MVP 轻量，快速验证 schema、binding、codegen 和 export workflow。

## 3. 目录结构

```text
src/
  App.tsx                  主 UI，当前比较大，后续需要拆分
  main.tsx                 React entry
  styles.css               全局样式
  types.ts                 Project schema / element schema / runtime mock types
  data/
    mockPids.ts            Mock runtime scenarios
  editor/
    bindings.ts            Binding registry + preview/codegen expression mapping
    codegen.ts             JCM JavaScript + joban_custom_resources.json 生成
    defaultProject.ts      默认 project AST
    importExport.ts        JSON / resource pack ZIP / resource config import-export
    validation.ts          Project validation
```

后续建议拆成：

```text
src/
  app/
  canvas/
  inspector/
  layers/
  codegen/
  schema/
  runtime/
  resource-pack/
  validation/
```

`App.tsx` 现在承载了太多交互逻辑，下一步应优先拆掉。

## 4. Project Schema 设计

核心类型在 `src/types.ts`。

### 4.1 PidsProject

```ts
interface PidsProject {
  schemaVersion: 2;
  name: string;
  preset: PidsPreset;
  resourceNamespace: string;
  scriptPath: string;
  canvas: { width: number; height: number };
  groups: LayerGroup[];
  elements: PidsElement[];
  repeatRows: RepeatRowsConfig;
  behavior: PidsBehavior;
}
```

说明：

- `schemaVersion` 目前是 2。以后做 breaking change 时要写 migration。
- `preset` 对应 JCM 的 PIDS type，例如 `rv_pids`、`lcd_pids`。
- `resourceNamespace` 默认 `jsblock`，用于生成 `jsblock:scripts/...` 和 texture id。
- `scriptPath` 是 resource pack 内脚本路径，例如 `scripts/custom_pids.js`。
- `canvas.width/height` 是 editor preview 的默认尺寸；实际 JS 可以用 `pids.width/pids.height`。
- `groups` 是 layer tree 的组。
- `elements` 是实际可绘制元素。
- `repeatRows` 是 arrival row template 的核心配置。
- `behavior` 是 PIDS config 行为开关。

### 4.2 Element 模型

目前元素类型：

```ts
TextElement
RectElement
LineElement
CircleElement
```

其中 `RectElement` 在 codegen 里通常映射到 `Texture.create()`，因为 JCM 没有 canvas rect primitive。当前使用 placeholder texture 来模拟矩形背景。

注意：

- `x/y/w/h` 使用 PIDS logical coordinate，不是 CSS px。
- `z` 用于排序。
- `visible` 控制 editor preview 和 codegen 是否输出。
- `locked` 控制 canvas 交互。
- `parentId` 用于 group/layer tree 归属。
- `condition` 用于控制 runtime draw，例如 arrival/customMessage/platformVisible。

### 4.3 RepeatRowsConfig

```ts
interface RepeatRowsConfig {
  enabled: boolean;
  groupId: string;
  name: string;
  startY: number;
  rowHeight: number;
  maxRows: number;
  countSource: 'pids.rows' | 'fixed';
  skipHiddenRows: boolean;
  collapseEmptyRows: boolean;
  customMessageMode: 'replace-row' | 'overlay' | 'ignore';
  showFallbackWhenEmpty: boolean;
}
```

这个配置决定 row template 如何展开：

```text
for i in 0..rowCount:
  rowY = startY + visibleRowIndex * rowHeight
  arrival = pids.arrivals().get(i)
  customMessage = pids.getCustomMessage(i)
```

设计原则：

- `Arrival Rows` group 里的元素是模板元素。
- 模板元素在 editor 里只存一份。
- Preview 和 codegen 根据 `repeatRows` 循环渲染。
- 不要生成 4 个硬编码 row。

## 5. Binding 系统

Binding key 定义在 `BindingKey`。

分组思路：

```text
Static
- static
- stationName
- clock

PIDS
- pids.type
- pids.width
- pids.height
- pids.rows
- pids.getCustomMessage(i)
- pids.isRowHidden(i)
- pids.isPlatformNumberHidden()

Row
- rowIndex
- rowNumber

Arrival
- arrival.destination()
- arrival.routeName()
- arrival.routeNumber()
- arrival.routeColor()
- arrival.platformName()
- arrival.arrivalTime()
- arrival.departureTime()
- arrival.deviation()
- arrival.realtime()
- arrival.terminating()
- arrival.carCount()

Computed
- computed.etaText
- computed.routeDisplay
- computed.realtimeBadge
```

Binding 的职责拆成两层：

1. Preview resolver：给 editor mock canvas 用。
2. Codegen expression：给 JCM JS 输出用。

不要把 preview resolver 和 JS expression 写死在组件里。后续应该把 `bindings.ts` 做成 registry：

```ts
interface BindingDefinition {
  key: BindingKey;
  label: string;
  group: string;
  requiresArrival: boolean;
  preview(runtime, rowIndex): string;
  codegen(ctx): string;
}
```

## 6. Codegen 规则

主文件：`src/editor/codegen.ts`。

生成目标：

```js
function create(ctx, state, pids) { ... }
function render(ctx, state, pids) { ... }
function dispose(ctx, state, pids) { ... }
```

JCM 关键 API：

```js
Text.create("name")
  .pos(x, y)
  .size(w, h)
  .text(str)
  .scale(scale)
  .color(0xFFFFFF)
  .bold()
  .italic()
  .shadowed()
  .scaleXY()
  .wrapText()
  .marquee(duration)
  .draw(ctx);

Texture.create("name")
  .texture("namespace:textures/...")
  .pos(x, y)
  .size(w, h)
  .color(0xFFFFFF)
  .uv(u1, v1, u2, v2)
  .draw(ctx);
```

### 6.1 Draw order

JCM 的顺序规则：后 draw 的元素显示在前面。

Editor 内部约定：

```text
z 小的先输出
z 大的后输出
```

Layer UI 之后最好改成：

```text
UI 越靠上 = z 越大 = 越前景
```

拖拽 layer reorder 时需要同步更新 `z`。

### 6.2 Row codegen

完整 row 逻辑应该接近：

```js
function drawRows(ctx, state, pids) {
  const rowCount = Math.min(pids.rows, MAX_ROWS);
  let visibleRowIndex = 0;

  for (let i = 0; i < rowCount; i++) {
    if (RESPECT_HIDE_ARRIVAL && pids.isRowHidden(i)) continue;

    const customMessage = pids.getCustomMessage(i);
    const arrival = pids.arrivals().get(i);
    const rowY = START_Y + visibleRowIndex * ROW_HEIGHT;

    if (RESPECT_CUSTOM_MESSAGE && customMessage !== "") {
      drawCustomMessageRow(ctx, state, pids, i, rowY, customMessage);
      visibleRowIndex++;
      continue;
    }

    if (arrival == null) {
      if (!SHOW_FALLBACK_WHEN_EMPTY) continue;
      drawEmptyRow(ctx, state, pids, i, rowY);
      visibleRowIndex++;
      continue;
    }

    drawArrivalRow(ctx, state, pids, i, rowY, arrival);
    visibleRowIndex++;
  }
}
```

注意事项：

- `pids.arrivals().get(i)` 可为 null。
- `customMessage` 空值是 `""`。
- `isPlatformNumberHidden()` 应该影响 platform text 的条件。
- `isRowHidden(i)` 应该在 row loop 早期处理。

### 6.3 Project metadata

生成 JS 里建议保留 metadata 注释：

```js
// @js-pids-editor-project: base64(...)
```

未来可以支持从本 editor 生成的 JS 反向恢复 project。

不要承诺能反解析任意手写 JS，这个成本太高。

## 7. Resource Pack Export

当前 export ZIP 内容：

```text
joban_custom_resources.json
assets/<namespace>/scripts/custom_pids.js
assets/<namespace>/textures/block/pids/pixel.png
assets/<namespace>/textures/block/pids/circle.png
js-pids-editor.project.json
pack.mcmeta
```

`joban_custom_resources.json` 生成形式：

```json
{
  "pids_images": [
    {
      "id": "custom_pids",
      "name": "Custom PIDS",
      "scriptFiles": ["jsblock:scripts/custom_pids.js"]
    }
  ]
}
```

注意：

- `scriptFiles` 路径是资源定位符，不是文件系统绝对路径。
- `scriptTexts` 不适合复杂脚本，只适合非常短的声明。
- 不要把 Scripted PIDS Preset 和 JSON PIDS Preset 混在一起。
- 现在 placeholder texture 只是为了让 ZIP 结构完整；正式版需要真实 texture asset manager。

## 8. Validation 规则

主文件：`src/editor/validation.ts`。

当前检查：

```text
元素越界
颜色格式
textureId 缺失
repeat row 配置异常
scriptPath / namespace 异常
custom message 行为配置异常
```

后续应该增加：

```text
binding requires arrival 但元素不在 repeat rows group
platform binding 未尊重 isPlatformNumberHidden
font id 格式不合法
marquee duration 非法
row template 子元素超出 canvas
z-order 重复或顺序不稳定
resource id 与文件路径不匹配
script path 扩展名不是 .js
导出前仍有 error 级 issue 时阻止 export
```

## 9. Mock Runtime

主文件：`src/data/mockPids.ts`。

Mock scenario：

```text
normal
longDestination
customMessage
hiddenRow
hidePlatform
emptyArrivals
terminating
```

Mock 的目标不是完全模拟 MTR/JCM，只是覆盖 editor 最容易出错的显示场景：

```text
长目的地
自定义消息
隐藏到达行
隐藏站台号
无 arrival
终到车
实时/计划 ETA
```

未来建议增加：

```text
mixed car length
multiple platforms
missing route
missing platform
late / early deviation
LCD PIDS size
PIDS 1A size
projector size
```

## 10. UI / UX 设计记录

当前 UI 信息架构：

```text
Top Toolbar
- preset
- canvas size
- mock scenario
- export actions

Left Sidebar
- component library
- layer tree

Center Canvas
- PIDS preview
- select / drag / resize / snap

Right Inspector
- element properties
- binding
- style
- repeat rows behavior
- validation

Bottom Panel
- generated JavaScript preview
```

后续 UI 优先级：

1. 拆分 `App.tsx`，把 UI 组件模块化。
2. Layer tree 支持真正树形拖拽、group 折叠、多选。
3. Inspector 做成 section-based schema renderer。
4. Code Preview 换 Monaco Editor。
5. Canvas 换 Konva，支持更可靠的 transform handles。
6. 加 command system，为 undo/redo 做准备。

## 11. 当前已知限制

### 11.1 SVG Canvas 限制

目前 SVG 足够 MVP，但长期会遇到：

```text
复杂 resize/rotate 不顺手
多选框选成本升高
对齐吸附逻辑会越来越乱
性能和事件管理不如专门 canvas library
```

后续迁移到 Konva 时，保留 schema/codegen 不变，只替换 canvas view layer。

### 11.2 任意 JS 不能反解析

不要尝试完整解析用户手写 JCM JS。原因：

```text
JS 是通用语言，控制流无限复杂
draw helper 可以任意封装
binding expression 很难还原成 UI intent
```

可行路线：

```text
支持导入 project JSON
支持导入 embedded metadata
支持从 joban_custom_resources.json 创建 project shell
```

### 11.3 Texture 资源管理还很弱

当前 texture id 只是字符串。正式版需要：

```text
导入 PNG
生成 resource id
预览 texture
检查文件路径
支持 texture atlas / UV
导出 assets/<namespace>/textures/...
```

## 12. 下一轮开发计划

优先级从高到低：

### A. Refactor

```text
拆分 App.tsx
引入 editor store
引入 command/action layer
给 schema 写 migration
把 binding registry 做成单一数据源
```

### B. Canvas

```text
Konva migration
多选
框选
复制/粘贴
undo/redo
align tools
snap guides
zoom/pan
```

### C. Resource workflow

```text
Texture asset manager
Resource id validator
Export ZIP 前检查 error
Import generated JS metadata
Resource pack preview tree
```

### D. Codegen hardening

```text
更多 JCM Text/Texture API 覆盖
manual zOrder mode
debug overlay option
dynamic texture layer 预留
clock helper
ETA helper 精修
```

### E. Product polish

```text
Monaco code preview
better empty states
keyboard shortcuts help
project settings modal
preset template gallery
```

## 13. 本地开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

如果 zip 解压后混入了 npm lockfile，保持只用 pnpm：

```bash
rm -f package-lock.json
pnpm install
```

## 14. Git / Repo 建议

推荐独立仓库：

```text
xiangao0904/js-pids-visual-editor
```

初始提交建议：

```bash
git init
git add .
git commit -m "Initial JS PIDS Visual Editor MVP"
git branch -M main
git remote add origin https://github.com/xiangao0904/js-pids-visual-editor.git
git push -u origin main
```

`.gitignore` 应至少包含：

```gitignore
node_modules
dist
.DS_Store
*.log
.env
.env.*
```

## 15. 做决策时的提醒

- 不要为了 UI 方便破坏 AST 的稳定性。
- 不要把 row template 展开成静态 row 保存。
- 不要依赖 JCM 里不存在的 draw primitive。
- 不要默认所有 arrival 都存在。
- 不要忽略 custom message / hide row / hide platform number。
- 不要承诺完整导入任意手写 JS。
- 不要让 codegen 变成组件里到处拼字符串；它应该集中在 `codegen.ts`。
- 不要让 resource pack export 靠用户手工修太多路径。

## 16. 当前版本状态

当前版本已经能跑通：

```text
Project JSON AST
Layer edit
Canvas edit
Repeat Rows preview
Mock runtime
Validation
JCM-style JS generation
joban_custom_resources.json generation
Resource Pack ZIP export
```

距离“正式可发布”主要还差：

```text
更可靠的 canvas engine
asset manager
undo/redo
Monaco
codegen edge case 测试
真实 JCM 环境测试
导出 ZIP 资源路径实测
```
---

## 17. MVP Release Criteria

这一节用于定义“什么时候可以发布 v0.1”。后续开发时，优先保证这些条件成立，再考虑更高级的编辑体验。

### 17.1 v0.1 必须支持

```text
Project workflow
- 新建 Project
- 保存 / 导入 Project JSON
- 从 Project JSON 恢复完整布局
- schemaVersion 不匹配时能给出明确错误或自动 migration

Editor workflow
- 添加 / 选择 / 移动 / 调整基础元素
- 编辑 Text / Rect / Line / Circle 的核心属性
- Layer 顺序稳定映射到 z-order
- Arrival Rows 以模板方式编辑，不展开保存成静态 row

Runtime preview
- 支持 normal / longDestination / customMessage / hiddenRow / hidePlatform / emptyArrivals
- Preview 与 codegen 使用同一套 binding registry
- Mock runtime 不允许成为 codegen 的隐式依赖

Codegen
- 生成 create(ctx, state, pids)
- 生成 render(ctx, state, pids)
- 生成 dispose(ctx, state, pids)
- 生成 JS 中保留 embedded project metadata
- Text / Texture 绘制顺序与 editor z-order 一致

Resource pack export
- 导出 joban_custom_resources.json
- 导出 assets/<namespace>/scripts/<scriptPath>
- 导出必要 placeholder textures
- 导出 js-pids-editor.project.json
- 导出 pack.mcmeta

JCM behavior
- 尊重 pids.getCustomMessage(i)
- 尊重 pids.isRowHidden(i)
- 尊重 pids.isPlatformNumberHidden()
- pids.arrivals().get(i) 为 null 时不崩溃
```

### 17.2 v0.1 可以暂不支持

```text
- 任意手写 JS 反解析
- Tauri 桌面版
- 自动写入 Minecraft resource pack 文件夹
- 完整 texture atlas 编辑
- 多用户协作
- 插件系统
- 动画时间线
- 复杂脚本表达式编辑器
```

### 17.3 发布前必须完成的真实环境测试

```text
Manual JCM test matrix
- rv_pids normal arrivals
- rv_pids custom message
- rv_pids hidden row
- rv_pids hide platform number
- rv_pids empty arrivals
- lcd_pids normal arrivals
- lcd_pids long destination text
- resource pack zip 被 JCM 正确加载
- joban_custom_resources.json 中 scriptFiles 路径正确
- 重新导入 js-pids-editor.project.json 后布局一致
```

### 17.4 Export gate

导出 Resource Pack ZIP 前必须执行 validation。

```text
允许导出：
- 无 error
- 可以有 warning / info，但 UI 必须明确提示

禁止导出：
- resourceNamespace 非法
- scriptPath 非法
- required texture 缺失
- repeatRows 配置不可用
- element id 重复
- group id 重复
- binding requires arrival 但元素不在 repeat rows group
```

## 18. Schema Reference

这一节是 Project JSON 的字段级约定。`src/types.ts` 是 TypeScript source of truth；这里负责解释语义、默认值和约束。

### 18.1 基础 ID 约定

```ts
// 推荐格式，不要求暴露给用户
// element_xxxxxxxx
// group_xxxxxxxx
// asset_xxxxxxxx
type EntityId = string;
```

约束：

```text
- id 在同类实体内必须唯一
- element.id 全局唯一
- group.id 全局唯一
- asset.id 全局唯一
- 不要使用 name 作为稳定引用
- 用户重命名不应该影响内部引用
```

### 18.2 PidsProject 字段

```ts
interface PidsProject {
  schemaVersion: number;
  name: string;
  preset: PidsPreset;
  resourceNamespace: string;
  scriptPath: string;
  canvas: CanvasConfig;
  groups: LayerGroup[];
  elements: PidsElement[];
  repeatRows: RepeatRowsConfig;
  behavior: PidsBehavior;
  resources?: ResourceAsset[];
  editor?: PersistedEditorState;
}
```

字段说明：

```text
schemaVersion
- 当前版本号
- import 时根据版本执行 migration
- export 永远输出当前版本

name
- Project 显示名称
- 可用于默认 preset name
- 不应该参与 resource path 生成，避免重命名破坏路径

preset
- JCM PIDS preset type
- 驱动默认 canvas、row 数量、模板推荐和 validation

resourceNamespace
- Minecraft resource namespace
- 只允许小写字母、数字、下划线、短横线、点
- 默认 jsblock

scriptPath
- resource pack 内脚本路径
- 例如 scripts/custom_pids.js
- 必须以 .js 结尾
- 不允许绝对路径和 ../

canvas
- editor preview 的 logical canvas 配置
- zoom / pan 不写入这里

groups
- layer tree group 数据
- group 只负责组织与可见性，不直接 codegen draw primitive

elements
- 可绘制元素列表
- codegen 只遍历 visible element

repeatRows
- arrival row template 展开规则

behavior
- JCM runtime 行为开关

resources
- texture 等资源资产
- v0.1 可以为空，但正式版应启用

editor
- 可持久化但不影响导出的 editor UI 偏好
- 不应该影响 generated JS 语义
```

### 18.3 CanvasConfig

```ts
interface CanvasConfig {
  width: number;
  height: number;
  background?: string;
  gridSize?: number;
  snapEnabled?: boolean;
}
```

约束：

```text
- width / height 必须大于 0
- 推荐按 preset definition 提供默认值
- background 只影响 editor preview，不一定进入 codegen
- gridSize 默认 1 或 4
- snapEnabled 是 editor 行为，不改变坐标系统
```

### 18.4 LayerGroup

```ts
interface LayerGroup {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  parentId?: string | null;
  zBase?: number;
}
```

约束：

```text
- parentId 为 null 表示顶层 group
- 不允许 group 形成环
- group hidden 时，子元素 preview 不显示，codegen 不输出
- group locked 时，子元素不能通过 canvas 交互修改
- expanded 只影响 editor UI
```

### 18.5 BaseElement

```ts
interface BaseElement {
  id: string;
  type: PidsElementType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  visible: boolean;
  locked: boolean;
  parentId?: string | null;
  condition?: ElementCondition;
  opacity?: number;
}
```

约束：

```text
x / y
- logical coordinate
- 原点为左上角
- x 向右，y 向下

w / h
- 必须大于 0，LineElement 可用 x2/y2 或 w/h 表达
- export JS 时允许小数，但建议最多保留 2 位

z
- 越大越靠前
- codegen 按 z 从小到大输出
- z 重复时用元素数组顺序作为稳定 fallback

visible
- false 时 editor layer 仍显示该元素，但 canvas preview 和 codegen 跳过

locked
- true 时不能拖动、resize 或批量编辑 geometry

parentId
- 为空表示不属于任何 group
- 指向不存在的 group 是 validation error

opacity
- 0 到 1
- JCM Texture / Text 是否能稳定支持 alpha 需要实测；不确定时 codegen 可以忽略并 warning
```

### 18.6 TextElement

```ts
interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  bindingKey?: BindingKey;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  bold?: boolean;
  italic?: boolean;
  shadowed?: boolean;
  wrapText?: boolean;
  marquee?: {
    enabled: boolean;
    duration: number;
  };
}
```

约束：

```text
- bindingKey 为空或 static 时使用 text
- bindingKey 非 static 时 text 可作为 fallback
- color 使用 #RRGGBB
- fontSize 必须大于 0
- marquee.duration 必须大于 0
- wrapText / marquee 同时启用时需要 JCM 实测
```

### 18.7 RectElement / TextureElement

当前 `RectElement` 是 placeholder texture 的语义包装。正式版可以拆成 `RectElement` 和 `TextureElement`。

```ts
interface RectElement extends BaseElement {
  type: 'rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  textureRef?: TextureRef;
}

interface TextureRef {
  assetId?: string;
  resourceId: string;
  uv?: [number, number, number, number];
}
```

约束：

```text
- fill / stroke 使用 #RRGGBB
- strokeWidth >= 0
- radius 在 JCM 中不一定能直接表达，v0.1 可 preview-only 并 warning
- resourceId 必须能映射到 assets/<namespace>/textures/...
- uv 默认 [0, 0, 1, 1]
```

### 18.8 LineElement

```ts
interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}
```

说明：

```text
- JCM 没有原生 line primitive 时，可以用 Texture 拉伸模拟
- 斜线支持需要单独实测；v0.1 可限制为水平 / 垂直线
- 非水平/垂直线在 export 时给 warning 或 error
```

### 18.9 CircleElement

```ts
interface CircleElement extends BaseElement {
  type: 'circle';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}
```

说明：

```text
- codegen 可映射到 circle.png texture
- 非等宽等高时表示 ellipse，但 placeholder texture 是否好看取决于 asset
- stroke 在 v0.1 可以 preview-only
```

## 19. Preset Abstraction

不要让 preset 只是一个字符串。不同 PIDS 类型应该有自己的默认尺寸、行数、能力和模板推荐。

```ts
interface PidsPresetDefinition {
  id: PidsPreset;
  label: string;
  defaultCanvas: { width: number; height: number };
  defaultRows: number;
  supportsPlatformNumber: boolean;
  supportsCustomMessage: boolean;
  supportsHideRow: boolean;
  recommendedTemplates: string[];
}
```

初始 registry：

```ts
const PIDS_PRESETS: Record<PidsPreset, PidsPresetDefinition> = {
  rv_pids: {
    id: 'rv_pids',
    label: 'RV PIDS',
    defaultCanvas: { width: 160, height: 80 },
    defaultRows: 4,
    supportsPlatformNumber: true,
    supportsCustomMessage: true,
    supportsHideRow: true,
    recommendedTemplates: ['rv-basic', 'rv-compact'],
  },
  lcd_pids: {
    id: 'lcd_pids',
    label: 'LCD PIDS',
    defaultCanvas: { width: 320, height: 180 },
    defaultRows: 6,
    supportsPlatformNumber: true,
    supportsCustomMessage: true,
    supportsHideRow: true,
    recommendedTemplates: ['lcd-basic', 'lcd-large'],
  },
};
```

Preset registry 应该驱动：

```text
- New Project 默认 canvas size
- repeatRows.maxRows 默认值
- template gallery
- validation warning
- mock runtime 默认数据
- export metadata
```

## 20. Editor State 设计

Project JSON 只存“项目语义”。Editor UI 状态需要分层，避免把拖拽状态、选中状态、面板开关混进 codegen 数据。

### 20.1 State 分层

```text
Project state
- 会保存进 project JSON
- 会影响 generated JS 或 resource pack
- 包括 elements / groups / repeatRows / behavior / resources

Persisted editor state
- 可以保存到 localStorage 或 project.editor
- 不影响 generated JS
- 包括 panel layout、last selected mock scenario、grid 开关

Transient editor state
- 只存在内存
- 不保存
- 包括 hover、dragging、resize handle、marquee selection box
```

### 20.2 EditorState

```ts
interface EditorState {
  project: PidsProject;
  selectedElementIds: string[];
  activeGroupId: string | null;
  activeTool: EditorTool;
  zoom: number;
  pan: { x: number; y: number };
  mockScenarioId: string;
  clipboard: PidsElement[];
  history: UndoRedoState;
  validationIssues: ValidationIssue[];
  ui: EditorUiState;
  transient: TransientCanvasState;
}

type EditorTool =
  | 'select'
  | 'text'
  | 'rect'
  | 'line'
  | 'circle'
  | 'pan';
```

### 20.3 PersistedEditorState

```ts
interface PersistedEditorState {
  mockScenarioId?: string;
  gridVisible?: boolean;
  snapEnabled?: boolean;
  leftPanelWidth?: number;
  rightPanelWidth?: number;
  bottomPanelHeight?: number;
}
```

注意：`selectedElementIds` 不建议写入 project。打开文件后选中状态可以为空，减少旧 id 失效导致的问题。

## 21. Command / Undo-Redo 设计

所有会修改 project 的操作都应该走 command/action。不要在 React component 里直接 mutate project。

### 21.1 Command 类型

```ts
type Command =
  | {
      type: 'element.add';
      element: PidsElement;
    }
  | {
      type: 'element.update';
      id: string;
      before: Partial<PidsElement>;
      after: Partial<PidsElement>;
    }
  | {
      type: 'element.delete';
      elements: PidsElement[];
    }
  | {
      type: 'element.duplicate';
      sourceIds: string[];
      duplicated: PidsElement[];
    }
  | {
      type: 'layer.reorder';
      before: Array<{ id: string; z: number }>;
      after: Array<{ id: string; z: number }>;
    }
  | {
      type: 'group.create';
      group: LayerGroup;
    }
  | {
      type: 'group.update';
      id: string;
      before: Partial<LayerGroup>;
      after: Partial<LayerGroup>;
    }
  | {
      type: 'project.updateSettings';
      before: Partial<PidsProject>;
      after: Partial<PidsProject>;
    };
```

### 21.2 History

```ts
interface UndoRedoState {
  past: Command[];
  future: Command[];
  currentTransaction?: CommandTransaction;
}

interface CommandTransaction {
  label: string;
  commands: Command[];
}
```

规则：

```text
- mouse drag 过程中可以实时更新 preview，但 mouseup 时只提交一个 element.update command
- resize 同理，mouseup 提交一次
- inspector 每次 commit 一个 element.update
- text input 可以 debounce 或 blur 时提交
- 批量移动多个元素时提交一个 transaction
- import project 后清空 history
- undo / redo 后重新运行 validation
- codegen preview 根据 project 派生，不进入 history
```

### 21.3 Command 应保持可序列化

不要把函数、DOM node、event object 放进 command。这样以后可以做：

```text
- debug command log
- project operation replay
- crash recovery
- collaboration groundwork
```

## 22. Inspector Schema Renderer

Inspector 不应该长期手写成大量 JSX。建议用 section + field schema 驱动 UI。

```ts
interface InspectorSection {
  id: string;
  title: string;
  visibleWhen: (ctx: InspectorContext) => boolean;
  fields: InspectorField[];
}

interface InspectorField {
  key: string;
  label: string;
  control:
    | 'text'
    | 'number'
    | 'color'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'binding-select'
    | 'texture-picker';
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
  visibleWhen?: (ctx: InspectorContext) => boolean;
  disabledWhen?: (ctx: InspectorContext) => boolean;
}
```

推荐 section：

```text
Common
- name
- visible
- locked
- x / y / w / h / z

Text
- text
- bindingKey
- fontSize
- color
- align
- verticalAlign
- bold / italic / shadowed
- wrapText
- marquee

Shape
- fill
- stroke
- strokeWidth
- radius

Texture
- textureRef
- uv

Condition
- condition mode
- customMessage behavior
- platform visibility behavior

Repeat Rows
- enabled
- startY
- rowHeight
- maxRows
- skipHiddenRows
- collapseEmptyRows
```

多选时 Inspector 需要支持 mixed value：

```ts
type InspectorValue<T> =
  | { kind: 'single'; value: T }
  | { kind: 'mixed' }
  | { kind: 'empty' };
```

## 23. Validation Issue Model

Validation 不只是弹错误列表，后续应该能定位元素、阻止导出、提供 quick fix。

```ts
interface ValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  target:
    | { type: 'project' }
    | { type: 'element'; elementId: string }
    | { type: 'group'; groupId: string }
    | { type: 'resource'; assetId?: string; path?: string }
    | { type: 'repeatRows' };
  fix?: ValidationQuickFix;
}

interface ValidationQuickFix {
  label: string;
  command: Command;
}
```

### 23.1 Issue code 命名

```text
project.namespace.invalid
project.scriptPath.invalid
group.parent.missing
group.parent.cycle
element.id.duplicate
element.parent.missing
element.bounds.outsideCanvas
element.color.invalid
element.texture.missing
element.binding.requiresArrival
element.platformVisibility.notRespected
repeatRows.groupMissing
repeatRows.rowHeight.invalid
repeatRows.maxRows.invalid
resource.path.invalid
resource.asset.unused
export.blockedByErrors
```

### 23.2 Validation 分级

```text
error
- 会导致 codegen 错误或 resource pack 无法工作
- export ZIP 前必须阻止

warning
- 可能和 JCM runtime 行为不一致
- 可以导出，但需要用户确认

info
- 质量建议，不影响导出
```

## 24. Resource Asset Model

Texture 资源不要长期只用字符串。正式 asset manager 至少需要知道资源 id、文件路径、预览数据和引用关系。

```ts
interface ResourceAsset {
  id: string;
  type: 'texture';
  namespace: string;
  resourcePath: string;
  sourceName: string;
  width?: number;
  height?: number;
  mimeType?: 'image/png';
  dataUrl?: string;
  hash?: string;
}

interface TextureRef {
  assetId?: string;
  resourceId: string;
  uv?: [number, number, number, number];
}
```

路径规则：

```text
resourceId:
- jsblock:textures/block/pids/pixel
- namespace:path，不带 .png

zip path:
- assets/jsblock/textures/block/pids/pixel.png
```

Asset manager 需要支持：

```text
- 导入 PNG
- 生成 resource id
- 预览 texture
- 检查重复 hash
- 检查 resource id 是否非法
- 检查 asset 是否被元素引用
- 删除 asset 前提示影响范围
- export 时写入 assets/<namespace>/textures/...
```

## 25. Import / Migration 设计

### 25.1 Import Project JSON

流程：

```text
1. 读取 JSON 文本
2. JSON.parse
3. 检查是否像 PidsProject
4. 根据 schemaVersion 执行 migration
5. validate migrated project
6. 创建新的 EditorState
7. 清空 undo/redo history
8. 使用默认 mockScenarioId
```

失败情况：

```text
- JSON parse 失败
- schemaVersion 缺失
- schemaVersion 高于当前版本
- migration 失败
- validation 出现不可恢复 error
```

### 25.2 Import JS with embedded metadata

流程：

```text
1. 把 JS 当作纯文本读取，不执行
2. 查找 @js-pids-editor-project: base64(...)
3. base64 decode
4. JSON.parse
5. 进入 Import Project JSON 流程
```

失败 fallback：

```text
- 找不到 metadata：提示只能创建 shell project
- base64 decode 失败：提示 metadata 损坏
- metadata schema 太新：提示需要新版 editor
```

### 25.3 Import joban_custom_resources.json

流程：

```text
1. 读取 pids_images
2. 读取 id / name / scriptFiles
3. 根据第一个 scriptFiles 推断 namespace 和 scriptPath
4. 创建 project shell
5. 不尝试反解析 JS
6. UI 明确提示“只能恢复 resource shell，不能恢复视觉布局”
```

### 25.4 Migration

```ts
type Migration = {
  from: number;
  to: number;
  migrate(input: unknown): unknown;
};

const migrations: Migration[] = [
  migrateV1ToV2,
  migrateV2ToV3,
];
```

规则：

```text
- migrations 必须连续
- migration 输入输出都用 unknown，内部做 defensive parsing
- migration 后必须 validate
- export 永远输出 current schema
- 无法 migration 时不静默丢字段
- migration 不处理 editor transient state
```

## 26. Coordinate System

坐标系统必须保持简单、稳定、可预测。

```text
- 原点在左上角
- x 向右增加
- y 向下增加
- project 坐标使用 PIDS logical coordinate
- SVG / Konva 只是 view layer
- zoom / pan 不改变 project 坐标
- snap 只影响交互提交后的数值
- codegen 使用 project 坐标
```

### 26.1 小数策略

```text
- 内部允许小数
- Inspector 默认显示最多 2 位小数
- codegen 默认最多保留 2 位小数
- snap grid 开启时，移动 / resize 结果贴到 grid
- 按住 Alt 可以临时关闭 snap
```

### 26.2 Transform 限制

v0.1 不建议支持任意 rotation。原因：JCM Text / Texture API 对旋转的支持需要确认，UI handle 和 codegen 都会复杂很多。

```text
v0.1 支持：
- move
- resize
- horizontal / vertical line

v0.1 不支持：
- rotate
- skew
- arbitrary path
```

## 27. Testing Strategy

### 27.1 Unit tests

```text
bindings.test.ts
- static binding preview
- arrival binding preview
- requiresArrival 标记正确
- codegen expression 输出正确

validation.test.ts
- invalid namespace
- invalid scriptPath
- duplicate id
- missing parent group
- invalid color
- repeatRows invalid config
- requiresArrival outside repeat group

resourcePath.test.ts
- resourceId -> zip path
- namespace validation
- scriptPath validation
- 防止 ../ path traversal

migration.test.ts
- v1 -> v2
- v2 -> current
- unknown future version error
```

### 27.2 Snapshot tests

```text
codegen.snapshot.test.ts
- default project JS
- custom message row JS
- hidden platform JS
- empty arrivals JS

resourcePack.snapshot.test.ts
- joban_custom_resources.json
- pack.mcmeta
- zip file list
```

### 27.3 Integration tests

```text
- Project JSON -> validate -> codegen -> ZIP
- export project -> import project -> export again 输出稳定
- import JS metadata -> restore project
- imported resource shell 不尝试反解析 JS
```

### 27.4 Manual JCM tests

```text
每次 release 前手动测：
- JCM 能加载 resource pack
- preset 列表能看到生成的 custom PIDS
- render 不报错
- row hidden 生效
- custom message 生效
- platform number hidden 生效
- empty arrival 不崩溃
- long text 不穿帮或至少 behavior 可接受
```

## 28. Performance Notes

```text
目标：
- 500 elements 内基础交互不卡顿
- 1000 elements 内仍可打开和导出
- repeatRows preview 不因为 mock rows 增多而指数级变慢
```

策略：

```text
- validation debounce 150-300ms
- generated JS preview debounce 300-500ms
- drag 过程中不实时刷新 code preview
- resize 过程中不实时刷新完整 validation
- selected element bounding box 用 memoized selector
- layer tree 大量元素时做虚拟列表预留
- export ZIP 只在用户点击时生成
```

不要过早引入复杂性能架构，但要避免把 expensive derived data 写在 React render path 里。

## 29. Security Constraints

这个 editor 会导入用户提供的 JSON / JS / ZIP / PNG。即使是本地 Web app，也要把导入内容当作不可信输入。

```text
- 导入 JS 只作为文本读取，绝不 eval / Function 执行
- embedded metadata decode 后仍然必须 schema validate
- Project JSON 必须 validate，不能直接信任字段类型
- ZIP import 必须防止 zip slip，例如 ../../evil.js
- 限制单个导入文件大小
- PNG 只作为 Blob / data URL 预览
- resource path 不允许绝对路径
- resource path 不允许 ../
- 导出前统一 normalize path
```

安全边界：

```text
允许：
- 读取 JS 文本
- 提取 metadata 注释
- 生成新的 JS 输出

不允许：
- 执行导入的 JS
- 根据导入 JS 的 AST 猜测 UI 布局
- 信任 ZIP 里的路径
- 把用户导入内容直接插进 DOM innerHTML
```

## 30. Keyboard Shortcuts

v0.1 可以先实现最基础的一组，后续在 Help modal 中展示。

```text
Editing
- Delete / Backspace: 删除选中元素
- Cmd/Ctrl+C: 复制
- Cmd/Ctrl+V: 粘贴
- Cmd/Ctrl+D: duplicate
- Cmd/Ctrl+Z: undo
- Cmd/Ctrl+Shift+Z: redo

Selection
- Cmd/Ctrl+A: select all unlocked visible elements
- Escape: clear selection / cancel current tool

Movement
- Arrow: 移动 1 unit
- Shift+Arrow: 移动 10 units

Canvas
- Space + drag: pan
- Cmd/Ctrl + wheel: zoom
```

焦点规则：

```text
- input / textarea / select / Monaco 聚焦时，不触发 canvas shortcuts
- Delete 在文本输入中只删除文本，不删除元素
- Escape 可以先 blur inspector field，再 clear selection
```

## 31. JCM Runtime To Verify

这些点不要在 codegen 里假设，应该通过真实 JCM 环境确认。

```text
Text
- Text.create(name) 的 name 是否需要唯一
- Text.size(w, h) 对 wrapText / marquee 的真实影响
- Text.scale(scale) 与 size(w, h) 同时使用时的优先级
- Text.color(0xFFFFFF) 是否支持 alpha
- Text.shadowed() 在不同背景下是否可读
- Text.marquee(duration) 的 duration 单位

Texture
- Texture.create(name) 的 name 是否需要唯一
- Texture.color(0xFFFFFF) 是否支持 alpha
- 单像素 pixel.png 拉伸成 rect 是否稳定
- Texture.uv(u1, v1, u2, v2) 坐标范围
- 非整数 pos / size 是否会抖动

PIDS runtime
- pids.width / pids.height 在所有 preset 是否可靠
- pids.rows 是最大行数还是当前可显示行数
- pids.arrivals().get(i) 越界行为
- pids.getCustomMessage(i) 越界行为
- pids.isRowHidden(i) 越界行为
- pids.isPlatformNumberHidden() 是否全局生效

Resource pack
- scriptFiles resource id 是否必须带 namespace
- joban_custom_resources.json 中 pids_images.id 是否需要唯一
- scriptFiles 多文件顺序是否稳定
- scriptTexts 与 scriptFiles 同时存在时行为
```

每确认一个点，就把结果写回本节，避免后面重复踩坑。

## 32. Development Backlog

### Milestone 1: Refactor App.tsx

```text
- [ ] Extract TopToolbar
- [ ] Extract LeftSidebar
- [ ] Extract LayerPanel
- [ ] Extract CanvasView
- [ ] Extract InspectorPanel
- [ ] Extract CodePreviewPanel
- [ ] Move selection logic into editor store
- [ ] Move drag / resize logic out of App.tsx
```

### Milestone 2: Binding Registry

```text
- [ ] Define BindingDefinition
- [ ] Move preview resolver into registry
- [ ] Move codegen expression into registry
- [ ] Add requiresArrival validation
- [ ] Add computed.etaText helper
- [ ] Add computed.routeDisplay helper
```

### Milestone 3: Validation Hardening

```text
- [ ] Implement ValidationIssue model
- [ ] Add issue codes
- [ ] Add export gate
- [ ] Add quick fix command support
- [ ] Make clicking issue select target element
```

### Milestone 4: Command / Undo-Redo

```text
- [ ] Define Command union
- [ ] Implement applyCommand
- [ ] Implement revertCommand
- [ ] Add command transaction
- [ ] Wire drag move as single history entry
- [ ] Wire inspector edits into command history
```

### Milestone 5: Resource Workflow

```text
- [ ] Define ResourceAsset
- [ ] Import PNG
- [ ] Texture picker
- [ ] Resource id validator
- [ ] Export imported textures
- [ ] Detect unused assets
```

### Milestone 6: Import / Migration

```text
- [ ] Define current schema version constant
- [ ] Implement migration runner
- [ ] Import Project JSON
- [ ] Import JS embedded metadata
- [ ] Import joban_custom_resources.json shell
- [ ] Add import error UI
```

### Milestone 7: JCM Test Pass

```text
- [ ] Build test resource pack
- [ ] Test rv_pids
- [ ] Test lcd_pids
- [ ] Record runtime quirks
- [ ] Update JCM Runtime To Verify section
```

## 33. Code Style / Repo Rules

```text
TypeScript
- 开启 strict
- 避免 any，import boundary 可以用 unknown
- schema parse 后再转成强类型

React
- component 负责 UI，不负责 codegen 字符串拼接
- component 不直接 mutate project
- expensive selector 用 memo
- editor store 暴露 action，不暴露内部 mutable object

Codegen
- 集中在 codegen 模块
- 所有 JS literal 都走 escape helper
- 所有 number 都走 formatNumber helper
- 所有 color 都走 parseColor helper
- 不在 UI 组件里拼 JCM JS

Validation
- pure function 优先
- 输入 project，输出 issues
- 不直接弹 toast，不直接修改 state

Import / Export
- pure function 优先
- 文件 IO 与数据转换分层
- path normalize 集中处理
```

推荐工具：

```text
- eslint
- prettier
- vitest
- playwright later
- typecheck in CI
```

CI 最低要求：

```text
pnpm install
pnpm typecheck
pnpm test
pnpm build
```


## 34. Development Environment Constraint

当前项目按 **Web-only development environment** 设计。

日常开发不要求运行 Minecraft，也不要求本地安装 JCM mod。Editor 不执行 JCM JavaScript，只负责生成、检查和打包 JCM script/resource pack。

因此验证体系分为三层：

```text
Level 1: Web-only validation
- schema validation
- binding validation
- editor state validation
- generated JS snapshot tests
- resource pack path validation
- ZIP structure validation
- import/export round-trip tests
- generated JS allowlist check

Level 2: JCM spec compatibility
- codegen 只允许输出目标 JCM 文档明确列出的 API
- 不确定行为必须进入 warning 或 To Verify
- 未验证能力默认不进入 MVP

Level 3: Optional real JCM smoke test
- 有 JCM runtime 时，用导出的 resource pack 做发布前验收
- smoke test 是 release confidence step，不是 daily development dependency
```

这意味着：

- Web editor 开发不能被真实游戏环境阻塞。
- JCM runtime quirks 不能靠猜，必须在文档里标成 To Verify。
- codegen 应该偏保守，只生成官方文档明确支持的调用。
- Editor preview 只代表设计意图，不承诺和 JCM runtime 像素级一致。

## 35. JCM API Compatibility Contract

本项目的 codegen 必须围绕一个固定的 JCM compatibility contract 实现，不能在 UI 组件里自由拼接 JCM API。

### 35.1 Target

```ts
export const JCM_TARGET = {
  version: '2.2',
  docs: [
    'https://jcm.joban.org/v2.2/dev/scripting/type/pids/',
    'https://jcm.joban.org/v2.2/dev/scripting/type/pids/tut/pids_tut/',
  ],
} as const;
```

注意：目标文档版本是 JCM v2.2。后续如果迁移到其他 JCM 版本，需要先更新 compatibility contract，再更新 codegen 和 snapshot tests。

### 35.2 Allowed generated API surface

MVP codegen 只允许生成以下对象和方法。

```ts
export const ALLOWED_JCM_OBJECTS = [
  'Text',
  'Texture',
  'TextUtil',
  'ctx',
  'state',
  'pids',
] as const;

export const ALLOWED_TEXT_METHODS = [
  'create',
  'pos',
  'size',
  'text',
  'scale',
  'color',
  'leftAlign',
  'centerAlign',
  'rightAlign',
  'shadowed',
  'italic',
  'bold',
  'stretchXY',
  'scaleXY',
  'wrapText',
  'marquee',
  'font',
  'draw',
  'zOrder',
] as const;

export const ALLOWED_TEXTURE_METHODS = [
  'create',
  'pos',
  'size',
  'texture',
  'color',
  'uv',
  'draw',
  'zOrder',
] as const;

export const ALLOWED_PIDS_MEMBERS = [
  'type',
  'width',
  'height',
  'rows',
  'arrivals',
  'getCustomMessage',
  'isRowHidden',
  'isPlatformNumberHidden',
] as const;

export const ALLOWED_ARRIVAL_METHODS = [
  'destination',
  'routeName',
  'routeNumber',
  'routeColor',
  'platformName',
  'arrivalTime',
  'departureTime',
  'deviation',
  'realtime',
  'terminating',
  'carCount',
] as const;
```

如果后续要支持新 API，必须满足：

1. 官方文档可以确认该 API 存在。
2. `jcmSpec.ts` 已加入 allowlist。
3. codegen snapshot 已覆盖。
4. compatibility checker 已能识别该调用。
5. 无法在 Web 环境确认的视觉行为进入 To Verify。

### 35.3 Disallowed generated APIs

MVP codegen 禁止生成：

```text
- 未在 JCM PIDS scripting 文档中出现的 draw primitive
- Browser DOM API
- Browser Canvas API
- Node.js API
- Minecraft/JCM 内部未公开 API
- 任意 eval / Function / 动态执行代码
- 从用户导入 JS 后再执行该 JS
```

尤其注意：Editor 里的 `RectElement`、`CircleElement`、`LineElement` 是 editor-level abstraction，不是 JCM 原生 primitive。

导出规则：

```text
RectElement   -> Texture with pixel texture fallback
CircleElement -> Texture with circle texture fallback
LineElement   -> Texture fallback, MVP 可先限制为 horizontal / vertical
TextElement   -> Text
```

如果某个 element 没有可导出的 Texture fallback，export 前必须报 error，而不是生成猜测 API。

### 35.4 Codegen helper pattern

不要在 React component 或 inspector 里拼 JCM 字符串。所有 JCM 调用必须通过 codegen helper 输出。

```ts
type AllowedTextMethod = (typeof ALLOWED_TEXT_METHODS)[number];
type AllowedTextureMethod = (typeof ALLOWED_TEXTURE_METHODS)[number];

function emitTextCall(method: AllowedTextMethod, args: string[]): string {
  return `.${method}(${args.join(', ')})`;
}

function emitTextureCall(method: AllowedTextureMethod, args: string[]): string {
  return `.${method}(${args.join(', ')})`;
}
```

目标是让 TypeScript 在编译期阻止明显的 API 拼错或未登记调用。

### 35.5 Compatibility checker

导出前应运行 `checkJcmCompatibility(project, generatedJs, resourcePackManifest)`。

```ts
interface JcmCompatibilityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  source: 'schema' | 'binding' | 'codegen' | 'resource-pack';
  target?:
    | { type: 'project' }
    | { type: 'element'; elementId: string }
    | { type: 'resource'; path: string }
    | { type: 'generated-js'; excerpt?: string };
}
```

Error examples：

```text
JCM_API_NOT_ALLOWED
- generated JS contains a method outside the allowlist

RESOURCE_SCRIPT_PATH_MISMATCH
- scriptFiles points to jsblock:scripts/a.js but ZIP writes assets/jsblock/scripts/b.js

ARRIVAL_BINDING_WITHOUT_NULL_GUARD
- generated row code can access arrival fields without checking arrival != null

SCRIPTED_AND_JSON_PIDS_MIXED
- export attempts to define Scripted PIDS Preset and JSON PIDS Preset together

NON_EXPORTABLE_ELEMENT
- an editor-level element has no JCM Texture/Text fallback
```

Warning examples：

```text
TEXT_SIZE_SCALE_COMBO_UNVERIFIED
- Text.size and Text.scale are both used; actual visual result should be smoke-tested

TEXTURE_ALPHA_UNVERIFIED
- Texture.color receives alpha-like value; alpha support is not guaranteed

MARQUEE_RUNTIME_TIMING_UNVERIFIED
- marquee/animation behavior depends on JCM render timing

LINE_ROTATION_UNVERIFIED
- rotated line export is not confirmed in JCM runtime
```

### 35.6 Resource pack contract

MVP export 应保持简单固定：

```text
joban_custom_resources.json
assets/<namespace>/scripts/<scriptName>.js
assets/<namespace>/textures/block/pids/pixel.png
assets/<namespace>/textures/block/pids/circle.png
js-pids-editor.project.json
pack.mcmeta
```

`joban_custom_resources.json`：

```json
{
  "pids_images": [
    {
      "id": "custom_pids",
      "name": "Custom PIDS",
      "scriptFiles": ["jsblock:scripts/custom_pids.js"]
    }
  ]
}
```

约束：

```text
- scriptFiles 使用 resource location，不是文件系统绝对路径
- assets/<namespace>/scripts/... 必须和 scriptFiles 一致
- scriptTexts 只适合非常短的脚本，MVP 默认不用
- 不混用 Scripted PIDS Preset 和 JSON PIDS Preset
- ZIP writer 必须阻止 ../ 形式的 zip slip path
```

### 35.7 Row compatibility contract

Repeat rows 是本项目的核心模型。生成代码必须满足：

```text
- rowCount 不能超过 pids.rows 和 project.repeatRows.maxRows
- pids.isRowHidden(i) 在 row loop 早期处理
- pids.getCustomMessage(i) 优先级高于 normal arrival row
- pids.arrivals().get(i) 必须判空
- arrival binding 只能在 arrival != null 的分支里访问
- platform 相关 binding 必须尊重 pids.isPlatformNumberHidden()
```

推荐生成结构：

```js
function drawRows(ctx, state, pids) {
  const rowCount = Math.min(pids.rows, MAX_ROWS);
  let visibleRowIndex = 0;

  for (let i = 0; i < rowCount; i++) {
    if (pids.isRowHidden(i)) continue;

    const customMessage = pids.getCustomMessage(i);
    const arrival = pids.arrivals().get(i);
    const rowY = START_Y + visibleRowIndex * ROW_HEIGHT;

    if (customMessage !== '') {
      drawCustomMessageRow(ctx, state, pids, i, rowY, customMessage);
      visibleRowIndex++;
      continue;
    }

    if (arrival == null) {
      if (!SHOW_FALLBACK_WHEN_EMPTY) continue;
      drawEmptyRow(ctx, state, pids, i, rowY);
      visibleRowIndex++;
      continue;
    }

    drawArrivalRow(ctx, state, pids, i, rowY, arrival);
    visibleRowIndex++;
  }
}
```

### 35.8 Web preview disclaimer

Web preview 是 editor-level simulation，不是 JCM renderer。

Web preview 应尽量模拟：

```text
- logical coordinate
- z-order
- repeat rows
- binding preview
- hidden row
- custom message
- hidden platform number
- empty arrival
```

Web preview 不承诺完全模拟：

```text
- JCM Text layout pixel behavior
- exact font rendering
- marquee timing
- Minecraft texture sampling
- alpha blending
- zOrder 和 draw order 的所有边界行为
```

这些项目需要进入 `JCM Runtime To Verify`，等有真实 JCM 环境时做 smoke test。

## 36. Final v0.1 Development Decision

当前文档已经足够支撑 v0.1 开发。下一步不再继续打磨文档，直接进入实现。

推荐开发顺序：

```text
1. 拆分 App.tsx
2. 建立 jcmSpec.ts
3. 建立 editor store
4. 建立 command/action layer
5. 重构 binding registry
6. 给 codegen 加 snapshot tests
7. 给 export 加 JCM compatibility checker
8. 加 import/migration 基础设施
9. 加 resource asset manager MVP
10. 最后迁移 canvas engine 或增强 SVG canvas
```

v0.1 开发期间的判断标准：

```text
能在 Web 环境稳定完成 Project JSON AST -> JCM JavaScript -> Resource Pack ZIP。
导出前能发现主要 schema、binding、resource path 和 JCM API compatibility 问题。
不承诺完整反解析任意手写 JS。
不要求日常开发依赖 Minecraft/JCM runtime。
```
