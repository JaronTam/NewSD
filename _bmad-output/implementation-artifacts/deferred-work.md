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

---

## From Story 1a.11 CR (Run 1, 2026-07-16)

CR verdict **PASS**(3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents; 12→7 root cause 合并; A+X 裁定 4 patch + 1 dropped + 7 defer)。patch: F-1 nextDefaultName skip-forward(SDR#14 + AC-18 2 测) + F-2 updateElement typeof guard(AC-19 3 测) + F-3 standalone createFlow JSDoc rewire + F-4 PropertyPanel `?? ""` removal(SDR#5 name:string invariant)。dropped: F-7(flowCreateWarning `names.join(", ")` 合法, parallel 记录展示)。defer 7 项:

| ID   | Item                                                                                                                                 | Target Story     | Rationale                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F-5  | ATDD scaffold e2e AC-3 (setElements + createStock 混合场景 seq 承接) 未覆盖                                                          | 1a.12 或 1b      | LOW; 已由 unit test suite (T2/T5) 覆盖 A2 hydrate + skip-forward 语义; e2e 层重复; 1a.12 名称化编辑落地时同步补 e2e                    |
| F-6  | validate.ts 空文件 (SDR#8 校验函数 stub)                                                                                             | 1a.12            | LOW; 1a.11 契约验证由 assertNameAvailable 内联担当 (store.ts:163); validate.ts 作为独立模块 1a.12 名称化 autocomplete 需反向映射时启用 |
| F-8  | deriveSeq 非规范名 (含 `_00`, `_-1`, `_1.5`) silent skip 无诊断                                                                      | TBD (post-1a.12) | LOW; A2 SDR#13 定义正则边界; 非规范名不 corrupt seq; 诊断增强 nice-to-have                                                             |
| F-9  | createStock/Cloud/Flow explicit name 未校验空白字符仅 leading/trailing (SDR#11 spec `name.trim()` 边界)                              | TBD              | LOW; assertNameAvailable 已用 `!name.trim()` 拒空/纯空白 (store.ts:164-166); 边界 `" x "` 保留原样合规 SDR#11 (trim 仅校验非改写)      |
| F-10 | flowCreateWarning parallel names 顺序未 sort (map 插入序)                                                                            | TBD              | LOW; 展示层稳定 (elements 数组插入序 = 用户可见操作序); sort 变会破坏跨调用一致性                                                      |
| F-11 | AC-14 SDR#13 正则 `/^\d+$/` 与 A2 「非规范名 silent skip」交互未 e2e 端到端 (setElements → 混合合法/非法名 → 后续 create → seq 承接) | 1a.12 或 1b      | LOW; unit test 覆盖 setElements + 后续 create 承接 (T2 A2); e2e 层重复                                                                 |
| F-12 | Cloud 1a.11 rewire 前 optional name 遗留数据 setElements 时无 diagnose (SDR#5 name:string invariant 假设 A2 输入合规)                | 4.x (persist)    | LOW; 1a.11 前无 persist story; 4.x persist 落地时 hydrate 层加 diagnose + 补 name; 1a.11 内 in-memory createCloud 100% name:string     |

---

## From Story 1a.12 CR (Run 1, 2026-07-16)

CR Run 1 进行中 (3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents). 已 patch: F-1 AlertTab resolved-confirm (HIGH) + F-3 pulse rename (SDR#10 命名对齐). B 裁定 defer (AC-17 overlay 定位 cluster, 用户 2026-07-16 拍板):

| ID       | Item                                                                                                                                                                                                            | Target Story           | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-2      | ghost AC-17(b) 主体已删高亮 (tombstone + ghostShadowPos + .ns-canvas__ghost-shadow) + overlay 定位机制 (world->screen + camera 同步) + AC-17(a) pulse overlay 定位 + CSS animation + load 场景 tombstone 持久化 | 4.2 (dangling-formula) | AC-17(b) ghost 在当前 errorDetection 契约不可达 (3 检测器 subjectId 皆现存元素, 已删元素不在 elements 数组不被遍历; onErrorClick 仅传 subjectId 无 type/finding); overlay 定位机制缺失 (pulse 空 div CanvasView:1548 无 style, camera camRef.current 命令式不 re-render, worldToScreen 仅 draw loop); A 完整实现代价 = overlay 定位硬投入 + tombstone load 无效 (1a-13 后暴露, setElements 清 tombstone) + 5 接口签名 + store schema + 连带 F-9 回归面; B 聚合 4.2 (overlay 定位 + 持久化 + ghost + load 一体设计), 1a-13 解耦不碰 ghost; dangling-formula (4.2) 是真"主体已删"归属; AC-17(a)(b) 守卫本次仅 DOM 存在 (hollow, CanvasView.test:2172), 定位 defer 4.2; F-3 rename 仅贴 SDR#10 命名 (pulseId->pulseHighlightId, pulse-highlight->ns-canvas__pulse-highlight), 不补 CSS 不补定位; ghostShadowPos defer 4.2 (F-6 部分) |
| F-7      | StockTab 徽章死路径 (stock 永非 detectOrphanCloud/detectDanglingFlowEndpoint/detectParallelFlow 主体 subjectId)                                                                                                 | 1b (量纲)              | 1b 量纲错误 detectDimensionalError 会以 stock.id 为 subjectId 产出真实 finding, StockTab 徽章 errorForStock 匹配生效; 1a.12 内 stock 无错误主体, 徽章死路径 (StockTab L55 find 恒 false) 无害, defer 1b 量纲落地时激活                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| F-10a11y | StatusBar 警告 popover a11y 增强 (arrow key 导航 / aria-activedescendant / Escape 关闭 / trigger aria-expanded / focus 管理)                                                                                    | TBD (post-1a.12)       | AC-16 [类型] 文案 + role=listbox/option + Enter 选择 已 patched 批1; 完整 a11y (listbox 键盘模式 + focus trap) nice-to-have defer, 非阻塞核心交互                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

CR Run 1 verdict **PASS** (2026-07-16 全裁定). 剩余 5 findings 裁定: F-4 close (toStored 边界核验正确) / F-7 defer 1b (见上表) / F-8 patched 批2 (AC-13 未读徽章) / F-9 patched 批1 (ErrorFinding type 统一) / F-10 [类型] patched 批1 + a11y defer (见上表). story ## CR Run 已回填 verdict + 验证 (tsc 0 + vitest 706 passed | 1 skipped + e2e 29 passed | 21 skipped / 50 0 fail).

---

## From Story 1a.13 CR (Run 1, 2026-07-18)

CR Run 1 (3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents). 已 patch: F-1 onBeforeUnload returnValue + F-7 flush-fail test + F-3 deriveFlowUnits 直调 + F-4 syncFlush dedupe + F-2 useIsoLayoutEffect 模块顶层 + F-8 history=[initialValue]. defer 4 项 (用户 2026-07-18 拍板):

| ID   | Item                                                                                                                             | Target Story                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-5  | flow.toId ref-integrity: restore 时 toId 指向不存在/已删 stock 的 deriveFlowUnits 行为 (悬空 flow 残留, units 返 "")             | 4.2/4.3 (dangling 机制) + 1b.6 (量纲兜底) | restore deriveFlowUnits 对悬空 toId 返 "" (flow.units 空), flow 残留无错误标记 (tombstone 未清, 1a.12 F-2 已立 tombstone 概念 target 4.2); 1a.13 仅恢复不校验引用完整性; dangling/tombstone 机制归 4.2/4.3 (epics L615 公式悬空->4.2, L1456 端点复用 4.2, 与 1a.12 F-2 target 4.2 一致), 1b.6 仅 dangling flow 仿真侧量纲兜底 (L1430); restore 场景 dangling/tombstone 检测触发 4.2/4.3 AC 未显式覆盖(删除/粘贴), 留 4.2 CS 评估补 AC |
| F-6  | formulaError null vs undefined 类型对齐: types.ts `formulaError?: string \| null`, restore 设 null, store 创建路径可能 undefined | post-1a (optional)                        | formulaError null (restore/derive 后) vs undefined (store createFlow 初始) 二义; 非阻塞 (两者 falsy, 渲染层 `formulaError &&` 兼容); 统一为 null 需核 store 全路径, defer 非阻塞优化                                                                                                                                                                                                                                                  |
| F-9  | AC-15 storage-type isolation test: autosave key 不被其他 localStorage 污染的隔离测试缺失                                         | post-1a (optional)                        | AC-15 要求 storage 隔离; vitest mock localStorage 单 key 已覆盖功能 (autosave.test.ts 24 passed); isolation 边界 (多 key 并存/namespace 冲突) 缺独立 test; defer 非阻塞, 1a 单 key 场景无实际冲突                                                                                                                                                                                                                                     |
| F-11 | Cloud/Flow roundtrip test: autosave.test.ts 主要测 Stock roundtrip, Cloud/Flow 缺独立 roundtrip test                             | post-1a (optional)                        | Stock roundtrip 已证 toPersisted/fromPersisted 对称 (AC-2/AC-3); Cloud/Flow 共用路径, roundtrip 对称性间接覆盖; 独立 Cloud/Flow roundtrip test nice-to-have defer; F-3 deriveFlowUnits 直调已覆盖 flow.units restore 正确性 (AC-4 e2e)                                                                                                                                                                                                |

CR Run 1 verdict **PASS** (2026-07-18 全裁定). 11 findings: 6 patched (F-1/F-7 批1 + F-3/F-4/F-2/F-8 批2) + 4 defer (见上表) + F-10 sprint-status->done (独立 chore PR, 合并后推). 验证: tsc 0 + vitest 730 passed | 1 skipped / 31 files + autosave-restore e2e 2 passed + 全套件 e2e 29 passed | 21 skipped (minimap + stock-render 首次 timeout flaky, 重跑 11 passed 全绿, 非 patch 回归).

---

## BMad Skill Enhancement Candidates (2026-07-17)

非单个 story CR 产出的 defer, 而是跨 story 教训沉淀的 BMad skill(CS/VS/DS/CR)流程增强候选。1a.12 合并后从 memory 迁入解锁。非阻塞性 story-cycle 改进, 无具体 story 归属; 落地方式 = BMad custom override `persistent_facts` 注入 skill gate(见 memory newsd-persistent-facts-custom-override-bmad-upgrade-risk)。

| ID  | 候选                                                              | 源教训                                                                                                                                                                                                                                         | How to apply                                                                                                                                                                                                                                                                                   | 源 memory                               |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| P1  | VS gate 增 task-SDR 一致性检查项                                  | 1a.7 CR F-1-4: SDR#7 + §3.1 矩阵 pin「新建 = setElements([])+清选+重置相机 {0,0,16}」(全量清空), 但 T11 任务行写「新建 = createStock」, DS 按 T11 实现偏离 SDR; VS gate 缺 task-SDR 一致性检查致矛盾漏到 CR 才暴露(epic AC-1 对新建沉默不裁决) | VS 阶段增「逐 task 核对 SDR, task-SDR 冲突时遵 SDR 或显式 raise 矛盾, 禁默从 task」检查项(类比 newsd-cs-webresearch-explicit-gate explicit-gate 模式); 矛盾须显式记录                                                                                                                          | newsd-ds-follows-task-not-cspin         |
| P2  | skill 调用自动校验(每阶段起核 skill 已 slash 加载, 非手写 prompt) | 1a.4 曾 glob `.claude/skills/**/bmad-dev-story*` 匹配文件名漏目录内 SKILL.md, 误判 skill 不存在 -> 手写 DS prompt + 两轮手动 VS(round-1 FAIL / round-2 PASS); 1a.5 VS 实测无持久化产物(审计证实)                                               | 每阶段起核 `_bmad/bmm/module-help.csv` 对应 skill(action 列区分 create/validate, menu-code 列 = CS/VS/DS/CR)已 slash 加载, 四阶段一致; 查 skill 存在用 `.claude/skills/<name>/**` 非 `**/<name>*`(后者匹配文件名漏目录内 SKILL.md); VS = `bmad-create-story validate` action 非独立 skill 目录 | newsd-story-cycle-bmad-skill-invocation |

---

## From Story 2.1 CR (Run 1, 2026-07-22)

CR Run 1 verdict **PASS** (3-layer orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents; 13 findings: 6 patch [F1/F2/F3/F4/F5/F9] + 6 defer [F6/F7/F8/F10/F11/F12] + F13 合并 F1 + 2 spec 回写 defer [F1-spec/fail-fast-spec]; 用户裁定全闭合). patch 项见 story `## CR 记录`. defer 8 项 (6 finding-defer + 2 spec 回写):

| ID             | Item                                                                                                              | Target Story                          | Rationale                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F1-spec        | SDR#10 provider_down 定义回写扩展含本地 DB 错 (upsert/session 失败归 provider_down 超原 "provider endpoint" 定义) | 2.1 spec 回写 (story SDR#10 / AC-10)  | F1=A 全映射 provider_down, DB 错语义扩展需 spec 认; 代码已 patch (handler.go 4 码->provider_down), spec 措辞滞后                           |
| F6             | AC-5 users 表列 spec 漏 email TEXT 列 (impl schema.go + B9 同邮箱测试 schema_test L158 `WHERE email=` 依赖)       | 2.1 spec 回写 (epics ERD L205 / AC-5) | email 列必要 (B9 同邮箱不同 provider 测试查询), impl 已建列, spec ERD/AC-5 漏列回写                                                        |
| F7             | AC-5 users CHECK 约束含 'fake' (spec AC-5 IN ('github','google') 仅, fake 是 FAKE_OAUTH=1 dev-only provider)      | 2.1 spec 回写 (AC-5)                  | fake 是 dev-only provider 需写表; spec AC-5 只列生产 provider, fake 注明仅 FAKE_OAUTH 注册                                                 |
| F8             | AC-6 UpsertUser DO UPDATE SET email=excluded.email (SDR#2 只 SET username)                                        | 2.1 spec 回写 (SDR#2)                 | impl SET email (用户 provider 返邮箱变更时刷新), spec SDR#2 只声明 username 回写滞后                                                       |
| F10            | me() 401 用 http.Error Content-Type text/plain (body 是 JSON) + me 返 {email,provider} 额外字段 (spec AC-11 未列) | 2.1 spec 回写 (AC-11 / SDR#3)         | API 卫生 (401 Content-Type application/json) + me 返字段 spec 表述; 前端无实际影响 (toast/redirect 不读额外字段), defer 非阻塞             |
| F11            | me() 返 token 到 JSON body (XSS 调 /me 偷 token 绕 HttpOnly cookie)                                               | 2.1 spec 回写 (SDR#32 / AD-16)        | AD-16/SDR#32 双通道 (HttpOnly cookie + JSON body token) 是设计决策非 bug; XSS 偷 token 是双通道固有 tradeoff, spec 显式确认 AD-16 认此风险 |
| F12            | AC-8(c) callback 302 redirect body token 浏览器不暴露 JS (token 实际经 /me fetchMe 获取)                          | 2.1 spec 回写 (AC-8(c))               | 302 redirect body 浏览器不读 (token 仅 Set-Cookie HttpOnly + 后续 /me); spec AC-8(c) 措辞 "body 返 token" 误导, 回写澄清 token 经 /me 获取 |
| fail-fast-spec | SDR#4 必填项定义裁定 (ii): 至少一 provider 配齐 id+secret, 全没配才 log.Fatal (spec SDR#4 未定义必填性颗粒度)     | 2.1 spec 回写 (SDR#4)                 | 用户裁定 (ii) per SDR#4; epic/SDR#4/SDR#11 均未定义 "必填项" 颗粒度 (单 provider vs 全没配), 回写 (ii) 澄清                                |

注: F13 (provider.go Exchange/FetchUser 不显式检查 HTTP status code, 依赖 body Decode) 合并 F1 -- F1 patch 把 Exchange err (含 status 非2xx -> body 非 JSON -> Decode err) -> provider_down 映射已覆盖非2xx 路径, 显式 status check 是精度改进非必需, 不单独 defer. 验证 gate (AC-17/SDR#24 全套件): tsc 0 + go test ./... 全 pass (auth 13 含新增 ProviderDown×2 + server + store + version) + vitest 797 passed | 1 skipped / 43 files + e2e 40 passed | 21 skipped (newsd.exe rebuild with FAKE_OAUTH=1 patches; flow-render AC-17 像素 flaky 重跑 pass 非 patch 回归).
