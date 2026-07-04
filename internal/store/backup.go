package store

import (
	"context"
	"fmt"
	"io"
	"os"
)

// Backup writes a consistent point-in-time snapshot of the live database to
// dstPath using SQLite's VACUUM INTO — AR#15 three-options, VACUUM INTO chosen
// over (a) the sqlite3 .backup conn API and (b) checkpoint+cp:
//
//   - VACUUM INTO is pure SQL (driver-agnostic — survives a mattn↔modernc
//     swap), runs online (does not block writers; internally uses SQLite's
//     online-backup mechanism), and yields a self-contained file with no
//     -wal/-shm sidecar (so the product is safe to raw-cp/ship to object
//     storage, which is the daily-backup path ARCHITECTURE-SPINE §409 names).
//   - sqlite3 .backup API: offers no snapshot advantage over VACUUM INTO for a
//     single-file target and couples the code to a driver-specific conn.Backup
//     surface (modernc and mattn name it differently).
//   - checkpoint+cp: raw-cp of a WAL-mode DB captures an inconsistent state —
//     the exact failure AR#15 calls out; PRAGMA wal_checkpoint(TRUNCATE)+cp
//     narrows but does not eliminate the writer race window.
//
// dstPath must not already exist (SQLite VACUUM INTO requirement); its parent
// directory must exist and be writable.
func (s *Store) Backup(ctx context.Context, dstPath string) error {
	if _, err := os.Stat(dstPath); err == nil {
		return fmt.Errorf("backup dst %q already exists (VACUUM INTO requires an absent target)", dstPath)
	}
	// VACUUM INTO does not accept a bound parameter for the target path (SQLite
	// limitation: the INTO target is a name, not a host param). The path is
	// configuration/test-supplied — not user input — and is rendered as a SQL
	// string literal with interior single quotes doubled to neutralize quotes.
	q := fmt.Sprintf("VACUUM INTO %s", sqlStringLiteral(dstPath))
	if _, err := s.db.ExecContext(ctx, q); err != nil {
		return fmt.Errorf("vacuum into %q: %w", dstPath, err)
	}
	return nil
}

// Restore copies a backup file to a usable database path. The source must be a
// VACUUM INTO product — self-contained, no -wal/-shm — so a file copy is safe.
// AR#15 forbids raw-cp of a *live* WAL-mode DB; Restore takes a quiescent
// backup file (never a running DB), so that restriction does not apply here.
// If dstPath exists it is overwritten (caller ensures dst is not a live DB).
func Restore(_ context.Context, srcPath, dstPath string) error {
	return copyFile(srcPath, dstPath)
}

// sqlStringLiteral renders s as a single-quoted SQL string literal with interior
// single quotes doubled. Used only for config/test-supplied paths because
// VACUUM INTO does not accept bound parameters.
func sqlStringLiteral(s string) string {
	out := make([]byte, 0, len(s)+2)
	out = append(out, '\'')
	for i := 0; i < len(s); i++ {
		if s[i] == '\'' {
			out = append(out, '\'', '\'')
		} else {
			out = append(out, s[i])
		}
	}
	out = append(out, '\'')
	return string(out)
}

func copyFile(src, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open src %q: %w", src, err)
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("create dst %q: %w", dst, err)
	}
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()
	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("copy %q→%q: %w", src, dst, err)
	}
	return out.Sync()
}
