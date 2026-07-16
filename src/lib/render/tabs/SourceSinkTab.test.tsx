import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Story 1a.12 RED - SourceSinkTab (「源/汇」tab content).
// gov: SDR#6 (表头) / SDR#7 (classifyCloud) / SDR#9 (orphan badge) / SDR#10 (row+badge click) /
//      AC-4 / AC-6(row) / AC-17(badge).
//
// Red mechanism: tabs/SourceSinkTab.tsx 未建 -> import not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现):
//   SourceSinkTab(props: { clouds: Cloud[]; elements: Element[]; onRowClick?: (id)=>void; onErrorClick?: (subjectId)=>void })
//   classifyCloud(cloud, elements): "source"|"sink"|"both"|"none" (export from SourceSinkTab.tsx, C1 落点).
//   row testid: ns-prompt-sourcesink-row; 仅 out -> 行首 ☁ + class --source; 仅 in -> ◼ + --sink.
//   问题 badge testid: ns-prompt-error-badge (orphan cloud -> badge 文案 孤立).
//   表头 4 列: 名称|连接|流量|问题; 流量列显 - stub; 空态 尚无源/汇.

import { SourceSinkTab, classifyCloud } from "./SourceSinkTab";

type Role = "source" | "sink" | "both" | "none";
interface BaseEl {
  id: string;
  kind: "stock" | "cloud" | "flow";
  name: string;
}
interface Cloud extends BaseEl {
  kind: "cloud";
}
interface Flow extends BaseEl {
  kind: "flow";
  fromId: string;
  toId: string;
}
type Element = BaseEl;

const cloud = (id: string, name = id): Cloud => ({ id, kind: "cloud", name });
const flow = (id: string, fromId: string, toId: string): Flow => ({
  id,
  kind: "flow",
  name: id,
  fromId,
  toId,
});

afterEach(cleanup);

// ---- AC-4: table header + row markers + stubs + empty state ----

describe("SourceSinkTab - AC-4 表头+行标记 (SDR#6/SDR#7)", () => {
  it("renders 4-column header 名称|连接|流量|问题", () => {
    const { container } = render(<SourceSinkTab clouds={[]} elements={[]} />);
    expect(container.textContent).toContain("名称");
    expect(container.textContent).toContain("连接");
    expect(container.textContent).toContain("流量");
    expect(container.textContent).toContain("问题");
  });

  it("empty store -> 尚无源/汇 empty state", () => {
    const { container } = render(<SourceSinkTab clouds={[]} elements={[]} />);
    expect(container.textContent).toContain("尚无源/汇");
  });

  it("C1 (仅 out) row: 行首 ☁ + class --source", () => {
    // c1 has outgoing flow only (c1 -> c2).
    const c1 = cloud("c1");
    const els = [c1, cloud("c2"), flow("f1", "c1", "c2")];
    const { container } = render(<SourceSinkTab clouds={[c1]} elements={els} />);
    const row = container.querySelector("[data-testid='ns-prompt-sourcesink-row']")!;
    expect(row.textContent).toContain("☁");
    expect(row.className).toContain("source");
  });

  it("C2 (仅 in) row: 行首 ◼ + class --sink", () => {
    // c2 has incoming flow only (c1 -> c2).
    const c2 = cloud("c2");
    const els = [cloud("c1"), c2, flow("f1", "c1", "c2")];
    const { container } = render(<SourceSinkTab clouds={[c2]} elements={els} />);
    const row = container.querySelector("[data-testid='ns-prompt-sourcesink-row']")!;
    expect(row.textContent).toContain("◼");
    expect(row.className).toContain("sink");
  });

  it("negative: stock does not appear in source/sink tab", () => {
    const stockEl = { id: "s1", kind: "stock" as const, name: "s1" };
    const { container } = render(<SourceSinkTab clouds={[]} elements={[stockEl]} />);
    expect(container.querySelector("[data-testid='ns-prompt-sourcesink-row']")).toBeNull();
  });

  it("流量 column shows - stub (no flow-rate computed yet)", () => {
    const c1 = cloud("c1");
    const els = [c1, cloud("c2"), flow("f1", "c1", "c2")];
    const { container } = render(<SourceSinkTab clouds={[c1]} elements={els} />);
    const row = container.querySelector("[data-testid='ns-prompt-sourcesink-row']")!;
    expect(row.textContent).toContain("-");
  });
});

// ---- AC-4(d)+AC-12(b): orphan cloud (no flows) -> 孤立 badge ----

describe("SourceSinkTab - AC-12/AC-17 orphan cloud badge (SDR#9)", () => {
  it("orphan cloud (no flows) shows 孤立 error badge", () => {
    const c1 = cloud("c1");
    const { container } = render(<SourceSinkTab clouds={[c1]} elements={[c1]} />);
    const badge = container.querySelector("[data-testid='ns-prompt-error-badge']")!;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("孤立");
  });
});

// ---- AC-6(row): cloud row click -> onRowClick(id) ----

describe("SourceSinkTab - AC-6 行点击 (SDR#10)", () => {
  it("click cloud row -> onRowClick(cloudId)", () => {
    const c1 = cloud("c1");
    const els = [c1, cloud("c2"), flow("f1", "c1", "c2")];
    const onRowClick = vi.fn();
    const { container } = render(
      <SourceSinkTab clouds={[c1]} elements={els} onRowClick={onRowClick} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-sourcesink-row']")!);
    expect(onRowClick).toHaveBeenCalledWith("c1");
  });
});

// ---- AC-17(badge): badge click -> onErrorClick(subjectId) ----

describe("SourceSinkTab - AC-17 badge 点击 (SDR#10)", () => {
  it("click 孤立 badge -> onErrorClick(cloudId)", () => {
    const c1 = cloud("c1");
    const onErrorClick = vi.fn();
    const { container } = render(
      <SourceSinkTab clouds={[c1]} elements={[c1]} onErrorClick={onErrorClick} />,
    );
    fireEvent.click(container.querySelector("[data-testid='ns-prompt-error-badge']")!);
    expect(onErrorClick).toHaveBeenCalledWith("c1");
  });
});

// ---- classifyCloud pure function (SDR#7, 4 组) ----

describe("classifyCloud - SDR#7 4 组矩阵", () => {
  it("仅 out -> source", () => {
    const c1 = cloud("c1");
    const els = [c1, cloud("c2"), flow("f1", "c1", "c2")];
    expect(classifyCloud(c1, els)).toBe("source");
  });

  it("仅 in -> sink", () => {
    const c2 = cloud("c2");
    const els = [cloud("c1"), c2, flow("f1", "c1", "c2")];
    expect(classifyCloud(c2, els)).toBe("sink");
  });

  it("双向 (both in and out) -> both", () => {
    const c1 = cloud("c1");
    const els = [c1, cloud("c2"), cloud("c3"), flow("f1", "c1", "c2"), flow("f2", "c3", "c1")];
    expect(classifyCloud(c1, els)).toBe("both");
  });

  it("均无 (no flows) -> none (orphan)", () => {
    const c1 = cloud("c1");
    expect(classifyCloud(c1, [c1])).toBe("none");
  });
});
