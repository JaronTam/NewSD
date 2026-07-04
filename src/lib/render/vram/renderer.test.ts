import { describe, expect, it } from "vitest";

import {
  affineToMat3,
  paletteToUniform,
  quadWorldSize,
  screenAffineToClipMat3,
  type RGBA,
  VRAMRenderer,
} from "./renderer";
import { CELL_H, CELL_W, GLYPH_H, GLYPH_W } from "./glowAtlas";
import type { Affine } from "../camera";

// Pure-logic helpers (camera->mat3, palette flatten, quad world size) are
// unit-tested here. The WebGL2 draw path is verified via Playwright — jsdom
// has no WebGL2 context, so the constructor is asserted to refuse a null ctx.

describe("affineToMat3 — camera 3x2 -> column-major mat3", () => {
  it("identity affine yields the identity mat3", () => {
    const id: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const m = affineToMat3(id);
    // column-major: col0=(a,b,0)=(1,0,0), col1=(c,d,0)=(0,1,0), col2=(e,f,1)=(0,0,1)
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("pure translation puts (e,f) in column 2", () => {
    const t: Affine = { a: 1, b: 0, c: 0, d: 1, e: 10, f: -4 };
    const m = affineToMat3(t);
    expect(m[6]).toBe(10); // e
    expect(m[7]).toBe(-4); // f
    expect(m[0]).toBe(1); // a (zoom preserved)
    expect(m[4]).toBe(1); // d (col1 row1)
  });

  it("pan/zoom affine (a=d=zoom) lands a,d in columns 0,1 diagonal", () => {
    const pan: Affine = { a: 2, b: 0, c: 0, d: 2, e: 3, f: 5 };
    const m = affineToMat3(pan);
    expect(m[0]).toBe(2); // a
    expect(m[4]).toBe(2); // d (col1 row1)
    expect(m[6]).toBe(3); // e
    expect(m[7]).toBe(5); // f
  });
});

describe("screenAffineToClipMat3 — compose world->screen affine with screen->NDC", () => {
  // Regression guard for the sub-PR #1 blank-canvas bug: camera.ts outputs a
  // world->screen-PIXEL affine, but gl_Position expects NDC ([-1, +1]) with
  // Y-up. Uploading the raw pixel-space mat3 clips every quad. This helper
  // pre-composes screen->NDC (with the Y flip) into the affine so u_proj is
  // ready-to-use in the vertex shader.
  const applyMat3ColMajor = (m: Float32Array, x: number, y: number): [number, number] => {
    // column-major: col0=(m0,m1,m2), col1=(m3,m4,m5), col2=(m6,m7,m8)
    const nx = m[0] * x + m[3] * y + m[6];
    const ny = m[1] * x + m[4] * y + m[7];
    return [nx, ny];
  };
  // Float32Array precision ceiling ~1e-7 — 5 decimals is comfortably above the noise floor.
  const PREC = 5;

  it("identity affine + 100x100 viewport maps world (0,0) to NDC (-1, +1)", () => {
    // A raw identity affine treats world (x,y) as screen (x,y). Screen (0,0)
    // is the canvas top-left, which is NDC (-1, +1) after the Y flip.
    const id: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const m = screenAffineToClipMat3(id, 100, 100);
    const [nx, ny] = applyMat3ColMajor(m, 0, 0);
    expect(nx).toBeCloseTo(-1, PREC);
    expect(ny).toBeCloseTo(1, PREC);
  });

  it("identity affine + 100x100 viewport maps world (100,100) to NDC (+1, -1)", () => {
    // Screen bottom-right (W, H) is NDC (+1, -1) — the diagonally opposite
    // corner of the top-left checked above.
    const id: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const m = screenAffineToClipMat3(id, 100, 100);
    const [nx, ny] = applyMat3ColMajor(m, 100, 100);
    expect(nx).toBeCloseTo(1, PREC);
    expect(ny).toBeCloseTo(-1, PREC);
  });

  it("camera-centered affine maps world origin to NDC (0,0)", () => {
    // worldToScreenAffine with camera at world origin + viewport 200x100
    // yields e=cx=100, f=cy=50 (world 0,0 lands at screen center). The
    // composed mat3 should map world (0,0) to NDC (0,0).
    const aff: Affine = { a: 1, b: 0, c: 0, d: 1, e: 100, f: 50 };
    const m = screenAffineToClipMat3(aff, 200, 100);
    const [nx, ny] = applyMat3ColMajor(m, 0, 0);
    expect(nx).toBeCloseTo(0, PREC);
    expect(ny).toBeCloseTo(0, PREC);
  });

  it("zoom preserves right/down screen direction into +x/-y NDC direction", () => {
    // Pure zoom (a=d=2), centered origin (e=W/2, f=H/2). World (+1,+1) is
    // screen (cx+2, cy+2). Screen is Y-down, NDC is Y-up, so +screen-y is
    // -NDC-y. Magnitudes: (sx·2, sy·2) = (2·2/W, -2·2/H).
    const aff: Affine = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 };
    const m = screenAffineToClipMat3(aff, 200, 100);
    const [nx, ny] = applyMat3ColMajor(m, 1, 1);
    expect(nx).toBeGreaterThan(0);
    expect(ny).toBeLessThan(0);
    expect(nx).toBeCloseTo((2 * 2) / 200, PREC);
    expect(ny).toBeCloseTo((-2 * 2) / 100, PREC);
  });

  it("returns a Float32Array with third column (0,0,1) preserved", () => {
    const id: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const m = screenAffineToClipMat3(id, 100, 100);
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(9);
    expect(m[2]).toBe(0);
    expect(m[5]).toBe(0);
    expect(m[8]).toBe(1);
  });
});

describe("paletteToUniform — flatten 8 RGBA -> uniform array", () => {
  it("packs 8 entries into a length-32 Float32Array in row order", () => {
    const palette: RGBA[] = Array.from({ length: 8 }, (_, i) => [i / 8, 0, 0, 1]);
    const u = paletteToUniform(palette);
    expect(u).toBeInstanceOf(Float32Array);
    expect(u.length).toBe(32);
    expect(u[0]).toBe(0);
    expect(u[4]).toBe(1 / 8); // entry 1 .r
    expect(u[28]).toBe(7 / 8); // entry 7 .r
    expect(u[3]).toBe(1); // entry 0 .a
  });

  it("rejects a palette of the wrong length", () => {
    const tooShort: RGBA[] = Array.from({ length: 7 }, () => [0, 0, 0, 1]);
    expect(() => paletteToUniform(tooShort)).toThrow(/8 entries/);
    const tooLong: RGBA[] = Array.from({ length: 9 }, () => [0, 0, 0, 1]);
    expect(() => paletteToUniform(tooLong)).toThrow(/8 entries/);
  });
});

describe("quadWorldSize — quad spans the glow-padded cell in world units", () => {
  it("is CELL/GLYPH (world unit == one char cell)", () => {
    const [qw, qh] = quadWorldSize();
    expect(qw).toBeCloseTo(CELL_W / GLYPH_W, 10);
    expect(qh).toBeCloseTo(CELL_H / GLYPH_H, 10);
  });

  it("matches the concrete baked layout (41/9, 48/16)", () => {
    const [qw, qh] = quadWorldSize();
    expect(qw).toBeCloseTo(41 / 9, 10);
    expect(qh).toBeCloseTo(48 / 16, 10);
  });
});

describe("VRAMRenderer — constructor WebGL2 gate", () => {
  it("throws when WebGL2 is unavailable (jsdom has no WebGL2)", () => {
    const canvas = document.createElement("canvas");
    const palette: RGBA[] = Array.from({ length: 8 }, () => [1, 1, 1, 1]);
    expect(() => new VRAMRenderer({ canvas, palette })).toThrow(/WebGL2/);
  });
});
