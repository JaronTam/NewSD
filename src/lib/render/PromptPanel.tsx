// Story 1a.7 - Prompt center panel (online-game style message log).
//
// Sits above the StatusBar as its own row. Two states:
//  - Collapsed (default): one row showing the latest message. An unanswered
//    confirm is pinned here + highlighted (--ns-err border pulse) so it can't
//    scroll out of view and the user must settle it before the awaiter (e.g.
//    handleNew) proceeds.
//  - Expanded: ~150px (minimap-height) scrollable log; the top edge is a drag
//    handle to resize [single-row, 40vh]; [清空] clears resolved messages only
//    (unanswered confirms are kept).
//
// confirm rows are black-bg/red-text (--ns-err + glow, ns-ascii--err); [确认] /
// [取消] settle the promise. ASCII box style: + - | frame, [] components, <>
// text (cyberpunk shell) - the same mono vocabulary as the boot skeleton.

import { useRef, useState, useSyncExternalStore } from "react";
import { promptStore, type PromptMessage } from "./promptStore";

/** Expanded default height = minimap height (styles.css .ns-canvas__minimap). */
const EXPANDED_DEFAULT_H = 150;
/** Collapsed row height (drag floor). */
const COLLAPSED_H = 26;
/** Drag ceiling as % of viewport. */
const MAX_H_VH = 40;

function tagOf(msg: PromptMessage): string {
  return `[${msg.type}]`;
}

function MessageRow({ msg }: { msg: PromptMessage }) {
  if (msg.type === "confirm") {
    return (
      <div
        className={`ns-prompt-panel__msg${
          msg.resolved ? " ns-prompt-panel__msg--resolved" : " ns-prompt-panel__msg--confirm"
        }`}
      >
        <span className="ns-prompt-panel__tag ns-prompt-panel__tag--confirm">{tagOf(msg)}</span>
        <span className="ns-prompt-panel__text">{msg.text}</span>
        {msg.resolved ? (
          <span className="ns-prompt-panel__result">{msg.result ? "[已确认]" : "[已取消]"}</span>
        ) : (
          <span className="ns-prompt-panel__actions">
            <button
              type="button"
              data-testid="ns-prompt-panel-confirm"
              onClick={() => msg.resolve?.(true)}
            >
              [确认]
            </button>
            <button
              type="button"
              data-testid="ns-prompt-panel-cancel"
              onClick={() => msg.resolve?.(false)}
            >
              [取消]
            </button>
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="ns-prompt-panel__msg">
      <span className="ns-prompt-panel__tag">{tagOf(msg)}</span>
      <span className="ns-prompt-panel__text">{msg.text}</span>
    </div>
  );
}

export function PromptPanel() {
  const messages = useSyncExternalStore(promptStore.subscribe, promptStore.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(EXPANDED_DEFAULT_H);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Unanswered confirm (if any) is pinned to the collapsed row.
  const pinnedConfirm = messages.find((m) => m.type === "confirm" && !m.resolved);
  const latest = messages.length > 0 ? messages[messages.length - 1] : null;

  const beginResize = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: height };
  };
  const moveResize = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY; // drag up = grow
    const maxH = window.innerHeight * (MAX_H_VH / 100);
    const next = Math.max(COLLAPSED_H, Math.min(maxH, dragRef.current.startH + delta));
    setHeight(next);
  };
  const endResize = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  if (!expanded) {
    return (
      <div
        data-testid="ns-prompt-panel"
        className={`ns-prompt-panel ns-prompt-panel--collapsed${
          pinnedConfirm ? " ns-prompt-panel--pin" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {pinnedConfirm ? (
          <>
            <span className="ns-prompt-panel__tag ns-prompt-panel__tag--confirm">[confirm]</span>
            <span className="ns-prompt-panel__text ns-prompt-panel__text--confirm">
              {pinnedConfirm.text}
            </span>
            <span className="ns-prompt-panel__actions">
              <button
                type="button"
                data-testid="ns-prompt-panel-confirm"
                onClick={() => pinnedConfirm.resolve?.(true)}
              >
                [确认]
              </button>
              <button
                type="button"
                data-testid="ns-prompt-panel-cancel"
                onClick={() => pinnedConfirm.resolve?.(false)}
              >
                [取消]
              </button>
            </span>
          </>
        ) : latest ? (
          <>
            <span className="ns-prompt-panel__tag">{tagOf(latest)}</span>
            <span className="ns-prompt-panel__text">{latest.text}</span>
          </>
        ) : (
          <span className="ns-prompt-panel__empty">+ no messages +</span>
        )}
        <button
          type="button"
          data-testid="ns-prompt-panel-toggle"
          className="ns-prompt-panel__btn"
          aria-label="展开提示中心"
          onClick={() => setExpanded(true)}
        >
          [⏏]
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="ns-prompt-panel"
      className="ns-prompt-panel ns-prompt-panel--expanded"
      style={{ height }}
      role="status"
      aria-live="polite"
    >
      <div
        data-testid="ns-prompt-panel-handle"
        className="ns-prompt-panel__handle"
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <div className="ns-prompt-panel__header">
        <span className="ns-prompt-panel__title">+-- [Prompt] --+</span>
        <span className="ns-prompt-panel__count">&lt;{messages.length} msgs&gt;</span>
        <span className="ns-prompt-panel__spacer" />
        <button
          type="button"
          data-testid="ns-prompt-panel-clear"
          className="ns-prompt-panel__btn"
          onClick={() => promptStore.clearResolved()}
        >
          [清空]
        </button>
        <button
          type="button"
          data-testid="ns-prompt-panel-toggle"
          className="ns-prompt-panel__btn"
          aria-label="收起提示中心"
          onClick={() => setExpanded(false)}
        >
          [⏏]
        </button>
      </div>
      <div className="ns-prompt-panel__list">
        {messages.length === 0 ? (
          <div className="ns-prompt-panel__empty">+ no messages +</div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} msg={m} />)
        )}
      </div>
    </div>
  );
}
