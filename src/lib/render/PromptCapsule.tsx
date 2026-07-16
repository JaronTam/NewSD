// Story 1a.12 T6 - Collapsed capsule row for PromptPanel.
// gov: SDR#3 (tab routing on expand) / AC-7 (capsule structure) / AC-8 (flash badge).
//
// Renders a single collapsed row: 4 tab names + ⏏️ toggle.
// Tab names are buttons that route to the correct tab on expand (AC-10).
// "!" tab gets --flash class when there's an unanswered confirm (AC-8).

import type { TabKey } from "./promptStore";
import { TABS, resolveActivateTab } from "./PromptTabs";

export interface PromptCapsuleProps {
  hasUnanswered: boolean;
  lastActiveTab: TabKey | null;
  onExpand: (tab: TabKey) => void;
}

export function PromptCapsule({ hasUnanswered, lastActiveTab, onExpand }: PromptCapsuleProps) {
  return (
    <div data-testid="ns-prompt-panel-capsule" className="ns-prompt-panel--collapsed">
      {TABS.map((tab) => {
        const isAlert = tab.key === "alert";
        const flashClass = isAlert && hasUnanswered ? " ns-prompt-panel__tab--flash" : "";
        return (
          <button
            key={tab.key}
            type="button"
            data-testid={`ns-prompt-panel-tab-${tab.key}`}
            className={`ns-prompt-panel__capsule-tab${flashClass}`}
            aria-label={tab.label}
            onClick={() => onExpand(resolveActivateTab(hasUnanswered, tab.key, lastActiveTab))}
          >
            {tab.label}
          </button>
        );
      })}
      <button
        type="button"
        data-testid="ns-prompt-panel-toggle"
        className="ns-prompt-panel__btn"
        aria-label="展开提示中心"
        onClick={() => onExpand(resolveActivateTab(hasUnanswered, null, lastActiveTab))}
      >
        [⏏]
      </button>
    </div>
  );
}
