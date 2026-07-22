// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - state CSRF nonce tests (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `t.Skip` (TDD RED). DS T11 activates them when
// GenerateState/ValidateState land in state.go. Each header declares
// gov: `AC-N + SDR#M + T-K`.
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"encoding/base64"
	"testing"
)

// TestGenerateStateIs32ByteBase64URL guards AC-2/SDR#5: state is crypto/rand
// 32 bytes, base64.RawURLEncoding (no padding), and non-deterministic.
func TestGenerateStateIs32ByteBase64URL(t *testing.T) {
	// gov: AC-2 + SDR#5 + T10(red)/T11(green)
	s1, err := GenerateState()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	// RawURLEncoding (no padding) decodes to exactly 32 bytes.
	dec, err := base64.RawURLEncoding.DecodeString(s1)
	if err != nil {
		t.Fatalf("state not base64 RawURLEncoding: %v (got %q)", err, s1)
	}
	if len(dec) != 32 {
		t.Errorf("state decodes to %d bytes, want 32 (crypto/rand 32B, AC-2)", len(dec))
	}
	// Non-deterministic: two calls differ.
	s2, err := GenerateState()
	if err != nil {
		t.Fatalf("generate 2: %v", err)
	}
	if s1 == s2 {
		t.Errorf("two GenerateState calls equal: %s (must be random, SDR#5)", s1)
	}
}

// TestValidateStateGuardsCSRF guards AC-2/SDR#5: equal non-empty states validate;
// mismatch or empty rejects (caller routes to E18 state_expired per AC-10).
func TestValidateStateGuardsCSRF(t *testing.T) {
	// gov: AC-2 + SDR#5 + SDR#10 + T10(red)/T11(green)
	state := "abcdefghijklmnopqrstuvwxyz0123456789ABCD"
	cases := []struct {
		name         string
		cookie, query string
		want         bool
	}{
		{"match", state, state, true},
		{"mismatch", state, state + "x", false},
		{"empty cookie", "", state, false},
		{"empty query", state, "", false},
		{"both empty", "", "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ValidateState(c.cookie, c.query); got != c.want {
				t.Errorf("ValidateState(%q,%q) = %v, want %v", c.cookie, c.query, got, c.want)
			}
		})
	}
}
