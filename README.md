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
bun run dev        # 前端 dev
bun run build      # 生成 dist(routeTree.gen.ts 作为副作用生成并提交)
bun run typecheck  # tsc --noEmit
```

## 部署(双轨,sub-PR #4 落地)

- **云托管**:Cloudflare Containers(托管 Go + SQLite + Wasm)
- **开源自部署**:docker-compose + Let's Encrypt/Caddy
- **共享单元**:Docker image(multi-stage Dockerfile)

## 美学基座

详见 `_bmad-output/design-system/ascii-design-system.md`。token 机器可读镜像在
`src/styles/tokens.css`。

## 进度

- ✅ 规划全阶段合并 main(@7c96479):架构 18 ADs + spec 13 CAPs + epics 6 epic/35 story + IR ✅ READY
- 🚧 Story 1a.1 应用骨架与无限画布导航(本 PR:foundation sub-PR #1)
