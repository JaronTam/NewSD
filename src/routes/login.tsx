// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 - /login route (AC-1/AC-10)
// ══════════════════════════════════════════════════════════════════════════════
//
// Login renders two provider entry links (GitHub, Google) as standard DOM
// anchors (NOT WebGL canvas, SDR#22). On mount, reads ?error= from the URL
// query string and dispatches the corresponding toast via promptStore (AC-10
// E18 error classification: provider_down, email_null, state_expired).
// Unknown error codes are silently ignored (SDR#11: never silent-default).
// ══════════════════════════════════════════════════════════════════════════════

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { promptStore } from "../lib/render/promptStore";

const ERROR_TOAST: Record<string, string> = {
  provider_down: "登录服务暂不可用",
  email_null: "provider 未返回邮箱",
  state_expired: "登录已过期请重试",
};

export function Login() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error && ERROR_TOAST[error]) {
      promptStore.toast(ERROR_TOAST[error]);
    }
  }, []);

  return (
    <div className="ns-center ns-ascii">
      <pre className="ns-ascii">{`┌─────────────────────┐
│     LOGIN  /  登录   │
└─────────────────────┘`}</pre>
      <div className="ns-actions">
        <a data-testid="ns-login-github" className="ns-link" href="/api/auth/github/start">
          [ login with GitHub ]
        </a>
        <a data-testid="ns-login-google" className="ns-link" href="/api/auth/google/start">
          [ login with Google ]
        </a>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: Login,
});
