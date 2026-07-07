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
  overrides: Partial<Stock> = {},
): Stock {
  return store.createStock({
    name: "TestStock",
    x: 0,
    y: 0,
    width: 8,
    height: 5,
    initialValue: 100,
    units: "people",
    allowNegative: false,
    ...overrides,
  });
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

// ---- AC-15: 重名软警告 — allow duplicate names ---------------------------------

describe("createFlow — duplicate name allowed (AC-15)", () => {
  it("allows two flows with the same name", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1" });
    const s2 = seedStock(store, { id: "s2" });
    const s3 = seedStock(store, { id: "s3" });

    const f1 = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "a",
      isVariable: false,
      name: "FlowX",
    });
    const f2 = createFlow(store, {
      fromId: s1.id,
      toId: s3.id,
      formula: "b",
      isVariable: true,
      name: "FlowX",
    });

    expect(f1.name).toBe("FlowX");
    expect(f2.name).toBe("FlowX");
    // Both exist in store
    const flows = store.getElements().filter((e) => e.kind === "flow");
    expect(flows.length).toBe(2);
  });

  it("allows a flow with the same name as an existing stock", () => {
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1", name: "DuplicateName" });
    const s2 = seedStock(store, { id: "s2" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "1",
      isVariable: false,
      name: "DuplicateName",
    });
    // Name collision between stock and flow is allowed
    expect(flow.name).toBe("DuplicateName");
    const names = store
      .getElements()
      .map((e) => ("name" in e ? (e as Stock).name : (e as { name?: string }).name));
    expect(names.filter((n) => n === "DuplicateName").length).toBe(2);
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

  it("flowCreateWarning returns a duplicate-name warning (AC-15)", () => {
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
    const warn = flowCreateWarning(store.getElements(), {
      fromId: s1.id,
      toId: s3.id,
      formula: "b",
      isVariable: true,
      name: "FlowX",
    });
    expect(warn).not.toBeNull();
    expect(warn).toContain("Duplicate flow name");
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
