package version

import "testing"

// Establishes the `go test` infra in Story 1a.1. The Go server binary arrives
// in sub-PR #2; this is the smallest package that proves the toolchain.
func TestString(t *testing.T) {
	t.Setenv("GO_VERSION_STAMP", "ignored") // ensure no env coupling
	got := String()
	if got != "newsd dev" {
		t.Fatalf("String() = %q, want %q", got, "newsd dev")
	}
}
