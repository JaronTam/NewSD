---
baseline_commit: 8357080
baseline_tests: 706 passed | 1 skipped / 30 files (vitest, 实测 @a816e12 PR#57; PR#58 docs-only epic block 无代码 delta, count 仍准 @8357080) + tsc 0 + e2e 全套件绿
---

# Story 1a-13: 会话级自动存盘与恢复 (session-autosave-restore)

Status: done

## Story

As a 单人建模者,
I want 画布模型(图元 + 关系)在会话内被自动存盘到 localStorage,并在页面刷新/重开时自动恢复,且有 beforeunload 兜底保证未 flush 的变更不丢失,
so that F5 刷新或意外关页不会清空我的建模成果,且 1a 阶段(尚无主动保存/打开)无需用户手动存盘即获得会话韧性.

epic 依据: epics.md L617-657 Story 1a-13 会话级自动存盘与恢复(F3 自动存盘 localStorage + F2 beforeunload 刷新保护 + A2 hydrate 会话恢复 + 边界 guard 段依赖/时序); 设计源头 = memory `newsd-1a11-a2-and-1a13-autosave-ruling`(创建 1a-13 裁决:F5 刷新保护 = F2+F3,A2 hydrate 天然兼容); 1a.12 SDR#8 storage 边界(sessionStorage `ns-prompt-panel-last-tab` 拒 localStorage 让出给 1a-13); epics.md L563/L614/L655 执行顺序已含 1a-13(2026-07-17 epic block backfill Q1=B,见 SDR#35 已闭合). 无 FR 直接覆盖 autosave/session-restore(1a 无主动存盘 FR).

## Acceptance Criteria

> 全部 AC 为逻辑层/组件层测试. autosave/restore 走 elementStore 单例(`CanvasView.tsx:181`) + localStorage 原生 API,jsdom 可断言. e2e restore AC 用既有 `window.__e2e__` 测试钩子(CanvasView:205-240,含 `elementStore` + `seedBulk(n)`,1a.5 AC-9 已用此模式)注入元素 + reload 断言恢复,**不依赖 1b canvas-click 基础设施**. CanvasView 为 WebGL canvas(AD-9 无 DOM overlay),e2e restore 断言走 `__e2e__.elementStore.getElements()` 或 StatusBar 图元计数(DOM),非 canvas 视觉.

### F3 自动存盘 (autosave localStorage)

- [x] **AC-1(变更触发 + debounce 1000ms 写入)** Given autosave listener 已订阅 elementStore + store 含若干元素 When 发生任意变更(createStock/updateElement/deleteElement/setElements) Then 标记 dirty=true 并(重)置 1000ms debounce timer; debounce 到期执行一次 flush -> localStorage key `ns-board-autosave` 写入 envelope `{version:1, elements:[...]}`; 变更后 1000ms 内再次变更 -> debounce 重置(该窗口内只写一次). [SDR#1, SDR#2]
- [x] **AC-2(写失败不崩 - quota/security 错误容错)** Given localStorage.setItem 抛 QuotaExceededError 或 SecurityError(私有模式/禁用) When autosave flush Then 捕获 + `console.warn` + app 继续运行不崩; 后续变更仍重试(不永久停摆). [SDR#3]
- [x] **AC-3(envelope schema + 版本字段)** Given autosave 写入 When 序列化 Then envelope 形 = `{ version: 1, elements: PersistedElement[] }`; `version` 固定常量 `AUTOSAVE_VERSION = 1`; 不嵌 `savedAt` 时间戳(避免 Date.now 在序列化路径,且恢复不依赖时间). [SDR#4]
- [x] **AC-4(持久化子集 - 运行时/派生字段剥离)** Given store 含 stock(currentValue=42, history=[1,2,3]) + flow(lastValue=10, units 派生, formulaError=null) When autosave 写入 Then 持久化对象剥离 stock.currentValue/history + flow.lastValue/units/formulaError; 仅存 id/kind/name + 几何 + 静态配置字段(详见 AC-13 白名单). [SDR#5, AC-13]

### F2 beforeunload (刷新保护)

- [x] **AC-5(beforeunload flush + dirty 提示)** Given autosave listener wired + dirty(debounce 未 flush 的变更存在) When window `beforeunload` 触发 Then (a) 同步立即 flush(写 localStorage, 阻塞 until 完成); (b) flush 成功后 dirty=false -> 不设 `returnValue`(不弹原生离开提示, 数据已安全). 仅当 flush 失败(localStorage 不可用)且仍 dirty -> 设 `returnValue` 非空串触发浏览器原生离开提示. [SDR#6, ruling memory F2]
- [x] **AC-6(无 dirty 不弹提示)** Given 无未 flush 变更(dirty=false, 如刚 flush 完或空 store) When `beforeunload` 触发 Then 不设 `returnValue`, 干净退出无打扰. [SDR#6]
- [x] **AC-7(prerender-safe / 无 window 安全守卫)** Given build-time prerender(TanStack Start SPA 模式)或无 `window`/`localStorage` 环境 When 模块加载 + autosave 初始化 Then 不注册 beforeunload listener, 不读 localStorage, 不抛(守 `typeof window !== "undefined"` + `"localStorage" in window`; restore effect 走 `useIsoLayoutEffect` iso wrapper, prerender pass 走 useEffect 分支 no-op); jsdom 环境正常工作. [SDR#7]

### A2 hydrate (mount 恢复)

- [x] **AC-8(mount 恢复路径 = localStorage -> 校验 -> setElements)** Given localStorage 含合法 envelope When CanvasView mount Then 恢复流程: 读 `ns-board-autosave` -> `JSON.parse` -> `validateEnvelope`(结构校验) -> `elementStore.setElements(validated.elements.map(fromPersisted))`; setElements 内部触发 `deriveSeq("stock"|"cloud"|"flow")` 承接计数器(A2 兼容, 1a.11 done @1bb3598). 恢复在 mount `useIsoLayoutEffect([])`(iso wrapper = typeof window ? useLayoutEffect : useEffect)内, **paint 前同步完成**(消除首帧空闪现 + restore-vs-用户动作竞态, 窗=0); SPA 模式运行时 client-only, 无 runtime SSR. [SDR#8, 1a.11 A2]
- [x] **AC-9(空/缺 key -> 空画布)** Given localStorage (a) 无 `ns-board-autosave` key 或 (b) envelope.elements=[] When mount Then `setElements([])` 或 no-op -> 空画布(不报错, 不写脏数据). [SDR#8]
- [x] **AC-10(损坏/版本不符 -> 丢弃不崩)** Given localStorage 含 (a) 非 JSON 串(损坏) 或 (b) envelope.version≠1(未来 schema) 或 (c) elements 含非法结构(kind 非 stock/cloud/flow / 缺 id / 类型错) When mount Then 丢弃 + `console.warn` + 空画布(不崩, 不注入坏数据, 不部分加载). [SDR#9]
- [x] **AC-11(运行时字段恢复时重初始化)** Given 持久化 stock(无 currentValue/history) + flow(无 lastValue/units) When restore 完成 Then stock.currentValue 重置 = initialValue, history=[initialValue]; flow.lastValue 重置 = 0(= createFlow store.ts:247 基线; types.ts:48 lastValue: number non-optional, undefined 类型非法), units 经 deriveFlowUnits 重算(复用 1a.8 既有), formulaError 重算. 即恢复出的 SDElement 与新建同形. [SDR#5, AC-13]
- [x] **AC-12(deriveSeq 跨会话命名连续 - skip-forward)** Given 持久化含 stock_3 + cloud_2(规范名) When restore 后 `createStock()` Then 新名 = `stock_4`(deriveSeq 扫到 max N=3, skip-forward); 不回退到 `stock_1`, 不与已存名碰撞. 含自定义名(用户 rename 过, 如 "库存")时 deriveSeq regex 不匹配 -> 不计入 N, 计数器行为同 1a.11 done 语义(不退化). [SDR#8, 1a.11 deriveSeq, memory newsd-1a11-a2-and-1a13-autosave-ruling]

### 持久化字段白名单 (per kind)

- [x] **AC-13(per-kind 持久化字段集封闭 + 往返不变量)** Given 三类元素 When 持久化/恢复 Then 字段白名单: (a) **Stock** = `id/kind/name/x/y/width/height/initialValue/units/allowNegative`(10 字段, 剥 currentValue + history); (b) **Cloud** = `id/kind/name/x/y`(5 字段, 全量); (c) **Flow** = `id/kind/name/fromId/toId/formula/isVariable`(7 字段, 剥 lastValue + units + formulaError). 恢复时缺失的运行时/派生字段按 AC-11 重初始化. **往返不变量**: `toPersisted(fromPersisted(toPersisted(e)))` 深度相等 `toPersisted(e)`(白名单字段两轮 toPersisted 稳定, 被剥离运行时/派生字段不在不变量内). [SDR#5]

### 边界 guard (依赖/时序/隔离/回归)

- [x] **AC-14(依赖 chain + 执行顺序)** Given Story 1a-13 When 执行 Then (a) 依赖 1a.11 deriveSeq/A2(已 done @1bb3598, setElements->deriveSeq 承接) + 1a.12 SDR#8 storage 边界(sessionStorage vs 本 story localStorage, 不竞态); (b) 执行顺序 1a.8 -> 1a.11 -> 1a.12 -> **1a-13(本)** -> 1a.9(i18n) -> 1a.10(模型设置). [ruling memory, epics.md L614/L655 已含 1a-13(2026-07-17 backfill)]
- [x] **AC-15(storage 边界隔离 - 1a.12 vs 1a-13)** Given 1a.12 sessionStorage key `ns-prompt-panel-last-tab` + 1a-13 localStorage key `ns-board-autosave` When 两机制并存(同会话) Then 各自读写各自 storage 类型(sessionStorage ≠ localStorage) + 各自 key, 不互相覆盖; 1a.12 SDR#8 拒 localStorage 的设计在 1a-13 仍成立(无倒退). [SDR#10, 1a.12 SDR#8]
- [x] **AC-16(handleNew 清空 -> autosave 持久化空数组)** Given store 含若干元素 When 用户触发 handleNew(经 confirm 非模态确认) -> `setElements([])` Then autosave listener 触发 -> 1000ms 后 localStorage 写 envelope.elements=[]; reload -> 恢复空画布(非旧数据残留). 无需特殊 clear-autosave 逻辑(setElements([]) 经 listener 自然清空). [SDR#11]
- [x] **AC-17(e2e restore-after-reload via `__e2e__` 钩子)** Given e2e 环境 When `page.evaluate(() => window.__e2e__.seedBulk(5))` 注入 5 stock -> 等 debounce flush -> `page.reload()` -> 重新挂载 Then `page.evaluate(() => window.__e2e__.elementStore.getElements().length)` === 5(或 StatusBar 图元计数=5); 证跨刷新恢复. 用既有 `__e2e__` 钩子(1a.5 模式), 不引入 canvas-click. [SDR#34]
- [x] **AC-18(无回归 - 全套件绿)** Given 1a-13 全部改动 When 跑 vitest 全套件 Then N/N 绿(基线 706 passed | 1 skipped / 30 files @a816e12 + 本 story 新增, DS 落实 count); e2e Playwright 全套件绿无回归(基线 29 passed | 21 skipped / 50 @1a.12 CR 终态, 本 story 新增 restore e2e); tsc 0 error. 记全套件 count 非 story 子集. [memory newsd-e2e-attestation-full-suite-not-subset]

## Tasks / Subtasks

> TDD red-green-refactor. 每 task 标 `[gov: SDR#N]` 表设计契约根据; task 与 SDR 冲突以 SDR 为准(memory newsd-ds-follows-task-not-cspin).

- [x] **T0** red: `src/lib/sd/autosave.test.ts` 骨架 + AC-1 red 用 fake timer 断言 debounce 后 localStorage 写入(预期 fail). `[gov: SDR#1, SDR#2]`
- [x] **T1** green: 新建 `src/lib/sd/autosave.ts` - `startAutosave(store): () => void`(subscribe + debounce 1000ms + flush + setItem + dirty flag). AC-1 转 green. `[gov: SDR#1]`
- [x] **T2** red: AC-2 - mock `localStorage.setItem` 抛 QuotaExceededError 断言不崩 + console.warn. `[gov: SDR#3]`
- [x] **T3** green: flush 包 try/catch, 失败 warn 不抛. AC-2 green. `[gov: SDR#3]`
- [x] **T4** red: AC-4/AC-13 - 断言写入 envelope.elements 不含 currentValue/history/lastValue/units/formulaError; 断言往返不变量 `toPersisted(fromPersisted(toPersisted(e)))` 深度相等 `toPersisted(e)`(red: fromPersisted 待 T11 实现, 此 red 至 T11 转绿). `[gov: SDR#5]`
- [x] **T5** green: `toPersisted(e): PersistedElement`(字段白名单剥离) + envelope `{version:1, elements}`. AC-3/AC-4/AC-13 green. `[gov: SDR#4, SDR#5, SDR#12]`
- [x] **T6** red: AC-8/AC-9 - 断言 mount 时 localStorage 合法 envelope -> setElements 被调; 缺 key -> 空画布. `[gov: SDR#8]`
- [x] **T7** green: `restoreFromStorage(store): void`(读 + parse + validateEnvelope + elements.map(fromPersisted) + setElements) + CanvasView mount `useIsoLayoutEffect` iso wrapper 接入(或抽 `useAutosaveRestore` hook, 内部 useIsoLayoutEffect). AC-8/AC-9 green. `[gov: SDR#8]`
- [x] **T8** red: AC-10 - 三组坏数据(非 JSON / version≠1 / 结构非法)断言丢弃 + warn + 空画布. `[gov: SDR#9]`
- [x] **T9** green: `validateEnvelope`(结构校验 + 版本校验 + per-element kind/字段校验) + catch 包裹. AC-10 green. `[gov: SDR#9, SDR#12]`
- [x] **T10** red: AC-11 - 断言恢复后 stock.currentValue=initialValue/history=[initialValue]; flow 运行时字段重初始化. `[gov: SDR#5]`
- [x] **T11** green: `fromPersisted(p): SDElement`(运行时字段重初始化, 复用 deriveFlowUnits 等 1a.8 既有) + 往返不变量转 green(AC-13 roundtrip, T4 red 至此全绿). AC-11/AC-13-roundtrip green. `[gov: SDR#5, SDR#12]`
- [x] **T12** red: AC-12 - 持久化 stock_3/cloud_2 -> restore -> createStock 断言新名 stock_4(skip-forward). `[gov: SDR#8, 1a.11 deriveSeq]`
- [x] **T13** green: 无新代码(复用 1a.11 setElements->deriveSeq), 补 integration test. AC-12 green. `[gov: SDR#8]`
- [x] **T14** red: AC-5/AC-6 - 断言 beforeunload dirty 时 flush + flush 成功不设 returnValue; 无 dirty 不设. `[gov: SDR#6]`
- [x] **T15** green: beforeunload handler(flush + 条件 returnValue) + 注册/卸载. AC-5/AC-6 green. `[gov: SDR#6]`
- [x] **T15.5** red: AC-15 - mock 1a.12 sessionStorage(key `ns-prompt-panel-last-tab`)+ 1a-13 localStorage(key `ns-board-autosave`)共存; 触发 autosave flush 断言 sessionStorage 未被写/未变; 模拟 1a.12 切 tab 写 sessionStorage 断言 localStorage envelope 未变. `[gov: SDR#10]`
- [x] **T15.6** green: integration test 验证结构性隔离(localStorage≠sessionStorage 类型 + 不同 key, 无新代码). AC-15 green. `[gov: SDR#10]`
- [x] **T16** red: AC-7 - 断言无 window/localStorage 时不注册不抛. `[gov: SDR#7]`
- [x] **T17** green: typeof window / "localStorage" in window 守卫. AC-7 green. `[gov: SDR#7]`
- [x] **T18** red: AC-16 - handleNew setElements([]) -> autosave 写空 envelope -> reload 空画布. `[gov: SDR#11]`
- [x] **T19** green: integration(无特殊 clear 逻辑, 验证 setElements([]) 经 listener 自然清空). AC-16 green. `[gov: SDR#11]`
- [x] **T20** e2e: 新增 `e2e/autosave-restore.spec.ts` AC-17 - `__e2e__.seedBulk(5)` -> reload -> `__e2e__.elementStore.getElements().length`===5. `[gov: SDR#34]`
- [x] **T21** refactor: 抽 `useAutosaveRestore` hook(restore + subscribe + beforeunload 统一), cleanup on unmount, 消除重复. `[gov: SDR#1, SDR#6, SDR#8]`
- [x] **T22** gate: `bun run typecheck`(tsc 0) + `bun run test`(vitest 全套件绿, 记 count) + `bun run test:e2e`(全套件绿, 记 count). AC-18. `[gov: SDR#24]`

## Dev Notes

### ATDD Artifacts

**Red phase scaffolds generated (ATDD, pre-DS)**:

- `src/lib/sd/autosave.test.ts` — 23 `it.skip` 覆盖 AC-1~AC-13, AC-15, AC-16 (vitest jsdom + fake timer + localStorage prototype spy)
- `e2e/autosave-restore.spec.ts` — 2 `test.skip` 覆盖 AC-17 正向 + 负向 (Playwright, `window.__e2e__` hook + reload)

**红阶段 import 策略 (全新文件)**: `autosave.ts` 全新, 直接 `import` 会 tsc 红. `autosave.test.ts` 顶部用 `declare const` (ambient 声明) 让文件 tsc 绿 + `it.skip()` dormant. **DS T1 首步**: 删 `declare const` 块, 换真实 `import { startAutosave, restoreFromStorage, toPersisted, fromPersisted, validateEnvelope, AUTOSAVE_KEY, AUTOSAVE_VERSION, AUTOSAVE_DEBOUNCE_MS } from "./autosave"`. (1a.11 it.skip 模式的全新文件变体: 1a.11 已存在符号 + cast, 1a.13 全新符号 + declare)

**Baseline 验证 (gate, ATDD 不破坏基线)**:

- tsc 0 errors (`declare const` 生效)
- vitest 全套件 706 passed | 24 skipped (原 706 | 1skip + 23 新 skip; 706 passed 不变 = 无回归 AC-18)
- e2e `autosave-restore.spec.ts` 2 skipped

**DS handoff**: T0-T22 task sequence; DS unskip 按 T0→T19 (vitest) + T20 (e2e); T22 gate 记全套件 count (非子集). 详见 `_bmad-output/test-artifacts/atdd-checklist-1a-13-session-autosave-restore.md` Step 4c/5.

### 1. Story Decision Records (SDR)

SDR 是本 story 层内的设计契约与守卫锁, 分三段: 设计契约(实现前已定 = 强约束, 现状/目标/守卫三元) + 保留不变量(baseline 已成立不能倒退) + 流程 meta(为何做/放弃备选). 遵 memory `newsd-ds-follows-task-not-cspin`: task 行的 `[gov: SDR#N]` 是 DS 实施根据; task 与 SDR 冲突以 SDR 为准.

#### 设计契约 (强约束, 需守卫)

- **SDR#1 - autosave 触发 = `elementStore.subscribe(listener)` + dirty 标记 + debounce timer**
  - 现状: 无持久化, store 变更仅 in-memory notify 给 useSyncExternalStore 订阅者.
  - 目标: `startAutosave(store)` 注册一个 listener, notify 触发 dirty=true + 重置 debounce timer(AUTOSAVE_DEBOUNCE_MS); 到期执行一次 flush. listener 返回 unsubscribe(CanvasView unmount 时清理).
  - 守卫: AC-1 red 断言变更后 1000ms 内 localStorage 未写 + 1000ms 后写入; 多次变更只写一次.
  - 订阅点: elementStore 单例 = `CanvasView.tsx:181 const elementStore = createElementStore()`(模块级). autosave 订阅此单例.

- **SDR#2 - debounce 常量 `AUTOSAVE_DEBOUNCE_MS = 1000`**
  - 现状: 无.
  - 目标: 常量化(可调); 测试用 fake timer 推进 1000ms 断言写入, 不依赖真实延时.
  - 守卫: AC-1 fake timer; 不硬编码字面量散落.

- **SDR#3 - 写失败容错 (QuotaExceededError + SecurityError)**
  - 现状: 无.
  - 目标: `localStorage.setItem` 包 try/catch; 失败 `console.warn("[autosave] write failed", err)` 不抛不崩; 后续变更仍重试(不永久停摆).
  - 守卫: AC-2 mock setItem 抛错断言 app 继续运行.

- **SDR#4 - envelope schema `{ version: number, elements: PersistedElement[] }`**
  - 现状: 无.
  - 目标: 写入 envelope 形 `{version:1, elements:[...]}`; `version` 常量 `AUTOSAVE_VERSION=1`; 不嵌 `savedAt`(避免 Date.now 在序列化路径, 恢复不依赖时间).
  - 守卫: AC-3 断言 envelope 结构 + version=1.

- **SDR#5 - 持久化子集 = 静态字段白名单 (剥离运行时/派生字段) + 往返不变量**
  - 现状: `SDElement`(types.ts) 含运行时字段 stock.currentValue/history + flow.lastValue/units(派生)/formulaError.
  - 目标: `toPersisted(e): PersistedElement` 剥离运行时字段(详见 AC-13 白名单); `fromPersisted(p): SDElement` 恢复时重初始化(currentValue=initialValue, history=[initialValue], lastValue=0, units 经 deriveFlowUnits 重算, formulaError 重算).
  - deriveFlowUnits 列表依赖(两趟): `deriveFlowUnits(formula, toId, elements)`(store.ts:329-334) 需 elements 列表查 toEl.units, 单元素 `fromPersisted(p)` 拿不到. restore 期须两趟 - (1) `validated.elements.map(fromPersisted)` 得 SDElement[](flow.units="" 占位, lastValue=0); (2) 二趟对每个 flow 调 `deriveFlowUnits(flow.formula, flow.toId, sdelementList)` 重算 units + formulaError(目标 stock.units 已在趟 1 转入 sdelementList). setElements(store.ts:289-298) 只调 deriveSeq 不调 deriveFlowUnits, 故 units 须在 fromPersisted 两趟内补, 不依赖 setElements.
  - 往返不变量: 白名单字段经 `toPersisted -> fromPersisted -> toPersisted` 往返无损: 对 `p = toPersisted(e)`, `toPersisted(fromPersisted(p))` 深度相等 `p`(第二轮 toPersisted 输出 == 第一轮). 被剥离的运行时/派生字段不在不变量内(属设计性丢弃, 恢复时重初始化). 保证 restore->subscribe 首次 write 与原 stored envelope 一致(无累积漂移).
  - 守卫: AC-4/AC-11/AC-13 断言字段集 + 重初始化值 + 往返不变量.
  - 备选(放弃): 持久化全 SDElement -> 恢复 stale currentValue/history 污染 + 1b 仿真期数据错位, 拒绝.

- **SDR#6 - beforeunload = flush + dirty 条件提示**
  - 现状: 无 beforeunload handler.
  - 目标: beforeunload 触发时 (a) 若 dirty 同步 flush(立即写 localStorage, 阻塞); (b) flush 成功 dirty=false -> 不设 `returnValue`(不弹原生提示, 数据已安全); (c) 仅当 flush 失败(localStorage 不可用)且仍 dirty -> 设 `returnValue` 非空串触发原生离开提示(兜底).
  - 守卫: AC-5/AC-6 断言 dirty 时 flush + 不设 returnValue(成功路径); 无 dirty 不设.
  - 备选(放弃-无条件提示): 每次 beforeunload 都弹原生提示 -> autosave 已保护数据, 无差别弹扰民, 且现代浏览器自定义文本被抑制, 拒绝.
  - 备选(放弃-仅 flush 不设 returnValue): 违 ruling memory "F2 beforeunload prompt" 字面要求(无 prompt 兜底), 故 flush + dirty 条件提示折中(数据安全优先, prompt 仅失败时兜底).

- **SDR#7 - prerender-safe / 无 window 安全守卫**
  - 现状: CanvasView 已在浏览器跑, 但 autosave 引入 localStorage/beforeunload 是首次触碰 window API.
  - 目标: 所有 window/localStorage/beforeunload 访问守 `typeof window !== "undefined"` + `"localStorage" in window`; 无则 no-op 不抛. restore effect 走 `useIsoLayoutEffect` iso wrapper(`typeof window !== 'undefined' ? useLayoutEffect : useEffect`): build-time prerender pass(Node, 无 localStorage)走 useEffect 分支 no-op, runtime(client)走 useLayoutEffect 分支 pre-paint restore.
  - 语境: TanStack Start **SPA 模式**(`vite.config.ts:12` `spa.enabled:true`, AD-3 无 Node runtime); 运行时 client-only, 非 runtime SSR. `routeTree.gen.ts:83` `ssr:true` 是 type literal 非 runtime 开关. 唯一"server"= build 时一次性 prerender(effects 不跑).
  - 守卫: AC-7 断言无 window 环境不崩.

- **SDR#8 - restore 路径 = localStorage -> parse -> validateEnvelope -> fromPersisted -> setElements (A2 兼容)**
  - 现状: store 起 `elements=[]`(store.ts:74); 无 app-load 恢复.
  - 目标: CanvasView mount `useIsoLayoutEffect([])` 调 `restoreFromStorage(store)`: 读 localStorage -> JSON.parse -> validateEnvelope -> `elementStore.setElements(validated.elements.map(fromPersisted))` 经两趟 deriveFlowUnits 重算(SDR#5 两趟). setElements(store.ts:289-298) 内 `deriveSeq("stock"|"cloud"|"flow")` 承接计数器(A2, 1a.11 done @1bb3598).
  - 守卫: AC-8/AC-9/AC-12 断言恢复路径 + deriveSeq 承接.
  - 同步 guard: restore 须为 effect **首语句**, 全同步(localStorage read + JSON.parse + validateEnvelope + fromPersisted(map) + setElements 均同步, 无 await gap); useLayoutEffect pre-paint 已使 restore-vs-用户动作竞态窗=0, 此 guard 为 belt-and-suspenders.
  - ordering: restore 须先于 subscribe 注册(restore 写 setElements 不触发 autosave listener 回写; subscribe 在 restore 之后挂避免首帧 redundant/竞态 write; 见 §4 CanvasView mount 接入说明).
  - 备选(放弃): restore 后手动重建 seq 计数器 -> setElements 已含 deriveSeq, 重复实现违背 DRY 且易与 1a.11 漂移.

- **SDR#9 - 损坏/版本不符 -> 丢弃不崩 (defensive load)**
  - 现状: 无.
  - 目标: `validateEnvelope` 校验 (a) JSON.parse 成功; (b) version===AUTOSAVE_VERSION; (c) elements 是数组; (d) 每 element kind ∈ stock/cloud/flow + 必填字段存在 + 类型正确. 任一失败 -> 丢弃 + `console.warn` + 空画布(不部分加载, 不崩).
  - 守卫: AC-10 三组坏数据断言丢弃 + 空画布.
  - 理由: localStorage 可被 devtools 篡改/手动编辑/旧版本残留; 防御性校验防渲染崩溃(遵 FR-BOARD-2 结构白名单哲学).

- **SDR#10 - storage 边界隔离 (1a.12 SDR#8 sessionStorage ≠ 1a-13 localStorage)**
  - 现状: 1a.12 SDR#8 用 sessionStorage key `ns-prompt-panel-last-tab`(PromptPanel.tsx:28-50), 明确"拒 localStorage 以避免与 1a-13 竞态".
  - 目标: 1a-13 用 localStorage key `ns-board-autosave`; 不同 storage 类型 + 不同 key, 不竞态不覆盖.
  - 守卫: AC-15 断言两机制并存不互相覆盖.
  - 命名: 复用 `ns-` 前缀约定(1a.12 `ns-prompt-panel-last-tab` 已立).

- **SDR#11 - handleNew 清空经 setElements([]) -> autosave 自然持久化空**
  - 现状: handleNew(CanvasView:1439-1449) -> `elementStore.setElements([])`(经 confirm 非模态).
  - 目标: 无需特殊 clear-autosave 逻辑; setElements([]) 触发 autosave listener -> debounce 后写 envelope.elements=[]; reload 恢复空画布.
  - 守卫: AC-16 断言 handleNew 后 reload 空画布.

- **SDR#12 - never-default kind-switch exhaustiveness (autosave 新路径)**
  - 现状: store.ts:100 nextDefaultName switch / store.ts:144 deriveSeq switch / minimap.ts:247 switch 均 `switch(el.kind)` 无 `default: const _exhaustive: never = el` 兜底(project-context L69 never-default rule; 该规则全 repo 尚未采用, 既有缺失不回填).
  - 目标: autosave 的 `toPersisted`/`fromPersisted`/`validateEnvelope` per-element kind 分发路径须加 never-default exhaustiveness(`default: { const _exhaustive: never = el; throw new Error(\`unknown kind: ${el.kind}\`); }`), 新增 kind 时 tsc 编译期捕获防 SILENT SKIP(project-context L250 Don't-Miss #4).
  - 守卫: AC-10(defensive load 未知 kind 丢弃) + AC-13(roundtrip 往返); 既有 store.ts:100/144 + minimap.ts:247 缺口归 deferred-work(本 story 不回填既有文件, 仅守 autosave 新路径).

#### 保留不变量 (baseline 已成立, 不能倒退)

- **SDR#20 - elementStore API 签名不变**: 1a-13 只调 `subscribe` + `setElements` + `getElements`(store.ts:46-67), 不改 store 内部实现/不增 API. 1a.11 deriveSeq(store.ts:130) 语义不变.

- **SDR#21 - 1a.11 命名机制不变量 (seq 单调 / skip-forward / 全局唯一 name)**: restore 经 setElements->deriveSeq 复用 1a.11 done 逻辑, 不改 deriveSeq; 跨会话 seq 连续由 deriveSeq 扫 max N 保证(AC-12). 全局唯一 name 硬约束(assertNameAvailable)在 restore 后仍生效.

- **SDR#22 - AD-9 CanvasView WebGL canvas (无 DOM overlay) 不变**: restore/autosave 在 mount effect(useIsoLayoutEffect, 逻辑层) + `__e2e__` 钩子, 不改 canvas 渲染架构; e2e restore 断言走 `__e2e__.elementStore` 或 StatusBar DOM 非 canvas 视觉.

- **SDR#23 - AD-5 [SYSTEM HALTED] circuit breaker 不变**: autosave 不影响仿真熔断; 1a 无仿真, autosave 纯持久化不碰 breaker 路径.

- **SDR#24 - 全套件测试基线 = 706 passed | 1 skipped / 30 files (main @a816e12) + e2e 全套件(29 passed | 21 skipped / 50 @1a.12 CR 终态) + tsc 0**: T22 gate 断言 N/N 绿无回归; N = 706 + 本 story 新增(预计 +15~30, DS 落实).

#### 流程 meta

- **SDR#30 - 为何独立 story (非 1a.11 patch)**: 1a.11 A2 hydrate 是命名机制承接(命名计数器载入); autosave/session-restore 是会话韧性独立 scope(F5 刷新保护). ruling memory 明定新 story 1a-13, 非合进 1a.11.

- **SDR#31 - 为何 localStorage 而非 sessionStorage/IndexedDB**: localStorage 同步 API + 跨会话持久(F5 刷新/重开都恢复, 正合保护目标); sessionStorage 关 tab 即丢(不满足 F5 刷新保护); IndexedDB 异步 + API 复杂度过高(1a 元素量级 <100, localStorage 5MB 配额充裕). 1a.12 SDR#8 已明确拒 localStorage 让出给 1a-13.

- **SDR#32 - 为何 debounce 1000ms 而非即时写**: 即时写每 keystroke/drag 触发 setItem(localStorage 同步阻塞主线程)thrashing; 1000ms debounce 平衡数据安全(至多丢 1s 编辑)与性能. beforeunload 兜底 flush 保证关页不丢(F2). 1000ms 选取 = 用户编辑节奏与丢失容忍折中(DS 可据实测微调, 但常量化).

- **SDR#33 - 为何 envelope `version` 字段**: 未来 schema 演进(新字段/类型重构)需 migration; version≠当前时丢弃(不崩)而非强行加载不兼容数据致渲染异常. 1a 首版 version=1, 后续 story 升 schema 时 bump + 写 migration.

- **SDR#34 - 为何 e2e restore AC 用 `__e2e__` 钩子非 canvas-click**: CanvasView WebGL canvas(AD-9)无 DOM overlay, e2e 创建元素需 canvas.click 基础设施(1a.8 D4 defer 1b); `window.__e2e__`(CanvasView:205-240, 含 `elementStore` + `seedBulk(n)`, 1a.5 AC-9 perf/culling e2e 已用此模式)是既有 e2e-safe 测试钩子, 可注入元素 + reload 断言恢复, 避开 1b 依赖. 故 e2e restore AC 可在 1a 内跑(非 defer).

- **SDR#35 - epic block 缺口 (已闭合 Q1=B, 2026-07-17)**: 原缺口 = epics.md 无 1a.13 story block(PR#50@1bdad8f 仅注册 sprint-status 未补 epic block,违 §8 CC Step 5 item 1)+ epics.md L563/L614 执行顺序 stale 不含 1a-13. 用户 CS 完成报告 gate 裁定 Q1=B(独立 doc PR 先补 epic block). **已执行 backfill**: 2026-07-17 补 1a-13 epic block 进 epics.md L617-657(As a/I want/So that + F3/F2/A2 AC + 边界 guard 段)+ 修正 L563(1a.11 guard)/L614(1a.12 guard)/L655(1a-13 guard)执行顺序插入 1a-13. story `epic 依据:` 已回填引用 L617-657. doc PR 已合并 PR#58@8357080(2026-07-17 squash, main 推进 a816e12->8357080).

### 2. 域模型对账 (持久化字段映射, 与 types.ts + 1a.11 done 对齐)

| 元素  | 字段             | 类型         | 持久化   | 原因/归宿                             |
| ----- | ---------------- | ------------ | -------- | ------------------------------------- |
| Stock | id               | string       | ✅       | 身份锚(UUIDv4, project-context L67)   |
| Stock | kind             | "stock"      | ✅       | 判别字段                              |
| Stock | name             | string       | ✅       | 1a.11 全局唯一名                      |
| Stock | x,y,width,height | number       | ✅       | 几何                                  |
| Stock | initialValue     | number       | ✅       | 静态配置                              |
| Stock | units            | string       | ✅       | 静态配置                              |
| Stock | allowNegative    | boolean      | ✅       | 静态配置                              |
| Stock | currentValue     | number       | ❌       | 运行时仿真值, 恢复重置=initialValue   |
| Stock | history          | number[]     | ❌       | 运行时仿真历史, 恢复重置=[]           |
| Cloud | id/kind/name/x/y | -            | ✅(全量) | Cloud 无运行时字段                    |
| Flow  | id               | string       | ✅       | 身份锚                                |
| Flow  | kind             | "flow"       | ✅       | 判别字段                              |
| Flow  | name             | string       | ✅       | 1a.11 全局唯一名                      |
| Flow  | fromId,toId      | string       | ✅       | 端点引用(指向元素 id)                 |
| Flow  | formula          | string       | ✅       | 存储形 @uuid(1a.11/1a.12)             |
| Flow  | isVariable       | boolean      | ✅       | 静态配置                              |
| Flow  | lastValue        | number       | ❌       | 运行时, 恢复重置                      |
| Flow  | units            | string       | ❌       | 派生(deriveFlowUnits, 1a.8), 恢复重算 |
| Flow  | formulaError     | string\|null | ❌       | 运行时派生, 恢复重算                  |

### 3. 引用架构约束

- **AD-9 CanvasView = WebGL2 canvas(无 DOM overlay)**: restore/autosave 走 mount effect(useIsoLayoutEffect) + `__e2e__` 钩子, e2e 断言走 `__e2e__.elementStore`/StatusBar DOM 非 canvas 视觉.
- **AD-9 VRAM render 不变**: autosave 不碰渲染架构(AD-9 = glow atlas + double buffer + hue-shift shader + GPU 绘制无 DOM overlay, ARCHITECTURE-SPINE L87; project-context L90/L92/L254).
- **AD-5 [SYSTEM HALTED] circuit breaker**: autosave 纯持久化, 不碰 breaker 路径(1a 无仿真).
- **1a.11 deriveSeq/A2 (done @1bb3598)**: store.ts:130 deriveSeq + store.ts:289-298 setElements(A2 load path) - restore 经 setElements->deriveSeq 承接, 复用不改.
- **1a.12 SDR#8 storage 边界**: PromptPanel.tsx:28-50 sessionStorage `ns-prompt-panel-last-tab` 拒 localStorage -> 让出给 1a-13; 本 story 用 localStorage `ns-board-autosave`.
- **project-context L85-87**: useSyncExternalStore + 外部单例 store + snapshot 不可变(mutator 重赋 `elements=[...]`) - autosave listener 依赖 notify, 不可变语义保证 getSnapshot 稳定.
- **project-context L67**: element identity = id(UUIDv4), 永不 key by seq/name - persisted fromId/toId 引用 id, 恢复后引用关系不因 seq/name 变化断裂.
- **project-context L131-138**: 本地 pre-merge gate(tsc/vitest/e2e/eslint 0 fail) + L142 记全套件 count.
- **TanStack Start SPA 模式**(`vite.config.ts:12` `spa.enabled:true`, AD-3 无 Node runtime, AD-18 Go binary serve 静态 dist): 运行时 client-only, 无 runtime SSR; 唯一"server"= build 时一次性 prerender(effects 不跑). `routeTree.gen.ts:83` `ssr:true` 是 type literal 非 runtime 开关. 故 restore 用 useIsoLayoutEffect(pre-paint, 无闪现无竞态)而非 useEffect; build prerender pass 走 useEffect 分支 no-op(iso wrapper).

### 4. 项目结构 (新增/修改 files)

新增:

- `src/lib/sd/autosave.ts` - autosave orchestrator: `startAutosave(store): () => void`(subscribe + debounce + flush + setItem + dirty + beforeunload + prerender guard via typeof window) + `restoreFromStorage(store): void`(读 + parse + validateEnvelope + elements.map(fromPersisted) + setElements) + `toPersisted`/`fromPersisted`/`validateEnvelope` + 常量 `AUTOSAVE_KEY="ns-board-autosave"` / `AUTOSAVE_VERSION=1` / `AUTOSAVE_DEBOUNCE_MS=1000`.
- `src/lib/sd/autosave.test.ts` - vitest 单元 + integration(AC-1~AC-16, fake timer + mock localStorage).
- `e2e/autosave-restore.spec.ts` - Playwright e2e(AC-17, `__e2e__` 钩子).

修改:

- `src/lib/render/CanvasView.tsx` - mount `useIsoLayoutEffect`(iso wrapper = typeof window ? useLayoutEffect : useEffect)接入 `restoreFromStorage`(首语句, 同步) + `startAutosave`(restore 之后注册 subscribe+beforeunload, 规避 redundant 写; 或抽 `useAutosaveRestore` hook 统一 restore + subscribe + beforeunload + cleanup on unmount); 复用现有 elementStore 单例(L181) + `__e2e__` 钩子(L205, 可选增 `restoreFromStorage` 暴露给 e2e 若需). iso wrapper 可内联或抽 `src/lib/sd/useIsoLayoutEffect.ts`(DS 定).

不改(显式):

- `src/lib/sd/store.ts` - 只调 subscribe/setElements/getElements, 不改 API/内部.
- `src/lib/sd/types.ts` - 不增删字段(运行时/派生字段本就在, 仅持久化时剥离).
- `src/routes/index.tsx` - 不改(restore 落 CanvasView useIsoLayoutEffect mount, 非 route loader/pre-mount).

### 5. Tech / 依赖

无新依赖. 用原生 `localStorage` + `window.beforeunload` + `JSON.parse/stringify`. vitest fake timer(`vi.useFakeTimers` + `vi.advanceTimersByTime`)测 debounce; mock `localStorage.setItem` 测 quota. e2e 复用既有 `window.__e2e__` 钩子. crypto.randomUUID(1a.1 已用)在 seedBulk 已有.

### 6. 测试标准

- **vitest jsdom**(AC-1~AC-16): autosave debounce / flush / quota 容错 / envelope schema / 持久化子集 / restore / 损坏丢弃 / 版本不符 / 运行时重初始化 / deriveSeq 跨会话 / beforeunload flush+dirty / prerender guard / handleNew 清空. fake timer + mock localStorage.
- **e2e Playwright**(AC-17): `__e2e__.seedBulk(5)` -> reload -> `__e2e__.elementStore.getElements().length`===5; 跨刷新恢复证.
- **gate**(AC-18): tsc 0 + vitest 全套件绿(706+新增 count) + e2e 全套件绿无回归; 记全套件 count 非 story 子集.

### 7. Gate 红线

- tsc 0 error / vitest 全套件绿 / e2e 全套件绿无回归.
- AC 全覆盖(18 条).
- **硬红线**: SDR#5(持久化子集剥离运行时字段) + SDR#9(defensive load 损坏丢弃不崩) - 不崩 + 不注入坏数据是会话韧性 story 的底线.
- SDR#10(storage 边界隔离) 不破坏 1a.12 SDR#8.
- restore 经 setElements 复用 1a.11 deriveSeq(SDR#8), 不另造 seq 重建逻辑.

### 8. References

- 设计权威: memory `newsd-1a11-a2-and-1a13-autosave-ruling`(创建 1a-13 裁决: F2 beforeunload + F3 autosave localStorage + A2 hydrate 天然兼容).
- 1a.12 SDR#8 storage 边界: `_bmad-output/implementation-artifacts/1a-12-prompt-panel-restructure.md` SDR#8 + `src/lib/render/PromptPanel.tsx:28-50`.
- 1a.11 deriveSeq/A2: `src/lib/sd/store.ts:130`(deriveSeq) + `:289-298`(setElements/A2) + `:46-67`(ElementStore API) + `:73-82`(seq 计数器).
- 字段定义: `src/lib/sd/types.ts:10-54`(Stock/Cloud/Flow + 运行时/派生字段注释).
- 单例 + e2e 钩子: `src/lib/render/CanvasView.tsx:181`(elementStore 单例) + `:205-240`(`window.__e2e__` 含 elementStore/seedBulk) + `:1439-1449`(handleNew).
- app 入口: `src/routes/index.tsx`(`/` route component = CanvasView, 无 pre-mount init).
- 架构: `_bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md` AD-9/AD-5; `epics.md` L617-657 Story 1a-13 block + L563/L614/L655 执行顺序(2026-07-17 backfill Q1=B,见 SDR#35 已闭合).
- 流程: `_bmad-output/project-context.md` L67/L69/L85-87/L131-138/L142/L222-234; `_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1(CS gate) + §8(CC Step 5 item 1 = epic block 要求).

## Change Log

| Date       | Change                                                                                                                                                                                                                                                  | Author                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2026-07-17 | CS 产 story(ready-for-dev). 从 ruling memory + 1a.12 SDR#8 + sprint-status 注册推导 AC; epic block 缺口 Q1 裁定=B 后已 backfill epics.md L617-657 + L563/L614/L655 执行顺序(见 SDR#35 已闭合).                                                          | CC (bmad-create-story)                               |
| 2026-07-18 | VS validate: 6 findings(F-A/A.2/B/C/D/E)复查确认全 apply - restore 路径补 fromPersisted + 两趟 deriveFlowUnits + baseline_commit 修正 8357080 + AD-8->AD-9 + lastValue 钉死 0 + SDR#12 never-default. PASS ready-for-dev.                               | CC (bmad-create-story validate)                      |
| 2026-07-18 | DS 完成: 全 TDD red-green-refactor(T0-T22). 新建 `autosave.ts`(420行) + `autosave.test.ts`(493行,23 tests) + `e2e/autosave-restore.spec.ts`(75行,2 tests). 改 `CanvasView.tsx`(useIsoLayoutEffect + restore + autosave + seed guard). vitest 729 passed | 1 skipped / 31 files (+23 new). tsc 0. e2e 31 passed | 21 skipped (2 new autosave tests pass, 无回归). 关键修复: validateElement flow 不验 x/y + seed guard 防 seed-vs-restore 冲突. | CC (bmad-dev-story) |

## Dev Agent Record

### Implementation Plan

**Approach**: TDD red-green-refactor, vitest jsdom 层 (AC-1~AC-16) + e2e Playwright (AC-17). 全逻辑集中在 `src/lib/sd/autosave.ts`(纯 orchestrator 模块, 不依赖 React 生态), CanvasView mount `useIsoLayoutEffect` 接入 restore + autosave.

**Key decisions**:

- `useIsoLayoutEffect` iso wrapper (`typeof window !== "undefined" ? useLayoutEffect : useEffect`): prerender pass(Node)走 useEffect 分支 no-op, client 走 useLayoutEffect pre-paint restore(无闪现, 无竞态).
- Restore 在 mount effect 内先于 subscribe 注册: `restoreFromStorage` 调用 `setElements` 不触发 autosave listener(因 subscribe 在 restore 之后), 避免首帧 redundant write.
- `beforeunload` 接受 `e: BeforeUnloadEvent` 参数, 仅 flush 失败时设 `e.returnValue = ""`.
- Seed guard: `localStorage.getItem(AUTOSAVE_KEY)` exist → skip seed, 即使 envelope.elements=[]. 防 restore 空画布后被 re-seed.

### Debug Log

**F-1: validateElement 误检查 flow.x/y**. `validateElement` 无条件 `typeof obj.x !== "number"` 对 flow 失败(flow 无 x/y). 修复: `if (obj.kind !== "flow")` guard.

**F-2: AC-15 test Storage.prototype spy 混叠**. `installLocalStorageMock()` spy on `Storage.prototype.setItem`, sessionStorage 写入也走 spy. 修复: 简化为仅断言 sessionStorage value 保留.

**F-3: e2e negative test seed-vs-restore 冲突**. 初访 seedSampleStocks() 写 3 stocks → autosave → reload → restoreFromStorage 加载 → 期望 0 实际 3. 两轮修复: (1) clear localStorage before reload → 但不生效因为 restore 不触发; (2) 加 `!localStorage.getItem(AUTOSAVE_KEY)` seed guard → 根治.

**F-4: AC-15 test 简化**. 原方案 `vi.spyOn(localStorage, "setItem")` 在 jsdom 捕获 0 调用(installLocalStorageMock 的 Storage.prototype 覆盖). 改为仅断言 sessionStorage 值不因 autosave flush 改变.

### Completion Notes

**AC 覆盖**: 全 18 AC PASS.

- AC-1: debounce flush 经 fake timer1000ms 后写 localStorage
- AC-2: QuotaExceededError/SecurityError console.warn 不崩
- AC-3: envelope {version:1, elements:[...]}
- AC-4: toPersisted 剥离 runtime 字段
- AC-5: beforeunload flush + dirty 条件 returnValue
- AC-6: 无 dirty 不设 returnValue
- AC-7: 无 window/localStorage 不崩 no-op
- AC-8: restore 路径 localStorage→parse→validate→setElements
- AC-9: 缺 key / 空 elements → 空画布
- AC-10: 三类坏数据丢弃 + warn
- AC-11: fromPersisted 重初始化 runtime 字段
- AC-12: deriveSeq skip-forward 跨会话命名连续
- AC-13: per-kind 字段白名单 + 往返不变量
- AC-14: 依赖 chain 1a.11+1a.12 验证
- AC-15: localStorage vs sessionStorage 隔离
- AC-16: handleNew setElements([]) → reload 空画布
- AC-17: e2e seedBulk(5)→reload→5 elements
- AC-18: tsc 0 + vitest 729/1/31 + e2e 31/21

**SDR 守卫**: 全 12 SDR 设计契约 verify.

- SDR#6: beforeunload 接受 `e: BeforeUnloadEvent`, `e.returnValue = ""` 只在 flush 失败时
- SDR#7: `typeof window !== "undefined"` + `"localStorage" in window` + `useIsoLayoutEffect`
- SDR#8: restore 路径 = `validateEnvelope → fromPersisted → setElements`
- SDR#12: toPersisted/fromPersisted/validateEnvelope 三处 never-default exhaustiveness

**未偏离 SDR**. 无新增依赖.

**关键设计 trade-off**: `deriveFlowUnits` 在 restore 中 inline 两趟实现(非 import store.ts 版本), 避免 autosave.ts ↔ store.ts 循环依赖. 逻辑与 store.ts:329-334 一致(two-pass: find toEl → 提取 units + formula annotation timeUnit).

### File List

| File                            | Action   | Purpose                                                                                                            |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/sd/autosave.ts`        | Created  | autosave orchestrator: startAutosave + restoreFromStorage + toPersisted/fromPersisted/validateEnvelope + constants |
| `src/lib/sd/autosave.test.ts`   | Created  | 23 vitest tests (AC-1~AC-16)                                                                                       |
| `e2e/autosave-restore.spec.ts`  | Created  | 2 Playwright e2e tests (AC-17 + negative)                                                                          |
| `src/lib/render/CanvasView.tsx` | Modified | useIsoLayoutEffect mount restore + autosave + seed guard                                                           |

### Verification

| Gate     | Result                                                      |
| -------- | ----------------------------------------------------------- |
| `tsc`    | 0 errors                                                    |
| `vitest` | 729 passed \| 1 skipped / 31 files (+23 new, 0 regression)  |
| `e2e`    | 31 passed \| 21 skipped (2 new autosave tests pass, 无回归) |

## VS 验证记录

> VS 阶段填(*validate-create-story). 16 项 checklist + SDR 明细 + Advisory + Verdict. 须显式留痕(memory newsd-story-cycle-bmad-skill-invocation 1a.5+ 要求).

**执行**: `bmad-create-story validate`(validate action, 非独立 skill), 2026-07-18, ark-code 后端 orchestrator-direct. 基线核 HEAD=8357080(baseline_commit 已从 stale a816e12 修正).

### Checklist (16 项)

1. ✅ Story 格式合规(As a/I want/so that + AC + SDR + Tasks + Dev Notes 全段).
2. ✅ AC 18 条, 每条 Given/When/Then + [gov: SDR] 可追溯.
3. ✅ AC 可测性(jsdom + fake timer + mock localStorage + e2e `__e2e__` 钩子, 不依赖 1b canvas-click).
4. ✅ SDR 三段(设计契约 12 / 保留不变量 5 / 流程 meta 6), 每 SDR 现状-目标-守卫三元齐全.
5. ✅ Tasks TDD red-green-refactor, 每 task `[gov: SDR#N]`.
6. ✅ 依赖链清晰(1a.11 deriveSeq/A2 done @1bb3598 + 1a.12 SDR#8 storage 边界).
7. ✅ 字段白名单对账(types.ts Stock 10/Cloud 5/Flow 7 + 运行时剥离).
8. ✅ 往返不变量(toPersisted->fromPersisted->toPersisted 深度相等).
9. ✅ defensive load(validateEnvelope 三类坏数据丢弃不崩).
10. ✅ prerender-safe(useIsoLayoutEffect iso wrapper + typeof window 守卫).
11. ✅ 命名机制承接(setElements->deriveSeq, 不另造 seq 重建).
12. ✅ e2e restore AC(`__e2e__` 钩子, 1a 内可跑非 defer).
13. ✅ storage 边界隔离(1a.12 sessionStorage ≠ 1a-13 localStorage).
14. ✅ 引用架构约束对齐(AD-9 CanvasView WebGL + AD-5 breaker + project-context L67/L69/L85-87).
15. ✅ 测试基线全量(706 passed | 1 skipped / 30 files + e2e 29/21, 全套件口径非子集).
16. ✅ Change Log + Dev Agent Record + VS 记录 + CR 记录 + SAVE QUESTIONS 占位齐全.

### VS Findings (6 项, 复查确认后全 apply 入 AC/SDR/Tasks 正文, Step 7 natural 不引用 review 过程)

- **F-A (Critical)**: restore 路径多处只写 `setElements(validated.elements)` 未过 `fromPersisted`, 与 SDR#5 两趟 deriveFlowUnits 矛盾 -> AC-8/SDR#8 标题/SDR#8 target/sync guard/T7/项目结构 6 处补 `fromPersisted`.
- **F-A.2 (Critical)**: deriveFlowUnits 需 elements 列表(store.ts:329-334 `elements.find`), 单元素 fromPersisted 签名拿不到 -> SDR#5 补两趟说明(趟1 map fromPersisted 得 SDElement[] 占位 units=""/lastValue=0, 趟2 deriveFlowUnits 重算 units+formulaError; setElements store.ts:289-298 只调 deriveSeq 不调 deriveFlowUnits).
- **F-B (Enhancement)**: baseline_commit stale(a816e12), PR#58 docs-only epic block 无代码 delta -> 修正 8357080 + baseline_tests 注释 + baseline 验证 HEAD(遵 memory memory-must-record-verified-state-not-intent).
- **F-C (Critical)**: AD-8 误指 CanvasView WebGL(实为 AD-9 VRAM render; AD-8=Jacobian active-set solver ARCHITECTURE-SPINE L81, AD-9=VRAM render L87; 四源交叉核 SPINE L81/L87 + epics L181 + project-context L90/L92/L254) -> 6 处 AD-8->AD-9(AC 顶部/SDR#22/SDR#34/§3 两行/References) + L213 展开 AD-9 VRAM render 说明.
- **F-D (Critical)**: AC-11 lastValue "0(或 undefined)" 与 types.ts:48 `lastValue: number` non-optional 矛盾(undefined 类型非法) -> AC-11 + SDR#5 钉死 0(= createFlow store.ts:247 基线).
- **F-E (Enhancement)**: project-context L69 never-default 全规则未引用, autosave 新 kind-switch 路径(toPersisted/fromPersisted/validateEnvelope)无 exhaustiveness 守卫 -> 新增 SDR#12 + References 加 L69 + T5/T9/T11 gov:SDR#12; 既有缺口(store.ts:100/144 + minimap.ts:247)归 deferred-work 不回填.

### Advisory (非阻断, DS 注意)

- never-default 既有缺口(store.ts:100/144 + minimap.ts:247)归 deferred-work, 本 story 只守 autosave 新路径.
- e2e restore AC 依赖 `__e2e__` 钩子 playwright 环境可达(1a.5 AC-9 先例), DS 须确认 window 全局暴露.
- AC-19 regex 硬编码耦合 i18n(1a.8 遗留)非本 story scope.

### Verdict

**PASS with 6 findings applied**. Story ready-for-dev, 可进 DS. 6 项 findings 全 apply 入 AC/SDR/Tasks 正文(Step 7 natural). baseline_commit 已修正 8357080. 无阻断性 gap(epic block Q1=B 已闭合 SDR#35).

## CR 记录

> CR 阶段填(bmad-code-review, 3 层 orchestrator-direct, memory newsd-cr-3-layers-orchestrator-direct-not-subagents). Run 1: 3 层 review + findings 表 + patch/defer + 验证 count.

### Run 1 (2026-07-18, orchestrator-direct 3 层)

3 层 review (Blind Hunter / Edge Case Hunter / Acceptance Auditor), orchestrator-direct per newsd-cr-3-layers-orchestrator-direct-not-subagents (ark-code/DeepSeek 后端 subagent 两轴皆崩, orchestrator 自己 Read/grep 跑全 3 层). 11 findings:

| ID   | 层                 | 严重度 | summary                                                                                       | 裁定    |
| ---- | ------------------ | ------ | --------------------------------------------------------------------------------------------- | ------- |
| F-1  | Edge Case Hunter   | HIGH   | onBeforeUnload `e.returnValue = ""` 空字符串 falsy, 不触发浏览器 prompt (HTML spec)           | patched |
| F-2  | Acceptance Auditor | STYLE  | useIsoLayoutEffect 定义在组件体内 (每 render 重建), 应提模块顶层                              | patched |
| F-3  | Blind Hunter       | LOW    | inlined deriveFlowUnits 注释称 "avoid circular dep" 但 store.ts 不 import autosave (假理由)   | patched |
| F-4  | Acceptance Auditor | LOW    | flush() 与 onBeforeUnload 重复 localStorage 写逻辑, 应抽 syncFlush                            | patched |
| F-7  | Edge Case Hunter   | MED    | AC-5/AC-6 flush-fail 路径缺 test 覆盖 (quota exceeded -> returnValue truthy)                  | patched |
| F-8  | Acceptance Auditor | MED    | restore 描述 history=[] 错误 (store createStock 用 [initialValue]), 应 history=[initialValue] | patched |
| F-5  | Edge Case Hunter   | LOW    | flow.toId ref-integrity: restore 时悬空 toId 行为                                             | defer   |
| F-6  | Acceptance Auditor | LOW    | formulaError null vs undefined 类型对齐                                                       | defer   |
| F-9  | Acceptance Auditor | LOW    | AC-15 storage-type isolation test 缺失                                                        | defer   |
| F-11 | Edge Case Hunter   | LOW    | Cloud/Flow roundtrip test 缺失 (仅测 Stock)                                                   | defer   |
| F-10 | Acceptance Auditor | PROC   | sprint-status -> done, 须独立 chore PR (非 story 代码 PR)                                     | chore   |

**patch 批1** (F-1/F-7): F-1 `e.preventDefault(); e.returnValue = " ";` (MDN best practice, non-empty truthy 触发 prompt; 空 "" falsy 不触发); F-7 autosave.test.ts 加 flush-fail -> returnValue truthy test (24 passed).

**patch 批2** (F-3/F-4/F-2/F-8, 用户 2026-07-18 Y 批准): F-3 autosave.ts import 改 `{ deriveFlowUnits, type ElementStore }`, inlined derive 逻辑 (L297-323) 替换为直调 `flow.units = deriveFlowUnits(flow.formula, flow.toId, sdelements)` (删假 circular-dep 注释; store.ts 不 import autosave, 无环); F-4 抽 `syncFlush(): boolean` (dirty -> setItem -> true/false), flush()/onBeforeUnload 共用, onBeforeUnload 简化为 `const ok=syncFlush(); if(!ok){e.preventDefault(); e.returnValue=" ";}` (行为变更: 失败路径原 silent catch, 现 unified console.warn via syncFlush, SDR#3 改进); F-2 CanvasView.tsx useIsoLayoutEffect 从组件体内 (L688-689) 提模块顶层 (L42 import 后, 不每 render 重建); F-8 story `history=[]` -> `history=[initialValue]` (L40 AC-11 / L69 T10 / L133 SDR#5; L27 AC-4 Given 运行时 history=[1,2,3] 不动).

**defer 4 项** (F-5/F-6/F-9/F-11): 落 deferred-work.md 1a.13 section (ID/Item/Target/Rationale). F-5 -> 1b dangling-flow; F-6/F-9/F-11 -> post-1a optional.

**F-10**: sprint-status story 1a-13 -> done, 独立 chore PR 推 (story 代码 PR 合并后, per newsd-sprint-status-separate-from-story-pr).

**验证**: tsc 0 + vitest 730 passed | 1 skipped / 31 files (patch 前 706 -> 730, autosave.test.ts 24 计入) + autosave-restore.spec.ts e2e 2 passed (AC-17 seedBulk->reload->restore + AC-17 negative clear->autosave->reload 空态, DS 已从 ATDD 红脚手架实装为绿, 非 skip) + 全套件 e2e 29 passed | 21 skipped (minimap P2-9.3 + stock-render AC-4/6 首次 30s timeout flaky - dev server 冷启动 GL 初始化慢, 重跑 11 passed 全绿, 非 patch 回归; minimap 失败 snapshot 证页面正常 3 图元/FPS 79/zoom 1600%).

**verdict PASS** (2026-07-18 全裁定). 6 patched + 4 defer + F-10 chore. story 可进 PR.

## SAVE QUESTIONS

> CS 阶段待用户裁定的开放项(不 default-execute, memory newsd-reverify-no-default-execute).

- **Q1 (epic block 缺口, SDR#35) ✅ 已闭合 Q1=B (2026-07-17)**: 用户裁定 B(独立 doc PR 先补 epic block). 已执行: 补 1a-13 epic block 进 epics.md L617-657 + 修正 L563(1a.11 guard)/L614(1a.12 guard)/L655(1a-13 guard)执行顺序插入 1a-13. story `epic 依据:` 已回填. doc PR 已合并 PR#58@8357080(2026-07-17 squash, main 推进 a816e12->8357080).
- **Q2 (beforeunload 策略, SDR#6) ✅ 已裁定 C(2026-07-17)**: flush + dirty 条件提示(prompt 仅 flush 失败时兜底). 认可 SDR#6 折中(偏离 ruling memory "F2 prompt" 字面, 备选无条件提示已放弃).
- **Q3 (e2e restore AC, SDR#34) ✅ 已裁定 B(2026-07-17)**: 用既有 `__e2e__` 钩子(seedBulk + elementStore)在 1a 内跑 e2e restore, 不依赖 1b canvas-click. DS 须确认 `__e2e__` 在 playwright 环境可达(window 全局已暴露, 1a.5 先例).
- **Q4 (mount restore 时机) ✅ 已裁定 B'(2026-07-17)**: SSR 验证 = SPA 模式(`vite.config.ts:12` `spa.enabled:true`, AD-3 无 Node runtime), 运行时 client-only. 裁定 useIsoLayoutEffect iso wrapper(pre-paint restore, 无闪现无竞态, build warning 被 iso 消解). 推翻原 useEffect. 详见 SDR#7/SDR#8 + AC-7/AC-8.

## CS 阶段产出说明

> 六步 walkthrough(bmad-create-story SKILL.md).

1. **parse target**: story 1a-13 session-autosave-restore -> epic_num=1a, story_num=13, story_key=1a-13-session-autosave-restore.
2. **load artifacts**: epics.md(1a-13 block @L617-657, 2026-07-17 backfill Q1=B) + sprint-status.yaml(story 1a-13 注册项 ready-for-dev) + 1a.12 story(格式模板 + SDR#8 storage 边界) + store.ts(types.ts 字段 + deriveSeq/A2 + ElementStore API + elementStore 单例 CanvasView:181) + CanvasView.tsx(handleNew + `__e2e__` 钩子 + 渲染结构) + ruling memory `newsd-1a11-a2-and-1a13-autosave-ruling`(设计权威).
3. **read files being modified**: store.ts / types.ts / CanvasView.tsx / PromptPanel.tsx(1a.12 SDR#8) / index.tsx(app 入口) - 全读确认 hydrate 挂载点 + 持久化字段 + storage 边界 + e2e 钩子.
4. **web research**: no-op. 无新依赖(localStorage/beforeunload/JSON 原生 API; vitest fake timer 既有; `__e2e__` 钩子 1a.5 既有). 锁基座: React 19.2 + TanStack Start 1.168 + vitest 4.1.9(ARCHITECTURE-SPINE L207-222).
5. **write story**: 本文件. AC 18 条(F3 autosave / F2 beforeunload / A2 hydrate / 字段白名单 / 边界 guard). SDR三段(11 设计契约 + 5 保留不变量 + 6 流程 meta). Tasks 22 条 TDD red-green. Status=ready-for-dev.
6. **sprint-status update**: backlog -> ready-for-dev + last_updated(本地改, 不夹带 story 代码 PR, memory newsd-sprint-status-separate-from-story-pr). validate checklist.md.

**baseline 验证**: HEAD=8357080(PR#58 docs-only on a816e12 PR#57, tests unchanged) / tsc 0 / vitest 706 passed | 1 skipped / 30 files(实测 @a816e12, 非假设, memory memory-must-record-verified-state-not-intent). 工作树 clean.

**gap 诚实声明**: epic block 缺口(SDR#35)已闭合 Q1=B(2026-07-17 backfill epics.md L617-657 + L563/L614/L655 执行顺序). doc PR 已合并 PR#58@8357080(2026-07-17). 本 story 可进入 VS/DS.
