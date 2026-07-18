// ══════════════════════════════════════════════════════════════════════════════
// Story 1a-13 RED PHASE SCAFFOLD — e2e restore-after-reload (AC-17)
// ══════════════════════════════════════════════════════════════════════════════
//
// Marked `test(...)` (TDD RED). DS activates in T20 (green). Product code
// (src/lib/sd/autosave.ts, src/lib/render/CanvasView.tsx) MUST NOT be touched in
// ATDD scaffold phase.
//
// Approach: NewSD CanvasView uses a WebGL2 canvas (AD-9) with NO DOM overlay, so
// e2e drives the app via the `window.__e2e__` hook (CanvasView:204-240, DEV-only)
// rather than DOM selectors. The hook exposes `elementStore` + `seedBulk(n)`.
//
// gov: AC-17 + SDR#8 + T20
//
// Hard waits note: the 1200ms wait is the AUTOSAVE_DEBOUNCE_MS (1000ms) + buffer
// for the debounced flush to land in localStorage before reload; the 300ms is
// the WebGL render-settle sanctioned by project-context.md L127. These are not
// arbitrary hard waits — they gate real async state (autosave timer + GPU frame).
// ══════════════════════════════════════════════════════════════════════════════

import { expect, test, type Page } from "@playwright/test";

async function waitForRenderReady(page: Page): Promise<void> {
  await page.locator(".ns-canvas__skeleton").waitFor({ state: "hidden" });
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
    return c !== null && c.width > 0;
  });
  await page.waitForTimeout(300); // WebGL render settle (project-context L127)
}

async function getElementCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const api = (window as unknown as { __e2e__?: { elementStore: { getElements(): unknown[] } } })
      .__e2e__;
    return api?.elementStore.getElements().length ?? -1;
  });
}

test("AC-17: seedBulk(5) -> reload -> restore 5 elements from localStorage", async ({ page }) => {
  // gov: AC-17 + SDR#8 + T20
  await page.goto("/");
  await waitForRenderReady(page);

  await page.evaluate((n) => {
    const api = (window as unknown as { __e2e__?: { seedBulk: (n: number) => void } }).__e2e__;
    api?.seedBulk(n);
  }, 5);
  await waitForRenderReady(page);

  // let the debounced autosave flush land in localStorage before reload
  await page.waitForTimeout(1200);

  await page.reload();
  await waitForRenderReady(page);

  expect(await getElementCount(page)).toBe(5);
});

test("AC-17 (negative): clear canvas -> autosave empty -> reload -> still empty (AC-9 e2e)", async ({
  page,
}) => {
  // gov: AC-17 + AC-9 + SDR#8 + T20
  await page.goto("/");
  await waitForRenderReady(page);

  // Clear all elements (simulates handleNew / empty board) and wait for
  // autosave to persist the empty envelope.
  await page.evaluate(() => {
    const api = (
      window as unknown as { __e2e__?: { elementStore: { setElements(e: unknown[]): void } } }
    ).__e2e__;
    api?.elementStore.setElements([]);
  });
  await page.waitForTimeout(1200);

  await page.reload();
  await waitForRenderReady(page);

  expect(await getElementCount(page)).toBe(0);
});
