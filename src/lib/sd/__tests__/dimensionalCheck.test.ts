// ACCEPTANCE TESTS — Story 1a.8 AC-12 (dimensional check stub) (green-phase)
//
// Tests active (checkDimensions stub implemented; returns "待 1b").
//
// AC-12: checkDimensions always returns {status:"deferred", message:"待 1b"}
// The stub does not derive actual units and does not throw on any input.

import { describe, expect, it } from "vitest";
import {
  checkDimensions,
  revalidateAllDimensions,
  type DimensionalCheckResult,
} from "../dimensionalCheck";
import type { SDElement } from "../types";

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

// ═══════════════════════════════════════════════════════════════════════════════
// Story 1a-10 T5/T6 - revalidateAllDimensions (aggregate flow revalidation).
// gov: AC-5/AC-6 + SDR#4/#20 + T5/T6.
//
// DS T6 done: declare-const replaced with real import (line-9 extended);
// stub elements upgraded to full SDElement literals (SDR#4 signature is
// readonly SDElement[] — Flow needs id/name/fromId/toId/isVariable/lastValue/
// units, Stock the full stock shape).
// ═══════════════════════════════════════════════════════════════════════════════

function flow(id: string, formula: string): SDElement {
  return {
    id,
    kind: "flow",
    name: id,
    fromId: "from-" + id,
    toId: "to-" + id,
    formula,
    isVariable: false,
    lastValue: 0,
    units: "",
  };
}

function stock(id: string): SDElement {
  return {
    id,
    kind: "stock",
    name: id,
    x: 0,
    y: 0,
    width: 10,
    height: 5,
    initialValue: 0,
    units: "",
    allowNegative: false,
    currentValue: 0,
    history: [0],
  };
}

describe("revalidateAllDimensions - AC-5/AC-6: aggregate flow revalidation (stub entry)", () => {
  it("[P0] N flow elements -> N results, all {status:'deferred', message:'待 1b'}", () => {
    // gov: AC-5 + AC-6 + SDR#4 + T5. filter kind==='flow' -> map checkDimensions(flow.formula).
    const flows: SDElement[] = [flow("f1", "人口 * 0.05"), flow("f2", "@a + 1"), flow("f3", "1")];
    const results = revalidateAllDimensions(flows);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe("deferred");
      expect(r.message).toBe("待 1b");
    }
  });

  it("[P0] empty elements -> [] (no flows to revalidate)", () => {
    // gov: AC-5 + SDR#4 + T5.
    expect(revalidateAllDimensions([])).toEqual([]);
  });

  it("[P0] non-flow elements (stock/etc) are skipped, not counted", () => {
    // gov: AC-5 + SDR#4 + T5. only kind==='flow' revalidated.
    const mixed: SDElement[] = [stock("s1"), flow("f1", "a + b"), stock("s2")];
    const results = revalidateAllDimensions(mixed);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("deferred");
  });

  it("[P0] returns a new array each call (no cached reference)", () => {
    // gov: AC-5 + SDR#4 + T5. pure function, fresh array per call.
    const flows: SDElement[] = [flow("f1", "1")];
    const a = revalidateAllDimensions(flows);
    const b = revalidateAllDimensions(flows);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
