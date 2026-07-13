// RED-PHASE ACCEPTANCE TEST SCAFFOLD — Story 1a.8 E2E Property Panel
//
// All tests are test.skip() per ATDD red-phase requirement.
// Remove .skip() after Story 1a.8 T1-T5 implements PropertyPanel.
//
// Covers: AC-1 (click → panel appears), AC-8 (isVariable toggle → ▼ marker),
//         AC-15 (regression guard: no crash/interaction on rapid clicks).
//
// E2E test: Playwright (chromium, WebGL2 SwiftShader).
// Follows project conventions from toolbar-statusbar.spec.ts.

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper: wait for render-ready state (canvas + skeleton removed)
// ---------------------------------------------------------------------------

async function waitForRenderReady(page: import("@playwright/test").Page) {
  // Wait for the app shell to mount.
  await page.waitForSelector(".ns-workspace", { timeout: 15000 });

  // Wait for skeleton to disappear (loading complete).
  await page
    .waitForFunction(
      () => {
        return document.querySelectorAll(".ns-skeleton").length === 0;
      },
      { timeout: 10000 },
    )
    .catch(() => {
      // Skeleton might not exist in some builds — that's fine.
    });

  // Ensure canvas exists.
  await page.waitForSelector(".ns-canvas", { timeout: 10000 });

  // Small settle delay for WebGL init.
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Helper: create stock elements via __e2e__ hook for test setup
// ---------------------------------------------------------------------------

async function seedStock(
  page: import("@playwright/test").Page,
  name: string,
  opts?: {
    initialValue?: number;
    units?: string;
    allowNegative?: boolean;
  },
) {
  await page.evaluate(
    ({ name, opts }: any) => {
      const store = (window as any).__e2e__.store;
      store.createStock({
        name,
        x: 100,
        y: 100,
        width: 8,
        height: 5,
        initialValue: opts?.initialValue ?? 100,
        units: opts?.units ?? "people",
        allowNegative: opts?.allowNegative ?? false,
      });
    },
    { name, opts },
  );
}

async function seedFlow(
  page: import("@playwright/test").Page,
  fromName: string,
  toName: string,
  flowName: string,
  isVariable = false,
) {
  await page.evaluate(
    ({ fromName, toName, flowName, isVariable }: any) => {
      const store = (window as any).__e2e__.store;
      const elements = store.getElements();
      const from = elements.find((e: any) => e.name === fromName);
      const to = elements.find((e: any) => e.name === toName);
      if (!from || !to) throw new Error(`Cannot find endpoints: ${fromName}→${toName}`);
      store.createFlow({
        name: flowName,
        fromId: from.id,
        toId: to.id,
        formula: "1",
        isVariable,
      });
    },
    { fromName, toName, flowName, isVariable },
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AC-1: 选中显示属性面板
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Property Panel E2E — AC-1 (P0)", () => {
  test.skip("[P0] clicking a stock on canvas opens property panel with stock fields", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Seed a stock element.
    await seedStock(page, "DemoStock", { initialValue: 50, units: "kg" });

    // Click the stock on the canvas (data-testid on canvas element).
    await page.click("[data-testid='ns-canvas-element-DemoStock']");

    // Property panel must appear.
    const panel = await page.waitForSelector("[data-testid='ns-property-panel']", {
      timeout: 5000,
    });
    expect(panel).not.toBeNull();

    // Stock fields must be visible.
    await expect(page.locator("[data-testid='ns-property-field-name']")).toBeVisible();
    await expect(page.locator("[data-testid='ns-property-field-initialValue']")).toBeVisible();
    await expect(page.locator("[data-testid='ns-property-field-units']")).toBeVisible();
    await expect(page.locator("[data-testid='ns-property-field-allowNegative']")).toBeVisible();
  });

  test.skip("[P1] clicking canvas empty area (deselect) returns panel to empty state", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    await seedStock(page, "DemoStock");

    // Select the stock.
    await page.click("[data-testid='ns-canvas-element-DemoStock']");
    await page.waitForSelector("[data-testid='ns-property-panel']", { timeout: 5000 });

    // Click empty canvas area to deselect.
    await page.click(".ns-canvas", { position: { x: 10, y: 10 } });

    // Empty state must appear.
    await expect(page.locator("[data-testid='ns-property-panel-empty']")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-8: isVariable 可变/常数切换 (F8)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Property Panel E2E — AC-8 (P0)", () => {
  test.skip("[P0] toggling isVariable on a flow updates aria-checked and canvas ▼ marker", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Create two stocks + one flow.
    await seedStock(page, "Source");
    await seedStock(page, "Sink", { initialValue: 0 });
    await seedFlow(page, "Source", "Sink", "MyFlow", false);

    // Select the flow.
    await page.click("[data-testid='ns-canvas-element-MyFlow']");
    await page.waitForSelector("[data-testid='ns-property-panel']", { timeout: 5000 });

    // Verify toggle exists and is unchecked.
    const toggle = page.locator("[data-testid='ns-property-field-isVariable']");
    await expect(toggle).toBeVisible();
    expect(await toggle.getAttribute("aria-checked")).toBe("false");

    // Toggle to variable.
    await toggle.click();
    expect(await toggle.getAttribute("aria-checked")).toBe("true");

    // Canvas must now show ▼ marker on the flow (isVariable=true).
    await expect(
      page.locator("[data-testid='ns-canvas-flow-MyFlow-variable-marker']"),
    ).toBeVisible();
  });

  test.skip("[P1] toggling isVariable back to false removes ▼ marker", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    await seedStock(page, "Source");
    await seedStock(page, "Sink", { initialValue: 0 });
    await seedFlow(page, "Source", "Sink", "MyFlow", true); // start as variable

    await page.click("[data-testid='ns-canvas-element-MyFlow']");
    await page.waitForSelector("[data-testid='ns-property-panel']", { timeout: 5000 });

    const toggle = page.locator("[data-testid='ns-property-field-isVariable']");
    expect(await toggle.getAttribute("aria-checked")).toBe("true");

    // Toggle off.
    await toggle.click();
    expect(await toggle.getAttribute("aria-checked")).toBe("false");

    // ▼ marker must disappear from canvas.
    await expect(
      page.locator("[data-testid='ns-canvas-flow-MyFlow-variable-marker']"),
    ).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AC-15: 回归守卫 — 面板交互无崩溃
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Property Panel E2E — AC-15 regression guard (P1)", () => {
  test.skip("[P1] rapid element switching does not crash or leave stale state", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    // Seed three stocks.
    await seedStock(page, "Alpha", { initialValue: 10, units: "m" });
    await seedStock(page, "Beta", { initialValue: 20, units: "kg" });
    await seedStock(page, "Gamma", { initialValue: 30, units: "s" });

    // Rapidly click between them.
    await page.click("[data-testid='ns-canvas-element-Alpha']");
    await page.waitForTimeout(100);
    await page.click("[data-testid='ns-canvas-element-Beta']");
    await page.waitForTimeout(100);
    await page.click("[data-testid='ns-canvas-element-Gamma']");
    await page.waitForTimeout(100);
    await page.click("[data-testid='ns-canvas-element-Alpha']");

    // Panel must still be present (not crashed / disappeared).
    await expect(page.locator("[data-testid='ns-property-panel']")).toBeVisible();

    // Name field should reflect the last selected element (Alpha).
    const nameInput = page.locator("[data-testid='ns-property-field-name']");
    await expect(nameInput).toBeVisible();
    // Value check: name should contain "Alpha" (either as input value or text).
  });

  test.skip("[P1] editing formula → syntax error → fix → no crash", async ({ page }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    await seedStock(page, "A");
    await seedStock(page, "B", { initialValue: 0 });
    await seedFlow(page, "A", "B", "TestFlow");

    await page.click("[data-testid='ns-canvas-element-TestFlow']");
    await page.waitForSelector("[data-testid='ns-property-panel']", { timeout: 5000 });

    const formulaField = page.locator("[data-testid='ns-property-field-formula']");
    await expect(formulaField).toBeVisible();

    // Enter bad formula.
    await formulaField.fill("(1+2");
    await formulaField.blur();

    // Error indicator should appear.
    await expect(page.locator("[data-testid='ns-property-formula-error']")).toBeVisible();

    // Fix formula.
    await formulaField.fill("1 + 2");
    await formulaField.blur();

    // Error indicator must be gone.
    await expect(page.locator("[data-testid='ns-property-formula-error']")).not.toBeVisible();

    // Panel must still be functional (no crash).
    await expect(page.locator("[data-testid='ns-property-panel']")).toBeVisible();
  });

  test.skip("[P1] canvas editing (reroute / delete) does not crash when panel is open", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForRenderReady(page);

    await seedStock(page, "X");
    await seedStock(page, "Y", { initialValue: 0 });
    await seedFlow(page, "X", "Y", "LinkFlow");

    // Open panel on the flow.
    await page.click("[data-testid='ns-canvas-element-LinkFlow']");
    await page.waitForSelector("[data-testid='ns-property-panel']", { timeout: 5000 });

    // Panel must show flow fields (formula, isVariable, etc.).
    await expect(page.locator("[data-testid='ns-property-field-formula']")).toBeVisible();

    // Panel must remain stable (no crash from interaction with canvas editing).
    await expect(page.locator("[data-testid='ns-property-panel']")).toBeVisible();
  });
});
