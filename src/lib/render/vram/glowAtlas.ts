// Package vram implements the AD-9 VRAM render base for Story 1a.2 sub-PR #1:
//   - glow atlas: off-screen pre-baked per ASCII glyph × luminance band
//   - double buffer: glyph-code buffer + color-index buffer (per-instance attrs)
//   - hue-shift fragment shader + NEAREST sampling (pixel-art crispness)
//
// AD-9 forbids per-glyph shadowBlur at RUNTIME (1000 glyphs × GPU blur/frame
// is unaffordable). The atlas is the one-time OFF-SCREEN bake that moves
// shadowBlur out of the per-frame path — this is the canonical AD-9 mechanism,
// not a violation. The F1-quality spike (1a.2 sub-PR #2) verifies the baked
// glow is visually indistinguishable from prototype runtime shadowBlur.
//
// This module owns the atlas LAYOUT (pure math, jsdom-unit-testable) and the
// off-screen Canvas2D baker (DOM+WebGL, verified end-to-end via Playwright).
// Business glyph rendering (stock/cloud/flow) arrives in 1a.3/1a.4 and
// consumes this base (epics.md L326).

// ---- character grid (tokens.css: --ns-cell-w / --ns-cell-h) ----
export const GLYPH_W = 9;
export const GLYPH_H = 16;

// Glow padding: must be >= --ns-glow-max (11px) so a band's shadowBlur halo
// never bleeds into the neighbor cell. 16 gives the stacked halo (GLOW_PASSES)
// room to bloom before clipping at the cell edge.
export const GLOW_PAD = 16;
export const CELL_W = GLYPH_W + 2 * GLOW_PAD; // 41
export const CELL_H = GLYPH_H + 2 * GLOW_PAD; // 48

// Luminance bands: 0 = crisp (no halo), 1 = dim, 2 = normal, 3 = bright.
// The value is the shadowBlur radius (px) used at bake time. Band 0 is the
// unblurred glyph so the renderer can draw non-glowing chrome (grid, frames)
// from the same atlas without a second texture.
export const LUMA_LEVELS = 4;
export const LUMA_BLUR_PX = [0, 4, 8, 14] as const;

// Halo stacking passes (F1-quality tuning): for blur>0 bands the baker draws
// the shadowed glyph N times so the halo alpha accumulates (source-over stacks
// → peak ~1-(1-α)^N). A single pass left the halo at ~0.3α, which read as a
// dim "sticker" under additive blending (contribution ≈ base·α²). 3 passes
// lift the peak to ~0.66 — a real glow without a second texture. Band 0
// (crisp, no halo) is always 1 pass.
export const GLOW_PASSES = 3;

// Box-drawing glyphs (U+2500–U+256C) for 1a.3 stock frames. Included now so
// the atlas layout is stable across 1a.3 (no re-bake/re-UV churn later).
export const BOX_GLYPHS = "─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬";

// Printable ASCII 32–126 (space..tilde), then box glyphs. Space is index 0.
export const CHARSET: readonly string[] = Object.freeze(
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).concat(Array.from(BOX_GLYPHS)),
);

export const CHAR_COUNT = CHARSET.length; // 95 + 22 = 117

const CHAR_MAP: ReadonlyMap<string, number> = new Map(CHARSET.map((c, i) => [c, i]));

export interface AtlasDims {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  texW: number;
  texH: number;
}

// Square-ish atlas layout: cells laid out left-to-right, top-to-bottom into
// `cols` columns. Default cols is the next power of two >= sqrt(total) —
// NPOT textures are fine in WebGL2, but a POT column count keeps row strides
// tidy and texture upload aligned.
export function atlasDims(cols?: number): AtlasDims {
  const total = CHAR_COUNT * LUMA_LEVELS;
  const c = cols ?? nextPow2(Math.ceil(Math.sqrt(total)));
  const r = Math.ceil(total / c);
  return { cols: c, rows: r, cellW: CELL_W, cellH: CELL_H, texW: c * CELL_W, texH: r * CELL_H };
}

// Linear cell index for (glyph, luma). Glyph-major: all 4 luminance bands
// for a glyph are contiguous, so a glyph's bands tile into one row run —
// cache-friendly when the renderer uploads per-glyph quads.
export function cellIndex(glyphIdx: number, lumaIdx: number): number {
  return glyphIdx * LUMA_LEVELS + lumaIdx;
}

// UV rect [u0,v0]–[u1,v1] for a linear cell index, in texture space.
//
// CONTRACT: the renderer MUST upload the atlas canvas with
// UNPACK_FLIP_Y_WEBGL = true so canvas row 0 (top, baked first) lands at
// texture v = 0 (GL bottom). With that flip, a cell at atlas (col, row) maps
// straightforwardly to v in [row*cellH/texH, (row+1)*cellH/texH] — no extra
// flip in the UV math here.
export function cellUV(
  cellIdx: number,
  dims: AtlasDims,
): { u0: number; v0: number; u1: number; v1: number } {
  const col = cellIdx % dims.cols;
  const row = Math.floor(cellIdx / dims.cols);
  return {
    u0: (col * dims.cellW) / dims.texW,
    u1: ((col + 1) * dims.cellW) / dims.texW,
    v0: (row * dims.cellH) / dims.texH,
    v1: ((row + 1) * dims.cellH) / dims.texH,
  };
}

// char -> glyph index, or -1 if not in the charset. The renderer clamps -1
// to space (index 0) so a missing glyph never crashes the draw.
export function charToGlyphIdx(ch: string): number {
  return CHAR_MAP.get(ch) ?? -1;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ---- off-screen Canvas2D baker (DOM + WebGL; verified via Playwright) ----

export interface BakeOptions {
  /** CSS font string, e.g. `${GLYPH_H}px "JetBrains Mono", "Courier New", monospace`. */
  font: string;
  /** Base glyph fill color (e.g. tokens --ns-fg #c9d1d9). */
  glyphColor: string;
  /** Glow halo color (e.g. tokens --ns-stock #00ffd5). */
  glowColor: string;
}

/**
 * Bake the glow atlas to an off-screen <canvas>. Each charset glyph is drawn
 * once per luminance band with shadowBlur = LUMA_BLUR_PX[band].
 *
 * This is the ONE place shadowBlur is used. It is off-screen and one-time —
 * NOT per-frame per-glyph (AD-9 forbids the latter). The returned canvas is
 * uploaded to a WebGL texture by the renderer.
 */
export function bakeGlowAtlasCanvas(opts: BakeOptions): HTMLCanvasElement {
  const dims = atlasDims();
  const canvas = document.createElement("canvas");
  canvas.width = dims.texW;
  canvas.height = dims.texH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.clearRect(0, 0, dims.texW, dims.texH);
  ctx.font = opts.font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let g = 0; g < CHAR_COUNT; g++) {
    for (let l = 0; l < LUMA_LEVELS; l++) {
      const idx = cellIndex(g, l);
      const col = idx % dims.cols;
      const row = Math.floor(idx / dims.cols);
      const cx = col * dims.cellW + dims.cellW / 2;
      const cy = row * dims.cellH + dims.cellH / 2;
      const blur = LUMA_BLUR_PX[l];
      ctx.shadowBlur = blur;
      ctx.shadowColor = blur > 0 ? opts.glowColor : "transparent";
      ctx.fillStyle = opts.glyphColor;
      // Stack the halo (GLOW_PASSES) for blur>0 bands so the alpha accumulates
      // into a real glow instead of a single-pass dim sticker.
      const passes = blur > 0 ? GLOW_PASSES : 1;
      for (let p = 0; p < passes; p++) ctx.fillText(CHARSET[g], cx, cy);
    }
  }
  ctx.shadowBlur = 0;
  return canvas;
}
