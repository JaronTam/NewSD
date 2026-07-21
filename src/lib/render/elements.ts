// Element-to-RenderInstance builders for stock/cloud/flow.
//
// Each builder converts a domain element (Stock, Cloud) into an array of
// RenderInstance entries suitable for the VRAMRenderer instanced pipeline.
// Box-drawing glyphs come from BOX_GLYPHS (glowAtlas.ts), which is already
// baked into the glyph atlas — no re-bake needed.

import type { Cloud, Flow, SDElement, Stock } from "../sd/types";
import { charToGlyphIdx } from "./vram/glowAtlas";
import type { RenderInstance } from "./vram/renderer";

// ---- entity type enum (CPU-side; matches shader convention) ---------------

export const EntityType = {
  STOCK: 0,
  CLOUD: 1,
  FLOW: 2,
} as const;

// ---- helpers ----------------------------------------------------------------

function pushChar(
  out: RenderInstance[],
  ch: string,
  worldX: number,
  worldY: number,
  colorIdx: number,
  lumaIdx: number,
  entityType: number,
  selected: boolean,
  rotation = 0,
): void {
  const glyphIdx = charToGlyphIdx(ch);
  if (glyphIdx < 0) return; // skip chars outside the baked charset
  out.push({
    glyphIdx,
    lumaIdx,
    colorIdx,
    worldX,
    worldY,
    entityType,
    zOrder: 0,
    rotation,
    selected,
  });
}

function pushString(
  out: RenderInstance[],
  s: string,
  startX: number,
  y: number,
  colorIdx: number,
  lumaIdx: number,
  entityType: number,
  selected: boolean,
): void {
  for (let i = 0; i < s.length; i++) {
    pushChar(out, s[i], startX + i, y, colorIdx, lumaIdx, entityType, selected);
  }
}

// ---- stock → instances ------------------------------------------------------

/**
 * Convert a Stock domain element into a list of RenderInstance entries.
 *
 * Renders an ASCII box using BOX_GLYPHS characters (┌─┐│└┘) with the
 * stock name, value, and (optional) units centered inside.
 *
 * @param stock      The stock domain element
 * @param simRunning If true, display `currentValue`; otherwise `initialValue`
 * @param selected   If true, marks instances selected — the vertex shader lifts
 *                   the luma band by one level (A2 path via `a_selected`), giving
 *                   a selection glow (AC-13). No CPU luma bump.
 */
export function stockToInstances(
  stock: Stock,
  simRunning: boolean,
  selected = false,
): RenderInstance[] {
  const out: RenderInstance[] = [];
  const { x, y, width: w, height: h } = stock;

  // Build display text: "name value [units]"
  const value = simRunning ? stock.currentValue : stock.initialValue;
  const displayText =
    stock.units.length > 0 ? `${stock.name} ${value} ${stock.units}` : `${stock.name} ${value}`;

  // Top edge: ┌─…─┐
  pushChar(out, "┌", x, y, 0, 0, EntityType.STOCK, selected); // ┌
  for (let col = 1; col < w - 1; col++) {
    pushChar(out, "─", x + col, y, 0, 0, EntityType.STOCK, selected); // ─
  }
  pushChar(out, "┐", x + w - 1, y, 0, 0, EntityType.STOCK, selected); // ┐

  // Middle rows
  for (let row = 1; row < h - 1; row++) {
    // Left border
    pushChar(out, "│", x, y + row, 0, 0, EntityType.STOCK, selected); // │

    // Content on the first interior row
    if (row === 1) {
      const textLen = Math.min(displayText.length, w - 2);
      const padLeft = Math.floor((w - 2 - textLen) / 2);
      // Fill left padding with spaces
      for (let col = 1; col < 1 + padLeft; col++) {
        pushChar(out, " ", x + col, y + row, 0, 0, EntityType.STOCK, selected);
      }
      // Display text
      pushString(
        out,
        displayText.slice(0, textLen),
        x + 1 + padLeft,
        y + row,
        0,
        0,
        EntityType.STOCK,
        selected,
      );
      // Fill remaining interior with spaces
      const used = padLeft + textLen;
      for (let col = 1 + used; col < w - 1; col++) {
        pushChar(out, " ", x + col, y + row, 0, 0, EntityType.STOCK, selected);
      }
    } else {
      // Other interior rows: just spaces
      for (let col = 1; col < w - 1; col++) {
        pushChar(out, " ", x + col, y + row, 0, 0, EntityType.STOCK, selected);
      }
    }

    // Right border
    pushChar(out, "│", x + w - 1, y + row, 0, 0, EntityType.STOCK, selected); // │
  }

  // Bottom edge: └─…─┘
  pushChar(out, "└", x, y + h - 1, 0, 0, EntityType.STOCK, selected); // └
  for (let col = 1; col < w - 1; col++) {
    pushChar(out, "─", x + col, y + h - 1, 0, 0, EntityType.STOCK, selected); // ─
  }
  pushChar(out, "┘", x + w - 1, y + h - 1, 0, 0, EntityType.STOCK, selected); // ┘

  return out;
}

// ---- cloud → instances ------------------------------------------------------

/** ASCII cloud shape (6 cols × 3 rows). Rows 0 and 2 are mirror-symmetric. */
const CLOUD_SHAPE = [" .--. ", "(    )", " '--' "];

/**
 * Convert a Cloud domain element into a list of RenderInstance entries.
 *
 * Renders a 6×3 ASCII cloud icon at `(cloud.x, cloud.y)` in world space.
 * colorIdx=2 (cloud violet), entityType=CLOUD.
 *
 * @param selected If true, marks instances selected — vertex shader lifts the
 *                 luma band (A2 path via `a_selected`) for a selection glow.
 */
export function cloudToInstances(cloud: Cloud, selected = false): RenderInstance[] {
  const out: RenderInstance[] = [];
  const { x, y } = cloud;

  for (let row = 0; row < CLOUD_SHAPE.length; row++) {
    const line = CLOUD_SHAPE[row];
    for (let col = 0; col < line.length; col++) {
      pushChar(out, line[col], x + col, y + row, 2, 0, EntityType.CLOUD, selected);
    }
  }

  return out;
}

// ---- hit testing -----------------------------------------------------------

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cloud icon is 6 cols × 3 rows (fixed). */
const CLOUD_W = CLOUD_SHAPE[0].length; // 6
const CLOUD_H = CLOUD_SHAPE.length; // 3

/**
 * Return the world-space bounding box for an element.
 * Stock bounds = (x, y, width, height).
 * Cloud bounds = (x, y, 6, 3) — fixed icon size.
 * Flow bounds = computed from the rendered Manhattan path when `allElements`
 *   is provided so endpoints can be resolved; otherwise {0,0,0,0}.
 */
export function getElementBounds(el: SDElement, allElements?: readonly SDElement[]): ElementBounds {
  if (el.kind === "stock") {
    return { x: el.x, y: el.y, width: el.width, height: el.height };
  }
  if (el.kind === "cloud") {
    return { x: el.x, y: el.y, width: CLOUD_W, height: CLOUD_H };
  }
  // flow — bbox from rendered instances when endpoints are available
  if (el.kind === "flow" && allElements) {
    const instances = flowToInstances(el, allElements, false);
    if (instances.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ri of instances) {
      if (ri.worldX < minX) minX = ri.worldX;
      if (ri.worldY < minY) minY = ri.worldY;
      if (ri.worldX > maxX) maxX = ri.worldX;
      if (ri.worldY > maxY) maxY = ri.worldY;
    }
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }
  return { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Find the topmost element at the given world coordinate.
 * Returns null if no element is hit.
 */
export function findElementAt(
  wx: number,
  wy: number,
  elements: readonly SDElement[],
): SDElement | null {
  // Scan in reverse (topmost = last drawn); first hit wins.
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const b = getElementBounds(el);
    if (wx >= b.x && wx < b.x + b.width && wy >= b.y && wy < b.y + b.height) {
      return el;
    }
  }
  return null;
}

// ---- resize (AC-7 调整大小; Story 1a.3 CR followup L9) ---------------------
//
// Stock-only: cloud is a fixed 6×3 icon (AC-12) and flow has no spatial
// extent (1a.4), so neither is resizable. The caller (CanvasView) hit-tests
// a screen-space corner zone, then calls resizeStock with the (already
// snapped) world pointer to compute the new geometry.

/** Which corner is being dragged. */
export type ResizeHandle = "nw" | "ne" | "sw" | "se";

/** All four corner handles, in scan order (used by CanvasView hit-test). */
export const RESIZE_HANDLES: readonly ResizeHandle[] = ["nw", "ne", "sw", "se"];

/**
 * Compute new stock geometry when dragging a corner handle to world (wx, wy).
 *
 * AC-7 (resize): the opposite corner stays fixed; the dragged corner follows
 * the pointer. AC-1/2/3 (snap): the caller snaps wx/wy before calling, so the
 * result is grid-aligned. AC-8/9 (size guard): width/height clamp to >=3
 * (matches validateStockSize); when a drag would shrink a dimension below 3,
 * the moving edge is pinned to opposite ± 3 so the box never inverts.
 *
 * Pure world-space math — no camera/DOM dependency (unit-tested directly).
 */
export function resizeStock(
  stock: Stock,
  handle: ResizeHandle,
  wx: number,
  wy: number,
): ElementBounds {
  const right = stock.x + stock.width;
  const bottom = stock.y + stock.height;
  // Edges: left/top/right/bottom. The handle selects which pair moves.
  let left = stock.x;
  let top = stock.y;
  let r = right;
  let b = bottom;
  if (handle === "nw") {
    left = wx;
    top = wy;
  } else if (handle === "ne") {
    r = wx;
    top = wy;
  } else if (handle === "sw") {
    left = wx;
    b = wy;
  } else {
    // se
    r = wx;
    b = wy;
  }

  // Width/height from edges; clamp to >=3 (AC-8/9). The moving edge is pinned
  // to the fixed opposite edge ± 3 so the dimension never goes negative.
  const movesLeft = handle === "nw" || handle === "sw";
  const movesTop = handle === "nw" || handle === "ne";
  let width = r - left;
  let height = b - top;
  if (width < 3) {
    if (movesLeft) left = r - 3;
    else r = left + 3;
    width = 3;
  }
  if (height < 3) {
    if (movesTop) top = b - 3;
    else b = top + 3;
    height = 3;
  }
  return { x: left, y: top, width, height };
}

// ---- flow → instances (Story 1a.4) ------------------------------------------

/** A connection port on an element edge. */
export interface Port {
  elementId: string;
  side: "N" | "S" | "E" | "W";
  x: number;
  y: number;
}

/**
 * Return the four edge-midpoint ports for a stock or cloud element (AC-9).
 *
 * Stock ports use **inclusive bounds** (S at `y+h-1`, E at `x+w-1`) so the
 * port sits on the element's edge cell (not one cell beyond it), and the
 * midpoint coords are `Math.round`-ed to the integer character-cell grid
 * (spec AC-9 "取整"). Cloud ports are the **fixed 6×3 icon** edge midpoints
 * (`N:(x+3,y+0)` / `S:(x+3,y+2)` / `E:(x+5,y+1)` / `W:(x+0,y+1)`) — NOT the
 * generic bounding-box center, so E/W land on integer cells (the generic
 * center `y+1.5` would be half-integer and off the grid). Flow elements have
 * no spatial extent and return [].
 */
export function getElementPorts(el: SDElement): Port[] {
  if (el.kind === "flow") return [];
  const b = getElementBounds(el);
  if (el.kind === "cloud") {
    // AC-9: cloud fixed 6×3 ports (mirror stock口径, integer cells).
    return [
      { elementId: el.id, side: "N", x: b.x + 3, y: b.y + 0 },
      { elementId: el.id, side: "S", x: b.x + 3, y: b.y + 2 },
      { elementId: el.id, side: "E", x: b.x + 5, y: b.y + 1 },
      { elementId: el.id, side: "W", x: b.x + 0, y: b.y + 1 },
    ];
  }
  // stock: edge midpoints, inclusive bounds, rounded to integer grid.
  // Coupled to getElementBounds which returns inclusive bounds (y+h-1, x+w-1);
  // the S/E port coords rely on that contract so ports sit on the element's
  // edge cell rather than one cell beyond it (AC-9).
  const cx = Math.round(b.x + b.width / 2);
  const cy = Math.round(b.y + b.height / 2);
  return [
    { elementId: el.id, side: "N", x: cx, y: b.y },
    { elementId: el.id, side: "S", x: cx, y: b.y + b.height - 1 },
    { elementId: el.id, side: "E", x: b.x + b.width - 1, y: cy },
    { elementId: el.id, side: "W", x: b.x, y: cy },
  ];
}

/**
 * Find the nearest port to (wx, wy) within `threshold` (Euclidean-inclusive:
 * straight-line distance ≤ threshold snaps; ties break by first encountered).
 * Returns null when no port is within range.
 */
export function findNearestPort(
  wx: number,
  wy: number,
  ports: readonly Port[],
  threshold: number,
): Port | null {
  let best: Port | null = null;
  let bestDist = Infinity;
  for (const p of ports) {
    const dx = p.x - wx;
    const dy = p.y - wy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** Center (cx, cy) of an element's bounding box (float — used for port pairing only). */
export function getElementCenter(el: SDElement): { x: number; y: number } {
  const b = getElementBounds(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Pick the port whose position is closest (squared Euclidean) to `target`. */
function nearestPort(ports: readonly Port[], target: { x: number; y: number }): Port {
  let best = ports[0];
  let bestD = Infinity;
  for (const p of ports) {
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Box-drawing corner glyph for a Manhattan turn cell, given the step signs.
 *
 * At the turn cell (tx, fy) the H-arm points back toward the source
 * (sign = -stepX) and the V-arm points toward the target (sign = stepY).
 *   (stepX, stepY) = (+1, +1) → arms W+S → ┐
 *                    (+1, -1) → arms W+N → ┘
 *                    (-1, +1) → arms E+S → ┌
 *                    (-1, -1) → arms E+N → └
 */
function cornerGlyph(stepX: number, stepY: number): string {
  if (stepX > 0 && stepY > 0) return "┐";
  if (stepX > 0 && stepY < 0) return "┘";
  if (stepX < 0 && stepY > 0) return "┌";
  if (stepX < 0 && stepY < 0) return "└";
  throw new Error(`cornerGlyph: invalid step (${stepX}, ${stepY})`);
}

/** Dedup per-frame dangling-flow warnings (AC-12c — once per flow ID). */
export const warnedDanglingFlows = new Set<string>();

/**
 * Convert a Flow element into an array of RenderInstance entries.
 *
 * AC-6 Manhattan orthogonal routing (horizontal-first): draw an axis-aligned
 * path from the source port to the target port using box-drawing glyphs
 * (`─` horizontal, `│` vertical, `┌┐└┘` corners) plus a `▶` arrowhead.
 *
 * AC-7 markers: a `▼` (variable flow) or `○` (constant flow) glyph is placed
 * one cell into the path from the source port (`fromPort + firstSegDir`),
 * drawn after the path so it sits on top. AC-7 arrow rotation:
 *   0 → E, π/2 → S, π → W, -π/2 → N
 *
 * AC-12c dangling ref guard: when either endpoint element is absent the
 * function emits a `console.warn` and returns an empty array (graceful
 * degradation — no throw).
 *
 * B1 (arrow visibility): the arrowhead is placed one cell short of the target
 * port (`toPort - lastSegDir`) so it lands in the gap between path and target
 * node rather than on the node's own edge glyph (which would occlude it). For
 * degenerate adjacent nodes (no gap cell) it falls back to the to-port cell.
 *
 * @param flow     The flow domain element (id, fromId/toId, isVariable).
 * @param elements All elements in the scene — used to resolve endpoint ports
 *                 via getElementPorts (single source of truth for port coords).
 * @param selected If true, all instances carry `selected=true` (A2 glow path).
 */
export function flowToInstances(
  flow: Flow,
  elements: readonly SDElement[],
  selected = false,
): RenderInstance[] {
  // AC-12c: dangling endpoint → warn + graceful empty (no throw).
  const fromEl = elements.find((e) => e.id === flow.fromId);
  const toEl = elements.find((e) => e.id === flow.toId);
  if (!fromEl || !toEl) {
    if (!warnedDanglingFlows.has(flow.id)) {
      warnedDanglingFlows.add(flow.id);
      console.warn(`flow ${flow.id} has dangling endpoint`);
    }
    return [];
  }

  // F11: reuse getElementPorts (single source for port coords) instead of
  // re-deriving them here with a divergent formula.
  const fromPorts = getElementPorts(fromEl);
  const toPorts = getElementPorts(toEl);
  if (fromPorts.length === 0 || toPorts.length === 0) return [];

  // Pick the from-port closest to the to-element center, and vice versa.
  const fromP = nearestPort(fromPorts, getElementCenter(toEl));
  const toP = nearestPort(toPorts, getElementCenter(fromEl));

  // Snap to integer grid (getElementPorts already returns integers; round
  // defensively in case bounds are ever fractional).
  const fx = Math.round(fromP.x);
  const fy = Math.round(fromP.y);
  const tx = Math.round(toP.x);
  const ty = Math.round(toP.y);

  const COLOR_IDX = 1; // flow magenta (palette index 1)
  const ET = EntityType.FLOW;

  const dx = tx - fx;
  const dy = ty - fy;

  // Degenerate same-cell ports (dx=0, dy=0): no path to draw, return empty.
  if (dx === 0 && dy === 0) return [];

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;

  // ---- segment directions (horizontal-first) ---------------------------
  const firstDirX = dx !== 0 ? stepX : 0;
  const firstDirY = dx !== 0 ? 0 : stepY;
  const lastDirX = dy !== 0 ? 0 : stepX;
  const lastDirY = dy !== 0 ? stepY : 0;

  // ---- arrow rotation (AC-7) -------------------------------------------
  let arrowRot: number;
  if (lastDirY !== 0) {
    arrowRot = lastDirY > 0 ? Math.PI / 2 : -Math.PI / 2; // S or N
  } else {
    arrowRot = lastDirX > 0 ? 0 : Math.PI; // E or W
  }

  const out: RenderInstance[] = [];

  // ---- Manhattan routing (horizontal-first) ----------------------------
  // H-segment: (fx, fy) → (tx, fy). When a V-segment follows, the cell at
  // (tx, fy) is the turn point → corner glyph; otherwise (straight H) it is
  // the to-port on the target node and is left for the node to draw.
  if (dx !== 0) {
    for (let x = fx + stepX; stepX > 0 ? x <= tx : x >= tx; x += stepX) {
      if (dy !== 0 && x === tx) {
        pushChar(out, cornerGlyph(stepX, stepY), x, fy, COLOR_IDX, 0, ET, selected, 0);
      } else if (x === tx) {
        break; // straight horizontal: to-port belongs to the target node
      } else {
        pushChar(out, "─", x, fy, COLOR_IDX, 0, ET, selected, 0);
      }
    }
  }

  // V-segment: (tx, fy) → (tx, ty). The to-port (tx, ty) is on the target
  // node; the loop excludes it. The arrow cell (tx, ty - stepY) may be drawn
  // here as │ and then overwritten by the arrowhead below.
  if (dy !== 0) {
    for (let y = fy + stepY; stepY > 0 ? y < ty : y > ty; y += stepY) {
      pushChar(out, "│", tx, y, COLOR_IDX, 0, ET, selected, 0);
    }
  }

  // ---- source marker (AC-7: ▼ variable / ○ constant, after path) -------
  pushChar(
    out,
    flow.isVariable ? "▼" : "○",
    fx + firstDirX,
    fy + firstDirY,
    COLOR_IDX,
    0,
    ET,
    selected,
    0,
  );

  // ---- arrowhead (B1: one cell short of the to-port, in the gap) -------
  let ax = tx - lastDirX;
  let ay = ty - lastDirY;
  // Degenerate adjacent nodes (no gap cell): fall back to the to-port.
  if ((ax === fx && ay === fy) || (ax === tx && ay === ty)) {
    ax = tx;
    ay = ty;
  }
  pushChar(out, "▶", ax, ay, COLOR_IDX, 0, ET, selected, arrowRot);

  return out;
}
