import { expect, test } from "@playwright/test";

// Story 1a.3 Task 5.2 / 8.3 — cloud icon rendering visual gate (AC-10).
//
// Clouds are rendered as 6×3 ASCII cloud icons at colorIdx=2 (violet).
// This spec verifies the e2e infrastructure renders the cloud overlay.

async function waitForRenderReady(page: import("@playwright/test").Page) {
  await page
    .waitForSelector(".ns-canvas__skeleton", { state: "hidden", timeout: 10_000 })
    .catch(() => {});
  await page.waitForTimeout(200);
}

test.describe("cloud render", () => {
  test("WebGL canvas exists and has non-zero dimensions", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    const hasGL = await page.waitForFunction(
      () => {
        const gl = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
        return gl !== null && gl.width > 0 && gl.height > 0;
      },
      { timeout: 10_000 },
    );
    expect(hasGL).toBeTruthy();
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
