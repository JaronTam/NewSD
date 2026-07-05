// Element-to-RenderInstance builders for stock/cloud/flow.
//
// Each builder converts a domain element (Stock, Cloud) into an array of
// RenderInstance entries suitable for the VRAMRenderer instanced pipeline.
// Box-drawing glyphs come from BOX_GLYPHS (glowAtlas.ts), which is already
// baked into the glyph atlas — no re-bake needed.

import type { Cloud, SDElement, Stock } from "../sd/types";
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
): void {
  const glyphIdx = charToGlyphIdx(ch);
  if (glyphIdx < 0) return; // skip chars outside the baked charset
  // TODO(A1/A2 scaffold — L6): entityType is GPU-dead (no shader attrib
  // consumes it; see renderer.ts:32) and zOrder is sort-dead (render() draws
  // in array order; see renderer.ts:38/342). rotation is shader-live (a_rotation
  // rotates the quad in VERT_SRC) but hardcoded 0 here — no element rotates yet.
  // All three await M2 Step 2 (drag hot-path wiring, deferred to 1a.4) before
  // they carry real per-instance values. `selected` is live (M1 — vertex shader
  // effectiveLuma = a_lumaIdx + a_selected).
  out.push({
    glyphIdx,
    lumaIdx,
    colorIdx,
    worldX,
    worldY,
    entityType,
    zOrder: 0,
    rotation: 0,
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
 */
export function getElementBounds(el: SDElement): ElementBounds {
  if (el.kind === "stock") {
    return { x: el.x, y: el.y, width: el.width, height: el.height };
  }
  if (el.kind === "cloud") {
    return { x: el.x, y: el.y, width: CLOUD_W, height: CLOUD_H };
  }
  // flow — has no spatial position (1a.4 introduces fromId→toId edges)
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
