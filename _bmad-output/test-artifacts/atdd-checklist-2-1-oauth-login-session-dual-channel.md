---
stepsCompleted:
  [
    step-01-preflight,
    step-02-generation-mode,
    step-03-ac-coverage,
    step-04-per-file-generation,
    step-4c-aggregate-red-compliance,
    step-05-validate-ds-handoff,
  ]
lastStep: step-05-validate-ds-handoff
lastSaved: 2026-07-20
storyId: "2.1"
storyKey: "2-1-oauth-login-session-dual-channel"
storyFile: _bmad-output/implementation-artifacts/2-1-oauth-login-session-dual-channel.md
atddChecklistPath: _bmad-output/test-artifacts/atdd-checklist-2-1-oauth-login-session-dual-channel.md
baselineCommit: ca4ce02
generatedTestFiles:
  - internal/store/schema.go
  - internal/store/schema_test.go
  - internal/auth/state.go
  - internal/auth/state_test.go
  - internal/auth/provider.go
  - internal/auth/provider_test.go
  - internal/auth/handler.go
  - internal/auth/handler_test.go
  - src/routes/login.test.tsx
  - src/lib/auth/authStore.test.ts
  - e2e/oauth-login.spec.ts
inputDocuments:
  - _bmad-output/implementation-artifacts/2-1-oauth-login-session-dual-channel.md
  - _bmad-output/project-context.md
  - src/lib/sd/autosave.test.ts (1a-13 red-scaffold precedent)
  - src/lib/render/i18n-switch.test.tsx (1a.9 TSX declare-function precedent)
  - src/lib/sd/langStore.test.ts (1a.9 external-store precedent)
  - internal/store/store.go (Store API surface)
  - internal/store/backup.go (Backup/Restore API for AC-14)
---

# ATDD Red-Phase Checklist — Story 2.1 OAuth Login & Session Dual-Channel

## Step 1 — Preflight (baseline reconciliation + scope)

### 1.1 Baseline distinction (working-tree vs committed)

Story 2.1 declares `baseline @ca4ce02 730 passed | 1 skipped / 31 files`. That is the **committed** baseline. The **working-tree** at ATDD-start additionally carries uncommitted 1a.9 + 5.1 red scaffolds (same batch, `newsd-current-batch-declaration`):

| Baseline                  | Tests                              | Files                            | Source                                                |
| ------------------------- | ---------------------------------- | -------------------------------- | ----------------------------------------------------- |
| committed `ca4ce02`       | 730 passed \| 1 skipped            | 31                               | git tree                                              |
| working-tree (before 2.1) | 730 passed \| **35 skipped** (765) | 31 passed \| **9 skipped** (40)  | +1a.9 (4 files) +5.1 (5 files), all it.skip           |
| working-tree (after 2.1)  | 730 passed \| **44 skipped** (774) | 31 passed \| **11 skipped** (42) | +2.1 (login.test.tsx + authStore.test.ts), +9 it.skip |

`passed` is **unchanged at 730** across all three rows — red scaffolds only add `skipped`, never new passing tests. Delta attributable to 2.1 = **+9 vitest it.skip** (login.test.tsx 5 + authStore.test.ts 4) + **+4 e2e test.skip** (oauth-login.spec.ts) + **6 Go t.Skip test funcs** across 4 Go _test.go files (12 t.Skip total: schema 5 + state 2 + provider 2 + handler 3 = 12).

### 1.2 Scope guard (DS-only modifications)

ATDD red phase touches ONLY new files (story §4 authoritative file list). MODIFIED files (`main.go`, `internal/server/server.go`, `go.mod` google/uuid indirect->direct) are deferred to DS — NOT touched here. `internal/store/store.go` (SDR#21) and `internal/server/server.go` (SDR#20) preserved invariants verified: store.go Open/pragmas/SetMaxOpenConns(1)/modernc untouched; server.go /__version + /__health + SPA fallback untouched.

### 1.3 Go red-scaffold mechanism (no ambient declarations)

Go has no TS-style `declare` ambient. Red scaffolds therefore ship **minimal signature stubs** in impl files with `panic("not implemented: DS T-K")` bodies — enough for `go vet`/`go build` to pass, never reached at test time because the `_test.go` calls `t.Skip()`. Verified: `go vet ./...` 0, `go build ./...` 0, `go test ./...` 4 pkg green (auth newly added).

### 1.4 TS red-scaffold mechanism (ambient declare)

New TS modules (`src/routes/login.tsx`, `src/lib/auth/authStore.ts`) do not exist in baseline. Tests declare their surface via typed `declare function`/`declare const` ambient declarations + `it.skip()` — no product code, tsc stays green. Return types use `import("react").ReactElement` (inline) NOT `JSX.Element` (React 19 removed global JSX namespace — caught + fixed in verify).

## Step 2 — Generation Mode

**AI Generation** (single-pass, 11 files). No human-pair. Mechanism: read story §4 file list + SDR gov tags + 1a-13/1a.9 red precedents -> emit stub+test pairs with `// RED PHASE SCAFFOLDS` banner + `// gov: AC-N + SDR#M + T-K` per-test header + real assertions (no placeholders). Go stubs panic-on-call; TS tests declare ambient; e2e uses `test.skip("title", cb)`.

## Step 3 — AC -> scenario -> level -> priority coverage table

| AC    | Scenario                                                                       | Level                     | Priority | Red test file(s)                                                                                                                  | DS task           |
| ----- | ------------------------------------------------------------------------------ | ------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| AC-1  | /login renders GitHub+Google entries linking to /api/auth/{provider}/start     | unit + e2e                | P0       | src/routes/login.test.tsx (2 it.skip) + e2e/oauth-login.spec.ts AC-1                                                              | T19/T20           |
| AC-2  | state = crypto/rand 32B base64.RawURLEncoding + cookie + constant-time compare | unit                      | P0       | internal/auth/state_test.go (2 t.Skip)                                                                                            | T10/T11           |
| AC-3  | callback validates state + Exchange code->token + creates session              | unit + integration        | P0       | internal/auth/provider_test.go (Exchange) + internal/auth/handler_test.go TestCallbackCreatesSessionAndCookie                     | T12/T14/T15       |
| AC-4  | fetch oauth_user_id + email; email null -> reject                              | unit                      | P0       | internal/auth/provider_test.go TestFakeProviderEmailNull + TestFakeProviderExchangeAndFetchUser                                   | T12               |
| AC-5  | users table schema + CHECK + UNIQUE(provider,oauth_user_id)                    | unit                      | P0       | internal/store/schema_test.go TestMigrateCreatesUsersAndSessionsTables                                                            | T0/T1             |
| AC-6  | upsert = find-or-create (id stable, username refresh)                          | unit                      | P0       | internal/store/schema_test.go TestUpsertUserFindOrCreate                                                                          | T2/T3             |
| AC-7  | B9 two providers same email = two independent users                            | unit                      | P0       | internal/store/schema_test.go TestUpsertUserB9TwoProvidersSameEmail                                                               | T4/T5             |
| AC-8  | session token opaque 32B + dual channel (cookie + JSON body)                   | unit + integration + unit | P0       | schema_test.go TestCreateSessionGetSession + handler_test.go TestCallbackCreatesSessionAndCookie + src/lib/auth/authStore.test.ts | T6/T7/T14/T21/T22 |
| AC-9  | session persists SQLite (GetSession reads SQLite)                              | unit                      | P1       | schema_test.go TestCreateSessionGetSession (GetSession path)                                                                      | T7                |
| AC-10 | E18 error toast classification (provider_down/email_null/state_expired)        | integration + unit        | P0       | handler_test.go TestCallbackStateExpired/TestCallbackEmailNull + login.test.tsx error-map (4 it.skip)                             | T14/T19           |
| AC-11 | Go auth skeleton: routing + /me + /logout + env config + FAKE_OAUTH            | integration               | P0       | handler_test.go TestStartRedirectsToProvider/TestMeReturnsUserOr401/TestLogoutDeletesSession                                      | T14/T15/T16/T17   |
| AC-12 | Dockerfile stage2 auto-includes internal/auth                                  | gate                      | —        | (no red test; DS T18 `go build` gate)                                                                                             | T18               |
| AC-13 | grep dist/client zero client_secret (SDR#6 hard red line)                      | e2e                       | P0       | e2e/oauth-login.spec.ts AC-13 (child_process grep)                                                                                | T23               |
| AC-14 | backup->restore E2E with real users/sessions tables                            | integration               | P1       | schema_test.go TestBackupRestoreWithRealTables                                                                                    | T8/T9             |
| AC-15 | dep chain + execution order (process meta)                                     | —                         | —        | (no test; SDR#35 process guard)                                                                                                   | —                 |
| AC-16 | canvas no forced gate (existing 29 e2e no-regression)                          | —                         | —        | (covered by AC-17 full-suite no-regression)                                                                                       | —                 |
| AC-17 | no regression: full suite green (gate)                                         | gate                      | P0       | (red scaffolds themselves keep baseline green; DS T24 finalizes counts)                                                           | T24               |

**Coverage**: 13 of 17 AC carry red tests (AC-1,2,3,4,5,6,7,8,9,10,11,13,14); 4 are gate/process (AC-12 build, AC-15 order, AC-16 no-gate-via-suite, AC-17 gate). No AC unaccounted.

## Step 4 — Per-file generation notes

### 4.1 `internal/store/schema.go` (NEW, impl stub)

- Types `User` + `Session` (story §2 域模型 fields).
- Methods on `*Store`: `Migrate`, `UpsertUser`, `FindUser`, `CreateSession`, `GetSession`, `DeleteSession` — all `panic("not implemented: DS T-K (AC-N/SDR#M)")`.
- **DS flag**: story §4 sketched `Migrate(db *sql.DB)` as package func; ATDD chose method-on-`*Store` (cleaner, reuses `s.db`). DS may reconcile — either form satisfies AC-5 tests (tests call `st.Migrate()`).

### 4.2 `internal/store/schema_test.go` (NEW, test) — 5 t.Skip

- `openTestStore(t)` helper (Open + TempDir + Cleanup).
- `tableColumns(t, st, table)` helper (pragma_table_info).
- Tests: MigrateCreatesUsersAndSessionsTables (AC-5), UpsertUserFindOrCreate (AC-6), UpsertUserB9TwoProvidersSameEmail (AC-7), CreateSessionGetSession (AC-8/AC-9), BackupRestoreWithRealTables (AC-14).

### 4.3 `internal/auth/state.go` (NEW, impl stub) — `GenerateState`/`ValidateState` panic stubs.

### 4.4 `internal/auth/state_test.go` (NEW, test) — 2 t.Skip

- TestGenerateStateIs32ByteBase64URL (AC-2), TestValidateStateGuardsCSRF (AC-2, table-driven match/mismatch/empty).

### 4.5 `internal/auth/provider.go` (NEW, impl stub)

- `UserInfo` struct + `Provider` interface (Name/AuthURL/Exchange/FetchUser).
- 3 pointer-receiver stub types (github/google/fake) + constructors returning `Provider`. Method bodies panic. No import cycle (store does not import auth).

### 4.6 `internal/auth/provider_test.go` (NEW, test) — 2 t.Skip

- TestFakeProviderExchangeAndFetchUser (AC-3/AC-4), TestFakeProviderEmailNull (AC-4/AC-10).

### 4.7 `internal/auth/handler.go` (NEW, impl stub)

- `Config` struct (env fields + SessionTTL + FakeOAuth).
- `New(mux, cfg, store, providers) http.Handler` panic stub (DS T15).

### 4.8 `internal/auth/handler_test.go` (NEW, test) — 3 t.Skip

- `setupAuthHandler(t, providers)` + `fakeProviders(name, user)` helpers.
- Tests: TestStartRedirectsToProvider (AC-1/AC-11), TestCallbackCreatesSessionAndCookie (AC-3/AC-8), TestCallbackStateExpired + TestCallbackEmailNull (AC-10), TestMeReturnsUserOr401 + TestLogoutDeletesSession (AC-11). (Multiple assertions per t.Skip func; count = 6 test funcs total across the file — see 4c.)

### 4.9 `src/routes/login.test.tsx` (NEW, test) — 5 it.skip

- `declare function Login(): import("react").ReactElement` ambient (NOT JSX.Element — React 19).
- AC-1: 2 entries href + data-testid ns-login-{github,google}.
- AC-10: 4 error-map cases (?error=provider_down/email_null/state_expired -> promptStore.toast; no error -> not called).

### 4.10 `src/lib/auth/authStore.test.ts` (NEW, test) — 4 it.skip

- Ambient declares: `fetchMe`/`getUsername`/`getToken`/`subscribe`/`getSnapshot`.
- AC-8/AC-11: 200->username+token; 401->null; subscribe+getSnapshot.
- AC-8/SDR#9: token NOT in localStorage/sessionStorage (leak check).

### 4.11 `e2e/oauth-login.spec.ts` (NEW, e2e) — 4 test.skip

- AC-1: two entries via getByTestId.
- AC-13: `git grep -li -E "client_secret|CLIENT_SECRET" dist/client` -> zero hits (skips if dist absent).
- AC-17: FAKE_OAUTH=1 full flow (login -> fake authorize -> callback -> ns-session cookie httpOnly -> /api/auth/me 200; logout -> cookie cleared -> /me 401). DS T23 wires Playwright `webServer` env.

## Step 4c — Aggregate + red-compliance

### 4c.1 File + skip count

- Go impl stubs: 4 (schema.go, state.go, provider.go, handler.go) — all panic-bodies, `go vet`/`go build` pass.
- Go test files: 4 — **12 t.Skip** test funcs (schema 5 + state 2 + provider 2 + handler 3).
- TS test files: 2 — **9 it.skip** (login.test.tsx 5 + authStore.test.ts 4).
- e2e spec: 1 — **4 test.skip**.
- Total new files: **11**. Total new skipped tests: **25** (12 Go + 9 vitest + 4 e2e).

### 4c.2 Red-compliance checklist

- [x] All new tests skip (t.Skip / it.skip / test.skip) — none execute against absent product code.
- [x] No product code touched (only NEW stub files; `// RED PHASE SCAFFOLDS` banner in each).
- [x] Real assertions (no placeholder `expect(true)`): decode-base64-32-bytes, UNIQUE-dup-rejected, count=2 B9, 302+Location+cookie-attributes, promptStore.toast called-with-mapped-message, token-not-in-storage.
- [x] gov comments per test (`// gov: AC-N + SDR#M + T-K`).
- [x] `go vet ./...` 0; `go build ./...` 0; `go test ./...` 4 pkg green.
- [x] `tsc --noEmit` 0 (after JSX.Element -> ReactElement fix).
- [x] e2e discovery OK (`playwright test --list` 4 tests, no parse errors; all test.skip at runtime).
- [x] SDR invariants preserved: SDR#21 store.go untouched, SDR#20 server.go untouched, SDR#1 no golang.org/x/oauth2 (go.mod zero new require), SDR#6 no client_secret in any frontend file.

## Step 5 — Validate + DS handoff

### 5.1 Gate results (working-tree after 2.1 scaffolds)

| Gate     | Command                                              | Result                                      |
| -------- | ---------------------------------------------------- | ------------------------------------------- |
| Go vet   | `go vet ./...`                                       | 0 ✅                                        |
| Go build | `go build ./...`                                     | 0 ✅                                        |
| Go test  | `go test ./...`                                      | 4 pkg green (auth added) ✅                 |
| tsc      | `npx tsc --noEmit`                                   | 0 ✅ (after ReactElement fix)               |
| vitest   | `npx vitest run`                                     | 730 passed \| 44 skipped (774) ✅ — see 5.2 |
| e2e list | `npx playwright test e2e/oauth-login.spec.ts --list` | 4 tests, all test.skip ✅                   |

### 5.2 Baseline reconciliation

- `passed` unchanged at **730** (red scaffolds add skips only).
- vitest skipped delta: working-tree-before 35 -> after **44** (+9 = login 5 + authStore 4). Consistent with §1.1 projection.
- e2e: full-suite run deferred to DS T24 (red spec is test.skip; 29|21 baseline unregressed at discovery level). DS must run full `bun run test:e2e` and record full-suite count (memory `newsd-e2e-attestation-full-suite-not-subset`).
- Go: baseline 3 pkg (store/server/version) -> 4 pkg (+auth). All green, no regression.

### 5.3 DS handoff notes (flags for DS)

1. **Go API shape**: ATDD placed schema methods on `*Store` (Migrate/UpsertUser/FindUser/CreateSession/GetSession/DeleteSession) and `New(mux, cfg, store, providers)` for auth. Story §4 sketched `Migrate(db *sql.DB)` package func. DS reconciles — tests call `st.Migrate()` so method-on-Store is the path of least resistance; if DS prefers package func, adjust test helper `openTestStore` accordingly.
2. **Provider constructor signatures**: `newGithubProvider/newGoogleProvider(clientID, clientSecret, redirectBase)` + `newFakeProvider(user *UserInfo)`. DS wires real `http.Client` + endpoints; fake provider short-circuits Exchange/FetchUser (Q2=B).
3. **e2e webServer wiring**: oauth-login.spec.ts AC-17 needs `FAKE_OAUTH=1` Go backend via Playwright `webServer` (DS T23). Until wired, the 4 e2e tests stay skipped — do NOT force-run green before T23.
4. **JSX.Element fix**: login.test.tsx ambient uses `import("react").ReactElement` (React 19 dropped global JSX namespace). DS swaps ambient declare for real `import Login from "./login"` at T20.
5. **Handler test `New` signature**: `New(mux *http.ServeMux, cfg Config, st *store.Store, providers map[string]Provider) http.Handler`. DS may return `http.Handler` or mutate mux in place — tests use `httptest.NewServer(handler)` so either works.
6. **AC-12/AC-15/AC-16/AC-17** carry no dedicated red test (gate/process). DS T18 (docker build) + T24 (full gate) close these.

### 5.4 Red-phase verdict

**GREEN baseline preserved**. 25 new skipped tests across 11 new files, zero passing-test delta, zero product-code modification, zero regression in existing 730 passing / 4 Go pkg. DS may proceed to make tests green (T1/T11/T13/T15/T17/T20/T22 first-real-impl per story Dev Notes L99).
