// Package server provides the HTTP handler for the NewSD single-binary server.
// It serves the embedded SPA (dist/client) plus the /__version and /__health
// endpoints. The handler is dist-agnostic — main.go injects the embedded FS —
// so the server package tests run without a built frontend (testing/fstest).
package server

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"

	"github.com/jarontam/newsd/internal/auth"
	"github.com/jarontam/newsd/internal/store"
	"github.com/jarontam/newsd/internal/version"
)

// New returns the HTTP handler serving the SPA plus /__version, /__health, and
// OAuth auth routes (when st + providers are non-nil). distClient is the
// dist/client subtree (SPA static assets).
func New(distClient fs.FS, st *store.Store, authCfg auth.Config, providers map[string]auth.Provider) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /__version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": version.Version})
	})

	mux.HandleFunc("GET /__health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Wire OAuth auth routes (AC-1/AC-11). Skipped when store is nil (tests that
	// only exercise static/version/health endpoints).
	if st != nil && providers != nil {
		auth.New(mux, authCfg, st, providers)
	}

	// Static assets + SPA client-routing fallback.
	fileServer := http.FileServer(http.FS(distClient))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Unknown /__ paths are a reserved namespace (not SPA routes) → 404.
		if strings.HasPrefix(r.URL.Path, "/__") {
			http.NotFound(w, r)
			return
		}
		// SPA fallback: client-side route has no static file → serve _shell.html.
		// TanStack Start SPA output uses _shell.html as the entry point.
		if p := strings.TrimPrefix(r.URL.Path, "/"); p != "" {
			if _, err := fs.Stat(distClient, p); err != nil {
				r.URL.Path = "/_shell.html"
			}
		} else {
			// Root path: serve _shell.html directly (no index.html in TanStack Start SPA).
			r.URL.Path = "/_shell.html"
		}
		fileServer.ServeHTTP(w, r)
	}))

	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
