import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

import "../styles.css";

// Lean carry: no react-query QueryClient, no Lovable error reporting. SPA
// root with a global error boundary (AC requirement): an error toast with a
// retry and a return-home action. The HTML shell is minimal; the cyberpunk
// aesthetic lives in tokens.css + styles.css.
export const Route = createRootRoute({
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NewSD</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <HeadContent />
      </head>
      <body>
        <div className="ns-root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}

function NotFoundComponent() {
  return (
    <div className="ns-center ns-ascii">
      <pre className="ns-ascii">{`┌─────────────────────┐
│   404  NOT FOUND    │
└─────────────────────┘`}</pre>
      <div className="ns-actions">
        <Link to="/" className="ns-link">
          [ return home ]
        </Link>
      </div>
    </div>
  );
}

function RootErrorComponent({ error }: { error: Error }) {
  const router = useRouter();

  useEffect(() => {
    // Keep the error visible; do not auto-redirect. The user must explicitly
    // retry or return home so that a crash loop never silently masks itself.
    console.error("[NewSD] route error:", error);
  }, [error]);

  return (
    <div className="ns-center ns-ascii">
      <pre className="ns-ascii--err">{`┌─────────────────────┐
│  ╳  SYSTEM FAULT     │
└─────────────────────┘`}</pre>
      <p className="ns-err-msg">{error?.message ?? "unknown error"}</p>
      <div className="ns-actions">
        <button type="button" className="ns-link" onClick={() => router.invalidate()}>
          [ retry ]
        </button>
        <Link to="/" className="ns-link">
          [ return home ]
        </Link>
      </div>
    </div>
  );
}
