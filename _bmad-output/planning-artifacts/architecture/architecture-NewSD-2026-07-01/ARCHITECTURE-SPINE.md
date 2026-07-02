---
name: NewSD
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: Host-Authoritative CRDT Document Model with Wasm Numeric Core and Fixed-Point Canvas Render
scope: NewSD MVP — cyberpunk ASCII system-dynamics multiplayer collaborative modeling platform; the whole system governed by its four design pillars
status: final
created: '2026-07-01'
updated: '2026-07-02'
binds: FR-SIM-1/4/6/7/8, FR-COLLAB-1/2/3/4/5/6, FR-CANVAS-3/4/5, FR-UI-6, FR-GAME-2, handoff open-high #1/#2/#3/#5/#6/#7/#8, addendum §3.1/§3.2/§7.3/§8.3, Q2 auth 决策, Q-cloud 决策
sources:
  - '_bmad-output/planning-artifacts/prds/prd-NewSD-2026-06-26/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-NewSD-2026-06-26/addendum.md'
  - '_bmad-output/planning-artifacts/prds/prd-NewSD-2026-06-26/handoff-to-architecture.md'
  - 'lovable/prototype (brownfield client code, read cross-branch)'
companions: []
---

# Architecture Spine — NewSD

## Design Paradigm

The composite paradigm is **Host-Authoritative CRDT Document Model with Wasm Numeric Core and Fixed-Point Canvas Render**. Four pillars jointly govern the system:

| Pillar | What it means | Lives in |
|---|---|---|
| **Host-Authoritative Simulation** | Simulation runs on the host client only; server relays but never runs sim. Host migration carries CRDT version-verified snapshot for continuation (AD-11). | Host client (browser) — `src/lib/sim/` |
| **CRDT Document Model** | Canvas model and formula AST live in Yjs CRDT (Y.Map nested AST + paren bypass Y.Array; pending nodes as Y.Text). Server relays CRDT ops via yjs-go. | Client `src/lib/collab/` + server CRDT relay |
| **Wasm Numeric Core** | All simulation-step numeric evaluation passes through Rust+Wasm kernel (BDF integrator, Newton solver, autodiff, sparse LU, dimension check, non-negative clamp, DELAY expansion). TS side is a thin Solver boundary calling Wasm exports. | `wasm/` (Rust) + TS boundary in `src/lib/solver/` |
| **Canvas 2D Fixed-Point Render** | VRAM double-buffer (char-code buffer + color-index buffer) with glow atlas pre-rendered per ASCII char x brightness tier; hue-shift GPU fragment shader, nearest sampling, no per-glyph shadowBlur. Dirty-region updates per FR-CANVAS-4. | `src/lib/render/` |

## Invariants & Rules

### AD-1 [ADOPTED] — F-Paradigm: Four-pillar design paradigm

- **Binds:** 全部 FR-SIM/FR-COLLAB/FR-CANVAS/FR-UI, PRD §1.1/§1.2/§2.1
- **Prevents:** 各子系统范式漂移(如仿真散到多客户端 / 渲染回退 shadowBlur / 数值跑 TS 主线程)
- **Rule:** 四范式为架构顶层不变量,子系统 AD 不得违背

### AD-2 [ADOPTED] — F-Envelope: Single-node deployment envelope

- **Binds:** F3, F2(#7 Wasm.Memory), F1(WebGL), addendum §3.1/§3.2
- **Prevents:** 运行包络整维度空缺(skill Finalize 失败定义)/ MVP 过度工程化上容器+云+可观测栈
- **Rule:** MVP 单节点单二进制 + SQLite WAL,无独立可观测栈;部署目标 = 云托管单节点(AD-18 详),Dockerfile + CI/CD 必备,裸机直跑仍可但不作 MVP 目标;水平迁移(多实例/PG/Redis)走 addendum §3.2 阈值

### AD-3 — F3: Go monolith backend

- **Binds:** FR-COLLAB-1/2/3/5, FR-BOARD-1
- **Prevents:** 双语言栈跨服务 IPC 复杂度(混合方案) / Node 弱类型后端演进
- **Rule:** 后端单 Go 进程, 不引入 Node 服务

### AD-4 — F3-yjs-server: yjs-go CRDT relay

- **Binds:** F3 Go 单体后端 CRDT 中继路径落地
- **Prevents:** 自研 Go Yjs binding 重活 / 换不成熟 automerge-go / 退回 Node 混合违 F3
- **Rule:** Go 服务端 CRDT 中继用 yjs-go,遇阻回评自研非退 Node

### AD-5 — F2: Wasm solver kernel boundary + circuit breaker

- **Binds:** FR-SIM-1/2/4/6/7/8, #1/#2/#7, FR-COLLAB-4
- **Prevents:** TS 主线程数值爆炸污染 UI 帧率 / 恶意公式无沙箱逃逸 / 隐式法放行代数死锁环(FR-SIM-2)
- **Rule:** 所有仿真步数值求值经 Wasm 内核, TS 不得直接跑仿真步; 编译期拓扑检查(切 stock 流出边后检测残余环)拒绝代数环, 不因隐式法可解而放行(FR-SIM-2). 熔断(#7)与降级(FR-SIM-8)边界: 资源耗尽(Wasm.Memory 64MB / 单步 wall-clock >500ms / AST MAX_NODES 5000 编译期 / 牛顿 maxIterations 100 仍不收敛)→ `[SYSTEM HALTED]` 暂停报错; 残差范数非收敛(数值收敛压力)→ FR-SIM-8 降级链(降级不阻断). 两者不混淆触发.

### AD-6 — F2-amend: Solver crate composition (handwritten parser + autodiff + faer)

- **Binds:** parser 复用 prototype formula.ts 结构扩 @uuid/[单位] 产生式(#9/#10 直落);AST 为单一真相源供 autodiff 图/量纲校验/tokenizer 共用;LU/sparse 交 faer(v0.24.4 current)
- **Prevents:** meval 不暴露 AST 致双源翻译层、meval 8年 stale、全手写 AD 数值正确性自担
- **Rule:** parser 手写、autodiff 借 autodiff crate(0.7.0)、LU 借 faer;不引入 meval

### AD-7 — F4: BDF startup strategy

- **Binds:** FR-SIM-1/8, #1
- **Prevents:** BDF-2+恒值外推退化一阶违§1.1无感(频繁降级黄点) / BDF-3+过度工程稳定降 / 纯后向欧拉降级链首级空转
- **Rule:** Wasm 求解器内核按阶数切换状态机起步, 牛顿初始猜测按当前阶数分配外推法

### AD-8 — F5: Jacobian active-set strategy

- **Binds:** FR-SIM-4, #2
- **Prevents:** Broyden 累积漂移致长仿真后期牛顿发散难排查 / Chattering 致雅可比频繁重算性能崩 / 后置钳制(nv=0)违 FR-SIM-3 物质守恒幽灵渗漏
- **Rule:** Wasm 求解器内核维护活动集状态机 + 滞回带, 约束激活后全重算雅可比与 LU 稀疏模式

### AD-9 — F1: VRAM render (glow atlas + double buffer + hue-shift shader)

- **Binds:** FR-CANVAS-3/4/5, FR-UI-6, PRD §2.1/§1.4/§4.1, #8
- **Prevents:** shadowBlur 逐字符 GPU 模糊致 1000 图元@60FPS 不可达 / 改 PRD 违§1.1 硬约束门槛 KPI
- **Rule:** 渲染层用图集预渲染 + 双缓冲 + Shader, 禁 per-glyph shadowBlur

### AD-10 — F6: AST structural conflict tiered fallback

- **Binds:** FR-COLLAB-6, #3, #4(待定节点冲突作子集)
- **Prevents:** 单一策略场景C 覆盖硬伤(锁子树边界难定 / 标冲突区错误传播)
- **Rule:** AST 合并后拓扑比较检测, 分级回退轻标区+锁子树重文本级

### AD-11 — F7: Snapshot-CRDT version alignment

- **Binds:** FR-COLLAB-3/5, #5, PRD §1.1 反指标
- **Prevents:** 新房主旧模型结构+新初始值续跑跳跃不连续 / 阻塞 CRDT 损协作
- **Rule:** 快照须带 CRDT 版本向量, 新房主校验对齐决定续跑/增量重跑

### AD-12 — F8: Degradation interface abstractions (MVP define interfaces not impl)

- **Binds:** #6, §5.1 逃生阀, addendum §8.3
- **Prevents:** ⑤ 降级名存实亡(handoff #6 明文) / 体量超载时重构多模块成本非线性
- **Rule:** MVP 须定义三项抽象接口隔离降级两端且接口非空(非空桩: 数据兼容层须支持 Y.Map 嵌套 AST 与 flat string 两种公式格式, 不只读一种), 降级逻辑本身可不实现但接口契约须可验证

### AD-13 — F-Gap1-A: Pending node rawText as Y.Text

- **Binds:** 待定节点 rawText 字段为 Y.Text,并发输入插入合并不丢字
- **Prevents:** string 键级 LWW 并发输入一边丢
- **Rule:** pending 节点 {type:'pending', rawText:Y.Text, cursorHint:number|null}

### AD-14 — F-Gap1-B: Parens stored as bypass Y.Array of maps, NOT AST group nodes

- **Binds:** AST 节点纯语义(binop/unop/ref/num/pending),括号不进 AST;公式根挂 parens 旁路(Y.Array of maps),按 nid(UUIDv4)引用 AST 节点;每个 AST 节点带 nid 字段
- **Prevents:** 显式 group 进 AST 致啰嗦+去冗余 pass 静默改写用户输入+g-4 链式判定非局部;不显式存纯版致结合性冲突归因模糊
- **Rule:** paren 副本是 AST 外双结构(轻旁路),非 AST 内 group 节点;op-4 结合性翻转时 paren 不自动迁移(子树重建语义正确,用户重加);渲染层须投射 paren 回括号. nid 分配为单调递增计数器(非 hash),子树重建时旧 nid 保留语义正确性,新节点发新 nid 不复用.

### AD-15 — F-NonHostDataflow: Non-host client subscribes to host sim state

- **Binds:** AD-1(房主权威仿真), FR-COLLAB-3, AD-11(快照续跑)
- **Prevents:** 非房主客户端本地跑 Wasm 仿真步致与房主结果分叉 / 每次按键仿真显示闪烁
- **Rule:** 非房主客户端权威仿真显示态由房主计算结果经服务端中继广播驱动(订阅非计算); 本地 Wasm 仅限非仿真预览(量纲/视觉实时预览, 非仿真步求值)

### AD-16 — F-Auth: OAuth(GitHub + Google) + session token

- **Binds:** FR-COLLAB-1(房间归属), FR-GAME-2(徽章跨设备持久化), Q2 决策, PRD §4.3(修订后), addendum §3.2(修订后)
- **Prevents:** 匿名前提致徽章跨设备丢失 / 无权限模型致共享链接=共享编辑权 / WS 网关无握手鉴权
- **Rule:** 认证走 OAuth 直连 GitHub + Google(零费用,不经 Auth0/Clerk 中间商),双 provider 共享同一 users 表(`oauth_provider` + `oauth_user_id` UNIQUE 联合); 登录后发 server-side session token(非 JWT),双通道下发:OAuth callback 同时 Set-Cookie(HttpOnly Secure SameSite=Lax,供 HTTP 请求自动携带)+ JSON 响应体返回 token(供 JS 取用——HttpOnly 致 JS 不可读 cookie,故 WS 鉴权 token 须从响应体取); Go 进程内存 + SQLite session 表持久化(进程重启会话不丢); WS 握手鉴权用首帧显式 token(客户端从登录响应体取 token 存 JS 内存,WS 升级请求不依赖 Cookie 鉴权,首 frame 校验失败拒连);token 仅存 JS 内存不可跨域读取,浏览器端 WS CSRF 不可行,Origin 头校验作 defense-in-depth 保留(覆盖非浏览器客户端); 同源 Cookie + SameSite=Lax 防 HTTP CSRF,不另加 CSRF token; 徽章触发(绑 FR-GAME-2)由服务端判定:服务端在 CRDT relay 路径观察文档状态、从 op 流推断建模动作完成时刻,客户端仅上报 op,服务端判定后写 `user_badges`(防客户端伪造解锁); `[SYSTEM HALTED]` 熔断事件(AD-5,客户端 Wasm 触发)须以结构化日志经 WS 上报服务端写 stdout,供云平台日志捕获(AD-18); MVP 不含自托管账号密码,SaaS 规模化后补(届时邮件服务已就位); client_secret 走 server env,不入前端 bundle

### AD-17 — F-Permission: CRDT 权限模型(owner/editor/viewer)

- **Binds:** AD-16(认证后授权), FR-COLLAB-1, FR-COLLAB-4, 场景 C(只读分享)
- **Prevents:** 共享链接=共享编辑权 / 无 owner 致画板无主无法管理
- **Rule:** 画板创建者为 owner;三角色 owner(全部+删+转让+改权限)/ editor(编辑 CRDT)/ viewer(只读,不发 CRDT op,仅订阅); 权限映射到 WS 网关:viewer 的 CRDT op 在网关拒收(非客户端自检), room 加入走 owner 邀请或 share token; 所有 owner 转让与角色修改操作必须走认证 HTTP 端点(验证当前 session 对应 user_id = `boards.owner_user_id` 后更新 SQLite),CRDT 通道不承载权限变更(防 editor 伪造 CRDT op 自提权); 权限变更须传播到已连接客户端:服务端推送 `role_change` WS frame(新角色 + 可选断开指令),变更前先 drain 该连接待处理 op 保原子性(防降级 viewer 本地 Y.Doc 残留旧 op 竞态); 画板归属存 SQLite boards 表(owner_user_id + share_token),share_token 由 crypto/rand 生成 ≥128 bits 熵 URL-safe base64 编码,owner 可随时重新生成使旧链接失效,分享页配 `Referrer-Policy: no-referrer` 防 token 经 Referer 泄漏; CRDT 文档本身不变,权限是网关层准入控制(非 CRDT 内嵌); CRDT 持久化表(CRDTSnapshot/OpLog)按 `board_id` 分区;PresenceSnapshot 为进程内存态按 `board_id` 键不落 SQLite(会话结束丢弃,FR-COLLAB-5)(见 ERD); 房主迁移(AD-11)与画板 owner 解耦:owner 是画板归属,host 是仿真权威,两者可不同人

### AD-18 — F-Cloud: 单节点云托管部署包络(AD-2 演进)

- **Binds:** AD-2(演进非推翻), Q-cloud 决策, addendum §3.2(阈值表 auth 不入)
- **Prevents:** 裸机部署无 CI/CD / SaaS 无域名 TLS / 密钥无管理
- **Rule:** AD-2 Rule 演进:MVP 仍单节点单 Go 二进制,Go 单二进制本身无云依赖、裸机直跑技术可行,但官方部署目标限云托管(Fly.io/Railway/Render/云 VM,实现期选); 加 Dockerfile(多阶段构建:Rust→wasm + Go binary + 前端 dist,单镜像) + CI/CD(GitHub Actions:lint→test→build→deploy); SQLite 仍可用(单实例,持久卷挂载)——云平台选型须支持持久卷挂载,若所选平台不支持持久卷(如 Render Web Service)则 SQLite 不可用,须视为 addendum §3.2 PostgreSQL 迁移提前触发条件; 多实例仍走 addendum §3.2 阈值,垂直扩容优先(先升云平台机器规格至最高档,仍不满足再水平迁移); 域名 + TLS(Let's Encrypt 自动)必须,可观测栈 MVP 不上独立产品走云平台内置日志/监控(客户端熔断事件经 WS 上报服务端写 stdout,见 AD-16); 密钥(OAuth client_secret / 邮件 API key)走云平台 secret env,不入 git; addendum §3.2 阈值表:auth 不入(已 MVP),云托管本身不触发水平迁移

**Dependency direction (who may depend on whom):**

```mermaid
flowchart TD
    subgraph Client["Browser Client"]
        ReactUI["React UI / Editor"]
        SolverBoundary["TS Solver Boundary"]
        WasmKernel["Wasm Kernel (Rust)"]
        Render["Canvas Render"]
        YDoc["Y.Doc CRDT"]
    end

    subgraph Server["Go Server"]
        WSGateway["WebSocket Gateway"]
        YjsRelay["yjs-go CRDT Relay"]
        SQLite["SQLite WAL"]
        MemState["In-memory Presence / Sim-state"]
    end

    ReactUI --> YDoc
    YDoc --> SolverBoundary
    SolverBoundary --> WasmKernel
    ReactUI --> Render

    WasmKernel --> HandwrittenParser["Handwritten Parser (Rust)"]
    WasmKernel --> AutodiffCrate["autodiff crate 0.7.0"]
    WasmKernel --> FaerLU["faer 0.24.4 LU"]

    YDoc <--> YjsRelay
    YjsRelay --> SQLite
    YjsRelay --> MemState

    Client <-->|WebSocket + handshake auth (AD-16)| WSGateway
    WSGateway --> YjsRelay
    WSGateway --> AuthGate["Auth/Permission Gate\n(session token + role check, AD-16/17)"]
```

## Consistency Conventions

| Concern | Convention |
|---|---|
| Naming — AST node identification | Each AST node carries `nid` = UUIDv4. Paren bypass references AST nodes by `nid`. Y.Map keys are nested AST node identifiers. |
| Naming — AST node types | {binop, unop, ref, num, pending}. No group node type (parens are external bypass). |
| Naming — formula reference id/name layering | Storage layer: CRDT AST ref nodes store stockId (UUIDv4). Display layer: editor renders `@<uuid>` as the referenced stock's name; renaming a stock changes name only, formula refs never break (handoff #10). |
| Data & formats — snapshot version vector | Y.Doc clientID + clock vector carried in snapshot. |
| Data & formats — circuit breaker envelope | ASCII `[SYSTEM HALTED: <reason>]` on Wasm breach (AD-5). |
| Data & formats — pending node shape | `{type:'pending', rawText:Y.Text, cursorHint:number|null}` (AD-13). |
| Data & formats — paren bypass structure | Y.Array of maps keyed by `nid`, not AST group nodes (AD-14). |
| State — simulation numeric mutation | All sim-step numeric evaluation inside Wasm kernel (AD-5). TS side does not run simulation steps. |
| State — CRDT single source of truth | Y.Doc CRDT is the single source of truth for the model. |
| State — host-authoritative sim state | Server relays CRDT only; does not run simulation (AD-3, AD-4). Host client owns sim state and snapshots. |
| State — SQLite persistence | SQLite WAL single file, in-process (no separate DB process) (AD-2). |
| State — session token | Server-side session (HttpOnly Secure Cookie, non-JWT); Go process memory + SQLite session table for restart survival (AD-16). |
| Naming — users table | `users(id, username, oauth_provider, oauth_user_id, created_at)` with UNIQUE(oauth_provider, oauth_user_id) for multi-provider OAuth linkage (AD-16). |
| Naming — boards ownership | `boards(id, owner_user_id, share_token)`; permission enforced at WS gateway not in CRDT (AD-17). |
| Naming — share_token entropy | `share_token` generated via crypto/rand, ≥128 bits entropy, URL-safe base64; owner-regenerable to revoke old links (AD-17). |
| Data & formats — CRDT persistence scoping | `CRDTSnapshot` / `OpLog` each carry `board_id` FK to scope multi-board persistence (AD-17); `PresenceSnapshot` carries `board_id` as in-memory key (not persisted, dropped on session end, FR-COLLAB-5). |

## Stack

| Name | Version |
|---|---|
| React | ^19.2.0 |
| TanStack Start | ^1.168.26 |
| TanStack Router | ^1.170.16 |
| Vite | ^8.0.16 |
| Tailwind CSS | v4 |
| TypeScript | ^5.8.3 |
| bun | (runtime, as per prototype) |
| Rust | stable toolchain |
| wasm-pack | latest stable |
| faer | 0.24.4 |
| autodiff | 0.7.0 |
| Go | stable |
| yjs-go (averyyan/yjs-go) | pinned via go.mod at implementation |
| SQLite | 3.x, WAL mode |

## Structural Seed

### System / Container Context

```mermaid
flowchart LR
    subgraph Browser["Browser Client"]
        Wasm["Wasm Kernel\n(Rust → wasm-pack)"]
        ReactUI["React UI\n(TanStack Start + Router)"]
        YDoc["Y.Doc CRDT"]
        Render["Canvas Render\n(VRAM double-buffer + glow atlas)"]
    end

    subgraph Server["Go Server (single binary)"]
        WS["WebSocket Gateway\n+ handshake auth (AD-16)"]
        YjsRelay["yjs-go CRDT Relay"]
        SQLite["SQLite WAL"]
        Presence["In-memory Presence\n/ Sim-state Snapshot"]
        AuthMW["Auth Middleware\n(OAuth callback + session, AD-16)\n+ Permission Gate (AD-17)"]
    end

    Browser <-->|WebSocket + session token| Server
    Wasm -->|exports| ReactUI
    YDoc <--> YjsRelay
    YjsRelay --> SQLite
    YjsRelay --> Presence
```

### Deployment & Environments

```mermaid
flowchart LR
    subgraph Production["Cloud-hosted Single Node (AD-18)"]
        GoBin["Go binary (single process)\nin Docker container"]
        SQLiteFile["SQLite WAL file\n(persistent volume)"]
        CI["CI/CD: GitHub Actions\nlint→test→build→deploy"]
        Secrets["Secret env\n(OAuth client_secret, etc.)"]
    end

    Client1["Browser Client 1"] -->|WebSocket + TLS + session| GoBin
    Client2["Browser Client 2"] -->|WebSocket + TLS + session| GoBin
    ClientN["Browser Client N"] -->|WebSocket + TLS + session| GoBin
    OAuth["GitHub / Google OAuth\n(zero fee, direct)"] <-.->|OAuth callback| GoBin
    GoBin --- SQLiteFile
    GoBin --- Secrets
    CI -.->|deploy| GoBin
```

### Core-Entity ERD

```mermaid
erDiagram
    YDoc ||--o{ ASTNode : "contains"
    YDoc ||--o{ ParenBypass : "contains"
    YDoc ||--o{ PendingNode : "contains"
    ASTNode {
        uuid nid PK
        string type "binop|unop|ref|num|pending"
        json children "nested Y.Map"
    }
    ParenBypass {
        uuid nid FK
        array map "Y.Array of maps"
    }
    PendingNode {
        uuid nid PK
        text rawText "Y.Text"
        number cursorHint "nullable"
    }
    SQLite ||--o{ CRDTSnapshot : "persists"
    SQLite ||--o{ OpLog : "persists"
    Board ||--o{ CRDTSnapshot : "scopes (board_id)"
    Board ||--o{ OpLog : "scopes (board_id)"
    Board ||--o{ PresenceSnapshot : "in-memory keyed by board_id"
    CRDTSnapshot {
        uuid board_id FK "scopes per board (AD-17)"
        string versionVector "clientID+clock"
        datetime simulationTime
        json docState
    }
    OpLog {
        int id PK
        uuid board_id FK "scopes per board (AD-17)"
        string opData "Yjs update"
        datetime timestamp
    }
    PresenceSnapshot {
        uuid board_id FK "in-memory key (AD-17), not persisted"
        string hostClientId
        string simState
        datetime capturedAt
    }
    User {
        uuid id PK
        string username
        string oauth_provider "github|google"
        string oauth_user_id
        datetime created_at
    }
    Session {
        string token PK "HttpOnly Secure Cookie"
        uuid user_id FK
        datetime expires_at
    }
    Board {
        uuid id PK
        uuid owner_user_id FK
        string share_token "nullable, for share-link join"
    }
    UserBadge {
        uuid user_id FK
        string badge_id
        datetime unlocked_at
    }
```

### Minimal Source Tree

```
{root}/
  src/
    lib/
      sd/               # brownfield: existing system-dynamics core (formula.ts, etc.)
      render/           # Canvas 2D fixed-point render (VRAM double-buffer, glow atlas, hue-shift shader)
      collab/           # Yjs CRDT document model (Y.Map AST, paren bypass, pending nodes, merge logic)
      solver/           # TS thin boundary — Wasm exports caller (Solver boundary per AD-5)
  wasm/
    src/                # Rust solver kernel: parser, autodiff, faer LU, BDF integrator, Newton solver, dimension check, non-negative clamp, DELAY expansion
    Cargo.toml
  server/
    main.go             # Go single binary: WebSocket gateway (handshake auth AD-16), yjs-go CRDT relay, SQLite persistence (users/sessions/boards/badges), in-memory presence, auth middleware + permission gate (AD-16/17)
    go.mod
  package.json          # brownfield: React + TanStack Start + Vite + Tailwind
  Dockerfile            # multi-stage build: Rust→wasm + Go binary + frontend dist, single image (AD-18)
  .github/workflows/    # CI/CD: lint→test→build→deploy (AD-18)
```

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
|---|---|---|
| FR-SIM-1 (implicit BDF, multi-step integrator) | Wasm kernel (`wasm/src/`) | AD-5, AD-7 |
| FR-SIM-2 (algebraic loop detection / stock circuit breaker) | Wasm kernel compile-time topological check | AD-5 |
| FR-SIM-3 (flow conservation / single convergence value) | Wasm kernel (`wasm/src/`) | AD-5, AD-8 |
| FR-SIM-4 (rate clamping, non-negative stock) | Wasm kernel (`wasm/src/`) | AD-5, AD-8 |
| FR-SIM-5 (DELAY function as ghost stocks) | Wasm kernel (`wasm/src/`) | AD-5, AD-6 |
| FR-SIM-6 (circuit breaker / system halt) | Wasm kernel + TS Solver boundary | AD-5, AD-2 |
| FR-SIM-7 (DELAY function) | Wasm kernel (`wasm/src/`) | AD-5, AD-6 |
| FR-SIM-8 (degradation chain) | Wasm kernel + TS Solver boundary | AD-5, AD-7, AD-12 |
| FR-COLLAB-1 (multi-user presence) | Go server (`server/`) | AD-3, AD-2 |
| FR-COLLAB-2 (presence awareness) | Go server in-memory + CRDT relay | AD-3, AD-4 |
| FR-COLLAB-3 (host migration) | Go server snapshot + host client | AD-11, AD-2 |
| FR-COLLAB-4 (lock-free editing) | Y.Doc CRDT (`src/lib/collab/`) | AD-1 paradigm, AD-10 |
| FR-COLLAB-5 (snapshot persistence) | Go server SQLite (`server/`) | AD-11, AD-2 |
| FR-COLLAB-6 (merge-undo / conflict resolution) | Y.Doc CRDT + `src/lib/collab/` | AD-10, AD-13, AD-14 |
| FR-CANVAS-3 (ASCII glyph rendering) | `src/lib/render/` | AD-9 |
| FR-CANVAS-4 (canvas viewport) | `src/lib/render/` | AD-9, AD-2 |
| FR-CANVAS-5 (mini-map) | `src/lib/render/` | AD-9 |
| FR-UI-6 (CRT background drift, per-glyph glow) | `src/lib/render/` (glow atlas) | AD-9 |
| FR-GAME-2 (behavior badges, cross-device persistence) | Go server SQLite `user_badges` table (bound to account) | AD-16 |
| Auth & permission (OAuth GitHub+Google, owner/editor/viewer, WS handshake auth) | Go server `server/` (auth middleware + WS gateway gate) | AD-16, AD-17 |
| Cloud deployment (Dockerfile, CI/CD, TLS, secret env) | repo root `Dockerfile` + `.github/workflows/` | AD-18 |

## Deferred

The following are intentionally not decided at this altitude:

- **F5-perf (Jacobian full recompute performance):** Whether full Jacobian recompute + sparse LU can meet PRD section 1.4's 100 steps/s target for 100-stock scale. Open question from memlog. Implementation-time calibration; if target not met, Broyden approximation must be re-evaluated.
- **F1-quality (glow atlas vs shadowBlur visual parity):** VRAM atlas glow must reproduce prototype per-glyph shadowBlur neon quality to **visually indistinguishable** acceptance (synced with spec CAP-11, locked stricter than prior open status). Implementation-time visual prototype vs shadowBlur comparison required; if not met, treat as FR-UI-6 non-conformance (no shadowBlur fallback, violates AD-9).
- **F6-threshold (light/heavy conflict enumeration):** The light vs heavy conflict classification threshold cannot be exhaustively enumerated at architecture time. Open question from memlog. Implementation-time calibration against real conflict scenarios.
- **F7-snapshot-freq (snapshot upload frequency):** FR-COLLAB-5 specifies "periodic" without concrete frequency. Open question from memlog. Implementation-time calibration balancing replay cost vs host startup latency.
- **Adaptive step-size:** Lives inside the FR-SIM-8 degradation chain. Not an MVP requirement; deferred to implementation within that chain.
- **Broyden re-evaluation:** Only triggered if F5-perf fails the 100 steps/s target. Not an architecture decision.
- **Observability stack (independent product) / multi-node WS gateway / PostgreSQL / Redis:** Addendum section 3.2 threshold-triggered. Not MVP. (Auth is now MVP per AD-16/17; cloud hosting per AD-18; neither triggers horizontal migration.)
- **AST conflict light/heavy threshold enumeration:** Implementation-time calibration against real conflict scenarios.
- **VRAM glow quality acceptance criteria:** **Visually indistinguishable** (locked, synced with spec CAP-11). Implementation-time visual prototype vs shadowBlur comparison required; no shadowBlur fallback if not met (AD-9).
- **Go SQLite driver choice:** Implementation-time decision, constrained by single-binary envelope (AD-2).
- **Snapshot upload frequency:** Implementation-time calibration (deferred from F7-snapshot-freq).
- **Rust async runtime for Wasm:** No decision needed at MVP — Wasm solver kernel is synchronous compute, not I/O-bound.
- **Self-hosted username/password auth:** Not MVP. SaaS scale-up complements OAuth (GitHub+Google) once email service is in place. AD-16 governs MVP auth.
- **Snapshot quiescence protocol (Reviewer Gate hole #3):** Whether snapshot capture must drain in-flight CRDT sync before reading, vs idempotent replay guard. AD-11's version vector + current-CRDT-wins replay already prevents double-application of ops on host handoff; the quiescence-vs-guard choice is an implementation-time concurrency decision, not an architecture invariant.
- **Prettier config baseline:** Inherit `lovable/prototype`'s `eslint-plugin-prettier` implicit defaults (no explicit `.prettierrc` on prototype today). Establish root `.prettierrc` at implementation kickoff before first TS/JS code lands on `main`, so editor/CI format-on-save activates deterministically instead of no-op'ing. Implementation-time tooling decision, not an architecture invariant.
- **CRDT op semantic validation / editor rate-limit (Reviewer Gate security finding):** AD-17 gateway rejects viewer ops, but editor retains full CRDT write and may send malicious ops (mass delete / forged stockId / oversized Awareness / op flooding). MVP gateway does minimal role-check only; per-client op/s quota, Awareness size/freq limits, room-capacity hard cap (10 users), and delete-target-existence checks are deferred to the implementation-time security spec. Revisit before MVP launch.
- **Server-restart recovery protocol (Reviewer Gate data-integrity finding):** Session survives restart (SQLite session table, AD-16) but in-memory sim state and hostClientId are lost. AD-11 host-migration governs live handoff; the restart-recovery case (auto-elect new host from connected editors via CRDT version vector, resume from persisted CRDTSnapshot) is deferred to implementation. Revisit before MVP launch.
- **Host-migration trigger protocol detail (Reviewer Gate data-integrity finding):** Who detects host disconnect (server heartbeat timeout), election priority (editor with newest CRDT version), and original-host-reconnect arbitration are deferred to implementation. CRDT version vector (AD-11) provides the ordering invariant; the trigger timing/threshold is an operational parameter. Revisit before MVP launch.
- **SQLite backup/restore & zero-downtime deploy (Reviewer Gate deployment finding):** Single-node SQLite has no backup strategy and each deploy has a downtime window. Both are deferred: backup path (e.g. daily `sqlite3 .backup` to object storage) must be defined before MVP launch; zero-downtime deploy is non-MVP (deploy-window downtime acceptable, documented in ops runbook). Revisit backup before launch.
