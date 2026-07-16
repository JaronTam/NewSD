import { render, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PromptPanel } from "./PromptPanel";
import { promptStore, MAX_MESSAGES, TOAST_MS } from "./promptStore";

// Story 1a.7 - Prompt center (online-game style message log). The panel subscribes
// to the singleton promptStore via useSyncExternalStore; these tests drive the store
// imperatively and assert the React render + async confirm contract.

describe("PromptPanel – prompt center (Story 1a.7)", () => {
  afterEach(() => {
    cleanup();
    promptStore.reset();
    vi.useRealTimers();
  });

  it("confirm resolves true on 确认", async () => {
    const { container } = render(<PromptPanel />);
    // Expand to see confirm button in the "!" tab
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    const p = promptStore.confirm("are you sure?");
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-confirm']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-confirm']")!);
    await expect(p).resolves.toBe(true);
  });

  it("confirm resolves false on 取消", async () => {
    const { container } = render(<PromptPanel />);
    // Expand to see cancel button in the "!" tab
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    const p = promptStore.confirm("are you sure?");
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-cancel']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-cancel']")!);
    await expect(p).resolves.toBe(false);
  });

  it("collapsed capsule shows --pin when unanswered confirm exists, --flash on ! tab", async () => {
    const { container } = render(<PromptPanel />);
    promptStore.info("hello");
    // info alone: no pin
    expect(container.querySelector(".ns-prompt-panel--pin")).toBeNull();
    promptStore.confirm("must confirm");
    await waitFor(() => expect(container.querySelector(".ns-prompt-panel--pin")).not.toBeNull());
    // 1a.12: collapsed capsule shows tab names, NOT inline confirm/cancel buttons.
    // Flash class on "!" tab indicates unanswered confirm.
    const alertTab = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alertTab.className).toContain("ns-prompt-panel__tab--flash");
    // Confirm/cancel buttons NOT in collapsed view (they're in the expanded "!" tab).
    expect(container.querySelector("[data-testid='ns-prompt-panel-confirm']")).toBeNull();
  });

  it("toast auto-removes after TOAST_MS", () => {
    vi.useFakeTimers();
    render(<PromptPanel />);
    promptStore.toast("flash");
    expect(promptStore.getMessages()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(TOAST_MS);
    });
    expect(promptStore.getMessages()).toHaveLength(0);
  });

  it("clearResolved removes resolved confirms but keeps unanswered", async () => {
    const { container } = render(<PromptPanel />);
    const answered = promptStore.confirm("answered");
    promptStore.confirm("unanswered");
    // Expand to see confirm/cancel buttons in the "!" tab
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-confirm']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-confirm']")!);
    await expect(answered).resolves.toBe(true);

    promptStore.clearResolved();
    const msgs = promptStore.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("unanswered");
    expect(msgs[0].resolved).toBeFalsy();
  });

  it("caps messages at MAX_MESSAGES, dropping oldest non-confirm", () => {
    render(<PromptPanel />);
    for (let i = 0; i < MAX_MESSAGES + 2; i++) {
      promptStore.info(`msg-${i}`);
    }
    expect(promptStore.getMessages()).toHaveLength(MAX_MESSAGES);
    // oldest two (msg-0, msg-1) dropped; first surviving is msg-2
    expect(promptStore.getMessages()[0].text).toBe("msg-2");
  });

  // T10 rewrite (1a.12 RED): collapsed = 4-tab capsule; expanded = tabpanel + 4 role=tab.
  // baseline 单行假设已废, 改 4-tab+capsule 结构断言 -> 改写即红 (PromptPanel.tsx 未重构).
  it("⏏ toggle: collapsed capsule <-> expanded 4-tab panel (1a.12 RED)", async () => {
    const { container } = render(<PromptPanel />);
    // collapsed: capsule present (ns-prompt-panel-capsule), no tabpanel body.
    expect(container.querySelector("[data-testid='ns-prompt-panel-capsule']")).not.toBeNull();
    expect(container.querySelector("[role='tabpanel']")).toBeNull();
    // expand
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).not.toBeNull());
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-milestone']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-prompt-panel-tab-sourcesink']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")).not.toBeNull();
    // collapse
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).toBeNull());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Story 1a.12 PromptPanel 4-tab 重构 - RED integration scaffolds
// gov: SDR#1 (4 tabs) / SDR#3 (capsule+expand) / SDR#8 (persist) / SDR#21 (scroll) /
//      AC-1 (integration smoke) / AC-11 (expanded toggle label) / AC-15 (scroll container).
// Red: PromptPanel.tsx 未重构 -> capsule/4-tab/scroll 结构均未建 -> 断言 fail.
// 1a.7 回归 (confirm T/F / pin / toast / clearResolved / cap-MAX_MESSAGES) 保留上方绿.
// ═══════════════════════════════════════════════════════════════════════════

describe("PromptPanel - 1a.12 RED 4-tab integration (T10)", () => {
  afterEach(() => {
    cleanup();
    promptStore.reset();
    vi.useRealTimers();
  });

  it("AC-1 integration: expanded panel renders 4 tabs in order + role=tab", async () => {
    const { container } = render(<PromptPanel />);
    // collapsed capsule anchor (instant red until DS builds capsule).
    expect(container.querySelector("[data-testid='ns-prompt-panel-capsule']")).not.toBeNull();
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).not.toBeNull());
    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs.length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-milestone']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-prompt-panel-tab-sourcesink']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")).not.toBeNull();
  });

  it("AC-11: expanded toggle aria-label = 收起提示中心", async () => {
    const { container } = render(<PromptPanel />);
    expect(container.querySelector("[data-testid='ns-prompt-panel-capsule']")).not.toBeNull();
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).not.toBeNull());
    const toggle = container.querySelector("[data-testid='ns-prompt-panel-toggle']")!;
    expect(toggle.getAttribute("aria-label")).toBe("收起提示中心");
  });

  it("AC-15: expanded tab content body has scroll container class (ns-prompt-panel__list has overflow-y:auto in CSS)", async () => {
    const { container } = render(<PromptPanel />);
    expect(container.querySelector("[data-testid='ns-prompt-panel-capsule']")).not.toBeNull();
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).not.toBeNull());
    const panel = container.querySelector("[role='tabpanel']") as HTMLElement;
    // jsdom doesn't load CSS, so getComputedStyle returns defaults.
    // Verify the element has the class that carries overflow-y: auto in styles.css.
    expect(panel.className).toContain("ns-prompt-panel__list");
  });
});

// ---- AC-13: 未读 alert 角标 (SDR#4) ----

describe("PromptPanel - AC-13 unread alert badge (SDR#4)", () => {
  afterEach(() => {
    cleanup();
    promptStore.reset();
    vi.useRealTimers();
  });

  it("collapsed: alert() bumps unread count; capsule has no badge (badge only on expanded tab)", () => {
    const { container } = render(<PromptPanel />);
    act(() => {
      promptStore.alert("告警1");
      promptStore.alert("告警2");
    });
    expect(promptStore.getUnreadAlertCount()).toBe(2);
    // collapsed capsule renders tab buttons but no unread badge span.
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-unread']")).toBeNull();
  });

  it("expand to alert tab clears the badge (handleExpand markAlertRead + effect)", async () => {
    const { container } = render(<PromptPanel />);
    act(() => {
      promptStore.alert("告警1");
      promptStore.alert("告警2");
    });
    expect(promptStore.getUnreadAlertCount()).toBe(2);
    // expand via collapsed toggle (resolveActivateTab fallback -> alert) -> markAlertRead.
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() => expect(container.querySelector("[role='tabpanel']")).not.toBeNull());
    await waitFor(() => expect(promptStore.getUnreadAlertCount()).toBe(0));
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-unread']")).toBeNull();
  });
});
