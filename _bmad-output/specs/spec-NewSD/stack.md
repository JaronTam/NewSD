# Stack — NewSD

> 技术栈固定表。版本 pin 自 `ARCHITECTURE-SPINE.md`(status: final)。分两类:**沿用 prototype(brownfield)** 与 **greenfield-new**。SPEC.md Constraints 引用本文件作技术栈固定约束。

## 沿用 prototype(brownfield 客户端栈)

| Name | Version | 备注 |
|------|---------|------|
| React | ^19.2.0 | |
| TanStack Start | ^1.168.26 | |
| TanStack Router | ^1.170.16 | |
| Vite | ^8.0.16 | |
| Tailwind CSS | v4 | |
| TypeScript | ^5.8.3 | |
| bun | (runtime) | 按 prototype |

## Greenfield-new(架构期新引入)

| Name | Version | 用途 | 备注 |
|------|---------|------|------|
| Rust | stable toolchain | Wasm 求解器内核 | |
| wasm-pack | latest stable | Rust → Wasm 打包 | |
| faer | 0.24.4 | LU / sparse 线性求解 | 牛顿步线性方程组(AD-6) |
| autodiff | 0.7.0 | 自动微分 | 雅可比生成(AD-6) |
| Go | stable | 单体后端 | WebSocket 网关 + CRDT 中继 + SQLite + 进程内存(AD-3) |
| yjs-go (averyyan/yjs-go) | pinned via go.mod at implementation | Go 侧 Yjs CRDT 中继 | reputation Medium caveat,实现期首验 sync protocol(AD-4) |
| SQLite | 3.x, WAL mode | CRDT 快照 + 操作日志持久化 | 单文件服务进程内访问(AD-2) |

## 已弃用 / 不引入

| 被否项 | 理由 |
|--------|------|
| **mexpr / meval** | 不存在于 crates.io(AD-6);meval 8 年 stale 且不暴露 AST 致双源翻译层 |
| Node.js 后端服务 | 违 AD-3 单 Go 决策;退回 Node 混合违 F3 |
| PostgreSQL / Redis(MVP 阶段) | 10 人认证单节点违 YAGNI,addendum §3.2 阈值触发后再引入 |
| 第三方图表库(ECharts/D3) | MVP 纯 ASCII sparkline 呈现(PRD §5.2) |
| eval() 公式求值 | 安全约束,仅 Rust/Wasm 解析器(PRD §4.3, AD-5) |
| per-glyph shadowBlur | GPU 极端消耗,改用 VRAM 图集(AD-9) |

## 求解器 crate 组合(AD-6 详)

手写递归下降 parser(复用 prototype `src/lib/sd/formula.ts` 结构,扩 `@uuid` / `[单位]` 产生式) + autodiff crate 0.7.0 + faer 0.24.4。

- **parser 手写**:自主可控,prototype formula.ts 思路延续。
- **autodiff 借库**:autodiff crate 0.7.0(2023-03-29),非全手写以避数值正确性自担。
- **LU 借 faer**:faer 0.24.4(2026-06-24 current)。
- **AST 为单一真相源**:供 autodiff 图 / 量纲校验 / tokenizer 共用,无双源翻译层。
- **不引入 meval**:meval 不暴露 AST,引入即需双源翻译。

prototype 现有 `src/lib/sd/formula.ts` 的 `evalFormula`(纯 TS 递归下降)仅留作非仿真场景(UI 实时预览 / 量纲预览),**仿真路径须替换为 Wasm 内核调用**(AD-5)。

## 部署(Deployment,AD-18)

| 项 | 选型 | 备注 |
|------|---------|------|
| Dockerfile | 多阶段构建 | stage1: Rust→wasm-pack;stage2: Go build;stage3: 前端 dist;终镜像单 Go 二进制 + 静态前端 + wasm(AD-18) |
| CI/CD | GitHub Actions | lint→test→build→deploy,main 合并触发部署(AD-18) |
| 部署目标 | 云托管单节点 | Fly.io / Railway / Render / 云 VM,实现期选一(AD-18) |
| TLS | Let's Encrypt 自动 | 域名 + HTTPS 强制;SaaS 必备(AD-18) |
| 持久卷 | SQLite WAL 文件挂载 | 平台不支持持久卷则提前触发 addendum §3.2 PG 迁移(AD-18) |
| 可观测 | 云平台内置日志/监控 | 不上独立可观测栈产品;客户端 `[SYSTEM HALTED]` 熔断事件经 WS 上报服务端写 stdout 供云日志捕获(AD-5/AD-18) |

裸机直跑技术可行(单二进制无云依赖)但非官方 MVP 目标;垂直扩容优先,水平迁移走 addendum §3.2 阈值。

## 密钥(Secrets,AD-16/AD-18)

| 密钥 | 存放 | 备注 |
|------|---------|------|
| OAuth client_secret(GitHub/Google) | 云平台 secret env | 走 server env,**不入前端 bundle 不入 git**(AD-16) |
| Session token signing key | 云平台 secret env | server-side session 签名(非 JWT,AD-16) |
| 邮件 API key(SaaS 规模化后) | 云平台 secret env | MVP 不含邮件服务(AD-16) |

密钥统一走云平台 secret env(Fly.io secrets / Railway variables / Render env),不硬编码不入仓库。
