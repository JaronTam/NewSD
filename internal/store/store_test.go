package store

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// TestBackupRestoreRoundTrip verifies the AR#15 backup primitive round-trips: a
// backup captures the DB at a point in time, and restoring it yields a usable
// DB whose contents match the backup moment — not the live state after
// subsequent writes. Per IR §470, business tables arrive in Epic 2/3; the
// primitive is validated against a seed table standing in for a future table.
func TestBackupRestoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.db")
	backupPath := filepath.Join(dir, "backup.db")
	restoredPath := filepath.Join(dir, "restored.db")

	live, err := Open(livePath)
	if err != nil {
		t.Fatalf("open live: %v", err)
	}
	defer live.Close()

	// seed: stand-in for a future business table (IR §470 — seed/empty DB).
	if _, err := live.DB().Exec(`CREATE TABLE seed(k INTEGER PRIMARY KEY, v TEXT)`); err != nil {
		t.Fatalf("create seed: %v", err)
	}
	if _, err := live.DB().Exec(`INSERT INTO seed(v) VALUES('a'),('b')`); err != nil {
		t.Fatalf("insert seed: %v", err)
	}

	// Backup captures the moment (2 rows present).
	if err := live.Backup(context.Background(), backupPath); err != nil {
		t.Fatalf("backup: %v", err)
	}

	// Post-backup mutation must NOT appear in the restored DB.
	if _, err := live.DB().Exec(`INSERT INTO seed(v) VALUES('c')`); err != nil {
		t.Fatalf("post-backup insert: %v", err)
	}

	// Restore to a fresh path.
	if err := Restore(context.Background(), backupPath, restoredPath); err != nil {
		t.Fatalf("restore: %v", err)
	}

	restored, err := Open(restoredPath)
	if err != nil {
		t.Fatalf("open restored: %v", err)
	}
	defer restored.Close()

	var n int
	if err := restored.DB().QueryRow(`SELECT COUNT(*) FROM seed`).Scan(&n); err != nil {
		t.Fatalf("count restored: %v", err)
	}
	if n != 2 {
		t.Fatalf("restored row count = %d, want 2 (backup is a point-in-time snapshot; post-backup 'c' must be absent)", n)
	}

	// Restored DB is writable — a usable database, not a read-only copy.
	if _, err := restored.DB().Exec(`INSERT INTO seed(v) VALUES('restored-write')`); err != nil {
		t.Fatalf("write to restored: %v", err)
	}
}

// TestBackupRejectsExistingTarget guards the VACUUM INTO contract: the target
// must not pre-exist. A caller re-backing up to the same path must delete it
// first (or use a timestamped name).
func TestBackupRejectsExistingTarget(t *testing.T) {
	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.db")
	backupPath := filepath.Join(dir, "backup.db")

	live, err := Open(livePath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer live.Close()

	if err := live.Backup(context.Background(), backupPath); err != nil {
		t.Fatalf("first backup: %v", err)
	}
	if err := live.Backup(context.Background(), backupPath); err == nil {
		t.Fatal("second backup to existing target: want error, got nil")
	}
}

// TestBackupFileIsSelfContained confirms the ARCHITECTURE-SPINE §409 property
// the daily-backup path relies on: a VACUUM INTO product has no -wal/-shm
// sidecar (safe to raw-cp/ship to object storage).
func TestBackupFileIsSelfContained(t *testing.T) {
	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.db")
	backupPath := filepath.Join(dir, "backup.db")

	live, err := Open(livePath)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer live.Close()

	if _, err := live.DB().Exec(`CREATE TABLE t(k INTEGER PRIMARY KEY, v TEXT); INSERT INTO t(v) VALUES('x')`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := live.Backup(context.Background(), backupPath); err != nil {
		t.Fatalf("backup: %v", err)
	}

	for _, suffix := range []string{"-wal", "-shm"} {
		if _, err := os.Stat(backupPath + suffix); err == nil {
			t.Errorf("backup has sidecar %q: VACUUM INTO product must be self-contained (no -wal/-shm)", suffix)
		}
	}
}
