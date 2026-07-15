---
stepsCompleted:
  [
    "step-01-preflight-and-context",
    "step-02-generation-mode",
    "step-03-test-strategy",
    "step-04-generate-tests",
  ]
lastStep: "step-04-generate-tests"
lastSaved: "2026-07-13"
storyId: "1a.8"
storyKey: "1a-8-property-panel-formula-editor"
storyFile: "_bmad-output/implementation-artifacts/1a-8-property-panel-formula-editor.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-1a-8-property-panel-formula-editor.md"
generatedTestFiles:
  - "src/lib/render/__tests__/PropertyPanel.test.tsx"
  - "src/lib/sd/__tests__/dimensionalCheck.test.ts"
  - "src/lib/sd/formula.test.ts"
  - "e2e/property-panel.spec.ts"
inputDocuments:
  - "_bmad-output/implementation-artifacts/1a-8-property-panel-formula-editor.md"
  - "_bmad/tea/config.yaml"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/playwright-cli.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/overview.md"
---

# Step 1: Preflight & Context Loading

## Stack Detection

- **Detected stack**: `frontend`
- **Method**: Auto-detection (package.json contains React 19, Vite 8, Tailwind v4; playwright.config.ts exists; 0 API endpoints)

## Prerequisites

- ✅ Story approved with 15 clear acceptance criteria (AC-1 through AC-15)
- ✅ Test framework configured: `playwright.config.ts` exists
- ✅ Development environment available: vitest + Playwright + bun
- ✅ Baseline: 499 tests passing (19 vitest files + 6 Playwright e2e files) at commit 830cd92

## Story Context

- **Story ID**: 1a.8
- **Story Key**: 1a-8-property-panel-formula-editor
- **Title**: Property Panel + Formula Editor
- **ACs**: 15 (AC-1 through AC-15)
- **Tasks**: 10 (T0-T10)
- **CS 决策**: §3.1-§3.7 with domain model reconciliation
- **Key rulings**: Dual model (storage form @uuid + display form name preview), name-ified editing deferred to 1a.12
- **New dependencies**: None (explicit no-op web research)

## Framework & Existing Patterns

- **vitest tests**: 19 files co-located in `src/` (jsdom + @testing-library/react)
- **Playwright e2e**: 6 files in `e2e/` (chromium + WebGL2 SwiftShader)
- **Key patterns observed**: data-testid convention, factory-closure singleton stores, useSyncExternalStore subscriptions, test.skip() for pending tests

## TEA Configuration

- `tea_use_playwright_utils`: true
- `tea_use_pactjs_utils`: false
- `tea_browser_automation`: auto
- `tea_execution_mode`: auto
- `risk_threshold`: p1
- `test_stack_type`: auto → frontend

## Knowledge Base Loaded

- **Core**: data-factories, component-tdd, test-quality, test-healing-patterns
- **Frontend**: selector-resilience, timing-debugging
- **Playwright Utils**: overview (core), playwright-cli
- **Not loaded** (extended PW Utils, available on-demand): api-request, network-recorder, auth-session, intercept-network-call, recurse, log, file-utils, network-error-monitor, fixtures-composition
- **Skipped** (not applicable): Pact.js, contract testing, backend patterns, webhook patterns

---

# Step 2: Generation Mode Selection

## Mode: AI Generation

**Rationale**: Story 1a.8 has 15 clear, well-specified ACs covering standard UI patterns:

- Panel visibility/empty state (AC-1, AC-2)
- Form field rendering (AC-3, AC-5, AC-6)
- Field editing + persistence (AC-4)
- Formula syntax validation (AC-7, AC-10)
- Toggle switch + e2e verification (AC-8)
- Derived/read-only display (AC-9, AC-13)
- Stub integration (AC-11, AC-12)
- Accessibility assertions (AC-14)
- Regression guard (AC-15)

No complex multi-step wizard, drag-and-drop, or stateful recording flows. Recording mode not required.

---

# Step 3: Test Strategy

## AC-to-Scenario Mapping

### AC-1: 选中显示属性面板

| Scenario                                   | Level     | Priority | Rationale                                           |
| ------------------------------------------ | --------- | -------- | --------------------------------------------------- |
| Select stock → panel renders stock fields  | Component | P0       | Core panel wiring                                   |
| Select cloud → panel renders cloud fields  | Component | P0       | Element type dispatch                               |
| Select flow → panel renders flow fields    | Component | P0       | Element type dispatch                               |
| Select → deselect → panel returns to empty | Component | P1       | Selection lifecycle                                 |
| Select stock → panel renders stock fields  | E2E       | P0       | Critical user journey: click canvas → panel appears |

### AC-2: 无选中空态

| Scenario                                              | Level     | Priority | Rationale             |
| ----------------------------------------------------- | --------- | -------- | --------------------- |
| selectedId=null → empty state rendered                | Component | P1       | Graceful no-selection |
| Empty state has data-testid `ns-property-panel-empty` | Component | P1       | Testability contract  |
| No field editors in DOM when empty                    | Component | P1       | Clean DOM             |

### AC-3: 存量字段

| Scenario                                                                   | Level     | Priority | Rationale          |
| -------------------------------------------------------------------------- | --------- | -------- | ------------------ |
| Stock selected → 4 fields rendered (name/initialValue/units/allowNegative) | Component | P0       | Core stock editing |
| Field values match elementStore snapshot                                   | Component | P0       | Data integrity     |
| allowNegative rendered as checkbox                                         | Component | P1       | Correct input type |
| initialValue rendered as number input                                      | Component | P1       | Correct input type |

### AC-4: 存量字段编辑持久化

| Scenario                                                         | Level     | Priority | Rationale               |
| ---------------------------------------------------------------- | --------- | -------- | ----------------------- |
| Edit name → updateElement(id, {name}) called                     | Component | P0       | Core editing            |
| Edit initialValue → updateElement(id, {initialValue}) called     | Component | P0       | Core editing            |
| Edit units → updateElement(id, {units}) called                   | Component | P1       | Core editing            |
| Toggle allowNegative → updateElement(id, {allowNegative}) called | Component | P1       | Core editing            |
| Patch is shallow-merge (single field, not full object)           | Component | P2       | Implementation contract |

### AC-5: cloud 字段(最简)

| Scenario                                                      | Level     | Priority | Rationale         |
| ------------------------------------------------------------- | --------- | -------- | ----------------- |
| Cloud selected → name field rendered                          | Component | P1       | Cloud editing     |
| Cloud panel does NOT render formula/units/initialValue fields | Component | P1       | Correct field set |
| Edit cloud name → updateElement persists                      | Component | P1       | Persistence       |

### AC-6: 流量字段-公式编辑器

| Scenario                                                       | Level     | Priority | Rationale                |
| -------------------------------------------------------------- | --------- | -------- | ------------------------ |
| Flow selected → formula textarea/toggle/derived units rendered | Component | P0       | Core flow editing        |
| Formula input is text (raw @uuid storage form)                 | Component | P1       | Dual model: storage form |
| Toggle rendered (isVariable switch)                            | Component | P0       | Core flow control        |
| Derived units rendered as read-only text                       | Component | P1       | Unit display             |

### AC-7: 常数单位标注

| Scenario                                                   | Level | Priority | Rationale               |
| ---------------------------------------------------------- | ----- | -------- | ----------------------- |
| `0.05 [1/year]` → tokenize skips `[1/year]`, syntax passes | Logic | P1       | Unit annotation parsing |
| `[unit]` participates in deriveFlowUnits                   | Logic | P2       | Time unit derivation    |
| CJK name + unit `人口 * 0.05 [1/year]` → syntax ok         | Logic | P2       | CJK + unit combo        |

### AC-8: isVariable 可变/常数切换 (F8)

| Scenario                                                 | Level     | Priority | Rationale                                            |
| -------------------------------------------------------- | --------- | -------- | ---------------------------------------------------- |
| Toggle → updateElement(id, {isVariable: <negated>})      | Component | P0       | Toggle logic                                         |
| Toggle has role="switch" + aria-checked                  | Component | P1       | a11y (also AC-14)                                    |
| Toggle click → isVariable:true → canvas ▼ marker appears | E2E       | P0       | Critical e2e: real UI interaction, no `__e2e__` hook |

### AC-9: 派生流量单位只读

| Scenario                                      | Level     | Priority | Rationale             |
| --------------------------------------------- | --------- | -------- | --------------------- |
| deriveFlowUnits result displayed as read-only | Component | P1       | Unit display          |
| Changing formula → derived units update       | Component | P2       | Reactivity            |
| Field is not editable (readonly/disabled)     | Component | P1       | Read-only enforcement |

### AC-10: 公式语法错误红色高亮

| Scenario                                                    | Level     | Priority | Rationale                      |
| ----------------------------------------------------------- | --------- | -------- | ------------------------------ |
| `(1+2` (unclosed paren) → `{ok:false, error}`               | Logic     | P0       | Syntax error detection         |
| `0.0.5` (bad number) → `{ok:false, error}`                  | Logic     | P0       | Syntax error detection         |
| `1+@#` (unexpected chars) → `{ok:false, error}`             | Logic     | P0       | Syntax error detection         |
| `[1/year` (unclosed unit annotation) → `{ok:false, error}`  | Logic     | P0       | Syntax error detection         |
| `1` (simple constant) → `{ok:true}`                         | Logic     | P0       | Valid formula                  |
| `@uuid` reference → `{ok:true}` (syntax only, not semantic) | Logic     | P0       | Distinguish syntax vs semantic |
| `人口 * 0.05 [1/year]` (CJK + unit) → `{ok:true}`           | Logic     | P1       | CJK name support               |
| Syntax error → formula input border red + error text        | Component | P0       | Error UI                       |
| Error text has aria-live="assertive"                        | Component | P1       | a11y error announcement        |
| Valid formula → no red border, no error text                | Component | P0       | Clean state                    |

### AC-11: 量纲校验入口存在+触发

| Scenario                                      | Level     | Priority | Rationale           |
| --------------------------------------------- | --------- | -------- | ------------------- |
| Edit formula → checkDimensions() is called    | Component | P2       | Integration trigger |
| checkDimensions result does not block editing | Component | P2       | Non-blocking        |

### AC-12: 量纲 stub 返回待 1b

| Scenario                                                              | Level | Priority | Rationale             |
| --------------------------------------------------------------------- | ----- | -------- | --------------------- |
| checkDimensions always returns `{status:"deferred", message:"待 1b"}` | Logic | P2       | Stub contract         |
| Stub does not derive actual units                                     | Logic | P2       | Correct stub behavior |
| Stub does not throw on any input                                      | Logic | P2       | Robustness            |

### AC-13: formatFormulaForEditor 接 UI (F10)

| Scenario                                           | Level     | Priority | Rationale            |
| -------------------------------------------------- | --------- | -------- | -------------------- |
| Formula preview renders via formatFormulaForEditor | Component | P1       | Display form preview |
| `@uuid` → resolved name in preview                 | Component | P1       | Name resolution      |
| Unknown `@uuid` → preserved as-is, no throw        | Component | P2       | Graceful unknown     |
| `[unit]` annotations stripped from preview         | Component | P2       | Clean display        |

### AC-14: AR#11 a11y

| Scenario                                           | Level     | Priority | Rationale               |
| -------------------------------------------------- | --------- | -------- | ----------------------- |
| All fields have aria-label with semantic name      | Component | P1       | Screen reader support   |
| Formula error area has aria-live                   | Component | P1       | Live error announcement |
| Toggle has role="switch" + aria-checked            | Component | P1       | Switch semantics        |
| Panel root has role="region" aria-label="图元属性" | Component | P1       | Landmark                |

### AC-15: 无回归

| Scenario                                           | Level      | Priority | Rationale        |
| -------------------------------------------------- | ---------- | -------- | ---------------- |
| Full vitest suite green (499 baseline + new tests) | Logic+Comp | P0       | Regression guard |
| `tsc --noEmit` passes                              | -          | P0       | Type safety      |

## Test File Allocation

| Test File                                          | Type      | Covers                                | Framework                       |
| -------------------------------------------------- | --------- | ------------------------------------- | ------------------------------- |
| `src/lib/render/__tests__/PropertyPanel.test.tsx`  | Component | AC-1..AC-6, AC-8..AC-11, AC-13, AC-14 | vitest + @testing-library/react |
| `src/lib/sd/__tests__/formula.test.ts` (extension) | Logic     | AC-7, AC-10 (validateFormulaSyntax)   | vitest                          |
| `src/lib/sd/__tests__/dimensionalCheck.test.ts`    | Logic     | AC-12                                 | vitest                          |
| `e2e/property-panel.spec.ts`                       | E2E       | AC-1, AC-8, AC-15                     | Playwright                      |

## Priority Summary

| Priority | Count        | ACs                                                |
| -------- | ------------ | -------------------------------------------------- |
| P0       | 11 scenarios | AC-1, AC-3, AC-4, AC-6, AC-8, AC-10, AC-15         |
| P1       | 14 scenarios | AC-2, AC-5, AC-7, AC-9, AC-13, AC-14               |
| P2       | 7 scenarios  | AC-4(patch), AC-7(unit), AC-11, AC-12, AC-13(edge) |

## Red Phase Confirmation

All generated tests MUST:

- Use `test.skip()` to mark as red-phase pending
- Be syntactically complete (imports, arrange, act, assert)
- Fail if unskipped (verify red by temporarily removing `.skip()` on one representative per file)
- Not require implementation code to exist (scaffold imports that will exist after T1-T9 green phase)

---

# Step 4: Test Generation (Completed 2026-07-13)

## TDD Red-Phase Compliance

All generated tests use `test.skip()` per ATDD red-phase requirement. Test suite confirms:

- **Vitest**: 19 passed | 2 skipped (21 files), 499 passed | 68 skipped (567 tests)
- The 2 skipped files are entirely-red (PropertyPanel.test.tsx, dimensionalCheck.test.ts)
- formula.test.ts new validateFormulaSyntax tests are skipped alongside existing live tests

## Source Stubs Created

Three minimal source stubs created so test imports compile:

| Stub                    | File                                     | Purpose                                  |
| ----------------------- | ---------------------------------------- | ---------------------------------------- |
| `validateFormulaSyntax` | `src/lib/sd/formula.ts` (appended)       | Throws "not implemented" — Story 1a.8 T6 |
| `checkDimensions`       | `src/lib/sd/dimensionalCheck.ts` (new)   | Throws "not implemented" — Story 1a.8 T7 |
| `PropertyPanel`         | `src/lib/render/PropertyPanel.tsx` (new) | Renders `null` — Story 1a.8 T1-T5        |

## Generated Test Files Summary

### 1. `src/lib/sd/__tests__/dimensionalCheck.test.ts` (NEW)

- **4 `test.skip()` scenarios** across 1 describe block
- Covers AC-12 (stub contract): always returns deferred shape, correct keys, robustness (no throw on any input), no singleton mutation
- Import: `checkDimensions`, `DimensionalCheckResult` from `../dimensionalCheck`

### 2. `src/lib/sd/formula.test.ts` (EXTENDED)

- **19 `test.skip()` scenarios** appended (2 describe blocks)
- AC-7 (4 tests): `[1/year]`, `[人/年]`, `[1/dt]` annotations valid; annotation-only formula valid
- AC-10 (15 tests): unclosed paren, bad number, unexpected chars, unclosed annotation → syntax errors; valid constant, @uuid ref, CJK+unit combo, empty string, whitespace, deeply nested → pass; trailing operator, double operator → errors; error message includes position/context
- Import added: `validateFormulaSyntax` from `./formula`

### 3. `src/lib/render/__tests__/PropertyPanel.test.tsx` (NEW)

- **47 `test.skip()` scenarios** across 12 describe blocks
- AC-1 (4 tests): stock/cloud/flow render, deselect→empty
- AC-2 (3 tests): empty state, no editors in DOM, data-testid contract
- AC-3 (4 tests): 4 stock fields, values from store, number input, checkbox
- AC-4 (5 tests): edit name/initialValue/units/allowNegative persistence, shallow merge
- AC-5 (3 tests): cloud name only, edit persistence, undefined name placeholder
- AC-6 (4 tests): flow formula/toggle/units, textarea tag, @uuid storage form, no stock fields
- AC-8 (3 tests): toggle click, role="switch"+aria-checked, toggle off
- AC-9 (3 tests): derived units display, readonly, formula change reactivity
- AC-10 (4 tests): red border on error, error clear on fix, aria-live="assertive", multiple errors
- AC-11 (2 tests): checkDimensions triggered, non-blocking
- AC-13 (4 tests): preview area exists, name resolution, unknown @uuid preserved, [unit] stripped
- AC-14 (5 tests): role="region"+aria-label, field aria-labels, flow field aria-labels, role="switch"+aria-checked, aria-live error region
- Cross-cutting (2 tests): selection switch reactivity, external store update
- Imports: `PropertyPanel`, `PropertyPanelProps` from `../PropertyPanel`; `createElementStore` from `../../sd/store`

### 4. `e2e/property-panel.spec.ts` (NEW)

- **8 `test.skip()` scenarios** across 3 describe blocks
- AC-1 (2 tests): click stock→panel appears with fields, deselect→empty state
- AC-8 (2 tests): toggle isVariable→aria-checked+▼ marker, toggle off→▼ removed
- AC-15 (3 tests): rapid element switching no crash, edit formula→error→fix no crash, panel open during canvas editing no crash
- Helpers: `waitForRenderReady(page)`, `seedStock(page, name, opts?)`, `seedFlow(page, fromName, toName, flowName, isVariable?)`
- Pattern: follows `toolbar-statusbar.spec.ts` conventions (data-testid selectors, `page.goto("/")`, `__e2e__` hook for seeding)

## AC Coverage Verification

| AC    | Title              | Scenarios Generated    | Covered In                                     |
| ----- | ------------------ | ---------------------- | ---------------------------------------------- |
| AC-1  | 选中显示属性面板   | 5 (4 comp + 1 e2e)     | PropertyPanel.test.tsx, property-panel.spec.ts |
| AC-2  | 无选中空态         | 3 (3 comp)             | PropertyPanel.test.tsx                         |
| AC-3  | 存量字段           | 4 (4 comp)             | PropertyPanel.test.tsx                         |
| AC-4  | 存量字段编辑持久化 | 5 (5 comp)             | PropertyPanel.test.tsx                         |
| AC-5  | Cloud 字段         | 3 (3 comp)             | PropertyPanel.test.tsx                         |
| AC-6  | 流量字段公式编辑器 | 4 (4 comp)             | PropertyPanel.test.tsx                         |
| AC-7  | 常数单位标注       | 4 (4 logic)            | formula.test.ts                                |
| AC-8  | isVariable 切换    | 5 (3 comp + 2 e2e)     | PropertyPanel.test.tsx, property-panel.spec.ts |
| AC-9  | 派生流量单位只读   | 3 (3 comp)             | PropertyPanel.test.tsx                         |
| AC-10 | 公式语法错误       | 14 (10 logic + 4 comp) | formula.test.ts, PropertyPanel.test.tsx        |
| AC-11 | 量纲校验入口       | 2 (2 comp)             | PropertyPanel.test.tsx                         |
| AC-12 | 量纲 stub          | 4 (4 logic)            | dimensionalCheck.test.ts                       |
| AC-13 | 公式预览           | 4 (4 comp)             | PropertyPanel.test.tsx                         |
| AC-14 | a11y               | 5 (5 comp)             | PropertyPanel.test.tsx                         |
| AC-15 | 无回归             | 3 (3 e2e)              | property-panel.spec.ts                         |

**Total: 68 test.skip() scenarios** across 4 files, covering all 15 ACs.

## Next Step

Proceed to Step 4C (aggregation) or directly to Story 1a.8 implementation (CS→VS→DS→CR cycle). Remove `.skip()` from tests as each task is implemented.
