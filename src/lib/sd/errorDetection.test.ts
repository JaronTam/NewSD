import { describe, expect, it } from "vitest";

// Story 1a.12 RED - sd/errorDetection pure-function unit tests.
// gov: SDR#9 (三错误源独立检测) / SDR#23 (重名源已根除, 不再分类) / AC-12 / AC-14 / AC-18.
//
// Red mechanism: errorDetection.ts 未建 -> import 抛 module not found -> 全文件 fail (import-resolution red, 裁决 A).
// DS 建模块导出下列函数 + ErrorFinding 类型后转绿.
//
// 契约 (DS 实现须满足):
//   type ErrorFinding = { id: string; type: ErrorType; subjectId: string; subjectName: string; message: string };
//   ErrorType = "orphan-cloud" | "dangling-flow-endpoint" | "parallel-flow";
//   detectSetupErrors(elements): ErrorFinding[]   // 聚合三检测器
//   detectOrphanCloud(elements): ErrorFinding[]
//   detectDanglingFlowEndpoint(elements): ErrorFinding[]
//   detectParallelFlow(elements): ErrorFinding[]
//   detectDuplicateName(elements): ErrorFinding[]   // AC-18: 恒返回 [] (1a.11 @1bb3598 assertNameAvailable 已根除)
//   detectDimensionalError(elements): ErrorFinding[] // AC-14(b): 占位, 恒返回 [] (量纲检测 defer 1b)
//   detectDanglingFormula(elements): ErrorFinding[]  // AC-14(c): 占位, 恒返回 [] (公式悬空 defer 4.2)

import {
  detectSetupErrors,
  detectOrphanCloud,
  detectDanglingFlowEndpoint,
  detectParallelFlow,
  detectDuplicateName,
  detectDimensionalError,
  detectDanglingFormula,
  type ErrorFinding,
} from "./errorDetection";
import type { SDElement } from "./types";

// ---- fixtures ----

function stock(id: string, name = id): SDElement {
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
  };
}

function cloud(id: string, name = id): SDElement {
  return { id, kind: "cloud", name, x: 0, y: 0 };
}

function flow(id: string, fromId: string, toId: string, name = id): SDElement {
  return {
    id,
    kind: "flow",
    name,
    fromId,
    toId,
    formula: "1",
    isVariable: false,
    lastValue: 0,
    units: "",
  };
}

// ---- AC-12(a): dangling flow endpoint ----

describe("detectDanglingFlowEndpoint - AC-12(a) flow 端点未连", () => {
  it("flags a flow whose fromId points to a deleted element", () => {
    const elements: SDElement[] = [
      stock("s1"),
      flow("f1", "ghost", "s1"), // fromId "ghost" 不存在
    ];
    const findings: ErrorFinding[] = detectDanglingFlowEndpoint(elements);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.type === "dangling-flow-endpoint")).toBe(true);
    expect(findings.some((f) => f.subjectId === "f1")).toBe(true);
  });

  it("flags a flow whose toId points to a deleted element", () => {
    const elements: SDElement[] = [
      stock("s1"),
      flow("f1", "s1", "ghost"), // toId "ghost" 不存在
    ];
    const findings: ErrorFinding[] = detectDanglingFlowEndpoint(elements);
    expect(findings.some((f) => f.subjectId === "f1")).toBe(true);
  });

  it("returns empty when both endpoints exist (negative)", () => {
    const elements: SDElement[] = [stock("s1"), stock("s2"), flow("f1", "s1", "s2")];
    expect(detectDanglingFlowEndpoint(elements)).toEqual([]);
  });
});

// ---- AC-12(b): orphan cloud ----

describe("detectOrphanCloud - AC-12(b) 孤立 cloud", () => {
  it("flags a cloud that no flow connects (neither source nor sink)", () => {
    const elements: SDElement[] = [
      stock("s1"),
      stock("s2"),
      flow("f1", "s1", "s2"), // flows between stocks, cloud untouched
      cloud("c1"), // orphan
    ];
    const findings: ErrorFinding[] = detectOrphanCloud(elements);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.type === "orphan-cloud")).toBe(true);
    expect(findings.some((f) => f.subjectId === "c1")).toBe(true);
  });

  it("does not flag a cloud that is a flow source (out only)", () => {
    const elements: SDElement[] = [cloud("c1"), stock("s1"), flow("f1", "c1", "s1")];
    expect(detectOrphanCloud(elements)).toEqual([]);
  });

  it("does not flag a cloud that is a flow sink (in only)", () => {
    const elements: SDElement[] = [cloud("c1"), stock("s1"), flow("f1", "s1", "c1")];
    expect(detectOrphanCloud(elements)).toEqual([]);
  });
});

// ---- AC-12(c): parallel flow ----

describe("detectParallelFlow - AC-12(c) 平行 flow", () => {
  it("flags two flows with the same fromId -> toId pair (parallel)", () => {
    const elements: SDElement[] = [
      stock("s1"),
      stock("s2"),
      flow("f1", "s1", "s2"),
      flow("f2", "s1", "s2"), // parallel
    ];
    const findings: ErrorFinding[] = detectParallelFlow(elements);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.type === "parallel-flow")).toBe(true);
  });

  it("does not flag flows with reversed direction (s1->s2 and s2->s1 are not parallel)", () => {
    const elements: SDElement[] = [
      stock("s1"),
      stock("s2"),
      flow("f1", "s1", "s2"),
      flow("f2", "s2", "s1"),
    ];
    expect(detectParallelFlow(elements)).toEqual([]);
  });
});

// ---- AC-12: detectSetupErrors aggregates all three ----

describe("detectSetupErrors - AC-12 聚合三检测器", () => {
  it("returns findings spanning all three error sources for a mixed fixture", () => {
    const elements: SDElement[] = [
      stock("s1"),
      stock("s2"),
      cloud("c1"), // orphan
      flow("f1", "ghost", "s1"), // dangling
      flow("f2", "s1", "s2"),
      flow("f3", "s1", "s2"), // parallel with f2
    ];
    const findings: ErrorFinding[] = detectSetupErrors(elements);
    const types = new Set(findings.map((f) => f.type));
    expect(types.has("orphan-cloud")).toBe(true);
    expect(types.has("dangling-flow-endpoint")).toBe(true);
    expect(types.has("parallel-flow")).toBe(true);
  });

  it("returns empty for a clean fixture (negative)", () => {
    const elements: SDElement[] = [
      stock("s1"),
      stock("s2"),
      cloud("c1"),
      flow("f1", "s1", "s2"),
      flow("f2", "c1", "s1"),
    ];
    expect(detectSetupErrors(elements)).toEqual([]);
  });
});

// ---- AC-14: placeholder detectors return [] ----

describe("AC-14 placeholder detectors (占位返回 [])", () => {
  it("detectDimensionalError is a no-op placeholder returning [] (量纲 defer 1b)", () => {
    expect(detectDimensionalError([stock("s1")])).toEqual([]);
  });

  it("detectDanglingFormula is a no-op placeholder returning [] (公式悬空 defer 4.2)", () => {
    expect(detectDanglingFormula([stock("s1"), flow("f1", "s1", "s1")])).toEqual([]);
  });
});

// ---- AC-18: duplicate-name source eradicated ----

describe("detectDuplicateName - AC-18 重名源已根除 (1a.11 @1bb3598)", () => {
  it("always returns [] even when names would collide (assertNameAvailable prevents it)", () => {
    // 1a.11 唯一名称机制使重名不可能进入 store; 此检测器恒空.
    const elements: SDElement[] = [stock("s1", "dup"), stock("s2", "dup")];
    expect(detectDuplicateName(elements)).toEqual([]);
  });

  it("does not surface duplicate-name in detectSetupErrors (negative, AC-18(a))", () => {
    const elements: SDElement[] = [stock("s1", "dup"), stock("s2", "dup")];
    const findings: ErrorFinding[] = detectSetupErrors(elements);
    expect(findings.some((f) => (f.type as string) === "duplicate-name")).toBe(false);
  });
});
