// NewSD canvas camera: Float64 world coordinates + 3x2 affine screen projection.
// Story 1a.1 sub-PR #3 (FR-CANVAS-1). Pure math, no DOM — fully unit-testable.
// The VRAM glyph render (AD-9) arrives in Story 1a.2 and consumes this camera.
//
// Coordinate convention:
//   - World coords are Float64, clamped to +/- WORLD_CLAMP (E7 precision guard,
//     epics.md line 287) so precision never degrades into glyph misplacement.
//   - The camera centers a world point (x, y) in the viewport and scales by zoom.
//   - 1 world unit == 1 monospace char cell (FR-CANVAS-2 pre-pave; CanvasView
//     draws cell-aligned grid lines so pan/zoom is visually verifiable).
//
// 3x2 affine (DOMMatrix [a,b,c,d,e,f]):
//   | a c e |   | wx |   | a*wx + c*wy + e |   | sx |
//   | b d f | * | wy | = | b*wx + d*wy + f | = | sy |
//   | 0 0 1 |   |  1 |   |       1         |   |  1 |
// For pan/zoom (no rotation/shear): a = d = zoom, b = c = 0,
// e = cx - x*zoom, f = cy - y*zoom, where (cx, cy) is the viewport center.

export const MIN_ZOOM = 0.05; // FR-CANVAS-1
export const MAX_ZOOM = 20; // FR-CANVAS-1
export const WORLD_CLAMP = 1e15; // E7 Float64 precision guard (epics.md line 287)

export interface Camera {
  /** World x at the viewport center. */
  x: number;
  /** World y at the viewport center. */
  y: number;
  /** Screen pixels per world unit (zoom factor). */
  zoom: number;
}

export interface Viewport {
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
}

export interface WorldRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Convert camera + viewport to the visible world-space rectangle.
 * Used for spatial-index culling (Story 1a.5, AC-2).
 */
export function viewportToWorldRect(cam: Camera, vp: Viewport): WorldRect {
  const [x0, y0] = screenToWorld(cam, vp, 0, 0);
  const [x1, y1] = screenToWorld(cam, vp, vp.width, vp.height);
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Build the world -> screen affine for a camera + viewport. */
export function worldToScreenAffine(cam: Camera, vp: Viewport): Affine {
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  return {
    a: cam.zoom,
    b: 0,
    c: 0,
    d: cam.zoom,
    e: cx - cam.x * cam.zoom,
    f: cy - cam.y * cam.zoom,
  };
}

/** Apply a 3x2 affine to a point. */
export function applyAffine(m: Affine, px: number, py: number): [number, number] {
  return [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f];
}

/** Inverse of a 3x2 affine (requires a*d - b*c != 0). */
export function invertAffine(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) throw new Error("singular affine (det=0)");
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv,
  };
}

/** Map a world point to screen pixels. */
export function worldToScreen(cam: Camera, vp: Viewport, wx: number, wy: number): [number, number] {
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  return [(wx - cam.x) * cam.zoom + cx, (wy - cam.y) * cam.zoom + cy];
}

/** Map a screen pixel to world coordinates. */
export function screenToWorld(cam: Camera, vp: Viewport, sx: number, sy: number): [number, number] {
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  return [(sx - cx) / cam.zoom + cam.x, (sy - cy) / cam.zoom + cam.y];
}

/**
 * Pan the view by a screen-space drag delta. Dragging the world +dx on screen
 * moves the camera center -dx/zoom in world space.
 */
export function panBy(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return {
    x: cam.x - dxScreen / cam.zoom,
    y: cam.y - dyScreen / cam.zoom,
    zoom: cam.zoom,
  };
}

/**
 * Zoom by `factor` anchored at screen point (sx, sy): the world point under the
 * cursor stays fixed after zoom. Returns a clamped camera (zoom + world bounds).
 */
export function zoomAt(cam: Camera, vp: Viewport, sx: number, sy: number, factor: number): Camera {
  const [wx, wy] = screenToWorld(cam, vp, sx, sy);
  const newZoom = clampZoom(cam.zoom * factor);
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  const nx = wx - (sx - cx) / newZoom;
  const ny = wy - (sy - cy) / newZoom;
  return clampCamera({ x: nx, y: ny, zoom: newZoom });
}

/** Clamp zoom to [MIN_ZOOM, MAX_ZOOM] (FR-CANVAS-1). */
export function clampZoom(z: number): number {
  if (z < MIN_ZOOM) return MIN_ZOOM;
  if (z > MAX_ZOOM) return MAX_ZOOM;
  return z;
}

/**
 * E7 precision guard: clamp zoom to [MIN_ZOOM, MAX_ZOOM] and world coords to
 * +/- WORLD_CLAMP so Float64 does not degrade at precision extremes.
 */
export function clampCamera(cam: Camera): Camera {
  return {
    x: clamp(cam.x, -WORLD_CLAMP, WORLD_CLAMP),
    y: clamp(cam.y, -WORLD_CLAMP, WORLD_CLAMP),
    zoom: clampZoom(cam.zoom),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Snap a world coordinate to the nearest grid multiple.
 *
 * AC-1/AC-3: 1 world unit == 1 char cell. Grid snap operates in world space.
 * World coords are Float64 (E7 precision guard — WORLD_CLAMP).
 *
 * @param world The world coordinate to snap.
 * @param step  Grid step in world units. Must be > 0 (throws otherwise).
 *              Default 1 = 1 char cell per grid line.
 */
export function snapToGrid(world: number, step = 1): number {
  if (step <= 0) throw new Error("Grid step must be > 0");
  return Math.round(world / step) * step;
}

/**
 * Whether a world coordinate is close enough to a grid line to "snap" visually.
 *
 * AC-2: screen-space snap tolerance is always 8 px regardless of zoom.
 * That translates to `snapTolerance = tolPx / zoom` in world units.
 *
 * @param world The world coordinate to test.
 * @param zoom  Current camera zoom (screen pixels per world unit).
 * @param step  Grid step in world units (default 1).
 * @param tolPx Screen-space snap tolerance in pixels (default 8).
 */
export function shouldSnap(world: number, zoom: number, step = 1, tolPx = 8): boolean {
  const nearest = snapToGrid(world, step);
  const dist = Math.abs(world - nearest);
  return dist <= tolPx / zoom;
}
