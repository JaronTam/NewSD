// ══════════════════════════════════════════════════════════════════════════════
// Story 5-1: cyberpunk-quality-first-8 — ASCII particle system
// ══════════════════════════════════════════════════════════════════════════════
//
// SDR#5: createParticleSystem() — VRAM instance particles for badge-unlock
// debris. Particles are ASCII glyph fragments rendered via renderer.render,
// NOT Canvas2D (CAP-11 compliance). 5.1 builds the render base with manual
// trigger; 5.3 connects to badge unlock events.
//
// gov: AC-4 + SDR#5
// ══════════════════════════════════════════════════════════════════════════════

import type { RenderInstance } from "../vram/renderer";
import { charToGlyphIdx } from "../vram/glowAtlas";

/** Single particle in the system. */
interface Particle {
  worldX: number;
  worldY: number;
  vx: number;
  vy: number;
  ttlMs: number;
  maxTtl: number;
  glyphIdx: number;
  lumaIdx: number;
}

/** ASCII debris glyphs used for particle fragments, as CHARSET indices. */
// Map via charToGlyphIdx: CHARSET index = ASCII-32. Previously raw ASCII codes
// were used as indices -> 124/126 OOB (atlas cellIndex>480) and others wrong.
// ! # $ % & * + - / < > ^ | ~
const DEBRIS_GLYPHS = "!#$%&*+-/<>^|~".split("").map(charToGlyphIdx);

/** Particle system returned by createParticleSystem. */
export interface ParticleSystem {
  /** Spawn a burst of particles at (x, y) in world coords. */
  spawn: (x: number, y: number) => void;
  /** Advance simulation by dtMs, returning VRAM instances for this frame. */
  update: (dtMs: number) => RenderInstance[];
  /** Whether any particles are still alive. */
  alive: () => boolean;
}

/**
 * Create an ASCII particle system.
 *
 * Particles are VRAM instances (SDR#5) — no Canvas2D, no shadowBlur.
 * Each spawn() creates a burst of debris glyphs that scatter outward
 * and fade over their lifetime.
 *
 * gov: SDR#5 (VRAM instances, 禁 Canvas2D shadowBlur) + AC-4
 */
export function createParticleSystem(): ParticleSystem {
  let particles: Particle[] = [];

  const spawn = (x: number, y: number): void => {
    // Spawn 8-12 debris particles per burst.
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 6; // world units per second
      const ttl = 400 + Math.random() * 600; // 400-1000ms
      particles.push({
        worldX: x,
        worldY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttlMs: ttl,
        maxTtl: ttl,
        glyphIdx: DEBRIS_GLYPHS[i % DEBRIS_GLYPHS.length],
        lumaIdx: 3, // bright
      });
    }
  };

  const update = (dtMs: number): RenderInstance[] => {
    // Remove dead particles and advance survivors.
    const dtSec = dtMs / 1000;
    const survivors: Particle[] = [];
    const instances: RenderInstance[] = [];

    for (const p of particles) {
      p.ttlMs -= dtMs;
      if (p.ttlMs <= 0) continue;

      p.worldX += p.vx * dtSec;
      p.worldY += p.vy * dtSec;

      // Fade: luma drops as ttl decreases.
      const lifeRatio = p.ttlMs / p.maxTtl;
      const luma = Math.max(0, Math.floor(lifeRatio * 3));

      survivors.push(p);
      instances.push({
        glyphIdx: p.glyphIdx,
        lumaIdx: luma,
        colorIdx: 0,
        worldX: p.worldX,
        worldY: p.worldY,
        entityType: 0,
        zOrder: 10, // above normal elements
        rotation: 0,
        selected: false,
      });
    }

    particles = survivors;
    return instances;
  };

  const alive = (): boolean => particles.length > 0;

  return { spawn, update, alive };
}
