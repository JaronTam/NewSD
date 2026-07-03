import { createFileRoute } from "@tanstack/react-router";

// Story 1a.1 foundation: minimal boot screen. The infinite canvas (stock/cloud/
// flow rendering, Float64 pan/zoom, 3x2 affine projection) arrives in sub-PR #3.
// This screen exists to (a) prove the SPA build pipeline end-to-end and
// (b) carry the cyberpunk "form-is-content" aesthetic from the first paint.
export const Route = createFileRoute("/")({
  component: BootScreen,
});

function BootScreen() {
  return (
    <div className="ns-center">
      <pre className="ns-ascii ns-boot-art">{`  ╔═══════════════════════╗
  ║  ░█▀▀░█░█░█▀▄░█▀▄░▀█▀  ║
  ║  ░▀▀█░█▀█░█░█░█▀▄░░█   ║
  ║  ░▀▀▀░▀░▀░▀▀░▀▀░░░▀   ║
  ╚═══════════════════════╝`}</pre>
      <p className="ns-boot-status">system-dynamics · collaborative · ascii</p>
      <p className="ns-boot-note">
        canvas not yet wired — Story 1a.1 sub-PR #3 (infinite canvas navigation)
      </p>
    </div>
  );
}
