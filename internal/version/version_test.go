package version

import "testing"

// Establishes the `go test` infra in Story 1a.1 alongside the server package.
// version.Version defaults to "dev" and is overridden via -ldflags at release.
func TestString(t *testing.T) {
	got := String()
	if got != "newsd dev" {
		t.Fatalf("String() = %q, want %q", got, "newsd dev")
	}
}
