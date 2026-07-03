import { createFileRoute } from "@tanstack/react-router";

import { CanvasView } from "../lib/render/CanvasView";

// Story 1a.1 sub-PR #3 (FR-CANVAS-1): infinite canvas navigation — Float64
// world coords, middle-mouse / space+left pan, wheel zoom (0.05-20), 3x2
// affine projection, loading skeleton (F4) + global error boundary (兜底基座
// in __root.tsx). The previous BootScreen is retired; the canvas is the shell.
export const Route = createFileRoute("/")({
  component: CanvasView,
});
