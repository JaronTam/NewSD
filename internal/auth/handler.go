// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - auth HTTP handler wiring (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// handler.go declares the env Config struct + the New constructor that wires
// the auth routes onto a mux (AC-1/AC-11/SDR#7). New's body is a panic stub;
// handler_test.go is t.Skip. DS T15/T17 implement the real handlers:
//
//   - GET  /api/auth/{provider}/start     -> generate state + set ns-oauth-state
//     cookie + 302 to provider AuthURL (AC-1/AC-2).
//   - GET  /api/auth/{provider}/callback  -> ValidateState + Exchange + FetchUser
//     + UpsertUser + CreateSession + Set-Cookie ns-session (HttpOnly+SameSite=Lax,
//     Secure conditional on non-localhost per Q3=A) + JSON body {token,user} +
//     302 to / (AC-3/AC-8/SDR#9). Errors -> 302 /login?error={code} (AC-10).
//   - GET  /api/auth/me                   -> read ns-session cookie + GetSession +
//     return user JSON; 401 if absent/expired (AC-11).
//   - POST /api/auth/logout               -> DeleteSession + clear cookie (AC-11).
//
// SDR#6 HARD RED LINE: client_secret is read here ONLY from env (Config fields),
// NEVER serialized into the frontend bundle. handler.go imports store (no cycle:
// store does not import auth).
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/jarontam/newsd/internal/store"
)

// Config holds the server-side OAuth + session env (SDR#4). Loaded from os.Getenv
// in main.go (DS T18); client_secret fields NEVER leave the server (SDR#6).
type Config struct {
	GitHubClientID     string
	GitHubClientSecret string // server env only (SDR#6 hard red line)
	GoogleClientID     string
	GoogleClientSecret string // server env only (SDR#6 hard red line)
	RedirectBaseURL    string // e.g. http://localhost:8080; /api/auth/{provider}/callback appended
	SessionTTL         time.Duration
	FakeOAuth          bool // FAKE_OAUTH=1 dev-only fake provider route (Q2=B); prod unset -> not registered
}

// handler holds the wired deps for auth HTTP handlers.
type handler struct {
	cfg       Config
	st        *store.Store
	providers map[string]Provider
}

// New wires the auth routes onto mux and returns the handler. providers is the
// map[string]Provider registry (SDR#11: {github, google} closed; DS T15 adds
// fake when cfg.FakeOAuth).
func New(mux *http.ServeMux, cfg Config, st *store.Store, providers map[string]Provider) http.Handler {
	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = store.SessionTTL
	}
	h := &handler{cfg: cfg, st: st, providers: providers}

	mux.HandleFunc("GET /api/auth/{provider}/start", h.start)
	mux.HandleFunc("GET /api/auth/{provider}/callback", h.callback)
	mux.HandleFunc("GET /api/auth/me", h.me)
	mux.HandleFunc("POST /api/auth/logout", h.logout)

	// Wire fake OAuth authorize handler for dev mode (Q2=B). The fake provider's
	// AuthURL returns /fake/authorize?state=...; this handler simulates the OAuth
	// authorize page by auto-redirecting to the callback with a fake code.
	if cfg.FakeOAuth {
		mux.HandleFunc("GET /fake/authorize", h.fakeAuthorize)
	}

	return mux
}

// start handles GET /api/auth/{provider}/start (AC-1/AC-2).
// Generates a CSRF state nonce, sets the ns-oauth-state cookie (HttpOnly,
// SameSite=Lax, 10min TTL), and 302-redirects to the provider authorize URL.
func (h *handler) start(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	p, ok := h.providers[provider]
	if !ok {
		http.NotFound(w, r)
		return
	}

	state, err := GenerateState()
	if err != nil {
		http.Error(w, "failed to generate state", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "ns-oauth-state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   !isLocalhost(h.cfg.RedirectBaseURL),
		MaxAge:   600, // 10 minutes (AC-2/SDR#5)
	})

	authURL, err := p.AuthURL(state)
	if err != nil {
		http.Error(w, "failed to build auth url", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, authURL, http.StatusFound)
}

// fakeAuthorize handles GET /fake/authorize (dev-only, FAKE_OAUTH=1). It simulates
// the OAuth provider's authorize page by auto-redirecting to the callback with a
// fake authorization code. The state is passed through unchanged for CSRF validation.
func (h *handler) fakeAuthorize(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	// Redirect to the fake provider's callback. The fake provider is registered
	// under the "fake" key, so the callback URL uses /fake as the provider path.
	callbackURL := "/api/auth/fake/callback?state=" + url.QueryEscape(state) + "&code=fake-code"
	http.Redirect(w, r, callbackURL, http.StatusFound)
}

// callback handles GET /api/auth/{provider}/callback (AC-3/AC-8/AC-10).
// Validates state CSRF, exchanges code, fetches user, upserts user, creates
// session, sets ns-session cookie (HttpOnly+SameSite=Lax, Secure conditional on
// non-localhost per Q3=A), and 302-redirects to /.
func (h *handler) callback(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	p, ok := h.providers[provider]
	if !ok {
		http.NotFound(w, r)
		return
	}

	// Bound provider HTTP calls (Exchange/FetchUser) so a hung provider cannot
	// stall the callback indefinitely (SDR#10 provider_down covers net timeout).
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Validate state CSRF (AC-2/SDR#5)
	cookieState, cookieErr := r.Cookie("ns-oauth-state")
	queryState := r.URL.Query().Get("state")
	if cookieErr != nil || !ValidateState(cookieState.Value, queryState) {
		http.Redirect(w, r, "/login?error=state_expired", http.StatusFound)
		return
	}

	// Clear state cookie after validation (single-use nonce)
	http.SetCookie(w, &http.Cookie{
		Name:     "ns-oauth-state",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	// Exchange code for access token (AC-3)
	code := r.URL.Query().Get("code")
	accessToken, err := p.Exchange(ctx, code)
	if err != nil {
		http.Redirect(w, r, "/login?error=provider_down", http.StatusFound)
		return
	}

	// Fetch user info from provider (AC-4)
	userInfo, err := p.FetchUser(ctx, accessToken)
	if err != nil {
		http.Redirect(w, r, "/login?error=provider_down", http.StatusFound)
		return
	}

	// Reject empty email (AC-10 E18 email_null, SDR#11)
	if userInfo.Email == "" {
		http.Redirect(w, r, "/login?error=email_null", http.StatusFound)
		return
	}

	// Upsert user (AC-6)
	user, err := h.st.UpsertUser(userInfo.Provider, userInfo.OAuthID, userInfo.Username, userInfo.Email)
	if err != nil {
		http.Redirect(w, r, "/login?error=provider_down", http.StatusFound)
		return
	}

	// Create session (AC-8)
	sess, err := h.st.CreateSession(user.ID)
	if err != nil {
		http.Redirect(w, r, "/login?error=provider_down", http.StatusFound)
		return
	}

	// Set session cookie: HttpOnly + SameSite=Lax, Secure conditional on non-localhost (Q3=A/SDR#9)
	secure := !isLocalhost(h.cfg.RedirectBaseURL)
	ttl := h.cfg.SessionTTL

	http.SetCookie(w, &http.Cookie{
		Name:     "ns-session",
		Value:    sess.Token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		MaxAge:   int(ttl.Seconds()),
	})

	http.Redirect(w, r, "/", http.StatusFound)
}

// me handles GET /api/auth/me (AC-11).
// Reads the ns-session cookie, validates the session, and returns the user JSON.
// Returns 401 if the cookie is absent or the session is expired/invalid.
func (h *handler) me(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("ns-session")
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	sess, err := h.st.GetSession(cookie.Value)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.st.FindUser(sess.UserID)
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": sess.Token,
		"user": map[string]interface{}{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"provider": user.OAuthProvider,
		},
	})
}

// logout handles POST /api/auth/logout (AC-11).
// Deletes the session from the store and clears the ns-session cookie.
// Idempotent: succeeds even if no session cookie is present.
func (h *handler) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("ns-session")
	if err == nil {
		_ = h.st.DeleteSession(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "ns-session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	w.WriteHeader(http.StatusNoContent)
}

// isLocalhost returns true if the baseURL host is localhost/127.0.0.1/::1 (Q3=A:
// skip Secure on local dev so the cookie works over plain HTTP).
func isLocalhost(baseURL string) bool {
	u, err := url.Parse(baseURL)
	if err != nil {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}
