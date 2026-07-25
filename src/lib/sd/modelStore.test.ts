// Story 1a-10 T0 - ATDD red-phase scaffold (modelStore); DS T1/T2 unskipped AC-1/AC-2/AC-10.
// gov: AC-1..AC-8, AC-10, AC-13 + SDR#1/#2/#5/#6/#23 + T0.
//
// DS T2 done: declare-const block replaced with real import (modelStore.ts created).
// Remaining it.skip tests (AC-3/AC-4 -> T3; AC-5..AC-8 -> T7; AC-13 -> T9) unskip
// per DS task order.
//
// DS note: modelStore is a module-level singleton (mirror langStore). Restore
// tests (AC-2) use vi.resetModules + dynamic import (freshStore) to obtain a
// fresh instance after setItem.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DimensionalCheckResult } from "./dimensionalCheck";
import { t, type DictKey } from "./i18n";
import { modelStore, MODEL_CONFIG_KEY } from "./modelStore";

// DS T1: fresh-singleton helper — modelStore is a module-level singleton
// (mirror langStore), so restore tests re-import the module after seeding
// localStorage. vi.resetModules drops the cached instance.
async function freshStore() {
  vi.resetModules();
  return await import("./modelStore");
}

// ═══════════════════════════════════════════════════════════════════════════════
// AC-1: timeUnit single-select persist
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-1: setTimeUnit updates snapshot + persists ns-model-config", () => {
  it("[P0] setTimeUnit(next) updates snapshot.timeUnit + persists localStorage[MODEL_CONFIG_KEY]", async () => {
    // gov: AC-1 + SDR#1 + T1
    localStorage.clear();
    const { modelStore, MODEL_CONFIG_KEY } = await freshStore();
    modelStore.setTimeUnit("month");
    expect(modelStore.getSnapshot().timeUnit).toBe("month");
    const raw = localStorage.getItem(MODEL_CONFIG_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).timeUnit).toBe("month");
  });

  it("[P0] persist writes only {timeUnit, dt} (revalidationNonce + lastRevalidation are runtime-derived, SDR#1)", async () => {
    // gov: AC-1 + SDR#1 + T1. 域模型对账: nonce/lastRevalidation 不持久.
    localStorage.clear();
    const { modelStore, MODEL_CONFIG_KEY } = await freshStore();
    modelStore.setTimeUnit("month");
    const persisted = JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY)!);
    expect(Object.keys(persisted).sort()).toEqual(["dt", "timeUnit"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-2: default year/0.1 + restore + corrupt-discard
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-2: default year/0.1 + restore + corrupt-discard", () => {
  it("[P0] fresh store (no localStorage) defaults to timeUnit=year, dt=0.1", async () => {
    // gov: AC-2 + SDR#1 + T1. i18n.ts:45 perTime "/ 年" year basis + FR-SIM-1 dt=0.1.
    localStorage.clear();
    const { modelStore, DEFAULT_TIME_UNIT, DEFAULT_DT } = await freshStore();
    const snap = modelStore.getSnapshot();
    expect(snap.timeUnit).toBe(DEFAULT_TIME_UNIT);
    expect(snap.timeUnit).toBe("year");
    expect(snap.dt).toBe(DEFAULT_DT);
    expect(snap.dt).toBe(0.1);
    expect(snap.revalidationNonce).toBe(0);
    expect(snap.lastRevalidation).toBeNull();
  });

  it("[P0] restore: valid localStorage[MODEL_CONFIG_KEY] -> fresh singleton reflects saved timeUnit+dt", async () => {
    // gov: AC-2 + SDR#1 + T1. mirror langStore restore (localStorage -> default).
    localStorage.clear();
    localStorage.setItem("ns-model-config", JSON.stringify({ timeUnit: "day", dt: 0.5 }));
    const { modelStore } = await freshStore();
    expect(modelStore.getSnapshot().timeUnit).toBe("day");
    expect(modelStore.getSnapshot().dt).toBe(0.5);
  });

  it("[P0] corrupt localStorage (bad JSON) -> discard + default + console.warn (no throw, no bad data inject)", async () => {
    // gov: AC-2 + SDR#1 + T1. modelStore restore 3-tier fallback (mirror langStore); warn is modelStore-specific.
    localStorage.clear();
    localStorage.setItem("ns-model-config", "{not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { modelStore } = await freshStore();
    const snap = modelStore.getSnapshot();
    expect(snap.timeUnit).toBe("year");
    expect(snap.dt).toBe(0.1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("[P0] invalid fields (bad timeUnit / bad dt / missing fields) -> discard + default + console.warn", async () => {
    // gov: AC-2 + SDR#1/#2 + T1. 缺字段/非法值 -> 丢弃 + 默认值 (不注入坏数据).
    const cases = [
      JSON.stringify({ timeUnit: "fortnight", dt: 0.5 }), // bad timeUnit
      JSON.stringify({ timeUnit: "month", dt: "abc" }), // bad dt type
      JSON.stringify({ timeUnit: "month", dt: -1 }), // non-positive dt
      JSON.stringify({ timeUnit: "month" }), // missing dt
      JSON.stringify({ dt: 0.5 }), // missing timeUnit
      JSON.stringify("just a string"), // wrong shape
    ];
    for (const c of cases) {
      localStorage.clear();
      localStorage.setItem("ns-model-config", c);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { modelStore } = await freshStore();
      expect(modelStore.getSnapshot().timeUnit).toBe("year");
      expect(modelStore.getSnapshot().dt).toBe(0.1);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-3: default dt 0.1 + setDt persist (FR-SIM-1 linkage, 1b solver)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-3: setDt updates snapshot + persists", () => {
  it("[P0] setDt(next) updates snapshot.dt + persists + no nonce bump (FR-SIM-1, 1b.1/1b.8 solver linkage)", () => {
    // gov: AC-3 + SDR#3 + T3. dt selector options [0.01,0.1,0.5,1.0] unchanged (Toolbar 1a.7).
    // setDt 持久化无 nonce (dt 非量纲基准, T3; AC-8 双覆盖 T7).
    localStorage.clear();
    const nonceBefore = modelStore.getSnapshot().revalidationNonce;
    modelStore.setDt(0.5);
    expect(modelStore.getSnapshot().dt).toBe(0.5);
    expect(JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY)!).dt).toBe(0.5);
    expect(modelStore.getSnapshot().revalidationNonce).toBe(nonceBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-4: dt backing migrated to modelStore (persist across reload)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-4: dt backing migrated to modelStore (model-level, not CanvasView transient)", () => {
  it("[P0] dt persists in localStorage[MODEL_CONFIG_KEY] (was CanvasView L575 useState(0.1) transient)", () => {
    // gov: AC-4 + SDR#3 + T3. store-layer pin: dt persisted. CanvasView wiring red in CanvasView.test (T3/T4).
    localStorage.clear();
    modelStore.setDt(1.0);
    expect(JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY)!).dt).toBe(1.0);
    // restore: fresh singleton picks the persisted dt up (跨刷新保留)
    return freshStore().then(({ modelStore: fresh }) => {
      expect(fresh.getSnapshot().dt).toBe(1.0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-5: setTimeUnit triggers revalidation (nonce++ + lastRevalidation)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-5: setTimeUnit triggers revalidation (nonce++ + recordRevalidation)", () => {
  // CR F-2: reset module-level singleton timeUnit before each it. AC-5 it1 :157 setTimeUnit("month")
  // requires timeUnit="year" baseline to bump nonce; residue "month" from prior run would early-return
  // (setTimeUnit same-value no-op) and fail :159 after===before+1 under order-shuffle.
  beforeEach(() => {
    modelStore.setTimeUnit("year");
  });

  it("[P0] setTimeUnit increments revalidationNonce (CanvasView effect[nonce] trigger key)", () => {
    // gov: AC-5 + SDR#5 + T7. setTimeUnit -> nonce++; CanvasView effect[nonce] reruns revalidateAllDimensions.
    localStorage.clear();
    const before = modelStore.getSnapshot().revalidationNonce;
    modelStore.setTimeUnit("month");
    const after = modelStore.getSnapshot().revalidationNonce;
    expect(after).toBe(before + 1);
  });

  it("[P0] recordRevalidation(results) writes lastRevalidation {flowCount, allDeferred, nonce}", () => {
    // gov: AC-5 + SDR#6 + T7. CanvasView effect calls recordRevalidation(immutable snapshot rebuild).
    const results: DimensionalCheckResult[] = [
      { status: "deferred", message: "待 1b" },
      { status: "deferred", message: "待 1b" },
    ];
    modelStore.recordRevalidation(results);
    const last = modelStore.getSnapshot().lastRevalidation;
    expect(last).not.toBeNull();
    expect(last!.flowCount).toBe(2);
    expect(last!.allDeferred).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-6: stub returns deferred (allDeferred proves stub ran, not derivation)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-6: allDeferred=true proves stub ran (not derivation result)", () => {
  it("[P1] recordRevalidation with N deferred results -> allDeferred=true (1b.1 replaces checkDimensions)", () => {
    // gov: AC-6 + SDR#4/#20 + T5. allDeferred=true only proves stub ran, not derivation correctness.
    const results: DimensionalCheckResult[] = Array.from({ length: 5 }, () => ({
      status: "deferred" as const,
      message: "待 1b",
    }));
    modelStore.recordRevalidation(results);
    expect(modelStore.getSnapshot().lastRevalidation!.allDeferred).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-7: lastRevalidation observable (trigger-ready, not derivation result)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-7: lastRevalidation observable via getSnapshot()", () => {
  it("[P0] lastRevalidation exposes flowCount + allDeferred (1a verifies trigger-ready, not derivation)", () => {
    // gov: AC-7 + SDR#6 + T7. observable via getSnapshot() or SettingsPanel ns-settings-dim-revalidation (DOM).
    modelStore.recordRevalidation([{ status: "deferred", message: "待 1b" }]);
    const last = modelStore.getSnapshot().lastRevalidation;
    expect(last).not.toBeNull();
    expect(typeof last!.flowCount).toBe("number");
    expect(typeof last!.allDeferred).toBe("boolean");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-8: setDt does NOT trigger revalidation
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-8: setDt does NOT trigger revalidation", () => {
  // CR F-2: reset timeUnit so :215 setTimeUnit("month") bumps nonce from "year" baseline (not early-return
  // on residue "month"); establishes clear nonceBefore baseline independent of prior describe order.
  beforeEach(() => {
    modelStore.setTimeUnit("year");
  });

  it("[P0] setDt leaves revalidationNonce + lastRevalidation unchanged (dt is not a dimensional basis)", () => {
    // gov: AC-8 + SDR#5 + T7. setTimeUnit -> nonce++; setDt -> no nonce (dt non-dimensional).
    localStorage.clear();
    modelStore.setTimeUnit("month");
    const nonceBefore = modelStore.getSnapshot().revalidationNonce;
    const lastBefore = modelStore.getSnapshot().lastRevalidation;
    modelStore.setDt(0.5);
    expect(modelStore.getSnapshot().revalidationNonce).toBe(nonceBefore);
    expect(modelStore.getSnapshot().lastRevalidation).toBe(lastBefore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-10: storage boundary isolation (ns-model-config independent key)
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-10: persist writes only ns-model-config (ns-lang / ns-board-autosave untouched)", () => {
  it("[P0] setTimeUnit/setDt write ns-model-config only; ns-lang + ns-board-autosave envelope untouched", async () => {
    // gov: AC-10 + SDR#21/#30 + T1. modelConfig independent key, NOT in autosave envelope (version 1 elements-only).
    localStorage.clear();
    localStorage.setItem("ns-lang", "en");
    localStorage.setItem("ns-board-autosave", JSON.stringify({ version: 1, elements: [] }));
    const { modelStore, MODEL_CONFIG_KEY } = await freshStore();
    modelStore.setTimeUnit("day");
    modelStore.setDt(0.5);
    // modelConfig persisted to its own key
    expect(JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY)!).timeUnit).toBe("day");
    expect(JSON.parse(localStorage.getItem(MODEL_CONFIG_KEY)!).dt).toBe(0.5);
    // other stores untouched
    expect(localStorage.getItem("ns-lang")).toBe("en");
    expect(JSON.parse(localStorage.getItem("ns-board-autosave")!).version).toBe(1);
    expect(JSON.parse(localStorage.getItem("ns-board-autosave")!).elements).toEqual([]);
    // restore does not read other keys either (fresh singleton from seeded state)
    const again = await freshStore();
    expect(again.modelStore.getSnapshot().timeUnit).toBe("day");
    expect(localStorage.getItem("ns-lang")).toBe("en");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-13: i18n key completeness (9 keys zh+en via t())
// ═══════════════════════════════════════════════════════════════════════════════

describe("modelStore - AC-13: 9 i18n keys render via t() zh+en (no hardcode中文)", () => {
  it("[P1] modelSettings/timeUnit/unitYear..unitSecond/dimRevalidationPending exist zh+en via t()", () => {
    // gov: AC-13 + SDR#2 + T10. RED: keys not in dict yet -> t() tier-3 returns key name.
    // Cast strategy mirrors i18n.test.ts (MISSING_KEY as DictKey); keys: string[] avoids literal-union cast.
    const keys: string[] = [
      "modelSettings",
      "timeUnit",
      "unitYear",
      "unitMonth",
      "unitDay",
      "unitHour",
      "unitMinute",
      "unitSecond",
      "dimRevalidationPending",
    ];
    for (const k of keys) {
      const zh = t(k as DictKey, "zh");
      const en = t(k as DictKey, "en");
      // tier-3 fallback returns the key name itself -> key missing. green requires real translation.
      expect(zh).not.toBe(k);
      expect(en).not.toBe(k);
      expect(zh).not.toBe("");
      expect(en).not.toBe("");
    }
  });
});
