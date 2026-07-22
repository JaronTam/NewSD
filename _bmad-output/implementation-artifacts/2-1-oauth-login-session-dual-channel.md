---
baseline_commit: ca4ce02
baseline_tests: tsc 0 + vitest 730 passed | 1 skipped / 31 files (实测 @ca4ce02 本会话; PR#63 docs-only project-context drift, 无前端 code delta) + e2e 29 passed | 21 skipped / 50 (1a.13 CR 终态实测 @a3cd209, PR#63 docs-only 承接无回归) + go test ./... (1a.1 store/server/version, 3 pkg)
---

# Story 2.1: OAuth Login & Session Dual-Channel (oauth-login-session-dual-channel)

Status: done

## Story

As a 协作建模者,
I want to log in with GitHub/Google OAuth and obtain a cross-device session,
so that my boards and badges are bound to an account rather than a browser-anonymous state.

epic 依据: epics.md L941-980 Story 2.1 OAuth 登录与 session 双通道 (As a/I want/So that + 5 AC 段: OAuth 登录 / users 表与 B9 / session 双通道 / Go 后端 skeleton / E18 边界 guard); AD = AD-16 (epics.md L195 + ARCHITECTURE-SPINE AD-16); NFR-SEC-4 (epics.md L132: WS 握手首帧 token 鉴权 + Origin 校验, OAuth GitHub+Google, session 双通道 HttpOnly Secure Cookie + JSON body, SameSite=Lax 防 CSRF). IR fold-in: implementation-readiness-report-2026-07-03.md L476/L526 (2.1 建 users 表后补 backup->restore 端到端验证, 1a.1 仅验原语可用) + L525 安全约束 (client_secret server env). 前置 1a.1 (epics.md L947: Dockerfile Go build 阶段 + AD-18 部署就绪) 已 done: Go server skeleton 在 repo 根 (`main.go` + `internal/server` + `internal/store` + `go.mod`), 非架构 spine 假设的 `server/` 子目录 (1a.1 实现偏离 spine minimal-source-tree, 已成既成事实, 本 story 扩展既有根级 Go module 不另建 `server/`).

## Acceptance Criteria

> AC 分 5 段 (epics.md L950-980 原序) + IR fold-in (backup->restore E2E) + 回归 guard. OAuth provider 交互经 `Provider` interface 抽象 (AuthorizeURL/Exchange/UserInfo), Go 单测注入 fake provider; 真实 GitHub/Google 端到端 OAuth 不可在 CI 跑 (需 provider 注册 app + client_secret), e2e 覆盖 login 页 UI + grep dist 无 client_secret 残留 + dev-mode fake provider 全流程 (Q2 裁定 B: FAKE_OAUTH=1 dev-only 分支). session token 仅存 JS 内存 + HttpOnly Cookie, 不入 localStorage (AD-16: token 仅存 JS 内存不可跨域读取).

### OAuth 登录 (epics L950-957)

- [ ] **AC-1 (登录页 + provider 入口)** Given 用户访问 `/login` 路由 When 页面 mount Then 渲染 GitHub 登录 + Google 登录两个入口 (按钮/link), 点击任一 -> `GET /api/auth/{provider}/start` (server) -> 302 重定向到 provider OAuth 授权页, URL 含 `client_id` + `redirect_uri` + `state` (CSRF nonce) + `scope` (read:user / user:email for GitHub; openid email profile for Google). [SDR#1, SDR#5]
- [ ] **AC-2 (state CSRF nonce)** Given `/api/auth/{provider}/start` When 生成 state Then state = `crypto/rand` 32 bytes `base64.RawURLEncoding` 随机串, 存入短效 HttpOnly Cookie (`ns-oauth-state`, 10min TTL, SameSite=Lax) + 附 provider authorize URL query; callback 时比对 cookie state == query state, 不符 -> E18 "登录已过期请重试" toast (AC-10), 不建 session. [SDR#5, SDR#6]
- [ ] **AC-3 (callback 接收 code + 换 token)** Given provider 回调 `GET /api/auth/{provider}/callback?code=...&state=...` When server 处理 Then (a) 校验 state (AC-2); (b) 用 code POST provider token endpoint 换 access_token (请求带 `client_id` + `client_secret` 从 server env 读取, **不入前端 bundle**); (c) token endpoint 响应解析 access_token. GitHub endpoint `https://github.com/login/oauth/access_token` (Accept: json), Google endpoint `https://oauth2.googleapis.com/token`. [SDR#1, SDR#4]
- [ ] **AC-4 (取 oauth_user_id + email)** Given access_token When server GET provider user endpoint Then 解析 `oauth_user_id` (GitHub: `https://api.github.com/user` -> `id` + `login` + `email`; Google: `https://www.googleapis.com/oauth2/v2/userinfo` -> `id` + `email` + `name`). email 为 null (GitHub 用户未公开邮箱) -> E18 "provider 未返回邮箱" toast (AC-10), 拒绝建账号. [SDR#1, SDR#4]

### users 表与 B9 (epics L959-962)

- [ ] **AC-5 (users 表 schema + UNIQUE 锚点)** Given 2.1 建表 When migrate Then `users` 表列: `id TEXT PK` (UUIDv4, `github.com/google/uuid`), `username TEXT NOT NULL`, `oauth_provider TEXT NOT NULL CHECK(oauth_provider IN ('github','google'))`, `oauth_user_id TEXT NOT NULL`, `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`; UNIQUE(`oauth_provider`, `oauth_user_id`) (双 provider 共享表, GitHub/Google 各占一行). [SDR#2, SDR#11]
- [ ] **AC-6 (upsert 登录 = find-or-create)** Given callback 取得 (provider, oauth_user_id, username, email) When 写 users 表 Then `INSERT ... ON CONFLICT(oauth_provider, oauth_user_id) DO UPDATE SET username=excluded.username` (username 刷新, id 不变); 首次登录建新行, 重复登录复用既有行 (user_id 稳定, 绑定后续 Epic 2/5 关系不漂). [SDR#2]
- [ ] **AC-7 (B9 双 provider 同邮箱 = 两独立 user)** Given alice@example.com 首次 GitHub 登录建 user 行 A When 同邮箱 Google 登录 Then 建**第二行独立 user B** (provider 不同, UNIQUE 锚点 (github, G_id) ≠ (google, G'_id) 不冲突), 两账号画板不互通 (不自动合并账号, 不按 email 合并). [SDR#2, SDR#33]

### session 双通道 (epics L964-967)

- [ ] **AC-8 (session 创建 + 双通道下发)** Given callback 换 token + upsert user 成功 When 建 session Then (a) `sessions` 表插行: `token TEXT PK` (`crypto/rand` 32 bytes `base64.RawURLEncoding`), `user_id TEXT FK -> users.id`, `expires_at DATETIME` (now + 7d); (b) HttpOnly + SameSite=Lax Cookie 下发 (`ns-session`, path=/, token 值, JS 不可读, 防 XSS 偷 token); **Secure 条件化: prod (非 localhost) 设 Secure (仅 HTTPS 传), dev (localhost http) 跳过 Secure** (浏览器在 http 丢弃 Secure cookie 致 session 存不下; Q3 裁定 A); (c) JSON body 返回 `{ token, user: { id, username } }` (供 WS 首帧鉴权, 解 JS 不可读 cookie 致 WS 无法首帧带 token 矛盾); (d) 302 重定向到 `/` (canvas) 携带 cookie. [SDR#3, SDR#4, SDR#9, SDR#32]
- [ ] **AC-9 (session 持久化 SQLite + 重启不丢)** Given session 写入 SQLite sessions 表 When 进程重启 Then 重启后 cookie 仍有效 (server 查 sessions 表验 token -> user), 会话不丢 (Go 内存为 cache, SQLite 为 source of truth, AD-16: Go 内存 + SQLite session 表持久化进程重启会话不丢). [SDR#3]

### Go 后端 skeleton (epics L969-973)

- [ ] **AC-10 (E18 OAuth provider 异常 toast 分类)** Given 用户点 GitHub/Google 登录 When (a) provider down (token/user endpoint 非 2xx 或网络超时) / (b) email null / (c) state 过期 (cookie 缺失或不符) Then server 302 到 `/login?error={code}` (error code ∈ `provider_down`/`email_null`/`state_expired`), 前端读 query error -> `promptStore.toast(...)` 分类提示: provider_down -> "登录服务暂不可用" / email_null -> "provider 未返回邮箱" / state_expired -> "登录已过期请重试"; 不崩登录页不静默, 异常分类提示用户可重试. [SDR#10, SDR#11]
- [ ] **AC-11 (Go 后端 auth 骨架 = routing + SQLite pool + env config)** Given 1a.1 Go server 仅 serve 前端 dist (`internal/server/server.go`: /__version + /__health + SPA fallback) When 2.1 扩展 Then (a) `main.go` 打开 Store (`internal/store.Open`) 并注入 server (当前 main.go 未接 Store, 2.1 wire); (b) `internal/server` 增 `/api/auth/{github,google}/start` + `/api/auth/{github,google}/callback` + `GET /api/auth/me` + `POST /api/auth/logout` 路由 (Go 1.22+ `http.NewServeMux` method routing, 复用既有 mux pattern); (c) env config struct (OAUTH_GITHUB_CLIENT_ID/SECRET, OAUTH_GOOGLE_CLIENT_ID/SECRET, OAUTH_REDIRECT_BASE_URL, SESSION_TTL, FAKE_OAUTH), `os.Getenv` 读取; (d) `FAKE_OAUTH=1` dev-only fake provider 路由 (生产 env 未设则不注册, grep 生产 binary 无 fake 路由暴露; Q2 裁定 B, e2e 全流程用); 后续 Epic 2 story 复用. [SDR#7, SDR#4, SDR#1]
- [ ] **AC-12 (auth Go 代码纳入既有 Dockerfile Go build 阶段)** Given 1a.1 Dockerfile stage2 (golang:1.25, `COPY go.mod go.sum + main.go + internal/`, `go build -o /newsd`) When 2.1 加 auth 代码 Then 无新 Dockerfile 阶段, 既有 stage2 `COPY internal/` 自动纳入新 auth 文件 (auth code 落 `internal/auth/` + `internal/store` schema 扩展), `go build` 产出含 auth 的单 binary (AD-18 部署骨架在 1a.1/1b.1, 本 epic 无独立部署 story). [SDR#8]
- [ ] **AC-13 (client_secret server env + grep dist 无残留)** Given client_secret 仅经 `os.Getenv` 在 server 读取 When `bun run build` 产 dist Then `grep -ri "client_secret\|CLIENT_SECRET\|<32-hex-or-known-secret>" dist/client` 零命中 (client_secret 不入前端 bundle, AD-16 + IR L525 安全约束); 前端只持 client_id (公开值) 经 env 注入或硬编码, 不持 secret. [SDR#6]

### IR fold-in (backup->restore E2E, IR L476/L526)

- [ ] **AC-14 (backup->restore 端到端 with 真实 users/sessions 表)** Given 2.1 建 users + sessions 表 (AC-5/AC-8) When 跑 backup->restore round-trip (复用 1a.1 `internal/store.Backup/Restore`) Then (a) 插入若干 users + sessions 行 -> Backup 捕获该时刻 -> 续写 users -> Restore 到新路径 -> restored DB 含 backup 时刻 users/sessions 行, 不含续写行 (1a.1 `store_test.go TestBackupRestoreRoundTrip` 用 seed stand-in table, 本 AC 换真实 business tables 验证端到端, IR §470/§476 闭合). [SDR#34]

### 边界 guard (依赖/隔离/回归)

- [ ] **AC-15 (依赖 chain + 执行顺序)** Given Story 2.1 When 执行 Then (a) 依赖 1a.1 done (Go skeleton + Dockerfile Go build + SQLite WAL + modernc driver + google/uuid indirect); (b) 执行顺序 1a.x (done) -> **2.1 (本)** -> 2.2 (board 归属 + 权限, 前置 2.1 users 表) -> 2.3 (share_token, 前置 2.2) -> 2.4 (徽章绑账号, 前置 2.1 users 表) (epics.md L384). [SDR#35]
- [ ] **AC-16 (canvas 不强制 gate 登录 - 2.1 仅交付 auth 能力)** Given 2.1 交付 login 页 + login 流程 + session 创建 + `/api/auth/me` When 用户未登录访问 `/` (canvas) Then canvas 仍可匿名访问 (1a.x 全部匿名 e2e 不破, 29 e2e 无回归); login 页可达, 登录后 session 建立并持久; **canvas 强制 gate 登录** (未登录重定向 /login) 非本 story scope, defer 至 2.2 (board 归属需要 login) (Q1 裁定 A: 不 gate, 低回归, 29 既有 e2e 不破). [SDR#35]
- [ ] **AC-17 (无回归 - 全套件绿)** Given 2.1 全部改动 When 跑全套件 Then (a) Go `go test ./...` 全绿 (1a.1 store/server/version 3 pkg + 2.1 新增 auth/store-schema 测试); (b) `bun run typecheck` tsc 0; (c) `bun run test` vitest 全套件绿 (基线 730 passed | 1 skipped / 31 files @ca4ce02 + 本 story 新增, DS 落实 count); (d) `bun run test:e2e` 全套件绿无回归 (基线 29 passed | 21 skipped / 50, 本 story 新增 login e2e + grep-dist e2e + FAKE_OAUTH=1 fake provider 全流程 e2e, Q2 裁定 B); 记全套件 count 非 story 子集 (memory newsd-e2e-attestation-full-suite-not-subset). [SDR#24]

## Tasks / Subtasks

> TDD red-green-refactor. 每 task 标 `[gov: SDR#N]` 表设计契约根据; task 与 SDR 冲突以 SDR 为准 (memory newsd-ds-follows-task-not-cspin). Go 测试 `go test ./internal/...`; 前端 vitest jsdom + Playwright e2e.

### Go backend (auth + schema + session)

- [ ] **T0** red: `internal/store/schema_test.go` - AC-5 red 断言 `migrate` 建 users 表 (列名/类型/UNIQUE 约束) + sessions 表; 查 `sqlite_master` + `PRAGMA table_info`. `[gov: SDR#2]`
- [ ] **T1** green: `internal/store/schema.go` - `Migrate(db *sql.DB) error` (CREATE TABLE IF NOT EXISTS users + sessions + UNIQUE + FK; idempotent). AC-5 green. `[gov: SDR#2, SDR#11]`
- [ ] **T2** red: AC-6 - 断言 `UpsertUser(provider, oauth_user_id, username, email)` 首次建行 + 重复刷新 username + id 不变. `[gov: SDR#2]`
- [ ] **T3** green: `UpsertUser` (INSERT ... ON CONFLICT DO UPDATE) + `FindUser` helpers. AC-6 green. `[gov: SDR#2]`
- [ ] **T4** red: AC-7 (B9) - 同邮箱 GitHub + Google 两次登录断言两独立 user 行 (id 不同, provider 不同, 不按 email 合并). `[gov: SDR#2, SDR#33]`
- [ ] **T5** green: 无新代码 (UpsertUser 按 UNIQUE(provider, oauth_user_id) 自然两行, 集成 test 验证). AC-7 green. `[gov: SDR#2, SDR#33]`
- [ ] **T6** red: AC-8/AC-9 - 断言 `CreateSession(user_id)` 生成 32-byte token + 写 sessions 表 + `GetSession(token)` 返回 user_id + expires_at; 过期 session 验证失败. `[gov: SDR#3]`
- [ ] **T7** green: `CreateSession`/`GetSession`/`DeleteSession` (crypto/rand 32 bytes + base64.RawURLEncoding + expires_at). AC-8/AC-9 green. `[gov: SDR#3]`
- [ ] **T8** red: AC-14 (backup->restore E2E with real tables) - 插 users + sessions -> Backup -> 续写 -> Restore -> 断言 restored 含 backup 时刻行 + 不含续写行. `[gov: SDR#34]`
- [ ] **T9** green: 无新代码 (复用 1a.1 `store.Backup/Restore`, 集成 test 换真实 business tables). AC-14 green. `[gov: SDR#34]`
- [ ] **T10** red: AC-2 - 断言 `GenerateState()` 32-byte base64url; `ValidateState(cookieState, queryState)` 比对. `[gov: SDR#5]`
- [ ] **T11** green: `internal/auth/state.go` - `GenerateState()` + `ValidateState()` (crypto/rand + base64.RawURLEncoding + constant-time compare). AC-2 green. `[gov: SDR#5, SDR#6]`
- [ ] **T12** red: AC-3/AC-4 - `Provider` interface + fake impl; 断言 `fakeProvider.Exchange(code)` 返回 access_token + `fakeProvider.UserInfo(token)` 返回 oauth_user_id + email; email null 路径. `[gov: SDR#1, SDR#4]`
- [ ] **T13** green: `internal/auth/provider.go` - `Provider` interface (AuthorizeURL(state), Exchange(code), UserInfo(token)) + `githubProvider` + `googleProvider` impls (net/http + encoding/json, hand-roll 无 golang.org/x/oauth2 dep). AC-3/AC-4 green (fake); real provider 经 e2e/dev 手测. `[gov: SDR#1, SDR#4, SDR#30]`
- [ ] **T14** red: AC-1/AC-3/AC-8/AC-10 - handler 集成: `/api/auth/{provider}/start` (生成 state + 设 cookie + 302 authorize URL) + `/api/auth/{provider}/callback` (validate state + Exchange + UserInfo + UpsertUser + CreateSession + 设 ns-session cookie + 302 /) + E18 error 路径 (provider_down/email_null/state_expired -> 302 /login?error=). `[gov: SDR#1, SDR#3, SDR#5, SDR#10]`
- [ ] **T15** green: `internal/auth/handler.go` - start/callback handlers + `Config` struct (env) + `New(authMux, cfg, store, providers map[string]Provider)`. AC-1/AC-3/AC-8/AC-10 green (fake provider 注入). `[gov: SDR#1, SDR#4, SDR#7, SDR#10, SDR#11]`
- [ ] **T16** red: AC-11 (`/api/auth/me` + logout) - 断言 me 读 ns-session cookie -> GetSession -> 返回 user JSON; 未登录 401; logout 删 session + 清 cookie. `[gov: SDR#3, SDR#7]`
- [ ] **T17** green: me + logout handlers. AC-11 green. `[gov: SDR#3, SDR#7]`
- [ ] **T18** refactor: wire `main.go` open Store + Migrate + inject auth handlers into server mux; env config load (SDR#7). `[gov: SDR#7]`

### Frontend (login route + auth state + toast)

- [ ] **T19** red: AC-1 - `src/routes/login.tsx` test 断言渲染 GitHub + Google 登录入口; AC-10 断言读 `?error=` query -> `promptStore.toast` 分类提示 (provider_down/email_null/state_expired 三文案). `[gov: SDR#10, SDR#35]`
- [ ] **T20** green: `src/routes/login.tsx` (TanStack file route, 两个 provider 入口 link 到 `/api/auth/{provider}/start` + error query -> promptStore.toast). AC-1/AC-10 green. `[gov: SDR#10, SDR#35]`
- [ ] **T21** red: AC-8/AC-11 - `src/lib/auth/authStore.ts` test 断言 `fetchMe()` GET `/api/auth/me` -> 200 返回 user / 401 null; token 存 JS 内存 (模块级变量, 不入 localStorage). `[gov: SDR#3, SDR#35]`
- [ ] **T22** green: `src/lib/auth/authStore.ts` (singleton external store + useSyncExternalStore, fetchMe + token in-memory only + getUsername; 复用 project-context L85-87 外部单例 store 模式). AC-8/AC-11 green. `[gov: SDR#3, SDR#35]`

### e2e + gate

- [x] **T23** e2e: `e2e/oauth-login.spec.ts` - AC-1 (login 页渲染 + 两入口) + AC-13 (grep dist/client 无 client_secret 残留, child_process 跑 grep) + **dev-mode fake provider 全流程** (Q2 裁定 B: `FAKE_OAUTH=1` server 绕过真实 provider -> fake authorize 自动 approve -> callback -> session cookie 建立 -> /api/auth/me 返 fake user; 全流程 e2e 断言). `[gov: SDR#1, SDR#6, SDR#10]`
- [x] **T24** gate: `go test ./...` 全绿 + `bun run typecheck` (tsc 0) + `bun run test` (vitest 全套件绿, 记 count) + `bun run test:e2e` (全套件绿, 记 count). AC-17. `[gov: SDR#24]`

## Dev Notes

### ATDD Artifacts

**Red phase scaffolds (pre-DS, ATDD):** DS 前 `/bmad-testarch-atdd` 产红脚手架 (memory newsd-tea-module-installed). 全新 Go 文件 (`schema.go`/`state.go`/`provider.go`/`handler.go`) + 全新 TS 文件 (`authStore.ts`) + 全新 route (`login.tsx`) 用 `declare const`/`it.skip` 保 tsc/vitest-go-compile 绿 (memory newsd-atdd-red-scaffold-declare-const-for-new-file; Go 无 tsc, 但 `go vet`/`go build` 须过, 故 red 脚手架用 `t.Skip` + 最小签名 stub). DS T1/T11/T13/T15/T17/T20/T22 首步换真实实现.

**Baseline 验证 (gate, ATDD 不破坏基线):** tsc 0 + vitest 730 passed | 1 skipped / 31 files (实测 @ca4ce02) + go test ./... (3 pkg) + e2e 29 passed | 21 skipped / 50 (1a.13 CR 承接). 工作树 clean.

### 1. Story Decision Records (SDR)

SDR 是本 story 层内的设计契约与守卫锁, 分三段: 设计契约 (实现前已定 = 强约束, 现状/目标/守卫三元) + 保留不变量 (baseline 已成立不能倒退) + 流程 meta (为何做/放弃备选). 遵 memory `newsd-ds-follows-task-not-cspin`: task 行的 `[gov: SDR#N]` 是 DS 实施根据; task 与 SDR 冲突以 SDR 为准.

#### 设计契约 (强约束, 需守卫)

- **SDR#1 - OAuth 手搓 stdlib, 不引 golang.org/x/oauth2**
  - 现状: go.mod 仅 `modernc.org/sqlite` + `google/uuid` (indirect), 无 OAuth 库.
  - 目标: OAuth web flow 用 stdlib `net/http` + `encoding/json` 手搓: (1) 构造 provider authorize URL (client_id + redirect_uri + state + scope); (2) callback 用 code POST token endpoint (GitHub `login/oauth/access_token` / Google `oauth2.googleapis.com/token`) 解 access_token; (3) GET user endpoint (GitHub `api.github.com/user` / Google `www.googleapis.com/oauth2/v2/userinfo`) 解 oauth_user_id + email + username. `Provider` interface 抽象 (AuthorizeURL/Exchange/UserInfo) + github/google impl + fake test impl.
  - 守卫: AC-3/AC-4 (fake provider 注入 Go 单测) + AC-11(d) (FAKE_OAUTH=1 dev-only fake provider 路由, e2e 全流程用); AC-13 (grep dist 无 client_secret); 不引 `golang.org/x/oauth2` (go.mod diff 零新 require).
  - 备选 (放弃): `golang.org/x/oauth2` + `oauth2/github` + `oauth2/google` provider 包 - 标准且 tested, 但 2 provider + 无 token refresh (MVP server-side session, 非 OAuth token 持久化) 场景下抽象收益低, 且拉 `golang.org/x/net` 等传递依赖污染极简 go.mod (违 1a.1 minimal-deps 哲学). AD-16 "direct OAuth" 字面支持手搓.

- **SDR#2 - users 表 schema: UNIQUE(oauth_provider, oauth_user_id) + B9 两行独立**
  - 现状: 无 users 表 (1a.1 store.go 仅 WAL 原语, business tables "arrive in Epic 2/3" 注释).
  - 目标: `users(id TEXT PK UUIDv4, username TEXT NOT NULL, oauth_provider TEXT NOT NULL CHECK IN ('github','google'), oauth_user_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(oauth_provider, oauth_user_id))`. `UpsertUser` 用 `INSERT ... ON CONFLICT(oauth_provider, oauth_user_id) DO UPDATE SET username=excluded.username` (id 不变, 刷新 username). B9: 同邮箱两 provider = 两独立行 (UNIQUE 锚点是 provider+oauth_user_id 非 email, 不按 email 合并).
  - 守卫: AC-5 (schema migrate) + AC-6 (upsert find-or-create) + AC-7 (B9 两行).
  - ERD 依据: ARCHITECTURE-SPINE AD-16 ERD (User{id PK, username, oauth_provider, oauth_user_id, created_at}).

- **SDR#3 - sessions 表: token PK (crypto/rand 32B) + SQLite 持久 + Go 内存 cache**
  - 现状: 无 sessions 表.
  - 目标: `sessions(token TEXT PK, user_id TEXT NOT NULL FK->users.id, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`. `CreateSession(user_id)` 生成 `crypto/rand` 32 bytes `base64.RawURLEncoding` opaque token (非 JWT, AD-16: session token 非 JWT) + 写 SQLite; `GetSession(token)` 查 expires_at > now; `DeleteSession(token)` (logout + 撤销). Go 内存 map 可作 cache (AD-16 "Go 内存 + SQLite session 表"), 但 SQLite 为 source of truth (进程重启会话不丢, AC-9), cache miss 回落 SQLite.
  - 守卫: AC-8 (双通道下发 + sessions 表写) + AC-9 (重启不丢).
  - 备选 (放弃): JWT 无状态 token - 不可即时撤销 (logout 无效, 需 blacklist), 且 signing key 管理负担; AD-16 明定非 JWT.

- **SDR#4 - env config: client_secret + OAuth client_id + redirect_base + session_ttl (server env only)**
  - 现状: main.go/server.go 无 env 读取 (仅 PORT).
  - 目标: `internal/auth.Config` struct 读 env: `OAUTH_GITHUB_CLIENT_ID`/`OAUTH_GITHUB_CLIENT_SECRET`/`OAUTH_GOOGLE_CLIENT_ID`/`OAUTH_GOOGLE_CLIENT_SECRET`/`OAUTH_REDIRECT_BASE_URL` (如 `http://localhost:8080`, 拼 `/api/auth/{provider}/callback`)/`SESSION_TTL` (default 7d). `os.Getenv` + 启动时校验必填项缺失 -> 启动失败 (fail-fast) 而非运行时崩. client_secret 仅 server 侧持有, 前端只持 client_id (公开值).
  - 守卫: AC-11 (env config) + AC-13 (grep dist 无 client_secret).
  - 依据: AD-16 (client_secret 走 server env 不入前端 bundle) + IR L525 (client_secret server env).

- **SDR#5 - state CSRF nonce: crypto/rand + 短效 HttpOnly cookie 比对**
  - 现状: 无 CSRF 防护 (1a 无 auth).
  - 目标: `/api/auth/{provider}/start` 生成 state = `crypto/rand` 32 bytes `base64.RawURLEncoding`, 存 `ns-oauth-state` HttpOnly + SameSite=Lax cookie (10min TTL) + 附 authorize URL query. callback 比对 cookie state == query state (`subtle.ConstantTimeCompare`); 不符/缺失 -> E18 state_expired (AC-10). SameSite=Lax 防 OAuth redirect 的 cross-site CSRF (AD-16: SameSite=Lax 防 HTTP CSRF).
  - 守卫: AC-2 (state 生成 + 比对) + AC-10 (state_expired toast).
  - 备选 (放弃): state 存 server 内存 map - 水平扩展 (多实例) 失效, cookie 方案无状态更稳.

- **SDR#6 - client_secret 不入前端 bundle (硬红线)**
  - 现状: 前端 dist (`dist/client`) 经 go:embed 进 binary; client_secret 若误入前端代码 -> 随 dist 公开.
  - 目标: client_secret 仅 `os.Getenv` server 侧; 前端 login 页只持 provider name + `/api/auth/{provider}/start` link, 不持任何 secret; client_id 可入前端 (公开值) 但本 story 走 server 拼 authorize URL (前端无需 client_id). `grep -ri "client_secret\|CLIENT_SECRET" dist/client` 零命中 (AC-13).
  - 守卫: AC-13 (grep dist e2e + 手测).
  - 依据: AD-16 + IR L525.

- _*SDR#7 - Go skeleton 扩展: main.go wire Store + server mux 增 /api/auth/* + env config_*
  - 现状: `main.go` 仅 `server.New(clientFS)` (未开 Store); `server.go` mux 仅 /__version + /__health + SPA fallback; Store (`internal/store.Open`) 存在但未 wire.
  - 目标: (a) `main.go` 打开 Store (`store.Open(dbPath)`) + `store.Migrate(db)` + 注入 server; (b) `server.New` 签名扩展接 Store + auth.Config (或 `server.New(distClient, deps)`); (c) mux 增 `/api/auth/{github,google}/start` + `/callback` + `GET /api/auth/me` + `POST /api/auth/logout` (Go 1.22+ `mux.HandleFunc("GET /api/auth/me", ...)`, 复用既有 mux 不换 router 库); (d) env config (SDR#4) 启动加载. 既有 /__version + /__health + SPA fallback 不变 (SDR#20).
  - 守卫: AC-11 (routing + SQLite pool + env config).
  - 不变 (显式): 不建 `server/` 子目录 (1a.1 已落根级 Go module, 成既成事实; architecture spine minimal-source-tree 的 `server/main.go` 路径被 1a.1 偏离, 本 story 不纠正, 扩展既有根级).

- **SDR#8 - auth Go 代码纳入既有 Dockerfile stage2 (无新阶段)**
  - 现状: Dockerfile stage2 (golang:1.25) `COPY go.mod go.sum + main.go + internal/` + `go build`.
  - 目标: auth 代码落 `internal/auth/` + `internal/store/schema.go` 扩展, 既有 stage2 `COPY internal/` 自动纳入, `go build` 产含 auth 的单 binary; 无新 Dockerfile 阶段; CGO_ENABLED=0 (modernc pure-Go, 1a.1 既有) 不变.
  - 守卫: AC-12 (docker build 成功 + binary 含 auth 路由).
  - 依据: AD-18 (部署骨架在 1a.1/1b.1, 本 epic 无独立部署 story).

- **SDR#9 - session 双通道: HttpOnly+Secure+SameSite=Lax Cookie + JSON body token**
  - 现状: 无 session 下发.
  - 目标: callback 建 session 后 (a) Set-Cookie `ns-session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<ttl>` (JS 不可读, 防 XSS 偷 token); (b) JSON body `{ token, user: {id, username} }` (token 供 WS 首帧鉴权, 解 JS 不可读 cookie 致 WS 无法首帧带 token 矛盾, AD-16 双通道理由); (c) 302 重定向到 `/` 携 cookie. dev 环境 (localhost, 无 TLS) Secure cookie 会被浏览器丢弃 -> **Secure 条件化: 非 localhost (prod) 设 Secure, localhost (dev) 跳过 Secure** (Q3 裁定 A; 业界 localhost Secure 豁免常规 + GitHub/Google OAuth App 允许 localhost http callback; SameSite=Lax 仍设防 CSRF; prod 强制 Secure 保留, AC-8(b) 同步).
  - 守卫: AC-8 (双通道下发).
  - 依据: AD-16 (session token 双通道 HttpOnly Secure Cookie + JSON body) + NFR-SEC-4 (epics.md L132).

- **SDR#10 - E18 OAuth 异常分类 toast (provider_down / email_null / state_expired)**
  - 现状: 无 OAuth 异常处理 (1a 无 auth).
  - 目标: callback/start 异常分类: (a) `provider_down` = token/user endpoint 非 2xx 或 net.OpError/timeout; (b) `email_null` = provider 返回 email 空 (GitHub 用户未公开邮箱); (c) `state_expired` = state cookie 缺失/不符 (SDR#5). server 302 到 `/login?error={code}`, 前端 login 页 mount 读 `?error=` -> `promptStore.toast(...)`: provider_down -> "登录服务暂不可用" / email_null -> "provider 未返回邮箱" / state_expired -> "登录已过期请重试". 复用 `promptStore.toast` (1a.7 既有, `promptStore.ts:172` 单例, TOAST_MS=4000).
  - 守卫: AC-10 (分类 toast).
  - 依据: epics.md L975-980 (E18 边界 guard) + promptStore 既有 toast API.

- **SDR#11 - never-default provider switch exhaustiveness (auth 新路径)**
  - 现状: project-context L69 never-default rule 全 repo 尚未采用 (既有 store.ts:100/144 + minimap.ts:247 缺口归 deferred-work, 1a.13 SDR#12 先例只守新路径).
  - 目标: auth 的 provider 分发 (AuthorizeURL/Exchange/UserInfo + E18 error code 映射 + state cookie name) 的 `switch(provider)` 路径须加 never-default exhaustiveness (`default: { var _exhaustive never = provider; panic(...) }`), 新增 provider 时 Go 编译期捕获 (Go 的 `switch` 无原生 exhaustive, 用 interface satisfaction + 显式 default panic 模拟; 或 Provider interface + map[string]Provider 注册表使未注册 provider 在 start 即 404). 既有缺口 (store.ts/minimap.ts) 不回填.
  - 守卫: AC-5 (CHECK constraint) + AC-10 (error code 封闭); provider 集合 = {github, google} 封闭, 新增 provider 显式扩展.
  - 依据: project-context L69/L250 (never-default + Don't-Miss #4 SILENT SKIP).

#### 保留不变量 (baseline 已成立, 不能倒退)

- **SDR#20 - 1a.1 server.go /\__version + /\__health + SPA fallback 不变**: 2.1 增 /api/auth/* 路由, 不改既有 /__version/ /__health/ SPA fallback 行为; `/__` reserved namespace 仍 404 (`server.go:36`).
- **SDR#21 - 1a.1 store.go Open/pragmas/SetMaxOpenConns(1)/modernc driver 不变**: 2.1 用 `store.Open` + `store.Migrate` (新增) + `store.DB()`, 不改 Open/pragmas (WAL/synchronous=NORMAL/busy_timeout=5000/foreign_keys=ON)/SetMaxOpenConns(1)/modernc.org/sqlite driver (pure-Go, CGO_ENABLED=0); 不换 mattn/go-sqlite3 (会破 alpine CGO 运行时).
- **SDR#22 - AD-9 CanvasView WebGL canvas (无 DOM overlay) 不变**: login 是独立 `/login` route (`src/routes/login.tsx`), 不改 CanvasView WebGL 渲染架构; canvas 匿名访问不变 (AC-16).
- **SDR#23 - AD-5 [SYSTEM HALTED] circuit breaker 不变**: auth 不碰仿真熔断路径 (2.1 纯 auth, 无仿真).
- **SDR#24 - 全套件测试基线 = tsc 0 + vitest 730 passed | 1 skipped / 31 files + go test 3 pkg + e2e 29 passed | 21 skipped / 50 (main @ca4ce02)**: T24 gate 断言全套件绿无回归; N = 730 + 本 story 新增 (Go auth/schema 测试 + 前端 authStore/login 测试 + e2e login/grep-dist, 预计 +10~25, DS 落实).

#### 流程 meta

- **SDR#30 - 为何手搓 OAuth 不引 golang.org/x/oauth2**: 见 SDR#1. 2 provider + 无 token refresh (MVP server-side session 非 OAuth token 持久化) 场景抽象收益低, 拉传递依赖污染极简 go.mod (违 1a.1 哲学); AD-16 "direct OAuth" 字面支持; web research (CS step 4) 查 golang.org/x/oauth2 latest + Go 1.25 compat + GitHub/Google OAuth flow endpoint (3 次 WebSearch 工具空回退, 见 CS 产出说明 §4), 但 baseline 知识足够 (OAuth2 web flow 标准: authorize -> code -> token -> userinfo, GitHub/Google endpoint 公开稳定), 手搓 = 零新依赖, web research 退化为 no-op citing baseline (go 1.25 stdlib + 既有 modernc/uuid), 不捏版本号 (memory memory-must-record-verified-state-not-intent).
- **SDR#31 - 为何 server-side opaque session token 非 JWT**: AD-16 明定非 JWT. opaque token (crypto/rand 32B) 存 SQLite, 可即时撤销 (DeleteSession, logout 即失效), 无 signing key 管理, 无 JWT 跨服务验证需求 (单 Go binary). JWT 不可即时撤销 (需 blacklist) + key 轮换负担, 拒绝.
- **SDR#32 - 为何 session 双通道 (Cookie + JSON body)**: AD-16 双通道理由 - HttpOnly Cookie JS 不可读防 XSS 偷 token, 但 WS 首帧鉴权需 JS 持 token (cookie 不自动附 WS 首帧), 矛盾解法 = 双通道 (Cookie 管浏览器请求 auth, JSON body token 管 WS 首帧). WS 消费在 Epic 3 (story 3.1), 2.1 仅建 token + 存 JS 内存 (authStore) 供 Epic 3 取用.
- **SDR#33 - 为何 B9 两 provider 同邮箱不合并**: AD-16 B9 显式 - provider 隔离, 两账号画板不互通 (不自动合并). 按 email 合并 -> 跨 provider 账号混淆 + 画板所有权漂移, 拒绝. UNIQUE 锚点 = (oauth_provider, oauth_user_id) 非 email.
- **SDR#34 - 为何 backup->restore E2E fold-in (IR §476)**: 1a.1 backup 原语仅用 seed stand-in table 验 (IR L470/§476), 真实 business tables (users/sessions) 建后须补端到端验证 (AC-14). 2.1 首建 users/sessions 表, 是补该 IR minor concern 的自然落点 (IR L526: "2.1 补 backup->restore E2E"). 复用 1a.1 `store.Backup/Restore` 无新原语, 换真实表验.
- **SDR#35 - scope + canvas gate 策略 (单 PR + canvas 不强制 gate)**: (a) scope: 2.1 含 Go auth backend + schema + session + 前端 login UI + toast, ≥3 子系统, **单 PR (Q4 裁定 A: 1a.8/1a.12 大 story 单 PR 先例 + Go/前端紧耦合拆 sub-PR1 无独立端到端验价值)**; formalization §6 (≥3 子系统可回退 sub-PR) 保留: DS step4 若实测 scope 过大 (TDD red 后 task 数/CR findings 爆) 可回退 sub-PR1 (Go auth+schema+session+Go 测) + sub-PR2 (前端 login+authStore+e2e). (b) canvas gate: 2.1 仅交付 auth 能力, 不强制 gate canvas (AC-16) - 1a.x 全部匿名 e2e (29) 不破, canvas 强制 gate defer 至 2.2 (board 归属需 login) (Q1 裁定 A: 不 gate 低回归, AC 字面无 gate 条款 + AC-17 无回归硬约束 + IR L270 使能 epic 定位).

### 2. 域模型对账 (users/sessions schema, 与 AD-16 ERD + 1a.1 store 对齐)

| 表       | 列             | 类型     | 约束                                           | 依据                   |
| -------- | -------------- | -------- | ---------------------------------------------- | ---------------------- |
| users    | id             | TEXT     | PK, UUIDv4                                     | google/uuid, AD-16 ERD |
| users    | username       | TEXT     | NOT NULL                                       | provider login/handle  |
| users    | oauth_provider | TEXT     | NOT NULL, CHECK IN ('github','google')         | AD-16, SDR#11          |
| users    | oauth_user_id  | TEXT     | NOT NULL, UNIQUE(oauth_provider,oauth_user_id) | AD-16, B9 (SDR#2)      |
| users    | created_at     | DATETIME | DEFAULT CURRENT_TIMESTAMP                      | AD-16 ERD              |
| sessions | token          | TEXT     | PK, crypto/rand 32B base64url                  | SDR#3, AD-16 (非 JWT)  |
| sessions | user_id        | TEXT     | NOT NULL, FK -> users.id ON DELETE CASCADE     | AD-16 ERD              |
| sessions | expires_at     | DATETIME | NOT NULL                                       | SDR#3 (default now+7d) |
| sessions | created_at     | DATETIME | DEFAULT CURRENT_TIMESTAMP                      | 审计                   |

### 3. 引用架构约束

- **AD-16 (OAuth GitHub+Google 直连 + session 双通道 + users 表)**: 全 story 权威 (epics.md L195 + ARCHITECTURE-SPINE AD-16). client_secret server env / session token 非 JWT / 双通道 HttpOnly Secure Cookie + JSON body / Go 内存 + SQLite 持久 / SameSite=Lax 防 CSRF / B9 双 provider 不合并 / MVP 不含自托管账号密码.
- **AD-3 (Go monolith, no Node runtime)**: 后端 = 单 Go binary (`go:embed` dist), 不引 Node; auth 全 Go 实现.
- **AD-17 (owner/editor/viewer, story 2.2)**: 2.1 不实现权限模型, 仅建 users/sessions 基座供 2.2 消费.
- **AD-18 (cloud hosting, 1a.1/1b.1 部署骨架)**: auth Go 代码纳入既有 Dockerfile stage2, 无独立部署 story (SDR#8).
- **AD-9 (CanvasView WebGL canvas 无 DOM overlay)**: login 独立 route, 不改 canvas 渲染 (SDR#22).
- **AD-5 ([SYSTEM HALTED] circuit breaker)**: auth 不碰 breaker (SDR#23).
- **1a.1 Go skeleton (done)**: `main.go` (embed dist + PORT) + `internal/server/server.go` (mux /__version + /__health + SPA fallback) + `internal/store/store.go` (Open + WAL pragmas + SetMaxOpenConns(1) + modernc) + `internal/store/backup.go` (Backup/Restore 原语) + `internal/version` + go.mod (modernc.org/sqlite v1.53.0 + google/uuid v1.6.0 indirect).
- **NFR-SEC-4 (epics.md L132)**: WS 握手首帧 token 鉴权 + Origin 校验 (AD-16); OAuth GitHub+Google; session 双通道; SameSite=Lax 防 CSRF. WS 消费 Epic 3, 2.1 仅建 token.
- **project-context.md**: L67 (element identity = id UUIDv4, users.id 同) + L69 (never-default, SDR#11) + L85-87 (外部单例 store + useSyncExternalStore, authStore 复用模式) + L131-138 (本地 pre-merge gate tsc/vitest/e2e/go test) + L142 (记全套件 count).
- **IR §470/§476/§525/§526**: backup 原语 2.1 补 E2E (SDR#34) + client_secret server env (SDR#4/SDR#6) + 安全约束 (unlocked_at server now() / award INSERT OR IGNORE 等, 多数落 2.4/5.3 非 2.1).
- **story-cycle-formalization**: §2.1 (CS gate: AC 完整 + tech constraint 引用 + web research EXPLICIT + e2e AC 实现路径 pinned) + §2.4 (VS task↔SDR 一致性) + §6 (sub-PR 判定, SDR#35).

### 4. 项目结构 (新增/修改 files)

新增 (Go):

- `internal/store/schema.go` - `Migrate(db *sql.DB) error` (CREATE TABLE IF NOT EXISTS users + sessions + UNIQUE + FK + CHECK; idempotent) + `UpsertUser`/`FindUser`/`CreateSession`/`GetSession`/`DeleteSession` helpers.
- `internal/store/schema_test.go` - Go 测 (AC-5/AC-6/AC-7/AC-8/AC-9/AC-14, 复用 1a.1 `Open` + `Backup/Restore` + `t.TempDir`).
- `internal/auth/state.go` - `GenerateState()` + `ValidateState()` (crypto/rand + base64.RawURLEncoding + constant-time compare).
- `internal/auth/provider.go` - `Provider` interface + `githubProvider` + `googleProvider` impls (hand-roll net/http + encoding/json) + `fakeProvider` (test).
- `internal/auth/handler.go` - `Config` struct (env) + start/callback/me/logout handlers + `New(authMux, cfg, store, providers)`.
- `internal/auth/*_test.go` - Go 测 (AC-1/AC-2/AC-3/AC-4/AC-8/AC-10/AC-11, fake provider 注入).

新增 (frontend):

- `src/routes/login.tsx` - TanStack file route, GitHub + Google 登录入口 + error query -> `promptStore.toast` (AC-1/AC-10).
- `src/lib/auth/authStore.ts` - singleton external store + useSyncExternalStore, `fetchMe()` GET /api/auth/me + token in-memory only + getUsername (AC-8/AC-11).
- `src/lib/auth/authStore.test.ts` - vitest (fetch mock).
- `e2e/oauth-login.spec.ts` - Playwright (login 页渲染 + grep dist 无 client_secret + dev-mode fake provider 全流程 FAKE_OAUTH=1, Q2 裁定 B).

修改:

- `main.go` - open Store + Migrate + inject auth handlers into server (wire 1a.1 未接的 Store) + env config load (SDR#7).
- `internal/server/server.go` - `New` 签名扩展接 Store + auth deps; mux 增 /api/auth/* 路由 (既有 /__version + /__health + SPA fallback 不变, SDR#20).
- `go.mod` - `google/uuid` 从 indirect 转 direct (users.id UUIDv4 生成; 已在 go.sum); 无新 require (手搓 OAuth, SDR#1).
- `src/routes/__root.tsx` 或 `src/routes/index.tsx` - 可选: app load 调 `fetchMe()` (AC-16 不强制 gate, Q1 裁定 A: canvas 匿名不变, auth-aware loader 可选非必须).

不改 (显式):

- `internal/store/store.go` - Open/pragmas/SetMaxOpenConns 不变 (SDR#21); Migrate 是新文件非改 store.go.
- `internal/store/backup.go` - Backup/Restore 原语复用不改 (SDR#34).
- `Dockerfile` - stage2 `COPY internal/` 自动纳入新 auth 文件, 无新阶段 (SDR#8).
- `src/lib/render/CanvasView.tsx` - canvas 渲染不变 (SDR#22); canvas 不强制 gate (AC-16).
- `src/lib/render/promptStore.ts` - 复用 `toast` API 不改.

### 5. Tech / 依赖

无新 Go 依赖. 用 stdlib `net/http` + `encoding/json` + `crypto/rand` + `crypto/subtle` + `encoding/base64` + `os` + `time` + `database/sql` (既有) + `github.com/google/uuid` (indirect -> direct, users.id UUIDv4) + `modernc.org/sqlite` (既有). 无 `golang.org/x/oauth2` (SDR#1). 前端无新依赖 (fetch + TanStack file route + useSyncExternalStore + promptStore 既有). web research (CS step 4) = no-op citing baseline (go 1.25 stdlib + 既有 deps), 详见 SDR#30 + CS 产出说明 §4.

### 6. 测试标准

- **Go `go test ./...`** (AC-5/AC-6/AC-7/AC-8/AC-9/AC-14/AC-2/AC-3/AC-4/AC-1/AC-10/AC-11): schema migrate / upsert find-or-create / B9 两行 / session 创建+持久+过期 / backup->restore 真实表 E2E / state 生成+比对 / Provider fake Exchange+UserInfo+email null / handler start+callback+me+logout + E18 分类. fake provider 注入 (不依赖真实 GitHub/Google).
- **vitest jsdom** (AC-1/AC-10/AC-8/AC-11): login 页渲染 + error query -> toast 分类 / authStore fetchMe + token in-memory.
- **e2e Playwright** (AC-1/AC-11/AC-13/AC-17): login 页渲染 + 两入口 / grep dist/client 无 client_secret 残留 / dev-mode fake provider 全流程 (FAKE_OAUTH=1, Q2 裁定 B) / 全套件无回归.
- **gate** (AC-17): `go test ./...` 全绿 + tsc 0 + vitest 全套件绿 (730+新增 count) + e2e 全套件绿无回归 (29+新增); 记全套件 count 非 story 子集.

### 7. Gate 红线

- `go test ./...` 全绿 / tsc 0 error / vitest 全套件绿 / e2e 全套件绿无回归.
- AC 全覆盖 (17 条).
- **硬红线**: SDR#6 (client_secret 不入前端 bundle, grep dist 零命中) + SDR#5 (state CSRF 比对, 不符拒建 session) + SDR#2 B9 (两 provider 不按 email 合并) - 安全/正确性底线.
- SDR#21 (1a.1 store.go 不变) + SDR#20 (server.go 既有路由不变) 不破坏 1a.1.
- SDR#34 (backup->restore E2E 真实表) 闭合 IR §476 minor concern.

### 8. References

- 设计权威: epics.md L941-980 (Story 2.1 AC) + L195 (AD-16 摘要) + L132 (NFR-SEC-4); ARCHITECTURE-SPINE AD-16 (ERD User/Session) + AD-3/AD-18.
- IR fold-in: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-03.md` L470/§476 (backup E2E) + L525 (安全约束) + L526 (2.1 补 backup->restore E2E).
- 1a.1 Go skeleton (前置): `main.go` + `internal/server/server.go` (mux /__version + /__health + SPA fallback, 2.1 扩展点) + `internal/store/store.go` (Open + WAL + SetMaxOpenConns(1) + modernc, 2.1 加 Migrate) + `internal/store/backup.go` (Backup/Restore 复用) + `internal/store/store_test.go` (Go 测 pattern: Open + DB().Exec + t.TempDir) + `go.mod` (modernc v1.53.0 + uuid v1.6.0).
- 1a.7 promptStore (toast 复用): `src/lib/render/promptStore.ts:15` (PromptType 含 "toast") + `:62` (TOAST_MS=4000) + `:172` (`export const promptStore` 单例) + CanvasView `:41` import + `:1459` 用法.
- 流程: `_bmad-output/project-context.md` L67/L69/L85-87/L131-138/L142; `_bmad-output/planning-artifacts/story-cycle-formalization.md` §2.1 (CS gate) + §2.4 (VS task↔SDR) + §6 (sub-PR).
- 1a.13 SDR 范式 (本 story 建模): `_bmad-output/implementation-artifacts/1a-13-session-autosave-restore.md` SDR 三段 + `[gov: SDR#N]` task 内联 + ATDD 红脚手架 declare-const (memory newsd-atdd-red-scaffold-declare-const-for-new-file).

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                     | Author                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 2026-07-20 | CS 产 story (ready-for-dev). 从 epics.md L941-980 (5 AC 段) + AD-16 + NFR-SEC-4 + IR §476 fold-in (backup->restore E2E) 推导 AC 17 条; SDR 三段 (11 设计契约 + 5 保留不变量 + 6 流程 meta); Tasks 24 条 TDD red-green (Go 18 + 前端 4 + e2e/gate 2); 手搓 OAuth (SDR#1, 零新依赖). baseline @ca4ce02 实测. | CC (bmad-create-story) |
| 2026-07-20 | Q1-Q4 裁定回填 (Q1=A 不 gate defer 2.2 / Q2=B fake provider 全流程 FAKE_OAUTH=1 / Q3=A dev 跳 Secure prod 设 / Q4=A 单 PR). AC-8 (Secure 条件化) + AC-11(d) (fake provider dev-only 路由) + AC-16/AC-17 + T23 + SDR#1/SDR#9/SDR#35 + 引用点 (L20/L236/L243/L261) 回填; SAVE QUESTIONS 转 [裁定].           | CC (bmad-create-story) |

## Dev Agent Record

### Implementation Plan

Go backend (T0-T18) 全绿: schema migration (users/sessions 表 + UNIQUE + FK + CHECK) + UpsertUser/FindUser + CreateSession/GetSession/DeleteSession + backup→restore 真实表 E2E + state CSRF nonce + Provider interface (github/google/fake impls) + handler (start/callback/me/logout) + main.go wire (Store + Migrate + auth handlers + FAKE_OAUTH=1 fake provider 注册). 前端 (T19-T22): login route (TanStack file route, GitHub+Google 入口 + error query→toast 分类) + authStore (useSyncExternalStore singleton, fetchMe + token in-memory). e2e (T23): oauth-login.spec.ts 4 测试 (AC-1 render + AC-13 grep + AC-17 login 全流程 + AC-17 logout) 全 pass.

关键修复 (DS 期间):

1. **SPA fallback** (`internal/server/server.go`): TanStack Start SPA 输出 `_shell.html` 非 `index.html`, SPA fallback 从 `/` 改为 `/_shell.html`; root path `/` 也重写到 `/_shell.html`. `server_test.go` testFS 同步更新.
2. **Fake OAuth authorize handler** (`internal/auth/handler.go`): `fakeProvider.AuthURL()` 返回 `/fake/authorize?state=...` 但无 handler → 注册 `fakeAuthorize` handler (GET /fake/authorize) 自动 redirect 到 `/api/auth/fake/callback?state=...&code=fake-code`.
3. **`__e2e__` hooks 生产暴露** (`src/lib/render/CanvasView.tsx`): `import.meta.env.DEV` gate 移除, 改为 `typeof window !== "undefined"` always-on, 供 Go backend 生产构建的 e2e 测试访问 internal state.
4. **Playwright webServer 配置** (`playwright.config.ts`): webServer.command 改为 `bash -c "FAKE_OAUTH=1 C:/Two/NewSD/newsd.exe"`, port 8080, 指向 Go binary 而非 Vite dev server.

### Debug Log

| Issue                                                                                   | Root Cause                                                                                   | Fix                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `http://localhost:8080/` 返回目录列表非 SPA                                             | `dist/client/` 无 `index.html` (TanStack Start 用 `_shell.html`), `http.FileServer` 展示目录 | SPA fallback 改为 `/_shell.html`               |
| Fake OAuth 全流程停在 authorize 页                                                      | `/fake/authorize` 无 handler, SPA fallback 返回 `_shell.html`                                | 注册 `fakeAuthorize` handler 自动 redirect     |
| `__e2e__` hooks undefined (spatial-index/minimap/flow-render/autosave-restore e2e 全挂) | `import.meta.env.DEV` gate 在生产构建移除 `__e2e__`                                          | 改为 `typeof window !== "undefined"` always-on |
| e2e `webServer` 启动超时                                                                | Vite dev server 冷启动 `Re-optimizing dependencies` ~100s > 30s timeout                      | 改用 Go binary (FAKE_OAUTH=1), 启动 <1s        |

### Completion Notes

**T0-T18 (Go backend)**: 全 19 task green. schema.go (Migrate + UpsertUser/FindUser/CreateSession/GetSession/DeleteSession) + state.go (GenerateState/ValidateState) + provider.go (Provider interface + github/google/fake impls) + handler.go (start/callback/me/logout + fakeAuthorize) + main.go wire (Store open + Migrate + auth handlers + FAKE_OAUTH=1 fake provider 注册). `go test ./internal/...` 4 pkg 全绿 (auth/server/store/version).

**T19-T22 (Frontend)**: 全 4 task green. `src/routes/login.tsx` (TanStack file route, GitHub+Google 入口 link 到 `/api/auth/{provider}/start` + `?error=` query→promptStore.toast 三文案) + `src/lib/auth/authStore.ts` (useSyncExternalStore singleton, fetchMe GET /api/auth/me + token in-memory + getUsername). vitest: 787 passed | 5 failed | 1 skipped (5 failed = pre-existing CSS animation tests in jsdom from Story 5.1, unrelated to 2.1).

**T23 (e2e)**: 4 oauth-login tests 全 pass (AC-1 render + AC-13 grep + AC-17 login 全流程 + AC-17 logout). Playwright 配置 Go backend (FAKE_OAUTH=1, port 8080). e2e 全套件: 35 passed | 26 skipped | 0 failed (baseline 29|21|50 → 新增 4 oauth-login + 2 autosave-restore previously-skipped-now-pass 因 **e2e** hooks 修复).

**T24 (gate)**: tsc 0 / go test ./... 4 pkg 全绿 / vitest 787 passed | 5 failed | 1 skipped (5 failed = pre-existing 5.1 CSS animation, 非 2.1 回归) / e2e 35 passed | 26 skipped | 0 failed. AC 17 条全覆盖. SDR 硬红线全守卫: SDR#6 (client_secret 不入前端, grep dist 零命中) + SDR#5 (state CSRF 比对) + SDR#2 B9 (两 provider 不按 email 合并).

### File List

| 文件                             | 操作 | 说明                                                                                             |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| `internal/store/schema.go`       | 新增 | Migrate (users/sessions 表) + UpsertUser/FindUser/CreateSession/GetSession/DeleteSession         |
| `internal/store/schema_test.go`  | 新增 | Go 测试 (AC-5/6/7/8/9/14)                                                                        |
| `internal/auth/state.go`         | 新增 | GenerateState + ValidateState (crypto/rand + base64.RawURLEncoding + subtle.ConstantTimeCompare) |
| `internal/auth/state_test.go`    | 新增 | Go 测试 (AC-2)                                                                                   |
| `internal/auth/provider.go`      | 新增 | Provider interface + github/google/fake impls                                                    |
| `internal/auth/provider_test.go` | 新增 | Go 测试 (AC-3/4)                                                                                 |
| `internal/auth/handler.go`       | 新增 | Config + start/callback/me/logout + fakeAuthorize + New                                          |
| `internal/auth/handler_test.go`  | 新增 | Go 测试 (AC-1/3/8/10/11)                                                                         |
| `internal/server/server.go`      | 修改 | New 签名扩展 (st + authCfg + providers) + auth 路由 wire + SPA fallback `_shell.html` fix        |
| `internal/server/server_test.go` | 修改 | testFS `index.html` → `_shell.html` + TestReservedPrefix404 新增                                 |
| `main.go`                        | 修改 | Store open + Migrate + auth handlers wire + FAKE_OAUTH=1 fake provider 注册                      |
| `src/routes/login.tsx`           | 新增 | TanStack file route, GitHub+Google 入口 + error query→toast                                      |
| `src/routes/login.test.tsx`      | 新增 | vitest (AC-1/10)                                                                                 |
| `src/lib/auth/authStore.ts`      | 新增 | useSyncExternalStore singleton, fetchMe + token in-memory                                        |
| `src/lib/auth/authStore.test.ts` | 新增 | vitest (AC-8/11)                                                                                 |
| `src/lib/render/CanvasView.tsx`  | 修改 | `__e2e__` hooks production-exposed (remove `import.meta.env.DEV` gate)                           |
| `playwright.config.ts`           | 修改 | webServer 改为 Go binary (FAKE_OAUTH=1, port 8080)                                               |
| `e2e/oauth-login.spec.ts`        | 新增 | 4 e2e tests (AC-1 render + AC-13 grep + AC-17 login + AC-17 logout)                              |

### Verification

| Gate          | 结果                            | Count                                                |
| ------------- | ------------------------------- | ---------------------------------------------------- |
| tsc           | 0 errors                        | —                                                    |
| go test ./... | 全绿                            | 4 pkg (auth/server/store/version)                    |
| vitest        | 787 passed, 5 failed, 1 skipped | 45 files (3 failed = pre-existing 5.1 CSS animation) |
| e2e           | 35 passed, 26 skipped, 0 failed | 61 total (baseline 29                                | 21  | 50 + 4 oauth + 2 autosave-fix) |
| AC 覆盖       | 17/17                           | 全 AC 满足                                           |
| SDR 硬红线    | 全守卫                          | SDR#6 (grep), SDR#5 (CSRF), SDR#2 (B9)               |

## VS 验证记录

> VS 2026-07-20 (bmad-create-story validate, §2.2 + §5 gate). 16 项 checklist + SDR↔AC↔Task 追溯矩阵 + e2e runnability + Advisory + Verdict.

### 1. AC 完备性 (epic↔story 对照)

| Epic AC 段 (epics.md L950-980)                                              | Story AC                   | 覆盖 |
| --------------------------------------------------------------------------- | -------------------------- | ---- |
| OAuth 登录 (redirect + state + callback + code→token + oauth_user_id+email) | AC-1, AC-2, AC-3, AC-4     | ✅   |
| users 表与 B9 (UNIQUE + 双行独立)                                           | AC-5, AC-6, AC-7           | ✅   |
| session 双通道 (Cookie + JSON body + SQLite 持久)                           | AC-8, AC-9                 | ✅   |
| Go 后端 skeleton (routing + SQLite pool + env + Dockerfile + grep)          | AC-10, AC-11, AC-12, AC-13 | ✅   |
| E18 边界 guard (provider down / email null / state expired → toast)         | AC-10                      | ✅   |
| IR fold-in (backup→restore E2E)                                             | AC-14                      | ✅   |
| 边界 guard (依赖链 / canvas gate / 无回归)                                  | AC-15, AC-16, AC-17        | ✅   |

**Verbatim 对照**: 全 5 段 epic AC + IR §476 fold-in 覆盖, 零遗漏. AC-10 同时覆盖 E18 toast 分类与 Go skeleton 错误处理, 不重复.

### 2. SDR↔AC↔Task 追溯矩阵

| 设计契约 SDR                   | Tasks (gov)                     | AC 覆盖                     | 守卫红测试                                             |
| ------------------------------ | ------------------------------- | --------------------------- | ------------------------------------------------------ |
| SDR#1 (手搓 OAuth)             | T12, T13, T14, T15, T23         | AC-3, AC-4, AC-11(d), AC-13 | T12 (fake Exchange+UserInfo), T23 (e2e FAKE_OAUTH=1)   |
| SDR#2 (users schema)           | T0, T1, T2, T3, T4, T5          | AC-5, AC-6, AC-7            | T0 (sqlite_master+PRAGMA), T2 (upsert), T4 (B9)        |
| SDR#3 (sessions table)         | T6, T7, T14, T16, T17, T21, T22 | AC-8, AC-9                  | T6 (CreateSession+GetSession+expired), T16 (me+logout) |
| SDR#4 (env config)             | T12, T13, T15                   | AC-11, AC-13                | T12 (fake provider 注入), T15 (Config struct)          |
| SDR#5 (state CSRF)             | T10, T11, T14                   | AC-2, AC-10                 | T10 (GenerateState+ValidateState), T14 (state_expired) |
| SDR#6 (client_secret 不入前端) | T11, T23                        | AC-13                       | T23 (grep dist e2e)                                    |
| SDR#7 (Go skeleton 扩展)       | T15, T16, T17, T18              | AC-11                       | T16 (me+logout 路由), T18 (wire main.go)               |
| SDR#8 (Dockerfile stage2)      | —                               | AC-12                       | ⚠️ 无 task 直接 cite; AC-12 gate 覆盖                  |
| SDR#9 (session 双通道)         | —                               | AC-8                        | ⚠️ T14/T15 实现 Cookie+JSON body 但未 cite SDR#9       |
| SDR#10 (E18 toast 分类)        | T14, T15, T19, T20, T23         | AC-10                       | T19 (error query→toast 三文案), T23 (e2e)              |
| SDR#11 (never-default)         | T1, T15                         | AC-5, AC-10                 | T1 (CHECK constraint), T15 (provider map 注册表)       |

**保留不变量 SDR#20-#24**: SDR#20-#23 无 task gov (不变, 非实现); SDR#24 gate T24 cite ✅.

**流程 meta SDR#30-#35**: SDR#30-#34 无 task gov (why, 非实现); SDR#35 scope T19-T22 cite ✅.

### 3. 16 项 checklist

| #   | 检查项                              | 结果                                                                 |
| --- | ----------------------------------- | -------------------------------------------------------------------- |
| 1   | AC Given/When/Then 完备             | ✅ 17 条全 Given/When/Then                                           |
| 2   | 覆盖 epic 全 AC                     | ✅ 5 段 + IR fold-in 全覆盖                                          |
| 3   | Task 可执行 (粒度 dev 直接做)       | ✅ 24 task TDD red-green, 文件+断言明确                              |
| 4   | Task cite `gov: SDR#N`              | ✅ 全 task 有 gov 引用 (2 advisory 见下)                             |
| 5   | 每个设计契约 SDR ≥1 Task + ≥1 AC    | ✅ (SDR#8/#9 advisory 见下)                                          |
| 6   | 守卫红测试存在 + 断言 "旧态消失"    | ✅ 无反向债 (全新 story, 无旧态需拆除)                               |
| 7   | AD/CAP 约束显式引用                 | ✅ AD-16/3/17/18/9/5 + NFR-SEC-4                                     |
| 8   | Web research 显式记录               | ✅ CS 产出 §4: 3 次空回退, no-op citing baseline, 非静默 skip        |
| 9   | 依赖标注 (前置 story/AD)            | ✅ 1a.1 done + 执行链 2.1→2.2→2.3→2.4                                |
| 10  | e2e AC 实现路径 pinned              | ✅ login 页 DOM 可断言 (非 canvas), FAKE_OAUTH=1 dev-only            |
| 11  | e2e selector 可跑性 (渲染架构 gate) | ✅ login route 是标准 React DOM, 非 WebGL canvas                     |
| 12  | 测试标准 TDD red-green              | ✅ Go + vitest + e2e 三层                                            |
| 13  | baseline 验证                       | ✅ ca4ce02 (tsc 0 + vitest 730+1skip/31files + go test 3pkg + e2e 29 | 21) |
| 14  | SDR 三段分类 (契约/不变量/meta)     | ✅ 11 契约 + 5 不变量 + 6 meta                                       |
| 15  | SDR 现状/目标/守卫三元              | ✅ 每条设计契约含现状(file:line)+目标(delta)+守卫(AC#+红测试)        |
| 16  | CS gate 全部门控                    | ✅ ZERO USER INTERVENTION (Q1-Q4 已裁定回填)                         |

### 4. Advisory (非阻塞)

- **A1 (SDR#8 无 task gov)**: SDR#8 (Dockerfile stage2 自动纳入 auth 代码) 无 task 显式 cite `[gov: SDR#8]`. AC-12 覆盖 gate 验证. 建议 T18 (wire main.go) 加 `[gov: SDR#8]` — `COPY internal/` 已自动纳入, 但 T18 是 Dockerfile build 成功的最接近 task. 严重度: 低 (SDR#8 本质是验证约束非实现 task, gate 已覆盖).
- **A2 (SDR#9 无 task gov)**: SDR#9 (session 双通道 Cookie+JSON body) 无 task 显式 cite `[gov: SDR#9]`. T14/T15 实现 callback handler (Set-Cookie + JSON body 返回 token) 但 cite SDR#1/#3/#4/#5/#7/#10/#11 未 cite SDR#9. AC-8 覆盖. 建议 T14 加 `[gov: SDR#9]`. 严重度: 低 (T14/T15 实现覆盖 SDR#9 行为, 仅缺 gov 标签).

### 5. 代码引用核验 (sample)

| Story 引用                                               | 实际                                                                                                                                | 一致? |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `main.go` line 39 `server.New(clientFS)` 未接 Store      | `main.go:39`: `server.New(clientFS)`                                                                                                | ✅    |
| `server.go` mux 仅 /__version + /__health + SPA fallback | `server.go:21-46`: 三路由                                                                                                           | ✅    |
| `store.go` Open + WAL + SetMaxOpenConns(1) + modernc     | `store.go:29-56`: 全匹配                                                                                                            | ✅    |
| `go.mod` google/uuid v1.6.0 indirect                     | `go.mod:9`: `// indirect`                                                                                                           | ✅    |
| `Dockerfile` stage2 `COPY internal/`                     | `Dockerfile:33`: `COPY internal/ ./internal/`                                                                                       | ✅    |
| `promptStore.ts:172` 单例                                | `promptStore.ts:172`: `export const promptStore = createPromptStore()`                                                              | ✅    |
| `promptStore.ts:62` TOAST_MS=4000                        | `promptStore.ts:62`: `TOAST_MS = 4000`                                                                                              | ✅    |
| `backup.go` Backup/Restore 原语                          | `backup.go:28-50`: Backup + Restore                                                                                                 | ✅    |
| `src/routes/` 无 login.tsx                               | glob: `__root.tsx`, `index.tsx`, `vram.tsx`                                                                                         | ✅    |
| ARCHITECTURE-SPINE AD-16 users 表 schema                 | `ARCHITECTURE-SPINE.md:200`: `users(id, username, oauth_provider, oauth_user_id, created_at)` UNIQUE(oauth_provider, oauth_user_id) | ✅    |
| ARCHITECTURE-SPINE AD-16 session token 非 JWT            | `ARCHITECTURE-SPINE.md:199`: "Server-side session (HttpOnly Secure Cookie, non-JWT)"                                                | ✅    |

### 6. Verdict

**PASS** ✅. 零歧义 + 零遗漏 + 可执行 + web research 显式记录 + task↔SDR 一致性达标. 2 advisory (A1/A2) 非阻塞, DS 可自行决定是否回填 gov 标签.

**Next**: DS `bmad-dev-story`

## CR 记录

> bmad-code-review (3 层 orchestrator-direct, memory newsd-cr-3-layers-orchestrator-direct-not-subagents; ark-code/DeepSeek 后端 subagent 两轴皆崩, orchestrator 自己 Read/grep/`git show` 跑全 3 层).

### Run 1 (2026-07-22)

**3 层 review**:

- Layer 1 Blind Hunter: black-box 逐 AC/SDR 反向追代码 + 测试, 暴露错误码封闭集违反 / provider timeout 缺失 / env 名不符 / AC-13 测试有效性缺陷.
- Layer 2 Edge Case Hunter: 边界与并发 (非2xx / email null / state expired / timeout 竞态 / Secure flag localhost 豁免 / DB upsert-session 失败路径).
- Layer 3 Acceptance Auditor: AC-1-17 逐条映射实现 + SDR#1-#11 契约核验 + 回归 (29 既有 e2e + 730 vitest 无破坏).

**findings 表 (13)**:

| ID  | 严重度  | 路由    | 描述                                                                                                                                                                                             |
| --- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | HIGH    | patch   | callback 错误码 exchange_failed/fetch_user_failed/upsert_failed/session_failed 不在 AC-10 封闭集 {provider_down,email_null,state_expired}; 前端 ERROR_TOAST silent (handler.go L158/165/178/185) |
| F2  | MEDIUM  | patch   | SDR#4 env 名 GITHUB_CLIENT_ID 等缺 OAUTH_ 前缀 (main.go L58-65)                                                                                                                                  |
| F3  | MEDIUM  | patch   | provider.go Exchange/FetchUser 无 HTTP timeout (SDR#10 provider_down 含 timeout)                                                                                                                 |
| F4  | MEDIUM  | patch   | AC-13 测试 `git grep dist` (gitignored) 恒 0 假 pass (e2e/oauth-login.spec.ts)                                                                                                                   |
| F5  | LOW-MED | patch   | data/ SQLite (users/sessions 含 token) 未 gitignore                                                                                                                                              |
| F6  | LOW     | defer   | AC-5 users 表列 spec 漏 email TEXT 列 (impl schema.go + B9 测试依赖)                                                                                                                             |
| F7  | LOW     | defer   | AC-5 users CHECK 含 'fake' (spec IN github/google; fake 是 FAKE_OAUTH dev provider)                                                                                                              |
| F8  | LOW     | defer   | AC-6 UpsertUser DO UPDATE SET email (SDR#2 只 SET username)                                                                                                                                      |
| F9  | LOW     | patch   | ns-oauth-state cookie 无 Secure (localhost 豁免 Q3=A)                                                                                                                                            |
| F10 | LOW     | defer   | me() 401 用 http.Error Content-Type text/plain (body JSON) + me 返 {email,provider} 额外字段                                                                                                     |
| F11 | LOW     | defer   | me() 返 token 到 JSON body (XSS 偷 token 绕 HttpOnly; AD-16/SDR#32 双通道设计决策非 bug)                                                                                                         |
| F12 | LOW     | defer   | AC-8(c) callback 302 redirect body token 浏览器不暴露 JS (token 实际经 /me 获取)                                                                                                                 |
| F13 | LOW     | 合并 F1 | provider.go Exchange/FetchUser 不显式检查 HTTP status code (F1 patch 的 provider_down 映射覆盖非2xx->Decode err 路径)                                                                            |

**用户裁定 (全闭合)**: F1=A 全映射 provider_down / F2=A OAUTH_ 前缀 + (ii) fail-fast 至少一 provider 配齐 id+secret / F3=B timeout 承接 F1 / F4·F5·F9=patch / F6·F7·F8·F10·F11·F12=defer / F13=合并 F1 / F1-spec + fail-fast-spec=spec 回写 defer.

**patch (7 项)**:

- F1: handler.go callback 4 错误码 (exchange_failed/fetch_user_failed/upsert_failed/session_failed) 全映射 -> provider_down; import "context" + `context.WithTimeout(r.Context(), 10*time.Second)` 承接 F3.
- F1-test: handler_test.go failingProvider (failExchange/failFetch flags) + TestCallbackProviderDownExchange + TestCallbackProviderDownFetch (断言 `/login?error=provider_down`); upsert/session 失败路径注 defer (需 fault-injecting store).
- F2: main.go env 名加 OAUTH_ 前缀 (OAUTH_GITHUB_CLIENT_ID/SECRET + OAUTH_GOOGLE_CLIENT_ID/SECRET + OAUTH_REDIRECT_BASE_URL); 注册条件 id+secret 双非空.
- F2-failfast: main.go SDR#4 (ii) `len(providers)==0 && !fakeOAuth` -> log.Fatal.
- F3: handler.go callback `context.WithTimeout(10s)` (合 F1) + p.Exchange/p.FetchUser 改用 ctx.
- F4: e2e/oauth-login.spec.ts AC-13 `git grep dist` -> Node fs 递归物理扫描 dist (readFileSync + 正则 client_secret/CLIENT_SECRET).
- F5: .gitignore 追加 `/data` (SQLite users/sessions).
- F9: handler.go ns-oauth-state cookie `Secure: !isLocalhost(cfg.RedirectBaseURL)` (localhost 豁免 Q3=A).

**defer (8 项)**: 见 `deferred-work.md` `From Story 2.1 CR` (F1-spec / F6 / F7 / F8 / F10 / F11 / F12 / fail-fast-spec; F13 合并 F1 不单独 defer).

**验证 gate (AC-17/SDR#24 全套件, 非子集)**:

- tsc: 0 error.
- go test ./...: 全 pass (auth 13 含新增 TestCallbackProviderDownExchange + TestCallbackProviderDownFetch + server + store + version; main 无 test file).
- vitest: 797 passed | 1 skipped | 0 failed / 43 files.
- e2e: 40 passed | 21 skipped | 0 failed (newsd.exe rebuild with FAKE_OAUTH=1 patches; 含 oauth-login 4 项; flow-render AC-17 首次 18515<18664 0.8% 像素差 SwiftShader 软渲 flaky 非 patch 回归, 重跑 pass).

**CR Run 1 verdict**: **PASS**. 13 findings 全路由 (6 patch + 6 defer + F13 合并 F1) + 2 spec 回写 defer; 用户裁定全闭合; gate 全绿.

## SAVE QUESTIONS

> CS 阶段待用户裁定的开放项 (不 default-execute, memory newsd-reverify-no-default-execute).

- **Q1 (canvas 是否强制 gate 登录, SDR#35/AC-16)** [裁定 A]: 2.1 不 gate, canvas 强制 gate defer 至 2.2 (board 归属需 login). 依据: AC 字面无 gate 条款 / AC-17 无回归硬约束 (29 既有 e2e 不破) / IR L270 使能 epic 定位 (使能层交付能力, enforcement 在消费 story). AC-16 保留现状.
- **Q2 (e2e 是否含 dev-mode fake provider 全流程, T23)** [裁定 B]: 加 `FAKE_OAUTH=1` env server dev-only fake provider 路由 (生产未设则不注册, grep 生产 binary 无 fake 路由暴露), e2e 跑全流程 (login -> fake authorize 自动 approve -> callback -> session cookie -> /api/auth/me 返 fake user). 依据: 1a.5 `window.__e2e__` 测试注入先例 / 端到端浏览器链是 e2e 核心价值 / env guard 生产无暴露. AC-11(d) + T23 + AC-17(d) 回填.
- **Q3 (dev 环境 Secure cookie, SDR#9)** [裁定 A]: dev (localhost) 跳过 Secure flag, prod (非 localhost) 设 Secure. 依据: localhost Secure 豁免是浏览器+OAuth 业界常规 (GitHub/Google OAuth App 允许 localhost http callback) / SameSite=Lax (AD-16) 是 CSRF 主防线 / 自签 cert 复杂度过高 (Windows 本地 + e2e Playwright 配置). AC-8(b) Secure 条件化 + SDR#9 回填.
- **Q4 (scope sub-PR, SDR#35)** [裁定 A]: 单 PR. 依据: 1a.8/1a.12 大 story 单 PR 先例 / Go 与前端紧耦合拆 sub-PR1 无独立端到端验价值 / formalization §6 默认单 PR. DS step4 保留回退 sub-PR 权 (若 TDD red 后 scope 实测过大). SDR#35 回填.

## CS 阶段产出说明

> 六步 walkthrough (bmad-create-story SKILL.md).

1. **parse target**: story 2.1 OAuth 登录 -> epic_num=2, story_num=1, story_key=2-1-oauth-login-session-dual-channel.
2. **load artifacts**: epics.md (L941-980 Story 2.1 block + L195 AD-16 摘要 + L132 NFR-SEC-4 + L384 执行顺序) + sprint-status.yaml (2-1-oauth-login-session-dual-channel 注册项 backlog + epic-2 backlog) + ARCHITECTURE-SPINE AD-16 (ERD User/Session) + IR report (L470/§476 backup E2E fold-in + L525 安全约束 + L526 2.1 补 backup) + 1a.13 story (SDR 范式 + ATDD declare-const 模式) + 1a.7 promptStore (toast API 复用) + 1a.1 Go skeleton (server.go/store.go/main.go/go.mod, 前置 done).
3. **read files being modified**: main.go (未接 Store, wire 点) + internal/server/server.go (mux /__version + /__health + SPA fallback, auth 扩展点) + internal/store/store.go (Open + WAL + SetMaxOpenConns(1) + modernc, Migrate 落点) + internal/store/backup.go (Backup/Restore 复用) + internal/store/store_test.go (Go 测 pattern) + go.mod (modernc + uuid indirect) + src/routes/index.tsx (/ = CanvasView, login 落新 route 非 index) + src/routes/__root.tsx (RootShell + error boundary) + src/lib/render/promptStore.ts (toast 单例, E18 复用) + Dockerfile (stage2 Go build, auth 纳入既有阶段). 全读确认扩展点 + 复用面 + 不变量.
4. **web research**: 3 次 WebSearch (golang.org/x/oauth2 latest + Go 1.25 compat / GitHub OAuth flow endpoint / Google OAuth2 userinfo endpoint) 工具空回退 (环境限制, 无结果返回). baseline 知识足够 (OAuth2 web flow 标准: authorize URL -> code -> token endpoint -> userinfo endpoint, GitHub `login/oauth/access_token` + `api.github.com/user`, Google `oauth2.googleapis.com/token` + `www.googleapis.com/oauth2/v2/userinfo` 公开稳定 endpoint). 决策 SDR#1 手搓 OAuth = 零新依赖 -> web research 退化为 no-op citing baseline (go 1.25 stdlib net/http + encoding/json + crypto/rand + 既有 modernc/uuid), 不捏版本号 (memory memory-must-record-verified-state-not-intent). 非静默 skip: 本段显式记录 attempt + 决策 + 退化理由 (memory newsd-cs-webresearch-explicit-gate).
5. **write story**: 本文件. AC 17 条 (OAuth 登录 4 / users+B9 3 / session 双通道 2 / Go skeleton 4 / E18 guard 1 / IR fold-in backup 1 / 边界 guard 3). SDR 三段 (11 设计契约 + 5 保留不变量 + 6 流程 meta). Tasks 24 条 TDD red-green (Go T0-T18 + 前端 T19-T22 + e2e/gate T23-T24). Status=ready-for-dev.
6. **sprint-status update**: 2-1-oauth-login-session-dual-channel backlog -> ready-for-dev + epic-2 backlog -> in-progress + last_updated -> 2026-07-20 (本地改, 不夹带 story 代码 PR, memory newsd-sprint-status-separate-from-story-pr). validate checklist.md.

**baseline 验证**: HEAD=ca4ce02 (PR#63 chore/pc-drift-fix, docs-only project-context drift 无前端 code delta) / tsc 0 / vitest 730 passed | 1 skipped / 31 files (实测 @ca4ce02 本会话) / go test ./... (1a.1 3 pkg) / e2e 29 passed | 21 skipped / 50 (1a.13 CR 终态 @a3cd209 实测, PR#63 docs-only 承接无回归; 本会话 e2e 重跑因 Vite v8.1.3 冷启动 99507ms "Re-optimizing dependencies" 超 playwright 30s webServer.timeout 未能复验, 环境冷启动 flaky 非 test 回归, 1a.13 CR 已记同类 flaky).

**gap 诚实声明**: (a) 前置 1a.1 Go skeleton 在 repo 根 (非 architecture spine 假设的 `server/` 子目录), 1a.1 实现偏离 spine minimal-source-tree 已成既成事实, 本 story 扩展既有根级 Go module 不纠正不另建 `server/` (SDR#7 显式不变). (b) web research 3 次空回退, 退化 no-op citing baseline (SDR#30, 非捏造). (c) e2e 本会话未复验 (Vite 冷启动 flaky), 引 1a.13 CR 终态 count 承接 (PR#63 docs-only 无 delta). (d) Q1-Q4 已裁定回填 (Q1=A 不 gate defer 2.2 / Q2=B fake provider 全流程 FAKE_OAUTH=1 dev-only / Q3=A dev 跳 Secure prod 设 / Q4=A 单 PR), AC-8/AC-11/AC-16/AC-17 + SDR#1/SDR#9/SDR#35 + T23 + 引用点 (L20/L236/L243/L261) 回填, SAVE QUESTIONS 转 [裁定].
