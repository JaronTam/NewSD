// Story 1a.9 T0 - ATDD red-phase scaffold (i18n runtime switch + AC-10 guard).
// gov: AC-5 (Toolbar i18n) / AC-10 (testid NOT localised - invariant on switch).
//
// RED PHASE: all tests it.skip() - dormant until DS (T5..T8) wires components
// to langStore. Toolbar EXISTS (brownfield) - real import + props() factory
// (mirrors Toolbar.test.tsx). langStore is NEW - ambient declares the symbols
// needed to drive the switch (setLang). When DS creates langStore, swap the
// declare block for `import { setLang } from "../sd/langStore"`.
//
// Scope: this scaffold covers the SWITCH MECHANISM (Toolbar) + the cross-cutting
// AC-10 testid invariant. Per-component bilingual text for AC-6/7/8/9
// (PropertyPanel / StatusBar / CanvasView / PromptPanel / PromptTabs /
// PromptCapsule / tabs x4 / AtMentionAutocomplete) is added by DS to the
// EXISTING component tests per story tasks T5-T8 (lang=zh fixture Q4=A + new en
// cases). AC-10 name/formula/ASCII guards are likewise carried by those existing
// en-case additions (assert user-entered name + ASCII formula unchanged).

import { act, render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { langStore } from "../sd/langStore";
import { Toolbar, type ToolbarProps } from "./Toolbar";
import { StockTab } from "./tabs/StockTab";
import { SourceSinkTab } from "./tabs/SourceSinkTab";
import { MilestoneTab } from "./tabs/MilestoneTab";

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

describe("i18n switch - AC-5: Toolbar aria-label reflects langStore lang", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("default (zh): 新建 button aria-label is '新建'", () => {
    // gov: AC-5 + SDR#6 + T5.1. Green-ready sanity. F1-A: pin zh (jsdom init en).
    langStore.setLang("zh");
    const { container } = render(<Toolbar {...props()} />);
    const btn = container.querySelector('[data-testid="ns-toolbar-btn-新建"]') as Element;
    expect(btn.getAttribute("aria-label")).toBe("新建");
  });

  it("setLang('en'): 新建 button aria-label switches to 'New'", () => {
    // gov: AC-2 + AC-5 + SDR#6 + T5.1. RED: Toolbar ignores langStore until DS wires it. F1-A: start from zh.
    langStore.setLang("zh");
    const { container } = render(<Toolbar {...props()} />);
    act(() => {
      langStore.setLang("en");
    });
    const btn = container.querySelector('[data-testid="ns-toolbar-btn-新建"]') as Element;
    expect(btn.getAttribute("aria-label")).toBe("New");
  });
});

describe("i18n switch - AC-10: testids are NOT localised", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("Toolbar button testids survive a lang switch", () => {
    // gov: AC-5 + AC-10 + SDR#6 + T5.1. Guard: testid set stable across switch.
    const { container } = render(<Toolbar {...props()} />);
    const before = Array.from(container.querySelectorAll('[data-testid^="ns-toolbar-btn-"]')).map(
      (e) => e.getAttribute("data-testid"),
    );
    act(() => {
      langStore.setLang("en");
    });
    const after = Array.from(container.querySelectorAll('[data-testid^="ns-toolbar-btn-"]')).map(
      (e) => e.getAttribute("data-testid"),
    );
    expect(after).toEqual(before);
  });

  // AC-10(c): ASCII 字符画不变 — row markers (⚪⚫☯ / ☁◼ / ★☆) + sim controls (⏸▶⏹⏭)
  it("StockTab row markers ⚪⚫☯ survive lang switch", () => {
    const stocks = [
      { id: "s1", kind: "stock" as const, name: "s1", currentValue: 5, history: [] },
      { id: "s2", kind: "stock" as const, name: "s2", currentValue: -3, history: [] },
      { id: "s3", kind: "stock" as const, name: "s3", currentValue: 0, history: [] },
    ];
    const { container } = render(<StockTab lang="zh" stocks={stocks} errors={[]} />);
    expect(container.textContent).toContain("⚪");
    expect(container.textContent).toContain("⚫");
    expect(container.textContent).toContain("☯");
    act(() => {
      langStore.setLang("en");
    });
    expect(container.textContent).toContain("⚪");
    expect(container.textContent).toContain("⚫");
    expect(container.textContent).toContain("☯");
  });

  it("SourceSinkTab row markers ☁◼ survive lang switch", () => {
    const c1 = { id: "c1", kind: "cloud" as const, name: "c1" };
    const c2 = { id: "c2", kind: "cloud" as const, name: "c2" };
    const els = [c1, c2, { id: "f1", kind: "flow" as const, name: "f1", fromId: "c1", toId: "c2" }];
    const { container } = render(<SourceSinkTab lang="zh" clouds={[c1]} elements={els} />);
    expect(container.textContent).toContain("☁");
    act(() => {
      langStore.setLang("en");
    });
    expect(container.textContent).toContain("☁");
  });

  it("MilestoneTab markers ★☆ survive lang switch", () => {
    const { container } = render(<MilestoneTab lang="zh" />);
    expect(container.textContent).toContain("★");
    expect(container.textContent).toContain("☆");
    act(() => {
      langStore.setLang("en");
    });
    expect(container.textContent).toContain("★");
    expect(container.textContent).toContain("☆");
  });

  it("Toolbar sim controls ⏸▶⏹⏭ survive lang switch", () => {
    const { container } = render(<Toolbar {...props()} />);
    expect(container.textContent).toContain("⏸");
    expect(container.textContent).toContain("▶");
    expect(container.textContent).toContain("⏹");
    expect(container.textContent).toContain("⏭");
    act(() => {
      langStore.setLang("en");
    });
    expect(container.textContent).toContain("⏸");
    expect(container.textContent).toContain("▶");
    expect(container.textContent).toContain("⏹");
    expect(container.textContent).toContain("⏭");
  });

  // AC-10(a): 图元 name 不受 i18n 影响
  it("stock name unchanged after lang switch (user name not i18n)", () => {
    const stocks = [
      { id: "s1", kind: "stock" as const, name: "我的存量", currentValue: 5, history: [] },
    ];
    const { container } = render(<StockTab lang="zh" stocks={stocks} errors={[]} />);
    expect(container.textContent).toContain("我的存量");
    act(() => {
      langStore.setLang("en");
    });
    // Name must stay the same — user-entered names are NOT translated
    expect(container.textContent).toContain("我的存量");
  });

  it("cloud name unchanged after lang switch (default prefix stock_/cloud_/flow_ not i18n)", () => {
    const c1 = { id: "c1", kind: "cloud" as const, name: "cloud_1" };
    const { container } = render(<SourceSinkTab lang="zh" clouds={[c1]} elements={[c1]} />);
    expect(container.textContent).toContain("cloud_1");
    act(() => {
      langStore.setLang("en");
    });
    expect(container.textContent).toContain("cloud_1");
  });
});
