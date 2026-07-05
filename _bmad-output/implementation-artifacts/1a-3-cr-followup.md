# Story 1a.3 CR Followup — 推荐方案与排期

- 来源: Story 1a.3 Code Review (CR), PR #25, branch `feat/1a.3-grid-snap-stock-source-sink`
- 审查者: Senior Developer (CR phase, 首个正式 CS→VS→DS→CR story-cycle)
- 状态: M3/M4/M5/L3 已修复并验证; **M6 已根因隔离并修复** (集成 CanvasView 默认 camera zoom=1 导致 glyph 在 SwiftShader headless 下 rasterize 为 0; 改为 zoom=16, AC-4/AC-6 readPixels 断言由 `test.fail` 转正并 PASS); **cloud-render.spec.ts 已 M6 同构修复** (smoke + AC-10 readPixels 真断言转正, 3 passed, 无需 test.fail — zoom=16 一并修绿 cloud); L6 TODO 注释已打且已补全 (renderer.ts:32/38/44/342 + elements.ts:pushChar)、L7 排期提前 (任何非 localhost 部署前必修); **M1 方案 a 已实施并验证** (接入 A2 selected GPU 路径 + 删死 `v_selected` + AC-13 措辞修正, 见下 "执行结果"); **M2 Step 1 已实施并验证** (setInstance 单测 4 例作契约护栏, Step 2 拖拽接入排 1a.4); **L9 resize 已实现并验证** (CR followup: `elements.ts:resizeStock` 纯函数 + `CanvasView` 4 角 handle hit-test + 拖拽改 w/h + clamp≥3 + snap + cursor 反馈 + 视觉 handle (CAP-11 fillRect/strokeRect); elements.test.ts +8 例 + CanvasView.test.tsx +4 例 全绿); **#2 合并裁定 = 推荐合并** (L9 blocker 已解除 — 全绿: tsc 0 错 / npm test 11 files 183 passed / playwright 7 passed; 详见末尾 裁定请求段 #2); Low 排期如下

## 已修复 (本批, 已合并进本分支)

| ID  | 文件                                     | 修复                                                                                           | 测试                                                                                      |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| M3  | `src/lib/sd/store.ts:createStock`        | 调 `validateStockSize(partial.width, partial.height)` 用校正值覆盖 partial                     | `store.test.ts` 增 createStock 集成 (clamp 0/-2, clamp 1×1, preserve 6×4)                 |
| M4  | `src/lib/sd/store.ts:validateStockSize`  | 阈值 `w>0 && h>0` → `w>=3 && h>=3` (box frame + >=1 内文行/列的最小合法值); 拒 1×1/2×2/2×5/5×2 | `store.test.ts` 增 reject 1×1/2×2/2×5/5×2 + accept 3×3                                    |
| M5  | `src/lib/render/elements.ts:CLOUD_SHAPE` | row 2 `"'--'  "` (左移) → `" '--' "` (居中, 镜像 row 0)                                        | `elements.test.ts` 增 cloud row 0/row 2 回文断言 + row0/row2 padding 一致性 (M5 回归守卫) |
| L3  | `src/lib/render/elements.ts` 注释        | "5 cols × 3 rows" / "5×3" → "6 cols × 3 rows" / "6×3" (两处)                                   | —                                                                                         |

验证: `npm test` → 11 files / 168 tests passed (历史快照 — M3/M4/M5/L3 批次; M1 后 167, M2 Step1 后 171, 见各段执行结果).

红线核查 (CAP-11 / PALETTE_SIZE 单源 / F1-quality 常量 / spec=epic) 全清, 无 High.

---

## M1/M2/M6 推荐方案

### M1 — A2 `selected` GPU 管线死路 + AC-13 名实不符

**现状:**

- `elements.ts:42` `pushChar` 恒置 `selected:false` → `a_selected` 恒 0.
- 选中辉光经 CPU 侧 `baseLuma = selected ? 1 : 0` (`elements.ts:79`) 抬 `a_lumaIdx`, 由**顶点**着色器 `effectiveLuma = a_lumaIdx + a_selected` (`shaders.ts:67`) 选更亮 atlas band 实现.
- `v_selected` (`shaders.ts:86`) 声明 + 顶点写出 + 片元接收, 但 `FRAG_SRC` (`shaders.ts:104-111`) 从不读 → 死 varying.
- AC-13 原文 (story L59): "fragment shader 在 selected 时 luma 档提升" — 实现既不在 fragment shader, `a_selected` 也恒 0.

**根因张力:** AC-13 措辞要求 "fragment shader", 但 luma 档 = atlas band 选择, 而 atlas UV 在**顶点**着色器计算 (`shaders.ts:73`), fragment 无法改采样 band. 所以 "fragment shader 提升 luma" 在 GPU 架构上不可能 (除非把 luma bump 做成 fragment 内 palette/color 调制, 但那不是 "luma 档"). AC-13 措辞本身需修正.

**推荐方案 a (接入 A2 路径, 让 AC-13 名实相符):**

Step-by-step:

1. `elements.ts:pushChar` — 加 `selected: boolean` 形参, 写入 `RenderInstance.selected` (当前硬编码 `false`).
2. `stockToInstances` / `cloudToInstances` — 移除 `baseLuma = selected ? 1 : 0` 的 CPU 抬升; `lumaIdx` 固定 0 (base), 把 `selected` 透传给 `pushChar`, 由 shader `a_selected` 在顶点抬 `effectiveLuma`.
   - 即 `pushChar(out, ch, x, y, colorIdx, 0, entityType, selected)`.
3. `shaders.ts` — 删 `v_selected` (顶点 out + 片元 in 两处): luma bump 已在顶点 `effectiveLuma` 完成, 片元无需该 varying.
4. `renderer.ts:render()` + `setInstance` — `selectedBuf` 写入处从 `RenderInstance.selected` 取真值 (当前写 false).
5. 测试:
   - `elements.test.ts:198-209` 当前断言 "selected always false" — 改为: 选中 stock 的 instances `selected:true`, 未选中 `false`.
   - `shaders.test.ts:86-88` — 改为 `expect(FRAG_SRC).not.toContain("v_selected")` (防死 varying 回潮).
6. AC-13 措辞修正 — 在 story 文件 `## Dev Notes` 或 `epics.md` 备注: "selected luma 档提升经 vertex shader 选 atlas band 实现 (UV 在顶点计算, fragment 无法改采样 band); AC-13 'fragment shader' 措辞修正为 'vertex shader'."

**替代方案 b (保守, 移除死脚手架):** 保留 `RenderInstance.selected` 字段 (AC-13 要求), 但删 `a_selected` attrib + `selectedBuf` + `v_selected`, 文档化 "选中辉光经 CPU lumaIdx 抬升". 缺点: AC-13 GPU 路径完全未实现, 需 story 接受偏离.

**推荐:** 方案 a. 让 A2 设计意图落地, AC-13 名实相符 (措辞修正后). 工作量 ~1-2h.

**执行结果 (CR 阶段已实施 — 方案 a, 全绿):**

1. `elements.ts` — `pushChar`/`pushString` 增 `selected: boolean` 形参 (写入 `RenderInstance.selected`, 不再硬编码 `false`); `stockToInstances` 删 `baseLuma = selected ? 1 : 0` CPU 抬升, `lumaIdx` 恒 0 base, `selected` 透传 pushChar; `cloudToInstances` 增 `selected = false` 形参 (修 cloud 选中无辉光 bug) 透传 pushChar.
2. `shaders.ts` — 删死 `v_selected` varying 三处 (vertex `flat out int v_selected;` + 赋值 `v_selected = a_selected;` + fragment `flat in int v_selected;`). `a_selected` attrib 保留 (顶点 `effectiveLuma = a_lumaIdx + a_selected` 仍用).
3. `renderer.ts` — **无改** (已正确: `render()` `ss[i] = it.selected ? 1 : 0` + `setInstance` `scratchSelected[index] = partial.selected ? 1 : 0`).
4. `CanvasView.tsx` — `buildInstancesFromStore` cloud 分支 `cloudToInstances(el)` → `cloudToInstances(el, el.id === selectedId)` (stock 分支已正确).
5. 测试:
   - `elements.test.ts` — stock "selected" 测试改为契约断言 (未选中 `selected:false`/`lumaIdx:0`; 选中 `selected:true`/`lumaIdx:0` base, shader 抬); cloud 测试增 `cloudToInstances(cloud, true)` → `selected:true`/`lumaIdx:0` 断言.
   - `shaders.test.ts` — 两 `v_selected` 测试合并为回归守卫 `expect(VERT_SRC).not.toContain("v_selected")` + `expect(FRAG_SRC).not.toContain("v_selected")` (防死 varying 回潮).
6. AC-13 措辞修正 — story 文件 7 处 (AC-13 定义 L59 / Task 3.1 L86 / Task 4.1 L92 / Task 7.3 L107 / CAP-11 Dev Notes L126 / A2 落点 L164 / AC mirror L266) "fragment shader ... luma 档提升" / "lumaIdx 按 selected 提档" → "vertex shader `effectiveLuma = a_lumaIdx + a_selected` 选更亮 atlas band"; 新增 Dev Notes M1 备注 (L129) 记 UV 在顶点计算、fragment 无法改采样 band、`v_selected` 已删、CPU 不 bump `lumaIdx`.

验证: `npx tsc --noEmit` 零错; `npx vitest run` → 11 files / 167 tests passed (M1 改动后 test count 由 168 → 167: 两 `v_selected` 测试合并为 1 回归守卫, 净 -1); `npx playwright test e2e/stock-render.spec.ts e2e/cloud-render.spec.ts` → 6 passed (smoke PASS + AC-4/AC-6 `.fail` expected-fail 仍如期, cloud 渲染不受影响).

红线核查: CAP-11 (无新 `.shadowBlur =` 站点) / PALETTE_SIZE 单源 (`shaders.ts:16` 仍 8, GLSL `${PALETTE_SIZE}`) / F1-quality 常量 (`GLOW_PAD=16` / `LUMA_BLUR_PX=[0,4,8,14]` / `GLOW_PASSES=3` 未动) / spec=epic (epics.md 无 AC-13 措辞, story 文件为权威, 已修正) 全清.

---

### M2 — A1 `setInstance` 未用 + 未测, AC-14 "避免 O(n)" 未达

**现状:**

- `renderer.ts:451` `setInstance(index, partial)` 已定义 (逐实例 `bufferSubData`).
- 拖拽热路径 (`CanvasView.tsx:525-538`) 走 `updateElement` → store subscribe → `buildInstancesFromStore` 全量重建 → `render()` 全量上传, 从未调 `setInstance`.
- `renderer.test.ts` 无 `setInstance` 测试 (grep 确认).
- AC-14 (story L61): "仅对该 instance 的 buffer 子区间做 bufferSubData 定点上传, 避免每帧 O(n) 全量重建" — 未达.

**推荐方案 (分两步: 必做单测 + 拖拽接入排 1a.4):**

**Step 1 (必做, 30min) — 补 setInstance 单元测试:**

1. `renderer.test.ts` 增 describe "setInstance — per-instance bufferSubData (AC-14)":
   - mock `gl.bufferSubData` ( spy ).
   - `setInstance(5, {worldX: 10})` → 断言仅 worldX buffer 在 offset=`5*stride` 调 `bufferSubData`, 其他 buffer 未调.
   - `setInstance(5, {entityType: 1})` → 断言不调任何 `bufferSubData` (CPU-only 字段, 注释 `renderer.ts:494`).
   - `setInstance(5, {selected: true})` → 断言 selectedBuf 在 offset=5 处上传 true.

**Step 2 (排 1a.4, 拖拽热路径接入) — 推迟到 1a.4 collab 重构:**

1. 建 instance index 映射: `elementId → [startIndex, count]` (每元素的实例区间), 存入 `instancesRef` 并行结构. 增删元素时 invalidate.
2. `CanvasView.tsx:525-538` 拖拽分支改造:
   - `updateElement(id, {x,y})` 仍更新 store (数据源一致).
   - subscribe 回调区分 "结构变更" (增删 → 全量 rebuild) vs "位移变更" (仅 x/y → `setInstance` 逐实例更新 worldX/worldY).
   - 或: pointermove 直接 `setInstance` (不经 store subscribe → draw 链), pointerup 才 `updateElement` 落 store.
3. `setInstance` 契约完善: 拖拽只需 worldX/worldY → 仅上传这俩 buffer 的该实例子区间.
4. 消双绘制 (配合 L8): 移除 movePan 末尾 `drawRef.current()` (subscribe 回调已绘制), 或 subscribe 回调改 rAF 合并.

**为何排 1a.4:** 1a.4 引入 Y.Doc collab, store/subscribe 必重构. 此时接入 setInstance 更自然, 避免在 1a.3 的单人社 store 上做一次、1a.4 再改一次的重复功.

**风险:** instance index 映射在增删后移位需 invalidate; "位移 vs 结构" 区分增加 subscribe 复杂度.

**推荐:** Step 1 本 story 补 (契约护栏, 防回归); Step 2 排 1a.4 collab 重构时一并. 若 1a.4 不近期启动, 则本 story 做最小接入 (仅 worldX/worldY 路径).

**执行结果 (CR 阶段已实施 — Step 1, 全绿):**

用户裁定方案 A (Step1 now + Step2→1a.4). Step 1 已实施:

1. `renderer.test.ts` — 新增 `makeMockGL()` (stub WebGL2: 显式列出 setInstance/构造器断言所需的 create*/bind/buffer/attrib/tex/uniform 方法为 `vi.fn()`, `create*` 返 distinct 对象供 buffer 身份断言, `getShaderParameter`/`getProgramParameter` 返 true 使构造器通过; 未列出的方法经 `Proxy` get 陷阱兜底为共享 no-op `vi.fn()` 避免构造器 GL 重设置撞 "is not a function"; 真实 WebGL2 数值常量如 `ARRAY_BUFFER=34962` 保留供 setInstance 读取) + `makeRenderer()` (`vi.spyOn(canvas,"getContext").mockReturnValue(gl)` 构造真 VRAMRenderer, 从 `createBuffer.mock.results[0..4]` 按序捕获 5 buffer [glyphLuma, worldPos, colorIdx, rotation, selected]).
2. 新增 describe "setInstance — per-instance bufferSubData (AC-14)" 4 例:
   - `setInstance(5, {worldX:10})` → 仅 1 次 `bufferSubData`, offset=`5*8` (Float32×2), 唯一 `bindBuffer` 落 worldPosBuf, data `Float32Array([10,0])` (worldY scratch 零初始化).
   - `setInstance(5, {entityType:1})` → 零 `bufferSubData` 零 `bindBuffer` (CPU-only 字段, 注释 `renderer.ts:494` 契约).
   - `setInstance(5, {selected:true})` → 1 次 `bufferSubData`, offset=`5*4` (Int32×1), bound selectedBuf, data `Int32Array([1])` (true→1).
   - `setInstance(3, {worldX:7, colorIdx:2})` → 2 次 `bufferSubData` (offset 3*8 然后 3*4), `bindBuffer` nth 1=worldPos nth 2=colorIdx (两 distinct buffer).
3. 构造后用 `gl.bindBuffer.mockClear()` + `gl.bufferSubData.mockClear()` (非 `clearAllMocks`, 保留捕获的 buffer results) 清构造期 call history 再断言.

验证: `npx tsc --noEmit` 零错; `npx vitest run src/lib/render/vram/renderer.test.ts` → 19 passed (原 15 + 新 4); `npm test` 全量 → 11 files / 171 tests passed (M1 后 167 + M2 Step1 +4 = 171).

红线核查: CAP-11 (单测不引入 `.shadowBlur`) / PALETTE_SIZE 单源 (单测用 `PALETTE_SIZE` import, 无硬编码 8) / F1-quality 常量 (未动) / spec=epic 全清.

**Step 2 (排 1a.4):** 拖拽热路径接入 (instance index 映射 elementId→[start,count] + subscribe 结构 vs 位移拆分) 不在本 story. 见上 "Step 2" 段与 L8 双绘制一并消.

---

### M6 — e2e "视觉门" 不验证 glyph 内容

**现状:**

- `e2e/stock-render.spec.ts` + `e2e/cloud-render.spec.ts` 仅断言 canvas 挂载 + 非零尺寸 + screenshot length>100.
- 不读像素, 不校验 glyph 实际画出 → M5 不对称云朵 (已修)、M4 破碎方框 (已修) 都无法被这层门拦住. "视觉门" 名不副实.

**执行结果 (CR 阶段已实施 — 重大发现, 非 brittle):**

readPixels 已试 — 结论颠覆原"降级"前提:

- **readPixels 本身可用**: 红色清屏探针 (clearColor→clear→readPixels 1px, 同一同步 evaluate 内) 读回 `[255,0,0,255]` → SwiftShader headless 下 WebGL2 readPixels 完全可用. 原"SwiftShader readPixels 不稳"前提被证伪.
- **但 app 渲染全 0**: `__gl` canvas readPixels 全零 (`nonBg=0`), 而 2D surface canvas 满像素 (`nonBg=921600`).
- **诊断排除 7+ 候因 (均不成立):**
  - 实例非空: `n=199` (3 stock × ~70 glyph).
  - atlas ready + 有内容: baked canvas `nonBg=230533 / 944640` (~24%).
  - palette 有效: `readPalette()` 兜底 `DEFAULT_PALETTE` (compile-time hex), 永不全零.
  - 几何在屏内: stock 网格坐标 (-8…5)×(-6…3) 经 `worldToScreenAffine`(zoom=1) + `screenAffineToClipMat3` → clip ~[-0.013, 0.008] (NDC 内).
  - 无 GL 错: `glError=0`, `glProgram` 已绑定 (renderer 创建未走 catch, console 无 warn/error).
  - `preserveDrawingBuffer:true` (`renderer.ts:198`) — backbuffer 持久.
  - `VERTS_PER_INSTANCE=6`, shader 源审查无误 (quad 生成 + u_proj 变换 + atlas 采样 + additive blend).
- **根因隔离**: 通过临时 GL introspection e2e (`e2e/m6-diag.spec.ts`, 已删) 对当前绑定 program/VAO/attrib/uniform/atlas 做帧内探查, 并在同一 evaluate 内以递增 zoom 重跑 `drawArraysInstanced` + `readPixels`, 得到 zoom sweep:
  - `zoom1x`: 0 non-bg px
  - `zoom2x`: 510
  - `zoom4x`: 1,254
  - `zoom8x`: 4,565
  - `zoom16x`: 18,464
  - `zoom24x`: 45,538
  - `zoom32x`: 79,358
  - 证明管线、atlas、uniform、实例数据均正常; 全 0 纯粹是因为集成 CanvasView 默认 `camRef.zoom = 1`, 而 VRAM glyph quad 的世界尺寸为 `CELL_W/GLYPH_W ≈ 4.56` × `CELL_H/GLYPH_H = 3` 世界单位. camera 语义下 `zoom = screen px / world unit`, 因此 zoom=1 时 glyph 在屏上只有约 4.56×3 px, 实际笔划 ~1 px; SwiftShader headless 光栅化后没有 fragment 存活. 隔离的 `/vram` harness 使用 `zoom=24` (cell 宽约 24 px), 所以能正常渲染; 这是两者唯一的实质差异.
- **修复**:
  - `src/lib/render/CanvasView.tsx`: `camRef` 默认值从 `{x:0, y:0, zoom:1}` 改为 `{x:0, y:0, zoom:16}`, 并加注释说明 zoom 必须提供可读 cell size (≥~16 px), 否则 SwiftShader headless 会 rasterize 为 0.
  - `e2e/stock-render.spec.ts`: 移除 AC-4/AC-6 真实断言的 `test.fail` 包装, 更新 M6 注释为 "已修复"; `waitForRenderReady` 增加 `canvas.ns-canvas__gl` 非零尺寸等待, 避免 canvas 尚未 mount 时读像素.
  - `src/lib/render/CanvasView.test.tsx`: 更新 6 处因默认 zoom 改变而失效的断言/坐标 (HUD 100% → 1600%, 交互测试屏幕坐标按 zoom=16 重新计算).
- **验证**:
  - `npx tsc --noEmit` 零错.
  - `npm test` → 11 files / 171 tests passed.
  - `npx playwright test e2e/stock-render.spec.ts` → 4 passed (含 AC-4/AC-6 非空 readPixels 断言).
- **回归测试**: AC-4/AC-6 readPixels 非空断言已转正, 任何让 glyph 再次不可见的改动 (如默认 zoom 回退、camera 语义变更) 会直接失败.

**cloud-render.spec.ts**: **已 M6 同构修复** (smoke + AC-10 readPixels 真断言转正, 3 passed, 无需 `test.fail` — zoom=16 一并修绿 cloud; 见末尾 裁定请求段).

**M6 状态**: 已修复、已验证、已回归测试. 不再升级裁定.

---

## Low 排期 (除 L3 外)

| ID  | 文件:行                                      | 问题                                                                                    | 排期                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 工作量                  |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| L1  | `camera.ts:snapToGrid`                       | NaN/Infinity step 直通返回 NaN (NaN<=0 为 false)                                        | 1a.4 起手顺手                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 10min                   |
| L2  | `camera.ts:shouldSnap`                       | zoom=0 → tolPx/zoom=Infinity → 恒吸附 (benign, zoom 已 clamp [0.05,20])                 | 1a.4 起手顺手                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 5min                    |
| L4  | `CanvasView.tsx:458/461/535` + `store.ts:51` | unsafe cast 绕判别联合; `Partial<SDElement>` 签名对 kind 专属字段 (x/y/name) 无效       | 1a.4 store 重构时                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 30min                   |
| L5  | `CanvasView.tsx:156`                         | `seedSampleStocks()` 模块导入副作用 (import 即污染 store)                               | 1a.4 store 重构时迁入 useEffect                                                                                                                                                                                                                                                                                                                                                                                                                                     | 15min                   |
| L6  | `elements.ts` + `renderer.ts:494`            | rotation/entityType/zOrder GPU 路径死 (A2/A1 脚手架)                                    | 立即标 TODO 注释; 接入随 M2 Step 2                                                                                                                                                                                                                                                                                                                                                                                                                                  | 注释 5min               |
| L7  | `store.ts:82/95`                             | `crypto.randomUUID` secure-context 依赖无 fallback (非 HTTPS/非 localhost 抛 TypeError) | 任何非 localhost 部署前必修（含 staging；staging 可能早于 4.x，提前自 4.x）                                                                                                                                                                                                                                                                                                                                                                                         | 10min                   |
| L8  | `CanvasView.tsx:525-538`                     | 拖拽 per-pointermove 双绘制 (updateElement→subscribe→draw 后又 draw)                    | 随 M2 Step 2 一并消                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 0 (M2 含)               |
| L9  | epic (Story 1a.3 交互段)                     | "调整大小" (resize) 交互未实现                                                          | 先调 epic 确认是否 1a.3 必交付; defer 则 story `## Deferred` 标注目标 story → **已实现 (CR followup)**: `elements.ts:resizeStock` 纯函数 (4 角 + clamp≥3 + 对角固定) + `CanvasView` pointerDown handle hit-test (selected stock, screen-space 12px 命中区) + movePan resize 分支 (snap + clamp) + endPan 清除 + hover cursor (nwse/nesw) + draw 4 handle (fillRect/strokeRect, CAP-11); 测试 elements.test.ts +8 + CanvasView.test.tsx +4 全绿 → **blocker 已解除** | 调研 15min + 实现 60min |

**排期原则:**

- L1/L2/L6 注释: 1a.4 起手顺手清 (camera.ts 守卫 + 脚手架 TODO 注释). L6 注释可立即打 (5min, 不改逻辑).
- L4/L5: 1a.4 引入 Y.Doc collab 时 store/CanvasView 必重构, 一并清 (避免 1a.3 单人 store 改一次、1a.4 再改一次).
- L7: **任何非 localhost 部署前**必修（含 staging；staging 可能早于 4.x，提前自 4.x）。secure-context 真实场景才触发；本地 dev 无碍。
- L8: 随 M2 Step 2 拖拽接入 setInstance 一并消 (同文件同路径).
- L9: **已实现 (CR followup)** — epic (`epics.md` L366) 明确 resize 在 1a.3 AC-7 范围; 原 story Task 7.1 标 [x] 但代码未实现, 现已补全: `elements.ts:resizeStock` 纯函数 (4 角 handle + 对角固定 + clamp≥3) + `CanvasView` pointerDown handle hit-test (selected stock, screen-space 12px 命中区, 须先于 findElementAt) + movePan resize 分支 (snap + clamp) + endPan 清除 + hover cursor (nwse/nesw) + draw 4 handle (fillRect/strokeRect, CAP-11 safe). 测试: `elements.test.ts` +8 例 (4 角 + clamp + 对角不变) + `CanvasView.test.tsx` +4 例 (SE 增大 / NW 移动+缩放 / clamp≥3 / cloud 不可 resize) 全绿. **blocker 已解除**.

---

## 裁定请求

- M1: **已实施 (方案 a + AC-13 措辞修正, 全绿)**. 详见上 "执行结果". 红线核查全清.
- M2: **Step 1 已实施并验证 (方案 A, 全绿)** — setInstance 4 例单测作 AC-14 契约护栏. Step 2 (拖拽接入) 排 1a.4 collab 重构 (与 L8 双绘制一并消).
- M6: **已根因隔离并修复** (默认 zoom=1 → zoom=16; AC-4/AC-6 readPixels 断言转正并 PASS). 无需升级裁定.
- L6: **已打且已补全** (renderer.ts:32/38/44/342 A1/A2 脚手架 TODO + elements.ts:pushChar 补全; 不改逻辑). 其余 Low 按 1a.4/4.x 排期.
- cloud-render.spec.ts: **已 M6 同构修复** (smoke + AC-10 readPixels 真断言转正, 3 passed, 无需 `test.fail` — zoom=16 一并修绿 cloud).
- **#2 合并时机: 推荐合并 (L9 blocker 已解除)**. 全绿验证通过 (`npx tsc --noEmit` 0 错 / `npm test` 11 files **183 passed** / `npx playwright test e2e/stock-render.spec.ts e2e/cloud-render.spec.ts` stock 4 + cloud 3 = **7 passed**). L9 已实现 (CR followup): epic (`epics.md` L366) 明确 "调整大小" 在 Story 1a.3 AC-7 范围 → 现已补全 `elements.ts:resizeStock` 纯函数 + `CanvasView` 4 角 handle hit-test + 拖拽改 w/h (套 `snapToGrid`/`shouldSnap` AC-1/2/3 + `validateStockSize` ≥3 clamp AC-8/9) + cursor 反馈 + 视觉 handle (CAP-11 fillRect/strokeRect); cloud 固定 6×3 不可 resize (AC-12). 测试: `elements.test.ts` +8 + `CanvasView.test.tsx` +4 全绿. **合并就绪**: 全部 CR findings (M1/M2/M3/M4/M5/M6/cloud-render/L6/L9) 已修复并验证, 待用户明示后即可 `gh pr merge 25 --squash --delete-branch`.
