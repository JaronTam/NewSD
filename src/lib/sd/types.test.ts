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
  it("has required fields matching epic AC-11", () => {
    const c: Cloud = {
      id: "00000000-0000-4000-8000-000000000010",
      kind: "cloud",
      x: 3,
      y: 7,
    };
    expect(c.kind).toBe("cloud");
    expect(c.name).toBeUndefined(); // optional, omitted by default
  });

  it("accepts optional name field (AC-11)", () => {
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
    };
    expect(f.kind).toBe("flow");
    expect(f.fromId).toBeTruthy();
    expect(f.toId).toBeTruthy();
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
