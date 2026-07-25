// ══════════════════════════════════════════════════════════════════════════════
// Story 1a-10 T12 GREEN - e2e timeUnit change triggers revalidation (AC-5)
// ══════════════════════════════════════════════════════════════════════════════
//
// Approach: NewSD CanvasView is WebGL2 (AD-9, no DOM overlay). The timeUnit
// control + dim-revalidation status row live in SettingsPanel (DOM, testable).
// Default board seeds stocks but 0 flows (CanvasView:842), so the status row
// would read flowCount=0 before AND after a timeUnit change (hollow assertion,
// VS F-3). Fix: seed >=1 flow via window.__e2e__.elementStore BEFORE opening
// SettingsPanel, so flowCount>=1 distinguishes "revalidation ran" from
// "nothing happened" (before=·0 / after=·1, reactive triple).
//
// DS fixes vs scaffold: gear testid 实为 ns-toolbar-btn-settings (非
// ns-toolbar-settings-gear); seed 升级为全字段 stock×2 + flow×1 (合法端点,
// 防 buildInstances/errorDetection 读缺字段).
//
// gov: AC-5 + SDR#5 + T12
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

test("AC-5: seed flow -> open SettingsPanel -> change timeUnit to month -> dim-revalidation status row flowCount 0->1 + 待 1b", async ({
  page,
}) => {
  // gov: AC-5 + SDR#5 + T12.
  await page.goto("/");
  await waitForRenderReady(page);

  // Seed >=1 flow (full fields, valid endpoints) so flowCount>=1 distinguishes
  // revalidation-ran from hollow 0 (VS F-3). setElements full-replace.
  await page.evaluate(() => {
    const api = (
      window as unknown as { __e2e__?: { elementStore: { setElements(e: unknown[]): void } } }
    ).__e2e__;
    api?.elementStore.setElements([
      {
        id: "e2e-stk-1",
        kind: "stock",
        name: "E2EStock1",
        x: -20,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 1,
        units: "",
        allowNegative: false,
        currentValue: 1,
        history: [1],
      },
      {
        id: "e2e-stk-2",
        kind: "stock",
        name: "E2EStock2",
        x: 20,
        y: 0,
        width: 10,
        height: 5,
        initialValue: 0,
        units: "",
        allowNegative: false,
        currentValue: 0,
        history: [0],
      },
      {
        id: "e2e-flow-1",
        kind: "flow",
        name: "e2e_flow_1",
        fromId: "e2e-stk-1",
        toId: "e2e-stk-2",
        formula: "1",
        isVariable: false,
        lastValue: 0,
        units: "",
      },
    ]);
  });
  await waitForRenderReady(page);

  // Open SettingsPanel via Toolbar gear (1a.9).
  await page.locator('[data-testid="ns-toolbar-btn-settings"]').click();

  const statusRow = page.locator('[data-testid="ns-settings-dim-revalidation"]');
  await expect(statusRow).toBeVisible();
  // before: mount-run recorded flowCount=0 (seed does not bump the nonce).
  await expect(statusRow).toHaveText(/待 1b · 0/);
  const statusBefore = await statusRow.textContent();

  // Change timeUnit to month -> nonce++ -> CanvasView effect -> revalidateAllDimensions.
  await page.locator('[data-testid="ns-settings-time-unit"]').selectOption("month");

  // after: flowCount=1 (seeded flow revalidated, not hollow 0) + 待 1b stub (AC-6).
  await expect(statusRow).toHaveText(/待 1b · [1-9]\d*/);
  const statusAfter = await statusRow.textContent();
  expect(statusAfter).not.toBe(statusBefore);
});
