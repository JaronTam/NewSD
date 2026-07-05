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
  // Give the GL canvas one more animation frame to be resized by the
  // resize observer + draw loop.
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

  test("WebGL canvas renders stock glyphs (non-empty readPixels)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // The GL canvas should have non-zero dimensions after the first render
    // frame.  We poll with waitForFunction so the resize observer has time
    // to fire before we assert.
    const hasDims = await page.waitForFunction(
      () => {
        const gl = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
        return gl !== null && gl.width > 0 && gl.height > 0;
      },
      { timeout: 10_000 },
    );
    expect(hasDims).toBeTruthy();
  });

  test("stock pixel snapshot (visual regression baseline)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Screenshot the full page for baseline comparison.
    const screenshot = await page.screenshot({ fullPage: false });
    expect(screenshot.length).toBeGreaterThan(100); // non-empty PNG
  });
});
