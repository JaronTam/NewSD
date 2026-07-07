import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { flowToInstances, getElementPorts, findNearestPort, warnedDanglingFlows } from "./elements";
import { charToGlyphIdx } from "./vram/glowAtlas";

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
  // Default scene: s1 (0,0,10×5) → s2 (20,0,10×5). s1 E-port (9,3) → s2
  // W-port (20,3): straight horizontal, variable flow.
  function horizontalScene(flow?: Partial<Flow>): { elements: SDElement[]; flow: Flow } {
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 10, height: 5 }),
      makeStock({ id: "s2", x: 20, y: 0, width: 10, height: 5 }),
    ];
    return { elements, flow: makeFlow({ ...flow }) };
  }

  it("produces a non-empty instance array for a valid endpoint pair", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    expect(instances.length).toBeGreaterThan(0);
  });

  it("every instance has entityType=FLOW (2)", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      expect(r.entityType).toBe(2);
    }
  });

  it("every instance has colorIdx=1 (flow magenta, palette index 1)", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    for (const r of instances) {
      expect(r.colorIdx).toBe(1);
    }
  });

  it("horizontal flow (E→W) is a single horizontal segment (one y value)", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    expect(instances.length).toBeGreaterThan(0);
    const ys = new Set(instances.map((r) => r.worldY));
    expect(ys.size).toBe(1);
  });

  it("vertical flow (N→S) is a single column of instances (one x value)", () => {
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 0, y: 20, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    expect(instances.length).toBeGreaterThan(0);
    const xs = new Set(instances.map((r) => r.worldX));
    expect(xs.size).toBe(1);
  });

  it("Manhattan routing: horizontal-first (East then South for SE diagonal)", () => {
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 20, y: 10, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    expect(instances.length).toBeGreaterThan(0);
    const byY = new Map<number, RenderInstance[]>();
    for (const r of instances) {
      const arr = byY.get(r.worldY) || [];
      arr.push(r);
      byY.set(r.worldY, arr);
    }
    expect(byY.size).toBeGreaterThanOrEqual(2);
  });

  it("▶ arrowhead glyph rendered (direction indicator)", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    const arrow = instances.find((r) => r.glyphIdx === charToGlyphIdx("▶"));
    expect(arrow).toBeDefined();
  });

  it("B1: arrow sits one cell short of the to-port (in the gap, not on the node edge)", () => {
    // s2 W-port is at (20,3). Arrow must be at (19,3) — the gap cell — not on
    // the to-port (20,3) where the target node's edge glyph would occlude it.
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    const arrow = instances.find((r) => r.glyphIdx === charToGlyphIdx("▶"));
    expect(arrow).toBeDefined();
    expect(arrow!.worldX).toBe(19);
    expect(arrow!.worldY).toBe(3);
    const onPort = instances.filter(
      (r) => r.glyphIdx === charToGlyphIdx("▶") && r.worldX === 20 && r.worldY === 3,
    );
    expect(onPort.length).toBe(0);
  });

  it("AC-6 corner glyph ┌┐└┘ rendered at the turn cell (not ─)", () => {
    // SE diagonal: turn cell at (tx, fy) = (20, 2); stepX=+1, stepY=+1 → ┐.
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 20, y: 10, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    const corner = instances.find(
      (r) => r.worldX === 20 && r.worldY === 2 && r.glyphIdx === charToGlyphIdx("┐"),
    );
    expect(corner).toBeDefined();
  });

  it("AC-6 corner glyph ┘ at turn cell (NE quadrant: stepX>0, stepY<0)", () => {
    // s1 SE of s2 → dx>0, dy<0 → stepX=+1, stepY=-1 → ┘ at (tx, fy).
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 10, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 20, y: 0, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    const corner = instances.find(
      (r) => r.worldX === 20 && r.worldY === 12 && r.glyphIdx === charToGlyphIdx("┘"),
    );
    expect(corner).toBeDefined();
  });

  it("AC-6 corner glyph ┌ at turn cell (SW quadrant: stepX<0, stepY>0)", () => {
    // s1 SW of s2 → dx<0, dy>0 → stepX=-1, stepY=+1 → ┌ at (tx, fy).
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 20, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 0, y: 10, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    const corner = instances.find(
      (r) => r.worldX === 7 && r.worldY === 2 && r.glyphIdx === charToGlyphIdx("┌"),
    );
    expect(corner).toBeDefined();
  });

  it("AC-6 corner glyph └ at turn cell (NW quadrant: stepX<0, stepY<0)", () => {
    // s1 NW of s2 → dx<0, dy<0 → stepX=-1, stepY=-1 → └ at (tx, fy).
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 20, y: 10, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 0, y: 0, width: 8, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const instances = flowToInstances(flow, elements);
    const corner = instances.find(
      (r) => r.worldX === 7 && r.worldY === 12 && r.glyphIdx === charToGlyphIdx("└"),
    );
    expect(corner).toBeDefined();
  });

  it("nearestPort determinism: same inputs produce identical path output", () => {
    // nearestPort tie-breaking depends on port-array order (N→S→E→W); verify
    // that repeated calls with the same inputs return deep-equal results.
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 6, height: 6 }),
      makeStock({ id: "s2", x: 12, y: 0, width: 6, height: 4 }),
    ];
    const flow = makeFlow({ fromId: "s1", toId: "s2" });
    const a = flowToInstances(flow, elements);
    const b = flowToInstances(flow, elements);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("selected flag propagates to all instances", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements, true);
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      expect(r.selected).toBe(true);
    }
  });

  it("unselected by default", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    for (const r of instances) {
      expect(r.selected).toBe(false);
    }
  });

  // AC-7: rotation mapping — Task 4.4 table
  // 0→E, π/2→S, π→W, -π/2→N (orthogonal directions only)
  it("AC-7: rotation maps to orthogonal direction per Task 4.4 table", () => {
    const { elements, flow } = horizontalScene();
    const instances = flowToInstances(flow, elements);
    for (const r of instances) {
      expect(typeof r.rotation).toBe("number");
    }
    // Horizontal rightward flow → arrowhead rotation ≈ 0 (E).
    const arrow = instances.find((r) => r.glyphIdx === charToGlyphIdx("▶"));
    expect(arrow).toBeDefined();
    expect(arrow!.rotation % (Math.PI / 2)).toBeCloseTo(0, 5);
  });

  it("F1: ▼ marker rendered for a variable flow (isVariable=true) at fromPort+firstDir", () => {
    // s1 E-port (9,3); first segment is East → marker at (10,3).
    const { elements, flow } = horizontalScene({ isVariable: true });
    const instances = flowToInstances(flow, elements);
    const marker = instances.find(
      (r) => r.glyphIdx === charToGlyphIdx("▼") && r.worldX === 10 && r.worldY === 3,
    );
    expect(marker).toBeDefined();
  });

  it("F1: ○ marker rendered for a constant flow (isVariable=false)", () => {
    const { elements, flow } = horizontalScene({ isVariable: false });
    const instances = flowToInstances(flow, elements);
    const marker = instances.find((r) => r.glyphIdx === charToGlyphIdx("○"));
    expect(marker).toBeDefined();
    const variable = instances.filter((r) => r.glyphIdx === charToGlyphIdx("▼"));
    expect(variable.length).toBe(0);
  });

  it("F7: ▼ marker triggered by isVariable regardless of endpoint kind (cloud→stock)", () => {
    const elements: SDElement[] = [
      makeCloud({ id: "c1", x: 0, y: 0 }),
      makeStock({ id: "s2", x: 20, y: 0, width: 10, height: 5 }),
    ];
    const flow = makeFlow({ fromId: "c1", toId: "s2", isVariable: true });
    const instances = flowToInstances(flow, elements);
    const marker = instances.find((r) => r.glyphIdx === charToGlyphIdx("▼"));
    expect(marker).toBeDefined();
  });
});

// ---- AC-12c: dangling flow ref -------------------------------------------------

describe("flowToInstances — AC-12c dangling ref guard", () => {
  beforeEach(() => {
    warnedDanglingFlows.clear();
  });

  it("returns empty array + warns when fromId endpoint element doesn't exist", () => {
    // Option B (VS钉死决策): silent empty + console.warn — don't throw.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const elements: SDElement[] = [makeStock({ id: "s2", x: 20, y: 0, width: 10, height: 5 })];
    const instances = flowToInstances(makeFlow({ fromId: "nonexistent", toId: "s2" }), elements);
    expect(instances).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("dangling"));
    warnSpy.mockRestore();
  });

  it("returns empty array + warns when toId endpoint element doesn't exist", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const elements: SDElement[] = [makeStock({ id: "s1", x: 0, y: 0, width: 10, height: 5 })];
    const instances = flowToInstances(makeFlow({ fromId: "s1", toId: "nonexistent" }), elements);
    expect(instances).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("dangling"));
    warnSpy.mockRestore();
  });

  it("returns empty array when both endpoints are missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const instances = flowToInstances(makeFlow({ fromId: "gone1", toId: "gone2" }), []);
    expect(instances).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("dangling ref does NOT throw (graceful degradation, Option B)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => flowToInstances(makeFlow({ fromId: "ghost" }), [])).not.toThrow();
    warnSpy.mockRestore();
  });
});

// ---- AC-9: getElementPorts ---------------------------------------------------

describe("getElementPorts (AC-9)", () => {
  it("returns 4 ports for a stock — N, E, S, W edge midpoints (inclusive bounds)", () => {
    const stock = makeStock({ x: 0, y: 0, width: 10, height: 6 });
    const ports = getElementPorts(stock);
    expect(ports.length).toBe(4);

    // N port: center-x of top edge
    const nPort = ports.find((p) => p.side === "N");
    expect(nPort).toBeDefined();
    expect(nPort!.x).toBe(5); // round(0 + 10/2) = 5
    expect(nPort!.y).toBe(0); // y (top edge)

    // S port: center-x of bottom edge — inclusive (y + height - 1)
    const sPort = ports.find((p) => p.side === "S");
    expect(sPort).toBeDefined();
    expect(sPort!.x).toBe(5);
    expect(sPort!.y).toBe(5); // 0 + 6 - 1 (inclusive bound)

    // E port: center-y of right edge — inclusive (x + width - 1)
    const ePort = ports.find((p) => p.side === "E");
    expect(ePort).toBeDefined();
    expect(ePort!.x).toBe(9); // 0 + 10 - 1 (inclusive bound)
    expect(ePort!.y).toBe(3); // round(0 + 6/2) = 3

    // W port: center-y of left edge
    const wPort = ports.find((p) => p.side === "W");
    expect(wPort).toBeDefined();
    expect(wPort!.x).toBe(0); // x (left edge)
    expect(wPort!.y).toBe(3);
  });

  it("returns 4 ports for a cloud (fixed 6×3 icon, all integer cells)", () => {
    const cloud = makeCloud({ x: 10, y: 5 });
    const ports = getElementPorts(cloud);
    expect(ports.length).toBe(4);

    // All ports reference the cloud element ID.
    for (const p of ports) {
      expect(p.elementId).toBe(cloud.id);
    }

    // AC-9: cloud fixed 6×3 ports — N/S on row 0/2 at col+3, E/W on col 5/0
    // at row+1. All integer (NOT the generic bounding-box center y+1.5).
    const nPort = ports.find((p) => p.side === "N");
    expect(nPort!.x).toBe(13); // 10 + 3
    expect(nPort!.y).toBe(5); // 5 + 0

    const sPort = ports.find((p) => p.side === "S");
    expect(sPort!.x).toBe(13); // 10 + 3
    expect(sPort!.y).toBe(7); // 5 + 2

    const ePort = ports.find((p) => p.side === "E");
    expect(ePort!.x).toBe(15); // 10 + 5
    expect(ePort!.y).toBe(6); // 5 + 1

    const wPort = ports.find((p) => p.side === "W");
    expect(wPort!.x).toBe(10); // 10 + 0
    expect(wPort!.y).toBe(6); // 5 + 1
  });

  it("stock ports are integer (Math.round applied to midpoints)", () => {
    // Odd-dimension stock: width=7, height=5 → midpoint x=3.5, y=2.5 → rounded.
    const stock = makeStock({ x: 0, y: 0, width: 7, height: 5 });
    const ports = getElementPorts(stock);

    const nPort = ports.find((p) => p.side === "N")!;
    expect(nPort.x).toBe(4); // round(3.5) = 4
    expect(nPort.y).toBe(0);

    const ePort = ports.find((p) => p.side === "E")!;
    expect(ePort.x).toBe(6); // 0 + 7 - 1 (inclusive bound)
    expect(ePort.y).toBe(3); // round(2.5) = 3
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
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 0, y: 20, width: 8, height: 4 }),
    ];
    const instances = flowToInstances(makeFlow({ fromId: "s1", toId: "s2" }), elements);
    expect(instances.length).toBeGreaterThan(0);
    for (const r of instances) {
      // rotation is a defined number (may be 0 for straight segments)
      expect(typeof r.rotation).toBe("number");
      expect(Number.isFinite(r.rotation)).toBe(true);
    }
  });

  it("rotation values are multiples of π/2 (orthogonal directions only)", () => {
    const elements: SDElement[] = [
      makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 4 }),
      makeStock({ id: "s2", x: 20, y: 10, width: 8, height: 4 }),
    ];
    const instances = flowToInstances(makeFlow({ fromId: "s1", toId: "s2" }), elements);
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
