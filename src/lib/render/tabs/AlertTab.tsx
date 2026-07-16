// Story 1a.12 T2 - AlertTab (「!」tab content).
// gov: SDR#2 (filterByTab) / SDR#4 (alert double-push) / AC-2 / AC-13.
//
// Extracted from PromptPanel's inline MessageRow rendering.
// Renders alert + confirm messages filtered by filterByTab("alert"),
// excluding info/toast. Confirm rows get [确认]/[取消] buttons.

import type { PromptMessage } from "../promptStore";
import { filterByTab } from "../promptStore";

export interface AlertTabProps {
  messages: readonly PromptMessage[];
  onResolve?: (id: string, confirmed: boolean) => void;
}

function tagOf(msg: PromptMessage): string {
  return `[${msg.type}]`;
}

export function AlertTab({ messages, onResolve }: AlertTabProps) {
  const filtered = messages.filter((m) => filterByTab(m, "alert"));

  if (filtered.length === 0) {
    return <div className="ns-prompt-panel__empty">+ no messages +</div>;
  }

  return (
    <>
      {filtered.map((m) => {
        const isConfirm = m.type === "confirm";
        // AC-2: resolved confirm -> --resolved (gray) + result text, hide action
        // buttons (mirrors 1a.7 MessageRow). Unresolved keeps --confirm +
        // [确认]/[取消]. Tag stays --confirm for confirm rows regardless.
        const resolved = isConfirm && m.resolved === true;
        const rowClass = isConfirm ? (resolved ? "resolved" : "confirm") : "alert";
        const tagClass = isConfirm ? "confirm" : "alert";
        return (
          <div
            key={m.id}
            data-testid="ns-prompt-alert-row"
            className={`ns-prompt-panel__msg ns-prompt-panel__msg--${rowClass}`}
          >
            <span className={`ns-prompt-panel__tag ns-prompt-panel__tag--${tagClass}`}>
              {tagOf(m)}
            </span>
            <span className="ns-prompt-panel__text">{m.text}</span>
            {isConfirm &&
              (resolved ? (
                <span className="ns-prompt-panel__result">
                  {m.result ? "[已确认]" : "[已取消]"}
                </span>
              ) : (
                <span className="ns-prompt-panel__actions">
                  <button
                    type="button"
                    data-testid="ns-prompt-panel-confirm"
                    onClick={() => onResolve?.(m.id, true)}
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    data-testid="ns-prompt-panel-cancel"
                    onClick={() => onResolve?.(m.id, false)}
                  >
                    取消
                  </button>
                </span>
              ))}
          </div>
        );
      })}
    </>
  );
}
