# 🔴 Red-Phase ATDD Prompt: Story 1a.5 Playwright E2E Tests

> **TDD Phase**: RED (write failing test scaffolds BEFORE implementation)
> **Target model**: Any capable LLM with access to this codebase
> **Output**: 1 new Playwright spec file: `e2e/spatial-index.spec.ts` with `test.skip()` scaffolding
> **Expected result after generation**: `npx playwright test` shows new tests as skipped (15 existing stay green)

---

## Mission

You are a Test Architect executing TDD RED phase for Story 1a.5 ("Spatial Index & Viewport Culling") of the NewSD project. Write **failing Playwright e2e test scaffolds** that validate spatial indexing, viewport culling effectiveness, dirty rect tracking, and PerformanceProbe sampling.

**Critical rule**: All new tests MUST use `test.skip()` — they are recorded but don't break CI. They will be activated (unskipped) during DS green phase when implementation is complete.

---

## Project Context

**NewSD**: A system dynamics modeling tool with an infinite canvas. The app runs as a React SPA at `http://localhost:3000` (dev server). The canvas has two layers: a 2D surface canvas (`.ns-canvas__surface`) and a WebGL2 overlay (`.ns-canvas__gl`).

**Key test infrastructure** (from existing e2e specs):

- `__e2e__` global hook (dev-only) exposes: `elementStore`, `createFlow`, `buildInstances()`, `charToGlyphIdx()`
- `waitForRenderReady(page)`: waits for `.ns-canvas__skeleton` hidden + GL canvas non-zero size + 200ms settle
- `waitForTimeout(100)` used for store→render pipeline settle (animation frames)
- Non-bg pixel counting via `gl.readPixels` for visual gates
- Screenshot-based visual regression baselines

**Existing e2e specs to reference** (in `e2e/`):

- `stock-render.spec.ts` — mounts check, WebGL2 probe, non-bg pixel gate, pixel snapshot
- `flow-render.spec.ts` — `createFlowAndWait` helper, `builtInstances` via `__e2e__`, glyphIdx lookup
- `cloud-render.spec.ts` — similar pattern

**For Story 1a.5, the `__e2e__` hook will be extended with** (does not exist yet):

- `__e2e__.seedBulk(n: number): void` — creates n test elements (stocks at random world positions)
- `__e2e__.buildInstances(): RenderInstance[]` — returns current visible instance array (already exists from 1a.4 as `api.buildInstances()`)
- `__e2e__.spatialIndex: SpatialIndex` — exposes SpatialIndex instance
- `__e2e__.perfProbe.getMetrics(): PerfMetrics` — returns `{fpsP95, loadMs, memP95}`

**Playwright config**: `playwright.config.ts` at project root. Web server auto-starts dev server. Run with `npx playwright test`.

---

## Test File to Generate

### FILE (NEW): `e2e/spatial-index.spec.ts`

**Tests AC-4, AC-6, AC-7, AC-9** (culling effectiveness, perf probe, dirty rect gate).

**IMPORTANT**: Mirror the structure of `e2e/stock-render.spec.ts` and `e2e/flow-render.spec.ts`:

- Same `waitForRenderReady` helper (copy the function)
- Same `test.describe` grouping pattern
- Same `page.evaluate(() => { const api = (window as any).__e2e__; ... })` pattern for hook access

**Helper functions** (include in the spec file):

```typescript
// Copy from stock-render.spec.ts:
async function waitForRenderReady(page: Page) {
  await page
    .waitForSelector(".ns-canvas__skeleton", { state: "hidden", timeout: 10_000 })
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      return c !== null && c.width > 0 && c.height > 0;
    },
    { timeout: 10_000 },
  );
  await page.waitForTimeout(200);
}

// New helper: seed bulk elements via __e2e__ hook
async function seedBulk(page: Page, n: number) {
  await page.evaluate((count) => {
    const api = (window as any).__e2e__;
    if (!api || typeof api.seedBulk !== "function")
      throw new Error("__e2e__.seedBulk not found — 1a.5 hook not available");
    api.seedBulk(count);
  }, n);
  // Wait for store → spatial-index sync → rebuild → render
  await page.waitForTimeout(200);
}

// New helper: get visible instance count
async function visibleInstanceCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const api = (window as any).__e2e__;
    if (!api || typeof api.buildInstances !== "function")
      throw new Error("__e2e__.buildInstances not found");
    return api.buildInstances().length;
  });
}

// New helper: get perf metrics
async function getPerfMetrics(page: Page): Promise<{
  fpsP95: number;
  loadMs: number;
  memP95?: number;
}> {
  return page.evaluate(() => {
    const api = (window as any).__e2e__;
    if (!api?.perfProbe?.getMetrics) throw new Error("__e2e__.perfProbe not found");
    return api.perfProbe.getMetrics();
  });
}
```

**Test cases** (ALL use `test.skip`):

```
test.describe('spatial index — culling effectiveness (AC-4, AC-6, AC-9)')

  test.skip('AC-9 ①: culling reduces visible instances when viewport shows subset (1000 elements)')
    - goto "/"
    - waitForRenderReady
    - seedBulk(1000) — elements scattered across large world area
    - visibleInstanceCount < 1000 (viewport only shows a portion)
    - visibleInstanceCount > 0 (not zero — some are visible)

  test.skip('AC-9 ①: culling reduces visible instances (10000 elements)')
    - goto "/"
    - waitForRenderReady
    - seedBulk(10000)
    - visibleInstanceCount < 10000
    - visibleInstanceCount > 0

  test.skip('AC-9 ②: all on-screen elements present in instance set (no missing)')
    - seedBulk with elements at known world positions (e.g., tight cluster near origin)
    - center viewport on that cluster
    - visibleInstanceCount equals total seed count (all in viewport)

  test.skip('AC-9 ③: pan changes visible set')
    - seedBulk(100) at known positions
    - record visibleInstanceCount at initial position → count_A
    - pan the canvas (keyboard or programmatic camera move)
    - waitForRenderReady
    - record visibleInstanceCount at new position → count_B
    - count_A !== count_B (viewport moved, different elements visible)
    - OR: count_B !== undefined (at minimum, pan doesn't crash)

  test.skip('AC-9 ③: visible set updates after pan (semantic check)')
    - seedBulk such that cluster A is at world (-500,0) and cluster B at (500,0)
    - position camera at (-500,0) → only cluster A visible
    - pan to (500,0)
    - previously invisible cluster B now visible; previously visible cluster A may be invisible

  test.skip('static scene: no render when nothing changes (AC-3 skip-render branch)')
    - goto "/"
    - waitForRenderReady (first frame renders)
    - wait several frames with no interaction
    - PerformanceProbe reports frame skips (verifies AC-3 third branch: !camera && !hasDirty → skip)
    - NOTE: This is a behavioral test — the exact assertion depends on how skip detection is exposed

test.describe('spatial index — dirty rect tracking (AC-9 ④)')

  test.skip('AC-9 ④: element move marks dirty rect (old + new bbox)')
    - creates an element at known position
    - moves it to new position
    - spatialIndex tracks dirty rects containing old bbox + new bbox
    - NOTE: DirtyRectTracker state exposed via __e2e__ or spatialIndex for assertion

test.describe('spatial index — PerformanceProbe (AC-7, AC-9 ⑤)')

  test.skip('AC-9 ⑤: PerformanceProbe returns non-zero frame-time samples after render')
    - goto "/"
    - waitForRenderReady
    - wait several frames (500ms)
    - getPerfMetrics().fpsP95 > 0
    - getPerfMetrics().loadMs > 0

  test.skip('PerformanceProbe samples accumulate over time')
    - goto "/"
    - waitForRenderReady
    - metrics_early = getPerfMetrics()
    - wait 1000ms
    - metrics_late = getPerfMetrics()
    - metrics_late.loadMs > metrics_early.loadMs (load time monotonically increases)

test.describe('spatial index — canvas health (regression gate, AC-8)')

  test.skip('canvas still mounts both surface and WebGL2 overlay after spatial index')
    - goto "/"
    - waitForSelector canvas.ns-canvas__surface (visible)
    - waitForSelector canvas.ns-canvas__gl (visible)
    - both visible

  test.skip('non-bg pixels still render after spatial index integration')
    - goto "/"
    - waitForRenderReady
    - readPixels from GL canvas
    - non-bg pixel count > 0 (existing stock seed renders)

  test.skip('flow glyphs still render after spatial index integration')
    - goto "/"
    - waitForRenderReady
    - createFlow via __e2e__ hook (between existing seed stocks)
    - non-bg pixel count increases after flow creation
    - "▶" arrowhead glyph present in buildInstances()

  test.skip('pixel snapshot — spatial index visual regression baseline')
    - goto "/"
    - waitForRenderReady
    - page.screenshot() → non-empty PNG (>100 bytes)
```

---

## Important Design Decisions (from Story CS)

These constraints shape the tests:

1. **Culling effectiveness, not absolute FPS**: Playwright uses SwiftShader (software WebGL), which is NOT representative of real GPU performance. Tests assert `buildInstances().length < total` (culling works), NOT `fps >= 30`. Absolute FPS validation is via `PerformanceProbe` in real browsers / RUM.

2. **Static scene skip-render**: When camera is stationary and no elements changed (`!camera && !hasDirty`), the render loop should SKIP WebGL render entirely. This is the key steady-state perf optimization.

3. **WebGL scissor out-of-scope**: No `gl.scissor()` usage. The "partial redraw" is at the instance-build layer (only dirty elements rebuilt), not at the screen-pixel layer.

4. **Pan does not trigger R-tree re-sync**: Camera change → only re-query visible set (fast), not rebuild the index. Elements haven't changed.

5. **`seedBulk(n)` is test-only**: Not a production API. Creates n stock elements at random/deterministic world positions for perf testing.

6. **`__e2e__.buildInstances()` returns CURRENT visible instances**: Post-culling, not all elements. This is the key assertion target.

7. **If Claude needs to visually verify Playwright screenshots**: STOP and ask user to "⚠ switch to multimodal" first (§7 gate).

---

## Global Rules

1. **All tests MUST use `test.skip()`** — this is RED phase.
2. **Mirror existing e2e spec structure**: `test.describe` grouping, `waitForRenderReady`, `page.evaluate` for `__e2e__` access.
3. **No `.shadowBlur =` in any test code** — CAP-11 structural guard.
4. **Use `waitForTimeout` sparingly** — only for render pipeline settle (100-200ms). Prefer `waitForFunction` / `waitForSelector` for deterministic waits.
5. **Test isolation**: Each test should be independent. Don't rely on state from previous tests.
6. **No screenshot visual assertions relying on exact pixel content** — SwiftShader is non-deterministic at pixel level. Use non-bg pixel counts and instance-set assertions instead.
7. **After writing**: Run `npx playwright test e2e/spatial-index.spec.ts` — all tests should show as skipped. Existing 15 tests stay green.

---

## Output Instructions

After writing the spec file:

1. Run `npx playwright test --list` to verify the spec is discovered
2. Run `npx playwright test e2e/spatial-index.spec.ts` — all skipped (or run existing 15 to confirm no regression)
3. Report any compilation/import errors
4. Confirm the spec structure mirrors existing `stock-render.spec.ts` patterns

**Do NOT implement any production code.** This is RED phase — only test scaffolds.
