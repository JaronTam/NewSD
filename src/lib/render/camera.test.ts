import { describe, expect, it } from "vitest";

import {
  applyAffine,
  clampCamera,
  clampZoom,
  invertAffine,
  panBy,
  screenToWorld,
  worldToScreen,
  worldToScreenAffine,
  zoomAt,
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_CLAMP,
  type Camera,
  type Viewport,
} from "./camera";

// FR-CANVAS-1 numeric guarantees: Float64 world coords, 3x2 affine
// world<->screen, cursor-anchored zoom, zoom clamp [0.05, 20], E7 world clamp.
const VP: Viewport = { width: 1000, height: 600 };
const ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };

describe("worldToScreen / screenToWorld", () => {
  it("maps the world origin to the viewport center", () => {
    const [sx, sy] = worldToScreen(ORIGIN, VP, 0, 0);
    expect(sx).toBe(500);
    expect(sy).toBe(300);
  });

  it("scales world distance by zoom", () => {
    const cam: Camera = { x: 0, y: 0, zoom: 2 };
    const [sx] = worldToScreen(cam, VP, 10, 0);
    expect(sx).toBe(500 + 20); // 10 world units * zoom 2
  });

  it("is the exact inverse of screenToWorld across the camera space", () => {
    const cam: Camera = { x: 42, y: -17, zoom: 3.5 };
    const points: Array<[number, number]> = [
      [0, 0],
      [100, 200],
      [-50, 7],
      [1234, -999],
    ];
    for (const [wx, wy] of points) {
      const [sx, sy] = worldToScreen(cam, VP, wx, wy);
      const [bx, by] = screenToWorld(cam, VP, sx, sy);
      expect(bx).toBeCloseTo(wx, 10);
      expect(by).toBeCloseTo(wy, 10);
    }
  });
});

describe("affine matrix", () => {
  it("matches the direct worldToScreen mapping", () => {
    const cam: Camera = { x: 5, y: 5, zoom: 4 };
    const m = worldToScreenAffine(cam, VP);
    const points: Array<[number, number]> = [
      [0, 0],
      [3, 7],
      [-2, 9],
    ];
    for (const [wx, wy] of points) {
      const [ax, ay] = applyAffine(m, wx, wy);
      const [dx, dy] = worldToScreen(cam, VP, wx, wy);
      expect(ax).toBeCloseTo(dx, 10);
      expect(ay).toBeCloseTo(dy, 10);
    }
  });

  it("invertAffine is the inverse of the forward affine", () => {
    const cam: Camera = { x: 9, y: -4, zoom: 2.5 };
    const m = worldToScreenAffine(cam, VP);
    const mi = invertAffine(m);
    const points: Array<[number, number]> = [
      [1, 1],
      [-3, 8],
      [50, -50],
    ];
    for (const [wx, wy] of points) {
      const [sx, sy] = applyAffine(m, wx, wy);
      const [bx, by] = applyAffine(mi, sx, sy);
      expect(bx).toBeCloseTo(wx, 9);
      expect(by).toBeCloseTo(wy, 9);
    }
  });

  it("throws on a singular (det=0) affine", () => {
    expect(() => invertAffine({ a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 })).toThrow();
  });
});

describe("panBy", () => {
  it("moves the camera opposite to the screen drag at zoom 1", () => {
    const next = panBy(ORIGIN, 100, 50);
    expect(next.x).toBe(-100);
    expect(next.y).toBe(-50);
    expect(next.zoom).toBe(1);
  });

  it("scales the drag delta by 1/zoom in world space", () => {
    const cam: Camera = { x: 0, y: 0, zoom: 4 };
    const next = panBy(cam, 100, 0);
    expect(next.x).toBe(-25); // 100 / 4
  });
});

describe("zoomAt", () => {
  it("doubles zoom when zooming into the viewport center", () => {
    const next = zoomAt({ x: 0, y: 0, zoom: 1 }, VP, 500, 300, 2);
    expect(next.zoom).toBe(2);
    expect(next.x).toBeCloseTo(0, 10);
    expect(next.y).toBeCloseTo(0, 10);
  });

  it("keeps the world point under the cursor fixed across zoom", () => {
    const cam: Camera = { x: 10, y: 10, zoom: 1 };
    const sx = 123;
    const sy = 87;
    const [wxBefore, wyBefore] = screenToWorld(cam, VP, sx, sy);
    const next = zoomAt(cam, VP, sx, sy, 3);
    const [wxAfter, wyAfter] = screenToWorld(next, VP, sx, sy);
    expect(wxAfter).toBeCloseTo(wxBefore, 10);
    expect(wyAfter).toBeCloseTo(wyBefore, 10);
  });

  it("clamps to MAX_ZOOM on zoom-in past the bound", () => {
    const next = zoomAt({ x: 0, y: 0, zoom: 18 }, VP, 500, 300, 4);
    expect(next.zoom).toBe(MAX_ZOOM);
  });

  it("clamps to MIN_ZOOM on zoom-out past the bound", () => {
    const next = zoomAt({ x: 0, y: 0, zoom: 0.1 }, VP, 500, 300, 0.1);
    expect(next.zoom).toBe(MIN_ZOOM);
  });
});

describe("clampCamera (E7 precision guard)", () => {
  it("clamps zoom to [MIN_ZOOM, MAX_ZOOM]", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
    expect(clampCamera({ x: 0, y: 0, zoom: 0 }).zoom).toBe(MIN_ZOOM);
    expect(clampCamera({ x: 0, y: 0, zoom: 1000 }).zoom).toBe(MAX_ZOOM);
  });

  it("clamps world coords to +/- 1e15", () => {
    const big = WORLD_CLAMP * 10;
    const c = clampCamera({ x: big, y: -big, zoom: 1 });
    expect(c.x).toBe(WORLD_CLAMP);
    expect(c.y).toBe(-WORLD_CLAMP);
  });

  it("leaves in-range cameras unchanged", () => {
    const c = clampCamera({ x: 5, y: -3, zoom: 2 });
    expect(c).toEqual({ x: 5, y: -3, zoom: 2 });
  });
});
