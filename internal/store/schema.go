// ══════════════════════════════════════════════════════════════════════════════
// Story 2.1 RED PHASE SCAFFOLDS - users/sessions schema (ATDD)
// ══════════════════════════════════════════════════════════════════════════════
//
// This file declares the business-table types (User/Session) and Store helpers
// for Story 2.1. ALL method bodies are `panic("not implemented: DS T-K")` stubs
// so go vet/go build pass with zero product behavior. The matching tests in
// schema_test.go are `t.Skip` - red phase keeps the go test baseline GREEN.
//
// DS unskips tests per T1/T3/T7/T9 and replaces each panic body with the real
// SQLite impl (CREATE TABLE / INSERT ... ON CONFLICT / crypto/rand token).
//
// Red-scaffold choice (DS may refine): story §4 sketched `Migrate(db *sql.DB)`
// as a package func, but Store already wraps *sql.DB (1a.1), so Migrate +
// the helpers are methods on *Store (s.db). DS T1 first step can revert to a
// package func + adjust schema_test.go if preferred - the signature is the
// only coupling. Rationale: idiomatic Go, tests open Store + call methods.
//
// Baseline preservation (SDR#21): store.go Open/pragmas/SetMaxOpenConns(1)/
// modernc driver are NOT modified - Migrate is a NEW file, not a store.go edit.
// ══════════════════════════════════════════════════════════════════════════════

package store

import (
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/google/uuid"
)

// User is a row of the `users` table (AC-5/SDR#2). The UNIQUE anchor is
// (oauth_provider, oauth_user_id) - NOT email - so B9 same-email-different-
// provider logins create two independent rows (SDR#33, never merge by email).
type User struct {
	ID            string
	Username      string
	Email         string
	OAuthProvider string // 'github' | 'google' | 'fake' (CHECK constraint, SDR#11; fake = dev-only)
	OAuthUserID   string
	CreatedAt     time.Time
}

// Session is a row of the `sessions` table (AC-8/SDR#3). Token is an opaque
// crypto/rand 32-byte base64.RawURLEncoding string (NON-JWT, AD-16/SDR#3);
// SQLite is the source of truth so sessions survive process restart (AC-9).
type Session struct {
	Token     string
	UserID    string // FK -> users.id ON DELETE CASCADE
	ExpiresAt time.Time
	CreatedAt time.Time
}

// Migrate creates the users + sessions tables if absent (idempotent). AC-5.
func (s *Store) Migrate() error {
	ddl := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL,
			email TEXT NOT NULL DEFAULT '',
			oauth_provider TEXT NOT NULL CHECK(oauth_provider IN ('github','google','fake')),
			oauth_user_id TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(oauth_provider, oauth_user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, d := range ddl {
		if _, err := s.db.Exec(d); err != nil {
			return err
		}
	}
	return nil
}

// UpsertUser inserts a new user row or, on UNIQUE(oauth_provider, oauth_user_id)
// conflict, refreshes username (id stable). AC-6. Returns the user row.
func (s *Store) UpsertUser(provider, oauthUserID, username, email string) (*User, error) {
	var u User
	err := s.db.QueryRow(
		`INSERT INTO users(id, username, email, oauth_provider, oauth_user_id)
		 VALUES(?, ?, ?, ?, ?)
		 ON CONFLICT(oauth_provider, oauth_user_id)
		 DO UPDATE SET username=excluded.username, email=excluded.email
		 RETURNING id, username, email, oauth_provider, oauth_user_id, created_at`,
		newUUID(), username, email, provider, oauthUserID,
	).Scan(&u.ID, &u.Username, &u.Email, &u.OAuthProvider, &u.OAuthUserID, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// FindUser returns the user row by id, or (nil, sql.ErrNoRows) if absent. AC-6.
func (s *Store) FindUser(id string) (*User, error) {
	var u User
	err := s.db.QueryRow(
		`SELECT id, username, email, oauth_provider, oauth_user_id, created_at
		 FROM users WHERE id=?`, id,
	).Scan(&u.ID, &u.Username, &u.Email, &u.OAuthProvider, &u.OAuthUserID, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// newUUID generates a UUIDv4 string using google/uuid (SDR#2).
func newUUID() string {
	return uuid.New().String()
}

// SessionTTL is the default session lifetime (7 days).
const SessionTTL = 7 * 24 * time.Hour

// CreateSession mints an opaque crypto/rand 32-byte token, inserts a sessions
// row (user_id + expires_at = now + SessionTTL), and returns the row. AC-8/AC-9.
func (s *Store) CreateSession(userID string) (*Session, error) {
	token, err := generateToken()
	if err != nil {
		return nil, err
	}
	sess := &Session{
		Token:     token,
		UserID:    userID,
		ExpiresAt: time.Now().Add(SessionTTL),
		CreatedAt: time.Now(),
	}
	_, err = s.db.Exec(
		`INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?,?,?,?)`,
		sess.Token, sess.UserID, sess.ExpiresAt, sess.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return sess, nil
}

// GetSession returns the session row for token if not expired, else
// (nil, sql.ErrNoRows) - expired sessions fail validation. AC-8/AC-9.
func (s *Store) GetSession(token string) (*Session, error) {
	var sess Session
	err := s.db.QueryRow(
		`SELECT token, user_id, expires_at, created_at
		 FROM sessions WHERE token=? AND expires_at>?`,
		token, time.Now(),
	).Scan(&sess.Token, &sess.UserID, &sess.ExpiresAt, &sess.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// DeleteSession removes a session row (logout / revoke). AC-11/SDR#3.
func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token=?`, token)
	return err
}

// generateToken returns a crypto/rand 32-byte base64.RawURLEncoding opaque token.
func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
