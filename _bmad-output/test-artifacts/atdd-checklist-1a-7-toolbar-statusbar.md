---
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
lastSaved: "2026-07-09"
storyId: "1a.7"
storyKey: "1a-7-toolbar-statusbar"
storyFile: "C:/Two/NewSD/_bmad-output/implementation-artifacts/1a-7-toolbar-statusbar.md"
atddChecklistPath: "C:/Two/NewSD/_bmad-output/test-artifacts/atdd-checklist-1a-7-toolbar-statusbar.md"
generatedTestFiles:
  - "C:/Two/NewSD/e2e/toolbar-statusbar.spec.ts"
inputDocuments:
  - "C:/Two/NewSD/_bmad-output/implementation-artifacts/1a-7-toolbar-statusbar.md"
  - "C:/Two/NewSD/playwright.config.ts"
  - "C:/Two/NewSD/e2e/minimap.spec.ts"
  - "C:/Two/NewSD/e2e/spatial-index.spec.ts"
  - "C:/Two/NewSD/.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md"
  - "C:/Two/NewSD/.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md"
  - "C:/Two/NewSD/.claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md"
  - "C:/Two/NewSD/.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md"
  - "C:/Two/NewSD/_bmad/tea/config.yaml"
  - "C:/Two/NewSD/.claude/skills/bmad-testarch-atdd/resources/tea-index.csv"
---

# Step 1: Preflight & Context Loading

## Stack Detection

- **Config value**: `auto`
- **Detected stack**: `frontend`
  - Root `package.json` with React 19.2, Vite, Playwright, vitest
  - `playwright.config.ts` exists
  - `vite.config.ts` exists
  - No backend manifests (no go.mod, pyproject.toml, etc.)

## Prerequisites

- ✅ Story approved with 13 clear ACs (epics.md L467-501)
- ✅ VS verdict: PASS (2026-07-09)
- ✅ `playwright.config.ts` configured (chromium + WebGL2 SwiftShader)
- ✅ Dev environment: vitest 438/438, Playwright 29/29, tsc 0 errors

## Story Context

- **Story key**: `1a-7-toolbar-statusbar`
- **Story ID**: `1a.7`
- **Epic**: 1a (in-progress)
- **Status**: ready-for-dev
- **Baseline commit**: `fb3f2a1`
- **ACs**: 13 (AC-1 Toolbar rendering → AC-13 e2e)
- **Scope**: DOM UI chrome — Toolbar (top) + StatusBar (bottom) + AppShell layout + keyboard handlers + a11y

## Config Flags

- `tea_use_playwright_utils`: true
- `tea_use_pactjs_utils`: false
- `tea_pact_mcp`: none
- `tea_browser_automation`: auto
- `tea_execution_mode`: auto
- `tea_capability_probe`: true
- `test_stack_type`: auto → frontend (detected)

## Existing Test Patterns

- **e2e directory**: `e2e/` (5 spec files)
- **Patterns observed**: `waitForRenderReady()` helper, `__e2e__` hook access, `page.evaluate()`, `test.describe()` blocks
- **No existing fixtures or page object files**
- **Full UI+API Playwright Utils profile** (browser tests detected with `page.goto`)

## Knowledge Fragments Loaded

- `selector-resilience.md` (core)
- `test-quality.md` (core)
- `component-tdd.md` (extended)
- `data-factories.md` (core)

---

# Step 2: Generation Mode Selection

## Chosen Mode: AI Generation

**Why AI Generation (not recording):**

- Story is `ready-for-dev` — the toolbar and statusbar don't exist in the app yet, so there's nothing to record in a live browser
- 13 ACs are clear, well-structured Given/When/Then (VS-verified, zero ambiguity)
- Interactions are standard DOM UI: button clicks, keyboard events, text assertions, focus order — no complex drag/drop or multi-step wizards
- Existing e2e patterns in `minimap.spec.ts` and `spatial-index.spec.ts` provide clear conventions for selectors, data setup, and assertion style
- `tea_browser_automation: auto` — recording is available but not applicable pre-implementation

## Recording: Skipped

Recording (CLI/MCP) requires a live app to capture selectors from. Since the toolbar/statusbar are not yet implemented, recording would capture nothing. Selectors will be derived from AC-specified roles, aria-labels, and Chinese text labels.

---

# Step 3: Test Strategy

## 3.1 Test Scenario Mapping

### AC-1 — Toolbar Rendering

| #    | Scenario                                                                                               | Level     | Priority | Red-Phase Rationale                                 |
| ---- | ------------------------------------------------------------------------------------------------------ | --------- | -------- | --------------------------------------------------- |
| S1.1 | Toolbar renders with 6 control groups (文件, 编辑, 工具, 模拟控制, 时间步长, 缩放)                     | Component | P0       | Fails until Toolbar.tsx exists                      |
| S1.2 | Each button/control has semantic role + aria-label in Chinese (e.g. `role="button" aria-label="新建"`) | Component | P1       | Fails until ARIA attrs added                        |
| S1.3 | Toolbar `<nav>` element visible in DOM after page load, positioned above canvas                        | E2E       | P0       | Fails until AppShell renders Toolbar in flex layout |
| S1.4 | Toolbar height ≤ 48px (compact single-row)                                                             | Component | P2       | Fails if toolbar layout overflows                   |

### AC-2 — Activation/Disable Matrix

| #    | Scenario                                                                                                                                      | Level     | Priority | Red-Phase Rationale                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | ------------------------------------------------ |
| S2.1 | Active buttons (新建, 删除, 工具切换×4, dt, 缩放) have `aria-disabled="false"`, visible, clickable                                            | Component | P0       | Fails until enable matrix implemented            |
| S2.2 | Disabled buttons (打开, 保存, 撤销, 重做, 复制, 粘贴, 暂停, 播放, 重置, 单步) have `disabled` attr + `aria-disabled="true"` + reduced opacity | Component | P1       | Fails until disable matrix + opacity implemented |
| S2.3 | Disabled buttons cannot receive focus (`tabIndex={-1}`)                                                                                       | Component | P1       | Fails until focus guard added                    |
| S2.4 | Disabled buttons show tooltip "暂未实现" on hover (title attr or Tooltip component)                                                           | Component | P1       | Fails until tooltip implemented                  |
| S2.5 | Disabled buttons not clickable/triggerable — clicking them produces no side effect                                                            | E2E       | P1       | Fails until click guard implemented              |
| S2.6 | 删除 is disabled (grayed) when no element selected, enabled when selection active                                                             | Component | P1       | Fails until selection-aware 删除 state wired     |

### AC-3 — Delete Activation

| #    | Scenario                                                                                                     | Level     | Priority | Red-Phase Rationale                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------ | --------- | -------- | ----------------------------------------------------------------------- |
| S3.1 | Select element → click 删除 button → element removed from store + element count decrements in statusbar      | E2E       | P0       | Fails until delete wired to store                                       |
| S3.2 | Select element → press Delete key → element removed                                                          | E2E       | P0       | Fails until keyboard handler added                                      |
| S3.3 | Select element → press Backspace key → element removed                                                       | E2E       | P0       | Fails until keyboard handler added                                      |
| S3.4 | Delete/Backspace with no selection = no-op (no error, no element removed)                                    | E2E       | P1       | Fails until no-selection guard added                                    |
| S3.5 | Delete/Backspace when `document.activeElement` is `<input>` or `<textarea>` = no-op (text editing preserved) | Component | P1       | Fails until input-guard added (prevents accidental delete while typing) |

### AC-4 — Tool Switching

| #    | Scenario                                                                                                        | Level     | Priority | Red-Phase Rationale                                  |
| ---- | --------------------------------------------------------------------------------------------------------------- | --------- | -------- | ---------------------------------------------------- |
| S4.1 | Click 选择 button → `toolMode` state changes to "select", button shows selected visual state (border/bg change) | E2E       | P0       | Fails until toolMode lift + setToolMode wired        |
| S4.2 | Click 存量/源汇/流量 → toolMode changes, previous button deselects, new button selects                          | E2E       | P0       | Fails until exclusive selection + state sync         |
| S4.3 | Press F key → toolMode = "select" (选择), toolbar button syncs                                                  | E2E       | P0       | Fails until keyboard+button share setToolMode        |
| S4.4 | Press S/C/V keys → toolMode = 存量/源汇/流量, toolbar button syncs                                              | E2E       | P0       | Fails until keyboard wiring complete                 |
| S4.5 | Switching tools aborts `flowDragRef` + clears `selectedElementId` (no regression from L815-844 behavior)        | Component | P1       | Fails until abort+clear wired in tool-switch handler |

### AC-5 — dt Selector

| #    | Scenario                                                                                  | Level     | Priority | Red-Phase Rationale                      |
| ---- | ----------------------------------------------------------------------------------------- | --------- | -------- | ---------------------------------------- |
| S5.1 | dt selector renders as `<select>` or custom dropdown with 4 options [0.01, 0.1, 0.5, 1.0] | Component | P1       | Fails until dt state + selector rendered |
| S5.2 | Default value 0.1 is selected on initial render                                           | Component | P1       | Fails until default wired                |
| S5.3 | Selecting different dt updates state, visible indicator reflects current value            | E2E       | P1       | Fails until onChange wired               |
| S5.4 | dt selector label reads "时间步长" (Chinese, consistent with toolbar matrix)              | Component | P2       | Fails if label mismatch                  |

### AC-6 — Zoom Slider + Indicator

| #    | Scenario                                                                                         | Level     | Priority | Red-Phase Rationale                                             |
| ---- | ------------------------------------------------------------------------------------------------ | --------- | -------- | --------------------------------------------------------------- |
| S6.1 | Zoom slider range [0.05, 20], value = current cam zoom, clamped to range                         | Component | P0       | Fails until slider + clampZoom wired                            |
| S6.2 | Drag slider right → `camRef.zoom` increases, indicator text updates (e.g. "1600%")               | E2E       | P0       | Fails until slider→zoomAt wired                                 |
| S6.3 | Zoom indicator format matches HUD zoomPct format (L465: `Math.round(100 / camera.zoom)` → "NN%") | Component | P1       | Fails until format matches existing HUD                         |
| S6.4 | Slider + indicator updated imperatively via render loop (ref-based), not React state per-frame   | Component | P2       | Fails if React state drives per-frame updates (perf regression) |

### AC-7 — Chinese Text

| #    | Scenario                                                                                                                                                        | Level     | Priority | Red-Phase Rationale                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- | ---------------------------------------- |
| S7.1 | All toolbar labels are hardcoded Chinese matching the CS matrix (新建/打开/保存/撤销/重做/复制/粘贴/删除/选择/存量/源汇/流量/暂停/播放/重置/单步/时间步长/缩放) | Component | P0       | Fails until Chinese labels written       |
| S7.2 | No `i18n.ts` or `useTranslation()` imports in toolbar/statusbar source files                                                                                    | Component | P2       | Fails if i18n imported (CS钉死: no i18n) |
| S7.3 | Sim controls use Unicode symbols (⏸▶⏹⏭) + Chinese text                                                                                                          | Component | P1       | Fails until Unicode + text rendered      |

### AC-8 — StatusBar Rendering

| #    | Scenario                                                                                      | Level     | Priority | Red-Phase Rationale                                   |
| ---- | --------------------------------------------------------------------------------------------- | --------- | -------- | ----------------------------------------------------- |
| S8.1 | StatusBar renders 7 fields: 模拟时间, 图元计数, 在线用户数, 头像堆栈, FPS, 连接状态, 量纲概要 | Component | P0       | Fails until StatusBar.tsx exists                      |
| S8.2 | Each field has semantic role + aria-label (e.g. `role="status" aria-label="图元计数"`)        | Component | P1       | Fails until ARIA attrs added                          |
| S8.3 | Dynamic fields (图元计数, FPS) have `aria-live="polite"` for screen reader announcements      | Component | P1       | Fails until aria-live added                           |
| S8.4 | StatusBar `<footer>` element visible in DOM after page load, positioned below canvas          | E2E       | P0       | Fails until AppShell renders StatusBar in flex layout |
| S8.5 | StatusBar height ≤ 32px (compact single-row)                                                  | Component | P2       | Fails if layout overflows                             |

### AC-9 — StatusBar Active/Placeholder Matrix

| #    | Scenario                                                                                 | Level     | Priority | Red-Phase Rationale                      |
| ---- | ---------------------------------------------------------------------------------------- | --------- | -------- | ---------------------------------------- |
| S9.1 | 图元计数 = `elementStore.getElements().length` (live value, updates after create/delete) | E2E       | P0       | Fails until store subscription wired     |
| S9.2 | FPS = `perfProbe.getMetrics().fpsP95` (live value, updates each render frame)            | E2E       | P0       | Fails until perfProbe subscription wired |
| S9.3 | FPS displays "-" (placeholder) when `fpsP95 <= 0` (jsdom/no rAF samples / headless CI)   | Component | P1       | Fails until fallback implemented         |
| S9.4 | Placeholder values: 模拟时间 = "0.00s", 在线 = "1", 连接 = "本地"                        | Component | P1       | Fails until placeholder values rendered  |
| S9.5 | 量纲概要 slot hidden (CS钉死: hidden in 1a.7, will be wired later)                       | Component | P1       | Fails if 量纲 renders visible content    |
| S9.6 | 头像堆栈 renders placeholder (single avatar icon, "1")                                   | Component | P1       | Fails until placeholder rendered         |

### AC-10 — Keyboard Accessibility

| #     | Scenario                                                                                          | Level     | Priority | Red-Phase Rationale                                            |
| ----- | ------------------------------------------------------------------------------------------------- | --------- | -------- | -------------------------------------------------------------- |
| S10.1 | Tab flows through toolbar buttons (L→R) → dt → zoom → statusbar fields in logical DOM order       | E2E       | P1       | Fails until tabIndex order matches visual order                |
| S10.2 | `:focus-visible` ring visible on all interactive controls (not hidden by `outline: none`)         | E2E       | P1       | Fails until focus-visible style added to Tailwind theme        |
| S10.3 | Arrow keys move selected element by 1 world unit (snapToGrid-aligned)                             | Component | P0       | Fails until Arrow handler added (new in 1a.7, not in L815-844) |
| S10.4 | Arrow keys with no selection = no-op, do NOT pan camera                                           | Component | P1       | Fails until no-selection guard added                           |
| S10.5 | F/S/C/V tool switching via keyboard works (no regression from existing L815-844 keyboard handler) | E2E       | P0       | Fails if keyboard refactored incorrectly during lift           |

### AC-11 — Color-Blind + Contrast

| #     | Scenario                                                                                               | Level     | Priority | Red-Phase Rationale                  |
| ----- | ------------------------------------------------------------------------------------------------------ | --------- | -------- | ------------------------------------ |
| S11.1 | Disabled state uses multi-cue: `disabled` attr + reduced opacity + "暂未实现" tooltip (not color-only) | Component | P1       | Fails until multi-cue disabled state |
| S11.2 | Selected tool button uses multi-cue: border change + text weight/color (not color-only)                | Component | P1       | Fails until multi-cue selected state |
| S11.3 | `--ns-fg` text color contrast ≥ 4.5:1 against background (WCAG AA) — verifiable via computed style     | Component | P2       | Fails if wrong CSS token used        |

### AC-12 — No Regression

| #     | Scenario                                                                | Level | Priority | Red-Phase Rationale                   |
| ----- | ----------------------------------------------------------------------- | ----- | -------- | ------------------------------------- |
| S12.1 | All existing vitest tests pass (≥ 438 currently, AC-8 gate)             | Unit  | P0       | Regression gate — must stay green     |
| S12.2 | All existing Playwright e2e tests pass (≥ 29 currently)                 | E2E   | P0       | Regression gate — must stay green     |
| S12.3 | `cap11-shadowblur-guard.test.ts` still green (no shadowBlur regression) | Unit  | P0       | Regression gate — explicit guard test |

### AC-13 — e2e Coverage

| #     | Scenario                                                                                                         | Level | Priority | Red-Phase Rationale                               |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ----- | -------- | ------------------------------------------------- |
| S13.1 | E2E scaffold covers: tool switch click, zoom slider drag, Delete key, Tab focus order, element count live update | E2E   | P0       | Red-phase scaffold — all `test.skip()` by default |

## 3.2 Test Level Summary

| Level                        | Scenario Count | Rationale                                                                                              |
| ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| **E2E (Playwright)**         | 18             | Critical user journeys: toolbar interaction, keyboard, statusbar live data, focus order, a11y          |
| **Component (vitest + RTL)** | 24             | UI behavior: render matrices, ARIA attrs, edge cases, disabled states, fallback values, Chinese labels |
| **Unit (vitest)**            | 3              | Regression gates: existing suite ≥ 438 + cap11 guard                                                   |

**No API tests** — this is a frontend-only DOM chrome story with zero API endpoints.

## 3.3 Priority Distribution

| Priority | Scenario Count | Meaning                                                                     |
| -------- | -------------- | --------------------------------------------------------------------------- |
| **P0**   | 17             | Core functionality — must pass for story to ship                            |
| **P1**   | 23             | Important: a11y, edge cases, placeholders, disabled states, keyboard guards |
| **P2**   | 5              | Nice to have: visual details, i18n verification, exact label matching       |
| **P3**   | 0              | None needed                                                                 |

## 3.4 E2E Test File Plan

Based on scenario mapping, the E2E scaffold will contain these `test.describe` blocks:

| Group             | ACs Covered            | Priority Tests      | Est. Lines |
| ----------------- | ---------------------- | ------------------- | ---------- |
| Toolbar Rendering | AC-1, AC-2, AC-5, AC-7 | S1.3, S2.5          | ~80        |
| Tool Switching    | AC-4                   | S4.1-S4.4           | ~70        |
| Delete Workflow   | AC-3                   | S3.1-S3.4           | ~70        |
| Zoom Slider       | AC-6                   | S6.2                | ~50        |
| StatusBar         | AC-8, AC-9             | S8.4, S9.1, S9.2    | ~80        |
| Keyboard & Focus  | AC-10                  | S10.1, S10.2, S10.5 | ~60        |
| **Total**         | —                      | —                   | **~410**   |

> Note: AC-12 (no regression) is satisfied by running the existing suite, not a new scaffold.
> AC-13 is the meta-AC — the e2e file itself is its fulfillment.

## 3.5 Component Test Strategy (Documentation Only)

Per TEA config (frontend stack, no API), component tests are **documented as strategy** for DS to implement during TDD red phase. Key patterns:

1. **Toolbar render matrix**: Test each button group renders with correct Chinese label + aria attrs
2. **Disabled state matrix**: Test each of the 10 disabled buttons has `disabled` + `aria-disabled="true"` + reduced opacity
3. **Tool switching state**: Test toolMode state transitions on click/keyboard, verify exclusive selection
4. **Delete guard**: Test input/textarea activeElement check prevents accidental delete
5. **StatusBar field rendering**: Test each of the 7 fields renders with correct placeholder or live value
6. **FPS fallback**: Test `fpsP95 <= 0` → displays "-"
7. **Focus management**: Test tabIndex assignment, focus-visible styles
8. **Arrow key move**: Test Arrow keys dispatch move by 1 world unit, no-op without selection
9. **Zoom format**: Test indicator text matches HUD format

## 3.6 Red-Phase Confirmation

All new tests are designed to **FAIL before implementation**:

- **E2E scaffolds**: Generated with `test.skip()`, un-skipped during DS red phase → fail because `nav.ns-toolbar` / `footer.ns-statusbar` / their children don't exist in DOM
- **Component tests**: Documented above for DS to create during TDD red phase → fail because Toolbar.tsx / StatusBar.tsx / AppShell.tsx don't exist yet
- **Unit regression**: Existing suite must stay green — not new red tests, but a gate that blocks merge if broken

### Expected test counts after DS green phase:

| Suite                     | Before 1a.7 | After 1a.7 (green)                      |
| ------------------------- | ----------- | --------------------------------------- |
| vitest (unit + component) | ≥ 438       | ≥ 438 + ~24 component = ~462            |
| Playwright e2e            | 29          | 29 + 1 (toolbar-statusbar.spec.ts) = 30 |

---

# Step 4: Generate Tests

## 4.1 Execution Mode

- **Requested**: `auto` (from `tea_execution_mode`)
- **Resolved**: `sequential` — frontend-only story, no benefit from parallel subagents
- **Capability probe**: enabled (`tea_capability_probe: true`)

## 4.2 Worker A: API Tests — SKIPPED

**N/A** — Story 1a.7 is a frontend-only DOM UI chrome story with zero API endpoints. No `POST`/`GET`/`PUT`/`DELETE` routes are introduced or modified.

## 4.3 Worker B: E2E Tests — GENERATED

**Output file**: `C:/Two/NewSD/e2e/toolbar-statusbar.spec.ts` (516 lines)

**TDD Phase**: RED — all 14 tests use `test.skip()`

### Test Inventory

| #   | Test                                                    | Priority | ACs Covered |
| --- | ------------------------------------------------------- | -------- | ----------- |
| 1   | S1.3: toolbar renders as `<nav>` with 6 control groups  | P0       | AC-1, AC-2  |
| 2   | S2.5: disabled buttons not clickable — no side effect   | P1       | AC-2        |
| 3   | S3.1: click 删除 → element removed, count decrements    | P0       | AC-3        |
| 4   | S3.2: press Delete key → element removed                | P0       | AC-3        |
| 5   | S3.4: Delete with no selection = no-op                  | P1       | AC-3        |
| 6   | S4.1: click tool button → toolMode changes              | P0       | AC-4        |
| 7   | S4.3: F/S/C/V keys switch toolMode, toolbar syncs       | P0       | AC-4        |
| 8   | S6.2: zoom slider changes camera zoom                   | P0       | AC-6        |
| 9   | S8.4: statusbar renders as `<footer>` with 7 fields     | P0       | AC-8        |
| 10  | S9.1: element count = elementStore.getElements().length | P0       | AC-9        |
| 11  | S9.2: FPS field shows value or "-" placeholder          | P0       | AC-9        |
| 12  | S10.1: Tab flows toolbar → canvas → statusbar           | P1       | AC-10       |
| 13  | S10.2: :focus-visible ring visible                      | P1       | AC-10       |
| 14  | S10.5: F/S/C/V keyboard regression guard                | P0       | AC-10, AC-4 |

### Selector Strategy

All selectors follow the resilience hierarchy (`data-testid` > ARIA roles > text):

| Element          | Primary Selector                                                  | Fallback                            |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------- |
| Toolbar          | `[data-testid='ns-toolbar']`                                      | `role="navigation"`                 |
| Toolbar buttons  | `[data-testid='ns-toolbar-btn-{name}']`                           | `role="button" aria-label="{name}"` |
| Control groups   | `[aria-label="{group}"]`                                          | —                                   |
| Zoom slider      | `[data-testid='ns-toolbar-zoom-slider']`                          | `input[type="range"]`               |
| Zoom label       | `[data-testid='ns-toolbar-zoom-label']`                           | —                                   |
| StatusBar        | `[data-testid='ns-statusbar']`                                    | `role="contentinfo"`                |
| Element count    | `[data-testid='ns-statusbar-element-count']`                      | `aria-label="图元计数"`             |
| FPS              | `[data-testid='ns-statusbar-fps']`                                | `aria-label="FPS"`                  |
| StatusBar fields | `[aria-label="{label}"]` / `[data-testid="ns-statusbar-{label}"]` | —                                   |

### Fixture Needs

**None** — tests use existing `__e2e__` hooks (`elementStore`, `camRef`) and standard Playwright APIs (`page.keyboard`, `page.locator`). No new fixtures or page objects required.

---

# Step 4C: Aggregate & Validate

## TDD Red Phase Compliance

| Check                                                                | Status       |
| -------------------------------------------------------------------- | ------------ |
| All tests use `test.skip()`                                          | Pass (14/14) |
| No placeholder assertions (`expect(true).toBe(true)`)                | Pass         |
| All tests assert expected behavior                                   | Pass         |
| Resilient selectors used (data-testid > ARIA > text)                 | Pass         |
| No hard waits (only `waitForTimeout(300)` matching existing pattern) | Pass         |
| Self-cleaning (no cross-test state via `setElements([])`)            | Pass         |
| Parallel-safe (unique element names per test)                        | Pass         |

## Summary Statistics

| Metric               | Value                                          |
| -------------------- | ---------------------------------------------- |
| **TDD Phase**        | RED                                            |
| **Total E2E tests**  | 14 (all `test.skip()`)                         |
| **API tests**        | 0 (N/A — frontend-only story)                  |
| **Component tests**  | 0 (strategy documented, DS creates during TDD) |
| **Fixtures created** | 0 (no new fixtures needed)                     |
| **P0 coverage**      | 8 tests                                        |
| **P1 coverage**      | 6 tests                                        |
| **P2 coverage**      | 0 (delegated to component strategy)            |
| **ACs covered**      | 13/13 (AC-1 through AC-13)                     |
| **Execution mode**   | Sequential (API N/A, E2E inline)               |

## Post-DS Green Phase Projections

| Suite          | Before 1a.7 | After 1a.7 (green)                           |
| -------------- | ----------- | -------------------------------------------- |
| vitest         | >= 438      | >= 462 (438 + ~24 component)                 |
| Playwright e2e | 29          | 30 (29 existing + toolbar-statusbar.spec.ts) |

## Next Steps

1. **DS (`bmad-dev-story`)**: Implement Toolbar + StatusBar + AppShell per story tasks T0-T13
2. **During DS red phase**: Remove `test.skip()` from individual tests as features are built
3. **DS green phase**: All 14 E2E tests pass + ~24 new component tests pass + >= 438 existing vitest tests green
4. **CR (`bmad-code-review`)**: Verify test coverage and implementation quality
5. **Merge**: Single PR for Story 1a.7 (per one-push-per-story convention)

---

# Step 5: Validate & Complete

## 5.1 Validation Checklist

| Check                               | Status                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Story approved with clear ACs       | PASS — Story 1a.7, VS PASS 2026-07-09                                   |
| Dev environment ready               | PASS — 438 vitest + 29 Playwright green                                 |
| Framework scaffolding exists        | PASS — playwright.config.ts, vite.config.ts                             |
| Test directory structure identified | PASS — `e2e/`                                                           |
| Existing patterns reviewed          | PASS — minimap.spec.ts, spatial-index.spec.ts                           |
| Knowledge fragments loaded          | PASS — selector-resilience, test-quality, component-tdd, data-factories |
| Each AC analyzed for test level     | PASS — 13/13 ACs mapped                                                 |
| Priority framework applied          | PASS — P0(17) + P1(23) + P2(5)                                          |
| E2E test file created               | PASS — `e2e/toolbar-statusbar.spec.ts` (14 tests)                       |
| All tests use `test.skip()`         | PASS — 14/14 RED phase                                                  |
| Selectors use data-testid/ARIA      | PASS — no CSS class selectors                                           |
| No hard waits                       | PASS — only `waitForTimeout(300)` matching existing pattern             |
| API tests N/A                       | PASS — frontend-only story, zero endpoints                              |
| Component strategy documented       | PASS — 24 scenarios for DS TDD red phase                                |
| Checklist generated                 | PASS — this file                                                        |
| Story artifacts linked              | PASS — `### ATDD Artifacts` updated in story file                       |
| CLI sessions cleaned                | PASS — no CLI sessions used (AI generation mode)                        |
| Temp artifacts stored               | PASS — all in `_bmad-output/test-artifacts/`                            |

## 5.2 Polish Output

- **Duplication**: No repeated sections — progressive-append workflow clean
- **Consistency**: Terminology (data-testid, AC, P0-P2) consistent throughout
- **Completeness**: All template sections populated or explicitly marked N/A
- **Format**: Tables aligned, headers consistent, no orphaned references

## 5.3 Completion Summary

**ATDD workflow for Story 1a.7 — Toolbar & StatusBar — complete.**

### Generated Artifacts

| File                                                                   | Type                    | Status                            |
| ---------------------------------------------------------------------- | ----------------------- | --------------------------------- |
| `e2e/toolbar-statusbar.spec.ts`                                        | E2E Playwright scaffold | 14 tests, all `test.skip()` (RED) |
| `_bmad-output/test-artifacts/atdd-checklist-1a-7-toolbar-statusbar.md` | ATDD checklist          | Complete (5 steps)                |
| `_bmad-output/implementation-artifacts/1a-7-toolbar-statusbar.md`      | Story file              | Updated with ATDD artifact links  |

### Test Coverage Summary

| AC    | Description                  | E2E Tests             | Component (Strategy) |
| ----- | ---------------------------- | --------------------- | -------------------- |
| AC-1  | Toolbar rendering            | S1.3                  | S1.1, S1.2, S1.4     |
| AC-2  | Activation/disable matrix    | S2.5                  | S2.1-S2.4, S2.6      |
| AC-3  | Delete activation            | S3.1, S3.2, S3.4      | S3.5                 |
| AC-4  | Tool switching               | S4.1, S4.3            | S4.5                 |
| AC-5  | dt selector                  | —                     | S5.1-S5.4            |
| AC-6  | Zoom slider                  | S6.2                  | S6.1, S6.3, S6.4     |
| AC-7  | Chinese text                 | —                     | S7.1-S7.3            |
| AC-8  | StatusBar rendering          | S8.4                  | S8.1-S8.3, S8.5      |
| AC-9  | StatusBar active/placeholder | S9.1, S9.2            | S9.3-S9.6            |
| AC-10 | Keyboard a11y                | S10.1, S10.2, S10.5   | S10.3, S10.4         |
| AC-11 | Color-blind + contrast       | —                     | S11.1-S11.3          |
| AC-12 | No regression                | (existing suite gate) | S12.1-S12.3          |
| AC-13 | e2e coverage                 | (this file)           | —                    |

### Key Risks & Assumptions

1. **Selector contract**: Tests use `data-testid` values like `ns-toolbar-btn-新建` — implementation MUST use these exact testids. If different testids are chosen, tests will fail even after feature is built.
2. **`__e2e__` hooks**: Tests assume `setSelectedElementId` and `getToolMode` will be exposed on `window.__e2e__`. These hooks must be added during DS.
3. **`waitForChromeReady`**: Catches `waitForSelector` failures (`.catch(() => {})`) since toolbar/statusbar don't exist yet — this is intentional for red phase. The `.catch()` must be removed during green phase.
4. **Zoom slider fill()**: May need adjustment if the slider is implemented as a custom component rather than `<input type="range">`.

### Next Recommended Workflow

**`bmad-dev-story`** (DS) — implement Toolbar + StatusBar + AppShell per T0-T13 tasks. During DS:

1. Remove `test.skip()` from relevant tests as features are built
2. Create component tests per strategy (§3.5)
3. Verify all 14 E2E + ~24 component + ≥438 unit tests pass before CR

### Handoff Paths

- **Story**: `C:/Two/NewSD/_bmad-output/implementation-artifacts/1a-7-toolbar-statusbar.md`
- **Checklist**: `C:/Two/NewSD/_bmad-output/test-artifacts/atdd-checklist-1a-7-toolbar-statusbar.md`
- **E2E tests**: `C:/Two/NewSD/e2e/toolbar-statusbar.spec.ts`
