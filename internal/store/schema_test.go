// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - users/sessions schema tests (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// All tests below are marked `t.Skip` (TDD RED). DS activates them per
// T1/T3/T7/T9 as the matching Store methods land in schema.go. Each header
// declares gov: `AC-N + SDR#M + T-K`.
//
// Product code (store.go, backup.go) MUST NOT be touched in ATDD scaffold
// phase (SDR#21/SDR#34). The panic stubs in schema.go let `go vet`/`go build`
// pass; t.Skip keeps go test green. DS replaces stubs + removes t.Skip.
// ══════════════════════════════════════════════════════════════════════════════

package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// openTestStore opens a fresh Store on a temp DB (mirror store_test.go pattern).
func openTestStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	st, err := Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

// tableColumns returns the set of column names for table (PRAGMA table_info).
func tableColumns(t *testing.T, st *Store, table string) map[string]bool {
	t.Helper()
	rows, err := st.DB().Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		t.Fatalf("pragma_table_info %s: %v", table, err)
	}
	defer rows.Close()
	cols := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan col: %v", err)
		}
		cols[name] = true
	}
	return cols
}

// TestMigrateCreatesUsersAndSessionsTables guards AC-5: Migrate creates the
// users + sessions tables with the SDR#2/SDR#3 columns + constraints.
func TestMigrateCreatesUsersAndSessionsTables(t *testing.T) {
	// gov: AC-5 + SDR#2 + SDR#3 + SDR#11 + T0(red)/T1(green)
	st := openTestStore(t)
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// users + sessions exist
	for _, table := range []string{"users", "sessions"} {
		var name string
		err := st.DB().QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table).Scan(&name)
		if err != nil {
			t.Errorf("table %q missing after Migrate: %v", table, err)
		}
	}
	// users columns (SDR#2)
	uCols := tableColumns(t, st, "users")
	for _, want := range []string{"id", "username", "oauth_provider", "oauth_user_id", "created_at"} {
		if !uCols[want] {
			t.Errorf("users missing column %q", want)
		}
	}
	// sessions columns (SDR#3)
	sCols := tableColumns(t, st, "sessions")
	for _, want := range []string{"token", "user_id", "expires_at", "created_at"} {
		if !sCols[want] {
			t.Errorf("sessions missing column %q", want)
		}
	}
	// oauth_provider CHECK IN ('github','google') -> invalid provider rejected (SDR#11)
	_, err := st.DB().Exec(`INSERT INTO users(id,username,oauth_provider,oauth_user_id) VALUES('u1','a','gitlab','g1')`)
	if err == nil {
		t.Errorf("INSERT invalid oauth_provider='gitlab' should fail CHECK constraint")
	}
	// UNIQUE(oauth_provider, oauth_user_id) -> duplicate rejected (SDR#2/B9)
	_, _ = st.DB().Exec(`INSERT INTO users(id,username,oauth_provider,oauth_user_id) VALUES('u1','a','github','g1')`)
	_, err = st.DB().Exec(`INSERT INTO users(id,username,oauth_provider,oauth_user_id) VALUES('u2','b','github','g1')`)
	if err == nil {
		t.Errorf("duplicate (github,g1) should fail UNIQUE constraint")
	}
}

// TestUpsertUserFindOrCreate guards AC-6: first call creates a row; repeat
// call with same (provider, oauth_user_id) refreshes username, id stable.
func TestUpsertUserFindOrCreate(t *testing.T) {
	// gov: AC-6 + SDR#2 + T2(red)/T3(green)
	st := openTestStore(t)
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	first, err := st.UpsertUser("github", "g1", "alice", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert first: %v", err)
	}
	if first.ID == "" || first.Username != "alice" {
		t.Fatalf("first user = %+v", first)
	}
	// Repeat: same provider+oauth_user_id, new username -> id stable, username refreshed.
	again, err := st.UpsertUser("github", "g1", "alice2", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert again: %v", err)
	}
	if again.ID != first.ID {
		t.Errorf("id changed on re-login: first=%s again=%s (must be stable, AC-6)", first.ID, again.ID)
	}
	if again.Username != "alice2" {
		t.Errorf("username not refreshed: got %q want alice2", again.Username)
	}
	// FindUser by id returns the refreshed row.
	got, err := st.FindUser(first.ID)
	if err != nil {
		t.Fatalf("finduser: %v", err)
	}
	if got.Username != "alice2" {
		t.Errorf("FindUser username = %q want alice2", got.Username)
	}
}

// TestUpsertUserB9TwoProvidersSameEmail guards AC-7/SDR#33 (B9): the same
// email across two providers creates TWO independent user rows (UNIQUE anchor
// is provider+oauth_user_id, NOT email - never merge by email).
func TestUpsertUserB9TwoProvidersSameEmail(t *testing.T) {
	// gov: AC-7 + SDR#2 + SDR#33 + T4(red)/T5(green)
	st := openTestStore(t)
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	gh, err := st.UpsertUser("github", "gh1", "alice", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert github: %v", err)
	}
	goog, err := st.UpsertUser("google", "gg1", "alice", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert google: %v", err)
	}
	if gh.ID == goog.ID {
		t.Errorf("B9 violated: github + google same email merged to one id %s (must be two independent users)", gh.ID)
	}
	if gh.OAuthProvider == goog.OAuthProvider {
		t.Errorf("providers equal: %s (must differ)", gh.OAuthProvider)
	}
	// Both rows present (count=2), not merged.
	var n int
	if err := st.DB().QueryRow(`SELECT COUNT(*) FROM users WHERE email='alice@example.com'`).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 2 {
		t.Errorf("users with alice@example.com = %d, want 2 (B9: two providers = two rows, SDR#33)", n)
	}
}

// TestCreateSessionGetSession guards AC-8/AC-9: CreateSession mints a 32-byte
// opaque token + writes the sessions row; GetSession returns it; expired fails.
func TestCreateSessionGetSession(t *testing.T) {
	// gov: AC-8 + AC-9 + SDR#3 + T6(red)/T7(green)
	st := openTestStore(t)
	if err := st.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	user, err := st.UpsertUser("github", "g1", "alice", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	sess, err := st.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	// Token is opaque crypto/rand 32 bytes base64.RawURLEncoding (non-JWT, SDR#3).
	if len(sess.Token) < 32 {
		t.Errorf("token too short: %d chars (opaque 32-byte base64url)", len(sess.Token))
	}
	if sess.UserID != user.ID {
		t.Errorf("session user_id = %q want %q", sess.UserID, user.ID)
	}
	if !sess.ExpiresAt.After(time.Now()) {
		t.Errorf("expires_at not in future: %v", sess.ExpiresAt)
	}
	// GetSession round-trips the token.
	got, err := st.GetSession(sess.Token)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.UserID != user.ID {
		t.Errorf("get session user_id = %q want %q", got.UserID, user.ID)
	}
	// Expired session fails validation (AC-9 boundary).
	_, err = st.DB().Exec(`UPDATE sessions SET expires_at=? WHERE token=?`, time.Now().Add(-time.Hour), sess.Token)
	if err != nil {
		t.Fatalf("expire session: %v", err)
	}
	if _, err := st.GetSession(sess.Token); err == nil {
		t.Errorf("expired session returned nil error (must fail validation, AC-9)")
	}
	// DeleteSession removes the row (logout).
	if err := st.DeleteSession(sess.Token); err != nil {
		t.Fatalf("delete session: %v", err)
	}
	if _, err := st.GetSession(sess.Token); err == nil {
		t.Errorf("deleted session returned nil error (must be gone, AC-11)")
	}
}

// TestBackupRestoreWithRealTables guards AC-14/SDR#34 (IR §476 fold-in):
// backup->restore round-trips with REAL business tables (users/sessions), not
// the seed stand-in of 1a.1's store_test.go. Backup captures a moment; post-
// backup mutations are absent from the restored DB.
func TestBackupRestoreWithRealTables(t *testing.T) {
	// gov: AC-14 + SDR#34 + T8(red)/T9(green)
	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.db")
	backupPath := filepath.Join(dir, "backup.db")
	restoredPath := filepath.Join(dir, "restored.db")

	live, err := Open(livePath)
	if err != nil {
		t.Fatalf("open live: %v", err)
	}
	defer live.Close()
	if err := live.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Seed users + sessions at the backup moment.
	u1, err := live.UpsertUser("github", "g1", "alice", "alice@example.com")
	if err != nil {
		t.Fatalf("upsert u1: %v", err)
	}
	if _, err := live.CreateSession(u1.ID); err != nil {
		t.Fatalf("create session: %v", err)
	}
	// Backup captures the moment (1 user, 1 session).
	if err := live.Backup(context.Background(), backupPath); err != nil {
		t.Fatalf("backup: %v", err)
	}
	// Post-backup mutation must NOT appear in the restored DB.
	if _, err := live.UpsertUser("google", "gg1", "bob", "bob@example.com"); err != nil {
		t.Fatalf("post-backup upsert: %v", err)
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
	var nUsers int
	if err := restored.DB().QueryRow(`SELECT COUNT(*) FROM users`).Scan(&nUsers); err != nil {
		t.Fatalf("count restored users: %v", err)
	}
	if nUsers != 1 {
		t.Errorf("restored users = %d, want 1 (backup is point-in-time; post-backup bob must be absent, SDR#34)", nUsers)
	}
}
