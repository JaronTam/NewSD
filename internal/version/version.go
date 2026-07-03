// Package version exposes the build version stamp. The Go binary (sub-PR #2)
// embeds the prerendered SPA dist and serves it; this stamp is reported at
// /__version so a deployed instance can be identified without shell access.
package version

import "fmt"

// Version is the canonical build stamp. Overridden at link time via
// `-ldflags "-X github.com/jarontam/newsd/internal/version.Version=..."`.
var Version = "dev"

// String returns a human-readable version line.
func String() string {
	return fmt.Sprintf("newsd %s", Version)
}
