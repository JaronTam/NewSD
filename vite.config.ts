import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// TanStack Start SPA mode (zero spec deviation):
//   - produces a prerendered static dist served by the Go binary (AD-18)
//   - no Node runtime in production (AD-3)
//   - keeps the committed stack table literal: TanStack Start ^1.168.26
// tsconfig `@/*` paths resolved natively (Vite ≥5); no tsconfig-paths plugin.
export default defineConfig({
  plugins: [tanstackStart({ spa: { enabled: true } }), viteReact(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  // Prerender spawns Vite's preview server (random port) and crawls it via
  // fetch. With the default host ("localhost") the bind and the fetch URL can
  // resolve to different stacks (IPv4 vs IPv6) inside buildx containers →
  // ConnectionRefused (TanStack retryCount=0 → 7ms failure, no retry).
  // Pin explicit IPv4 127.0.0.1 so bind + fetch URL match (Vite resolveHostname:
  // host="127.0.0.1" → name="127.0.0.1", no DNS resolution). CI host env is
  // unaffected — explicit IPv4 resolves identically there.
  preview: { host: "127.0.0.1" },
});
