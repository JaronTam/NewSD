import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PALETTE, PALETTE_TOKENS, hexToRGBA, readPalette } from "./palette";
import { PALETTE_SIZE } from "./vram/shaders";

// hexToRGBA + readPalette are pure CSS-free logic; the WebGL2 draw path is
// verified via Playwright. Here we assert the palette contract (8 entries,
// tokens.css order) and the per-token fallback that lets CanvasView degrade
// gracefully when tokens.css is unavailable (jsdom, SSR).

describe("hexToRGBA — #rrggbb / #rgb -> [0..1] tuple (alpha 1)", () => {
  it("parses a 6-digit hex with leading #", () => {
    expect(hexToRGBA("#00ffd5")).toEqual([0, 1, 213 / 255, 1]); // stock cyan
  });

  it("parses a 6-digit hex without leading #", () => {
    expect(hexToRGBA("ff5577")).toEqual([1, 85 / 255, 119 / 255, 1]); // flow magenta
  });

  it("expands a 3-digit hex to the doubled-channel form", () => {
    expect(hexToRGBA("#fff")).toEqual([1, 1, 1, 1]);
    expect(hexToRGBA("000")).toEqual([0, 0, 0, 1]);
    expect(hexToRGBA("#39f")).toEqual([3 / 15, 9 / 15, 15 / 15, 1]);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(hexToRGBA("  #00ffd5  ")).toEqual([0, 1, 213 / 255, 1]);
  });

  it("returns null on malformed input", () => {
    expect(hexToRGBA("")).toBeNull();
    expect(hexToRGBA("#xyz")).toBeNull();
    expect(hexToRGBA("#00ff")).toBeNull(); // 4 digits — neither 3 nor 6
    expect(hexToRGBA("#00ffdg")).toBeNull(); // non-hex digit
    expect(hexToRGBA("#00ffd500")).toBeNull(); // 8-digit (alpha) not supported
  });
});

describe("DEFAULT_PALETTE — 8-entry fallback mirroring tokens.css", () => {
  it("has exactly PALETTE_SIZE entries (PALETTE_SIZE contract)", () => {
    expect(DEFAULT_PALETTE.length).toBe(PALETTE_SIZE);
    expect(PALETTE_TOKENS.length).toBe(PALETTE_SIZE);
  });

  it("entry 0 is stock cyan #00ffd5", () => {
    expect(DEFAULT_PALETTE[0]).toEqual([0, 1, 213 / 255, 1]);
  });

  it("entry 7 is err red #ff4444 (semantic, not the old accent blue)", () => {
    expect(DEFAULT_PALETTE[7]).toEqual([1, 68 / 255, 68 / 255, 1]);
  });

  it("every entry is an opaque RGBA tuple in [0..1]", () => {
    for (const [r, g, b, a] of DEFAULT_PALETTE) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      expect(a).toBe(1);
    }
  });
});

describe("readPalette — runtime token read with per-entry fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns PALETTE_SIZE RGBA entries", () => {
    const pal = readPalette();
    expect(pal.length).toBe(PALETTE_SIZE);
    for (const c of pal) expect(c.length).toBe(4);
  });

  it('falls back to DEFAULT_PALETTE when tokens are absent (jsdom: getComputedStyle returns "")', () => {
    // jsdom does not load tokens.css, so every --ns-* custom property reads as
    // the empty string -> readPalette must surface DEFAULT_PALETTE verbatim.
    const pal = readPalette();
    expect(pal).toEqual([...DEFAULT_PALETTE]);
  });

  it("reads a live token value when getComputedStyle returns one", () => {
    // Stub getComputedStyle to serve a custom value for --ns-stock (index 0)
    // and empty strings elsewhere. Only index 0 should reflect the stub; the
    // rest fall back to DEFAULT_PALETTE.
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      const style = real.call(window, el);
      // Proxy getPropertyValue so the --ns-stock override is visible.
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === "getPropertyValue") {
            return (name: string) =>
              name === "--ns-stock" ? "#112233" : target.getPropertyValue(name);
          }
          return Reflect.get(target, prop, receiver);
        },
      }) as CSSStyleDeclaration;
    });

    const pal = readPalette();
    expect(pal[0]).toEqual([17 / 255, 34 / 255, 51 / 255, 1]); // #112233
    expect(pal[1]).toEqual(DEFAULT_PALETTE[1]); // still defaulted
  });

  it("falls back when a token holds a malformed value", () => {
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      const style = real.call(window, el);
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (prop === "getPropertyValue") {
            return (name: string) =>
              name === "--ns-flow" ? "not-a-color" : target.getPropertyValue(name);
          }
          return Reflect.get(target, prop, receiver);
        },
      }) as CSSStyleDeclaration;
    });

    const pal = readPalette();
    expect(pal[1]).toEqual(DEFAULT_PALETTE[1]); // malformed -> fallback
  });
});
