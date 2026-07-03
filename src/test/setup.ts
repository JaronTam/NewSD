import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { cleanup } from "@testing-library/react";

// jsdom has no matchMedia / IntersectionObserver / ResizeObserver. The canvas
// (sub-PR #3) will query these; stub them now so foundation tests stay green.
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
