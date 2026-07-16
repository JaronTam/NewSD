import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - PromptCapsule (收起态单行胶囊).
// gov: SDR#3 (capsule 结构 + 路由) / AC-7 / AC-8 / AC-9 / AC-10 / AC-11.
//
// Red mechanism: PromptCapsule.tsx 未建 -> import 抛 module not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现):
//   PromptCapsule(props: { hasUnanswered: boolean; lastActiveTab: TabKey | null;
//                          onExpand: (tab: TabKey) => void })
//   testids: ns-prompt-panel-capsule; 4 tab-name 按钮复用 ns-prompt-panel-tab-{key};
//            ⏏️ ns-prompt-panel-toggle (aria-label `展开提示中心` 收起态).

import { PromptCapsule } from "./PromptCapsule";

type TabKey = "alert" | "milestone" | "sourcesink" | "stock";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

// ---- AC-7: collapsed capsule structure ----

describe("PromptCapsule - AC-7 收起态单行胶囊 (SDR#3)", () => {
  it("renders capsule with 4 tab-name buttons + ⏏️ toggle, no content body", () => {
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab="stock" onExpand={() => {}} />,
    );
    expect(container.querySelector("[data-testid='ns-prompt-panel-capsule']")).not.toBeNull();
    // 4 tab-name buttons reuse the expanded-state testids.
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-milestone']")).not.toBeNull();
    expect(
      container.querySelector("[data-testid='ns-prompt-panel-tab-sourcesink']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")).not.toBeNull();
    // ⏏️ toggle present.
    expect(container.querySelector("[data-testid='ns-prompt-panel-toggle']")).not.toBeNull();
    // collapsed: no tabpanel body.
    expect(container.querySelector("[role='tabpanel']")).toBeNull();
  });
});

// ---- AC-8: flash on capsule ! button when unanswered ----

describe("PromptCapsule - AC-8 胶囊 ! 按钮 --flash (SDR#22/AD-9)", () => {
  it("! button carries --flash class when hasUnanswered=true", () => {
    const { container } = render(
      <PromptCapsule hasUnanswered={true} lastActiveTab="stock" onExpand={() => {}} />,
    );
    const alert = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alert.className).toContain("flash");
  });

  it("negative: no flash when hasUnanswered=false", () => {
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab="stock" onExpand={() => {}} />,
    );
    const alert = container.querySelector("[data-testid='ns-prompt-panel-tab-alert']")!;
    expect(alert.className).not.toContain("flash");
  });
});

// ---- AC-9: ⏏️ click expand routing ----

describe("PromptCapsule - AC-9 ⏏️ 展开路由 (SDR#3)", () => {
  it("hasUnanswered + ⏏️ click -> onExpand(alert) (force)", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <PromptCapsule hasUnanswered={true} lastActiveTab="stock" onExpand={onExpand} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    expect(onExpand).toHaveBeenCalledWith("alert");
  });

  it("!hasUnanswered + lastActive=stock + ⏏️ click -> onExpand(stock)", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab="stock" onExpand={onExpand} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    expect(onExpand).toHaveBeenCalledWith("stock");
  });

  it("!hasUnanswered + first session (lastActive=null) + ⏏️ click -> onExpand(alert) fallback", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab={null} onExpand={onExpand} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-toggle']")!);
    expect(onExpand).toHaveBeenCalledWith("alert");
  });
});

// ---- AC-10: tab-name click expand routing ----

describe("PromptCapsule - AC-10 tab 名展开路由 (SDR#3)", () => {
  it("hasUnanswered + click 里程碑 tab name -> onExpand(alert) (force, ignore clicked)", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <PromptCapsule hasUnanswered={true} lastActiveTab="stock" onExpand={onExpand} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-tab-milestone']")!);
    expect(onExpand).toHaveBeenCalledWith("alert");
  });

  it("!hasUnanswered + click 存量 tab name -> onExpand(stock)", () => {
    const onExpand = vi.fn();
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab="alert" onExpand={onExpand} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-panel-tab-stock']")!);
    expect(onExpand).toHaveBeenCalledWith("stock");
  });
});

// ---- AC-11: ⏏️ toggle label + expand (persist is parent-level; see PromptPanel integration) ----

describe("PromptCapsule - AC-11 ⏏️ toggle label", () => {
  it("⏏️ toggle has aria-label `展开提示中心` in collapsed state", () => {
    const { container } = render(
      <PromptCapsule hasUnanswered={false} lastActiveTab="stock" onExpand={() => {}} />,
    );
    const toggle = container.querySelector("[data-testid='ns-prompt-panel-toggle']")!;
    expect(toggle.getAttribute("aria-label")).toBe("展开提示中心");
  });
});
