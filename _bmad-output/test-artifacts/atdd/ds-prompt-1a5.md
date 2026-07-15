# 🟢 DS Phase Prompt: Story 1a.5 — 空间索引与视口剔除

> **Phase**: DS (Dev Story) — bmad-dev-story workflow
> **Target model**: Claude Code (or any capable LLM with codebase access)
> **Story file**: `_bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md`
> **Expected result**: All 6 tasks implemented, all ACs satisfied, vitest & Playwright green, tsc clean, story Status → "review", sprint-status → "review"

---

## Mission

You are a **Developer** implementing Story 1a.5 ("Spatial Index & Viewport Culling") of the NewSD project. Follow the **bmad-dev-story** 10-step workflow exactly. Execute TDD red-green-refactor for each task. Do NOT stop at "milestones" or "session boundaries" — continue until ALL tasks complete and ALL gates pass.

**Critical rule**: NEVER implement anything not mapped to a specific task/subtask in the story file. NEVER mark a task complete unless ALL conditions are met.

---

## Step 0: Prerequisites — READ Before Anything Else

Before writing any code, read these files in order:

1. **Story file** (THE authoritative spec): `_bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md`
   - Parse ALL sections: Story, Acceptance Criteria (AC-1..AC-9), Tasks/Subtasks (6 tasks), Dev Notes, SDR decisions (11 items), Domain Model Reconciliation, Project Structure, References
   - The story file is your single source of truth for WHAT to build

2. **Sprint status**: `_bmad-output/implementation-artifacts/sprint-status.yaml`
   - Confirm `1a-5-spatial-index-viewport-cull: ready-for-dev`

3. **Story-cycle formalization**: `_bmad-output/planning-artifacts/story-cycle-formalization.md`
   - §2.3 DS 10-step workflow, §4 PR workflow, §6 single-PR decision, §7 gate redlines

4. **Existing source files** (understand current state before modifying):
   - `src/lib/render/camera.ts` — Camera, Viewport, worldToScreen, screenToWorld, WORLD_CLAMP
   - `src/lib/render/elements.ts` — getElementBounds, findElementAt, stockToInstances, cloudToInstances, flowToInstances
   - `src/lib/render/vram/renderer.ts` — RenderInstance (9 fields), render(cam,vp,instances), setInstance
   - `src/lib/sd/store.ts` — ElementStore, subscribe, getElements, notify, createStock/createCloud/createFlow
   - `src/lib/sd/types.ts` — SDElement = Stock | Cloud | Flow
   - `src/lib/render/CanvasView.tsx` — buildInstancesFromStore, render loop, **e2e** hook
   - `package.json` — current dependencies

5. **Existing test files** (understand patterns before writing new tests):
   - `src/lib/render/camera.test.ts` — test patterns for pure functions
   - `src/lib/render/elements.test.ts` — factory patterns for SDElement creation
   - `src/lib/render/CanvasView.test.tsx` — React component test patterns, mock strategies
   - `src/lib/render/cap11-shadowblur-guard.test.ts` — CAP-11 guard (must stay green)
   - `src/lib/render/vram/glowAtlas.test.ts` — F1-quality locked constants (must stay green)
   - `e2e/stock-render.spec.ts` — Playwright patterns: waitForRenderReady, **e2e** hook, readPixels
   - `e2e/flow-render.spec.ts` — Playwright patterns: createFlowAndWait, builtInstances, glyphIdx

---

## Step 1: Find & Load Story (DS step 1)

1. Read `_bmad-output/implementation-artifacts/sprint-status.yaml` completely
2. Confirm `1a-5-spatial-index-viewport-cull` is `ready-for-dev`
3. Read the COMPLETE story file: `_bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md`
4. Parse all sections; identify the first incomplete task (should be Task 1)

---

## Step 2: Load Context (DS step 2)

Load all context from the story file's Dev Notes section:

- Architecture constraints: AD-9 (F1 VRAM render), AD-2 (viewport), CAP-11 (no runtime shadowBlur), F1-quality locked constants, E7 (Float64 precision)
- SDR decisions: 11 items that MUST be followed exactly
- Domain Model Reconciliation table: what each module already has, what 1a.5 adds
- Web research: rbush v4.0.1 (ESM-only, quickselect ^3.0.0 dep)
- §6 single-PR assessment: default = single PR

---

## Step 3: Detect Review Continuation (DS step 3)

Check if "Senior Developer Review (AI)" section exists in the story file. For a fresh start (no prior review), this section won't exist. Set `review_continuation = false`.

---

## Step 4: Mark Story In-Progress (DS step 4)

1. If story file YAML frontmatter has no `baseline_commit`, run `git rev-parse HEAD` and add it
2. Update `sprint-status.yaml`: `1a-5-spatial-index-viewport-cull: ready-for-dev` → `in-progress`
3. Update `last_updated` to current date

---

## Step 5: Implement Tasks — TDD Red-Green-Refactor (DS step 5)

Execute tasks IN ORDER (Task 1 → Task 2 → ... → Task 6). For each task:

### RED Phase

Write FAILING tests first. The story file specifies test files for each task. Use `test.skip()` initially for new test files, then remove `.skip` when ready to test. For modifying existing test files, add new tests with `test()` (not skip) since they test new functionality.

**Key test files to create/modify** (from story Project Structure):

| File                                   | Action | Task     | Tests                                                                                                                    |
| -------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/render/spatial-index.test.ts` | NEW    | 1.3      | bulk load search, insert/remove sync, point query, flow bbox, empty store safety                                         |
| `src/lib/render/camera.test.ts`        | MODIFY | 2.2      | viewportToWorldRect at zoom=1/16/MAX/MIN, pan following, vp resize                                                       |
| `src/lib/render/dirty-rect.test.ts`    | NEW    | 3.2      | markDirty/consume(drain)/hasDirty/clear, queryLowPrecision grid merge, empty returns [], multi-rect merge                |
| `src/lib/render/perf-probe.test.ts`    | NEW    | 4.2      | frame-time sampling + P95, memory degrade (jsdom), reset zeroing                                                         |
| `src/lib/render/CanvasView.test.tsx`   | MODIFY | 2.5, 3.4 | off-screen not in instances, on-screen all present, static skip render spy, dirty old+new bbox, camera pan clear+rebuild |
| `e2e/spatial-index.spec.ts`            | NEW    | 5.1      | culling effectiveness (1000/10000), viewport completeness, pan visible update, dirty rect move, perfProbe non-zero       |

**IMPORTANT**: The ATDD red-phase prompts (`_bmad-output/test-artifacts/atdd/red-phase-vitest-1a5.md` and `red-phase-e2e-1a5.md`) contain detailed test case specifications. Read them for exact test descriptions.

### GREEN Phase

Implement MINIMAL code to make tests pass:

**Task 1: R-tree SpatialIndex + store sync (AC-1)**

1. `npm install rbush@^4.0.1` (verify rbush v4 ESM-only, Vite compatible)
2. Create `src/lib/render/spatial-index.ts`:
   - `SpatialIndex` class wrapping `RBush`
   - `constructor(elementStore, maxEntries=9)`
   - `search(rect): SDElement[]` — rbush.search → id lookup → SDElement[]
   - `collides(rect): boolean`
   - `insert(el)` / `remove(el)` — via getElementBounds → bbox
   - `load(elements)` — bulk via rbush.load (OMT algorithm)
   - `sync(prev, next)` — diff → insert/remove/update changed only
   - Subscribe to `elementStore.subscribe` for auto-sync
   - Item shape: `{minX, minY, maxX, maxY, id, kind}`
3. Create `src/lib/render/spatial-index.test.ts` with all tests

**Task 2: viewportToWorldRect + viewport culling (AC-2)**

1. Add `viewportToWorldRect(cam, vp): {minX,minY,maxX,maxY}` to `camera.ts`:
   - `screenToWorld(0,0)` + `screenToWorld(vp.width, vp.height)`
   - Take min/max for correct ordering (world x/y same direction, no axis flip)
   - Pure function, no side effects
2. Add tests to `camera.test.ts`
3. Refactor `buildInstancesFromStore` in `CanvasView.tsx`:
   - Use `spatialIndex.search(viewportToWorldRect(cam, vp))` to get visible elements
   - Only build instances for visible elements
   - Z-order: flow first, then stock/cloud
   - Camera change (pan/zoom/resize) → only re-query visible set, NOT re-sync R-tree
4. Extend `__e2e__` hook: `buildInstances()`, `seedBulk(n)`, `spatialIndex`, `perfProbe`
5. Add culling tests to `CanvasView.test.tsx`

**Task 3: DirtyRectTracker + render decision (AC-3, AC-5)**

1. Create `src/lib/render/dirty-rect.ts`:
   - `DirtyRectTracker` class
   - `markDirty(rect)` / `consume(): rect[]` (drain) / `hasDirty()` / `clear()`
   - `queryLowPrecision(step): rect[]` — AC-5 contract: grid-coarse merge by step world-units
   - State: rect set + coarse cache
2. Create `dirty-rect.test.ts` with all tests
3. Integrate dirty decision in `CanvasView.tsx` render loop:
   - Store subscribe → diff changed elements → `markDirty(oldBbox)` + `markDirty(newBbox)`
   - **3-branch render decision** (SDR #5):
     - Camera change OR first frame → `dirtyTracker.clear()` + full visible rebuild + full WebGL redraw
     - !camera && `hasDirty()` → rebuild dirty only + full WebGL redraw of visible set
     - !camera && !hasDirty → **skip WebGL render entirely** (static scene, zero GPU work)
   - **WebGL scissor out-of-scope** (SDR: additive glow + post-culling small visible set)
   - 2D surface canvas: keep full redraw (O(viewport), not bottleneck)
4. Add dirty decision tests to `CanvasView.test.tsx`

**Task 4: PerformanceProbe + RUM base (AC-7)**

1. Create `src/lib/render/perf-probe.ts`:
   - `PerformanceProbe` class
   - `start()` / `stop()` / `tick(now)` / `getMetrics(): PerfMetrics` / `reset()`
   - rAF frame-time sampling via `performance.now()` delta
   - Load time: `performance.now()` - navigation start
   - Memory: `performance.memory?.usedJSHeapSize` (window aggregation)
   - P95 aggregation (sliding window, not per-frame)
   - **Graceful degradation**: jsdom has no rAF/memory → return 0/undefined, don't throw
2. Create `perf-probe.test.ts` with all tests
3. Mount `perfProbe` in CanvasView render loop (rAF cycle)
4. Expose via `__e2e__.perfProbe.getMetrics()`
5. **Explicit defer declaration**: network upload + server ingestion + dashboard → ops/RUM story (not 1a.5)

**Task 5: Playwright perf e2e (AC-9, covers AC-4/AC-6)**

1. Create `e2e/spatial-index.spec.ts`:
   - Mirror structure of `stock-render.spec.ts` / `flow-render.spec.ts`
   - Copy `waitForRenderReady` helper from existing specs
   - Add helpers: `seedBulk(page, n)`, `visibleInstanceCount(page)`, `getPerfMetrics(page)`
   - Tests: bulk seed 1000+10000 → culling effectiveness, viewport completeness, pan visible update, dirty rect move, perfProbe non-zero
   - **Culling effectiveness, NOT absolute FPS**: SwiftShader is software WebGL, not representative
   - Assert `buildInstances().length < total` (culling works), not `fps >= 30`
   - All tests use `test()` directly (not skip — this is green phase)

**Task 6: §6 Single-PR Decision Review (DS step4)**

- Re-evaluate §6 criteria: 9 ACs (< 20 threshold), 5 subsystems but shared SpatialIndex + render loop (not independent)
- Record decision: single PR (default, no reversion)
- Document in Dev Agent Record

### REFACTOR Phase

After ALL tests pass:

- Improve code structure while keeping tests green
- Ensure code follows architecture patterns from Dev Notes
- Verify no duplicate code, clean interfaces

---

## Step 6: Author Comprehensive Tests (DS step 6)

- Unit tests for all business logic (spatial-index, dirty-rect, perf-probe, viewportToWorldRect)
- Integration tests for CanvasView (culling + dirty decision + **e2e** hook)
- E2E tests for culling effectiveness + perf probe (spatial-index.spec.ts)
- Edge cases: empty store, zero-area rect, negative-extent rect, MIN_ZOOM/MAX_ZOOM boundaries, no performance.memory in jsdom
- **CAP-11 guard**: `cap11-shadowblur-guard.test.ts` + `CanvasView.test.tsx` runtime spy MUST stay green
- **F1-quality guard**: `glowAtlas.test.ts` locked constants MUST stay green

---

## Step 7: Run Validations (DS step 7)

Run ALL of these, in order, and fix any failures before proceeding:

```bash
# 1. Type check
cd C:/Two/NewSD && npx tsc --noEmit

# 2. Unit tests (all, including new)
cd C:/Two/NewSD && npx vitest run

# 3. Playwright e2e (all, including new spatial-index spec)
cd C:/Two/NewSD && npx playwright test
```

**Gate**: ALL must pass. If any regression, STOP and fix before continuing.

---

## Step 8: Validate & Mark Complete (DS step 8)

For EACH task, verify ALL of these before marking [x]:

- [ ] Tests for this task ACTUALLY EXIST and PASS 100%
- [ ] Implementation matches EXACTLY what the task specifies — no extra features
- [ ] All related ACs are satisfied
- [ ] Full test suite passes (no regressions)
- [ ] CAP-11 guard stays green
- [ ] F1-quality constants unchanged

Only then mark the task checkbox [x] in the story file. Update File List section with all new/modified files.

---

## Step 9: Story Completion (DS step 9)

1. Verify ALL tasks and subtasks are marked [x]
2. Run full regression suite (do not skip)
3. Confirm File List includes every changed file
4. Execute Definition of Done validation:
   - All tasks/subtasks [x]
   - Every AC satisfied
   - Unit tests for core functionality
   - Integration tests for component interactions
   - E2E tests for critical flows
   - All tests pass
   - tsc clean
   - File List complete
   - Dev Agent Record updated
   - CAP-11/F1-quality guards green
5. Update story Status to: "review"
6. Update sprint-status.yaml: `1a-5-spatial-index-viewport-cull: in-progress` → `review`
7. Update `last_updated` to current date

---

## Step 10: Completion Communication (DS step 10)

1. Summarize: story ID, key changes, tests added, files modified
2. Provide story file path and current status ("review")
3. Suggest next step: run `bmad-code-review` (ideally with a DIFFERENT LLM)

---

## Project-Specific Rules & Constraints

### Architecture Redlines (story-cycle §7 — MUST follow)

1. **CAP-11**: NO `.shadowBlur =` anywhere except `bakeGlowAtlasCanvas` (off-screen bake). 1a.5 new code has zero shadowBlur sites. The `cap11-shadowblur-guard.test.ts` structural grep + `CanvasView.test.tsx` runtime spy MUST stay green.

2. **F1-quality locked constants**: `GLOW_PAD=16`, `LUMA_BLUR_PX=[0,4,8,14]`, `GLOW_PASSES=3`. These are locked by `glowAtlas.test.ts`. 1a.5 does NOT touch glowAtlas. Guard must stay green.

3. **Spec authority = epic** (not prototype). If any conflict, epic wins.

4. **No Wasm/Go/Rust deps** for 1a.5: Pure TypeScript rendering path per AD-9. rbush is pure JS/TS (ESM), no native deps.

5. **Float64 precision**: WORLD_CLAMP=1e15 (camera.ts). viewportToWorldRect operates within clamp. rbush bbox uses world coordinates (Float64 safe).

6. **WebGL scissor out-of-scope**: SDR #5. No `gl.scissor()` usage. "Partial redraw" is at instance-build layer, not screen-pixel layer.

7. **NFR verification split** (SDR #7): Playwright validates culling effectiveness (`buildInstances().length`), NOT absolute FPS. Absolute FPS via PerformanceProbe/RUM in real browsers.

8. **B-obs-1 RUM**: Partial delivery + explicit defer. PerformanceProbe (client sampling + P95) is delivered. Network upload + server + dashboard are explicitly deferred (not silently missed).

9. **Static scene NFR**: 1000≥60fps / 10000≥30fps are static rendering (no sim animation, animation deferred to 5.1).

10. **findElementAt stays O(n)**: per-click not per-frame, 10000 elements sub-ms acceptable. R-tree hit-test is future optimization, not 1a.5 scope.

11. **`__e2e__` hook extensions**: `buildInstances()` (current visible instances), `seedBulk(n)` (test-only, not production), `spatialIndex` (SpatialIndex instance), `perfProbe` (PerformanceProbe instance).

### SDR Decisions (11 items — MUST follow exactly)

These are in the story file Dev Notes → SDR 决策. Every one must be implemented as specified, no deviation:

1. R-tree = rbush v4.0.1 (not @turf/turf, not hand-rolled)
2. Index object = SDElement by world bbox (getElementBounds → {minX,minY,maxX,maxY})
3. Sync strategy = incremental diff (store.subscribe → diff prev/next → insert/remove/update changed only); camera change does NOT re-sync
4. Culling point = buildInstancesFromStore (via SpatialIndex.search); z-order unchanged (flow first, stock/cloud after)
5. Dirty render decision = 3-branch (camera→full rebuild; !camera+hasDirty→rebuild dirty+full redraw; !camera+!hasDirty→skip); WebGL scissor out-of-scope; 2D surface full redraw
6. Dirty rect API = queryLowPrecision(step): rect[] (1a.5 signature + basic coarse merge; 1a.6 consumes without changing signature)
7. NFR verification split: Playwright = culling effectiveness; absolute FPS = PerformanceProbe/RUM
8. B-obs-1 RUM = partial + explicit defer
9. NFR static caliber: no sim animation
10. findElementAt stays O(n)
11. **e2e** hook additions: buildInstances/seedBulk/spatialIndex/perfProbe

### PR Rules (story-cycle §4)

- **NEVER push directly to main**. Always create a branch and PR.
- Branch naming: `story-1a5-spatial-index` or similar
- Commit message format: title + bullet points + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- PR body: summary + test plan + `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- PR merge: `gh pr create` → local tsc+vitest+playwright all green → `gh pr merge --squash --delete-branch`
- **NEVER `git add -A`** — use explicit paths
- Before committing: `git diff --cached --stat` — check for forbidden files (`.playwright-mcp/`, `package-lock.json`, `.claude/`, non-whitelisted PNGs). If found, `git restore --staged <file>`
- **No fixup-PR chain**: problems get folded into the current story PR before merging
- **sprint-status update separate from story code PR**: story code PR does NOT include sprint-status changes; after merge, open a separate chore PR for sprint-status → done

### Verification Commands (run locally)

```bash
# Type check
cd C:/Two/NewSD && npx tsc --noEmit

# Unit tests
cd C:/Two/NewSD && npx vitest run

# E2E tests
cd C:/Two/NewSD && npx playwright test

# Current baseline (MUST pass before starting):
# vitest: 305/305 (12 files)
# Playwright: 15/15
# tsc: clean
# HEAD: a587417
```

### File Structure (expected after implementation)

```
NEW FILES:
  src/lib/render/spatial-index.ts       — SpatialIndex class wrapping rbush
  src/lib/render/spatial-index.test.ts  — R-tree unit tests
  src/lib/render/dirty-rect.ts          — DirtyRectTracker class
  src/lib/render/dirty-rect.test.ts     — Dirty rect unit tests
  src/lib/render/perf-probe.ts          — PerformanceProbe class
  src/lib/render/perf-probe.test.ts     — Perf probe unit tests
  e2e/spatial-index.spec.ts             — Playwright culling e2e

MODIFIED FILES:
  src/lib/render/camera.ts              — +viewportToWorldRect
  src/lib/render/camera.test.ts         — +viewportToWorldRect tests
  src/lib/render/CanvasView.tsx         — refactor buildInstancesFromStore + dirty decision + perfProbe + __e2e__
  src/lib/render/CanvasView.test.tsx    — +culling tests + dirty decision tests
  package.json                          — +rbush ^4.0.1

UNCHANGED (verify no regression):
  src/lib/render/elements.ts            — getElementBounds unchanged, findElementAt O(n) unchanged
  src/lib/render/vram/renderer.ts       — render() unchanged
  src/lib/render/vram/glowAtlas.ts      — locked constants unchanged
  src/lib/render/vram/shaders.ts        — unchanged
  src/lib/sd/store.ts                   — ElementStore unchanged
  src/lib/sd/types.ts                   — SDElement unchanged
  src/lib/render/cap11-shadowblur-guard.test.ts — must stay green
  src/lib/render/vram/glowAtlas.test.ts         — must stay green
```

### Key Dependencies

- **rbush v4.0.1**: ESM-only, zero runtime deps except quickselect ^3.0.0. API: `load(items)`, `insert(item)`, `remove(item)`, `search(bbox)`, `collides(bbox)`. Item shape: `{minX, minY, maxX, maxY, ...}`.
- No other new dependencies.

---

## Output Instructions

After completing all 10 steps:

1. Report final test counts: vitest (N passed, N failed), Playwright (N passed, N failed), tsc (clean/errors)
2. Confirm ALL 9 ACs are satisfied
3. Confirm CAP-11 guard stays green
4. Confirm F1-quality constants unchanged
5. List all files created/modified with line counts
6. Confirm story Status → "review" and sprint-status → "review"
7. Provide the PR number and branch name
8. Remind: sprint-status update goes in a SEPARATE chore PR after story PR merges

**Do NOT stop at "milestones" or "session boundaries."** Continue until ALL tasks complete and ALL gates pass. Only Step 9 decides completion.
