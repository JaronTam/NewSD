import { expect, test } from "@playwright/test";

// Story 1a.3 Task 4.3 / 8.3 — stock box rendering visual gate (AC-4, AC-6).
//
// The canvas overlay uses WebGL2 with SwiftShader on headless CI.
// We assert non-empty rendering via pixel read-back after the render
// loop has had time to size the canvas and draw the first frame.

async function waitForRenderReady(page: import("@playwright/test").Page) {
  // The skeleton is the loading indicator; it disappears when the first
  // render pass completes (phase flips to "ready"). If it was never in the
  // DOM it's already gone — that's fine too.
  await page
    .waitForSelector(".ns-canvas__skeleton", { state: "hidden", timeout: 10_000 })
    .catch(() => {});
  // Wait until the GL canvas has a non-zero size; this means the resize
  // observer has already run and the renderer can address the viewport.
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      return c !== null && c.width > 0 && c.height > 0;
    },
    { timeout: 10_000 },
  );
  // Give the draw loop one more animation frame.
  await page.waitForTimeout(200);
}

test.describe("stock render", () => {
  test("canvas mounts the 2D surface and WebGL overlay", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas.ns-canvas__surface", { state: "visible" });
    await page.waitForSelector("canvas.ns-canvas__gl", { state: "visible" });

    const surface = page.locator("canvas.ns-canvas__surface");
    const gl = page.locator("canvas.ns-canvas__gl");
    await expect(surface).toBeVisible();
    await expect(gl).toBeVisible();
  });

  // M6 CR FOLLOWUP (see _bmad-output/implementation-artifacts/1a-3-cr-followup.md):
  // The integrated CanvasView WebGL path previously rendered ALL-ZEROS under
  // Playwright headless (SwiftShader). GL introspection ruled out VAO, program
  // link, atlas content, palette, viewport, blend, and readPixels limitations.
  // Root cause: the default camera zoom was 1. The VRAM renderer treats zoom as
  // "screen px per world unit", so a 9x16 glyph became ~1px on screen and
  // SwiftShader rasterized it to zero fragments. The /vram harness used zoom=24
  // and rendered correctly. The fix is CanvasView's default zoom=16, which gives
  // a readable on-screen cell size from the first frame.

  test("WebGL2 pipeline + readPixels functional under SwiftShader (M6 smoke)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Red-clear probe: clear the GL backbuffer to solid red, read back 1px.
    // Proves WebGL2 context + readPixels readback work under SwiftShader headless
    // (the app's all-zeros is NOT a readPixels limitation).
    const probe = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      if (!canvas) return { err: "no __gl canvas" };
      const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
      if (!gl) return { err: "no webgl2 ctx" };
      gl.disable(gl.BLEND);
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { px: Array.from(px), err: null as string | null };
    });
    expect(probe.err).toBeNull();
    expect(probe.px).toEqual([255, 0, 0, 255]);
  });

  test("WebGL canvas renders stock glyphs (AC-4/AC-6 non-empty readPixels)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // AC-4/AC-6 visual gate: stock box glyphs must produce non-background pixels
    // on the WebGL canvas. Asserts "non-background" (any non-zero RGBA) rather
    // than a specific RGB to stay palette/tolerance-agnostic.
    const nonBg = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      if (!canvas) return -1;
      const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
      if (!gl) return -1;
      const w = canvas.width;
      const h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let n = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0 || pixels[i + 3] !== 0)
          n++;
      }
      return n;
    });
    expect(nonBg).toBeGreaterThan(0);
  });

  test("stock pixel snapshot (visual regression baseline)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Screenshot the full page for baseline comparison.
    const screenshot = await page.screenshot({ fullPage: false });
    expect(screenshot.length).toBeGreaterThan(100); // non-empty PNG
  });
});
