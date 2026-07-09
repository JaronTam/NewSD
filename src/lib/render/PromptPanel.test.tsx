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
    const p = promptStore.confirm("are you sure?");
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-confirm']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-confirm']")!);
    await expect(p).resolves.toBe(true);
  });

  it("confirm resolves false on 取消", async () => {
    const { container } = render(<PromptPanel />);
    const p = promptStore.confirm("are you sure?");
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-cancel']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-cancel']")!);
    await expect(p).resolves.toBe(false);
  });

  it("collapsed state pins an unanswered confirm with --pin highlight", async () => {
    const { container } = render(<PromptPanel />);
    promptStore.info("hello");
    // info alone: no pin, latest shown
    expect(container.querySelector(".ns-prompt-panel--pin")).toBeNull();
    promptStore.confirm("must confirm");
    await waitFor(() => expect(container.querySelector(".ns-prompt-panel--pin")).not.toBeNull());
    // pinned confirm exposes 确认/取消 in the collapsed row
    expect(container.querySelector("[data-testid='ns-prompt-panel-confirm']")).not.toBeNull();
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
    // collapsed pins the first unanswered confirm (= answered)
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

  it("⏏ toggle expands then collapses the panel", async () => {
    const { container } = render(<PromptPanel />);
    // collapsed initially: resize handle absent
    expect(container.querySelector("[data-testid='ns-prompt-panel-handle']")).toBeNull();
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-handle']")).not.toBeNull(),
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    await waitFor(() =>
      expect(container.querySelector("[data-testid='ns-prompt-panel-handle']")).toBeNull(),
    );
  });
});
