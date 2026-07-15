import { describe, expect, it } from "vitest";
import { SpatialIndex } from "./spatial-index";
import type { WorldRect } from "./camera";
import { createElementStore } from "../sd/store";
import type { SDElement, Stock, Cloud, Flow } from "../sd/types";

// ---- helpers -----------------------------------------------------------

function makeStock(overrides: Partial<Stock> & { id: string }): Stock {
  return {
    kind: "stock",
    name: overrides.name ?? "Test",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 8,
    height: overrides.height ?? 5,
    initialValue: 100,
    units: "",
    allowNegative: false,
    currentValue: 100,
    history: [100],
    ...overrides,
  };
}

function makeCloud(overrides: Partial<Cloud> & { id: string }): Cloud {
  return {
    kind: "cloud",
    name: overrides.id,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    ...overrides,
  };
}

function makeFlow(overrides: Partial<Flow> & { id: string }): Flow {
  return {
    kind: "flow",
    name: overrides.name ?? "Flow 1",
    fromId: overrides.fromId ?? "s1",
    toId: overrides.toId ?? "s2",
    formula: "1",
    isVariable: false,
    lastValue: 0,
    units: "",
    ...overrides,
  };
}

function vpRect(camX: number, camY: number, zoom: number, vpW = 1000, vpH = 600): WorldRect {
  const cx = vpW / 2;
  const cy = vpH / 2;
  const x0 = (0 - cx) / zoom + camX;
  const y0 = (0 - cy) / zoom + camY;
  const x1 = (vpW - cx) / zoom + camX;
  const y1 = (vpH - cy) / zoom + camY;
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

// ---- tests -------------------------------------------------------------

describe("SpatialIndex", () => {
  describe("construction and bulk load", () => {
    it("loads elements and finds them via search", () => {
      const store = createElementStore();
      const s1 = store.createStock({
        name: "A",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const s2 = store.createStock({
        name: "B",
        x: 600,
        y: 600,
        width: 10,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });

      const idx = new SpatialIndex(store);
      const rect = vpRect(0, 0, 1);

      const visible = idx.search(rect);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe(s1.id);

      const s2Rect = vpRect(600, 600, 1);
      const visible2 = idx.search(s2Rect);
      expect(visible2.length).toBe(1);
      expect(visible2[0].id).toBe(s2.id);

      idx.dispose();
    });

    it("handles empty store gracefully", () => {
      const store = createElementStore();
      const idx = new SpatialIndex(store);
      const rect = vpRect(0, 0, 1);
      expect(idx.search(rect)).toEqual([]);
      expect(idx.collides(rect)).toBe(false);
      idx.dispose();
    });

    it("handles bulk load with many items", () => {
      const store = createElementStore();
      const ids: string[] = [];
      for (let i = 0; i < 100; i++) {
        const s = store.createStock({
          name: `S${i}`,
          x: i * 10,
          y: 0,
          width: 8,
          height: 5,
          initialValue: 1,
          units: "",
          allowNegative: false,
        });
        ids.push(s.id);
      }

      const idx = new SpatialIndex(store);
      const rect = vpRect(0, 0, 1);
      const visible = idx.search(rect);
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThan(100);

      const wideRect = vpRect(500, 0, 1);
      const visible2 = idx.search(wideRect);
      expect(visible2.length).toBeGreaterThan(0);

      idx.dispose();
    });
  });

  describe("insert and remove", () => {
    it("inserts a new element and makes it searchable", () => {
      const store = createElementStore();
      const idx = new SpatialIndex(store);
      const s = makeStock({ id: "s1", x: 10, y: 10, width: 8, height: 5 });

      idx.insert(s);
      const rect: WorldRect = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
      const visible = idx.search(rect);
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe("s1");

      idx.dispose();
    });

    it("removes an element so it's no longer searchable", () => {
      const store = createElementStore();
      const s = store.createStock({
        name: "R",
        x: 5,
        y: 5,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const idx = new SpatialIndex(store);

      const rect: WorldRect = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
      expect(idx.search(rect).length).toBe(1);

      idx.remove(s);
      expect(idx.search(rect).length).toBe(0);

      idx.dispose();
    });

    it("skips degenerate elements (zero-area bbox)", () => {
      const store = createElementStore();
      const idx = new SpatialIndex(store);
      const f = makeFlow({ id: "f1", fromId: "missing1", toId: "missing2" });
      idx.insert(f);
      const rect: WorldRect = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
      expect(idx.search(rect).length).toBe(0);
      idx.dispose();
    });
  });

  describe("collides (point query)", () => {
    it("returns true when an element intersects the rect", () => {
      const store = createElementStore();
      store.createStock({
        name: "C",
        x: 50,
        y: 50,
        width: 10,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const idx = new SpatialIndex(store);

      expect(idx.collides({ minX: 45, minY: 45, maxX: 55, maxY: 55 })).toBe(true);
      expect(idx.collides({ minX: 0, minY: 0, maxX: 10, maxY: 10 })).toBe(false);
      idx.dispose();
    });
  });

  describe("sync (incremental diff)", () => {
    it("detects added elements", () => {
      const store = createElementStore();
      const idx = new SpatialIndex(store);
      const prev = store.getElements();
      const s = makeStock({ id: "new1", x: 5, y: 5, width: 8, height: 5 });
      const next = [...prev, s];

      idx.sync(prev, next);
      const rect: WorldRect = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
      expect(idx.search(rect).length).toBe(1);
      idx.dispose();
    });

    it("detects removed elements", () => {
      const store = createElementStore();
      const s = store.createStock({
        name: "R",
        x: 5,
        y: 5,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const idx = new SpatialIndex(store);
      const prev = store.getElements();
      const next: SDElement[] = [];

      idx.sync(prev, next);
      const rect: WorldRect = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
      expect(idx.search(rect).length).toBe(0);
      idx.dispose();
    });

    it("detects moved elements (bbox change)", () => {
      const store = createElementStore();
      const s = store.createStock({
        name: "M",
        x: 0,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const idx = new SpatialIndex(store);
      const prev = store.getElements();

      const moved = { ...s, x: 100, y: 100 };
      const next = [moved];

      idx.sync(prev, next);

      const oldRect: WorldRect = { minX: 0, minY: 0, maxX: 20, maxY: 20 };
      expect(idx.search(oldRect).length).toBe(0);

      const newRect: WorldRect = { minX: 95, minY: 95, maxX: 115, maxY: 115 };
      expect(idx.search(newRect).length).toBe(1);
      idx.dispose();
    });

    it("handles store.subscribe auto-sync", () => {
      const store = createElementStore();
      const idx = new SpatialIndex(store);

      const s = store.createStock({
        name: "Auto",
        x: 20,
        y: 20,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });

      const rect: WorldRect = { minX: 15, minY: 15, maxX: 30, maxY: 30 };
      expect(idx.search(rect).length).toBe(1);
      expect(idx.search(rect)[0].id).toBe(s.id);

      store.deleteElement(s.id);
      expect(idx.search(rect).length).toBe(0);

      idx.dispose();
    });
  });

  describe("flow bbox", () => {
    it("indexes flow elements using their rendered-path bbox", () => {
      const store = createElementStore();
      const s1 = store.createStock({
        name: "From",
        x: 0,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const s2 = store.createStock({
        name: "To",
        x: 20,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });

      const flow: Flow = {
        id: "flow-1",
        kind: "flow",
        name: "F1",
        fromId: s1.id,
        toId: s2.id,
        formula: "1",
        isVariable: false,
        lastValue: 0,
        units: "",
      };
      store.setElements([s1, s2, flow]);

      const idx = new SpatialIndex(store);

      const rect: WorldRect = { minX: 0, minY: -10, maxX: 30, maxY: 10 };
      const visible = idx.search(rect);
      const flowHit = visible.find((e) => e.kind === "flow");
      expect(flowHit).toBeDefined();

      idx.dispose();
    });

    it("updates flow bbox when an endpoint moves (CR H2 regression)", () => {
      const store = createElementStore();
      const s1 = makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 5 });
      const s2 = makeStock({ id: "s2", x: 20, y: 0, width: 8, height: 5 });
      const flow = makeFlow({ id: "f1", fromId: "s1", toId: "s2" });
      store.setElements([s1, s2, flow]);
      const idx = new SpatialIndex(store);

      // flow bbox spans s1(0,0)..s2(20,0) -> roughly x[0,28].
      const oldFlowRect: WorldRect = { minX: 0, minY: -10, maxX: 30, maxY: 10 };
      expect(idx.search(oldFlowRect).find((e) => e.kind === "flow")).toBeDefined();

      // Move both endpoints far away -> flow bbox must follow (AC-2 无遗漏).
      // store.setElements triggers subscription auto-sync.
      store.setElements([{ ...s1, x: 500, y: 500 }, { ...s2, x: 520, y: 500 }, flow]);

      // Bug (H2): sync oldBbox used next-state endpoints -> oldBbox≡newBbox
      // -> no index update -> flow stays at old bbox -> oldFlowRect still hits.
      // Fix: oldBbox uses prev-state endpoints -> flow bbox updates.
      expect(idx.search(oldFlowRect).find((e) => e.kind === "flow")).toBeUndefined();

      const newFlowRect: WorldRect = { minX: 495, minY: 490, maxX: 530, maxY: 510 };
      expect(idx.search(newFlowRect).find((e) => e.kind === "flow")).toBeDefined();

      idx.dispose();
    });

    it("removes a flow cleanly after its endpoint moved (CR H6 regression)", () => {
      const store = createElementStore();
      const s1 = makeStock({ id: "s1", x: 0, y: 0, width: 8, height: 5 });
      const s2 = makeStock({ id: "s2", x: 20, y: 0, width: 8, height: 5 });
      const flow = makeFlow({ id: "f1", fromId: "s1", toId: "s2" });
      store.setElements([s1, s2, flow]);
      const idx = new SpatialIndex(store);

      // Move endpoint s2 far away (flow bbox updates via H2 fix), then delete
      // the flow. remove() must take the flow out of the tree entirely.
      store.setElements([s1, { ...s2, x: 500, y: 500 }, flow]);
      store.setElements([s1, { ...s2, x: 500, y: 500 }]); // flow removed

      // Bug (H6): remove recomputed bbox from current store -> mismatched the
      // tree entry -> stale flow item leaked -> search still hits flow.
      // Fix: remove uses the cached indexed bbox -> clean removal.
      const wideRect: WorldRect = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
      expect(idx.search(wideRect).find((e) => e.kind === "flow")).toBeUndefined();

      idx.dispose();
    });
  });

  describe("dispose", () => {
    it("unsubscribes and clears state", () => {
      const store = createElementStore();
      store.createStock({
        name: "D",
        x: 0,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      const idx = new SpatialIndex(store);
      idx.dispose();

      store.createStock({
        name: "D2",
        x: 10,
        y: 10,
        width: 8,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
    });
  });
});
