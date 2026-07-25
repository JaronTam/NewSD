// Story 1a-10 T2 — External singleton store for model-level config (timeUnit + dt).
// gov: AC-1..AC-5/AC-8/AC-10 + SDR#1/#2/#3/#5/#6/#23.
//
// Pattern: factory-closure external store (mirror 1a.9 langStore — SDR#23).
// Consumers: CanvasView (dt backing + revalidation effect), SettingsPanel
// (timeUnit select + dim-revalidation status row), Toolbar dt selector (via
// CanvasView props).
//
// Persistence: localStorage key `ns-model-config` holds ONLY {timeUnit, dt}
// (SDR#1). revalidationNonce + lastRevalidation are runtime-derived (not
// persisted — recomputed at runtime via the CanvasView effect, SDR#5/#6).
// Restore: localStorage → defaults (year/0.1); corrupt/invalid → discard +
// console.warn (AC-2, modelStore-specific warn — langStore stores a bare
// string and has no parse path).

import type { DimensionalCheckResult } from "./dimensionalCheck";

/** SDR#2: 年/月/日/时/分/秒 (FR-SIM-1, epics.md L56). */
export type TimeUnit = "year" | "month" | "day" | "hour" | "minute" | "second";

/** SDR#6: observable revalidation outcome (1a proves trigger-ready, not derivation). */
export interface LastRevalidation {
  flowCount: number;
  /** true 仅证 stub 跑过 (1a checkDimensions always deferred), 非推导结果正确性. */
  allDeferred: boolean;
  /** nonce at record time — ties the result to the triggering setTimeUnit. */
  nonce: number;
}

/** SDR#1: model-level config snapshot (immutable — every mutator rebuilds). */
export interface ModelConfig {
  timeUnit: TimeUnit;
  dt: number;
  revalidationNonce: number;
  lastRevalidation: LastRevalidation | null;
}

/** AC-1/AC-10: localStorage key — independent from ns-lang / ns-board-autosave (SDR#30). */
export const MODEL_CONFIG_KEY = "ns-model-config";

/** AC-2: default time unit (i18n.ts perTime "/ 年" year basis + SD convention). */
export const DEFAULT_TIME_UNIT: TimeUnit = "year";

/** AC-3: default dt (FR-SIM-1; CanvasView:575 useState(0.1) baseline). */
export const DEFAULT_DT = 0.1;

interface PersistedModelConfig {
  timeUnit: TimeUnit;
  dt: number;
}

/**
 * SDR#2: TimeUnit validation with never-default exhaustiveness — adding a
 * TimeUnit member without extending this switch is a COMPILE error
 * (project-context L69; 1a.13 SDR#12 precedent). Runtime: unknown strings
 * fall into default and are rejected.
 */
function isTimeUnit(v: unknown): v is TimeUnit {
  if (typeof v !== "string") return false;
  const u = v as TimeUnit;
  switch (u) {
    case "year":
    case "month":
    case "day":
    case "hour":
    case "minute":
    case "second":
      return true;
    default: {
      const _exhaustive: never = u;
      void _exhaustive;
      return false;
    }
  }
}

function isValidPersisted(v: unknown): v is PersistedModelConfig {
  if (typeof v !== "object" || v === null) return false;
  const p = v as { timeUnit?: unknown; dt?: unknown };
  return isTimeUnit(p.timeUnit) && typeof p.dt === "number" && Number.isFinite(p.dt) && p.dt > 0;
}

/** AC-2: restore — localStorage → null (caller falls back to defaults); corrupt/invalid → warn + null. */
function readStoredConfig(): PersistedModelConfig | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(MODEL_CONFIG_KEY);
  } catch {
    // localStorage unavailable (SSR / test) — fall through to defaults (mirror langStore).
    return null;
  }
  if (raw === null) return null; // first visit — defaults, no warn
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidPersisted(parsed)) return { timeUnit: parsed.timeUnit, dt: parsed.dt };
  } catch {
    // bad JSON — fall through to warn
  }
  console.warn(`[modelStore] corrupt ${MODEL_CONFIG_KEY} — discarding, using defaults`);
  return null;
}

function createModelStore() {
  const stored = readStoredConfig();
  let snapshot: ModelConfig = {
    timeUnit: stored?.timeUnit ?? DEFAULT_TIME_UNIT,
    dt: stored?.dt ?? DEFAULT_DT,
    revalidationNonce: 0,
    lastRevalidation: null,
  };
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((cb) => cb());
  }

  /** SDR#1: persist ONLY {timeUnit, dt} (nonce + lastRevalidation are runtime-derived). */
  function persist() {
    try {
      localStorage.setItem(
        MODEL_CONFIG_KEY,
        JSON.stringify({ timeUnit: snapshot.timeUnit, dt: snapshot.dt }),
      );
    } catch {
      // localStorage quota exceeded or unavailable — noop (in-memory only), mirror langStore.
    }
  }

  return {
    /** SDR#23: useSyncExternalStore subscription (Set-based, idempotent). */
    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    /** SDR#23: current snapshot (cached ref — stable between mutations). */
    getSnapshot(): ModelConfig {
      return snapshot;
    },

    /** AC-1/AC-5: switch time unit + persist + bump revalidationNonce (CanvasView effect trigger key, SDR#5). */
    setTimeUnit(next: TimeUnit) {
      if (next === snapshot.timeUnit) return; // no change → no trigger
      snapshot = { ...snapshot, timeUnit: next, revalidationNonce: snapshot.revalidationNonce + 1 };
      persist();
      notify();
    },

    /** AC-3/AC-8: update dt + persist. Does NOT bump nonce — dt is not a dimensional basis (SDR#5). */
    setDt(next: number) {
      if (next === snapshot.dt) return;
      snapshot = { ...snapshot, dt: next };
      persist();
      notify();
    },

    /**
     * AC-5/AC-7: record a full-model revalidation run (SDR#6). Immutable
     * snapshot rebuild + notify; nonce unchanged → CanvasView effect[nonce]
     * does not re-enter (no loop).
     */
    recordRevalidation(results: DimensionalCheckResult[]) {
      snapshot = {
        ...snapshot,
        lastRevalidation: {
          flowCount: results.length,
          allDeferred: results.every((r) => r.status === "deferred"),
          nonce: snapshot.revalidationNonce,
        },
      };
      notify();
    },
  };
}

/** Shared singleton (imported by CanvasView / SettingsPanel). */
export const modelStore = createModelStore();
