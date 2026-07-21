import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - AlertTab (「!」tab content).
// gov: SDR#2 (filterByTab) / SDR#4 (alert double-push) / AC-2 / AC-13.
//
// Red mechanism: tabs/AlertTab.tsx 未建 -> import not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现, 与 promptStore.test.ts filterByTab 4x4 矩阵一致):
//   AlertTab(props: { messages: PromptMessage[]; onResolve?: (id: string, confirmed: boolean) => void })
//   filterByTab(msg, "alert") === true 当 type in {alert, confirm}; info/toast === false.
//   alert 行 testid: ns-prompt-alert-row, class --alert, 无按钮.
//   confirm 行 testid: ns-prompt-alert-row, class --confirm, 有 [确认]/[取消] 按钮.

import { AlertTab } from "./AlertTab";

type PromptType = "confirm" | "info" | "toast" | "alert";
interface PromptMessage {
  id: string;
  type: PromptType;
  text: string;
  ts: number;
  resolved?: boolean;
  result?: boolean;
  confirmed?: boolean;
}

const mk = (
  id: string,
  type: PromptType,
  text = "m",
  extra: { resolved?: boolean; result?: boolean } = {},
): PromptMessage => ({ id, type, text, ts: 0, ...extra });

afterEach(cleanup);

// ---- AC-2: alert tab renders alert + confirm; info/toast excluded ----

describe("AlertTab - AC-2 filterByTab 路由 (SDR#2: alert+confirm 入, info/toast 排)", () => {
  it("renders alert AND confirm messages, excludes info/toast", () => {
    const messages = [
      mk("a1", "alert", "异常"),
      mk("c1", "confirm", "确认吗"),
      mk("i1", "info", "信息"),
      mk("t1", "toast", "吐司"),
    ];
    const { container } = render(<AlertTab lang="zh" messages={messages} />);
    const rows = container.querySelectorAll("[data-testid='ns-prompt-alert-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("异常");
    expect(rows[1].textContent).toContain("确认吗");
  });

  it("negative: info/toast types never appear in alert tab", () => {
    const messages = [mk("i1", "info"), mk("t1", "toast")];
    const { container } = render(<AlertTab lang="zh" messages={messages} />);
    expect(container.querySelectorAll("[data-testid='ns-prompt-alert-row']")).toHaveLength(0);
  });

  it("empty: no rows, no crash", () => {
    const { container } = render(<AlertTab lang="zh" messages={[]} />);
    expect(container.querySelectorAll("[data-testid='ns-prompt-alert-row']")).toHaveLength(0);
  });
});

// ---- AC-2: confirm row has --confirm class + [确认]/[取消] buttons; alert row has --alert ----

describe("AlertTab - AC-2 行样式 + 按钮 (SDR#2)", () => {
  it("confirm row carries --confirm class + [确认]/[取消] buttons", () => {
    const messages = [mk("c1", "confirm", "确认吗")];
    const { container, getByText } = render(<AlertTab lang="zh" messages={messages} />);
    const row = container.querySelector("[data-testid='ns-prompt-alert-row']")!;
    expect(row.className).toContain("confirm");
    expect(getByText("确认")).not.toBeNull();
    expect(getByText("取消")).not.toBeNull();
  });

  it("alert row carries --alert class, no resolve buttons", () => {
    const messages = [mk("a1", "alert", "异常")];
    const { container, queryByText } = render(<AlertTab lang="zh" messages={messages} />);
    const row = container.querySelector("[data-testid='ns-prompt-alert-row']")!;
    expect(row.className).toContain("alert");
    expect(queryByText("确认")).toBeNull();
    expect(queryByText("取消")).toBeNull();
  });

  it("[确认] click -> onResolve(id, true)", () => {
    const onResolve = vi.fn();
    const messages = [mk("c1", "confirm", "确认吗")];
    const { getByText } = render(<AlertTab lang="zh" messages={messages} onResolve={onResolve} />);
    fireEvent.click(getByText("确认"));
    expect(onResolve).toHaveBeenCalledWith("c1", true);
  });

  it("[取消] click -> onResolve(id, false)", () => {
    const onResolve = vi.fn();
    const messages = [mk("c1", "confirm", "确认吗")];
    const { getByText } = render(<AlertTab lang="zh" messages={messages} onResolve={onResolve} />);
    fireEvent.click(getByText("取消"));
    expect(onResolve).toHaveBeenCalledWith("c1", false);
  });

  it("resolved confirm -> --resolved + [已确认], hides buttons (AC-2)", () => {
    const messages = [mk("c1", "confirm", "确认吗", { resolved: true, result: true })];
    const { container, queryByTestId } = render(<AlertTab lang="zh" messages={messages} />);
    const row = container.querySelector("[data-testid='ns-prompt-alert-row']")!;
    expect(row.className).toContain("resolved");
    expect(row.textContent).toContain("[已确认]");
    expect(queryByTestId("ns-prompt-panel-confirm")).toBeNull();
    expect(queryByTestId("ns-prompt-panel-cancel")).toBeNull();
  });

  it("resolved cancel -> --resolved + [已取消] (AC-2)", () => {
    const messages = [mk("c2", "confirm", "确认吗", { resolved: true, result: false })];
    const { container } = render(<AlertTab lang="zh" messages={messages} />);
    const row = container.querySelector("[data-testid='ns-prompt-alert-row']")!;
    expect(row.className).toContain("resolved");
    expect(row.textContent).toContain("[已取消]");
  });
});

// ---- AC-13: alert row structure (double-push yields 1 alert row, toast sibling excluded) ----

describe("AlertTab - AC-13 alert 行结构 (SDR#4 double-push)", () => {
  it("alert double-push yields exactly 1 alert row (toast sibling excluded from view)", () => {
    // SDR#4: promptStore.alert() pushes alert + toast. AlertTab only shows the alert.
    const messages = [mk("a1", "alert"), mk("t1", "toast")];
    const { container } = render(<AlertTab lang="zh" messages={messages} />);
    expect(container.querySelectorAll("[data-testid='ns-prompt-alert-row']")).toHaveLength(1);
  });
});
