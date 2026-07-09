import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toolbar, type ToolbarProps } from "./Toolbar";

// Story 1a.7 T1 — Toolbar unit tests (TDD green phase).
// Covers: AC-1 rendering (6 groups, Chinese labels, aria), AC-2 enable/disable
// matrix, AC-4 tool switching, AC-5 dt selector, AC-6 zoom slider, AC-7 Chinese
// text + unicode symbols.

function props(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    toolMode: "select",
    setToolMode: vi.fn(),
    dt: 0.1,
    setDt: vi.fn(),
    onDelete: vi.fn(),
    onNew: vi.fn(),
    zoomSliderRef: { current: null },
    zoomLabelRef: { current: null },
    onZoomChange: vi.fn(),
    ...overrides,
  };
}

describe("Toolbar — AC-1 rendering (6 groups, Chinese labels, aria)", () => {
  afterEach(() => cleanup());

  it("renders as a <nav> with role='navigation'", () => {
    const { container } = render(<Toolbar {...props()} />);
    const nav = container.querySelector("[data-testid='ns-toolbar']");
    expect(nav).not.toBeNull();
    expect(nav!.tagName).toBe("NAV");
    expect(nav!.getAttribute("role")).toBe("navigation");
  });

  it("has an aria-label of 工具栏", () => {
    const { container } = render(<Toolbar {...props()} />);
    const nav = container.querySelector("[data-testid='ns-toolbar']");
    expect(nav!.getAttribute("aria-label")).toBe("工具栏");
  });

  it("renders all 6 control groups with aria-labels", () => {
    const { container } = render(<Toolbar {...props()} />);
    const groups = ["文件", "编辑", "工具", "模拟控制", "时间步长", "缩放"];
    for (const label of groups) {
      const group = container.querySelector(`[aria-label="${label}"]`);
      expect(group).not.toBeNull();
    }
  });

  it("renders all toolbar buttons with Chinese labels", () => {
    const { container } = render(<Toolbar {...props()} />);
    const expectedLabels = [
      "新建",
      "打开",
      "保存",
      "撤销",
      "重做",
      "复制",
      "粘贴",
      "删除",
      "选择",
      "存量",
      "源汇",
      "流量",
      "暂停",
      "播放",
      "重置",
      "单步",
    ];
    for (const label of expectedLabels) {
      const btn = container.querySelector(`[data-testid='ns-toolbar-btn-${label}']`);
      expect(btn).not.toBeNull();
      expect(btn!.getAttribute("aria-label")).toBe(label);
    }
  });

  it("renders unicode symbols for sim control buttons", () => {
    const { container } = render(<Toolbar {...props()} />);
    expect(container.textContent).toContain("⏸");
    expect(container.textContent).toContain("▶");
    expect(container.textContent).toContain("⏹");
    expect(container.textContent).toContain("⏭");
  });
});

describe("Toolbar — AC-2 enable/disable matrix", () => {
  afterEach(() => cleanup());

  const activeButtons = ["新建", "删除", "选择", "存量", "源汇", "流量"];
  const disabledButtons = [
    "打开",
    "保存",
    "撤销",
    "重做",
    "复制",
    "粘贴",
    "暂停",
    "播放",
    "重置",
    "单步",
  ];

  it("active buttons are enabled", () => {
    const { container } = render(<Toolbar {...props()} />);
    for (const name of activeButtons) {
      const btn = container.querySelector(
        `[data-testid='ns-toolbar-btn-${name}']`,
      ) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.disabled).toBe(false);
    }
  });

  it("disabled buttons have disabled + aria-disabled + tabIndex=-1", () => {
    const { container } = render(<Toolbar {...props()} />);
    for (const name of disabledButtons) {
      const btn = container.querySelector(
        `[data-testid='ns-toolbar-btn-${name}']`,
      ) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute("aria-disabled")).toBe("true");
      expect(btn.tabIndex).toBe(-1);
    }
  });

  it("disabled buttons have title tooltip with reason", () => {
    const { container } = render(<Toolbar {...props()} />);
    const openBtn = container.querySelector("[data-testid='ns-toolbar-btn-打开']")!;
    expect(openBtn.getAttribute("title")).toContain("暂未实现");
  });

  it("disabled buttons have reduced opacity via CSS class", () => {
    const { container } = render(<Toolbar {...props()} />);
    const btn = container.querySelector("[data-testid='ns-toolbar-btn-打开']")!;
    // The ns-toolbar__btn class is present; disabled styling is via :disabled selector
    expect(btn.classList.contains("ns-toolbar__btn")).toBe(true);
    expect(btn.hasAttribute("disabled")).toBe(true);
  });
});

describe("Toolbar — AC-4 tool switching", () => {
  afterEach(() => cleanup());

  it("calls setToolMode with correct mode on button click", () => {
    const setToolMode = vi.fn();
    const { container } = render(<Toolbar {...props({ setToolMode })} />);
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-存量']")!);
    expect(setToolMode).toHaveBeenCalledWith("stock");
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-源汇']")!);
    expect(setToolMode).toHaveBeenCalledWith("cloud");
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-流量']")!);
    expect(setToolMode).toHaveBeenCalledWith("flow");
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-选择']")!);
    expect(setToolMode).toHaveBeenCalledWith("select");
  });

  it("active tool button has aria-pressed='true'", () => {
    const { container } = render(<Toolbar {...props({ toolMode: "stock" })} />);
    const stockBtn = container.querySelector("[data-testid='ns-toolbar-btn-存量']")!;
    expect(stockBtn.getAttribute("aria-pressed")).toBe("true");
    const selectBtn = container.querySelector("[data-testid='ns-toolbar-btn-选择']")!;
    expect(selectBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("active tool button has --active CSS class", () => {
    const { container } = render(<Toolbar {...props({ toolMode: "flow" })} />);
    const flowBtn = container.querySelector("[data-testid='ns-toolbar-btn-流量']")!;
    expect(flowBtn.classList.contains("ns-toolbar__btn--active")).toBe(true);
    const selectBtn = container.querySelector("[data-testid='ns-toolbar-btn-选择']")!;
    expect(selectBtn.classList.contains("ns-toolbar__btn--active")).toBe(false);
  });
});

describe("Toolbar — AC-5 dt selector", () => {
  afterEach(() => cleanup());

  it("renders dt selector with default value 0.1", () => {
    const { container } = render(<Toolbar {...props({ dt: 0.1 })} />);
    const select = container.querySelector(
      "[data-testid='ns-toolbar-dt-select']",
    ) as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe("0.1");
  });

  it("calls setDt on selection change", () => {
    const setDt = vi.fn();
    const { container } = render(<Toolbar {...props({ setDt })} />);
    const select = container.querySelector(
      "[data-testid='ns-toolbar-dt-select']",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "1" } });
    expect(setDt).toHaveBeenCalledWith(1.0);
  });

  it("has 4 dt options", () => {
    const { container } = render(<Toolbar {...props()} />);
    const select = container.querySelector("[data-testid='ns-toolbar-dt-select']")!;
    expect(select.querySelectorAll("option")).toHaveLength(4);
  });
});

describe("Toolbar — AC-6 zoom slider + label", () => {
  afterEach(() => cleanup());

  it("renders zoom slider with range [0.05, 20]", () => {
    const { container } = render(<Toolbar {...props()} />);
    const slider = container.querySelector(
      "[data-testid='ns-toolbar-zoom-slider']",
    ) as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.type).toBe("range");
    expect(Number(slider.min)).toBe(0.05);
    expect(Number(slider.max)).toBe(20);
  });

  it("renders zoom label", () => {
    const { container } = render(<Toolbar {...props()} />);
    const label = container.querySelector("[data-testid='ns-toolbar-zoom-label']");
    expect(label).not.toBeNull();
  });

  it("calls onZoomChange on slider input", () => {
    const onZoomChange = vi.fn();
    const { container } = render(<Toolbar {...props({ onZoomChange })} />);
    const slider = container.querySelector(
      "[data-testid='ns-toolbar-zoom-slider']",
    ) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "8" } });
    expect(onZoomChange).toHaveBeenCalledWith(8);
  });
});

describe("Toolbar — action callbacks", () => {
  afterEach(() => cleanup());

  it("calls onNew when 新建 button clicked", () => {
    const onNew = vi.fn();
    const { container } = render(<Toolbar {...props({ onNew })} />);
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-新建']")!);
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when 删除 button clicked", () => {
    const onDelete = vi.fn();
    const { container } = render(<Toolbar {...props({ onDelete })} />);
    fireEvent.click(container.querySelector("[data-testid='ns-toolbar-btn-删除']")!);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
