import { describe, expect, it } from "vitest";

import {
  applyAffine,
  clampCamera,
  clampZoom,
  invertAffine,
  panBy,
  screenToWorld,
  shouldSnap,
  snapToGrid,
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

describe("snapToGrid", () => {
  it("snaps a world coordinate to the nearest grid step (default step=1)", () => {
    expect(snapToGrid(3.7)).toBe(4);
    expect(snapToGrid(3.2)).toBe(3);
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(-3.7)).toBe(-4);
    expect(snapToGrid(-3.2)).toBe(-3);
  });

  it("snaps with explicit step", () => {
    expect(snapToGrid(3.7, 2)).toBe(4);
    expect(snapToGrid(5.1, 2)).toBe(6);
    expect(snapToGrid(0, 5)).toBe(0);
    expect(snapToGrid(-3.7, 2)).toBe(-4);
  });

  it("returns the value unchanged when already on the grid", () => {
    expect(snapToGrid(5, 1)).toBe(5);
    expect(snapToGrid(10, 2)).toBe(10);
    expect(snapToGrid(-6, 3)).toBe(-6);
  });

  it("throws when step <= 0", () => {
    expect(() => snapToGrid(5, 0)).toThrow("Grid step must be > 0");
    expect(() => snapToGrid(5, -1)).toThrow("Grid step must be > 0");
    expect(() => snapToGrid(5, -0.5)).toThrow("Grid step must be > 0");
  });

  it("defaults to step=1 (1 char cell as world unit)", () => {
    // AC-1: 1 world unit == 1 char cell
    expect(snapToGrid(3.5)).toBe(4);
    expect(snapToGrid(3.49)).toBe(3);
  });
});

describe("shouldSnap", () => {
  it("returns true when world coord is within tolerance of a grid line", () => {
    // At zoom 1, tolPx=8 → tolerance in world = 8
    expect(shouldSnap(3.5, 1)).toBe(true); // distance to 4 = 0.5 ≤ 8
    expect(shouldSnap(7.9, 1)).toBe(true); // distance to 8 = 0.1 ≤ 8
    expect(shouldSnap(-2.1, 1)).toBe(true); // distance to -2 = 0.1 ≤ 8
  });

  it("returns false when world coord is beyond tolerance", () => {
    // Use large step so tolPx creates a meaningful threshold
    // step=10, zoom=1, tolPx=8 → tol = 8. Point 15: nearest 10 or 20, dist = 5 ≤ 8 → true
    expect(shouldSnap(15, 1, 10, 8)).toBe(true);
    // step=10, zoom=1, tolPx=4 → tol = 4. Point 15: dist = 5 > 4 → false (beyond tolerance)
    expect(shouldSnap(15, 1, 10, 4)).toBe(false);
    // step=10, tolPx=1 → tol = 1. Point 12: dist to 10 = 2 > 1 → false
    expect(shouldSnap(12, 1, 10, 1)).toBe(false);
  });

  it("returns false for any off-grid coordinate when tolPx=0", () => {
    expect(shouldSnap(3.7, 1, 1, 0)).toBe(false);
    expect(shouldSnap(0, 1, 1, 0)).toBe(true); // exactly on grid, distance=0 ≤ 0
  });

  it("scales tolerance with zoom: smaller zoom = larger world tolerance (AC-2)", () => {
    // AC-2: snapTolerance = 8 / currentZoom → screen-space tolerance always 8px
    // At zoom 0.5, tol = 16 world units. step=20: point 12, dist to 20 = 8 ≤ 16 → true
    expect(shouldSnap(12, 0.5, 20, 8)).toBe(true);
    // At zoom 4, tol = 2 world units. step=10: point 6, dist to 10 = 4 > 2 → false
    expect(shouldSnap(6, 4, 10, 8)).toBe(false);
    // Same world point, zoom 4: point 9, dist to 10 = 1 ≤ 2 → true
    expect(shouldSnap(9, 4, 10, 8)).toBe(true);
  });

  it("zoom makes tolerance screen-constant at 8px (AC-2)", () => {
    // When zoom doubles, world tolerance halves → screen stays 8px
    // At zoom 1: tol = 8. step=5: point 3, dist to 5 = 2 ≤ 8 → true
    expect(shouldSnap(3, 1, 5, 8)).toBe(true);
    // At zoom 2: tol = 4. step=5: point 3, dist to 5 = 2 ≤ 4 → true (same screen distance)
    expect(shouldSnap(3, 2, 5, 8)).toBe(true);
    // At zoom 2: step=5: point 8, dist to 10 = 2 ≤ 4 → true. But point 8, dist to 5 = 3 ≤ 4 → also true!
    // Pick a point clearly beyond: step=5, point 11, nearest = 10, dist = 1 ≤ 4 → true
    // step=5: point 13, dist to 15 = 2, dist to 10 = 3, min = 2 ≤ 4 → true
    // step=5: point 14, dist to 15 = 1 ≤ 4 → true
    // Need: step=5, tolPx=2 at zoom 4: tol = 0.5. Point 3.3, dist to 5 = 1.7 > 0.5 → false
    expect(shouldSnap(3.3, 4, 5, 2)).toBe(false);
    expect(shouldSnap(4.8, 4, 5, 2)).toBe(true); // dist to 5 = 0.2 ≤ 0.5
  });

  it("returns false when zoom makes tolerance too small", () => {
    // At zoom 20, tolerance = 8/20 = 0.4
    expect(shouldSnap(0.3, 20)).toBe(true); // distance to 0 = 0.3 ≤ 0.4
    expect(shouldSnap(0.5, 20)).toBe(false); // distance to 0 or 1 = 0.5 > 0.4
  });

  it("respects explicit step parameter", () => {
    // step=5 grid lines at 0, 5, 10, 15, ...
    expect(shouldSnap(12, 1, 5, 8)).toBe(true); // distance from 12 to 10 = 2 ≤ 8
    expect(shouldSnap(12, 1, 5, 4)).toBe(true); // distance = 2 ≤ 4
    expect(shouldSnap(12, 1, 5, 1)).toBe(false); // distance = 2 > 1
  });
});
