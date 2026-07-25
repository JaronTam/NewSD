// Story 1a.9 T0 - ATDD red-phase scaffold (SettingsPanel).
// gov: AC-3 (settings panel entry via Toolbar gear; lang toggle + persist).
//
// RED PHASE: all tests it() - dormant until DS (T3) creates SettingsPanel.tsx.
// SettingsPanel.tsx is NEW - declared ambient via `declare const SettingsPanel`
// (React.FC) so JSX tsc-compiles. langStore is also NEW - ambient declares.
// DS first step: replace BOTH declare blocks with real imports.

import type { FC } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { langStore, LANG_KEY } from "../sd/langStore";
import { SettingsPanel } from "./SettingsPanel";

describe("SettingsPanel - AC-3: gear entry renders the panel", () => {
  beforeEach(() => {
    langStore.setLang("zh");
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders an element with data-testid='ns-settings-panel'", () => {
    // gov: AC-3 + SDR#2 + T3.1. RED: SettingsPanel undefined -> render throws.
    const { container } = render(<SettingsPanel />);
    const panel = container.querySelector('[data-testid="ns-settings-panel"]');
    expect(panel).not.toBeNull();
  });
});

describe("SettingsPanel - AC-3: lang toggle switches + persists", () => {
  beforeEach(() => {
    langStore.setLang("zh");
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("clicking the English option switches langStore to 'en'", () => {
    // gov: AC-2 + AC-3 + SDR#2 + T3.2. RED.
    const { container } = render(<SettingsPanel />);
    const enBtn = container.querySelector('[data-testid="ns-settings-lang-en"]') as HTMLElement;
    fireEvent.click(enBtn);
    expect(langStore.getSnapshot()).toBe("en");
  });

  it("clicking English persists 'en' to localStorage[LANG_KEY]", () => {
    // gov: AC-3 + AC-4 + SDR#4 + T3.2. RED.
    const { container } = render(<SettingsPanel />);
    fireEvent.click(container.querySelector('[data-testid="ns-settings-lang-en"]') as Element);
    expect(localStorage.getItem(LANG_KEY)).toBe("en");
  });

  it("clicking the Chinese option switches langStore to 'zh'", () => {
    // gov: AC-2 + AC-3 + SDR#2 + T3.2. RED.
    const { container } = render(<SettingsPanel />);
    fireEvent.click(container.querySelector('[data-testid="ns-settings-lang-zh"]') as Element);
    expect(langStore.getSnapshot()).toBe("zh");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Story 1a-10 T9/T10 - SettingsPanel timeUnit control + dim-revalidation row.
// gov: AC-1/AC-13 + SDR#1/#2 + T9/T10.
//
// DS T10 done: declare-const block replaced with real import.
// ═══════════════════════════════════════════════════════════════════════════════

import { modelStore } from "../sd/modelStore";

describe("SettingsPanel - AC-1: timeUnit single-select (6 options 年/月/日/时/分/秒 via t())", () => {
  beforeEach(() => {
    langStore.setLang("zh");
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("[P0] renders <select data-testid='ns-settings-time-unit'> with 6 options", () => {
    // gov: AC-1 + SDR#1/#2 + T9. RED: control not yet in SettingsPanel.
    const { container } = render(<SettingsPanel />);
    const select = container.querySelector(
      '[data-testid="ns-settings-time-unit"]',
    ) as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.options).toHaveLength(6);
  });

  it("[P0] select.value reflects modelStore.getSnapshot().timeUnit", () => {
    // gov: AC-1 + SDR#1 + T9. current value = modelStore.timeUnit.
    const { container } = render(<SettingsPanel />);
    const select = container.querySelector(
      '[data-testid="ns-settings-time-unit"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe(modelStore.getSnapshot().timeUnit);
  });

  it("[P0] changing select calls modelStore.setTimeUnit(next) -> snapshot update + persist", () => {
    // gov: AC-1 + SDR#1 + T9. select -> setTimeUnit -> ns-model-config persist.
    const { container } = render(<SettingsPanel />);
    const select = container.querySelector(
      '[data-testid="ns-settings-time-unit"]',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "month" } });
    expect(modelStore.getSnapshot().timeUnit).toBe("month");
  });
});

describe("SettingsPanel - AC-13/AC-7: dim-revalidation status row", () => {
  beforeEach(() => {
    langStore.setLang("zh");
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("[P0] renders <span data-testid='ns-settings-dim-revalidation'> showing flowCount + 待 1b", () => {
    // gov: AC-13 + AC-7 + SDR#6 + T9. status row reads modelStore.lastRevalidation (i18n dimRevalidationPending).
    const { container } = render(<SettingsPanel />);
    const row = container.querySelector('[data-testid="ns-settings-dim-revalidation"]');
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("待 1b");
  });
});
