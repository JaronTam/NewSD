// Story 1a-13: Session-level autosave + restore (localStorage)
// SDR#1-SDR#12: autosave trigger, debounce, error tolerance, envelope schema,
// field whitelist, beforeunload, prerender guard, restore path, defensive load,
// storage isolation, handleNew, never-default exhaustiveness.
//
// Design authority: memory newsd-1a11-a2-and-1a13-autosave-ruling
// 1a.12 SDR#8 storage boundary: sessionStorage "ns-prompt-panel-last-tab" (PromptPanel)
// 1a.11 deriveSeq/A2: setElements -> deriveSeq (store.ts:289-298)

import { deriveFlowUnits, type ElementStore } from "./store";
import type { Cloud, Flow, SDElement, Stock } from "./types";

// ---------------------------------------------------------------------------
// Constants (SDR#2, SDR#4)
// ---------------------------------------------------------------------------

/** localStorage key for the board autosave envelope. */
export const AUTOSAVE_KEY = "ns-board-autosave";

/** Current envelope schema version. Bump on incompatible schema changes. */
export const AUTOSAVE_VERSION = 1;

/** Debounce window in ms between a store change and the localStorage flush. */
export const AUTOSAVE_DEBOUNCE_MS = 1000;

// ---------------------------------------------------------------------------
// Persisted element types (SDR#5 — field whitelist per AC-13)
// ---------------------------------------------------------------------------

interface PersistedStock {
  kind: "stock";
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  initialValue: number;
  units: string;
  allowNegative: boolean;
}

interface PersistedCloud {
  kind: "cloud";
  id: string;
  name: string;
  x: number;
  y: number;
}

interface PersistedFlow {
  kind: "flow";
  id: string;
  name: string;
  fromId: string;
  toId: string;
  formula: string;
  isVariable: boolean;
}

type PersistedElement = PersistedStock | PersistedCloud | PersistedFlow;

/** Envelope written to localStorage (SDR#4). */
interface AutosaveEnvelope {
  version: number;
  elements: PersistedElement[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function hasLocalStorage(): boolean {
  return hasWindow() && "localStorage" in window;
}

// ---------------------------------------------------------------------------
// toPersisted / fromPersisted (SDR#5, SDR#12 — never-default exhaustiveness)
// ---------------------------------------------------------------------------

/**
 * Strip runtime/derived fields from an SDElement, producing a PersistedElement
 * suitable for serialization (SDR#5, AC-13 whitelist).
 *
 * Stock: retains id/kind/name/x/y/width/height/initialValue/units/allowNegative
 *        (10 fields), strips currentValue + history.
 * Cloud: retains id/kind/name/x/y (5 fields, full set).
 * Flow:  retains id/kind/name/fromId/toId/formula/isVariable (7 fields),
 *        strips lastValue + units + formulaError.
 */
export function toPersisted(e: SDElement): PersistedElement {
  switch (e.kind) {
    case "stock":
      return {
        kind: "stock",
        id: e.id,
        name: e.name,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        initialValue: e.initialValue,
        units: e.units,
        allowNegative: e.allowNegative,
      };
    case "cloud":
      return {
        kind: "cloud",
        id: e.id,
        name: e.name,
        x: e.x,
        y: e.y,
      };
    case "flow":
      return {
        kind: "flow",
        id: e.id,
        name: e.name,
        fromId: e.fromId,
        toId: e.toId,
        formula: e.formula,
        isVariable: e.isVariable,
      };
    default: {
      const _exhaustive: never = e;
      throw new Error(`unknown kind: ${(e as SDElement).kind}`);
    }
  }
}

/**
 * Rehydrate a PersistedElement into a full SDElement with runtime fields
 * re-initialised (SDR#5, AC-11).
 *
 * Stock: currentValue = initialValue, history = [initialValue].
 * Cloud: no runtime fields.
 * Flow: lastValue = 0, units = "" (placeholder, filled by deriveFlowUnits
 *        in the two-pass restore), formulaError = null.
 */
export function fromPersisted(p: PersistedElement): SDElement {
  switch (p.kind) {
    case "stock":
      return {
        kind: "stock",
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        initialValue: p.initialValue,
        units: p.units,
        allowNegative: p.allowNegative,
        currentValue: p.initialValue,
        history: [p.initialValue],
      } as Stock;
    case "cloud":
      return {
        kind: "cloud",
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
      } as Cloud;
    case "flow":
      return {
        kind: "flow",
        id: p.id,
        name: p.name,
        fromId: p.fromId,
        toId: p.toId,
        formula: p.formula,
        isVariable: p.isVariable,
        lastValue: 0,
        units: "",
        formulaError: null,
      } as Flow;
    default: {
      const _exhaustive: never = p;
      throw new Error(`unknown kind: ${(p as PersistedElement).kind}`);
    }
  }
}

// ---------------------------------------------------------------------------
// validateEnvelope (SDR#9, SDR#12 — defensive load)
// ---------------------------------------------------------------------------

const VALID_KINDS = new Set(["stock", "cloud", "flow"]);

/** Required fields per kind for structural validation. */
const REQUIRED_FIELDS: Record<string, string[]> = {
  stock: ["id", "name", "x", "y", "width", "height", "initialValue", "units", "allowNegative"],
  cloud: ["id", "name", "x", "y"],
  flow: ["id", "name", "fromId", "toId", "formula", "isVariable"],
};

function isValidKind(k: unknown): k is PersistedElement["kind"] {
  return typeof k === "string" && VALID_KINDS.has(k);
}

function validateElement(el: unknown): el is PersistedElement {
  if (typeof el !== "object" || el === null) return false;
  const obj = el as Record<string, unknown>;
  if (!isValidKind(obj.kind)) return false;
  const required = REQUIRED_FIELDS[obj.kind];
  for (const field of required) {
    if (!(field in obj)) return false;
  }
  // Type-check scalar fields
  if (typeof obj.id !== "string") return false;
  if (typeof obj.name !== "string") return false;
  if (obj.kind !== "flow") {
    if (typeof obj.x !== "number" || typeof obj.y !== "number") return false;
  }
  if (obj.kind === "stock") {
    if (
      typeof obj.width !== "number" ||
      typeof obj.height !== "number" ||
      typeof obj.initialValue !== "number" ||
      typeof obj.units !== "string" ||
      typeof obj.allowNegative !== "boolean"
    )
      return false;
  }
  if (obj.kind === "flow") {
    if (
      typeof obj.fromId !== "string" ||
      typeof obj.toId !== "string" ||
      typeof obj.formula !== "string" ||
      typeof obj.isVariable !== "boolean"
    )
      return false;
  }
  return true;
}

/**
 * Validate a raw parsed value as an AutosaveEnvelope (SDR#9).
 * Returns { ok: true, elements } on success, { ok: false } on any failure.
 */
export function validateEnvelope(
  raw: unknown,
): { ok: true; elements: PersistedElement[] } | { ok: false } {
  if (typeof raw !== "object" || raw === null) return { ok: false };
  const obj = raw as Record<string, unknown>;
  if (obj.version !== AUTOSAVE_VERSION) return { ok: false };
  if (!Array.isArray(obj.elements)) return { ok: false };
  for (const el of obj.elements) {
    if (!validateElement(el)) return { ok: false };
  }
  return { ok: true, elements: obj.elements as PersistedElement[] };
}

// ---------------------------------------------------------------------------
// restoreFromStorage (SDR#8 — localStorage -> validate -> fromPersisted -> setElements)
// ---------------------------------------------------------------------------

/**
 * Read the autosave envelope from localStorage, validate, rehydrate, and load
 * into the store via setElements (which triggers deriveSeq — A2 compatible,
 * 1a.11 done @1bb3598). Two-pass deriveFlowUnits for flows (SDR#5 two-pass).
 *
 * On missing key / empty / corrupt / version mismatch: warn + leave store as-is.
 */
export function restoreFromStorage(store: ElementStore): void {
  if (!hasLocalStorage()) return;

  let raw: unknown;
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return; // AC-9: missing key -> no-op
    raw = JSON.parse(json);
  } catch {
    console.warn("[autosave] restore skipped: invalid JSON");
    return;
  }

  const validated = validateEnvelope(raw);
  if (!validated.ok) {
    console.warn("[autosave] restore skipped: invalid envelope");
    return;
  }

  if (validated.elements.length === 0) {
    store.setElements([]);
    return;
  }

  // Pass 1: rehydrate from persisted (flow units placeholder "")
  const sdelements = validated.elements.map(fromPersisted);

  // Pass 2: deriveFlowUnits for each flow (needs full element list, SDR#5 two-pass).
  // Calls store.ts deriveFlowUnits directly (no circular dep: store does not import autosave).
  for (const el of sdelements) {
    if (el.kind === "flow") {
      const flow = el as Flow;
      flow.units = deriveFlowUnits(flow.formula, flow.toId, sdelements);
      flow.formulaError = null;
    }
  }

  store.setElements(sdelements);
}

// ---------------------------------------------------------------------------
// startAutosave (SDR#1, SDR#3, SDR#6, SDR#7)
// ---------------------------------------------------------------------------

/**
 * Subscribe to store changes and auto-flush a snapshot to localStorage on a
 * debounce (SDR#1). Registers a beforeunload handler for dirty-flush (SDR#6).
 * Prerender-safe: no-ops when window/localStorage are unavailable (SDR#7).
 *
 * @returns unsubscribe function — call on CanvasView unmount to clean up.
 */
export function startAutosave(store: ElementStore): () => void {
  if (!hasLocalStorage()) {
    return () => {}; // prerender / no-window: no-op (SDR#7)
  }

  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  // Synchronous flush: writes envelope if dirty, returns success (SDR#3).
  // Shared by debounce flush() and beforeunload handler (F-4 dedupe).
  const syncFlush = (): boolean => {
    if (!dirty) return true;
    const elements = store.getElements();
    const envelope: AutosaveEnvelope = {
      version: AUTOSAVE_VERSION,
      elements: elements.map(toPersisted),
    };
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(envelope));
      dirty = false;
      return true;
    } catch (err) {
      // SDR#3: quota exceeded / security error - warn, don't crash, keep dirty
      console.warn("[autosave] write failed", err);
      return false;
    }
  };

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    syncFlush();
  };

  // Subscribe to store changes (SDR#1)
  const unsubStore = store.subscribe(() => {
    dirty = true;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
  });

  // beforeunload handler (SDR#6)
  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    // Sync immediate flush (block until localStorage write completes)
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    // Only prompt if flush failed (still dirty) - SDR#6
    // MDN best practice: preventDefault() + non-empty returnValue (legacy support).
    const ok = syncFlush();
    if (!ok) {
      e.preventDefault();
      e.returnValue = " ";
    }
  };

  // Register beforeunload
  window.addEventListener("beforeunload", onBeforeUnload);

  // Return combined cleanup
  return () => {
    unsubStore();
    window.removeEventListener("beforeunload", onBeforeUnload);
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
