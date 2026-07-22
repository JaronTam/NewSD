package server

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/jarontam/newsd/internal/auth"
)

// testFS mimics dist/client: _shell.html (TanStack Start SPA entry) and a hashed asset.
// Tests run without a built frontend — the handler is dist-agnostic.
func testFS() fs.FS {
	return fstest.MapFS{
		"_shell.html":    &fstest.MapFile{Data: []byte("<!doctype html><html><body>SPA</body></html>")},
		"assets/app.js":  &fstest.MapFile{Data: []byte("console.log('app')")},
	}
}

func TestVersionEndpoint(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/__version", nil)
	New(testFS(), nil, auth.Config{}, nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("content-type = %q, want application/json", ct)
	}
	// version.Version defaults to "dev" (overridden via -ldflags at release build).
	if !strings.Contains(rec.Body.String(), `"version":"dev"`) {
		t.Fatalf("body = %q, want version dev", rec.Body.String())
	}
}

func TestHealthEndpoint(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/__health", nil)
	New(testFS(), nil, auth.Config{}, nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"status":"ok"`) {
		t.Fatalf("body = %q, want status ok", rec.Body.String())
	}
}

func TestStaticAsset(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	New(testFS(), nil, auth.Config{}, nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "console.log") {
		t.Fatalf("body = %q, want app.js content", rec.Body.String())
	}
}

func TestSPAFallback(t *testing.T) {
	// A client-side route (/boards/abc) has no static file → serves _shell.html.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/boards/abc", nil)
	New(testFS(), nil, auth.Config{}, nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (SPA fallback)", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "SPA") {
		t.Fatalf("body = %q, want _shell.html (SPA fallback)", rec.Body.String())
	}
}

func TestReservedPrefix404(t *testing.T) {
	// Unknown /__ paths are reserved (not SPA fallback) → 404.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/__unknown", nil)
	New(testFS(), nil, auth.Config{}, nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}
