// Dirty-rect tracker for incremental render decisions (Story 1a.5, AC-3/AC-5).
//
// CS钉死 #5: 3-branch render decision — camera/first-frame → full rebuild;
// !camera && hasDirty → rebuild dirty + full redraw; static → skip WebGL.
// CS钉死 #6: queryLowPrecision(step) API contract locked for 1a.6 minimap.
// WebGL scissor is explicitly out-of-scope (CS钉死 #5).
//
// AC-5: queryLowPrecision returns grid-coarsened dirty rects for the minimap.
// 1a.6 consumes this API without changing the signature.

import type { WorldRect } from "./camera";

// ---- DirtyRectTracker ----------------------------------------------------

export class DirtyRectTracker {
  private rects: WorldRect[] = [];
  private dirtyIds = new Set<string>();

  /** Record a world-space rect that needs redraw. */
  markDirty(rect: WorldRect, elementId?: string): void {
    this.rects.push(rect);
    if (elementId) this.dirtyIds.add(elementId);
  }

  /** True when any dirty rects are pending. */
  hasDirty(): boolean {
    return this.rects.length > 0;
  }

  /** Drain all pending dirty rects and element IDs, resetting state. */
  consume(): { rects: WorldRect[]; elementIds: Set<string> } {
    const result = { rects: [...this.rects], elementIds: new Set(this.dirtyIds) };
    this.rects = [];
    this.dirtyIds.clear();
    return result;
  }

  /** Discard all pending dirty rects without processing. */
  clear(): void {
    this.rects = [];
    this.dirtyIds.clear();
  }

  /**
   * AC-5 contract (locked for 1a.6 minimap): return dirty rects coarsened to
   * a step-width world-unit grid. Each rect is snapped outward to the nearest
   * step multiple, and identical coarse rects are deduplicated.
   *
   * Returns [] when no dirty rects are pending.
   */
  queryLowPrecision(step: number): WorldRect[] {
    if (step <= 0) throw new Error("Grid step must be > 0");
    if (this.rects.length === 0) return [];

    const grid = new Map<string, WorldRect>();
    for (const r of this.rects) {
      const gx0 = Math.floor(r.minX / step) * step;
      const gy0 = Math.floor(r.minY / step) * step;
      const gx1 = Math.ceil(r.maxX / step) * step;
      const gy1 = Math.ceil(r.maxY / step) * step;
      // Skip zero-area coarse rects (degenerate inputs snapped to nothing).
      if (gx0 === gx1 && gy0 === gy1) continue;
      const key = `${gx0},${gy0},${gx1},${gy1}`;
      if (!grid.has(key)) {
        grid.set(key, { minX: gx0, minY: gy0, maxX: gx1, maxY: gy1 });
      }
    }
    return Array.from(grid.values());
  }
}

// ---- rect utilities ------------------------------------------------------

/** True when two world rects overlap (touching edges count). */
export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
