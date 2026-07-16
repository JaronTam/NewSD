import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

// Story 1a.12 RED - MilestoneTab (「里程碑」tab content, 纯静态占位).
// gov: SDR#5 / AC-3.
//
// Red mechanism: tabs/MilestoneTab.tsx 未建 -> import not found -> 全文件 fail (import-resolution red, 裁决 A).
//
// 契约 (DS 实现):
//   MilestoneTab() 无 props (纯静态, 无 store 依赖, AC-3c).
//   渲染两栏占位: 「★ 已达成」/「☆ 未达成」.
//   defer 提示文案: `游戏化中心 (Epic 5.4) 接入前占位`.

import { MilestoneTab } from "./MilestoneTab";

afterEach(cleanup);

// ---- AC-3: milestone placeholder skeleton ----

describe("MilestoneTab - AC-3 里程碑占位骨架 (SDR#5, defer 5.4)", () => {
  it("renders both sections ★ 已达成 / ☆ 未达成", () => {
    const { container } = render(<MilestoneTab />);
    expect(container.textContent).toContain("★");
    expect(container.textContent).toContain("已达成");
    expect(container.textContent).toContain("☆");
    expect(container.textContent).toContain("未达成");
  });

  it("renders defer notice text (游戏化中心 Epic 5.4 接入前占位)", () => {
    const { container } = render(<MilestoneTab />);
    expect(container.textContent).toContain("游戏化中心");
    expect(container.textContent).toContain("Epic 5.4");
    expect(container.textContent).toContain("占位");
  });

  it("renders without store dependency (pure static, no props, no crash)", () => {
    // AC-3c: 无 store 依赖. 组件不读 elementStore/promptStore, 纯静态.
    const { container } = render(<MilestoneTab />);
    expect(container).not.toBeNull();
  });
});
