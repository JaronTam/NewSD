// Command newsd serves the embedded SPA frontend plus the /__version and
// /__health endpoints from a single binary (ARCHITECTURE-SPINE AD-3: no Node
// runtime in production; AD-18: single-node cloud hosting).
//
// Build order matters: `bun run build` produces dist/, then `go build` embeds
// it. dist/ is the TanStack Start SPA output (dist/client = static assets,
// dist/server = prerender engine, build-time only).
package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/jarontam/newsd/internal/server"
	"github.com/jarontam/newsd/internal/version"
)

// dist/ is embedded at compile time. `all:` includes dotfiles so hashed asset
// manifests are not skipped. Must exist before `go build` (run `bun run build`).
//
//go:embed all:dist
var distFS embed.FS

func main() {
	clientFS, err := fs.Sub(distFS, "dist/client")
	if err != nil {
		log.Fatalf("dist/client not present in embed: %v (run `bun run build` first)", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("newsd listening on :%s (version %s)", port, version.Version)
	if err := http.ListenAndServe(":"+port, server.New(clientFS)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
