// Palette derivation for the VRAM glyph renderer (Story 1a.2 sub-PR #2).
//
// Single source of truth: the 8 semantic glyph colors in src/styles/tokens.css.
// readPalette() reads them at runtime from the computed :root style and returns
// the RGBA [0..1] array the VRAMRenderer uploads as u_palette. Both the prod
// CanvasView and the DEV /vram harness consume this so the on-screen glyph
// palette never drifts from tokens.css (aesthetic AC② — single source).
//
// Indices are stable (callers store colorIdx in RenderInstance), so the token
// order below is the palette contract:
//   0 stock · 1 flow · 2 cloud · 3 fg · 4 fg-dim · 5 sel · 6 spark · 7 err

import type { RGBA } from "./vram/renderer";

// CSS custom-property names, in palette-index order. Mirror tokens.css.
export const PALETTE_TOKENS = [
  "--ns-stock",
  "--ns-flow",
  "--ns-cloud",
  "--ns-fg",
  "--ns-fg-dim",
  "--ns-sel",
  "--ns-spark",
  "--ns-err",
] as const;

// Hex fallbacks mirror tokens.css verbatim so a missing/invalid token still
// renders an on-palette glyph rather than transparent. Order matches PALETTE_TOKENS.
const PALETTE_HEX = [
  "#00ffd5", // 0 stock  (cyan)
  "#ff5577", // 1 flow   (magenta)
  "#7c3aed", // 2 cloud  (violet)
  "#c9d1d9", // 3 fg
  "#4a5568", // 4 fg-dim
  "#ffd700", // 5 sel    (amber)
  "#39ff14", // 6 spark  (neon green)
  "#ff4444", // 7 err    (red)
] as const;

/**
 * Parse a `#rgb` or `#rrggbb` hex string into an RGBA tuple in [0..1] (alpha 1).
 * Returns null on malformed/empty input. Leading `#` is optional.
 */
export function hexToRGBA(hex: string): RGBA | null {
  if (!hex) return null;
  let h = hex.trim();
  if (h[0] === "#") h = h.slice(1);
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}

// DEFAULT_PALETTE is built from compile-time-known-good hex literals.
function assertHex(hex: string): RGBA {
  const c = hexToRGBA(hex);
  if (!c) throw new Error(`invalid default palette hex: ${hex}`);
  return c;
}

export const DEFAULT_PALETTE: readonly RGBA[] = PALETTE_HEX.map((h) => assertHex(h));

/**
 * Read the 8-entry VRAM palette from the runtime computed style on :root.
 * Falls back per-entry to DEFAULT_PALETTE when a token is missing/invalid
 * (e.g. jsdom, where tokens.css is not loaded and getComputedStyle returns "").
 * When `document` is undefined (SSR), returns a copy of DEFAULT_PALETTE.
 */
export function readPalette(): RGBA[] {
  if (typeof document === "undefined") return DEFAULT_PALETTE.map((c) => [...c] as RGBA);
  const root = getComputedStyle(document.documentElement);
  const out: RGBA[] = new Array(PALETTE_TOKENS.length);
  for (let i = 0; i < PALETTE_TOKENS.length; i++) {
    const raw = root.getPropertyValue(PALETTE_TOKENS[i]).trim();
    out[i] = hexToRGBA(raw) ?? DEFAULT_PALETTE[i];
  }
  return out;
}
