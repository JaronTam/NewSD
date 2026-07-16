// Story 1a.12 - PromptPanel 重构为四 tab 容器 (prompt center).
// gov: SDR#1 (4 tabs) / SDR#3 (activeTab priority) / SDR#8 (sessionStorage).
//
// Collapsed: PromptCapsule (4 tab names + ⏏️).
// Expanded: drag handle + header + PromptTabs + tabpanel content area.
// Tab content dispatched by activeTab: alert → message list, others → stubs (T3-T5).
//
// 1a.7 baseline retained: confirm resolve, toast auto-remove, clearResolved,
// resize drag, COLLAPSED_H/EXPANDED_DEFAULT_H.

import { useRef, useState, useSyncExternalStore, useEffect, useMemo } from "react";
import { promptStore, type PromptMessage, type TabKey } from "./promptStore";
import { PromptTabs } from "./PromptTabs";
import { PromptCapsule } from "./PromptCapsule";
import { MilestoneTab } from "./tabs/MilestoneTab";
import { SourceSinkTab, type CloudItem, type TabElement } from "./tabs/SourceSinkTab";
import { StockTab, type StockItem } from "./tabs/StockTab";
import { AlertTab } from "./tabs/AlertTab";
import type { SDElement, Stock } from "../sd/types";

/** Expanded default height = minimap height (styles.css .ns-canvas__minimap). */
const EXPANDED_DEFAULT_H = 150;
/** Collapsed row height (drag floor). */
const COLLAPSED_H = 26;
/** Drag ceiling as % of viewport. */
const MAX_H_VH = 40;

/** SDR#8: sessionStorage key for lastActiveTab persistence. */
const LAST_TAB_KEY = "ns-prompt-panel-last-tab";

export interface PromptPanelProps {
  elements?: readonly SDElement[];
  onRowClick?: (id: string) => void;
  onErrorClick?: (subjectId: string) => void;
}

function readLastTab(): TabKey {
  try {
    const v = sessionStorage.getItem(LAST_TAB_KEY);
    if (v === "alert" || v === "milestone" || v === "sourcesink" || v === "stock") return v;
  } catch {
    // sessionStorage unavailable (e.g. SSR/test) → fall through
  }
  return "alert";
}

function persistLastTab(tab: TabKey) {
  try {
    sessionStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // noop
  }
}

export function PromptPanel({ elements = [], onRowClick, onErrorClick }: PromptPanelProps) {
  const messages = useSyncExternalStore(promptStore.subscribe, promptStore.getSnapshot);
  const unreadAlertCount = useSyncExternalStore(
    promptStore.subscribe,
    promptStore.getUnreadAlertCount,
  );
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(EXPANDED_DEFAULT_H);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // SDR#3: activeTab with sessionStorage-backed lastActiveTab (SDR#8).
  const [activeTab, setActiveTab] = useState<TabKey>(() => readLastTab());
  const [lastActiveTab, setLastActiveTab] = useState<TabKey>(() => readLastTab());

  const hasUnansweredConfirm = messages.some((m) => m.type === "confirm" && !m.resolved);

  // Compute clouds, stocks, and errors for data tabs (T8).
  const clouds = useMemo<CloudItem[]>(
    () =>
      elements
        .filter((e): e is SDElement & { kind: "cloud" } => e.kind === "cloud")
        .map((c) => ({ id: c.id, kind: "cloud" as const, name: c.name })),
    [elements],
  );
  const stocks = useMemo<StockItem[]>(
    () =>
      elements
        .filter((e): e is SDElement & { kind: "stock" } => e.kind === "stock")
        .map((s) => ({
          id: s.id,
          kind: "stock" as const,
          name: s.name,
          currentValue: s.currentValue,
          history: s.history,
        })),
    [elements],
  );
  const tabElements = useMemo<TabElement[]>(
    () =>
      elements.map((e) => {
        if (e.kind === "cloud") return { id: e.id, kind: "cloud" as const, name: e.name };
        if (e.kind === "flow")
          return { id: e.id, kind: "flow" as const, name: e.name, fromId: e.fromId, toId: e.toId };
        return { id: e.id, kind: "stock" as const, name: e.name };
      }),
    [elements],
  );

  // Persist lastActiveTab changes (SDR#8).
  useEffect(() => {
    persistLastTab(lastActiveTab);
  }, [lastActiveTab]);

  // AC-13: while viewing the alert tab, clear the unread badge as new alerts arrive.
  useEffect(() => {
    if (expanded && activeTab === "alert") promptStore.markAlertRead();
  }, [expanded, activeTab, unreadAlertCount]);

  const handleSelectTab = (key: TabKey) => {
    setActiveTab(key);
    setLastActiveTab(key);
    // AC-13: selecting the alert tab marks alerts as read (clears "!" badge).
    if (key === "alert") promptStore.markAlertRead();
  };

  const handleExpand = (targetTab: TabKey) => {
    setActiveTab(targetTab);
    setLastActiveTab(targetTab);
    setExpanded(true);
    // AC-13: expanding to the alert tab marks alerts as read (clears "!" badge).
    if (targetTab === "alert") promptStore.markAlertRead();
  };

  const handleCollapse = () => {
    setExpanded(false);
    // persist lastActiveTab before collapsing (SDR#8).
    persistLastTab(activeTab);
  };

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

  // ── Collapsed: capsule row ──
  if (!expanded) {
    return (
      <div
        data-testid="ns-prompt-panel"
        className={`ns-prompt-panel ns-prompt-panel--collapsed${
          hasUnansweredConfirm ? " ns-prompt-panel--pin" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        <PromptCapsule
          hasUnanswered={hasUnansweredConfirm}
          lastActiveTab={lastActiveTab}
          onExpand={handleExpand}
        />
      </div>
    );
  }

  // ── Expanded: tab bar + content ──

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
          onClick={handleCollapse}
        >
          [⏏]
        </button>
      </div>
      <PromptTabs
        messages={messages}
        activeTab={activeTab}
        onTabChange={handleSelectTab}
        hasUnanswered={hasUnansweredConfirm}
        unreadAlertCount={unreadAlertCount}
      >
        {activeTab === "alert" ? (
          <AlertTab
            messages={messages}
            onResolve={(id, confirmed) => {
              const msg = messages.find((m) => m.id === id);
              msg?.resolve?.(confirmed);
            }}
          />
        ) : activeTab === "milestone" ? (
          <MilestoneTab />
        ) : activeTab === "sourcesink" ? (
          <SourceSinkTab
            clouds={clouds}
            elements={tabElements}
            onRowClick={onRowClick}
            onErrorClick={onErrorClick}
          />
        ) : (
          <StockTab
            stocks={stocks}
            errors={[]}
            onRowClick={onRowClick}
            onErrorClick={onErrorClick}
          />
        )}
      </PromptTabs>
    </div>
  );
}
