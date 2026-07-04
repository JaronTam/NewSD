import { useEffect, useRef, useState } from "react";

import {
  clampCamera,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
  type Viewport,
} from "./camera";
import { readPalette } from "./palette";
import { GLYPH_H, LUMA_LEVELS, bakeGlowAtlasCanvas, charToGlyphIdx } from "./vram/glowAtlas";
import { VRAMRenderer, type RenderInstance } from "./vram/renderer";

// Story 1a.1 sub-PR #3 — FR-CANVAS-1: infinite canvas navigation.
//
// Pure Float64 camera math lives in camera.ts (unit-tested there). This
// component is the view layer: it owns the <canvas>, wires pointer/wheel/keyboard
// input to panBy/zoomAt, draws an on-palette adaptive grid (no shadowBlur —
// CAP-11), overlays VRAM glyphs on a second WebGL2 canvas (AD-9; Story 1a.2
// sub-PR #2), and shows a loading skeleton during the mount phase (F4). Runtime
// render errors fall through to the global error boundary in __root.tsx
// (RootErrorComponent — the "兜底基座" from sub-PR #1), not handled here.
//
// Rendering model: camera + viewport live in refs (mutable, no React re-render
// per frame); the only React state is `phase` (loading -> ready). The draw
// function is held in a ref and reassigned each render so the [] effects never
// go stale (the canonical imperative-canvas pattern; avoids exhaustive-deps
// noise without disabling the rule).

// Wheel deltaY -> zoom factor. factor = exp(-deltaY * STEP): scroll down
// (deltaY > 0) zooms out, scroll up zooms in. Tuned so one notch (~100) is a
// ~14% step.
const ZOOM_WHEEL_STEP = 0.0015;

// Coarsen the character-cell grid until screen spacing >= this many px, so
// lines never collapse into a solid block when zoomed out.
const GRID_MIN_PX = 8;

// Zoom controls step factor: +/- buttons apply exactly this multiplier per
// click, anchored at the viewport center. 1.2 lines up with "one wheel notch"
// on the FR-CANVAS-1 UX.
const ZOOM_BUTTON_FACTOR = 1.2;

type Phase = "loading" | "ready";

interface Cursor {
  sx: number;
  sy: number;
}

interface Tokens {
  bg: string;
  grid: string;
  origin: string;
  fgDim: string;
  cellW: number;
  cellH: number;
}

// Defensive fallbacks mirror tokens.css (primary source is the runtime computed
// style read in readTokens). If a token is missing/invalid we still render
// on-palette rather than blank.
const DEFAULT_TOKENS: Tokens = {
  bg: "#0a0e14",
  grid: "#1a1f2e",
  origin: "#00ffd5",
  fgDim: "#4a5568",
  cellW: 9,
  cellH: 16,
};

function readTokens(): Tokens {
  if (typeof document === "undefined") return DEFAULT_TOKENS;
  const root = getComputedStyle(document.documentElement);
  const get = (name: string) => root.getPropertyValue(name).trim();
  const cellW = parseFloat(get("--ns-cell-w"));
  const cellH = parseFloat(get("--ns-cell-h"));
  return {
    bg: get("--ns-bg") || DEFAULT_TOKENS.bg,
    grid: get("--ns-grid") || DEFAULT_TOKENS.grid,
    origin: get("--ns-stock") || DEFAULT_TOKENS.origin,
    fgDim: get("--ns-fg-dim") || DEFAULT_TOKENS.fgDim,
    cellW: Number.isFinite(cellW) && cellW > 0 ? cellW : DEFAULT_TOKENS.cellW,
    cellH: Number.isFinite(cellH) && cellH > 0 ? cellH : DEFAULT_TOKENS.cellH,
  };
}

const SKELETON = `╔═══════════════════════════════╗
║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
║  ░░░░  INITIALIZING CANVAS  ░░  ║
║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
╚═══════════════════════════════╝`;

function isTextInput(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  );
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// First-screen placeholder glyphs (Story 1a.2 sub-PR #2). Business glyphs
// (stock/cloud/flow shapes) land in 1a.3/1a.4; this static ASCII proves the
// VRAM real-time path is wired into the real CanvasView (not just the DEV
// /vram route). Centered on the world origin so it sits under the crosshair.
// ASCII-only (charset is ASCII 32-126 + box glyphs); non-charset chars are
// skipped by charToGlyphIdx returning -1.
function buildBootInstances(): RenderInstance[] {
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
      });
    }
  };
  pushLine("NewSD", -2, 0, 3); // title — stock cyan, max glow
  pushLine("1a.2 vram canvas", 0, 3, 1); // subtitle — fg, low glow
  pushLine("┌──────────────┐", 2, 2, 2); // cloud violet frame
  pushLine("└──────────────┘", 3, 2, 2);
  return out;
}

export function CanvasView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  // VRAM glyph overlay (AD-9). glCanvas is a second <canvas> stacked above the
  // 2D surface; renderer is null when WebGL2 is unavailable (jsdom / old
  // browsers) -> degrade to grid-only. instances holds the first-screen
  // placeholder glyphs (business glyphs arrive in 1a.3/1a.4).
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VRAMRenderer | null>(null);
  const instancesRef = useRef<RenderInstance[]>([]);

  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const vpRef = useRef<Viewport>({ width: 0, height: 0 });
  const tokensRef = useRef<Tokens>(DEFAULT_TOKENS);
  const cursorRef = useRef<Cursor | null>(null);
  // Pan state machine: active = currently dragging; spaceDown = Space held
  // (left-button drag doubles as pan while Space is down).
  const panRef = useRef({ active: false, spaceDown: false, lastX: 0, lastY: 0, pointerId: -1 });
  // Multi-touch pinch state: tracks live pointers by id, and (when >=2 down)
  // the previous two-finger distance so the next move can compute a factor.
  // Pinch is a two-finger gesture; it suspends the pan state machine while
  // active so the "left-without-space doesn't pan" rule still holds for single
  // taps, but two-finger touch always zooms regardless of the space gate.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ active: boolean; prevDist: number }>({ active: false, prevDist: 0 });

  const [phase, setPhase] = useState<Phase>("loading");

  // draw is reassigned every render so the [] effects below always call the
  // freshest closure. It only reads refs, so identity churn is harmless.
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const vp = vpRef.current;
    const cam = camRef.current;
    const tokens = tokensRef.current;

    // HUD (no 2D context needed — stays testable in jsdom).
    const hud = hudRef.current;
    if (hud) {
      const zoomPct = Math.round(cam.zoom * 100);
      const cur = cursorRef.current;
      const [wx, wy] = cur ? screenToWorld(cam, vp, cur.sx, cur.sy) : [cam.x, cam.y];
      hud.textContent = `zoom ${zoomPct}%  ·  x ${wx.toFixed(1)}  ·  y ${wy.toFixed(1)}`;
    }

    if (!canvas || !ctx || vp.width === 0 || vp.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. background
    ctx.fillStyle = tokens.bg;
    ctx.fillRect(0, 0, vp.width, vp.height);

    // 2. adaptive character-cell grid (anisotropic 9x16 -> separate x/y step).
    ctx.lineWidth = 1;
    ctx.strokeStyle = tokens.grid;
    drawGrid(ctx, cam, vp, tokens.cellW, GRID_MIN_PX, "x");
    drawGrid(ctx, cam, vp, tokens.cellH, GRID_MIN_PX, "y");

    // 3. world origin axes (subtle cyan crosshair — the "you are here").
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = tokens.origin;
    const [ox, oy] = worldToScreen(cam, vp, 0, 0);
    ctx.beginPath();
    ctx.moveTo(Math.round(ox) + 0.5, 0);
    ctx.lineTo(Math.round(ox) + 0.5, vp.height);
    ctx.moveTo(0, Math.round(oy) + 0.5);
    ctx.lineTo(vp.width, Math.round(oy) + 0.5);
    ctx.stroke();

    // 4. origin marker "+"
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(Math.round(ox) - 4, Math.round(oy) + 0.5);
    ctx.lineTo(Math.round(ox) + 5, Math.round(oy) + 0.5);
    ctx.moveTo(Math.round(ox) + 0.5, Math.round(oy) - 4);
    ctx.lineTo(Math.round(ox) + 0.5, Math.round(oy) + 5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 5. VRAM glyph overlay (AD-9). Renders the pre-baked glow atlas via the
    // WebGL2 instanced pipeline on the stacked gl canvas. No-op when WebGL2 is
    // unavailable — rendererRef stays null and the grid-only surface above is
    // the final frame (no shadowBlur fallback; AD-9/CAP-11). The renderer sizes
    // its own backing store from the viewport, so it stays in lockstep with the
    // 2D surface via the shared vpRef/camRef.
    rendererRef.current?.render(cam, vp, instancesRef.current);
  };

  // ---- viewport + tokens + ready transition (mount) ----
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    tokensRef.current = readTokens();

    // VRAM glyph overlay (AD-9): construct the WebGL2 instanced pipeline and
    // bake the glow atlas once on mount. WebGL2 is unavailable in jsdom and
    // old browsers — catch and degrade to grid-only (rendererRef stays null).
    // No shadowBlur fallback is ever introduced (AD-9/CAP-11). The bake uses
    // shadowBlur OFF-SCREEN and ONE-TIME — the canonical AD-9 mechanism, not
    // a per-frame per-glyph violation.
    const glCanvas = glCanvasRef.current;
    if (glCanvas) {
      try {
        const renderer = new VRAMRenderer({ canvas: glCanvas, palette: readPalette() });
        const baked = bakeGlowAtlasCanvas({
          font: `${GLYPH_H}px "JetBrains Mono", "Courier New", monospace`,
          glyphColor: "#ffffff", // neutral luminance map; palette shades in-shader
          glowColor: "#ffffff",
        });
        renderer.setAtlas(baked);
        rendererRef.current = renderer;
        instancesRef.current = buildBootInstances();
      } catch (err) {
        rendererRef.current = null;
        if (import.meta.env.DEV) {
          console.warn("[CanvasView] WebGL2 unavailable — rendering grid-only", err);
        }
      }
    }

    const measure = () => {
      const w = Math.max(1, Math.floor(el.clientWidth));
      const h = Math.max(1, Math.floor(el.clientHeight));
      vpRef.current = { width: w, height: h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      drawRef.current();
    };
    measure();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);

    // Flip to ready on the next macrotask: the canvas has been measured and
    // drawn synchronously above, so hiding the skeleton then never flashes a
    // blank frame, while keeping the skeleton visibly present for the load
    // frame itself (F4 — non-blank during load).
    const readyTimer = setTimeout(() => setPhase("ready"), 0);
    return () => {
      clearTimeout(readyTimer);
      ro?.disconnect();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ---- wheel zoom (native, non-passive so preventDefault holds) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      cursorRef.current = { sx, sy };
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-dy * ZOOM_WHEEL_STEP);
      camRef.current = zoomAt(camRef.current, vpRef.current, sx, sy, factor);
      drawRef.current();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ---- Space key (window) -> grab cursor + enables left-button pan ----
  useEffect(() => {
    const setCursor = () => {
      const el = containerRef.current;
      if (!el) return;
      const p = panRef.current;
      el.style.cursor = p.active ? "grabbing" : p.spaceDown ? "grab" : "default";
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTextInput(e.target)) return;
      e.preventDefault();
      panRef.current.spaceDown = true;
      setCursor();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      panRef.current.spaceDown = false;
      setCursor();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const beginPan = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Always track this pointer so a second finger going down promotes us to
    // pinch mode. Coordinates are canvas-relative for the pinch midpoint.
    pointersRef.current.set(e.pointerId, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    // Two pointers down -> enter pinch (regardless of button gate). If a pan
    // was in progress, drop it: pinch takes over.
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      pinchRef.current = { active: true, prevDist: distance(pts[0], pts[1]) };
      panRef.current.active = false;
      containerRef.current?.style.setProperty("cursor", "grabbing");
      // Capture this pointer so we still see pointermove even if the finger
      // leaves the canvas rect mid-gesture.
      try {
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } catch {
        // jsdom / no-capture browsers — pinch still works via bubbling.
      }
      e.preventDefault();
      return;
    }

    const middle = e.button === 1;
    const spaceLeft = e.button === 0 && panRef.current.spaceDown;
    if (!middle && !spaceLeft) return;
    e.preventDefault();
    try {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } catch {
      // capture unsupported (jsdom) or already captured; pan still works.
    }
    panRef.current = {
      ...panRef.current,
      active: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    containerRef.current?.style.setProperty("cursor", "grabbing");
  };

  const movePan = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    cursorRef.current = { sx, sy };

    // Update tracked pointer position (pinch needs both fingers' live coords).
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: sx, y: sy });
    }

    // Pinch: two fingers -> zoom about the midpoint by (newDist / prevDist).
    // zoomAt already clamps zoom + world coords, so no extra clamp needed here.
    if (pinchRef.current.active && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values()).slice(0, 2);
      const newDist = distance(pts[0], pts[1]);
      const prev = pinchRef.current.prevDist;
      if (prev > 0 && newDist > 0) {
        const factor = newDist / prev;
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        camRef.current = zoomAt(camRef.current, vpRef.current, midX, midY, factor);
      }
      pinchRef.current.prevDist = newDist;
      drawRef.current();
      return;
    }

    if (!panRef.current.active) {
      drawRef.current(); // hover HUD only
      return;
    }
    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;
    camRef.current = clampCamera(panBy(camRef.current, dx, dy));
    drawRef.current();
  };

  const endPan = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Always release capture + drop this pointer from the tracker.
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be released on pointerup; ignore.
    }
    pointersRef.current.delete(e.pointerId);

    // Drop out of pinch as soon as we go back below two fingers.
    if (pinchRef.current.active && pointersRef.current.size < 2) {
      pinchRef.current = { active: false, prevDist: 0 };
    }

    const p = panRef.current;
    if (p.active && p.pointerId === e.pointerId) {
      e.preventDefault();
      p.active = false;
    }
    containerRef.current?.style.setProperty("cursor", p.spaceDown ? "grab" : "default");
  };

  // Zoom controls (+/-) — anchor at the viewport center so keyboard/click users
  // get predictable zoom without needing to move the pointer over the canvas.
  const zoomByFactor = (factor: number) => {
    const vp = vpRef.current;
    if (vp.width === 0 || vp.height === 0) return;
    const cx = vp.width / 2;
    const cy = vp.height / 2;
    camRef.current = zoomAt(camRef.current, vp, cx, cy, factor);
    drawRef.current();
  };

  return (
    <div ref={containerRef} className="ns-canvas" tabIndex={0}>
      <canvas
        ref={canvasRef}
        className="ns-canvas__surface"
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      />
      {/* WebGL2 glyph overlay (AD-9). Stacked above the 2D surface; transparent
          and pointer-events:none so all pan/zoom/wheel input still hits the 2D
          canvas below. aria-hidden: the HUD is the accessible live region. */}
      <canvas ref={glCanvasRef} className="ns-canvas__gl" aria-hidden="true" />
      <span ref={hudRef} className="ns-canvas__hud" aria-live="polite" />
      <div className="ns-canvas__ctrl" role="group" aria-label="zoom controls">
        <button
          type="button"
          className="ns-canvas__btn"
          aria-label="zoom in"
          onClick={() => zoomByFactor(ZOOM_BUTTON_FACTOR)}
        >
          +
        </button>
        <button
          type="button"
          className="ns-canvas__btn"
          aria-label="zoom out"
          onClick={() => zoomByFactor(1 / ZOOM_BUTTON_FACTOR)}
        >
          −
        </button>
      </div>
      {phase === "loading" && (
        <div className="ns-canvas__skeleton" role="status" aria-busy="true">
          <pre className="ns-ascii" aria-hidden="true">
            {SKELETON}
          </pre>
          <span className="ns-canvas__hint">loading · Float64 canvas · 3×2 affine</span>
        </div>
      )}
    </div>
  );
}

// Draw vertical ("x") or horizontal ("y") grid lines at world multiples of the
// cell size, coarsened by powers of two until on-screen spacing >= minPx so the
// grid never collapses to a solid block when zoomed out. Stroke color is set by
// the caller; no shadowBlur (CAP-11).
function drawGrid(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  vp: Viewport,
  cell: number,
  minPx: number,
  axis: "x" | "y",
) {
  let step = cell;
  while (step * cam.zoom < minPx) step *= 2;

  const [wx0, wy0] = screenToWorld(cam, vp, 0, 0);
  const [wx1, wy1] = screenToWorld(cam, vp, vp.width, vp.height);

  ctx.beginPath();
  if (axis === "x") {
    const k0 = Math.floor(wx0 / step);
    const k1 = Math.ceil(wx1 / step);
    for (let k = k0; k <= k1; k++) {
      const [sx] = worldToScreen(cam, vp, k * step, 0);
      const x = Math.round(sx) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vp.height);
    }
  } else {
    const k0 = Math.floor(wy0 / step);
    const k1 = Math.ceil(wy1 / step);
    for (let k = k0; k <= k1; k++) {
      const [, sy] = worldToScreen(cam, vp, 0, k * step);
      const y = Math.round(sy) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(vp.width, y);
    }
  }
  ctx.stroke();
}
