import { useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";

import type { Camera, Viewport } from "../lib/render/camera";
import {
  GLYPH_H,
  LUMA_LEVELS,
  bakeGlowAtlasCanvas,
  charToGlyphIdx,
} from "../lib/render/vram/glowAtlas";
import { readPalette } from "../lib/render/palette";
import type { RenderInstance } from "../lib/render/vram/renderer";
import { VRAMRenderer } from "../lib/render/vram/renderer";

// Story 1a.2 sub-PR #1 — VRAM render base dev harness.
//
// Mounts the WebGL2 instanced glyph pipeline (AD-9) and renders a sample ASCII
// scene with the cyberpunk palette + slow hue drift. DEV-only: the renderer
// is never instantiated in production (the early return gates the effect).
// End-to-end visual verification is the Playwright gate (sub-PR #1 step).

// The 8-entry glyph palette is derived at runtime from src/styles/tokens.css
// via readPalette() (single source — aesthetic AC②), shared with the prod
// CanvasView so this DEV harness never drifts off-palette.

function buildSampleInstances(): RenderInstance[] {
  const out: RenderInstance[] = [];
  const pushLine = (text: string, y: number, colorIdx: number, baseLuma: number) => {
    const x0 = -text.length / 2;
    for (let i = 0; i < text.length; i++) {
      const glyphIdx = charToGlyphIdx(text[i]);
      if (glyphIdx < 0) continue; // skip chars outside the baked charset
      out.push({
        glyphIdx,
        lumaIdx: (baseLuma + i) % LUMA_LEVELS,
        colorIdx,
        worldX: x0 + i,
        worldY: y,
        entityType: 0, // placeholder: stock
        zOrder: 0,
        rotation: 0,
        selected: false,
      });
    }
  };
  pushLine("NewSD", -3, 0, 3); // title, stock cyan, max glow
  pushLine("1a.2 VRAM render base", 0, 3, 1); // subtitle, fg, low glow
  pushLine("stock cloud flow glow", 3, 0, 2); // palette tour, cloud
  pushLine("┌─────────────────────┐", 5, 2, 2);
  pushLine("└─────────────────────┘", 6, 2, 2);
  return out;
}

function VramDev() {
  // DEV gate: never instantiate the WebGL2 renderer in production.
  // Hooks must run unconditionally (react-hooks/rules-of-hooks) — check
  // import.meta.env.DEV inside the effect and in the JSX branch instead of
  // early-returning before the hook calls.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new VRAMRenderer({ canvas, palette: readPalette() });
    const baked = bakeGlowAtlasCanvas({
      font: `${GLYPH_H}px "JetBrains Mono", "Courier New", monospace`,
      glyphColor: "#ffffff", // neutral luminance map; palette shades in-shader
      glowColor: "#ffffff",
    });
    renderer.setAtlas(baked);

    // zoom = CSS pixels per world unit. One world unit == one char cell, so
    // zoom needs to be ~ the desired on-screen cell width in pixels. 24 gives
    // a comfortably-readable 24px-wide char in the dev harness.
    const camera: Camera = { x: 0, y: 0, zoom: 24 };
    const viewport: Viewport = { width: window.innerWidth, height: window.innerHeight };
    const instances = buildSampleInstances();

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      renderer.setHueShift(t * 0.3); // slow cyberpunk hue drift
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      renderer.render(camera, viewport, instances);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100vw", height: "100vh", display: "block", background: "#0a0e14" }}
    />
  );
}

export const Route = createFileRoute("/vram")({ component: VramDev });
