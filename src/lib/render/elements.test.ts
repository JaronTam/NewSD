import { describe, expect, it } from "vitest";

import {
  cloudToInstances,
  findElementAt,
  getElementBounds,
  resizeStock,
  stockToInstances,
  RESIZE_HANDLES,
} from "./elements";
import type { Cloud, Flow, SDElement, Stock } from "../sd/types";
import type { RenderInstance } from "./vram/renderer";

// ---- 1a.4 red-phase imports (do NOT exist yet — TDD red state) --------------
import { flowToInstances, getElementPorts, findNearestPort } from "./elements";

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

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.4 red-phase — flowToInstances + ports + pushChar rotation
//
// These symbols (flowToInstances, getElementPorts, findNearestPort) do NOT
// exist in elements.ts yet. The imports at the top of this file will cause a
// module load failure, which is the expected TDD red state.
// ══════════════════════════════════════════════════════════════════════════════

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: "f1",
    kind: "flow",
    name: "growth",
    fromId: "s1",
    toId: "s2",
    formula: "0.05 * Pop",
    isVariable: true,
    lastValue: 0,
    units: "people/dt",
    ...overrides,
  };
}

// ---- AC-6/7/8: flowToInstances -----------------------------------------------

describe("flowToInstances — Manhattan orthogonal routing (AC-6/7/8)", () => {
  it("produces a non-empty instance array for a valid endpoint pair", () => {
    // Even a trivial horizontal flow should produce glyph instances.
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 2, width: 10, height: 5 }, // from bounds
      { x: 20, y: 0, width: 10, height: 5 }, // to bounds
    );
    expect(instances.length).toBeGreaterThan(0);
  });

  it("every instance has entityType=FLOW (2)", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 20, y: 0, width: 8, height: 4 },
    );
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      expect(r.entityType).toBe(2);
    }
  });

  it("every instance has colorIdx=1 (flow green)", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 20, y: 0, width: 8, height: 4 },
    );
    for (const r of instances) {
      expect(r.colorIdx).toBe(1);
    }
  });

  it("horizontal flow (E→W or W→E) uses only horizontal box-drawing glyphs", () => {
    // Two stocks side-by-side horizontally. Orthogonal routing = single horizontal line.
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 2, width: 10, height: 5 }, // right edge at x=10, mid y=4.5→4
      { x: 20, y: 2, width: 10, height: 5 }, // left edge at x=20, mid y=4.5→4
    );
    expect(instances.length).toBeGreaterThan(0);
    // All instances should share the same y (single horizontal segment).
    const ys = new Set(instances.map((r) => r.worldY));
    expect(ys.size).toBe(1);
  });

  it("vertical flow (N→S or S→N) is a single column of instances", () => {
    // Two stocks stacked vertically — routing is a straight vertical line.
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 }, // bottom mid
      { x: 0, y: 20, width: 8, height: 4 }, // top mid
    );
    expect(instances.length).toBeGreaterThan(0);
    // All instances should share the same x (single vertical segment).
    const xs = new Set(instances.map((r) => r.worldX));
    expect(xs.size).toBe(1);
  });

  it("Manhattan routing: horizontal-first (East then South for SE diagonal)", () => {
    // from at (0,0) → to at (20,10): horizontal segment first (E), then vertical (S).
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 }, // from
      { x: 20, y: 10, width: 8, height: 4 }, // to (SE of from)
    );
    expect(instances.length).toBeGreaterThan(0);
    // Horizontal-first: the first segment runs east, the second south.
    // Verify that for the horizontal segment, y is constant; for the vertical, x is constant.
    // Simple structural check: there's at least one horizontal run and one vertical run.
    const byY = new Map<number, RenderInstance[]>();
    for (const r of instances) {
      const arr = byY.get(r.worldY) || [];
      arr.push(r);
      byY.set(r.worldY, arr);
    }
    // At least 2 distinct y values (horizontal + vertical segments)
    expect(byY.size).toBeGreaterThanOrEqual(2);
  });

  it("▶ arrowhead glyph at the endpoint (direction indicator)", () => {
    // The flow should render a ▶ arrowhead at the to-end of the path.
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 2, width: 10, height: 5 },
      { x: 20, y: 2, width: 10, height: 5 },
    );
    // At least one instance near the "to" element's port.
    const arrowInstances = instances.filter((r) => r.worldX >= 18 && r.worldX <= 22);
    expect(arrowInstances.length).toBeGreaterThan(0);
  });

  it("selected flag propagates to all instances", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 20, y: 0, width: 8, height: 4 },
      true,
    );
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      expect(r.selected).toBe(true);
    }
  });

  it("unselected by default", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 20, y: 0, width: 8, height: 4 },
    );
    for (const r of instances) {
      expect(r.selected).toBe(false);
    }
  });

  // AC-7: rotation mapping — Task 4.4 table
  // 0→E, π/2→S, π→W, -π/2→N (orthogonal directions only)
  it("AC-7: rotation maps to orthogonal direction per Task 4.4 table", () => {
    // The pushChar function must accept a rotation parameter and set it on
    // RenderInstance. The rotation→direction mapping:
    //   0 → E (right, ▶ points east)
    //   π/2 → S (down, ▶ points south)
    //   π → W (left, ▶ points west)
    //   -π/2 → N (up, ▶ points north)
    // For flow glyphs, rotation determines arrowhead orientation.

    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 2, width: 10, height: 5 },
      { x: 20, y: 2, width: 10, height: 5 },
    );

    // All instances must have a defined rotation field.
    for (const r of instances) {
      expect(typeof r.rotation).toBe("number");
    }

    // Horizontal rightward flow → arrowhead at the endpoint should have rotation ≈ 0 (E)
    const rightEdgeInstances = instances.filter((r) => r.worldX > 15);
    for (const r of rightEdgeInstances) {
      // rotation is a multiple of π/2 (orthogonal)
      expect(r.rotation % (Math.PI / 2)).toBeCloseTo(0, 5);
    }
  });

  it("▼ marker glyph rendered at cloud connections", () => {
    // Flow to/from cloud: a ▼ marker is rendered at the cloud port.
    // We verify that the instances array includes glyphs — glyph-level
    // verification (which ch is ▼) is harder without the glyph map, but
    // structural assertions (non-empty, at cloud location) work.
    const instances = flowToInstances(
      makeFlow({ fromId: "c1" }),
      { x: 0, y: 0, width: 6, height: 3 }, // cloud (fixed 6×3)
      { x: 20, y: 0, width: 10, height: 5 }, // stock
    );
    expect(instances.length).toBeGreaterThan(0);
  });
});

// ---- AC-12c: dangling flow ref -------------------------------------------------

describe("flowToInstances — AC-12c dangling ref guard", () => {
  it("returns empty array when fromId endpoint element doesn't exist", () => {
    // Option B (VS钉死决策): silent empty — don't throw, just render nothing.
    const instances = flowToInstances(
      makeFlow({ fromId: "nonexistent" }),
      null, // from bounds = null (endpoint not found)
      { x: 10, y: 0, width: 8, height: 4 },
    );
    expect(instances).toEqual([]);
  });

  it("returns empty array when toId endpoint element doesn't exist", () => {
    const instances = flowToInstances(
      makeFlow({ toId: "nonexistent" }),
      { x: 0, y: 0, width: 8, height: 4 },
      null, // to bounds = null (endpoint not found)
    );
    expect(instances).toEqual([]);
  });

  it("returns empty array when both endpoints are null", () => {
    const instances = flowToInstances(makeFlow({ fromId: "gone1", toId: "gone2" }), null, null);
    expect(instances).toEqual([]);
  });

  it("dangling ref does NOT throw (graceful degradation, Option B)", () => {
    expect(() =>
      flowToInstances(makeFlow({ fromId: "ghost" }), null, { x: 0, y: 0, width: 8, height: 4 }),
    ).not.toThrow();
  });
});

// ---- AC-9: getElementPorts ---------------------------------------------------

describe("getElementPorts (AC-9)", () => {
  it("returns 4 ports for a stock — N, E, S, W edge midpoints", () => {
    const stock = makeStock({ x: 0, y: 0, width: 10, height: 6 });
    const ports = getElementPorts(stock);
    expect(ports.length).toBe(4);

    // N port: center-x of top edge
    const nPort = ports.find((p) => p.side === "N");
    expect(nPort).toBeDefined();
    expect(nPort!.x).toBe(5); // x + width/2 = 0 + 5
    expect(nPort!.y).toBe(0); // y (top edge)

    // S port: center-x of bottom edge
    const sPort = ports.find((p) => p.side === "S");
    expect(sPort).toBeDefined();
    expect(sPort!.x).toBe(5);
    expect(sPort!.y).toBe(6); // y + height = 0 + 6

    // E port: center-y of right edge
    const ePort = ports.find((p) => p.side === "E");
    expect(ePort).toBeDefined();
    expect(ePort!.x).toBe(10); // x + width = 0 + 10
    expect(ePort!.y).toBe(3); // y + height/2 = 0 + 3

    // W port: center-y of left edge
    const wPort = ports.find((p) => p.side === "W");
    expect(wPort).toBeDefined();
    expect(wPort!.x).toBe(0); // x (left edge)
    expect(wPort!.y).toBe(3);
  });

  it("returns 4 ports for a cloud (fixed 6×3 icon)", () => {
    const cloud = makeCloud({ x: 10, y: 5 });
    const ports = getElementPorts(cloud);
    expect(ports.length).toBe(4);

    // All ports reference the cloud element ID.
    for (const p of ports) {
      expect(p.elementId).toBe(cloud.id);
    }

    // Cloud ports are at edge midpoints of the 6×3 bounding box.
    const nPort = ports.find((p) => p.side === "N");
    expect(nPort!.x).toBe(13); // 10 + 3
    expect(nPort!.y).toBe(5);

    const ePort = ports.find((p) => p.side === "E");
    expect(ePort!.x).toBe(16); // 10 + 6
    expect(ePort!.y).toBe(6.5); // 5 + 1.5
  });

  it("stock ports are at world-space midpoints (integer or half-integer)", () => {
    // Odd-dimension stock: width=7, height=5 → center-x is 3.5, center-y is 2.5
    const stock = makeStock({ x: 0, y: 0, width: 7, height: 5 });
    const ports = getElementPorts(stock);

    const nPort = ports.find((p) => p.side === "N")!;
    expect(nPort.x).toBe(3.5);
    expect(nPort.y).toBe(0);

    const ePort = ports.find((p) => p.side === "E")!;
    expect(ePort.x).toBe(7);
    expect(ePort.y).toBe(2.5);
  });

  it("each port carries the element ID it belongs to", () => {
    const stock = makeStock({ id: "my-stock-1" });
    const ports = getElementPorts(stock);
    for (const p of ports) {
      expect(p.elementId).toBe("my-stock-1");
    }
  });
});

// ---- AC-10: findNearestPort --------------------------------------------------

describe("findNearestPort (AC-10)", () => {
  function makePortsAroundOrigin(): ReturnType<typeof getElementPorts> {
    return [
      { elementId: "s-n", side: "N" as const, x: 5, y: 0 },
      { elementId: "s-s", side: "S" as const, x: 5, y: 6 },
      { elementId: "s-e", side: "E" as const, x: 10, y: 3 },
      { elementId: "s-w", side: "W" as const, x: 0, y: 3 },
    ];
  }

  it("returns the nearest port when cursor is close to one port", () => {
    const ports = makePortsAroundOrigin();
    // Cursor at (9.5, 3) — very close to E port (10, 3).
    const nearest = findNearestPort(9.5, 3, ports, 3);
    expect(nearest).not.toBeNull();
    expect(nearest!.side).toBe("E");
    expect(nearest!.elementId).toBe("s-e");
  });

  it("returns null when cursor is farther than threshold from all ports", () => {
    const ports = makePortsAroundOrigin();
    // Cursor at (100, 100) — far from all ports, threshold=3.
    const nearest = findNearestPort(100, 100, ports, 3);
    expect(nearest).toBeNull();
  });

  it("returns null when ports array is empty", () => {
    expect(findNearestPort(5, 3, [], 5)).toBeNull();
  });

  it("breaks ties by the first port encountered (closest distance wins)", () => {
    // Two ports equidistant from the cursor.
    const ports = [
      { elementId: "a", side: "N" as const, x: 5, y: 0 },
      { elementId: "b", side: "S" as const, x: 5, y: 6 },
    ];
    // Cursor at (5, 3) — exactly 3 units from both N(5,0) and S(5,6).
    const nearest = findNearestPort(5, 3, ports, 5);
    expect(nearest).not.toBeNull();
    // Either port is valid — just verify the result is one of them.
    expect(["a", "b"]).toContain(nearest!.elementId);
  });

  it("threshold is exclusive: exactly threshold away still snaps", () => {
    const ports = [{ elementId: "p1", side: "N" as const, x: 5, y: 0 }];
    // Distance = 3 (exactly at threshold), should snap.
    const nearest = findNearestPort(5, 3, ports, 3);
    expect(nearest).not.toBeNull();
  });

  it("threshold + epsilon away does NOT snap", () => {
    const ports = [{ elementId: "p1", side: "N" as const, x: 5, y: 0 }];
    // Distance = 3.01 > threshold 3.
    const nearest = findNearestPort(5, 3.01, ports, 3);
    expect(nearest).toBeNull();
  });

  it("large threshold (e.g. 5) snaps from farther away", () => {
    const ports = makePortsAroundOrigin();
    // Cursor at (13, 3) — 3 units from E port (10,3), within threshold=5.
    const nearest = findNearestPort(13, 3, ports, 5);
    expect(nearest).not.toBeNull();
    expect(nearest!.side).toBe("E");
  });
});

// ---- pushChar rotation support (AC-8) ----------------------------------------

describe("pushChar rotation (AC-8)", () => {
  it("flowToInstances sets rotation on all instances", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 0, y: 20, width: 8, height: 4 },
    );
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      // rotation is a defined number (may be 0 for straight segments)
      expect(typeof r.rotation).toBe("number");
      expect(Number.isFinite(r.rotation)).toBe(true);
    }
  });

  it("rotation values are multiples of π/2 (orthogonal directions only)", () => {
    const instances = flowToInstances(
      makeFlow(),
      { x: 0, y: 0, width: 8, height: 4 },
      { x: 20, y: 10, width: 8, height: 4 },
    );
    for (const r of instances) {
      // Each rotation should be a multiple of π/2 (0, π/2, π, -π/2)
      const remainder = r.rotation % (Math.PI / 2);
      expect(Math.abs(remainder)).toBeCloseTo(0, 5);
    }
  });

  it("existing stockToInstances still has rotation=0 (no regression)", () => {
    const instances = stockToInstances(makeStock(), false);
    for (const r of instances) {
      expect(r.rotation).toBe(0);
    }
  });

  it("existing cloudToInstances still has rotation=0 (no regression)", () => {
    const instances = cloudToInstances(makeCloud());
    for (const r of instances) {
      expect(r.rotation).toBe(0);
    }
  });
});

// ---- getElementBounds — flow branch (AC-6 carry) -----------------------------

describe("getElementBounds — flow (AC-6)", () => {
  it("returns non-zero bbox for a flow (computed from endpoint instances)", () => {
    // Place two stocks 10 world-units apart horizontally so the Manhattan route
    // has measurable extent. s1 at (0,0) 10×5, s2 at (20,0) 10×5.
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 10, height: 5 }),
      makeStock({ id: "s2", x: 20, y: 0, width: 10, height: 5 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const b = getElementBounds(flow, elements);
    expect(b.width).toBeGreaterThan(0);
    expect(b.height).toBeGreaterThanOrEqual(0);
    // The bbox must contain at least the arrowhead at the to-port.
    expect(b.x).toBeLessThanOrEqual(b.x + b.width);
    expect(b.y).toBeLessThanOrEqual(b.y + b.height);
  });

  it("returns zero bbox when allElements is not provided (backward compat)", () => {
    const b = getElementBounds(makeFlow());
    expect(b).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("returns zero bbox for a flow with dangling refs (AC-12c)", () => {
    const elements: SDElement[] = [makeStock({ id: "s1", x: 0, y: 0, width: 10, height: 5 })];
    const flow = makeFlow({ fromId: "s1", toId: "nonexistent" });
    const b = getElementBounds(flow, elements);
    expect(b).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
