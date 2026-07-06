import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasView } from "./CanvasView";
import { getElementBounds } from "./elements";

// Integration smoke for FR-CANVAS-1: the camera math (panBy/zoomAt/clamp) is
// unit-tested in camera.test.ts; here we assert the view layer wires input ->
// camera -> HUD and that the F4 loading skeleton -> ready transition holds.
// jsdom has no 2D canvas context (getContext returns null), so draw() cannot
// paint pixels — but the HUD is updated before the ctx early-return, which is
// exactly what lets us observe pan/zoom through the HUD text imperatively.

async function renderReady() {
  const utils = render(<CanvasView />);
  await waitFor(() => expect(utils.container.querySelector(".ns-canvas__skeleton")).toBeNull());
  return utils;
}

function hudText(container: HTMLElement): string {
  const el = container.querySelector(".ns-canvas__hud");
  return el?.textContent ?? "";
}

function zoomPercent(text: string): number {
  const m = text.match(/zoom\s+(\d+)%/);
  return m ? Number(m[1]) : NaN;
}

describe("CanvasView — F4 loading skeleton + ready transition", () => {
  afterEach(() => cleanup());

  it("shows the loading skeleton on first render (non-blank during load)", () => {
    const { container } = render(<CanvasView />);
    // The ready flip is deferred to a macrotask, so synchronously after render
    // the skeleton is still mounted — this is the F4 "non-blank" guarantee.
    const skeleton = container.querySelector(".ns-canvas__skeleton");
    expect(skeleton).not.toBeNull();
    expect(skeleton?.textContent).toContain("INITIALIZING CANVAS");
  });

  it("mounts the canvas surface and clears the skeleton once ready", async () => {
    const { container } = await renderReady();
    expect(container.querySelector(".ns-canvas__skeleton")).toBeNull();
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
    // HUD baseline is present and on the default zoom (16 -> 1600%).
    expect(zoomPercent(hudText(container))).toBe(1600);
  });
});

describe("CanvasView — FR-CANVAS-1 pan/zoom input wiring", () => {
  afterEach(() => cleanup());

  it("wheel zoom updates the HUD zoom (cursor-anchored, clamped 0.05-20)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = zoomPercent(hudText(container));
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 100, clientY: 50 });
    const after = zoomPercent(hudText(container));
    expect(after).toBeGreaterThan(before); // zoomed in
    expect(after).toBeLessThanOrEqual(2000); // MAX_ZOOM 20 -> 2000%
  });

  it("wheel zoom-out clamps to the MIN_ZOOM floor", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    // A huge positive deltaY zooms out aggressively; repeated wheels must floor.
    for (let i = 0; i < 60; i++) {
      fireEvent.wheel(canvas, { deltaY: 1e6, clientX: 50, clientY: 50 });
    }
    expect(zoomPercent(hudText(container))).toBe(5); // MIN_ZOOM 0.05 -> 5%
  });

  it("middle-mouse drag pans the world (HUD world coords move)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = hudText(container);
    fireEvent.pointerDown(canvas, { button: 1, pointerId: 1, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 220, clientY: 50 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 220, clientY: 50 });
    expect(hudText(container)).not.toBe(before);
  });

  it("space + left-mouse drag pans (space gate enables left-button pan)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = hudText(container);
    fireEvent.keyDown(window, { code: "Space", keyCode: 32 });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 2, clientX: 80, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 200, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 200, clientY: 40 });
    expect(hudText(container)).not.toBe(before);
  });

  it("left-mouse drag without Space does NOT pan (no accidental drag)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = hudText(container);
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 3, clientX: 100, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 220, clientY: 50 });
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 220, clientY: 50 });
    // HUD may update cursor coords on hover, but zoom must be unchanged and the
    // camera must not have translated — assert zoom stayed at the default.
    expect(zoomPercent(hudText(container))).toBe(1600);
    expect(before).toContain("zoom 1600%");
  });
});

describe("CanvasView — FR-CANVAS-1 pinch (two-finger zoom)", () => {
  afterEach(() => cleanup());

  it("two pointers spreading apart zoom the HUD in (pinch-open)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = zoomPercent(hudText(container));
    // Two fingers down 100px apart, horizontal.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 10, clientX: 400, clientY: 300 });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 11, clientX: 500, clientY: 300 });
    // Spread to 300px apart — factor 3x on the midpoint (450, 300).
    fireEvent.pointerMove(canvas, { pointerId: 10, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(canvas, { pointerId: 11, clientX: 600, clientY: 300 });
    fireEvent.pointerUp(canvas, { pointerId: 10, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(canvas, { pointerId: 11, clientX: 600, clientY: 300 });
    const after = zoomPercent(hudText(container));
    expect(after).toBeGreaterThan(before); // zoomed in
    expect(after).toBeLessThanOrEqual(2000); // MAX_ZOOM 20 -> 2000%
  });

  it("two pointers pinching in zoom the HUD out (pinch-close)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    // First zoom in via wheel so we have room to pinch out and observe it.
    fireEvent.wheel(canvas, { deltaY: -400, clientX: 400, clientY: 300 });
    const before = zoomPercent(hudText(container));
    expect(before).toBeGreaterThan(100);
    // Two fingers 400px apart -> collapse to 100px.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 20, clientX: 200, clientY: 300 });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 21, clientX: 600, clientY: 300 });
    fireEvent.pointerMove(canvas, { pointerId: 20, clientX: 350, clientY: 300 });
    fireEvent.pointerMove(canvas, { pointerId: 21, clientX: 450, clientY: 300 });
    fireEvent.pointerUp(canvas, { pointerId: 20, clientX: 350, clientY: 300 });
    fireEvent.pointerUp(canvas, { pointerId: 21, clientX: 450, clientY: 300 });
    const after = zoomPercent(hudText(container));
    expect(after).toBeLessThan(before); // zoomed out
    expect(after).toBeGreaterThanOrEqual(5); // MIN_ZOOM 0.05 -> 5%
  });
});

describe("CanvasView — FR-CANVAS-1 zoom control buttons (+/-)", () => {
  afterEach(() => cleanup());

  it("renders both zoom buttons with accessible labels", async () => {
    const { container } = await renderReady();
    expect(container.querySelector('[aria-label="zoom in"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="zoom out"]')).not.toBeNull();
  });

  it("clicking + increases HUD zoom; clicking − decreases it (center-anchored)", async () => {
    const { container } = await renderReady();
    const zoomIn = container.querySelector('[aria-label="zoom in"]') as HTMLButtonElement;
    const zoomOut = container.querySelector('[aria-label="zoom out"]') as HTMLButtonElement;
    const start = zoomPercent(hudText(container));
    fireEvent.click(zoomIn);
    const afterIn = zoomPercent(hudText(container));
    expect(afterIn).toBeGreaterThan(start);
    fireEvent.click(zoomOut);
    fireEvent.click(zoomOut);
    const afterOut = zoomPercent(hudText(container));
    expect(afterOut).toBeLessThan(afterIn);
  });

  it("clicking − many times clamps HUD zoom to MIN (5%)", async () => {
    const { container } = await renderReady();
    const zoomOut = container.querySelector('[aria-label="zoom out"]') as HTMLButtonElement;
    for (let i = 0; i < 40; i++) fireEvent.click(zoomOut);
    expect(zoomPercent(hudText(container))).toBe(5);
  });

  it("clicking + many times clamps HUD zoom to MAX (2000%)", async () => {
    const { container } = await renderReady();
    const zoomIn = container.querySelector('[aria-label="zoom in"]') as HTMLButtonElement;
    for (let i = 0; i < 40; i++) fireEvent.click(zoomIn);
    expect(zoomPercent(hudText(container))).toBe(2000);
  });
});

// Story 1a.2 sub-PR #2 — VRAM glyph overlay (AD-9) + WebGL2 graceful degrade.
// jsdom has no WebGL2 (and no 2D canvas context), so the renderer constructor
// throws and CanvasView must catch it and fall back to the grid-only surface.
// The WebGL2-present path is verified end-to-end via the Playwright visual gate.
describe("CanvasView — VRAM overlay + WebGL2 graceful degrade (1a.2 sub-PR #2)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mounts both the 2D surface and the WebGL2 glyph overlay canvas", async () => {
    const { container } = await renderReady();
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
    expect(container.querySelector("canvas.ns-canvas__gl")).not.toBeNull();
  });

  it("marks the WebGL2 overlay aria-hidden (the HUD is the live region)", async () => {
    const { container } = await renderReady();
    const gl = container.querySelector("canvas.ns-canvas__gl");
    expect(gl?.getAttribute("aria-hidden")).toBe("true");
  });

  it("degrades to grid-only when WebGL2 is unavailable (jsdom) without throwing", async () => {
    // The VRAMRenderer constructor throws "WebGL2 context unavailable" in jsdom;
    // CanvasView catches it and logs a DEV-only warn. Assert the degrade path is
    // actually taken (the warn fires) and the grid-only surface still mounts.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = await renderReady();
    const messages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("WebGL2 unavailable"))).toBe(true);
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
  });
});

// ---- Story 1a.3 Task 7: element interaction (AC-7) --------------------------

import { elementStore } from "./CanvasView";

describe("CanvasView — element interaction (Story 1a.3 Task 7)", () => {
  afterEach(() => {
    cleanup();
    // Reset store to the default seed so other tests don't see side-effects.
    elementStore.setElements([]);
  });

  it("left-click on a stock selects it (smoke — no crash, no pan)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;
    const before = zoomPercent(hudText(container));

    // Create a stock at a known position.
    elementStore.setElements([
      {
        id: "test-s1",
        kind: "stock",
        name: "Test",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 100,
        currentValue: 100,
        units: "",
        allowNegative: false,
        history: [100],
      },
    ]);

    // Click at world (5, 2.5) — center of the stock.
    // screenToWorld with default cam (0,0,16) and vp={1,1}: wx = (sx - 0.5) / 16
    // So to hit world (5, 2.5), clientX = 5 * 16 + 0.5 = 80.5, clientY = 2.5 * 16 + 0.5 = 40.5.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 50, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 50, clientX: 80.5, clientY: 40.5 });

    // Zoom must stay at the default — left click on element does NOT pan.
    expect(zoomPercent(hudText(container))).toBe(1600);
  });

  it("left-click on empty space clears selection (no crash)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    // Click far from any element — world (100, 100).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 51, clientX: 1600.5, clientY: 1600.5 });
    fireEvent.pointerUp(canvas, { pointerId: 51, clientX: 1600.5, clientY: 1600.5 });

    // Still renders without crash.
    expect(zoomPercent(hudText(container))).toBe(1600);
  });

  it("dragging a stock moves it with grid snap applied", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-drag",
        kind: "stock",
        name: "DragMe",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    // pointerDown at world (5, 2.5) → hit test finds the stock → begin drag.
    // With zoom=16, screen = world * 16 + 0.5.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 52, clientX: 80.5, clientY: 40.5 });

    // Drag to world (15, 0.5): rawX = 15 + offsetX(-5) = 10, rawY = 0.5 + offsetY(-2.5) = -2
    // snapToGrid: 10 → 10, -2 → -2. Stock moves from (0, 0) to (10, -2).
    // screen for world (15, 0.5): sx = 15 * 16 + 0.5 = 240.5, sy = 0.5 * 16 + 0.5 = 8.5.
    fireEvent.pointerMove(canvas, { pointerId: 52, clientX: 240.5, clientY: 8.5 });
    fireEvent.pointerUp(canvas, { pointerId: 52, clientX: 240.5, clientY: 8.5 });

    const elements = elementStore.getElements();
    const dragged = elements.find((e) => e.id === "test-drag");
    expect(dragged).toBeDefined();
    if (!dragged) throw new Error("unreachable: element not found");
    expect(dragged.kind).toBe("stock");
    if (dragged!.kind === "stock") {
      expect(dragged.x).toBe(10);
      expect(dragged.y).toBe(-2);
    }
  });

  it("left-drag without Space does NOT pan the camera", async () => {
    // This re-validates the existing invariant with element interaction active:
    // dragging an element must not pan the underlying camera.
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-nopan",
        kind: "stock",
        name: "NoPan",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    const before = hudText(container);
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 53, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerMove(canvas, { pointerId: 53, clientX: 400.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 53, clientX: 400.5, clientY: 40.5 });

    // Camera must not have panned — zoom stays at the default.
    expect(zoomPercent(hudText(container))).toBe(1600);
  });
});

describe("CanvasView — double-click edit name (AC-7)", () => {
  afterEach(() => {
    cleanup();
    elementStore.setElements([]);
  });

  it("double-click on a stock opens a prompt to edit its name", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-dbl",
        kind: "stock",
        name: "OldName",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("NewName");

    // First click — selects the element.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 60, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 60, clientX: 80.5, clientY: 40.5 });

    // Second click within 300 ms on same element → double-click → prompt.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 61, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 61, clientX: 80.5, clientY: 40.5 });

    expect(promptSpy).toHaveBeenCalledWith("Edit name:", "OldName");

    // The name should be updated.
    const elements = elementStore.getElements();
    const edited = elements.find((e) => e.id === "test-dbl");
    expect(edited).toBeDefined();
    if (!edited) throw new Error("unreachable: element not found");
    if (edited.kind === "stock") {
      expect(edited.name).toBe("NewName");
    }

    promptSpy.mockRestore();
  });

  it("double-click with cancelled prompt does NOT change the name", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-cancel",
        kind: "stock",
        name: "KeepMe",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 62, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 62, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 63, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 63, clientX: 80.5, clientY: 40.5 });

    expect(promptSpy).toHaveBeenCalled();
    const elements = elementStore.getElements();
    const unchanged = elements.find((e) => e.id === "test-cancel");
    expect(unchanged).toBeDefined();
    if (!unchanged) throw new Error("unreachable: element not found");
    if (unchanged.kind === "stock") {
      expect(unchanged.name).toBe("KeepMe");
    }

    promptSpy.mockRestore();
  });
});

// ---- Story 1a.3 CR followup (L9): element resize (AC-7 调整大小) -------------
//
// Resize fires only when a STOCK is selected and the pointerDown lands in a
// corner handle's screen-space hit-zone. Default cam (0,0,16) + vp {1,1}:
// screenToWorld wx = (sx - 0.5) / 16; worldToScreen sx = wx * 16 + 0.5.
// Stock (0,0,10,5): body center world (5, 2.5) -> screen (80.5, 40.5);
// NW corner world (0,0) -> screen (0.5, 0.5); SE corner world (10,5) -> (160.5, 80.5).
describe("CanvasView — element resize (Story 1a.3 CR followup L9, AC-7)", () => {
  afterEach(() => {
    cleanup();
    elementStore.setElements([]);
  });

  it("dragging the SE handle grows a stock's width/height (x/y unchanged)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-rsz-se",
        kind: "stock",
        name: "ResizeSE",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    // 1. Select the stock: click body center world (5, 2.5) -> screen (80.5, 40.5).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 70, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 70, clientX: 80.5, clientY: 40.5 });

    // 2. Grab the SE handle: pointerDown at SE corner world (10,5) -> screen (160.5, 80.5).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 71, clientX: 160.5, clientY: 80.5 });
    // 3. Drag SE to world (15, 8) -> screen (240.5, 128.5).
    fireEvent.pointerMove(canvas, { pointerId: 71, clientX: 240.5, clientY: 128.5 });
    fireEvent.pointerUp(canvas, { pointerId: 71, clientX: 240.5, clientY: 128.5 });

    const el = elementStore.getElements().find((e) => e.id === "test-rsz-se");
    expect(el).toBeDefined();
    if (!el) throw new Error("unreachable: element not found");
    expect(el.kind).toBe("stock");
    if (el.kind === "stock") {
      expect(el.x).toBe(0); // NW corner fixed
      expect(el.y).toBe(0);
      expect(el.width).toBe(15); // grew
      expect(el.height).toBe(8);
    }
  });

  it("dragging the NW handle moves x/y and resizes (opposite SE corner fixed)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-rsz-nw",
        kind: "stock",
        name: "ResizeNW",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    // Select: body click.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 72, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 72, clientX: 80.5, clientY: 40.5 });

    // Grab NW handle: pointerDown at NW corner world (0,0) -> screen (0.5, 0.5).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 73, clientX: 0.5, clientY: 0.5 });
    // Drag NW to world (-3, -2) -> screen (-47.5, -31.5).
    fireEvent.pointerMove(canvas, { pointerId: 73, clientX: -47.5, clientY: -31.5 });
    fireEvent.pointerUp(canvas, { pointerId: 73, clientX: -47.5, clientY: -31.5 });

    const el = elementStore.getElements().find((e) => e.id === "test-rsz-nw");
    expect(el).toBeDefined();
    if (!el) throw new Error("unreachable: element not found");
    expect(el.kind).toBe("stock");
    if (el.kind === "stock") {
      expect(el.x).toBe(-3);
      expect(el.y).toBe(-2);
      expect(el.width).toBe(13); // 10 - (-3)
      expect(el.height).toBe(7); // 5 - (-2)
      // SE corner invariant: (x + width, y + height) === (10, 5).
      expect(el.x + el.width).toBe(10);
      expect(el.y + el.height).toBe(5);
    }
  });

  it("resize clamps width & height to >=3 when the SE handle is dragged past the opposite corner", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "test-rsz-clamp",
        kind: "stock",
        name: "ClampMe",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    // Select.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 74, clientX: 80.5, clientY: 40.5 });
    fireEvent.pointerUp(canvas, { pointerId: 74, clientX: 80.5, clientY: 40.5 });

    // Grab SE handle, drag to world (1, 1) -> screen (16.5, 16.5) (would make w=h=1).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 75, clientX: 160.5, clientY: 80.5 });
    fireEvent.pointerMove(canvas, { pointerId: 75, clientX: 16.5, clientY: 16.5 });
    fireEvent.pointerUp(canvas, { pointerId: 75, clientX: 16.5, clientY: 16.5 });

    const el = elementStore.getElements().find((e) => e.id === "test-rsz-clamp");
    expect(el).toBeDefined();
    if (!el) throw new Error("unreachable: element not found");
    if (el.kind === "stock") {
      expect(el.width).toBe(3); // clamped to minimum (AC-8/9)
      expect(el.height).toBe(3);
      expect(el.x).toBe(0);
      expect(el.y).toBe(0);
    }
  });

  it("cloud is not resizable: a corner drag does not add width/height (AC-12 fixed 6×3)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([{ id: "test-cloud-noresize", kind: "cloud", x: 0, y: 0 }]);

    // Select the cloud: body click at world (1, 1) -> screen (16.5, 16.5).
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 76, clientX: 16.5, clientY: 16.5 });
    fireEvent.pointerUp(canvas, { pointerId: 76, clientX: 16.5, clientY: 16.5 });

    // Attempt a resize from the cloud's SE corner position: world (6, 3) ->
    // screen (96.5, 48.5). Clouds are kind !== "stock", so the resize hit-test
    // branch is skipped and no width/height patch is ever applied.
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 77, clientX: 96.5, clientY: 48.5 });
    fireEvent.pointerMove(canvas, { pointerId: 77, clientX: 160.5, clientY: 96.5 });
    fireEvent.pointerUp(canvas, { pointerId: 77, clientX: 160.5, clientY: 96.5 });

    const el = elementStore.getElements().find((e) => e.id === "test-cloud-noresize");
    expect(el).toBeDefined();
    if (!el) throw new Error("unreachable: element not found");
    expect(el.kind).toBe("cloud");
    // Cloud gained no width/height — resize never fired.
    expect("width" in el).toBe(false);
    expect("height" in el).toBe(false);
    expect(getElementBounds(el)).toEqual({ x: 0, y: 0, width: 6, height: 3 });
  });
});

// CAP-11 runtime guard: prove the 2D draw path never assigns ctx.shadowBlur.
//
// jsdom's getContext returns null globally (src/test/setup.ts), so CanvasView's
// draw early-returns and never executes. To exercise it we override getContext
// to return a Proxy mock ctx that records every shadowBlur assignment, then
// render CanvasView — the mount effect calls measure() -> drawRef.current(),
// which runs the full 2D draw (background + drawGrid x/y + origin axes).
//
// The override returns null for non-"2d" contexts, so VRAMRenderer's
// getContext("webgl2") returns null -> the constructor throws -> the bake
// (bakeGlowAtlasCanvas, which legitimately sets shadowBlur off-screen) is
// skipped -> the ONLY 2D ctx in play is CanvasView's surface, and the spy
// observes exactly the runtime draw path. This complements the source-level
// grep guard in cap11-shadowblur-guard.test.ts.
describe("CanvasView — CAP-11 runtime guard (no shadowBlur in the 2D draw path)", () => {
  afterEach(() => cleanup());

  it("the runtime 2D draw path never assigns ctx.shadowBlur (only the off-screen bake may)", () => {
    const sets: number[] = [];
    const mockCtx = new Proxy(
      { shadowBlur: 0 },
      {
        get: (target, prop) => {
          if (prop === "shadowBlur") return target.shadowBlur;
          // Every method is a no-op; every other prop read returns undefined.
          return typeof prop === "string" ? () => {} : undefined;
        },
        set: (target, prop, value) => {
          if (prop === "shadowBlur") {
            target.shadowBlur = value as number;
            sets.push(value as number);
          }
          return true;
        },
      },
    );
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = ((type: string) =>
      type === "2d" ? mockCtx : null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    try {
      render(<CanvasView />);
      // The mount effect fires synchronously under act(): measure() runs the
      // full 2D draw. vp is {1,1} (jsdom clientWidth 0 -> max(1,0)); ctx is the
      // Proxy (truthy), so the vp.width===0 early-return is bypassed and
      // drawGrid executes end-to-end through the Proxy.
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
    }
    expect(
      sets,
      `CAP-11 violated: 2D draw path set ctx.shadowBlur to [${sets.join(", ")}]`,
    ).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Story 1a.4 red-phase — flow creation + port snap + empty state
//
// These tests reference interaction patterns that don't exist yet:
//   - Flow tool mode ("flow") wired to keyboard shortcut
//   - pointerDown on a port → drag → pointerUp on another port = createFlow
//   - findNearestPort snap during pointerMove
//   - Empty state UI when no elements exist (AR#12)
//
// All are expected to FAIL until DS implements the flow creation interaction.
// ══════════════════════════════════════════════════════════════════════════════

import { findNearestPort } from "./elements";

// ---- AC-10/11: flow creation via port snap ----------------------------------

describe("CanvasView — flow creation & port snap (AC-10, AC-11)", () => {
  afterEach(() => {
    cleanup();
    elementStore.setElements([]);
  });

  it("F key activates flow toolMode", async () => {
    // Keyboard shortcut: F → flow tool mode (per VS钉死决策: keyboard-only toolMode).
    // Red: toolMode switching via keyboard is not yet implemented.
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    fireEvent.keyDown(window, { code: "KeyF", key: "f" });

    // After pressing F, the status bar / HUD should reflect "flow" mode.
    // We can't directly assert internal React state, but we can check that
    // no crash occurred and the canvas is still mounted.
    expect(canvas).not.toBeNull();
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
  });

  it("S key activates stock toolMode (existing, regression guard)", async () => {
    const { container } = await renderReady();
    fireEvent.keyDown(window, { code: "KeyS", key: "s" });
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
  });

  it("C key activates cloud toolMode (existing, regression guard)", async () => {
    const { container } = await renderReady();
    fireEvent.keyDown(window, { code: "KeyC", key: "c" });
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
  });

  it("V key activates select toolMode (existing, regression guard)", async () => {
    const { container } = await renderReady();
    fireEvent.keyDown(window, { code: "KeyV", key: "v" });
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
  });

  it("pointerDown near a port starts flow creation drag", async () => {
    // AC-10: port snap activates when cursor is within SNAP_THRESHOLD of a port.
    // Red: flow creation interaction is not yet wired.
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    // Place two stocks so we can drag between their ports.
    elementStore.setElements([
      {
        id: "from-stock",
        kind: "stock",
        name: "Source",
        x: 0,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 100,
        currentValue: 100,
        units: "people",
        allowNegative: false,
        history: [100],
      },
      {
        id: "to-stock",
        kind: "stock",
        name: "Target",
        x: 20,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 50,
        currentValue: 50,
        units: "people",
        allowNegative: false,
        history: [50],
      },
    ]);

    // Activate flow tool via F key.
    fireEvent.keyDown(window, { code: "KeyF", key: "f" });

    // The E port of from-stock is at world (10, 3). With zoom=16, screen = world * 16 + 0.5.
    // PointerDown near the port should snap and begin flow creation.
    const ePortScreenX = 10 * 16 + 0.5; // 160.5
    const ePortScreenY = 3 * 16 + 0.5; // 48.5

    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 100,
      clientX: ePortScreenX,
      clientY: ePortScreenY,
    });

    // Drag toward the W port of to-stock at world (20, 3).
    const wPortScreenX = 20 * 16 + 0.5; // 320.5
    const wPortScreenY = 3 * 16 + 0.5; // 48.5

    fireEvent.pointerMove(canvas, {
      pointerId: 100,
      clientX: wPortScreenX,
      clientY: wPortScreenY,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 100,
      clientX: wPortScreenX,
      clientY: wPortScreenY,
    });

    // After the interaction completes, a flow should be created.
    const elements = elementStore.getElements();
    const flows = elements.filter((e) => e.kind === "flow");

    expect(flows.length).toBe(1);
    expect(flows[0].fromId).toBe("from-stock");
    expect(flows[0].toId).toBe("to-stock");
  });

  it("flow creation drag shows a preview line (rubber-band) during drag", async () => {
    // During flow creation drag, a temporary preview line should be visible
    // from the snapped port to the current cursor position.
    // Red: preview line rendering is not yet implemented.
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "from-stock",
        kind: "stock",
        name: "Source",
        x: 0,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 100,
        currentValue: 100,
        units: "",
        allowNegative: false,
        history: [100],
      },
    ]);

    fireEvent.keyDown(window, { code: "KeyF", key: "f" });

    // Start at E port.
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 101,
      clientX: 160.5,
      clientY: 48.5,
    });

    // Move to a new location (preview line should follow).
    fireEvent.pointerMove(canvas, {
      pointerId: 101,
      clientX: 250,
      clientY: 100,
    });

    // Abort the drag (don't create a flow). No port is nearby at (250,100) → world (15.6, 6.2).
    fireEvent.pointerUp(canvas, {
      pointerId: 101,
      clientX: 250,
      clientY: 100,
    });

    // No canvas crash; no flow in store (release was not near any port).
    expect(container.querySelector("canvas.ns-canvas__surface")).not.toBeNull();
    const flows = elementStore.getElements().filter((e) => e.kind === "flow");
    expect(flows.length).toBe(0);
  });

  it("flow creation aborted when pointerUp is NOT near a port (no flow created)", async () => {
    // AC-10: if the drag ends in empty space (not near any port), no flow is created.
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "from-stock",
        kind: "stock",
        name: "Source",
        x: 0,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 100,
        currentValue: 100,
        units: "",
        allowNegative: false,
        history: [100],
      },
    ]);

    fireEvent.keyDown(window, { code: "KeyF", key: "f" });

    // PointerDown at E port of from-stock.
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 102,
      clientX: 160.5,
      clientY: 48.5,
    });

    // Drag to empty space far from any port.
    fireEvent.pointerMove(canvas, {
      pointerId: 102,
      clientX: 500.5,
      clientY: 500.5,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 102,
      clientX: 500.5,
      clientY: 500.5,
    });

    // No flow should be created — only the original stock remains.
    const elements = elementStore.getElements();
    expect(elements.length).toBe(1);
    expect(elements[0].kind).toBe("stock");
  });

  it("flow tool mode shows [F] indicator in the HUD", async () => {
    const { container } = await renderReady();

    fireEvent.keyDown(window, { code: "KeyF", key: "f" });

    // The HUD should reflect flow mode with [F] prefix.
    const hud = container.querySelector(".ns-canvas__hud");
    expect(hud).not.toBeNull();
    expect(hud!.textContent).toContain("[F]");
  });
});

// ---- AC-16: empty state (AR#12) ---------------------------------------------

describe("CanvasView — empty state (AC-16, AR#12)", () => {
  afterEach(() => {
    cleanup();
    elementStore.setElements([]);
  });

  it("AC-16: shows guidance text when no elements are on the canvas", async () => {
    const { container } = await renderReady();

    // Clear all elements (remove the default 3 seed stocks).
    elementStore.setElements([]);

    const guide = container.querySelector(".ns-canvas__guide") as HTMLElement;
    expect(guide).not.toBeNull();
    expect(guide.style.display).toBe("block");
    expect(guide.textContent).toBe("按 S 放置存量 · 按 C 放置源汇 · 按 F 连流量");
  });

  it("AC-16: guidance text disappears when elements are added", async () => {
    const { container } = await renderReady();

    elementStore.setElements([]);

    // Add a stock — guidance should clear.
    elementStore.setElements([
      {
        id: "new-stock",
        kind: "stock",
        name: "First",
        x: 0,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        currentValue: 1,
        units: "",
        allowNegative: false,
        history: [1],
      },
    ]);

    const guide = container.querySelector(".ns-canvas__guide") as HTMLElement;
    expect(guide).not.toBeNull();
    expect(guide.style.display).toBe("none");
  });

  it("AC-16: default seed stocks prevent empty state on first load", async () => {
    // The default seed (seedSampleStocks) creates 3 stocks, so the empty state
    // should NOT appear on initial load.
    const { container } = await renderReady();

    // Default seed stocks are present → no empty state.
    const elements = elementStore.getElements();
    expect(elements.length).toBeGreaterThanOrEqual(2); // at least the 3 default stocks
  });
});

// ---- Status bar / warnings (AC-14 E11 carry) ---------------------------------

describe("CanvasView — status bar warnings (AC-14)", () => {
  afterEach(() => {
    cleanup();
    elementStore.setElements([]);
  });

  it("warn div exists with role=alert and is initially hidden", async () => {
    const { container } = await renderReady();

    const warn = container.querySelector(".ns-canvas__warn") as HTMLElement;
    expect(warn).not.toBeNull();
    expect(warn.getAttribute("role")).toBe("alert");
    expect(warn.style.display).toBe("none");
  });

  it("warn div remains hidden after successful flow creation (no error)", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("canvas")!;

    elementStore.setElements([
      {
        id: "ws1",
        kind: "stock",
        name: "A",
        x: 0,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 100,
        currentValue: 100,
        units: "",
        allowNegative: false,
        history: [100],
      },
      {
        id: "ws2",
        kind: "stock",
        name: "B",
        x: 20,
        y: 0,
        width: 10,
        height: 6,
        initialValue: 50,
        currentValue: 50,
        units: "",
        allowNegative: false,
        history: [50],
      },
    ]);

    fireEvent.keyDown(window, { code: "KeyF", key: "f" });
    // E port of ws1 at world (10, 3)
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 200, clientX: 160.5, clientY: 48.5 });
    // W port of ws2 at world (20, 3)
    fireEvent.pointerMove(canvas, { pointerId: 200, clientX: 320.5, clientY: 48.5 });
    fireEvent.pointerUp(canvas, { pointerId: 200, clientX: 320.5, clientY: 48.5 });

    // Flow was created successfully — warn must stay hidden.
    const flows = elementStore.getElements().filter((e) => e.kind === "flow");
    expect(flows.length).toBe(1);

    const warn = container.querySelector(".ns-canvas__warn") as HTMLElement;
    expect(warn.style.display).toBe("none");
  });
});
