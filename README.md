# NewSD

赛博朋克 ASCII 系统动力学多人协作建模平台 MVP。

## 技术栈

| 层     | 技术                                               | 说明                     |
| ------ | -------------------------------------------------- | ------------------------ |
| 前端   | React 19 + TanStack Start (SPA mode) + Tailwind v4 | 无限画布(等宽网格为画布) |
| 数值核 | Rust + wasm-pack (Wasm)                            | Float64 仿真,epic 1b     |
| 服务端 | Go (单二进制,嵌入 dist)                            | AD-18 单节点             |
| 存储   | SQLite WAL                                         | 备份原语 AR#15           |

## 测试(三语言)

| 语言 | 命令                         | 范围           |
| ---- | ---------------------------- | -------------- |
| 前端 | `bun run test`               | vitest (jsdom) |
| Go   | `go test ./...`              | 服务端         |
| Wasm | `wasm-pack test --node wasm` | 数值核         |

### 本地可跑 vs CI-only

| 命令                                                                    |           本地            |      CI       |
| ----------------------------------------------------------------------- | :-----------------------: | :-----------: |
| `bun run lint` / `bun run test` / `bun run build` / `bun run typecheck` |            ✅             |      ✅       |
| `go test ./...`                                                         |        需本地装 Go        | ✅ (setup-go) |
| `wasm-pack test --node wasm`                                            | 需本地装 Rust + wasm-pack | ✅ (CI 安装)  |

> dev 机未装 go/rust/wasm-pack;Go 与 Wasm 测试以 CI 为准。

## 开发

```bash
bun install
bun run dev          # 前端 dev
bun run build        # 生成 dist(routeTree.gen.ts 作为副作用生成并提交)
bun run typecheck    # tsc --noEmit
```

### 单二进制(Go serve dist,sub-PR #2)

```bash
bun run build        # 先生成 dist/(go:embed 编译期要求)
go build -o newsd .  # 嵌入 dist → 单二进制(AD-3 无 Node 运行时)
PORT=8080 ./newsd    # 默认 :8080
```

端点:`GET /`(SPA)、`GET /__version`(版本戳,接 `internal/version`)、`GET /__health`(存活)。
未知 `/__*` 保留命名空间 → 404;客户端路由回退 index.html。`go test ./...` 需 dist/
存在(CI 由 frontend job 产出 artifact 供 go job 下载)。

## 部署(双轨,sub-PR #4 落地)

- **云托管**:Cloudflare Containers(托管 Go + SQLite + Wasm)
- **开源自部署**:docker-compose + Let's Encrypt/Caddy
- **共享单元**:Docker image(multi-stage Dockerfile)

## 美学基座

详见 `_bmad-output/design-system/ascii-design-system.md`。token 机器可读镜像在
`src/styles/tokens.css`。

## 进度

- ✅ 规划全阶段合并 main(@7c96479):架构 18 ADs + spec 13 CAPs + epics 6 epic/35 story + IR ✅ READY
- ✅ Story 1a.1 foundation sub-PR #1 合并 main(@03a1919):brownfield carry + SPA shell + 三语言测试基座 + 设计系统 token 基座
- 🚧 Story 1a.1 sub-PR #2(本 PR):Go serve dist(单二进制 + /__version + /__health + F1/F2/F3 清理)
- ⏳ Story 1a.1 sub-PR #3:无限画布导航(Float64 pan/zoom + 3×2 仿射)+ 美学机制 A②③ 落地
- ⏳ Story 1a.1 sub-PR #4:Dockerfile 多阶段 + CI/CD 双轨(Cloudflare Containers + docker-compose)
- ⏳ Story 1a.1 sub-PR #5:SQLite WAL 备份原语(AR#15 三选一 + 恢复 E2E)
