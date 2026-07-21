// Story 1a.9 T0 - ATDD red-phase scaffold (langStore).
// gov: AC-2 (subscribe + runtime instant switch) / AC-4 (localStorage ns-lang) / AC-11 (navigator.language default).
//
// RED PHASE: all tests it.skip() - dormant until DS (T2) creates langStore.ts.
// langStore.ts is NEW (does not exist at ATDD time) - symbols declared ambient
// via `declare const` / `declare function` so this file tsc-compiles. DS first
// step: replace the declare block with `import { ... } from "./langStore"`.
//
// API mirrors the existing external-singleton store pattern (elementStore /
// promptStore / autosaveStore @autosave.ts: useSyncExternalStore + subscribe /
// getSnapshot + mutation). Recommended testable seam for AC-11: a PURE
// `detectLang(navLang)` function (no navigator side-effect at call time).
// DS owns exact signatures; tests pin BEHAVIOUR. If DS names things differently,
// swap the declare-block symbols - not the assertions.

import { afterEach, describe, expect, it, vi } from "vitest";
import { LANG_KEY, langStore, detectLang } from "./langStore";

const EXPECTED_LANG_KEY = "ns-lang";

describe("langStore - AC-2: external store subscribe + instant switch", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("subscribe returns an unsubscribe function", () => {
    // gov: AC-2 + SDR#3 + T2.1. RED: subscribe is undefined (declare) -> throw.
    const unsub = langStore.subscribe(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("setLang fires subscribed listeners", () => {
    // gov: AC-2 + SDR#3 + T2.1. RED. Robust to init: set the OTHER lang (always fires).
    const listener = vi.fn();
    const unsub = langStore.subscribe(listener);
    langStore.setLang(langStore.getSnapshot() === "zh" ? "en" : "zh");
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it("getSnapshot reflects setLang immediately (no re-render needed)", () => {
    // gov: AC-2 + SDR#3 + T2.1. RED.
    langStore.setLang("en");
    expect(langStore.getSnapshot()).toBe("en");
    langStore.setLang("zh");
    expect(langStore.getSnapshot()).toBe("zh");
  });
});

describe("langStore - AC-4: localStorage persistence under LANG_KEY", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("LANG_KEY constant is 'ns-lang'", () => {
    // gov: AC-4 + SDR#4 + T2.2. RED: LANG_KEY undefined -> fail.
    expect(LANG_KEY).toBe(EXPECTED_LANG_KEY);
  });

  it("setLang('en') writes 'en' to localStorage[LANG_KEY]", () => {
    // gov: AC-4 + SDR#4 + T2.2. RED. Robust to init: force to 'zh' first (no-op if already).
    langStore.setLang("zh");
    langStore.setLang("en");
    expect(localStorage.getItem(LANG_KEY)).toBe("en");
  });

  it("setLang('zh') writes 'zh' to localStorage[LANG_KEY]", () => {
    // gov: AC-4 + SDR#4 + T2.2. RED. Robust to init: force to 'en' first (no-op if already).
    langStore.setLang("en");
    langStore.setLang("zh");
    expect(localStorage.getItem(LANG_KEY)).toBe("zh");
  });
});

describe("langStore - AC-11: navigator.language default detection", () => {
  it("detectLang returns 'en' for an English navigator.language", () => {
    // gov: AC-11 + SDR#4 + T2.3. RED: detectLang undefined -> throw.
    expect(detectLang("en-US")).toBe("en");
  });

  it("detectLang returns 'zh' for a Chinese navigator.language", () => {
    // gov: AC-11 + SDR#4 + T2.3. RED.
    expect(detectLang("zh-CN")).toBe("zh");
  });

  it("detectLang falls back to 'en' for an unknown language", () => {
    // gov: AC-11 + SDR#4 + T2.3. RED. AC-11 spec: 其他 -> en.
    expect(detectLang("fr-FR")).toBe("en");
  });

  it("detectLang returns 'en' for empty navigator.language (SSR/no-navigator)", () => {
    // gov: AC-11 + SDR#4 + T2.3. SSR or navigator.language missing -> "" -> en.
    expect(detectLang("")).toBe("en");
  });
});
