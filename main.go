// Command newsd serves the embedded SPA frontend plus the /__version, /__health,
// and OAuth auth endpoints from a single binary (ARCHITECTURE-SPINE AD-3: no Node
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
	"path/filepath"
	"time"

	"github.com/jarontam/newsd/internal/auth"
	"github.com/jarontam/newsd/internal/server"
	"github.com/jarontam/newsd/internal/store"
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

	// Open SQLite store + run migrations (AC-5/SDR#2/SDR#3).
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join("data", "newsd.db")
	}
	// Ensure parent dir exists for the DB file.
	if dir := filepath.Dir(dbPath); dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("create data dir %s: %v", dir, err)
		}
	}
	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open store %s: %v", dbPath, err)
	}
	defer st.Close()
	if err := st.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Build OAuth provider registry (SDR#4/SDR#11).
	redirectBase := os.Getenv("OAUTH_REDIRECT_BASE_URL")
	if redirectBase == "" {
		redirectBase = "http://localhost:8080"
	}
	sessionTTL := store.SessionTTL
	if v := os.Getenv("SESSION_TTL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			sessionTTL = d
		}
	}
	fakeOAuth := os.Getenv("FAKE_OAUTH") == "1"

	authCfg := auth.Config{
		GitHubClientID:     os.Getenv("OAUTH_GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("OAUTH_GITHUB_CLIENT_SECRET"), // SDR#6 hard red line
		GoogleClientID:     os.Getenv("OAUTH_GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("OAUTH_GOOGLE_CLIENT_SECRET"), // SDR#6 hard red line
		RedirectBaseURL:    redirectBase,
		SessionTTL:         sessionTTL,
		FakeOAuth:          fakeOAuth,
	}

	providers := map[string]auth.Provider{}
	if fakeOAuth {
		// Dev-only fake provider (Q2=B). Register under "github" and "google"
		// so the login page links work in dev mode. Production DOES NOT register
		// these; the fake provider is gated by FAKE_OAUTH=1 env.
		fp := auth.NewFakeProvider(&auth.UserInfo{
			Provider: "fake",
			OAuthID:  "dev-1",
			Username: "dev",
			Email:    "dev@localhost",
		})
		providers["github"] = fp
		providers["google"] = fp
		providers["fake"] = fp
	}
	if authCfg.GitHubClientID != "" && authCfg.GitHubClientSecret != "" && !fakeOAuth {
		providers["github"] = auth.NewGithubProvider(authCfg.GitHubClientID, authCfg.GitHubClientSecret, redirectBase)
	}
	if authCfg.GoogleClientID != "" && authCfg.GoogleClientSecret != "" && !fakeOAuth {
		providers["google"] = auth.NewGoogleProvider(authCfg.GoogleClientID, authCfg.GoogleClientSecret, redirectBase)
	}
	// SDR#4 fail-fast: in production (FAKE_OAUTH unset) at least one provider
	// must be fully configured (id+secret). Zero providers -> refuse to start.
	if !fakeOAuth && len(providers) == 0 {
		log.Fatal("no OAuth provider configured: set OAUTH_GITHUB_CLIENT_ID/SECRET or OAUTH_GOOGLE_CLIENT_ID/SECRET (SDR#4 fail-fast)")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("newsd listening on :%s (version %s)", port, version.Version)
	if err := http.ListenAndServe(":"+port, server.New(clientFS, st, authCfg, providers)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
