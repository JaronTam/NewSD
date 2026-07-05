// Element CRUD store with useSyncExternalStore subscription.
// In-memory store for Story 1a.3; designed as a replaceable adapter
// so 1a.4 / collab (AD-10 Y.Doc) can swap out the backing store later.

import type { Cloud, SDElement, Stock } from "./types";

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
