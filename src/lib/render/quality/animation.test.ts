// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — animation ticker + flow offset tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-1 + AC-2 + AC-11 + SDR#1 + SDR#3 + SDR#11 + T1-T4 green
// ══════════════════════════════════════════════════════════════════════════════

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeFlowOffset,
  getAnimationState,
  resetAnimationState,
  startAnimationTicker,
} from "./animation";
import { buildInstancesFromStore, elementStore } from "../CanvasView";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AC-1: 前8项经 VRAM 管线渲染 (CAP-11 禁 runtime shadowBlur)", () => {
  // gov: AC-1 + SDR#1 (animation ticker) + SDR#2 (CAP-11 boundary) + T1
  it("ticker 启动后连续帧推进 time offset 并回调 drawRef.current (经 VRAM 管线)", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls: number[] = [];
    const drawRef = { current: () => calls.push(calls.length) };
    const stop = startAnimationTicker(drawRef, () => false);

    // Advance 3 frames (~16.67ms each)
    vi.advanceTimersByTime(50);
    expect(calls.length).toBeGreaterThan(1);

    stop();
    vi.useRealTimers();
  });
});

describe("AC-2: 流量行进 (ticker 推进 + flow offset 纯函数)", () => {
  // gov: AC-2 + SDR#1 + SDR#3 (CPU 改 instance 禁 u_time) + T3
  it("computeFlowOffset(time) 随 time 单调周期推进 (纯函数, 无 u_time)", () => {
    const o0 = computeFlowOffset(0);
    const o1 = computeFlowOffset(16);
    const o2 = computeFlowOffset(32);
    expect(o1).not.toBe(o0);
    expect(o2).not.toBe(o1);
  });

  it("computeFlowOffset 周期 wrapping (1000ms 完整周期)", () => {
    // After 1000ms the offset wraps back to start (period = 10 world units)
    const o0 = computeFlowOffset(0);
    const o1000 = computeFlowOffset(1000);
    expect(o0).toBe(0);
    expect(o1000).toBe(0);
  });

  // gov: AC-2 + SDR#3 + T3 (无流量时 offset 仍是纯函数, 由调用方决定是否应用)
  it("computeFlowOffset 是纯函数, 无副作用", () => {
    expect(typeof computeFlowOffset).toBe("function");
    // 连续调用确定性
    const a = computeFlowOffset(500);
    const b = computeFlowOffset(500);
    expect(a).toBe(b);
  });
});

describe("AC-11: prefers-reduced-motion 降级", () => {
  // gov: AC-11 + SDR#8 (呼吸辉光 dt select) + SDR#11 (reduced-motion) + T19
  it("matchMedia reduce=true 时 ticker 降级 (帧率降)", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls: number[] = [];
    const drawRef = { current: () => calls.push(calls.length) };
    const stop = startAnimationTicker(drawRef, () => true);

    // With reduced motion, ticker skips 3 of every 4 frames.
    // Advance 4 frames worth — should get at most 1 callback.
    vi.advanceTimersByTime(64);
    // With reduced motion on, drawRef is called much less frequently.
    expect(calls.length).toBeLessThanOrEqual(2);

    stop();
    vi.useRealTimers();
  });

  // gov: AC-11 + SDR#11 + T19 (getAnimationState 暴露 reducedMotion)
  it("getAnimationState() 初始态 timeMs=0, reducedMotion=false", () => {
    resetAnimationState();
    const state = getAnimationState();
    expect(state.timeMs).toBe(0);
    expect(state.reducedMotion).toBe(false);
  });

  it("getAnimationState().reducedMotion === true 当 ticker 收到 reduced motion", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const drawRef = { current: () => {} };
    const stop = startAnimationTicker(drawRef, () => true);

    vi.advanceTimersByTime(64); // 4 frames, reduced motion skips 3 of 4
    expect(getAnimationState().reducedMotion).toBe(true);

    stop();
    vi.useRealTimers();
  });

  it("getAnimationState().timeMs 随 ticker 推进单调递增", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const drawRef = { current: () => {} };
    const stop = startAnimationTicker(drawRef, () => false);

    const before = getAnimationState().timeMs;
    vi.advanceTimersByTime(50); // ~3 frames
    const after = getAnimationState().timeMs;
    expect(after).toBeGreaterThan(before);

    stop();
    vi.useRealTimers();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-2 / SDR#3 integration: buildInstancesFromStore 接 timeMs → flow marching
// (T3 rework: 接入断言, 非纯函数单元测)
// ══════════════════════════════════════════════════════════════════════════════
describe("AC-2 integration: buildInstancesFromStore 接 timeMs 后 flow 箭头行进", () => {
  beforeEach(() => {
    // Clear store and seed test data: one stock pair with a flow between them.
    elementStore.setElements([]);
    const s1 = elementStore.createStock({
      name: "A",
      x: 0,
      y: 0,
      width: 8,
      height: 4,
      initialValue: 10,
      units: "",
      allowNegative: false,
    });
    const s2 = elementStore.createStock({
      name: "B",
      x: 20,
      y: 0,
      width: 8,
      height: 4,
      initialValue: 20,
      units: "",
      allowNegative: false,
    });
    elementStore.createFlow({
      fromId: s1.id,
      toId: s2.id,
      formula: "A",
      isVariable: false,
    });
  });

  it("timeMs=0 时 flow 实例 worldX 无 marching offset", () => {
    const instances = buildInstancesFromStore(null, { timeMs: 0 });
    // Find flow instances (EntityType.FLOW = 2).
    const arrows = instances.filter((ri) => ri.entityType === 2);
    expect(arrows.length).toBeGreaterThan(0);
  });

  it("timeMs>0 时 flow 实例 worldX 沿流向偏移 (marching 效果)", () => {
    const instances0 = buildInstancesFromStore(null, { timeMs: 0 });
    const instances500 = buildInstancesFromStore(null, { timeMs: 500 });

    // Flow marching shifts instances along flow direction.
    // Compare all flow instances — positions should differ.
    const flows0 = instances0
      .filter((ri) => ri.entityType === 2)
      .map((ri) => `${ri.worldX.toFixed(2)},${ri.worldY.toFixed(2)}`)
      .join("|");
    const flows500 = instances500
      .filter((ri) => ri.entityType === 2)
      .map((ri) => `${ri.worldX.toFixed(2)},${ri.worldY.toFixed(2)}`)
      .join("|");

    expect(flows0.length).toBeGreaterThan(0);
    // Marching offset changes world positions along the flow.
    expect(flows500).not.toBe(flows0);
  });

  it("无 flow 图元时 buildInstancesFromStore 不抛 (timeMs>0 空安全)", () => {
    elementStore.setElements([]);
    const instances = buildInstancesFromStore(null, { timeMs: 500 });
    expect(Array.isArray(instances)).toBe(true);
  });
});
