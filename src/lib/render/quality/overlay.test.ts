// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — LVL UP overlay tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-6 + SDR#7 + T11-T12 green
// ══════════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";

import { createLvlUpOverlay } from "./overlay";

describe("AC-6: LVL UP overlay 显示 -> 停留 -> 淡出 (DOM overlay 生命周期)", () => {
  // gov: AC-6 + SDR#7 (LVL UP DOM overlay) + T11
  it("trigger() 后 getState()=showing, update 推进停留期仍 showing", () => {
    const overlay = createLvlUpOverlay();
    overlay.trigger();
    expect(overlay.getState()).toBe("showing");
    overlay.update(100); // 停留期内
    expect(overlay.getState()).toBe("showing");
  });

  // gov: AC-6 + SDR#7 + T11 (淡出: 停留期结束 -> fading -> hidden)
  it("停留期结束 update 推进 -> fading, 再推进 -> hidden", () => {
    const overlay = createLvlUpOverlay();
    overlay.trigger();
    overlay.update(1000); // DS: 超过停留期
    expect(overlay.getState()).toBe("fading");
    overlay.update(500); // DS: 超过淡出期
    expect(overlay.getState()).toBe("hidden");
  });
});
