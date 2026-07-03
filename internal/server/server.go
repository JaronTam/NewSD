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

	"github.com/jarontam/newsd/internal/version"
)

// New returns the HTTP handler serving the SPA plus /__version and /__health.
// distClient is the dist/client subtree (SPA static assets).
func New(distClient fs.FS) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /__version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": version.Version})
	})

	mux.HandleFunc("GET /__health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Static assets + SPA client-routing fallback.
	fileServer := http.FileServer(http.FS(distClient))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Unknown /__ paths are a reserved namespace (not SPA routes) → 404.
		if strings.HasPrefix(r.URL.Path, "/__") {
			http.NotFound(w, r)
			return
		}
		// SPA fallback: a client-side route has no static file → serve index.html.
		if p := strings.TrimPrefix(r.URL.Path, "/"); p != "" {
			if _, err := fs.Stat(distClient, p); err != nil {
				r.URL.Path = "/"
			}
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
