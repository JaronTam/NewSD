// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1: cyberpunk-quality-first-8 — Web Audio blip player
// ══════════════════════════════════════════════════════════════════════════════
//
// SDR#4: createBlipPlayer() — Web Audio 方波 OscillatorNode + autoplay resume.
// Creates a short square-wave blip sound effect for badge unlock events (5.3).
//
// gov: AC-3 + AC-10 + SDR#4
// ══════════════════════════════════════════════════════════════════════════════

/** Blip player returned by createBlipPlayer. */
export interface BlipPlayer {
  /** Trigger a short square-wave blip. Silent no-op if AudioContext is suspended. */
  trigger: () => void;
  /** Resume AudioContext on first user gesture (autoplay policy). */
  resumeOnGesture: () => void;
  /** Read current AudioContext state (for e2e hooks). */
  getState: () => string;
}

/**
 * Create a Web Audio blip player.
 *
 * Uses lazy AudioContext construction (browser autoplay policy: created
 * suspended). Each trigger() creates a short square-wave OscillatorNode
 * burst with a gain envelope for a sharp "blip" sound.
 *
 * gov: SDR#4 (Web Audio 方波 + autoplay resume) + AC-3 + AC-10
 */
export function createBlipPlayer(): BlipPlayer {
  let ctx: AudioContext | null = null;

  const getCtx = (): AudioContext | null => {
    if (ctx) return ctx;
    try {
      const Ctor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
    return ctx;
  };

  const trigger = (): void => {
    const c = getCtx();
    if (!c) return;

    // Silent skip when suspended (autoplay policy, not yet resumed).
    if (c.state === "suspended") return;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(880, c.currentTime); // A5 — bright blip

    // Short envelope: sharp attack, fast decay
    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(c.destination);

    // F-E2: disconnect oscillator after stop to release resources.
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  };

  const resumeOnGesture = (): void => {
    const c = getCtx();
    if (!c) return;
    c.resume().catch(() => {
      // Autoplay policy may reject — silent no-op.
    });
  };

  const getState = (): string => {
    const c = getCtx();
    return c?.state ?? "unavailable";
  };

  return { trigger, resumeOnGesture, getState };
}
