---
name: lovable-deck-prompt
type: deck-prompt
purpose: Prompt for Lovable to generate an interactive architecture deck for NewSD
audience: dual-layer (vision + technical)
generated_from: ARCHITECTURE-SPINE.md (status: final, 2026-07-01)
note: This is the PROMPT file only. The deck product is generated on the Lovable side and does NOT return to the NewSD repo. AD IDs cited below are stable (ARCHITECTURE-SPINE.md companion).
---

# Lovable Deck Prompt — NewSD Architecture

You are generating an **interactive HTML+SVG architecture deck** for **NewSD** — a cyberpunk ASCII system-dynamics multiplayer collaborative modeling platform. This deck has **two audiences in one artifact**: a vision layer (for stakeholders who need the "why" and the product shape) and a technical layer (for engineers who need the invariants that govern the build). Both layers must be navigable from a single deck; the vision layer should not dumb down the technical layer, and the technical layer should not bury the vision.

## Source of truth

The architecture is fully specified in `ARCHITECTURE-SPINE.md` (the spine), distilled from 26 memlog entries (14 original decisions + 2 reviewer-gate-driven decisions AD-15/F-BreakerBoundary + version checks + open questions). **Cite AD IDs by their stable numbers** (AD-1 … AD-15) when a slide asserts an invariant. The deck is a companion, not a replacement — every slide that makes an architectural claim should foot-note the governing AD.

## Deck structure (suggested slide flow — adapt to what carries the story)

1. **Title / one-line vision.** "NewSD — cyberpunk ASCII system-dynamics, modeled live together." One sentence on the product; one sentence on the four-pillar paradigm (AD-1).
2. **The product in one picture (VISION).** What a user sees: an ASCII canvas, formulas, real-time multi-cursor collaboration, a neon aesthetic. Convey the experience, not the stack.
3. **Four design pillars (VISION → TECHNICAL bridge).** Host-Authoritative Simulation / CRDT Document Model / Wasm Numeric Core / Fixed-Point Canvas Render (AD-1). For each pillar: one vision sentence + one technical sentence + where it lives (namespace). This is the slide where the audience crosses from "why" to "how."
4. **Why these four together (TECHNICAL).** The divergences each pillar prevents: sim scattered across clients / render falling back to per-glyph shadowBlur / numerics on the TS main thread / CRDT conflict destroying AST semantics. Show that the four are coupled choices, not independent.
5. **System context (TECHNICAL).** Browser client (Wasm kernel + React UI + Y.Doc + Canvas render) ↔ Go single-binary server (WebSocket gateway + yjs-go CRDT relay + SQLite WAL + in-memory presence). Reproduce the spine's container diagram. Footnote AD-3, AD-4, AD-5, AD-9.
6. **Deployment envelope (TECHNICAL).** Single Linux node, single Go binary, single SQLite WAL file, no container/cloud/observability stack (AD-2). Make explicit what is deliberately NOT here (and that cloud/multi-node/observability are threshold-triggered via addendum §3.2 — not MVP). This slide is the "what we're not over-building" contract.
7. **The simulation core (TECHNICAL).** Wasm kernel: implicit BDF startup (AD-7), Jacobian active-set + hysteresis (AD-8), algebraic-loop rejection (AD-5/FR-SIM-2), circuit breaker vs degradation boundary (AD-5 vs FR-SIM-8). This is the hardest slide — show the breaker halts on resource/iteration exhaustion, the degradation chain handles residual non-convergence without halting.
8. **The solver crate reality (TECHNICAL, load-bearing).** mexpr does NOT exist on crates.io. Composition: handwritten recursive-descent parser (reuses prototype formula.ts structure, extended with `@uuid`/`[单位]`) + autodiff crate 0.7.0 + faer 0.24.4 for LU (AD-6). AST is the single source of truth shared by autodiff graph / dimension check / tokenizer. No meval.
9. **Collaboration model (TECHNICAL).** Y.Doc CRDT: Y.Map nested AST (pure-semantic nodes, each with nid=UUIDv4), paren bypass as Y.Array of maps keyed by nid (AD-14), pending nodes as Y.Text (AD-13). Host-authoritative sim: non-host clients subscribe to host-broadcast sim state, do not compute sim steps locally (AD-15). yjs-go relay on the server (AD-4, reputation Medium caveat).
10. **Conflict and migration (TECHNICAL).** AST structural conflict tiered fallback (AD-10): light = mark region + lock subtree; heavy = text-level CRDT degrade. Snapshot-CRDT version alignment (AD-11): snapshot carries clientID+clock vector; new host validates aligned→continue, misaligned→incremental replay. Preserves the anti-metric "host migration zeroes sim state = 0."
11. **The escape valve (VISION + TECHNICAL).** The ⑤→A degradation interface (AD-12): MVP defines three abstractions (data-compat / editor / validation pipeline) that isolate the two degradation ends — non-empty interfaces, not stubs. This is what keeps the MVP's load-shedding escape valve real instead of nominal.
12. **What's deferred / open (TECHNICAL, honesty slide).** The 7 open questions with their revisit conditions: F5-perf (can full Jacobian recompute hit 100 steps/s?), F1-quality (can VRAM atlas match shadowBlur neon?), F6-threshold (AST conflict light/heavy calibration), F7-snapshot-freq (snapshot upload frequency), #15 op/s quota (collaboration abuse defense), FR-SIM-8 convergence params (tol/N/ρ). Plus derived defers: adaptive step-size, Broyden re-eval, observability/cloud/multi-node (addendum §3.2 thresholds). Honesty builds trust — show what isn't decided.
13. **The stack (TECHNICAL, appendix).** Ratified from prototype: React 19.2 / TanStack Start 1.168 / Vite 8 / Tailwind v4 / TypeScript / bun. Greenfield-new: Rust + wasm-pack, faer 0.24.4, autodiff 0.7.0, Go, yjs-go, SQLite WAL. One row per item, versions pinned.
14. **Closing / next steps.** Lead with: adopt the spine as a spec companion (stable AD IDs for downstream citation). Then: epics-and-stories breakdown.

## Style & interaction requirements

- **Cyberpunk ASCII aesthetic.** This is a system-dynamics platform with a neon aesthetic; the deck itself should carry a restrained version of that visual identity (ASCII-art accents, neon-on-dark palette, monospace for code/diagrams). Do not let the aesthetic overshadow legibility.
- **Dual-layer navigation.** A persistent toggle or split view lets a reader stay in the vision layer or drop into the technical layer per slide. Vision assertions and technical invariants for the same concept should be one click apart.
- **Interactive diagrams.** The system context, deployment, and ERD diagrams (reproduce the spine's mermaid as interactive SVG) should be explorable — hover a node to see the governing AD; click a pillar to filter slides.
- **AD citations are live.** Every architectural claim foot-notes an AD-n; clicking it jumps to a side panel showing that AD's Binds/Prevents/Rule.
- **Mermaid is valid.** Any diagram authored as mermaid must render (the spine's diagrams are the reference set).
- **No invented decisions.** If a slide would need a decision the spine doesn't have, mark it as an open question (slide 12) rather than fabricating. The spine is the authority.

## Constraints on the deck product

- The deck is generated on the **Lovable side**. It does **not** return to the NewSD repo — only this prompt file is committed.
- The deck cites **stable AD IDs** from `ARCHITECTURE-SPINE.md`. If the spine is later amended (AD IDs stable, Rules amended in place, new AD-n appended), the deck's citations remain valid.

## Acceptance check (for the deck author)

Before considering the deck done: (a) every slide with an architectural claim cites a stable AD-n; (b) the vision and technical layers are both navigable end-to-end; (c) slide 7 conveys the breaker-vs-degradation boundary without ambiguity; (d) slide 8 states mexpr does not exist and the crate composition is the handwritten-parser path; (e) slide 12 lists all 7 open questions with revisit conditions; (f) no slide invents a decision not in the spine.
