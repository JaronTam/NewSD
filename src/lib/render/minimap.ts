// Minimap projector (Story 1a.6, AC-1/AC-4).
// 2D canvas overlay rendering world overview + highlight box.
// Non-VRAM path — no glyph rendering, no shadowBlur risk (CAP-11/AD-9).
//
// CS 决策 #1: projection = positioning dots/blocks (low-precision, no ASCII glyphs)
// CS 决策 #2: queryLowPrecision step = max(1, round(MINIMAP_DIRTY_CELL_PX / minimapScale))
// CS 决策 #3: 3-branch update (camera→highlight-only, dirty→incremental, else→skip)
// CS 决策 #4: independent DirtyRectTracker (parallel to main tracker, no drain coupling)
// CS 决策 #9: world bounds = min/max bbox + padding, single/collocated uses min span

import type { Camera, Viewport, WorldRect } from "./camera";
import { viewportToWorldRect, WORLD_CLAMP } from "./camera";
import { DirtyRectTracker } from "./dirty-rect";
import type { SpatialIndex } from "./spatial-index";
import type { ElementStore } from "../sd/store";
import type { SDElement } from "../sd/types";
import { getElementBounds } from "./elements";

// ---- constants -----------------------------------------------------------

/** Default minimap dirty-cell size in minimap pixels (CS 决策 #2). */
export const MINIMAP_DIRTY_CELL_PX = 4;
/** Default padding inside the minimap canvas (pixels). */
const DEFAULT_PADDING = 8;
/** Minimum world span for single-element / collocated case (CS 决策 #9). */
const MIN_WORLD_SPAN = 1;
/** Placeholder text shown when zero elements exist (AC-5). */
const PLACEHOLDER_TEXT = "No elements";
/** Element-type fill colours (2D canvas, not design tokens — minimap is always dark). */
const COLOR_STOCK = "#4a9eff";
const COLOR_CLOUD = "#b0b0b0";
const COLOR_FLOW = "#ff6b6b";
const COLOR_HIGHLIGHT = "rgba(255,255,255,0.7)";
const HIGHLIGHT_LINE_WIDTH = 1.5;

// ---- MinimapProjector ----------------------------------------------------

export class MinimapProjector {
  /** Independent dirty-rect tracker for minimap (CS 决策 #4). */
  readonly dirtyTracker: DirtyRectTracker;

  private readonly canvas: HTMLCanvasElement;
  private readonly elementStore: ElementStore;
  private readonly spatialIndex: SpatialIndex;
  private readonly padding: number;

  // Derived per-frame state
  private worldBounds: WorldRect | null = null;
  private minimapScale = 1;
  private needsFullProject = true;

  // Store-subscription bookkeeping
  private storeUnsub: (() => void) | null = null;
  private prevElements: readonly SDElement[] = [];
  private lastElementCount = 0;

  // Per-frame highlight box (set by drawHighlightBox, read by getHighlightBox for __e2e__)
  private _highlightBox: WorldRect | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    elementStore: ElementStore,
    spatialIndex: SpatialIndex,
    padding: number = DEFAULT_PADDING,
  ) {
    this.canvas = canvas;
    this.elementStore = elementStore;
    this.spatialIndex = spatialIndex;
    this.padding = padding;
    this.dirtyTracker = new DirtyRectTracker();

    // Snapshot initial state.
    this.prevElements = [...elementStore.getElements()];
    this.lastElementCount = this.prevElements.length;

    // Parallel subscription to element store (same diff pattern as main
    // tracker in CanvasView, but marks minimap's own dirtyTracker).
    this.storeUnsub = elementStore.subscribe(() => {
      const nextElements = elementStore.getElements();
      const prevMap = new Map(this.prevElements.map((e) => [e.id, e]));
      const nextMap = new Map(nextElements.map((e) => [e.id, e]));

      const bboxOf = (el: SDElement): WorldRect => {
        const b = getElementBounds(el, nextElements);
        return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
      };

      // 0→1 transition → full projection (AC-6).
      if (this.lastElementCount === 0 && nextElements.length > 0) {
        this.needsFullProject = true;
      }

      for (const [id, el] of nextMap) {
        const prev = prevMap.get(id);
        if (!prev) {
          const b = bboxOf(el);
          this.dirtyTracker.markDirty(b, id);
          // A new element may lie outside the current world bounds (CR Run 1
          // F-B): an incremental redraw would paint it off-canvas (invisible)
          // and the bounds wouldn't expand to fit it. Force a full reproject so
          // worldBounds rescales to include the new element.
          const wb = this.worldBounds;
          if (!wb || b.minX < wb.minX || b.minY < wb.minY || b.maxX > wb.maxX || b.maxY > wb.maxY) {
            this.needsFullProject = true;
          }
          continue;
        }
        const oldB = bboxOf(prev);
        const newB = bboxOf(el);
        if (
          oldB.minX !== newB.minX ||
          oldB.minY !== newB.minY ||
          oldB.maxX !== newB.maxX ||
          oldB.maxY !== newB.maxY
        ) {
          this.dirtyTracker.markDirty(oldB, id);
          this.dirtyTracker.markDirty(newB, id);
        }
      }

      // Removal → full recompute (bounds may shrink).
      for (const id of prevMap.keys()) {
        if (!nextMap.has(id)) {
          this.needsFullProject = true;
          break;
        }
      }

      this.prevElements = [...nextElements];
      this.lastElementCount = nextElements.length;
    });
  }

  // ---- world ↔ minimap transforms ----------------------------------------

  /** World coordinate → minimap pixel. */
  worldToMinimap(wx: number, wy: number): [number, number] {
    if (!this.worldBounds) return [0, 0];
    return [
      (wx - this.worldBounds.minX) * this.minimapScale + this.padding,
      (wy - this.worldBounds.minY) * this.minimapScale + this.padding,
    ];
  }

  /** Minimap pixel → world coordinate (inverse, for jump interaction). */
  minimapToWorld(px: number, py: number): [number, number] {
    if (!this.worldBounds) return [0, 0];
    return [
      (px - this.padding) / this.minimapScale + this.worldBounds.minX,
      (py - this.padding) / this.minimapScale + this.worldBounds.minY,
    ];
  }

  /** Current minimap → world scale factor (world units per minimap pixel). */
  get scale(): number {
    return this.minimapScale > 0 ? 1 / this.minimapScale : 1;
  }

  // ---- world-bounds computation ------------------------------------------

  /**
   * Compute the world rectangle that encompasses all elements.
   * Single / collocated elements get a minimum span (CS 决策 #9).
   */
  private computeWorldBounds(elements: readonly SDElement[]): WorldRect | null {
    if (elements.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      const b = getElementBounds(el, elements);
      if (b.width === 0 && b.height === 0) continue; // degenerate flow
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }

    if (!Number.isFinite(minX)) return null; // all elements degenerate

    // Minimum span for single / collocated elements (CS 决策 #9).
    if (maxX - minX < MIN_WORLD_SPAN) {
      const midX = (minX + maxX) / 2;
      minX = midX - MIN_WORLD_SPAN / 2;
      maxX = midX + MIN_WORLD_SPAN / 2;
    }
    if (maxY - minY < MIN_WORLD_SPAN) {
      const midY = (minY + maxY) / 2;
      minY = midY - MIN_WORLD_SPAN / 2;
      maxY = midY + MIN_WORLD_SPAN / 2;
    }

    // Clamp to WORLD_CLAMP (E7 precision guard).
    return {
      minX: Math.max(-WORLD_CLAMP, minX),
      minY: Math.max(-WORLD_CLAMP, minY),
      maxX: Math.min(WORLD_CLAMP, maxX),
      maxY: Math.min(WORLD_CLAMP, maxY),
    };
  }

  /** Recompute world bounds + minimap scale from the current element set. */
  private recomputeWorldBounds(): void {
    const elements = this.elementStore.getSnapshot();
    this.worldBounds = this.computeWorldBounds(elements);
    if (this.worldBounds) {
      const drawW = Math.max(1, this.canvas.width - this.padding * 2);
      const drawH = Math.max(1, this.canvas.height - this.padding * 2);
      const worldW = this.worldBounds.maxX - this.worldBounds.minX || MIN_WORLD_SPAN;
      const worldH = this.worldBounds.maxY - this.worldBounds.minY || MIN_WORLD_SPAN;
      this.minimapScale = Math.min(drawW / worldW, drawH / worldH);
    }
  }

  // ---- drawing helpers ---------------------------------------------------

  /** Clear the entire minimap canvas. */
  private clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Fill the minimap background. */
  private drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Draw a single element as a low-precision dot / block (CS 决策 #1). */
  private drawElementDot(
    ctx: CanvasRenderingContext2D,
    el: SDElement,
    elements: readonly SDElement[],
    index: Map<string, SDElement>,
  ): void {
    const b = getElementBounds(el, elements);
    if (b.width === 0 && b.height === 0) return;

    const [px, py] = this.worldToMinimap(b.x, b.y);
    const [px2, py2] = this.worldToMinimap(b.x + b.width, b.y + b.height);

    const w = Math.max(1, px2 - px);
    const h = Math.max(1, py2 - py);

    switch (el.kind) {
      case "stock":
        ctx.fillStyle = COLOR_STOCK;
        ctx.fillRect(px, py, w, h);
        break;
      case "cloud": {
        ctx.fillStyle = COLOR_CLOUD;
        const cx = px + w / 2;
        const cy = py + h / 2;
        const r = Math.max(1.5, Math.min(w, h) / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "flow": {
        // Flow: draw a line from source center to target center.
        // O(1) endpoint lookup via the caller-built id index (CR Run 1 F-F),
        // avoiding an O(n) find() per flow inside the projection loop.
        const fromEl = index.get(el.fromId);
        const toEl = index.get(el.toId);
        if (fromEl && toEl) {
          const fb = getElementBounds(fromEl, elements);
          const tb = getElementBounds(toEl, elements);
          const [fx, fy] = this.worldToMinimap(fb.x + fb.width / 2, fb.y + fb.height / 2);
          const [tx, ty] = this.worldToMinimap(tb.x + tb.width / 2, tb.y + tb.height / 2);
          ctx.strokeStyle = COLOR_FLOW;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        break;
      }
    }
  }

  // ---- projection methods ------------------------------------------------

  /** Full projection: draw every element (mount / bulk / first element). */
  private fullProject(ctx: CanvasRenderingContext2D): void {
    const elements = this.elementStore.getSnapshot();
    this.recomputeWorldBounds();
    if (elements.length === 0) {
      this.drawPlaceholder(ctx);
      return;
    }
    const index = new Map(elements.map((e) => [e.id, e]));
    for (const el of elements) {
      this.drawElementDot(ctx, el, elements, index);
    }
  }

  /**
   * Incremental projection: query dirty tracker for coarse rects, search
   * spatial index for elements in those rects, redraw only those elements.
   * Before redrawing dirty elements, clear their old minimap region.
   */
  private incrementalProject(ctx: CanvasRenderingContext2D): void {
    const elements = this.elementStore.getSnapshot();
    // Recompute bounds only if world bounds may have changed (add/remove).
    // For move-only dirty rects, bounds are stable.
    if (this.needsFullProject) {
      this.recomputeWorldBounds();
    }

    const step = this.computeDirtyStep();
    const coarseRects = this.dirtyTracker.queryLowPrecision(step);

    // Nothing coarse to redraw, but still drain so hasDirty() doesn't stay true
    // and re-enter this branch every frame (CR Run 1 F-C).
    if (coarseRects.length === 0) {
      this.dirtyTracker.consume();
      return;
    }

    // For each coarse dirty rect, find affected elements and redraw them.
    const redrawIds = new Set<string>();
    for (const rect of coarseRects) {
      const hits = this.spatialIndex.search(rect);
      for (const hit of hits) {
        redrawIds.add(hit.id);
      }
    }

    // Clear and redraw the dirty minimap regions.
    for (const rect of coarseRects) {
      const [mx0, my0] = this.worldToMinimap(rect.minX, rect.minY);
      const [mx1, my1] = this.worldToMinimap(rect.maxX, rect.maxY);
      ctx.clearRect(
        Math.min(mx0, mx1),
        Math.min(my0, my1),
        Math.abs(mx1 - mx0) + 1,
        Math.abs(my1 - my0) + 1,
      );
    }

    // Redraw affected elements. O(1) lookup via a caller-built id index
    // (CR Run 1 F-F) instead of find() per dirty id.
    const index = new Map(elements.map((e) => [e.id, e]));
    for (const id of redrawIds) {
      const el = index.get(id);
      if (el) this.drawElementDot(ctx, el, elements, index);
    }

    // Drain the minimap dirty tracker.
    this.dirtyTracker.consume();
  }

  // ---- highlight box -----------------------------------------------------

  /**
   * Draw the viewport highlight box on the minimap.
   * Called on every frame (camera change → highlight-only update).
   */
  drawHighlightBox(ctx: CanvasRenderingContext2D, cam: Camera, vp: Viewport): void {
    const vr = viewportToWorldRect(cam, vp);
    this._highlightBox = vr;

    const [px0, py0] = this.worldToMinimap(vr.minX, vr.minY);
    const [px1, py1] = this.worldToMinimap(vr.maxX, vr.maxY);

    ctx.strokeStyle = COLOR_HIGHLIGHT;
    ctx.lineWidth = HIGHLIGHT_LINE_WIDTH;
    ctx.strokeRect(
      Math.min(px0, px1),
      Math.min(py0, py1),
      Math.abs(px1 - px0),
      Math.abs(py1 - py0),
    );
  }

  // ---- E8 placeholder ----------------------------------------------------

  /** Draw the "empty" placeholder when zero elements exist (AC-5). */
  private drawPlaceholder(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#666";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(PLACEHOLDER_TEXT, this.canvas.width / 2, this.canvas.height / 2);
  }

  // ---- 3-branch update (CS 决策 #3) ---------------------------------------

  /**
   * Main update entry point. Call from the render loop.
   *
   * Branch 1: cameraChanged || isMountOrBulk → full project (mount/bulk) or
   *           full repaint on camera-only change too (spec amendment, CR Run 1 F-A).
   * Branch 2: !camera && dirtyTracker.hasDirty() → incremental project.
   * Branch 3: !camera && !hasDirty → skip.
   */
  update(cam: Camera, vp: Viewport, cameraChanged: boolean, isMountOrBulk: boolean): void {
    // Always compute the highlight box world rect — pure math, no canvas needed.
    // This keeps __e2e__.getHighlightBox() testable in jsdom (no 2D context).
    this._highlightBox = viewportToWorldRect(cam, vp);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const isEmpty = this.elementStore.getSnapshot().length === 0;

    // Branch 1 — camera change / mount / bulk
    if (cameraChanged || isMountOrBulk || this.needsFullProject) {
      if (isMountOrBulk || this.needsFullProject) {
        // Full redraw: clear → background → elements → highlight
        this.clearCanvas(ctx);
        this.drawBackground(ctx);
        if (isEmpty) {
          this.drawPlaceholder(ctx);
        } else {
          this.fullProject(ctx);
        }
        this.needsFullProject = false;
      } else if (!isEmpty) {
        // Camera-only change: the highlight box needs refreshing;
        // elements haven't moved. But we still need to repaint the
        // background + elements underneath the new highlight position.
        // Per spec amendment (CR Run 1 F-A, accepted tradeoff), we
        // do a full repaint on camera change. Tradeoff: 10000-element
        // continuous pan = O(n)/frame (2D draw lightweight, accepted per
        // AC-4 备注; Branch 2 element-change path stays incremental).
        this.clearCanvas(ctx);
        this.drawBackground(ctx);
        this.fullProject(ctx);
      }
      // Draw highlight on top (always, unless empty).
      if (!isEmpty) {
        this.drawHighlightBox(ctx, cam, vp);
      }
      return;
    }

    // Branch 2 — incremental dirty update
    if (this.dirtyTracker.hasDirty()) {
      if (!isEmpty) {
        this.incrementalProject(ctx);
        this.drawHighlightBox(ctx, cam, vp);
      }
      return;
    }

    // Branch 3 — nothing to do, skip.
  }

  // ---- jump interaction (AC-3) -------------------------------------------

  /**
   * Convert a minimap pixel coordinate to the world point the camera
   * should center on. Returns the world (x, y) — CanvasView applies
   * the camera update and triggers re-render.
   */
  jumpToWorld(px: number, py: number): { x: number; y: number } {
    const [wx, wy] = this.minimapToWorld(px, py);
    return { x: wx, y: wy };
  }

  // ---- dirty-step derivation (CS 决策 #2) ---------------------------------

  /** Compute the queryLowPrecision step for the current minimap scale. */
  computeDirtyStep(): number {
    // guard: avoid division by zero for uninitialized scale
    const scale = this.minimapScale || 0.01;
    return Math.max(1, Math.round(MINIMAP_DIRTY_CELL_PX / scale));
  }

  // ---- __e2e__ helpers ---------------------------------------------------

  /** Expose the current highlight box in world coords (for e2e). */
  getHighlightBox(): WorldRect | null {
    return this._highlightBox;
  }

  /** Force a full projection on the next update. */
  forceFullProject(): void {
    this.needsFullProject = true;
  }

  // ---- lifecycle ---------------------------------------------------------

  /** Unsubscribe from the element store. Call when the minimap is unmounted. */
  dispose(): void {
    this.storeUnsub?.();
    this.storeUnsub = null;
    this.dirtyTracker.clear();
  }
}
