// PerformanceProbe — client-side RUM base (Story 1a.5, AC-7 / B-obs-1).
//
// Samples rAF frame-time deltas, P95-aggregates them in a sliding window, and
// captures load-time + memory metrics. Intended as the measurable foundation for
// NFR-PERF-1 (≥60 FPS @ 1000 elems) and NFR-PERF-2 (≥30 FPS @ 10000 elems).
//
// Explicit deferrals (not silent omissions):
//   - Network upload, server-side ingestion, and ops dashboards → deferred to a
//     future ops / RUM story. 1a.5 has no backend RUM endpoint.
//   - Navigation start is approximated via constructor timestamp (no
//     performance.timing / PerformanceObserver for the initial HTML nav) —
//     sufficient for a client-side SPA load metric.
//
// SSR / jsdom safety: rAF, performance.now, and performance.memory are guarded;
// missing APIs degrade to 0 / no-op rather than throwing.

export interface PerfMetrics {
  /** P95 FPS derived from frame-time samples (0 when no samples). */
  fpsP95: number;
  /** Milliseconds since PerformanceProbe construction (≈ SPA load time). */
  loadMs: number;
  /** P95 usedJSHeapSize in bytes (0 when performance.memory is unavailable). */
  memP95: number;
}

const MAX_SAMPLES = 300; // sliding window ≈ 5 s at 60 fps

export class PerformanceProbe {
  private frameTimes: number[] = [];
  private memSamples: number[] = [];
  private frameCount = 0;
  private rafId: number | null = null;
  private loadStart: number;

  constructor() {
    this.loadStart = typeof performance !== "undefined" ? performance.now() : 0;
  }

  // ---- rAF sampling lifecycle -----------------------------------------------

  /** Begin the rAF sampling loop. No-op when rAF is unavailable (jsdom / SSR). */
  start(): void {
    if (typeof requestAnimationFrame === "undefined") return;
    if (this.rafId !== null) return; // already running

    let lastTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      this.frameTimes.push(delta);
      if (this.frameTimes.length > MAX_SAMPLES) {
        this.frameTimes.shift();
      }

      // Sample memory every ~1 s (60 frames) to avoid per-frame overhead.
      this.frameCount++;
      if (this.frameCount % 60 === 0) {
        this.sampleMemory();
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** Cancel the rAF loop. Idempotent. */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ---- metrics --------------------------------------------------------------

  /** Return current P95-aggregated metrics. Does NOT reset state. */
  getMetrics(): PerfMetrics {
    return {
      fpsP95: this.computeFpsP95(),
      loadMs: this.loadStart > 0 ? performance.now() - this.loadStart : 0,
      memP95: this.computeMemP95(),
    };
  }

  /** Discard all accumulated samples and reset the load timer. */
  reset(): void {
    this.frameTimes = [];
    this.memSamples = [];
    this.frameCount = 0;
    this.loadStart = typeof performance !== "undefined" ? performance.now() : 0;
  }

  // ---- internal -------------------------------------------------------------

  private sampleMemory(): void {
    const mem = (performance as any).memory?.usedJSHeapSize;
    if (typeof mem === "number" && mem > 0) {
      this.memSamples.push(mem);
      if (this.memSamples.length > MAX_SAMPLES) {
        this.memSamples.shift();
      }
    }
  }

  private computeFpsP95(): number {
    if (this.frameTimes.length === 0) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    const p95Ft = sorted[Math.max(0, idx)]!;
    return p95Ft > 0 ? 1000 / p95Ft : 0;
  }

  private computeMemP95(): number {
    if (this.memSamples.length === 0) return 0;
    const sorted = [...this.memSamples].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)]!;
  }
}
