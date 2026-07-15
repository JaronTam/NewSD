import { useEffect, useRef, useState } from "react";

import {
  clampCamera,
  panBy,
  screenToWorld,
  shouldSnap,
  snapToGrid,
  viewportToWorldRect,
  worldToScreen,
  zoomAt,
  type Camera,
  type Viewport,
} from "./camera";
import {
  cloudToInstances,
  findElementAt,
  findNearestPort,
  flowToInstances,
  getElementBounds,
  getElementPorts,
  resizeStock,
  stockToInstances,
  type Port,
  type ResizeHandle,
} from "./elements";
import { readPalette } from "./palette";
import { createElementStore, createFlow } from "../sd/store";
import type { Flow, SDElement, Stock, ToolMode } from "../sd/types";
import { GLYPH_H, bakeGlowAtlasCanvas, charToGlyphIdx } from "./vram/glowAtlas";
import { VRAMRenderer, type RenderInstance } from "./vram/renderer";
import { SpatialIndex } from "./spatial-index";
import { DirtyRectTracker } from "./dirty-rect";
import { PerformanceProbe } from "./perf-probe";
import { MinimapProjector } from "./minimap";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { PromptPanel } from "./PromptPanel";
import { PropertyPanel } from "./PropertyPanel";
import { promptStore } from "./promptStore";

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

// Resize handle hit-zone half-size in screen pixels (AC-7 调整大小). A 12 px
// square centred on each stock corner — slightly larger than the 8 px drawn
// handle for usability. Cloud is a fixed 6×3 icon (AC-12) and is not resizable.
const RESIZE_HANDLE_HALF_PX = 6;

/** CSS cursor for a given corner handle (diagonal pairs share an axis). */
function cursorForHandle(h: ResizeHandle): string {
  return h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize";
}

/**
 * Hit-test the four corner handles of a stock in screen space (AC-7 resize).
 * Returns the handle under (sx, sy), or null when the pointer is not on a
 * corner. Pure worldToScreen math — works in jsdom (no DOM layout needed).
 */
function hitResizeHandle(
  sx: number,
  sy: number,
  stock: Stock,
  cam: Camera,
  vp: Viewport,
): ResizeHandle | null {
  const corners: ReadonlyArray<readonly [ResizeHandle, number, number]> = [
    ["nw", stock.x, stock.y],
    ["ne", stock.x + stock.width, stock.y],
    ["sw", stock.x, stock.y + stock.height],
    ["se", stock.x + stock.width, stock.y + stock.height],
  ];
  for (const [h, wx, wy] of corners) {
    const [csx, csy] = worldToScreen(cam, vp, wx, wy);
    if (
      Math.abs(sx - csx) <= RESIZE_HANDLE_HALF_PX &&
      Math.abs(sy - csy) <= RESIZE_HANDLE_HALF_PX
    ) {
      return h;
    }
  }
  return null;
}

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

// Element store (module-level singleton — single-user local app).
// Swap out for Y.Doc in Story 1a.4 / collab AD-10.
const elementStore = createElementStore();
const spatialIndex = new SpatialIndex(elementStore);
const dirtyTracker = new DirtyRectTracker();
const perfProbe = new PerformanceProbe();
// CR H4: last camera/viewport used by the __e2e__.buildInstances hook so it
// returns the culled set (matching the live render) instead of every element.
// Updated at the end of each draw(). Module-level (single CanvasView instance).
let lastCam: Camera | null = null;
let lastVp: Viewport | null = null;

// Story 1a.6: minimap projector — module-level singleton (same pattern as
// elementStore / spatialIndex / dirtyTracker / perfProbe). Instantiated on
// mount, disposed on unmount. Exposed via __e2e__ for Playwright tests.
let minimapProjector: MinimapProjector | null = null;

// Story 1a.7: e2e test hooks — resolved lazily after component mount.
let _e2eSetSelectedId: ((id: string | null) => void) | null = null;
let _e2eGetToolMode: (() => string) | null = null;

export { elementStore, spatialIndex, dirtyTracker, perfProbe, minimapProjector };

// e2e test hook — expose store + spatialIndex + createFlow on window for
// Playwright (dev only). Story 1a.5 extends __e2e__ with culling stats.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).__e2e__ = {
    elementStore,
    spatialIndex,
    dirtyTracker,
    perfProbe,
    createFlow,
    buildInstances: () =>
      buildInstancesFromStore(
        null,
        lastCam && lastVp ? { spatialIndex, cam: lastCam, vp: lastVp } : undefined,
      ),
    /** Bulk-seed N stock elements in a grid for perf/culling e2e (Story 1a.5 AC-9).
     *  Uses setElements (single notify) to avoid O(n²) subscription cascade. */
    seedBulk: (n: number) => {
      const cols = Math.ceil(Math.sqrt(n));
      const stocks: any[] = [];
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        stocks.push({
          id: crypto.randomUUID(),
          kind: "stock",
          name: `s${i}`,
          x: col * 20 - cols * 10,
          y: row * 10 - (n / cols) * 5,
          width: 8,
          height: 4,
          initialValue: i,
          currentValue: i,
          history: [i],
          units: "",
          allowNegative: false,
        });
      }
      elementStore.setElements(stocks);
    },
    charToGlyphIdx,
    // Story 1a.6: minimap e2e hooks (AC-9).
    get minimapProjector() {
      return minimapProjector;
    },
    get minimapDirtyTracker() {
      return minimapProjector?.dirtyTracker ?? null;
    },
    getHighlightBox: () => minimapProjector?.getHighlightBox() ?? null,
    jumpToWorld: (px: number, py: number) =>
      minimapProjector?.jumpToWorld(px, py) ?? { x: 0, y: 0 },
    // Story 1a.7: e2e hooks for toolbar/statusbar tests (AC-13).
    setSelectedElementId: (id: string | null) => {
      // This function name is resolved lazily — the actual ref is set on mount.
      // We store a callback that CanvasView's internal selectedIdRef will resolve.
      (_e2eSetSelectedId as ((id: string | null) => void) | null)?.(id);
    },
    getToolMode: () => {
      return (_e2eGetToolMode as (() => string) | null)?.() ?? "select";
    },
  };
}

// Seed sample stocks for development / first screen (replaces the old
// `buildBootInstances` static ASCII placeholder).
function seedSampleStocks() {
  elementStore.createStock({
    name: "Population",
    x: -8,
    y: -6,
    width: 14,
    height: 5,
    initialValue: 1_000_000,
    units: "people",
    allowNegative: false,
  });
  elementStore.createStock({
    name: "CO₂",
    x: 6,
    y: -6,
    width: 12,
    height: 5,
    initialValue: 420,
    units: "ppm",
    allowNegative: false,
  });
  elementStore.createStock({
    name: "GDP",
    x: -2,
    y: 3,
    width: 14,
    height: 5,
    initialValue: 25000,
    units: "B$",
    allowNegative: false,
  });
}
// Seed on first mount only — not at module init, so the empty-state test can
// clear the store and verify guidance text (AR#12 / AC-16).

/**
 * Detect whether the camera or viewport changed since the previous frame
 * (Story 1a.5 AC-3, CS钉死 #5 Branch-1 trigger). A viewport resize counts as
 * a change: the gl backing-store must resize in lockstep with the 2D surface,
 * otherwise the stale gl canvas is CSS-stretched over the fresh grid (CR H1).
 *
 * Exported as a pure function so the resize-as-camera-change invariant can be
 * unit-tested directly - jsdom has no WebGL2 (rendererRef stays null, so
 * renderer.render() is a no-op and cannot be spied); locking the Branch-1
 * trigger condition here is the equivalent regression guard for the resize
 * glitch. The full resize -> gl redraw path is verified via the Playwright
 * visual gate.
 */
export function computeCameraChanged(
  prevCam: Camera | null,
  prevVp: { width: number; height: number } | null,
  cam: Camera,
  vp: { width: number; height: number },
): boolean {
  return (
    prevCam === null ||
    prevCam.x !== cam.x ||
    prevCam.y !== cam.y ||
    prevCam.zoom !== cam.zoom ||
    prevVp === null ||
    prevVp.width !== vp.width ||
    prevVp.height !== vp.height
  );
}

function buildInstancesFromStore(
  selectedId: string | null,
  opts?: { spatialIndex?: SpatialIndex | null; cam?: Camera; vp?: Viewport },
): RenderInstance[] {
  const out: RenderInstance[] = [];

  // Viewport culling (Story 1a.5 AC-2): use spatial index when available.
  let elements: readonly SDElement[];
  let cullStats: { total: number; visible: number } | null = null;
  if (opts?.spatialIndex && opts?.cam && opts?.vp) {
    const rect = viewportToWorldRect(opts.cam, opts.vp);
    const allElements = elementStore.getElements();
    const visible = opts.spatialIndex.search(rect);
    // Always include the selected element even if it's outside the viewport
    // (e.g. after a drag that pushed it partially off-screen).
    if (selectedId && !visible.some((e) => e.id === selectedId)) {
      const sel = allElements.find((e) => e.id === selectedId);
      if (sel) visible.push(sel);
    }
    elements = visible;
    cullStats = { total: allElements.length, visible: visible.length };
  } else {
    elements = elementStore.getElements();
  }

  // Expose cull stats on window for e2e assertions (dev only).
  // NOTE: direct property assignment preserves getter-based minimap hooks
  // (Story 1a.6) — Object spread evaluates getters into static values.
  if (typeof window !== "undefined" && import.meta.env.DEV && cullStats) {
    (window as any).__e2e__.cullStats = cullStats;
  }

  // 1. Flow instances first (edges below nodes — CS钉死 z-order).
  // When culling, pass the FULL element set to flowToInstances so it can find
  // source/target stocks even if they're outside the viewport.
  const allElements = elementStore.getElements();
  for (const el of elements) {
    if (el.kind !== "flow") continue;
    const flow = el as Flow;
    const selected = el.id === selectedId;
    const instances = flowToInstances(flow, allElements, selected);
    for (const ri of instances) out.push(ri);
  }

  // 2. Stock + cloud instances (nodes above edges).
  for (const el of elements) {
    if (el.kind === "stock") {
      const selected = el.id === selectedId;
      const instances = stockToInstances(el as Stock, false, selected);
      for (const ri of instances) out.push(ri);
    } else if (el.kind === "cloud") {
      const selected = el.id === selectedId;
      const instances = cloudToInstances(el, selected);
      for (const ri of instances) out.push(ri);
    }
  }
  return out;
}

export function CanvasView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const warnElRef = useRef<HTMLDivElement>(null);
  // VRAM glyph overlay (AD-9). glCanvas is a second <canvas> stacked above the
  // 2D surface; renderer is null when WebGL2 is unavailable (jsdom / old
  // browsers) -> degrade to grid-only. instances holds the first-screen
  // placeholder glyphs (business glyphs arrive in 1a.3/1a.4).
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  // Story 1a.6: minimap 2D canvas overlay (non-VRAM path, AC-1).
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VRAMRenderer | null>(null);
  const instancesRef = useRef<RenderInstance[]>([]);

  // Initial zoom gives an on-screen cell width of ~16px. The VRAM glyph
  // renderer's quadWorldSize is expressed in world units where 1 world unit
  // maps to `zoom` screen pixels (see /vram harness which uses zoom=24 for a
  // 24px cell). At zoom=1 the glyphs rasterize to ~1px and read back as all
  // zeros under SwiftShader headless (M6 CR followup), so the default must be
  // a readable cell size from the first frame.
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 16 });
  const prevCamRef = useRef<Camera | null>(null); // Story 1a.5: camera-change detection for 3-branch render
  const vpRef = useRef<Viewport>({ width: 0, height: 0 });
  // CR H1: viewport-change detection for the 3-branch render decision. A resize
  // changes viewport dims without touching cam.x/y/zoom, so it must be tracked
  // separately to trigger Branch 1 (full WebGL redraw + gl backing-store resize).
  const prevVpRef = useRef<Viewport | null>(null);
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

  // Element interaction state (Task 7, AC-7).
  // T1.4: lift to React state + keep ref sync for draw loop (mirrors 1a.7 toolMode pattern).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  // Keep ref in sync for render-loop closures.
  selectedIdRef.current = selectedId;
  // Drag state: when active, tracks the world-offset from pointer to element origin.
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number; // world offset: element.x - worldX_at_pointerDown
    offsetY: number;
  }>({ active: false, pointerId: -1, offsetX: 0, offsetY: 0 });
  // Double-click detection: timestamp of last click + clicked element id.
  const clickRef = useRef<{ time: number; id: string }>({ time: 0, id: "" });
  // Resize state (AC-7 调整大小, CR followup L9): when active, tracks which
  // corner handle is being dragged. Stock-only — clouds are a fixed 6×3 icon
  // (AC-12) and have no resize handles.
  const resizeRef = useRef<{
    active: boolean;
    pointerId: number;
    handle: ResizeHandle;
  }>({ active: false, pointerId: -1, handle: "se" });

  // Story 1a.4: tool mode (keyboard-only, toolbar defer 1a.7).
  // Story 1a.7 T7: lifted to React state so Toolbar buttons reflect current mode.
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const toolModeRef = useRef<ToolMode>("select");
  // Keep ref in sync for keyboard handlers and render-loop closures.
  toolModeRef.current = toolMode;

  // Story 1a.7 T8: dt (time step) lifted to React state for toolbar dt selector.
  const [dt, setDt] = useState(0.1);

  // Story 1a.7 T9/T10: imperative refs for zoom slider/label and statusbar live fields.
  const zoomSliderRef = useRef<HTMLInputElement | null>(null);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const elementCountRef = useRef<HTMLSpanElement | null>(null);
  const fpsRef = useRef<HTMLSpanElement | null>(null);

  // Story 1a.4: flow creation drag state (port snap → preview → commit).
  const flowDragRef = useRef<{
    active: boolean;
    pointerId: number;
    fromPort: Port | null;
    previewInstances: RenderInstance[];
  }>({ active: false, pointerId: -1, fromPort: null, previewInstances: [] });

  // Story 1a.4: status-bar warnings (E11 parallel flows, duplicate names).
  const warnRef = useRef<string>("");

  // Story 1a.6: minimap drag state for jump interaction (T4, AC-3).
  const minimapDragRef = useRef<boolean>(false);

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
      const modeLabel: Record<string, string> = {
        select: "V",
        stock: "S",
        cloud: "C",
        flow: "F",
      };
      const tm = toolModeRef.current;
      const modeStr = `[${modeLabel[tm] ?? tm}]`;
      hud.textContent = `${modeStr}  zoom ${zoomPct}%  ·  x ${wx.toFixed(1)}  ·  y ${wy.toFixed(1)}`;
    }

    // Story 1a.7 T9: imperative zoom slider + label (mirrors HUD pattern).
    if (zoomSliderRef.current) {
      const rawZoom = cam.zoom;
      // Clamp to slider range; slider handles [0.05, 20].
      const clamped = Math.max(0.05, Math.min(20, rawZoom));
      if (zoomSliderRef.current.valueAsNumber !== clamped) {
        zoomSliderRef.current.valueAsNumber = clamped;
      }
    }
    if (zoomLabelRef.current) {
      const pct = Math.round(cam.zoom * 100);
      zoomLabelRef.current.textContent = `${pct}%`;
    }

    // Story 1a.7 T10: imperative statusbar live fields (element count + FPS).
    if (elementCountRef.current) {
      elementCountRef.current.textContent = String(elementStore.getElements().length);
    }
    if (fpsRef.current) {
      // AC-9: fpsP95<=0 (jsdom no rAF samples / pre-sample window / backgrounded
      // tab) must show the "-" fallback, never "0" (toFixed(0) of fpsP95=0).
      const fps = perfProbe.getMetrics().fpsP95;
      fpsRef.current.textContent = fps > 0 ? fps.toFixed(0) : "-";
    }

    // Empty-state guidance + warnings (also DOM-based, testable in jsdom).
    const guide = guideRef.current;
    if (guide) {
      const isEmpty = elementStore.getElements().length === 0;
      guide.style.display = isEmpty ? "block" : "none";
      if (isEmpty) {
        guide.textContent = "按 S 放置存量 · 按 C 放置源汇 · 按 F 连流量";
      }
    }
    const warn = warnElRef.current;
    if (warn) {
      const msg = warnRef.current;
      warn.style.display = msg ? "block" : "none";
      if (msg) warn.textContent = msg;
    }

    // 6. 3-branch render decision (Story 1a.5 AC-3, CS钉死 #5):
    //    Branch 1 — camera changed or first frame: clear dirty, full rebuild, full WebGL redraw.
    //    Branch 2 — !camera && hasDirty: rebuild visible set, full WebGL redraw of visible.
    //    Branch 3 — !camera && !hasDirty: skip WebGL entirely (static scene, zero GPU).
    //    2D surface (bg, grid, origin, handles) always redraws — O(viewport), not bottleneck.
    const prevCam = prevCamRef.current;
    const prevVp = prevVpRef.current;
    // CR H1: viewport resize counts as a camera change (see computeCameraChanged).
    const cameraChanged = computeCameraChanged(prevCam, prevVp, cam, vp);

    // Story 1a.6: minimap update must run BEFORE the ctx early-return so it
    // remains testable in jsdom (getContext("2d") returns null). The minimap
    // projector does its own ctx null-guard internally.
    minimapProjector?.update(cam, vp, cameraChanged, false);

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

    // 5. selection resize handles (AC-7 调整大小; CR followup L9). Stock-only:
    //    clouds are a fixed 6×3 icon (AC-12) and are not resizable. CAP-11:
    //    fillRect/strokeRect only — no shadowBlur. Drawn on the 2D surface (the
    //    gl glyph overlay stacks above, but corners extend half-outside the box
    //    for visibility). Handles mark where the user can grab to resize.
    const selId = selectedIdRef.current;
    if (selId) {
      const sel = elementStore.getElements().find((el) => el.id === selId);
      if (sel && sel.kind === "stock") {
        const b = getElementBounds(sel);
        const HANDLE = 8; // CSS-px half-size of the drawn handle square
        ctx.lineWidth = 1;
        ctx.strokeStyle = tokens.origin;
        ctx.fillStyle = tokens.bg;
        const corners: ReadonlyArray<readonly [number, number]> = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ];
        for (const [hx, hy] of corners) {
          const [csx, csy] = worldToScreen(cam, vp, hx, hy);
          const x = Math.round(csx) - HANDLE / 2;
          const y = Math.round(csy) - HANDLE / 2;
          ctx.fillRect(x, y, HANDLE, HANDLE);
          ctx.strokeRect(x + 0.5, y + 0.5, HANDLE - 1, HANDLE - 1);
        }
      }
    }

    // 6. 3-branch render decision (Story 1a.5 AC-3, CS钉死 #5):
    if (cameraChanged) {
      dirtyTracker.clear();
    }

    const shouldRenderWebGL = cameraChanged || dirtyTracker.hasDirty();

    if (shouldRenderWebGL) {
      // Branch 1 & 2: full visible rebuild + WebGL redraw.
      instancesRef.current = buildInstancesFromStore(selectedIdRef.current, {
        spatialIndex,
        cam,
        vp,
      });

      // 6a. Prepend flow drag preview if active (Story 1a.4).
      if (flowDragRef.current.active && flowDragRef.current.previewInstances.length > 0) {
        instancesRef.current = [...flowDragRef.current.previewInstances, ...instancesRef.current];
      }

      // 7. VRAM glyph overlay (AD-9). Renders the pre-baked glow atlas via the
      // WebGL2 instanced pipeline on the stacked gl canvas. No-op when WebGL2 is
      // unavailable — rendererRef stays null and the grid-only surface above is
      // the final frame (no shadowBlur fallback; AD-9/CAP-11). The renderer sizes
      // its own backing store from the viewport, so it stays in lockstep with the
      // 2D surface via the shared vpRef/camRef.
      rendererRef.current?.render(cam, vp, instancesRef.current);

      if (!cameraChanged) {
        // Branch 2: drain dirty rects after render.
        dirtyTracker.consume();
      }
    }

    // Track camera + viewport for next frame's change detection (CR H1).
    prevCamRef.current = { x: cam.x, y: cam.y, zoom: cam.zoom };
    prevVpRef.current = { width: vp.width, height: vp.height };
    // CR H4: expose current cam/vp to the __e2e__.buildInstances hook.
    lastCam = cam;
    lastVp = vp;
  };

  // ---- viewport + tokens + ready transition (mount) ----
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    // AR#12 / AC-16: seed default stocks on first mount when the store is empty
    // so the canvas never shows a blank screen. Clearing the store afterward
    // (e.g. to test the empty-state guidance) does NOT re-seed — the seed is
    // only applied once at initial mount.
    // Story 1a.7: wire e2e hooks (resolved lazily for toolbar/statusbar Playwright tests).
    _e2eSetSelectedId = (id: string | null) => {
      selectedIdRef.current = id;
      setSelectedId(id);
      drawRef.current();
    };
    _e2eGetToolMode = () => toolModeRef.current;

    if (elementStore.getElements().length === 0) {
      seedSampleStocks();
    }

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
        instancesRef.current = buildInstancesFromStore(null);
      } catch (err) {
        rendererRef.current = null;
        if (import.meta.env.DEV) {
          console.warn("[CanvasView] WebGL2 unavailable — rendering grid-only", err);
        }
      }
    }

    // Story 1a.5 AC-3: subscribe to element store, diff prev/next elements,
    // and mark dirty rects for changed bboxes before triggering redraw.
    let prevElements: readonly SDElement[] = elementStore.getElements();
    const unsubStore = elementStore.subscribe(() => {
      const nextElements = elementStore.getElements();
      const prevMap = new Map<string, SDElement>(prevElements.map((e) => [e.id, e]));
      const nextMap = new Map<string, SDElement>(nextElements.map((e) => [e.id, e]));

      // Helper: element → WorldRect for dirty marking.
      const bboxOf = (
        el: SDElement,
      ): { minX: number; minY: number; maxX: number; maxY: number } => {
        const b = getElementBounds(el, nextElements);
        return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
      };

      // Added or moved/resized elements.
      for (const [id, el] of nextMap) {
        const prev = prevMap.get(id);
        if (!prev) {
          dirtyTracker.markDirty(bboxOf(el), id);
          continue;
        }
        // Check whether the bbox changed (move / resize / flow-path change).
        const oldB = bboxOf(prev);
        const newB = bboxOf(el);
        if (
          oldB.minX !== newB.minX ||
          oldB.minY !== newB.minY ||
          oldB.maxX !== newB.maxX ||
          oldB.maxY !== newB.maxY
        ) {
          dirtyTracker.markDirty(oldB, id);
          dirtyTracker.markDirty(newB, id);
        }
      }

      // Removed elements.
      for (const [id, el] of prevMap) {
        if (!nextMap.has(id)) {
          dirtyTracker.markDirty(bboxOf(el), id);
        }
      }

      prevElements = nextElements;
      drawRef.current();
    });

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

    // Story 1a.5 AC-7: start performance probe (rAF frame-time sampling).
    // Runs its own rAF loop — independent of drawRef.current().
    perfProbe.start();

    // Story 1a.6: instantiate minimap projector (AC-1). Uses the minimap canvas
    // overlay for 2D projection of all elements + highlight box. Own
    // DirtyRectTracker runs parallel to the main tracker (CS钉死 #4).
    let minimapRO: ResizeObserver | null = null;
    const minimapCanvas = minimapCanvasRef.current;
    if (minimapCanvas) {
      minimapProjector = new MinimapProjector(minimapCanvas, elementStore, spatialIndex);
      // Size the minimap canvas to its CSS layout box.
      const sizeMinimap = () => {
        const w = Math.max(1, Math.floor(minimapCanvas.clientWidth));
        const h = Math.max(1, Math.floor(minimapCanvas.clientHeight));
        const dpr = window.devicePixelRatio || 1;
        minimapCanvas.width = Math.max(1, Math.floor(w * dpr));
        minimapCanvas.height = Math.max(1, Math.floor(h * dpr));
        // Bounds change triggers full projection on next update().
        minimapProjector?.forceFullProject();
        drawRef.current();
      };
      sizeMinimap();
      // ResizeObserver for the minimap canvas (CS钉死 #10).
      minimapRO = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sizeMinimap) : null;
      minimapRO?.observe(minimapCanvas);
    }

    return () => {
      clearTimeout(readyTimer);
      perfProbe.stop();
      minimapRO?.disconnect();
      minimapProjector?.dispose();
      minimapProjector = null;
      _e2eSetSelectedId = null;
      _e2eGetToolMode = null;
      unsubStore();
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

  // ---- Tool mode keyboard switching (Story 1a.4 AC-10, keyboard-only) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      // Only handle bare key presses (no Ctrl/Alt/Meta — allow Shift).
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const map: Record<string, ToolMode> = {
        KeyF: "flow",
        KeyS: "stock",
        KeyC: "cloud",
        KeyV: "select",
      };
      const mode = map[e.code];
      if (mode) {
        e.preventDefault();
        toolModeRef.current = mode;
        setToolMode(mode);
        // Abort any in-progress flow drag when switching modes.
        flowDragRef.current = {
          active: false,
          pointerId: -1,
          fromPort: null,
          previewInstances: [],
        };
        selectedIdRef.current = null;
        setSelectedId(null);
        drawRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Delete / Backspace keyboard handler (Story 1a.7 T5, AC-3) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        const selId = selectedIdRef.current;
        if (selId) {
          elementStore.deleteElement(selId);
          selectedIdRef.current = null;
          setSelectedId(null);
          drawRef.current();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Arrow key movement handler (Story 1a.7 T6, AC-3) ----
  useEffect(() => {
    const MOVE_STEP = 1; // world-unit step per key press
    const onKey = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const selId = selectedIdRef.current;
      if (!selId) return;
      const el = elementStore.getElements().find((x) => x.id === selId);
      if (!el) return;
      let dx = 0;
      let dy = 0;
      if (e.code === "ArrowUp") dy = -MOVE_STEP;
      else if (e.code === "ArrowDown") dy = MOVE_STEP;
      else if (e.code === "ArrowLeft") dx = -MOVE_STEP;
      else if (e.code === "ArrowRight") dx = MOVE_STEP;
      else return;
      e.preventDefault();
      if (el.kind === "stock" || el.kind === "cloud") {
        elementStore.updateElement(el.id, { x: el.x + dx, y: el.y + dy } as Partial<SDElement>);
      }
      // Flow elements don't have position — arrow keys are no-op for them.
      drawRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

    // ---- pan gate: middle button or Space+left ----
    if (middle || spaceLeft) {
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
      return;
    }

    // ---- flow creation: port snap (Story 1a.4 AC-10, keyboard-only toolMode) ----
    if (e.button === 0 && toolModeRef.current === "flow") {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);

      // Build port list from all non-flow elements.
      const elems = elementStore.getElements();
      const ports: Port[] = [];
      for (const el of elems) {
        if (el.kind === "flow") continue;
        for (const p of getElementPorts(el)) ports.push(p);
      }
      const snapTol = 8 / cam.zoom; // screen 8 px → world units (mirrors shouldSnap)
      const port = findNearestPort(wx, wy, ports, snapTol);

      if (port) {
        e.preventDefault();
        try {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        } catch {
          /* jsdom */
        }
        flowDragRef.current = {
          active: true,
          pointerId: e.pointerId,
          fromPort: port,
          previewInstances: [],
        };
        containerRef.current?.style.setProperty("cursor", "crosshair");
        drawRef.current();
        return;
      }
      // If not near a port in flow mode, fall through to miss → clear selection.
    }

    // ---- element interaction: plain left click (Task 7, AC-7) ----
    if (e.button === 0) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);

      // Resize handle hit-test on the currently-selected stock (AC-7 调整大小).
      // Must precede findElementAt so a corner grab (which may extend outside the
      // box) starts a resize, not a body-drag. Clouds are fixed-size (AC-12) —
      // only stocks get handles.
      const selId = selectedIdRef.current;
      if (selId) {
        const sel = elementStore.getElements().find((el) => el.id === selId);
        if (sel && sel.kind === "stock") {
          const handle = hitResizeHandle(sx, sy, sel, cam, vp);
          if (handle) {
            resizeRef.current = { active: true, pointerId: e.pointerId, handle };
            try {
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            } catch {
              // jsdom — resize still works via bubbling.
            }
            containerRef.current?.style.setProperty("cursor", cursorForHandle(handle));
            e.preventDefault();
            return;
          }
        }
      }

      const elements = elementStore.getElements();
      const hit = findElementAt(wx, wy, elements);

      if (hit && hit.kind !== "flow") {
        // Double-click detection: same element within 300 ms → edit name.
        const now = performance.now();
        if (clickRef.current.id === hit.id && now - clickRef.current.time < 300) {
          clickRef.current = { time: 0, id: "" };
          const currentName = (hit as { name?: string }).name ?? "";
          const newName = window.prompt("Edit name:", currentName);
          if (newName !== null && newName.trim().length > 0) {
            try {
              elementStore.updateElement(hit.id, { name: newName.trim() } as Partial<SDElement>);
            } catch {
              // Collision or empty-name rejection (SDR#4 / AC-7b): surface via
              // alert; the original name is preserved (throw prevents write).
              // TODO(1a.9): i18n for this single alert call site.
              window.alert("名称已存在,请重试");
            }
          }
          e.preventDefault();
          return;
        }
        clickRef.current = { time: now, id: hit.id };

        // Select + begin drag (AC-7, AC-14).
        selectedIdRef.current = hit.id;
        setSelectedId(hit.id);
        dragRef.current = {
          active: true,
          pointerId: e.pointerId,
          offsetX: hit.x - wx,
          offsetY: hit.y - wy,
        };
        try {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        } catch {
          // jsdom — drag still works via bubbling.
        }
        drawRef.current();
        e.preventDefault();
        return;
      }

      // Miss: clear selection.
      if (selectedIdRef.current !== null) {
        selectedIdRef.current = null;
        setSelectedId(null);
        drawRef.current();
      }
    }
  };

  const movePan = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    cursorRef.current = { sx, sy };

    // ---- flow creation drag preview (Story 1a.4 AC-10) ----
    if (flowDragRef.current.active && flowDragRef.current.pointerId === e.pointerId) {
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);
      const fp = flowDragRef.current.fromPort!;
      const preview: RenderInstance[] = [];
      const pushPrev = (ch: string, worldX: number, worldY: number, rotation = 0) => {
        const gi = charToGlyphIdx(ch);
        if (gi < 0) return;
        preview.push({
          glyphIdx: gi,
          lumaIdx: 3,
          colorIdx: 1,
          worldX,
          worldY,
          entityType: 2,
          zOrder: 0,
          rotation,
          selected: true,
        });
      };
      const dx = wx - fp.x;
      const dy = wy - fp.y;
      const stepX = dx > 0 ? 1 : -1;
      const stepY = dy > 0 ? 1 : -1;
      const rx = Math.round(fp.x);
      const ry = Math.round(fp.y);
      const tx = Math.round(wx);
      const ty = Math.round(wy);
      // H-segment
      if (dx !== 0) {
        for (let x = rx + stepX; stepX > 0 ? x <= tx : x >= tx; x += stepX) {
          if (dy === 0 && x === tx) break; // arrow replaces last h-glyph
          pushPrev("─", x, ry);
        }
      }
      // V-segment
      if (dy !== 0) {
        for (let y = ry + stepY; stepY > 0 ? y < ty : y > ty; y += stepY) {
          pushPrev("│", tx, y);
        }
      }
      // Arrowhead at cursor
      const arrowRot = dy !== 0 ? (dy > 0 ? Math.PI / 2 : -Math.PI / 2) : dx > 0 ? 0 : Math.PI;
      pushPrev("▶", tx, ty, arrowRot);
      flowDragRef.current.previewInstances = preview;
      drawRef.current();
      return;
    }

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

    // ---- element resize (AC-7 调整大小: snap + clamp ≥3) ----
    if (resizeRef.current.active && resizeRef.current.pointerId === e.pointerId) {
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);
      // Snap the pointer to the grid before computing new dims (AC-1/2/3).
      const rX = shouldSnap(wx, cam.zoom) ? snapToGrid(wx) : wx;
      const rY = shouldSnap(wy, cam.zoom) ? snapToGrid(wy) : wy;
      const id = selectedIdRef.current;
      if (id) {
        const sel = elementStore.getElements().find((el) => el.id === id);
        if (sel && sel.kind === "stock") {
          const next = resizeStock(sel, resizeRef.current.handle, rX, rY);
          elementStore.updateElement(id, next as Partial<SDElement>);
        }
      }
      drawRef.current();
      return;
    }

    // ---- element drag (AC-7: snapToGrid + shouldSnap tolerance) ----
    if (dragRef.current.active && dragRef.current.pointerId === e.pointerId) {
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);
      const rawX = wx + dragRef.current.offsetX;
      const rawY = wy + dragRef.current.offsetY;
      const newX = shouldSnap(rawX, cam.zoom) ? snapToGrid(rawX) : rawX;
      const newY = shouldSnap(rawY, cam.zoom) ? snapToGrid(rawY) : rawY;
      const id = selectedIdRef.current;
      if (id) {
        elementStore.updateElement(id, { x: newX, y: newY } as Partial<SDElement>);
      }
      drawRef.current();
      return;
    }

    if (!panRef.current.active) {
      // Hover-resize cursor: when idle over a selected stock's handle, show a
      // resize cursor so the affordance is discoverable before pressing. Falls
      // back to the space-aware default otherwise.
      let cursor = panRef.current.spaceDown ? "grab" : "default";
      const sid = selectedIdRef.current;
      if (sid && !panRef.current.spaceDown) {
        const sel = elementStore.getElements().find((el) => el.id === sid);
        if (sel && sel.kind === "stock") {
          const h = hitResizeHandle(sx, sy, sel, camRef.current, vpRef.current);
          if (h) cursor = cursorForHandle(h);
        }
      }
      containerRef.current?.style.setProperty("cursor", cursor);
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

    // ---- flow creation completion (Story 1a.4 AC-10) ----
    if (flowDragRef.current.active && flowDragRef.current.pointerId === e.pointerId) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = camRef.current;
      const vp = vpRef.current;
      const [wx, wy] = screenToWorld(cam, vp, sx, sy);
      const fp = flowDragRef.current.fromPort!;

      // Build port list from all non-flow elements.
      const elems = elementStore.getElements();
      const ports: Port[] = [];
      for (const el of elems) {
        if (el.kind === "flow") continue;
        for (const p of getElementPorts(el)) ports.push(p);
      }
      const snapTol = 8 / cam.zoom;
      const port = findNearestPort(wx, wy, ports, snapTol);

      if (port && port.elementId !== fp.elementId) {
        // Valid target port found — create flow.
        try {
          createFlow(
            elementStore,
            {
              fromId: fp.elementId,
              toId: port.elementId,
              formula: "1",
              isVariable: false,
            },
            (msg) => {
              warnRef.current = msg ?? "";
            },
          );
        } catch (err: unknown) {
          warnRef.current = err instanceof Error ? err.message : "Flow creation failed";
        }
      }

      // Reset flow drag state.
      flowDragRef.current = {
        active: false,
        pointerId: -1,
        fromPort: null,
        previewInstances: [],
      };
      containerRef.current?.style.setProperty("cursor", "crosshair");
      drawRef.current();
      return;
    }

    // Drop out of pinch as soon as we go back below two fingers.
    if (pinchRef.current.active && pointersRef.current.size < 2) {
      pinchRef.current = { active: false, prevDist: 0 };
    }

    const p = panRef.current;
    if (p.active && p.pointerId === e.pointerId) {
      e.preventDefault();
      p.active = false;
    }

    // End element drag.
    if (dragRef.current.active && dragRef.current.pointerId === e.pointerId) {
      dragRef.current.active = false;
    }

    // End element resize (AC-7).
    if (resizeRef.current.active && resizeRef.current.pointerId === e.pointerId) {
      resizeRef.current.active = false;
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

  // ---- minimap jump interaction (Story 1a.6 T4, AC-3) -----------------------
  // Click/drag on the minimap canvas recenters the camera to the corresponding
  // world position via minimapToWorld inverse transform. Camera zoom is preserved.
  // Dragging gives continuous recenter (pointerdown→pointermove→pointerup).

  const beginMinimapJump = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Convert CSS-pixel offset to canvas-internal pixels (canvas.width = clientWidth * dpr).
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    if (minimapProjector) {
      const world = minimapProjector.jumpToWorld(px, py);
      camRef.current = clampCamera({ ...camRef.current, x: world.x, y: world.y });
      drawRef.current();
      minimapDragRef.current = true;
    }
    // Capture so pointermove still fires even if the finger leaves the minimap rect.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // jsdom compat — capture unsupported, drag still works via bubbling.
    }
  };

  const moveMinimapJump = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!minimapDragRef.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const px = (e.clientX - rect.left) * dpr;
    const py = (e.clientY - rect.top) * dpr;
    if (minimapProjector) {
      const world = minimapProjector.jumpToWorld(px, py);
      camRef.current = clampCamera({ ...camRef.current, x: world.x, y: world.y });
      drawRef.current();
    }
  };

  const endMinimapJump = (_e: React.PointerEvent<HTMLCanvasElement>) => {
    minimapDragRef.current = false;
  };

  // ── Story 1a.7 handler functions (T5, T8, T9, T11) ──

  const handleDelete = () => {
    const selId = selectedIdRef.current;
    if (selId) {
      elementStore.deleteElement(selId);
      selectedIdRef.current = null;
      setSelectedId(null);
      drawRef.current();
    }
  };

  const handleNew = async () => {
    // Story 1a.7 CS-pinned #7: 新建 = new model - clear all elements, clear
    // selection, reset camera to {0,0,16}. Guard with a confirm when elements
    // exist (misclick protection; removable once Epic 4 undo lands). The
    // confirm is non-modal: it lands in the PromptPanel (bottom area) and
    // handleNew awaits its promise before clearing.
    if (elementStore.getElements().length > 0) {
      const ok = await promptStore.confirm("新建将清空当前画布上的所有元素，确定吗?");
      if (!ok) return;
    }
    elementStore.setElements([]);
    selectedIdRef.current = null;
    setSelectedId(null);
    camRef.current = clampCamera({ x: 0, y: 0, zoom: 16 });
    drawRef.current();
  };

  const handleZoomChange = (zoom: number) => {
    camRef.current = clampCamera({ ...camRef.current, zoom });
    drawRef.current();
  };

  return (
    <div className="ns-layout">
      {/* Story 1a.7 AC-1: top toolbar (6 control groups, Chinese labels, semantic roles). */}
      <Toolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        dt={dt}
        setDt={setDt}
        onDelete={handleDelete}
        onNew={handleNew}
        zoomSliderRef={zoomSliderRef}
        zoomLabelRef={zoomLabelRef}
        onZoomChange={handleZoomChange}
      />

      <div className="ns-workspace">
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
          {/* Story 1a.6: minimap 2D canvas overlay (AC-1). Positioned bottom-right,
              above zoom controls. Own pointer events for jump interaction (T4). */}
          <canvas
            ref={minimapCanvasRef}
            className="ns-canvas__minimap"
            onPointerDown={beginMinimapJump}
            onPointerMove={moveMinimapJump}
            onPointerUp={endMinimapJump}
            onPointerCancel={endMinimapJump}
          />
          <span ref={hudRef} className="ns-canvas__hud" aria-live="polite" />
          <div
            ref={warnElRef}
            className="ns-canvas__warn"
            role="alert"
            style={{ display: "none" }}
          />
          <div
            ref={guideRef}
            className="ns-canvas__guide"
            role="status"
            style={{ display: "none" }}
          />
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

        {/* Story 1a.8 T1: property panel sidebar (right of canvas). */}
        <PropertyPanel elementStore={elementStore} selectedId={selectedId} />
      </div>

      {/* Story 1a.7: prompt center (online-game style message log) - collapsed
          single row above the statusbar; expands to a resizable log. Hosts the
          新建 confirm (F-1-4) and future info/toast/game messages. */}
      <PromptPanel />

      {/* Story 1a.7 AC-8: bottom statusbar (7 fields, aria-live). */}
      <StatusBar elementCountRef={elementCountRef} fpsRef={fpsRef} />
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
