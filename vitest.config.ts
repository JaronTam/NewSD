import { defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";

// Vitest config is intentionally separate from vite.config.ts:
// the TanStack Start vite plugin must NOT run during tests (it expects a
// start/router entry and generates routeTree.gen.ts at build time). Tests
// import pure domain modules directly via the @/* path alias.
// tsconfig `@/*` paths resolved natively (Vite ≥5); no tsconfig-paths plugin.
export default defineConfig({
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
