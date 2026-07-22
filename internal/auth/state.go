// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - state CSRF nonce (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// state.go mints + validates the OAuth state CSRF nonce (AC-2/SDR#5). Bodies
// are panic stubs; state_test.go is t.Skip. DS T11 replaces them with the real
// crypto/rand + base64.RawURLEncoding + crypto/subtle.ConstantTimeCompare impl.
//
// Contract (locked by AC-2/SDR#5, DS honors):
//   - GenerateState() -> 32 random bytes, base64.RawURLEncoding (no padding).
//   - ValidateState(cookieState, queryState) -> constant-time compare; true
//     iff equal AND non-empty. Empty/missing -> false (rejects session, E18
//     state_expired per AC-10).
// ══════════════════════════════════════════════════════════════════════════════

package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
)

// GenerateState returns a 32-byte cryptographically-random nonce encoded as
// base64.RawURLEncoding (no padding), for the OAuth state CSRF parameter + the
// short-lived ns-oauth-state cookie (10min TTL, SameSite=Lax, AC-2/SDR#5).
func GenerateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// ValidateState compares the cookie-stored state with the query state using a
// constant-time compare. Returns true iff both are non-empty AND equal; any
// mismatch or emptiness returns false (caller routes to E18 state_expired,
// AC-10/SDR#5).
func ValidateState(cookieState, queryState string) bool {
	if cookieState == "" || queryState == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(cookieState), []byte(queryState)) == 1
}
