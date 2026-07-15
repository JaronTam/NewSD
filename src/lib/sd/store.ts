// Element CRUD store with useSyncExternalStore subscription.
// In-memory store for Story 1a.3; designed as a replaceable adapter
// so 1a.4 / collab (AD-10 Y.Doc) can swap out the backing store later.

import type { Cloud, Flow, SDElement, Stock } from "./types";

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
  /** Create a new stock element. Returns the fully-hydrated Stock. */
  createStock(partial: Omit<Stock, "id" | "kind" | "currentValue" | "history">): Stock;
  /** Create a new cloud element. Returns the fully-hydrated Cloud. */
  createCloud(partial: Omit<Cloud, "id" | "kind">): Cloud;
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

  const notify = () => {
    for (const cb of listeners) cb();
  };

  return {
    getElements(): readonly SDElement[] {
      return elements;
    },

    createStock(partial): Stock {
      // E9 guard (AC-8/AC-9): clamp invalid/too-small dimensions to defaults
      // before they reach the renderer (which assumes w>=3, h>=3 for a valid box).
      const { width, height } = validateStockSize(partial.width, partial.height);
      const stock: Stock = {
        ...partial,
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
      const cloud: Cloud = {
        ...partial,
        id: crypto.randomUUID(),
        kind: "cloud",
      };
      elements = [...elements, cloud];
      notify();
      return cloud;
    },

    updateElement(id, patch): void {
      const idx = elements.findIndex((e) => e.id === id);
      if (idx === -1) return;
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
 * Rules (AC-3, CS 决策):
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

  // Default time unit (CS 决策)
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
 * - AC-15 duplicate names: another flow shares the proposed (or auto-generated)
 *   name. Allowed (non-blocking), but flagged.
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
  const flowNums = flows.map((f) => {
    const m = f.name.match(/^Flow (\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const nextFlowNum = Math.max(0, ...flowNums) + 1;
  const name = input.name ?? `Flow ${nextFlowNum}`;
  if (flows.some((f) => f.name === name)) {
    return `Duplicate flow name: "${name}"`;
  }
  return null;
}

/**
 * Create a Flow element and append it to the store.
 *
 * Guard sequence (AC-12/AC-12b, throw form — preserves Flow return type):
 * ① Endpoint validity — fromId/toId must point to existing Stock or Cloud
 *    (rejects nonexistent ids and Flow→Flow connections)
 * ② Self-loop guard — fromId === toId → reject
 *
 * E11 (parallel flows) and AC-15 (duplicate names) are allowed (non-blocking);
 * when `onWarn` is supplied it is invoked with a warning string (or null when
 * the flow is clean) after the flow is appended. Throwing guards do NOT call
 * onWarn (the flow was not created).
 *
 * @throws {Error} "Invalid flow endpoint" if endpoints are invalid.
 * @throws {Error} "Self-loop not allowed" if fromId === toId.
 * @param onWarn Optional sink for non-blocking E11/AC-15 warnings.
 */
export function createFlow(
  store: ElementStore,
  input: CreateFlowInput,
  onWarn?: (msg: string | null) => void,
): Flow {
  const elements = [...store.getElements()];

  // ① Endpoint validity (AC-12b)
  const fromEl = elements.find((e) => e.id === input.fromId);
  const toEl = elements.find((e) => e.id === input.toId);

  if (!fromEl || fromEl.kind === "flow" || !toEl || toEl.kind === "flow") {
    throw new Error("Invalid flow endpoint");
  }

  // ② Self-loop guard (AC-12)
  if (input.fromId === input.toId) {
    throw new Error("Self-loop not allowed");
  }

  // Derive units from target stock + formula time annotation
  const units = deriveFlowUnits(input.formula, input.toId, elements);

  // Auto-name: use max existing Flow-N + 1 (not length+1, which can collide after deletions).
  const flowNums = elements
    .filter((e) => e.kind === "flow")
    .map((f) => {
      const m = f.name.match(/^Flow (\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const nextFlowNum = Math.max(0, ...flowNums) + 1;

  const flow: Flow = {
    id: crypto.randomUUID(),
    kind: "flow",
    name: input.name ?? `Flow ${nextFlowNum}`,
    fromId: input.fromId,
    toId: input.toId,
    formula: input.formula,
    isVariable: input.isVariable,
    lastValue: 0,
    units,
  };

  store.setElements([...elements, flow]);

  // F3: non-blocking E11/AC-15 warnings (computed against the pre-add state).
  if (onWarn) onWarn(flowCreateWarning(elements, input));

  return flow;
}
