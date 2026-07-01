# Adversarial Construction Review — Lens 2

**Reviewer:** LENS 2 (adversarial construction)
**Target:** ARCHITECTURE-SPINE.md + AD-1 through AD-18 (sourced from `ADRs.md` at repo root)
**Method:** For each axis, attempt to construct two independently-built units (features/epics) that each obey every AD to the letter yet still build incompatibly.

---

## Axis 1: Two owners of the simulation step

### Attempted construction

**Unit A — "Non-host preview renderer"** builds a feature that shows a live preview of the current formula on a non-host client before sending. It runs the Wasm kernel locally (AD-5: "all sim-step numeric eval goes through Wasm kernel"). The server relays CRDT ops but does not run sim (AD-3). Non-host is not the host (AD-1 says host-authoritative). The preview is purely local — it never mutates shared state.

**Unit B — "Host authoritative step engine"** builds the host-side sim executor. The host receives ops, runs Wasm, and broadcasts the resulting CRDT state. AD-1 says host is authoritative.

**The incompatibility:** Unit A's preview on a non-host client runs the *same* Wasm kernel as Unit B's host step, but on a *different* CRDT state snapshot — the non-host's local Yjs document may be behind the host's by several ops (CRDT sync is asynchronous). Unit A's preview produces a sim result that *looks* correct locally but diverges from what the host computes next. The user sees a flicker: preview shows X, then the host step broadcasts Y, and the preview jumps. Neither unit violated any AD — AD-5 says "Wasm kernel" (both use it), AD-3 says "server does not run sim" (true), AD-1 says "host-authoritative" (Unit B defers to host; Unit A is preview only, not authoritative). No AD pins **whose Wasm execution** is the source of truth for a non-host client's visual state, or how a non-host client reconciles its local preview with the host's next authoritative result.

**Verdict: HOLE FOUND**

### What's missing
A new or tightened AD that pins:
- **Dataflow:** Non-host clients MUST NOT derive visual sim state from local Wasm execution. Visual state is always driven by the host's broadcast CRDT state (subscribe path). Local preview is permissible only if explicitly flagged as "stale-until-host-confirms" and reconciled atomically.
- **Source-of-truth for sim output:** Only the host's Wasm step produces authoritative sim state. Non-host clients subscribe to sim results via CRDT; they do not compute them independently.

**Severity: HIGH** — Every session with >1 client hits this divergence on every keypress. Flicker between local preview and authoritative result is a visible correctness bug.

---

## Axis 2: Clashing shared-data shape (AST node IDs and bracket round-trip)

### Attempted construction

**Unit A — "Formula AST builder"** assigns stable integer nid values (AD-6: parser produces AST; AD-13: pending Y.Text with local-to-global mapping; AD-14: parens bypass Y.Array via dedicated field). Unit A uses a strictly sequential counter for nid: root=0, left child=1, right child=2, etc. When op-4 ("用户重加") triggers a subtree rebuild, Unit A reuses the original nid for the replacement paren node (the paren is "the same" in user intent).

**Unit B — "Bracket projection renderer"** implements the bracket display. AD-14 says parens use a dedicated field (bypassing Y.Array). AD-13 says pending ops use Y.Text. AD-6 says the parser produces AST with nids. Unit B needs to project brackets onto the formula display. It assigns nids from a *hash* of the paren's text position and depth, so after subtree rebuild, the replacement paren gets a *different* nid. Unit B's bracket projection code keys bracket geometry by nid; after rebuild, the old nid's bracket geometry is orphaned and the new nid has no geometry, so brackets momentarily disappear or jump.

**The incompatibility:** Neither unit violates any AD:
- AD-6 says "parser produces AST" — both produce ASTs, just with different nid conventions.
- AD-13 says "pending Y.Text" — both use Y.Text for pending content.
- AD-14 says "parens bypass Y.Array via dedicated field" — both use dedicated paren fields.
- AD-14's op-4 note ("用户重加") says the paren copy survives, but does not say *how the nid is determined* or whether two independent implementers would agree on nid stability across rebuild.

The nid scheme is *not* specified as a shared-data convention anywhere. Two builders can pick incompatible schemes, and bracket projection + AST manipulation silently diverge.

**Verdict: HOLE FOUND**

### What's missing
An AD that pins the node-id scheme:
- **nid assignment rule:** MUST use [e.g., monotonic counter, not content-hash] so that nid stability across rebuilds is deterministic.
- **nid round-trip contract:** When a subtree is rebuilt (op-4 flip), the replacement nodes' nids must be [reuse originals / new unique values], specified concretely.

**Severity: MED** — Does not cause incorrect simulation, but causes visual glitches (bracket disappearance, flicker) and potential CRDT merge conflicts if two clients rebuild the same subtree simultaneously.

---

## Axis 3: Snapshot vs CRDT race

### Attempted construction

**Unit A — "Snapshot recovery"** implements AD-11 (snapshot carries version vector, new host validates). On host handoff, Unit A captures a snapshot of the current CRDT state and its version vector. To be safe, it first pauses CRDT sync, takes the snapshot, then resumes.

**Unit B — "Incremental replay"** implements the "incremental replay" fallback. On host handoff, Unit B replays the CRDT op log from the snapshot's version vector forward. It reads the current CRDT model as source of truth (per AD-11's rationale: "current CRDT model wins").

**The incompatibility:** Unit A pauses CRDT sync to take a clean snapshot. During that pause, Unit B (on a different client) continues to generate local ops. Unit A's snapshot is internally consistent but is behind by those concurrent ops. When Unit B becomes the new host and replays from the snapshot's vector, it replays ops that it *already applied locally* — causing double-application. Neither unit violated any AD: Unit A's pause is a reasonable implementation of "capture snapshot with version vector"; Unit B's replay is exactly "incremental replay from snapshot vector forward." No AD pins whether the snapshot is *globally quiesced* (all clients paused) or *locally consistent only* (the capturing client's view). No AD pins the protocol for "stopping the world" during snapshot capture.

AD-11 says "new host validates" but does not say *what* validates or how concurrent ops during capture are handled. The gap is the absence of a **quiescence protocol**.

**Verdict: HOLE FOUND**

### What's missing
An AD that pins:
- **Snapshot quiescence:** Before capture, all clients MUST flush pending ops to the CRDT layer AND the capturing client MUST confirm all CRDT sync channels are drained (no in-flight ops). Alternatively: snapshots are taken only from the CRDT model's persisted state, which is always consistent.
- **Double-apply guard:** Incremental replay MUST check each op against the current model and skip already-applied ops (idempotent replay).

**Severity: HIGH** — Double-application of CRDT ops corrupts shared state silently. Recovery from host handoff produces incorrect formula state without any error signal.

---

## Axis 4: Degradation interface seam (⑤→A escape valve)

### Attempted construction

**Unit A — "Full degradation pipeline"** implements all three abstractions from AD-12 (degradation interface has three layers). It implements a data-compat layer that reads *both* the canonical CRDT formula format AND a legacy flat-string format (⑤→A escape valve). When the full CRDT model fails, it falls back to the flat-string format.

**Unit B — "Minimal data-compat"** implements AD-12 with only two abstractions — the data-compat layer reads *only* the canonical CRDT format. Unit B argues that AD-12 says "interface exists" and lists three abstractions, but does not say each abstraction must be *functional*. Unit B's data-compat layer is a thin pass-through: it receives CRDT model, returns CRDT model. The ⑤→A escape valve is an empty method that throws "not implemented."

**The incompatibility:** When the CRDT model becomes corrupted (the exact scenario ⑤→A was designed for), Unit B's system has no fallback. The user sees a crash or blank formula where Unit A would degrade gracefully to a flat string. Unit B obeys AD-12 to the letter — the interface exists, all three abstractions are declared. The AD does not say they must be *operational*.

**Verdict: HOLE FOUND**

### What's missing
Tighten AD-12 to specify:
- **Operational requirement:** Each of the three abstractions MUST produce valid output for its specified input range. The data-compat layer MUST support at least two formula representations (canonical CRDT + legacy flat string).
- **⑤→A obligation:** The escape valve MUST be implemented and tested. An unimplemented fallback is equivalent to no fallback.

**Severity: MED** — Silent failure: a user hitting CRDT corruption in a build with Unit B's implementation loses all formula data with no degradation path. The system claims to support ⑤→A (FR-SIM-8) but cannot deliver it.

---

## Axis 5: Circuit breaker vs degradation boundary

### Attempted construction

**Unit A — "Convergence-optimized solver"** implements FR-SIM-8 (degradation: convergence pressure, don't halt). When the Newton loop fails to converge, Unit A emits a degradation signal (reduce precision, fall back to bisection) and continues. It never invokes the circuit breaker (AD-5) for non-convergence.

**Unit B — "Resource-constrained solver"** implements AD-5 (circuit breaker: resource exhaustion, halt). Unit B's solver monitors iteration count. When the Newton loop exceeds 10,000 iterations, Unit B decides this is "resource exhaustion" (CPU time) and trips the circuit breaker, halting all sim. Unit B argues that a runaway Newton loop is a form of CPU resource exhaustion covered by AD-5.

**The incompatibility:** FR-SIM-8 says "don't halt under convergence pressure" — but AD-5 says "halt under resource exhaustion." A non-convergent Newton loop can be classified as either. The boundary is not pinned as an AD. Unit A never halts (obeys FR-SIM-8). Unit B halts aggressively (obeys AD-5). Two builders produce opposite behavior for the same input, and both are technically compliant.

**Verdict: HOLE FOUND**

### What's missing
An AD that pins the boundary:
- **Resource exhaustion definition:** "Resource exhaustion" for the circuit breaker is limited to [e.g., memory allocation failure, external computation timeout >30s, GPU OOM]. Iteration count and convergence failure are NEVER circuit-breaker events — they MUST route to the degradation chain (FR-SIM-8).
- **Exclusive routing:** A sim-step failure MUST be classified into exactly one of: (a) circuit-breaker event (halt), (b) degradation event (continue with reduced fidelity), (c) user-correctable error (show diagnostic). Non-convergence is (b) or (c), never (a).

**Severity: HIGH** — Two implementations of the same AD set can produce opposite outcomes (halt vs continue) for the exact same convergence failure. A user relying on degradation to keep their formula running gets a hard stop.

---

## Summary

| # | Axis | Finding | Severity |
|---|------|---------|----------|
| 1 | Two owners of simulation step | Non-host local preview diverges from host authoritative result; no AD pins whose Wasm is source of truth for visual state | HIGH |
| 2 | Clashing shared-data shape (nid scheme) | Two builders pick incompatible nid assignment rules; bracket projection glitches silently | MED |
| 3 | Snapshot vs CRDT race | No quiescence protocol for snapshot capture; double-apply of ops on host handoff | HIGH |
| 4 | Degradation interface seam | AD-12 abstractions can be empty stubs; ⑤→A escape valve can be unimplemented while "obeying" the interface | MED |
| 5 | Circuit breaker vs degradation boundary | Non-convergent loop can be routed to either circuit-breaker (halt) or degradation (continue); opposite outcomes for same input | HIGH |

### Verdict: N_HOLES (5 holes found)

### What must be tightened
1. **New AD:** Non-host client sim dataflow — visual state driven by host broadcast, not local Wasm. Preview is stale-until-confirmed.
2. **New AD / tighten AD-6:** nid assignment rule — monotonic counter (or equivalent), stable across subtree rebuilds.
3. **New AD / tighten AD-11:** Snapshot quiescence protocol — drain all CRDT sync channels before capture; idempotent replay guard.
4. **Tighten AD-12:** Each abstraction must be operational; data-compat layer must support >=2 formula representations; escape valve must be implemented.
5. **New AD:** Circuit breaker vs degradation boundary — resource exhaustion is memory/GPU/OOM only; iteration count and non-convergence always route to degradation.

### Review file
`_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/reviews/review-adversarial.md`
