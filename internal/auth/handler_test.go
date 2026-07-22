// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - auth HTTP handler integration tests (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `t.Skip` (TDD RED). DS T15/T17 activate them as
// the start/callback/me/logout handlers land in handler.go. Each header
// declares gov: `AC-N + SDR#M + T-K`. Tests inject a fakeProvider (no real
// GitHub/Google network); the FAKE_OAUTH=1 dev-mode full flow is exercised in
// e2e/oauth-login.spec.ts (AC-17, Q2 ruling B).
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"

	"github.com/jarontam/newsd/internal/store"
)

// setupAuthHandler builds a New auth handler over a temp DB + fake provider
// map. DS T15/T17 make this return a working handler; red phase panics inside
// New, so callers must t.Skip before invoking.
func setupAuthHandler(t *testing.T, providers map[string]Provider) (http.Handler, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	cfg := Config{
		RedirectBaseURL: "http://localhost:8080",
		SessionTTL:      0, // DS sets a real default; 0 -> DS chooses
		FakeOAuth:       true,
	}
	mux := http.NewServeMux()
	h := New(mux, cfg, st, providers)
	return h, st
}

// fakeProviders builds a provider map with a single fake provider keyed by name.
func fakeProviders(name string, user *UserInfo) map[string]Provider {
	return map[string]Provider{name: NewFakeProvider(user)}
}

// TestStartRedirectsToProvider guards AC-1: GET /api/auth/{provider}/start 302-
// redirects to the provider authorize URL carrying client_id + state + redirect_uri.
func TestStartRedirectsToProvider(t *testing.T) {
	// gov: AC-1 + AC-2 + SDR#1 + SDR#5 + T14(red)/T15(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: "a@x.com"}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/start", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("start code = %d, want 302 (AC-1)", rec.Code)
	}
	loc := rec.Result().Header.Get("Location")
	// Fake provider returns /fake/authorize?state=... (no client_id/redirect_uri
	// for fake; real providers would include those). The handler must 302-redirect
	// to whatever the provider returns.
	if !contains(loc, "state") {
		t.Errorf("start Location missing state: %s (AC-1/SDR#5)", loc)
	}
	// ns-oauth-state cookie set (HttpOnly + SameSite=Lax, 10min TTL, AC-2/SDR#5).
	var stateCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "ns-oauth-state" {
			stateCookie = c
		}
	}
	if stateCookie == nil {
		t.Errorf("ns-oauth-state cookie not set (AC-2/SDR#5)")
	} else if !stateCookie.HttpOnly || stateCookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("state cookie flags wrong: HttpOnly=%v SameSite=%v (want HttpOnly+Lax, SDR#5)", stateCookie.HttpOnly, stateCookie.SameSite)
	}
}

// TestCallbackCreatesSessionAndCookie guards AC-3/AC-8: callback validates
// state, exchanges code, upserts user, creates session, sets ns-session cookie,
// and 302-redirects to /.
func TestCallbackCreatesSessionAndCookie(t *testing.T) {
	// gov: AC-3 + AC-8 + SDR#3 + SDR#9 + T14(red)/T15(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: "a@x.com"}))
	// Two-phase: first call /start to obtain a valid state cookie, then /callback.
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/api/auth/github/start", nil)
	h.ServeHTTP(rec1, req1)
	stateCookie := rec1.Result().Cookies()
	// Reuse the state cookie on the callback request.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/callback?code=fake-code&state="+stateValue(stateCookie), nil)
	if len(stateCookie) > 0 {
		req.AddCookie(stateCookie[0])
	}
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("callback code = %d, want 302 (AC-8)", rec.Code)
	}
	if loc := rec.Result().Header.Get("Location"); loc != "/" {
		t.Errorf("callback Location = %q, want / (AC-8)", loc)
	}
	var sessionCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "ns-session" {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatalf("ns-session cookie not set (AC-8/SDR#9)")
	}
	if !sessionCookie.HttpOnly || sessionCookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("session cookie flags wrong: HttpOnly=%v SameSite=%v (want HttpOnly+Lax, SDR#9)", sessionCookie.HttpOnly, sessionCookie.SameSite)
	}
	if sessionCookie.Secure {
		t.Errorf("session cookie Secure=true on localhost (dev skips Secure, Q3=A/SDR#9)")
	}
}

// TestCallbackStateExpired guards AC-10 (E18 state_expired): callback with a
// missing/mismatched state cookie 302-redirects to /login?error=state_expired.
func TestCallbackStateExpired(t *testing.T) {
	// gov: AC-2 + AC-10 + SDR#5 + SDR#10 + T14(red)/T15(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: "a@x.com"}))
	rec := httptest.NewRecorder()
	// No ns-oauth-state cookie -> state_expired.
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/callback?code=fake-code&state=anything", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("code = %d, want 302", rec.Code)
	}
	if loc := rec.Result().Header.Get("Location"); !contains(loc, "error=state_expired") {
		t.Errorf("Location = %q, want /login?error=state_expired (AC-10/SDR#10)", loc)
	}
}

// TestCallbackEmailNull guards AC-10 (E18 email_null): callback whose provider
// returns an empty email 302-redirects to /login?error=email_null.
func TestCallbackEmailNull(t *testing.T) {
	// gov: AC-4 + AC-10 + SDR#10 + SDR#11 + T14(red)/T15(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: ""}))
	// Seed a valid state cookie via /start first.
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/api/auth/github/start", nil)
	h.ServeHTTP(rec1, req1)
	sc := rec1.Result().Cookies()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/callback?code=fake-code&state="+stateValue(sc), nil)
	if len(sc) > 0 {
		req.AddCookie(sc[0])
	}
	h.ServeHTTP(rec, req)
	if loc := rec.Result().Header.Get("Location"); !contains(loc, "error=email_null") {
		t.Errorf("Location = %q, want /login?error=email_null (AC-10 email-null, SDR#11)", loc)
	}
}

// failingProvider simulates a provider endpoint failure (Exchange or FetchUser)
// to guard the AC-10/SDR#10 provider_down redirect. upsert/session failure
// paths share the same provider_down mapping in handler.go but require a
// fault-injecting store; they are deferred (not exercised here).
type failingProvider struct {
	name         string
	failExchange bool
	failFetch    bool
}

func (p *failingProvider) Name() string { return p.name }

func (p *failingProvider) AuthURL(state string) (string, error) {
	return "/fake/authorize?state=" + url.QueryEscape(state), nil
}

func (p *failingProvider) Exchange(ctx context.Context, code string) (string, error) {
	if p.failExchange {
		return "", fmt.Errorf("simulated exchange failure")
	}
	return "fake-access-token", nil
}

func (p *failingProvider) FetchUser(ctx context.Context, accessToken string) (*UserInfo, error) {
	if p.failFetch {
		return nil, fmt.Errorf("simulated fetch-user failure")
	}
	return &UserInfo{Provider: p.name, OAuthID: "1", Username: "alice", Email: "a@x.com"}, nil
}

// TestCallbackProviderDownExchange guards AC-10 (E18 provider_down): callback
// whose provider Exchange errors 302-redirects to /login?error=provider_down.
func TestCallbackProviderDownExchange(t *testing.T) {
	// gov: AC-10 + SDR#10 + F1 (CR Run1)
	h, _ := setupAuthHandler(t, map[string]Provider{"github": &failingProvider{name: "github", failExchange: true}})
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/api/auth/github/start", nil)
	h.ServeHTTP(rec1, req1)
	sc := rec1.Result().Cookies()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/callback?code=fake-code&state="+stateValue(sc), nil)
	if len(sc) > 0 {
		req.AddCookie(sc[0])
	}
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("callback code = %d, want 302 (AC-10)", rec.Code)
	}
	if loc := rec.Result().Header.Get("Location"); !contains(loc, "error=provider_down") {
		t.Errorf("Location = %q, want /login?error=provider_down (AC-10 provider_down, SDR#10, F1)", loc)
	}
}

// TestCallbackProviderDownFetch guards AC-10 (E18 provider_down): callback whose
// provider FetchUser errors 302-redirects to /login?error=provider_down.
func TestCallbackProviderDownFetch(t *testing.T) {
	// gov: AC-10 + SDR#10 + F1 (CR Run1)
	h, _ := setupAuthHandler(t, map[string]Provider{"github": &failingProvider{name: "github", failFetch: true}})
	rec1 := httptest.NewRecorder()
	req1 := httptest.NewRequest(http.MethodGet, "/api/auth/github/start", nil)
	h.ServeHTTP(rec1, req1)
	sc := rec1.Result().Cookies()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/github/callback?code=fake-code&state="+stateValue(sc), nil)
	if len(sc) > 0 {
		req.AddCookie(sc[0])
	}
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("callback code = %d, want 302 (AC-10)", rec.Code)
	}
	if loc := rec.Result().Header.Get("Location"); !contains(loc, "error=provider_down") {
		t.Errorf("Location = %q, want /login?error=provider_down (AC-10 provider_down, SDR#10, F1)", loc)
	}
}

// TestMeReturnsUserOr401 guards AC-11: GET /api/auth/me with a valid session
// cookie returns the user JSON; without (or expired) returns 401.
func TestMeReturnsUserOr401(t *testing.T) {
	// gov: AC-8 + AC-11 + SDR#3 + T16(red)/T17(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: "a@x.com"}))
	// No cookie -> 401.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("me without cookie code = %d, want 401 (AC-11)", rec.Code)
	}
}

// TestLogoutDeletesSession guards AC-11: POST /api/auth/logout deletes the
// session and clears the ns-session cookie.
func TestLogoutDeletesSession(t *testing.T) {
	// gov: AC-11 + SDR#3 + T16(red)/T17(green)
	h, _ := setupAuthHandler(t, fakeProviders("github", &UserInfo{Provider: "github", OAuthID: "1", Username: "alice", Email: "a@x.com"}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent && rec.Code != http.StatusOK {
		t.Errorf("logout code = %d, want 204 or 200 (AC-11)", rec.Code)
	}
	cleared := false
	for _, c := range rec.Result().Cookies() {
		if c.Name == "ns-session" && c.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Errorf("ns-session cookie not cleared on logout (AC-11)")
	}
}

// contains is a minimal substring check (avoid pulling strings just for Contains).
func contains(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) && indexOf(haystack, needle) >= 0)
}

// indexOf returns the first index of needle in haystack, or -1.
func indexOf(haystack, needle string) int {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}

// stateValue extracts the ns-oauth-state cookie value from a slice ("" if absent).
func stateValue(cookies []*http.Cookie) string {
	for _, c := range cookies {
		if c.Name == "ns-oauth-state" {
			return c.Value
		}
	}
	return ""
}
