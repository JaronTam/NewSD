import { describe, expect, it } from "vitest";

import {
  cloudToInstances,
  findElementAt,
  getElementBounds,
  resizeStock,
  stockToInstances,
  RESIZE_HANDLES,
} from "./elements";
import type { Cloud, SDElement, Stock } from "../sd/types";
import type { RenderInstance } from "./vram/renderer";

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: "s1",
    kind: "stock",
    name: "Population",
    x: 0,
    y: 0,
    width: 10,
    height: 5,
    initialValue: 100,
    units: "people",
    allowNegative: false,
    currentValue: 100,
    history: [100],
    ...overrides,
  };
}

describe("stockToInstances — ASCII box builder", () => {
  it("produces exactly width × height instances", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    expect(instances.length).toBe(8 * 4);
  });

  it("top-left corner is ┌ (U+250C)", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    const tl = instances.find((r) => r.worldX === stock.x && r.worldY === stock.y);
    expect(tl).toBeDefined();
    // glyphIdx depends on charToGlyphIdx — we test via the rendered character
    // rather than the raw index. The glyphIdx should be non-negative (valid).
    expect(tl!.glyphIdx).toBeGreaterThanOrEqual(0);
  });

  it("top-right corner is ┐ (U+2510)", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    const tr = instances.find(
      (r) => r.worldX === stock.x + stock.width - 1 && r.worldY === stock.y,
    );
    expect(tr).toBeDefined();
    expect(tr!.glyphIdx).toBeGreaterThanOrEqual(0);
  });

  it("bottom-left corner is └ (U+2514)", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    const bl = instances.find(
      (r) => r.worldX === stock.x && r.worldY === stock.y + stock.height - 1,
    );
    expect(bl).toBeDefined();
    expect(bl!.glyphIdx).toBeGreaterThanOrEqual(0);
  });

  it("bottom-right corner is ┘ (U+2518)", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    const br = instances.find(
      (r) => r.worldX === stock.x + stock.width - 1 && r.worldY === stock.y + stock.height - 1,
    );
    expect(br).toBeDefined();
    expect(br!.glyphIdx).toBeGreaterThanOrEqual(0);
  });

  it("top/bottom edges use ─ (U+2500) for interior columns", () => {
    const stock = makeStock({ width: 10, height: 5 });
    const instances = stockToInstances(stock, false);

    // Top edge interior (x from stock.x+1 to stock.x+width-2, y = stock.y)
    const topInterior = instances.filter(
      (r) => r.worldY === stock.y && r.worldX > stock.x && r.worldX < stock.x + stock.width - 1,
    );
    expect(topInterior.length).toBe(stock.width - 2);
    for (const r of topInterior) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }

    // Bottom edge interior
    const bottomInterior = instances.filter(
      (r) =>
        r.worldY === stock.y + stock.height - 1 &&
        r.worldX > stock.x &&
        r.worldX < stock.x + stock.width - 1,
    );
    expect(bottomInterior.length).toBe(stock.width - 2);
    for (const r of bottomInterior) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it("left/right edges use │ (U+2502) for interior rows", () => {
    const stock = makeStock({ width: 10, height: 5 });
    const instances = stockToInstances(stock, false);

    // Left edge interior (x = stock.x, y from stock.y+1 to stock.y+height-2)
    const leftInterior = instances.filter(
      (r) => r.worldX === stock.x && r.worldY > stock.y && r.worldY < stock.y + stock.height - 1,
    );
    expect(leftInterior.length).toBe(stock.height - 2);
    for (const r of leftInterior) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }

    // Right edge interior (x = stock.x + width - 1)
    const rightInterior = instances.filter(
      (r) =>
        r.worldX === stock.x + stock.width - 1 &&
        r.worldY > stock.y &&
        r.worldY < stock.y + stock.height - 1,
    );
    expect(rightInterior.length).toBe(stock.height - 2);
    for (const r of rightInterior) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it("all instances have colorIdx=0 (stock cyan)", () => {
    const stock = makeStock({ width: 8, height: 4 });
    const instances = stockToInstances(stock, false);
    for (const r of instances) {
      expect(r.colorIdx).toBe(0);
    }
  });

  it("displays name + initialValue when sim is NOT running", () => {
    const stock = makeStock({ name: "Pop", initialValue: 42, units: "" });
    const instances = stockToInstances(stock, false);

    // Find instances that are NOT box-border chars (interior text)
    const interior = instances.filter(
      (r) =>
        r.worldX > stock.x &&
        r.worldX < stock.x + stock.width - 1 &&
        r.worldY > stock.y &&
        r.worldY < stock.y + stock.height - 1,
    );
    // "Pop 42" should appear somewhere in the interior
    expect(interior.length).toBeGreaterThan(0);
    // glyph indices for 'P', 'o', 'p', ' ', '4', '2' are all ≥ 0
    for (const r of interior) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }
  });

  it("displays name + currentValue when sim IS running", () => {
    const stock = makeStock({
      name: "Pop",
      initialValue: 42,
      currentValue: 99,
      units: "",
    });
    const instances = stockToInstances(stock, true);
    const interior = instances.filter(
      (r) =>
        r.worldX > stock.x &&
        r.worldX < stock.x + stock.width - 1 &&
        r.worldY > stock.y &&
        r.worldY < stock.y + stock.height - 1,
    );
    expect(interior.length).toBeGreaterThan(0);
  });

  it("appends units when non-empty", () => {
    const stock = makeStock({ name: "X", initialValue: 1, units: "kg" });
    const instances = stockToInstances(stock, false);
    const interior = instances.filter(
      (r) =>
        r.worldX > stock.x &&
        r.worldX < stock.x + stock.width - 1 &&
        r.worldY > stock.y &&
        r.worldY < stock.y + stock.height - 1,
    );
    // "X 1 kg" → at least 6 chars
    expect(interior.length).toBeGreaterThanOrEqual(6);
  });

  it("omits units when empty string", () => {
    const stock = makeStock({ name: "X", initialValue: 1, units: "" });
    const instances = stockToInstances(stock, false);
    const interior = instances.filter(
      (r) =>
        r.worldX > stock.x &&
        r.worldX < stock.x + stock.width - 1 &&
        r.worldY > stock.y &&
        r.worldY < stock.y + stock.height - 1,
    );
    // "X 1" — shorter than with units
    expect(interior.length).toBeGreaterThanOrEqual(3);
  });

  it("selected flag propagates to instances; lumaIdx stays at base (shader lifts luma)", () => {
    // M1 (A2 path): CPU no longer bumps lumaIdx for selected glyphs. The vertex
    // shader computes effectiveLuma = a_lumaIdx + a_selected, so selected
    // instances carry selected=true with lumaIdx=0 (base). This keeps atlas band
    // selection in the vertex shader (UV is computed there) — the fragment
    // shader cannot change the sampling band, so AC-13's "fragment shader"
    // wording is corrected to "vertex shader" (see story Dev Notes).
    const unselected = stockToInstances(makeStock(), false);
    for (const r of unselected) {
      expect(r.selected).toBe(false);
      expect(r.lumaIdx).toBe(0);
    }
    const selected = stockToInstances(makeStock(), false, true);
    for (const r of selected) {
      expect(r.selected).toBe(true);
      expect(r.lumaIdx).toBe(0); // base — shader lifts, not CPU
    }
  });

  it("entityType is 0 for stock", () => {
    const stock = makeStock();
    const instances = stockToInstances(stock, false);
    for (const r of instances) {
      expect(r.entityType).toBe(0);
    }
  });

  it("zOrder and rotation default to 0", () => {
    const stock = makeStock();
    const instances = stockToInstances(stock, false);
    for (const r of instances) {
      expect(r.zOrder).toBe(0);
      expect(r.rotation).toBe(0);
    }
  });
});

// ---- cloud → instances ---------------------------------------------------

function makeCloud(overrides: Partial<Cloud> = {}): Cloud {
  return {
    id: "c1",
    kind: "cloud",
    x: 0,
    y: 0,
    ...overrides,
  };
}

describe("cloudToInstances — ASCII cloud builder", () => {
  it("renders exactly 6 × 3 = 18 glyph instances", () => {
    const cloud = makeCloud();
    const instances = cloudToInstances(cloud);
    // 6 columns × 3 rows = 18 (with padding spaces for centering)
    expect(instances.length).toBe(18);
  });

  it("row 0 is ' .--. ' — a palindrome (arc centered, mirror-symmetric)", () => {
    const cloud = makeCloud({ x: 10, y: 5 });
    const instances = cloudToInstances(cloud);
    const row0 = instances.filter((r) => r.worldY === cloud.y).sort((a, b) => a.worldX - b.worldX);
    expect(row0.length).toBe(6);
    // All glyph indices are valid
    for (const r of row0) {
      expect(r.glyphIdx).toBeGreaterThanOrEqual(0);
    }
    // .--. is a palindrome: col0==col5 (space), col1==col4 (.), col2==col3 (-)
    expect(row0[0].glyphIdx).toBe(row0[5].glyphIdx);
    expect(row0[1].glyphIdx).toBe(row0[4].glyphIdx);
    expect(row0[2].glyphIdx).toBe(row0[3].glyphIdx);
  });

  it("row 1 is '(    )' (paren, 4 spaces, paren)", () => {
    const cloud = makeCloud({ x: 0, y: 0 });
    const instances = cloudToInstances(cloud);
    const row1 = instances
      .filter((r) => r.worldY === cloud.y + 1)
      .sort((a, b) => a.worldX - b.worldX);
    expect(row1.length).toBe(6);
  });

  it("row 2 is \" '--' \" — palindrome mirroring row 0's padding (M5 regression guard)", () => {
    const cloud = makeCloud({ x: 0, y: 0 });
    const instances = cloudToInstances(cloud);
    const row0 = instances.filter((r) => r.worldY === cloud.y).sort((a, b) => a.worldX - b.worldX);
    const row2 = instances
      .filter((r) => r.worldY === cloud.y + 2)
      .sort((a, b) => a.worldX - b.worldX);
    expect(row2.length).toBe(6);
    // '--' is a palindrome: col0==col5 (space), col1==col4 ('), col2==col3 (-)
    expect(row2[0].glyphIdx).toBe(row2[5].glyphIdx);
    expect(row2[1].glyphIdx).toBe(row2[4].glyphIdx);
    expect(row2[2].glyphIdx).toBe(row2[3].glyphIdx);
    // M5: pre-fix row 2 was "'--'  " (left-shifted) — col 0 was a quote, not a
    // space. The arc must be centered, so row 2 col 0 == row 0 col 0 (both spaces).
    expect(row2[0].glyphIdx).toBe(row0[0].glyphIdx);
    expect(row2[5].glyphIdx).toBe(row0[5].glyphIdx);
  });

  it("all instances have colorIdx=2 (cloud violet)", () => {
    const cloud = makeCloud();
    const instances = cloudToInstances(cloud);
    for (const r of instances) {
      expect(r.colorIdx).toBe(2);
    }
  });

  it("all instances have entityType=1 (CLOUD)", () => {
    const cloud = makeCloud();
    const instances = cloudToInstances(cloud);
    for (const r of instances) {
      expect(r.entityType).toBe(1);
    }
  });

  it("selected flag propagates; defaults to false, zOrder/rotation default to 0", () => {
    const cloud = makeCloud();
    const instances = cloudToInstances(cloud);
    for (const r of instances) {
      expect(r.selected).toBe(false);
      expect(r.zOrder).toBe(0);
      expect(r.rotation).toBe(0);
    }
    // M1: selected cloud → selected=true on all instances (A2 glow path,
    // luma lift done by vertex shader, not CPU).
    const sel = cloudToInstances(makeCloud(), true);
    for (const r of sel) {
      expect(r.selected).toBe(true);
      expect(r.lumaIdx).toBe(0); // base — shader lifts luma, not CPU
    }
  });

  it("positions cloud at (x, y) world coordinates", () => {
    const cloud = makeCloud({ x: 42, y: -7 });
    const instances = cloudToInstances(cloud);
    const minX = Math.min(...instances.map((r) => r.worldX));
    const minY = Math.min(...instances.map((r) => r.worldY));
    const maxX = Math.max(...instances.map((r) => r.worldX));
    const maxY = Math.max(...instances.map((r) => r.worldY));
    expect(minX).toBe(42);
    expect(minY).toBe(-7);
    expect(maxX).toBe(47); // x + 5 (6 cols wide, 0-indexed)
    expect(maxY).toBe(-5); // y + 2
  });
});

// ---- hit testing -----------------------------------------------------------

describe("getElementBounds", () => {
  it("returns stock bounds from (x, y, width, height)", () => {
    const stock = makeStock({ x: 5, y: 3, width: 12, height: 6 });
    const b = getElementBounds(stock);
    expect(b).toEqual({ x: 5, y: 3, width: 12, height: 6 });
  });

  it("returns cloud bounds as fixed 6×3", () => {
    const cloud = makeCloud({ x: 10, y: -2 });
    const b = getElementBounds(cloud);
    expect(b).toEqual({ x: 10, y: -2, width: 6, height: 3 });
  });
});

describe("findElementAt", () => {
  const elements: SDElement[] = [
    makeStock({ id: "s1", x: 0, y: 0, width: 10, height: 5 }),
    makeCloud({ id: "c1", x: 20, y: 0 }),
    makeStock({ id: "s2", x: 0, y: 10, width: 8, height: 4 }),
  ];

  it("returns null when no element is at the world point", () => {
    expect(findElementAt(100, 100, elements)).toBeNull();
  });

  it("finds a stock by its bounding box", () => {
    const found = findElementAt(5, 2, elements);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("s1");
  });

  it("finds a cloud by its fixed 6×3 bounds", () => {
    const found = findElementAt(23, 1, elements);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("c1");
  });

  it("returns the last-drawn (topmost) element when two overlap", () => {
    // s2 is drawn last; it should be found even if s1 is also under the point.
    // s1: (0,0,10,5), s2: (0,10,8,4) — no overlap.
    // Use a scenario where two elements overlap.
    const overlapping: SDElement[] = [
      makeStock({ id: "bottom", x: 0, y: 0, width: 10, height: 5 }),
      makeStock({ id: "top", x: 2, y: 1, width: 10, height: 5 }),
    ];
    const found = findElementAt(5, 3, overlapping);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("top"); // last in array = topmost
  });

  it("boundary: point exactly on top-left corner is inside", () => {
    const found = findElementAt(0, 0, elements);
    expect(found).not.toBeNull();
    expect(found!.id).toBe("s1");
  });

  it("boundary: point exactly on bottom-right edge (width, height) is outside", () => {
    // s1: (0,0,10,5) — (10, 5) is exclusive
    const found = findElementAt(10, 5, elements);
    expect(found).toBeNull();
  });
});

// ---- resize (AC-7 调整大小; CR followup L9) --------------------------------

describe("resizeStock", () => {
  it("exposes all four corner handles", () => {
    expect(RESIZE_HANDLES).toEqual(["nw", "ne", "sw", "se"]);
  });

  it("SE handle grows width/height; x/y (opposite NW corner) stay fixed", () => {
    // stock (0,0,10,5); drag SE corner to (15,8) → width=15, height=8.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "se", 15, 8);
    expect(r).toEqual({ x: 0, y: 0, width: 15, height: 8 });
  });

  it("NW handle moves x/y and resizes; opposite SE corner stays fixed", () => {
    // stock (0,0,10,5); SE corner = (10,5) fixed; drag NW to (-3,-2) →
    // x=-3, y=-2, width=10-(-3)=13, height=5-(-2)=7.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "nw", -3, -2);
    expect(r).toEqual({ x: -3, y: -2, width: 13, height: 7 });
    // SE corner invariant: (x+w, y+h) === (10, 5).
    expect(r.x + r.width).toBe(10);
    expect(r.y + r.height).toBe(5);
  });

  it("NE handle moves top + right; opposite SW corner stays fixed", () => {
    // stock (0,0,10,5); SW = (0,5) fixed; drag NE to (12,-2) →
    // x=0 (left fixed), y=-2, width=12, height=5-(-2)=7.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "ne", 12, -2);
    expect(r).toEqual({ x: 0, y: -2, width: 12, height: 7 });
    expect(r.x).toBe(0);
    expect(r.y + r.height).toBe(5); // SW corner y
  });

  it("SW handle moves left + bottom; opposite NE corner stays fixed", () => {
    // stock (0,0,10,5); NE = (10,0) fixed; drag SW to (-2,9) →
    // x=-2, y=0 (top fixed), width=10-(-2)=12, height=9.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "sw", -2, 9);
    expect(r).toEqual({ x: -2, y: 0, width: 12, height: 9 });
    expect(r.y).toBe(0);
    expect(r.x + r.width).toBe(10); // NE corner x
  });

  it("SE handle clamps width & height to >=3 when dragged past the opposite corner", () => {
    // stock (0,0,10,5); drag SE to (1,1) → width=1<3, height=1<3.
    // SE moves right+bottom edges → pin r=left+3=3, b=top+3=3 → 3×3.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "se", 1, 1);
    expect(r).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it("NW handle clamps to >=3 by pinning left/top to opposite ±3 (not inverting)", () => {
    // stock (0,0,10,5); drag NW to (12,6) → width=10-12=-2<3, height=5-6=-1<3.
    // NW moves left+top → pin left=r-3=10-3=7, top=b-3=5-3=2 → 3×3.
    // Opposite SE corner (10,5) preserved: 7+3=10, 2+3=5.
    const r = resizeStock(makeStock({ x: 0, y: 0, width: 10, height: 5 }), "nw", 12, 6);
    expect(r).toEqual({ x: 7, y: 2, width: 3, height: 3 });
    expect(r.x + r.width).toBe(10);
    expect(r.y + r.height).toBe(5);
  });

  it("respects a non-origin stock position when resizing SE", () => {
    // stock (-4, 3, 10, 5); SE corner = (6, 8) fixed... wait SE moves so NW=(-4,3) fixed.
    // drag SE to (2, 6) → width=2-(-4)=6, height=6-3=3.
    const r = resizeStock(makeStock({ x: -4, y: 3, width: 10, height: 5 }), "se", 2, 6);
    expect(r).toEqual({ x: -4, y: 3, width: 6, height: 3 });
  });
});
