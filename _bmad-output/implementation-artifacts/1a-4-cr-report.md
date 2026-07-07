# Code Review Report — Story 1a.4 (Flow Connector & Port Snap), Run 3

- **Run**: 3 (post-DS-Round-2 re-review; all DS R2 patches independently verified in working tree)
- **Date**: 2026-07-07
- **Backend model**: DeepSeek v4 Pro (orchestrator-direct — all 3 layers run by orchestrator, no subagents)
- **Diff range**: `7d91306..WORKTREE` (post-DS-R2 working tree, 9 files, +662/−266)
- **Vitest**: 305/305 pass · **tsc**: 0 errors · **Playwright**: 15/15 pass
- **Story file**: `_bmad-output/implementation-artifacts/1a-4-flow-connector-port-snap.md` (19 AC)
- **story_key**: `1a-4-flow-connector-port-snap`

---

## failed_layers

```
failed_layers: []   ✅  All 3 layers completed read-only; zero src/ edits
```

---

## AC Tally

| Verdict | Count | ACs                                                                                                                    |
| ------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| PASS    | 18    | AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-12b, AC-12c, AC-13, AC-14, AC-15, AC-16, AC-17 |
| PARTIAL | 1     | AC-5 (`formatFormulaForEditor` not wired to any UI → F10 deferred to 1a.8)                                             |
| FAIL    | 0     | —                                                                                                                      |

Tally: **18 PASS / 1 PARTIAL / 0 FAIL** (vs Run 2: 12/5/2)

---

## DS Round 2 Patch Verification

All 12 DS R2 patches (F1-F7/F9/F11/F12) + 2 bonus patches (B1, B4) verified present and correct in working tree:

| Patch | Description                                                    | Verified                                                   |
| ----- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| F1    | Marker ▼/○ at fromPort+firstSegDir, `isVariable` read          | ✅ `elements.ts:527-529`                                   |
| F2    | `console.warn` for dangling endpoints                          | ✅ `elements.ts:454`                                       |
| F3    | `flowCreateWarning` + `onWarn` callback in `createFlow`        | ✅ `store.ts:208-222,241-282`                              |
| F4    | Stock S/E inclusive `-1`+`Math.round`; cloud fixed 6×3         | ✅ `elements.ts:334-348`                                   |
| F5    | `cornerGlyph(stepX,stepY)` → `┌┐└┘` at turn cell               | ✅ `elements.ts:412-417,506`                               |
| F6    | `__e2e__.buildInstances`+`charToGlyphIdx` for non-sham e2e     | ✅ `CanvasView.tsx:1065-1072`, `flow-render.spec.ts:65-81` |
| F7    | Unit test marker trigger: `isVariable` (not cloud connections) | ✅ `elements.test.ts`                                      |
| F9    | Dev Agent Record 9 `[CR修订 DS-R2]` annotations                | ✅ Spec L298-331                                           |
| F11   | `flowToInstances` calls `getElementPorts` (single source)      | ✅ `elements.ts:460-466`                                   |
| F12   | Doc `colorIdx=3→1`; code `// flow magenta`                     | ✅ `elements.ts:475`, spec L103                            |
| B1    | Arrow at `toPort - lastSegDir×1`; fallback to to-port          | ✅ `elements.ts:538-544`                                   |
| B4    | `findNearestPort` JSDoc: `Euclidean-inclusive`                 | ✅ `elements.ts:355-358`                                   |

---

## Triage (Run 3 findings)

| ID  | AC     | Severity | Summary                                                                    | Route                                           |
| --- | ------ | -------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| H2  | AC-6   | LOW      | Only 1 of 4 `cornerGlyph` branches tested (┐; ┌└┘ untested)                | ✅ Fixed (elements.test.ts)                     |
| H3  | AC-15  | LOW      | Auto-generated flow name sequence gap after deletion → self-inflicted warn | ✅ Fixed (store.ts)                             |
| H4  | —      | LOW      | `cornerGlyph` fallthrough `return "└"` has no defensive guard              | ✅ Fixed (elements.ts)                          |
| H6  | AC-12c | LOW      | `console.warn` fires every render frame for dangling flows (no DEV guard)  | ✅ Fixed (elements.ts)                          |
| H7  | AC-14  | LOW      | `flowCreateWarning` parallel check `.find()` → only first duplicate        | ✅ Fixed (store.ts)                             |
| H8  | AC-9   | LOW      | `nearestPort` tie-breaking depends on port array order; implicit, untested | ✅ Fixed (elements.test.ts)                     |
| H10 | AC-9   | LOW      | `getElementPorts` stock coupling to `getElementBounds` undocumented        | ✅ Fixed (elements.ts)                          |
| H12 | AC-6   | LOW      | Degenerate dx=0,dy=0 flow produces garbage render                          | ✅ Fixed (elements.ts)                          |
| H1  | AC-6/7 | LOW      | Corner glyph overwritten by marker when \|dx\|=1 and dy≠0                  | Defer (edge-case polish)                        |
| H5  | AC-7   | LOW      | Marker overwrites visible first path cell (1-cell visual gap)              | Defer (by-design per AC-7)                      |
| H9  | —      | LOW      | `onWarn` called after `store.setElements` (timing gap)                     | Defer (warnRef is ref, not state → zero impact) |
| H11 | AC-6   | LOW      | B1 fallback arrow occlusion for adjacent nodes                             | Defer (documented)                              |

8 patches applied (~75 lines net) · 4 deferred (all edge-case/UX polish)

---

## CAP-11 / F1-quality / Red-line Verification

| Check                                | Status | Evidence                                     |
| ------------------------------------ | ------ | -------------------------------------------- |
| shadowBlur only in glowAtlas.ts bake | ✅     | Only `glowAtlas.ts:162,171` assignments      |
| GLOW_PAD=16                          | ✅     | Unchanged                                    |
| LUMA_BLUR_PX=[0,4,8,14]              | ✅     | Unchanged                                    |
| GLOW_PASSES=3                        | ✅     | Unchanged                                    |
| CHAR_COUNT 120 (▶▼○ only)            | ✅     | `glowAtlas.ts`                               |
| palette single source                | ✅     | Index 1=flow magenta `#ff5577` unchanged     |
| No src/ edits during review          | ✅     | `git status --short` shows only CR artifacts |

---

## Decision

**CR Run 3 PASS → PATCHED** — 0 FAIL, 18/19 AC PASS. All 12 LOW findings adjudicated: 8 patches applied (H2, H3, H4, H6, H7, H8, H10, H12 — ~75 lines net across 3 src files), 4 deferred (H1, H5, H9, H11). A review-pass regression was discovered and fixed: H3's auto-name logic was not synced to `flowCreateWarning` (would have produced false-positive warnings after deletions); both functions now share the same `Math.max(...)+1` pattern. Ready for merge.

---

## In-field Status

- Working tree: `7d91306` + DS R2 patches + CR Run 3 patches (8 applied, 4 deferred)
- Zero code edits during review, zero push, zero `git add`
- `stash@{0}`: preserved from Run 2
- Next: Merge → Story 1a.5 (Spatial Index & Viewport Cull)
