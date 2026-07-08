import { describe, expect, it } from "vitest";
import { DirtyRectTracker, rectsIntersect } from "./dirty-rect";
import type { WorldRect } from "./camera";

function rect(minX: number, minY: number, maxX: number, maxY: number): WorldRect {
  return { minX, minY, maxX, maxY };
}

// ---- DirtyRectTracker ---------------------------------------------------

describe("DirtyRectTracker", () => {
  describe("markDirty / hasDirty / clear", () => {
    it("hasDirty returns false when no rects have been marked", () => {
      const t = new DirtyRectTracker();
      expect(t.hasDirty()).toBe(false);
    });

    it("hasDirty returns true after markDirty", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 10, 10));
      expect(t.hasDirty()).toBe(true);
    });

    it("clear resets to empty", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 10, 10));
      t.clear();
      expect(t.hasDirty()).toBe(false);
    });

    it("clear resets element IDs too", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 10, 10), "el-1");
      t.clear();
      const { elementIds } = t.consume();
      expect(elementIds.size).toBe(0);
    });
  });

  describe("consume (drain)", () => {
    it("returns and drains all dirty rects", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 5, 5));
      t.markDirty(rect(10, 10, 15, 15));

      const { rects } = t.consume();
      expect(rects).toHaveLength(2);
      expect(t.hasDirty()).toBe(false);
    });

    it("consume on empty tracker returns empty arrays", () => {
      const t = new DirtyRectTracker();
      const { rects, elementIds } = t.consume();
      expect(rects).toEqual([]);
      expect(elementIds.size).toBe(0);
    });

    it("tracks element IDs alongside rects", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 10, 10), "el-a");
      t.markDirty(rect(20, 20, 30, 30), "el-b");
      t.markDirty(rect(40, 40, 50, 50)); // no ID

      const { elementIds } = t.consume();
      expect(elementIds.has("el-a")).toBe(true);
      expect(elementIds.has("el-b")).toBe(true);
      expect(elementIds.size).toBe(2);
    });

    it("second consume after first returns empty (drain semantics)", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 1, 1));
      t.consume();

      const { rects } = t.consume();
      expect(rects).toEqual([]);
    });
  });

  describe("queryLowPrecision (AC-5)", () => {
    it("returns [] when no dirty rects are pending", () => {
      const t = new DirtyRectTracker();
      expect(t.queryLowPrecision(10)).toEqual([]);
    });

    it("coarsens a single rect to step-sized grid", () => {
      const t = new DirtyRectTracker();
      // rect (3, 5, 7, 12) with step=10:
      // floor(3/10)*10=0, floor(5/10)*10=0, ceil(7/10)*10=10, ceil(12/10)*10=20
      t.markDirty(rect(3, 5, 7, 12));
      const result = t.queryLowPrecision(10);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(rect(0, 0, 10, 20));
    });

    it("coarsens to step=1 (identity, but snapped outward)", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(3.3, 5.7, 7.1, 12.9));
      const result = t.queryLowPrecision(1);
      expect(result).toHaveLength(1);
      // floor(3.3)=3, floor(5.7)=5, ceil(7.1)=8, ceil(12.9)=13
      expect(result[0]).toEqual(rect(3, 5, 8, 13));
    });

    it("deduplicates identical coarse rects", () => {
      const t = new DirtyRectTracker();
      // Two rects that snap to the same 10×10 cell.
      t.markDirty(rect(1, 1, 4, 4));
      t.markDirty(rect(6, 6, 9, 9));
      const result = t.queryLowPrecision(10);
      expect(result).toHaveLength(1); // both snap to (0,0,10,10)
    });

    it("keeps distinct coarse rects separate", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 5, 5));
      t.markDirty(rect(50, 50, 55, 55));
      const result = t.queryLowPrecision(10);
      expect(result).toHaveLength(2);
    });

    it("does not mutate internal state (non-draining)", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 5, 5));
      t.queryLowPrecision(10);
      expect(t.hasDirty()).toBe(true); // still dirty after query
    });

    it("throws when step <= 0", () => {
      const t = new DirtyRectTracker();
      t.markDirty(rect(0, 0, 10, 10));
      expect(() => t.queryLowPrecision(0)).toThrow("Grid step must be > 0");
      expect(() => t.queryLowPrecision(-1)).toThrow("Grid step must be > 0");
    });

    it("skips zero-area coarse rects from degenerate inputs", () => {
      const t = new DirtyRectTracker();
      // A rect smaller than step that snaps to the same grid cell: (0,0)-(0,0)
      // step=10: floor(0.1/10)*10=0, ceil(0.1/10)*10=10 → not zero-area
      // Need a rect that truly produces zero area: (0,0,0,0) → snap all to 0
      t.markDirty(rect(0, 0, 0, 0));
      const result = t.queryLowPrecision(10);
      expect(result).toEqual([]);
    });
  });
});

// ---- rectsIntersect -----------------------------------------------------

describe("rectsIntersect", () => {
  it("overlapping rects intersect", () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(5, 5, 15, 15))).toBe(true);
  });

  it("disjoint rects do not intersect", () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(20, 20, 30, 30))).toBe(false);
  });

  it("touching edges count as intersection", () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(10, 0, 20, 10))).toBe(true);
  });

  it("contained rect intersects", () => {
    expect(rectsIntersect(rect(0, 0, 100, 100), rect(10, 10, 20, 20))).toBe(true);
  });

  it("identical rects intersect", () => {
    expect(rectsIntersect(rect(5, 5, 15, 15), rect(5, 5, 15, 15))).toBe(true);
  });

  it("separated vertically", () => {
    expect(rectsIntersect(rect(0, 0, 10, 10), rect(0, 20, 10, 30))).toBe(false);
  });
});
