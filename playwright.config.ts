import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // WebGL2 requires SwiftShader software rendering in headless CI.
          // --use-gl=angle --use-angle=swiftshader enables the software WebGL2
          // path on Linux & Windows CI runners without a GPU.
          args: ["--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: "npx vite",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  // Snapshot directory for visual regression (AC-16).
  snapshotDir: "./e2e/__snapshots__",
});
