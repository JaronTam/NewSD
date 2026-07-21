// Story 1a.9 T0 - ATDD red-phase scaffold (i18n E27 fallback).
// gov: AC-1 (dict extend + E27 fallback) / AC-13 (E27 English key name) / AC-14 (E27 console.warn).
//
// RED PHASE: all tests are it.skip() — dormant until DS (T1) activates them.
// i18n.ts EXISTS (brownfield 1a.1 @7306f98) — real import; NO declare-const needed.
// E27 fallback (3-tier) is the NEW behaviour this scaffold pins:
//   tier 1 — key + lang present          -> return dict[key][lang]
//   tier 2 — key present, lang missing   -> fallback dict[key].en + console.warn
//   tier 3 — key absent                  -> return KEY NAME + console.warn (never empty / never throw)
// Current t() is naive: `dict[key][lang]` throws TypeError on a missing key.
// Activated tier-3 tests FAIL (throw) until DS adds the fallback.
//
// Cast strategy: missing keys are `string` variables cast `as DictKey` so the
// brownfield t() signature type-checks without augmenting DictKey. When DS
// extends dict, the casts remain valid (string -> literal-union downcast).

import { describe, expect, it, vi } from "vitest";
import { t, type DictKey } from "./i18n";

// Key absent from dict — used for tier-3 fallback assertions.
const MISSING_KEY = "__atdd_missing_1a9__";

describe("i18n.t - AC-1 tier 1: existing key + lang returns dict value", () => {
  it("returns English / Chinese values for an existing key", () => {
    // gov: AC-1 + SDR#7 + T1.1 (green-ready sanity; pins tier-1 contract).
    expect(t("file", "en")).toBe("File");
    expect(t("file", "zh")).toBe("文件");
  });
});

describe("i18n.t - AC-13 tier 3: missing key returns the key name (ASCII)", () => {
  it("returns the key name for a missing key (en)", () => {
    // gov: AC-13 + SDR#7 + T1.2. RED: current t() throws TypeError -> fail.
    expect(t(MISSING_KEY as DictKey, "en")).toBe(MISSING_KEY);
  });

  it("returns the key name for a missing key (zh)", () => {
    // gov: AC-13 + SDR#7 + T1.2. RED: current t() throws TypeError -> fail.
    expect(t(MISSING_KEY as DictKey, "zh")).toBe(MISSING_KEY);
  });

  it("never returns an empty string for a missing key", () => {
    // gov: AC-13 + SDR#7 + T1.2. RED: current t() throws -> fail.
    expect(t(MISSING_KEY as DictKey, "en")).not.toBe("");
  });
});

describe("i18n.t - AC-1/AC-13 tier 3: missing key does not throw", () => {
  it("does not throw for a missing key", () => {
    // gov: AC-1 + AC-13 + SDR#7 + T1.2. RED: current t() throws -> fail.
    expect(() => t(MISSING_KEY as DictKey, "en")).not.toThrow();
  });
});

describe("i18n.t - AC-14 tier 3: missing key logs a console.warn", () => {
  it("calls console.warn with the missing key name", () => {
    // gov: AC-14 + SDR#7 + T1.3. RED: current t() throws before any warn -> spy not called.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      t(MISSING_KEY as DictKey, "en");
    } catch {
      // pre-implementation: t() throws; swallow so the assertion can run.
    }
    expect(warnSpy).toHaveBeenCalled();
    const warned = warnSpy.mock.calls.some((c) => String(c[0] ?? "").includes(MISSING_KEY));
    expect(warned).toBe(true);
    warnSpy.mockRestore();
  });
});
