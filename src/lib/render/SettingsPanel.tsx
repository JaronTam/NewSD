// Story 1a.9 T4 — Settings panel (language toggle via Toolbar gear popover).
// gov: AC-3 (settings panel entry) / AC-2 (lang toggle) / AC-4 (localStorage persist).
//
// Q5=A: Toolbar gear icon popover. Renders a small popover/dropdown with
// language toggle buttons (zh/en). The Toolbar imports and positions this
// component next to the gear button (T5).
//
// Story 1a-10 T10 — extended with model settings (1a.9 Q5 verdict: "1a.10
// model-settings 可扩展同弹层"): timeUnit single-select (AC-1, 6 options via
// t()) + dim-revalidation status row (AC-7/AC-13). dt 留 Toolbar 不复刻
// (SDR#3/#31, 单一源 modelStore 避免双写竞态).

import { useSyncExternalStore } from "react";
import { langStore } from "../sd/langStore";
import { modelStore, type TimeUnit } from "../sd/modelStore";
import { t, type DictKey } from "../sd/i18n";

/** AC-1/AC-13: 时间单位 6 选项 (年/月/日/时/分/秒, FR-SIM-1) — labels via t(). */
const TIME_UNIT_OPTIONS: readonly { value: TimeUnit; key: DictKey }[] = [
  { value: "year", key: "unitYear" },
  { value: "month", key: "unitMonth" },
  { value: "day", key: "unitDay" },
  { value: "hour", key: "unitHour" },
  { value: "minute", key: "unitMinute" },
  { value: "second", key: "unitSecond" },
];

export function SettingsPanel() {
  const lang = useSyncExternalStore(langStore.subscribe, langStore.getSnapshot);
  const modelConfig = useSyncExternalStore(modelStore.subscribe, modelStore.getSnapshot);
  const last = modelConfig.lastRevalidation;

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

      {/* ── Story 1a-10: model settings — time unit single-select (AC-1) ── */}
      <span className="ns-settings-panel__label">{t("timeUnit", lang)}</span>
      <select
        data-testid="ns-settings-time-unit"
        className="ns-settings-panel__time-unit"
        aria-label={t("timeUnit", lang)}
        value={modelConfig.timeUnit}
        onChange={(e) => modelStore.setTimeUnit(e.target.value as TimeUnit)}
      >
        {TIME_UNIT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.key, lang)}
          </option>
        ))}
      </select>

      {/* ── Story 1a-10: dim-revalidation status row (AC-7/AC-13) ── */}
      <span
        data-testid="ns-settings-dim-revalidation"
        className="ns-settings-panel__dim-revalidation"
      >
        {t("dimRevalidationPending", lang)} · {last?.flowCount ?? 0}
      </span>
    </div>
  );
}
