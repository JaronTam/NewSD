// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — blip audio tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-3 + AC-10 + SDR#4 + T5-T6 green
// ══════════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBlipPlayer } from "./audio";

// Mock AudioContext factory (jsdom lacks it).
function makeMockAudioContext() {
  const ctx = {
    state: "suspended" as string,
    currentTime: 0 as number,
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createOscillator: vi.fn(() => ({
      type: "sine" as string,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
    destination: {} as AudioNode,
  };
  return ctx;
}

/** Stub global AudioContext with a mock that returns the given ctx object. */
function stubAudioContext(mock: ReturnType<typeof makeMockAudioContext>) {
  // Use a class so `new AudioContext()` returns the mock object (constructor
  // returns an object → `new` returns that object per spec).
  const FakeCtx = function (this: any) {
    return mock;
  } as any;
  vi.stubGlobal("AudioContext", FakeCtx);
  vi.stubGlobal("webkitAudioContext", FakeCtx);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AC-3: blip 方波 OscillatorNode (Web Audio)", () => {
  // gov: AC-3 + SDR#4 (Web Audio blip) + T5
  it("trigger() 创建 square wave OscillatorNode 并接入 destination", () => {
    const mock = makeMockAudioContext();
    stubAudioContext(mock);

    const player = createBlipPlayer();
    // AudioContext starts suspended per autoplay policy; resume first.
    player.resumeOnGesture();
    player.trigger();

    expect(mock.createOscillator).toHaveBeenCalled();
    const osc = mock.createOscillator.mock.results[0]?.value;
    expect(osc?.type).toBe("square");
  });
});

describe("AC-10: E25 autoplay (suspended -> 首手势 resume -> running)", () => {
  // gov: AC-10 + SDR#4 + T5 (autoplay policy: 初始 suspended, 手势后 resume)
  it("初始 AudioContext.state=suspended, resumeOnGesture() 后 -> running", () => {
    const mock = makeMockAudioContext();
    stubAudioContext(mock);

    const player = createBlipPlayer();
    // Lazy ctx: getState() triggers creation and returns state.
    expect(player.getState()).toBe("suspended");

    player.resumeOnGesture();

    expect(mock.resume).toHaveBeenCalled();
    expect(player.getState()).toBe("running");
  });
});
