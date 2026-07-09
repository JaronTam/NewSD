import { expect, test } from "@playwright/test";

// Story 1a.7 — Toolbar & StatusBar e2e scaffolds (AC-13).
// TDD RED PHASE: all tests are test.skip() — will fail until toolbar/statusbar implemented.
//
// Covers:
//   S1.3:  Toolbar <nav> visible in DOM above canvas
//   S2.5:  Disabled buttons not clickable (no side effect)
//   S3.1:  Click 删除 → element removed, count decrements
//   S3.2:  Press Delete key → element removed
//   S3.4:  Delete with no selection = no-op
//   S4.1:  Click tool button → toolMode changes
//   S4.3:  Press F/S/C/V → toolMode changes, toolbar syncs
//   S6.2:  Zoom slider drag → zoom changes
//   S8.4:  StatusBar <footer> visible in DOM below canvas
//   S9.1:  Element count = elementStore.getElements().length (live)
//   S9.2:  FPS field populated from perfProbe (or "-" placeholder)
//   S10.1: Tab focus order: toolbar → canvas → statusbar
//   S10.2: :focus-visible ring on interactive controls
//   S10.5: F/S/C/V keyboard tool switching (regression guard)
//
// Uses __e2e__.elementStore for data setup/verification.

async function waitForRenderReady(page: import("@playwright/test").Page) {
  await page
    .waitForSelector(".ns-canvas__skeleton", { state: "hidden", timeout: 10_000 })
    .catch(() => {});
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas.ns-canvas__gl") as HTMLCanvasElement | null;
      return c !== null && c.width > 0 && c.height > 0;
    },
    { timeout: 10_000 },
  );
  await page.waitForTimeout(300);
}

async function waitForChromeReady(page: import("@playwright/test").Page) {
  await waitForRenderReady(page);
  // Wait for toolbar + statusbar DOM elements (will fail in red phase — expected).
  await page.waitForSelector("[data-testid='ns-toolbar']", { timeout: 5_000 }).catch(() => {});
  await page.waitForSelector("[data-testid='ns-statusbar']", { timeout: 5_000 }).catch(() => {});
}

test.describe("Toolbar & StatusBar (Story 1a.7, AC-1–AC-13)", () => {
  // ═══════════════════════════════════════════════════════════════════════════════
  // Toolbar Rendering (AC-1, AC-2, AC-7)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S1.3: toolbar renders as <nav> with 6 control groups", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    const toolbar = page.locator("[data-testid='ns-toolbar']");
    await expect(toolbar).toBeAttached();

    // Verify toolbar is a <nav> element.
    await expect(toolbar).toHaveAttribute("role", "navigation");

    // Verify all 6 control groups are present.
    const groups = ["文件", "编辑", "工具", "模拟控制", "时间步长", "缩放"];
    for (const label of groups) {
      await expect(toolbar.locator(`[aria-label="${label}"]`).first()).toBeAttached();
    }

    // Active buttons are enabled, disabled buttons are not.
    const activeButtons = ["新建", "删除", "选择", "存量", "源汇", "流量"];
    for (const name of activeButtons) {
      const btn = toolbar.locator(`[data-testid='ns-toolbar-btn-${name}']`);
      await expect(btn).toBeEnabled();
    }

    const disabledButtons = ["打开", "保存", "撤销", "重做", "复制", "粘贴"];
    for (const name of disabledButtons) {
      const btn = toolbar.locator(`[data-testid='ns-toolbar-btn-${name}']`);
      await expect(btn).toBeDisabled();
    }
  });

  test.skip("[P1] S2.5: disabled buttons are not clickable — no side effect", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Snapshot element count before attempting disabled-button click.
    const before = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });

    // Click a disabled button (打开 = stub).
    const disabledBtn = page.locator("[data-testid='ns-toolbar-btn-打开']");
    // Even if attached, it should be disabled.
    if (await disabledBtn.isAttached().catch(() => false)) {
      await disabledBtn.click({ force: true }).catch(() => {});
    }

    // Element count must not change (no side effect from disabled button).
    const after = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(after).toBe(before);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Delete Workflow (AC-3)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S3.1: click 删除 → selected element removed, count decrements", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Seed a single element and select it.
    const elemId = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);
      const s = api.elementStore.createStock({
        name: "to-delete",
        x: 0,
        y: 0,
        width: 5,
        height: 3,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      // Select via __e2e__ internal hook.
      if (typeof api.setSelectedElementId === "function") {
        api.setSelectedElementId(s.id);
      }
      return s.id;
    });

    // Verify element exists before delete.
    const countBefore = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(countBefore).toBe(1);

    // Click 删除 button.
    const deleteBtn = page.locator("[data-testid='ns-toolbar-btn-删除']");
    await deleteBtn.click();

    // Element must be removed.
    const countAfter = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(countAfter).toBe(0);

    // StatusBar element count must reflect deletion.
    const countDisplay = page.locator("[data-testid='ns-statusbar-element-count']");
    await expect(countDisplay).toContainText("0");
  });

  test.skip("[P0] S3.2: press Delete key → selected element removed", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);
      const s = api.elementStore.createStock({
        name: "key-delete",
        x: 10,
        y: 10,
        width: 5,
        height: 3,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      if (typeof api.setSelectedElementId === "function") {
        api.setSelectedElementId(s.id);
      }
    });

    // Press Delete key.
    await page.keyboard.press("Delete");

    const countAfter = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(countAfter).toBe(0);
  });

  test.skip("[P1] S3.4: Delete with no selection = no-op", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Seed elements, deselect everything.
    await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);
      api.elementStore.createStock({
        name: "keep-me",
        x: 0,
        y: 0,
        width: 5,
        height: 3,
        initialValue: 1,
        units: "",
        allowNegative: false,
      });
      if (typeof api.setSelectedElementId === "function") {
        api.setSelectedElementId(null);
      }
    });

    const countBefore = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(countBefore).toBe(1);

    // Press Delete with no selection — must be no-op.
    await page.keyboard.press("Delete");

    const countAfter = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.elementStore.getElements().length;
    });
    expect(countAfter).toBe(1);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Tool Switching (AC-4)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S4.1: click tool button → toolMode changes, selected state visible", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    const selectBtn = page.locator("[data-testid='ns-toolbar-btn-选择']");
    const stockBtn = page.locator("[data-testid='ns-toolbar-btn-存量']");

    // Click 存量 — it should become the selected tool.
    await stockBtn.click();

    // Verify toolMode changed via __e2e__ hook.
    const toolMode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(toolMode).toBe("stock");

    // Selected button has aria-pressed or data-selected.
    await expect(stockBtn).toHaveAttribute("aria-pressed", "true");

    // Click 选择 — stock should deselect, select should activate.
    await selectBtn.click();
    const toolMode2 = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(toolMode2).toBe("select");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "true");
  });

  test.skip("[P0] S4.3: F/S/C/V keys switch toolMode, toolbar button syncs", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Press F → select mode.
    await page.keyboard.press("f");
    let mode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(mode).toBe("select");

    // Press S → stock mode.
    await page.keyboard.press("s");
    mode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(mode).toBe("stock");

    // Press C → flow mode.
    await page.keyboard.press("c");
    mode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(mode).toBe("flow");

    // Press V → connector mode.
    await page.keyboard.press("v");
    mode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(mode).toBe("connector");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Zoom Slider (AC-6)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S6.2: zoom slider changes camera zoom and indicator updates", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Read initial zoom from __e2e__.
    const zoomBefore = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.camRef?.zoom ?? 16;
    });

    // Locate the zoom slider and set a new value.
    const slider = page.locator("[data-testid='ns-toolbar-zoom-slider']");
    // Zoom slider range is [0.05, 20]; set to zoom=8.
    await slider.fill("8");

    // Camera zoom must reflect the slider change.
    const zoomAfter = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      return api.camRef?.zoom ?? -1;
    });
    expect(zoomAfter).not.toBe(zoomBefore);
    expect(zoomAfter).toBeCloseTo(8, 0);

    // Zoom indicator label must update.
    const zoomLabel = page.locator("[data-testid='ns-toolbar-zoom-label']");
    await expect(zoomLabel).toContainText("%");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // StatusBar Rendering & Live Data (AC-8, AC-9)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S8.4: statusbar renders as <footer> with 7 fields", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    const statusbar = page.locator("[data-testid='ns-statusbar']");
    await expect(statusbar).toBeAttached();

    // Verify it's a <footer> with contentinfo role.
    await expect(statusbar).toHaveAttribute("role", "contentinfo");

    // All 7 fields must be present.
    const fields = [
      "模拟时间",
      "图元计数",
      "在线用户数",
      "头像堆栈",
      "FPS",
      "连接状态",
      "量纲概要",
    ];
    for (const label of fields) {
      await expect(
        statusbar.locator(`[aria-label="${label}"], [data-testid="ns-statusbar-${label}"]`).first(),
      ).toBeAttached();
    }
  });

  test.skip("[P0] S9.1: element count display = elementStore.getElements().length", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Seed 5 elements.
    await page.evaluate(() => {
      const api = (window as any).__e2e__;
      api.elementStore.setElements([]);
      for (let i = 0; i < 5; i++) {
        api.elementStore.createStock({
          name: `c${i}`,
          x: i * 10,
          y: 0,
          width: 3,
          height: 2,
          initialValue: i,
          units: "",
          allowNegative: false,
        });
      }
    });
    await page.waitForTimeout(300);

    // StatusBar must show "5".
    const countDisplay = page.locator("[data-testid='ns-statusbar-element-count']");
    await expect(countDisplay).toContainText("5");
  });

  test.skip("[P0] S9.2: FPS field shows value from perfProbe or '-' placeholder", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    const fpsDisplay = page.locator("[data-testid='ns-statusbar-fps']");
    await expect(fpsDisplay).toBeAttached();

    // FPS must be non-empty (either a number or "-").
    const fpsText = await fpsDisplay.textContent();
    expect(fpsText).toBeTruthy();

    // In headless CI, fpsP95 may be 0 → shows "-".
    // In a real browser with rAF, shows a number.
    const isPlaceholderOrNumber = fpsText!.trim() === "-" || !Number.isNaN(Number(fpsText!.trim()));
    expect(isPlaceholderOrNumber).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Keyboard & Focus Accessibility (AC-10)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P1] S10.1: Tab flows toolbar → canvas → statusbar in logical order", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Start Tab navigation. First Tab should reach the toolbar.
    await page.keyboard.press("Tab");

    // The first toolbar button (新建 or equivalent) should be focused.
    const firstFocused = page.locator("[data-testid='ns-toolbar'] *:focus");
    await expect(firstFocused).toBeAttached();

    // Continue tabbing through toolbar controls.
    // After N tabs we should leave the toolbar.
    let leftToolbar = false;
    for (let i = 0; i < 20 && !leftToolbar; i++) {
      await page.keyboard.press("Tab");
      const insideToolbar = await page
        .locator("[data-testid='ns-toolbar'] *:focus")
        .isAttached()
        .catch(() => false);
      if (!insideToolbar) leftToolbar = true;
    }
    // Must eventually focus something outside the toolbar.
    expect(leftToolbar).toBe(true);

    // Continue tabbing — should eventually reach statusbar.
    let reachedStatusbar = false;
    for (let i = 0; i < 20 && !reachedStatusbar; i++) {
      await page.keyboard.press("Tab");
      const insideStatusbar = await page
        .locator("[data-testid='ns-statusbar'] *:focus")
        .isAttached()
        .catch(() => false);
      if (insideStatusbar) reachedStatusbar = true;
    }
    expect(reachedStatusbar).toBe(true);
  });

  test.skip("[P1] S10.2: :focus-visible ring visible on interactive controls", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Tab to focus the first interactive toolbar button.
    await page.keyboard.press("Tab");

    // Check that the focused element has a visible focus ring.
    // focus-visible means outline is not "none" when focused via keyboard.
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      // outline-style must not be "none" when :focus-visible.
      return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
    });
    expect(hasFocusRing).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // Keyboard Regression Guard (AC-10.5, AC-4)
  // ═══════════════════════════════════════════════════════════════════════════════

  test.skip("[P0] S10.5: F/S/C/V keyboard tool switching (regression guard)", async ({ page }) => {
    await page.goto("/");
    await waitForChromeReady(page);

    // Press 's' — stock mode.
    await page.keyboard.press("s");
    const stockMode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(stockMode).toBe("stock");

    // Press 'f' — select mode.
    await page.keyboard.press("f");
    const selectMode = await page.evaluate(() => {
      const api = (window as any).__e2e__;
      if (typeof api.getToolMode === "function") return api.getToolMode();
      return (window as any).__e2e__?.toolMode;
    });
    expect(selectMode).toBe("select");

    // Toolbar button must sync with keyboard.
    const selectBtn = page.locator("[data-testid='ns-toolbar-btn-选择']");
    await expect(selectBtn).toHaveAttribute("aria-pressed", "true");
  });
});
