import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { cleanup } from "@testing-library/react";

// jsdom has no matchMedia / ResizeObserver and no 2D canvas context. The
// canvas (sub-PR #3) queries all three; stub them so foundation tests stay
// green and CanvasView's draw() early-returns cleanly (ctx === null) after
// updating the HUD — which is exactly what lets pan/zoom be observed via HUD.
afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  // No-op that fires the callback once synchronously so observing a container
  // yields an initial (zero-size) measurement, matching real ResizeObserver's
  // initial delivery.
  class ResizeObserverStub {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [
          {
            target,
            contentRect: {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              toJSON() {
                return this;
              },
            },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof HTMLCanvasElement !== "undefined") {
  // jsdom logs "Not implemented: getContext" on every call; return null
  // silently (CanvasView handles null gracefully).
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
