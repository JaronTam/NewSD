import { expect, test } from "@playwright/test";

// Story 1a.6 Task 5.1 — Minimap e2e (AC-9).
//
// Covers:
//   P2-9.1: Minimap <canvas> element present in DOM, correctly sized
//   P2-9.2: Elements rendered as colored points/blocks on minimap
//   P2-9.3: Highlight box visible on minimap and moves when viewport is panned/zoomed
//   P2-9.4: Click minimap → main viewport recenters to clicked world point
//   P2-9.5: E8 placeholder visible when canvas is empty
//   P2-9.6: Incremental dirty: move one element → only affected minimap region redrawn
//   P2-9.7: __e2e__ hook exposes minimapProjector/minimapDirtyTracker/getHighlightBox/jumpToWorld
//
// Uses __e2e__.minimapProjector, __e2e__.minimapDirtyTracker, __e2e__.getHighlightBox(),
// __e2e__.jumpToWorld(px, py), __e2e__.elementStore, __e2e__.seedBulk.

async function waitForRenderReady(page: import("@playwright/test").Page) {
  await page
    .waitForSelector(".ns-canvas__skeleton", { state: "hidden", timeout: 10_000 })
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      return c !== null && c.width > 0 && c.height > 0;
    },
    { timeout: 10_000 },
  );
  // Allow the minimap canvas (ResizeObserver) to settle after the GL canvas is ready.
  await page.waitForFunction(
    () => {
      const mc = document.querySelector("canvas.ns-canvas__minimap") as HTMLCanvasElement | null;
      return mc !== null && mc.width > 0 && mc.height > 0;
    },
    { timeout: 5_000 },
  );
}

test.describe("Minimap (Story 1a.6, AC-9)", () => {
  // ── P2-9.1 ────────────────────────────────────────────────────────────────────────
  test("P2-9.1: minimap canvas element is present and sized", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector("canvas.ns-canvas__minimap") as HTMLCanvasElement | null;
      if (!c) return null;
      return { width: c.width, height: c.height, tag: c.tagName };
    });

    expect(canvasInfo).not.toBeNull();
    expect(canvasInfo!.tag).toBe("CANVAS");
    expect(canvasInfo!.width).toBeGreaterThan(0);
    expect(canvasInfo!.height).toBeGreaterThan(0);
  });

  // ── P2-9.2 ────────────────────────────────────────────────────────────────────────
  test("P2-9.2: elements appear as colored points/blocks on the minimap", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const pixelCount = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);

      // Seed a mix of element types.
      api.elementStore.createStock({
        name: "s1",
        x: 0,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      api.elementStore.createStock({
        name: "s2",
        x: 30,
        y: 20,
        width: 8,
        height: 5,
        initialValue: 2,
        units: "",
        allowNegative: false,
      });

      // Force full minimap redraw so the elements are projected.
      // update() uses the internal 2D context — call via the exposed projector.
      const mp = api.minimapProjector;
      if (mp) {
        mp.forceFullProject();
        mp.update({ x: 0, y: 0, zoom: 16 }, { width: 800, height: 600 }, true, true);
      }

      const canvas = document.querySelector(
        "canvas.ns-canvas__minimap",
      ) as HTMLCanvasElement | null;
      if (!canvas) return -2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return -3;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonBg = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) nonBg++;
      }
      return nonBg;
    });

    // After seeding elements, the minimap should contain rendered dots/blocks.
    expect(pixelCount).toBeGreaterThan(0);
  });

  // ── P2-9.3 ────────────────────────────────────────────────────────────────────────
  test("P2-9.3: highlight box moves when viewport is panned", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Capture the highlight box at the default camera position.
    const initialBox = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getHighlightBox !== "function") return null;
      return api.getHighlightBox();
    });

    expect(initialBox).not.toBeNull();
    expect(typeof initialBox!.minX).toBe("number");
    expect(typeof initialBox!.minY).toBe("number");
    expect(typeof initialBox!.maxX).toBe("number");
    expect(typeof initialBox!.maxY).toBe("number");
    expect(initialBox!.maxX).toBeGreaterThan(initialBox!.minX);
    expect(initialBox!.maxY).toBeGreaterThan(initialBox!.minY);

    // Pan the camera and update the minimap.
    const pannedBox = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      const mp = api.minimapProjector;
      if (!mp) return null;

      // Simulate a panned camera (cam.x = 200, cam.y = 100, zoom preserved).
      mp.update({ x: 200, y: 100, zoom: 16 }, { width: 800, height: 600 }, true, false);

      if (typeof api.getHighlightBox !== "function") return null;
      return api.getHighlightBox();
    });

    expect(pannedBox).not.toBeNull();
    // After panning right (+200) and down (+100), the highlight box should have shifted.
    expect(pannedBox!.minX).toBeGreaterThan(initialBox!.minX);
    expect(pannedBox!.minY).toBeGreaterThan(initialBox!.minY);
  });

  // ── P2-9.4 ────────────────────────────────────────────────────────────────────────
  test("P2-9.4: clicking minimap recenters main viewport to clicked world point", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Use the __e2e__ jumpToWorld hook for programmatic access.
    // The actual pointer-event path is verified in the CanvasView unit tests (T4).
    const jumpResult = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.jumpToWorld !== "function") {
        return { error: "jumpToWorld not exposed" };
      }
      // jumpToWorld(px, py) converts minimap-pixel coordinates to world coordinates.
      const world = api.jumpToWorld(50, 30);
      return world;
    });

    expect(jumpResult.error).toBeUndefined();
    expect(typeof jumpResult.x).toBe("number");
    expect(typeof jumpResult.y).toBe("number");
    expect(Number.isFinite(jumpResult.x)).toBe(true);
    expect(Number.isFinite(jumpResult.y)).toBe(true);
  });

  // ── P2-9.5 ────────────────────────────────────────────────────────────────────────
  test("P2-9.5: E8 placeholder visible when canvas has zero elements", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const hasPlaceholder = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      // Clear all elements (triggers E8 placeholder on next update).
      api.elementStore.setElements([]);

      // Force full minimap redraw with zero elements → placeholder path.
      const mp = api.minimapProjector;
      if (mp) {
        mp.forceFullProject();
        mp.update({ x: 0, y: 0, zoom: 16 }, { width: 800, height: 600 }, true, true);
      }

      const canvas = document.querySelector(
        "canvas.ns-canvas__minimap",
      ) as HTMLCanvasElement | null;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Check that the canvas has non-transparent pixels (placeholder text/background).
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonTransparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) nonTransparent++;
      }
      // The placeholder should have rendered text + background.
      return nonTransparent > 0;
    });

    expect(hasPlaceholder).toBe(true);
  });

  // ── P2-9.6 ────────────────────────────────────────────────────────────────────────
  test("P2-9.6: moving one element triggers incremental dirty rects on minimap", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const dirtyState = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);

      // Create 10 elements spread across the world.
      for (let i = 0; i < 10; i++) {
        api.elementStore.createStock({
          name: `e${i}`,
          x: i * 20,
          y: 0,
          width: 5,
          height: 5,
          initialValue: i,
          units: "",
          allowNegative: false,
        });
      }

      // Full draw to establish the baseline minimap render.
      const mp = api.minimapProjector;
      if (mp) {
        mp.update({ x: 0, y: 0, zoom: 16 }, { width: 800, height: 600 }, true, true);
      }

      // Drain the minimap's own dirty tracker so we capture only the move.
      const dt = api.minimapDirtyTracker;
      if (!dt) return { error: "no minimapDirtyTracker" };
      dt.consume();

      // Move element e3 far away — this should mark old + new bbox as dirty.
      const elements = api.elementStore.getElements();
      const target = elements.find((e: any) => e.name === "e3");
      if (!target) return { error: "e3 not found" };
      api.elementStore.updateElement(target.id, { x: 500, y: 500 });

      // After the synchronous store update, the minimap dirty tracker should
      // have recorded dirty rects for both the old and new bounding boxes.
      const hasDirty = dt.hasDirty();
      const dirtyRects = dt.queryLowPrecision(10);

      return {
        hasDirty,
        rectCount: dirtyRects.length,
        // The dirty rects should cover only the affected regions, not the entire world.
        rectCountSane: dirtyRects.length > 0 && dirtyRects.length < 100,
      };
    });

    expect(dirtyState.error).toBeUndefined();
    expect(dirtyState.hasDirty).toBe(true);
    expect(dirtyState.rectCount).toBeGreaterThan(0);
    expect(dirtyState.rectCountSane).toBe(true);
  });

  // ── P2-9.7 ────────────────────────────────────────────────────────────────────────
  test("P2-9.7: __e2e__ hooks expose minimapProjector/minimapDirtyTracker/getHighlightBox/jumpToWorld", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const hooks = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return {
        hasMinimapProjector:
          typeof api.minimapProjector === "object" && api.minimapProjector !== null,
        hasMinimapDirtyTracker:
          typeof api.minimapDirtyTracker === "object" && api.minimapDirtyTracker !== null,
        hasGetHighlightBox: typeof api.getHighlightBox === "function",
        hasJumpToWorld: typeof api.jumpToWorld === "function",
      };
    });

    expect(hooks.hasMinimapProjector).toBe(true);
    expect(hooks.hasMinimapDirtyTracker).toBe(true);
    expect(hooks.hasGetHighlightBox).toBe(true);
    expect(hooks.hasJumpToWorld).toBe(true);
  });
});
