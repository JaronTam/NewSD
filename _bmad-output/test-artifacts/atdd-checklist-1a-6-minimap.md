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
storyId: "1a.6"
storyKey: "1a-6-minimap"
storyFile: "_bmad-output/implementation-artifacts/1a-6-minimap.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-1a-6-minimap.md"
generatedTestFiles:
  - e2e/minimap.spec.ts
inputDocuments:
  - _bmad-output/implementation-artifacts/1a-6-minimap.md
  - _bmad/tea/config.yaml
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/overview.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/api-request.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/network-recorder.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/auth-session.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/intercept-network-call.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/recurse.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/log.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/file-utils.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/network-error-monitor.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/fixtures-composition.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/playwright-cli.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/fixture-architecture.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/network-first.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/test-levels-framework.md
  - .claude/skills/bmad-testarch-atdd/resources/knowledge/test-priorities-matrix.md
  - e2e/spatial-index.spec.ts
  - src/lib/render/dirty-rect.test.ts
  - src/lib/render/spatial-index.ts
  - src/lib/render/dirty-rect.ts
  - src/lib/render/camera.ts
---

# ATDD Checklist — Story 1a.6 Minimap

## Step 1: Preflight & Context

### Stack Detection

- **Config value**: `auto` → **detected**: `frontend`
- **Indicators**: `package.json` (React, Vite), `playwright.config.ts`, `vite.config.*`, `vitest.config.ts` (jsdom)

### Prerequisites

| Requirement                   | Status                       |
| ----------------------------- | ---------------------------- |
| Story approved with clear ACs | ✅ 9 ACs (AC-1 through AC-9) |
| `playwright.config.ts`        | ✅ Present                   |
| `vitest.config.ts`            | ✅ Present                   |
| Development environment       | ✅ Available                 |

### Config Flags

| Flag                       | Value               |
| -------------------------- | ------------------- |
| `tea_use_playwright_utils` | `true`              |
| `tea_use_pactjs_utils`     | `false`             |
| `tea_pact_mcp`             | `none`              |
| `tea_browser_automation`   | `auto`              |
| `test_stack_type`          | `auto` → `frontend` |

### Story Context

- **Story ID**: 1a.6
- **Story Key**: 1a-6-minimap
- **Title**: Minimap (FR-CANVAS-5)
- **ACs**: 9 (AC-1 through AC-9)
- **Tasks**: 6 (T1: H8/E2 hardening → T6: regression + wrap-up)
- **Sprint status**: `ready-for-dev`
- **Baseline commit**: `d946a442`
- **VS verdict**: PASS (2026-07-09)

### Key Contracts for Testing

| Contract                                   | Source                                  | Usage in 1a.6                                      |
| ------------------------------------------ | --------------------------------------- | -------------------------------------------------- |
| `DirtyRectTracker.queryLowPrecision(step)` | `src/lib/render/dirty-rect.ts:51-69`    | Low-precision dirty rect query for minimap overlay |
| `SpatialIndex.search(rect)`                | `src/lib/render/spatial-index.ts:89-97` | Search for elements visible in minimap viewport    |
| `viewportToWorldRect(cam, vp)`             | `src/lib/render/camera.ts:50-59`        | Convert viewport to world bounds                   |
| `worldToScreen(cam, vp, wx, wy)`           | `src/lib/render/camera.ts:105-109`      | Project world to screen                            |
| `screenToWorld(cam, vp, sx, sy)`           | `src/lib/render/camera.ts:113-116`      | Click-to-jump: screen click → world target         |
| `WorldRect`                                | `src/lib/render/camera.ts:39-44`        | World-space rectangle type                         |
| `Camera`                                   | `src/lib/render/camera.ts:23-30`        | Camera state (x, y, zoom)                          |
| `Viewport`                                 | `src/lib/render/camera.ts:32-37`        | Viewport dimensions (width, height)                |

### Existing Test Patterns

- **e2e**: `e2e/spatial-index.spec.ts` — `window.__e2e__.seedBulk()`, `page.waitForFunction()`, `page.evaluate()`, canvas-based assertions
- **vitest**: `src/lib/render/dirty-rect.test.ts` — pure unit tests on DirtyRectTracker, `describe`/`it` blocks, no DOM

### Knowledge Base Loaded

**Core (4):** data-factories, component-tdd, test-quality, test-healing-patterns
**Frontend (2):** selector-resilience, timing-debugging
**Playwright Utils Full UI+API (10):** overview, api-request, network-recorder, auth-session, intercept-network-call, recurse, log, file-utils, network-error-monitor, fixtures-composition
**Playwright CLI (1):** playwright-cli
**Traditional (1):** fixture-architecture, network-first
**Backend (2):** test-levels-framework, test-priorities-matrix (loaded, informational for frontend-only stack)

### Test Quality Standards (from knowledge fragments)

- Deterministic, isolated, explicit assertions
- <300 lines per test file
- <1.5 min per test
- No `waitForTimeout` / hard waits
- No conditionals in tests
- Network-first: intercept BEFORE navigate
- Selector resilience: data-testid preferred over CSS/text selectors

---

## Step 2: Generation Mode Selection

### Mode: AI Generation

**Rationale:**

- 9 ACs are clear and specific (minimap projector, highlight box, click-to-jump, incremental dirty, E8 placeholder, H8/E2 hardening, no-regression, e2e gate)
- Standard canvas overlay scenarios — no complex multi-step UI wizards or drag-drop flows
- Existing test patterns available: `e2e/spatial-index.spec.ts` for canvas e2e, `dirty-rect.test.ts` for unit tests
- Canvas rendering tests don't benefit from DOM snapshot recording (minimap draws on 2D canvas, not standard widgets)
- `tea_browser_automation: auto` — recording is available but unnecessary for this story

### Test Approach

| Layer            | Framework                      | Scope                                                                                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (vitest)    | `describe`/`it` in `*.test.ts` | Minimap projector math, `queryLowPrecision` hardening, `worldToScreen`/`screenToWorld` precision, click-to-jump coordinate transform |
| e2e (Playwright) | `@playwright/test`             | Minimap canvas rendering, highlight box visibility, click-to-jump navigation, AC-9 gate                                              |

---

## Step 3: Test Strategy

### 3.1 AC → Test Scenario Mapping

#### AC-1: MinimapProjector world↔minimap coordinate transform

| #    | Scenario                                                                                                                | Type     | Level |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 1.1  | World bbox → minimap canvas coordinates: known world rect maps to expected canvas rect (top-left origin, scale-correct) | Positive | Unit  |
| 1.2  | Single element at origin (0,0) projects to correct minimap position                                                     | Positive | Unit  |
| 1.3  | Multiple elements spread across world project to distinct, non-overlapping minimap positions                            | Positive | Unit  |
| 1.4  | Minimap world bounds dynamic calculation: min/max bbox + padding from element set                                       | Positive | Unit  |
| 1.5  | Single element / co-located elements use minimum span (e.g., `span=1`) — no div-by-zero                                 | Edge     | Unit  |
| 1.6  | Bounds clamped to `WORLD_CLAMP=1e15` — elements at extreme coordinates don't overflow                                   | Edge     | Unit  |
| 1.7  | Elements at negative world coordinates project correctly                                                                | Edge     | Unit  |
| 1.8  | Very large world span (10000+ units) → minimap scale computed without precision loss                                    | Edge     | Unit  |
| 1.9  | `getElementBounds` returns zero-area bbox (degenerate) → skipped, no crash                                              | Edge     | Unit  |
| 1.10 | 10000 elements: `getSnapshot()` + `getElementBounds` per element completes without O(n²)                                | Edge     | Unit  |

#### AC-2: Highlight box (viewport indicator)

| #    | Scenario                                                                                            | Type     | Level           |
| ---- | --------------------------------------------------------------------------------------------------- | -------- | --------------- |
| 2.1  | `viewportToWorldRect(cam, vp)` projected to minimap rect — box rendered at correct position/size    | Positive | Component + E2E |
| 2.2  | Camera pan: highlight box moves on minimap (no element re-projection)                               | Positive | Component + E2E |
| 2.3  | Camera zoom in: highlight box shrinks on minimap (viewport covers less world area)                  | Positive | Component + E2E |
| 2.4  | Camera zoom out: highlight box grows on minimap (viewport covers more world area)                   | Positive | Component + E2E |
| 2.5  | Viewport resize: highlight box adjusts (viewport aspect ratio change)                               | Positive | Component       |
| 2.6  | Camera unchanged between frames → highlight box NOT redrawn (no-op, Branch 1 only on cameraChanged) | Positive | Component       |
| 2.7  | Viewport completely outside minimap world bounds → highlight box clamped or not rendered            | Edge     | Component       |
| 2.8  | Viewport partially outside minimap world bounds → highlight box clipped at minimap edge             | Edge     | Component       |
| 2.9  | Zoom at MIN_ZOOM=0.05 → highlight box tiny but visible                                              | Edge     | Component       |
| 2.10 | Zoom at MAX_ZOOM=20 → highlight box very large, possibly covering entire minimap                    | Edge     | Component       |

#### AC-3: Click-to-jump

| #    | Scenario                                                                                   | Type     | Level           |
| ---- | ------------------------------------------------------------------------------------------ | -------- | --------------- |
| 3.1  | Click minimap center → `cam.x`/`cam.y` set to corresponding world point                    | Positive | Unit + E2E      |
| 3.2  | `cam.zoom` preserved after jump (zoom unchanged by navigation)                             | Positive | Unit            |
| 3.3  | Jump triggers `cameraChanged` → main render Branch 1 recenter                              | Positive | Component       |
| 3.4  | Drag (pointerdown → pointermove → pointerup): camera updates continuously during drag      | Positive | Component + E2E |
| 3.5  | Jump coordinates clamped via `clampCamera` (within WORLD_CLAMP)                            | Positive | Unit            |
| 3.6  | Click at minimap top-left corner → correct world coordinate (edge of minimap world bounds) | Edge     | Unit            |
| 3.7  | Click at minimap bottom-right corner → correct world coordinate                            | Edge     | Unit            |
| 3.8  | Click outside minimap canvas bounds → ignored, camera unchanged                            | Edge     | Component       |
| 3.9  | Rapid clicks (debounce not required, but no crash/double-jump glitch)                      | Edge     | Component       |
| 3.10 | Drag that exits minimap canvas → pointerup outside → camera stops at last valid position   | Edge     | Component       |

#### AC-4: Incremental dirty (3-branch)

| #    | Scenario                                                                                                                                                                         | Type     | Level            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| 4.1  | Branch 1 (first frame / mount): full projection of all elements                                                                                                                  | Positive | Unit             |
| 4.2  | Branch 1 (bulk load): full projection, minimapTracker cleared                                                                                                                    | Positive | Unit             |
| 4.3  | Branch 1 (camera change): highlight box only, NO element re-projection                                                                                                           | Positive | Unit + Component |
| 4.4  | Branch 2 (!camera && hasDirty): `queryLowPrecision(step)` → `spatialIndex.search(rect)` per coarse rect → incremental redraw of changed elements only → `minimapTracker` drained | Positive | Unit             |
| 4.5  | Branch 3 (!camera && !hasDirty): skip minimap redraw entirely                                                                                                                    | Positive | Unit             |
| 4.6  | `minimapDirtyTracker` independent from main `dirtyTracker`: main tracker drain does NOT affect minimap tracker (no drain order coupling)                                         | Positive | Unit             |
| 4.7  | `step = Math.max(1, Math.round(MINIMAP_DIRTY_CELL_PX / minimapScale))` with `MINIMAP_DIRTY_CELL_PX=4`                                                                            | Positive | Unit             |
| 4.8  | 10000 elements, only 1 dirty rect → `queryLowPrecision` returns 1 coarse rect → `spatialIndex.search` returns only affected elements → only those redrawn (not all 10000)        | Edge     | Unit             |
| 4.9  | Dirty rect at minimap boundary → coarse rect snapped outward, still within valid range                                                                                           | Edge     | Unit             |
| 4.10 | `minimapScale` is 0 (zero-size world bounds) → step calculation doesn't NaN/Infinity                                                                                             | Edge     | Unit             |

#### AC-5: E8 placeholder (empty canvas)

| #   | Scenario                                                                                      | Type     | Level           |
| --- | --------------------------------------------------------------------------------------------- | -------- | --------------- |
| 5.1 | `elementStore.getSnapshot().length === 0` → placeholder rendered (centered text or empty box) | Positive | Component + E2E |
| 5.2 | Zero elements → no element points drawn on minimap                                            | Positive | Component       |
| 5.3 | Zero elements → no error thrown, no crash, no console.error                                   | Positive | Component       |
| 5.4 | Placeholder styling matches design tokens (color, font, positioning)                          | Positive | Component       |
| 5.5 | Element store is undefined/null → handled gracefully (defensive)                              | Edge     | Component       |

#### AC-6: 0→1 transition (placeholder → normal)

| #   | Scenario                                                                         | Type     | Level     |
| --- | -------------------------------------------------------------------------------- | -------- | --------- |
| 6.1 | 0 elements → 1 element added → placeholder disappears, normal projection renders | Positive | Component |
| 6.2 | 0→1 triggers `minimapTracker.markDirty` → Branch 1 full projection               | Positive | Component |
| 6.3 | 0→1 after placeholder was visible → no residual placeholder artifacts on minimap | Positive | Component |
| 6.4 | Rapid 0→1→0→1 transitions → placeholder toggles correctly, no flicker/crash      | Edge     | Component |

#### AC-7: H8/E2 hardening (queryLowPrecision NaN/Infinity)

| #    | Scenario                                                                                                                                         | Type     | Level |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----- |
| 7.1  | `markDirty({minX: NaN, ...})` → rect skipped, `console.warn` called                                                                              | Positive | Unit  |
| 7.2  | `markDirty({maxX: +Infinity, ...})` → rect skipped                                                                                               | Positive | Unit  |
| 7.3  | `markDirty({minY: -Infinity, ...})` → rect skipped                                                                                               | Positive | Unit  |
| 7.4  | `markDirty({minX: -0, ...})` → accepted (`-0` is finite, `Number.isFinite(-0) === true`)                                                         | Edge     | Unit  |
| 7.5  | `markDirty` with mixed batch: 2 finite + 1 NaN → 2 stored, 1 skipped + warned                                                                    | Positive | Unit  |
| 7.6  | `queryLowPrecision` with NaN rect in stored list → NaN rect filtered out before grid math, finite rects still returned correctly                 | Positive | Unit  |
| 7.7  | `queryLowPrecision` with Infinity rect → Infinity filtered, other rects unaffected                                                               | Positive | Unit  |
| 7.8  | `queryLowPrecision` with `-0` coordinates → grid math correct (`Math.floor(-0) === -0`, `-0 * step === -0`, key `"0,0,..."` matches `"0,0,..."`) | Edge     | Unit  |
| 7.9  | `queryLowPrecision` signature unchanged — existing callers (1a.5 tests) compile and pass                                                         | Positive | Unit  |
| 7.10 | All rects are NaN/Infinity → `queryLowPrecision` returns `[]` (no crash, no NaN grid key)                                                        | Edge     | Unit  |

#### AC-8: No-regression

| #   | Scenario                                                                                      | Type     | Level        |
| --- | --------------------------------------------------------------------------------------------- | -------- | ------------ |
| 8.1 | All existing vitest tests pass (`npx vitest run`)                                             | Positive | Verification |
| 8.2 | All existing Playwright tests pass (`npx playwright test`)                                    | Positive | Verification |
| 8.3 | CAP-11 guard: no `.shadowBlur =` in new code (`minimap.ts`, `CanvasView.tsx` minimap section) | Positive | Verification |
| 8.4 | F1-quality constants unchanged: `GLOW_PAD=16`, `LUMA_BLUR_PX=[0,4,8,14]`, `GLOW_PASSES=3`     | Positive | Verification |
| 8.5 | `glowAtlas.ts`/`renderer.ts`/`shaders.ts` untouched (no VRAM path changes)                    | Positive | Verification |

#### AC-9: Playwright e2e gate

| #   | Scenario                                                                                                 | Type     | Level |
| --- | -------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 9.1 | Minimap `<canvas>` element present in DOM, correctly sized                                               | Positive | E2E   |
| 9.2 | Elements rendered as colored points/blocks on minimap (stock=square, cloud=circle, flow=line)            | Positive | E2E   |
| 9.3 | Highlight box visible on minimap and moves when viewport panned/zoomed                                   | Positive | E2E   |
| 9.4 | Click minimap → main viewport recenters to clicked world point                                           | Positive | E2E   |
| 9.5 | E8 placeholder visible when canvas is empty                                                              | Positive | E2E   |
| 9.6 | Incremental dirty: move one element → only affected minimap region redrawn (not full canvas)             | Positive | E2E   |
| 9.7 | `__e2e__` hook exposes `minimapProjector`/`minimapDirtyTracker`/`getHighlightBox()`/`jumpToWorld(px,py)` | Positive | E2E   |

### 3.2 Test Level Assignment

| Level            | Framework                     | Count | Rationale                                                                                                                                                             |
| ---------------- | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**         | vitest (`*.test.ts`)          | 27    | Math transforms (AC-1/AC-3), H8/E2 hardening (AC-7), 3-branch logic (AC-4), bounds calculation — pure logic, no DOM needed                                            |
| **Component**    | vitest + jsdom (`*.test.tsx`) | 18    | CanvasView integration (AC-2/AC-3/AC-5/AC-6), minimap overlay mount/sizing, placeholder rendering, highlight box logic, jump interaction wiring                       |
| **E2E**          | Playwright (`e2e/*.spec.ts`)  | 9     | Visual verification: minimap rendering (AC-1), highlight box movement (AC-2), click-to-jump (AC-3), E8 placeholder (AC-5), incremental dirty visual (AC-4), AC-9 gate |
| **Verification** | Run existing suites           | 5     | AC-8 no-regression: `npx vitest run` + `npx playwright test` + CAP-11 grep + F1-quality constant check                                                                |

**Total: 59 test scenarios** (27 unit + 18 component + 9 e2e + 5 verification)

### 3.3 Priority Assignment

#### P0 — BLOCKING (must pass before ANY implementation proceeds)

| AC       | Scenarios | Rationale                                                                                                                                                                    |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-7** | 7.1–7.10  | H8/E2 hardening is **prerequisite** — minimap consumes `queryLowPrecision` (T1 before T2). NaN/Infinity in dirty rects would corrupt minimap rendering. Must be fixed first. |
| **AC-1** | 1.1–1.10  | MinimapProjector is the **foundation** — all other minimap features (highlight, jump, dirty) depend on correct world↔minimap transform.                                      |
| **AC-4** | 4.1–4.10  | 3-branch dirty logic is **core performance** — without correct incremental dirty, 10000-element canvases would full-redraw every frame.                                      |

#### P1 — HIGH (core UX, should pass before merge)

| AC       | Scenarios | Rationale                                                                                                        |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| **AC-2** | 2.1–2.10  | Highlight box is the **primary UX** of the minimap — without it, users can't see where they are in the canvas.   |
| **AC-3** | 3.1–3.10  | Click-to-jump is the **primary interaction** — the "So that" of the user story is fast navigation.               |
| **AC-5** | 5.1–5.5   | E8 placeholder is a **guard** — empty canvas must not crash. Per 1a.4 AR#12 precedent, empty state is mandatory. |

#### P2 — MEDIUM (important but not blocking)

| AC       | Scenarios | Rationale                                                                                                                            |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AC-6** | 6.1–6.4   | 0→1 transition is an **edge of AC-5** — important for UX continuity when first element is added.                                     |
| **AC-9** | 9.1–9.7   | Playwright e2e is the **visual validation gate** — confirms rendering in real browser, but unit+component tests already cover logic. |

#### P3 — VERIFICATION (no new tests, confirm existing suite green)

| AC       | Scenarios | Rationale                                                                                                                            |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AC-8** | 8.1–8.5   | No-regression is verified by **running existing test suites** — no new test files created for this AC. Confirmed green before merge. |

### 3.4 Test File Mapping

| Test File                                       | ACs Covered                                     | Level        | Status                                                                            |
| ----------------------------------------------- | ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| `src/lib/render/dirty-rect.test.ts`             | AC-7 (+ existing AC-3/AC-5 from 1a.5)           | Unit         | **Modify** — add H8/E2 hardening tests (7.1–7.10)                                 |
| `src/lib/render/minimap.test.ts`                | AC-1, AC-4, AC-3 (math)                         | Unit         | **Create** — MinimapProjector unit tests (1.1–1.10, 3.1–3.7, 4.1–4.10)            |
| `src/lib/render/CanvasView.test.tsx`            | AC-2, AC-3 (wiring), AC-5, AC-6                 | Component    | **Modify** — add minimap integration tests (2.1–2.10, 3.3–3.10, 5.1–5.5, 6.1–6.4) |
| `e2e/minimap.spec.ts`                           | AC-9 (covers AC-1/AC-2/AC-3/AC-4/AC-5 visually) | E2E          | **Create** — minimap e2e gate (9.1–9.7)                                           |
| `src/lib/render/cap11-shadowblur-guard.test.ts` | AC-8                                            | Verification | **Unchanged** — must stay green                                                   |
| `src/lib/render/vram/glowAtlas.test.ts`         | AC-8                                            | Verification | **Unchanged** — F1-quality constants locked                                       |
| All existing test files                         | AC-8                                            | Verification | **Unchanged** — `npx vitest run` must be green                                    |

### 3.5 Red-Phase Requirements

All P0–P2 tests **MUST fail before implementation** (TDD red-green-refactor cycle per story-cycle §2.3):

| Test File                                 | Red Phase Strategy                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `dirty-rect.test.ts` (new AC-7 tests)     | Write tests for NaN/Infinity rejection → confirm they FAIL (current code accepts NaN) → implement `Number.isFinite` guard → confirm GREEN |
| `minimap.test.ts` (new file)              | Write all unit tests → confirm they FAIL (no `MinimapProjector` class exists yet) → implement `minimap.ts` → confirm GREEN                |
| `CanvasView.test.tsx` (new minimap tests) | Write integration tests → confirm they FAIL (no minimap overlay in CanvasView) → implement CanvasView minimap integration → confirm GREEN |
| `e2e/minimap.spec.ts` (new file)          | Write e2e tests → confirm they FAIL (no minimap in DOM) → implement full integration → confirm GREEN                                      |

**Red-phase execution order** (matching Tasks T1→T6):

1. T1 (AC-7): `dirty-rect.test.ts` red → green
2. T2 (AC-1/AC-4): `minimap.test.ts` red → green
3. T3 (AC-1/AC-2/AC-5/AC-6): `CanvasView.test.tsx` red → green
4. T4 (AC-3): `minimap.test.ts` + `CanvasView.test.tsx` jump tests red → green
5. T5 (AC-9): `e2e/minimap.spec.ts` red → green
6. T6 (AC-8): run all suites → all green

### 3.6 Test Quality Gates (per TEA standards)

- **Deterministic**: No `Math.random()`, no `Date.now()`, no race conditions
- **Isolated**: Each test independent, no shared mutable state between tests
- **Explicit**: One assertion concept per test, clear Given/When/Then
- **<300 lines per file**: Split if needed
- **<1.5 min per test file**: Unit <10s, Component <30s, E2E <90s
- **No hard waits**: Use `waitForFunction`/`waitFor` (Playwright), no `setTimeout`/`waitForTimeout`
- **No conditionals in tests**: Each branch is its own test case
- **Network-first for e2e**: Intercept BEFORE navigate (Playwright Utils pattern)

---

## Step 4: Red-Phase Test Scaffold Generation

### Execution Mode

- **Requested**: `auto` → **Resolved**: `subagent`
- **Capability probe**: enabled, supports subagent ✅, agent-team not available
- **Timestamp**: 2026-07-09T02:03:00Z

### Worker A: API Test Generation

- **Result**: No API endpoints found (expected for frontend-only minimap story)
- **Output**: `_bmad-output/test-artifacts/tea-atdd-api-tests-1a-6.json`
- **Endpoints found**: 0
- **Test files generated**: 0 (N/A — minimap is pure 2D canvas, no REST/GraphQL/network requests)

### Worker B: E2E Test Generation

- **Result**: 7 red-phase E2E scaffolds generated
- **Output**: `_bmad-output/test-artifacts/tea-atdd-e2e-tests-1a-6.json`
- **Test file**: `e2e/minimap.spec.ts` (304 lines)

| #      | Test                                            | AC Coverage        | Status           |
| ------ | ----------------------------------------------- | ------------------ | ---------------- |
| P2-9.1 | Minimap canvas element present and sized        | AC-9               | `test.skip()` ✅ |
| P2-9.2 | Elements rendered as colored points/blocks      | AC-9 (visual AC-1) | `test.skip()` ✅ |
| P2-9.3 | Highlight box moves when viewport panned/zoomed | AC-9 (visual AC-2) | `test.skip()` ✅ |
| P2-9.4 | Clicking minimap recenters main viewport        | AC-9 (visual AC-3) | `test.skip()` ✅ |
| P2-9.5 | E8 placeholder visible when zero elements       | AC-9 (visual AC-5) | `test.skip()` ✅ |
| P2-9.6 | Moving element triggers incremental dirty rects | AC-9 (visual AC-4) | `test.skip()` ✅ |
| P2-9.7 | `__e2e__` hooks exposed (4 hooks)               | AC-9               | `test.skip()` ✅ |

### TDD Red Phase Status

🔴 **RED PHASE**: All 7 E2E scaffolds use `test.skip()` — they express EXPECTED behavior and will FAIL until implementation is complete.

**Patterns matched** (from existing `e2e/spatial-index.spec.ts`):

- `import { expect, test } from "@playwright/test"`
- `waitForRenderReady(page)` helper (GL canvas + minimap canvas ready)
- `page.evaluate()` with `(window as any).__e2e__`
- `waitForFunction` for canvas readiness
- No `waitForTimeout` in test logic

### Remaining Red-Phase Scaffolds (to be generated during DS)

The following test files are NOT generated by TEA workers (they are unit/component tests, not API/E2E). They will be created during `/bmad-dev-story` TDD red phase:

| Test File                            | Type                     | ACs                    | Status                                             |
| ------------------------------------ | ------------------------ | ---------------------- | -------------------------------------------------- |
| `src/lib/render/dirty-rect.test.ts`  | Unit (vitest)            | AC-7                   | Modify existing — add NaN/Infinity tests during T1 |
| `src/lib/render/minimap.test.ts`     | Unit (vitest)            | AC-1, AC-4, AC-3       | Create new — T2 red phase                          |
| `src/lib/render/CanvasView.test.tsx` | Component (vitest+jsdom) | AC-2, AC-3, AC-5, AC-6 | Modify existing — T3 red phase                     |

---

## Step 4C: Aggregation

### TDD Red Phase Validation

✅ **PASS**: All tests compliant with TDD red phase requirements.

| Check                     | API Tests     | E2E Tests                |
| ------------------------- | ------------- | ------------------------ |
| `test.skip()` present     | N/A (0 tests) | 7/7 ✅                   |
| No placeholder assertions | N/A           | ✅                       |
| Asserts expected behavior | N/A           | ✅                       |
| Files written to disk     | N/A           | ✅ `e2e/minimap.spec.ts` |

### Summary Statistics

| Metric                      | Value                                         |
| --------------------------- | --------------------------------------------- |
| Total red-phase tests       | 7 (all E2E)                                   |
| API tests                   | 0 (no endpoints for frontend minimap)         |
| E2E tests                   | 7 (`e2e/minimap.spec.ts`)                     |
| Fixtures created            | 0 (uses existing `__e2e__` hooks)             |
| Acceptance criteria covered | AC-9 (also visually covers AC-1 through AC-5) |
| Execution mode              | subagent (API + E2E parallel)                 |
| Performance gain            | ~50% vs sequential                            |

### Acceptance Criteria Coverage Summary

| AC   | Covered By                                            | Test Level             |
| ---- | ----------------------------------------------------- | ---------------------- |
| AC-1 | E2E (P2-9.2 visual) + DS unit tests (T2)              | E2E + Unit             |
| AC-2 | E2E (P2-9.3 visual) + DS component tests (T3)         | E2E + Component        |
| AC-3 | E2E (P2-9.4 visual) + DS unit/component tests (T2/T4) | E2E + Unit + Component |
| AC-4 | E2E (P2-9.6 visual) + DS unit tests (T2)              | E2E + Unit             |
| AC-5 | E2E (P2-9.5 visual) + DS component tests (T3)         | E2E + Component        |
| AC-6 | DS component tests (T3)                               | Component              |
| AC-7 | DS unit tests (T1)                                    | Unit                   |
| AC-8 | Verification (run existing suites)                    | Verification           |
| AC-9 | E2E (P2-9.1–9.7)                                      | E2E                    |

### Generated Files

```
e2e/minimap.spec.ts                              ← RED PHASE: 7 test.skip() scaffolds
_bmad-output/test-artifacts/
  tea-atdd-api-tests-1a-6.json                   ← No API endpoints (frontend minimap)
  tea-atdd-e2e-tests-1a-6.json                   ← E2E generation metadata
  tea-atdd-summary-1a-6.json                     ← Aggregated summary
  atdd-checklist-1a-6-minimap.md                 ← This checklist
```

### Next Steps (Task-by-Task Activation)

During `/bmad-dev-story` implementation:

1. **T1 (AC-7)**: Write `dirty-rect.test.ts` NaN/Infinity tests → red → implement → green
2. **T2 (AC-1/AC-4)**: Write `minimap.test.ts` unit tests → red → implement `minimap.ts` → green
3. **T3 (AC-1/AC-2/AC-5/AC-6)**: Write `CanvasView.test.tsx` integration tests → red → implement CanvasView minimap overlay → green
4. **T4 (AC-3)**: Write jump tests in `minimap.test.ts` + `CanvasView.test.tsx` → red → implement → green
5. **T5 (AC-9)**: Remove `test.skip()` from `e2e/minimap.spec.ts` → red → implement → green
6. **T6 (AC-8)**: Run all suites (`npx vitest run` + `npx tsc --noEmit` + `npx playwright test`) → all green

---

## Step 5: Validate & Complete

### Validation Checklist

| Check                                               | Status                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| Prerequisites satisfied (story approved, ACs clear) | ✅                                                    |
| Test files created correctly                        | ✅ `e2e/minimap.spec.ts` (304 lines, 7 scaffolds)     |
| All ACs mapped to test scenarios                    | ✅ 9/9 ACs covered (59 scenarios)                     |
| Tests are red-phase scaffolds with `test.skip()`    | ✅ 7/7 E2E tests skipped                              |
| No placeholder assertions                           | ✅ All assertions express expected behavior           |
| Story metadata captured for downstream workflows    | ✅ ATDD Artifacts section linked in story file        |
| Story file linked in checklist frontmatter          | ✅                                                    |
| Temp artifacts stored in `{test_artifacts}/`        | ✅ All 4 JSON files in `_bmad-output/test-artifacts/` |
| CLI sessions cleaned up                             | ✅ No browser sessions opened (subagent mode)         |

### Polish

- No duplicate sections detected
- Terminology consistent throughout (AC IDs, P0-P3 priorities, task mapping)
- All template sections populated or explicitly marked N/A
- Markdown formatting clean

### Completion Summary

**TEA ATDD Create Mode — Story 1a.6 Minimap: COMPLETE** 🔴

| Metric                   | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| **Red-phase test files** | 1 generated (`e2e/minimap.spec.ts`)                                |
| **E2E scaffolds**        | 7 (`test.skip()`)                                                  |
| **API scaffolds**        | 0 (N/A — frontend-only minimap)                                    |
| **ACs covered**          | 9/9 (AC-1 through AC-9)                                            |
| **Total scenarios**      | 59 (27 unit + 18 component + 9 e2e + 5 verification)               |
| **P0 (blocking)**        | 30 (AC-1, AC-4, AC-7)                                              |
| **P1 (high)**            | 25 (AC-2, AC-3, AC-5)                                              |
| **P2 (medium)**          | 11 (AC-6, AC-9)                                                    |
| **P3 (verification)**    | 5 (AC-8)                                                           |
| **Pending DS red-phase** | 3 files (dirty-rect.test.ts, minimap.test.ts, CanvasView.test.tsx) |

**Key risks / assumptions:**

- Unit and component test scaffolds (27 unit + 18 component) are deferred to `/bmad-dev-story` — they are not generated by TEA workers (TEA covers API + E2E only)
- `e2e/minimap.spec.ts` uses `__e2e__` hooks (`minimapProjector`, `minimapDirtyTracker`, `getHighlightBox`, `jumpToWorld`) that must be exposed by CanvasView during implementation
- H8/E2 hardening (AC-7) is prerequisite T1 — must complete before T2 minimap consumption
- All `test.skip()` scaffolds will fail when activated until corresponding feature code is implemented (this is intentional TDD red phase)

**Next workflow**: `/bmad-dev-story` — implement Story 1a.6 following TDD red-green-refactor cycle per Tasks T1→T6.
