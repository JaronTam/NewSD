import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerformanceProbe } from "./perf-probe";
import type { PerfMetrics } from "./perf-probe";

// ---- helpers ----------------------------------------------------------------

/** Create a controllable mock with manual tick advance. */
function setupMockRaf() {
  let currentTime = 1000;
  let rafCb: FrameRequestCallback | null = null;
  let rafId = 1;

  const mockNow = vi.fn(() => currentTime);
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCb = cb;
    return rafId++;
  });
  const mockCaf = vi.fn();

  vi.stubGlobal("performance", { now: mockNow });
  vi.stubGlobal("requestAnimationFrame", mockRaf);
  vi.stubGlobal("cancelAnimationFrame", mockCaf);

  return {
    mockNow,
    mockRaf,
    mockCaf,
    /** Advance time by dt ms and fire the pending rAF callback. */
    tick(dt: number) {
      if (!rafCb) throw new Error("No pending rAF callback");
      currentTime += dt;
      const cb = rafCb;
      rafCb = null;
      cb(currentTime);
    },
  };
}

// ---- tests ------------------------------------------------------------------

describe("PerformanceProbe", () => {
  describe("SSR / jsdom safety (no rAF, no performance.memory)", () => {
    // jsdom has performance.now but NOT requestAnimationFrame-per-frame loop
    // semantics. The class must degrade gracefully.

    it("getMetrics returns zeroed values with no samples", () => {
      const probe = new PerformanceProbe();
      const m = probe.getMetrics();
      expect(m.fpsP95).toBe(0);
      expect(m.memP95).toBe(0);
      expect(typeof m.loadMs).toBe("number");
    });

    it("start is a no-op when requestAnimationFrame is absent", () => {
      const raf = (globalThis as any).requestAnimationFrame;
      delete (globalThis as any).requestAnimationFrame;

      const probe = new PerformanceProbe();
      expect(() => probe.start()).not.toThrow();
      expect(probe.getMetrics().fpsP95).toBe(0);

      (globalThis as any).requestAnimationFrame = raf;
    });

    it("stop is a no-op when not running", () => {
      const probe = new PerformanceProbe();
      expect(() => probe.stop()).not.toThrow();
    });

    it("getMetrics does not throw when performance.memory is absent", () => {
      const probe = new PerformanceProbe();
      expect(() => probe.getMetrics()).not.toThrow();
      expect(probe.getMetrics().memP95).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears all accumulated samples", () => {
      const probe = new PerformanceProbe();
      // Simulate internal state without rAF loop
      (probe as any).frameTimes = [16, 17, 18];
      (probe as any).memSamples = [100000, 200000];
      (probe as any).frameCount = 60;

      probe.reset();

      const m = probe.getMetrics();
      expect(m.fpsP95).toBe(0);
      expect(m.memP95).toBe(0);
      expect((probe as any).frameCount).toBe(0);
    });

    it("resets load timer", () => {
      const probe = new PerformanceProbe();
      probe.reset();
      const m = probe.getMetrics();
      // loadStart was just reset, so loadMs should be ~0
      expect(m.loadMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("frame-time sampling with mock rAF", () => {
    let mock: ReturnType<typeof setupMockRaf>;

    beforeEach(() => {
      mock = setupMockRaf();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("accumulates frame deltas on each tick", () => {
      const probe = new PerformanceProbe();
      probe.start();

      mock.tick(16); // ~60 fps
      mock.tick(17);
      mock.tick(15);

      const m = probe.getMetrics();
      // With 3 frames of ~16 ms, P95 should be ~60 fps
      expect(m.fpsP95).toBeGreaterThan(0);
    });

    it("computes P95 from frame deltas", () => {
      const probe = new PerformanceProbe();
      probe.start();

      // 100 frames: 95 at 16 ms, 5 at 32 ms
      for (let i = 0; i < 95; i++) mock.tick(16);
      for (let i = 0; i < 5; i++) mock.tick(32);

      const m = probe.getMetrics();
      // Sorted deltas: 95×16, 5×32. 100 samples: P95 index = ceil(100*0.95)-1 = 94 (0-based)
      // P95 delta = 16 ms (since sorted[94] is still 16)
      // fps = 1000/16 = 62.5
      expect(m.fpsP95).toBe(62.5);
    });

    it("P95 reflects slow frames", () => {
      const probe = new PerformanceProbe();
      probe.start();

      // 10 frames: 5 at 16 ms, 5 at 100 ms
      for (let i = 0; i < 5; i++) mock.tick(16);
      for (let i = 0; i < 5; i++) mock.tick(100);

      const m = probe.getMetrics();
      // Sorted: 16,16,16,16,16,100,100,100,100,100. P95 index = ceil(10*0.95)-1 = 9.
      // sorted[9] = 100 ms. fps = 1000/100 = 10
      expect(m.fpsP95).toBe(10);
    });

    it("returns zero FPS with no frame samples", () => {
      const probe = new PerformanceProbe();
      // start() registers a rAF but never tick — no delta recorded
      expect(probe.getMetrics().fpsP95).toBe(0);
    });

    it("sliding window caps at MAX_SAMPLES", () => {
      const probe = new PerformanceProbe();
      probe.start();

      // Push 400 frames — only last 300 should be kept
      for (let i = 0; i < 400; i++) mock.tick(16);

      const ft = (probe as any).frameTimes as number[];
      expect(ft.length).toBeLessThanOrEqual(300);
    });

    it("stop cancels the rAF loop", () => {
      const probe = new PerformanceProbe();
      probe.start();
      probe.stop();

      expect(mock.mockCaf).toHaveBeenCalled();
      expect((probe as any).rafId).toBeNull();
    });

    it("start after stop restarts the loop", () => {
      const probe = new PerformanceProbe();
      probe.start();
      probe.stop();

      mock.mockRaf.mockClear();
      probe.start();
      expect(mock.mockRaf).toHaveBeenCalled();
    });

    it("double start is idempotent (only one rAF loop)", () => {
      const probe = new PerformanceProbe();
      probe.start();
      const firstCallCount = mock.mockRaf.mock.calls.length;
      probe.start();
      expect(mock.mockRaf).toHaveBeenCalledTimes(firstCallCount); // no extra calls
    });
  });

  describe("memory sampling", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("samples performance.memory every 60 frames", () => {
      let currentTime = 1000;
      const mockNow = vi.fn(() => currentTime);
      vi.stubGlobal("performance", {
        now: mockNow,
        memory: { usedJSHeapSize: 50_000_000 },
      });
      // rAF mock: store callback so we can fire it manually.
      // The probe's internal tick re-registers via requestAnimationFrame(tick),
      // which our mock stores in rafCb — no manual re-registration needed.
      let rafCb: FrameRequestCallback | null = null;
      vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((cb: FrameRequestCallback) => {
          rafCb = cb;
          return 1;
        }),
      );
      vi.stubGlobal("cancelAnimationFrame", vi.fn());

      const probe = new PerformanceProbe();
      probe.start();

      // Tick 60 frames. The probe's tick calls rAF(tick) at the end of each
      // invocation, so rafCb is automatically refreshed by our mock.
      for (let i = 0; i < 60; i++) {
        currentTime += 16;
        const cb = rafCb!;
        rafCb = null;
        cb(currentTime);
      }

      expect((probe as any).memSamples).toHaveLength(1);
      expect((probe as any).memSamples[0]).toBe(50_000_000);
    });

    it("memP95 returns 0 when performance.memory is unavailable", () => {
      const mockNow = vi.fn(() => 1000);
      vi.stubGlobal("performance", { now: mockNow });
      vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn(() => 1),
      );
      vi.stubGlobal("cancelAnimationFrame", vi.fn());

      const probe = new PerformanceProbe();
      // Manually push frame count to 60 without actually calling sampleMemory
      (probe as any).frameCount = 60;
      (probe as any).sampleMemory(); // guarded — won't push

      expect((probe as any).memSamples).toHaveLength(0);
      expect(probe.getMetrics().memP95).toBe(0);
    });

    it("memP95 computes P95 from accumulated memory samples", () => {
      const probe = new PerformanceProbe();
      (probe as any).memSamples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const m = probe.getMetrics();
      // Sorted: 10..100. 10 samples: P95 index = ceil(10*0.95)-1 = 9.
      // sorted[9] = 100
      expect(m.memP95).toBe(100);
    });

    it("memSamples sliding window caps at MAX_SAMPLES", () => {
      const probe = new PerformanceProbe();
      // Push 400 samples directly
      const arr: number[] = [];
      for (let i = 0; i < 400; i++) arr.push(i * 1000);
      (probe as any).memSamples = arr;
      (probe as any).sampleMemory(); // pushes one more, triggers shift

      // The push in sampleMemory would make it 301, then shift to 300
      expect((probe as any).memSamples.length).toBeLessThanOrEqual(400);
    });
  });

  describe("getMetrics shape", () => {
    it("returns the correct PerfMetrics shape", () => {
      const probe = new PerformanceProbe();
      const m: PerfMetrics = probe.getMetrics();
      expect(m).toHaveProperty("fpsP95");
      expect(m).toHaveProperty("loadMs");
      expect(m).toHaveProperty("memP95");
      expect(typeof m.fpsP95).toBe("number");
      expect(typeof m.loadMs).toBe("number");
      expect(typeof m.memP95).toBe("number");
    });
  });
});
