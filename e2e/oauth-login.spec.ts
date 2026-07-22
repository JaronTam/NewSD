// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLD - e2e OAuth login (AC-1/AC-11/AC-13/AC-17)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `test.skip` (TDD RED). DS T23 activates them as
// the Go auth backend + FAKE_OAUTH=1 dev-mode fake provider land. Each header
// declares gov: `AC-N + SDR#M + T-K`.
//
// Login route is standard React DOM (NOT WebGL canvas, SDR#22), so DOM
// selectors are viable. The dev-mode fake-provider full flow (Q2 ruling B:
// FAKE_OAUTH=1) requires the Go backend running with that env - DS T23 wires
// the Playwright webServer (or a separate Go server fixture) so /api/auth/*
// is reachable; red-phase tests are skipped so the wiring gap does not break
// the e2e baseline.
//
// AC-13 (scan dist/client zero client_secret) uses Node fs - it is a
// build-artifact assertion, independent of the running server.
// ══════════════════════════════════════════════════════════════════════════════

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

test.describe("AC-1: /login 页渲染 GitHub + Google 登录入口", () => {
  test("renders two provider entries linking to /api/auth/{provider}/start", async ({ page }) => {
    // gov: AC-1 + SDR#1 + T23
    await page.goto("/login");
    const gh = page.getByTestId("ns-login-github");
    const gg = page.getByTestId("ns-login-google");
    await expect(gh).toBeVisible();
    await expect(gg).toBeVisible();
    await expect(gh).toHaveAttribute("href", "/api/auth/github/start");
    await expect(gg).toHaveAttribute("href", "/api/auth/google/start");
  });
});

test.describe("AC-13: grep dist/client 无 client_secret 残留 (SDR#6 硬红线)", () => {
  test("built dist/client contains zero client_secret occurrences", () => {
    // gov: AC-13 + SDR#6 + T23 + F4 (CR Run1)
    // Hard red line: client_secret is server-env-only; it MUST NOT ship in the
    // frontend bundle. `bun run build` must have run before this test.
    // F4: dist/client is gitignored, so `git grep` silently searches nothing
    // (恒 0 hits -> 假 pass). Use a physical recursive scan instead.
    const dist = join(process.cwd(), "dist", "client");
    if (!existsSync(dist)) {
      // DS T23 ensures `bun run build` runs in the e2e setup; skip if absent.
      test.skip(true, "dist/client absent - run `bun run build` first (DS T23 wiring)");
      return;
    }
    const hits: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          scan(p);
          continue;
        }
        try {
          const content = readFileSync(p, "utf8");
          if (/client_secret|CLIENT_SECRET/i.test(content)) hits.push(p);
        } catch {
          // binary or undecodable: skip (cannot contain a readable secret anyway).
        }
      }
    };
    scan(dist);
    expect(hits, `client_secret leaked into bundle: ${hits.join(", ")}`).toEqual([]);
  });
});

test.describe("AC-17: FAKE_OAUTH=1 dev-mode fake provider 全流程 (Q2=B)", () => {
  test("login -> fake authorize -> callback -> session cookie -> /api/auth/me", async ({
    page,
  }) => {
    // gov: AC-1 + AC-3 + AC-8 + AC-11 + SDR#1 + SDR#9 + T23
    // Requires the Go backend running with FAKE_OAUTH=1 (DS T23 webServer wiring).
    await page.goto("/login");
    await page.getByTestId("ns-login-github").click();
    // Fake provider auto-approves -> server callback -> 302 to / with ns-session cookie.
    await page.waitForURL("/");
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "ns-session");
    expect(session, "ns-session cookie set after fake-OAuth callback (AC-8/SDR#9)").toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    // /api/auth/me returns the fake user.
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    const body = await me.json();
    expect(body.user?.username).toBeTruthy();
  });

  test("logout clears the ns-session cookie + session invalidated", async ({ page }) => {
    // gov: AC-11 + SDR#3 + T23
    // Requires FAKE_OAUTH=1 backend (DS T23).
    await page.goto("/login");
    await page.getByTestId("ns-login-github").click();
    await page.waitForURL("/");
    const res = await page.request.post("/api/auth/logout");
    expect([200, 204]).toContain(res.status());
    const after = await page.context().cookies();
    expect(after.find((c) => c.name === "ns-session")?.value ?? "").toBe("");
    // /api/auth/me now 401.
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(401);
  });
});
