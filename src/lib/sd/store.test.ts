import { describe, expect, it } from "vitest";

import { createElementStore, DEFAULT_STOCK_H, DEFAULT_STOCK_W, validateStockSize } from "./store";
import type { Stock } from "./types";

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
