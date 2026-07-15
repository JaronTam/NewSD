// Element CRUD store with useSyncExternalStore subscription.
// In-memory store for Story 1a.3; designed as a replaceable adapter
// so 1a.4 / collab (AD-10 Y.Doc) can swap out the backing store later.

import type { Cloud, ElementKind, Flow, SDElement, Stock } from "./types";

// ---------------------------------------------------------------------------
// E9 stock size validation (AC-8, AC-9)
// ---------------------------------------------------------------------------

export interface StockSizeResult {
  ok: boolean;
  width: number;
  height: number;
}

/** Default stock dimensions when input is invalid (≥4 char cells to fit box + text). */
export const DEFAULT_STOCK_W = 8;
export const DEFAULT_STOCK_H = 5;

/**
 * Validate stock width & height (E9 guard, AC-8 / AC-9).
 *
 * Accepts w >= 3 && h >= 3 (the minimum that fits a box frame ┌─┐│└┘ plus at
 * least one interior text row/col; smaller sizes degenerate — w<3 makes ┌/┐
 * overlap, h<3 collapses top/bottom edges onto the interior).
 * Rejects: < 3 on either axis, NaN, ±Infinity, non-numeric strings.
 * On rejection, returns `{ ok: false, width: DEFAULT, height: DEFAULT }`.
 * On success, returns the validated numeric values.
 */
export function validateStockSize(width: unknown, height: unknown): StockSizeResult {
  const w = Number(width);
  const h = Number(height);
  const ok = w >= 3 && h >= 3 && Number.isFinite(w) && Number.isFinite(h);
  return {
    ok,
    width: ok ? w : DEFAULT_STOCK_W,
    height: ok ? h : DEFAULT_STOCK_H,
  };
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface ElementStore {
  /** Immutable snapshot of all elements (ordered by insertion). */
  getElements(): readonly SDElement[];
  /** Create a new stock element. name auto-assigned `stock_N` when omitted. Returns the fully-hydrated Stock. */
  createStock(
    partial: Omit<Stock, "id" | "kind" | "currentValue" | "history" | "name"> & { name?: string },
  ): Stock;
  /** Create a new cloud element. name auto-assigned `cloud_N` when omitted. Returns the fully-hydrated Cloud. */
  createCloud(partial: Omit<Cloud, "id" | "kind" | "name"> & { name?: string }): Cloud;
  /** Create a new flow element. name auto-assigned `flow_N` when omitted. */
  createFlow(input: CreateFlowInput, onWarn?: (msg: string | null) => void): Flow;
  /** Update one element's mutable fields. No-op if id not found. */
  updateElement(id: string, patch: Partial<SDElement>): void;
  /** Remove an element by id. No-op if not found. */
  deleteElement(id: string): void;
  /** Replace all elements in one batch (e.g. after drag reorder). */
  setElements(elements: readonly SDElement[]): void;
  /** Subscribe to store changes. Returns unsubscribe function. */
  subscribe(callback: () => void): () => void;
  /** Current element snapshot (for useSyncExternalStore). */
  getSnapshot(): readonly SDElement[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createElementStore(): ElementStore {
  let elements: SDElement[] = [];
  const listeners = new Set<() => void>();

  // Per-type monotonic high-water counters (SDR#2). Incremented only on auto-name;
  // never decremented (delete/rename do not reclaim). Initialised at 0; setElements
  // re-derives them from the element snapshot via deriveSeq (A2 load path, SDR#13).
  let stockSeq = 0;
  let cloudSeq = 0;
  let flowSeq = 0;

  const notify = () => {
    for (const cb of listeners) cb();
  };

  /**
   * Return the next default name for `kind` (SDR#3: `<type>_<N>` format).
   * SDR#14 skip-forward semantics: if the canonical candidate `<type>_<N>` is
   * already taken (rename→canonical case), keep incrementing seq until the
   * candidate is free. Terminates because `elements` is finite and `seq` is
   * strictly increasing. Auto-name never throws, never collides.
   */
  const nextDefaultName = (kind: ElementKind): string => {
    const taken = new Set(
      elements.map((e) => (e as { name?: string }).name).filter(Boolean) as string[],
    );
    let candidate: string;
    switch (kind) {
      case "stock":
        do {
          stockSeq++;
          candidate = `stock_${stockSeq}`;
        } while (taken.has(candidate));
        return candidate;
      case "cloud":
        do {
          cloudSeq++;
          candidate = `cloud_${cloudSeq}`;
        } while (taken.has(candidate));
        return candidate;
      case "flow":
        do {
          flowSeq++;
          candidate = `flow_${flowSeq}`;
        } while (taken.has(candidate));
        return candidate;
    }
  };

  /**
   * Derive the per-kind sequence counter from the current element snapshot
   * (SDR#2 load path, A2 ruling). Scans all elements of the given kind,
   * extracts the maximum N from names matching `^<type>_(\d+)$`, and sets
   * the counter. Non-canonical names (non-matching / empty / above
   * Number.MAX_SAFE_INTEGER) are skipped. Called by setElements for each
   * kind on every full replacement.
   */
  const deriveSeq = (kind: ElementKind): void => {
    const prefix = `${kind}_`;
    let maxN = 0;
    for (const el of elements) {
      if (el.kind !== kind) continue;
      const name = (el as { name?: string }).name;
      if (!name || !name.startsWith(prefix)) continue;
      const suffix = name.slice(prefix.length);
      // Double-anchored: must be all digits, no extra chars.
      if (!/^\d+$/.test(suffix)) continue;
      const n = Number(suffix);
      if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER) continue;
      if (n > maxN) maxN = n;
    }
    switch (kind) {
      case "stock":
        stockSeq = maxN;
        break;
      case "cloud":
        cloudSeq = maxN;
        break;
      case "flow":
        flowSeq = maxN;
        break;
    }
  };

  /**
   * Assert name is available across ALL elements (single namespace, SDR#1).
   * Rejects empty/whitespace-only names (SDR#11). `exceptId` excludes the
   * element being renamed from the collision scan (no-op renames allowed).
   * @throws {Error} on collision or empty name.
   */
  const assertNameAvailable = (name: string, exceptId?: string): void => {
    if (!name || !name.trim()) {
      throw new Error("Name must not be empty");
    }
    const collision = elements.find(
      (e) => e.id !== exceptId && (e as { name?: string }).name === name,
    );
    if (collision) {
      throw new Error(`Name "${name}" is already in use`);
    }
  };

  return {
    getElements(): readonly SDElement[] {
      return elements;
    },

    createStock(partial): Stock {
      // E9 guard (AC-8/AC-9): clamp invalid/too-small dimensions to defaults
      // before they reach the renderer (which assumes w>=3, h>=3 for a valid box).
      const { width, height } = validateStockSize(partial.width, partial.height);
      const explicitName = partial.name !== undefined;
      // Empty/whitespace explicit names throw (SDR#11); auto-name when omitted.
      const name = explicitName ? partial.name! : nextDefaultName("stock");
      if (explicitName) assertNameAvailable(partial.name!);
      const stock: Stock = {
        ...partial,
        name,
        width,
        height,
        id: crypto.randomUUID(),
        kind: "stock",
        currentValue: partial.initialValue,
        history: [partial.initialValue],
      };
      elements = [...elements, stock];
      notify();
      return stock;
    },

    createCloud(partial): Cloud {
      const explicitName = partial.name !== undefined;
      const name = explicitName ? partial.name! : nextDefaultName("cloud");
      if (explicitName) assertNameAvailable(partial.name!);
      const cloud: Cloud = {
        ...partial,
        name,
        id: crypto.randomUUID(),
        kind: "cloud",
      };
      elements = [...elements, cloud];
      notify();
      return cloud;
    },

    createFlow(input, onWarn): Flow {
      // ① Endpoint validity
      const fromEl = elements.find((e) => e.id === input.fromId);
      const toEl = elements.find((e) => e.id === input.toId);

      if (!fromEl || fromEl.kind === "flow" || !toEl || toEl.kind === "flow") {
        throw new Error("Invalid flow endpoint");
      }

      // ② Self-loop guard
      if (input.fromId === input.toId) {
        throw new Error("Self-loop not allowed");
      }

      // Derive units from target stock + formula time annotation
      const units = deriveFlowUnits(input.formula, input.toId, elements);

      const explicitName = input.name !== undefined;
      const name = explicitName ? input.name! : nextDefaultName("flow");
      if (explicitName) assertNameAvailable(input.name!);

      const flow: Flow = {
        id: crypto.randomUUID(),
        kind: "flow",
        name,
        fromId: input.fromId,
        toId: input.toId,
        formula: input.formula,
        isVariable: input.isVariable,
        lastValue: 0,
        units,
      };

      // Capture pre-add state for warning computation (same semantics as
      // the standalone createFlow which computed against the snapshot before append).
      const preAddElements = elements;

      elements = [...elements, flow];
      notify();

      // F3: non-blocking E11/AC-15 warnings (computed against the pre-add state).
      if (onWarn) onWarn(flowCreateWarning(preAddElements, input));

      return flow;
    },

    updateElement(id, patch): void {
      const idx = elements.findIndex((e) => e.id === id);
      if (idx === -1) return;
      // Collision check for name changes (SDR#4, exclude self so no-op rename is safe).
      // AC-19: reject non-string name (undefined/null/number) — `"name" in patch` is
      // true even when the value is undefined, and `String(undefined)` would silently
      // corrupt the element.
      if ("name" in patch) {
        if (typeof patch.name !== "string") {
          throw new Error("Name must be a string");
        }
        assertNameAvailable(patch.name, id);
      }
      const updated = { ...elements[idx], ...patch } as SDElement;
      elements = [...elements.slice(0, idx), updated, ...elements.slice(idx + 1)];
      notify();
    },

    deleteElement(id): void {
      const idx = elements.findIndex((e) => e.id === id);
      if (idx === -1) return;
      elements = [...elements.slice(0, idx), ...elements.slice(idx + 1)];
      notify();
    },

    setElements(els): void {
      elements = [...els];
      // A2 load path: re-derive all three per-kind seq counters from the
      // new element snapshot (SDR#2/SDR#13). Full-replacement semantics —
      // does NOT accumulate on top of old seq values.
      deriveSeq("stock");
      deriveSeq("cloud");
      deriveSeq("flow");
      notify();
    },

    subscribe(callback): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    getSnapshot(): readonly SDElement[] {
      return elements;
    },
  };
}

// ---------------------------------------------------------------------------
// Flow helpers (Story 1a.4)
// ---------------------------------------------------------------------------

/**
 * Derive flow units from the target element's units and formula time annotation.
 *
 * Rules (AC-3, CS钉死):
 * - Default time unit = `/dt`
 * - If formula contains `[单位]` annotation (e.g. `[1/year]`), extract the
 *   time-unit portion (the `/…` segment) and use it instead of `/dt`
 * - If `toId` points to a Cloud or a non-existent element → return `""`
 * - If the target stock has empty units, return just the time unit (e.g. `/dt`)
 *
 * @returns The derived units string (single source of truth; called by createFlow).
 */
export function deriveFlowUnits(
  formula: string,
  toId: string,
  elements: readonly SDElement[],
): string {
  const toEl = elements.find((e) => e.id === toId);

  // Cloud target or nonexistent → empty string (AC-3 cloud fallback)
  if (!toEl || toEl.kind === "cloud") return "";

  const stockUnits = (toEl as Stock).units;

  // Default time unit (CS钉死)
  let timeUnit = "/dt";

  // Check for [单位] annotation in formula (e.g. "0.05 [1/year]")
  const annMatch = formula.match(/\[([^\]]+)\]/);
  if (annMatch) {
    const inner = annMatch[1]; // e.g. "1/year"
    const slashIdx = inner.indexOf("/");
    if (slashIdx !== -1) {
      timeUnit = inner.slice(slashIdx); // "/year"
    }
  }

  return stockUnits ? `${stockUnits}${timeUnit}` : timeUnit;
}

/** Partial input for createFlow (omits id/kind/units/lastValue — all derived). */
export interface CreateFlowInput {
  fromId: string;
  toId: string;
  formula: string;
  isVariable: boolean;
  name?: string;
}

/**
 * F3: detect non-blocking warnings for a flow about to be created from `input`
 * against the existing `elements`. Returns a human-readable warning string, or
 * null when the flow is clean. Pure (no store mutation) so it is unit-testable
 * in isolation and callable from createFlow without extra coupling.
 *
 * - E11 parallel flows: another flow already connects the same ordered pair
 *   (fromId→toId). Allowed (non-blocking), but flagged for the UI.
 * - Duplicate-name check REMOVED (SDR#4 / AC-11): name collisions are hard-
 *   rejected at create-time by assertNameAvailable, so this function no longer
 *   returns a dup-name warning. The parallel-flow gate (E11) is preserved.
 */
export function flowCreateWarning(
  elements: readonly SDElement[],
  input: CreateFlowInput,
): string | null {
  const flows = elements.filter((e): e is Flow => e.kind === "flow");
  const parallels = flows.filter((f) => f.fromId === input.fromId && f.toId === input.toId);
  if (parallels.length > 0) {
    const names = parallels.map((f) => f.name).join(", ");
    return `Parallel flow(s) already exist (${names}): ${input.fromId}→${input.toId}`;
  }
  // Duplicate-name branch REMOVED (SDR#4): name collision is hard-rejected at
  // create-time (assertNameAvailable in createStore.createFlow), so this pure
  // function no longer needs a dup-name gate. AC-11 + AC-15 rewired accordingly.
  return null;
}

/**
 * Create a Flow element and append it to the store.
 *
 * Guard sequence (AC-12/AC-12b/AC-1, throw form — preserves Flow return type):
 * ① Endpoint validity — fromId/toId must point to existing Stock or Cloud
 *    (rejects nonexistent ids and Flow→Flow connections)
 * ② Self-loop guard — fromId === toId → reject
 * ③ Name uniqueness (SDR#4/AC-1) — assertNameAvailable rejects duplicates
 *    across all element kinds (single namespace, SDR#1) and empty/whitespace
 *    names (SDR#11).
 *
 * E11 (parallel flows) is non-blocking; when `onWarn` is supplied it is
 * invoked with a warning string (or null when the flow is clean) after the
 * flow is appended. Duplicate-name warnings REMOVED (SDR#4/AC-11) — dup names
 * are hard-rejected in step ③, so `onWarn` no longer surfaces them.
 * Throwing guards do NOT call onWarn (the flow was not created).
 *
 * @throws {Error} "Invalid flow endpoint" if endpoints are invalid.
 * @throws {Error} "Self-loop not allowed" if fromId === toId.
 * @throws {Error} on duplicate or empty name (SDR#4/SDR#11).
 * @param onWarn Optional sink for non-blocking E11 warnings.
 */
export function createFlow(
  store: ElementStore,
  input: CreateFlowInput,
  onWarn?: (msg: string | null) => void,
): Flow {
  return store.createFlow(input, onWarn);
}
