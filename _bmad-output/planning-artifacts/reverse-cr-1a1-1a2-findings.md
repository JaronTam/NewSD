# 逆向 Code Review 综合报告 — Story 1a.1/1a.2 已合并码

> **产物性质**:Story 1a.2 闭合后,对 1a.1/1a.2 已合并码做**只读逆向 CR**,聚焦 Story 1a.3+ 依赖的契约面。
> **范围**:camera 数学 / VRAMRenderer+instance 契约 / palette 单源 + CAP-11/AD-9 / 测试盲区。视觉质量面已在 F1-quality spike 评审闭合,不在本次范围。
> **方式**:4 面分 CR(方案乙),本表为去重 + 重分类后的综合(原始 4 面 findings ~37 条)。
> **审计**:综合报告经 `/audit` 无状态判定器核查,结论 UNCERTAIN(仅 A4 "散落 4 处" 计数不准,已修正;4 项载重事实核查通过)。
> **A3 落地**:本文档产出后,A3 守卫(structural grep + runtime spy)已在本 PR 同步落地。

---

## A. 真契约债(1a.1/1a.2 遗留,1a.3 动工前 / 首片应处理)

| #   | 来源 | finding                                                                                                                                                                                           | 1a.3 影响                                                                                           |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1  | ②C1  | VRAMRenderer 无 per-instance mutation API,`render()` 全量替换每帧重建 GL buffer                                                                                                                   | 动态增删图元每帧全量重上传                                                                          |
| A2  | ②C2  | `RenderInstance` 仅 5 字段(`glyphIdx`/`lumaIdx`/`colorIdx`/`worldX`/`worldY`),缺 `entityType`/`zOrder`/`rotation`/`selected`                                                                      | 扩字段 = breaking change 触 shader + vertexAttrib + buildBootInstances                              |
| A3  | ③C1  | **无运行时 shadowBlur 守卫测试** — AD-9/CAP-11 全靠 review 纪律                                                                                                                                   | 未来 PR 在 2D canvas 运行时路径加 shadowBlur 会全部测试过 → **本 PR 已落地守卫**                    |
| A4  | ③C2  | GLSL 字面量 `uniform vec4 u_palette[8]`(`shaders.ts:72`)与 `PALETTE_SIZE=8` const(`shaders.ts:96`)**双源硬编码** — const 未驱动 GLSL 数组尺寸;`renderer.ts` 4 处引用已正确经 const 传播(非字面量) | 加色须改 2 源码字面量 + 同步 3 测试断言(`palette.test.ts:39` / `shaders.test.ts:47,60`),共 5 必改点 |

### A4 修正方案(源自审计核查)

审计揭示 A4 的真契约债**不是**"散落多处",而是 **GLSL 数组尺寸字面量未由 `PALETTE_SIZE` const 驱动** — const 虽导出但 GLSL `u_palette[8]` 是字符串字面量,二者无模板关联。零代码加色的最小修法:

- **方案**:GLSL 源以 `u_palette[${PALETTE_SIZE}]` 模板插值,const 单点改 → GLSL 自动跟随;测试断言改用 `PALETTE_SIZE` 变量而非字面量 `8`
- **落地后**:加色 = 改 `PALETTE_SIZE` const 一处,源码 + 测试均零改

---

## B. 契约 major(1a.3 实现期会撞,可 backlog)

- B1 [②M3] `render()` 混合 upload+draw,无"仅相机变时跳上传"
- B2 [②M4] 无 frustum culling,大网格全量绘制
- B3 [②M5] shader 无 per-instance entity-type 通路(source-sink 脉冲 / 箭头无处实现)
- B4 [③M1=④M6] `readPalette()` 部分 token fallback 无 DEV warn

---

## C. 测试基建债(1a.3 需补)

- C1 [④C1] **`drawGrid()` 零单测** — 网格是 1a.3 吸附视觉锚点,有 off-by-one 风险(经 grep 守卫确认:`drawGrid|readTokens` 在 `*.test.*` 零匹配)
- C2 [④C2] **`readTokens()` 零单测** — 输出 cellW/cellH 喂给 drawGrid
- C3 [④C4] **无 Playwright/e2e 基建** — WebGL2 渲染通路完全无自动化回归,只靠 dev 手动视觉 gate(经核查 `package.json` 无 `playwright`/`@playwright/test` dep,全局无 `playwright.config.*`)
- C4 [④M1-M3] renderer `reallocBuffers` / `atlasReady=false` / 零实例路径未测(均需 Playwright,jsdom 无 WebGL2)
- C5 [④M4] CanvasView resize 路径未测(测试用 1×1 视口)
- C6 [①+④M7] camera 极端 zoom(0.05/20)可逆性 + `WORLD_CLAMP=1e15` 精度未测(`1e15/0.05=2e16 > 2^53≈9.007e15`,超 Float64 精确整数范围)
- C7 [④M5] `zoomAt` 退化视口(0,0)未测

---

## D. 预期工作(非缺陷,1a.3 本就要做)

- D1 [④C3] `gridSnap`/`snapToGrid` 未实现 — 1a.3 核心交付(FR-CANVAS-2 snapTolerance=8/zoom),从零写

---

## E. minor(清理,backlog)

- ② resize 双调 / `atlasDims` 每帧重算
- ③ `buildBootInstances` 硬编码 `colorIdx` / `readTokens` 静默 fallback
- ④ `dispose()` 未测 / `charToGlyphIdx` -1 钳位未测 / shader 编译未测 / F4F5 键盘快捷键未测

---

## 跨面主题

1. **VRAMRenderer 契约为 boot demo 设计**(A1+A2+B1+B2+B3)— 最重契约债,1a.3 真实图元需扩契约
2. **AD-9/CAP-11 无机器守卫**(A3)— invariant 全靠人眼 review → **本 PR 已补机器守卫**
3. **Playwright 基建缺**(C3+C4)— WebGL2 渲染路径零自动化回归
4. **CanvasView 核心零单测**(C1+C2+C5)— drawGrid/readTokens/resize 是 1a.3 视觉锚点却无测试

---

## 已验证为正确(无 finding)

- ② `dispose()` GL 清理无泄漏 ✅
- ③ AD-9 双缓冲保持 / `hexToRGBA` fallback / SSR 退化 / `glowAtlas.test.ts` 常量锁(GLOW_PAD=16 / LUMA_BLUR_PX=[0,4,8,14] / GLOW_PASSES=3)充分 ✅
- ① `screenToWorld` 签名稳定 + Camera 不可变(Float64)✅

---

## 处置建议

| 类                                                                      | 建议                           | 理由                                                             |
| ----------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| **A3**(shadowBlur 守卫)                                                 | **本 PR 已落地**               | cheap、高价值(堵 AD-9 静默违反)、独立于 1a.3                     |
| **A1/A2/A4**(RenderInstance 扩字段 + mutation API + palette templating) | fold 进 1a.3 第一个 sub-PR     | 是 1a.3 图元实现的契约基座,动工前空改不如随 1a.3 首片一起改 + 测 |
| **C3**(Playwright 基建)                                                 | 1a.3 首片前或首片内建          | 1a.3 视觉验证依赖                                                |
| **B/C1/C2/C5/C6/C7**                                                    | 进 backlog,1a.3 实现期按需消化 | 非阻塞                                                           |
| **D1**(gridSnap)                                                        | 1a.3 核心,自然交付             | 非债                                                             |
| **E**                                                                   | backlog 清理                   | 非阻塞                                                           |

---

## A3 守卫落地说明(本 PR)

双守卫,defense in depth:

1. **Structural grep guard**(`src/lib/render/cap11-shadowblur-guard.test.ts`):扫 `src/` 全部非 test `.ts/.tsx`,断言 `\.shadowBlur\s*=` 赋值仅出现在 `lib/render/vram/glowAtlas.ts`(离屏 bake 唯一允许点)。源码级,在违反进入运行时前拦截。
2. **Runtime spy**(`src/lib/render/CanvasView.test.tsx` 新 describe):override `getContext` → Proxy mock ctx(`webgl2` 返回 null → VRAMRenderer 抛 → bake 跳过 → 仅 2D draw 路径运行),断言 `ctx.shadowBlur` 永不被赋值。行为级,证明 draw 路径运行时确实不碰 shadowBlur。

二者互补:grep 守源码直接赋值,runtime spy 守行为(含间接路径)。未来 PR 若在运行时 2D 路径加 `ctx.shadowBlur =`,两个测试同时红。
