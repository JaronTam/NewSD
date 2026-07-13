# Deferred Work Log — NewSD

Generated from code reviews. Each entry records work deferred beyond the current story scope.

---

## From Story 1a.4 CR (Run 2, 2026-07-07)

| ID  | Item                                                                                                                 | Target Story                               | Rationale                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| F8  | `isVariable` UI toggle — hardcoded `false` in CanvasView endPan; no user-facing way to create variable flows         | ~~1a.8 (Property Panel)~~ ✅ resolved 1a.8 | Property editing UI deferred per spec AC-10 note ("toolbar UI defer 1a.7, property panel 1a.8")                                         |
| F10 | `formatFormulaForEditor` wiring — helper exists + tested but no src/ caller connects it to any UI                    | ~~1a.8 (Property Panel)~~ ✅ resolved 1a.8 | Display-layer wiring belongs with formula editor UI                                                                                     |
| —   | `isVariable:true` e2e testing via real UI interaction (not `window.__e2e__` hook)                                    | ~~1a.8~~ ✅ resolved 1a.8                  | Requires property panel to toggle isVariable; e2e scaffolded in e2e/property-panel.spec.ts (ATDD red-phase, needs dev server to unskip) |
| —   | Flow path visual dedup for parallel flows (AC-14 known limitation: shared fromId+toId → overlapping Manhattan paths) | TBD (post-1a.8)                            | Port staggering or path offset; spec explicitly defers as "visual polish" beyond 1a.4 core                                              |
| —   | Orphan cloud persist-time warn ("N 个孤立 cloud")                                                                    | 4.x (persist)                              | AC-13 — create-time only in 1a.4; persist-time warn deferred per spec                                                                   |
| —   | Render-side self-loop guard (currently only store-side guard in createFlow)                                          | 4.x (persist/paste)                        | Self-loop flows could arrive via persistence reload or 4.3 paste, bypassing createFlow guard                                            |
| —   | Snap tolerance at extreme zoom levels (zoom=0.05 → snapTol=160 world units)                                          | 1a.7 (toolbar/statusbar) or 1a.5           | AC-10 snap interaction; could use zoom-aware clamping                                                                                   |

### Edge Cases deferred (non-blocking)

| ID  | Condition                                                   | Consequence                     | Mitigation                                                                          |
| --- | ----------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| E1  | Zero-length flow (from-port == to-port same cell)           | Isolated arrow, wrong direction | Rare in practice; guard in createFlow could reject adjacent-element port collisions |
| E2  | Non-UUID @-ref in formula (`@Pop`)                          | Cryptic "Unknown name: @" error | Low probability; parser could emit clearer diagnostic                               |
| E3  | Cloud W/E port y-offset (half-integer → Math.round ties up) | Arrow 1 row below visual side   | Fixed by F4 (AC-9 cloud 6×3 coords)                                                 |

---

## From Story 1a.4 CR (Run 3, 2026-07-07)

8 of 12 LOW findings were patched before merge (H2, H3, H4, H6, H7, H8, H10, H12 ~75 lines net across 3 src files). 4 deferred:

| ID  | Item                                                                         | Target Story    | Rationale                                                                                |
| --- | ---------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| H1  | Corner glyph overwritten by marker when \|dx\|=1 and dy≠0 (adjacent nodes)   | TBD (post-1a.8) | Edge-case visual polish; marker-on-corner rare in practice; non-blocking                 |
| H5  | Marker overwrites visible first path cell → 1-cell visual gap                | TBD             | By-design per AC-7 spec (marker at fromPort+dir×1); defer unless user reports issue      |
| H9  | `onWarn` called after `store.setElements` — pre-add snapshot vs post-add gap | TBD             | Timing hardening; warnRef is a React ref (not state) → zero observable impact            |
| H11 | B1 fallback arrow occlusion for adjacent nodes (documented known limitation) | TBD (post-1a.8) | Adjacent-node arrow on target edge glyph; z-order fix would require architectural change |

---

## From Story 1a.5 CR (Run 1, 2026-07-08)

CR verdict FAIL -> 回 DS 续修 must+should(H1/H2/H3/H4/H6 + 2 回归测试)。LOW/Edge defer 项(见 story 文件 `Senior Developer Review (AI)` section):

| ID  | Item                                                                                                  | Target Story | Rationale                                                                              |
| --- | ----------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| H5  | dirty subscription `bboxOf` 双侧用 nextElements -> flow 端点移动不 markDirty (CanvasView.tsx:594-599) | TBD          | LOW;Branch2 全 visible rebuild 覆盖,不致 omission;dirty 优化仅影响 Branch2 redraw 范围 |
| H7  | `viewportToWorldRect` 无 zoom=0 guard (camera.ts)                                                     | TBD          | LOW;clampCamera 上游 clamp [MIN_ZOOM,MAX_ZOOM] 守卫,defense-in-depth nice-to-have      |
| H8  | `queryLowPrecision` NaN/Infinity 未守卫 (dirty-rect.ts:51-52/62)                                      | 1a.6         | LOW;1a.6 消费前修;viewportToWorldRect 在 WORLD_CLAMP=1e15 内不产 NaN                   |
| H9  | `consume()` 返 `{rects, elementIds}` 非 AC-3 spec 措辞 `rect[]` (dirty-rect.ts:31)                    | TBD          | LOW;AC-3 spec 措辞 vs 实现双字段,消费侧 CanvasView 已适配 elementIds                   |
| E1  | sync update 路径 `tree.insert` 无 degenerate skip (spatial-index.ts:142)                              | TBD          | Edge;flow 端点存在时非 degenerate;insert() L79 有 skip,sync update 路径漏              |
| E2  | `queryLowPrecision` NaN pass (dirty-rect.ts:51)                                                       | 1a.6         | Edge;同 H8                                                                             |
| E3  | dispose-stale (spatial-index.ts:152-157)                                                              | -            | **非 bug**(dispose 清 elementMap+tree + storeUnsub 正确)                               |
| E4  | `markDirty` 无 rect 校验 (dirty-rect.ts:21)                                                           | TBD          | Edge;调用侧传 getElementBounds 合法 rect                                               |
| E5  | (见 CR Run 1 Layer-2 报告)                                                                            | TBD          | Edge                                                                                   |

---

## From Story 1a.6 CR (Run 1, 2026-07-09)

CR verdict **FAIL**(F-B correctness + F-A AC-2 spec violation;patch 项 F-B/F-C/F-D/F-E/F-F 待用户裁定 apply/action-items)。defer 2 项:

| ID  | Item                                                                                                                       | Target Story | Rationale                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| F-G | minimap flow 端点移动不 markDirty(prev===el)->旧 flow 线段近未动端点不 clear->stale 残线(minimap.ts:99-109, 252-269)       | TBD          | LOW;camera 变化全量重绘(F-A)自愈;flows on minimap 稀疏细线;修需检测 flow bbox 随端点变 non-trivial |
| F-H | computeWorldBounds 非对称 clamp(max 下界 / min 上界)->元素 coord 超 WORLD_CLAMP=1e15 可 minX>maxX 反转(minimap.ts:188-193) | TBD          | LOW;元素 coord >1e15 非现实(user 不在此置图元);对称 clamp + `minX<=maxX` hardening nice-to-have    |

注:1a.5 H8/E2(queryLowPrecision NaN/Infinity 未守卫)已由本 story AC-7 闭环(dirty-rect.ts `markDirty` `Number.isFinite` + `queryLowPrecision` defensive skip + 23 测,签名不改),不再 defer。

---

## From Story 1a.7 CR (Run 1, 2026-07-10)

CR verdict **PASS**(3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents)。合并前 2 patch(F-cs-dep-mismatch 回退 @testing-library/user-event 恢复 CS「无新依赖」一致 + F-dead-css 删 ns-prompt-panel__expand)。4 minor defer 项,2026-07-10 用户裁决后处理:

| ID  | Item                                                            | 处理            | Target          | Rationale                                                                                                                                                                   |
| --- | --------------------------------------------------------------- | --------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | COLLAPSED_H(26) vs CSS(1.6rem=25.6px) 0.4px 差                  | **defer 1a.12** | 1a.12 重构      | collapsed 高度本应固定(drag floor 是 px);1a.7 本地曾修 CSS height 1.6rem->26px 对齐常量,patch 随 B3 restore 弃,1a.12 收起态胶囊重做时重实现                                 |
| D2  | testid-dup:展开态多未答 confirm 时 ns-prompt-panel-confirm 重复 | **accept**      | TBD(1a.12 重构) | 多未答 confirm 仅连点新建(异常操作)触发;正常单 confirm 无冲突;querySelector 取首个功能正确,不修                                                                             |
| D3  | trim-cap:100 条全未答 confirm 时 trim 无法丢,超 MAX_MESSAGES    | **accept**      | TBD             | 决策约束(未答 confirm 不推进业务下一步=清空)使 confirm 不堆积至 100;trim 跳过未答 confirm 防 awaiter 永挂的保护正确,不修                                                    |
| D4  | autoscroll:展开态新消息不自动滚底                               | **defer 1a.12** | 1a.12 重构      | stick-to-bottom(chat/终端惯例):已在底部才自动滚,用户上滚时不抢回;1a.7 本地曾修 useEffect + scrollTop 检测(24px 阈值)+ 2 测试,patch 随 B3 restore 弃,1a.12 list 重构时重实现 |

注:D1/D4 用户裁决 B3(2026-07-12):1a.7 本地 patch 随 restore 弃,defer Story 1a.12(PromptPanel 四 tab 重构)重实现(1a.8 只动属性面板不碰 PromptPanel,故非 1a.8);D2/D3 accept 不修。CR 报告门控 retrospect:1a.7 CR 跑完直接 patch+合并未先报告,已立 memory newsd-cr-report-before-execute-gate 防复发;4 defer 项本次补作决策项报告。

---

## From Story 1a.8 CR (Run 1, 2026-07-13)

CR verdict **PASS**(3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents; F-1/F-2 patched, 2 advisory A1/A2 accept non-blocking). 4 defer 项(3 scope + 1 epic gap 归 1b):

| ID  | Item                                                                         | Target Story            | Rationale                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Q1 名称化编辑(显示名称 + 编辑 + name->@uuid 反向映射 + autocomplete)         | 1a.12                   | 依赖 1a.11 唯一名称; 1a.11 前名称可重名反向不可靠; 1a.8 存储形编辑 + 显示形预览双层模型满足 epic AC(§3.6, VS Q1 裁定 SOUND)                                                                                                                                                                                                                                                                               |
| D2  | dimensionalCheck 量纲推导逻辑                                                | 1b (Wasm kernel)        | 1a.8 交付 stub 入口 + 触发(AC-11/12, PropertyPanel.tsx L149 调用 checkDimensions); 推导逻辑 FR-SIM-7 在 1b Wasm kernel(prd L351/L544, ARCHITECTURE-SPINE L371)                                                                                                                                                                                                                                            |
| D3  | container tab-ify / 新 tab / 错误二分归宿                                    | 1a.12                   | epic L523 scope 明示 defer; 1a.8 容器为右侧固定宽列基座, 1a.12 演进不推翻(§3.1/§3.4)                                                                                                                                                                                                                                                                                                                      |
| D4  | e2e canvas-click 基础设施(DOM overlay 层 / spec 重写用坐标 click + 像素断言) | 1b(具体 story 待 1b CS) | property-panel.spec.ts selector 假设 DOM overlay(`ns-canvas-element-{name}` click + `ns-canvas-flow-{name}-variable-marker` 断言), CanvasView 纯 WebGL canvas 渲染 mismatch(stock/flow/▼○ 画在 canvas 像素 elements.ts L538-549 非 DOM); green-phase 需 DOM overlay 层或 spec 重写, 2026-07-13 裁定归属 1b(1b e2e 集成 story 补, 具体 story 待 1b CS); 1a.8 unit 覆盖 AC-8 核心, e2e 整体 defer(B accept) |

注:F-1(Dev Log T4 声明 deriveFlowUnits vs 代码 L203 实读 selectedElement.units, 声明↔代码不一致)/ F-2(L878 hollow + 无跨图元切换测试)已 patched(L203 改 deriveFlowUnits + L216 key={selectedElement.id} remount + L896 跨图元测试), 非 defer. A1(checkDimensions 1 参数 vs T7.1 3 参数, stub 简化)/ A2(AC-11 测试存在性断言缺 before 三元组)advisory accept non-blocking. e2e canvas-click 基础设施(D4)非 1a.8 scope 缺失, 是 epic 级规划 gap(epic 未规划 canvas-click 基础设施归属 story + AC-8 e2e 门槛无实现路径)+ ATDD scaffold 执行缺陷(selector 未核 WebGL canvas 架构); 1a.8 unit 覆盖 AC-8 真实 UI 交互核心, e2e defer 待 1b e2e 集成解决(2026-07-13 裁定归属 1b, 补 epic 规划 gap).
