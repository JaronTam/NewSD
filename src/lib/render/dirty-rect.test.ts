import { describe, expect, it, vi } from "vitest";
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

  // ---- H8/E2 hardening (AC-7, Story 1a.6) -------------------------------

  describe("markDirty input validation (H8/E2 hardening)", () => {
    it("skips rect with NaN minX and warns", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(NaN, 0, 10, 10));
      expect(t.hasDirty()).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("skips rect with NaN maxX and warns", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(0, 0, NaN, 10));
      expect(t.hasDirty()).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("skips rect with +Infinity and warns", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(0, 0, Infinity, 10));
      expect(t.hasDirty()).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("skips rect with -Infinity and warns", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(-Infinity, 0, 10, 10));
      expect(t.hasDirty()).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("accepts rect with -0 (negative zero is finite)", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(-0, -0, 10, 10));
      expect(t.hasDirty()).toBe(true);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("mixed finite+NaN: finite rects still recorded, NaN skipped with warn", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(0, 0, 10, 10)); // valid
      t.markDirty(rect(NaN, 0, 10, 10)); // skipped
      t.markDirty(rect(20, 20, 30, 30)); // valid
      expect(t.hasDirty()).toBe(true);
      const { rects } = t.consume();
      expect(rects).toHaveLength(2);
      expect(rects[0]).toEqual(rect(0, 0, 10, 10));
      expect(rects[1]).toEqual(rect(20, 20, 30, 30));
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("skips rect where any single field is non-finite", () => {
      const t = new DirtyRectTracker();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      t.markDirty(rect(0, 0, 10, NaN)); // only maxY is NaN
      expect(t.hasDirty()).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  describe("queryLowPrecision defensive skip (H8/E2 hardening)", () => {
    it("filters out non-finite rects that bypassed markDirty guard", () => {
      const t = new DirtyRectTracker();
      // Directly push a non-finite rect into internal state (simulating
      // a bypass of the markDirty guard, e.g. from external manipulation).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t as any).rects = [
        rect(0, 0, 10, 10), // valid
        rect(NaN, 0, 10, 10), // non-finite → skip
        rect(20, 20, Infinity, 30), // non-finite → skip
        rect(40, 40, 50, 50), // valid
      ];
      const result = t.queryLowPrecision(10);
      // Only the two valid rects should survive.
      expect(result).toHaveLength(2);
    });

    it("returns [] when all rects are non-finite", () => {
      const t = new DirtyRectTracker();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t as any).rects = [rect(NaN, NaN, NaN, NaN), rect(Infinity, -Infinity, Infinity, -Infinity)];
      const result = t.queryLowPrecision(10);
      expect(result).toEqual([]);
    });

    it("non-finite filter preserves dedup behavior for valid rects", () => {
      const t = new DirtyRectTracker();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t as any).rects = [
        rect(1, 1, 4, 4),
        rect(NaN, 0, 10, 10), // skipped
        rect(6, 6, 9, 9), // snaps to same cell as first
      ];
      const result = t.queryLowPrecision(10);
      expect(result).toHaveLength(1);
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
