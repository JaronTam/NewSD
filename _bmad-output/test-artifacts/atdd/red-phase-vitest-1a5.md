# 🔴 Red-Phase ATDD Prompt: Story 1a.5 Vitest Unit Tests

> **TDD Phase**: RED (write failing test scaffolds BEFORE implementation)
> **Target model**: Any capable LLM (Claude, GPT, Gemini, DeepSeek, etc.)
> **Output**: 4 new test files + 2 modified test files, all with `test.skip()` or `test.fails()` scaffolding
> **Expected result after generation**: `npx vitest run` shows new tests as skipped (305 existing tests stay green)

---

## Mission

You are a Test Architect executing TDD RED phase for Story 1a.5 ("Spatial Index & Viewport Culling") of the NewSD project. Write **failing test scaffolds** that define expected behavior BEFORE implementation exists.

**Critical rule**: All new tests MUST use `test.skip()` so they are recorded but don't break CI. They will be activated (unskipped) during DS green phase when implementation is written.

---

## Project Context

**NewSD**: A system dynamics modeling tool with an infinite canvas rendered via WebGL2 instanced glyph atlas. The frontend is React 19 + TanStack Start + Vite (ESM). Tests use vitest + jsdom (unit) and Playwright (e2e).

**Key architecture constraints**:

- **AD-9 (F1 VRAM render)**: WebGL2 instanced rendering with pre-baked glow atlas. `shadowBlur` ONLY allowed in `bakeGlowAtlasCanvas` (off-screen bake). Runtime per-glyph `shadowBlur` is FORBIDDEN (CAP-11).
- **F1-quality locked constants**: `GLOW_PAD=16`, `LUMA_BLUR_PX=[0,4,8,14]`, `GLOW_PASSES=3` — must never change.
- **No Wasm/Go/Rust deps** for 1a.5: Pure TypeScript rendering path.
- **E7**: Float64 precision, `WORLD_CLAMP=1e15`.

**Source files you need to understand** (READ before writing tests):

| File                              | Role                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/render/camera.ts`        | `Camera`, `Viewport`, `worldToScreen`, `screenToWorld`, `WORLD_CLAMP` — existing; you add `viewportToWorldRect`     |
| `src/lib/render/elements.ts`      | `getElementBounds(el)` returns `{x,y,width,height}` world bbox for stock/cloud/flow; `findElementAt` is O(n) (kept) |
| `src/lib/render/vram/renderer.ts` | `RenderInstance` (9 fields), `render(cam,vp,instances)` full draw, `setInstance(idx,partial)`                       |
| `src/lib/sd/store.ts`             | `ElementStore` with `subscribe(cb)`, `getElements()`, `notify()`                                                    |
| `src/lib/sd/types.ts`             | `SDElement = Stock                                                                                                  | Cloud | Flow` |
| `src/lib/render/CanvasView.tsx`   | `buildInstancesFromStore`, render loop, `__e2e__` hook                                                              |

**Existing test conventions** (mirror these patterns):

- Tests in `src/lib/render/*.test.ts` use vitest + jsdom
- Import from vitest: `describe`, `it`/`test`, `expect`, `vi`, `beforeEach`
- Pure functions tested directly; classes instantiated; React components use `@testing-library/react`
- Mock strategy: `vi.mock()` for modules, `vi.fn()` for callbacks, `vi.spyOn()` for method tracking
- No hard waits; use `vi.advanceTimersByTime()` for timer-dependent code
- Existing test files to reference: `camera.test.ts`, `elements.test.ts`, `store.test.ts`, `CanvasView.test.tsx`

---

## Test Files to Generate

### FILE 1 (NEW): `src/lib/render/spatial-index.test.ts`

**Tests AC-1** (R-tree SpatialIndex + rbush v4.0.1).

**Module under test** (does not exist yet — write tests against the EXPECTED API):

```typescript
// Expected API (from story AC-1):
class SpatialIndex {
  constructor(elementStore: ElementStore, maxEntries?: number); // default maxEntries=9
  search(rect: { minX: number; minY: number; maxX: number; maxY: number }): SDElement[];
  collides(rect: { minX: number; minY: number; maxX: number; maxY: number }): boolean;
  insert(el: SDElement): void;
  remove(el: SDElement): void;
  load(elements: SDElement[]): void; // bulk load (rbush.load, OMT algorithm)
  sync(prev: SDElement[], next: SDElement[]): void; // diff → insert/remove/update only changed
  // Subscribes to elementStore.subscribe for auto-sync
}
```

**Test cases** (ALL use `test.skip`):

```
# Test Suite: SpatialIndex

## Construction
test.skip('constructs with default maxEntries=9')
test.skip('constructs with custom maxEntries')
test.skip('constructs with empty element store (no error)')

## Bulk Load + Search
test.skip('search(viewport) returns elements whose bbox intersects viewport')
  - load 100 elements in a 1000x1000 world grid
  - search a 100x100 viewport in the center
  - assert only elements within or intersecting that rect are returned
test.skip('search(viewport) returns empty array when no elements intersect')
  - load elements all at world coords (1000,1000)-(1100,1100)
  - search viewport at (0,0)-(100,100)
  - assert result is []
test.skip('search(viewport) returns all elements when viewport covers entire world')
test.skip('search handles edge-touching elements (boundary = intersection)')
  - element bbox exactly touches viewport edge (e.g., maxX === viewport.minX)
  - rbush `search` is inclusive on boundary — verify element IS returned

## Point Query (collides)
test.skip('collides(rect) returns true when element overlaps')
test.skip('collides(rect) returns false when no element overlaps')

## Incremental Insert/Remove
test.skip('insert then search finds the new element')
test.skip('remove then search no longer finds the element')
test.skip('insert then remove different element — only removed one missing')

## Sync (diff prev/next)
test.skip('sync inserts new elements not in prev')
test.skip('sync removes elements not in next')
test.skip('sync updates elements whose bbox changed (move/resize)')
  - same id, different position → treated as remove(old)+insert(new)
test.skip('sync does nothing when prev === next (no-op, no rbush calls)')
  - spy on rbush insert/remove, assert 0 calls

## Flow bbox indexing
test.skip('flow elements are indexed by their path bbox (getElementBounds)')
  - verify flow's bbox (path extent) is used, not stock bbox

## Empty/edge cases
test.skip('search on empty index returns []')
test.skip('collides on empty index returns false')
test.skip('remove non-existent element does not throw')
test.skip('insert duplicate id replaces old entry')
```

**Mock strategy**:

- Mock `rbush` default export: `vi.mock('rbush')` or mock the SpatialIndex's internal rbush instance
- Create test SDElements via factory functions (pattern: `createStock(overrides)` → see `elements.test.ts` for conventions)
- Mock `getElementBounds` to return controllable bbox values

---

### FILE 2 (NEW): `src/lib/render/dirty-rect.test.ts`

**Tests AC-3 + AC-5** (DirtyRectTracker + queryLowPrecision API contract).

**Module under test** (does not exist yet):

```typescript
// Expected API:
interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

class DirtyRectTracker {
  markDirty(rect: WorldRect): void;
  consume(): WorldRect[]; // drain + return all dirty rects
  hasDirty(): boolean;
  clear(): void;
  queryLowPrecision(step: number): WorldRect[]; // AC-5: grid-coarse merge
}
```

**Test cases** (ALL use `test.skip`):

```
# Test Suite: DirtyRectTracker

## markDirty / hasDirty / consume
test.skip('hasDirty returns false on fresh tracker')
test.skip('markDirty then hasDirty returns true')
test.skip('consume returns all marked rects and drains (hasDirty→false after)')
test.skip('consume on empty tracker returns []')
test.skip('multiple markDirty calls accumulate — consume returns all')

## clear
test.skip('clear empties all tracked rects — hasDirty→false, consume→[]')
test.skip('clear then markDirty — fresh state, only new rect tracked')

## queryLowPrecision (AC-5 API contract)
test.skip('queryLowPrecision(step) returns [] when no dirty rects')
test.skip('queryLowPrecision merges adjacent rects within same grid cell')
  - mark two rects that fall in the same coarse grid cell
  - queryLowPrecision with step=gridSize
  - assert returned rects are merged (fewer rects than marked)
test.skip('queryLowPrecision does not merge rects in different grid cells')
test.skip('queryLowPrecision with step=1 returns original rects (no merge at resolution 1)')
test.skip('queryLowPrecision with step=Infinity returns single bounding rect')
test.skip('queryLowPrecision preserves total dirty area (no holes introduced)')
  - merge result MBR must contain all original rects
test.skip('queryLowPrecision signature locked: (step: number) => rect[] (AC-5 contract)')

## Edge cases
test.skip('markDirty with zero-area rect (minX===maxX) — still tracked')
test.skip('markDirty with negative-extent rect (maxX < minX) — normalized or tracked as-is')
test.skip('large number of dirty rects (1000) — performance acceptable (<50ms)')
```

---

### FILE 3 (NEW): `src/lib/render/perf-probe.test.ts`

**Tests AC-7** (PerformanceProbe frame-time sampling + P95 + memory degredation).

**Module under test** (does not exist yet):

```typescript
// Expected API:
interface PerfMetrics {
  fpsP95: number;
  loadMs: number;
  memP95?: number; // undefined in jsdom (no performance.memory)
}

class PerformanceProbe {
  start(): void;
  stop(): void;
  tick(now: number): void; // call each rAF with performance.now()
  getMetrics(): PerfMetrics;
  reset(): void;
}
```

**Test cases** (ALL use `test.skip`):

```
# Test Suite: PerformanceProbe

## Frame-time sampling
test.skip('tick records frame delta (now - prevNow)')
test.skip('multiple ticks build up sample window')
test.skip('getMetrics().fpsP95 returns P95 of frame rate from samples')
  - feed controlled frame times (16ms, 17ms, 16ms, 50ms spike, 16ms...)
  - P95 should be ~17ms (spike is P100, not P95)
test.skip('P95 with fewer than 20 samples uses all available')

## Load time
test.skip('getMetrics().loadMs returns elapsed since start')
  - start at t=1000, getMetrics at t=1500 → loadMs ≈ 500
test.skip('loadMs is 0 before start() called')

## Memory (jsdom degradation)
test.skip('getMetrics().memP95 is undefined when performance.memory unavailable (jsdom)')
  - jsdom has no performance.memory — probe must degrade gracefully, not throw
test.skip('getMetrics().memP95 returns number when performance.memory available')
  - mock performance.memory.usedJSHeapSize

## Reset
test.skip('reset clears all samples — getMetrics after reset returns fresh stats')
test.skip('reset then tick — only new samples counted')

## Lifecycle
test.skip('stop() prevents new samples from being recorded')
test.skip('start() after stop() resumes sampling')
test.skip('tick before start() does not throw (no-op)')
test.skip('getMetrics() before start() returns zeros (safe to call anytime)')
```

---

### FILE 4 (MODIFY): `src/lib/render/camera.test.ts`

**Add tests for AC-2** (`viewportToWorldRect`).

**Function under test** (does not exist yet):

```typescript
// Expected signature (pure function, no side effects):
function viewportToWorldRect(
  cam: Camera, // {x, y, zoom}
  vp: Viewport, // {width, height}
): { minX: number; minY: number; maxX: number; maxY: number };
```

**Test cases to APPEND** (ALL use `test.skip`):

```
# Test Suite: viewportToWorldRect (appended to camera.test.ts)

test.skip('viewportToWorldRect at zoom=1, cam at origin')
  - cam={x:0,y:0,zoom:1}, vp={width:100,height:100}
  - screenToWorld(0,0) → world(-50,-50), screenToWorld(100,100) → world(50,50)
  - result: {minX:-50, minY:-50, maxX:50, maxY:50}
test.skip('viewportToWorldRect at zoom=16 (default zoom)')
  - cam at origin, zoom=16 → viewport covers smaller world area
  - min/max correctly ordered (minX < maxX, minY < maxY)
test.skip('viewportToWorldRect at MAX_ZOOM=20')
  - rect is valid (no NaN, no Infinity)
test.skip('viewportToWorldRect at MIN_ZOOM=0.05')
  - extremely large world rect but within WORLD_CLAMP
test.skip('viewportToWorldRect with panned camera')
  - cam offset from origin → rect shifts by cam offset
  - pan right → minX/maxX increase
test.skip('viewportToWorldRect with viewport resize')
  - vp={width:200,height:100} → wider rect than vp={width:100,height:100}
test.skip('viewportToWorldRect world x/y same direction — no axis flip')
  - screen right → world right (x increases)
  - screen down → world down (y increases)
test.skip('viewportToWorldRect pure function — same inputs produce same outputs')
```

---

### FILE 5 (MODIFY): `src/lib/render/CanvasView.test.tsx`

**Add tests for AC-2 (culling) + AC-3 (dirty decision)**.

**Changes under test** (do not exist yet):

- `buildInstancesFromStore` refactored to use `SpatialIndex.search(viewportWorldRect)`
- Render loop uses 3-branch dirty decision
- `__e2e__` hook extended with `buildInstances()`, `seedBulk(n)`, `spatialIndex`, `perfProbe`

**Test cases to APPEND** (ALL use `test.skip`):

```
# Test Suite: Viewport Culling (AC-2)

test.skip('buildInstances only includes elements in viewport')
  - seed elements: some in viewport, some far outside
  - call buildInstances → instance count < total element count
test.skip('buildInstances includes all on-screen elements (no missing)')
  - seed elements all within viewport → all appear in instances
test.skip('viewport culling preserves z-order (flow first, then stock/cloud)')
  - seed mixed elements → flow instances come before stock/cloud in array
test.skip('off-screen elements produce zero instances')
  - element entirely outside viewport → no RenderInstance generated

# Test Suite: Dirty Render Decision (AC-3)

test.skip('camera change triggers full rebuild + clear dirty tracker')
  - spy on renderer.render + dirtyTracker.clear
  - pan camera → renderer.render called, dirtyTracker cleared
test.skip('static scene (no camera change, no dirty) skips WebGL render')
  - spy on renderer.render
  - no camera change, no element changes → renderer.render NOT called second frame
test.skip('element change without camera change triggers dirty-only rebuild')
  - move element → renderer.render called (full redraw of visible set)
  - but only dirty elements' instances rebuilt (partial rebuild)

# Test Suite: __e2e__ Hook Extensions

test.skip('__e2e__.buildInstances() returns current visible instance array')
test.skip('__e2e__.seedBulk(n) creates n elements for testing')
  - seedBulk(100) → elementStore has 100 new elements
test.skip('__e2e__.spatialIndex exposes SpatialIndex instance')
test.skip('__e2e__.perfProbe exposes PerformanceProbe instance')
```

---

## Global Rules

1. **All new tests MUST use `test.skip()`** — this is RED phase, not GREEN.
2. **Tests added to existing files**: Append to end of file (before any closing `})` if applicable). Use `test.skip()` so existing 305 tests stay green.
3. **Mock strategy**: Prefer `vi.mock()` at module level for rbush; use `vi.fn()` for callbacks; use `vi.spyOn()` for method tracking on existing modules.
4. **No `.shadowBlur =` in any test code** — CAP-11 structural guard.
5. **Pure functions first**: `viewportToWorldRect` and `DirtyRectTracker` are pure logic — test without DOM/React.
6. **Factory pattern**: Create test elements with factory functions matching `SDElement` type. Reference `elements.test.ts` for existing factory conventions.
7. **Test isolation**: Each test creates its own instances; no shared mutable state between tests.
8. **After writing**: Run `npx vitest run` — existing 305 tests must stay green, new tests show as "skipped".

---

## Output Instructions

After writing all test files:

1. Run `npx vitest run` and report the count (should show 305 passed + N skipped)
2. Report any compilation errors (tsc issues)
3. Confirm CAP-11 guard test stays green
4. List all files created/modified with line counts

**Do NOT implement any production code.** This is RED phase — only test scaffolds.
