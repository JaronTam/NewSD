// R-tree spatial index for viewport culling (Story 1a.5, AC-1).
// Wraps rbush v4.0.1 (ESM-only, OMT bulk-load) with SDElement id→object
// resolution and incremental store.subscribe sync.
//
// CS钉死 #1: rbush v4.0.1 (not @turf/turf, not hand-rolled)
// CS钉死 #2: index object = SDElement by world bbox (getElementBounds → {minX,minY,maxX,maxY})
// CS钉死 #3: sync = incremental diff (store.subscribe → diff prev/next → insert/remove/update changed only);
//             camera change does NOT re-sync

import RBush from "rbush";
import type { SDElement } from "../sd/types";
import { getElementBounds } from "./elements";
import type { ElementStore } from "../sd/store";
import type { WorldRect } from "./camera";

// ---- rbush item shape (CS钉死) -----------------------------------------

export interface IndexItem {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  id: string;
  kind: string;
}

/** Bbox shape cached per element (matches getElementBounds / toIndexItem input). */
type IndexedBbox = { x: number; y: number; width: number; height: number };

// ---- SpatialIndex ------------------------------------------------------

export class SpatialIndex {
  private readonly tree: RBush<IndexItem>;
  // CR H6: cache the indexed bbox alongside the element so remove() matches the
  // tree entry without recomputing from the (possibly moved) current store.
  private readonly elementMap = new Map<string, { el: SDElement; bbox: IndexedBbox }>();
  private storeUnsub: (() => void) | null = null;
  private prevElements: readonly SDElement[] = [];
  private readonly _elementStore: ElementStore;
  private readonly maxEntries: number;

  constructor(elementStore: ElementStore, maxEntries = 9) {
    this.tree = new RBush<IndexItem>(maxEntries);
    this._elementStore = elementStore;
    this.maxEntries = maxEntries;

    // Subscribe to store changes for auto-sync (CS钉死 #3). Batch replaces
    // (setElements/seedBulk: many added+removed at once) downgrade to a single
    // rbush.load bulk rebuild - O(n log n) OMT vs per-item insert/remove with
    // tree rebalancing (CR H3, CS钉死 #3 PARTIAL -> full).
    this.storeUnsub = elementStore.subscribe(() => {
      const next = elementStore.getElements();
      if (this.isBatchReplace(this.prevElements, next)) {
        this.load(next);
      } else {
        this.sync(this.prevElements, next);
      }
      this.prevElements = [...next];
    });

    // Initial load: bulk-insert whatever is already in the store.
    const initial = elementStore.getElements();
    if (initial.length > 0) {
      this.load(initial);
    }
    this.prevElements = [...initial];
  }

  /**
   * Detect a batch replace (CS钉死 #3): when the added+removed id count exceeds
   * 2*maxEntries, a full bulk-load is cheaper than incremental diff. Threshold
   * tuned so single-element edits still go through sync (incremental).
   */
  private isBatchReplace(prev: readonly SDElement[], next: readonly SDElement[]): boolean {
    const prevIds = new Set(prev.map((e) => e.id));
    const nextIds = new Set(next.map((e) => e.id));
    let changed = 0;
    for (const id of prevIds) if (!nextIds.has(id)) changed++;
    for (const id of nextIds) if (!prevIds.has(id)) changed++;
    return changed > this.maxEntries * 2;
  }

  /** Access the element store (for CanvasView integration). */
  get elementStore(): ElementStore {
    return this._elementStore;
  }

  /** Return the set of elements whose bbox intersects `rect`. */
  search(rect: WorldRect): SDElement[] {
    const hits = this.tree.search(rect);
    const out: SDElement[] = [];
    for (const item of hits) {
      const entry = this.elementMap.get(item.id);
      if (entry) out.push(entry.el);
    }
    return out;
  }

  /** True when any element's bbox intersects `rect`. */
  collides(rect: WorldRect): boolean {
    return this.tree.collides(rect);
  }

  /** Insert a single element into the index. */
  insert(el: SDElement): void {
    const bbox = getElementBounds(el, this._elementStore.getElements());
    if (bbox.width === 0 && bbox.height === 0) return; // skip degenerate (e.g. flow w/o endpoints)
    this.elementMap.set(el.id, { el, bbox });
    this.tree.insert(toIndexItem(el, bbox));
  }

  /** Remove a single element from the index (by id). */
  remove(el: SDElement): void {
    // CR H6: use the cached indexed bbox (set at insert/load time) so the item
    // we remove matches the item actually in the tree, even if the element's
    // endpoints have since moved. Falls back to a fresh compute only when no
    // cached entry exists (e.g. external single remove before any insert).
    const cached = this.elementMap.get(el.id);
    const bbox = cached?.bbox ?? getElementBounds(el, this._elementStore.getElements());
    const item = toIndexItem(el, bbox);
    this.elementMap.delete(el.id);
    this.tree.remove(item, (a, b) => a.id === b.id);
  }

  /** Bulk-load elements (replaces all). Uses rbush.load (OMT, 2-3x faster than per-item insert). */
  load(elements: readonly SDElement[]): void {
    this.elementMap.clear();
    this.tree.clear();

    const items: IndexItem[] = [];
    const allElements = this._elementStore.getElements();
    for (const el of elements) {
      const bbox = getElementBounds(el, allElements);
      if (bbox.width === 0 && bbox.height === 0) continue;
      this.elementMap.set(el.id, { el, bbox });
      items.push(toIndexItem(el, bbox));
    }
    this.tree.load(items);
  }

  /**
   * Incremental sync: diff prev vs next element arrays, only update changed
   * items (CS钉死 #3). Camera change does NOT call this — elements haven't
   * changed, only the viewport has.
   */
  sync(prev: readonly SDElement[], next: readonly SDElement[]): void {
    const allElements = this._elementStore.getElements();

    // Build id→element maps for both snapshots.
    const prevMap = new Map(prev.map((e) => [e.id, e]));
    const nextMap = new Map(next.map((e) => [e.id, e]));

    // Removed: in prev but not in next.
    for (const [id, el] of prevMap) {
      if (!nextMap.has(id)) {
        this.remove(el);
      }
    }

    // Added or updated: in next.
    for (const [id, el] of nextMap) {
      const prevEl = prevMap.get(id);
      if (!prevEl) {
        // New element.
        this.insert(el);
      } else {
        // Check if position/size changed (update = remove + re-insert).
        // CR H2: oldBbox must use PREV-state endpoints (the `prev` array), not
        // the current store (= next). For flows, getElementBounds resolves
        // endpoints from the passed element array; using `allElements` (= next)
        // made oldBbox≡newBbox, so endpoint moves never updated the index and
        // search missed the moved flow (AC-2 无遗漏 violation).
        const oldBbox = getElementBounds(prevEl, prev);
        const newBbox = getElementBounds(el, allElements);
        if (!rectEq(oldBbox, newBbox)) {
          // Remove old item, insert new.
          this.elementMap.delete(id);
          this.tree.remove(toIndexItem(prevEl, oldBbox), (a, b) => a.id === b.id);
          this.elementMap.set(id, { el, bbox: newBbox });
          this.tree.insert(toIndexItem(el, newBbox));
        } else {
          // Element unchanged, but update the stored reference (e.g. name change).
          this.elementMap.set(id, { el, bbox: newBbox });
        }
      }
    }
  }

  /** Unsubscribe from the store. Call when disposing. */
  dispose(): void {
    this.storeUnsub?.();
    this.storeUnsub = null;
    this.elementMap.clear();
    this.tree.clear();
  }
}

// ---- helpers -----------------------------------------------------------

function toIndexItem(
  el: SDElement,
  bbox: { x: number; y: number; width: number; height: number },
): IndexItem {
  return {
    minX: bbox.x,
    minY: bbox.y,
    maxX: bbox.x + bbox.width,
    maxY: bbox.y + bbox.height,
    id: el.id,
    kind: el.kind,
  };
}

function rectEq(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
