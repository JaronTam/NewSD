// Story 1a.9 T4 — Settings panel (language toggle via Toolbar gear popover).
// gov: AC-3 (settings panel entry) / AC-2 (lang toggle) / AC-4 (localStorage persist).
//
// Q5=A: Toolbar gear icon popover. Renders a small popover/dropdown with
// language toggle buttons (zh/en). The Toolbar imports and positions this
// component next to the gear button (T5).

import { useSyncExternalStore } from "react";
import { langStore } from "../sd/langStore";
import { t } from "../sd/i18n";

export function SettingsPanel() {
  const lang = useSyncExternalStore(langStore.subscribe, langStore.getSnapshot);

  return (
    <div data-testid="ns-settings-panel" className="ns-settings-panel">
      <span className="ns-settings-panel__label">{t("language", lang)}</span>
      <button
        type="button"
        data-testid="ns-settings-lang-zh"
        className={`ns-settings-panel__lang-btn${lang === "zh" ? " ns-settings-panel__lang-btn--active" : ""}`}
        aria-label="中文"
        aria-pressed={lang === "zh"}
        onClick={() => langStore.setLang("zh")}
      >
        中文
      </button>
      <button
        type="button"
        data-testid="ns-settings-lang-en"
        className={`ns-settings-panel__lang-btn${lang === "en" ? " ns-settings-panel__lang-btn--active" : ""}`}
        aria-label="English"
        aria-pressed={lang === "en"}
        onClick={() => langStore.setLang("en")}
      >
        English
      </button>
    </div>
  );
}
