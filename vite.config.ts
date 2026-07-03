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
});
