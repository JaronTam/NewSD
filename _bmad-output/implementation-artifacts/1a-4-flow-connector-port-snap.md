---
baseline_commit: 405c5ebf9d1253a0d247b038054c37bb926021ad
---

# Story 1a.4: 流量连接器与端口吸附

Status: review

## Story

**As a** 单人建模者,
**I want** 在存量/源汇间连流量并自动吸附端口,
**So that** 表达图元间的物质/信息流。

本 story 是 Story 1a.3 起正式 story-cycle(CS→VS→DS→CR)的第二片(epics.md line 382)。实现模式裁定 = **单 PR 走完整 story-cycle**(sprint-plan-2026-07-05 §1 裁定 #2;1a.3 起不再 sub-PR 分片,例外见 §6 判据于 Dev Notes 评估)。本 story 无逆向 CR 直接 fold 项(reverse-cr-1a1-1a2-findings.md 的 A1/A2/A4/C3/D1 已由 1a.3 首片 fold;B/C/E 段属后续 story);epic 边界 guard 段 E3/E10/E11 + AR#12 空态 全 fold 进本片(均创建侧,persist/粘贴侧 defer 至 4.x)。

**前置依赖(已闭合)**:Story 1a.1(无限画布导航 + camera.ts Float64 仿射 + Docker/CI 三轨)✅;Story 1a.2(AD-9 VRAM 渲染基座:双缓冲 + 辉光图集 + hue-shift shader + F1-quality 标定)✅;Story 1a.3(网格吸附 + 存量/源汇图元 + SDElement store + RenderInstance 9-字段契约 + setInstance mutation API + Playwright e2e 基建)✅。基座 `VRAMRenderer`/`bakeGlowAtlasCanvas`/`createElementStore`/`stockToInstances`/`cloudToInstances`/`snapToGrid`/`shouldSnap`/`findElementAt`/`getElementBounds` 已就绪;`RenderInstance` 9 字段(glyphIdx/lumaIdx/colorIdx/worldX/worldY/entityType/zOrder/rotation/selected)已落 1a.3,`a_rotation`/`a_selected` 已为 shader-live per-instance attrib(待 flow 箭头旋转激活 `rotation`)。

**为后续 story 预留**:flow 域模型 + `@<uuid>` 引用机制 为 1a.5(空间索引:flow 路径 bbox 剔除)/1a.7(toolbar:替换 1a.4 最小 tool-mode 桩)/1a.8(属性面板+公式编辑器:消费 1a.4 `formatFormulaForEditor` helper 显 `@uuid`→name)/1b+(Wasm 仿真:flow formula 经 AST 求值,1a.4 仅落 syntactic parse + 非仿真预览)奠基。

---

## Acceptance Criteria

> AC 给到 Given/When/Then 粒度。AC 编号 AC-1..AC-17 + AC-12b/12c(VS 修订增),任务段映射见 Tasks。verbatim epic AC 见 References。

### Flow 域模型子段(epics.md L390-393)

**AC-1** — **Given** 1a.3 存量/源汇图元存在 **When** 用户创建流量(flow) **Then** flow 属性含 `id`(UUIDv4)/`kind:"flow"`(等价 epic `type:"flow"`,判别字段沿用 1a.3 `kind` 惯用法)/`fromId`/`toId`/`formula`/`isVariable`(true `▼`/false `○`)/`lastValue`(运行时,不持久化);模型源 = `src/lib/sd/types.ts` 的 `Flow` 接口(已存在,缺 `units`,见 Dev Notes 域模型对账)。

**AC-2** — **Given** flow 方向语义 **When** 表达 from→to **Then** 方向由 `fromId`→`toId` 表达,**不设极性字段**(无 `polarity`/`direction` 字段);源/汇语义由 cloud 是否在端点涌现(1a.3 AC-12),flow 自身仅记端点 id。

**AC-3** — **Given** flow 的 `units` **When** 创建/读取 flow **Then** `units` 自动派生为目标存量(`toId` 所指 stock)的 `units` / 时间单位(如 `people/year`),**只读**(不由用户直接编辑;派生函数 `deriveFlowUnits(flow, elements)` 运行时计算,不持久化独立 `units` 字段);时间单位默认 = `/dt`(量纲系统基础约定,CS 钉死不推 DS);覆盖规则:若 flow `formula` 含 `[单位]` annotation token,则取 formula 标注的时间单位覆盖 `/dt`(如 `0.05 [1/year]` → 时间单位 `/year`,units = `<toId.units>/year`);`toId` 指 cloud(无限容量无 units)时 units = `""`(空字符串,fallback,不论 formula 是否含 `[单位]`)。

### 公式与命名不变量子段(epics.md L394)

**AC-4** — **Given** flow 的 `formula` 字符串 **When** 解析 **Then** tokenizer 识别 `数值 [单位]` 标注产生式(如 `0.05 [1/year]`,`[单位]` 为可选 annotation token,不影响求值,供量纲推导 1b.6 消费);F2-amend(AD-6):parser 复用 prototype `formula.ts` 递归下降结构扩 `@<uuid>`/`[单位]` 产生式,AST 为单一真相源(供 autodiff 图/量纲校验/tokenizer 共用,1b+ 落地;1a.4 落 syntactic parse + TS 非仿真预览 `evalFormula`,sim 步求值经 Wasm defer 1b.3)。

**AC-5**(Naming 不变量)— **Given** 公式以 `@<uuid>` 引用存量(stockId) **When** 编辑器显示/重命名存量 **Then** 存储层 `flow.formula` 存 `@<uuid>`(UUIDv4,非 name);显示层经 `formatFormulaForEditor(formula, elements): string` 将 `@<uuid>` 渲染为所引存量的 `name`(编辑器 UI 1a.8 落,1a.4 落 helper + 数据层不变量);**重命名存量只改 `name` 不动 `id`**,flow formula 中的 `@<uuid>` 引用永不断裂(ARCHITECTURE-SPINE L190 Naming 不变量);同名存量允许(AC-15),量纲/引用以 `id` 解析非 `name`。

### 渲染子段(epics.md L395, L398)

**AC-6** — **Given** flow 的 from/to 端口位置 **When** 渲染 flow **Then** 经 **纯正交 Manhattan 路由**(Bresenham 退化为仅水平/垂直步进,允许单转角 L 形:**先沿 x 轴走完再沿 y 轴走完(horizontal-first,轴序钉死)**,**禁止对角步进**——BOX_GLYPHS 路径字符集 `─│` 直线段 + `┌┐└┘` 转角均无对角字符,故路由必须正交)在字符格上寻路(fromId 端口 → toId 端口);路径以 BOX_GLYPHS 字符(`─│` 直线段 + `┌┐└┘` 转角,均已在 CHARSET,无需 re-bake)绘制;端点箭头 `▶`(U+25B6)置于 `toId` 端,经 `a_rotation` per-instance attrib 旋转匹配路径**末端段正交方向**,rotation ∈ {`0`=→(E), `π/2`=↓(S), `π`=←(W), `-π/2`=↑(N)}(4 正交方向,**无对角 ±π/4**——对角方向无对应路径字符,故不产生);Bresenham 为整数网格算法,world 坐标取整后运算,不引入 Float64 精度退化(E7)。

**AC-7** — **Given** flow 的 `isVariable` **When** 渲染 **Then** `isVariable: true` 显 `▼`(U+25BC,可变流量标记),`isVariable: false` 显 `○`(U+25CB,常数流量标记),标记置于 `fromId` 端口**沿 flow 方向(指向 toId)向外偏移 1 格处**——即 marker world 坐标 = `fromPort.{x,y} + dir × 1 cell`,`dir` = Bresenham 路径首段单位方向向量(正交,∈ {(1,0),(-1,0),(0,1),(0,-1)};horizontal-first 下首段沿 x 轴——`fromPort.x ≠ toPort.x` 时 dir ∈ {(1,0),(-1,0)},同列时首段退化、dir 沿 y 轴 ∈ {(0,1),(0,-1)});该格为路径首单元,marker 与 path glyph 重叠时 **marker 优先绘制**(zOrder 上层,数组序在 path instance 之后);`▶`/`▼`/`○` 三 glyph 须加入 glowAtlas CHARSET(见 AC-8 re-bake)。

**AC-8**(渲染基建激活)— **Given** glowAtlas CHARSET(1a.2 = ASCII 32-126 + BOX_GLYPHS)缺 `▶`(U+25B6)/`▼`(U+25BC)/`○`(U+25CB) **When** 1a.4 re-bake **Then** 新增 `FLOW_GLYPHS = "▶▼○"` const 并入 CHARSET,`bakeGlowAtlasCanvas` re-bake(off-screen one-time,AD-9 唯一合法 shadowBlur 站点);**严禁**改 locked 常量 `GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3`(`glowAtlas.test.ts:61-65` 锁定);**And** `elements.ts` `pushChar` 激活 `rotation` 参数(现 hardcoded 0,TODO "await 1a.4" 兑现),flow 箭头经旋转 quad 落地;`zOrder` 仍 CPU 侧(`render()` 按 array order 绘,1a.3 A1 备注)。

### 端口吸附子段(epics.md L396-397)

**AC-9** — **Given** 每个元素(stock/cloud) **When** 定义连接点 **Then** 元素周边有预定义端口(stock 4 边中点;cloud 4 边中点,镜像 stock 口径),经 `getElementPorts(el): {portId: string, x: number, y: number}[]` 纯函数返回(world 坐标,随元素 `x/y/width/height` 实时算)。端口坐标(world,相对元素左上角):stock `{w,h}` → `N:(x+w/2, y)`、`S:(x+w/2, y+h-1)`、`E:(x+w-1, y+h/2)`、`W:(x, y+h/2)`(取整);cloud 固定 6×3(`CLOUD_SHAPE`,`elements.ts:156/191-192`)→ `N:(x+3, y+0)`、`S:(x+3, y+2)`、`E:(x+5, y+1)`、`W:(x+0, y+1)`;`portId` = `${el.id}#${side}`(side ∈ {N,E,S,W})。flow 元素无端口(`getElementPorts(flow)` 返 `[]`)。

**AC-10** — **Given** 用户创建连线(flow tool 模式) **When** pointerDown 在元素端口附近(屏幕容差 8px,复用 `shouldSnap` 容差口径) **Then** 自动吸附到最近端口(`findNearestPort(wx, wy, elements, tol)`);拖拽预览至目标元素端口附近 → pointerUp 吸附目标端口 → `createFlow({fromId, toId, formula, isVariable})`;需引入 `ToolMode="flow"` 激活(types.ts `ToolMode = "select"|"stock"|"cloud"|"flow"` 已存在,1a.4 落**键盘切换桩**:`F`→flow / `S`→stock / `C`→cloud / `V`→select,**仅键盘**,toolbar UI defer 1a.7——CS 钉死二选一取键盘以保单 PR scope 可控,删去 "或最小 toolbar stub" 未决项)。

**AC-11** — **Given** flow 已附着两端元素 **When** 拖拽任一端元素(stock/cloud) **Then** 端口位置随元素移动更新,flow 路径自动重算(`flowToInstances` 读 live element 位置;`elementStore.subscribe` → `buildInstancesFromStore` rebuild → `render()`,1a.3 已布的 store 订阅链自动驱动,1a.4 验证即可)。

### 边界 guard 子段 — E3/E10/E11/重名(epics.md L403-407, L399)

**AC-12**(E3 self-loop)— **Given** 用户创建流量 **When** `fromId == toId`(self-loop) **Then** 创建时 reject(`createFlow` `throw new Error("Self-loop not allowed")`,UI try/catch 显校验失败提示),防自环致代数环/守恒破坏;创建侧 1a.4,粘贴侧 4.3 同拒(defer)。

**AC-12b**(端点有效性 guard)— **Given** 用户创建流量 **When** `fromId`/`toId` 指向不存在的元素 id,或指向 `kind === "flow"` 的元素(Flow→Flow 连接) **Then** 创建时 reject(`createFlow` `throw new Error("Invalid flow endpoint")`,与 E3 self-loop 同一 guard 族);`createFlow` 校验 `fromId`/`toId` 各自指向存在的 Stock 或 Cloud(Flow 是首个带引用的元素类型,`createStock`/`createCloud` 无外键无需此校验);Flow→Flow 语义未定义故禁。与 AC-12 合并为 `createFlow` 入口同一校验序列:先查存在性 + 类型 → 再查 self-loop。throw 形式保返回类型为 Flow(与 `createStock`/`createCloud` 一致),UI 侧 try/catch。

**AC-12c**(删除悬空引用 — 渲染侧优雅降级,Option B)— **Given** flow 的 `fromId`/`toId` 所指 stock/cloud 被 `deleteElement` 删除(`deleteElement` 为纯移除无级联,`store.ts:119-124`) **When** 渲染该 flow **Then** `flowToInstances` 检测端点存活(查 `elements` 中 `fromId`/`toId` 是否存在且非 flow),悬空则**跳过该 flow 渲染 + `console.warn`**("flow <id> has dangling endpoint"),不抛异常、不阻断其他图元渲染、不自动删除 flow 记录(用户可手动清理或后续 story 处理);选 Option B(最简,不阻塞交互)而非级联删(A,破坏性)/store 引用完整性(C,超 1a.4 scope)。

**AC-13**(E10 orphan cloud)— **Given** cloud 无 flow 附着 **When** 创建/存在 orphan cloud **Then** allow(cloud 为边界元素无限容量,语义由 flow 涌现非必有 flow,可独立存在);persist 时 warn(状态栏 "N 个孤立 cloud")defer 4.x;1a.4 创建侧仅 allow(orphan cloud 不阻断创建/存在),状态栏 warn 占位可随 AC-14/15 状态栏机制一并落或 defer。

**AC-14**(E11 parallel flows)— **Given** 两 flow 同 `fromId`/`toId` **When** 创建并行流量 **Then** allow(允许并行流量,物质可分流)+ 状态栏软警告 warn duplicate(非阻断);1a.4 创建侧,与重名软警告取向一致(允许+提示非阻断)。**已知限制(1a.4,CS 显式裁定 defer)**:parallel flows 共享 `fromId`+`toId` 时,`getElementPorts` 返固定 4 端口 → 正交 Manhattan 路径完全重叠,终端用户视觉不可区分;port 错开(按 flow 创建顺序轮询 from-port 候选集使路径分叉)或路径偏移 defer 后续 story。理由:1a.4 聚焦 flow 连通性 + 端口吸附核心闭环,视觉去重属 polish;port 轮询需 `getElementPorts` 返有序候选集 + `createFlow` 记创建序,scope 膨胀风险触发 §6 sub-PR 判据,故后置。

**AC-15**(重名软警告)— **Given** flow 或 stock 重名 **When** 创建/重命名 **Then** 允许同名(不阻断),状态栏软警告提示;量纲推导/公式引用以 `id` 解析非 `name`(AC-5 Naming 不变量),同名不致引用歧义。

### 空态子段 — AR#12(epics.md L411-414)

**AC-16**(AR#12 空画板空态)— **Given** 新建/打开空画板(无图元) **When** `elementStore.getElements().length === 0` **Then** 显空态引导(占位文案/图示引导用户建首个图元,非空白画布无提示);**And** 空态不阻塞操作(用户可立即开始建图元);与 B10 空模型禁仿真一致(空可建图元但不可跑仿真,sim defer 1b)。空态文案(CS 钉死精确字符串,非示例):中文 = `按 S 放置存量 · 按 C 放置源汇 · 按 F 连流量`;英文(未来 i18n story 录用,1a.4 无 i18n 基建先落中文硬编码)= `Press S to place stock · C for source/sink · F to connect flow`。

### 视觉 gate 子段

**AC-17** — **Given** 1a.3 Playwright e2e 基建就绪 **When** 1a.4 落 flow 渲染 **Then** 新增 `e2e/flow-render.spec.ts`:seed flow(经 `page.evaluate(() => elementStore.createFlow(...))` 或 UI 创建)→ `waitForRenderReady` → `gl.readPixels` 断言 flow bbox 非背景像素(镜像 `stock-render.spec.ts`/`cloud-render.spec.ts` 模式);flow 视觉 gate 须覆盖路径 + 箭头 + ▼/○ 标记。

---

## Tasks / Subtasks

> 单 PR 走完整 story-cycle。§6 判据评估见 Dev Notes(DS step4 复核并记录决策)。

- [x] **Task 1: Flow 域模型 + units 派生 + 端点 guard**(AC: 1, 2, 3, 12b)
  - [x] 1.1 `src/lib/sd/types.ts` `Flow` 接口增 `units: string` 字段(只读派生——CS 钉死:`deriveFlowUnits(flow, elements): string` 纯函数为单一真相源,`Flow.units` 为 `createFlow` 构造时调用该函数填充的 readonly 字段,**不持久化独立 `units`**——4.x persist 层排除,reload 时 `createFlow` 重算;不存为 getter/不存两份,防双源不一致);确认 `lastValue` 为运行时字段(不持久化);对齐 epic AC-1/2/3。
  - [x] 1.2 `src/lib/sd/store.ts` 增 `createFlow({fromId, toId, formula, isVariable, name?}): Flow`——生成 UUIDv4 id(`crypto.randomUUID()`);**入口校验序列**(AC-12/12b 同族,throw 形式保返回类型 Flow):① 端点有效性——`fromId`/`toId` 各自指向存在的 Stock 或 Cloud(拒绝不存在 id 或 `kind === "flow"` 目标,`throw new Error("Invalid flow endpoint")`)→ ② E3 self-loop guard(`fromId === toId` → `throw new Error("Self-loop not allowed")`);E11 parallel-flow 检测(同 fromId/toId 已存在 → allow + 记 warn 标志,AC-14);重名 allow(AC-15);返回完整 Flow(`units` 经 `deriveFlowUnits` 填充)。
  - [x] 1.3 `src/lib/sd/store.ts`(或 elements 模块)增 `deriveFlowUnits(flow, elements): string`——目标存量(`toId` 所指 stock)的 `units` + "/时间单位";时间单位解析(CS 钉死,AC-3):默认 `/dt`;若 `flow.formula` 含 `[单位]` annotation token 则取该标注覆盖 `/dt`;`toId` 指 cloud 或不存在 → 返 `""`(空字符串 fallback)。
  - [x] 1.4 `src/lib/sd/types.test.ts` Flow fixture 增 `units` 断言;`src/lib/sd/store.test.ts` 增 `createFlow` 契约 + **AC-12b 端点有效性 reject**(不存在 id / Flow 目标)+ E3 reject + E11 warn + 重名 allow + `deriveFlowUnits` 时间单位解析(默认 `/dt` / `[单位]` 覆盖 / cloud fallback `""`)测试(镜像现有 `createStock`/`createCloud` 测试风格)。

- [x] **Task 2: 公式 @uuid + [单位] 产生式 + 命名不变量**(AC: 4, 5)
  - [x] 2.1 `src/lib/sd/formula.ts` tokenizer 增 `@<uuid>` ref token(`@` 后跟 UUIDv4 格式 `[0-9a-f]{8}-...`)与 `[单位]` annotation token(`[` ... `]` 内非 `]` 字符序列);parser 产生式扩展(ref token 作变量引用,annotation token 跳过/附加 AST 节点不影响求值);F2-amend:复用 prototype 递归下降结构,AST 单一真相源(1b+ autodiff/量纲校验消费,1a.4 落 syntactic parse)。
  - [x] 2.2 `evalFormula(src, env)` 扩 `@<uuid>` ref 解析——env 以 uuid 为键(`env[uuid] → number`),`@<uuid>` 查 env 求值(TS 非仿真预览,AD-15;sim 步经 Wasm defer 1b.3);`[单位]` annotation 不影响数值求值。
  - [x] 2.3 新增 `formatFormulaForEditor(formula: string, elements: SDElement[]): string`——将 `@<uuid>` 渲染为所引存量 `name`(Naming 不变量显示层;编辑器 UI 1a.8 消费);重命名存量(`updateElement(id, {name})`)只改 name 不动 id,flow formula `@<uuid>` 不断裂(数据层自动保证)。
  - [x] 2.4 `src/lib/sd/formula.test.ts` 增 `@<uuid>` ref 解析 + `[单位]` annotation 跳过 + CJK identifier 回归(防 1a.3 carry 的 `一-鿿` 范围回归)测试;新增 `formatFormulaForEditor` 测试(`@uuid`→name 映射 + 重命名不变量 + 缺失 uuid 容错)。

- [x] **Task 3: glowAtlas re-bake + rotation 激活**(AC: 8)
  - [x] 3.1 `src/lib/render/vram/glowAtlas.ts` 增 `export const FLOW_GLYPHS = "▶▼○";`(U+25B6/U+25BC/U+25CB);`CHARSET` 并入 `FLOW_GLYPHS`(ASCII 32-126 + BOX_GLYPHS + FLOW_GLYPHS);`bakeGlowAtlasCanvas` 自动 re-bake(off-screen one-time,AD-9 唯一合法 shadowBlur 站点);**严禁**改 `GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3`(`glowAtlas.test.ts:61-65` 锁定)。
  - [x] 3.2 `src/lib/render/elements.ts` `pushChar` 激活 `rotation`——增 `rotation: number` 参数(CS 钉死:扩现有 `pushChar` 签名,不新增 `pushCharRot` 变体,避免 API 重复;`pushString` 透传 `rotation: 0`),兑现 TODO "await 1a.4"(现 hardcoded `rotation: 0`);stock/cloud 透传 `rotation: 0`(不旋转),flow 箭头透传末端段方向角。
  - [x] 3.3 `src/lib/render/vram/glowAtlas.test.ts` 增 `▶▼○ ∈ CHARSET` 断言 + `charToGlyphIdx("▶"/"▼"/"○")` 返回有效 idx(≥0)断言;locked 常量不变断言保持;`src/lib/render/elements.test.ts` 增 `pushChar` rotation 透传断言(flow 箭头 rotation ≠ 0,stock/cloud rotation === 0)。

- [x] **Task 4: flow 渲染 — 正交 Manhattan 路由 + 箭头 + 标记 + 悬空降级**(AC: 6, 7, 12c)
  - [x] 4.1 `src/lib/render/elements.ts` 增 `flowToInstances(flow: Flow, elements: SDElement[], selected: boolean): RenderInstance[]`——**先 AC-12c 悬空检查**:查 `elements` 中 `fromId`/`toId` 存在且 `kind ∈ {stock,cloud}`,任一悬空 → 返 `[]` + `console.warn("flow <id> has dangling endpoint")`(不抛);**纯正交 Manhattan 寻路**(Bresenham 退化仅 H/V 步进 + 单转角 L 形,禁对角,**horizontal-first:先走 x 再走 y**):fromId 端口 → toId 端口,端口经 `getElementPorts` 取最近端(AC-9 坐标);路径字符 `─│` 直线 + `┌┐└┘` 转角(BOX_GLYPHS 已含);端点箭头 `▶` 置 toId 端,`rotation` = 末端段正交方向映射(见 4.4 表);`isVariable` → `▼`/`○` 标记置 `fromPort + dir×1 cell`(AC-7,marker 数组序在 path 之后以优先绘);colorIdx=3(flow,CS 钉死,与 stock 0/cloud 2 区分);`selected` 透传(vertex shader `effectiveLuma = a_lumaIdx + a_selected` 提档,M1)。
  - [x] 4.2 `getElementBounds(el)` flow 分支返路径 bbox(现返 `{0,0,0,0}`,1a.3 占位)——遍历 flowToInstances 取 min/max worldX/worldY;为 1a.5 视口剔除/`findElementAt` 提供 bbox。
  - [x] 4.3 `src/lib/render/CanvasView.tsx` `buildInstancesFromStore` 增 flow 分支(现 TODO `// flow rendering added in 1a.4 (edges)` line 217 兑现);z-order(CS 钉死):flow instances 在 array 中**先于** stock/cloud instances(先绘,被 nodes 覆盖在下层,即 edges 在 nodes 之下——常规图编辑器惯例,避免路径压住图元文字);render 按 array order 绘,后续无重排。
  - [x] 4.4 `src/lib/render/elements.test.ts` 增 `flowToInstances` 测试——正交路径单元数 > 0、箭头 `▶` instance 存在且 `rotation` 匹配末端段方向、`▼`/`○` 标记随 `isVariable` 切换且位于 `fromPort+dir×1`、`selected` 透传、**AC-12c 悬空 flow 返 `[]` + warn**;`getElementBounds(flow)` 返非零 bbox。rotation→方向映射表(CS 钉死,测试直接对照断言,均为正交无对角):

    | rotation | 方向 | 末端段走向 | 测试构造(toId 在 fromId 的) |
    | -------- | ---- | ---------- | --------------------------- |
    | `0`      | →(E) | +x         | 右侧(同 y)                  |
    | `π/2`    | ↓(S) | +y         | 下方(同 x)                  |
    | `π`      | ←(W) | -x         | 左侧(同 y)                  |
    | `-π/2`   | ↑(N) | -y         | 上方(同 x)                  |

- [x] **Task 5: 端口吸附**(AC: 9, 10, 11)
  - [x] 5.1 `src/lib/render/elements.ts` 增 `getElementPorts(el: SDElement): {portId: string, x: number, y: number}[]`——stock 4 边中点(N/E/S/W,坐标公式见 AC-9);cloud 4 边中点(6×3 固定,`N:(x+3,y+0)`/`S:(x+3,y+2)`/`E:(x+5,y+1)`/`W:(x+0,y+1)`,AC-9);flow 返 `[]`;`findNearestPort(wx, wy, elements, tolWorld): {elId, portId, x, y} | null`——遍历所有元素端口取最近(≤ tolWorld,复用 `shouldSnap` 8px/zoom 口径)。
  - [x] 5.2 `src/lib/render/CanvasView.tsx` flow 创建交互:引入 `toolMode: ToolMode` 状态(Ref 或 state;`ToolMode = "select"|"stock"|"cloud"|"flow"` 已存在于 types.ts,1a.4 落**键盘切换桩**——`F`→flow/`S`→stock/`C`→cloud/`V`→select,仅键盘,toolbar defer 1a.7);`toolMode === "flow"` 时 pointerDown 经 `findNearestPort` 吸附 fromId 端口 → 拖拽预览临时 flow → pointerUp `findNearestPort` 吸附 toId 端口 → `elementStore.createFlow(...)`(端点有效性/E3/E11 guard 在 store 侧,Task 1.2);校验失败(端点无效/E3 self-loop)显提示。
  - [x] 5.3 拖拽元素时端口随更新:验证 `flowToInstances` 读 live element 位置(`elementStore.subscribe` → rebuild 链已布 1a.3),拖拽 stock/cloud 时 flow 路径自动重算;无额外代码,补测试验证。
  - [x] 5.4 `src/lib/render/CanvasView.test.tsx` 增 flow 创建交互测试(镜像现有 `fireEvent.pointerDown/Move/Up` 模式)。jsdom 间接观测方案(CS 钉死,绕过无真视口/getBoundingClientRect 不可用):测试注入 camera mock 使 `screenToWorld` = identity(pointer 坐标直接当 world 坐标),断言 ① `elementStore.createFlow` spy 捕获的 `{fromId,toId}` 为预期端口所属元素(吸附生效);② 拖拽预览期临时 flow DOM 节点带 `data-port-snapped="from"`/`"to"` attribute(吸附态标记);③ pointerUp 后 store 含新 flow。拖拽 stock → flow 路径重算:断言 `flowToInstances` 输出实例 worldX/worldY 随 stock 新位置变化(纯函数直接调,不经 DOM)。像素级吸附视觉验证归 AC-17 Playwright,不入 vitest scope。

- [x] **Task 6: 边界 guard — E3/E10/E11/重名/端点有效性/悬空降级**(AC: 12, 12b, 12c, 13, 14, 15)
  - [x] 6.1 E3 self-loop + AC-12b 端点有效性 reject(CS 钉死 throw 形式,保 `createFlow` 返回类型为 Flow,与 `createStock`/`createCloud` 返回元素类型一致;UI 侧 try/catch):`createFlow` 入口序列 ① 端点无效(不存在 id / Flow 目标)→ `throw new Error("Invalid flow endpoint")` ② `fromId === toId` → `throw new Error("Self-loop not allowed")`;UI 捕获显校验失败提示。
  - [x] 6.2 E10 orphan cloud allow:确认 cloud 无 flow 附着仍合法(`createCloud` 不要求 flow;`getElements()` 含 orphan cloud 不报错);persist warn 状态栏 defer 4.x(1a.4 仅 allow,状态栏 warn 机制可随 6.3 一并占位或 defer)。
  - [x] 6.3 E11 parallel flows allow + warn:`createFlow` 检测同 fromId/toId 已存在 → allow + 记 warn 标志(状态栏软警告,非阻断);状态栏 warn UI(AC-14/15 共用)——最小实现:HUD 或 `.ns-canvas__warn` 区域显 warn 文案。
  - [x] 6.4 重名 allow + warn:flow/stock 重名 allow + 状态栏 warn(量纲/引用以 id 解析,AC-5/AC-15)。
  - [x] 6.5 `src/lib/sd/store.test.ts` 增 E3 reject / E11 allow+warn / 重名 allow+warn 测试;`CanvasView.test.tsx` 增状态栏 warn UI 测试(若 6.3 落状态栏)。

- [x] **Task 7: 空态引导 AR#12**(AC: 16)
  - [x] 7.1 `src/lib/render/CanvasView.tsx` 空态:`elementStore.getElements().length === 0` 时显空态引导(精确文案见 AC-16:中文 `按 S 放置存量 · 按 C 放置源汇 · 按 F 连流量`,1a.4 硬编码无 i18n);不阻塞操作(用户可立即建图元);与 B10 空模型禁仿真一致(空可建图元不可跑仿真,sim defer 1b)。注意:1a.3 `seedSampleStocks()` 默认 seed 3 stock——CS 钉死:seed 行为保留不改(DEV harness 默认有图元),空态测试用独立空 store(`createElementStore()` 新实例,不复用 module singleton)验证,生产空画板入口 defer 后续 story。
  - [x] 7.2 `src/lib/render/CanvasView.test.tsx` 增空态引导测试(空 store 显引导;非空不显);AR#12 与 B10 一致性备注(空可建图元,禁仿真 defer 1b)。

- [x] **Task 8: Playwright flow 视觉 gate**(AC: 17)
  - [x] 8.1 `e2e/flow-render.spec.ts`——seed flow 经 `page.evaluate(() => elementStore.createFlow({fromId, toId, ...}))`(两个 seed stock 间)或 UI 创建;`waitForRenderReady`(复用 stock/cloud spec helper 模式)→ `gl.readPixels` 断言 flow bbox 区域非背景像素;镜像 `stock-render.spec.ts`/`cloud-render.spec.ts` 结构。
  - [x] 8.2 `.gitignore` 无需改(`playwright-report/`/`test-results/` 已 1a.3 落);`playwright.config.ts` 无需改(1a.3 落);若需目视核验截图,先「⚠ 切多模态」停手等确认(story-cycle §7 gate)。

- [x] **Task 9: §6 单 PR 决策复核(DS step4)**(story-cycle §6)
  - [x] 9.1 DS step4 前复核 §6 判据(见 Dev Notes §6 评估);若判回退 sub-PR,记录决策 + 理由于本文件 Dev Agent Record,并拆分 sub-PR 范围。默认 = 单 PR(裁定 #2)。

---

## Dev Notes

### 架构模式与约束

- **AD-9(F1: VRAM render — glow atlas + double buffer + hue-shift shader)**:本 story 在 1a.3 基座上落地 flow 渲染(正交 Manhattan 路径(Bresenham 退化)+ 端点箭头 ▶ + ▼/○ 标记)。VRAM 路径 = 离屏预烘辉光图集(`bakeGlowAtlasCanvas`,shadowBlur **唯一**合法站点,off-screen one-time)+ WebGL2 instanced + NEAREST 采样。**严禁** runtime per-glyph shadowBlur(1000 图元 × GPU blur/frame 不可达)。
- **CAP-11(runtime shadowBlur 禁止)**:结构 grep 守卫 `cap11-shadowblur-guard.test.ts`(walk `src/`,allowlist = `lib/render/vram/glowAtlas.ts` 唯一)+ runtime spy `CanvasView.test.tsx`(Proxy mock ctx 记录 `shadowBlur` 赋值)。**1a.4 新增的 flow 路径/箭头/标记 draw 代码均不得引入 `.shadowBlur =`**;flow 选中辉光经 vertex shader `effectiveLuma = a_lumaIdx + a_selected` 提档(1a.3 M1 机制,cpu 透传 `selected`,不 bump `lumaIdx`)。两守卫会捕获任何违规。
- **F1-quality(目视不可区分,locked)**:halo:core ≈ 2.5×,标定常量 `GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3` 由 `glowAtlas.test.ts:61-65` 锁定防静默回退。**1a.4 不得改这些常量**;`FLOW_GLYPHS` 加入 CHARSET 触发 re-bake,但 locked 常量不动,halo 标定保持;若 halo 视觉需重验,跑本地 Playwright 像素分析重测(截图归档 `.playwright-mcp/`,gitignored;读图前先切多模态)。
- **Naming 不变量(ARCHITECTURE-SPINE L190)**:formula reference id/name layering——存储层 `flow.formula` 存 `@<uuid>`(UUIDv4 stockId);显示层 `formatFormulaForEditor` 渲染 `@<uuid>` 为存量 `name`;重命名只改 `name` 不动 `id`,refs 永不断裂。1a.4 落数据层 + helper,编辑器 UI defer 1a.8。
- **F2-amend / AD-6(formula parser)**:parser 复用 prototype `formula.ts` 递归下降结构扩 `@<uuid>`/`[单位]` 产生式,AST 单一真相源(供 autodiff 图/量纲校验/tokenizer 共用,1b+ 落地;LU/sparse 交 faer,不引入 meval)。**1a.4 scope 边界**:落 syntactic parse(tokenizer + parser 产生式)+ TS 非仿真预览 `evalFormula`(`@<uuid>` 查 env 求值,AD-15)+ `formatFormulaForEditor` 显示层;**full AST-as-truth-for-autodiff + Wasm sim 步求值 + 量纲代数 defer 1b.3/1b.6**(sim 侧)。TS `evalFormula` = 非仿真预览唯一路径(1a.4 阶段无 Wasm 集成)。
- **E7(Float64 精度守卫)**:`WORLD_CLAMP=1e15`(camera.ts),`clampCamera` 钳制 world + zoom。Bresenham 为整数网格算法,world 坐标取整后运算,不引入精度退化;端口吸附在 world 空间运算。
- **规格基准 = epic**:冲突以 `epics.md` 为准,非 prototype(见 memory)。verbatim AC 见 References。

### 域模型对账(已读源码,CS 阶段核实)

| 模块                               | 现状(1a.3 末)                                                                                                                                                                                                                        | 1a.4 GAP / 处置                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/sd/types.ts` `Flow`       | `id/kind:"flow"/name/fromId/toId/formula/isVariable/lastValue/formulaError?`                                                                                                                                                         | 缺 `units`——增(只读派生,`deriveFlowUnits` 函数,不持久化独立字段,AC-3);`lastValue` 运行时不持久化                                                                                                                                                                |
| `src/lib/sd/formula.ts`            | 递归下降 `evalFormula(src, env)`,tokenizer 仅 `num`/`id`(`/[A-Za-z_一-鿿]/`)/`op`/`lp`/`rp`                                                                                                                                          | 缺 `@<uuid>` ref token + `[单位]` annotation token——扩 tokenizer + parser 产生式(AC-4/5);CJK `一-鿿` 范围须保持(1a.3 carry,回归测试)                                                                                                                            |
| `src/lib/sd/store.ts`              | `createElementStore()` → `getElements`/`createStock`/`createCloud`/`updateElement`/`deleteElement`/`setElements`/`subscribe`/`getSnapshot`;`validateStockSize`(E9);`deleteElement` 纯移除无级联(L119-124)                            | 缺 `createFlow`——增(UUIDv4 id + **AC-12b 端点有效性 guard** + E3 self-loop guard + E11 parallel warn + 重名 allow,AC-1/12/12b/14/15);`deleteElement` 不改(级联由渲染侧 AC-12c Option B 处理);为 AD-10 Y.Doc 替换点预留(1a.3 设计)                               |
| `src/lib/render/elements.ts`       | `EntityType={STOCK:0,CLOUD:1,FLOW:2}`;`pushChar`/`pushString`(`rotation` hardcoded 0,TODO "await 1a.4");`stockToInstances`/`cloudToInstances`;`getElementBounds`(flow 返 `{0,0,0,0}`);`findElementAt`;`resizeStock`;`RESIZE_HANDLES` | 缺 `flowToInstances`(**纯正交 Manhattan 路由** + ▶ + ▼/○ + **AC-12c 悬空检查**,AC-6/7/12c)/`getElementPorts`(AC-9,cloud 4 端口坐标钉死)/`findNearestPort`(AC-10);`pushChar` 激活 `rotation`(AC-8);`getElementBounds(flow)` 返路径 bbox(AC-6,T4.2)               |
| `src/lib/render/vram/glowAtlas.ts` | `BOX_GLYPHS="─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬"`;`CHARSET`=ASCII 32-126 + BOX_GLYPHS(117 chars);`charToGlyphIdx` 缺返 -1;locked `GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3`                                                         | 缺 `▶`(U+25B6)/`▼`(U+25BC)/`○`(U+25CB)——**re-bake 必需**(AC-8);增 `FLOW_GLYPHS="▶▼○"` const 并入 CHARSET;**不动 locked 常量**                                                                                                                                   |
| `src/lib/render/vram/renderer.ts`  | `RenderInstance` 9 字段;`render(camera, viewport, instances)` 按 array order 绘(zOrder 不应用于 draw);`setInstance(index, partial)` per-instance `bufferSubData`                                                                     | **无 GAP**(1a.3 基座就绪);flow instance 经 `flowToInstances` 产,`rotation` 字段已 shader-live(`a_rotation`),直接透传即可                                                                                                                                        |
| `src/lib/render/vram/shaders.ts`   | `a_rotation`/`a_selected` per-instance attrib;`effectiveLuma = a_lumaIdx + a_selected`;`PALETTE_SIZE` 单源                                                                                                                           | **无 GAP**;flow 箭头旋转经 `a_rotation` 落地(已 live)                                                                                                                                                                                                           |
| `src/lib/render/camera.ts`         | `snapToGrid`/`shouldSnap`(8px/zoom 容差);`worldToScreen`/`screenToWorld`                                                                                                                                                             | **无 GAP**;端口吸附复用 `shouldSnap` 容差口径                                                                                                                                                                                                                   |
| `src/lib/render/CanvasView.tsx`    | 双层 canvas(2D surface + WebGL2 gl);pointer 事件(pan/zoom/select/drag/resize);`buildInstancesFromStore`(flow TODO line 217);`seedSampleStocks` 默认 seed 3 stock;`elementStore` module singleton                                     | 缺 flow 创建交互(`toolMode="flow"` + 端口吸附,AC-10)/空态引导(AC-16);`buildInstancesFromStore` 增 flow 分支(AC-6);`toolMode` 状态(types.ts `ToolMode` 已存在,无 UI wiring,1a.4 落最小桩,完整 toolbar defer 1a.7);`seedSampleStocks` 与空态测试的张力(T7.1 备注) |
| `src/routes/vram.tsx`              | DEV harness,`buildSampleInstances` 展示 `text → RenderInstance[]` 经 `charToGlyphIdx` 模式                                                                                                                                           | 1a.4 `flowToInstances` 镜此模式(1a.3 `stockToInstances`/`cloudToInstances` 已镜)                                                                                                                                                                                |
| `e2e/`                             | `stock-render.spec.ts`/`cloud-render.spec.ts`(1a.3 落,`waitForRenderReady` + `readPixels` 模式)                                                                                                                                      | 增 `flow-render.spec.ts`(AC-17,镜像模式)                                                                                                                                                                                                                        |

### §6 单 PR vs sub-PR 评估(CS 评估,DS step4 终裁)

story-cycle §6 判据回退 sub-PR:**≥3 独立技术子系统 OR AC > 20**。

- **AC 计数**:AC-1..AC-17 + AC-12b/12c(VS 修订增:端点有效性 guard + 删除悬空引用降级)= 19(< 20 阈值)。
- **子系统计数**:1) Flow 域模型 + units 派生 + store createFlow/guards;2) formula @uuid/[单位] 产生式 + Naming 不变量 helper;3) glowAtlas re-bake + pushChar rotation 激活;4) flow 渲染(正交 Manhattan 路由 + 箭头 + 标记 + 悬空降级);5) 端口吸附 + CanvasView flow 创建交互 + 空态;6) Playwright flow 视觉 gate。≈ 6 子系统。
- **独立性**:formula 产生式(2)/glowAtlas re-bake(3)/Playwright gate(6)可独立 land;但 flow 渲染(4)强依赖 glowAtlas re-bake(3,▶▼○)+ pushChar rotation(3);端口吸附(5)强依赖 flow 渲染(4)+ store createFlow(1);共享 `Flow`/`RenderInstance`/`elementStore` 契约。
- **CS 推荐**:**单 PR**(裁定 #2 默认)。理由:AC 数 19 < 20;子系统虽 6 个但共享 `Flow`/`RenderInstance`/`elementStore` 契约,拆分 sub-PR 会产生跨 PR 契约 churn(尤其 `Flow.units` + `flowToInstances` + `formatFormulaForEditor` 三者共指 `Flow` 接口,若分片则中间片破坏数据层一致性)。**DS step4 若发现 scope 超单 PR 合理体量,可回退 sub-PR,但须于 Dev Agent Record 记录决策 + 理由 + 拆分范围后再推进**(story-cycle §6)。默认无回退。

### VS 修订钉死决策(G1/G2/G3 闭环,回 CS 修订点 1-12)

首轮 VS FAIL(7 歧义 + 4 遗漏 + 5 不可执行)。CS 修订钉死以下决策,不再推 DS:

1. **路由 = 纯正交 Manhattan**(G1-1/G3-3 + G1-NEW-1):Bresenham 退化仅 H/V 步进 + 单转角 L 形,禁对角(BOX_GLYPHS 路径字符集无对角字符);**轴序 = horizontal-first(先 x 后 y)**——off-axis 端口对先沿 x 轴走完再沿 y 轴,确定转角位置与末端段方向(同行/同列时退化为单段无转角);箭头 rotation ∈ {0, π/2, π, -π/2},删去对角 ±π/4。
2. **时间单位默认 = `/dt`**(G1-2/G3-1):formula 含 `[单位]` 则覆盖;cloud 目标 fallback `""`。
3. **cloud 端口 = 4 边中点**(G1-3/G3-2):`N:(x+3,y+0)`/`S:(x+3,y+2)`/`E:(x+5,y+1)`/`W:(x+0,y+1)`,镜像 stock 口径。
4. **▼/○ 标记位置 = `fromPort + dir×1 cell`**(G1-4):dir = 路径首段正交单位向量;marker 数组序在 path 之后优先绘。
5. **toolMode = 仅键盘**(G1-5):`F`/`S`/`C`/`V`,toolbar defer 1a.7。
6. **空态文案 = 精确字符串**(G1-6):中文 `按 S 放置存量 · 按 C 放置源汇 · 按 F 连流量`(1a.4 硬编码),英文录用备 i18n。
7. **units = `deriveFlowUnits` 纯函数**(G1-7):`Flow.units` readonly 字段由该函数构造时填充,不持久化独立字段,单一真相源。
8. **端点有效性 guard**(G2-1/G2-2,AC-12b):`createFlow` 拒绝 fromId/toId 指向不存在元素或 Flow;throw 形式。
9. **删除悬空引用 = Option B**(G2-3,AC-12c):`flowToInstances` 检测端点存活,悬空跳过渲染 + `console.warn`,不级联删。
10. **平行 flow 视觉重叠 = 已知限制 defer**(G2-4,AC-14):port 错开后置后续 story,1a.4 聚焦连通性核心。
11. **rotation→方向映射表**(G3-4):见 Task 4.4 表,4 正交方向,测试直接对照。
12. **jsdom 吸附测试 = camera mock identity + data-attribute + createFlow spy**(G3-5):像素级视觉归 AC-17 Playwright。

### story-cycle §7 gate 红线(不可违)

- 禁 per-glyph shadowBlur at runtime(CAP-11 / AD-9);唯一合法站点 = `bakeGlowAtlasCanvas` off-screen bake。
- 规格基准 = epic(非 prototype)。
- memory 只记已验证状态(有验证命令证实),不记意图。
- 读任何图(PNG/截图/设计稿/视觉 gate)前先「⚠ 切多模态」停手等确认(AC-17 Playwright 截图若需 Claude 目视核验,须先切多模态)。
- 文档标点:prd 全角 / epics+spine 半角(Edit old_string 须精确匹配)。
- 定位变更须传播到全部措辞。

### 测试标准

- **TDD red-green-refactor**(story-cycle §2.3 DS 10 步):每 task 先写失败测试(red)→ 实现(green)→ 重构。**NEVER mark complete unless 全验证 pass**(DS §2.3 step10)。
- **纯数学/纯逻辑**(camera.ts 容差复用、`deriveFlowUnits`、`getElementPorts`/`findNearestPort`、正交 Manhattan 路径、formula tokenizer/parser、`formatFormulaForEditor`、E3/AC-12b 端点有效性/AC-12c 悬空降级/E11/重名 guards)→ vitest + jsdom 单测。
- **WebGL2 draw 路径**(flow 渲染、▶ 旋转、▼/○ 标记)→ jsdom 无 WebGL2,经 Playwright e2e 验证(AC-17,1a.3 基建);renderer constructor 在 jsdom 抛 "WebGL2 context unavailable"(1a.3 已证)。
- **CAP-11 守卫**:`cap11-shadowblur-guard.test.ts` 结构 grep + `CanvasView.test.tsx` runtime spy 双守卫须保持绿;1a.4 新代码不得新增 `.shadowBlur =` 站点。
- **F1-quality locked 常量**:`glowAtlas.test.ts:61-65` 锁定 `GLOW_PAD`/`LUMA_BLUR_PX`/`GLOW_PASSES`;1a.4 re-bake 加 `FLOW_GLYPHS` 后此守卫须仍绿(常量不变)。
- **本地验证命令**(NewSD,非 SDONE):
  - `cd C:/Two/NewSD && npx vitest run`(单元,1a.3 末 183 基线,1a.4 增 flow/formula/ports 测试后基线上调)
  - `cd C:/Two/NewSD && npx tsc --noEmit`(类型)
  - `cd C:/Two/NewSD && npx playwright test`(e2e,AC-17 flow-render.spec.ts 加入后)
  - 主机已装 Go1.26.4 / Rust1.96.1 / wasm-pack0.15.0 / GitHub CLI(见 memory);docker 未装;仓库无 CI(P#29 清空),质量靠本地 tsc+vitest+Playwright 自检。
- **禁直推 main**;改 main 走 PR(`gh pr create` → 本地 tsc+vitest+playwright 全绿 → `gh pr merge --squash --delete-branch`,main 仅 Require PR 无 required checks)。
- **禁 `git add -A`**;提交前核暂存区(`git diff --cached --stat`),发现 `.playwright-mcp/`/`package-lock.json`/`.claude/`/非白名单 PNG 立即 `git restore --staged <file>`(P#26 守卫教训,虽 husky 已 P#29 清空,手动核验仍须)。
- **禁 fixup-PR 链**:问题折进当前 story PR 合并前一次清掉,不开新 chore/fix PR(裁定,memory)。

### Project Structure Notes

```
src/lib/sd/
  types.ts            # Flow 增 units(Task 1.1);ToolMode 已存在
  types.test.ts       # Flow fixture 增 units 断言(Task 1.4)
  store.ts            # +createFlow +E3/E11/重名 guards +deriveFlowUnits(Task 1.2/1.3)
  store.test.ts       # +createFlow/guards 测试(Task 1.4/6.5)
  formula.ts          # +@<uuid> ref +[单位] annotation 产生式(Task 2.1/2.2)
  formula.test.ts     # +@uuid/[单位] 解析 + CJK 回归(Task 2.4)
  formulaEditor.ts    # [NEW] formatFormulaForEditor(@uuid→name)(Task 2.3)
  formulaEditor.test.ts # [NEW] 映射 + 重命名不变量(Task 2.4)
src/lib/render/
  camera.ts           # 不改(snapToGrid/shouldSnap 复用)
  elements.ts         # +flowToInstances +getElementPorts +findNearestPort +pushChar rotation(Task 3.2/4.1/4.2/5.1)
  elements.test.ts    # +flow/ports/rotation 测试(Task 3.3/4.4)
  CanvasView.tsx      # +flow 创建交互 +toolMode 桩 +空态 +buildInstances flow 分支(Task 4.3/5.2/7.1)
  CanvasView.test.tsx # +flow 创建/端口吸附/拖拽更新/空态/warn 测试(Task 5.4/6.5/7.2)
  cap11-shadowblur-guard.test.ts  # 不改,保持绿(1a.4 新代码无 .shadowBlur=)
  vram/
    glowAtlas.ts      # +FLOW_GLYPHS="▶▼○" 并入 CHARSET,re-bake(Task 3.1)
    glowAtlas.test.ts # +▶▼○ ∈ CHARSET 断言(Task 3.3);locked 常量不变
    renderer.ts       # 不改(1a.3 基座就绪)
    shaders.ts        # 不改(a_rotation 已 live)
e2e/
  flow-render.spec.ts # [NEW] flow 渲染视觉 gate(Task 8.1)
playwright.config.ts  # 不改(1a.3 落)
package.json         # 不改(@playwright/test 已 1a.3 落)
```

### References

- **epics.md** Story 1a.4 段:`_bmad-output/planning-artifacts/epics.md` L382-414(verbatim AC 权威源:主 AC L388-399;边界 guard E3/E10/E11 L401-407;AR#12 空态 L409-414)。
- **sprint-plan**:`_bmad-output/planning-artifacts/sprint-plan-2026-07-05.md` §1 三项裁定(裁定 #2 单 PR、裁定 #3 fold 首片已 1a.3 落)+ §3 findings 排期(1a.4 无直接 fold 项)。
- **story-cycle**:`_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1 CS 6 步、§2.2 VS gate(零歧义+零遗漏+可执行)、§2.3 DS 10 步、§2.4 CR parallel、§6 单 PR 判据、§7 gate 红线。
- **reverse-cr findings**:`_bmad-output/planning-artifacts/reverse-cr-1a1-1a2-findings.md`(A1/A2/A4/C3/D1 已 1a.3 fold;B1-B4/C1/C2/C4-C7/E 段属后续 story,1a.4 无直接 fold 项)。
- **architecture**:`_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md` §AD-9(L87,F1 VRAM render)、§AD-6(L69-74,F2-amend formula parser 复用 prototype 结构扩 @uuid/[单位] 产生式,AST 单一真相源,LU/sparse 交 faer)、§Naming 不变量(L190,formula ref id/name layering)、§AD-15(L123-127,非仿真预览路径)、§CAP-11(runtime shadowBlur 禁)、§F1-quality(L392/399,locked)。
- **implementation-readiness-report**:`_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-03.md`(FR-ELEM-3 流量连接器 → 1a.4;FR-ELEM-4 连接端口 → 1a.4;Verdict ✅ READY)。
- **sprint-status**:`_bmad-output/implementation-artifacts/sprint-status.yaml` L34(`1a-4-flow-connector-port-snap: backlog` → CS 后 `ready-for-dev`)。
- **源码落点**(已读,CS 阶段核实):`src/lib/sd/types.ts`(Flow 缺 units)、`src/lib/sd/formula.ts`(tokenizer 缺 @uuid/[单位])、`src/lib/sd/store.ts`(缺 createFlow+guards)、`src/lib/render/elements.ts`(pushChar rotation hardcoded、缺 flowToInstances/ports)、`src/lib/render/camera.ts`(snapToGrid/shouldSnap 复用)、`src/lib/render/vram/glowAtlas.ts`(CHARSET 缺 ▶▼○,locked 常量)、`src/lib/render/vram/renderer.ts`(RenderInstance 9 字段就绪)、`src/lib/render/vram/shaders.ts`(a_rotation/a_selected 已 live)、`src/lib/render/CanvasView.tsx`(buildInstancesFromStore flow TODO line 217、pointer 交互、seedSampleStocks、无 toolMode wiring)、`e2e/stock-render.spec.ts`+`e2e/cloud-render.spec.ts`(waitForRenderReady+readPixels 模式)、`src/routes/vram.tsx`(DEV harness RenderInstance builder 模式参考)。
- **1a.3 story**:`_bmad-output/implementation-artifacts/1a-3-grid-snap-stock-source-sink.md`(结构镜像模板;域模型对账/§6 评估/§7 gate/测试标准/Project Structure Notes/References 风格)。

---

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (DeepSeek v4 Pro backend); Playwright e2e executed via Playwright MCP plugin.

### Debug Log References

- Playwright screenshots: `.playwright-mcp/` (gitignored) — flow render visual gate verified via readPixels pixel-count assertions, no manual screenshot review needed.
- Console warnings verified: `flowToInstances` dangling endpoint warn, `createFlow` E11 parallel warn.

### Completion Notes List

**§6 单 PR 决策复核**: 裁定 #2 单 PR 维持。理由: 9 任务全绿(vitest 291 pass + Playwright 14 pass + tsc clean),无阻塞项,无跨团队依赖;变化量可控(~2100 insertions across 14 files),单 PR review 可消化。

**CS 钉死决策落地核验**:

- `units` = `deriveFlowUnits` 纯函数: 确认。`src/lib/sd/store.ts` `createFlow` 中 `units: deriveFlowUnits(target, formula)`,默认 `/dt`, `[单位]` 注解覆盖,cloud fallback `""`,全部测试通过。
- toolMode 仅键盘: 确认。`CanvasView.tsx` 中 `F`/`S`/`C`/`V` 键盘切换 `toolMode` Ref,toolbar defer 1a.7,HUD 显示当前 mode 标签。
- flow z-order = edges 在 nodes 下: 确认。`buildInstancesFromStore` 中 flow instances 先于 stock/cloud instances push。
- 正交 Manhattan 路由 horizontal-first: 确认。`flowToInstances` 先走 x 再走 y,路径段用 `─`/`│` 直线 + `┌┐└┘` 转角,箭头 `▶` rotation 映射末端段方向(4 方向全测试覆盖)。
- 时间单位 `/dt`: 确认。`deriveFlowUnits` 默认返 `"/dt"`,仅当 formula 含 `[...]` 注解时覆盖。
- cloud 4 端口坐标: 确认。`getElementPorts` cloud 分支: N:(x+3,y+0), S:(x+3,y+2), E:(x+5,y+1), W:(x+0,y+1),与 AC-9 精确匹配。

**AC 逐条验证**:

- AC-1 (flow 域模型): `Flow` interface 含 `kind:"flow"`/`fromId`/`toId`/`formula`/`isVariable`/`units`,`Units注解` 为 `deriveFlowUnits` 派生字段。
- AC-2 (时间单位 `/dt`): 默认 `/dt`,注解覆盖,cloud fallback `""`,formulaEditor.test.ts 测试覆盖。
- AC-3 (`@uuid` 引用 token): tokenizer 增 `REFERNCE` token 类型,`createFormulaParser` 含 `parseReference` 产生式。
- AC-4 (`formatFormulaForEditor`): 显示侧 `@uuid`→name 解析,Naming 不变量(formulaEditor.test.ts 测试覆盖)。
- AC-5 (ID 引用,name 不参与解析): ref token 存储 uuid,显示层 name lookup,重名允许+状态栏 warn。
- AC-6 (正交 Manhattan 路由): horizontal-first,纯 H/V 步进,单转角 L 形,禁对角(4 方向 rotation 映射表全部覆盖)。
- AC-7 (箭头+标记): ▶ 箭头置 toId 端 rotation=末端方向;▼/○ 标记置 fromPort+dir×1 随 isVariable 切换。
- AC-8 (flow 颜色): colorIdx=3(与 stock 0/cloud 2 区分),e2e readPixels 确认非背景像素。
- AC-9 (端口坐标): stock 4 边中点,cloud 4 边中点,flow 返 `[]`,`findNearestPort` ≤ tolWorld。
- AC-10 (端口吸附交互): toolMode flow → pointerDown `findNearestPort` → 拖拽预览 → pointerUp 吸附创建 → `createFlow`。
- AC-11 (拖拽后 flow 重算): `flowToInstances` 读 live element 位置,store subscribe → rebuild 链自动重算。
- AC-12 (E3 self-loop reject): `createFlow` 入口 throw `"Self-loop not allowed"`,store.test.ts 覆盖。
- AC-12b (端点有效性): `createFlow` 入口 throw `"Invalid flow endpoint"`,store.test.ts 覆盖。
- AC-12c (悬空降级): `flowToInstances` 悬空返 `[]` + `console.warn`,elements.test.ts 覆盖。
- AC-13 (E10 orphan cloud allow): `createCloud` 不要求 flow,`getElements()` 含 orphan cloud 不报错。
- AC-14 (E11 parallel flows allow+warn): `createFlow` 检测同 fromId/toId → allow + warn,store.test.ts 覆盖。
- AC-15 (重名 allow+warn): flow/stock 重名 allow + 状态栏 warn,store.test.ts + CanvasView.test.tsx 覆盖。
- AC-16 (AR#12 空态引导): 精确中文文案,空 store 显引导,非空不显,CanvasView.test.tsx 覆盖。
- AC-17 (Playwright 视觉 gate): e2e/flow-render.spec.ts 8 测试全 pass(readPixels 像素增长+variable marker+parallel flows+HUD mode)。

**CAP-11 守卫**: shadowBlur 动态计算禁(glowAtlas 常量锁定 GLOW_PAD=16/LUMA_BLUR_PX=[0,4,8,14]/GLOW_PASSES=3),本 story 未改。

**F1-quality 常量不变核验**: GLOW_PAD=16, LUMA_BLUR_PX=[0,4,8,14], GLOW_PASSES=3, CHARSET 从 117 扩至 120(增 ▶▼○),CHAR_COUNT=120。所有 locked 常量原值不变。

**测试统计**: vitest 291 pass (相比 1a.3 183 pass 增 108 test), Playwright e2e 14 pass (stock-render 4 + cloud-render 2 + flow-render 8), tsc --noEmit clean。

### File List

**NEW:**

- `e2e/flow-render.spec.ts` — Playwright e2e: flow render visual gate (8 tests, AC-17)
- `src/lib/sd/formulaEditor.test.ts` — formatFormulaForEditor idempotency + naming invariant tests

**MODIFIED:**

- `src/lib/sd/types.ts` — `Flow` interface (kind/fromId/toId/formula/isVariable/units)
- `src/lib/sd/formula.ts` — tokenizer: REFERNCE token + `[...]` annotation skip + `formatFormulaForEditor`
- `src/lib/sd/store.ts` — `createFlow` + `deriveFlowUnits` + guards (E3/E11/端点有效性)
- `src/lib/render/elements.ts` — `flowToInstances` + `getElementPorts` + `findNearestPort` + `pushChar` rotation param + `getElementBounds` flow bbox
- `src/lib/render/CanvasView.tsx` — flow creation UI (toolMode F/S/C/V keyboard + port snap + rubber-band preview + HUD + empty-state AR#12 + warn display + z-order + e2e hook)
- `src/lib/render/vram/glowAtlas.ts` — CHARSET 扩至 120 (增 FLOW_GLYPHS="▶▼○")
- `src/lib/sd/store.test.ts` — createFlow contract + E3/E11/重名/deriveFlowUnits tests
- `src/lib/render/elements.test.ts` — flowToInstances + rotation + ports + bbox + dangling tests
- `src/lib/render/CanvasView.test.tsx` — flow creation + HUD + empty-state + warn tests
- `src/lib/render/vram/glowAtlas.test.ts` — CHAR_COUNT 120 audit
- `src/lib/sd/formula.test.ts` — REFERNCE token + annotation skip tests
- `src/lib/sd/types.test.ts` — Flow type guard tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 1a-4 status updates (backlog → ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/1a-4-flow-connector-port-snap.md` — story file (this file)

---

## CS 阶段产出说明

本文件由 [CS] bmad-create-story 生成(sprint-status.yaml L34: `backlog` → `ready-for-dev`)。下一步 [VS] `*validate-create-story`——选项 A:用 code-review skill on 本 story 文件;选项 B:手动检查清单(story-cycle §2.2 gate:零歧义 + 零遗漏 + 可执行)。VS pass 后 → [DS] bmad-dev-story(TDD red-green-refactor,story-cycle §2.3 10 步,DS step1 更新 `baseline_commit` 为实际 dev 起点 commit、step4 复核 §6 单 PR 决策)。

CS 6 步执行轨迹:① 目标 story = 1a-4(epics.md L382,1a.3 后首片 backlog)✅;② 加载分析 artifacts(epics AC + AD-9/AD-6/AD-15/Naming 不变量 + IR + 1a.3 story 模板 + reverse-cr 无 1a.4 直接 fold)✅;③ 架构分析(READ 待修改文件防回归:types/formula/store/elements/camera/renderer/glowAtlas/shaders/CanvasView + e2e specs + 单测)✅;④ web research(Bresenham/端口吸附——教科级算法,搜索无新增可引源,Dev Notes 依领域知识撰写)✅;⑤ 生成 story 文件(本文件,镜像 1a.3 结构,AC-1..17 覆盖 epic + AR#12/E3/E10/E11 fold)✅;⑥ 更新 sprint-status.yaml(`1a-4` → `ready-for-dev`,`last_updated` → 2026-07-06)✅。

**VS 修订轨迹(2026-07-06)**:首轮 VS FAIL(G1 歧义 7 + G2 遗漏 4 + G3 不可执行 5,§7 红线 PASS)→ 回 CS 修订 12 点(见 Dev Notes「VS 修订钉死决策」);增 AC-12b(端点有效性)/AC-12c(删除悬空引用降级),AC 计数 17 → 19;所有 "DS 定" 未决项已钉死或显式 defer 并陈述理由。修订后重新提交 VS review gate。**Round-2(2026-07-06)**:12 findings 全闭合 + §7 红线 PASS + epic L382-414 全覆盖 + G3 无新项;新增 1 G1 歧义(G1-NEW-1:Manhattan 路由轴序 horizontal-first vs vertical-first 未指定)→ 回 CS 修订 1 行(AC-6 钉 horizontal-first,传播 AC-7 dir 推导 / Task 4.1 正文 / Dev Notes 决策 #1);reviewer 裁定此 finding 闭合即 PASS,无需 round-3 re-review。
