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
    rotation: 0,
    selected: false,
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
): void {
  for (let i = 0; i < s.length; i++) {
    pushChar(out, s[i], startX + i, y, colorIdx, lumaIdx, entityType);
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
 * @param selected   If true, bump lumaIdx for a selection glow (AC-13)
 */
export function stockToInstances(
  stock: Stock,
  simRunning: boolean,
  selected = false,
): RenderInstance[] {
  const out: RenderInstance[] = [];
  const { x, y, width: w, height: h } = stock;
  const baseLuma = selected ? 1 : 0; // A2: selected bumps luma level by 1

  // Build display text: "name value [units]"
  const value = simRunning ? stock.currentValue : stock.initialValue;
  const displayText =
    stock.units.length > 0 ? `${stock.name} ${value} ${stock.units}` : `${stock.name} ${value}`;

  // Top edge: ┌─…─┐
  pushChar(out, "┌", x, y, 0, baseLuma, EntityType.STOCK); // ┌
  for (let col = 1; col < w - 1; col++) {
    pushChar(out, "─", x + col, y, 0, baseLuma, EntityType.STOCK); // ─
  }
  pushChar(out, "┐", x + w - 1, y, 0, baseLuma, EntityType.STOCK); // ┐

  // Middle rows
  for (let row = 1; row < h - 1; row++) {
    // Left border
    pushChar(out, "│", x, y + row, 0, baseLuma, EntityType.STOCK); // │

    // Content on the first interior row
    if (row === 1) {
      const textLen = Math.min(displayText.length, w - 2);
      const padLeft = Math.floor((w - 2 - textLen) / 2);
      // Fill left padding with spaces
      for (let col = 1; col < 1 + padLeft; col++) {
        pushChar(out, " ", x + col, y + row, 0, baseLuma, EntityType.STOCK);
      }
      // Display text
      pushString(
        out,
        displayText.slice(0, textLen),
        x + 1 + padLeft,
        y + row,
        0,
        baseLuma,
        EntityType.STOCK,
      );
      // Fill remaining interior with spaces
      const used = padLeft + textLen;
      for (let col = 1 + used; col < w - 1; col++) {
        pushChar(out, " ", x + col, y + row, 0, baseLuma, EntityType.STOCK);
      }
    } else {
      // Other interior rows: just spaces
      for (let col = 1; col < w - 1; col++) {
        pushChar(out, " ", x + col, y + row, 0, baseLuma, EntityType.STOCK);
      }
    }

    // Right border
    pushChar(out, "│", x + w - 1, y + row, 0, baseLuma, EntityType.STOCK); // │
  }

  // Bottom edge: └─…─┘
  pushChar(out, "└", x, y + h - 1, 0, baseLuma, EntityType.STOCK); // └
  for (let col = 1; col < w - 1; col++) {
    pushChar(out, "─", x + col, y + h - 1, 0, baseLuma, EntityType.STOCK); // ─
  }
  pushChar(out, "┘", x + w - 1, y + h - 1, 0, baseLuma, EntityType.STOCK); // ┘

  return out;
}

// ---- cloud → instances ------------------------------------------------------

/** ASCII cloud shape (5 cols × 3 rows). */
const CLOUD_SHAPE = [" .--. ", "(    )", "'--'  "];

/**
 * Convert a Cloud domain element into a list of RenderInstance entries.
 *
 * Renders a 5×3 ASCII cloud icon at `(cloud.x, cloud.y)` in world space.
 * colorIdx=2 (cloud violet), entityType=CLOUD.
 */
export function cloudToInstances(cloud: Cloud): RenderInstance[] {
  const out: RenderInstance[] = [];
  const { x, y } = cloud;

  for (let row = 0; row < CLOUD_SHAPE.length; row++) {
    const line = CLOUD_SHAPE[row];
    for (let col = 0; col < line.length; col++) {
      pushChar(out, line[col], x + col, y + row, 2, 0, EntityType.CLOUD);
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
