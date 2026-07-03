import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

// TanStack Start resolves `#tanstack-router-entry` to this file and calls
// `getRouter()` to hydrate the SPA. The Register augmentation (router type) is
// generated into routeTree.gen.ts by the start plugin, so it is not declared
// here. SPA mode: no server context, no QueryClient (lean carry).
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}
