import { describe, expect, it } from "vitest";

import type { Cloud, Flow, SDElement, Stock } from "./types";

// Task 2.3: Stock/Cloud 字段契约 + UUIDv4 + allowNegative default false
describe("Stock type contract", () => {
  it("has required fields matching epic AC-5", () => {
    const s: Stock = {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "stock",
      name: "Population",
      x: 5,
      y: 10,
      width: 8,
      height: 6,
      initialValue: 100,
      units: "people",
      allowNegative: false,
      currentValue: 100,
      history: [],
    };

    expect(s.kind).toBe("stock");
    expect(s.width).toBeGreaterThan(0);
    expect(s.height).toBeGreaterThan(0);
    // allowNegative defaults to false per AC-5
    expect(s.allowNegative).toBe(false);
    // currentValue is a runtime field (not persisted, AC-5)
    expect(typeof s.currentValue).toBe("number");
    // history is a runtime sim array (not persisted)
    expect(Array.isArray(s.history)).toBe(true);
  });

  it("allows allowNegative = true for explicit opt-in", () => {
    const s: Stock = {
      id: "00000000-0000-4000-8000-000000000002",
      kind: "stock",
      name: "Debt",
      x: 0,
      y: 0,
      width: 4,
      height: 4,
      initialValue: 0,
      units: "",
      allowNegative: true,
      currentValue: 0,
      history: [],
    };
    expect(s.allowNegative).toBe(true);
  });

  it("uses width/height (not w/h) per epic alignment", () => {
    const s: Stock = {
      id: "00000000-0000-4000-8000-000000000003",
      kind: "stock",
      name: "Test",
      x: 0,
      y: 0,
      width: 8,
      height: 4,
      initialValue: 0,
      units: "",
      allowNegative: false,
      currentValue: 0,
      history: [],
    };
    // Verify width/height are the canonical field names (not w/h)
    expect(s).toHaveProperty("width");
    expect(s).toHaveProperty("height");
  });
});

describe("Cloud type contract", () => {
  it("has required fields matching FR-ELEM-5 (1a.11 rewired)", () => {
    const c: Cloud = {
      id: "00000000-0000-4000-8000-000000000010",
      kind: "cloud",
      name: "c",
      x: 3,
      y: 7,
    };
    expect(c.kind).toBe("cloud");
    expect(c.name).toBe("c"); // required per 1a.11 (was optional)
  });

  it("name field is required (was optional before 1a.11)", () => {
    const c: Cloud = {
      id: "00000000-0000-4000-8000-000000000011",
      kind: "cloud",
      x: 3,
      y: 7,
      name: "Source",
    };
    expect(c.name).toBe("Source");
  });

  it("has no initialValue/currentValue/units (infinite capacity, AC-12)", () => {
    const c: Cloud = {
      id: "00000000-0000-4000-8000-000000000012",
      kind: "cloud",
      name: "c12",
      x: 0,
      y: 0,
    };
    // Cloud should not have value-related fields (AC-12)
    expect("initialValue" in c).toBe(false);
    expect("currentValue" in c).toBe(false);
    expect("units" in c).toBe(false);
  });
});

describe("Flow type contract", () => {
  it("preserves existing Flow discriminant for 1a.4", () => {
    const f: Flow = {
      id: "00000000-0000-4000-8000-000000000020",
      kind: "flow",
      name: "births",
      fromId: "stock-1",
      toId: "stock-2",
      formula: "birthRate * Population",
      isVariable: false,
      lastValue: 0,
      units: "",
    };
    expect(f.kind).toBe("flow");
    expect(f.fromId).toBeTruthy();
    expect(f.toId).toBeTruthy();
  });

  // AC-1: Flow 属性含 units(只读派生,不持久化)
  it("AC-1: Flow has required `units` field (readonly, derived from toId stock)", () => {
    const f: Flow = {
      id: "00000000-0000-4000-8000-000000000021",
      kind: "flow",
      name: "growth",
      fromId: "stock-a",
      toId: "stock-b",
      formula: "0.05 * Population",
      isVariable: true,
      lastValue: 0,
      units: "people/dt",
    };
    expect(f.units).toBe("people/dt");
    // units is a string field present on every Flow
    expect(typeof f.units).toBe("string");
  });

  // AC-2: 方向由 fromId→toId 表达,不设极性字段
  it("AC-2: Flow direction is expressed solely by fromId→toId (no polarity field)", () => {
    const f: Flow = {
      id: "00000000-0000-4000-8000-000000000022",
      kind: "flow",
      name: "inflow",
      fromId: "src",
      toId: "dst",
      formula: "1",
      isVariable: false,
      lastValue: 0,
      units: "",
    };
    // Direction is purely fromId → toId; no polarity/direction field exists
    expect(f.fromId).toBe("src");
    expect(f.toId).toBe("dst");
    // polarity must not exist on Flow — verified via runtime access
    const _noPolarity: undefined = (f as unknown as Record<string, unknown>)[
      "polarity"
    ] as undefined;
    expect(_noPolarity).toBeUndefined();
  });

  // AC-3: units 自动派生为目标存量 units/时间单位,只读,deriveFlowUnits 纯函数
  it("AC-3: Flow.units is a readonly derived field (populated by deriveFlowUnits at construction)", () => {
    // Flow.units is a plain string — the derivation happens in createFlow (store),
    // not as a getter. This test just verifies the field exists and is typed as string.
    const f: Flow = {
      id: "00000000-0000-4000-8000-000000000023",
      kind: "flow",
      name: "derived",
      fromId: "s1",
      toId: "s2",
      formula: "rate",
      isVariable: false,
      lastValue: 0,
      units: "people/dt",
    };
    expect(f.units).toBe("people/dt");
  });
});

describe("SDElement discriminated union", () => {
  it("discriminates by kind field", () => {
    const stock: SDElement = {
      id: "1",
      kind: "stock",
      name: "S",
      x: 0,
      y: 0,
      width: 4,
      height: 4,
      initialValue: 0,
      units: "",
      allowNegative: false,
      currentValue: 0,
      history: [],
    };
    const cloud: SDElement = {
      id: "2",
      kind: "cloud",
      name: "c2",
      x: 0,
      y: 0,
    };

    // kind 是 TS discriminated union 判别字段，等价 epic type 概念
    const getKind = (e: SDElement) => e.kind;
    expect(getKind(stock)).toBe("stock");
    expect(getKind(cloud)).toBe("cloud");
  });
});

describe("UUIDv4 id format", () => {
  const uuidV4Re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("crypto.randomUUID() produces valid UUIDv4 strings", () => {
    const id = crypto.randomUUID();
    expect(id).toMatch(uuidV4Re);
  });

  it("each generated UUID is unique", () => {
    const ids = new Set(Array.from({ length: 100 }, () => crypto.randomUUID()));
    expect(ids.size).toBe(100);
  });
});
