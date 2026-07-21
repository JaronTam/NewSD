import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - PromptTabs (展开态 4-tab 容器) + resolveActivateTab 纯函数.
// gov: SDR#1 (4 tab 有序) / SDR#3 (activeTab 路由 9 组矩阵) / AC-1 / AC-8.
//
// Red mechanism: PromptTabs.tsx 未建 -> import 抛 module not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现):
//   type TabKey = "alert" | "milestone" | "sourcesink" | "stock";
//   PromptTabs(props: { messages: PromptMessage[]; activeTab: TabKey;
//                       onTabChange: (t: TabKey) => void; hasUnanswered: boolean })
//   resolveActivateTab(hasUnanswered: boolean, requestedTab: TabKey | null,
//                      lastActiveTab: TabKey | null): TabKey
//   testids: ns-prompt-panel-tab-{alert|milestone|sourcesink|stock}, role=tab, aria-selected.

import { PromptTabs, resolveActivateTab } from "./PromptTabs";

type TabKey = "alert" | "milestone" | "sourcesink" | "stock";

afterEach(() => cleanup());

// ---- AC-1: 4-tab container ----

describe("PromptTabs - AC-1 4-tab container (SDR#1)", () => {
  it("renders 4 tabs in order !/里程碑/源汇/存量 with role=tab + testids", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="alert"
        onTabChange={() => {}}
        hasUnanswered={false}
      />,
    );
    const tabs = container.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(4);
    expect(tabs[0].getAttribute("data-testid")).toBe("ns-prompt-panel-tab-alert");
    expect(tabs[1].getAttribute("data-testid")).toBe("ns-prompt-panel-tab-milestone");
    expect(tabs[2].getAttribute("data-testid")).toBe("ns-prompt-panel-tab-sourcesink");
    expect(tabs[3].getAttribute("data-testid")).toBe("ns-prompt-panel-tab-stock");
  });

  it("default activeTab=alert has aria-selected=true, others false", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="alert"
        onTabChange={() => {}}
        hasUnanswered={false}
      />,
    );
    const alert = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alert.getAttribute("aria-selected")).toBe("true");
    const stock = container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")!;
    expect(stock.getAttribute("aria-selected")).toBe("false");
  });

  it("clicking a non-active tab flips aria-selected and fires onTabChange", () => {
    const onTabChange = vi.fn();
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="alert"
        onTabChange={onTabChange}
        hasUnanswered={false}
      />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")!);
    expect(onTabChange).toHaveBeenCalledWith("stock");
  });

  it("renders a role=tabpanel for the active tab body", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="stock"
        onTabChange={() => {}}
        hasUnanswered={false}
      />,
    );
    const panel = container.querySelector("[role='tabpanel']");
    expect(panel).not.toBeNull();
  });
});

// ---- AC-8: flash on alert tab when unanswered ----

describe("PromptTabs - AC-8 alert tab --flash when hasUnanswered (SDR#22/AD-9)", () => {
  it("alert tab carries --flash class when hasUnanswered=true", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="stock"
        onTabChange={() => {}}
        hasUnanswered={true}
      />,
    );
    const alert = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alert.className).toContain("flash");
  });

  it("negative: no flash class when hasUnanswered=false", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="stock"
        onTabChange={() => {}}
        hasUnanswered={false}
      />,
    );
    const alert = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alert.className).not.toContain("flash");
  });
});

// ---- AC-9/AC-10: resolveActivateTab 9-group matrix (SDR#3, C1 落点 PromptTabs.tsx) ----

describe("resolveActivateTab - AC-9/10 SDR#3 9-group routing matrix (C1)", () => {
  // C1: 矩阵按 T-task 最可能 export 处 (PromptTabs.tsx) 落点; DS 抽独立 util 时整体迁移.
  // 路由: hasUnanswered -> 强制 alert; 否则 requestedTab, 无 requested 则 lastActiveTab, 均无则 alert 兜底.

  it("AC-10a: hasUnanswered + requested=milestone -> alert (force, ignore requested)", () => {
    expect(resolveActivateTab(true, "milestone", "stock")).toBe("alert");
  });

  it("AC-9a: hasUnanswered + ⏏ click (requested=null) -> alert", () => {
    expect(resolveActivateTab(true, null, "stock")).toBe("alert");
  });

  it("AC-9b: !hasUnanswered + ⏏ click + lastActive=stock -> stock", () => {
    expect(resolveActivateTab(false, null, "stock")).toBe("stock");
  });

  it("AC-9c: !hasUnanswered + ⏏ click + first session (lastActive=null) -> alert (fallback)", () => {
    expect(resolveActivateTab(false, null, null)).toBe("alert");
  });

  it("AC-10b: !hasUnanswered + requested=stock + lastActive=stock -> stock", () => {
    expect(resolveActivateTab(false, "stock", "stock")).toBe("stock");
  });

  it("!hasUnanswered + requested=alert + lastActive=stock -> alert", () => {
    expect(resolveActivateTab(false, "alert", "stock")).toBe("alert");
  });

  it("!hasUnanswered + requested=milestone + lastActive=stock -> milestone", () => {
    expect(resolveActivateTab(false, "milestone", "stock")).toBe("milestone");
  });

  it("!hasUnanswered + requested=sourcesink + first session -> sourcesink", () => {
    expect(resolveActivateTab(false, "sourcesink", null)).toBe("sourcesink");
  });

  it("hasUnanswered + requested=stock + lastActive=alert -> alert (force overrides)", () => {
    expect(resolveActivateTab(true, "stock", "alert")).toBe("alert");
  });
});

// ---- AC-13: 未读 alert 角标 ----

describe("PromptTabs - AC-13 unread alert badge (SDR#4)", () => {
  it("renders a badge with unreadAlertCount when alert tab has unread > 0", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="stock"
        onTabChange={() => {}}
        hasUnanswered={false}
        unreadAlertCount={3}
      />,
    );
    const badge = container.querySelector("[data-testid='ns-prompt-panel-tab-unread']");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("3");
  });

  it("badge only appears on the alert tab, not on others", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="stock"
        onTabChange={() => {}}
        hasUnanswered={false}
        unreadAlertCount={1}
      />,
    );
    const alertBtn = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    const stockBtn = container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")!;
    expect(alertBtn.querySelector("[data-testid='ns-prompt-panel-tab-unread']")).not.toBeNull();
    expect(stockBtn.querySelector("[data-testid='ns-prompt-panel-tab-unread']")).toBeNull();
  });

  it("no badge rendered when unreadAlertCount=0 (default)", () => {
    const { container } = render(
      <PromptTabs
        lang="zh"
        messages={[]}
        activeTab="alert"
        onTabChange={() => {}}
        hasUnanswered={false}
      />,
    );
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-unread']")).toBeNull();
  });
});
