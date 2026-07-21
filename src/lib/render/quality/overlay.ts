// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1: cyberpunk-quality-first-8 — LVL UP overlay lifecycle controller
// ══════════════════════════════════════════════════════════════════════════════
//
// SDR#7: createLvlUpOverlay() — DOM overlay lifecycle controller for LVL UP text.
// Returns a controller that manages show → stay → fade → hidden transitions.
// The visual overlay is a React <div> with CSS animation (mounted in CanvasView);
// this module is the pure state machine consumed by the component.
//
// gov: AC-6 + SDR#7
// ══════════════════════════════════════════════════════════════════════════════

/** Overlay state machine states. */
export type OverlayState = "hidden" | "showing" | "fading";

/** Stay duration before fade begins (ms). */
const STAY_MS = 800;

/** Fade-out animation duration (ms). */
const FADE_MS = 400;

/** Overlay lifecycle controller returned by createLvlUpOverlay. */
export interface LvlUpOverlay {
  /** Trigger the overlay: hidden → showing. No-op if not hidden. */
  trigger: () => void;
  /** Read current overlay state. */
  getState: () => OverlayState;
  /** Advance the state machine by dtMs. */
  update: (dtMs: number) => void;
}

/**
 * Create a LVL UP overlay lifecycle controller.
 *
 * Pure state machine: hidden → showing (trigger) → fading (stay elapsed) →
 * hidden (fade elapsed). The visual side is a React DOM overlay driven by
 * getState() — no canvas rendering (SDR#7).
 *
 * gov: SDR#7 (DOM overlay, 非 canvas) + AC-6
 */
export function createLvlUpOverlay(): LvlUpOverlay {
  let state: OverlayState = "hidden";
  let elapsedMs = 0;

  const trigger = (): void => {
    if (state !== "hidden") return; // No-op if already active.
    state = "showing";
    elapsedMs = 0;
  };

  const getState = (): OverlayState => state;

  const update = (dtMs: number): void => {
    if (state === "hidden") return;

    elapsedMs += dtMs;

    if (state === "showing" && elapsedMs >= STAY_MS) {
      state = "fading";
      elapsedMs = 0;
    } else if (state === "fading" && elapsedMs >= FADE_MS) {
      state = "hidden";
      elapsedMs = 0;
    }
  };

  return { trigger, getState, update };
}
