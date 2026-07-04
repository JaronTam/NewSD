import { describe, expect, it } from "vitest";

import {
  BOX_GLYPHS,
  CELL_H,
  CELL_W,
  CHAR_COUNT,
  CHARSET,
  GLOW_PAD,
  GLOW_PASSES,
  LUMA_BLUR_PX,
  LUMA_LEVELS,
  atlasDims,
  cellIndex,
  cellUV,
  charToGlyphIdx,
} from "./glowAtlas";

// Pure-layout tests for the AD-9 glow atlas. The off-screen Canvas2D baker
// (bakeGlowAtlasCanvas) needs a real 2D context + WebGL and is verified
// end-to-end via Playwright, not here.

describe("glowAtlas — charset", () => {
  it("charset is printable ASCII 32–126 + box glyphs (117 total)", () => {
    expect(CHARSET[0]).toBe(" ");
    expect(CHARSET[94]).toBe("~");
    expect(CHARSET.length).toBe(95 + BOX_GLYPHS.length);
    expect(CHAR_COUNT).toBe(117);
    expect(CHARSET).toContain("─");
    expect(CHARSET).toContain("╬");
  });

  it("charToGlyphIdx maps ASCII and box glyphs; unknown → -1", () => {
    expect(charToGlyphIdx(" ")).toBe(0);
    expect(charToGlyphIdx("~")).toBe(94);
    expect(charToGlyphIdx("─")).toBe(95);
    expect(charToGlyphIdx("╬")).toBe(116);
    expect(charToGlyphIdx("€")).toBe(-1);
  });
});

describe("glowAtlas — halo tuning constants", () => {
  it("LUMA_BLUR_PX has one entry per band, band 0 is crisp (no blur)", () => {
    expect(LUMA_BLUR_PX.length).toBe(LUMA_LEVELS);
    expect(LUMA_BLUR_PX[0]).toBe(0);
    // bands are monotonically steeper so higher luma = wider halo
    for (let i = 1; i < LUMA_BLUR_PX.length; i++) {
      expect(LUMA_BLUR_PX[i]).toBeGreaterThan(LUMA_BLUR_PX[i - 1]);
    }
  });

  // F1-quality spike-calibrated values (PR#21 @b8332f4). These knobs bake the
  // halo measured at halo:core ≈ 2.5× on both /vram (2.55) and CanvasView
  // zoom=2000% (2.49) — the operational bar for spec [F1-quality]'s "visually
  // indistinguishable" acceptance (epics.md Story 1a.2 收尾备注). Pinning the
  // exact values prevents the halo fix from being silently reverted: a
  // single-pass GLOW_PASSES=1 or flatter LUMA_BLUR_PX passes the structural
  // invariants above but regresses the glow to a dim "sticker" (the spike's
  // root cause). Changing them requires re-running the local Playwright
  // halo:core gate.
  it("F1-quality spike-calibrated halo knobs are pinned (PR#21)", () => {
    expect(GLOW_PAD).toBe(16);
    expect([...LUMA_BLUR_PX]).toEqual([0, 4, 8, 14]);
    expect(GLOW_PASSES).toBe(3);
  });
});

describe("glowAtlas — atlas layout", () => {
  const dims = atlasDims();

  it("default cols is the next pow2 >= sqrt(total cells)", () => {
    const total = CHAR_COUNT * LUMA_LEVELS; // 468
    expect(dims.cols).toBe(32); // nextPow2(ceil(sqrt(468))) = nextPow2(22) = 32
    expect(dims.rows).toBe(Math.ceil(total / 32)); // 15
  });

  it("cell size = glyph + 2*glow pad", () => {
    expect(dims.cellW).toBe(CELL_W); // 41
    expect(dims.cellH).toBe(CELL_H); // 48
  });

  it("texture size = cols*cellW × rows*cellH", () => {
    expect(dims.texW).toBe(dims.cols * dims.cellW); // 32*41 = 1312
    expect(dims.texH).toBe(dims.rows * dims.cellH); // 15*48 = 720
    expect(dims.texW).toBe(1312);
    expect(dims.texH).toBe(720);
  });

  it("every cell fits within the texture (no overflow)", () => {
    const last = cellIndex(CHAR_COUNT - 1, LUMA_LEVELS - 1);
    const col = last % dims.cols;
    const row = Math.floor(last / dims.cols);
    expect((col + 1) * dims.cellW).toBeLessThanOrEqual(dims.texW);
    expect((row + 1) * dims.cellH).toBeLessThanOrEqual(dims.texH);
  });
});

describe("glowAtlas — cellIndex", () => {
  it("is glyph-major (a glyph's luminance bands are contiguous)", () => {
    expect(cellIndex(0, 0)).toBe(0);
    expect(cellIndex(0, 3)).toBe(3);
    expect(cellIndex(1, 0)).toBe(4); // next glyph starts at band stride
    expect(cellIndex(116, 3)).toBe(467); // last cell
  });
});

describe("glowAtlas — cellUV", () => {
  const dims = atlasDims();

  it("cell 0 maps to the texture origin corner [0,0]–[cellW/texW, cellH/texH]", () => {
    const uv = cellUV(0, dims);
    expect(uv.u0).toBeCloseTo(0, 10);
    expect(uv.v0).toBeCloseTo(0, 10);
    expect(uv.u1).toBeCloseTo(CELL_W / dims.texW, 10);
    expect(uv.v1).toBeCloseTo(CELL_H / dims.texH, 10);
  });

  it("UVs match the (col,row) position derived from the linear index", () => {
    const last = cellIndex(CHAR_COUNT - 1, LUMA_LEVELS - 1); // 467
    const col = last % dims.cols; // 19
    const row = Math.floor(last / dims.cols); // 14
    const uv = cellUV(last, dims);
    expect(uv.u0).toBeCloseTo((col * CELL_W) / dims.texW, 10);
    expect(uv.u1).toBeCloseTo(((col + 1) * CELL_W) / dims.texW, 10);
    expect(uv.v0).toBeCloseTo((row * CELL_H) / dims.texH, 10);
    expect(uv.v1).toBeCloseTo(((row + 1) * CELL_H) / dims.texH, 10);
    expect(uv.v1).toBeCloseTo(1, 10); // last row reaches v=1
  });

  it("u1/v1 of one cell equals u0/v0 of the next along each axis", () => {
    const a = cellUV(0, dims);
    const b = cellUV(1, dims); // same row, next col
    expect(b.u0).toBeCloseTo(a.u1, 10);
    expect(b.v0).toBeCloseTo(a.v0, 10);
  });
});
