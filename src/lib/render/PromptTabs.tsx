// Story 1a.12 T1 - Tab bar subcomponent for PromptPanel.
// gov: SDR#1 (4 tab keys) / SDR#3 (activeTab priority / 9-group routing matrix).
//
// Renders 4 role="tab" buttons in fixed order: alert / milestone / sourcesink / stock.
// Active tab gets aria-selected="true". Flash class on "!" tab when hasUnanswered.
// Wraps children in a role="tabpanel" container.

import type { TabKey, PromptMessage } from "./promptStore";

export interface TabDef {
  key: TabKey;
  label: string;
}

/** SDR#1: 4-tab key set, fixed order. */
export const TABS: readonly TabDef[] = [
  { key: "alert", label: "!" },
  { key: "milestone", label: "里程碑" },
  { key: "sourcesink", label: "源/汇" },
  { key: "stock", label: "存量" },
];

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
  onTabChange: (key: TabKey) => void;
  hasUnanswered: boolean;
  /** AC-13: unread alert count for the "!" tab badge. */
  unreadAlertCount?: number;
  children?: React.ReactNode;
}

export function PromptTabs({
  messages: _messages,
  activeTab,
  onTabChange,
  hasUnanswered,
  unreadAlertCount = 0,
  children,
}: PromptTabsProps) {
  return (
    <>
      <div className="ns-prompt-panel__tabs" role="tablist" aria-label="提示面板标签">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const isAlert = tab.key === "alert";
          const flashClass =
            isAlert && hasUnanswered && !isActive ? " ns-prompt-panel__tab--flash" : "";
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              data-testid={`ns-prompt-panel-tab-${tab.key}`}
              className={`ns-prompt-panel__tab${isActive ? " ns-prompt-panel__tab--active" : ""}${flashClass}`}
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
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
        aria-label={`${activeTab} tab content`}
      >
        {children}
      </div>
    </>
  );
}
