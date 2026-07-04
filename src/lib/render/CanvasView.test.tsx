import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasView } from "./CanvasView";

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
    // HUD baseline is present and on the 100% zoom default.
    expect(zoomPercent(hudText(container))).toBe(100);
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
    // camera must not have translated — assert zoom stayed 100%.
    expect(zoomPercent(hudText(container))).toBe(100);
    expect(before).toContain("zoom 100%");
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
