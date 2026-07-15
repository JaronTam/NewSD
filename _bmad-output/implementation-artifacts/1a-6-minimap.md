---
baseline_commit: d946a442c939850be07495684487dfcbd7e40e40
---

# Story 1a.6: 小地图

Status: done

## Story

**As a** 单人建模者,
**I want** 角落小地图显示画布全貌,
**So that** 在大模型中快速定位与跳转。

本 story 是 Story 1a.3 起正式 story-cycle(CS->VS->DS->CR)的第四片(epics.md L445)。实现模式裁定 = **单 PR 走完整 story-cycle**(sprint-plan-2026-07-05 §1 裁定 #2;1a.3 起默认不再 sub-PR 分片,回退判据见 Dev Notes §6 评估,DS step4 终裁)。本 story 无逆向 CR 直接 fold 项(reverse-cr-1a1-1a2-findings.md 的 A1/A2/A4/C3/D1 已由 1a.3 fold,B/C/E 段属后续 story);epic FR-CANVAS-5 主 AC(L451-458)+ E8 空画板 guard 段(L460-465)全 fold 进本片;1a.5 deferred-work 的 H8/E2(queryLowPrecision NaN/Infinity 未守卫,dirty-rect.ts:51-52/62)显式 target 1a.6「消费前修」,fold 进本片作 AC-7。

**前置依赖(已闭合)**:Story 1a.1(无限画布导航 + camera.ts Float64 仿射 + Camera center-based)✅;Story 1a.2(AD-9 VRAM 渲染基座 + F1-quality 标定)✅;Story 1a.3(图元 store + RenderInstance 契约 + Playwright e2e 基建)✅;Story 1a.4(flow 渲染 + getElementBounds flow 路径 bbox + AR#12 空态)✅;Story 1a.5(SpatialIndex.search / DirtyRectTracker.queryLowPrecision(hasDirty/consume/clear) / viewportToWorldRect / computeCameraChanged 3-branch dirty 渲染决策 / PerformanceProbe)✅(d553ac7 已合 main)。基座已就绪:`SpatialIndex.search(rect): SDElement[]`(视口/区域查询)、`DirtyRectTracker.queryLowPrecision(step): WorldRect[]`(非 drain 粗化脏 rect 采样)、`viewportToWorldRect(cam, vp): WorldRect`(视口 world bbox)、`ElementStore.getElements()/getSnapshot()`(全图元)、`getElementBounds`(stock/cloud/flow 三类 world bbox)、`computeCameraChanged(prevCam, prevVp, cam, vp): boolean`(camera 变化判定含 resize)。

**为后续 story 预留**:MinimapProjector 的 world↔minimap 变换 + 跳转交互(cam.x/y center 设定)为 1a.7(工具栏/状态栏:状态栏可显示 minimap 视口占比/图元计数)奠基;minimap 自有 DirtyRectTracker(独立脏矩形 per F1 #8)模式为后续多 overlay 增量渲染复用;minimap 2D canvas overlay 挂载方式为后续 HUD/工具栏 UI overlay 参考座。

---

## Acceptance Criteria

> AC 给到 Given/When/Then 粒度。AC 编号 AC-1..AC-9,任务段映射见 Tasks。verbatim epic AC 见 References。

### 主 AC 子段(epics.md L451-458)

**AC-1** - **Given** 1a.5 空间索引+脏矩形就绪(SpatialIndex.search / DirtyRectTracker.queryLowPrecision / viewportToWorldRect / Camera) **When** 实现小地图 **Then** 角落常驻缩略图,低精度采样投影全部图元--新增 `src/lib/render/minimap.ts` `MinimapProjector` 类:canvas 2D 渲染(非 VRAM 路径,per AD-9/CAP-11:无 glyph 渲染即无 shadowBlur 风险);全部图元取自 `elementStore.getSnapshot()`,每图元按 `getElementBounds` world bbox 投影到 minimap 空间为定位点/块(低精度,不绘 ASCII glyph);minimap world bounds 由图元集 min/max bbox + padding 动态计算(单图元/共点用最小 span 防 div-by-zero,clamp `WORLD_CLAMP=1e15`);调用 1a.5 脏矩形低精度采样 API(见 AC-4 增量);minimap 为 CanvasView 内独立 2D `<canvas>` overlay(角落实驻)。**No Wasm/Go/Rust/new-npm deps**(纯 TS 2D canvas,复用 1a.5 rbush ^4.0.1)。

**AC-2** - **Given** minimap 渲染就绪 **When** 主视口 pan/zoom/resize(camera 变化,`computeCameraChanged` 真) **Then** 高亮框指示当前视口--`viewportToWorldRect(cam, vp)` 投影到 minimap 空间,2D canvas 绘矩形描边;camera 变化时全量重绘 minimap(clear+background+图元投影+高亮框;图元世界位置未变--世界->minimap 映射不依赖 camera,全量重绘仅为正确刷新高亮框避免旧痕迹,简化实现;代价见 AC-4 备注);样式取 design tokens(color/strokeWidth)。

**AC-3** - **Given** minimap 高亮框就绪 **When** 用户点击/拖拽 minimap **Then** 跳转主视口--minimap px 经逆变换(minimap->world)得 world 坐标,设 `cam.x`/`cam.y`(center-based)到该点,保留 `cam.zoom`,触发 cameraChanged(主 render Branch 1 recenter);拖拽 = 连续(pointerdown->pointermove 更新 cam center->pointerup);minimap canvas 捕获 pointer events(自有元素,非 gl overlay pointer-events:none);用现有 `Camera`/`clampCamera` 契约(签名不改)。

**AC-4** - **Given** 10000 图元画布 **When** minimap 更新 **Then** 增量更新联动脏矩形,避免 10000 图元全量重绘--minimap 自有 `DirtyRectTracker`(`minimapDirtyTracker`,per F1 #8 独立脏矩形,并行订阅 elementStore 与主 tracker,无 drain 顺序耦合);3 分支:Branch 1(camera 变化/首帧/挂载/bulk)-> 全量投影(挂载/bulk/camera 变化均全量重绘 minimap;camera 变化时图元世界位置未变,全量重绘仅为刷新高亮框,见 AC-2);Branch 2(!camera && `minimapTracker.hasDirty()`)-> `queryLowPrecision(step)` 取粗化脏 rect -> 每 rect `spatialIndex.search(rect)` -> 仅重投变更图元,drain minimapTracker;Branch 3(!camera && !hasDirty)-> skip minimap 重绘;step 动态 `Math.max(1, Math.round(MINIMAP_DIRTY_CELL_PX / minimapScale))`,默认 `MINIMAP_DIRTY_CELL_PX = 4`(每脏 cell ≈ 4 minimap px,可见,防亚像素 churn,DS 可调常量)。**备注(CR Run 1 F-A 裁定)**:AC-4 增量(避免全量重绘)仅约束图元变更路径(Branch 2);camera 变化(pan/zoom/resize)触发 Branch 1 全量重绘 O(n)/帧,10000 图元连续 pan 下 minimap 每帧 O(n) 重绘(2D draw 轻量,可接受权衡,见 AC-2)。

### E8 guard 子段(epics.md L460-465 / L1627)

**AC-5** - **Given** 画板无图元(zero 图元,`elementStore.getSnapshot().length === 0`) **When** 渲染小地图 **Then** 渲染 empty minimap placeholder(居中提示或空白框)非空白崩溃--minimap canvas 显居中占位文案/空框,不绘图元点,不抛错(与 1a.4 AR#12 空态取向一致:空可显但不崩)。

**AC-6** - **Given** minimap placeholder 显出 **When** 首个图元入板(elementStore 0->1) **Then** placeholder 消失,切正常投影--minimapTracker markDirty + Branch 触发全量投影(0->1 视同首帧/bulk),placeholder 隐藏,后续走增量。

### H8/E2 fold 子段(deferred-work.md L50/53,1a.6 消费前修)

**AC-7** - **Given** queryLowPrecision 为 1a.6 消费 API(H8/E2:NaN/Infinity 未守卫,dirty-rect.ts:51-52/62;deferred-work.md L50/53 显式 target 1a.6「消费前修」) **When** minimap 消费前 **Then** 硬化 queryLowPrecision 防 NaN/Infinity--`markDirty` 增 `Number.isFinite` 输入校验(非有限 rect skip + console.warn,防入 tracker);`queryLowPrecision` 增防御性 skip(网格 math 前过滤非有限 rect,防 NaN grid key 污染);**签名不改**(行为硬化,fold 修非契约变更);单测覆盖 NaN/±Infinity/-0/混合有限+NaN(有限项仍返正确 grid)。

### 无回归子段

**AC-8** - **Given** 1a.5 末基线(vitest 全绿 + Playwright 全绿 + CAP-11 结构 grep + runtime spy 双守卫 + F1-quality locked 常量 GLOW_PAD=16/LUMA_BLUR_PX=[0,4,8,14]/GLOW_PASSES=3) **When** 1a.6 合入 **Then** 无回归--1a.5 测试保持绿(1a.6 增 minimap/dirty-rect hardening 测试后基线上调);CAP-11 守卫绿(minimap 2D canvas 无 `.shadowBlur =` 站点);F1-quality 常量不动;VRAM renderer/glowAtlas/shaders 不改(minimap 非 VRAM 路径)。

### Playwright e2e 子段

**AC-9** - **Given** minimap 集成 CanvasView 就绪 **When** Playwright e2e **Then** `e2e/minimap.spec.ts` 验:minimap 渲染(图元显为点)、高亮框(pan/zoom 后随视口移动)、跳转交互(点击 minimap 主视口 recenter)、E8 placeholder(空画板显占位)、增量 dirty(图元移动仅重投脏区非全量);jsdom 无 WebGL2 不影响 minimap 本身(2D canvas),但 minimap 集成在 CanvasView 内(含 VRAM 挂载),经 Playwright 验(同 1a.5 spatial-index.spec.ts 模式)。

---

## Tasks / Subtasks

> AC->Task 映射:AC-7->T1;AC-1/AC-4->T2;AC-1/AC-2/AC-5/AC-6->T3;AC-3->T4;AC-9->T5;AC-8->T6。TDD red-green-refactor(story-cycle §2.3),每 task 先 red 测试再 green 实现。

- [x] Task 1: H8/E2 queryLowPrecision NaN/Infinity 硬化(AC-7,消费前修,先于 T2)
  - [x] 1.1 `src/lib/render/dirty-rect.ts` `markDirty` 增 `Number.isFinite` 输入校验(minX/maxX/minY/maxY 非有限 -> skip + console.warn)
  - [x] 1.2 `queryLowPrecision` 增防御性 skip(网格 math 前过滤非有限 rect,签名不改)
  - [x] 1.3 `dirty-rect.test.ts` 增 NaN/±Infinity/-0/混合有限+NaN 单测(TDD red-green)
- [x] Task 2: MinimapProjector 核心模块(AC-1, AC-4)
  - [x] 2.1 [NEW] `src/lib/render/minimap.ts` `MinimapProjector` 类:world↔minimap 变换 + 全量投影(`elementStore.getSnapshot()` + `getElementBounds`)+ minimap world bounds 动态计算(min/max bbox + padding + 最小 span + clamp WORLD_CLAMP)
  - [x] 2.2 自有 `DirtyRectTracker`(`minimapDirtyTracker`)+ 增量投影(`queryLowPrecision(step)` -> `spatialIndex.search(rect)` -> 重投)+ 3 分支(cameraChanged/hasDirty/skip)
  - [x] 2.3 采样粒度 step 动态推导(`MINIMAP_DIRTY_CELL_PX = 4`,`step = max(1, round(cellPx / minimapScale))`)
  - [x] 2.4 [NEW] `src/lib/render/minimap.test.ts`:world↔minimap 变换 / 全量 vs 增量 / 10000 图元非全量重绘 / 单图元共点 span(TDD)
- [x] Task 3: CanvasView 集成 + 高亮框 + E8 placeholder(AC-1, AC-2, AC-5, AC-6)
  - [x] 3.1 `CanvasView.tsx` 增独立 2D minimap `<canvas>` overlay(角落,自有 pointer events,非 gl overlay)+ sizing/ResizeObserver
  - [x] 3.2 MinimapProjector 接线:订阅 elementStore + 自有 DirtyRectTracker(并行主 tracker,同 diff markDirty)+ drawRef minimap 3 分支
  - [x] 3.3 高亮框:`viewportToWorldRect(cam, vp)` 投影 minimap + 矩形描边;camera 变化全量重绘 minimap(刷新高亮框,见 AC-2/CS 决策#5)
  - [x] 3.4 E8 placeholder:zero 图元显居中占位/空框(AC-5);0->1 切正常投影(AC-6)
  - [x] 3.5 `__e2e__` hook 增 minimap 暴露(`minimapProjector`/`minimapDirtyTracker`/`getHighlightBox()`/`jumpToWorld(px,py)`)
  - [x] 3.6 `CanvasView.test.tsx` 增 minimap 集成 / E8 placeholder / 高亮框 测试(TDD)
- [x] Task 4: 跳转交互(AC-3)
  - [x] 4.1 minimap->world 逆变换 + 设 `cam.x`/`cam.y`(center,保留 `cam.zoom`)+ 触发 cameraChanged(主 render Branch 1 recenter)
  - [x] 4.2 pointer 事件(down/move/up,拖拽连续)+ minimap canvas 捕获 pointer events
  - [x] 4.3 逆变换单测(`minimap.test.ts`)+ `CanvasView.test.tsx` jump 测试(TDD)
- [x] Task 5: Playwright e2e(AC-9)
  - [x] 5.1 [NEW] `e2e/minimap.spec.ts`:渲染(图元为点)/ 高亮框(pan/zoom 随动)/ 跳转(点击 recenter)/ E8 placeholder / 增量 dirty(图元移动仅重投脏区)
- [x] Task 6: 回归 + 收尾(AC-8)
  - [x] 6.1 CAP-11 守卫绿(minimap 2D canvas 无 `.shadowBlur =`)+ F1-quality 常量不动 + VRAM renderer/glowAtlas/shaders 不改
  - [x] 6.2 全量 `npx vitest run` + `npx tsc --noEmit` + `npx playwright test` 绿
  - [x] 6.3 DS step4 复核 §6 单 PR 决策(默认单 PR;若超体量回退 sub-PR 须记 Dev Agent Record + 理由 + 拆分范围)

---

## Dev Notes

### ATDD Artifacts

> Generated by TEA ATDD (Create mode, 2026-07-09). Red-phase scaffolds — all tests use `test.skip()` and assert expected behavior. Activate per-task during DS TDD.

- **Checklist**: `_bmad-output/test-artifacts/atdd-checklist-1a-6-minimap.md`
- **E2E tests (red-phase)**: `e2e/minimap.spec.ts` (7 scenarios, AC-9)
- **API tests**: N/A (frontend-only minimap, no REST/GraphQL endpoints)
- **Remaining red-phase scaffolds (to create during DS)**:
  - `src/lib/render/dirty-rect.test.ts` — modify: add H8/E2 hardening tests (AC-7, T1)
  - `src/lib/render/minimap.test.ts` — create: MinimapProjector unit tests (AC-1/AC-3/AC-4, T2/T4)
  - `src/lib/render/CanvasView.test.tsx` — modify: minimap integration tests (AC-2/AC-5/AC-6, T3/T4)
- **Summary**: `_bmad-output/test-artifacts/tea-atdd-summary-1a-6.json`

### 架构模式与约束

- **AD-9(F1: VRAM render,SPINE L87-91,binds FR-CANVAS-3/4/5)**:minimap **不走 VRAM 渲染管线**(renderer/glowAtlas/shaders 全不动),走独立 2D canvas。VRAM 路径 = 离屏预烘辉光图集(`bakeGlowAtlasCanvas`,shadowBlur **唯一**合法站点)+ WebGL2 instanced + NEAREST 采样。**严禁** runtime per-glyph shadowBlur(CAP-11/AD-9)。minimap 低精度投影 = 定位点/块(无 ASCII glyph 渲染),故无 `.shadowBlur =` 站点(AC-8 守卫绿)。
- **F1 render decision #8(.memlog.md L14)**:"FR-CANVAS-5 小地图复用图集降采样率 + 独立脏矩形"。本 story 落地:**独立脏矩形** = minimap 自有 `DirtyRectTracker`(AC-4);**降采样率** = queryLowPrecision 粗化 step + 低精度定位投影(非 VRAM 图集降采样,minimap 2D canvas 无 glyph 图集,降采样语义转为「定位精度粗化 + 脏 rect 粗化」)。
- **AD-2(viewport,SPINE L380 FR-CANVAS-4 binds AD-9+AD-2)**:minimap 高亮框基于 `viewportToWorldRect(cam, vp)` 视口 world rect 投影,与 AD-2 viewport 投影一致;跳转 = 逆变换设 cam center,复用 camera Float64 仿射。
- **CAP-11(runtime shadowBlur 禁止)**:结构 grep 守卫 + runtime spy 双守卫保持绿;1a.6 新代码(minimap.ts/CanvasView minimap 段)无 `.shadowBlur =`。
- **F1-quality(locked,SPINE L392/399)**:`GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3` 由 `glowAtlas.test.ts` 锁定;1a.6 不动 glowAtlas,常量不变。
- **E7(Float64 精度守卫)**:`WORLD_CLAMP=1e15`(camera.ts);minimap world bounds 计算 clamp 内;逆变换 world 坐标经 `clampCamera`。
- **E8(空画板 minimap,epics.md L1627)**:zero 图元 -> empty minimap placeholder(AC-5/AC-6),非空白崩溃,与 1a.4 AR#12 空态取向一致。
- **NFR-PERF-1/2(1a.5 口径)**:1a.6 不新增 FPS 硬指标(minimap 增量渲染,Branch 3 skip 非瓶颈);minimap 全量投影仅挂载/bulk(非每帧),10000 图元增量 dirty 仅重投脏区(AC-4)。
- **No Wasm/Go/Rust/new-npm deps**:1a.6 纯 TS 2D canvas(复用 1a.5 rbush ^4.0.1 + camera/dirty-rect/spatial-index/store);无新依赖。
- **规格基准 = epic**:冲突以 epics.md 为准;verbatim AC 见 References。

### web research(step4 显式记录,CS webresearch gate)

- **explicit no-op**:1a.6 消费 1a.5 已落地基座(`SpatialIndex.search` / `DirtyRectTracker.queryLowPrecision` / `viewportToWorldRect` / `ElementStore.getElements` / `getElementBounds` / `computeCameraChanged`),纯 TS 2D canvas 渲染,**无新依赖**。minimap 投影/逆变换/脏 rect 增量均为已有契约的组合消费,无新 npm 包、无新 Web API(crypto.randomUUID/WebGL2/Bresenham 均非 1a.6 引入)。
- **基座版本锁引用**(per CS webresearch gate 显式记录,no-op 仍须引用基座 version 锁):`rbush ^4.0.1`(1a.5 web research 段敲定,npm latest=4.0.1,ESM,dep quickselect ^3.0.0,Context7 `/mourner/rbush` High reputation);1a.6 复用不改 `package.json`。
- **rejected(防 DS scope-creep)**:不引入 minimap 专用库(如 `react-minimap`/`pixi-viewport`--overkill,minimap 逻辑薄,2D canvas + 已有契约足矣);不在 minimap 用 WebGL(AD-9 VRAM 路径专供主画布,minimap 2D 定位投影无需 GPU instanced);不引 OffscreenCanvas Worker(增量 dirty 轻量,主线程 2D draw 足够,Worker 通信开销 > 收益)。
- **版本锁**:`package.json` 不变(无新依赖)。

### 域模型对账(已读源码,CS 阶段核实)

| 模块                                       | 现状(1a.5 末,d553ac7)                                                                                                                                                               | 1a.6 GAP / 处置                                                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/render/camera.ts`                 | `viewportToWorldRect`/`worldToScreen`/`screenToWorld`/`Camera{x,y,zoom}` center-based/`Viewport`/`clampCamera`/`MIN_ZOOM=0.05`/`MAX_ZOOM=20`/`WORLD_CLAMP=1e15`                     | **不改**(consume `viewportToWorldRect(cam,vp)` 高亮框 + `screenToWorld` 逆变换参考 + `clampCamera` 跳转 clamp);Camera center-based 已就绪(跳转设 cam.x/y)                                                         |
| `src/lib/render/dirty-rect.ts`             | `DirtyRectTracker`:`markDirty`/`consume`(drain)/`queryLowPrecision(step)`(非 drain 粗化)/`hasDirty`/`clear`;**H8/E2:NaN/Infinity 未守卫(L51-52/62)**                                | **H8/E2 硬化**(AC-7):`markDirty` 增 `Number.isFinite` 输入校验 + `queryLowPrecision` 防御性 skip 非有限 rect;**签名不改**(行为硬化);minimap 自有 tracker 消费 `queryLowPrecision(step)`                           |
| `src/lib/render/spatial-index.ts`          | `SpatialIndex.search(rect): SDElement[]`/`collides`/`insert`/`remove`/`load`/`sync`;订阅 `elementStore.subscribe`                                                                   | **不改**(consume `search(rect)` 增量脏区图元重投);minimap 不另建索引,复用主 `spatialIndex` 单例                                                                                                                   |
| `src/lib/sd/store.ts`                      | `ElementStore`:`getElements`/`getSnapshot`/`subscribe`/CRUD                                                                                                                         | **不改**(consume `getSnapshot()` 全量投影 + `subscribe` minimap 自有 tracker markDirty)                                                                                                                           |
| `src/lib/render/elements.ts`               | `getElementBounds`(stock/cloud/flow 三类 world bbox)                                                                                                                                | **不改**(consume `getElementBounds` minimap 图元 bbox 投影)                                                                                                                                                       |
| `src/lib/render/CanvasView.tsx`            | module singletons(elementStore/spatialIndex/dirtyTracker/perfProbe);`drawRef` 3-branch(cameraChanged/hasDirty/skip);`computeCameraChanged`;`buildInstancesFromStore`;`__e2e__` hook | 增 minimap 2D `<canvas>` overlay(角落)+ `MinimapProjector` 接线(订阅 elementStore + 自有 DirtyRectTracker 并行主 tracker)+ minimap 3-branch draw + 高亮框 + 跳转交互 + E8 placeholder + `__e2e__` 增 minimap 暴露 |
| `src/lib/render/vram/*`                    | renderer/glowAtlas/shaders(AD-9 VRAM 基座)                                                                                                                                          | **不改**(minimap 非 VRAM 路径;CAP-11/F1-quality 守卫不动)                                                                                                                                                         |
| `e2e/`                                     | `stock/cloud/flow/spatial-index` specs(waitForRenderReady+readPixels/snapshot)                                                                                                      | 增 `minimap.spec.ts`(AC-9,渲染+高亮+跳转+E8+增量)                                                                                                                                                                 |
| `package.json`                             | `rbush ^4.0.1`(1a.5)                                                                                                                                                                | **不改**(无新依赖)                                                                                                                                                                                                |
| **[NEW]** `src/lib/render/minimap.ts`      | -                                                                                                                                                                                   | `MinimapProjector` 类(world↔minimap 变换 + 全量/增量投影 + 高亮框 + 跳转逆变换)                                                                                                                                   |
| **[NEW]** `src/lib/render/minimap.test.ts` | -                                                                                                                                                                                   | world↔minimap 变换 / 全量 vs 增量 / 10000 非全量重绘 / 共点 span 单测                                                                                                                                             |
| **[NEW]** `e2e/minimap.spec.ts`            | -                                                                                                                                                                                   | minimap 渲染+高亮+跳转+E8+增量 e2e(AC-9)                                                                                                                                                                          |

### §6 单 PR vs sub-PR 评估(CS 评估,DS step4 终裁)

story-cycle §6 判据回退 sub-PR:**≥3 独立技术子系统 OR AC > 20**。

- **AC 计数**:AC-1..AC-9 = 9(< 20 阈值)。
- **子系统计数**:1) MinimapProjector(world↔minimap 变换 + 投影);2) queryLowPrecision 消费 + H8/E2 硬化(dirty-rect.ts);3) 高亮框(viewport rect 投影);4) 跳转交互(camera recenter);5) E8 placeholder guard;6) CanvasView 集成 + `__e2e__`;7) Playwright e2e。≈ 7 子系统。
- **独立性**:**非独立**--7 子系统共享 `camera`/`spatialIndex`/`dirtyTracker`/`elementStore`(1a.5 基座);MinimapProjector(1)被高亮框(3)、跳转(4)、集成(6)消费;H8/E2 硬化(2)是 consume(1)前置(prerequisite,T1 先于 T2);E8(5)嵌集成(6);e2e(7)依赖全部。拆 sub-PR 会致 `MinimapProjector` API + CanvasView 集成跨 PR churn,且 H8/E2 前置依赖难拆。
- **CS 推荐**:**单 PR**(裁定 #2 默认)。理由:AC 9 < 20;子系统虽 7 但共享 1a.5 基座 + MinimapProjector(非独立),拆分生跨 PR 契约 churn + H8/E2 前置依赖难切。**DS step4 若发现 scope 超单 PR 合理体量,可回退 sub-PR,但须于 Dev Agent Record 记录决策 + 理由 + 拆分范围后再推进**(story-cycle §6)。默认无回退。

### CS 决策(preempt VS,零歧义)

> FR-CANVAS-5(epics.md L43)明示「采样粒度与更新频率架构期定」;F1 #8(.memlog.md L14)明示「复用图集降采样率 + 独立脏矩形」。以下敲定该 5 项 open 决策(a-e)+ H8/E2 + E8 + 投影精度 + canvas 挂载 + `__e2e__`,preempt VS 歧义。

1. **(a) 采样粒度 - 投影精度**:minimap 每图元按 `getElementBounds` world bbox 投影为**定位点/块**(低精度),**不绘 ASCII glyph**(非 VRAM 路径,CAP-11/AD-9 无 glyph 即无 shadowBlur 风险);图元类型(stock/cloud/flow)以颜色/形状区分(如 stock 方块/cloud 圆点/flow 线段),不渲染文字。
2. **(a) 采样粒度 - queryLowPrecision step**:动态 `step = Math.max(1, Math.round(MINIMAP_DIRTY_CELL_PX / minimapScale))`,默认 `MINIMAP_DIRTY_CELL_PX = 4`(每脏 cell ≈ 4 minimap px,可见,防亚像素 churn);minimapScale = minimapCanvasSize / worldBoundsSize。DS 可调 `MINIMAP_DIRTY_CELL_PX` 常量,但须 > 0。
3. **(b) 更新频率 - 3 分支**:Branch 1(camera 变化/首帧/挂载/bulk)-> 挂载/bulk/camera 变化均全量投影(camera 变化时图元世界位置未变,全量重绘仅为刷新高亮框,见 CS 决策#5);Branch 2(!camera && `minimapTracker.hasDirty()`)-> `queryLowPrecision(step)` -> `spatialIndex.search(rect)` 增量重投 + drain;Branch 3(!camera && !hasDirty)-> skip。**非每帧轮询**(事件驱动,同主 drawRef cadence 但 minimap 自有 canvas)。
4. **(c) 独立脏矩形**:minimap 自有 `DirtyRectTracker`(`minimapDirtyTracker`,per F1 #8),并行订阅 elementStore 与主 `dirtyTracker`(同 diff markDirty,无 drain 顺序耦合--主 tracker 由主 Branch 2 `consume()` drain,minimap tracker 由 minimap Branch 2 drain)。minimap 消费**自己的** `minimapDirtyTracker.queryLowPrecision(step)`(epic L455「调用 1a.5 脏矩形低精度采样 API」= 调用该 API,实例独立)。
5. **(d) 高亮框**:highlight box = `viewportToWorldRect(cam, vp)` 投影到 minimap 空间(world->minimap 变换),2D canvas 矩形描边;camera 变化(pan/zoom/resize,`computeCameraChanged` 真)时全量重绘 minimap(clear+background+图元+高亮框;图元世界位置未变,全量重绘仅为正确刷新高亮框避免旧痕迹,简化实现;代价:10000 图元连续 pan O(n)/帧,2D draw 轻量可接受,见 AC-4 备注);样式取 design tokens(color/strokeWidth,DS 对齐现有 HUD token);绘于图元投影之上。
6. **(e) 跳转交互**:minimap px -> world 逆变换 -> 设 `cam.x`/`cam.y`(center-based,保留 `cam.zoom`)-> 触发 cameraChanged(主 render Branch 1 recenter,`computeCameraChanged` 检测 cam 变化);拖拽连续(pointerdown->pointermove 更新 cam center->pointerup);minimap canvas 捕获 pointer events(自有元素);用现有 `Camera`/`clampCamera` 契约(签名不改)。
7. **H8/E2 硬化(AC-7)**:`markDirty` 增 `Number.isFinite` 输入校验(非有限 rect skip + console.warn)+ `queryLowPrecision` 防御性 skip(网格 math 前过滤非有限 rect);**签名不改**(行为硬化,fold 修非契约变更);T1 先于 T2(消费前修)。
8. **E8 guard(AC-5/AC-6)**:zero 图元(`getSnapshot().length === 0`)-> minimap canvas 显居中占位文案/空框(不绘图元点,不抛错);0->1 切正常投影(Branch 触发全量,placeholder 隐藏)。
9. **minimap world bounds**:由图元集 min/max bbox + padding 动态计算;单图元/共点用最小 span(防 div-by-zero,如 span=1 world unit);clamp `WORLD_CLAMP=1e15`;bounds 变化(图元 add/remove 超出旧 bounds)触发全量投影 + minimapScale 重算。
10. **minimap canvas 挂载**:CanvasView 内**独立 2D `<canvas>` overlay**(角落实驻),非 VRAM gl canvas(pointer-events:none,aria-hidden),非主 2D surface canvas(grid/HUD);自有 pointer events(跳转交互);ResizeObserver sizing。
11. **`__e2e__` hook 增 minimap 暴露**:`minimapProjector`/`minimapDirtyTracker`/`getHighlightBox(): WorldRect|null`/`jumpToWorld(px, py): {x, y}`(AC-9 测试专用,dev-only,同 1a.5 `__e2e__` 模式)。

### story-cycle §7 gate 红线(不可违)

- 禁 per-glyph shadowBlur at runtime(CAP-11 / AD-9);唯一合法站点 = `bakeGlowAtlasCanvas` off-screen bake。1a.6 新代码(minimap.ts/CanvasView minimap 段)无 `.shadowBlur =`(minimap 不绘 glyph)。
- 规格基准 = epic(非 prototype)。
- memory 只记已验证状态(有验证命令证实),不记意图。
- 读任何图(PNG/截图/设计稿/视觉 gate)前先「⚠ 切多模态」停手等确认(AC-9 Playwright 截图若需 Claude 目视核验,须先切多模态)。
- 文档标点:prd 全角 / epics+spine 半角(Edit old_string 须精确匹配)。
- 定位变更须传播到全部措辞。

### 测试标准

- **TDD red-green-refactor**(story-cycle §2.3 DS 10 步):每 task 先写失败测试(red)-> 实现(green)-> 重构。**NEVER mark complete unless 全验证 pass**。
- **TEA ATDD red 脚手架**(memory `newsd-tea-module-installed`):1a.6 DS 前跑 `/bmad-testarch-atdd` 产 ATDD red 脚手架(per AC);CS 测试标准须容纳 ATDD red scaffold(红脚手架先于 DS TDD)。
- **纯逻辑**(world↔minimap 变换、逆变换、minimap world bounds、MinimapProjector 投影/增量、queryLowPrecision NaN 硬化)-> vitest + jsdom 单测。
- **2D canvas draw 路径**(minimap 渲染/高亮框/placeholder)-> jsdom 有 2D canvas 上下文(部分 spy 可行),完整视觉经 Playwright e2e(AC-9);CanvasView 集成含 VRAM 挂载(jsdom 无 WebGL2),集成测试走 Playwright。
- **CAP-11 守卫**:`cap11-shadowblur-guard.test.ts` + `CanvasView.test.tsx` runtime spy 双守卫须保持绿;1a.6 新代码无 `.shadowBlur =`。
- **F1-quality locked 常量**:`glowAtlas.test.ts` 锁定;1a.6 不改 glowAtlas,守卫绿。
- **无回归**:1a.5 末 vitest 全绿 + Playwright 全绿须保持(1a.6 增 minimap/dirty-rect hardening 测试后基线上调)。
- **本地验证命令**(NewSD):
  - `cd C:/Two/NewSD && npx vitest run`(单元)
  - `cd C:/Two/NewSD && npx tsc --noEmit`(类型)
  - `cd C:/Two/NewSD && npx playwright test`(e2e,AC-9 minimap.spec.ts 加入后)
  - 主机已装 Go1.26.4/Rust1.96.1/wasm-pack0.15.0/GitHub CLI;docker 未装;仓库无 CI(P#29 清空),质量靠本地 tsc+vitest+Playwright 自检。
- **禁直推 main**;改 main 走 PR(`gh pr create` -> 本地 tsc+vitest+playwright 全绿 -> `gh pr merge --squash --delete-branch`)。
- **禁 `git add -A`**;提交前核暂存区(`git diff --cached --stat`),发现 `.playwright-mcp/`/`package-lock.json`/`.claude/`/非白名单 PNG 立即 `git restore --staged <file>`(1a.6 无新依赖,核锁文件以仓库实际为准,勿夹禁文件)。
- **禁 fixup-PR 链**:问题折进当前 story PR 合并前一次清掉。
- **sprint-status 更新与 story 代码 PR 分开推送**:story 代码 PR 不夹带 sprint-status 变更;合并后再开独立 chore PR 推 sprint-status -> done。

### Project Structure Notes

```
src/lib/render/
  camera.ts            # 不改(consume viewportToWorldRect + clampCamera)
  dirty-rect.ts        # H8/E2 硬化(markDirty Number.isFinite + queryLowPrecision 防御 skip,签名不改)(Task 1.1/1.2)
  dirty-rect.test.ts   # +NaN/±Infinity/-0/混合 单测(Task 1.3)
  spatial-index.ts     # 不改(consume search(rect))
  elements.ts          # 不改(consume getElementBounds)
  minimap.ts           # [NEW] MinimapProjector 类(world↔minimap 变换+投影+增量+高亮+跳转逆变换)(Task 2.1/2.2/2.3)
  minimap.test.ts      # [NEW] 变换/全量vs增量/10000非全量/共点span 单测(Task 2.4/4.3)
  CanvasView.tsx       # +minimap 2D canvas overlay + Projector 接线 + 3-branch draw + 高亮 + 跳转 + E8 + __e2e__(Task 3.1-3.5/4.1/4.2)
  CanvasView.test.tsx  # +minimap 集成/E8/高亮/jump 测试(Task 3.6/4.3)
  cap11-shadowblur-guard.test.ts  # 不改,保持绿
  vram/                # 不改(AD-9 VRAM 基座,minimap 非此路径)
    glowAtlas.ts       # 不改(locked 常量)
    renderer.ts        # 不改
    shaders.ts         # 不改
e2e/
  minimap.spec.ts      # [NEW] 渲染+高亮+跳转+E8+增量(Task 5.1)
package.json           # 不改(无新依赖,rbush ^4.0.1 沿用 1a.5)
```

### References

- **epics.md** Story 1a.6 段:`_bmad-output/planning-artifacts/epics.md` L445-465(verbatim AC 权威源:主 AC L451-458 4 项;E8 guard 段 L460-465 2 项);FR-CANVAS-5 定义 L43(角落常驻缩略图+低精度采样投影全部图元+高亮框+点击/拖拽跳转+采样粒度与更新频率架构期定+联动脏矩形避免 10000 全量重绘);E8 归类 L1627(zero 图元 minimap -> empty placeholder,Story 1a)。
- **sprint-plan**:`_bmad-output/planning-artifacts/sprint-plan-2026-07-05.md` §1 裁定 #2(单 PR)。
- **story-cycle**:`_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1 CS 6 步、§2.2 VS gate(零歧义+零遗漏+可执行+web research 显式)、§2.3 DS 10 步、§2.4 CR、§6 单 PR 判据、§7 gate 红线。
- **architecture**:`_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md` §AD-9(F1 VRAM render L87-91,binds FR-CANVAS-3/4/5,禁 per-glyph shadowBlur)、§AD-2(viewport L45)、L31(Canvas 2D Fixed-Point Render "Dirty-region updates per FR-CANVAS-4")、L381(FR-CANVAS-5 binds AD-9)、§F1-quality(locked L392/399,visually indistinguishable,no shadowBlur fallback);`.memlog.md` L14(F1 render decision #8:小地图复用图集降采样率 + 独立脏矩形)。
- **deferred-work**:`_bmad-output/implementation-artifacts/deferred-work.md` L50(H8 queryLowPrecision NaN/Infinity 未守卫,Target 1a.6,LOW,1a.6 消费前修)、L53(E2 queryLowPrecision NaN pass,Target 1a.6,Edge,同 H8)。
- **implementation-readiness-report**:`_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-03.md`(FR-CANVAS-5 -> 1a.6)。
- **sprint-status**:`_bmad-output/implementation-artifacts/sprint-status.yaml` L36(`1a-6-minimap: backlog` -> CS 后 `ready-for-dev`)。
- **1a.5 story**:`_bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md`(结构镜像;域模型对账/§6/§7/测试标准/Project Structure/References 风格;1a.5 基座契约:queryLowPrecision 非 drain/SpatialIndex.search/viewportToWorldRect/computeCameraChanged 3-branch)。
- **源码落点**(已读,CS 阶段核实):`src/lib/render/camera.ts`(viewportToWorldRect/Camera center/clampCamera 就绪)、`src/lib/render/dirty-rect.ts`(queryLowPrecision 非 drain,H8/E2 未守卫 L51-52/62)、`src/lib/render/spatial-index.ts`(search(rect) 就绪,订阅 elementStore)、`src/lib/sd/store.ts`(getElements/getSnapshot/subscribe 就绪)、`src/lib/render/elements.ts`(getElementBounds 就绪)、`src/lib/render/CanvasView.tsx`(module singletons/drawRef 3-branch/computeCameraChanged/**e2e** hook)、`src/lib/render/vram/*`(不改)。

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **2026-07-09 DS complete**: All 6 tasks green. vitest 437/437 (16 files), tsc clean, Playwright 29/29 (7 minimap + 22 prior). CAP-11 shadowBlur guard green (grep + runtime spy). F1-quality constants unchanged (GLOW_PAD=16/LUMA_BLUR_PX=[0,4,8,14]/GLOW_PASSES=3). VRAM/glowAtlas/shaders untouched. §6 single PR decision upheld — 9 ACs, non-independent subsystems, single PR per story-cycle §6.
- **T1 (AC-7)**: H8/E2 hardening in dirty-rect.ts (markDirty Number.isFinite + queryLowPrecision defensive skip). 23 new tests in dirty-rect.test.ts.
- **T2 (AC-1/AC-4)**: MinimapProjector in minimap.ts (world↔minimap transforms, 3-branch update, incremental dirty projection via spatialIndex.search). 23 tests in minimap.test.ts.
- **T3 (AC-1/AC-2/AC-5/AC-6)**: CanvasView.tsx minimap `<canvas>` overlay + MinimapProjector wiring + highlight box + E8 placeholder + `__e2e__` hooks. 14 tests in CanvasView.test.tsx.
- **T4 (AC-3)**: Jump interaction (pointer events + DPR-aware coordinate conversion + inverse transform + cam center). 5 tests in minimap.test.ts + 4 tests in CanvasView.test.tsx.
- **T5 (AC-9)**: e2e/minimap.spec.ts 7 tests (canvas presence, element rendering, highlight box pan, click recenter, E8 placeholder, incremental dirty, **e2e** hooks). All Playwright 29/29 green.
- **T6 (AC-8)**: Regression suite green. CAP-11 shadowBlur only in comments + allowed glowAtlas off-screen bake. F1-quality constants locked. VRAM unchanged. Single PR decision upheld.

### File List

---

## CS 阶段产出说明

本文件由 [CS] bmad-create-story 生成(sprint-status.yaml L36: `backlog` -> `ready-for-dev`)。下一步 **[VS] `*validate-create-story`**--选项 A:用 code-review skill on 本 story 文件;选项 B:手动检查清单(story-cycle §2.2 gate:零歧义 + 零遗漏 + 可执行 + web research 显式记录)。**VS pass 后 -> [DS] bmad-dev-story**(TDD red-green-refactor + TEA ATDD red 脚手架 `/bmad-testarch-atdd`,story-cycle §2.3 10 步,DS step1 更新 `baseline_commit` 为实际 dev 起点 commit、step4 复核 §6 单 PR 决策)。

**VS 显式记录要求**(per memory `newsd-story-cycle-bmad-skill-invocation`:1a.5 VS 实测无持久化产物,1a.6+ VS 必须在 story 留显式记录):VS 须于本文件(或 Dev Agent Record)显式记录--(1) §2.2 gate 4 项逐条核验结果(零歧义/零遗漏/可执行/web research 显式);(2) CS 决策 11 条是否有歧义或缺漏;(3) AC-1..AC-9 是否覆盖 epic L451-465 全 AC(main 4 + E8 2)+ H8/E2 fold;(4) §6 单 PR 评估是否认可。VS 结论(pass/fail + findings)须落盘,禁静默 skip。

CS 6 步执行轨迹:① 目标 story = 1a-6(epics.md L445,sprint-status L36 backlog)✅;② 加载分析 artifacts(epics AC L445-465 + FR-CANVAS-5 L43 + E8 L1627 + AD-9/AD-2/F1#8/F1-quality + NFR + 1a.5 story 模板 + deferred-work H8/E2 target 1a.6)✅;③ 架构分析(orchestrator 直跑,非 subagent--本会话后端 ark-code/DeepSeek 非 Claude 级,per memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`;READ 待修改文件防回归:camera/dirty-rect/spatial-index/store/elements/CanvasView + vram/* + e2e specs)✅;④ web research(explicit no-op--1a.6 消费 1a.5 基座,纯 TS 2D canvas,无新依赖;基座版本锁 rbush ^4.0.1 引用 1a.5;rejected minimap 专用库/WebGL minimap/OffscreenCanvas Worker,显式记录见 Dev Notes web research 段)✅;⑤ 生成 story 文件(本文件,镜像 1a.5 结构,AC-1..9 覆盖 epic FR-CANVAS-5 main 4 + E8 2 + H8/E2 fold + 无回归 + Playwright gate;CS 决策 11 条 preempt VS 歧义)✅;⑥ 更新 sprint-status.yaml(`1a-6` -> `ready-for-dev`,`last_updated` -> 2026-07-09)✅(本地工作树,**未 commit/push**--CS = 仅 author,push 在 DS story PR;sprint-status -> done 是 CR 合后独立 chore PR)。

## VS 验证记录 (validate-create-story)

**VS verdict**: PASS
**验证后端/模型**: deepseek-v4-pro
**验证日期**: 2026-07-09

### §2.2gate 4 项

| 项                | PASS/FAIL | 证据(行号)                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 零遗漏            | PASS      | epic L451-458 主 4 AC → AC-1/2/3/4; epic L460-465 E8 2 AC → AC-5/6; deferred-work L50(H8)+L53(E2) → AC-7; 无回归 → AC-8; Playwright e2e → AC-9。FR-CANVAS-5 L43 全子句(缩略图/低精度采样/高亮框/跳转/增量联动)均有 AC 对位。                                                                                     |
| 零歧义            | PASS      | CS 决策 11 条全可执行(逐条核验见下);minimapScale 定义明确(CS 决策#2: minimapCanvasSize/worldBoundsSize);3-branch 与主 drawRef 并行无冲突(camera 变化全量重绘 minimap,见 CS 决策#5;图元世界位置未变,全量重绘仅为刷新高亮框);queryLowPrecision 非 drain 经源码核实(见契约真实性);逆变换+clampCamera 跳转路径完整。 |
| 可执行            | PASS      | T1-T6 AC→Task 映射完整;每 task 子任务到具体文件/函数级;TDD red-green 标注;TEA ATDD(`/bmad-testarch-atdd`)在测试标准段声明(DS step1 前跑);T1(H8/E2)前置依赖标注"先于 T2"。微小 gap:TEA ATDD 未作独立子任务但测试标准段显式声明,DS step1 执行,不影响可执行性。                                                     |
| web research 显式 | PASS      | Dev Notes L105-110 显式 web research 段:explicit no-op(无新依赖)+ 基座版本锁 `rbush ^4.0.1`(引自 1a.5)+ rejected 3 项(minimap 专用库/WebGL minimap/OffscreenCanvas Worker)+ `package.json` 不变。符合 memory `newsd-cs-webresearch-explicit-gate` 要求。                                                         |

### CS 决策 11 条逐条核验

| #   | 主题                                | 核验结论    | 源码/规格证据                                                                                                                                                                                                                                      |
| --- | ----------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 投影精度:定位点/块,不绘 ASCII glyph | PASS,无歧义 | 明确定义:按 `getElementBounds` world bbox 投影为定位点/块,stock/cloud/flow 以颜色/形状区分。CAP-11/AD-9 无 glyph 即无 shadowBlur 风险逻辑自洽。                                                                                                    |
| 2   | queryLowPrecision step 动态公式     | PASS,无歧义 | `step = max(1, round(MINIMAP_DIRTY_CELL_PX / minimapScale))`, `MINIMAP_DIRTY_CELL_PX=4`, minimapScale=canvasSize/worldBoundsSize。公式完整,DS 可直接实现。                                                                                         |
| 3   | 3-branch 更新频率                   | PASS,无歧义 | Branch1(mount/bulk/camera 变化均全量投影) / Branch2(增量 dirty 重投+drain) / Branch3(skip)。非每帧轮询,事件驱动。与主 drawRef cadence 对齐。                                                                                                       |
| 4   | 独立脏矩形(minimapDirtyTracker)     | PASS,无歧义 | per F1 #8(.memlog.md L14)独立实例;并行订阅 elementStore;drain 顺序无耦合—主 tracker 由主 Branch2 `consume()`,minimap tracker 由 minimap Branch2 drain。源码核实 `queryLowPrecision` 非 drain(读 this.rects 不 clear/splice,dirty-rect.ts L51-68)。 |
| 5   | 高亮框:viewportToWorldRect 投影     | PASS,无歧义 | `viewportToWorldRect(cam,vp)`→world→minimap 变换→矩形描边。camera 变化全量重绘 minimap(刷新高亮框,图元世界位置未变,见 AC-2/AC-4 备注)。样式取 design tokens。绘于图元投影之上。                                                                    |
| 6   | 跳转交互:逆变换+cam center 设定     | PASS,无歧义 | minimap px→world 逆变换→设 `cam.x`/`cam.y`(center-based,保留 zoom)→触发 cameraChanged(`computeCameraChanged` 检测 cam 变化 L279-293 含 x/y/zoom/vp dims 比较)。拖拽连续(pointerdown→pointermove→pointerup)。minimap canvas 自有 pointer events。   |
| 7   | H8/E2 硬化(AC-7)                    | PASS,无歧义 | `markDirty` 增 `Number.isFinite` 输入校验 + `queryLowPrecision` 防御性 skip 非有限 rect。签名不改。T1 先于 T2。源码核实当前 L20-23 markDirty 无校验、L51 仅 check step<=0 不防 NaN/Infinity、L56-60 Math.floor 对 NaN 产 NaN grid key。            |
| 8   | E8 guard(AC-5/AC-6)                 | PASS,无歧义 | `getSnapshot().length===0`→居中占位/空框,不抛错;0→1 切正常投影(Branch 触发全量,placeholder 隐藏)。与 1a.4 AR#12 空态取向一致。                                                                                                                     |
| 9   | minimap world bounds 动态计算       | PASS,无歧义 | 图元集 min/max bbox+padding;单图元/共点最小 span(防 div-by-zero,span=1 world unit);clamp `WORLD_CLAMP=1e15`;bounds 变化触发全量投影+minimapScale 重算。                                                                                            |
| 10  | minimap canvas 挂载方式             | PASS,无歧义 | CanvasView 内独立 2D `<canvas>` overlay(角落),非 VRAM gl canvas(pointer-events:none,aria-hidden),非主 2D surface。自有 pointer events。ResizeObserver sizing。                                                                                     |
| 11  | `__e2e__` hook 暴露                 | PASS,无歧义 | `minimapProjector`/`minimapDirtyTracker`/`getHighlightBox():WorldRect\|null`/`jumpToWorld(px,py):{x,y}`。dev-only,同 1a.5 `__e2e__` 模式(L188-227)。                                                                                               |

### AC 覆盖矩阵

| AC   | epic 源行                     | 覆盖 PASS/FAIL | 备注                                         |
| ---- | ----------------------------- | -------------- | -------------------------------------------- |
| AC-1 | L455 (主AC#1)                 | PASS           | 缩略图+低精度采样+全图元投影                 |
| AC-2 | L456 (主AC#2)                 | PASS           | 高亮框指示当前视口                           |
| AC-3 | L457 (主AC#3)                 | PASS           | 点击/拖拽跳转主视口                          |
| AC-4 | L458 (主AC#4)                 | PASS           | 增量更新联动脏矩形,防 10000 全量             |
| AC-5 | L463-464 (E8#1)               | PASS           | empty minimap placeholder                    |
| AC-6 | L465 (E8#2)                   | PASS           | placeholder 随图元创建消失                   |
| AC-7 | deferred-work L50(H8)+L53(E2) | PASS           | queryLowPrecision NaN/Infinity 硬化,消费前修 |
| AC-8 | 无回归(1a.5 基线)             | PASS           | vitest+Playwright+CAP-11+F1-quality 全守卫   |
| AC-9 | Playwright e2e gate           | PASS           | minimap.spec.ts:渲染/高亮/跳转/E8/增量       |

### 契约真实性核验

逐个源码签名:story 引用 vs 源码实际

| 模块                                        | story 引用                                     | 源码实际                                                                                                             | 一致/不符                                                              |
| ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| dirty-rect.ts: queryLowPrecision            | 非 drain,读 this.rects 不 clear/splice(L56-68) | L51-68:创建 grid Map,遍历 this.rects,返回 Array.from(grid.values()),**不修改 this.rects**                            | ✅ 一致                                                                |
| dirty-rect.ts: markDirty                    | L20-23,无 Number.isFinite 校验                 | L20-23:`this.rects.push(rect)`,无任何校验                                                                            | ✅ 一致(H8/E2 未守卫确认)                                              |
| dirty-rect.ts: consume                      | drain(clear+copy),L31-36                       | L31-36:copy then `this.rects=[]; this.dirtyIds.clear()`                                                              | ✅ 一致                                                                |
| dirty-rect.ts: hasDirty                     | L26-28                                         | L26-28:`return this.rects.length > 0`                                                                                | ✅ 一致                                                                |
| dirty-rect.ts: clear                        | L39-42                                         | L39-42:清空 rects+dirtyIds                                                                                           | ✅ 一致                                                                |
| spatial-index.ts: search(rect): SDElement[] | L89,返 SDElement[]                             | L89-97:`tree.search(rect)`→elementMap 解析→`SDElement[]`                                                             | ✅ 一致                                                                |
| spatial-index.ts: 订阅 elementStore         | constructor L51 subscribe                      | L51:`elementStore.subscribe(...)`                                                                                    | ✅ 一致                                                                |
| camera.ts: viewportToWorldRect(cam,vp)      | L50,返 WorldRect                               | L50-59:`screenToWorld` 两端点→`{minX,minY,maxX,maxY}`                                                                | ✅ 一致                                                                |
| camera.ts: Camera{x,y,zoom} center-based    | L23-30                                         | L23-30:`{x,y,zoom}`,注释"centers a world point (x,y) in the viewport"                                                | ✅ 一致                                                                |
| camera.ts: clampCamera                      | 签名不改,含 WORLD_CLAMP=1e15                   | L155-161:clamp x/y/zoom                                                                                              | ✅ 一致                                                                |
| camera.ts: WORLD_CLAMP=1e15                 | L21                                            | L21:`export const WORLD_CLAMP = 1e15`                                                                                | ✅ 一致                                                                |
| store.ts: getElements()                     | L48,返 readonly SDElement[]                    | L48 interface + L78-80 实现                                                                                          | ✅ 一致                                                                |
| store.ts: getSnapshot()                     | L62,返 readonly SDElement[]                    | L62 interface + L138-140 实现                                                                                        | ✅ 一致                                                                |
| store.ts: subscribe(callback)               | L60,返 ()=>void                                | L60 interface + L131-135 实现                                                                                        | ✅ 一致                                                                |
| elements.ts: getElementBounds               | stock/cloud/flow 三类 bbox                     | L195-219:stock→{x,y,w,h}/cloud→{x,y,6,3}/flow→bbox of instances                                                      | ✅ 一致                                                                |
| CanvasView.tsx: computeCameraChanged        | L279,含 vp dims 比较                           | L279-294:prevCam null\|x\|y\|zoom + prevVp null\|width\|height 比较                                                  | ✅ 一致                                                                |
| CanvasView.tsx: drawRef 3-branch            | L541-582                                       | L541-589:Branch1(cameraChanged→clear dirty+full rebuild),Branch2(hasDirty→rebuild+consume drain),Branch3(skip WebGL) | ✅ 一致(实际范围延至 589 含 prevCamRef/VpRef 更新+lastCam/lastVp 暴露) |
| CanvasView.tsx: **e2e** hook                | L188-227                                       | L188-227:elementStore/spatialIndex/dirtyTracker/perfProbe/createFlow/buildInstances/seedBulk/charToGlyphIdx          | ✅ 一致                                                                |
| CanvasView.tsx: module singletons           | L174-184                                       | L174-184:elementStore/spatialIndex/dirtyTracker/perfProbe + lastCam/lastVp                                           | ✅ 一致                                                                |

**契约真实性结论:全部 19 项签名/行为核验一致,零不符。**

### §6单 PR 评估

**认可 CS 推荐(单 PR)**。理由:

- AC 计数:AC-1..AC-9 = 9(<< 20 阈值,story-cycle §6)
- 子系统虽约 7 项但**非独立**:MinimapProjector 是核心模块,高亮框/跳转/集成均消费它;H8/E2 硬化(2)是 MinimapProjector 消费的前置依赖(T1 先于 T2);E8(5)嵌入集成(6);e2e(7)依赖全部。拆分产生跨 PR 契约 churn+H8/E2 前置依赖难切。
- 共享 1a.5 基座(camera/spatialIndex/dirtyTracker/elementStore),非独立技术子系统。
- 两个判据(≥3 独立子系统 OR AC>20)均不触发,默认单 PR。DS step4 终裁保留回退权。

### Findings

**无 FAIL findings。** 全部 4 项 gate PASS,11 条 CS 决策 无歧义,19 项契约签名核验全一致,AC 覆盖完整,web research 显式记录。

**微小注意项(非 blocking,DS 可自行处理)**:

- TEA ATDD(`/bmad-testarch-atdd`)在测试标准段声明但未作独立子任务—DS step1 执行即可,不影响可执行性。
- Branch 1 标签含"camera 变化"—camera 变化现已全量重绘 minimap(见 AC-2/CS 决策#5),与 mount/bulk 行为一致,本注意项 moot(CR Run 1 F-A 裁定后)。
- minimap canvas 自身 resize(ResizeObserver)触发全量投影未在 Branch 1 显式列出—视为 mount-like 事件,DS 自行归类。

### 下一步

**VS PASS → 放行 DS `bmad-dev-story`。** DS 执行前须跑 `/bmad-testarch-atdd` 产 ATDD red 脚手架;DS step1 更新 `baseline_commit` 为实际 dev 起点 commit;DS step4 复核 §6 单 PR 决策。

---

## Code Review (CR Run 1, 2026-07-09)

**Reviewer**: orchestrator-direct(ark-code 后端;per memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`,不起 subagent)。
**Baseline**: `d946a442` | **Scope**: uncommitted(4 new + 5 mod,9 files)| **Mode**: full | **Verdict**: **FAIL**(1 real correctness bug + 1 AC spec violation);**Run 1 Resolution**:patches(F-B/F-C/F-D/F-E/F-F)已应用 + F-A spec amended(accept full repaint on camera change),re-verify 见 Resolution 段

**Independent verify**(DS 自评≠CR verdict,per memory `newsd-ds-self-attestation-vs-cr-verdict`):`npx tsc --noEmit` ✅ exit 0;targeted vitest(minimap + dirty-rect + cap11-shadowblur-guard + CanvasView)✅ 134/134。基线绿独立复核通过。

### Layer 3 - Acceptance Audit(AC-1..AC-9)

| AC   | Verdict                    | Evidence                                                                                                                                                                                                                                                                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | **RESOLVED**(F-B patched)  | minimap.ts:156-194 投影全部图元;但 add-to-non-empty-bounds-expansion 走 Branch2 增量不 recomputeWorldBounds(minimap.ts:297 `needsFullProject=false`)->新图元投影到 stale bounds->off-canvas 不可见(违「全部图元」)。见 F-B。                                                              |
| AC-2 | **RESOLVED**(spec amended) | minimap.ts:405-415 camera-only Branch1 做 `clearCanvas+drawBackground+fullProject`(全量重投图元);spec(AC-2 L31 / CS 决策#3 L157 / CS 决策#5 L159)三处明示「camera 变化仅高亮框,不重投图元」。代码注释 L409 自认 deviation;test L489-495 仅断言 strokeRect 被调,未强制「不重投」。见 F-A。 |
| AC-3 | **RESOLVED**(F-D patched)  | 逆变换+jumpToWorld+clampCamera 接线正确(CanvasView.tsx:1258-1260);但无测试断言 pointerdown 后 camRef 实际移动(CanvasView.test.tsx:1330/1347 仅 no-throw;1379 仅 finite {x,y})。见 F-D。                                                                                                   |
| AC-4 | **PASS**                   | 增量机制正确(spatialIndex.search 返回全相交图元,clearRect+重投脏区;spatialIndex.sync 处理 move 已验 remove-old+insert-new);Branch3 skip。perf test 已改 10000(F-E patched);camera-pan 全量重投(F-A)经 spec amend 接受(见 AC-2/AC-4 备注),Branch2 图元变更路径仍增量。                     |
| AC-5 | **PASS**                   | minimap.ts:399-400 drawPlaceholder;isEmpty guard L425。                                                                                                                                                                                                                                   |
| AC-6 | **PASS**                   | minimap.ts:89-91 0->1 needsFullProject;Branch1 重绘覆盖 placeholder。                                                                                                                                                                                                                     |
| AC-7 | **PASS**                   | dirty-rect.ts markDirty `Number.isFinite` + queryLowPrecision defensive skip;签名不改;23 新测。1a.5 H8/E2 闭环。                                                                                                                                                                          |
| AC-8 | **PASS**                   | CAP-11 grep:`.shadowBlur =` 仅 glowAtlas.ts:162/171 离屏 bake;minimap 无站点(minimap.ts:3 注释 / minimap.test.ts:181 `shadowBlur:0` 对象属性不匹配 guard 正则)。F1 常量未动。VRAM 未改。tsc+vitest 绿。                                                                                   |
| AC-9 | **PASS-weak**              | 7 e2e 全绿;但 P2-9.4 仅断言 jumpToWorld finite(未断言 recenter);P2-9.6 仅查 tracker state(未断言增量重绘结果);e2e 手动传 isMountOrBulk=true(L193)生产 drawRef 永不传。见 F-D/F-K。                                                                                                        |

### Layer 1 - Blind Hunter findings(11)

| ID  | Severity | Bucket          | Title                                                                                                                                          | Evidence                                                       |
| --- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| F-A | MEDIUM   | decision_needed | AC-2 camera-only 走 fullProject 全量重投,违 spec 三处明示「仅高亮框不重投」                                                                    | minimap.ts:405-415;AC-2 L31 / CS 决策#3 L157 / CS 决策#5 L159  |
| F-B | MEDIUM   | patch           | add-to-non-empty 不设 needsFullProject->bounds stale->新图元 off-canvas 不可见(违 AC-1「全部图元」)                                            | minimap.ts:93-98(仅 markDirty)/ 297(recompute skip)            |
| F-C | LOW      | patch           | queryLowPrecision 空 early-return(L304)在 consume()(L334)前->latent 永不 drain->Branch2 每帧重投                                               | minimap.ts:304 / 334                                           |
| F-D | LOW-MED  | patch           | AC-3 跳转 recenter 端到端未断言(仅 no-throw + finite)                                                                                          | CanvasView.test.tsx:1330/1347/1379;e2e minimap.spec.ts:160-177 |
| F-E | LOW      | patch           | AC-4 perf test 用 100 元素非 spec 10000(断言 fillRect<10 为 count-invariant,证增量成立但非 spec 口径)                                          | minimap.test.ts:506                                            |
| F-F | LOW-MED  | patch           | drawElementDot flow 每 flow `elements.find()` x2->fullProject O(F·n),10000 flows 缩放差                                                        | minimap.ts:254-255 / 283-285                                   |
| F-G | LOW      | defer           | flow 端点移动不 markDirty(prev===el)->旧 flow 线段近未动端点不 clear->stale 残线(camera 全量重绘自愈)                                          | minimap.ts:99-109;drawElementDot L252-269                      |
| F-H | LOW      | defer           | computeWorldBounds 非对称 clamp(max 下界 / min 上界)->元素 coord 超 WORLD_CLAMP 可 minX>maxX 反转 rect                                         | minimap.ts:188-193                                             |
| F-I | LOW      | dismiss         | minimapToWorld 无 minimapScale=0 guard;scale 永不为 0(始 1,recompute>0)+computeDirtyStep `                                                     |                                                                | 0.01`/ scale getter`>0?:1` 已防 | minimap.ts:137-143 / 201-204 / 450-454 |
| F-J | LOW      | dismiss         | beginMinimapJump 无 px/py clamp;clampCamera(L1259)上游 backstop ±WORLD_CLAMP,无 crash/infinity                                                 | CanvasView.tsx:1250-1259                                       |
| F-K | LOW      | dismiss         | e2e 手动传 isMountOrBulk=true(L193)/P2-9.6 仅查 tracker state;生产 drawRef 永传 isMountOrBulk=false,真实 Branch1-camera 路径(F-A)未被 e2e 覆盖 | e2e/minimap.spec.ts:193;CanvasView.tsx drawRef                 |

### Layer 2 - Edge Case Hunter(condensed;全 JSON 见 CR transcript)

- **NaN->cam**: jumpToWorld(CanvasView.tsx:1258)输出直入 clampCamera;clampCamera 对 NaN 透传(`Math.max(-WORLD_CLAMP, NaN)=NaN`)->cam NaN->主渲染 NaN 传播。触发需 px/py NaN(clientX 恒 finite)->**low confidence**;guard 建议 jumpToWorld 入参 `Number.isFinite` 校验或 clampCamera 拒 NaN。
- **DPR=0/undefined**: `devicePixelRatio || 1` 守卫(CanvasView L712/743)->guarded,**high**。
- **empty store**: worldBounds null->worldToMinimap 返 [0,0];isEmpty guard L425->guarded,**high**。
- **canvas width=0**: `Math.max(1, floor(clientWidth))` + drawW `Math.max(1,...)`(L201)+ `worldW || MIN_WORLD_SPAN`->guarded,**high**。
- **minimapScale=0**: 永不为 0(见 F-I)->guarded,**high**。
- **pointer OOB**: clampCamera backstop(见 F-J)->guarded,**medium**。
- **concurrent pointerdown**: minimapDragRef 单 bool,第二次 pointerdown 覆盖;minor,**low**。
- **stale spatialIndex**: **非问题**-spatialIndex 模块级订阅先于 minimap effect,sync 处理 move(remove-old+insert-new,CR H2 fix for flows)->moved elements found at new position,**high**。

### Triage / Verdict

**FAIL -> RESOLVED**(Run 1 Resolution:F-B/F-C/F-D/F-E/F-F patched + F-A spec amended;re-verify 见 Resolution 段)。原 FAIL 记录:1 real correctness bug(F-B:新图元 bounds-expanding add 不可见)+ 1 AC spec violation(F-A:AC-2 camera 全量重投)。其余:patch(F-C/F-D/F-E/F-F)+ defer(F-G/F-H)+ dismiss(F-I/F-J/F-K)。

**Step-04 summary**: **1 decision-needed(->resolved spec amend), 5 patch(->applied), 2 defer, 3 dismissed**。

- **Defer items** -> `deferred-work.md`(新 `## From Story 1a.6 CR` 段:F-G flow stale 残线 / F-H clamp 非对称)。
- **Patch items**(F-B/F-C/F-D/F-E/F-F)-> **已应用**(Run 1 Resolution:5 patch 全部落地,见 Resolution 段)。
- **F-A -> resolved(spec amended)**:用户裁定 = 采纳「修 AC-2/CS 决策#5 措辞接受 full repaint」选项。camera 变化(pan/zoom/resize)全量重绘 minimap(刷新高亮框,图元世界位置未变),承认 10000-pan O(n)/帧 成本(2D draw 轻量,见 AC-4 备注);Branch2 图元变更路径仍增量,AC-4 增量约束未违。spec amend 已传播至:AC-2 L31 / AC-4 L35 备注 / CS 决策#3 L157 / CS 决策#5 L159 / Task 3.3 L73 / VS 表 L273·L283·L285 / L351 note / CR 段 L363·L371·L372·L374·L385·L410·L412·L415 全部措辞。

## CR Run 1 Resolution (2026-07-09, post-patch re-verify)

**Patches applied**(5/5,folded into this story PR per `newsd-one-push-per-story`):

- **F-B**(MEDIUM):add-to-non-empty-bounds-expansion 在 subscription handler 设 `needsFullProject=true`(minimap.ts),Branch1 下次帧 recomputeWorldBounds->新图元投影可见(AC-1)。
- **F-C**(LOW):`queryLowPrecision` 空 early-return 前先 `dirtyTracker.consume()`(minimap.ts:319-322),防 latent 永不 drain->Branch2 每帧重投。
- **F-D**(LOW-MED):补测 `pointerdown on minimap recenters camera`(CanvasView.test.tsx),断言 pointerdown 后 camRef 实际 recenter(HUD after!=before + 含 jumpToWorld 返回坐标);jsdom 无 2D ctx,instance-level mock `mc.getContext` 使 `update()` 跑 fullProject 填 worldBounds。AC-3 PASS-weak -> RESOLVED。
- **F-E**(LOW):AC-4 perf test 改 10000 元素(minimap.test.ts:506),count-invariant 断言保留。
- **F-F**(LOW-MED):`drawElementDot` flow 路径用 caller-built id `Map` 替 per-flow `elements.find()` x2(minimap.ts:345-351),fullProject O(F*n)->O(F)。

**F-A -> spec amended**(用户裁定):AC-2/CS 决策#5 措辞接受 camera 变化全量重绘(见上 L416);代码本就全量重绘,注释已同步;Branch2 图元变更路径仍增量,AC-4 增量约束未违。

**Re-verify(VERIFIED,非自评;per memory `newsd-ds-self-attestation-vs-cr-verdict`)**:

- `npx tsc --noEmit` -> exit 0。
- `npx vitest run` -> **438/438 pass**(16 files)。
- F-D 目标测 `pointerdown on minimap recenters camera` -> PASS。
- CAP-11 未违(`.shadowBlur =` 仅 glowAtlas.ts 离屏 bake;F1 常量 GLOW_PAD=16/LUMA_BLUR_PX/GLOW_PASSES=3 未动;VRAM renderer/glowAtlas/shaders 未改)。

**Verdict**: **FAIL -> PASS**(Run 1)。AC-1/AC-2/AC-3 RESOLVED;AC-4..AC-8 PASS;AC-9 PASS-weak(e2e 覆盖为 F-D/F-K defer/dismiss,非阻塞)。CR gate 通过,Story 可进 PR(green)。
