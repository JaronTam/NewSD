import { describe, expect, it } from "vitest";

// ---- 1a.4 red-phase imports (do NOT exist yet — TDD red state) ---------------
// formatFormulaForEditor is the display-side function that resolves @uuid refs
// to human-readable names and strips [单位] annotations from the editor view.
// createFlow constructs Flow domain objects, deriving units from toId stock +
// formula annotation. deriveFlowUnits computes the display units string.
import { formatFormulaForEditor } from "./formula";
import { createFlow, deriveFlowUnits } from "./store";
import { createElementStore } from "./store";
import type { Stock } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.4 red-phase — naming invariant & formula→editor round-trip (AC-5)
//
// The naming invariant (epics.md, ARCHITECTURE-SPINE §Naming不变量 L190):
//   "Formula internally stores @uuid references; display uses human-readable
//    names via formatFormulaForEditor."
//
// These tests verify that:
//   1. formatFormulaForEditor is idempotent (re-applying doesn't change output)
//   2. The naming invariant holds end-to-end: createFlow → formula stored with
//      @uuid → formatFormulaForEditor resolves names for display
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

// ---- Naming invariant: idempotency -------------------------------------------

describe("formatFormulaForEditor — idempotency (AC-5 naming invariant)", () => {
  it("is idempotent: applying formatFormulaForEditor twice yields the same result", () => {
    const nameMap = {
      "550e8400-e29b-41d4-a716-446655440000": "Population",
    };
    const first = formatFormulaForEditor(
      "@550e8400-e29b-41d4-a716-446655440000 * 0.05 [1/year]",
      nameMap,
    );
    const second = formatFormulaForEditor(first, nameMap);
    expect(second).toBe(first);
  });

  it("idempotent on plain formula with no @uuid or [单位]", () => {
    const first = formatFormulaForEditor("birthRate * Population", {});
    const second = formatFormulaForEditor(first, {});
    expect(second).toBe(first);
  });

  it("idempotent after [单位] already stripped", () => {
    const alreadyClean = "0.05 * Population";
    const result = formatFormulaForEditor(alreadyClean, {});
    expect(result).toBe(alreadyClean);
  });
});

// ---- Naming invariant: end-to-end --------------------------------------------

describe("naming invariant: formula ↔ editor round-trip (AC-5)", () => {
  it("Flow.formula stored as-is (may contain @uuid); display via formatFormulaForEditor", () => {
    // The naming invariant dictates that formula storage keeps @uuid refs.
    // formatFormulaForEditor is called at the editor boundary for display.
    const store = createElementStore();
    const s1 = seedStock(store, { id: "s1", name: "Pop" });
    const s2 = seedStock(store, { id: "s2", name: "GDP", units: "dollars" });

    const flow = createFlow(store, {
      fromId: s1.id,
      toId: s2.id,
      formula: "@550e8400-e29b-41d4-a716-446655440000 * 0.05",
      isVariable: false,
    });

    // The stored formula preserves the raw @uuid string
    expect(flow.formula).toContain("@");

    // formatFormulaForEditor resolves it for the UI
    const display = formatFormulaForEditor(flow.formula, {
      "550e8400-e29b-41d4-a716-446655440000": "Population",
    });
    expect(display).not.toContain("@");
    expect(display).toContain("Population");
  });

  it("rename of a stock propagates to formula display (late-resolve via name map)", () => {
    // When a stock is renamed, formatFormulaForEditor picks up the new name
    // because it resolves from the current name map each time.
    const displayOld = formatFormulaForEditor("@550e8400-e29b-41d4-a716-446655440000 * 0.05", {
      "550e8400-e29b-41d4-a716-446655440000": "OldName",
    });
    expect(displayOld).toBe("OldName * 0.05");

    const displayNew = formatFormulaForEditor("@550e8400-e29b-41d4-a716-446655440000 * 0.05", {
      "550e8400-e29b-41d4-a716-446655440000": "NewName",
    });
    expect(displayNew).toBe("NewName * 0.05");
    expect(displayNew).not.toBe(displayOld);
  });
});

// ---- deriveFlowUnits contract (re-verified at naming-invariant level) --------

describe("deriveFlowUnits — pure function contract (AC-3 carry)", () => {
  it("is a pure function (no side effects on the store)", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "dollars" });
    const elementsBefore = store.getElements().length;

    const units = deriveFlowUnits("rate [1/year]", s2.id, store.getElements());

    // No elements were added or removed
    expect(store.getElements().length).toBe(elementsBefore);
    expect(typeof units).toBe("string");
  });

  it("default /dt when no [单位] in formula", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "items" });
    expect(deriveFlowUnits("rate", s2.id, store.getElements())).toBe("items/dt");
  });

  it("[单位] annotation overrides time unit", () => {
    const store = createElementStore();
    const s2 = seedStock(store, { id: "s2", units: "items" });
    expect(deriveFlowUnits("0.05 [1/month]", s2.id, store.getElements())).toBe("items/month");
  });
});
