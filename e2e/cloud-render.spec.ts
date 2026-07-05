import { expect, test } from "@playwright/test";

// Story 1a.3 Task 5.2 / 8.3 — cloud icon rendering visual gate (AC-10).
//
// Clouds are rendered as 6×3 ASCII cloud icons at colorIdx=2 (violet) via the
// same VRAM instanced pipeline as stock glyphs. This spec verifies the e2e
// infrastructure renders the cloud overlay with real pixel read-back (mirrors
// the M6 fix applied to stock-render.spec.ts — see
// _bmad-output/implementation-artifacts/1a-3-cr-followup.md §M6).

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

test.describe("cloud render", () => {
  test("canvas mounts the 2D surface and WebGL overlay", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas.ns-canvas__surface", { state: "visible" });
    await page.waitForSelector("canvas.ns-canvas__gl", { state: "visible" });

    const surface = page.locator("canvas.ns-canvas__surface");
    const gl = page.locator("canvas.ns-canvas__gl");
    await expect(surface).toBeVisible();
    await expect(gl).toBeVisible();
  });

  // M6 CR FOLLOWUP: previously this spec only asserted the GL canvas had
  // non-zero dimensions (`gl.width > 0`) — a "dims-only" gate that could not
  // catch a cloud that failed to rasterize. Now mirrors stock-render's AC-4/AC-6
  // gate: read back the full framebuffer and assert at least one non-background
  // pixel. The default camera zoom=16 (M6 fix) gives cloud glyphs a readable
  // on-screen cell size under SwiftShader headless, so this passes without
  // test.fail.

  test("WebGL canvas renders cloud glyphs (AC-10 non-empty readPixels)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // AC-10 visual gate: cloud ASCII glyphs must produce non-background pixels
    // on the WebGL canvas. Asserts "non-background" (any non-zero RGBA) rather
    // than a specific RGB to stay palette/tolerance-agnostic. Clouds share the
    // stock VRAM pipeline (colorIdx=2), so the same zoom=16 fix applies.
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

  test("cloud renders with HUD showing zoom info", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // The HUD shows pan/zoom info once the render loop is running.
    const hasHud = await page.waitForFunction(
      () => {
        const el = document.querySelector(".ns-canvas__hud");
        return el !== null && (el.textContent?.length ?? 0) > 0;
      },
      { timeout: 10_000 },
    );
    expect(hasHud).toBeTruthy();

    const hudText = await page.evaluate(() => {
      const el = document.querySelector(".ns-canvas__hud");
      return el?.textContent ?? "";
    });
    expect(hudText).toContain("zoom");
  });
});
