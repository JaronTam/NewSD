// Package store provides the SQLite persistence layer for the NewSD single
// binary (ARCHITECTURE-SPINE AD-2: SQLite WAL single file, in-process; AD-17:
// per-board partitioning is a table-layer concern, not here). This is the
// skeleton layer — Story 1a.1 lands the connection + WAL + backup primitives
// only; business tables (users/sessions/boards/CRDTSnapshot/OpLog) arrive in
// Epic 2/3 and consume this layer (IR §470: backup primitive at the skeleton
// layer is defensible, verified against a seed/empty DB).
package store

import (
	"context"
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite" // pure-Go driver — CGO_ENABLED=0 (alpine runtime, CI)
)

// Store wraps a SQLite connection pool. Methods are safe for concurrent use.
type Store struct {
	db   *sql.DB
	path string
}

// Open opens (creating if absent) the SQLite file at path with WAL journaling.
// WAL is required by ARCHITECTURE-SPINE (single-writer/multi-reader, durable
// across restarts) and is the reason AR#15 forbids raw-cp of the live DB: a
// raw copy of a WAL-mode database can capture an inconsistent state (the main
// file alone misses un-checkpointed pages in -wal).
func Open(path string) (*Store, error) {
	// modernc registers under the driver name "sqlite". The DSN is the bare
	// file path; pragmas are set via Exec so the call is driver-agnostic
	// (mattn/modernc both speak PRAGMA statements).
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite %q: %w", path, err)
	}
	// Cap the pool at a single connection: modernc/SQLite serializes writes, and
	// allowing >1 open conn invites SQLITE_BUSY under concurrent writers. WAL
	// readers still do not block the writer — reads are concurrent at the page
	// level within the single conn. Revisit if a future story needs read scaling.
	db.SetMaxOpenConns(1)

	ctx := context.Background()
	for _, p := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA foreign_keys=ON",
	} {
		if _, err := db.ExecContext(ctx, p); err != nil {
			db.Close()
			return nil, fmt.Errorf("pragma %q: %w", p, err)
		}
	}
	return &Store{db: db, path: path}, nil
}

// DB returns the underlying *sql.DB for use by future Epic 2/3 table layers.
// Callers must not close it; use Store.Close.
func (s *Store) DB() *sql.DB { return s.db }

// Path returns the on-disk path of the live database file.
func (s *Store) Path() string { return s.path }

// Close releases the connection pool.
func (s *Store) Close() error { return s.db.Close() }
