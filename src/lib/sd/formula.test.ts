import { describe, expect, it } from "vitest";

import { evalFormula } from "./formula";

// ---- 1a.4 red-phase imports (do NOT exist yet — TDD red state) ---------------
import { formatFormulaForEditor } from "./formula";

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

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.4 red-phase — @uuid refs + [单位] annotations (AC-4)
//
// The tokenizer must be extended to recognise:
//   1. @uuid references — e.g. @550e8400-e29b-41d4-a716-446655440000
//   2. [单位] annotations — e.g. [1/year], [people]
//
// These are new token types that do not exist yet; evalFormula must be taught
// to resolve @uuid refs from an element map and skip [单位] annotations.
// ══════════════════════════════════════════════════════════════════════════════

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("evalFormula — @uuid references (AC-4)", () => {
  it("recognises @uuid as a valid token (not 'Unexpected character @')", () => {
    // The tokenizer currently throws on '@' — after AC-4 it must tokenise @uuid.
    // Red: this will throw "Unexpected '@'" until the tokenizer is extended.
    expect(() => evalFormula(`@${SAMPLE_UUID}`, {})).not.toThrow("Unexpected");
  });

  it("resolves @uuid from an element-name map", () => {
    // @uuid resolves to the current value of the referenced element.
    // Red: "Unknown name" until evalFormula learns to look up @uuid refs.
    const env = { [`@${SAMPLE_UUID}`]: 42 };
    const result = evalFormula(`@${SAMPLE_UUID}`, env);
    expect(result).toBe(42);
  });

  it("@uuid in an arithmetic expression evaluates correctly", () => {
    const env = {
      [`@${SAMPLE_UUID}`]: 100,
      [`@bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`]: 50,
    };
    expect(evalFormula(`@${SAMPLE_UUID} + 1`, env)).toBe(101);
    expect(evalFormula(`@${SAMPLE_UUID} + @bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, env)).toBe(150);
  });

  it("throws when @uuid ref is not in the env", () => {
    expect(() => evalFormula(`@${SAMPLE_UUID}`, {})).toThrow();
  });
});

describe("evalFormula — [单位] annotation skipping (AC-4)", () => {
  it("skips [1/year] annotation during evaluation (treated as whitespace)", () => {
    // [1/year] is a unit-time annotation, not an arithmetic token.
    // The parser must skip it, treating it as a no-op.
    expect(evalFormula("rate [1/year]", { rate: 0.05 })).toBe(0.05);
  });

  it("skips [单位] annotation mid-expression", () => {
    // "[people]" in "0.05 * Population [people]" must be skipped.
    expect(evalFormula("0.05 * Population [people]", { Population: 1000 })).toBe(50);
  });

  it("skips annotation containing CJK characters", () => {
    expect(evalFormula("rate [人/年]", { rate: 0.03 })).toBe(0.03);
  });

  it("skips annotation containing digits and slashes", () => {
    expect(evalFormula("flow [1/dt]", { flow: 10 })).toBe(10);
  });

  it("annotation at start of formula is a no-op", () => {
    expect(evalFormula("[1/year] 0.05 * Pop", { Pop: 1000 })).toBe(50);
  });

  it("multiple annotations in one formula are all skipped", () => {
    expect(
      evalFormula("rate [1/year] + bonus [people/yr]", { rate: 0.05, bonus: 0.01 }),
    ).toBeCloseTo(0.06);
  });
});

describe("evalFormula — CJK regression guard (AC-4 carry)", () => {
  it("CJK identifiers still work alongside @uuid and [单位]", () => {
    // The @uuid and [单位] extensions must not break CJK identifier support.
    const env = { 人口: 1000, [`@${SAMPLE_UUID}`]: 50 };
    expect(evalFormula(`人口 * 0.05 + @${SAMPLE_UUID}`, env)).toBe(100);
  });

  it("CJK identifiers with annotations evaluate correctly", () => {
    expect(evalFormula("出生率 [1/year] - 死亡率 [1/year]", { 出生率: 0.02, 死亡率: 0.01 })).toBe(
      0.01,
    );
  });

  it("CJK identifier spanning the full 一-鿿 range", () => {
    // Boundary CJK chars: 一 (U+4E00) and 鿿 (U+9FFF)
    expect(evalFormula("一 + 鿿", { 一: 1, 鿿: 9 })).toBe(10);
  });
});

// ---- AC-5: formatFormulaForEditor -------------------------------------------

describe("formatFormulaForEditor (AC-5)", () => {
  it("resolves @uuid to element name for display", () => {
    // The editor shows human-readable names, not raw @uuid strings.
    // formatFormulaForEditor replaces @uuid refs with their current names.
    const result = formatFormulaForEditor(`@${SAMPLE_UUID} * 0.05`, {
      [SAMPLE_UUID]: "Population",
    });
    expect(result).toBe("Population * 0.05");
  });

  it("strips [单位] annotations from the display string", () => {
    const result = formatFormulaForEditor("0.05 * Population [people]", {});
    expect(result).toBe("0.05 * Population");
  });

  it("both resolves @uuid AND strips [单位] in a single pass", () => {
    const result = formatFormulaForEditor(`@${SAMPLE_UUID} * 0.05 [1/year]`, {
      [SAMPLE_UUID]: "Population",
    });
    expect(result).toBe("Population * 0.05");
  });

  it("passes through plain formulas unchanged", () => {
    const result = formatFormulaForEditor("birthRate * Population", {});
    expect(result).toBe("birthRate * Population");
  });

  it("handles unknown @uuid gracefully (keeps raw @uuid)", () => {
    // If the name map doesn't contain the uuid, keep the raw @uuid for safety.
    const result = formatFormulaForEditor(`@${SAMPLE_UUID}`, {});
    expect(result).toContain(SAMPLE_UUID);
  });

  it("handles empty formula string", () => {
    expect(formatFormulaForEditor("", {})).toBe("");
  });
});
