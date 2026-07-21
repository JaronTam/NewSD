// Story 1a.9 T0 - ATDD red-phase scaffold (SettingsPanel).
// gov: AC-3 (settings panel entry via Toolbar gear; lang toggle + persist).
//
// RED PHASE: all tests it.skip() - dormant until DS (T3) creates SettingsPanel.tsx.
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
