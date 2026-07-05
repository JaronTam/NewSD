import { describe, expect, it } from "vitest";

import { DEFAULT_STOCK_H, DEFAULT_STOCK_W, validateStockSize } from "./store";

describe("validateStockSize — E9 guard (AC-8, AC-9)", () => {
  it("accepts positive finite dimensions", () => {
    const r = validateStockSize(10, 5);
    expect(r.ok).toBe(true);
    expect(r.width).toBe(10);
    expect(r.height).toBe(5);
  });

  it("accepts minimum reasonable size (1×1)", () => {
    const r = validateStockSize(1, 1);
    expect(r.ok).toBe(true);
    expect(r.width).toBe(1);
    expect(r.height).toBe(1);
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

describe("validateStockSize — createStock integration guard", () => {
  it("default width/height are used when validation fails", () => {
    // Validate that the defaults are suitable for the rendering path
    // (fit box frame + at least one line of interior text).
    const r = validateStockSize(0, 0);
    expect(r.ok).toBe(false);
    // With w=8, h=5: top ┌─…─┐ + 3 interior rows + bottom └─…─┘
    // Interior row 1 fits text up to 6 chars (8 - 2 borders).
    expect(r.width).toBeGreaterThanOrEqual(6); // enough for "X 100 kg"
    expect(r.height).toBeGreaterThanOrEqual(4); // enough for box frame
  });
});
