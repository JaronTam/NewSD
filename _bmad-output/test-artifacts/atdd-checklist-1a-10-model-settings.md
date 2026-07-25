---
storyId: "1a.10"
storyKey: "1a-10-model-settings"
storyFile: "_bmad-output/implementation-artifacts/1a-10-model-settings.md"
baseline_commit: "c217b6a"
tddPhase: "red"
stepsCompleted:
  [
    "step-01-preflight-and-context",
    "step-02-generation-mode",
    "step-03-test-strategy",
    "step-04-generate-tests",
    "step-04c-aggregate",
    "step-05-validate-and-complete",
  ]
lastStep: "step-05-validate-and-complete"
lastSaved: "2026-07-25"
generatedTestFiles:
  - "src/lib/sd/modelStore.test.ts"
  - "src/lib/sd/__tests__/dimensionalCheck.test.ts"
  - "src/lib/render/SettingsPanel.test.tsx"
  - "e2e/model-settings.spec.ts"
executionMode: "sequential orchestrator-direct"
---

# ATDD Checklist - Story 1a-10 model-settings

> DS 前 `/bmad-testarch-atdd` 产红阶段验收测试脚手架(TEA v1.19.0).
> 执行方式: sequential orchestrator-direct(ark-code 后端无 subagent, memory newsd-cr-3-layers-orchestrator-direct-not-subagents; story Dev Notes §ATDD Artifacts 明示).

## Step 1 - Preflight & Context

- **detected_stack**: `frontend`(package.json: react ^19.2 + @tanstack/react-start ^1.168.26 + vite ^8.0.16 + vitest ^4.1.9 jsdom + @playwright/test ^1.61.1 + @testing-library/react ^16.3.2; 无 backend test config, Cargo.toml 为 wasm 子模块非测试主体).
- **test framework**: vitest(jsdom, setupFiles `./src/test/setup.ts`, include `src/**/*.test.{ts,tsx}`, `@/*` alias) + playwright(testDir `./e2e`, chromium SwiftShader, webServer `FAKE_OAUTH=1 newsd.exe` :8080).
- **tsconfig include**: `src/**` + 3 config(不含 `e2e/`) -> e2e spec 不进 tsc --noEmit, 由 playwright esbuild 编译; e2e `test.skip` 不破 baseline e2e.
- **prerequisites**: story ready-for-dev(VS Run 1 PASS, 5 findings applied) ✅ / test framework configured ✅ / dev env ✅.
- **story context**: 13 AC + SDR#1-#6/#20-#24/#30-#33 + T0-T13 + ATDD Artifacts 4 文件 + declare-const 策略(SDR#33) 全定死.
- **existing patterns 实测**: langStore factory-closure singleton + useSyncExternalStore + localStorage(`ns-lang`); `window.__e2e__` hook(autosave-restore.spec); declare-const 红脚手架(1a.13 autosave.test 首例, memory newsd-atdd-red-scaffold-declare-const-for-new-file); i18n.test `MISSING_KEY as DictKey` cast 策略(dict 未 export, 经 t() 间接测 key 完整性).
- **knowledge fragments**: 跳过批量加载(1a.10 脚手架策略已在 story Dev Notes/ATDD Artifacts/SDR#33 定死, 项目特定 pattern 已从实测先例掌握, 通用 TDD/component-tdd 知识已内化; skill 自身 Context Efficiency 原则).

## Step 2 - Generation Mode

- **mode**: AI generation(AC 清晰, store+component 标准场景, 非复杂 UI 录制; detected_stack=frontend 但 UI 交互标准, 无需 browser recording).
- recording 跳过(tea_browser_automation=auto, 但 6-option select + status row 非复杂交互, AI gen 足够).

## Step 3 - Test Strategy

AC -> test level + priority 映射:

| AC    | 场景                                 | level              | file                                                              | priority |
| ----- | ------------------------------------ | ------------------ | ----------------------------------------------------------------- | -------- |
| AC-1  | timeUnit 6-option select + persist   | unit/component     | modelStore.test + SettingsPanel.test                              | P0       |
| AC-2  | default year/0.1 + restore + corrupt | unit               | modelStore.test                                                   | P0       |
| AC-3  | default dt + setDt persist           | unit               | modelStore.test                                                   | P0       |
| AC-4  | dt backing migrated to modelStore    | unit               | modelStore.test(store层) + CanvasView.test(T3, DS)                | P0       |
| AC-5  | setTimeUnit triggers revalidation    | unit + e2e         | modelStore.test + dimensionalCheck.test + e2e/model-settings.spec | P0       |
| AC-6  | stub returns deferred (allDeferred)  | unit               | dimensionalCheck.test + modelStore.test                           | P1       |
| AC-7  | lastRevalidation observable          | unit               | modelStore.test                                                   | P0       |
| AC-8  | setDt no revalidation trigger        | unit               | modelStore.test                                                   | P0       |
| AC-9  | dependency chain + order             | meta               | (非测试, story 内闭合)                                            | -        |
| AC-10 | storage boundary isolation           | unit               | modelStore.test                                                   | P0       |
| AC-11 | AR#5 ≤5min Epic 1a 闭环              | integration/manual | (defer 单元, Epic 串联手动验收)                                   | -        |
| AC-12 | no regression full suite             | gate               | tsc + vitest + e2e + lint                                         | P0       |
| AC-13 | 9 i18n keys zh+en via t()            | unit               | modelStore.test                                                   | P1       |

- **red phase 确认**: 全部新测试 `it.skip()`/`test.skip()` dormant, 产品码未实现前不执行, 不破 baseline; DS unskip 按 T1->T12.
- **declare-const 策略**(SDR#33): modelStore.ts 全新 -> modelStore.test.ts 顶部 `declare const modelStore` + local `type`(TimeUnit/ModelConfig/LastRevalidation); dimensionalCheck.test 扩展 `declare const revalidateAllDimensions`; SettingsPanel.test 扩展 `declare const modelStore`. DS T2/T6/T10 首步换真实 import.

## Step 4 - Generate Tests (sequential orchestrator-direct)

resolvedMode = sequential(ark-code 后端 subagent 不可靠, memory newsd-cr-3-layers-orchestrator-direct-not-subagents; skill step-04 允许 sequential "each worker already completed during dispatch"). 跳过 subagent fan-out + /tmp JSON 中间件, orchestrator 直接写盘 4 文件.

### 生成文件

1. **`src/lib/sd/modelStore.test.ts`**(NEW, 13 it.skip)
   - declare const: `modelStore`(subscribe/getSnapshot/setTimeUnit/setDt/recordRevalidation) + `MODEL_CONFIG_KEY` + `DEFAULT_TIME_UNIT` + `DEFAULT_DT`; local type: `TimeUnit`/`ModelConfig`/`LastRevalidation`.
   - real import: `type DimensionalCheckResult`(from ./dimensionalCheck) + `t, type DictKey`(from ./i18n, AC-13 cast 策略).
   - AC 覆盖: AC-1(1) + AC-2(3: default/restore/corrupt) + AC-3(1) + AC-4(1) + AC-5(2: nonce++/recordRevalidation) + AC-6(1) + AC-7(1) + AC-8(1) + AC-10(1) + AC-13(1) = 13 it.skip.
   - DS handoff 注释: modelStore 单例, AC-2 restore 需 vi.resetModules + dynamic import; DS T2 删 declare 块换真实 import.

2. **`src/lib/sd/__tests__/dimensionalCheck.test.ts`**(EXTEND, +4 it.skip, 保留 1a.8 AC-12 green 4 tests)
   - declare const: `revalidateAllDimensions(elements: {kind:string; formula?:string}[]) => DimensionalCheckResult[]`.
   - AC-5/AC-6(T5): N flow->N 结果全 deferred / empty->[] / 非 flow 跳过 / 每次新数组.
   - DS T6 首步: 删 declare, 扩展 line-9 import 加 revalidateAllDimensions.

3. **`src/lib/render/SettingsPanel.test.tsx`**(EXTEND, +4 it.skip, 保留 1a.9 lang green 3 tests)
   - declare const: `modelStore`(getSnapshot/setTimeUnit, 内联类型).
   - AC-1/AC-13(T9): timeUnit select 6 options / select.value=modelStore.timeUnit / change->setTimeUnit / 状态行 ns-settings-dim-revalidation 显示 flowCount+待1b.
   - DS T10 首步: 删 declare, import { modelStore } from "../sd/modelStore".

4. **`e2e/model-settings.spec.ts`**(NEW, 1 test.skip)
   - AC-5(T12): seed ≥1 flow via `window.__e2e__.elementStore.setElements`(防空心断言 VS F-3) -> 打开 SettingsPanel(gear) -> 选 month -> 断言 ns-settings-dim-revalidation 含 待1b + before/after 可区分.
   - `test.skip`(非 test()): 产品码未实现, 避免破 baseline e2e 40|0|21(1a.13 autosave-restore.spec 用 test() 因已 green; 1a.10 ATDD 阶段必须 skip).
   - e2e 不进 tsc(tsconfig 不含 e2e/), playwright esbuild 编译.

## Step 4C - Aggregate (TDD red phase compliance)

- ✅ 全部新测试 `it.skip()`(vitest) / `test.skip()`(playwright) - TDD red phase 合规.
- ✅ 无 active passing tests 误产(red phase 只 skip, 不 run).
- ✅ 现有 green 测试不破(dimensionalCheck.test 1a.8 AC-12 4 tests + SettingsPanel.test 1a.9 lang 3 tests 保留 active).
- ✅ declare-const 生效: 新文件 + 扩展文件 tsc 0.

## Step 5 - Validate & Complete (baseline gate)

| Gate     | baseline (@c217b6a)                 | ATDD 后 (@工作树)                             | 结果                                                   |
| -------- | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `tsc`    | 0 errors                            | 0 errors(declare-const 生效)                  | ✅                                                     |
| `vitest` | 797 passed \| 1 skipped / 43 files  | 797 passed \| 22 skipped / 44 files, 0 failed | ✅(797 不变 = 无回归 AC-12)                            |
| `e2e`    | 40 passed \| 0 failed \| 21 skipped | 40 passed \| 0 failed \| 22 skipped           | ✅(40 不变, 无新失败; AC-17 flaky 已修 c217b6a 无复发) |

- vitest 22 skipped = 1 baseline + 21 new(13 modelStore + 4 dimensionalCheck + 4 SettingsPanel).
- e2e 22 skipped = 21 baseline + 1 new(model-settings.spec test.skip).
- 44 files = 43 baseline + modelStore.test.ts.
- lint: 未单跑(ATDD 仅加 test 文件, 无产品码变更, lint 留 DS T13 gate).

## DS Handoff

- **T0 done**: 4 红脚手架文件已产, baseline 不破.
- **DS unskip 顺序**: T1(red AC-1/AC-2 modelStore.test) -> T2(green modelStore.ts, 删 declare 换真实 import) -> T3(red AC-3/AC-4 CanvasView.test) -> T4(green CanvasView dt 迁移) -> T5(red AC-5/AC-6 dimensionalCheck.test, 已 scaffold) -> T6(green revalidateAllDimensions, 删 declare) -> T7(red AC-5/AC-7/AC-8 CanvasView.test effect) -> T8(green CanvasView effect) -> T9(red AC-1/AC-13 SettingsPanel.test, 已 scaffold) -> T10(green SettingsPanel + i18n 9 key, 删 declare) -> T11(green styles.css) -> T12(e2e unskip model-settings.spec) -> T13(gate tsc/vitest/e2e/lint 全套件 count).
- **declare 块清理点**: T2(modelStore.test) / T6(dimensionalCheck.test) / T10(SettingsPanel.test) 各删 declare + 换真实 import.
- **AC-2 restore 测试**: DS T1/T2 需加 vi.resetModules + dynamic import 获 fresh singleton(modelStore 模块级单例, 仿 langStore).
- **AC-12 全套件口径**: T13 gate 记 vitest N/N + e2e N/N 全套件(非 story 子集, memory newsd-e2e-attestation-full-suite-not-subset).
- **硬红线**: SDR#20(checkDimensions stub 不改) + SDR#21(autosave envelope 不动) + SDR#22(deriveFlowUnits 不改) + SDR#3(Toolbar dt selector 不破 1a.7 AC-5).
