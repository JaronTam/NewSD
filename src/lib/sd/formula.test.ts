import { describe, expect, it } from "vitest";

import { evalFormula } from "./formula";

// Guards the carried formula parser (recursive-descent, no eval). The CJK
// identifier case (`一-鿿` range) is the byte we most needed to preserve across
// the prototype carry — if it regresses, the population-growth model breaks.
describe("evalFormula", () => {
  it("evaluates arithmetic", () => {
    expect(evalFormula("1 + 2 * 3", {})).toBe(7);
    expect(evalFormula("(1 + 2) * 3", {})).toBe(9);
    expect(evalFormula("10 / 4", {})).toBe(2.5);
  });

  it("resolves names from env", () => {
    expect(evalFormula("a + b", { a: 2, b: 3 })).toBe(5);
    expect(evalFormula("-a", { a: 4 })).toBe(-4);
  });

  it("supports CJK identifiers", () => {
    expect(evalFormula("人口 * 0.05", { 人口: 1000 })).toBe(50);
    expect(evalFormula("出生率 - 死亡率", { 出生率: 0.02, 死亡率: 0.01 })).toBe(0.01);
  });

  it("throws on unknown names", () => {
    expect(() => evalFormula("x + 1", {})).toThrow();
  });

  it("throws on non-finite results", () => {
    expect(() => evalFormula("1 / 0", {})).toThrow();
  });
});
