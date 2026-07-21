// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1 DS GREEN PHASE — particle system tests
// ══════════════════════════════════════════════════════════════════════════════
//
// gov: AC-4 + SDR#5 + T7-T8 green
// ══════════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import type { RenderInstance } from "../vram/renderer";
import { CHARSET } from "../vram/glowAtlas";

import { createParticleSystem } from "./particles";

describe("AC-4: 粒子生成 -> 飞散 -> 消亡 (VRAM instance 生命周期)", () => {
  // gov: AC-4 + SDR#5 (粒子 VRAM) + T7
  it("spawn(x,y) 后 update(dt) 返回飞散 instance (glyphIdx 弹片字符 + worldX/Y 轨迹)", () => {
    const ps = createParticleSystem();
    ps.spawn(100, 200);
    const instances = ps.update(16);
    expect(instances.length).toBeGreaterThan(0);
    const first = instances[0]!;
    // glyphIdx must be a valid CHARSET index pointing at a debris glyph
    // (raw ASCII codes were a bug -> OOB / wrong glyphs; F-P1 fix).
    expect(first.glyphIdx).toBeGreaterThanOrEqual(0);
    expect(first.glyphIdx).toBeLessThan(CHARSET.length);
    expect(CHARSET[first.glyphIdx]).toMatch(/^[!#$%&*+\-\/<>^|~]$/);
    expect(first.worldX).not.toBe(100); // 已飞散 (轨迹偏离原点)
  });

  // gov: AC-4 + SDR#5 + T7 (消亡: ttl 到期后 alive() -> false, update 返回空)
  it("粒子 ttl 到期后 update 返回空数组 + alive() -> false", () => {
    const ps = createParticleSystem();
    ps.spawn(0, 0);
    // 推进 dt 累计超过 ttl (max 1000ms)
    ps.update(1000);
    expect(ps.alive()).toBe(false);
    expect(ps.update(16)).toHaveLength(0);
  });
});
