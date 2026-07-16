import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ErrorFinding, ErrorType } from "../sd/errorDetection";
import { StatusBar, type StatusBarProps } from "./StatusBar";

// Story 1a.7 T2 — StatusBar unit tests (TDD green phase).
// Covers: AC-8 rendering (7 fields, semantic roles, aria-live), AC-9
// placeholder matrix (static fields correct, live fields expose refs).

function props(overrides: Partial<StatusBarProps> = {}): StatusBarProps {
  return {
    elementCountRef: { current: null },
    fpsRef: { current: null },
    ...overrides,
  };
}

describe("StatusBar — AC-8 rendering (7 fields, semantic roles)", () => {
  afterEach(() => cleanup());

  it("renders as a <footer> with role='contentinfo'", () => {
    const { container } = render(<StatusBar {...props()} />);
    const footer = container.querySelector("[data-testid='ns-statusbar']");
    expect(footer).not.toBeNull();
    expect(footer!.tagName).toBe("FOOTER");
    expect(footer!.getAttribute("role")).toBe("contentinfo");
  });

  it("has aria-label 状态栏", () => {
    const { container } = render(<StatusBar {...props()} />);
    const footer = container.querySelector("[data-testid='ns-statusbar']")!;
    expect(footer.getAttribute("aria-label")).toBe("状态栏");
  });

  it("scopes aria-live='polite' to the element-count field (not the whole footer)", () => {
    const { container } = render(<StatusBar {...props()} />);
    const footer = container.querySelector("[data-testid='ns-statusbar']")!;
    // Not on the container: the per-frame FPS span would flood screen readers.
    expect(footer.getAttribute("aria-live")).toBeNull();
    const countField = container.querySelector("[data-testid='ns-statusbar-element-count']")!;
    expect(countField.getAttribute("aria-live")).toBe("polite");
  });

  it("renders all 7 fields with data-testid", () => {
    const { container } = render(<StatusBar {...props()} />);
    const fields = [
      "ns-statusbar-模拟时间",
      "ns-statusbar-element-count",
      "ns-statusbar-在线用户数",
      "ns-statusbar-头像堆栈",
      "ns-statusbar-fps",
      "ns-statusbar-连接状态",
      "ns-statusbar-量纲概要",
    ];
    for (const testid of fields) {
      expect(container.querySelector(`[data-testid='${testid}']`)).not.toBeNull();
    }
  });

  it("each field has an aria-label", () => {
    const { container } = render(<StatusBar {...props()} />);
    const labels = [
      "模拟时间",
      "图元计数",
      "在线用户数",
      "头像堆栈",
      "FPS",
      "连接状态",
      "量纲概要",
    ];
    for (const label of labels) {
      expect(container.querySelector(`[aria-label='${label}']`)).not.toBeNull();
    }
  });
});

describe("StatusBar — AC-9 placeholder values (1a single-user)", () => {
  afterEach(() => cleanup());

  it("shows sim time placeholder 0.00s", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-模拟时间']")!;
    expect(el.textContent).toContain("0.00s");
  });

  it("shows online count placeholder 1", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-在线用户数']")!;
    expect(el.textContent).toContain("1");
  });

  it("shows avatar placeholder ☺", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-头像堆栈']")!;
    expect(el.textContent).toContain("☺");
  });

  it("shows FPS field with '-' fallback initially", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-fps']")!;
    expect(el.textContent).toContain("-");
  });

  it("shows connection placeholder 本地", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-连接状态']")!;
    expect(el.textContent).toContain("本地");
  });

  it("量纲概要 slot is hidden (display:none)", () => {
    const { container } = render(<StatusBar {...props()} />);
    const el = container.querySelector("[data-testid='ns-statusbar-量纲概要']") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.display).toBe("none");
  });
});

describe("StatusBar — live field refs", () => {
  afterEach(() => cleanup());

  it("attaches elementCountRef to the count span", () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(<StatusBar {...props({ elementCountRef: ref })} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe("SPAN");
  });

  it("attaches fpsRef to the FPS value span", () => {
    const ref = { current: null as HTMLSpanElement | null };
    render(<StatusBar {...props({ fpsRef: ref })} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe("SPAN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Story 1a.12 StatusBar ⚠N warnings slot + popover - RED scaffolds
// gov: SDR#9 (error findings) / SDR#10 (popover click) / SDR#21 (display:none) /
//      AC-12 (⚠N hidden when 0, shown with count) / AC-16 (popover listbox + item click).
// Red: StatusBar.tsx 未增 ⚠N 字段 -> ns-statusbar-warnings 不存在 -> 断言 fail.
// 契约: props 增 warnings?: ErrorFinding[] + onErrorClick?: (subjectId)=>void.
//   ⚠N testid ns-statusbar-warnings (N=0 display:none / N>0 显 ⚠N);
//   popover role=listbox, 项 testid ns-statusbar-warning-item; click -> onErrorClick(subjectId).
// ═══════════════════════════════════════════════════════════════════════════

const wf = (
  subjectId: string,
  type: ErrorType = "orphan-cloud",
  subjectName = subjectId,
): ErrorFinding => ({
  id: `e-${subjectId}`,
  type,
  subjectId,
  subjectName,
  message: "问题描述",
});

describe("StatusBar - 1a.12 RED ⚠N warnings + popover (AC-12/AC-16)", () => {
  afterEach(() => cleanup());

  it("AC-12: ⚠N field hidden (display:none) when no warnings", () => {
    const { container } = render(<StatusBar {...props()} {...({ warnings: [] } as any)} />);
    const w = container.querySelector("[data-testid='ns-statusbar-warnings']") as HTMLElement;
    expect(w).not.toBeNull();
    expect(w.style.display).toBe("none");
  });

  it("AC-12: ⚠N field visible with count when warnings>0", () => {
    const ws = [wf("c1"), wf("c2")];
    const { container } = render(<StatusBar {...props()} {...({ warnings: ws } as any)} />);
    const w = container.querySelector("[data-testid='ns-statusbar-warnings']") as HTMLElement;
    expect(w).not.toBeNull();
    expect(w.style.display).not.toBe("none");
    expect(w.textContent).toContain("2");
  });

  it("AC-16: click ⚠N opens popover (role=listbox) listing warnings", () => {
    const ws = [wf("c1", "orphan-cloud", "云1"), wf("f1", "dangling-flow-endpoint", "流1")];
    const { container } = render(<StatusBar {...props()} {...({ warnings: ws } as any)} />);
    fireEvent.click(container.querySelector("[data-testid='ns-statusbar-warnings']")!);
    const listbox = container.querySelector("[role='listbox']");
    expect(listbox).not.toBeNull();
    const items = container.querySelectorAll("[data-testid='ns-statusbar-warning-item']");
    expect(items).toHaveLength(2);
    expect(listbox!.textContent).toContain("云1");
    expect(listbox!.textContent).toContain("流1");
  });

  it("AC-16: click popover item -> onErrorClick(subjectId)", () => {
    const ws = [wf("c1", "orphan-cloud", "云1")];
    const onErrorClick = vi.fn();
    const { container } = render(
      <StatusBar {...props()} {...({ warnings: ws, onErrorClick } as any)} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-statusbar-warnings']")!);
    fireEvent.click(container.querySelector("[data-testid='ns-statusbar-warning-item']")!);
    expect(onErrorClick).toHaveBeenCalledWith("c1");
  });
});
