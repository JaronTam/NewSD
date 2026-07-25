---
baseline_commit: c217b6a
baseline_tests: 797 passed | 1 skipped / 43 files (vitest, 实测 @c217b6a main HEAD) + tsc 0 + e2e 40 passed | 0 failed (AC-17 已 chore PR#72 reframing builtInstances 修复, merged c217b6a; flaky 脆断言根因已除) | 21 skipped (实测 @c217b6a)
---

# Story 1a-10: 模型设置 (model-settings)

Status: done

## Story

As a 单人建模者,
I want 在设置面板中配置模型级时间单位(年/月/日/时/分/秒)与默认 dt, 并在修改时间单位时触发全模型量纲重校验,
so that 模型有了量纲基准与计量步长的统一配置入口, 且量纲一致性检查(FR-SIM-7)的触发逻辑在 1a 阶段就绪(推导结果 stub "待 1b", 1b.1 接入实际求解时替换 stub).

epic 依据: epics.md L683-703 Story 1a-10 模型设置(模型级配置项 时间单位单选 + 默认 dt 与 FR-SIM-1 联动 + 修改时间单位触发全模型量纲重校验 + 量纲重校验触发逻辑在 1a 推导 stub 返回"待 1b" 同 1a.8 占位策略 + 1a 验收只验触发逻辑就绪不验推导结果 + 边界 guard AR#5 SUCCESS-1 Epic 1a 全 story 就绪 ≤5min); FR-UI-5(epics.md L94) model settings time unit + default dt; FR-SIM-1(L56) dt default 0.1 + 时间单位 年/月/日/时/分/秒; FR-SIM-7(L62) dim consistency check; FR-UI-1(L90) Toolbar dt selector [0.01,0.1,0.5,1.0]. 跨 story 引用: 1b.1(L871/L876) "1a.8/1a.10 量纲 stub 入口存在, 1b.1 替换 stub"; 1b.8(L925) 默认 dt(1a.10 UI)与 FR-SIM-1 联动 + dt 选择器 [0.01,0.1,0.5,1.0]; 1b.8(L930-933) sim running + 用户改时间单位 -> 手动 replay(defer 1b). 设计源头 = 1a.8 量纲 stub 占位策略 + 1a.9 SettingsPanel 弹层(1a.9 Q5 verdict L462: "1a.10 model-settings 可扩展同弹层") + 1a.13 autosave storage 边界(独立 key 不并入 envelope).

## Acceptance Criteria

> 全部 AC 为逻辑层/组件层测试 + 1 条 e2e. modelStore 走 useSyncExternalStore + localStorage 原生 API(mirror 1a.9 langStore), jsdom 可断言. 触发重校验走 CanvasView effect(逻辑层) + modelStore.lastRevalidation(可观测) + SettingsPanel 状态行(DOM, e2e 可断言). CanvasView 为 WebGL canvas(AD-9 无 DOM overlay), 重校验编排不碰 canvas 渲染; e2e 时间单位切换断言走 SettingsPanel DOM 控件 + 状态行, 非 canvas 视觉(避开 1b canvas-click 基础设施 defer).

### 时间单位 (time unit)

- [x] **AC-1(时间单位单选 年/月/日/时/分/秒)** Given SettingsPanel 打开(Toolbar 齿轮 1a.9 已建) When 渲染 Then 时间单位控件为单选(年/月/日/时/分/秒 6 选项, 经 `t()` i18n label), 当前值 = `modelStore.timeUnit`; 选中某项 -> `modelStore.setTimeUnit(next)` -> snapshot 更新 + 持久化 localStorage key `ns-model-config`. [SDR#1, SDR#2]
- [x] **AC-2(默认 timeUnit="year" + 持久化恢复)** Given 首次访问(localStorage 无 `ns-model-config`) When modelStore 构造 Then 默认 `timeUnit="year"`(basis: i18n perTime "/ 年" i18n.ts:45 + SD convention) + `dt=0.1`(FR-SIM-1); Given localStorage 含合法 `ns-model-config` When 构造 Then 恢复 timeUnit + dt(同 langStore restore 模式); 损坏/缺字段 -> 丢弃 + 默认值 + console.warn(不崩, 不注入坏数据). [SDR#1]

### 默认 dt (default dt, FR-SIM-1 linkage)

- [x] **AC-3(默认 dt [0.01,0.1,0.5,1.0] default 0.1, FR-SIM-1 联动 1b)** Given modelStore When 取 dt Then 默认 0.1(FR-SIM-1 L56 + CanvasView:575 现状基线); Toolbar dt selector(1a.7 AC-5 已建, DT_OPTIONS=[0.01,0.1,0.5,1.0] Toolbar.tsx:31) 选项不变; 选 dt -> `modelStore.setDt(next)` -> 持久化 + snapshot 更新. dt 与 FR-SIM-1 联动(1b.1/1b.8 接入实际求解, 1a 仅存配置不跑仿真). [SDR#3]
- [x] **AC-4(dt backing 迁移 CanvasView useState -> modelStore, 不破 Toolbar)** Given CanvasView L575 `const [dt, setDt] = useState(0.1)`(transient, 不持久) When 1a.10 Then 迁移为 `const modelConfig = useSyncExternalStore(modelStore.subscribe, modelStore.getSnapshot)`, 传 `dt={modelConfig.dt}` + `setDt={modelStore.setDt}` 给 Toolbar(L1670-1674); Toolbar dt selector 行为不变(1a.7 AC-5 不回归). dt 现为模型级配置, 跨刷新保留. [SDR#3]

### 量纲重校验 (dimensional revalidation)

- [x] **AC-5(修改时间单位触发全模型量纲重校验)** Given store 含 N 个 flow When `modelStore.setTimeUnit(next)`(timeUnit 变更) Then 触发 CanvasView effect(key=[modelConfig.revalidationNonce]) -> `revalidateAllDimensions(elementStore.getElements())` 遍历所有 flow 调 `checkDimensions(flow.formula)` -> `modelStore.recordRevalidation(results)`; `modelStore.lastRevalidation = { flowCount: N, allDeferred: true, nonce }` 更新. nonce 随 setTimeUnit 递增. [SDR#4, SDR#5]
- [x] **AC-6(重校验推导 stub 返回"待 1b" 同 1a.8, checkDimensions 契约不变)** Given revalidateAllDimensions 遍历 flow When 调 checkDimensions Then 每 flow 结果 = `{ status: "deferred", message: "待 1b" }`(1a.8 占位策略, dimensionalCheck.ts:25-27 stub 不改); allDeferred=true 仅证 stub 跑过(非推导结果). 1b.1 替换 checkDimensions -> 真实推导时, revalidateAllDimensions 即 stub 入口(epics 1b.1 L871/L876). [SDR#4, SDR#20]
- [x] **AC-7(1a 验收只验触发逻辑就绪, 不验推导结果)** Given AC-5 触发 When 验收 Then 1a 只验"触发逻辑就绪" = (a) revalidateAllDimensions 遍历全 flow 调 checkDimensions(可观测: lastRevalidation.flowCount === N); (b) allDeferred=true 证 stub 返回 deferred(非推导结果正确性); 不验量纲推导结果(推导结果 defer 1b, checkDimensions 是 stub). lastRevalidation 可经 modelStore.getSnapshot() 或 SettingsPanel 状态行 `ns-settings-dim-revalidation`(DOM) 观测. [SDR#6]
- [x] **AC-8(setDt 不触发量纲重校验)** Given timeUnit 不变 When `modelStore.setDt(next)` Then revalidationNonce 不递增(dt 非量纲基准, 仅时间单位是量纲基准), CanvasView effect 不重跑, lastRevalidation 不变. setDt 仅更新 dt + 持久化 + snapshot. [SDR#5]

### 边界 guard (依赖/时序/隔离/回归)

- [x] **AC-9(依赖 chain + 执行顺序)** Given Story 1a-10 When 执行 Then (a) 依赖 1a.8 量纲 stub(dimensionalCheck.ts checkDimensions done, 1a.10 加 revalidateAllDimensions 不改 stub) + 1a.9 SettingsPanel 弹层(Toolbar 齿轮 + SettingsPanel done, 1a.10 扩展同弹层加 timeUnit 控件) + 1a.9 langStore(mirror pattern, modelStore 仿) + 1a.13 autosave(storage 边界, modelConfig 独立 key 不并入 envelope); (b) 执行顺序 1a.8 -> 1a.11 -> 1a.12 -> 1a-13 -> 1a.9(i18n) -> **1a.10(本)**. [epics.md L683-703, ruling memory]
- [x] **AC-10(storage 边界隔离 - modelConfig 独立 key)** Given 1a.9 langStore localStorage `ns-lang` + 1a-13 autosave localStorage `ns-board-autosave`(envelope version 1, elements-only) + 1a.12 sessionStorage `ns-prompt-panel-last-tab` When 1a.10 modelStore localStorage `ns-model-config` 并存 Then 各自 key + 各自 schema, 不互相覆盖; 1a-13 autosave envelope 不含 modelConfig(独立持久化, envelope version 1 契约不破, SDR#21). [SDR#21]
- [ ] **AC-11(边界 guard AR#5 SUCCESS-1 - Epic 1a 闭环 ≤5min)** [DEFER per SAVE Q5: Epic 1a 未闭环(1a.14 backlog), 串联手动验收非 1a.10 承担] Given Story 1a-10 done When Epic 1a 全 story 就绪(1a.1-1a.10 单人建模闭环) Then 满足 AR#5 SUCCESS-1(epics.md L698-703): 从空白到首个可仿真模型 ≤5min(NFR-SUCCESS-1). 本 AC 为集成/手动验收(全 Epic 1a story 串联), defer 单元测试; 1a.10 本身只验配置入口 + 触发逻辑就绪(AC-1..AC-8), 不独自承担 ≤5min 度量. [epics.md L698-703, AR#5]
- [x] **AC-12(无回归 - 全套件绿)** Given 1a-10 全部改动 When 跑 vitest 全套件 Then N/N 绿(基线 797 passed | 1 skipped / 43 files @c217b6a + 本 story 新增, DS 落实 count); e2e Playwright 无新失败(基线 40 passed | 0 failed | 21 skipped @c217b6a, AC-17 已 chore PR#72 reframing builtInstances 修复 merged c217b6a; 1a.10 不引入新 e2e 失败即无回归); tsc 0 error. 记全套件 count 非 story 子集. [SDR#24, memory newsd-e2e-attestation-full-suite-not-subset]
- [x] **AC-13(i18n key 完整性)** Given 时间单位 6 label + modelSettings + 量纲重校验状态 When i18n.ts dict Then 新增 key: `modelSettings`/`timeUnit`/`unitYear`/`unitMonth`/`unitDay`/`unitHour`/`unitMinute`/`unitSecond`/`dimRevalidationPending`(待 1b 状态) zh/en 双值齐全; 全部经 `t(key, lang)` 渲染(无硬编码中文); E27 fallback(i18n.ts t() 3-tier)对缺翻译兜底. [SDR#2, 1a.9 E27]

## Tasks / Subtasks

> TDD red-green-refactor. 每 task 标 `[gov: SDR#N]` 表设计契约根据; task 与 SDR 冲突以 SDR 为准(memory newsd-ds-follows-task-not-cspin).

- [x] **T0** red: ATDD 红脚手架 - `src/lib/sd/modelStore.test.ts`(declare const + `it.skip` 覆盖 AC-1~AC-8, AC-10, AC-13) + `src/lib/sd/__tests__/dimensionalCheck.test.ts` 扩展(revalidateAllDimensions skip) + `src/lib/render/SettingsPanel.test.tsx` 扩展(timeUnit 控件 skip). 保 baseline tsc 0. `[gov: SDR#33]`
- [x] **T1** red: AC-1/AC-2 - `modelStore.test.ts` 断言 defaults(timeUnit="year", dt=0.1) + `setTimeUnit` 持久化 localStorage `ns-model-config` + nonce 递增 + 构造时 restore(合法/缺 key/损坏丢弃+warn) + AC-10: persist 只写 `ns-model-config`(`ns-lang`/`ns-board-autosave` 不受影响). `[gov: SDR#1, SDR#2]`
- [x] **T2** green: 新建 `src/lib/sd/modelStore.ts` - factory-closure singleton(mirror langStore), `ModelConfig` + `TimeUnit` union, defaults(year/0.1), localStorage `ns-model-config` persist + restore(三级 fallback 同 langStore), `subscribe`/`getSnapshot`/`setTimeUnit`(nonce++)/`setDt`(无 nonce)/`recordRevalidation`, snapshot 不可变(每 mutator 重建对象). AC-1/AC-2 green. `[gov: SDR#1, SDR#2, SDR#23]`
- [x] **T3** red: AC-3/AC-4 - 断言 modelStore.dt default 0.1 + `setDt` 持久化无 nonce; CanvasView 传 modelConfig.dt 给 Toolbar, 改 modelStore.dt -> Toolbar dt selector 反映(不破 1a.7 AC-5). `[gov: SDR#3]`
- [x] **T4** green: `src/lib/render/CanvasView.tsx` L575 `useState(0.1)` -> `useSyncExternalStore(modelStore.subscribe, modelStore.getSnapshot)`, L1670-1674 传 `dt={modelConfig.dt}` + `setDt={modelStore.setDt}`. AC-3/AC-4 green. `[gov: SDR#3]`
- [x] **T5** red: AC-5/AC-6 - `src/lib/sd/__tests__/dimensionalCheck.test.ts` 扩展断言 `revalidateAllDimensions(elements)` 返回 N 结果(N flow, 全 `{status:"deferred", message:"待 1b"}`) + 空 flow -> [] + 非 flow 元素跳过 + 每次新数组. `[gov: SDR#4, SDR#20]`
- [x] **T6** green: `src/lib/sd/dimensionalCheck.ts` 加 `revalidateAllDimensions(elements): DimensionalCheckResult[]`(filter kind==="flow" -> map checkDimensions(flow.formula)). 不改 checkDimensions stub. AC-5/AC-6 green. `[gov: SDR#4]`
- [x] **T7** red: AC-5/AC-7/AC-8 - `CanvasView.test.tsx` 断言 timeUnit 变更(setTimeUnit) -> effect 调 revalidateAllDimensions + modelStore.lastRevalidation.flowCount===N + allDeferred===true; setDt -> nonce 不变, lastRevalidation 不变. `[gov: SDR#5, SDR#6]`
- [x] **T8** green: `src/lib/render/CanvasView.tsx` 加 `useEffect(() => { const results = revalidateAllDimensions(elementStore.getElements()); modelStore.recordRevalidation(results); }, [modelConfig.revalidationNonce])`(elementStore 模块级单例 :198). AC-5/AC-7/AC-8 green. `[gov: SDR#5, SDR#6]`
- [x] **T9** red: AC-1/AC-13 - `SettingsPanel.test.tsx` 扩展断言 timeUnit 控件渲染 6 选项(年/月/日/时/分/秒) + 当前值 = modelStore.timeUnit + 选中调 `setTimeUnit` + 量纲重校验状态行 `ns-settings-dim-revalidation` 显示 flowCount + "待 1b". `[gov: SDR#1, SDR#2]`
- [x] **T10** green: `src/lib/render/SettingsPanel.tsx` 加 timeUnit 单选控件(`<select data-testid="ns-settings-time-unit">` 6 option, 经 `t()`) + subscribe modelStore + setTimeUnit on change + 重校验状态行(`<span data-testid="ns-settings-dim-revalidation">` 读 lastRevalidation); `src/lib/sd/i18n.ts` 加 9 key(modelSettings/timeUnit/unitYear..unitSecond/dimRevalidationPending zh/en). AC-1/AC-13 green. `[gov: SDR#1, SDR#2]`
- [x] **T11** green: `src/styles.css` 加 `.ns-settings-panel` + `.ns-settings-panel__time-unit` + `.ns-settings-panel__dim-revalidation` 样式(1a.9 SettingsPanel 类零 CSS 规则, 本 task 补 panel 容器 + timeUnit 控件 + 状态行). 无 red(CSS 非 unit-test, 经 e2e/manual + lint 验). `[gov: SDR#1]`
- [x] **T12** e2e: `e2e/model-settings.spec.ts` AC-5 - 默认板只 seed stock 0 flow(CanvasView:842), 先经 `window.__e2e__.elementStore` 建 ≥1 flow(autosave-restore.spec `__e2e__` hook 先例) -> 打开 SettingsPanel -> 选时间单位"月" -> 断言 `ns-settings-dim-revalidation` 状态行 flowCount≥1 + 待 1b(before/after 可区分, 防空心断言). DOM 控件非 canvas, 1a 内可跑非 defer. `[gov: SDR#5]`
- [x] **T13** gate: `bun run typecheck`(tsc 0) + `bun run test`(vitest 全套件绿, 记 count) + `bun run test:e2e`(全套件绿, 记 count) + `bun run lint`(0 error). AC-12. `[gov: SDR#24]`

## Dev Notes

### ATDD Artifacts

**Red phase scaffolds generated (ATDD, pre-DS)**:

- `src/lib/sd/modelStore.test.ts` - `it.skip` 覆盖 AC-1~AC-8, AC-10, AC-13(vitest jsdom + localStorage prototype spy + fake timer 无需, 纯 store 断言)
- `src/lib/sd/__tests__/dimensionalCheck.test.ts` - 扩展 `it.skip` 覆盖 revalidateAllDimensions(AC-5/AC-6, 现有 1a.8 checkDimensions 测试不破)
- `src/lib/render/SettingsPanel.test.tsx` - 扩展 `it.skip` 覆盖 timeUnit 控件 + 状态行(AC-1/AC-13, 现有 1a.9 lang toggle 测试不破)
- `e2e/model-settings.spec.ts` - `test.skip` 覆盖 AC-5(Playwright, SettingsPanel DOM 控件)

**红阶段 import 策略 (全新文件)**: `modelStore.ts` 全新, 直接 `import` 会 tsc 红. `modelStore.test.ts` 顶部用 `declare const` (ambient 声明 modelStore 接口/方法) 让文件 tsc 绿 + `it.skip()` dormant. **DS T2 首步**: 删 `declare const` 块, 换真实 `import { modelStore, ModelConfig, TimeUnit, setTimeUnit, ... } from "./modelStore"`. (1a.13 autosave.ts 全新文件 declare-const 先例, memory newsd-atdd-red-scaffold-declare-const-for-new-file.) 扩展现有模块(dimensionalCheck.test/SettingsPanel.test)用 `declare const` 补新符号 revalidateAllDimensions + modelStore(或 cast), DS 首步换真实 import.

**Baseline 验证 (gate, ATDD 不破坏基线)**:

- tsc 0 errors(`declare const` 生效)
- vitest 全套件 797 passed | 1 skipped + N skipped(原 1skip + ATDD 新 skip; 797 passed 不变 = 无回归 AC-12)
- e2e `model-settings.spec.ts` skipped

**DS handoff**: T0-T13 task sequence; DS unskip 按 T0->T11(vitest) + T12(e2e); T13 gate 记全套件 count(非子集). 详见 `_bmad-output/test-artifacts/atdd-checklist-1a-10-model-settings.md`(DS 前 `/bmad-testarch-atdd` 产).

**执行模式**: sequential orchestrator-direct(ark-code 后端无 subagent, 1a.13 先例; memory newsd-cr-3-layers-orchestrator-direct-not-subagents).

### 1. Story Decision Records (SDR)

SDR 是本 story 层内的设计契约与守卫锁, 分三段: 设计契约(实现前已定 = 强约束, 现状/目标/守卫三元) + 保留不变量(baseline 已成立不能倒退) + 流程 meta(为何做/放弃备选). 遵 memory `newsd-ds-follows-task-not-cspin`: task 行的 `[gov: SDR#N]` 是 DS 实施根据; task 与 SDR 冲突以 SDR 为准.

#### 设计契约 (强约束, 需守卫)

- **SDR#1 - 新 modelStore.ts 单例 + ModelConfig + localStorage `ns-model-config`**
  - 现状: dt = CanvasView.tsx:575 `useState(0.1)` transient(不持久); 无 timeUnit 概念; 无模型级配置 store.
  - 目标: 新建 `src/lib/sd/modelStore.ts` factory-closure singleton(mirror 1a.9 langStore), `ModelConfig = { timeUnit: TimeUnit, dt: number }`, snapshot 含 `{ timeUnit, dt, revalidationNonce, lastRevalidation }`. 持久化 localStorage key `ns-model-config`(仅 timeUnit + dt; revalidationNonce + lastRevalidation 派生态不持久, 运行时重算). 构造时 restore(三级 fallback: localStorage -> 默认 year/0.1; 损坏丢弃+warn, 同 langStore).
  - 守卫: AC-1/AC-2 red 断言 defaults + setTimeUnit 持久化 + restore 路径; modelStore.test.ts.
  - 镜像点: langStore(i18n.ts:dict / langStore.ts singleton + localStorage `ns-lang` + navigator.language). modelStore 仿此 pattern(timeUnit/dt 替代 lang, 无 navigator 检测因模型配置无浏览器偏好推断).

- **SDR#2 - TimeUnit union type + never-default exhaustiveness**
  - 现状: 无 TimeUnit 类型; deriveFlowUnits 硬编码 "/dt" 默认时间单位(store.ts:342).
  - 目标: `TimeUnit = "year" | "month" | "day" | "hour" | "minute" | "second"`(年/月/日/时/分/秒, FR-SIM-1 L56). modelStore 内 setTimeUnit/restore 的 TimeUnit switch 用 `default: const _exhaustive: never` 守卫(project-context L69 never-default; 1a.13 autosave toPersisted/fromPersisted 已采此 pattern, SDR#12).
  - 守卫: AC-1 red 断言 6 选项 + tsc exhaustiveness; 新增 TimeUnit 值(未来)编译期捕获.
  - 注: deriveFlowUnits 的 "/dt" 硬编码**不改**(SDR#22); TimeUnit 是模型级配置层, 与 deriveFlowUnits 的 unit string 推导分离(SDR#32 流程 meta).

- **SDR#3 - dt 选择器 backing 迁移 + dt 留 Toolbar 不复刻 SettingsPanel**
  - 现状: Toolbar dt selector 已存在(1a.7 AC-5, Toolbar.tsx:31 `DT_OPTIONS=[0.01,0.1,0.5,1.0]` + :238-259 `<select data-testid="ns-toolbar-dt-select">`); backing = CanvasView useState:575 transient.
  - 目标: dt backing 从 CanvasView useState 迁移到 modelStore(模型级配置, 持久化); Toolbar dt selector **留原位**(1a.7 AC-5 不回归), 传 `dt={modelConfig.dt}` + `setDt={modelStore.setDt}`. **不在 SettingsPanel 复刻 dt 控件**(单一源 modelStore, 避免重复控件双写竞态; 1a.9 Q5 verdict L462 明示 1a.10 扩展同弹层 = timeUnit 控件, 非 dt 迁入).
  - 守卫: AC-3/AC-4 red 断言 dt default 0.1 + setDt 持久化 + Toolbar dt selector 反映 modelStore.dt; CanvasView.test.tsx 不破 1a.7 AC-5.

- **SDR#4 - revalidateAllDimensions(elements) 纯函数 + stub 入口**
  - 现状: dimensionalCheck.ts:25-27 `checkDimensions(_formula)` stub 返回 `{status:"deferred", message:"待 1b"}`(1a.8); PropertyPanel.tsx:194 已在 formula blur 时调 checkDimensions(per-flow 单次, 非 timeUnit 触发).
  - 目标: dimensionalCheck.ts 加 `revalidateAllDimensions(elements: SDElement[]): DimensionalCheckResult[]` 纯函数(filter `kind==="flow"` -> map `checkDimensions(flow.formula)`), 返回每 flow 一结果(1a 全 "待 1b"). 此函数即 1b.1 替换 checkDimensions 时的聚合入口(epics 1b.1 L871/L876 "1a.8/1a.10 量纲 stub 入口存在").
  - 守卫: AC-5/AC-6 red 断言 N flow -> N 结果 + 全 deferred + 空 flow -> [] + 非 flow 跳过 + 每次新数组; dimensionalCheck.test.ts 扩展不破 1a.8 AC-12.
  - 不改 checkDimensions stub(SDR#20).

- **SDR#5 - 触发编排 = CanvasView useEffect[revalidationNonce] + 双 store 解耦**
  - 现状: 无 timeUnit 变更 -> 重校验 触发链; elementStore 模块级单例(CanvasView.tsx:198 `const elementStore = createElementStore()`, 1a.13 story L114 证).
  - 目标: CanvasView 加 `useEffect(() => { const results = revalidateAllDimensions(elementStore.getElements()); modelStore.recordRevalidation(results); }, [modelConfig.revalidationNonce])`. `setTimeUnit` 增 nonce(触发); `setDt` **不增 nonce**(dt 非量纲基准, AC-8). modelStore **不持 elementStore ref**(解耦: CanvasView 拥双 store + elementStore 单例, 编排在 CanvasView; modelStore 仅 recordRevalidation 存结果).
  - 守卫: AC-5/AC-7/AC-8 red 断言 timeUnit 变更 -> effect 跑 + lastRevalidation 更新; setDt -> nonce 不变 + lastRevalidation 不变.
  - mount 行为: effect 首跑(nonce 初值) -> 记录初始 "待 1b" 状态(lastRevalidation populated); 无 mount-skip ref(简化, mount-run 无害 = 初始状态填充; nonce 后续不变不重入).

- **SDR#6 - lastRevalidation 可观测 + recordRevalidation snapshot 不可变**
  - 现状: 无重校验结果可观测态.
  - 目标: modelStore snapshot 含 `lastRevalidation: { flowCount: number, allDeferred: boolean, nonce: number } | null`(1a 可观测触发就绪, AC-7). `recordRevalidation(results)` 计 flowCount + allDeferred(全 deferred) + 当前 nonce -> 重建 snapshot 对象(不可变) + notify. allDeferred=true **仅证 stub 跑过**(非推导结果正确性, AC-5/AC-7 合规).
  - 守卫: AC-7 red 断言 lastRevalidation.flowCount + allDeferred 可经 getSnapshot 或 SettingsPanel 状态行 `ns-settings-dim-revalidation`(DOM) 观测.
  - 无环: recordRevalidation notify -> CanvasView re-render, 但 nonce 不变 -> effect 不重跑(dep=[nonce]); 无无限循环.

#### 保留不变量 (baseline 已成立, 不能倒退)

- **SDR#20 - checkDimensions 契约不变 (1a.8 AC-12)**: 1a.10 不改 dimensionalCheck.ts:25-27 `checkDimensions` stub(始终 `{status:"deferred", message:"待 1b"}`, 不 throw, 每次新对象, keys 仅 [message, status]). 1a.10 只**加** revalidateAllDimensions(调 checkDimensions), 不改 checkDimensions. 守卫: `src/lib/sd/__tests__/dimensionalCheck.test.ts`(1a.8 AC-12 契约)不破.

- **SDR#21 - autosave envelope 不动 (version 1, elements-only)**: 1a.13 autosave envelope `{version:1, elements: PersistedElement[]}`(autosave.ts:63-66)不含 modelConfig; modelConfig 独立 localStorage key `ns-model-config`(mirror langStore `ns-lang`), 不并入 envelope. restoreFromStorage/startAutosave 不改. 守卫: 1a.13 autosave.test 不破 + AC-10 storage 边界隔离. (1a.13 envelope version 1 契约保持, modelConfig 加入 = version bump defer 未来, 1a 不破.)

- **SDR#22 - deriveFlowUnits 不改 (/dt 默认保留)**: store.ts:342 `let timeUnit = "/dt"` 默认 + `[单位]` annotation 提取**不改**. 时间单位对 flow units string 的重推导属 stubbed 推导(defer 1b, SDR#32); 1a.10 只接 checkDimensions 触发(量纲 CHECK), 不碰 deriveFlowUnits(unit string 推导). 守卫: store.test 不破. (checkDimensions stub 入口 vs deriveFlowUnits 1a.8 已落地 unit string, 二者不同, 见 SDR#32.)

- **SDR#23 - useSyncExternalStore + factory-closure + snapshot 不可变 (mirror langStore)**: modelStore 仿 1a.9 langStore pattern(project-context L85-87 useSyncExternalStore + external singleton stores load-bearing). 每 mutator(setTimeUnit/setDt/recordRevalidation)重建 snapshot 对象(不可变, getSnapshot 稳定). 守卫: modelStore.test snapshot 不可变 + mirror langStore 结构.

- **SDR#24 - 全套件基线 = vitest 797 passed | 1 skipped / 43 files + tsc 0 + e2e 40 passed | 0 failed (AC-17 已 chore PR#72 reframing builtInstances 修复, merged c217b6a) | 21 skipped (实测 @c217b6a)**: T13 gate 断言 vitest N/N 绿 + tsc 0 + e2e 无新失败(AC-17 已修, 无例外); 1a.10 不引入新 e2e 失败即无回归. 全套件口径非子集(memory newsd-e2e-attestation-full-suite-not-subset).

#### 流程 meta

- **SDR#30 - 为何独立 modelStore (不并入 autosave envelope)**: (a) 解耦 - modelConfig 是模型级配置(timeUnit/dt), autosave 是会话韧性(elements 快照), 生命周期/语义不同; (b) 1a.13 autosave envelope version 1 契约 = elements-only, 并入 modelConfig = version bump + migration 负担(1a 不引); (c) pattern 一致性 - langStore 已独立 `ns-lang` key, modelStore 仿 `ns-model-config` 独立 key, 三 store(lang/autosave/model)各持各 key 各自 restore(AC-10 隔离). 备选(并入 envelope)拒: 破 1a.13 契约 + 耦合.

- **SDR#31 - 为何 dt 留 Toolbar 不移 SettingsPanel**: (a) 1a.7 AC-5 已建 Toolbar dt selector(DT_OPTIONS + testid), 迁入 SettingsPanel = 重做 + 破 1a.7 测试; (b) 单一源 - dt 留 Toolbar 控件, backing 迁 modelStore(模型级配置), 一处控件一处源, 避免双写竞态; (c) 1a.9 Q5 verdict L462 明示 1a.10 扩展同弹层 = timeUnit 控件(非 dt 迁入). 备选(dt 也迁 SettingsPanel)拒: 重复控件 + 破 1a.7.

- **SDR#32 - 为何 flow units string 重推导 defer 1b (非 1a.10 触发)**: checkDimensions(stub, "待 1b")是量纲**一致性检查**入口, 1a.10 接其**触发**(timeUnit 变更 -> 重跑 checkDimensions); deriveFlowUnits(store.ts:329-355, 1a.8 已落地)是 flow unit **string 推导**(从 formula `[单位]` annotation + "/dt" 默认), 二者不同. 时间单位变更**应**重推导 flow units string(如 year -> month, "/年" -> "/月"), 但推导逻辑属 1b solver 统一推导(checkDimensions 替换时一并); 1a.10 只接 CHECK 触发不接 string 重推导, 避免 1a 半吊子推导(derivation)与 1b solver 推导分裂. 备选(1a 触发 deriveFlowUnits 重跑)拒: 半吊子推导 + 与 1b 分裂. (SAVE QUESTION Q2 待 VS/用户确认, 见末.)

- **SDR#33 - ATDD 红脚手架 declare-const + 全新文件不破 baseline tsc 0**: modelStore.ts 全新模块, 直接 import 破 baseline tsc 0. 红脚手架用 `declare const`(ambient 声明) + `it.skip` dormant 保 tsc 0(1a.13 autosave.ts 首例, memory newsd-atdd-red-scaffold-declare-const-for-new-file). DS T2 首步换真实 import. 扩展现有模块(dimensionalCheck.test/SettingsPanel.test)用 declare-const 补新符号. 守卫: ATDD 后 baseline tsc 0 + vitest 797 passed 不变.

### 2. 域模型对账 (modelConfig 映射, 与 types.ts + 1a.8/1a.9/1a.13 对齐)

| 配置项     | 字段              | 类型         | 持久化 | 运行时派生        | 原因/归宿                                       |
| ---------- | ----------------- | ------------ | ------ | ----------------- | ----------------------------------------------- |
| timeUnit   | timeUnit          | TimeUnit     | ✅     | -                 | 模型级量纲基准(年/月/日/时/分/秒, FR-SIM-1)     |
| dt         | dt                | number       | ✅     | -                 | 默认步长(FR-SIM-1, [0.01,0.1,0.5,1.0], 1b 求解) |
| nonce      | revalidationNonce | number       | ❌     | ✅(setTimeUnit++) | 触发编排 key, 运行时重置(不持久)                |
| reval 结果 | lastRevalidation  | object\|null | ❌     | ✅(effect 重算)   | 1a 可观测触发就绪(AC-7), 运行时重算(不持久)     |

> 注: modelConfig 不含 elements(elements 属 1a.13 autosave envelope, 独立 key, AC-10). modelStore 不持 elementStore ref(SDR#5 解耦).

### 3. 引用架构约束

- **AD-9 CanvasView = WebGL2 canvas(无 DOM overlay)**: modelStore/重校验编排走 mount effect(useEffect, 逻辑层) + SettingsPanel DOM 控件(timeUnit select + 状态行), 不改 canvas 渲染架构; e2e 时间单位切换断言走 SettingsPanel DOM 非 canvas 视觉.
- **AD-5 [SYSTEM HALTED] circuit breaker 不变**: modelConfig 纯配置 + 重校验触发, 不碰仿真熔断; 1a 无仿真(dt 仅存配置, 1b.1/1b.8 接入求解).
- **AD-6 无 meval in TS**: 量纲推导 checkDimensions stub "待 1b"(AD-5 Wasm boundary, TS 薄边界, numeric eval -> Rust 1b); 1a.10 只接触发, 推导 defer 1b.
- **1a.8 量纲 stub (done)**: dimensionalCheck.ts:25-27 checkDimensions(stub) + PropertyPanel.tsx:194 per-flow 调用 - 1a.10 加 revalidateAllDimensions 聚合 + timeUnit 触发, 不改 stub.
- **1a.9 langStore pattern (done)**: langStore.ts singleton + localStorage `ns-lang` + useSyncExternalStore - modelStore 仿此 pattern.
- **1a.13 autosave storage 边界 (done)**: autosave.ts:63-66 envelope version 1 elements-only + `ns-board-autosave` key - modelConfig 独立 `ns-model-config` key, 不并入 envelope(AC-10, SDR#21).
- **project-context L85-87**: useSyncExternalStore + 外部单例 store + snapshot 不可变 - modelStore 遵此(load-bearing).
- **project-context L67**: element identity = id(UUIDv4) - modelConfig 不 key by seq/name, timeUnit/dt 是模型级非元素级.
- **project-context L69 never-default**: TimeUnit switch + recordRevalidation 用 exhaustiveness `default: const _exhaustive: never`(新代码采用, 1a.13 SDR#12 先例; 既有缺口 store.ts:100/144 + minimap.ts:247 归 deferred-work 不回填).
- **project-context L131-138/L142**: 本地 pre-merge gate(tsc/vitest/e2e/eslint 0 fail) + 记全套件 count.
- **FR-SIM-1 (L56) + FR-UI-1 (L90) + FR-UI-5 (L94) + FR-SIM-7 (L62)**: dt default 0.1 + dt selector [0.01,0.1,0.5,1.0] + model settings time unit/default dt + dim consistency check.

### 4. 项目结构 (新增/修改 files)

新增:

- `src/lib/sd/modelStore.ts` - factory-closure singleton(mirror langStore): `modelStore`(subscribe/getSnapshot/setTimeUnit/setDt/recordRevalidation) + `ModelConfig` + `TimeUnit` union + 常量 `MODEL_CONFIG_KEY="ns-model-config"` / 默认 `DEFAULT_TIME_UNIT="year"` / `DEFAULT_DT=0.1`. restore 三级 fallback(localStorage -> 默认; 损坏丢弃+warn).
- `src/lib/sd/modelStore.test.ts` - vitest 单元 + integration(AC-1~AC-8, AC-10, AC-13, localStorage spy).
- `e2e/model-settings.spec.ts` - Playwright e2e(AC-5, SettingsPanel DOM 控件).

修改:

- `src/lib/sd/dimensionalCheck.ts` - 加 `revalidateAllDimensions(elements): DimensionalCheckResult[]`(不改 checkDimensions stub).
- `src/lib/sd/__tests__/dimensionalCheck.test.ts` - 扩展 revalidateAllDimensions 测试.
- `src/lib/render/CanvasView.tsx` - L575 `useState(0.1)` -> `useSyncExternalStore(modelStore...)`; L1670-1674 传 modelConfig.dt/setDt 给 Toolbar; 加 `useEffect[revalidationNonce]` 触发重校验.
- `src/lib/render/SettingsPanel.tsx` - 加 timeUnit 单选控件 + subscribe modelStore + 重校验状态行(1a.9 只 lang toggle, 1a.10 扩展).
- `src/lib/render/SettingsPanel.test.tsx` - 扩展 timeUnit 控件 + 状态行测试.
- `src/lib/sd/i18n.ts` - 加 9 key(modelSettings/timeUnit/unitYear/unitMonth/unitDay/unitHour/unitMinute/unitSecond/dimRevalidationPending zh/en).
- `src/styles.css` - 加 `.ns-settings-panel` + `.ns-settings-panel__time-unit` + `.ns-settings-panel__dim-revalidation`(1a.9 SettingsPanel 类零 CSS 规则, 本 story 补).

不改(显式):

- `src/lib/sd/store.ts` - deriveFlowUnits `/dt` 默认(:342)不改(SDR#22); elementStore API 不改.
- `src/lib/sd/autosave.ts` - envelope version 1 elements-only 不动(SDR#21); modelConfig 独立 key.
- `src/lib/sd/types.ts` - 不增删元素字段(TimeUnit 是模型级非元素级, 加 modelStore.ts 内非 types.ts).
- `src/lib/render/Toolbar.tsx` - dt selector(1a.7 AC-5)不改, 仅 backing 经 CanvasView 迁 modelStore(SDR#3).

### 5. Tech / 依赖

无新依赖. 用 React 19 `useSyncExternalStore`(全已在用, elementStore/promptStore/langStore/autosaveStore) + `localStorage`(原生) + `JSON.parse/stringify`. vitest mock `localStorage` 测 persist/restore/损坏丢弃; e2e 走 SettingsPanel DOM 控件. 栈 version 锁: React ^19.2, TanStack Start ^1.168.26, Vite ^8.0.16, Tailwind v4, TS ^5.8.3, bun. 时间单位转换(年<->秒)是 1b solver 职责, 1a 不引入转换库(AD-6 无 meval in TS). **web research no-op**: 无新依赖, 复用现有 useSyncExternalStore + localStorage pattern(AD-bound, 非库不引); Web search 无需(query "react useSyncExternalStore external store pattern" = 已知 React 19 生态, 现有 4 store 已证 pattern). [memory newsd-cs-webresearch-explicit-gate]

### 6. 测试标准

- **vitest jsdom**(AC-1~AC-8, AC-10, AC-13): modelStore defaults/persist/restore/损坏丢弃/snapshot 不可变 + revalidateAllDimensions 聚合 + CanvasView effect 触发/nonce/setDt no-trigger + SettingsPanel timeUnit 控件/状态行. mock localStorage.
- **e2e Playwright**(AC-5): SettingsPanel -> 选时间单位 -> 断言 `ns-settings-dim-revalidation` 状态行更新. DOM 控件非 canvas, 1a 内可跑非 defer.
- **gate**(AC-12): tsc 0 + vitest 全套件绿(797+新增 count) + e2e 无新失败(AC-17 已 chore PR#72 reframing builtInstances 修复 merged c217b6a, 无例外) + lint 0; 记全套件 count 非 story 子集.
- **ATDD**: DS 前 `/bmad-testarch-atdd` 红脚手架(TEA v1.19.0, memory newsd-tea-module-installed).

### 7. Gate 红线

- tsc 0 error / vitest 全套件绿 / e2e 无新失败(AC-17 已 chore PR#72 reframing builtInstances 修复 merged c217b6a, 无例外) / lint 0.
- AC 全覆盖(13 条).
- **硬红线**: SDR#20(checkDimensions 契约不变) + SDR#21(autosave envelope 不动) - 不破 1a.8 量纲 stub + 1a.13 autosave 契约是依赖 story 的底线.
- SDR#22(deriveFlowUnits 不改) + SDR#3(Toolbar dt selector 不破 1a.7 AC-5) 不破坏依赖 story.
- modelConfig 独立 `ns-model-config` key(SDR#30), 不并入 autosave envelope.
- 文档标点: story 文件服从 epics+spine **半角**(,.:;). [memory newsd-doc-punctuation-style]
- 文档语言: **中文**(1a.9 §7 precedent, 胜 project-context L257 English 误; `_bmad/custom/config.user.toml` effective communication_language=中文).
- 读图前先 ⚠ 切多模态: 1a.10 无 PNG/截图/设计稿读取需求(纯代码+规格), N/A.
- 规格基准是 **epic 不是 prototype**(冲突以 epic 为准). [memory newsd-epic-over-prototype-authority]
- task↔SDR 一致性: VS 门控查 task 不偏离 SDR#1-#6/#20-#24/#30-#33 pin. [memory newsd-ds-follows-task-not-cspin]
- AC-no-regression 全套件口径(797 基线, 非 story 子集). [memory newsd-e2e-attestation-full-suite-not-subset]

### 8. References

- 设计权威: epics.md L683-703 Story 1a-10 block(模型设置 + 时间单位 + 默认 dt + 量纲重校验触发 + stub "待 1b" + AR#5 SUCCESS-1).
- FR 定义: epics.md FR-UI-5(L94) / FR-SIM-1(L56) / FR-SIM-7(L62) / FR-UI-1(L90).
- 跨 story 引用: epics.md 1b.1(L871/L876 量纲 stub 入口) + 1b.8(L925/L930-933 dt 联动 + replay defer 1b).
- 1a.8 量纲 stub: `src/lib/sd/dimensionalCheck.ts:25-27`(checkDimensions) + `src/lib/sd/__tests__/dimensionalCheck.test.ts`(1a.8 AC-12 契约) + `src/lib/render/PropertyPanel.tsx:194`(per-flow 调用).
- 1a.9 langStore pattern: `src/lib/sd/langStore.ts`(singleton + localStorage `ns-lang` + useSyncExternalStore) + `src/lib/render/SettingsPanel.tsx`(1a.9 弹层, 1a.10 扩展) + `_bmad-output/implementation-artifacts/1a-9-i18n.md` Q5 verdict L462(1a.10 扩展同弹层).
- 1a.13 autosave storage 边界: `src/lib/sd/autosave.ts:63-66`(envelope version 1 elements-only) + `_bmad-output/implementation-artifacts/1a-13-session-autosave-restore.md` SDR#8(storage 边界).
- 1a.7 Toolbar dt selector: `src/lib/render/Toolbar.tsx:31`(DT_OPTIONS) + `:238-259`(`<select data-testid="ns-toolbar-dt-select">`).
- CanvasView 单例 + dt: `src/lib/render/CanvasView.tsx:198`(elementStore 模块级单例) + `:575`(useState 0.1) + `:831-832`(restoreFromStorage/startAutosave) + `:1670-1674`(Toolbar props).
- deriveFlowUnits: `src/lib/sd/store.ts:329-355`(:342 `/dt` 默认, SDR#22 不改).
- 架构: `_bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md` AD-9(CanvasView WebGL)/AD-5([SYSTEM HALTED] breaker)/AD-6(无 meval in TS); project-context.md L67/L69/L85-87/L131-138/L142/L257.
- 流程: `_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1(CS gate) + §2.2(VS gate) + §2.4(Layer3 交叉核); `_bmad-output/project-context.md` feedback 环已激活(memory newsd-project-context-generated).
- memory: newsd-1a11-a2-and-1a13-autosave-ruling / newsd-atdd-red-scaffold-declare-const-for-new-file / newsd-cs-webresearch-explicit-gate / newsd-ds-follows-task-not-cspin / newsd-e2e-attestation-full-suite-not-subset / newsd-doc-punctuation-style / newsd-epic-over-prototype-authority.

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Author                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 2026-07-24 | CS 产 story(ready-for-dev). 从 epics.md L683-703 + FR-UI-5/FR-SIM-1/FR-SIM-7/FR-UI-1 + 1a.8 stub + 1a.9 langStore/SettingsPanel + 1a.13 autosave 推导 AC 13 + SDR 15(6 设计契约+5 保留不变量+4 流程 meta) + Tasks T0-T13 + web research no-op + SAVE QUESTIONS 6. baseline c217b6a / 797 passed + 1 skip / 43 files + tsc 0 + e2e 40 passed + 0 failed[AC-17 已 chore PR#72 reframing builtInstances 修复 merged c217b6a] + 21 skipped. 新 modelStore.ts(mirror langStore, `ns-model-config`) + revalidateAllDimensions(stub 入口, 1b.1 替换) + SettingsPanel timeUnit 控件 + CanvasView dt 迁移+重校验 effect.                                                | CC (bmad-create-story)          |
| 2026-07-24 | VS Run 1 PASS(bmad-create-story validate, orchestrator-direct): 16 项 checklist 全过, 5 findings 全应用(F-1 dimensionalCheck.test 路径 `__tests__/` 4+1 处 / F-2 AC-10 补红测 T0+T1+scope / F-3 T12 e2e `__e2e__` seed flow 防空心断言 / F-4 锚点 drift 4 处 / F-5 T11 gov SDR#3->SDR#1); SAVE Q1-Q5 用户裁定全按推荐(Q6 已闭合 PR#72); 六 gate(零歧义/零遗漏/可执行/web research 显式/task↔SDR/e2e 可跑)全过; Status 维持 ready-for-dev 可进 DS.                                                                                                                                                                                                              | CC (bmad-create-story validate) |
| 2026-07-25 | DS done(bmad-dev-story, orchestrator-direct): T0-T13 全 done. modelStore.ts(mirror langStore, `ns-model-config`, persist 仅 {timeUnit,dt}, restore 损坏丢弃+warn, setTimeUnit nonce++/setDt 无 nonce, recordRevalidation 不可变) + revalidateAllDimensions(SDR#4 readonly SDElement[], stub 不改) + CanvasView dt 迁移 useState->modelStore + useEffect[revalidationNonce] 触发 + SettingsPanel timeUnit select(6 option t())+状态行 + i18n 9 key + styles.css panel 样式 + e2e AC-5(0->1 待 1b). AC-11 DEFER(SAVE Q5). gate: tsc 0 / vitest 826\|1skip/44files / e2e 41\|0fail\|21skip / lint 0 error 于 1a-10 文件(141 pre-existing 未触). Status -> review. | CC (bmad-dev-story)             |

## Dev Agent Record

### Implementation Plan

DS 2026-07-25 (bmad-dev-story, orchestrator-direct, baseline c217b6a):

1. **T0** ATDD 红脚手架已产(pre-DS `/bmad-testarch-atdd`, 4 文件 21 vitest skip + 1 e2e skip, baseline 797 不破).
2. **T1/T2** modelStore: T1 unskip AC-1/AC-2/AC-10(freshStore = vi.resetModules + dynamic import 取 fresh singleton) -> red(模块不存在); T2 建 `modelStore.ts`(mirror langStore factory-closure, SDR#1/#2/#23) + declare 块换真实 import -> green.
3. **T3/T4** dt 迁移： T3 unskip store 层 AC-3/AC-4(T2 已覆盖即绿) + CanvasView.test 新增 AC-4 wiring 3 tests(red: modelStore 0.5/1.0 vs useState 0.1); T4 CanvasView L575 `useState(0.1)` -> `useSyncExternalStore(modelStore)` + Toolbar props `dt={modelConfig.dt}`/`setDt={modelStore.setDt}` -> green(1a.7 AC-5 不破).
4. **T5/T6** revalidateAllDimensions: T5 unskip 4 tests(red: declare const undefined); T6 dimensionalCheck.ts 加纯函数(filter kind==="flow" -> map checkDimensions, SDR#4; stub 不改 SDR#20) + scaffold 部分字段 stub 升级全字段 SDElement(签名 `readonly SDElement[]` 对齐 SDR#4) -> green.
5. **T7/T8** 触发编排： T7 CanvasView.test AC-5/AC-7/AC-8(red: lastRevalidation null) + unskip store 层 AC-5..AC-8(即绿); T8 CanvasView 加 `useEffect[modelConfig.revalidationNonce]`(revalidateAllDimensions(elementStore.getElements()) -> recordRevalidation, SDR#5/#6) -> green.
6. **T9/T10** SettingsPanel: T9 unskip 4 tests + AC-13 i18n(red); T10 SettingsPanel 加 timeUnit `<select data-testid="ns-settings-time-unit">`(6 option 经 t()) + 状态行 `<span data-testid="ns-settings-dim-revalidation">` + i18n.ts 9 key zh/en -> green.
7. **T11** styles.css 补 `.ns-settings-panel` 系列(panel 容器/label/lang-btn/time-unit/dim-revalidation, mirror `.ns-toolbar__select`; 1a.9 零 CSS 规则补).
8. **T12** e2e model-settings.spec AC-5(**e2e**.elementStore seed 全字段 stock×2+flow×1 -> 开 panel -> 选 month -> 状态行 flowCount 0->1 + 待 1b).
9. **T13** gate 全套件.

### Debug Log

- **T1 red 形式**: freshStore dynamic import 未解析模块 -> vite import-analysis 文件级 transform 失败(非单 test fail); T2 邻接 green 解, 中间态 tsc 红仅存在于 T1->T2 之间(T13 gate 0). declare-const 保 baseline 策略只覆盖 ATDD 阶段全 skip; DS unskip 后 red 即真实失败.
- **T2 笔误**: `listeners.forEach((cb) => cb();` 缺 paren, 写后 grep 当场修(未跑到 test).
- **T3 store 层即绿**: AC-3/AC-4 store 断言由 T2 setDt 实现覆盖, unskip 即 pass(非 red); red 由 CanvasView wiring 3 tests 承担(0.5/1 vs 0.1).
- **T5 python 批量 unskip 误中注释**: `it.skip()` 字样出现在 2 处注释被一并替换为 `it()`(字符串替换含 paren), 无害(注释内).
- **T6 scaffold stub 升级**: ATDD declare 签名 `{kind:string; formula?:string}[]` 与 SDR#4 `readonly SDElement[]` 不符, DS 遵 SDR 升级测试 stub 为全字段 Flow/Stock + flow()/stock() helper(遵 SDR 非 task 行, memory newsd-ds-follows-task-not-cspin).
- **T7 AC-8 vacuous green**: effect 未实现时 AC-8(setDt 不变更)空真通过; T8 后 lastRevalidation populated, AC-8 非空化(ref 不变断言仍绿).
- **T10 dimRevalidationPending en 值**: `"Dim revalidation: 待 1b"` 保留 "待 1b" — "待 1b" 是 checkDimensions stub 状态消息(1a.8 AC-12 契约, 非 UI 文案), e2e 断言 lang-independent(无需 seed ns-lang).
- **T12 两修**: (a) scaffold gear testid 误 `ns-toolbar-settings-gear` -> 实 `ns-toolbar-btn-settings`(Toolbar.tsx:291); (b) seed 部分字段 flow 升级全字段 stock×2+flow×1(防 buildInstances/errorDetection 读缺字段). 首跑红根因 = playwright webServer 跑 Go binary `newsd.exe`(main.go:29 go:embed all:dist)嵌 Jul 22 旧 dist 无 1a-10 代码 -> `bun run build` + `go build -o newsd.exe .` 重嵌后绿(4.7s). before/after 断言 /待 1b · 0/ -> /待 1b · [1-9]/ 防空心(VS F-3 reactive 三元组).
- **T13 lint**: 141 errors(140 no-explicit-any + 1 no-useless-escape)全在 1a-10 未触文件(e2e 旧 spec/quality/minimap/perf-probe/CanvasView.tsx:232,249 **e2e** any 等 pre-existing 行); 1a-10 全部新改文件 0 error(prettier-as-eslint-rule 亦过). lint 债 pre-existing, 归 deferred-work 候选(非本 story scope).

### Completion Notes

- **AC-1**: SettingsPanel `<select data-testid="ns-settings-time-unit">` 6 option 经 t()(SettingsPanel.test 3 tests) + modelStore.setTimeUnit persist `ns-model-config`(modelStore.test AC-1 2 tests 含 persist keys 仅 {timeUnit,dt}).
- **AC-2**: 默认 year/0.1 + restore 合法/坏 JSON/缺字段×6 丢弃+console.warn(modelStore.test AC-2 4 tests, freshStore fresh singleton).
- **AC-3**: dt default 0.1 + setDt persist 无 nonce(modelStore.test AC-3); Toolbar DT_OPTIONS 不变(Toolbar.test 1a.7 AC-5 绿).
- **AC-4**: CanvasView L575 useState(0.1) 旧态消失 -> modelStore backing(store.test AC-4 跨刷新 restore + CanvasView.test 3 wiring tests: 反映/响应/反向写+persist).
- **AC-5**: setTimeUnit -> nonce++ -> CanvasView effect -> revalidateAllDimensions -> recordRevalidation(CanvasView.test AC-5: flowCount=2 seeded/allDeferred/nonce+1; e2e AC-5: 状态行 0->1).
- **AC-6**: revalidateAllDimensions N flow -> N 全 {deferred, 待 1b} + 空->[] + 非 flow 跳过 + 新数组(dimensionalCheck.test 4 tests; stub :27-29 未动 SDR#20).
- **AC-7**: lastRevalidation 可观测(getSnapshot: mount-run populated flowCount/allDeferred CanvasView.test AC-7; SettingsPanel 状态行 DOM SettingsPanel.test + e2e).
- **AC-8**: setDt 无 nonce 无 lastRevalidation 变更(modelStore.test AC-3 nonce 断言 + AC-8; CanvasView.test AC-8 ref 不变).
- **AC-9**: 依赖链全 done(sprint-status: 1a.8/1a.9/1a.11/1a.12/1a.13); 执行顺序符合(1a.9 -> 1a.10 本).
- **AC-10**: modelConfig 独立 `ns-model-config` key(modelStore.test AC-10: ns-lang/ns-board-autosave 写不受影响 + restore 不读他 key; autosave envelope 未动 SDR#21).
- **AC-11**: DEFER per SAVE Q5 裁定(Epic 1a 串联手动验收, 1a.14 backlog 未闭环, 1a.10 不独自承担 ≤5min 度量) — checkbox 留 [ ].
- **AC-12**: 全套件绿 — tsc 0 / vitest 826 passed | 1 skipped / 44 files(基线 797|1/43 + 29 新增: modelStore 15 + dimensionalCheck 4 + SettingsPanel 4 + CanvasView 6)/ e2e 41 passed | 0 failed | 21 skipped(基线 40|0|21 + 1 新增, AC-17 PR#72 后无 flaky 复发). lint: 0 error 在 1a-10 文件(141 pre-existing 未触, 见 Debug Log).
- **AC-13**: i18n 9 key zh/en 双值齐全经 t()(modelStore.test AC-13 cast 策略; E27 fallback 不破).

### step8 baseline diff review

`git diff c217b6a` (工作树, DS 未提交) 逐文件核 — 声明 vs diff 实际:

| 文件                                                                           | Dev Log 声明                                                                                                                                | diff 实际                                                                                                                                                                                                              | 一致？ |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `src/lib/sd/modelStore.ts` (Created)                                           | T2: factory-closure singleton + TimeUnit never-default + persist {timeUnit,dt} + restore warn + nonce++/setDt 无 nonce + recordRevalidation | +179 行： MODEL_CONFIG_KEY/DEFAULT_TIME_UNIT(year)/DEFAULT_DT(0.1); isTimeUnit switch `default: const _exhaustive: never`(SDR#2); setTimeUnit nonce++(:145); setDt 无 nonce(:152); recordRevalidation 不可变重建(:164) | YES    |
| `src/lib/sd/modelStore.test.ts` (Created)                                      | T1/T3/T7/T9: 15 tests 全 active(AC-1×2/AC-2×4/AC-3/AC-4/AC-5×2/AC-6/AC-7/AC-8/AC-10/AC-13), declare 块换真实 import, freshStore helper      | 15 `it(` 0 `it.skip(`; import { modelStore, MODEL_CONFIG_KEY }(:15); freshStore vi.resetModules+dynamic import(:20-23)                                                                                                 | YES    |
| `src/lib/sd/dimensionalCheck.ts`                                               | T6: +revalidateAllDimensions(filter flow -> map checkDimensions), stub 不改                                                                 | +19 行： import type Flow/SDElement(:11) + 函数(:30-46); checkDimensions 原文 :27-29 未动(SDR#20)                                                                                                                      | YES    |
| `src/lib/sd/__tests__/dimensionalCheck.test.ts`                                | T5/T6: +4 tests + 全字段 stub helper, 1a.8 4 tests 不破                                                                                     | +83 行： flow()/stock() helper + 4 tests(N deferred/empty/non-flow/new array); 1a.8 AC-12 describe 原文保留                                                                                                            | YES    |
| `src/lib/render/CanvasView.tsx`                                                | T4: useState(0.1) 旧态消失 -> useSyncExternalStore(modelStore); T8: useEffect[revalidationNonce]                                            | import +2(:46-47); L577-591 modelConfig + effect; Toolbar props dt={modelConfig.dt}/setDt={modelStore.setDt}(:1689-1690); `const [dt, setDt] = useState(0.1)` 已删                                                     | YES    |
| `src/lib/render/CanvasView.test.tsx`                                           | T3: AC-4 ×3(反映/响应/反向写+persist); T7: AC-5/AC-7/AC-8 ×3                                                                                | +126 行 2 describe 于文件尾； act import(:1); modelStore import(:228)                                                                                                                                                  | YES    |
| `src/lib/render/SettingsPanel.tsx`                                             | T10: timeUnit select(6 option t()) + 状态行 + subscribe modelStore                                                                          | +44 行： TIME_UNIT_OPTIONS + useSyncExternalStore(modelStore) + select(:62-72) + span ns-settings-dim-revalidation(:75-80); 1a.9 lang toggle 原样                                                                      | YES    |
| `src/lib/render/SettingsPanel.test.tsx`                                        | T9: 4 tests unskip + declare->真实 import                                                                                                   | 1a-10 块 4 `it(` 0 skip; import { modelStore }(:76); 1a.9 lang 3 tests 原样                                                                                                                                            | YES    |
| `src/lib/sd/i18n.ts`                                                           | T10: +9 key zh/en                                                                                                                           | +10 行(:134-143): modelSettings/timeUnit/unitYear..unitSecond/dimRevalidationPending                                                                                                                                   | YES    |
| `src/styles.css`                                                               | T11: +panel/time-unit/dim-revalidation 样式                                                                                                 | +65 行 5 块(ns-settings-panel/__label/__lang-btn(--active)/__time-unit(+focus+option)/__dim-revalidation) @layer components 内                                                                                         | YES    |
| `e2e/model-settings.spec.ts` (Created)                                         | T12: AC-5 green(seed flow -> month -> 状态行 0->1 + 待 1b)                                                                                  | 全字段 stock×2+flow×1 seed; gear testid ns-toolbar-btn-settings; /待 1b · 0/ -> /待 1b · [1-9]\d*/ 断言                                                                                                                | YES    |
| `_bmad-output/test-artifacts/atdd-checklist-1a-10-model-settings.md` (Created) | T0 ATDD 红脚手架记录                                                                                                                        | pre-DS 产(4 文件 21+1 skip, baseline 797 不破)                                                                                                                                                                         | YES    |
| `_bmad-output/implementation-artifacts/sprint-status.yaml`                     | DS step4 in-progress + step9 review(独立 PR 不夹带, memory newsd-sprint-status-separate-from-story-pr)                                      | 1a-10 行状态 + last_updated 2026-07-25                                                                                                                                                                                 | YES    |

不改文件核验（显式）: `store.ts`(deriveFlowUnits /dt :342 未动 SDR#22)/ `autosave.ts`(envelope 未动 SDR#21)/ `types.ts` / `Toolbar.tsx`(SDR#3) — git status 均无, YES.

### File List

| File                                                                 | Action   | Purpose                                                                                |
| -------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `src/lib/sd/modelStore.ts`                                           | Created  | singleton + ModelConfig/TimeUnit + localStorage `ns-model-config` + recordRevalidation |
| `src/lib/sd/modelStore.test.ts`                                      | Created  | vitest AC-1~AC-8, AC-10, AC-13(15 tests 全 active)                                     |
| `src/lib/sd/dimensionalCheck.ts`                                     | Modified | 加 revalidateAllDimensions(不改 checkDimensions stub)                                  |
| `src/lib/sd/__tests__/dimensionalCheck.test.ts`                      | Modified | 扩展 revalidateAllDimensions 4 tests + 全字段 stub helper                              |
| `src/lib/render/CanvasView.tsx`                                      | Modified | dt 迁 modelStore + useEffect[revalidationNonce] 触发重校验                             |
| `src/lib/render/CanvasView.test.tsx`                                 | Modified | AC-4 wiring ×3 + AC-5/AC-7/AC-8 effect ×3                                              |
| `src/lib/render/SettingsPanel.tsx`                                   | Modified | 加 timeUnit 单选控件 + 重校验状态行                                                    |
| `src/lib/render/SettingsPanel.test.tsx`                              | Modified | 扩展 timeUnit 控件 + 状态行 4 tests(declare->真实 import)                              |
| `src/lib/sd/i18n.ts`                                                 | Modified | 加 9 key(zh/en)                                                                        |
| `src/styles.css`                                                     | Modified | 加 ns-settings-panel + time-unit + dim-revalidation 样式                               |
| `e2e/model-settings.spec.ts`                                         | Created  | Playwright e2e AC-5                                                                    |
| `_bmad-output/test-artifacts/atdd-checklist-1a-10-model-settings.md` | Created  | ATDD 红脚手架 checklist(T0, pre-DS)                                                    |

### Verification

| Gate     | Result                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc`    | 0 errors(2026-07-25 DS 实测)                                                                                                                                     |
| `vitest` | 826 passed \| 1 skipped / 44 files(2026-07-25 DS 全套件实测; 基线 797\|1/43 + 29 新增 = modelStore 15 + dimensionalCheck 4 + SettingsPanel 4 + CanvasView 6)     |
| `e2e`    | 41 passed \| 0 failed \| 21 skipped(2026-07-25 DS 全套件实测; 基线 40\|0\|21 + 1 新增 model-settings; AC-17 PR#72 后无 flaky 复发)                               |
| `lint`   | 0 error 在 1a-10 全部新改文件; 141 pre-existing errors(140 no-explicit-any + 1 no-useless-escape)在 1a-10 未触文件/行, 非本 story 引入(见 Debug Log, defer 候选) |

### DoD 双源核验 (epic AC ∪ story AC, step9)

epics.md L683-703 1a-10 block AC 逐条： L693 时间单位单选+默认 dt -> AC-1/AC-3 ✅; L694 修改时间单位触发全模型量纲重校验 -> AC-5 ✅; L695 推导 stub 返回"待 1b" 同 1a.8 -> AC-6 ✅; L696 1a 验收只验触发逻辑就绪 -> AC-7 ✅; L698-703 AR#5 SUCCESS-1 ≤5min -> AC-11 DEFER(SAVE Q5, Epic 1a 未闭环)⏸. story AC-1..AC-10/AC-12/AC-13 ✅(证据见 Completion Notes), AC-11 ⏸ defer. 无遗漏.

## VS 验证记录

> VS 阶段填(*validate-create-story). 16 项 checklist + SDR 明细 + Advisory + Verdict. 须显式留痕(memory newsd-story-cycle-bmad-skill-invocation 1a.5+ 要求).
> 执行方式: orchestrator-direct(ark-code 后端, memory newsd-cr-3-layers-orchestrator-direct-not-subagents).

**执行**: `bmad-create-story validate`(validate action, 非独立 skill), 2026-07-24, ark-code 后端 orchestrator-direct. 基线 HEAD=c217b6a(与 frontmatter baseline_commit 一致). 输入: story + epics.md(L683-703 1a.10 block / L56 FR-SIM-1 / L62 FR-SIM-7 / L90 FR-UI-1 / L94 FR-UI-5 / L871/L876 1b.1 / L925/L930-933 1b.8 全实测) + 代码锚点全 Read/grep 实测.

### Checklist (16 项)

1. ✅ Story 格式合规(As a/I want/so that + AC + SDR + Tasks + Dev Notes 全段).
2. ✅ AC 13 条, 每条 Given/When/Then + [SDR#N]/[epics L] 可追溯.
3. ✅ AC 可测性(jsdom store/DOM 断言 + e2e SettingsPanel DOM 控件, 不碰 canvas).
4. ✅ SDR 三段(设计契约 6 / 保留不变量 5 / 流程 meta 4), 每条现状-目标-守卫三元齐全.
5. ✅ Tasks TDD red-green-refactor, 每 task `[gov: SDR#N]`(T11 gov 错位 -> F-5 已修).
6. ✅ 依赖链全 done(1a.8 量纲 stub / 1a.9 SettingsPanel+langStore / 1a.11 seq / 1a.12 / 1a.13 autosave 边界).
7. ✅ epic AC 零遗漏(L693->AC-1/AC-3, L694->AC-5, L695->AC-6, L696->AC-7, L698-703->AC-11).
8. ✅ 跨 story 引用实测(1b.1 L871/L876 + 1b.8 L925/L930-933 + FR-SIM-1 L56/FR-SIM-7 L62/FR-UI-1 L90/FR-UI-5 L94).
9. ✅ 代码锚点实测(dimensionalCheck.ts:25-27 stub / PropertyPanel:194+247 / Toolbar:31 DT_OPTIONS+:238-259 select / CanvasView:198 单例+:575 useState+:831-832 autosave+:1670-1674 props / store.ts:342 "/dt" / i18n.ts:45 perTime / SettingsPanel.tsx 40 行零 CSS / langStore `ns-lang` pattern).
10. ✅ web research 显式 no-op + 栈 version 锁(§5 Tech/依赖 + CS 产出说明 Step4 双记录, 非静默 skip).
11. ✅ task↔SDR 追溯矩阵(6 设计契约全 ≥1 Task + ≥1 AC; 反向债 SDR#1 dt 迁移旧态消失断言 T3 覆盖; AC-10 红测缺口 -> F-2 已修).
12. ✅ e2e 可跑性 gate(SettingsPanel 纯 DOM testid, 无 canvas selector, AD-9 合规; T12 空心断言风险 -> F-3 已修).
13. ✅ storage 边界(`ns-model-config` 独立 key, 不并入 autosave envelope; 覆盖缺口同 F-2 已修).
14. ✅ 保留不变量对齐(SDR#20 checkDimensions stub / SDR#21 envelope / SDR#22 deriveFlowUnits / SDR#23 snapshot 不可变 / SDR#24 全套件基线).
15. ✅ 测试基线全量口径(797 passed | 1 skipped / 43 files + e2e 40 passed | 0 failed | 21 skipped @c217b6a, AC-17 已 chore PR#72 修, 全套件非子集).
16. ✅ Change Log + Dev Agent Record + VS 记录 + CR 记录 + SAVE QUESTIONS 占位齐全.

### VS Findings (5 项, 用户裁定 all 全应用, Step 7 natural 正文不引用 review 过程)

- **F-1 (Critical)**: `src/lib/sd/dimensionalCheck.test.ts` 路径不存在(真实 `src/lib/sd/__tests__/dimensionalCheck.test.ts`), story 内部矛盾(T0/ATDD Artifacts/§4 项目结构/File List 4 处错 vs SDR#20/§8 2 处对), DS 会在错位置新建重复测试文件 -> 4 处改 `__tests__` 路径 + T5 钉路径.
- **F-2 (Enhancement)**: AC-10(storage 边界隔离)可测但无 task 红测覆盖(T0 scope 列 AC-1~AC-8+AC-13 漏 AC-10, SDR#21 守卫引 AC-10 成循环) -> T0/ATDD/§4/File List scope 补 AC-10 + T1 red 补断言(persist 只写 `ns-model-config`, `ns-lang`/`ns-board-autosave` 不受影响).
- **F-3 (Enhancement)**: T12 e2e 空心断言风险(默认板只 seed 3 stock 0 flow, CanvasView:312-333/:842, 状态行 before/after 同文 flowCount=0+待 1b, 断言通过≠重校验跑过) -> T12 pin 经 `window.__e2e__.elementStore` 建 ≥1 flow(autosave-restore.spec 先例) + flowCount≥1 断言(before/after 可区分, reactive 三元组).
- **F-4 (Trivial)**: 锚点 drift 4 处: AC-11 引 epics L697-700(实 L698-703, 2 occurrence) / SDR#21+§3+§8 autosave :64-67(实 interface :63-66, 3 occurrence) / CS 产出说明 i18n 101 keys(实测 105) -> 全修.
- **F-5 (Trivial)**: T11 `[gov: SDR#3]` 错位(CSS 样式与 dt-backing 无关) -> 改 `[gov: SDR#1]`.

### Advisory (非阻断, DS 注意)

- T12 是首个开 SettingsPanel 的 e2e(现 10 spec 无一开 settings); popover 点外关闭(1a.9 Q5), select 交互在 panel 内不触发外点, 可行.
- modelStore restore 比 langStore 多 JSON.parse 损坏分支(langStore 存裸字符串无 parse 失败路径); "同 langStore" = fallback 层级语义, warn 为 modelStore 特有(AC-2 已钉, 零歧义).
- AC-11 ≤5min 为 Epic 1a 串联手动/集成验收, 非单元, 1a.10 不独自承担(=SAVE Q5 裁定 A).

### SAVE QUESTIONS 裁定 (2026-07-24 用户, 全按推荐)

Q1=A(默认 year) / Q2=A(只触发 CHECK, 不重推导 string, defer 1b) / Q3=A(dt 留 Toolbar) / Q4=A(独立 `ns-model-config`) / Q5=A(AC-11 集成/手动 defer); Q6 已闭合(chore PR#72 merged c217b6a). 裁定逐条回填 SAVE QUESTIONS 节.

### Verdict

**PASS with 5 findings applied**. 零歧义 + 零遗漏 + 可执行 + web research 显式 + task↔SDR 一致 + e2e 可跑 六 gate 全过. Status 维持 ready-for-dev, 可进 DS(DS 前 `/bmad-testarch-atdd` 红脚手架 per T0 + ATDD Artifacts).

## CR 记录

### CR Run 1 (2026-07-25, bmad-code-review, 3-layer orchestrator-direct)

per `newsd-cr-3-layers-orchestrator-direct-not-subagents` (ark-code/DeepSeek 后端 subagent 崩, orchestrator 直跑 3 层). fresh context, baseline @c217b6a + DS 工作树 (Status review -> done).

**3 层 review**:

| Layer                      | 焦点                | findings                                 |
| -------------------------- | ------------------- | ---------------------------------------- |
| Layer 1 Blind Hunter       | 无 spec, 纯代码缺陷 | F-2 (test 顺序耦合), F-4 (effect 不重跑) |
| Layer 2 Edge Case Hunter   | 边界/异常           | F-1 (runtime input validation)           |
| Layer 3 Acceptance Auditor | AC/SDR 对账         | F-3 (i18n text + interface AC gap)       |

**4 findings 裁定 (用户 2026-07-25 拍板)**:

| ID  | finding                                                                                                                                                                                                                        | 裁定           | 说明                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1 | setTimeUnit/setDt 无运行时输入校验 (modelStore.ts:144,152 / SettingsPanel.tsx:64 `as TimeUnit` cast 无 isTimeUnit guard)                                                                                                       | **dismiss**    | defense-in-depth advisory, 非 SDR violation (SDR#2 只要求 restore 路径 isTimeUnit :70); UI 6 选项约束 (TIME_UNIT_OPTIONS :19-26) + restore isValidPersisted + TS 类型三重覆盖, 无 1a.10 真实路径; 1b.6 mutator 调用路径可能变, 现加 runtime guard 可能返工; 无 story 承接, dismiss 不占 defer 坑位 |
| F-2 | AC-5/AC-8 modelStore.test.ts 用共享单例无 beforeEach reset; setTimeUnit("month") 残留致 order-shuffle flaky (timeUnit 非 "year" baseline 时 setTimeUnit same-value early-return no-op, nonce 不 bump, `after===before+1` 失败) | **patch**      | test hygiene, unambiguous: L12 import beforeEach + AC-5/AC-8 describe 加 `beforeEach(() => modelStore.setTimeUnit("year"))` (不用 act, 无 React 订阅, subscribers 空 Set, notify no-op); AC-3 不 patch (不依赖 timeUnit, 文件序在 AC-5 前)                                                         |
| F-3 | dimRevalidationPending i18n text (i18n.ts:143 en 值内嵌中文 "待 1b" 临时 stub 文案) + LastRevalidation interface pass/warn counts AC gap                                                                                       | **defer 1b.6** | 1b.6 epics L876 替换 stub 为实际推导时该 i18n text 需同步更新 (待 1b -> 实际推导结果), L871-877 AC 未覆盖; LastRevalidation interface (当前 flowCount + allDimConsistent) 可能需扩展 pass/warn counts 支撑 1b.6 实时展示, L871-877 未覆盖; 1a.10 stub 文案 + interface 满足 AC-1/AC-13             |
| F-4 | CanvasView effect[revalidationNonce] (CanvasView.tsx:588-591) 仅 timeUnit 变触发重校验, element 增删不重跑 -> flowCount 临时失配                                                                                               | **defer 1b.6** | SDR#5 trigger 限 timeUnit (dt 非量纲基准不递增 nonce); 1a.10 AC-5 证触发就绪非实时 (1a scope = 配置入口 + 触发逻辑); 1b.6 L877 实时校验落地时扩展 effect trigger 覆盖 element 增删 (公式编辑 per-flow 已覆盖 L877, element 增删未覆盖 = AC gap)                                                    |

**patch**: F-2 (折进 story PR)
**defer**: F-3 / F-4 -> 1b.6 (详见 deferred-work.md `From Story 1a.10 CR`)
**dismiss**: F-1

**验证 gate**:

- `tsc --noEmit` = 0
- `vitest run` = 826 passed | 1 skipped / 44 files (与 DS 声明一致, F-2 patch 无回归)
- e2e 全套: 本地 SwiftShader 软件 WebGL 渲染慢, 4 次跑 (默认并发 / --last-failed / 预热 server 全套 / --workers=1 串行) 每次 ~7 canvas render-ready `page.waitForFunction` 超时 (集合随机, 重跑 failed 项大多绿); 非断言失败, 非产品代码回归 (F-2 patch 只改 modelStore.test.ts 不触 e2e/产品/newsd.exe); DS 声明 41|0fail|21skip 绿 (2026-07-25); flaky 归本地 SwiftShader 环境 (memory `newsd-flow-render-ac17-flaky-root-cause` 同类 e2e 红非回归)

**verdict**: **PASS** (F-2 patched, F-3/F-4 defer 1b.6, F-1 dismiss; 单元 + 类型 gate 确定性绿, e2e 归环境). failed_layers = []. Status review -> done.

## SAVE QUESTIONS(CS 阶段, 非阻塞, 待 VS/用户确认)

> CS 阶段存疑项, 不阻塞 ready-for-dev; VS/用户裁定后回填 AC/SDR.

- **Q1 - 默认 timeUnit="year" 是否合理**: 推荐"年"(basis: i18n.ts:45 perTime "/ 年" 已是 year basis + SD convention 存量模型常以年为单位). 备选"月"/"日". 待确认.
  - **裁定(2026-07-24 用户, 按综合推荐执行)**: **A(默认 timeUnit="year")**. i18n.ts:45 perTime "/ 年" 已是 year basis + SD convention 存量模型常以年为单位.
- **Q2 - 时间单位变更是否触发 flow units string 重推导**: 推荐**只触发量纲 CHECK**(revalidateAllDimensions 调 checkDimensions), **不触发 flow units string 重推导**(deriveFlowUnits 重跑), string 重推导 defer 1b(SDR#32). 理由: checkDimensions 是 stub 入口(1b 替换), deriveFlowUnits 是 1a.8 已落地 unit string 推导, 二者分裂 = 半吊子推导; 1b solver 统一推导时一并接. 待 VS/用户确认.
  - **裁定(2026-07-24 用户, 按综合推荐执行)**: **A(只触发量纲 CHECK, 不触发 flow units string 重推导)**. deriveFlowUnits 重跑 defer 1b(SDR#32), 避免 1a 半吊子推导与 1b solver 推导分裂.
- **Q3 - dt 是否也加进 SettingsPanel**: 推荐**否**, dt 留 Toolbar(1a.7 AC-5 已建), 单一源 modelStore(SDR#31). 备选(dt 迁 SettingsPanel 与 timeUnit 同处)拒: 重复控件 + 破 1a.7. 待确认.
  - **裁定(2026-07-24 用户, 按综合推荐执行)**: **A(dt 留 Toolbar, 不迁 SettingsPanel)**. 单一源 modelStore(SDR#31), 1a.7 AC-5 不回归.
- **Q4 - modelConfig 持久化 key 独立 vs 并入 autosave envelope**: 推荐**独立** `ns-model-config`(mirror langStore `ns-lang`, SDR#30). 备选(并入 envelope)拒: 破 1a.13 version 1 契约 + 耦合. 待确认.
  - **裁定(2026-07-24 用户, 按综合推荐执行)**: **A(独立 `ns-model-config` key)**. mirror langStore `ns-lang`(SDR#30), autosave envelope version 1 契约不动(SDR#21).
- **Q5 - AC-11 AR#5 SUCCESS-1 ≤5min 是否作 1a.10 单元验收**: 推荐**集成/手动 defer**(AC-11 标注), 1a.10 本身只验 AC-1..AC-8(配置入口+触发逻辑); ≤5min 是 Epic 1a 全 story 串联度量, 非 1a.10 独自承担. 待确认.
  - **裁定(2026-07-24 用户, 按综合推荐执行)**: **A(AC-11 集成/手动验收, defer 单元测试)**. 1a.10 只验 AC-1..AC-8 + AC-13 配置入口与触发逻辑就绪.
- **Q6 - 预存 e2e flaky 脆断言 flow-render AC-17 已裁定 = (b) chore PR #72 reframing builtInstances**: 根因(实测 @b426751 跨跑 flaky: 前会话 2 红 afterFlowPx=18512 < baselinePx≈18555 ~0.2% + 本会话 1 绿) = `e2e/flow-render.spec.ts:143` 断言 `afterFlowPx > baselinePx` 用绝对像素数测渲染, 受 stock 数字字形 glitch 动画(animation.ts:135-151 次 50ms 轮换 ASCII 字形) + rAF readPixels 时刻相位噪声影响(信号<噪声, 脆断). 已执行 (b): chore PR #72 把断言 reframe 为 builtInstances glyphIdx 确定性 channel(断言 ▶─○ 字形进 instances, flowToInstances 推定值 ─=95/▶=117/○=119 不受 glitch/flowOffset 影响), merged c217b6a, baseline e2e 40|0|21 绿. flaky 脆断言根因已除, AC-12 无例外.

## CS 阶段产出说明

- **Step1 确定目标**: story `1a-10-model-settings`, 从 sprint-status.yaml `backlog` 起, 执行链 1a.8 -> 1a.11 -> 1a.12 -> 1a-13 -> 1a.9(i18n) -> **1a.10(本)**. epic-1a 已 in-progress, 无需改 epic 状态(epics.md L683-703 story block 已存在).
- **Step2 加载/分析 artifacts**: 读 epics.md L683-703(权威 1a.10 block) + L56/L62/L90/L94(FR-SIM-1/FR-SIM-7/FR-UI-1/FR-UI-5) + L871/L876/L925/L930-933(1b.1/1b.8 跨 story 引用) + prd FR + ARCHITECTURE-SPINE(AD-5/AD-6/AD-9) + project-context.md(L67/L69/L85-87/L131-138/L142/L257) + 1a.13 story(SDR 框架 + autosave 边界 + ATDD declare-const 先例) + 1a.9 story(SettingsPanel/langStore pattern + Q5 verdict) + 1a.8 story(量纲 stub 占位策略) + story-cycle-formalization §2.1/§2.2/§2.4.
- **Step3 架构分析 + READ 待改文件(防回归)**: 全读 `src/lib/sd/dimensionalCheck.ts`(27 行, 1a.8 stub checkDimensions :25-27) + `src/lib/sd/__tests__/dimensionalCheck.test.ts`(62 行, 1a.8 AC-12 契约) + `src/lib/sd/types.ts`(ElementKind/Stock/Flow, 无 model-config type) + `src/lib/sd/i18n.ts`(105 keys post-1a.9, perTime "/ 年" :45, E27 3-tier) + `src/lib/render/Toolbar.tsx`(303 行, KEY 发现 dt selector 已存在 1a.7 AC-5 :31/:238-259 + SettingsPanel 弹层 :284-300) + `src/lib/sd/store.ts`(423 行, deriveFlowUnits :329-355 硬编码 "/dt" :342) + `src/lib/sd/autosave.ts`(392 行, 1a.13 envelope version 1 elements-only :63-66) + `src/lib/sd/errorDetection.ts`(148 行, detectDimensionalError placeholder :141) + `src/lib/render/PropertyPanel.tsx`(265 行, :194 checkDimensions per-flow 调用 + :247 deriveFlowUnits) + `src/lib/sd/formula.ts`(239 行, [单位] annotation) + `src/lib/render/CanvasView.tsx`(:198 elementStore 模块级单例 + :575 useState 0.1 + :831-832 autosave + :1670-1674 Toolbar props) + `src/lib/render/SettingsPanel.tsx`(40 行, 1a.9 只 lang toggle, 零 CSS 规则) + `src/styles.css`(ns-toolbar__* 有, ns-settings-panel 无). grep createElementStore 证 elementStore :198 模块级单例(1a.13 story L114 证). 确认 dt selector 已存在(1a.7) = 1a.10 scope 是 backing 迁移 + timeUnit 新建 + 重校验触发, 非建 dt selector. 零 fabrication(全 read/grep 核, 行号+符号+行为均真). [[memory newsd-bmad-skill-strict-invocation-and-prompt]] 防回归基线锁定.
- **Step4 web research**: 显式记录 no-op, 无新依赖, 复用 React 19 useSyncExternalStore + localStorage 现有 pattern(AD-bound, 4 store 已证), 时间单位转换 defer 1b(AD-6 无 meval in TS), 栈 version 锁不变(见 §5 Tech/依赖). [memory newsd-cs-webresearch-explicit-gate]
- **Step5 创建 story 文件**: 本文件, Status set `ready-for-dev`, 结构对齐 1a.13 enriched(minimal frontmatter + Story + AC Given/When/Then + epic L 引用 + [SDR#N] + TDD red-green task + [gov: SDR#N] + SDR 三段(设计契约/保留不变量/流程 meta) + 域模型对账表 + 引用架构约束 + 项目结构 + Tech/依赖 + 测试标准 + Gate 红线 + References + Dev Agent Record + VS/CR 占位 + SAVE QUESTIONS + CS 产出说明). 中文 + 半角标点.
- **Step6 验证 + sprint-status 更新**: 对照 checklist.md 验证; 更新 sprint-status.yaml `1a-10-model-settings: backlog -> ready-for-dev` + `last_updated -> 2026-07-24`; 报告完成. **baseline e2e 实测**: @b426751 跨跑 flaky(flow-render AC-17 afterFlowPx>baselinePx 脆断, 非本 story 引入) | 21 skipped. 已裁定处置 = (b) chore PR #72 reframing builtInstances(断言 ▶─○ 字形进 instances 确定性 channel, merged c217b6a), baseline e2e 40|0|21 绿, flaky 脆断言根因已除. 已据此修正 frontmatter/AC-12/SDR#24/§6/§7/Verification 表的 e2e 基线口径(flaky->已修, baseline @c217b6a). vitest 797|1skip/43files + tsc 0 实测绿. **CS 不推 PR**(CS 产出 = story 文件 + sprint-status 更新, 留工作树供 DS 续做; [[memory newsd-pr-before-merge-report-gate]]).
