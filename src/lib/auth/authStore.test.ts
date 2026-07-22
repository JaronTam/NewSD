// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - authStore (session token in-memory) (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `it.skip` (TDD RED). DS T22 activates them when
// src/lib/auth/authStore.ts lands (singleton external store + useSyncExternalStore,
// fetchMe GET /api/auth/me + token in-memory ONLY + getUsername). Each header
// declares gov: `AC-N + SDR#M + T-K`.
//
// Product code MUST NOT be touched in ATDD red phase. The `declare` block lets
// this file tsc-compile (runtime undefined); DS replaces it with the real
// `import { fetchMe, getUsername, getToken, subscribe, getSnapshot } from "./authStore"`.
//
// Hard invariant (AD-16/SDR#3/SDR#9): the session token lives in JS memory
// ONLY - it MUST NOT be written to localStorage/sessionStorage (cookie is
// HttpOnly so JS cannot read it; the JSON-body token is held in-memory for WS
// first-frame auth, Epic 3). fetch is stubbed via vi.stubGlobal.
// ══════════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMe, getSnapshot, getToken, getUsername, subscribe } from "./authStore";

interface MeResponse {
  user: { id: string; username: string };
  token: string;
}

function mockFetch(status: number, body: MeResponse | null): void {
  const fn = vi.fn(
    async () =>
      new Response(body ? JSON.stringify(body) : "", {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fn);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AC-8/AC-11: fetchMe GET /api/auth/me", () => {
  it("200 -> 设置 username, getToken 返回 in-memory token", async () => {
    // gov: AC-8 + AC-11 + SDR#3 + SDR#9 + T21(red)/T22(green)
    mockFetch(200, { user: { id: "u1", username: "alice" }, token: "tok-123" });
    await fetchMe();
    expect(getUsername()).toBe("alice");
    expect(getToken()).toBe("tok-123");
  });

  it("401 -> username=null, token=null (未登录)", async () => {
    // gov: AC-11 + SDR#3 + T21(red)/T22(green)
    mockFetch(401, null);
    await fetchMe();
    expect(getUsername()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("subscribe + getSnapshot 驱动 useSyncExternalStore", () => {
    // gov: AC-8 + SDR#3 + T21(red)/T22(green) - external store pattern (project-context L85-87)
    const listener = vi.fn();
    const unsub = subscribe(listener);
    expect(typeof unsub).toBe("function");
    expect(getSnapshot()).toEqual({ username: null, token: null });
    unsub();
  });
});

describe("AC-8/SDR#9: token 仅存 JS 内存, 不入 localStorage", () => {
  it("fetchMe 200 后, token 不写入 localStorage/sessionStorage", async () => {
    // gov: AC-8 + SDR#3 + SDR#6 + SDR#9 + T21(red)/T22(green)
    // Hard invariant (AD-16): token in-memory only; HttpOnly cookie is unreadable
    // by JS, so the JSON-body token must NOT leak to storage.
    mockFetch(200, { user: { id: "u1", username: "alice" }, token: "tok-leak-check" });
    await fetchMe();
    expect(getToken()).toBe("tok-leak-check");
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      expect(localStorage.getItem(k)).not.toContain("tok-leak-check");
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      expect(sessionStorage.getItem(k)).not.toContain("tok-leak-check");
    }
  });
});
