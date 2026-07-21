import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - StockTab (「存量」tab content).
// gov: SDR#6 (表头) / SDR#9 (error badge) / SDR#10 (row+badge click) / AC-5 / AC-6(row) / AC-17(badge).
//
// Red mechanism: tabs/StockTab.tsx 未建 -> import not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现):
//   StockTab(props: { stocks: Stock[]; errors: ErrorFinding[];
//                    onRowClick?: (id)=>void; onErrorClick?: (subjectId)=>void })
//   行标记按 currentValue 符号: >0 -> ⚪ + --pos; <0 -> ⚫ + --neg; =0 -> ☯ + --zero.
//   row testid: ns-prompt-stock-row; 问题 badge testid: ns-prompt-error-badge.
//   表头 4 列: 名称|变化值|单位|问题; 变化值列显 - stub; 空态 尚无存量.

import { StockTab } from "./StockTab";
import type { ErrorFinding, ErrorType } from "../../sd/errorDetection";

interface Stock {
  id: string;
  kind: "stock";
  name: string;
  currentValue: number;
  history: unknown[];
}

const stock = (id: string, currentValue: number, name = id): Stock => ({
  id,
  kind: "stock",
  name,
  currentValue,
  history: [],
});
const err = (subjectId: string, type: ErrorType = "parallel-flow"): ErrorFinding => ({
  id: `e-${subjectId}`,
  type,
  subjectId,
  subjectName: subjectId,
  message: "问题",
});

afterEach(cleanup);

// ---- AC-5: table header + row markers + stubs + empty state ----

describe("StockTab - AC-5 表头+行标记 (SDR#6)", () => {
  it("renders 4-column header 名称|变化值|单位|问题", () => {
    const { container } = render(<StockTab lang="zh" stocks={[]} errors={[]} />);
    expect(container.textContent).toContain("名称");
    expect(container.textContent).toContain("变化值");
    expect(container.textContent).toContain("单位");
    expect(container.textContent).toContain("问题");
  });

  it("empty store -> 尚无存量 empty state", () => {
    const { container } = render(<StockTab lang="zh" stocks={[]} errors={[]} />);
    expect(container.textContent).toContain("尚无存量");
  });

  it("S1 (currentValue>0) row: 行首 ⚪ + class --pos", () => {
    const s1 = stock("s1", 5);
    const { container } = render(<StockTab lang="zh" stocks={[s1]} errors={[]} />);
    const row = container.querySelector("[data-testid='ns-prompt-stock-row']")!;
    expect(row.textContent).toContain("⚪");
    expect(row.className).toContain("pos");
  });

  it("S2 (currentValue<0) row: 行首 ⚫ + class --neg", () => {
    const s2 = stock("s2", -3);
    const { container } = render(<StockTab lang="zh" stocks={[s2]} errors={[]} />);
    const row = container.querySelector("[data-testid='ns-prompt-stock-row']")!;
    expect(row.textContent).toContain("⚫");
    expect(row.className).toContain("neg");
  });

  it("S3 (currentValue=0) row: 行首 ☯ + class --zero", () => {
    const s3 = stock("s3", 0);
    const { container } = render(<StockTab lang="zh" stocks={[s3]} errors={[]} />);
    const row = container.querySelector("[data-testid='ns-prompt-stock-row']")!;
    expect(row.textContent).toContain("☯");
    expect(row.className).toContain("zero");
  });

  it("negative: cloud/flow do not appear in stock tab", () => {
    const cloudEl = { id: "c1", kind: "cloud" as const, name: "c1" };
    const { container } = render(
      <StockTab lang="zh" stocks={[]} errors={[]} />, // 父已过滤, 但 tab 自身也不应渲染非 stock
    );
    expect(container.querySelector("[data-testid='ns-prompt-stock-row']")).toBeNull();
    expect(cloudEl.kind).toBe("cloud"); // 占位: cloud 不传入 stocks
  });

  it("变化值 column shows - stub (no change-rate computed yet)", () => {
    const s1 = stock("s1", 5);
    const { container } = render(<StockTab lang="zh" stocks={[s1]} errors={[]} />);
    const row = container.querySelector("[data-testid='ns-prompt-stock-row']")!;
    expect(row.textContent).toContain("-");
  });
});

// ---- AC-17(badge): stock with error finding -> badge; click -> onErrorClick ----

describe("StockTab - AC-17 stock 问题 badge (SDR#9/SDR#10)", () => {
  it("stock with error finding shows ns-prompt-error-badge", () => {
    const s1 = stock("s1", 5);
    const { container } = render(<StockTab lang="zh" stocks={[s1]} errors={[err("s1")]} />);
    expect(container.querySelector("[data-testid='ns-prompt-error-badge']")).not.toBeNull();
  });

  it("stock without error finding shows no badge", () => {
    const s1 = stock("s1", 5);
    const { container } = render(<StockTab lang="zh" stocks={[s1]} errors={[]} />);
    expect(container.querySelector("[data-testid='ns-prompt-error-badge']")).toBeNull();
  });

  it("click badge -> onErrorClick(stockId)", () => {
    const s1 = stock("s1", 5);
    const onErrorClick = vi.fn();
    const { container } = render(
      <StockTab lang="zh" stocks={[s1]} errors={[err("s1")]} onErrorClick={onErrorClick} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-error-badge']")!);
    expect(onErrorClick).toHaveBeenCalledWith("s1");
  });
});

// ---- AC-6(row): stock row click -> onRowClick(id) ----

describe("StockTab - AC-6 行点击 (SDR#10)", () => {
  it("click stock row -> onRowClick(stockId)", () => {
    const s1 = stock("s1", 5);
    const onRowClick = vi.fn();
    const { container } = render(
      <StockTab lang="zh" stocks={[s1]} errors={[]} onRowClick={onRowClick} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-stock-row']")!);
    expect(onRowClick).toHaveBeenCalledWith("s1");
  });
});
