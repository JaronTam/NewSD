// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - Provider fake impl tests (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `t.Skip` (TDD RED). DS T12 activates them when
// the fakeProvider body lands in provider.go. The fake is the test double for
// the OAuth web flow (SDR#1: Provider interface injected, no real GitHub/Google
// calls in unit tests). Each header declares gov: `AC-N + SDR#M + T-K`.
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"context"
	"testing"
)

// TestFakeProviderExchangeAndFetchUser guards AC-3/AC-4: the fake provider's
// Exchange returns an access_token and FetchUser returns the configured
// oauth_user_id + username + email (hand-roll contract, SDR#1).
func TestFakeProviderExchangeAndFetchUser(t *testing.T) {
	// gov: AC-3 + AC-4 + SDR#1 + T12(red)/T13(green)
	want := &UserInfo{Provider: "fake", OAuthID: "123", Username: "alice", Email: "alice@example.com"}
	p := NewFakeProvider(want)
	ctx := context.Background()
	tok, err := p.Exchange(ctx, "any-code")
	if err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if tok == "" {
		t.Errorf("Exchange returned empty access_token (AC-3)")
	}
	info, err := p.FetchUser(ctx, tok)
	if err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if info.OAuthID != "123" {
		t.Errorf("OAuthID = %q want 123 (AC-4)", info.OAuthID)
	}
	if info.Email != "alice@example.com" {
		t.Errorf("Email = %q want alice@example.com (AC-4)", info.Email)
	}
	if info.Username != "alice" {
		t.Errorf("Username = %q want alice (AC-4)", info.Username)
	}
}

// TestFakeProviderEmailNull guards AC-4/AC-10 (E18 email_null): when the
// provider returns an empty email, FetchUser returns Email="" so the caller
// rejects account creation with the email_null toast (no silent default).
func TestFakeProviderEmailNull(t *testing.T) {
	// gov: AC-4 + AC-10 + SDR#10 + SDR#11 + T12(red)
	p := NewFakeProvider(&UserInfo{Provider: "fake", OAuthID: "456", Username: "bob", Email: ""})
	info, err := p.FetchUser(context.Background(), "tok")
	if err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if info.Email != "" {
		t.Errorf("Email = %q, want empty (email-null path -> E18 reject, AC-10/SDR#11)", info.Email)
	}
}
