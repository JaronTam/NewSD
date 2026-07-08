---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
lastStep: step-04-generate-tests
lastSaved: "2026-07-08"
storyId: "1a.5"
storyKey: 1a-5-spatial-index-viewport-cull
storyFile: _bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md
atddChecklistPath: _bmad-output/test-artifacts/atdd-checklist-1a-5-spatial-index-viewport-cull.md
generatedTestFiles:
  - _bmad-output/test-artifacts/atdd/red-phase-vitest-1a5.md
  - _bmad-output/test-artifacts/atdd/red-phase-e2e-1a5.md
  - _bmad-output/test-artifacts/atdd/ds-prompt-1a5.md
inputDocuments:
  - _bmad-output/implementation-artifacts/1a-5-spatial-index-viewport-cull.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/story-cycle-formalization.md
  - _bmad/tea/config.yaml
  - knowledge/data-factories.md
  - knowledge/component-tdd.md
  - knowledge/test-quality.md
  - knowledge/test-healing-patterns.md
  - knowledge/selector-resilience.md
  - knowledge/timing-debugging.md
  - knowledge/playwright-cli.md
  - e2e/stock-render.spec.ts
  - e2e/flow-render.spec.ts
  - e2e/cloud-render.spec.ts
  - src/lib/render/camera.test.ts
  - src/lib/render/CanvasView.test.tsx
  - src/lib/render/elements.test.ts
  - src/lib/sd/store.test.ts
---

# ATDD Checklist — Story 1a.5: 空间索引与视口剔除

## Preflight Summary

- **Stack**: frontend (React + Vite + TanStack Start + WebGL2)
- **Test framework**: vitest (unit) + Playwright (e2e)
- **Baseline**: vitest 305/305 (12 files), Playwright 15/15, tsc clean
- **Baseline commit**: `a587417ac309eda7de44d072767d830e57c93c08`
- **TEA config**: playwright_utils=enabled, pactjs=disabled, browser_automation=auto, execution_mode=auto

## Generation Mode

**AI Generation** — AC are concrete with Given/When/Then, existing test patterns well-established (stock-render, flow-render, cloud-render specs), no recording needed.

## Test Strategy (AC → Level → Priority)

| AC   | Focus                                       | Level               | Priority | New/Modified Test File                                    |
| ---- | ------------------------------------------- | ------------------- | -------- | --------------------------------------------------------- |
| AC-1 | R-tree SpatialIndex + rbush v4.0.1          | Unit (vitest)       | P0       | `spatial-index.test.ts` [NEW]                             |
| AC-2 | viewportToWorldRect + viewport culling      | Unit (vitest)       | P0       | `camera.test.ts` [MOD], `CanvasView.test.tsx` [MOD]       |
| AC-3 | DirtyRectTracker + 3-branch render decision | Unit (vitest)       | P0       | `dirty-rect.test.ts` [NEW], `CanvasView.test.tsx` [MOD]   |
| AC-4 | 10000≥30FPS (culling effectiveness)         | E2E (Playwright)    | P1       | `spatial-index.spec.ts` [NEW]                             |
| AC-5 | queryLowPrecision API contract              | Unit (vitest)       | P1       | `dirty-rect.test.ts` [NEW]                                |
| AC-6 | 1000≥60FPS (culling effectiveness)          | E2E (Playwright)    | P1       | `spatial-index.spec.ts` [NEW]                             |
| AC-7 | PerformanceProbe + RUM base                 | Unit (vitest) + E2E | P1       | `perf-probe.test.ts` [NEW], `spatial-index.spec.ts` [NEW] |
| AC-8 | No regression (305→~330)                    | Unit + E2E          | P0       | All existing (stay green)                                 |
| AC-9 | Playwright perf e2e gate                    | E2E (Playwright)    | P0       | `spatial-index.spec.ts` [NEW]                             |

## Red-Phase Prompts

Two self-contained prompt files generated for external model execution:

1. **`_bmad-output/test-artifacts/atdd/red-phase-vitest-1a5.md`** — Unit tests (vitest + jsdom): spatial-index, camera.viewportToWorldRect, dirty-rect, perf-probe, CanvasView culling/dirty decision
2. **`_bmad-output/test-artifacts/atdd/red-phase-e2e-1a5.md`** — Playwright e2e: spatial-index.spec.ts (culling effectiveness, perf probe, dirty rect gate)

## TDD Red Phase Status

🔴 **RED PHASE** — All prompts generate `test.skip()` / `test.fails()` scaffolds that:

- Assert EXPECTED behavior
- FAIL when activated (feature not yet implemented)
- Are designed to pass after Task 1-5 implementation (green phase)

## Next Steps

1. Execute red-phase prompts in target model → write failing test files
2. Verify: `npx vitest run` shows new tests as skipped/failing (not breaking existing 305)
3. Proceed to DS (bmad-dev-story) → implement → tests go green
4. CR phase → final verification
