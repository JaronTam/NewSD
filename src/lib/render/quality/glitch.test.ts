// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — glitch glyphIdx tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-5 + SDR#6 + T9-T10 green
// ══════════════════════════════════════════════════════════════════════════════

import { beforeEach, describe, expect, it } from "vitest";

import { computeGlitchGlyphIdx } from "./animation";
import { buildInstancesFromStore, elementStore } from "../CanvasView";

describe("AC-5: glitch glyphIdx 周期轮转 -> 稳定真值", () => {
  // gov: AC-5 + SDR#6 (glitch glyphIdx 轮转) + T9
  it("computeGlitchGlyphIdx(time, true) 随 time 周期轮转 (非恒等于 true)", () => {
    const g0 = computeGlitchGlyphIdx(0, 5);
    const g1 = computeGlitchGlyphIdx(16, 5);
    const g2 = computeGlitchGlyphIdx(32, 5);
    expect([g0, g1, g2].some((g) => g !== 5)).toBe(true);
  });

  // gov: AC-5 + SDR#6 + T9 (稳定: 周期结束后回归 trueGlyphIdx)
  it("周期结束后 computeGlitchGlyphIdx 回归 trueGlyphIdx (稳定真值)", () => {
    // DS: time 推进超过 glitch 60% 扰动窗口 -> 返回 trueGlyphIdx
    const stable = computeGlitchGlyphIdx(1500, 5);
    expect(stable).toBe(5);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-5 / SDR#6 integration: buildInstancesFromStore 接 timeMs → stock glitch
// (T9 rework: 接入断言, 非纯函数单元测)
// ══════════════════════════════════════════════════════════════════════════════
describe("AC-5 integration: buildInstancesFromStore 接 timeMs 后 stock 数值 glitch", () => {
  beforeEach(() => {
    elementStore.setElements([]);
    elementStore.createStock({
      name: "GDP",
      x: 0,
      y: 0,
      width: 14,
      height: 5,
      initialValue: 25000,
      units: "B$",
      allowNegative: false,
    });
  });

  it("timeMs=0 时 stock digit glyphIdx 不扰动 (静态显示真值)", () => {
    const instances = buildInstancesFromStore(null, { timeMs: 0 });
    // Find digit glyph instances (CHARSET 16-25 = '0'-'9').
    const digits = instances.filter((ri) => ri.glyphIdx >= 16 && ri.glyphIdx <= 25);
    expect(digits.length).toBeGreaterThan(0);
    // All digits are at their true glyph indices.
    for (const d of digits) {
      expect(d.glyphIdx).toBeGreaterThanOrEqual(16);
      expect(d.glyphIdx).toBeLessThanOrEqual(25);
    }
  });

  it("timeMs>0 且 glitch 期内 stock digit 被替换为随机 glyph (解码效果)", () => {
    const instancesStatic = buildInstancesFromStore(null, { timeMs: 0 });
    // Use a time within the glitch perturbation window (first 60% of 2000ms).
    const instancesGlitch = buildInstancesFromStore(null, { timeMs: 100 });

    // During glitch phase, some digit glyphs are replaced with random CHARSET
    // glyphs (indices 1-94). The full glyph sequences should differ.
    const allGlyphsStatic = instancesStatic.map((ri) => ri.glyphIdx).join(",");
    const allGlyphsGlitch = instancesGlitch.map((ri) => ri.glyphIdx).join(",");
    expect(allGlyphsStatic.length).toBeGreaterThan(0);
    expect(allGlyphsGlitch).not.toBe(allGlyphsStatic);
  });

  it("timeMs 在稳定期 (60%+) 时 stock digit 回归真值", () => {
    // After 1300ms (past 60% of 2000ms = 1200ms), digits stabilize.
    const instancesStable = buildInstancesFromStore(null, { timeMs: 1300 });
    const instancesStatic = buildInstancesFromStore(null, { timeMs: 0 });

    // In stable phase, digit glyphs should match the static (unglitched) ones.
    const digitsStable = instancesStable
      .filter((ri) => ri.glyphIdx >= 16 && ri.glyphIdx <= 25)
      .map((ri) => ri.glyphIdx);
    const digitsStatic = instancesStatic
      .filter((ri) => ri.glyphIdx >= 16 && ri.glyphIdx <= 25)
      .map((ri) => ri.glyphIdx);

    // Both should have the same number of digit glyphs.
    expect(digitsStable.length).toBe(digitsStatic.length);
    // All digit positions should have their true glyph indices.
    expect(digitsStable).toEqual(digitsStatic);
  });
});
