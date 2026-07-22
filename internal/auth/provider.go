// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - OAuth Provider interface (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// provider.go declares the Provider abstraction over GitHub/Google OAuth so the
// handler + tests depend on an interface, not concrete providers (SDR#1: hand-
// roll stdlib net/http + encoding/json, NO golang.org/x/oauth2). Method bodies
// are panic stubs; provider_test.go is t.Skip. DS T13 implements the real
// github/google providers; DS T12 implements the fake provider for tests.
//
// Contract (locked by AC-3/AC-4/SDR#1, DS honors):
//   - AuthURL(state) -> provider authorize URL with client_id + redirect_uri +
//     state + scope (GitHub read:user/user:email; Google openid email profile).
//   - Exchange(ctx, code) -> POST provider token endpoint with client_id +
//     client_secret (server env, SDR#4/SDR#6), parse access_token.
//   - FetchUser(ctx, accessToken) -> GET provider user endpoint, parse
//     oauth_user_id + username + email; email null path = E18 email_null (AC-10).
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// UserInfo is the normalized result of a provider user-endpoint call (AC-4).
// Provider is the union field for the users-table upsert (SDR#2); OAuthID is
// the provider-specific stable id (GitHub `id` / Google `id`), NOT email.
type UserInfo struct {
	Provider string
	OAuthID  string
	Username string
	Email    string // may be "" -> E18 email_null (AC-10), reject account creation
}

// Provider abstracts an OAuth provider. The handler dispatches by provider name
// via a map[string]Provider registry (SDR#11: provider set = {github, google}
// closed; unknown provider -> start 404, never silent default).
type Provider interface {
	Name() string
	AuthURL(state string) (string, error)
	Exchange(ctx context.Context, code string) (string, error)
	FetchUser(ctx context.Context, accessToken string) (*UserInfo, error)
}

// githubProvider implements Provider for GitHub (SDR#1: hand-roll, endpoints
// login/oauth/access_token + api.github.com/user).
type githubProvider struct {
	clientID     string
	clientSecret string // server env only, never reaches frontend (SDR#6)
	redirectBase string
}

func (p *githubProvider) Name() string { return "github" }

func (p *githubProvider) AuthURL(state string) (string, error) {
	u, err := url.Parse("https://github.com/login/oauth/authorize")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("client_id", p.clientID)
	q.Set("redirect_uri", p.redirectBase+"/api/auth/github/callback")
	q.Set("state", state)
	q.Set("scope", "read:user user:email")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (p *githubProvider) Exchange(ctx context.Context, code string) (string, error) {
	data := url.Values{
		"client_id":     {p.clientID},
		"client_secret": {p.clientSecret},
		"code":          {code},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/oauth/access_token",
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" {
		return "", fmt.Errorf("github token exchange: %s", out.Error)
	}
	if out.AccessToken == "" {
		return "", fmt.Errorf("github token exchange: empty access_token (status %d)", resp.StatusCode)
	}
	return out.AccessToken, nil
}

func (p *githubProvider) FetchUser(ctx context.Context, accessToken string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var gu struct {
		ID    int    `json:"id"`
		Login string `json:"login"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gu); err != nil {
		return nil, err
	}
	if gu.ID == 0 {
		return nil, fmt.Errorf("github user: missing id (status %d)", resp.StatusCode)
	}
	return &UserInfo{
		Provider: "github",
		OAuthID:  fmt.Sprintf("%d", gu.ID),
		Username: gu.Login,
		Email:    gu.Email,
	}, nil
}

// NewGithubProvider constructs a githubProvider from server env config (SDR#4).
func NewGithubProvider(clientID, clientSecret, redirectBase string) Provider {
	return &githubProvider{clientID: clientID, clientSecret: clientSecret, redirectBase: redirectBase}
}

// googleProvider implements Provider for Google (SDR#1: hand-roll, endpoints
// oauth2.googleapis.com/token + www.googleapis.com/oauth2/v2/userinfo).
type googleProvider struct {
	clientID     string
	clientSecret string
	redirectBase string
}

func (p *googleProvider) Name() string { return "google" }

func (p *googleProvider) AuthURL(state string) (string, error) {
	u, err := url.Parse("https://accounts.google.com/o/oauth2/v2/auth")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("client_id", p.clientID)
	q.Set("redirect_uri", p.redirectBase+"/api/auth/google/callback")
	q.Set("state", state)
	q.Set("scope", "openid email profile")
	q.Set("response_type", "code")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (p *googleProvider) Exchange(ctx context.Context, code string) (string, error) {
	data := url.Values{
		"client_id":     {p.clientID},
		"client_secret": {p.clientSecret},
		"code":          {code},
		"grant_type":    {"authorization_code"},
		"redirect_uri":  {p.redirectBase + "/api/auth/google/callback"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token",
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Error != "" {
		return "", fmt.Errorf("google token exchange: %s", out.Error)
	}
	if out.AccessToken == "" {
		return "", fmt.Errorf("google token exchange: empty access_token (status %d)", resp.StatusCode)
	}
	return out.AccessToken, nil
}

func (p *googleProvider) FetchUser(ctx context.Context, accessToken string) (*UserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var gu struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&gu); err != nil {
		return nil, err
	}
	if gu.ID == "" {
		return nil, fmt.Errorf("google userinfo: missing id (status %d)", resp.StatusCode)
	}
	return &UserInfo{
		Provider: "google",
		OAuthID:  gu.ID,
		Username: gu.Name,
		Email:    gu.Email,
	}, nil
}

// NewGoogleProvider constructs a googleProvider from server env config (SDR#4).
func NewGoogleProvider(clientID, clientSecret, redirectBase string) Provider {
	return &googleProvider{clientID: clientID, clientSecret: clientSecret, redirectBase: redirectBase}
}

// fakeProvider is a dev-only Provider used by Go unit tests + the FAKE_OAUTH=1
// dev e2e flow (Q2 ruling B). It bypasses real OAuth: Exchange returns a fixed
// access_token, FetchUser returns a configurable UserInfo (incl. the email-null
// path for E18). Production binaries do NOT register fake routes when
// FAKE_OAUTH is unset (AC-11(d)/SDR#1).
type fakeProvider struct {
	user *UserInfo
}

func (p *fakeProvider) Name() string { return "fake" }

func (p *fakeProvider) AuthURL(state string) (string, error) {
	return "/fake/authorize?state=" + url.QueryEscape(state), nil
}

func (p *fakeProvider) Exchange(ctx context.Context, code string) (string, error) {
	return "fake-access-token", nil
}

func (p *fakeProvider) FetchUser(ctx context.Context, accessToken string) (*UserInfo, error) {
	return p.user, nil
}

// NewFakeProvider constructs a fakeProvider for tests/dev (Q2=B). The userInfo
// arg configures the FetchUser return (set Email="" to exercise email_null).
func NewFakeProvider(user *UserInfo) Provider {
	return &fakeProvider{user: user}
}
