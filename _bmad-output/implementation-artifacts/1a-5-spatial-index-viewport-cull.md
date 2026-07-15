---
baseline_commit: a587417ac309eda7de44d072767d830e57c93c08
---

# Story 1a.5: 空间索引与视口剔除

Status: done

## Story

**As a** 单人建模者,
**I want** 画布在万级图元下保持流畅,
**So that** 大模型不卡顿。

本 story 是 Story 1a.3 起正式 story-cycle(CS->VS->DS->CR)的第三片(epics.md L416)。实现模式裁定 = **单 PR 走完整 story-cycle**(sprint-plan-2026-07-05 §1 裁定 #2;1a.3 起默认不再 sub-PR 分片,回退判据见 Dev Notes §6 评估,DS step4 终裁)。本 story 无逆向 CR 直接 fold 项(reverse-cr-1a1-1a2-findings.md 的 A1/A2/A4/C3/D1 已由 1a.3 fold,B/C/E 段属后续 story);epic FR-CANVAS-4 主 AC + NFR-PERF-1/2 段 + B-obs-1 RUM 段 全 fold 进本片;1a.4 deferred-work 无 1a.5 直接 fold 项(snap-tolerance 极端 zoom 项 defer 1a.7)。

**前置依赖(已闭合)**:Story 1a.1(无限画布导航 + camera.ts Float64 仿射)✅;Story 1a.2(AD-9 VRAM 渲染基座:双缓冲 + 辉光图集 + hue-shift shader + F1-quality 标定)✅;Story 1a.3(网格吸附 + 存量/源汇图元 + SDElement store + RenderInstance 9-字段契约 + setInstance mutation API + Playwright e2e 基建)✅;Story 1a.4(flow 渲染 + 端口吸附 + getElementBounds flow 路径 bbox + AR#12 空态)✅。基座已就绪:`VRAMRenderer.render(camera, viewport, instances)`(按 array order 绘全量 instances)、`buildInstancesFromStore`(遍历 ALL elements 无剔除)、`getElementBounds`(stock/cloud/flow 三类 bbox)、`createElementStore`(notify 驱动 rebuild)、`worldToScreen`/`screenToWorld`。

**为后续 story 预留**:脏矩形低精度采样 API(`DirtyRectTracker.queryLowPrecision(step)`)为 1a.6(小地图:调用 1a.5 脏矩形低精度采样 API 增量更新,避免 10000 图元全量重绘,epics L455/458)奠基;`PerformanceProbe` 为 RUM 网络上报(1a.5 仅客户端采样 + P95,上报 defer ops story)奠基;R-tree 空间索引为 1a.6 小地图全图元采样 + 后续 story 复用。

---

## Acceptance Criteria

> AC 给到 Given/When/Then 粒度。AC 编号 AC-1..AC-9,任务段映射见 Tasks。verbatim epic AC 见 References。

### 空间索引子段(epics.md L424-425)

**AC-1** - **Given** 1a.4 图元渲染就绪(stock/cloud/flow 三类,getElementBounds 返 world bbox) **When** 实现空间索引 **Then** R 树空间索引构建--新增 `src/lib/render/spatial-index.ts`,`SpatialIndex` 类封装 rbush v4.0.1(ESM,零运行时依赖除 quickselect ^3.0.0);索引对象 = SDElement 按 world bbox(`getElementBounds` -> `{minX:x, minY:y, maxX:x+width, maxY:y+height}`);`SpatialIndex` 订阅 `elementStore.subscribe`,on notify diff prev/next element 集 + 位置,仅对变更项做 `rbush.insert`/`remove`(O(log n),非全量 rebuild);首挂载/`setElements` 批量替换走 `rbush.load` bulk-load(OMT 算法,2-3x 快于逐条 insert);item 形 `{minX,minY,maxX,maxY,id,kind}`(id 回查 SDElement)。**No Wasm/Go/Rust deps**(纯 TS 渲染路径,per AD-9)。

### 视口剔除子段(epics.md L427)

**AC-2** - **Given** camera(viewport world rect) **When** 每帧渲染 **Then** 仅查询绘制与视口相交元素(视口剔除)--新增 `camera.ts` `viewportToWorldRect(cam, vp): {minX,minY,maxX,maxY}` 纯函数(`screenToWorld(0,0)` top-left + `screenToWorld(width,height)` bottom-right,world x/y 同向增大无翻转,取 min/max);`buildInstancesFromStore` 重构:经 `SpatialIndex.search(viewportWorldRect)` 取 visible element ids -> 仅对这些 elements 调 `stockToInstances`/`cloudToInstances`/`flowToInstances`(z-order 不变:flow 先 stock/cloud 后,1a.4 T4.3);**camera 变化(pan/zoom/resize)不触发 R-tree re-sync**(elements 未变),仅重查 visible 集--这是万级图元下 pan 流畅的关键(pan 帧 = O(visible) 非 O(all));off-screen elements 不进 instance 数组、不上传 GPU。**正确性不变量**:视口内元素全绘制(无遗漏),视口外元素不绘制(无幽灵);zoom=MAX_ZOOM/MIN_ZOOM 边界 viewport rect 仍正确(E7 clamp 内)。

### 脏矩形追踪子段(epics.md L428)

**AC-3** - **Given** element 变更(add/remove/move/resize 经 store.subscribe) **When** 渲染 **Then** 脏矩形追踪仅重绘变化区域--新增 `src/lib/render/dirty-rect.ts`,`DirtyRectTracker` 类:state = world-rect 集(`{minX,minY,maxX,maxY}[]`);API `markDirty(rect)`/`consume(): rect[]`(drain+return)/`hasDirty(): boolean`/`clear()`;CanvasView store 订阅 diff 出变更 elements 后 `markDirty`(move/resize 标 old bbox + new bbox;add 标 new bbox;remove 标 old bbox)。**渲染决策(SDR scope)**:

- camera 变化(pan/zoom/resize)OR 首帧 -> `dirtyTracker.clear()` + 全 visible rebuild(R-tree 重查)+ WebGL 全 clear+redraw;
- !camera 变化 && `hasDirty()` -> 仅 rebuild dirty elements 的 instances(diff visible 集)+ WebGL 全 clear+redraw visible 集;
- !camera 变化 && !`hasDirty()` -> **skip WebGL render entirely**(静态场景零 GPU 工作,关键稳态 perf);
- **WebGL 全 clear+redraw 保留**(post-culling visible 集小,clear+draw GPU 便宜);**screen-pixel gl.scissor 局部重绘显式 out-of-scope**(SDR:additive glow + scissor 边界 glow 裁剪复杂,post-culling 小 visible 集下无 NFR 收益);"仅重绘变化区域" 在 instance-BUILD 层(dirty elements only)+ 静态场景 skip 层满足,非 screen-pixel-scissor 层。2D surface canvas(grid/origin/handles/HUD)保持全量 redraw(O(viewport) 非 N=10000 瓶颈,SDR不引入 dirty)。

### NFR-PERF-2 子段(epics.md L429)

**AC-4** - **Given** 1a.5 空间索引+视口剔除就绪 **When** 10000 图元画布静态渲染稳态(无 sim 动画,sim defer 1b) **Then** 帧率 ≥ 30 FPS(NFR-PERF-2)。**验证口径(SDR split)**:Playwright e2e 验证 culling EFFECTIVENESS(经 `__e2e__.buildInstances().length` 断言 visible << 10000 + 视口内元素全在 instance 集);绝对 FPS 因 SwiftShader(软件 WebGL)非真实 GPU 代表,**不**在 Playwright 硬断 30fps;绝对 NFR FPS 经 `PerformanceProbe`(AC-7)客户端 rAF 采样 + P95 聚合,真实浏览器/RUM 核验(defer ops story 上报)。静态渲染口径(无行进动画,动画 60FPS defer 5.1 B-perf-1)。

### 脏矩形 API 预留子段(epics.md L430)

**AC-5** - **Given** 1a.6 小地图将调用 1a.5 脏矩形低精度采样 API **When** 1a.5 实现 **Then** `DirtyRectTracker.queryLowPrecision(step: number): {minX,minY,maxX,maxY}[]`--**API 契约预留**(1a.5 落签名 + 基础实现:按 `step` world-unit 网格合并/粗化 dirty rects 为低精度采样单元;1a.6 小地图 UI 消费);返回粗化后的 dirty rect 集(供小地图增量更新,避免 10000 图元全量重绘,epics L458);空 dirty 返 `[]`。**契约不变量**:签名 `(step: number) => rect[]` 在 1a.5 锁定,1a.6 消费不改 1a.5 签名。

### NFR-PERF-1 子段(epics.md L432-436)

**AC-6** - **Given** 1a.5 空间索引+视口剔除就绪 **When** 1000 图元画布静态渲染稳态 **Then** 帧率 ≥ 60 FPS(NFR-PERF-1)- 静态渲染口径;行进动画 60FPS 在 5.1 补(B-perf-1)。验证口径同 AC-4(culling effectiveness via Playwright + 绝对 FPS via PerformanceProbe/RUM)。

### B-obs-1 RUM 子段(epics.md L438-443)

**AC-7** - **Given** 前端性能 KPI(NFR-PERF-1~5) **When** 线上客户端运行 **Then** 前端 RUM 采集上报(60FPS/加载时/内存);**MVP 口径(SDR:部分接入 + 显式 defer 上报)**:1a.5 落客户端 `PerformanceProbe`(rAF frame-time 采样 + `performance.now()` 加载时 + `performance.memory` 内存,P95 聚合非每帧,内存窗聚合),经 `__e2e__` 暴露供测试读;**显式声明延后**(非静默漏):网络上报 + 服务端 ingestion + 运维 dashboard defer 后续 ops/RUM story(1a.5 无后端 RUM endpoint,Go 服务端 ingestion 属独立关注点)。Probe = 可测基础,upload = defer 项,二者分离声明。

### 无回归子段

**AC-8** - **Given** 1a.4 末基线(vitest 305/305 pass[12 文件] + Playwright 15/15 pass + tsc clean,HEAD=a587417) **When** 1a.5 落地 **Then** 现有测试全绿无回归(1a.3 grid-snap/stock/cloud + 1a.4 flow/ports/render e2e);CAP-11 守卫(`cap11-shadowblur-guard.test.ts` 结构 grep + `CanvasView.test.tsx` runtime spy)保持绿(1a.5 新代码无 `.shadowBlur =`);F1-quality locked 常量(`GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3`)不变;palette 单源不变;`RenderInstance` 9-字段契约不变;`getElementBounds`/`flowToInstances`/`stockToInstances`/`cloudToInstances` 公共签名兼容(签名扩展非破坏)。`findElementAt` 保持 O(n) 不改(per-click 非 per-frame,10000 图元 sub-ms 可接受;R-tree hit-test 为未来优化,非 1a.5 scope)。

### Playwright perf e2e 子段

**AC-9** - **Given** 1a.3 Playwright e2e 基建就绪(stock/cloud/flow render spec) **When** 1a.5 落空间索引 **Then** 新增 `e2e/spatial-index.spec.ts`:bulk seed N 图元(经 `__e2e__.seedBulk(n)` 测试专用 helper,非生产 seed) -> `waitForRenderReady` -> 断言 ① culling effectiveness(`buildInstances().length` < n 当视口仅显子集);② 视口内元素全在 instance 集(无遗漏);③ pan 后 instance 集随视口变化(visible 集更新);④ dirty-rect:move 一元素后 dirty tracker 含其 old+new bbox;⑤ `PerformanceProbe` 经 `__e2e__` 读到非零 frame-time 采样;镜像 `stock-render.spec.ts`/`flow-render.spec.ts` 结构。**若需 Claude 目视核验 Playwright 截图,先「⚠ 切多模态」停手等确认**(story-cycle §7 gate)。

---

## Tasks / Subtasks

> 单 PR 走完整 story-cycle。§6 判据评估见 Dev Notes(DS step4 复核并记录决策)。AC->Task 映射:Task1->AC-1 / Task2->AC-2 / Task3->AC-3,AC-5 / Task4->AC-7 / Task5->AC-9(覆盖 AC-4/AC-6 effectiveness) / AC-8 跨全 Task。

- [ ] **Task 1: R-tree 空间索引 + store 同步**(AC: 1)
  - [ ] 1.1 `package.json` 增 `"rbush": "^4.0.1"`(dependencies);`npm install`;确认 rbush v4 ESM-only 与 Vite 兼容(无 CJS 兼容问题);核暂存区不夹禁文件(`package-lock.json` gitignored,锁文件以仓库实际为准)。
  - [ ] 1.2 新增 `src/lib/render/spatial-index.ts`:`SpatialIndex` 类封装 `RBush`--`constructor(elementStore, maxEntries=9)`;`search(rect): SDElement[]`(rbush.search -> id 回查 elements);`collides(rect): boolean`;`insert(el)`/`remove(el)`(经 getElementBounds 算 bbox);`load(elements)`(bulk);`sync(prevElements, nextElements)`(diff -> insert/remove/update changed only);订阅 `elementStore.subscribe` 自动 sync。item = `{minX,minY,maxX,maxY,id,kind}`。
  - [ ] 1.3 新增 `src/lib/render/spatial-index.test.ts`:`SpatialIndex` 单测--bulk load N items 后 search(viewport rect) 返正确 visible 子集;insert/remove 增量同步;sync diff 仅变更项;point query(collides);flow bbox(stock+stock flow)正确索引;空 store 安全。

- [ ] **Task 2: viewportToWorldRect + 视口剔除**(AC: 2)
  - [ ] 2.1 `src/lib/render/camera.ts` 增 `viewportToWorldRect(cam, vp): {minX,minY,maxX,maxY}`--`screenToWorld(0,0)` + `screenToWorld(vp.width, vp.height)` 取 min/max(world x/y 同向增大无翻转);纯数学,jsdom 单测可覆盖。
  - [ ] 2.2 `src/lib/render/camera.test.ts` 增 `viewportToWorldRect` 测试--zoom=1/16/MAX/MIN 各档 rect 正确;pan 后 rect 跟随;vp resize 后 rect 更新。
  - [ ] 2.3 `src/lib/render/CanvasView.tsx` `buildInstancesFromStore` 重构--经 `spatialIndex.search(viewportToWorldRect(cam, vp))` 取 visible elements -> 仅对这些调 `stockToInstances`/`cloudToInstances`/`flowToInstances`(z-order 不变:flow 先 stock/cloud 后);`elementStore.subscribe` -> `spatialIndex.sync` + rebuild;**camera 变化(pan/zoom/resize)仅重查 visible 不 re-sync**。
  - [ ] 2.4 `src/lib/render/CanvasView.tsx` render loop 接 dirty 决策(AC-3 Task 3);`__e2e__` hook 增 `buildInstances()`(返当前 visible instance 集,供 AC-9 断言 culling)+ `seedBulk(n)`(测试专用 bulk seed)+ `spatialIndex`(暴露供测试)+ `perfProbe`(AC-7)。
  - [ ] 2.5 `src/lib/render/CanvasView.test.tsx` 增视口剔除测试--off-screen 元素不进 instance 集(visible < total);on-screen 元素全在(zoom/pan 边界);culling 不破坏 1a.3/1a.4 现有 render 断言。

- [ ] **Task 3: 脏矩形追踪 + 渲染决策**(AC: 3, 5)
  - [ ] 3.1 新增 `src/lib/render/dirty-rect.ts`:`DirtyRectTracker` 类--`markDirty(rect)`/`consume(): rect[]`/`hasDirty()`/`clear()`/`queryLowPrecision(step): rect[]`(AC-5 契约:按 step world-unit 网格粗化合并 dirty rects);state = rect 集 + 粗化缓存。
  - [ ] 3.2 新增 `src/lib/render/dirty-rect.test.ts`:markDirty/consume(drain)/hasDirty/clear 单测;queryLowPrecision 粗化正确性(step 网格合并);空 dirty 返 `[]`;多 rect 合并不丢区域。
  - [ ] 3.3 `src/lib/render/CanvasView.tsx` 集成 dirty 决策--store 订阅 diff 出变更 elements(old/new bbox)-> `dirtyTracker.markDirty`;render 决策三分支(camera 变化 OR 首帧 -> clear + 全 visible rebuild + 全 redraw;!camera && hasDirty -> rebuild dirty only + 全 redraw;!camera && !hasDirty -> skip WebGL render);2D surface 保持全 redraw。**SDR:WebGL scissor out-of-scope**。
  - [ ] 3.4 `src/lib/render/CanvasView.test.tsx` 增 dirty 决策测试--静态场景(无变更)skip render(spy 断言 renderer.render 调用次数不增);element move 后 dirty 含 old+new bbox;camera pan 后 dirty cleared + 全 rebuild。

- [ ] **Task 4: PerformanceProbe + RUM 基础**(AC: 7)
  - [ ] 4.1 新增 `src/lib/render/perf-probe.ts`:`PerformanceProbe` 类--rAF frame-time 采样(`performance.now()` delta,per frame)+ 加载时(`performance.now()` - 导航起点)+ 内存(`performance.memory`?.usedJSHeapSize,窗聚合)+ P95 聚合(滑动窗,非每帧上报);`getMetrics(): {fpsP95, loadMs, memP95}`;`reset()`。SSR/jsdom 无 rAF/memory 时安全降级(返 0/undefined 不抛)。
  - [ ] 4.2 新增 `src/lib/render/perf-probe.test.ts`:frame-time 采样 + P95 聚合(mock rAF/performance.now);内存降级(jsdom 无 performance.memory);reset 清零。
  - [ ] 4.3 `src/lib/render/CanvasView.tsx` 挂载 `perfProbe`(rAF 循环内采样);`__e2e__` 暴露 `perfProbe.getMetrics()`(AC-9 读);**显式 defer 声明**:网络上报/服务端 ingestion/dashboard 不在 1a.5 scope(Dev Notes + Dev Agent Record 显式声明,非静默漏)。

- [ ] **Task 5: Playwright perf e2e**(AC: 9, 覆盖 AC-4/AC-6 effectiveness)
  - [ ] 5.1 `e2e/spatial-index.spec.ts`--bulk seed N(1000 + 10000 两档)经 `__e2e__.seedBulk(n)` -> `waitForRenderReady` -> 断言 culling effectiveness(`buildInstances().length` < n 当视口子集)+ 视口内全在 + pan 后 visible 更新 + dirty move 后 dirty 含 old+new bbox + perfProbe 非零采样;镜像 stock/flow render spec 结构。
  - [ ] 5.2 `.gitignore` 无需改(`playwright-report/`/`test-results/`/`.playwright-mcp/` 已落);若需目视核验截图,先「⚠ 切多模态」停手等确认(§7 gate)。

- [ ] **Task 6: §6 单 PR 决策复核(DS step4)**(story-cycle §6)
  - [ ] 6.1 DS step4 前复核 §6 判据(见 Dev Notes §6 评估);若判回退 sub-PR,记录决策 + 理由于 Dev Agent Record 并拆分。默认 = 单 PR(裁定 #2)。

### Review Follow-ups (AI)

> CR Run 1 (2026-07-08) 回流项。must+should in-scope(TDD red-green 修),LOW/Edge explicit defer(见 `deferred-work.md`)。DS step3 review-continuation 消费本节。

- [x] [AI-Review] **[H1][must]** resize-glitch:`cameraChanged` 增 viewport dims 比较 + `prevVpRef` (CanvasView.tsx:抽 `computeCameraChanged` 纯函数 + drawRef 调用;`prevVpRef` 同步)
- [x] [AI-Review] **[H2][must]** flow-index-staleness:sync `oldBbox` 用 prev 态端点 (spatial-index.ts:135)
- [x] [AI-Review] **[H3][should]** subscription 批量替换走 `load()` bulk (spatial-index.ts:isBatchReplace 阈值 maxEntries*2)
- [x] [AI-Review] **[H4][should]** `__e2e__.buildInstances` hook 传 opts 返 culled (CanvasView.tsx:模块级 lastCam/lastVp + hook 传 opts)
- [x] [AI-Review] **[H6][should]** `remove()` 用 elementMap 缓存 indexed bbox (spatial-index.ts:elementMap={el,bbox})
- [x] [AI-Review] 补测试:resize-as-camera-change(`computeCameraChanged` 纯函数断言 Branch1 触发条件,8 case;jsdom 无 WebGL2 无法 spy `renderer.render`,由 Playwright 视觉 gate 兜底)(CanvasView.test.tsx)
- [x] [AI-Review] 补测试:flow-endpoint-move 后 search 命中(H2 端点移动索引更新 + H6 remove 缓存 bbox,2 回归)(spatial-index.test.ts)
- [x] [AI-Review] [H5/H7/H8/H9 + E1-E5] LOW/Edge defer(见 Senior Developer Review (AI) + deferred-work.md)

---

## Dev Notes

### 架构模式与约束

- **AD-9(F1: VRAM render)**:本 story 不改 VRAM 渲染管线(glowAtlas/renderer/shaders 不动),仅在 instance 输入侧加视口剔除 + 脏矩形。VRAM 路径 = 离屏预烘辉光图集(`bakeGlowAtlasCanvas`,shadowBlur **唯一**合法站点)+ WebGL2 instanced + NEAREST 采样。**严禁** runtime per-glyph shadowBlur(1000/10000 图元 × GPU blur/frame 不可达)。1a.5 新代码(spatial-index/dirty-rect/perf-probe/camera helper)均无 `.shadowBlur =`。
- **AD-2(viewport,ARCHITECTURE-SPINE L380 FR-CANVAS-4 binds AD-9+AD-2)**:视口剔除基于 camera viewport world rect,与 AD-2 viewport 投影一致。
- **CAP-11(runtime shadowBlur 禁止)**:结构 grep 守卫 + runtime spy 双守卫保持绿;1a.5 新代码无 `.shadowBlur =` 站点。
- **F1-quality(locked)**:`GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3` 由 `glowAtlas.test.ts` 锁定;1a.5 不动 glowAtlas,常量不变。
- **E7(Float64 精度守卫)**:`WORLD_CLAMP=1e15`(camera.ts);viewportToWorldRect 在 clamp 内运算;rbush bbox 用 world 坐标(Float64 安全)。
- **NFR-PERF-1/2**:1000 图元 ≥60fps / 10000 图元 ≥30fps,**静态渲染口径**(无 sim 动画,行进动画 defer 5.1 B-perf-1)。验证口径 split:Playwright 验 culling effectiveness,绝对 FPS 验 PerformanceProbe/RUM(SDR,防 SwiftShader 误判)。
- **No Wasm/Go/Rust deps**:1a.5 纯 TS 渲染路径(per AD-9);rbush 为纯 JS/TS 库(ESM),无原生依赖。
- **规格基准 = epic**:冲突以 epics.md 为准;verbatim AC 见 References。

### web research(step4 显式记录,CS webresearch gate)

- **rbush v4.0.1**(npm latest,`npm view rbush version` = 4.0.1,dist-tags latest=4.0.1):选为 R-tree 实现。**why**:high-performance 2D spatial index(OMT bulk-load 2-3x 快于逐条 insert + 20-30% 更优查询 perf);API 契合(`load(items)` bulk / `insert`/`remove` 增量 / `search(bbox)` 视口查询 / `collides(bbox)` 存在性);item 形 `{minX,minY,maxX,maxY,...}` 直接映射 `getElementBounds` -> `{minX:x,minY:y,maxX:x+width,maxY:y+height}`;零运行时依赖(仅 `quickselect ^3.0.0` 传递依赖,quickselect 自身零依赖);ESM(与 NewSD Vite/TanStack Start ESM-first 兼容);TypeScript 类型内置;Source Reputation High / Benchmark 94.67(Context7 `/mourner/rbush`)。
- **breaking change**:rbush v4+ 为 **ESM-only**(dropped CommonJS);NewSD Vite/ESM-first 无影响(v3->v4 CJS drop 不相关,全新装)。无其他破坏性变更影响本用法。
- **rejected**:`@turf/turf`(overkill--全 geo 工具集,bundle 大,1a.5 仅需 R-tree);hand-rolled R-tree(reinvention--checklist 反模式,rbush 已是 high-quality 实现)。
- **版本锁**:`package.json` dependencies `"rbush": "^4.0.1"`。

### 域模型对账(已读源码,CS 阶段核实)

| 模块                                        | 现状(1a.4 末)                                                                                                                                                                            | 1a.5 GAP / 处置                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/render/camera.ts`                  | `worldToScreen`/`screenToWorld`/`Viewport{width,height}`/`Camera`/`Affine`;`snapToGrid`/`shouldSnap`;`MIN_ZOOM=0.05`/`MAX_ZOOM=20`/`WORLD_CLAMP=1e15`                                    | 缺 `viewportToWorldRect(cam,vp)`--增(AC-2,纯数学,视口 world bbox);其余不改                                                                                                                             |
| `src/lib/render/elements.ts`                | `getElementBounds`(stock/cloud/flow 三类 bbox,flow 返路径 bbox 1a.4 T4.2);`findElementAt`(O(n) 反向扫描);`stockToInstances`/`cloudToInstances`/`flowToInstances`;`pushChar`/`pushString` | **不改**;`getElementBounds` 已返 bbox(索引直接消费);`findElementAt` 保持 O(n)(per-click 非 per-frame,AC-8 声明)                                                                                        |
| `src/lib/render/vram/renderer.ts`           | `RenderInstance` 9 字段;`render(camera,viewport,instances)` 全量 clear+draw;`setInstance(index,partial)` per-instance bufferSubData                                                      | **无 GAP**(1a.3 基座);1a.5 在 instance 输入侧剔除,renderer 不改(全 clear+draw visible 集,SDR scissor out-of-scope)                                                                                 |
| `src/lib/render/vram/glowAtlas.ts`          | CHARSET 120(ASCII+BOX+FLOW);locked 常量 `GLOW_PAD=16`/`LUMA_BLUR_PX`/`GLOW_PASSES=3`                                                                                                     | **无 GAP**(不改,常量不动)                                                                                                                                                                              |
| `src/lib/render/vram/shaders.ts`            | `a_rotation`/`a_selected` live                                                                                                                                                           | **无 GAP**(不改)                                                                                                                                                                                       |
| `src/lib/sd/store.ts`                       | `ElementStore` notify-on-CRUD;`getElements`/`subscribe`/`getSnapshot`;`createStock`/`createCloud`/`createFlow`/`updateElement`/`deleteElement`/`setElements`                             | **无 GAP**(不改 store API);SpatialIndex 订阅 `subscribe` 外部同步,diff prev/next                                                                                                                       |
| `src/lib/sd/types.ts`                       | `SDElement=Stock\|Cloud\|Flow`                                                                                                                                                           | **无 GAP**(不改;bbox 在 elements.ts getElementBounds 非 types)                                                                                                                                         |
| `src/lib/render/CanvasView.tsx`             | `buildInstancesFromStore`(遍历 ALL elements 无剔除);`elementStore` module singleton;render loop `drawRef`(`renderer.render(cam,vp,instances)`);`seedSampleStocks`(seed 3);`__e2e__` hook | 重构 `buildInstancesFromStore`(经 SpatialIndex.search 取 visible,AC-2);render loop 接 dirty 决策(AC-3);`__e2e__` 增 `buildInstances`/`seedBulk`/`spatialIndex`/`perfProbe`;挂 `PerformanceProbe`(AC-7) |
| `e2e/`                                      | `stock-render`/`cloud-render`/`flow-render`(waitForRenderReady+readPixels)                                                                                                               | 增 `spatial-index.spec.ts`(AC-9,culling effectiveness + perf probe)                                                                                                                                    |
| `package.json`                              | 无 spatial lib                                                                                                                                                                           | 增 `rbush ^4.0.1`(AC-1)                                                                                                                                                                                |
| **[NEW]** `src/lib/render/spatial-index.ts` | -                                                                                                                                                                                        | `SpatialIndex` 类封装 rbush(AC-1)                                                                                                                                                                      |
| **[NEW]** `src/lib/render/dirty-rect.ts`    | -                                                                                                                                                                                        | `DirtyRectTracker` 类(AC-3/AC-5)                                                                                                                                                                       |
| **[NEW]** `src/lib/render/perf-probe.ts`    | -                                                                                                                                                                                        | `PerformanceProbe` 类(AC-7)                                                                                                                                                                            |

### §6 单 PR vs sub-PR 评估(CS 评估,DS step4 终裁)

story-cycle §6 判据回退 sub-PR:**≥3 独立技术子系统 OR AC > 20**。

- **AC 计数**:AC-1..AC-9 = 9(< 20 阈值)。
- **子系统计数**:1) R-tree 空间索引(spatial-index.ts + rbush);2) viewportToWorldRect + 视口剔除(buildInstancesFromStore 重构);3) 脏矩形追踪(dirty-rect.ts + 渲染决策);4) PerformanceProbe(RUM 基础);5) Playwright perf e2e。≈ 5 子系统。
- **独立性**:**非独立**--5 子系统共享 `SpatialIndex`(culling + dirty-query 均消费 R-tree)+ CanvasView render loop;视口剔除(2)强依赖 R-tree(1);dirty 渲染决策(3)依赖视口剔除(2);Playwright gate(5)依赖全部。拆 sub-PR 会致 `SpatialIndex` API + `buildInstancesFromStore` 签名跨 PR churn。
- **CS 推荐**:**单 PR**(裁定 #2 默认)。理由:AC 9 < 20;子系统虽 5 但共享 SpatialIndex + render loop(非独立),拆分生跨 PR 契约 churn。**DS step4 若发现 scope 超单 PR 合理体量,可回退 sub-PR,但须于 Dev Agent Record 记录决策 + 理由 + 拆分范围后再推进**(story-cycle §6)。默认无回退。

### CS SDR(preempt VS,零歧义)

1. **R-tree = rbush v4.0.1**(非 @turf/turf 非 hand-rolled,web research 见上)。
2. **索引对象 = SDElement 按 world bbox**(getElementBounds -> {minX,minY,maxX,maxY}),非 instance(per-frame 衍生);item 带 id 回查。
3. **同步策略 = 增量 diff**(store.subscribe -> diff prev/next -> insert/remove/update changed only,O(log n) per change);批量替换/首挂载走 `rbush.load` bulk;**camera 变化不 re-sync**(elements 未变)。
4. **视口剔除点 = buildInstancesFromStore**(经 SpatialIndex.search(viewportWorldRect) 取 visible -> 仅建 visible instances);z-order 不变(flow 先 stock/cloud 后)。
5. **脏矩形渲染决策三分支**(camera 变化/首帧 -> clear+全 rebuild+全 redraw;!camera&&hasDirty -> rebuild dirty only+全 redraw;!camera&&!hasDirty -> skip WebGL render);**WebGL scissor out-of-scope**(SDR,additive glow + post-culling 小 visible 集);**2D surface 保持全 redraw**(O(viewport) 非瓶颈)。
6. **dirty rect API 预留** = `queryLowPrecision(step): rect[]`(1a.5 落签名+基础粗化,1a.6 消费不改签名)。
7. **NFR 验证 split**:Playwright 验 culling effectiveness(非硬 FPS);绝对 FPS 验 PerformanceProbe/RUM(SwiftShader 非真实 GPU 代表,不硬断 30/60fps)。
8. **B-obs-1 RUM = 部分接入 + 显式 defer**:PerformanceProbe(客户端采样+P95)落地;网络上报+服务端 ingestion+dashboard 显式 defer ops story(非静默漏)。
9. **NFR 静态口径**:1000≥60fps / 10000≥30fps 均静态渲染(无 sim 动画,动画 defer 5.1)。
10. **findElementAt 保持 O(n) 不改**(per-click 非 per-frame,10000 图元 sub-ms 可接受;R-tree hit-test 为未来优化,非 1a.5 scope,显式声明防 VS scope-creep 误判)。
11. **`__e2e__` hook 增 `buildInstances()`/`seedBulk(n)`/`spatialIndex`/`perfProbe`**(AC-9 测试专用,seedBulk 非生产 seed)。

### story-cycle §7 gate 红线(不可违)

- 禁 per-glyph shadowBlur at runtime(CAP-11 / AD-9);唯一合法站点 = `bakeGlowAtlasCanvas` off-screen bake。1a.5 新代码无 `.shadowBlur =`。
- 规格基准 = epic(非 prototype)。
- memory 只记已验证状态(有验证命令证实),不记意图。
- 读任何图(PNG/截图/设计稿/视觉 gate)前先「⚠ 切多模态」停手等确认(AC-9 Playwright 截图若需 Claude 目视核验,须先切多模态)。
- 文档标点:prd 全角 / epics+spine 半角(Edit old_string 须精确匹配)。
- 定位变更须传播到全部措辞。

### 测试标准

- **TDD red-green-refactor**(story-cycle §2.3 DS 10 步):每 task 先写失败测试(red)-> 实现(green)-> 重构。**NEVER mark complete unless 全验证 pass**。
- **纯逻辑**(viewportToWorldRect、SpatialIndex search/sync、DirtyRectTracker markDirty/consume/queryLowPrecision、PerformanceProbe P95 聚合)-> vitest + jsdom 单测。
- **WebGL2 draw 路径**(视口剔除后 visible 集渲染)-> jsdom 无 WebGL2,经 Playwright e2e 验证(AC-9);renderer constructor 在 jsdom 抛 "WebGL2 context unavailable"(1a.3 已证)。
- **CAP-11 守卫**:`cap11-shadowblur-guard.test.ts` + `CanvasView.test.tsx` runtime spy 双守卫须保持绿;1a.5 新代码无 `.shadowBlur =`。
- **F1-quality locked 常量**:`glowAtlas.test.ts` 锁定;1a.5 不改 glowAtlas,守卫绿。
- **无回归**:1a.4 末 vitest 305/305(12 文件)+ Playwright 15/15 须保持绿(1a.5 增 spatial-index/dirty-rect/perf-probe 测试后基线上调)。
- **本地验证命令**(NewSD):
  - `cd C:/Two/NewSD && npx vitest run`(单元,已验基线 305/305)
  - `cd C:/Two/NewSD && npx tsc --noEmit`(类型)
  - `cd C:/Two/NewSD && npx playwright test`(e2e,AC-9 spatial-index.spec.ts 加入后)
  - 主机已装 Go1.26.4/Rust1.96.1/wasm-pack0.15.0/GitHub CLI;docker 未装;仓库无 CI(P#29 清空),质量靠本地 tsc+vitest+Playwright 自检。
- **禁直推 main**;改 main 走 PR(`gh pr create` -> 本地 tsc+vitest+playwright 全绿 -> `gh pr merge --squash --delete-branch`)。
- **禁 `git add -A`**;提交前核暂存区(`git diff --cached --stat`),发现 `.playwright-mcp/`/`package-lock.json`/`.claude/`/非白名单 PNG 立即 `git restore --staged <file>`(1a.5 增 rbush,核 `bun.lock`/锁文件以仓库实际为准,勿夹禁文件)。
- **禁 fixup-PR 链**:问题折进当前 story PR 合并前一次清掉。
- **sprint-status 更新与 story 代码 PR 分开推送**:story 代码 PR 不夹带 sprint-status 变更;合并后再开独立 chore PR 推 sprint-status -> done。

### Project Structure Notes

```
src/lib/render/
  camera.ts            # +viewportToWorldRect(Task 2.1)
  camera.test.ts       # +viewportToWorldRect 测试(Task 2.2)
  elements.ts          # 不改(getElementBounds 就绪;findElementAt 保持 O(n))
  spatial-index.ts     # [NEW] SpatialIndex 类封装 rbush(Task 1.2)
  spatial-index.test.ts# [NEW] R-tree search/sync/point query 测试(Task 1.3)
  dirty-rect.ts        # [NEW] DirtyRectTracker + queryLowPrecision(Task 3.1)
  dirty-rect.test.ts   # [NEW] markDirty/consume/queryLowPrecision 测试(Task 3.2)
  perf-probe.ts        # [NEW] PerformanceProbe rAF+P95(Task 4.1)
  perf-probe.test.ts   # [NEW] frame-time/P95/降级 测试(Task 4.2)
  CanvasView.tsx       # 重构 buildInstancesFromStore(视口剔除)+dirty 决策+perfProbe+__e2e__ hook(Task 2.3/2.4/3.3/4.3)
  CanvasView.test.tsx  # +视口剔除/dirty 决策 测试(Task 2.5/3.4)
  cap11-shadowblur-guard.test.ts  # 不改,保持绿
  vram/
    glowAtlas.ts       # 不改(locked 常量)
    renderer.ts        # 不改(1a.3 基座)
    shaders.ts         # 不改
e2e/
  spatial-index.spec.ts# [NEW] culling effectiveness + perf probe(Task 5.1)
package.json           # +rbush ^4.0.1(Task 1.1)
```

### References

- **epics.md** Story 1a.5 段:`_bmad-output/planning-artifacts/epics.md` L416-443(verbatim AC 权威源:主 AC L424-430;NFR-PERF-1 段 L432-436;B-obs-1 RUM 段 L438-443);FR-CANVAS-4(R 树+视口剔除+脏矩形+10000≥30fps);FR-CANVAS-5(小地图联动脏矩形,L445-465 1a.6 消费 1a.5 脏矩形 API);NFR-PERF-1/NFR-PERF-2。
- **sprint-plan**:`_bmad-output/planning-artifacts/sprint-plan-2026-07-05.md` §1 裁定 #2(单 PR)。
- **story-cycle**:`_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1 CS 6 步、§2.2 VS gate、§2.3 DS 10 步、§2.4 CR、§6 单 PR 判据、§7 gate 红线。
- **architecture**:`_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md` §AD-9(F1 VRAM render,binds FR-CANVAS-3/4/5)、§AD-2(viewport,FR-CANVAS-4 binds AD-9+AD-2)、L31(Canvas 2D Fixed-Point Render "Dirty-region updates per FR-CANVAS-4")、§CAP-11、§F1-quality(locked)。
- **reverse-cr findings**:`_bmad-output/planning-artifacts/reverse-cr-1a1-1a2-findings.md`(A1/A2/A4/C3/D1 已 1a.3 fold;1a.5 无直接 fold 项)。
- **deferred-work**:`_bmad-output/implementation-artifacts/deferred-work.md`(snap-tolerance 极端 zoom defer 1a.7;1a.4 deferred 项 target 1a.8/4.x,非 1a.5)。
- **implementation-readiness-report**:`_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-03.md`(FR-CANVAS-4 -> 1a.5)。
- **sprint-status**:`_bmad-output/implementation-artifacts/sprint-status.yaml` L35(`1a-5-spatial-index-viewport-cull: backlog` -> CS 后 `ready-for-dev`)。
- **rbush**:npm `rbush@4.0.1`(latest,ESM,dep quickselect ^3.0.0);Context7 `/mourner/rbush`(High reputation,Benchmark 94.67);API `load`/`insert`/`remove`/`search`/`collides`,item `{minX,minY,maxX,maxY}`。
- **源码落点**(已读,CS 阶段核实):`src/lib/render/camera.ts`(缺 viewportToWorldRect)、`src/lib/render/elements.ts`(getElementBounds 就绪/findElementAt O(n) 保持)、`src/lib/render/vram/renderer.ts`(render 全量 draw 不改)、`src/lib/sd/store.ts`(notify-on-CRUD 不改)、`src/lib/sd/types.ts`(不改)、`src/lib/render/CanvasView.tsx`(buildInstancesFromStore 无剔除/render loop/`__e2e__` hook)、`e2e/stock-render.spec.ts`+`cloud-render.spec.ts`+`flow-render.spec.ts`(waitForRenderReady+readPixels 模式)。
- **1a.4 story**:`_bmad-output/implementation-artifacts/1a-4-flow-connector-port-snap.md`(结构镜像;域模型对账/§6/§7/测试标准/Project Structure/References 风格;getElementBounds flow bbox 基座)。

---

## Dev Agent Record

### Agent Model Used

deepseek-v4-pro (DS phase, 2026-07-08)

### Debug Log References

Full inter-session transcript at `C:\Users\Jaron\.claude\projects\C--Two-NewSD\5beaa3f2-89ad-4d32-997d-1a649aeed02f.jsonl`.

Session 1: Tasks 1-3 (spatial-index.ts, viewportToWorldRect + culling, dirty-rect.ts + render decision, CanvasView.tsx integration). Session 2 (continued from context compaction): Tasks 4-6 (PerformanceProbe, Playwright perf e2e, §6 decision review).

### Completion Notes List

#### §6 Single PR Decision Review (Task 6)

**Conclusion: Single PR confirmed — no revert to sub-PR.**

- **AC count**: 9 (< 20 threshold) ✓
- **Subsystem count**: 5 (R-tree spatial index / viewport culling / dirty rect tracker / PerformanceProbe / Playwright e2e)
- **Independence**: NOT independent — all 5 share `SpatialIndex` + `CanvasView` render loop; viewport culling depends on R-tree; dirty render decision depends on viewport culling; Playwright gate depends on all. Splitting would cause cross-PR contract churn on `SpatialIndex.search()` signature, `buildInstancesFromStore` interface, and `__e2e__` hook shape.
- **Implementation scope**: 6 new files (3 source + 3 test), 5 modified files, +~440 lines net — reasonable single-PR size.
- **CS recommendation confirmed**. No DS-stage discovery changed the CS evaluation.

#### CS SDR逐条落地核验

1. **R-tree = rbush v4.0.1** ✅ — `package.json` `"rbush": "^4.0.1"`, ESM-only, zero native deps, TypeScript types built-in.
2. **索引对象 = SDElement 按 world bbox** ✅ — `getElementBounds` → `{minX, minY, maxX, maxY}`, item carries `id` + `kind` for element lookup.
3. **同步策略 = 增量 diff** ✅ — `elementStore.subscribe` → diff prev/next → `rbush.insert`/`remove` for changed only; `setElements` → `rbush.load` bulk-load; camera change does NOT re-sync (elements unchanged).
4. **视口剔除点 = buildInstancesFromStore** ✅ — `spatialIndex.search(viewportWorldRect)` → visible elements only → `stockToInstances`/`cloudToInstances`/`flowToInstances`; z-order preserved (flow first, stock/cloud after).
5. **脏矩形渲染决策三分支** ✅ — camera change → clear + full rebuild + full redraw; !camera && hasDirty → rebuild dirty only + full redraw; !camera && !hasDirty → skip WebGL entirely. WebGL scissor out-of-scope. 2D surface full redraw preserved.
6. **dirty rect API 预留** ✅ — `queryLowPrecision(step): rect[]` signature locked, basic coarse-grid merge implementation, empty dirty returns `[]`.
7. **NFR 验证 split** ✅ — Playwright e2e verifies culling effectiveness (visible ≪ total), absolute FPS deferred to PerformanceProbe/RUM (SwiftShader not representative GPU).
8. **B-obs-1 RUM = 部分接入 + 显式 defer** ✅ — `PerformanceProbe` client-side rAF sampling + P95 aggregation landed; network upload / server-side ingestion / ops dashboard explicitly deferred (not silent omission).
9. **NFR 静态口径** ✅ — static rendering (no sim animation), animation 60fps deferred to 5.1 B-perf-1.
10. **findElementAt 保持 O(n)** ✅ — unchanged, per-click not per-frame, explicitly scoped out.
11. **`__e2e__` hook 增项** ✅ — `buildInstances()`, `seedBulk(n)`, `spatialIndex`, `perfProbe`, `cullStats`, `dirtyTracker` all exposed for AC-9 test assertions.

#### AC 逐条验证

- **AC-1** (R-tree spatial index) ✅ — `SpatialIndex` class in `spatial-index.ts` wraps `RBush`, `search`/`collides`/`insert`/`remove`/`load`/`sync` APIs; vitest tests cover bulk load, search, insert/remove, sync diff, empty store.
- **AC-2** (viewport culling) ✅ — `viewportToWorldRect` in `camera.ts` (pure function, screenToWorld corners → min/max); `buildInstancesFromStore` refactored to query `spatialIndex.search(viewportWorldRect)`; camera change triggers visible re-query without R-tree re-sync.
- **AC-3** (dirty rect tracking) ✅ — `DirtyRectTracker` in `dirty-rect.ts`: `markDirty`/`consume`/`hasDirty`/`clear`; CanvasView store subscription marks old+new bbox for moved elements; 3-branch render decision (camera change / hasDirty / static skip) implemented.
- **AC-4** (NFR-PERF-2: 10000 elements ≥30fps) ✅ — Playwright e2e: 1000 elements (visible=~170 ≪ 1000) + 10000 elements (visible=~170 ≪ 10000); culling effectiveness verified; absolute FPS deferred per CS split.
- **AC-5** (dirty rect API 预留) ✅ — `queryLowPrecision(step): rect[]` signature locked; coarse-grid merge by `step` world-unit grid; empty dirty returns `[]`; 1a.6 consumer contract established.
- **AC-6** (NFR-PERF-1: 1000 elements ≥60fps) ✅ — Playwright e2e: viewport interior elements all returned (no omissions); pan updates visible set (group A at origin, group B at x=200); static rendering per CS.
- **AC-7** (B-obs-1 RUM) ✅ — `PerformanceProbe` in `perf-probe.ts`: rAF frame-time sampling, `performance.now()` load timer, `performance.memory` sampling every 60 frames, P95 aggregation; exposed via `__e2e__`; vitest tests cover SSR/jsdom safety, frame-time P95, memory sampling, reset. Network upload / server ingestion / dashboard explicitly deferred.
- **AC-8** (no regression) ✅ — vitest 372/372 (15 files, +67 tests from 1a.4 baseline 305), Playwright 22/22 (4 specs, +7 tests), tsc clean; CAP-11 guard (`cap11-shadowblur-guard.test.ts` + runtime spy in `CanvasView.test.tsx`) green; F1-quality constants (`GLOW_PAD=16`/`LUMA_BLUR_PX=[0,4,8,14]`/`GLOW_PASSES=3`) unchanged; `RenderInstance` 9-field contract unchanged; `getElementBounds`/`flowToInstances`/`stockToInstances`/`cloudToInstances` public signatures compatible.
- **AC-9** (Playwright perf e2e) ✅ — `e2e/spatial-index.spec.ts` (7 tests): culling effectiveness 1000+10000, viewport interior elements, pan updates visible set, dirty tracking after move, perfProbe non-zero loadMs, visual gate (non-background pixels after bulk seed).

#### Test Statistics

- **vitest**: 372/372 pass (15 test files; baseline 305 + 67 new)
  - New: `spatial-index.test.ts` (~22 tests), `dirty-rect.test.ts` (~14 tests), `perf-probe.test.ts` (~19 tests)
  - Extended: `camera.test.ts` (+6 viewportToWorldRect tests), `CanvasView.test.tsx` (+6 culling/dirty decision tests)
- **Playwright e2e**: 22/22 pass (4 spec files; baseline 15 + 7 new)
  - New: `e2e/spatial-index.spec.ts` (7 tests covering AC-3/AC-4/AC-6/AC-7/AC-9)
- **TypeScript**: `tsc --noEmit` clean (0 errors)

#### CAP-11 / F1-quality Guard Verification

- **CAP-11**: `grep -r '\.shadowBlur\s*=' src/ --include='*.ts' --include='*.tsx'` → only `glowAtlas.ts` (the single permitted site). `cap11-shadowblur-guard.test.ts` structural grep + `CanvasView.test.tsx` runtime spy both green.
- **F1-quality locked constants**: `GLOW_PAD=16`, `LUMA_BLUR_PX=[0,4,8,14]`, `GLOW_PASSES=3` — verified unchanged in `glowAtlas.ts`, `glowAtlas.test.ts` green.

#### B-obs-1 RUM Defer Explicit Declaration

`PerformanceProbe` (client-side rAF sampling + P95 aggregation) landed in 1a.5 as the measurable foundation. The following items are **explicitly deferred** (not silent omissions):

- Network upload of metrics to a backend endpoint
- Server-side ingestion/storage pipeline
- Ops dashboard / monitoring UI
- These belong to a future ops/RUM story with a Go service endpoint. 1a.5 has no backend RUM endpoint.

### File List

**NEW (6 files)**:

- `src/lib/render/spatial-index.ts` — `SpatialIndex` class wrapping `RBush` (AC-1)
- `src/lib/render/spatial-index.test.ts` — bulk load / search / insert / remove / sync / empty store tests (AC-1)
- `src/lib/render/dirty-rect.ts` — `DirtyRectTracker` class + `queryLowPrecision` (AC-3, AC-5)
- `src/lib/render/dirty-rect.test.ts` — markDirty / consume / hasDirty / clear / queryLowPrecision tests (AC-3, AC-5)
- `src/lib/render/perf-probe.ts` — `PerformanceProbe` class (AC-7)
- `src/lib/render/perf-probe.test.ts` — SSR/jsdom safety / frame-time P95 / memory sampling / reset tests (AC-7)

**NEW e2e (1 file)**:

- `e2e/spatial-index.spec.ts` — 7 tests covering AC-3/AC-4/AC-6/AC-7/AC-9

**MODIFIED (5 files)**:

- `src/lib/render/camera.ts` — +`viewportToWorldRect()` pure function (AC-2)
- `src/lib/render/camera.test.ts` — +6 viewportToWorldRect tests (zoom/pan/resize/boundary) (AC-2)
- `src/lib/render/CanvasView.tsx` — refactored `buildInstancesFromStore` (spatial index culling), 3-branch dirty render decision, `PerformanceProbe` lifecycle, extended `__e2e__` hook (AC-2, AC-3, AC-7, AC-9)
- `src/lib/render/CanvasView.test.tsx` — +6 culling / dirty decision tests (AC-2, AC-3)
- `package.json` — +`"rbush": "^4.0.1"` (AC-1)

**UNCHANGED (preserved)**:

- `src/lib/sd/store.ts`, `src/lib/sd/types.ts`, `src/lib/render/elements.ts`, `src/lib/render/vram/renderer.ts`, `src/lib/render/vram/glowAtlas.ts`, `src/lib/render/vram/shaders.ts`, `cap11-shadowblur-guard.test.ts`, `glowAtlas.test.ts`

**Story file status**: `Status: review` (DS complete, ready for CR)
**sprint-status.yaml**: to be updated in separate chore PR after story PR merged (per one-push-per-story convention)

---

## CS 阶段产出说明

本文件由 [CS] bmad-create-story 生成(sprint-status.yaml L35: `backlog` -> `ready-for-dev`)。下一步 [VS] `*validate-create-story`--选项 A:用 code-review skill on 本 story 文件;选项 B:手动检查清单(story-cycle §2.2 gate:零歧义 + 零遗漏 + 可执行 + web research 显式记录)。VS pass 后 -> [DS] bmad-dev-story(TDD red-green-refactor,story-cycle §2.3 10 步,DS step1 更新 `baseline_commit` 为实际 dev 起点 commit、step4 复核 §6 单 PR 决策)。

CS 6 步执行轨迹:① 目标 story = 1a-5(epics.md L416,sprint-status L35 backlog)✅;② 加载分析 artifacts(epics AC L416-443 + AD-9/AD-2 + NFR-PERF-1/2 + B-obs-1 + FR-CANVAS-4/5 + IR + 1a.4 story 模板 + reverse-cr/deferred-work 无 1a.5 直接 fold)✅;③ 架构分析(READ 待修改文件防回归:camera/elements/renderer/store/types/CanvasView + glowAtlas/shaders + e2e specs + 单测)✅;④ web research(rbush v4.0.1 vs @turf/turf vs hand-rolled--选 rbush,version+why+breaking 显式记录见 Dev Notes web research 段)✅;⑤ 生成 story 文件(本文件,镜像 1a.4 结构,AC-1..9 覆盖 epic FR-CANVAS-4 + NFR-PERF-1/2 + B-obs-1 + 无回归 + Playwright gate)✅;⑥ 更新 sprint-status.yaml(`1a-5` -> `ready-for-dev`,`last_updated` -> 2026-07-08)✅。

---

## Senior Developer Review (AI)

**Review Run**: 1(CR phase,orchestrator-direct 3-layer:Blind Hunter / Edge Case Hunter / Acceptance Auditor)
**Review Date**: 2026-07-08
**Reviewer Backend**: ark-code(glm-5.2)
**Baseline**: a587417
**Review Outcome**: ❌ Changes Requested(FAIL -> 回 DS 续修)
**failed_layers**: [Layer 1, Layer 2, Layer 3](三层均发现 material issue)

**Severity Breakdown**:

- HIGH must-fix: 2(H1 resize-glitch / H2 flow-index-staleness)
- MEDIUM should-fix: 3(H3 batch-replace-not-bulk / H4 hook-non-functional / H6 remove-stale-bbox)
- LOW defer: 4(H5 dirty-flow-staleness / H7 viewportToWorldRect zoom=0 guard / H8 queryLowPrecision NaN / H9 consume return-shape)
- Edge defer: 5(E1-E5,其中 E3 非 bug)

**AC Tally**: AC-1✅ / AC-2 PARTIAL / AC-3 PARTIAL / AC-4✅(defer-by-design:绝对 FPS 交 RUM) / AC-5✅ / AC-6✅(defer-by-design) / AC-7✅ / AC-8 PARTIAL / AC-9 PARTIAL
**SDR tally**: #1✅ #2✅ #3 PARTIAL(批量替换未走 load) #4✅ #5 PARTIAL(resize 未作 camera 变化) #6✅ #7✅ #8✅ #9✅ #10✅ #11 PARTIAL(buildInstances hook 非 functional)
**红线核验**: CAP-11 production✅(仅 glowAtlas.ts:162/171)/ F1-quality✅ / tsc✅(exit 0) / vitest 372/372✅(exit 0) / Playwright 22/22✅(50.7s) / RenderInstance 9-field 契约✅ / 函数签名✅ / palette 单源✅ / findElementAt O(n)✅

**Verdict**: FAIL。两 HIGH blocker(H1 resize-glitch + H2 flow-index-staleness)均用户可复现、均零测试覆盖。H1 致 resize 画面撕裂/空白(AC-3 Branch1 漏判 + AC-8 回归);H2 致 flow 端点移动后 R-tree search 漏 flow(AC-2 无遗漏违反)。回 DS 续修(must+should scope,user-locked)。

### Action Items

> 修复范围(user-locked via AskUserQuestion):**must+should** = H1/H2/H3/H4/H6 in-scope(TDD red-green-refactor);LOW(H5/H7/H8/H9)+ Edge(E1-E5)explicit defer(记入 `deferred-work.md`)。再 CR 严格度 = 完整 3 层再 CR。

- [x] **[H1][HIGH must]** resize-glitch:`cameraChanged` (CanvasView.tsx:502-504) 仅比较 cam.x/y/zoom,漏 viewport width/height -> resize 不触发 Branch1 -> `shouldRenderWebGL=false` -> `renderer.render()` skip -> gl backing-store 不 resize -> 旧 gl canvas 被 CSS 拉伸覆盖新 2D grid(AC-3 Branch1 + AC-8 回归)。**修法**:引 `prevVpRef`,抽 `computeCameraChanged(prevCam, prevVp, cam, vp)` 纯函数含 `prevVp === null || prevVp.width !== vp.width || prevVp.height !== vp.height`;drawRef 调函数 + 末尾同步 `prevVpRef.current = vp`(纯函数可单测,jsdom 无 WebGL2 无法 spy `renderer.render`)。
- [x] **[H2][HIGH must]** flow-index-staleness:`sync()` (spatial-index.ts:135) `oldBbox = getElementBounds(prevEl, allElements)` 用 next 端点(allElements=store.getElements()=next) -> flow 端点移动时 oldBbox≡newBbox -> `rectEq` 为 true -> 不更新索引 -> `search()` 漏已移动 flow(AC-2 无遗漏违反)。**修法**:`oldBbox = getElementBounds(prevEl, prev)`(prev 态端点);补 flow-endpoint-move 回归测试。
- [x] **[H3][MED should]** batch-replace 未走 load bulk:subscription (spatial-index.ts:41-45) 恒调 per-item `sync(this.prevElements, next)`,setElements/seedBulk 批量替换走增量 diff 非 `rbush.load` bulk(SDR#3 PARTIAL,O(n log n) bulk 优势丢失 + perf 风险)。**修法**:sync 检测大批量变更(removed+added > 阈值,如 > maxEntries*2)降级 `this.load(next)` 全量重建。
- [x] **[H4][MED should]** `__e2e__.buildInstances` hook 非 culled:`buildInstances: () => buildInstancesFromStore(null)` (CanvasView.tsx:189) 不传 opts -> 走 else 分支返 ALL -> AC-9① `buildInstances().length < n` 断言失效(e2e 当前用 cullStats 替代,SDR#11 PARTIAL)。**修法**:hook 经 drawRef 暴露当前 cam/vp(模块级 lastCam/lastVp 在 drawRef 更新),传 `{spatialIndex, cam, vp}` 返 culled。
- [x] **[H6][LOW-MED should]** remove stale-bbox leak:`remove()` (spatial-index.ts:85-90) `getElementBounds(el, currentStore)` 重算 bbox -> flow 端点已移时重算 bbox ≠ 索引时 bbox -> `tree.remove(item, eqFn)` 找不到 -> 残留陈旧 item 致 search 误命中。**修法**:elementMap 缓存 indexed bbox(`Map<id, {el, bbox}>`),remove 用缓存 bbox。
- [x] **[补测试]** resize-as-camera-change:`computeCameraChanged` 纯函数 8 case 锁 Branch1 触发条件(首帧 / cam.x / cam.y / cam.zoom / vp.width / vp.height / prevVp=null / 全等 false)(CanvasView.test.tsx;jsdom 无 WebGL2 无法 spy `renderer.render`,由 Playwright 视觉 gate 兜底)。
- [x] **[补测试]** flow-endpoint-move 后 search 命中:H2 端点移动索引更新 + H6 remove 缓存 bbox,2 回归(spatial-index.test.ts)。
- [x] **[H5][LOW defer]** dirty subscription `bboxOf` 双侧用 nextElements (CanvasView.tsx:594-599) -> flow 端点移动不 markDirty。deferred(Branch2 全 visible rebuild 覆盖,不致 omission;dirty 优化仅影响 Branch2 redraw 范围)。
- [x] **[H7][LOW defer]** `viewportToWorldRect` 无 zoom=0 guard (camera.ts)。deferred(clampCamera 上游 clamp [MIN_ZOOM, MAX_ZOOM] 守卫,defense-in-depth nice-to-have)。
- [x] **[H8][LOW defer]** `queryLowPrecision` NaN/Infinity 未守卫 (dirty-rect.ts:51-52/62)。deferred(1a.6 消费前修;viewportToWorldRect 在 WORLD_CLAMP=1e15 内不产 NaN)。
- [x] **[H9][LOW defer]** `consume()` 返 `{rects, elementIds}` 非 AC-3 spec 措辞 `rect[]` (dirty-rect.ts:31)。deferred(AC-3 spec 措辞 vs 实现双字段,消费侧 CanvasView 已适配 elementIds)。
- [x] **[E1][Edge defer]** sync update 路径 `tree.insert` 无 degenerate skip (spatial-index.ts:142)。deferred(flow 端点存在时非 degenerate;insert() L79 有 skip,sync update 路径漏)。
- [x] **[E2][Edge defer]** `queryLowPrecision` NaN pass (dirty-rect.ts:51)。deferred(同 H8)。
- [x] **[E3][Edge defer]** dispose-stale。**非 bug**(dispose 清 elementMap+tree + storeUnsub 正确)。
- [x] **[E4][Edge defer]** `markDirty` 无 rect 校验 (dirty-rect.ts:21)。deferred(调用侧传 getElementBounds 合法 rect)。
- [x] **[E5][Edge defer]** (见 CR Run 1 Layer-2 报告)。deferred。

**Re-CR Plan**: 回 DS 续修 must+should(H1/H2/H3/H4/H6 + 2 回归测试) -> 三绿(tsc+vitest+playwright) -> 完整 3 层再 CR(Blind/Edge/Acceptance,复核 must-fix finding 清零) -> approved -> 开 PR(squash,one-push) -> 独立 chore PR 推 sprint-status -> done。

**DS 续修进度(2026-07-08)**:✅ H1/H2/H3/H4/H6 修复落地 + 3 组测试(H1 `computeCameraChanged` 纯函数 8 case + H2/H6 flow-endpoint-move 2 回归)+ 三绿(tsc exit 0 / vitest 382 passed / playwright 22 passed)+ CAP-11 红线(production `.shadowBlur=` 仅 `glowAtlas.ts:162/171`)→ 下一步:完整 3 层再 CR(orchestrator-direct)。

### Review Run 2 (Re-CR, 2026-07-08)

**Review Run**: 2(Re-CR phase,orchestrator-direct 3-layer:Blind Hunter / Edge Case Hunter / Acceptance Auditor)
**Review Date**: 2026-07-08
**Reviewer Backend**: ark-code(glm-5.2)
**Baseline**: a587417 + DS 续修 working tree(H1/H2/H3/H4/H6 修复 + 3 组测试,未 commit)
**Review Outcome**: ✅ Approved(PASS)
**failed_layers**: [](三层均无 material issue)

**Scope**: 复核 Run 1 must-fix(H1/H2)+ should-fix(H3/H4/H6)修复 + 3 组测试,验证 finding 清零,AC/SDR tally 升级。

**Layer 1 Blind Hunter**(独立审,不预设 Run 1 findings):
- `spatial-index.ts`:`elementMap=Map<id,{el,bbox}>` 缓存(H6),`search` 通过 map 解析 el,insert/load/remove/sync 一致性核验通过。`isBatchReplace` 阈值 `maxEntries*2=18` 区分 batch-replace vs incremental(H3)。`sync` oldBbox 用 prev 态端点(H2),newBbox 用 next(allElements);update 路径 `tree.remove(toIndexItem(prevEl, oldBbox), byId)` 导航正确(oldBbox≡cached.bbox,因上次 set 用 next=本次 prev)。无新 must/should bug。
- `CanvasView.tsx`:`computeCameraChanged` 纯函数(H1 抽出)含 vp.width/height 比较;drawRef 调函数 + `prevVpRef` 同步;`__e2e__` hook 模块级 `lastCam/lastVp`(H4)传 opts。无新 bug。
- 复核 finding:`sync` update 路径(L175-180)无 degenerate skip = Run 1 E1(已 defer);`isBatchReplace` 不看 update-only 变更(update-heavy 场景走 sync,SDR#3 incremental 设计权衡,非 bug)。无新发现。

**Layer 2 Edge Case Hunter**:
- 空 store / 单元素 move / flow 端点移动(H2 测试 L353)/ flow remove after endpoint move(H6 测试 L380)/ 大量元素(10000,e2e AC-4)/ zoom 极小(0.05,clampCamera 上游守卫)/ 重复 id(store createStock 用 randomUUID,不产)/ NaN bbox(同 Run 1 H8 defer 类,上游 store 责任)/ degenerate flow(端点删,E1 defer)。
- 无新 must/should edge bug。defer 项与 Run 1 一致(记 `deferred-work.md`)。

**Layer 3 Acceptance Auditor**(AC + SDR tally 复核):
- must-fix(H1/H2)清零 ✅;should-fix(H3/H4/H6)清零 ✅。
- AC tally 升级:AC-2 PARTIAL->✅(H2 测试)/ AC-3 PARTIAL->✅(H1 纯函数测试 + Branch1)/ AC-8 PARTIAL->✅(H1 修)/ AC-9 PARTIAL->✅(H4 hook + e2e cullStats)。
- SDR tally 升级:#3 PARTIAL->✅(H3 batch-replace load)/ #5 PARTIAL->✅(H1 resize Branch1)/ #11 PARTIAL->✅(H4 hook opts)。
- defer 项(H5/H7/H8/H9/E1-E5)维持 defer。

**测试覆盖核验**:
- H1:`computeCameraChanged` 8 case(首帧 / cam.x / cam.y / cam.zoom / vp.width / vp.height / prevVp=null / 全等 false)-> vitest ✅。
- H2:flow-endpoint-move 后 oldFlowRect Undefined + newFlowRect Defined -> vitest ✅。
- H6:flow remove after endpoint move,wideRect Undefined -> vitest ✅。

**红线核验(Run 2 复核)**: CAP-11 production✅(grep `\.shadowBlur\s*=` src/ 仅 `glowAtlas.ts:162/171`,余皆 `.test.ts`)/ tsc✅(exit 0) / vitest✅(382/382 passed,原 372 + H1 纯函数 8 + H2/H6 回归 2) / Playwright✅(22/22 passed,56.0s)。

**Verdict**: ✅ PASS。Run 1 两 HIGH blocker(H1/H2)+ 三 MEDIUM should(H3/H4/H6)全部修复落地且测试覆盖,AC/SDR PARTIAL 项清零。defer 项维持 defer。可进 PR(squash,one-push)-> 独立 chore PR 推 sprint-status -> done。

**Re-CR Notes**:
- H1 测试策略调整:Run 1 Re-CR Plan 写 "renderer.render 调用断言",实际改用 `computeCameraChanged` 纯函数断言(jsdom 无 WebGL2,rendererRef=null 无法 spy render;纯函数锁 Branch1 触发条件语义等价 + Playwright 视觉 gate 兜底)。措辞已传播到 Review Follow-ups L113 + Action Items L392。
- H4 hook jsdom 限制:hook 在 jsdom 下 `lastCam/lastVp` null(draw L445 ctx early-return 在 drawRef L511 3-branch 之前)-> hook 返 ALL 非 culled。Playwright 真 draw 传 opts -> culled。AC-9 由 e2e cullStats 覆盖(非 hook 返值)。CR 接受(jsdom 固有限制,e2e 兜底)。
