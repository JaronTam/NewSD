# Deferred Work Log — NewSD

Generated from code reviews. Each entry records work deferred beyond the current story scope.

---

## From Story 1a.4 CR (Run 2, 2026-07-07)

| ID  | Item                                                                                                                 | Target Story                     | Rationale                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| F8  | `isVariable` UI toggle — hardcoded `false` in CanvasView endPan; no user-facing way to create variable flows         | 1a.8 (Property Panel)            | Property editing UI deferred per spec AC-10 note ("toolbar UI defer 1a.7, property panel 1a.8") |
| F10 | `formatFormulaForEditor` wiring — helper exists + tested but no src/ caller connects it to any UI                    | 1a.8 (Property Panel)            | Display-layer wiring belongs with formula editor UI                                             |
| —   | `isVariable:true` e2e testing via real UI interaction (not `window.__e2e__` hook)                                    | 1a.8                             | Requires property panel to toggle isVariable                                                    |
| —   | Flow path visual dedup for parallel flows (AC-14 known limitation: shared fromId+toId → overlapping Manhattan paths) | TBD (post-1a.8)                  | Port staggering or path offset; spec explicitly defers as "visual polish" beyond 1a.4 core      |
| —   | Orphan cloud persist-time warn ("N 个孤立 cloud")                                                                    | 4.x (persist)                    | AC-13 — create-time only in 1a.4; persist-time warn deferred per spec                           |
| —   | Render-side self-loop guard (currently only store-side guard in createFlow)                                          | 4.x (persist/paste)              | Self-loop flows could arrive via persistence reload or 4.3 paste, bypassing createFlow guard    |
| —   | Snap tolerance at extreme zoom levels (zoom=0.05 → snapTol=160 world units)                                          | 1a.7 (toolbar/statusbar) or 1a.5 | AC-10 snap interaction; could use zoom-aware clamping                                           |

### Edge Cases deferred (non-blocking)

| ID  | Condition                                                   | Consequence                     | Mitigation                                                                          |
| --- | ----------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| E1  | Zero-length flow (from-port == to-port same cell)           | Isolated arrow, wrong direction | Rare in practice; guard in createFlow could reject adjacent-element port collisions |
| E2  | Non-UUID @-ref in formula (`@Pop`)                          | Cryptic "Unknown name: @" error | Low probability; parser could emit clearer diagnostic                               |
| E3  | Cloud W/E port y-offset (half-integer → Math.round ties up) | Arrow 1 row below visual side   | Fixed by F4 (AC-9 cloud 6×3 coords)                                                 |

---

## From Story 1a.4 CR (Run 3, 2026-07-07)

8 of 12 LOW findings were patched before merge (H2, H3, H4, H6, H7, H8, H10, H12 ~75 lines net across 3 src files). 4 deferred:

| ID  | Item                                                                         | Target Story    | Rationale                                                                                |
| --- | ---------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| H1  | Corner glyph overwritten by marker when \|dx\|=1 and dy≠0 (adjacent nodes)   | TBD (post-1a.8) | Edge-case visual polish; marker-on-corner rare in practice; non-blocking                 |
| H5  | Marker overwrites visible first path cell → 1-cell visual gap                | TBD             | By-design per AC-7 spec (marker at fromPort+dir×1); defer unless user reports issue      |
| H9  | `onWarn` called after `store.setElements` — pre-add snapshot vs post-add gap | TBD             | Timing hardening; warnRef is a React ref (not state) → zero observable impact            |
| H11 | B1 fallback arrow occlusion for adjacent nodes (documented known limitation) | TBD (post-1a.8) | Adjacent-node arrow on target edge glyph; z-order fix would require architectural change |
