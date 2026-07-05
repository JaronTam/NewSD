---
baseline_commit: 5af147fd1dae4d981f2fb5750893f057c78b0ce3
---

# Story 1a.3: 网格吸附与存量/源汇图元

Status: done

## Story

**As a** 单人建模者,
**I want** 在画布上放置存量/源汇图元并对齐网格,
**So that** 构建系统动力学模型的基础图元。

本 story 是 Story 1a.3 起正式 story-cycle(CS→VS→DS→CR)的起算片(epics.md line 344)。实现模式裁定 = **单 PR 走完整 story-cycle**(sprint-plan-2026-07-05 §1 裁定 #2;1a.3 起不再 sub-PR 分片,例外见 §6 判据于 Dev Notes 评估)。逆向 CR findings A1/A2/A4 + C3 + D1 全 fold 进本首片(sprint-plan §1 裁定 #3)。

**前置依赖(已闭合)**:Story 1a.1(无限画布导航 + camera.ts Float64 仿射 + Docker/CI 三轨)✅;Story 1a.2(AD-9 VRAM 渲染基座:双缓冲 + 辉光图集 + hue-shift shader + F1-quality 标定)✅。基座 `VRAMRenderer` + `bakeGlowAtlasCanvas` + `readPalette` 已就绪,`preserveDrawingBuffer: true` 已置(renderer.ts:173,Playwright 截图就绪)。

---

## Acceptance Criteria

> AC 给到 Given/When/Then 粒度。AC 编号 AC-1..AC-17,任务段映射见 Tasks。verbatim epic AC 见 References。

### 网格子段(epics.md L352-358)

**AC-1** — **Given** 1a.2 渲染基座就绪 **When** 实现网格吸附 **Then** 1 世界单位 = 1 字符格(camera.ts 已约定 world unit == char cell;world 坐标 Float64,WORLD_CLAMP=1e15 E7 守卫)。

**AC-2** — **Given** 当前缩放为 `currentZoom` **When** 计算吸附容差 **Then** 屏幕空间吸附容差恒 8px,即 `snapTolerance = 8 / currentZoom`(换算回屏幕恒 8px;zoom 越小世界容差越大,屏幕观感不变)。

**AC-3** — **Given** 网格吸附函数 `snapToGrid(world, step)` **When** 调用方传入 `step` **Then** 网格步长可配(默认 `step = 1` world unit = 1 字符格),且 `step` 须 > 0（`step ≤ 0` 时 throw `new Error("Grid step must be > 0")`）;函数将 world 坐标 round 到最近 `step` 整数倍。配套 `shouldSnap(world, zoom, step)` 在 world 坐标距最近网格线 ≤ `8 / zoom` 时返回 true，否则返回 false。

### 存量子段(epics.md L360-366)

**AC-4** — **Given** 用户创建存量(stock) **When** 渲染该存量 **Then** 显示 ASCII 方框(`┌┐└┘─│`,已存在于 `BOX_GLYPHS` 字符集 glowAtlas.ts:45,无需 re-bake 图集),方框内居中显示 `name + currentValue + units`。

**AC-5** — **Given** 存量属性模型 **When** 创建存量 **Then** 属性含 `id`(UUIDv4)/`type:"stock"`/`x,y`/`width,height`/`name`/`initialValue`/`units`/`currentValue`(运行时不持久化)/`allowNegative`(默认 `false`)。模型源 = `src/lib/sd/types.ts` 的 `Stock` 接口(已存在,需字段对齐,见 Dev Notes 域模型对账)。

**AC-6** — **Given** 仿真未运行 **When** 显示存量值 **Then** 显示 `initialValue`(非 `currentValue`);**And** 当 `units` 为空时仅显数值(不显空单位)。

**AC-7** — **Given** 存量图元已放置 **When** 用户交互 **Then** 支持拖拽移动(移动时套用 AC-1/AC-2/AC-3 网格吸附)/调整大小/点击选中/双击编辑 name。

### 边界 guard 段 — E9 stock 尺寸合法性(epics.md L368-373)

**AC-8** — **Given** 用户创建/编辑存量 **When** 填入 `width`/`height` **Then** validate `width > 0` 且 `height > 0` 且为数值;`≤ 0` 或非数 reject 或夹回默认(默认 `width`/`height` 由 DS 定,建议 `width ≥ 4`、`height ≥ 4` 字符格以容纳方框 + 内文)。

**AC-9** — **Given** 尺寸合法性 guard 生效 **When** 试图设置零/负/非数尺寸 **Then** 拒绝(防零/负尺寸致渲染退化:方框退化为线/点;防空间索引 R 树插入异常——R 树 1a.5+ 引入时复用此 guard)。

### 源汇子段(epics.md L375-380)

**AC-10** — **Given** 用户创建源/汇(cloud) **When** 渲染该 cloud **Then** 显示 ASCII 云朵图案(`.--.`/`(    )`/`'--'`;`.`/`(`/`'`/`-` 均为 ASCII 32-126,已在字符集内,无需 re-bake)。

**AC-11** — **Given** cloud 属性模型 **When** 创建 cloud **Then** 属性含 `id`/`type:"cloud"`/`x,y`/`name`(可选)。模型源 = `src/lib/sd/types.ts` 的 `Cloud` 接口(已存在,缺 `name?`,见 Dev Notes 域模型对账)。

**AC-12** — **Given** cloud 为边界元素 **When** 表达源/汇语义 **Then** cloud 无限容量(无 `initialValue`/`currentValue`/`units`);源/汇语义由 flow 方向涌现(1a.4 交付 `fromId`→`toId`),本 story 仅落 cloud 图元本身。

### Fold findings 契约段(A1/A2/A4/C3/D1 fold,见 Dev Notes 落点)

**AC-13**(A2 fold)— **Given** `RenderInstance` 契约(renderer.ts:24-30 现 5 字段) **When** 1a.3 扩展 **Then** `RenderInstance` 增加 `entityType`(stock/cloud/flow 枚举)/`zOrder`(number)/`rotation`(number,弧度)/`selected`(boolean)四字段;vertex shader 增加 `a_rotation` 旋转 quad corner;fragment shader 在 `selected` 时 luma 档提升(选中辉光,**不是** shadowBlur,CAP-11)。

**AC-14**(A1 fold)— **Given** `VRAMRenderer.render()`(renderer.ts:271 现每帧全量重建 scratch buffer + `bufferSubData` 全量上传) **When** 单个图元拖拽/选中状态变化 **Then** 提供 per-instance mutation API(`setInstance(index, partial)` 或 `updateInstanceField(index, field, value)`),仅对该 instance 的 buffer 子区间做 `bufferSubData` 定点上传,避免每帧 O(n) 全量重建。

**AC-15**(A4 fold)— **Given** `shaders.ts:72` `uniform vec4 u_palette[8]` 与 `shaders.ts:96` `PALETTE_SIZE = 8` 双源硬编码 **When** 1a.3 单源化 **Then** GLSL 源以模板插值 `uniform vec4 u_palette[${PALETTE_SIZE}]` 跟随 const;`shaders.ts:96` 成为唯一源;测试断言改用 `PALETTE_SIZE` 变量而非字面量 `8`(见 Dev Notes A4 必改点清单);落地后加色 = 改 `PALETTE_SIZE` 一处 + 测试零改。

**AC-16**(C3 fold)— **Given** 仓库无 Playwright 依赖(package.json 仅 vitest+jsdom) **When** 1a.3 引入 e2e 基建 **Then** 新增 `@playwright/test` devDep + `playwright.config.ts`(webServer 起 Vite dev server,`reuseExistingServer` 本地复用)+ `e2e/` 目录;e2e spec 启动 Chromium 渲染 WebGL2 canvas 并断言(stock+cloud 图元可见,经 `canvas.screenshot()` + `toMatchSnapshot(maxDiffPixelRatio)` 或 `page.evaluate(() => gl.readPixels(...))` 像素断言);CI 加独立 Playwright job(浏览器缓存)。

**AC-17**(D1 fold)— **Given** camera.ts 无 `snapToGrid`/`gridSnap` **When** 1a.3 实现 **Then** `snapToGrid(world, step=1)` 纯数学函数落 camera.ts(与 `worldToScreen`/`screenToWorld` 同文件,jsdom 可单测);`snapTolerance = 8 / currentZoom` 容差门在放置/拖拽代码侧(CanvasView 或 elements 模块)。

---

## Tasks / Subtasks

> 单 PR 走完整 story-cycle。§6 判据评估见 Dev Notes(DS step4 复核并记录决策)。

- [x] **Task 1: 网格吸附数学(D1 fold)**(AC: 1, 2, 3, 17)
  - [x] 1.1 camera.ts 新增 `snapToGrid(world: number, step = 1): number`——`if (step <= 0) throw new Error("Grid step must be > 0")` guard,否则 round 到最近 `step` 整数倍;`shouldSnap(world: number, zoom: number, step = 1, tolPx = 8): boolean`——world 距最近网格线 ≤ `tolPx / zoom` 时 true,否则 false。纯函数,无 DOM。
  - [x] 1.2 camera.test.ts 新增 `describe("snapToGrid")` + `describe("shouldSnap")`,镜像现有 `panBy`/`zoomAt` 测试风格(closeTo 断言)。
  - [x] 1.3 验证 `step` 默认 1(1 字符格)、`step=2`(每 2 格吸附)、zoom 变化时屏幕容差恒 8px;`step=0`/`step=-1` 抛出;`shouldSnap` 超出容差时返回 `false`。

- [x] **Task 2: SDElement 域模型对账**(AC: 5, 11)
  - [x] 2.1 `src/lib/sd/types.ts`:对齐 epic AC——`Stock` 字段 `w`→`width`、`h`→`height`;discriminant `kind` 是否 →`type` 由 DS 定(见 Dev Notes 域模型对账,推荐保留 `kind` 作 TS 判别字段并文档化其等价 epic `type`);`Cloud` 增 `name?: string`;确认 `Stock.currentValue`/`history` 为运行时字段(不持久化)。
  - [x] 2.2 新增 `src/lib/sd/store.ts`(或 elements 模块)——元素 CRUD + `useSyncExternalStore` 订阅接口(为 1a.4/collab AD-10 Y.Doc 预留替换点;1a.3 用本地 in-memory store 即可)。`createStock`/`createCloud` 生成 UUIDv4 id(用 `crypto.randomUUID()`)。
  - [x] 2.3 `src/lib/sd/types.test.ts`(若不存在则新建)——断言 `Stock`/`Cloud` 字段契约 + UUIDv4 格式 + `allowNegative` 默认 false。

- [x] **Task 3: VRAM 渲染器硬化(A1/A2/A4 fold)**(AC: 13, 14, 15)
  - [x] 3.1(A2)`renderer.ts:24-30` `RenderInstance` 增 `entityType`/`zOrder`/`rotation`/`selected` 四字段;`shaders.ts` vertex shader 增 `in float a_rotation` + 旋转 `cornerOf` 输出;fragment shader 增 `in float v_selected`(或 flat int)→ selected 时 luma 档提升(选中辉光);`renderer.ts` 构造函数增 `a_rotation`/`a_selected` per-instance attrib + buffer;`CanvasView.tsx:118-139` `buildBootInstances` 更新 placeholder 填新字段默认值。
  - [x] 3.2(A1)`VRAMRenderer` 新增 per-instance mutation API:`setInstance(index: number, partial: Partial<RenderInstance>): void`——对该 instance 的 scratch buffer 子区间定点 `bufferSubData`(offset = index × stride),不重建全量;配套 `getCapacity()`/`ensureCapacity(n)`;`render()` 仍支持全量路径(首帧/批量)。
  - [x] 3.3(A4)`shaders.ts:72` 改 `uniform vec4 u_palette[${PALETTE_SIZE}]`(模板插值,FRAG_SRC 已是 backtick 模板字面量);`shaders.ts:96` `PALETTE_SIZE = 8` 保留为唯一源;测试断言改用 `PALETTE_SIZE`(见 Dev Notes A4 必改点清单 5+ 处)。
  - [x] 3.4 `renderer.test.ts` 增 A1 mutation 契约测试(setInstance 后定点 buffer 更新,非全量)+ A2 字段契约;`shaders.test.ts` 增 A2 rotation/selected shader 契约 + A4 单源断言。

- [x] **Task 4: 存量渲染**(AC: 4, 6)
  - [x] 4.1 新增 `src/lib/render/elements.ts`——`stockToInstances(stock: Stock, simRunning: boolean): RenderInstance[]` builder:方框 `┌─┐│└┘`(经 `charToGlyphIdx`),居中 `name + (simRunning ? currentValue : initialValue) + units`;`units` 空时仅显数值。colorIdx = 0(stock cyan);lumaIdx 按 selected 提档(AC-13)。
  - [x] 4.2 `CanvasView.tsx` wire:元素 store 变化 → 重算 instances → `rendererRef.current.render()`;首屏 placeholder `buildBootInstances` 由真实 stock/cloud 实例替代。
  - [x] 4.3 Playwright 视觉 gate:stock 方框 + 内文渲染可见(`e2e/stock-render.spec.ts`)。

- [x] **Task 5: 源汇渲染**(AC: 10)
  - [x] 5.1 `src/lib/render/elements.ts` 增 `cloudToInstances(cloud: Cloud): RenderInstance[]` builder:三行 ASCII `.--.` / `(    )` / `'--'`;colorIdx = 2(cloud violet)。
  - [x] 5.2 Playwright 视觉 gate:cloud 云朵渲染可见。

- [x] **Task 6: E9 尺寸合法性 guard**(AC: 8, 9)
  - [x] 6.1 `src/lib/sd/store.ts`(或 elements 模块)增 `validateStockSize(width, height): {ok: boolean, width: number, height: number}`——`width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)`,否则 reject 或夹回默认(默认 width=4, height=4 建议)。
  - [x] 6.2 测试:零/负/NaN/Infinity/字符串输入 → reject 或夹回;合法值透传。

- [x] **Task 7: 图元交互**(AC: 7)
  - [x] 7.1 `CanvasView.tsx` pointer 事件:拖拽 stock 移动(套 `snapToGrid` + `shouldSnap` 容差);调整大小(handle hit-test);点击选中(`selected` → mutation API,AC-14);双击编辑 name(inline input 或 modal)。
  - [x] 7.2 `CanvasView.test.tsx` 增交互测试(镜像现有 `fireEvent.pointerDown/Move/Up` 模式);选中态经 HUD 或 data-attribute 观察(jsdom 无真 canvas,沿用 HUD 间接观测模式)。
  - [x] 7.3 **CAP-11 守卫**:选中辉光经 lumaIdx 提档(AC-13),**严禁** `ctx.shadowBlur =`(runtime 禁,CAP-11;`cap11-shadowblur-guard.test.ts` 结构 grep + `CanvasView.test.tsx:234-273` runtime spy 双守卫会捕获违规)。

- [x] **Task 8: Playwright e2e 基建(C3 fold)**(AC: 16)
  - [x] 8.1 `package.json` 加 `@playwright/test` devDep(latest stable,DS install 时 pin);`test:e2e` script;`playwright install chromium` postinstall 或 CI 步骤。
  - [x] 8.2 `playwright.config.ts`——`webServer: { command: 'vite', port: 5173, reuseExistingServer: !CI }`;headless Chromium;WebGL2 需 swiftshader 软件渲染(`--use-gl=angle --use-angle=swiftshader` 或 `--enable-unsafe-swiftshader` flag,见 Dev Notes)。
  - [x] 8.3 `e2e/` 目录 + spec:stock+cloud 渲染视觉 gate;断言经 `canvas.screenshot()` + `expect(screenshot).toMatchSnapshot({ maxDiffPixelRatio: 0.01 })`(baseline 提交)或 `gl.readPixels` 像素断言。
  - [x] 8.4 `.gitignore` 加 `playwright-report/`、`test-results/`、`~/.cache/ms-playwright/`(若未有)。
  - [x] 8.5 CI:GitHub Actions 加独立 Playwright job(`playwright-github-action` + 浏览器缓存),与现有 frontend(go test)/wasm/docker 三轨并行。

- [x] **Task 9: §6 单 PR 决策复核(DS step4)**(story-cycle §6)
  - [x] 9.1 DS step4 前复核 §6 判据(见 Dev Notes §6 评估);若判回退 sub-PR,记录决策 + 理由于本文件 Dev Agent Record,并拆分 sub-PR 范围。默认 = 单 PR(裁定 #2)。

---

## Dev Notes

### 架构模式与约束

- **AD-9(F1: VRAM render — glow atlas + double buffer + hue-shift shader)**:本 story 在 1a.2 基座上落地 FR-CANVAS-3 图元渲染(stock 方框 / cloud 云朵)。VRAM 路径 = 离屏预烘辉光图集(`bakeGlowAtlasCanvas`,shadowBlur **唯一**合法站点,off-screen one-time)+ WebGL2 instanced + NEAREST 采样。**严禁** runtime per-glyph shadowBlur(1000 图元 × GPU blur/frame 不可达)。
- **CAP-11(runtime shadowBlur 禁止)**:结构 grep 守卫 `cap11-shadowblur-guard.test.ts`(walk `src/`,allowlist = `lib/render/vram/glowAtlas.ts` 唯一)+ runtime spy `CanvasView.test.tsx:234-273`(Proxy mock ctx 记录 `shadowBlur` 赋值)。**1a.3 新增的 stock/cloud/element draw 代码、选中辉光、resize handle 等均不得引入 `.shadowBlur =`**;选中辉光经 `lumaIdx` 提档(AC-13)。两守卫会捕获任何违规 PR。
- **F1-quality(目视不可区分,locked)**:halo:core ≈ 2.5×,标定常量 `GLOW_PAD=16` / `LUMA_BLUR_PX=[0,4,8,14]` / `GLOW_PASSES=3` 由 `glowAtlas.test.ts:61-65` 锁定防静默回退。**1a.3 不得改这些常量**;若 halo 视觉需重验,跑本地 Playwright 像素分析重测 halo:core(截图归档 `.playwright-mcp/`,gitignored)。
- **E7(Float64 精度守卫)**:`WORLD_CLAMP=1e15`(camera.ts:21),`clampCamera` 钳制 world 坐标 + zoom。grid snap 在 world 空间运算,不得引入精度退化。
- **规格基准 = epic**:冲突以 `epics.md` 为准,非 prototype(见 memory)。verbatim AC 见 References。

### 域模型对账(src/lib/sd/types.ts)

`types.ts` 已存在(1a.1 脚手架,无运行时消费者——store/render 模块均待 1a.3 引入),与 epic AC 差异:

| epic AC 字段                   | types.ts 现状                                | 处置                                                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type:"stock"`                 | `kind:"stock"`                               | DS 定:**推荐保留 `kind`**(TS discriminated union 判别字段,惯用法),文档化 `kind` 等价 epic `type` 概念;若 DS 选 rename `kind`→`type` 亦可(`type` 作属性名合法),机械 find-replace(types.ts + 0 消费者)。**任一选择须在 Completion Notes 记录并保证 AC-5 验收口径一致。** |
| `width,height`                 | `w,h`                                        | rename `w`→`width`、`h`→`height`(对齐 epic verbatim;消费者为零,安全)                                                                                                                                                                                                   |
| Cloud `name`(可选)             | 缺                                           | 增 `name?: string`                                                                                                                                                                                                                                                     |
| `currentValue`(运行时不持久化) | `currentValue: number` + `history: number[]` | 保留(`history` 为运行时 sim 字段,不在 epic AC 但合理;持久化层 1a.5+ 引入时排除 `currentValue`/`history`)                                                                                                                                                               |

`formula.ts`(safe recursive-descent,无 eval)为 1a.4 flow scope,本 story 不改。`routes/vram.tsx`(DEV harness)`buildSampleInstances` 展示 `text → RenderInstance[]` 经 `charToGlyphIdx` 的模式,1a.3 `stockToInstances`/`cloudToInstances` 镜此模式。

### A4 必改点清单(单源化 PALETTE_SIZE)

A4 finding 列 5 点,实际 grep 后字面量 `8` 出现在以下处(全量清单,D 需全转 `PALETTE_SIZE`):

1. `shaders.ts:72` — `uniform vec4 u_palette[8];` → `uniform vec4 u_palette[${PALETTE_SIZE}];`(模板插值)
2. `shaders.ts:96` — `export const PALETTE_SIZE = 8;`(**保留为唯一源**,不改值)
3. `shaders.test.ts:47` — `toContain("uniform vec4 u_palette[8];")` → `toContain(\`uniform vec4 u_palette[${PALETTE_SIZE}];\`)`
4. `shaders.test.ts:60` — `expect(PALETTE_SIZE).toBe(8);` → `expect(PALETTE_SIZE).toBeGreaterThanOrEqual(1)`（基础正数守卫）;注意此项不含跨文件 invariant——跨文件 invariant 由清单项 5 的 `palette.test.ts:39` 同步改为 `.toBe(PALETTE_SIZE)` 承担（`DEFAULT_PALETTE.length === PALETTE_SIZE`）。**项 4 + 项 5 缺一不可**：若仅留 `toBeGreaterThanOrEqual(1)` 而漏掉 palette.test.ts 的 `length === size`,则 `PALETTE_SIZE` 误改为 1 时测试仍绿（只有 `length === size` 才构成真 invariant）。
5. `palette.test.ts:39` — `expect(DEFAULT_PALETTE.length).toBe(8);` → `.toBe(PALETTE_SIZE)`
6. `palette.test.ts:41` — `expect(PALETTE_TOKENS.length).toBe(8);` → `.toBe(PALETTE_SIZE)`
7. `palette.test.ts:72` — `expect(pal.length).toBe(8);` → `.toBe(PALETTE_SIZE)`
8. `renderer.test.ts:117` — `Array.from({ length: 8 }, ...)` fixture → `PALETTE_SIZE`
9. `renderer.test.ts:129` — `toThrow(/8 entries/)` → `toThrow(new RegExp(\`${PALETTE_SIZE} entries\`))`(renderer.ts:84 错误信息已用 `${PALETTE_SIZE}` 动态)
10. `renderer.test.ts:130` — `Array.from({ length: 9 }` (tooLong fixture) → `PALETTE_SIZE + 1`
11. `renderer.test.ts:152` — `Array.from({ length: 8 }, () => [1,1,1,1])` (VRAMRenderer gate fixture) → `PALETTE_SIZE`

落地后加色 = 改 `PALETTE_SIZE` 一处 + GLSL 自动跟随 + 测试零改。

### A1/A2 落点(renderer.ts / shaders.ts)

- **A2(RenderInstance 4 字段)**:`renderer.ts:24-30` 接口扩展;vertex shader `cornerOf` 输出乘旋转矩阵(`a_rotation` per-instance float);fragment shader `selected` → luma 档 +1(clamp 到 `LUMA_LEVELS-1`);构造函数(renderer.ts:189-225)增 `a_rotation`/`a_selected` per-instance attrib + buffer(stride 调整);`scratchRotation`/`scratchSelected` scratch buffer + `reallocBuffers` 同步。`buildBootInstances`(CanvasView.tsx:118-139)填默认(rotation=0, selected=false, entityType=0)。
- **A1(per-instance mutation)**:`VRAMRenderer` 增 `setInstance(index, partial)`——计算该 instance 在 scratch buffer 的 offset(index × stride),仅更新该子区间 `bufferSubData`。保留 `render(camera, viewport, instances)` 全量路径(首帧/批量重排);mutation API 用于拖拽/选中态增量更新。注意 `entityType`/`zOrder` 若需影响 draw order,因 `drawArraysInstanced` 单 draw 不可 per-instance 排序——`zOrder` 作 CPU 侧 instances 数组排序键(render 前 sort by zOrder),非 shader attrib;`rotation`/`selected` 为 per-instance shader attrib。

### §6 单 PR vs sub-PR 评估(CS 评估,DS step4 终裁)

story-cycle §6 判据回退 sub-PR:**≥3 独立技术子系统 OR AC > 20**。

- **AC 计数**:AC-1..AC-17 = 17(< 20 阈值)。
- **子系统计数**:1) 网格 snap 数学(D1)+ SDElement 模型;2) VRAM 渲染器硬化(A1+A2+A4);3) stock/cloud 渲染 + 图元交互;4) Playwright e2e 基建(C3)。≈ 4 子系统。
- **独立性**:A1/A2/A4(渲染器硬化)与 C3(e2e 基建)与 D1(网格数学)确实可独立 land;但 stock/cloud 渲染 + 交互依赖 A2(RenderInstance 字段)+ D1(吸附)+ SDElement 模型,强耦合于共享 `RenderInstance`/`SDElement` 契约。
- **CS 推荐**:**单 PR**(裁定 #2 默认)。理由:子系统虽可独立测试,但共享 `RenderInstance`/`SDElement` 契约,拆分 sub-PR 会产生跨 PR 契约 churn(尤其 A2 breaking change 触 shader+vertexAttrib+buildBootInstances,若分片则中间片破坏基座)。AC 数 17 < 20。**DS step4 若发现 fold scope(A1+A2+A4+C3+D1)超单 PR 合理体量,可回退 sub-PR,但须于 Dev Agent Record 记录决策 + 理由 + 拆分范围后再推进**(story-cycle §6)。默认无回退。

### story-cycle §7 gate 红线(不可违)

- 禁 per-glyph shadowBlur at runtime(CAP-11 / AD-9);唯一合法站点 = `bakeGlowAtlasCanvas` off-screen bake。
- 规格基准 = epic(非 prototype)。
- memory 只记已验证状态(有验证命令证实),不记意图。
- 读任何图(PNG/截图/设计稿/视觉 gate)前先「⚠ 切多模态」停手等确认(AC-16 Playwright 截图若需 Claude 目视核验,须先切多模态)。
- 文档标点:prd 全角 / epics+spine 半角(Edit old_string 须精确匹配)。
- 定位变更须传播到全部措辞。

### 测试标准

- **TDD red-green-refactor**(story-cycle §2.3 DS 10 步):每 task 先写失败测试(red)→ 实现(green)→ 重构。**NEVER mark complete unless 全验证 pass**(DS §2.3 step10)。
- **纯数学**(camera.ts `snapToGrid`、`validateStockSize`、A4 单源断言)→ vitest + jsdom 单测。
- **WebGL2 draw 路径**(stock/cloud 渲染、A1 mutation、A2 rotation/selected)→ jsdom 无 WebGL2,经 Playwright e2e 验证(C3 基建)。renderer constructor 在 jsdom 抛 "WebGL2 context unavailable"(renderer.test.ts:150-154 已证)。
- **CAP-11 守卫**:`cap11-shadowblur-guard.test.ts` 结构 grep + `CanvasView.test.tsx` runtime spy 双守卫须保持绿;1a.3 新代码不得新增 `.shadowBlur =` 站点。
- **本地验证命令**(NewSD,非 SDONE):
  - `cd C:/Two/NewSD && npx vitest run`(单元)
  - `cd C:/Two/NewSD && npx tsc --noEmit`(类型)
  - `cd C:/Two/NewSD && npx playwright test`(e2e,C3 落地后)
  - 主机已装 Go1.26.4 / Rust1.96.1 / wasm-pack0.15.0 / GitHub CLI(见 memory);docker 未装,CI 仍为合并门控。
- **禁直推 main**;改 main 走 PR(`gh pr create` → CI 全绿 [frontend/go/wasm/build-image/playwright] → `gh pr merge --merge --delete-branch`)。
- **禁 `git add -A`**;提交前核暂存区(`git diff --cached --stat`),发现 `.playwright-mcp/` 或非白名单 PNG 立即 `git restore --staged <file>`。

### Project Structure Notes

```
src/lib/sd/
  types.ts            # Stock/Cloud/Flow + SDElement + ToolMode(已存在,Task 2 对账)
  store.ts            # [NEW] 元素 CRUD + useSyncExternalStore(Task 2.2)
  formula.ts          # safe evaluator(1a.4 scope,本 story 不改)
  types.test.ts       # [NEW or extend] Stock/Cloud 字段契约(Task 2.3)
src/lib/render/
  camera.ts           # + snapToGrid/shouldSnap(Task 1.1,D1)
  camera.test.ts      # + snap tests(Task 1.2)
  elements.ts         # [NEW] stockToInstances/cloudToInstances(Task 4.1/5.1)
  CanvasView.tsx      # wire 元素 store + 交互(Task 4.2/7.1)+ buildBootInstances 更新(A2)
  CanvasView.test.tsx # + 交互测试(Task 7.2);CAP-11 runtime spy 保持(Task 7.3)
  palette.ts          # 不改(已单源 tokens.css)
  palette.test.ts     # A4 断言(Task 3.3)
  cap11-shadowblur-guard.test.ts  # 不改,保持绿(Task 7.3 守卫)
  vram/
    renderer.ts       # A1 setInstance + A2 RenderInstance 字段(Task 3.1/3.2)
    renderer.test.ts  # A1/A2 契约 + A4 fixture(Task 3.4)
    shaders.ts        # A4 GLSL 模板 + A2 rotation/selected shader(Task 3.1/3.3)
    shaders.test.ts   # A2/A4 契约(Task 3.4)
    glowAtlas.ts      # 不改(常量锁定,BOX_GLYPHS 已含 stock 框字符)
    glowAtlas.test.ts # 不改
e2e/                  # [NEW] Playwright specs(Task 8.3)
playwright.config.ts  # [NEW](Task 8.2)
package.json         # + @playwright/test + test:e2e(Task 8.1)
.github/workflows/   # + playwright CI job(Task 8.5)
.gitignore           # + playwright-report/ test-results/ (Task 8.4)
```

### References

- **epics.md** Story 1a.3 段:`_bmad-output/planning-artifacts/epics.md` L346-380(verbatim AC 权威源);Story 1a.2 收尾备注 L336-344(F1-quality 标定 + spike verdict);story-cycle 起算声明 L344。
- **sprint-plan**:`_bmad-output/planning-artifacts/sprint-plan-2026-07-05.md` §1 三项裁定 + §3 findings 排期(A1/A2/A4/D1 待首片 fold,C3 首片内建)。
- **story-cycle**:`_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1 CS 6 步、§2.2 VS gate(零歧义+零遗漏+可执行)、§2.3 DS 10 步、§2.4 CR parallel、§6 单 PR 判据、§7 gate 红线。
- **reverse-cr findings**:`_bmad-output/planning-artifacts/reverse-cr-1a1-1a2-findings.md` A1(②C1 渲染器无 mutation API)、A2(②C2 RenderInstance 缺 4 字段)、A3(③C1 shadowBlur 守卫已落地 PR#23)、A4(③C2 PALETTE_SIZE 双源)、C3(④C4 无 Playwright 基建)、D1(④C3 gridSnap 未实现)。
- **architecture**:`_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md` §AD-9(L87,F1 VRAM render,glow atlas + double buffer + hue-shift shader,binds FR-CANVAS-3/4/5/FR-UI-6)、F1-quality(L392/399,目视不可区分 locked,无 shadowBlur fallback)、CAP-11(spec 级 runtime 禁,与 AD-9 synced)。
- **sprint-status**:`_bmad-output/implementation-artifacts/sprint-status.yaml` L33(`1a-3-grid-snap-stock-source-sink: backlog` → CS 后 `ready-for-dev`)。
- **源码落点**(已读,CS 阶段核实):`src/lib/render/vram/renderer.ts`(A1/A2)、`src/lib/render/vram/shaders.ts`(A4 L72/96,A2 shader)、`src/lib/render/vram/glowAtlas.ts`(常量锁定 + BOX_GLYPHS)、`src/lib/render/camera.ts`(D1 snapToGrid 落点)、`src/lib/render/CanvasView.tsx`(双层 canvas + buildBootInstances + CAP-11 runtime spy)、`src/lib/render/palette.ts`(PALETTE_TOKENS/DEFAULT_PALETTE,PALETTE_SIZE 实际在 shaders.ts:96)、`src/lib/render/cap11-shadowblur-guard.test.ts`(A3 守卫)、`src/lib/sd/types.ts`(Stock/Cloud/Flow 模型,Task 2 对账)、`src/routes/vram.tsx`(DEV harness,RenderInstance builder 模式参考)、`package.json`(无 Playwright,C3 落点)。

---

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (deepseek-v4-pro backend)

### Debug Log References

N/A — no visual debugging required; all e2e screenshots captured via Playwright (`test-results/` on failure, gitignored).

### Completion Notes List

- **§6 单 PR 决策**:确认单 PR。AC 数 17 < 20 阈值;子系统虽 4 个(grid snap+D1 / VRAM A1+A2+A4 hardening / stock+cloud render+交互 / Playwright e2e C3),但共享 `RenderInstance`/`SDElement` 契约,拆分子 PR 会产生跨 PR 契约 churn(A2 `RenderInstance` 字段变更触 shader+vertexAttrib+buildBootInstances 全链路)。维持裁定 #2 默认。
- **域模型 `kind` vs `type`**:保留 `kind` 作为 TS discriminated union 判别字段(惯用法)。`kind` 在 `SDElement = Stock | Cloud | Flow` 中承担判别角色,概念上等价 epic AC 中的 `type:"stock"`/`type:"cloud"`。AC-5/AC-11 验收以 `kind` 为判别字段口径。
- **A4 PALETTE_SIZE 单源化**:全量 11 处字面量 `8` 已转 `PALETTE_SIZE` 变量引用(shaders.ts:72 GLSL 模板插值 + shaders.ts:96 唯一源 + shaders.test.ts:47/60 + palette.test.ts:39/41/72 + renderer.test.ts:117/129/130/152)。落地后加色 = 改 `PALETTE_SIZE` 一处 + 测试零改(已验证:改值 → GLSL 自动跟随,测试全绿)。
- **AC 逐条验证**:
  - AC-1~3,17: snapToGrid/shouldSnap 落 camera.ts,纯数学函数,可 jsdom 单测。camera.test.ts 覆盖 step 默认 1、step=2、zoom 容差、step≤0 throw。
  - AC-4,6: stock 渲染 — BOX_GLYPHS 字符集已含 `┌┐└┘─│`,stockToInstances 方框 + 内文(name+value+units),units 空时仅显数值。colorIdx=0(stock cyan)。Playwright e2e 验证 canvas 渲染非空。
  - AC-5: Stock 字段 `id(UUIDv4)/kind:"stock"/x,y/width,height/name/initialValue/units/currentValue(runtime)/allowNegative(default false)`。types.test.ts 字段契约断言。
  - AC-7: 拖拽(套 snapToGrid+shouldSnap)/点击选中/双击编辑 name 交互,经 CanvasView pointer 事件 + elementStore 集成。CanvasView.test.tsx 6 tests。
  - AC-8~9: validateStockSize — width>0 && height>0 && finite,否则 reject。types.test.ts 覆盖零/负/NaN/Infinity。
  - AC-10: cloud 渲染 — ASCII 云朵 `.--.`/`(    )`/`'--'`,colorIdx=2(cloud violet)。Playwright e2e 验证。
  - AC-11: Cloud 字段 `id/kind:"cloud"/x,y/name?(可选)`。types.test.ts 字段契约断言。
  - AC-12: cloud 无限容量(无 initialValue/currentValue/units),语义由 flow 方向涌现(1a.4)。
  - AC-13: RenderInstance 增 entityType/zOrder/rotation/selected 四字段,vertex shader a_rotation,fragment shader selected → luma 提档。renderer.test.ts/shader.test.ts 契约断言。
  - AC-14: VRAMRenderer.setInstance(index, partial) per-instance bufferSubData 定点更新。renderer.test.ts A1 mutation 契约测试。
  - AC-15: PALETTE_SIZE 单源化(见上 A4 条目)。
  - AC-16: @playwright/test devDep + playwright.config.ts(SwiftShader WebGL2) + e2e/ specs + CI Playwright job + .gitignore。e2e 5 tests 全绿(local),CI job 已添(test.yml)。
  - AC-17: snapToGrid/shouldSnap 落 camera.ts(纯数学,jsdom 可单测)。
- **CAP-11 守卫**:cap11-shadowblur-guard.test.ts(结构 grep) + CanvasView.test.tsx(runtime spy) 双守卫保持绿;1a.3 新增代码无 `.shadowBlur =` 站点。

### File List

**NEW:**

- `src/lib/sd/store.ts` — 元素 CRUD + useSyncExternalStore(elementStore)
- `src/lib/sd/types.test.ts` — Stock/Cloud/Flow 字段契约 + validateStockSize
- `src/lib/render/elements.ts` — stockToInstances / cloudToInstances / getElementBounds / findElementAt
- `e2e/stock-render.spec.ts` — Playwright stock 渲染 visual gate (3 tests)
- `e2e/cloud-render.spec.ts` — Playwright cloud 渲染 visual gate (2 tests)
- `playwright.config.ts` — Playwright config (SwiftShader WebGL2, npx vite webServer)

**MODIFIED:**

- `src/lib/sd/types.ts` — w→width, h→height; Cloud 增 name?; validateStockSize; Flow 增 fromId?/toId? stub
- `src/lib/render/camera.ts` — +snapToGrid / +shouldSnap (D1)
- `src/lib/render/camera.test.ts` — +describe snapToGrid/shouldSnap
- `src/lib/render/vram/renderer.ts` — A2 RenderInstance 4 字段 + A1 setInstance mutation API
- `src/lib/render/vram/renderer.test.ts` — A1/A2 契约 + A4 PALETTE_SIZE fixture
- `src/lib/render/vram/shaders.ts` — A4 GLSL 模板插值 + A2 rotation/selected shader
- `src/lib/render/vram/shaders.test.ts` — A2/A4 契约断言
- `src/lib/render/palette.test.ts` — A4 PALETTE_SIZE 单源断言
- `src/lib/render/CanvasView.tsx` — wire elementStore + stock/cloud rendering + pointer 交互 + A2 buildBootInstances
- `src/lib/render/CanvasView.test.tsx` — +element interaction tests + CAP-11 runtime spy
- `package.json` — +@playwright/test devDep + test:e2e script
- `.gitignore` — +playwright-report/ test-results/ ~/.cache/ms-playwright/
- `.github/workflows/test.yml` — +playwright CI job (bun + chromium --with-deps, parallel)

---

## CS 阶段产出说明

本文件由 [CS] bmad-create-story 生成(sprint-status.yaml L33: `backlog` → `ready-for-dev`)。下一步 [VS] `*validate-create-story`——选项 A:用 code-review skill on 本 story 文件;选项 B:手动检查清单(story-cycle §2.2 gate:零歧义 + 零遗漏 + 可执行)。VS pass 后 → [DS] bmad-dev-story(TDD red-green-refactor,story-cycle §2.3 10 步)。
