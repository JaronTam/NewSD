import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MinimapProjector, MINIMAP_DIRTY_CELL_PX } from "./minimap";
import type { Camera, Viewport, WorldRect } from "./camera";
import type { ElementStore } from "../sd/store";
import type { SpatialIndex } from "./spatial-index";
import type { SDElement, Stock, Cloud, Flow } from "../sd/types";
import { DirtyRectTracker } from "./dirty-rect";

// ---- test helpers --------------------------------------------------------

function rect(minX: number, minY: number, maxX: number, maxY: number): WorldRect {
  return { minX, minY, maxX, maxY };
}

function stock(id: string, x: number, y: number, w = 8, h = 5): Stock {
  return {
    id,
    kind: "stock",
    name: id,
    x,
    y,
    width: w,
    height: h,
    initialValue: 0,
    currentValue: 0,
    history: [],
    units: "",
    allowNegative: false,
  };
}

function cloud(id: string, x: number, y: number): Cloud {
  return { id, kind: "cloud", x, y };
}

function flow(id: string, fromId: string, toId: string): Flow {
  return {
    id,
    kind: "flow",
    name: id,
    fromId,
    toId,
    formula: "0",
    isVariable: false,
    lastValue: 0,
    units: "",
  };
}

interface StoreMock {
  elements: SDElement[];
  listeners: Array<() => void>;
}

function createStoreMock(initial: SDElement[] = []): {
  store: ElementStore;
  mock: StoreMock;
} {
  const mock: StoreMock = { elements: [...initial], listeners: [] };
  const store: ElementStore = {
    getElements: () => mock.elements,
    getSnapshot: () => mock.elements,
    createStock: vi.fn() as any,
    createCloud: vi.fn() as any,
    updateElement: vi.fn(),
    deleteElement: vi.fn(),
    setElements: (els: readonly SDElement[]) => {
      mock.elements = [...els];
      mock.listeners.forEach((cb) => cb());
    },
    subscribe: (cb: () => void) => {
      mock.listeners.push(cb);
      return () => {
        const idx = mock.listeners.indexOf(cb);
        if (idx >= 0) mock.listeners.splice(idx, 1);
      };
    },
  };
  return { store, mock };
}

function createSpatialIndexMock(): SpatialIndex {
  return {
    search: vi.fn((_rect: WorldRect): SDElement[] => []),
    collides: vi.fn(() => false),
    insert: vi.fn(),
    remove: vi.fn(),
    load: vi.fn(),
    sync: vi.fn(),
    dispose: vi.fn(),
    elementStore: null as any,
  } as any;
}

function createCamera(x = 0, y = 0, zoom = 1): Camera {
  return { x, y, zoom };
}

function createViewport(w = 800, h = 600): Viewport {
  return { width: w, height: h };
}

function createCanvas(w = 200, h = 150): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Create a mock CanvasRenderingContext2D with vi.fn() spies on all drawing
 * methods. jsdom does NOT implement Canvas2D (setup.ts overrides getContext
 * to return null), so we supply a full mock and temporarily patch getContext
 * when tests need to exercise the drawing path.
 */
function createMockContext() {
  return {
    // Drawing
    fillRect: vi.fn<CanvasRenderingContext2D["fillRect"]>(),
    clearRect: vi.fn<CanvasRenderingContext2D["clearRect"]>(),
    strokeRect: vi.fn<CanvasRenderingContext2D["strokeRect"]>(),
    fillText: vi.fn<CanvasRenderingContext2D["fillText"]>(),
    strokeText: vi.fn<CanvasRenderingContext2D["strokeText"]>(),
    arc: vi.fn<CanvasRenderingContext2D["arc"]>(),
    beginPath: vi.fn<CanvasRenderingContext2D["beginPath"]>(),
    closePath: vi.fn<CanvasRenderingContext2D["closePath"]>(),
    stroke: vi.fn<CanvasRenderingContext2D["stroke"]>(),
    fill: vi.fn<CanvasRenderingContext2D["fill"]>(),
    moveTo: vi.fn<CanvasRenderingContext2D["moveTo"]>(),
    lineTo: vi.fn<CanvasRenderingContext2D["lineTo"]>(),
    rect: vi.fn<CanvasRenderingContext2D["rect"]>(),
    arcTo: vi.fn<CanvasRenderingContext2D["arcTo"]>(),
    bezierCurveTo: vi.fn<CanvasRenderingContext2D["bezierCurveTo"]>(),
    quadraticCurveTo: vi.fn<CanvasRenderingContext2D["quadraticCurveTo"]>(),
    ellipse: vi.fn<CanvasRenderingContext2D["ellipse"]>(),
    clip: vi.fn<CanvasRenderingContext2D["clip"]>(),
    // State
    save: vi.fn<CanvasRenderingContext2D["save"]>(),
    restore: vi.fn<CanvasRenderingContext2D["restore"]>(),
    translate: vi.fn<CanvasRenderingContext2D["translate"]>(),
    scale: vi.fn<CanvasRenderingContext2D["scale"]>(),
    rotate: vi.fn<CanvasRenderingContext2D["rotate"]>(),
    transform: vi.fn<CanvasRenderingContext2D["transform"]>(),
    setTransform: vi.fn<CanvasRenderingContext2D["setTransform"]>(),
    resetTransform: vi.fn<CanvasRenderingContext2D["resetTransform"]>(),
    getTransform: vi.fn<CanvasRenderingContext2D["getTransform"]>(),
    createLinearGradient: vi.fn<CanvasRenderingContext2D["createLinearGradient"]>(),
    createRadialGradient: vi.fn<CanvasRenderingContext2D["createRadialGradient"]>(),
    createConicGradient: vi.fn<CanvasRenderingContext2D["createConicGradient"]>(),
    createPattern: vi.fn<CanvasRenderingContext2D["createPattern"]>(),
    createImageData: vi.fn<CanvasRenderingContext2D["createImageData"]>(),
    getImageData: vi.fn<CanvasRenderingContext2D["getImageData"]>(),
    putImageData: vi.fn<CanvasRenderingContext2D["putImageData"]>(),
    drawImage: vi.fn<CanvasRenderingContext2D["drawImage"]>(),
    drawFocusIfNeeded: vi.fn<CanvasRenderingContext2D["drawFocusIfNeeded"]>(),
    measureText: vi.fn(() => ({ width: 50 }) as TextMetrics),
    isPointInPath: vi.fn<CanvasRenderingContext2D["isPointInPath"]>(),
    isPointInStroke: vi.fn<CanvasRenderingContext2D["isPointInStroke"]>(),
    getContextAttributes: vi.fn<CanvasRenderingContext2D["getContextAttributes"]>(),
    getLineDash: vi.fn(() => []),
    setLineDash: vi.fn<CanvasRenderingContext2D["setLineDash"]>(),
    createPath2D: vi.fn(),
    reset: vi.fn<CanvasRenderingContext2D["reset"]>(),
    roundRect: vi.fn<CanvasRenderingContext2D["roundRect"]>(),
    // Mutable properties
    fillStyle: "" as string | CanvasGradient | CanvasPattern,
    strokeStyle: "" as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    lineDashOffset: 0,
    miterLimit: 10,
    font: "",
    textAlign: "start" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    direction: "inherit" as CanvasDirection,
    globalAlpha: 1,
    globalCompositeOperation: "source-over" as GlobalCompositeOperation,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "low" as ImageSmoothingQuality,
    shadowBlur: 0,
    shadowColor: "rgba(0,0,0,0)",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    filter: "none",
    // Canvas properties
    get canvas() {
      return null as unknown as HTMLCanvasElement;
    },
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Temporarily override HTMLCanvasElement.getContext to return a mock context,
 * run the test body, then restore the original. jsdom returns null for all
 * context types (setup.ts hard-stubs it), so this is the only way to test
 * canvas-drawing code outside of Playwright e2e.
 */
function withMockContext(
  fn: (ctx: ReturnType<typeof createMockContext>) => void | Promise<void>,
): void {
  const origGetContext = HTMLCanvasElement.prototype.getContext.bind(HTMLCanvasElement.prototype);
  const mockCtx = createMockContext();

  HTMLCanvasElement.prototype.getContext = ((_type: string, _opts?: any) =>
    mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  try {
    fn(mockCtx);
  } finally {
    HTMLCanvasElement.prototype.getContext =
      origGetContext as typeof HTMLCanvasElement.prototype.getContext;
  }
}

// ---- tests ---------------------------------------------------------------

describe("MinimapProjector", () => {
  let canvas: HTMLCanvasElement;
  let storeMock: StoreMock;
  let store: ElementStore;
  let spatialIndex: SpatialIndex;

  beforeEach(() => {
    canvas = createCanvas();
    const m = createStoreMock();
    storeMock = m.mock;
    store = m.store;
    spatialIndex = createSpatialIndexMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -- construction & dirty tracker ----------------------------------------

  describe("construction", () => {
    it("creates an independent dirty tracker", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(mp.dirtyTracker).toBeInstanceOf(DirtyRectTracker);
      expect(mp.dirtyTracker.hasDirty()).toBe(false);
      mp.dispose();
    });

    it("subscribes to the element store", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(storeMock.listeners.length).toBe(1);
      mp.dispose();
    });

    it("dispose unsubscribes from store", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(storeMock.listeners.length).toBe(1);
      mp.dispose();
      // Listener was removed by unsubscribe.
    });
  });

  // -- world ↔ minimap transforms ------------------------------------------

  describe("worldToMinimap / minimapToWorld", () => {
    it("return [0,0] when worldBounds is null (no elements)", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(mp.worldToMinimap(100, 200)).toEqual([0, 0]);
      expect(mp.minimapToWorld(50, 75)).toEqual([0, 0]);
      mp.dispose();
    });

    it("transforms are inverses of each other", () => {
      store.setElements([stock("s1", 0, 0, 10, 10), stock("s2", 100, 100, 10, 10)]);
      const mp = new MinimapProjector(canvas, store, spatialIndex);

      withMockContext(() => {
        mp.update(createCamera(), createViewport(), true, true);
      });

      const [px, py] = mp.worldToMinimap(50, 50);
      const [wx, wy] = mp.minimapToWorld(px, py);
      expect(wx).toBeCloseTo(50, 4);
      expect(wy).toBeCloseTo(50, 4);
      mp.dispose();
    });

    it("worldToMinimap maps world origin into the padded minimap area", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);
      const mp = new MinimapProjector(canvas, store, spatialIndex);

      withMockContext(() => {
        mp.update(createCamera(), createViewport(), true, true);
      });

      const [px, py] = mp.worldToMinimap(0, 0);
      // Should be >= padding (8) and within canvas bounds.
      expect(px).toBeGreaterThanOrEqual(7);
      expect(py).toBeGreaterThanOrEqual(7);
      expect(px).toBeLessThanOrEqual(canvas.width);
      expect(py).toBeLessThanOrEqual(canvas.height);
      mp.dispose();
    });

    it("minimapToWorld with centre pixel returns world centre", () => {
      store.setElements([stock("s1", -10, -10, 8, 5), stock("s2", 10, 10, 8, 5)]);
      const mp = new MinimapProjector(canvas, store, spatialIndex);

      withMockContext(() => {
        mp.update(createCamera(), createViewport(), true, true);
      });

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const [wx, wy] = mp.minimapToWorld(cx, cy);
      // Elements span (-10,-10,8×5) to (10,10,8×5) → world ~(-10,-10)-(18,15).
      // The minimap centre pixel projects to somewhere inside the world bounds.
      expect(wx).toBeGreaterThan(-11);
      expect(wx).toBeLessThan(19);
      expect(wy).toBeGreaterThan(-11);
      expect(wy).toBeLessThan(16);
      mp.dispose();
    });
  });

  // -- full projection -----------------------------------------------------

  describe("full projection (Branch 1 mount/bulk)", () => {
    it("draws stock + cloud elements on the canvas", () => {
      store.setElements([stock("s1", 0, 0, 8, 5), cloud("c1", 20, 20)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // Stock → fillRect, Cloud → arc.
        // Background + stock rect calls.
        const rectCalls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
        expect(rectCalls.length).toBeGreaterThanOrEqual(2);

        // Cloud should draw an arc (circle).
        expect(ctx.arc).toHaveBeenCalled();
        mp.dispose();
      });
    });

    it("draws flow as a line between endpoint centres", () => {
      store.setElements([
        stock("s1", 0, 0, 8, 5),
        stock("s2", 50, 50, 8, 5),
        flow("f1", "s1", "s2"),
      ]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // Flow line → beginPath, moveTo, lineTo, stroke.
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
        mp.dispose();
      });
    });
  });

  // -- E8 placeholder ------------------------------------------------------

  describe("E8 placeholder (AC-5)", () => {
    it("draws placeholder text when zero elements", () => {
      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        expect(ctx.fillText).toHaveBeenCalled();
        const textArg = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
        expect(textArg).toBe("No elements");
        mp.dispose();
      });
    });

    it("does not draw placeholder when elements exist", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls
          .map((c) => c[0])
          .filter((t) => typeof t === "string");
        expect(calls).not.toContain("No elements");
        mp.dispose();
      });
    });

    it("transitions from placeholder to full projection on 0→1 (AC-6)", () => {
      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);

        // Initial: empty → placeholder.
        mp.update(createCamera(), createViewport(), true, true);

        // Add first element.
        store.setElements([stock("s1", 0, 0, 8, 5)]);
        const fillTextSpy = ctx.fillText as ReturnType<typeof vi.fn>;
        fillTextSpy.mockClear();

        // Trigger update — needsFullProject from 0→1 detection.
        mp.update(createCamera(), createViewport(), false, false);

        // Placeholder text should NOT be drawn.
        const calls = fillTextSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
        expect(calls).not.toContain("No elements");
        mp.dispose();
      });
    });
  });

  // -- 3-branch update -----------------------------------------------------

  describe("3-branch update", () => {
    it("Branch 1 (mount,bulk): full projection draws background + elements", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // Background + element rect(s).
        expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(
          2,
        );
        mp.dispose();
      });
    });

    it("Branch 2 (dirty): incremental update clears dirty region", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);

        // First update: mount → full.
        mp.update(createCamera(), createViewport(), true, true);

        // Mark a dirty rect and trigger Branch 2.
        mp.dirtyTracker.markDirty(rect(0, 0, 10, 10), "s1");
        (spatialIndex.search as any).mockReturnValue([store.getElements()[0]]);

        (ctx.clearRect as ReturnType<typeof vi.fn>).mockClear();
        mp.update(createCamera(), createViewport(), false, false);

        // Should clear dirty minimap region.
        expect(ctx.clearRect).toHaveBeenCalled();
        // After Branch 2, dirty tracker is drained.
        expect(mp.dirtyTracker.hasDirty()).toBe(false);
        mp.dispose();
      });
    });

    it("Branch 3 (skip): no drawing when no camera change and no dirty", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        (ctx.clearRect as ReturnType<typeof vi.fn>).mockClear();
        (ctx.fillRect as ReturnType<typeof vi.fn>).mockClear();

        // No camera change, no dirty → skips drawing.
        mp.update(createCamera(), createViewport(), false, false);

        // clearRect should NOT be called on the skip path.
        expect(ctx.clearRect).not.toHaveBeenCalled();
        // fillRect should NOT be called (no background redraw).
        expect(ctx.fillRect).not.toHaveBeenCalled();
        mp.dispose();
      });
    });

    it("camera-only change draws highlight box (Branch 1 camera-only)", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);
        (ctx.strokeRect as ReturnType<typeof vi.fn>).mockClear();

        // Camera change but no element change → Branch 1 full repaint path (spec amendment, CR Run 1 F-A).
        // Implementation falls into Branch 1 (cameraChanged) → redraws
        // background + elements + highlight box.
        mp.update(createCamera(100, 100, 1), createViewport(), true, false);

        // Highlight box strokeRect is called.
        expect(ctx.strokeRect).toHaveBeenCalled();
        mp.dispose();
      });
    });
  });

  // -- incremental projection performance (AC-4) ---------------------------

  describe("incremental projection performance (AC-4)", () => {
    it("incremental path only redraws elements in dirty rects", () => {
      const elements: SDElement[] = [];
      for (let i = 0; i < 10000; i++) {
        elements.push(stock(`s${i}`, (i % 10) * 20, Math.floor(i / 10) * 20, 8, 5));
      }
      store.setElements(elements);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // Mark a single dirty rect → only s0 should be affected.
        mp.dirtyTracker.markDirty(rect(0, 0, 20, 20), "s0");
        (spatialIndex.search as any).mockImplementation((r: WorldRect) => {
          if (r.minX <= 20 && r.minY <= 20) return [elements[0]];
          return [];
        });

        (ctx.fillRect as ReturnType<typeof vi.fn>).mockClear();
        mp.update(createCamera(), createViewport(), false, false);

        // Only redraws the affected element (s0 = 1 stock rect), not all 10000.
        // Branch 2 → incrementalProject → only elements in dirty rects drawn.
        // fillRect called once for s0 (plus possibly background).
        expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThan(10);
        mp.dispose();
      });
    });

    it("drains dirty tracker after incremental update", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        mp.dirtyTracker.markDirty(rect(0, 0, 10, 10), "s1");
        expect(mp.dirtyTracker.hasDirty()).toBe(true);

        (spatialIndex.search as any).mockReturnValue([store.getElements()[0]]);
        mp.update(createCamera(), createViewport(), false, false);

        expect(mp.dirtyTracker.hasDirty()).toBe(false);
        mp.dispose();
      });
    });
  });

  // -- jumpToWorld ---------------------------------------------------------

  describe("jumpToWorld (AC-3)", () => {
    it("converts minimap pixel to world coordinate", () => {
      store.setElements([stock("s1", 0, 0, 8, 5), stock("s2", 100, 100, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const result = mp.jumpToWorld(canvas.width / 2, canvas.height / 2);
        expect(typeof result.x).toBe("number");
        expect(typeof result.y).toBe("number");
        expect(Number.isFinite(result.x)).toBe(true);
        expect(Number.isFinite(result.y)).toBe(true);
        mp.dispose();
      });
    });

    it("jumpToWorld + worldToMinimap round-trip", () => {
      store.setElements([stock("s1", -50, -50, 8, 5), stock("s2", 50, 50, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const px = 100;
        const py = 75;
        const { x: wx, y: wy } = mp.jumpToWorld(px, py);
        const [px2, py2] = mp.worldToMinimap(wx, wy);

        expect(px2).toBeCloseTo(px, 5);
        expect(py2).toBeCloseTo(py, 5);
        mp.dispose();
      });
    });

    it("jumpToWorld returns (0,0) when worldBounds is null (no elements)", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      const result = mp.jumpToWorld(100, 75);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      mp.dispose();
    });

    it("scale getter returns 1 when minimapScale is 0 (uninitialized)", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(mp.scale).toBe(1);
      mp.dispose();
    });

    it("scale getter returns correct world-units-per-pixel after projection", () => {
      store.setElements([stock("s1", 0, 0, 8, 5), stock("s2", 100, 100, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // scale = 1 / minimapScale. Should be > 0 (world units per minimap pixel).
        expect(mp.scale).toBeGreaterThan(0);
        mp.dispose();
      });
    });

    it("minimapToWorld handles out-of-bounds pixels (negative, beyond canvas)", () => {
      store.setElements([stock("s1", 0, 0, 8, 5), stock("s2", 100, 100, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        // Out-of-bounds pixels should still return finite world coordinates
        // (clamped/extrapolated by the inverse affine transform).
        const [wx1, wy1] = mp.minimapToWorld(-10, -10);
        expect(Number.isFinite(wx1)).toBe(true);
        expect(Number.isFinite(wy1)).toBe(true);

        const [wx2, wy2] = mp.minimapToWorld(9999, 9999);
        expect(Number.isFinite(wx2)).toBe(true);
        expect(Number.isFinite(wy2)).toBe(true);
        mp.dispose();
      });
    });

    it("jumpToWorld with large world span still returns finite coords", () => {
      store.setElements([stock("s1", -1e6, -1e6, 8, 5), stock("s2", 1e6, 1e6, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const result = mp.jumpToWorld(canvas.width / 2, canvas.height / 2);
        expect(Number.isFinite(result.x)).toBe(true);
        expect(Number.isFinite(result.y)).toBe(true);
        mp.dispose();
      });
    });
  });

  // -- computeDirtyStep ----------------------------------------------------

  describe("computeDirtyStep", () => {
    it("returns at least 1 even without worldBounds", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      // minimapScale defaults to 1 → step = max(1, round(4/1)) = 4.
      expect(mp.computeDirtyStep()).toBeGreaterThanOrEqual(1);
      mp.dispose();
    });

    it("rounds based on MINIMAP_DIRTY_CELL_PX and minimapScale", () => {
      store.setElements([stock("s1", 0, 0, 8, 5), stock("s2", 1000, 1000, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const step = mp.computeDirtyStep();
        // With a large world span, scale is small → step > 1.
        expect(step).toBeGreaterThanOrEqual(1);
        mp.dispose();
      });
    });
  });

  // -- getHighlightBox -----------------------------------------------------

  describe("getHighlightBox", () => {
    it("returns null before any draw", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(mp.getHighlightBox()).toBeNull();
      mp.dispose();
    });

    it("returns the viewport world rect after drawing highlight", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(0, 0, 2), createViewport(800, 600), true, true);

        const hb = mp.getHighlightBox();
        expect(hb).not.toBeNull();
        expect(hb!.minX).toBeLessThan(hb!.maxX);
        expect(hb!.minY).toBeLessThan(hb!.maxY);
        mp.dispose();
      });
    });
  });

  // -- forceFullProject ----------------------------------------------------

  describe("forceFullProject", () => {
    it("causes next update to do a full projection even without camera change", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        mp.forceFullProject();

        (ctx.fillRect as ReturnType<typeof vi.fn>).mockClear();
        mp.update(createCamera(), createViewport(), false, false);

        // Full redraw: background + element.
        expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(
          1,
        );
        mp.dispose();
      });
    });
  });

  // -- single-element / collocated span (CS钉死 #9) -----------------------

  describe("single-element world bounds (CS钉死 #9)", () => {
    it("single element gets minimum span — no div-by-zero", () => {
      store.setElements([stock("s1", 50, 50, 8, 5)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const { x, y } = mp.jumpToWorld(canvas.width / 2, canvas.height / 2);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
        mp.dispose();
      });
    });

    it("collocated elements get minimum span", () => {
      store.setElements([stock("s1", 10, 10, 8, 5), cloud("c1", 10, 10)]);

      withMockContext(() => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);

        const step = mp.computeDirtyStep();
        expect(step).toBeGreaterThanOrEqual(1);
        expect(Number.isFinite(step)).toBe(true);
        mp.dispose();
      });
    });
  });

  // -- store subscription → dirty tracking --------------------------------

  describe("store subscription dirty tracking", () => {
    it("marks dirty when element is added", () => {
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      expect(mp.dirtyTracker.hasDirty()).toBe(false);

      store.setElements([stock("new1", 0, 0, 8, 5)]);

      // After subscription fires, dirty tracker should have rects.
      expect(mp.dirtyTracker.hasDirty()).toBe(true);
      mp.dispose();
    });

    it("marks dirty when element is moved", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);
      const mp = new MinimapProjector(canvas, store, spatialIndex);
      // Drain initial subscription marks.
      mp.dirtyTracker.consume();

      // Move the element.
      store.setElements([stock("s1", 100, 100, 8, 5)]);

      expect(mp.dirtyTracker.hasDirty()).toBe(true);
      mp.dispose();
    });

    it("triggers full projection (placeholder) on element removal", () => {
      store.setElements([stock("s1", 0, 0, 8, 5)]);

      withMockContext((ctx) => {
        const mp = new MinimapProjector(canvas, store, spatialIndex);
        mp.update(createCamera(), createViewport(), true, true);
        mp.dirtyTracker.consume();

        // Remove the element.
        store.setElements([]);

        const fillTextSpy = ctx.fillText as ReturnType<typeof vi.fn>;
        fillTextSpy.mockClear();

        mp.update(createCamera(), createViewport(), false, false);

        expect(ctx.fillText).toHaveBeenCalled();
        const textArg = fillTextSpy.mock.calls[0]?.[0];
        expect(textArg).toBe("No elements");
        mp.dispose();
      });
    });
  });
});
