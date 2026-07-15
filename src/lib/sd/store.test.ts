import { describe, expect, it } from "vitest";

import { createElementStore, DEFAULT_STOCK_H, DEFAULT_STOCK_W, validateStockSize } from "./store";
import type { Stock } from "./types";

// Symbols imported from store for 1a.4 red-phase tests.
// These do NOT exist yet — the imports will fail at compile/load time,
// which is the expected TDD red state.
import { createFlow, deriveFlowUnits, flowCreateWarning } from "./store";

describe("validateStockSize — E9 guard (AC-8, AC-9)", () => {
  it("accepts positive finite dimensions", () => {
    const r = validateStockSize(10, 5);
    expect(r.ok).toBe(true);
    expect(r.width).toBe(10);
    expect(r.height).toBe(5);
  });

  it("rejects degenerate 1×1 (too small for box frame + interior text)", () => {
    const r = validateStockSize(1, 1);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("rejects 2×2 (still too small — w<3 || h<3)", () => {
    const r = validateStockSize(2, 2);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("accepts minimum legal size 3×3 (box frame + 1 interior row/col)", () => {
    const r = validateStockSize(3, 3);
    expect(r.ok).toBe(true);
    expect(r.width).toBe(3);
    expect(r.height).toBe(3);
  });

  it("rejects w<3 even when h is valid (e.g. 2×5)", () => {
    const r = validateStockSize(2, 5);
    expect(r.ok).toBe(false);
  });

  it("rejects h<3 even when w is valid (e.g. 5×2)", () => {
    const r = validateStockSize(5, 2);
    expect(r.ok).toBe(false);
  });

  it("rejects zero width", () => {
    const r = validateStockSize(0, 5);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("rejects zero height", () => {
    const r = validateStockSize(5, 0);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("rejects negative width", () => {
    const r = validateStockSize(-3, 5);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("rejects negative height", () => {
    const r = validateStockSize(5, -3);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("rejects NaN", () => {
    const r = validateStockSize(NaN, 5);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);

    const r2 = validateStockSize(5, NaN);
    expect(r2.ok).toBe(false);
  });

  it("rejects Infinity", () => {
    const r = validateStockSize(Infinity, 5);
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);

    const r2 = validateStockSize(5, -Infinity);
    expect(r2.ok).toBe(false);
  });

  it("rejects non-numeric strings (clamp to default)", () => {
    const r = validateStockSize("abc", "xyz");
    expect(r.ok).toBe(false);
    expect(r.width).toBe(DEFAULT_STOCK_W);
    expect(r.height).toBe(DEFAULT_STOCK_H);
  });

  it("accepts numeric strings that parse to valid values", () => {
    // Number("10") => 10, which is valid
    const r = validateStockSize("10", "5");
    expect(r.ok).toBe(true);
    expect(r.width).toBe(10);
    expect(r.height).toBe(5);
  });

  it("default constants are reasonable (≥ 4 per AC-8)", () => {
    expect(DEFAULT_STOCK_W).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_STOCK_H).toBeGreaterThanOrEqual(4);
  });
});

describe("createStock — E9 integration guard (AC-8, AC-9)", () => {
  it("clamps invalid (0, -2) width/height to defaults before storing", () => {
    const store = createElementStore();
    const stock = store.createStock({
      name: "X",
      x: 0,
      y: 0,
      width: 0,
      height: -2,
      initialValue: 1,
      units: "",
      allowNegative: false,
    });
    expect(stock.width).toBe(DEFAULT_STOCK_W);
    expect(stock.height).toBe(DEFAULT_STOCK_H);
    // Stored snapshot reflects the clamped values (not the raw input)
    const stored = store.getElements()[0];
    expect(stored.kind).toBe("stock");
    expect((stored as Stock).width).toBe(DEFAULT_STOCK_W);
    expect((stored as Stock).height).toBe(DEFAULT_STOCK_H);
  });

  it("clamps too-small 1×1 to defaults", () => {
    const store = createElementStore();
    const stock = store.createStock({
      name: "X",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      initialValue: 1,
      units: "",
      allowNegative: false,
    });
    expect(stock.width).toBe(DEFAULT_STOCK_W);
    expect(stock.height).toBe(DEFAULT_STOCK_H);
  });

  it("preserves valid dimensions (6×4) untouched", () => {
    const store = createElementStore();
    const stock = store.createStock({
      name: "X",
      x: 0,
      y: 0,
      width: 6,
      height: 4,
      initialValue: 1,
      units: "",
      allowNegative: false,
    });
    expect(stock.width).toBe(6);
    expect(stock.height).toBe(4);
    expect((store.getElements()[0] as Stock).width).toBe(6);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.4 red-phase tests — createFlow + guards + deriveFlowUnits
//
// These imports (createFlow, deriveFlowUnits) do NOT exist in store.ts yet.
// The import at the top of this file will cause a module load failure,
// which is the expected TDD red state. Once the symbols are implemented,
// these tests will run and verify the contracts below.
// ══════════════════════════════════════════════════════════════════════════════

function seedStock(
  store: ReturnType<typeof createElementStore>,
  overrides: Partial<Stock> & { name?: string } = {},
): Stock {
  return store.createStock({
    x: 0,
    y: 0,
    width: 8,
    height: 5,
    initialValue: 100,
    units: "people",
    allowNegative: false,
    ...overrides,
  } as Parameters<typeof store.createStock>[0]);
}

function seedCloud(
  store: ReturnType<typeof createElementStore>,
  overrides: { id?: string; x?: number; y?: number; name?: string } = {},
) {
  const cloud = store.createCloud({
    x: overrides.x ?? 20,
    y: overrides.y ?? 0,
    name: overrides.name,
  });
  if (overrides.id !== undefined) cloud.id = overrides.id;
  return cloud;
}

// ---- AC-1: createFlow 基础契约 -------------------------------------------------

describe("createFlow — basic contract (AC-1)", () => {
  it("creates a Flow with UUIDv4 id, kind:'flow', and all required fields", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1", name: "Pop" });
    const s2 = seedStock(store, { id: "s2", name: "GDP", units: "dollars" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "0.05 * Pop",
      isVariable: true,
    });

    expect(flow.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(flow.kind).toBe("flow");
    expect(flow.fromId).toBe(s1.id);
    expect(flow.toId).toBe(s2.id);
    expect(flow.formula).toBe("0.05 * Pop");
    expect(flow.isVariable).toBe(true);
    expect(flow.lastValue).toBe(0);
  });

  it("AC-1: Flow returned by createFlow includes derived `units` field", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2", units: "dollars" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "rate",
      isVariable: false,
    });

    // units is derived from toId stock units + time unit (/dt default)
    expect(typeof flow.units).toBe("string");
  });

  it("AC-1: flow is appended to the store's element list", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });

    createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false });
    const elements = store.getElements();
    const flows = elements.filter((e) => e.kind === "flow");
    expect(flows.length).toBe(1);
  });

  it("AC-1: optional `name` parameter is preserved", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "1",
      isVariable: false,
      name: "MyFlow",
    });
    expect(flow.name).toBe("MyFlow");
  });

  it("AC-1: default name is generated when name is omitted", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "1",
      isVariable: false,
    });
    // A default name of some form is provided (non-empty string)
    expect(typeof flow.name).toBe("string");
    expect(flow.name.length).toBeGreaterThan(0);
  });
});

// ---- AC-3: deriveFlowUnits ---------------------------------------------------

describe("deriveFlowUnits (AC-3)", () => {
  it("default time unit is /dt when formula has no [单位] annotation", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "people" });
    const elements = store.getElements();

    const units = deriveFlowUnits("rate", s2.id, elements);
    expect(units).toBe("people/dt");
  });

  it("time unit is overwritten by formula [单位] annotation", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "people" });
    const elements = store.getElements();

    const units = deriveFlowUnits("0.05 [1/year]", s2.id, elements);
    expect(units).toBe("people/year");
  });

  it("returns empty string when toId points to a cloud (infinite capacity, no units)", () => {
    const store = createElementStore();
    const c = seedCloud(store, { x: 20, y: 0 });
    const elements = store.getElements();

    const units = deriveFlowUnits("0.05 [1/year]", c.id, elements);
    expect(units).toBe("");
  });

  it("returns empty string when toId does not exist", () => {
    const store = createElementStore();
    const elements = store.getElements();

    const units = deriveFlowUnits("rate", "nonexistent-id", elements);
    expect(units).toBe("");
  });

  it("cloud fallback is empty string regardless of [单位] annotation", () => {
    const store = createElementStore();
    const c = seedCloud(store, { x: 20, y: 0 });
    const elements = store.getElements();

    // Even with [单位] annotation, cloud target → empty string
    const units = deriveFlowUnits("0.05 [1/year]", c.id, elements);
    expect(units).toBe("");
  });

  it("stock with empty units string still gets /dt appended", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "" });
    const elements = store.getElements();

    const units = deriveFlowUnits("rate", s2.id, elements);
    expect(units).toBe("/dt");
  });
});

// ---- AC-12: E3 self-loop guard ------------------------------------------------

describe("createFlow — E3 self-loop guard (AC-12)", () => {
  it("rejects self-loop (fromId === toId) with throw", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });

    expect(() =>
      createFlow(store, { fromId: s1.id, toId: s1.id, formula: "1", isVariable: false }),
    ).toThrow("Self-loop not allowed");
  });
});

// ---- AC-12b: endpoint validity guard ------------------------------------------

describe("createFlow — endpoint validity guard (AC-12b)", () => {
  it("rejects when fromId points to a non-existent element", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2" });

    expect(() =>
      createFlow(store, { fromId: "nonexistent", toId: s2.id, formula: "1", isVariable: false }),
    ).toThrow("Invalid flow endpoint");
  });

  it("rejects when toId points to a non-existent element", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });

    expect(() =>
      createFlow(store, { fromId: s1.id, toId: "nonexistent", formula: "1", isVariable: false }),
    ).toThrow("Invalid flow endpoint");
  });

  it("rejects Flow→Flow connection (fromId points to a flow)", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const f1 = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false });
    const s3 = seedStock(store, { id: "s3" });

    expect(() =>
      createFlow(store, { fromId: f1.id, toId: s3.id, formula: "1", isVariable: false }),
    ).toThrow("Invalid flow endpoint");
  });

  it("rejects Flow→Flow connection (toId points to a flow)", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const f1 = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false });
    const s3 = seedStock(store, { id: "s3" });

    expect(() =>
      createFlow(store, { fromId: s3.id, toId: f1.id, formula: "1", isVariable: false }),
    ).toThrow("Invalid flow endpoint");
  });

  it("endpoint validity check runs before self-loop check", () => {
    const store = createElementStore();

    // fromId nonexistent AND fromId === toId (both nonexistent)
    // The guard sequence is: ① endpoint validity → ② self-loop.
    // So this should throw "Invalid flow endpoint", not "Self-loop not allowed".
    expect(() =>
      createFlow(store, { fromId: "ghost", toId: "ghost", formula: "1", isVariable: false }),
    ).toThrow("Invalid flow endpoint");
  });
});

// ---- AC-13: E10 orphan cloud — allow -----------------------------------------

describe("createFlow — orphan cloud allowed (AC-13, E10)", () => {
  it("cloud without any attached flow is allowed to exist", () => {
    const store = createElementStore();
    const c = seedCloud(store, { x: 0, y: 0 });
    const elements = store.getElements();

    // orphan cloud is in the store and is valid
    expect(elements.find((e) => e.id === c.id)).toBeDefined();
  });

  it("creating a flow does not reject because a different cloud is orphan", () => {
    const store = createElementStore();
    seedCloud(store, { x: 0, y: 0 }); // orphan cloud
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });

    // Creating a flow unrelated to the orphan cloud succeeds
    const flow = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false });
    expect(flow.kind).toBe("flow");
  });
});

// ---- AC-14: E11 parallel flows — allow + warn ---------------------------------

describe("createFlow — E11 parallel flows (AC-14)", () => {
  it("allows two flows with the same fromId/toId pair", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });

    const f1 = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "a", isVariable: false });
    const f2 = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "b", isVariable: true });

    expect(f1.kind).toBe("flow");
    expect(f2.kind).toBe("flow");
    expect(f1.id).not.toBe(f2.id);
  });
});

// ---- AC-15: 重名硬拒绝 — duplicate names REJECTED (SDR#4 rewired) ---------------

describe("createFlow — duplicate name REJECTED (AC-15 rewired per SDR#4)", () => {
  it("rejects second flow with duplicate explicit name", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const s3 = seedStock(store, { id: "s3" });

    createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "a",
      isVariable: false,
      name: "FlowX",
    });
    // Second flow with same explicit name MUST throw (SDR#4 hard-reject).
    expect(() =>
      createFlow(store, {
        fromId: s1.id,
        toId: s3.id,
        formula: "b",
        isVariable: true,
        name: "FlowX",
      }),
    ).toThrow();
    // Only the first flow exists in store.
    const flows = store.getElements().filter((e) => e.kind === "flow");
    expect(flows.length).toBe(1);
  });

  it("rejects a flow with the same name as an existing stock", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1", name: "DuplicateName" });
    const s2 = seedStock(store, { id: "s2" });

    // Name collision between stock and flow is now hard-rejected (SDR#1 single namespace).
    expect(() =>
      createFlow(store, {
        fromId: s1.id,
        toId: s2.id,
        formula: "1",
        isVariable: false,
        name: "DuplicateName",
      }),
    ).toThrow();
    // Only stock exists — flow was never created.
    const names = store
      .getElements()
      .map((e) => (e as { name?: string }).name)
      .filter(Boolean);
    expect(names.filter((n) => n === "DuplicateName").length).toBe(1);
  });
});

// ---- F3: non-blocking warn callback (E11 parallel / AC-15 dup name) -----------

describe("createFlow — F3 onWarn callback + flowCreateWarning", () => {
  it("flowCreateWarning returns null for a clean flow (no parallel, no dup name)", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const warn = flowCreateWarning(store.getElements(), {
      fromId: s1.id,
      toId: s2.id,
      formula: "1",
      isVariable: false,
    });
    expect(warn).toBeNull();
  });

  it("flowCreateWarning returns a parallel-flow warning (E11) for a duplicate fromId→toId pair", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "a",
      isVariable: false,
      name: "first",
    });
    const warn = flowCreateWarning(store.getElements(), {
      fromId: s1.id,
      toId: s2.id,
      formula: "b",
      isVariable: true,
    });
    expect(warn).not.toBeNull();
    expect(warn).toContain("Parallel");
  });

  it("flowCreateWarning returns null for duplicate name (AC-15 rewired per SDR#4)", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const s3 = seedStock(store, { id: "s3" });
    createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "a",
      isVariable: false,
      name: "FlowX",
    });
    // Dup-name gate removed; collision is hard-rejected at create-time.
    // flowCreateWarning no longer returns a dup-name string.
    const warn = flowCreateWarning(store.getElements(), {
      fromId: s1.id,
      toId: s3.id,
      formula: "b",
      isVariable: true,
      name: "FlowX",
    });
    expect(warn).toBeNull();
  });

  it("createFlow invokes onWarn with null when the flow is clean", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    let captured: string | null | undefined;
    createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false }, (msg) => {
      captured = msg;
    });
    expect(captured).toBeNull();
  });

  it("createFlow invokes onWarn with a parallel-flow warning (E11)", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    createFlow(store, { fromId: s1.id, toId: s2.id, formula: "a", isVariable: false });
    let captured: string | null | undefined;
    createFlow(store, { fromId: s1.id, toId: s2.id, formula: "b", isVariable: true }, (msg) => {
      captured = msg;
    });
    expect(captured).not.toBeNull();
    expect(captured).toContain("Parallel");
  });

  it("createFlow does NOT invoke onWarn when it throws (invalid endpoint)", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2" });
    let called = false;
    expect(() =>
      createFlow(store, { fromId: "ghost", toId: s2.id, formula: "1", isVariable: false }, () => {
        called = true;
      }),
    ).toThrow();
    expect(called).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.11 图元命名机制 — RED PHASE SCAFFOLDS
//
// All tests below are marked `it.skip(...)` (red phase, TDD RED).
// DS activates them in step 5 (T1..T9) as the corresponding SDR contracts land.
// Each test header declares gov: `AC-N + SDR#M + T-K` per story traceability.
//
// Product code MUST NOT be touched in ATDD scaffold phase — these tests are
// authored against the target API surface (createStock({name?}), auto-name
// contracts, assertNameAvailable, deriveSeq(kind), single-namespace uniqueness).
// The imports at file head do not yet expose that API; DS will extend store.ts.
// ══════════════════════════════════════════════════════════════════════════════

// Helpers for load-path seeds — bypass factory validations by using setElements
// directly with prebuilt element shapes. Used by AC-4b / AC-16 / AC-17.
function stockShape(id: string, name: string): Stock {
  return {
    id,
    kind: "stock",
    name,
    x: 0,
    y: 0,
    width: 8,
    height: 5,
    initialValue: 0,
    currentValue: 0,
    units: "",
    allowNegative: false,
    history: [0],
  } as Stock;
}

function cloudShape(id: string, name: string) {
  return {
    id,
    kind: "cloud" as const,
    name,
    x: 0,
    y: 0,
  };
}

// ---- AC-1: 显式撞名跨类型拒绝 (SDR#1 / T3) ----------------------------------

describe("1a.11 AC-1: assertNameAvailable — 显式撞名拒绝", () => {
  it("createCloud 显式撞已有 stock name → throw + store 未新增", () => {
    // gov: AC-1 + SDR#1 + T3
    const store = createElementStore();
    seedStock(store, { name: "A" });
    const countBefore = store.getElements().length;
    expect(() => store.createCloud({ x: 20, y: 0, name: "A" })).toThrow();
    // Ensure the failed create did not partially write
    expect(store.getElements().length).toBe(countBefore);
  });
});

// ---- AC-2: create-path seq monotonic (SDR#2 + #3 / T1) ---------------------

describe("1a.11 AC-2: createStock auto-name 单调递增", () => {
  it("空 store 连续 3 次 createStock (name undefined) → stock_1/stock_2/stock_3", () => {
    // gov: AC-2 + SDR#2 + SDR#3 + T1
    const store = createElementStore();
    // Casting is intentional: DS will loosen the createStock Omit<> to make name optional.
    const s1 = store.createStock({
      x: 0,
      y: 0,
      width: 8,
      height: 5,
      initialValue: 0,
      units: "",
      allowNegative: false,
    } as unknown as Parameters<typeof store.createStock>[0]);
    const s2 = store.createStock({
      x: 0,
      y: 0,
      width: 8,
      height: 5,
      initialValue: 0,
      units: "",
      allowNegative: false,
    } as unknown as Parameters<typeof store.createStock>[0]);
    const s3 = store.createStock({
      x: 0,
      y: 0,
      width: 8,
      height: 5,
      initialValue: 0,
      units: "",
      allowNegative: false,
    } as unknown as Parameters<typeof store.createStock>[0]);
    expect([s1.name, s2.name, s3.name]).toEqual(["stock_1", "stock_2", "stock_3"]);
  });
});

// ---- AC-3: cloud_1 / flow_1 首次自动名 (SDR#3 / T1) ------------------------

describe("1a.11 AC-3: createCloud/createFlow 首次自动命名", () => {
  it("空 store createCloud (name undefined) → cloud_1", () => {
    // gov: AC-3 + SDR#3 + T1
    const store = createElementStore();
    const c = store.createCloud({ x: 20, y: 0 });
    expect(c.name).toBe("cloud_1");
  });

  it("空 store createFlow (name undefined) → flow_1 (不再是 'Flow 1')", () => {
    // gov: AC-3 + SDR#3 + T1
    const store = createElementStore();
    const s1 = seedStock(store, { name: "src" });
    const s2 = seedStock(store, { name: "dst" });
    const f = createFlow(store, { fromId: s1.id, toId: s2.id, formula: "1", isVariable: false });
    expect(f.name).toBe("flow_1");
    expect(f.name).not.toMatch(/^Flow /);
  });
});

// ---- AC-4a: 删除后 create-path 不复用 (SDR#2 + #12 / T2) --------------------

describe("1a.11 AC-4a: delete → createStock 计数器不复用", () => {
  it("seq=3 delete stock_3 后 createStock → stock_4 (create 路径不复用)", () => {
    // gov: AC-4a + SDR#2 + SDR#12 + T2
    const store = createElementStore();
    const s1 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const s2 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const s3 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    void s1;
    void s2;
    store.deleteElement(s3.id);
    const s4 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s4.name).toBe("stock_4");
    expect(s4.name).not.toBe("stock_3");
  });
});

// ---- AC-4b: setElements 载入推导 (SDR#2 load 路径 / T2) --------------------

describe("1a.11 AC-4b: setElements → deriveSeq 载入承接", () => {
  it("setElements([stock_1, stock_5]) + createStock → stock_6", () => {
    // gov: AC-4b + SDR#2 + T2
    const store = createElementStore();
    store.setElements([stockShape("id-1", "stock_1"), stockShape("id-5", "stock_5")]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s.name).toBe("stock_6");
  });
});

// ---- AC-4c: setElements 空数组 → seq 归 0 (SDR#2 / T2) ---------------------

describe("1a.11 AC-4c: setElements([]) → seq 归 0", () => {
  it("setElements([]) + createStock → stock_1 (归 0)", () => {
    // gov: AC-4c + SDR#2 + T2
    const store = createElementStore();
    // First seed then wipe to prove seq is derived from current elements, not history.
    store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    store.setElements([]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s.name).toBe("stock_1");
  });
});

// ---- AC-5: updateElement 撞名拒绝 (SDR#4 / T3) ----------------------------

describe("1a.11 AC-5: updateElement 撞名拒绝", () => {
  it("stock A + stock B, updateElement(B,{name:'A'}) → throw + B.name 仍 'B'", () => {
    // gov: AC-5 + SDR#4 + T3
    const store = createElementStore();
    const a = seedStock(store, { name: "A" });
    const b = seedStock(store, { name: "B" });
    void a;
    // before
    expect((store.getElements().find((e) => e.id === b.id) as Stock).name).toBe("B");
    // action
    expect(() => store.updateElement(b.id, { name: "A" } as Partial<Stock>)).toThrow();
    // after — anti-anchor: not "A"
    const after = store.getElements().find((e) => e.id === b.id) as Stock;
    expect(after.name).toBe("B");
    expect(after.name).not.toBe("A");
  });
});

// ---- AC-6: rename → id 不变 + 公式预览联动 (SDR#6 / T5) ---------------------

describe("1a.11 AC-6: rename id 稳定 + 公式预览联动", () => {
  it("stock 'A'(s1) + flow @s1 → rename s1→'C' → id 不变 + preview='C'", async () => {
    // gov: AC-6 + SDR#6 + T5
    const { formatFormulaForEditor } = await import("./formula");
    const store = createElementStore();
    const s1 = seedStock(store, { name: "A" });
    const s2 = seedStock(store, { name: "sink" });
    const idBefore = s1.id;
    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: `0.05 * @${s1.id}`,
      isVariable: true,
    });
    // action: rename
    store.updateElement(s1.id, { name: "C" } as Partial<Stock>);
    const afterS1 = store.getElements().find((e) => e.id === idBefore) as Stock;
    // id unchanged
    expect(afterS1.id).toBe(idBefore);
    // name preview reflects new name
    const nameMap: Record<string, string> = {};
    for (const el of store.getElements()) if ("name" in el && el.name) nameMap[el.id] = el.name;
    const preview = formatFormulaForEditor(flow.formula, nameMap);
    expect(preview).toContain("C");
    expect(preview).not.toContain("A");
  });
});

// ---- AC-8: 跨类型 flow×stock 显式撞名 (SDR#1 / T3) --------------------------

describe("1a.11 AC-8: 跨类型 flow×stock 显式撞名拒绝", () => {
  it("flow 'X' 存在 + createStock 显式 'X' → throw", () => {
    // gov: AC-8 + SDR#1 + T3
    const store = createElementStore();
    const s1 = seedStock(store, { name: "src" });
    const s2 = seedStock(store, { name: "dst" });
    createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "1",
      isVariable: false,
      name: "X",
    });
    expect(() => seedStock(store, { name: "X" })).toThrow();
  });
});

// ---- AC-9: cloud auto-name 非 undefined (SDR#5 / T1) ------------------------

describe("1a.11 AC-9: Cloud.name 必为 string", () => {
  it("createCloud 无 name → Cloud.name === 'cloud_1' (非 undefined)", () => {
    // gov: AC-9 + SDR#5 + T1
    const store = createElementStore();
    const c = store.createCloud({ x: 0, y: 0 });
    expect(typeof c.name).toBe("string");
    expect(c.name).toBe("cloud_1");
  });
});

// ---- AC-10: 连续 create 单调 (paste 契约代理 SDR#7 / T7) --------------------

describe("1a.11 AC-10: 连续 createStock 单调递增", () => {
  it("createStock 连续 5 次无 name → stock_1..stock_5 数组精确等于", () => {
    // gov: AC-10 + SDR#7 + T7 (paste 契约代理)
    const store = createElementStore();
    const names: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
      names.push(s.name);
    }
    expect(names).toEqual(["stock_1", "stock_2", "stock_3", "stock_4", "stock_5"]);
  });
});

// ---- AC-11: flowCreateWarning 撞名分支移除 (SDR#4 / T4) ---------------------

describe("1a.11 AC-11: flowCreateWarning 撞名 → null", () => {
  it("flowCreateWarning(撞名 input) → null (非 'Duplicate flow name')", () => {
    // gov: AC-11 + SDR#4 + T4
    const store = createElementStore();
    const s1 = seedStock(store, { name: "src" });
    const s2 = seedStock(store, { name: "mid" });
    const s3 = seedStock(store, { name: "dst" });
    createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "a",
      isVariable: false,
      name: "FlowX",
    });
    // Same-name second flow (different endpoint pair) — post-1a.11 the
    // dup-name warning branch is REMOVED (hard-reject at create-time instead).
    const warn = flowCreateWarning(store.getElements(), {
      fromId: s1.id,
      toId: s3.id,
      formula: "b",
      isVariable: true,
      name: "FlowX",
    });
    expect(warn).toBeNull();
    // Cross-check: no legacy "Duplicate flow name" substring leaks through.
    expect(warn ?? "").not.toContain("Duplicate flow name");
  });
});

// ---- AC-14a: 空名 createStock 拒绝 (SDR#11 / T3) ----------------------------

describe("1a.11 AC-14a: 空名 createStock 拒绝", () => {
  it("createStock({name:''}) → throw", () => {
    // gov: AC-14a + SDR#11 + T3
    const store = createElementStore();
    expect(() =>
      store.createStock({
        name: "",
        x: 0,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 0,
        units: "",
        allowNegative: false,
      } as unknown as Parameters<typeof store.createStock>[0]),
    ).toThrow();
  });
});

// ---- AC-14b: 空白名 updateElement 拒绝 + 原名保留 (SDR#11 / T3) -------------

describe("1a.11 AC-14b: 空白名 updateElement 拒绝", () => {
  it("updateElement(id,{name:'   '}) → throw + 原名保留", () => {
    // gov: AC-14b + SDR#11 + T3
    const store = createElementStore();
    const s = seedStock(store, { name: "keep" });
    // before
    expect((store.getElements().find((e) => e.id === s.id) as Stock).name).toBe("keep");
    // action
    expect(() => store.updateElement(s.id, { name: "   " } as Partial<Stock>)).toThrow();
    // after — anti-anchor: original name preserved
    const after = store.getElements().find((e) => e.id === s.id) as Stock;
    expect(after.name).toBe("keep");
    expect(after.name).not.toBe("   ");
  });
});

// ---- AC-16a: 载入推导跨类型混合 (SDR#2 + #13 / T2) --------------------------

describe("1a.11 AC-16a: setElements 混合载入 + create 三类新元素", () => {
  it("setElements([stock_7, stock_2, cloud_3]) → new stock=stock_8, cloud=cloud_4, flow=flow_1", () => {
    // gov: AC-16a + SDR#2 + SDR#13 + T2
    const store = createElementStore();
    store.setElements([
      stockShape("s-7", "stock_7"),
      stockShape("s-2", "stock_2"),
      cloudShape("c-3", "cloud_3"),
    ]);
    const newStock = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const newCloud = store.createCloud({ x: 0, y: 0 });
    const newFlow = createFlow(store, {
      fromId: "s-7",
      toId: "s-2",
      formula: "1",
      isVariable: false,
    });
    expect(newStock.name).toBe("stock_8");
    expect(newCloud.name).toBe("cloud_4");
    expect(newFlow.name).toBe("flow_1");
  });
});

// ---- AC-16b: setElements 全量替换语义 (SDR#13 / T2) -------------------------

describe("1a.11 AC-16b: setElements 全量替换 seq 不累加", () => {
  it("setElements 二次调用 → seq 从新元素推导 (不叠加旧 seq)", () => {
    // gov: AC-16b + SDR#13 + T2
    const store = createElementStore();
    // First set: seq should be 5.
    store.setElements([stockShape("id-5", "stock_5")]);
    // Second set: only stock_2 remains. seq must be derived from THIS array, not accumulated.
    store.setElements([stockShape("id-2", "stock_2")]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s.name).toBe("stock_3");
    expect(s.name).not.toBe("stock_6"); // anti-anchor: prior 5 must not leak
  });
});

// ---- AC-17a: deriveSeq 正则忽略非匹配名 (SDR#2 / T2) ------------------------

describe("1a.11 AC-17a: deriveSeq 只识别 canonical 名", () => {
  it("setElements 含 '营收'/'stock_9x'/'my_stock_3'/'stock_5' → createStock → stock_6", () => {
    // gov: AC-17a + SDR#2 + T2
    const store = createElementStore();
    store.setElements([
      stockShape("id-a", "营收"),
      stockShape("id-b", "stock_9x"),
      stockShape("id-c", "my_stock_3"),
      stockShape("id-d", "stock_5"),
    ]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    // Only "stock_5" is canonical (双端锚定 ^stock_\d+$); seq derives from 5.
    expect(s.name).toBe("stock_6");
  });
});

// ---- AC-17b: 溢出边界 (SDR#2 / T2) ------------------------------------------

describe("1a.11 AC-17b: MAX_SAFE_INTEGER 溢出 guard", () => {
  it("setElements 含 'stock_99999999999999999999' → deriveSeq 跳过 → createStock 不 NaN/Infinity", () => {
    // gov: AC-17b + SDR#2 + T2
    const store = createElementStore();
    store.setElements([stockShape("id-big", "stock_99999999999999999999")]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    // Overflow token skipped → seq=0 → stock_1.
    expect(s.name).toMatch(/^stock_\d+$/);
    expect(s.name).toBe("stock_1");
    expect(s.name).not.toContain("NaN");
    expect(s.name).not.toContain("Infinity");
  });
});

// ---- AC-17c: 正则双端锚定 (SDR#2 / T2) --------------------------------------

describe("1a.11 AC-17c: 双端锚定正则", () => {
  it("setElements(['my_stock_1']) → stockSeq=0 → createStock → stock_1", () => {
    // gov: AC-17c + SDR#2 + T2
    const store = createElementStore();
    store.setElements([stockShape("id-my", "my_stock_1")]);
    const s = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s.name).toBe("stock_1"); // prefix "my_" must NOT match ^stock_\d+$
  });
});

// ---- AC-18: nextDefaultName skip-forward (SDR#14 / T2) ---------------------

describe("1a.11 AC-18: auto-name skip-forward on rename-to-canonical", () => {
  it("rename stock_2 → 'stock_5', then createStock ×3 skips 'stock_5' → stock_3, stock_4, stock_6", () => {
    // gov: AC-18 + SDR#14 + T2
    const store = createElementStore();
    const s1 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const s2 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s1.name).toBe("stock_1");
    expect(s2.name).toBe("stock_2");

    // Rename s2 to a future canonical form.
    store.updateElement(s2.id, { name: "stock_5" });

    // Subsequent auto-names must skip "stock_5" — no throw, no collision.
    const s3 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const s4 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    const s5 = store.createStock({} as unknown as Parameters<typeof store.createStock>[0]);
    expect(s3.name).toBe("stock_3");
    expect(s4.name).toBe("stock_4");
    expect(s5.name).toBe("stock_6"); // stock_5 skipped (occupied)

    // All names remain globally unique (SDR#1).
    const names = store.getElements().map((e) => (e as { name?: string }).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("cloud and flow skip-forward independently", () => {
    // gov: AC-18 + SDR#14 + T2
    const store = createElementStore();
    const c1 = store.createCloud({ x: 0, y: 0 });
    store.updateElement(c1.id, { name: "cloud_3" });
    const c2 = store.createCloud({ x: 1, y: 1 });
    const c3 = store.createCloud({ x: 2, y: 2 });
    expect(c2.name).toBe("cloud_2");
    expect(c3.name).toBe("cloud_4"); // cloud_3 skipped
  });
});

// ---- AC-19: updateElement non-string name rejection (SDR#11 / T3) ----------

describe("1a.11 AC-19: updateElement rejects non-string name", () => {
  it("updateElement(id, { name: undefined }) throws + original name preserved", () => {
    // gov: AC-19 + SDR#11 + T3
    const store = createElementStore();
    const s = store.createStock({
      name: "A",
    } as unknown as Parameters<typeof store.createStock>[0]);
    expect(() =>
      store.updateElement(s.id, { name: undefined } as unknown as Partial<typeof s>),
    ).toThrow(/must be a string/i);
    const after = store.getElements().find((e) => e.id === s.id);
    expect((after as { name?: string })?.name).toBe("A");
  });

  it("updateElement(id, { name: null }) throws + original name preserved", () => {
    // gov: AC-19 + SDR#11 + T3
    const store = createElementStore();
    const s = store.createStock({
      name: "B",
    } as unknown as Parameters<typeof store.createStock>[0]);
    expect(() => store.updateElement(s.id, { name: null } as unknown as Partial<typeof s>)).toThrow(
      /must be a string/i,
    );
    const after = store.getElements().find((e) => e.id === s.id);
    expect((after as { name?: string })?.name).toBe("B");
  });

  it("updateElement(id, { name: 42 }) throws + original name preserved", () => {
    // gov: AC-19 + SDR#11 + T3
    const store = createElementStore();
    const s = store.createStock({
      name: "C",
    } as unknown as Parameters<typeof store.createStock>[0]);
    expect(() => store.updateElement(s.id, { name: 42 } as unknown as Partial<typeof s>)).toThrow(
      /must be a string/i,
    );
    const after = store.getElements().find((e) => e.id === s.id);
    expect((after as { name?: string })?.name).toBe("C");
  });
});
