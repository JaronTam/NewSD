// Story 1a.9 T2 — External singleton store for runtime language state.
// gov: AC-2 (subscribe + instant switch) / AC-4 (localStorage) / AC-11 (navigator.language).
//
// Pattern: factory-closure external store (mirrors elementStore / promptStore / autosaveStore).
// Consumers: SettingsPanel, Toolbar, StatusBar, PropertyPanel, CanvasView, PromptPanel, tabs.
//
// Initialisation: localStorage → navigator.language → 'en' default (AC-11: 其他/SSR → en).

import type { Lang } from "./i18n";

/** AC-4: localStorage key for language preference. */
export const LANG_KEY = "ns-lang";

/** AC-11: pure function — detect Lang from navigator.language string. */
export function detectLang(navLang: string): Lang {
  if (!navLang) return "en";
  const lower = navLang.toLowerCase();
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("en")) return "en";
  return "en";
}

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "zh" || v === "en") return v;
  } catch {
    // localStorage unavailable (SSR / test) — fall through
  }
  return null;
}

function createLangStore() {
  let lang: Lang =
    readStoredLang() ?? detectLang(typeof navigator !== "undefined" ? navigator.language : "");
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((cb) => cb());
  }

  return {
    /** AC-2: useSyncExternalStore subscription. */
    subscribe(cb: () => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    /** AC-2: current snapshot for useSyncExternalStore. */
    getSnapshot(): Lang {
      return lang;
    },

    /** AC-2: switch language + persist (AC-4) + notify subscribers. */
    setLang(next: Lang) {
      if (next === lang) return;
      lang = next;
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // localStorage quota exceeded or unavailable — noop (in-memory only).
      }
      notify();
    },
  };
}

/** Shared singleton (imported by all UI components that need lang state). */
export const langStore = createLangStore();
