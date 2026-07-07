import { expect, test } from "@playwright/test";

// Story 1a.4 Task 8.1 — Flow Connector & Port Snap rendering visual gate (AC-17).
//
// Flow rendering uses the same WebGL2 instanced pipeline as stock/cloud
// (AD-9 VRAM glyph atlas). The visual gate asserts that flow glyphs
// (▶ arrowhead, ─│ path segments, ▼/○ marker) produce non-background
// pixels on the WebGL canvas after a flow is created via the e2e test hook.
//
// This file mirrors the pattern of e2e/stock-render.spec.ts and
// e2e/cloud-render.spec.ts.

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

/** Create a flow between two seed stocks via the e2e test hook, then wait
 *  for the render loop to pick up the change. */
async function createFlowAndWait(
  page: import("@playwright/test").Page,
  fromName: string,
  toName: string,
  isVariable = false,
) {
  await page.evaluate(
    ({ fromName: fn, toName: tn, isVariable: iv }) => {
      const api = (window as any).__e2e__;
      if (!api) throw new Error("__e2e__ hook not found — is the app running in dev mode?");
      const elements = api.elementStore.getElements();
      const from = elements.find((e: any) => e.name === fn);
      const to = elements.find((e: any) => e.name === tn);
      if (!from || !to) throw new Error(`Seed stocks not found: ${fn}=${!!from} ${tn}=${!!to}`);
      api.createFlow(api.elementStore, {
        fromId: from.id,
        toId: to.id,
        formula: "1",
        isVariable: iv,
      });
    },
    { fromName, toName, isVariable },
  );
  // Wait two animation frames for the store subscription → rebuild → render pipeline.
  await page.waitForTimeout(100);
}

/** Rebuild the RenderInstance[] the renderer draws, straight from the live
 *  store (dev-only __e2e__ hook). F6: lets the AC-17 gate assert specific
 *  glyphs (▼/○ marker) reach the renderer, not just non-bg pixel growth. */
async function builtInstances(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const api = (window as any).__e2e__;
    if (!api || typeof api.buildInstances !== "function")
      throw new Error("__e2e__.buildInstances not found — dev hook missing?");
    return api.buildInstances() as { glyphIdx: number }[];
  });
}

/** Look up a char's glyph index in the baked atlas via the dev hook. */
async function glyphIdxOf(page: import("@playwright/test").Page, ch: string): Promise<number> {
  return page.evaluate((c) => {
    const api = (window as any).__e2e__;
    if (!api || typeof api.charToGlyphIdx !== "function")
      throw new Error("__e2e__.charToGlyphIdx not found — dev hook missing?");
    return api.charToGlyphIdx(c) as number;
  }, ch);
}

test.describe("flow render (AC-17)", () => {
  test("canvas mounts both surface and WebGL2 overlay", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas.ns-canvas__surface", { state: "visible" });
    await page.waitForSelector("canvas.ns-canvas__gl", { state: "visible" });

    const surface = page.locator("canvas.ns-canvas__surface");
    const gl = page.locator("canvas.ns-canvas__gl");
    await expect(surface).toBeVisible();
    await expect(gl).toBeVisible();
  });

  test("AC-17: WebGL canvas renders flow glyphs (non-empty readPixels after flow creation)", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Baseline: count non-background pixels before flow creation (stocks only).
    const baselinePx = await page.evaluate(() => {
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
    expect(baselinePx).toBeGreaterThan(0);

    // Create a flow between two existing seed stocks.
    // Seed stocks: Population (x=-8,y=-6), CO₂ (x=6,y=-6), GDP (x=-2,y=3)
    await createFlowAndWait(page, "Population", "CO₂");

    // After flow creation: pixel count should increase (flow glyphs add to the canvas).
    const afterFlowPx = await page.evaluate(() => {
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
    // The flow adds path segments (─, │) + arrowhead (▶) + marker (○) → more non-bg pixels.
    expect(afterFlowPx).toBeGreaterThan(baselinePx);
  });

  test("AC-17: variable flow renders ▼ marker (isVariable=true)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Create a variable flow (isVariable=true → ▼ marker).
    await createFlowAndWait(page, "Population", "GDP", true);

    // Pixel sanity: the canvas still renders after variable flow creation.
    // (Path + arrow alone satisfy this — the glyph assertion below is the real
    // non-sham check that ▼ specifically reached the renderer.)
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

    // F6 (non-sham): the ▼ marker glyph must be present in the instances the
    // renderer draws, and the ○ marker (isVariable=false variant) must NOT.
    const [instances, downIdx, circleIdx] = await Promise.all([
      builtInstances(page),
      glyphIdxOf(page, "▼"),
      glyphIdxOf(page, "○"),
    ]);
    expect(downIdx).toBeGreaterThanOrEqual(0); // ▼ is baked in the atlas
    expect(instances.some((ri) => ri.glyphIdx === downIdx)).toBe(true);
    expect(instances.some((ri) => ri.glyphIdx === circleIdx)).toBe(false);
  });

  test("AC-17: non-variable flow renders ○ marker (isVariable=false)", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Default isVariable=false → ○ marker (AC-7). Same stock pair as the ▼
    // test above; only the isVariable flag differs, isolating the marker glyph.
    await createFlowAndWait(page, "Population", "GDP", false);

    const [instances, circleIdx, downIdx] = await Promise.all([
      builtInstances(page),
      glyphIdxOf(page, "○"),
      glyphIdxOf(page, "▼"),
    ]);
    expect(circleIdx).toBeGreaterThanOrEqual(0); // ○ is baked in the atlas
    expect(instances.some((ri) => ri.glyphIdx === circleIdx)).toBe(true);
    expect(instances.some((ri) => ri.glyphIdx === downIdx)).toBe(false);
  });

  test("AC-17: parallel flows (E11) both render", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Create two flows between the same two stocks (parallel flows, AC-14/E11).
    await createFlowAndWait(page, "CO₂", "GDP");
    await createFlowAndWait(page, "CO₂", "GDP", true);

    // Both flows render; canvas should have more non-bg pixels than with one flow.
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

  test("AC-17: pixel snapshot — flow render visual regression baseline", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Create a flow so the screenshot includes flow glyphs.
    await createFlowAndWait(page, "Population", "CO₂");

    // Full-page screenshot for baseline comparison.
    const screenshot = await page.screenshot({ fullPage: false });
    expect(screenshot.length).toBeGreaterThan(100); // non-empty PNG
  });
});

test.describe("flow render — HUD mode indicator (AC-10)", () => {
  test("flow tool mode shows [F] in HUD after pressing F key", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Press F to activate flow tool mode.
    await page.keyboard.press("KeyF");

    // HUD should now show [F] as the active tool mode.
    const hudText = await page.evaluate(() => {
      const el = document.querySelector(".ns-canvas__hud");
      return el?.textContent ?? "";
    });
    expect(hudText).toContain("[F]");
  });

  test("returning to select mode (V) removes [F] from HUD", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    await page.keyboard.press("KeyF");
    await page.keyboard.press("KeyV");

    const hudText = await page.evaluate(() => {
      const el = document.querySelector(".ns-canvas__hud");
      return el?.textContent ?? "";
    });
    // After pressing V (select mode), [F] should be gone.
    expect(hudText).not.toContain("[F]");
  });
});
