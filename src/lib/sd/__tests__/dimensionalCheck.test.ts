// ACCEPTANCE TESTS — Story 1a.8 AC-12 (dimensional check stub) (green-phase)
//
// Tests active (checkDimensions stub implemented; returns "待 1b").
//
// AC-12: checkDimensions always returns {status:"deferred", message:"待 1b"}
// The stub does not derive actual units and does not throw on any input.

import { describe, expect, it } from "vitest";
import { checkDimensions, type DimensionalCheckResult } from "../dimensionalCheck";

// ═══════════════════════════════════════════════════════════════════════════════
// AC-12: Stub contract — always returns deferred
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkDimensions — AC-12 stub contract (P2)", () => {
  it("[P2] always returns {status:'deferred', message:'待 1b'} for any formula", () => {
    const formulas = [
      "1",
      "人口 * 0.05",
      "@00000000-0000-0000-0000-000000000001 + 1",
      "(a + b) * 2 [1/year]",
      "",
    ];

    for (const f of formulas) {
      const result: DimensionalCheckResult = checkDimensions(f);
      expect(result.status).toBe("deferred");
      expect(result.message).toBe("待 1b");
    }
  });

  it("[P2] result shape has only status and message keys (no derived units)", () => {
    const result = checkDimensions("人口 * 增长率");
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(["message", "status"]);
  });

  it("[P2] does not throw on any input (robustness guard)", () => {
    const edgeCases = [
      "",
      "   ",
      "!@#$%",
      "\n\t",
      "a".repeat(1000),
      undefined as unknown as string,
      null as unknown as string,
      123 as unknown as string,
    ];

    for (const input of edgeCases) {
      expect(() => checkDimensions(input)).not.toThrow();
    }
  });

  it("[P2] returns a new object each call (no singleton mutation)", () => {
    const a = checkDimensions("1");
    const b = checkDimensions("2");
    expect(a).not.toBe(b);
    // But they have the same values.
    expect(a).toEqual(b);
  });
});
