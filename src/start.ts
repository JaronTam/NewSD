import { createStart } from "@tanstack/react-start";

// SPA mode: no server runtime, no request middleware, no server functions.
// createStart returns the start instance whose getOptions() is read at hydrate
// time (for serialization adapters / middleware / serverFns). With none of
// those in the MVP SPA shell, the options object is empty. The Go binary
// serves the prerendered static dist (AD-18); client errors are handled by
// the root route's errorComponent, not server middleware.
export const startInstance = createStart(() => ({}));
