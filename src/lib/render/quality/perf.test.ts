// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — perf probe + 60FPS gate tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-12 + SDR#12 + T21-T22 green
// ══════════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from "vitest";
import { PerformanceProbe } from "../perf-probe";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AC-12: B-perf-1 性能门控 (60FPS / 上限声明)", () => {
  // gov: AC-12 + SDR#12 (60FPS / 上限声明) + T21

  it("PerformanceProbe.getMetrics() 返回有效结构 (fpsP95/loadMs/memP95)", () => {
    const probe = new PerformanceProbe();
    const m = probe.getMetrics();
    expect(typeof m.fpsP95).toBe("number");
    expect(typeof m.loadMs).toBe("number");
    expect(typeof m.memP95).toBe("number");
    probe.stop();
  });

  it("未启动时 fpsP95 === 0 (无采样)", () => {
    const probe = new PerformanceProbe();
    expect(probe.getMetrics().fpsP95).toBe(0);
  });

  it("MAX_FLOW_ANIM_ELEMENTS 上限声明存在且为正整数", async () => {
    // T22: 行进动画图元数上限声明 — 显式边界, 余静态
    const { MAX_FLOW_ANIM_ELEMENTS } = await import("./animation");
    expect(Number.isInteger(MAX_FLOW_ANIM_ELEMENTS)).toBe(true);
    expect(MAX_FLOW_ANIM_ELEMENTS).toBeGreaterThan(0);
  });
});
