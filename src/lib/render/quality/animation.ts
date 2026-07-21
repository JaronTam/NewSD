// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1: cyberpunk-quality-first-8 — animation ticker + flow offset
// ══════════════════════════════════════════════════════════════════════════════
//
// SDR#1: 独立 rAF animation ticker (独立于 perfProbe rAF), 每帧推进
// animation state + 调 drawRef.current(). 受 reduced-motion 调节.
// SDR#3: computeFlowOffset 纯函数, CPU 端每帧改 instance worldX/glyphIdx,
// 不走 shader u_time.
//
// gov: AC-1 + AC-2 + AC-11 + SDR#1 + SDR#3 + SDR#11
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Maximum number of flow elements that receive marching animation per frame.
 *
 * Per AC-12 / B-perf-1 / SDR#12: when the scene contains more than this many
 * flow elements, the remaining elements are rendered statically (no glyphIdx
 * rotation) to maintain ≥60 FPS (NFR-PERF-1).
 *
 * gov: SDR#12 (性能上限声明) + AC-12
 */
export const MAX_FLOW_ANIM_ELEMENTS = 1000;
// ══════════════════════════════════════════════════════════════════════════════

/** Animation state exposed for e2e hooks. */
export interface AnimationState {
  /** Monotonic time in ms since ticker started. */
  timeMs: number;
  /** Whether reduced-motion is active. */
  reducedMotion: boolean;
}

/**
 * Start a continuous rAF animation ticker.
 *
 * Runs independently of perfProbe's rAF (perf-probe.ts:42-65) which only
 * samples frame times. The ticker advances `timeMs` each frame and calls
 * `drawRef.current()` to trigger a VRAM re-render.
 *
 * When `getReducedMotion()` returns true, the ticker runs at a reduced rate
 * (every 4th frame ≈ 15fps on a 60Hz display) per AR#11 / SDR#11.
 *
 * Returns a stop function that cancels the rAF on unmount.
 *
 * gov: SDR#1 (独立 rAF ticker) + SDR#11 (reduced-motion 降频)
 */
export function startAnimationTicker(
  drawRef: { current: (() => void) | null },
  getReducedMotion: () => boolean,
): () => void {
  let rafId = 0;
  let lastTime = 0;
  let frameSkip = 0;
  const REDUCED_MOTION_SKIP = 4; // 降频到 ~15fps

  const tick = (now: number) => {
    rafId = requestAnimationFrame(tick);

    const reduced = getReducedMotion();
    _state.reducedMotion = reduced;

    if (reduced) {
      frameSkip = (frameSkip + 1) % REDUCED_MOTION_SKIP;
      if (frameSkip !== 0) {
        // F-E5: update lastTime even on skipped frames so the next non-skip
        // frame doesn't accumulate a huge dt that causes timeMs to jump.
        lastTime = now;
        return;
      }
    }

    if (lastTime === 0) {
      lastTime = now;
      return;
    }

    const dt = now - lastTime;
    lastTime = now;

    // Update animation state — exposed via closure for e2e hooks.
    _state.timeMs += dt;

    drawRef.current?.();
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
}

// Internal mutable state — exposed via getAnimationState() for e2e.
const _state: AnimationState = { timeMs: 0, reducedMotion: false };

/** Read current animation state (for e2e hooks). */
export function getAnimationState(): Readonly<AnimationState> {
  return _state;
}

/** Reset animation state to initial values (for test isolation). */
export function resetAnimationState(): void {
  _state.timeMs = 0;
  _state.reducedMotion = false;
}

/**
 * Compute flow arrow offset from monotonic time.
 *
 * Pure function (SDR#3): time → pixel offset for flow arrow `>>>>>>>` marching.
 * Returns a value in world units that can be added to instance worldX to
 * advance the arrow glyphs along the flow direction.
 *
 * Period: 1000ms cycle, speed: 1 world unit per 100ms.
 *
 * gov: SDR#3 (CPU 改 instance, 禁 u_time) + AC-2
 */
export function computeFlowOffset(timeMs: number): number {
  // Flow arrows march at 1 world unit per 100ms, wrapping every 10 units.
  // This gives a visible `>>>>>>>` scrolling effect when applied to
  // flow arrow glyph positions.
  return (timeMs / 100) % 10;
}

/**
 * Compute glitch glyph index for stock value display.
 *
 * Pure function (SDR#6): time → perturbed glyphIdx for glitch decoding effect.
 * The glyph alternates between random-looking ASCII and the true glyph index
 * over a ~2s cycle. After the glitch period, it stabilizes to the true value.
 *
 * gov: SDR#6 (glitch glyphIdx 轮转) + AC-5
 */
export function computeGlitchGlyphIdx(timeMs: number, trueGlyphIdx: number): number {
  const GLITCH_PERIOD_MS = 2000;
  const phase = timeMs % GLITCH_PERIOD_MS;

  // First 60% of the period: glitch (random printable glyphs from CHARSET).
  // CHARSET index 0 = space, indices 1-94 = '!'..'~' (printable non-space).
  if (phase < GLITCH_PERIOD_MS * 0.6) {
    // Use a deterministic pseudo-random based on time and true index
    // to avoid visual flicker inconsistency across frames.
    const seed = Math.floor(timeMs / 50) + trueGlyphIdx * 31;
    // CHARSET indices 1-94 (94 printable non-space glyphs).
    return 1 + (seed % 94);
  }

  // Last 40%: stable true value
  return trueGlyphIdx;
}
