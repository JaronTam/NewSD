// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - /login route + E18 toast (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `it.skip` (TDD RED). DS T20 activates them when
// src/routes/login.tsx lands (TanStack file route, two provider entries +
// error query -> promptStore.toast). Each header declares gov: `AC-N + SDR#M + T-K`.
//
// Product code MUST NOT be touched in ATDD red phase. `declare function Login`
// lets this file tsc-compile (runtime undefined); DS replaces the declare with
// the real `import Login from "./login"` (or the TanStack route component) and
// unskips per T19/T20. promptStore is real (existing, 1a.7) - spied, not redeclared.
//
// Login is a standard React DOM route (NOT WebGL canvas, SDR#22) so DOM-selector
// assertions are viable (VS checklist item 11).
// ══════════════════════════════════════════════════════════════════════════════

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { promptStore } from "../lib/render/promptStore";

import { Login } from "./login";

const ERROR_TOAST: Record<string, string> = {
  provider_down: "登录服务暂不可用",
  email_null: "provider 未返回邮箱",
  state_expired: "登录已过期请重试",
};

function setLocationSearch(search: string): void {
  window.history.replaceState({}, "", `/login${search}`);
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/login");
  vi.restoreAllMocks();
});

describe("AC-1: /login 渲染 GitHub + Google 登录入口", () => {
  it("渲染两个入口, href 指向 /api/auth/{provider}/start", () => {
    // gov: AC-1 + SDR#1 + T19(red)/T20(green)
    setLocationSearch("");
    const { container } = render(<Login />);
    const gh = container.querySelector(
      '[data-testid="ns-login-github"]',
    ) as HTMLAnchorElement | null;
    const gg = container.querySelector(
      '[data-testid="ns-login-google"]',
    ) as HTMLAnchorElement | null;
    expect(gh).not.toBeNull();
    expect(gg).not.toBeNull();
    expect(gh?.getAttribute("href")).toBe("/api/auth/github/start");
    expect(gg?.getAttribute("href")).toBe("/api/auth/google/start");
  });
});

describe("AC-10: ?error= query -> promptStore.toast 分类提示 (E18)", () => {
  it("error=provider_down -> toast '登录服务暂不可用'", () => {
    // gov: AC-10 + SDR#10 + T19(red)/T20(green)
    const toast = vi.spyOn(promptStore, "toast").mockImplementation(() => {});
    setLocationSearch("?error=provider_down");
    render(<Login />);
    expect(toast).toHaveBeenCalledWith(ERROR_TOAST.provider_down);
  });

  it("error=email_null -> toast 'provider 未返回邮箱'", () => {
    // gov: AC-10 + SDR#10 + T19(red)/T20(green)
    const toast = vi.spyOn(promptStore, "toast").mockImplementation(() => {});
    setLocationSearch("?error=email_null");
    render(<Login />);
    expect(toast).toHaveBeenCalledWith(ERROR_TOAST.email_null);
  });

  it("error=state_expired -> toast '登录已过期请重试'", () => {
    // gov: AC-10 + SDR#5 + SDR#10 + T19(red)/T20(green)
    const toast = vi.spyOn(promptStore, "toast").mockImplementation(() => {});
    setLocationSearch("?error=state_expired");
    render(<Login />);
    expect(toast).toHaveBeenCalledWith(ERROR_TOAST.state_expired);
  });

  it("无 error query -> 不弹 toast (不静默分类, 不误触)", () => {
    // gov: AC-10 + SDR#11 + T19(red)/T20(green)
    const toast = vi.spyOn(promptStore, "toast").mockImplementation(() => {});
    setLocationSearch("");
    render(<Login />);
    expect(toast).not.toHaveBeenCalled();
  });
});
