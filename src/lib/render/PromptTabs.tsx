// Story 1a.12 T1 - Tab bar subcomponent for PromptPanel.
// gov: SDR#1 (4 tab keys) / SDR#3 (activeTab priority / 9-group routing matrix).
//
// Renders 4 role="tab" buttons in fixed order: alert / milestone / sourcesink / stock.
// Active tab gets aria-selected="true". Flash class on "!" tab when hasUnanswered.
// Wraps children in a role="tabpanel" container.

import type { TabKey, PromptMessage } from "./promptStore";
import { t } from "../sd/i18n";
import type { Lang } from "../sd/i18n";

/** SDR#1: 4-tab key set, fixed order. Q6=C: keep key, delete label, component-internal t(). */
export const TABS: readonly TabKey[] = ["alert", "milestone", "sourcesink", "stock"];

/** Q6=C: resolve tab display label at render time. "!" is ASCII art (AC-10). */
export function tabLabel(key: TabKey, lang: Lang): string {
  if (key === "alert") return "!";
  if (key === "milestone") return t("milestone", lang);
  if (key === "sourcesink") return t("sourceSink", lang);
  return t("stock", lang);
}

/**
 * SDR#3: resolve which tab to activate (9-group routing matrix).
 * Priority: hasUnanswered → force "alert"; requestedTab → use it;
 * lastActiveTab → use it; fallback "alert".
 */
export function resolveActivateTab(
  hasUnanswered: boolean,
  requestedTab: TabKey | null,
  lastActiveTab: TabKey | null,
): TabKey {
  if (hasUnanswered) return "alert";
  if (requestedTab) return requestedTab;
  if (lastActiveTab) return lastActiveTab;
  return "alert";
}

export interface PromptTabsProps {
  messages: readonly PromptMessage[];
  activeTab: TabKey;
  lang: Lang;
  onTabChange: (key: TabKey) => void;
  hasUnanswered: boolean;
  /** AC-13: unread alert count for the "!" tab badge. */
  unreadAlertCount?: number;
  children?: React.ReactNode;
}

export function PromptTabs({
  messages: _messages,
  activeTab,
  lang,
  onTabChange,
  hasUnanswered,
  unreadAlertCount = 0,
  children,
}: PromptTabsProps) {
  return (
    <>
      <div className="ns-prompt-panel__tabs" role="tablist" aria-label={t("promptTabsLabel", lang)}>
        {TABS.map((key) => {
          const isActive = key === activeTab;
          const isAlert = key === "alert";
          const flashClass =
            isAlert && hasUnanswered && !isActive ? " ns-prompt-panel__tab--flash" : "";
          return (
            <button
              key={key}
              type="button"
              role="tab"
              data-testid={`ns-prompt-panel-tab-${key}`}
              className={`ns-prompt-panel__tab${isActive ? " ns-prompt-panel__tab--active" : ""}${flashClass}`}
              aria-selected={isActive}
              aria-label={tabLabel(key, lang)}
              onClick={() => onTabChange(key)}
            >
              {tabLabel(key, lang)}
              {isAlert && unreadAlertCount > 0 && (
                <span
                  className="ns-prompt-panel__tab-badge"
                  data-testid="ns-prompt-panel-tab-unread"
                >
                  {unreadAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        className="ns-prompt-panel__list"
        aria-label={t("tabContent", lang).replace("{tab}", tabLabel(activeTab, lang))}
      >
        {children}
      </div>
    </>
  );
}
