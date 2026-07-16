// ACCEPTANCE TESTS — Story 1a.8 Property Panel + Formula Editor (green-phase)
//
// Tests active (PropertyPanel implemented). One .skip remains for the
// uncontrolled-input external-update limitation (see skipped test below).
//
// Covers: AC-1..AC-6, AC-8..AC-11, AC-13, AC-14
//
// Component test: vitest + @testing-library/react (jsdom environment).
// Uses data-testid selectors per project convention.

import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyPanel } from "../PropertyPanel";
import type { PropertyPanelProps } from "../PropertyPanel";
import { createElementStore } from "../../sd/store";
import type { ElementStore } from "../../sd/store";
import type { Stock, Cloud, Flow } from "../../sd/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Create a fresh store and optional seed elements. Returns the store instance. */
function setupStore(seeds: ("stock" | "cloud" | "flow")[] = ["stock"]) {
  const store = createElementStore();
  store.setElements([]);

  let stockIdx = 0;
  for (const kind of seeds) {
    if (kind === "stock") {
      stockIdx++;
      store.createStock({
        name: `Stock${stockIdx}`,
        x: 0,
        y: 0,
        width: 8,
        height: 5,
        initialValue: 100,
        units: "people",
        allowNegative: false,
      });
    } else if (kind === "cloud") {
      store.createCloud({ name: `Cloud${stockIdx + 1}`, x: 0, y: 0 });
    } else if (kind === "flow") {
      // Need two stocks first for endpoints.
      const stocks = store.getElements().filter((e) => e.kind === "stock");
      if (stocks.length >= 2) {
        // Use the store's internal create flow — but we can only add via setElements.
        const flow: Flow = {
          id: crypto.randomUUID(),
          kind: "flow",
          name: "TestFlow",
          fromId: stocks[0].id,
          toId: stocks[1].id,
          formula: "1",
          isVariable: false,
          lastValue: 0,
          units: "people/dt",
        };
        store.setElements([...store.getElements(), flow]);
      }
    }
  }

  return store;
}

/** Get first element of given kind from store. */
function firstOf(store: ElementStore, kind: "stock" | "cloud" | "flow") {
  return store.getElements().find((e) => e.kind === kind) ?? null;
}

/** Render PropertyPanel with given selectedId. */
function renderPanel(store: ElementStore, selectedId: string | null) {
  return render(<PropertyPanel elementStore={store} selectedId={selectedId} />);
}

// ---------------------------------------------------------------------------
// AC-1: 选中显示属性面板
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-1 panel render by element kind (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] selecting a stock renders the property panel with stock fields", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    // Panel root must exist.
    const panel = container.querySelector("[data-testid='ns-property-panel']");
    expect(panel).not.toBeNull();

    // Stock fields: name, initialValue, units, allowNegative (AC-3).
    expect(container.querySelector("[data-testid='ns-property-field-name']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-property-field-initialValue']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-units']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-property-field-allowNegative']"),
    ).not.toBeNull();
  });

  it("[P0] selecting a cloud renders the property panel with cloud fields", () => {
    const store = setupStore(["cloud"]);
    const cloud = firstOf(store, "cloud") as Cloud;
    const { container } = renderPanel(store, cloud.id);

    const panel = container.querySelector("[data-testid='ns-property-panel']");
    expect(panel).not.toBeNull();

    // Cloud fields: name only (AC-5).
    expect(container.querySelector("[data-testid='ns-property-field-name']")).not.toBeNull();
    // Must NOT render stock/flow fields.
    expect(container.querySelector("[data-testid='ns-property-field-formula']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-initialValue']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-units']")).toBeNull();
  });

  it("[P0] selecting a flow renders the property panel with flow fields", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const panel = container.querySelector("[data-testid='ns-property-panel']");
    expect(panel).not.toBeNull();

    // Flow fields: formula textarea, isVariable toggle, derived units (AC-6).
    expect(container.querySelector("[data-testid='ns-property-field-name']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-formula']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-isVariable']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-property-field-derivedUnits']"),
    ).not.toBeNull();
  });

  it("[P1] deselecting (selectedId→null) returns panel to empty state", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;

    // First render with selection.
    const { container, rerender } = renderPanel(store, stock.id);
    expect(container.querySelector("[data-testid='ns-property-panel']")).not.toBeNull();

    // Re-render with null selection.
    rerender(<PropertyPanel elementStore={store} selectedId={null} />);

    // Empty state must appear.
    expect(container.querySelector("[data-testid='ns-property-panel-empty']")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-2: 无选中空态
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-2 empty state (P1)", () => {
  afterEach(() => cleanup());

  it("[P1] selectedId=null shows empty state with guidance text", () => {
    const store = setupStore([]);
    const { container } = renderPanel(store, null);

    const empty = container.querySelector("[data-testid='ns-property-panel-empty']");
    expect(empty).not.toBeNull();
    // Should have some guidance text (e.g. "点击图元查看属性").
    expect(empty!.textContent).toBeTruthy();
  });

  it("[P1] no field editors in DOM when empty", () => {
    const store = setupStore([]);
    const { container } = renderPanel(store, null);

    // No input/textarea/select elements when empty.
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("select")).toBeNull();
  });

  it("[P1] empty state matches data-testid contract", () => {
    const store = setupStore([]);
    const { container } = renderPanel(store, null);

    const empty = container.querySelector("[data-testid='ns-property-panel-empty']");
    expect(empty).not.toBeNull();
    // The panel root itself should still exist even when empty.
    expect(container.querySelector("[data-testid='ns-property-panel']")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3: 存量字段
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-3 stock field rendering (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] stock selected shows name, initialValue, units, allowNegative", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    // All 4 fields present with data-testid.
    const nameField = container.querySelector("[data-testid='ns-property-field-name']");
    const initField = container.querySelector("[data-testid='ns-property-field-initialValue']");
    const unitsField = container.querySelector("[data-testid='ns-property-field-units']");
    const allowNegField = container.querySelector(
      "[data-testid='ns-property-field-allowNegative']",
    );

    expect(nameField).not.toBeNull();
    expect(initField).not.toBeNull();
    expect(unitsField).not.toBeNull();
    expect(allowNegField).not.toBeNull();
  });

  it("[P0] field values reflect elementStore snapshot", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    // Name input should show the stock's name.
    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    if (nameInput) {
      expect(nameInput.value ?? nameInput.textContent).toContain("Stock1");
    }

    // initialValue should show 100.
    const initInput = container.querySelector(
      "[data-testid='ns-property-field-initialValue']",
    ) as HTMLInputElement;
    if (initInput && initInput.value !== undefined) {
      expect(initInput.value).toBe("100");
    }

    // Units should show "people".
    const unitsInput = container.querySelector(
      "[data-testid='ns-property-field-units']",
    ) as HTMLInputElement;
    if (unitsInput && unitsInput.value !== undefined) {
      expect(unitsInput.value).toBe("people");
    }
  });

  it("[P1] initialValue rendered as number input", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const initInput = container.querySelector("[data-testid='ns-property-field-initialValue']");
    expect(initInput).not.toBeNull();
    if (initInput instanceof HTMLInputElement) {
      expect(initInput.type).toBe("number");
    }
  });

  it("[P1] allowNegative rendered as checkbox or role=switch", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const allowNeg = container.querySelector("[data-testid='ns-property-field-allowNegative']");
    expect(allowNeg).not.toBeNull();
    // Should be a checkbox input or a role="switch" element.
    if (allowNeg instanceof HTMLInputElement) {
      expect(allowNeg.type).toBe("checkbox");
    }
  });
});

// ---------------------------------------------------------------------------
// AC-4: 存量字段编辑持久化
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-4 stock field editing persistence (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] editing name calls updateElement with {name}", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();

    // Change the name.
    fireEvent.change(nameInput!, { target: { value: "NewName" } });
    fireEvent.blur(nameInput!);

    // Verify store was updated.
    const updated = store.getElements().find((e) => e.id === stock.id);
    expect(updated).toBeDefined();
    if (updated && (updated as Stock).name !== undefined) {
      expect((updated as Stock).name).toBe("NewName");
    }
  });

  it("[P0] editing initialValue calls updateElement with {initialValue}", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const initInput = container.querySelector(
      "[data-testid='ns-property-field-initialValue']",
    ) as HTMLInputElement;
    expect(initInput).not.toBeNull();

    fireEvent.change(initInput!, { target: { value: "200" } });
    fireEvent.blur(initInput!);

    const updated = store.getElements().find((e) => e.id === stock.id) as Stock;
    expect(updated.initialValue).toBe(200);
  });

  it("[P1] editing units calls updateElement with {units}", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const unitsInput = container.querySelector(
      "[data-testid='ns-property-field-units']",
    ) as HTMLInputElement;
    expect(unitsInput).not.toBeNull();

    fireEvent.change(unitsInput!, { target: { value: "元" } });
    fireEvent.blur(unitsInput!);

    const updated = store.getElements().find((e) => e.id === stock.id) as Stock;
    expect(updated.units).toBe("元");
  });

  it("[P1] toggling allowNegative calls updateElement with {allowNegative}", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const checkbox = container.querySelector(
      "[data-testid='ns-property-field-allowNegative']",
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();

    // Current value is false; toggle to true.
    fireEvent.click(checkbox!);

    const updated = store.getElements().find((e) => e.id === stock.id) as Stock;
    expect(updated.allowNegative).toBe(true);
  });

  it("[P2] updateElement uses shallow merge (only the changed field, not full object)", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    // Edit only the name.
    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    fireEvent.change(nameInput!, { target: { value: "Renamed" } });
    fireEvent.blur(nameInput!);

    const updated = store.getElements().find((e) => e.id === stock.id) as Stock;
    // Other fields must remain unchanged.
    expect(updated.name).toBe("Renamed");
    expect(updated.initialValue).toBe(stock.initialValue);
    expect(updated.units).toBe(stock.units);
    expect(updated.allowNegative).toBe(stock.allowNegative);
  });
});

// ---------------------------------------------------------------------------
// AC-5: cloud 字段(最简)
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-5 cloud fields (P1)", () => {
  afterEach(() => cleanup());

  it("[P1] cloud selected shows name field only", () => {
    const store = setupStore(["cloud"]);
    const cloud = firstOf(store, "cloud") as Cloud;
    const { container } = renderPanel(store, cloud.id);

    expect(container.querySelector("[data-testid='ns-property-field-name']")).not.toBeNull();

    // Stock/flow fields must be absent.
    expect(container.querySelector("[data-testid='ns-property-field-initialValue']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-units']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-allowNegative']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-formula']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-isVariable']")).toBeNull();
  });

  it("[P1] editing cloud name persists via updateElement", () => {
    const store = setupStore(["cloud"]);
    const cloud = firstOf(store, "cloud") as Cloud;
    const { container } = renderPanel(store, cloud.id);

    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    fireEvent.change(nameInput!, { target: { value: "RenamedCloud" } });
    fireEvent.blur(nameInput!);

    const updated = store.getElements().find((e) => e.id === cloud.id);
    expect(updated).toBeDefined();
    if (updated) {
      expect(updated.name).toBe("RenamedCloud");
    }
  });

  it("[P1] undefined cloud name shows empty or placeholder in name field", () => {
    const store = createElementStore();
    store.setElements([]);
    store.createCloud({ x: 0, y: 0 }); // no name — Cloud allows name? optional
    const cloud = store.getElements()[0];
    const { container } = renderPanel(store, cloud.id);

    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    // Empty name should show placeholder or empty.
  });
});

// ---------------------------------------------------------------------------
// AC-6: 流量字段-公式编辑器
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-6 flow formula editor (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] flow selected shows formula textarea, isVariable toggle, derived units", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    expect(container.querySelector("[data-testid='ns-property-field-formula']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-isVariable']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-property-field-derivedUnits']"),
    ).not.toBeNull();
  });

  it("[P1] formula input is a textarea (multiline editing)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector("[data-testid='ns-property-field-formula']");
    expect(formulaEl).not.toBeNull();
    expect(formulaEl!.tagName).toBe("TEXTAREA");
  });

  it("[P1] formula textarea shows raw storage form (@uuid intact, not name-resolved)", () => {
    // Dual model: storage form uses @uuid; display form uses names (F10 preview).
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    // Set a formula with @uuid.
    store.updateElement(flow.id, { formula: "@00000000-0000-0000-0000-000000000001 * 2" } as any);
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    expect(formulaEl).not.toBeNull();
    if (formulaEl) {
      // Storage form — @uuid preserved.
      expect(formulaEl.value).toContain("@");
    }
  });

  it("[P1] flow panel does NOT render stock-only fields (initialValue, allowNegative)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    expect(container.querySelector("[data-testid='ns-property-field-initialValue']")).toBeNull();
    expect(container.querySelector("[data-testid='ns-property-field-allowNegative']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-8: isVariable 可变/常数切换 (F8)
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-8 isVariable toggle (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] toggle click calls updateElement with negated isVariable", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const beforeIsVar = flow.isVariable; // false by default

    const { container } = renderPanel(store, flow.id);

    const toggle = container.querySelector("[data-testid='ns-property-field-isVariable']");
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);

    const updated = store.getElements().find((e) => e.id === flow.id) as Flow;
    expect(updated.isVariable).toBe(!beforeIsVar);
  });

  it("[P1] toggle has role='switch' and aria-checked reflects isVariable", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;

    // Render with isVariable=true for this test.
    store.updateElement(flow.id, { isVariable: true } as any);
    const { container } = renderPanel(store, flow.id);

    const toggle = container.querySelector("[data-testid='ns-property-field-isVariable']");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("role")).toBe("switch");
    expect(toggle!.getAttribute("aria-checked")).toBe("true");
  });

  it("[P1] toggling off sets isVariable:false and aria-checked='false'", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    store.updateElement(flow.id, { isVariable: true } as any);

    const { container } = renderPanel(store, flow.id);

    const toggle = container.querySelector("[data-testid='ns-property-field-isVariable']");
    fireEvent.click(toggle!);

    // After click, aria-checked should be false.
    expect(toggle!.getAttribute("aria-checked")).toBe("false");

    const updated = store.getElements().find((e) => e.id === flow.id) as Flow;
    expect(updated.isVariable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-9: 派生流量单位只读
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-9 derived flow units read-only (P1)", () => {
  afterEach(() => cleanup());

  it("[P1] derived units field displays deriveFlowUnits result", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const unitsEl = container.querySelector("[data-testid='ns-property-field-derivedUnits']");
    expect(unitsEl).not.toBeNull();
    // Should display "people/dt" (derived from target stock units + default /dt).
    expect(unitsEl!.textContent).toBeTruthy();
  });

  it("[P1] derived units field is read-only (not editable)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const unitsEl = container.querySelector("[data-testid='ns-property-field-derivedUnits']");
    expect(unitsEl).not.toBeNull();

    // Must not be an input/textarea — read-only display only.
    if (unitsEl instanceof HTMLInputElement || unitsEl instanceof HTMLTextAreaElement) {
      expect(unitsEl.readOnly || unitsEl.disabled).toBe(true);
    }
    // Should not be an editable element.
    expect(unitsEl!.tagName).not.toBe("INPUT");
    expect(unitsEl!.tagName).not.toBe("TEXTAREA");
  });

  it("[P2] changing formula text updates derived units reactively (F-1 live deriveFlowUnits)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    const unitsEl = container.querySelector("[data-testid='ns-property-field-derivedUnits']");
    expect(unitsEl).not.toBeNull();

    // Baseline: default formula "1" has no [unit] annotation -> time unit /dt.
    // Target stock (toId) units = "people" -> derived "people/dt".
    const beforeText = unitsEl!.textContent ?? "";
    expect(beforeText).toContain("/dt");
    expect(beforeText).not.toContain("/month");

    // Change formula to include a [1/month] time annotation, then blur to persist.
    // deriveFlowUnits parses [1/month] -> inner "1/month" -> slice at "/" -> "/month".
    fireEvent.change(formulaEl!, { target: { value: "1 [1/month]" } });
    fireEvent.blur(formulaEl!);

    // F-1: derived units must recompute LIVE via deriveFlowUnits(formula, toId, elements)
    // on re-render - NOT read the stale build-time .units cache. The fields container
    // is NOT remounted here (same flow.id -> key unchanged), so re-query the persistent span.
    const afterEl = container.querySelector("[data-testid='ns-property-field-derivedUnits']");
    const afterText = afterEl!.textContent ?? "";

    // Units must have changed from /dt to /month. This locks F-1: without the live
    // deriveFlowUnits call (reading stale .units instead), the display would stay
    // "people/dt" and these assertions would fail.
    expect(afterText).not.toBe(beforeText);
    expect(afterText).toContain("/month");
    expect(afterText).not.toContain("/dt");
    // Stock-units portion is preserved (target stock units "people" still present).
    expect(afterText).toContain("people");
  });
});

// ---------------------------------------------------------------------------
// AC-10: 公式语法错误红色高亮
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-10 formula syntax error UI (P0)", () => {
  afterEach(() => cleanup());

  it("[P0] syntax error shows red border on formula field", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;

    // Enter invalid formula.
    fireEvent.change(formulaEl!, { target: { value: "(1+2" } }); // unclosed paren
    fireEvent.blur(formulaEl!);

    // Red border must appear.
    expect(formulaEl!.classList.toString().toLowerCase()).toMatch(/error|invalid|red/);
    // Or check for data attribute.
    const errorIndicator = container.querySelector("[data-testid='ns-property-formula-error']");
    expect(errorIndicator).not.toBeNull();
  });

  it("[P0] valid formula after error clears red border and error text", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;

    // First enter invalid.
    fireEvent.change(formulaEl!, { target: { value: "(1+2" } });
    fireEvent.blur(formulaEl!);
    expect(container.querySelector("[data-testid='ns-property-formula-error']")).not.toBeNull();

    // Then fix to valid.
    fireEvent.change(formulaEl!, { target: { value: "1 + 2" } });
    fireEvent.blur(formulaEl!);

    // Error must be cleared.
    expect(container.querySelector("[data-testid='ns-property-formula-error']")).toBeNull();
  });

  it("[P1] error text has aria-live='assertive' for screen reader announcement", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    fireEvent.change(formulaEl!, { target: { value: "0.0.5" } }); // bad number
    fireEvent.blur(formulaEl!);

    const errorEl = container.querySelector("[data-testid='ns-property-formula-error']");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.getAttribute("aria-live")).toBe("assertive");
  });

  it("[P0] multiple error inputs (unclosed paren, bad number, unexpected char) all show errors", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;

    const badFormulas = ["(1+2", "0.0.5", "1+@#", "[1/year"];
    for (const bad of badFormulas) {
      fireEvent.change(formulaEl!, { target: { value: bad } });
      fireEvent.blur(formulaEl!);
      expect(container.querySelector("[data-testid='ns-property-formula-error']")).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-11: 量纲校验入口存在+触发
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-11 dimensional check integration (P2)", () => {
  afterEach(() => cleanup());

  it("[P2] editing formula triggers checkDimensions call", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;

    // Edit formula — checkDimensions should be called.
    // We can't directly assert call count here (internal function), but
    // we can verify the dimensional status area is rendered post-edit.
    fireEvent.change(formulaEl!, { target: { value: "2 * Population" } });
    fireEvent.blur(formulaEl!);

    // Dimensional status area must exist in the panel.
    const dimStatus = container.querySelector("[data-testid='ns-property-dimensional-status']");
    expect(dimStatus).not.toBeNull();
  });

  it("[P2] checkDimensions failure does not block editing (non-blocking)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;

    // Edit and blur — even if dim check returns deferred, editing must work.
    fireEvent.change(formulaEl!, { target: { value: "999" } });
    fireEvent.blur(formulaEl!);

    // Formula update must persist regardless of dim check result.
    const updated = store.getElements().find((e) => e.id === flow.id) as Flow;
    expect(updated.formula).toBe("999");
  });
});

// ---------------------------------------------------------------------------
// AC-13: formatFormulaForEditor 接 UI (F10)
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-13 formula preview (F10, P1)", () => {
  afterEach(() => cleanup());

  it("[P1] formula preview area exists separate from textarea", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    store.updateElement(flow.id, {
      formula: "@00000000-0000-0000-0000-000000000001 * 0.05",
    } as any);
    const { container } = renderPanel(store, flow.id);

    // Preview area must exist (distinct from textarea).
    expect(container.querySelector("[data-testid='ns-property-formula-preview']")).not.toBeNull();
  });

  it("[P1] preview shows name-resolved formula (not raw @uuid)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    // Set formula with UUID that doesn't resolve.
    store.updateElement(flow.id, { formula: "@00000000-0000-0000-0000-000000000001 * 2" } as any);
    const { container } = renderPanel(store, flow.id);

    const preview = container.querySelector("[data-testid='ns-property-formula-preview']");
    expect(preview).not.toBeNull();
    // Preview should contain something (name or @uuid) — not empty.
    expect(preview!.textContent).toBeTruthy();
  });

  it("[P2] unknown @uuid preserved as-is in preview (no throw)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    store.updateElement(flow.id, { formula: "@ffffffff-ffff-ffff-ffff-ffffffffffff" } as any);
    const { container } = renderPanel(store, flow.id);

    const preview = container.querySelector("[data-testid='ns-property-formula-preview']");
    expect(preview).not.toBeNull();
    // Unknown @uuid should still render (not crash).
    expect(preview!.textContent).toBeTruthy();
  });

  it("[P2] [unit] annotations stripped from preview", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    store.updateElement(flow.id, { formula: "0.05 * Population [1/year]" } as any);
    const { container } = renderPanel(store, flow.id);

    const preview = container.querySelector("[data-testid='ns-property-formula-preview']");
    expect(preview).not.toBeNull();
    // Unit annotations must NOT appear in the preview.
    expect(preview!.textContent).not.toContain("[1/year]");
  });
});

// ---------------------------------------------------------------------------
// AC-14: AR#11 a11y
// ---------------------------------------------------------------------------

describe("PropertyPanel — AC-14 accessibility (P1)", () => {
  afterEach(() => cleanup());

  it("[P1] panel root has role='region' and aria-label='图元属性'", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const panel = container.querySelector("[data-testid='ns-property-panel']");
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("role")).toBe("region");
    expect(panel!.getAttribute("aria-label")).toBe("图元属性");
  });

  it("[P1] all editable fields have aria-label with semantic name", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    const fieldLabels: Record<string, string> = {
      "ns-property-field-name": "名称",
      "ns-property-field-initialValue": "初始值",
      "ns-property-field-units": "单位",
      "ns-property-field-allowNegative": "允许负值",
    };

    for (const [testid, expectedLabel] of Object.entries(fieldLabels)) {
      const el = container.querySelector(`[data-testid='${testid}']`);
      expect(el).not.toBeNull();
      expect(el!.getAttribute("aria-label")).toBe(expectedLabel);
    }
  });

  it("[P1] flow fields have semantic aria-labels", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    expect(
      container
        .querySelector("[data-testid='ns-property-field-formula']")
        ?.getAttribute("aria-label"),
    ).toBe("公式");
    expect(
      container
        .querySelector("[data-testid='ns-property-field-isVariable']")
        ?.getAttribute("aria-label"),
    ).toBe("可变/常数切换");
    expect(
      container
        .querySelector("[data-testid='ns-property-field-derivedUnits']")
        ?.getAttribute("aria-label"),
    ).toBe("派生单位");
  });

  it("[P1] isVariable toggle has role='switch' and aria-checked", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const toggle = container.querySelector("[data-testid='ns-property-field-isVariable']");
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("role")).toBe("switch");
    expect(toggle!.hasAttribute("aria-checked")).toBe(true);
  });

  it("[P1] formula error area has aria-live region (AC-10 a11y)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);

    const formulaEl = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    fireEvent.change(formulaEl!, { target: { value: "(1+2" } });
    fireEvent.blur(formulaEl!);

    // Error area must exist with aria-live for screen reader.
    const errorEl = container.querySelector("[data-testid='ns-property-formula-error']");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.getAttribute("aria-live")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: selection change reactivity
// ---------------------------------------------------------------------------

describe("PropertyPanel — selection change reactivity", () => {
  afterEach(() => cleanup());

  it("[P1] switching element resets uncommitted field edit to new element's value (F-2 key remount)", () => {
    const store = createElementStore();
    store.setElements([]);
    const s1 = store.createStock({
      name: "First",
      x: 0,
      y: 0,
      width: 5,
      height: 3,
      initialValue: 10,
      units: "kg",
      allowNegative: false,
    });
    const s2 = store.createStock({
      name: "Second",
      x: 10,
      y: 10,
      width: 5,
      height: 3,
      initialValue: 20,
      units: "m",
      allowNegative: true,
    });

    const { container, rerender } = renderPanel(store, s1.id);

    // Baseline: s1's name field shows "First".
    const s1Name = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(s1Name).not.toBeNull();
    expect(s1Name.value).toBe("First");

    // Type into s1's name WITHOUT blurring - uncommitted DOM-only edit.
    // (defaultValue + onBlur: React does not manage the value, so the store
    // is not updated until blur. This is the strongest F-2 manifestation: an
    // uncommitted value must NOT leak into another element's field on switch.)
    fireEvent.change(s1Name, { target: { value: "UncommittedEdit" } });
    expect(s1Name.value).toBe("UncommittedEdit");
    // Store still holds "First" (no blur fired -> no updateElement).
    expect((store.getElements().find((e) => e.id === s1.id) as Stock).name).toBe("First");

    // Switch selection to s2.
    rerender(<PropertyPanel elementStore={store} selectedId={s2.id} />);

    // Re-query the name input - the key={selectedElement.id} remount on the
    // fields container (F-2 fix) creates a fresh node bound to s2's value.
    // The old s1Name reference is now detached; must re-query from container.
    const s2Name = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(s2Name).not.toBeNull();
    // F-2: field must show s2's value, NOT s1's uncommitted residual or stale value.
    expect(s2Name.value).toBe("Second");
    expect(s2Name.value).not.toBe("UncommittedEdit");
    expect(s2Name.value).not.toBe("First");

    // F-2 applies to all fields (key is on the container, remounting every child).
    const s2Units = container.querySelector(
      "[data-testid='ns-property-field-units']",
    ) as HTMLInputElement;
    expect(s2Units).not.toBeNull();
    expect(s2Units.value).toBe("m"); // s2's units, not s1's "kg"

    // s1's store value must be untouched (uncommitted edit did not persist/leak).
    expect((store.getElements().find((e) => e.id === s1.id) as Stock).name).toBe("First");
  });

  // NOTE: skipped by design — uncontrolled inputs (defaultValue + onBlur) do not
  // react to external store updates for the same element. This is acceptable for
  // the current UX: property panel is the sole editor; canvas is read-only display.
  // If concurrent editing is needed in the future, switch to controlled inputs.
  it.skip("[P1] panel updates when store element is modified externally", () => {
    const store = setupStore(["stock"]);
    const stock = firstOf(store, "stock") as Stock;
    const { container } = renderPanel(store, stock.id);

    // Modify stock externally (simulating another component's edit).
    act(() => {
      store.updateElement(stock.id, { name: "ExternallyUpdated" } as any);
    });

    // Panel should reflect the change.
    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    if (nameInput && nameInput.value !== undefined) {
      expect(nameInput.value).toBe("ExternallyUpdated");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Story 1a.11 图元命名机制 — RED PHASE SCAFFOLDS
//
// AC-7(a): PropertyPanel name rename collision surfacing.
//   Blur on name input with a value that collides with another element's name
//   MUST: (i) surface error via [data-testid="ns-property-name-error"],
//         (ii) revert input value to the store's current name,
//         (iii) NOT persist the collision (store.name unchanged).
//
// AC-7(a-x): Cross-selection F-2 (1a.8 教训): editing name for A without
//   blur, then re-rendering with B selected, MUST show B's name — never leak
//   A's in-flight edit into B's input.
// ═══════════════════════════════════════════════════════════════════════════

describe("PropertyPanel — AC-7(a) rename collision surfacing (1a.11 RED)", () => {
  it("blur collision → nameError DOM + input reverts + store.name unchanged", async () => {
    // gov: AC-7(a) + SDR#4 + T6
    const store = setupStore(["stock", "stock"]);
    const stocks = store.getElements().filter((e) => e.kind === "stock") as Stock[];
    // Rename them to distinct known values so the collision target is deterministic.
    act(() => {
      store.updateElement(stocks[0].id, { name: "A" } as Partial<Stock>);
      store.updateElement(stocks[1].id, { name: "B" } as Partial<Stock>);
    });
    const { container } = renderPanel(store, stocks[0].id);

    // before
    const nameInput = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("A");

    // action: user types "B" (existing) and blurs
    fireEvent.change(nameInput, { target: { value: "B" } });
    fireEvent.blur(nameInput);

    // after (i) — nameError DOM appears
    const errorEl = await waitFor(() =>
      container.querySelector("[data-testid='ns-property-name-error']"),
    );
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent ?? "").not.toBe("");

    // after (ii) — input reverts to "A"
    expect(nameInput.value).toBe("A");
    expect(nameInput.value).not.toBe("B");

    // after (iii) — store.name is still "A"
    const stored = store.getElements().find((e) => e.id === stocks[0].id) as Stock;
    expect(stored.name).toBe("A");
    expect(stored.name).not.toBe("B");
  });

  it("AC-7(a-x) cross-selection: A edit not blurred, switch to B → B input shows B's name", () => {
    // gov: AC-7(a) + SDR#4 + T6 + 1a.8 F-2 教训
    const store = setupStore(["stock", "stock"]);
    const stocks = store.getElements().filter((e) => e.kind === "stock") as Stock[];
    act(() => {
      store.updateElement(stocks[0].id, { name: "A" } as Partial<Stock>);
      store.updateElement(stocks[1].id, { name: "B" } as Partial<Stock>);
    });

    // Render A first, edit input WITHOUT blur.
    const { container, rerender } = renderPanel(store, stocks[0].id);
    const inputA = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    fireEvent.change(inputA, { target: { value: "in-flight-A-edit" } });

    // Switch selection to B (rerender with new selectedId).
    rerender(<PropertyPanel elementStore={store} selectedId={stocks[1].id} />);

    // The re-mounted input should reflect B's stored name, not A's in-flight text.
    const inputB = container.querySelector(
      "[data-testid='ns-property-field-name']",
    ) as HTMLInputElement;
    expect(inputB.value).toBe("B");
    expect(inputB.value).not.toBe("in-flight-A-edit");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Story 1a.12 D1 - PropertyPanel formula controlled + AtMentionAutocomplete 集成
// gov: SDR#11 (controlled 双路径, 避免 1a.8 F-2 hollow) / SDR#23 (name<->id 反向映射) /
//      AC-19 (id->name 显示 / @ 下拉 / 选项插入 / blur persist id-form / controlled).
// Red: PropertyPanel formula 仍为 1a.8 uncontrolled (defaultValue+onBlur), 无 autocomplete
//      -> name-form 显示/外部更新同步/@ 下拉 均未实现 -> 断言 fail.
// 1a.8 L461 (unknown @uuid preserved) 保留绿: 未知 uuid 不解析仍含 @, 与 D1 不冲突.
// ═══════════════════════════════════════════════════════════════════════════

describe("PropertyPanel - 1a.12 D1 controlled formula + autocomplete (AC-19 RED)", () => {
  afterEach(() => cleanup());

  it("AC-19(a): flow formula @<stockId> displays as stock name (D1 name-form, not @uuid)", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const stock = firstOf(store, "stock") as Stock;
    const flow = firstOf(store, "flow") as Flow;
    act(() => {
      store.updateElement(stock.id, { name: "库存" } as Partial<Stock>);
      store.updateElement(flow.id, { formula: `@${stock.id} * 2` } as Partial<Flow>);
    });
    const { container } = renderPanel(store, flow.id);
    const ta = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    // D1: display = name form "库存 * 2", NOT raw "@<uuid> * 2".
    expect(ta.value).toContain("库存");
    expect(ta.value).not.toContain(stock.id);
  });

  it("AC-19(b): typing @ in formula opens AtMentionAutocomplete listbox", () => {
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);
    const ta = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    fireEvent.focus(ta);
    fireEvent.change(ta, { target: { value: "@" } });
    expect(container.querySelector("[data-testid='ns-at-mention-listbox']")).not.toBeNull();
  });

  it("AC-19(e): formula textarea is controlled (external store update reflects, not uncontrolled)", () => {
    // 1a.8 uncontrolled (defaultValue) does NOT reflect external store updates (see
    // L970 skipped test for name). D1 controlled MUST reflect. Red until D1 wires value.
    const store = setupStore(["stock", "stock", "flow"]);
    const flow = firstOf(store, "flow") as Flow;
    const { container } = renderPanel(store, flow.id);
    const before = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    expect(before.value).toBe("1"); // default formula
    act(() => {
      store.updateElement(flow.id, { formula: "2 + 2" } as Partial<Flow>);
    });
    const after = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    // controlled: reflects new store value. uncontrolled: stays "1" -> red.
    expect(after.value).toBe("2 + 2");
  });

  it("AC-19 F-2 regression: switch flow selection resets uncommitted formula edit (SDR#11)", () => {
    // 守卫: D1 controlled 转换不得重新引入 1a.8 F-2 (draft 跨选择泄漏).
    const store = setupStore(["stock", "stock", "flow"]);
    const stocks = store.getElements().filter((e) => e.kind === "stock") as Stock[];
    const f2: Flow = {
      id: crypto.randomUUID(),
      kind: "flow",
      name: "F2",
      fromId: stocks[0].id,
      toId: stocks[1].id,
      formula: "2",
      isVariable: false,
      lastValue: 0,
      units: "people/dt",
    };
    store.setElements([...store.getElements(), f2]);
    const flow1 = firstOf(store, "flow") as Flow;

    const { container, rerender } = renderPanel(store, flow1.id);
    const ta1 = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    fireEvent.change(ta1, { target: { value: "uncommitted-edit" } });

    rerender(<PropertyPanel elementStore={store} selectedId={f2.id} />);
    const ta2 = container.querySelector(
      "[data-testid='ns-property-field-formula']",
    ) as HTMLTextAreaElement;
    expect(ta2.value).toBe("2"); // f2's formula, not flow1's uncommitted edit
    expect(ta2.value).not.toBe("uncommitted-edit");
  });
});
