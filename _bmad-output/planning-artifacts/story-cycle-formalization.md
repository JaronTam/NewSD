# Story-Cycle 正式化定义 (CS→VS→DS→CR)

> NewSD 项目自 Story 1a.3 起按 BMad story-cycle 四阶段推进。本文为长期参考文档, 定义各阶段流程、gate、artifacts。
> 依据: epics.md line 344 ("Story 1a.3 起 按 CS→VS→DS→CR story-cycle 推进"); BMad skills (bmad-create-story / *validate-create-story / bmad-dev-story / bmad-code-review)。
> 本次 [SP] 裁定快照见 [sprint-plan-2026-07-05.md](sprint-plan-2026-07-05.md); 机器可读状态见 `../implementation-artifacts/sprint-status.yaml`。

## 1. 阶段映射

| 阶段 | BMad skill             | 角色                     | 触发                                      | 输出                                     |
| ---- | ---------------------- | ------------------------ | ----------------------------------------- | ---------------------------------------- |
| CS   | bmad-create-story      | planner                  | 上一 story done, sprint-status 有 backlog | story 文件 + sprint-status→ready-for-dev |
| VS   | *validate-create-story | reviewer                 | CS 完成                                   | VS 报告 (pass/fail)                      |
| DS   | bmad-dev-story         | dev                      | VS pass                                   | 实现+测试 + sprint-status→review         |
| CR   | bmad-code-review       | reviewer (fresh context) | DS review                                 | CR 报告 + sprint-status→done             |

## 2. 各阶段详述

### 2.1 CS (Create Story)

**流程** (bmad-create-story skill 6 步):

1. determine target story: 从 sprint-status 找第一个 backlog story (ID 如 1a-3-...)
2. load/analyze artifacts: epic AC + AD + IR + spike 结论 + 逆向 CR findings (fold 项)
3. architecture analysis: READ 待修改文件 (non-negotiable, 防回归)
4. web research: lib/最佳实践
5. create story file: 从模板生成 `_bmad-output/implementation-artifacts/{story-id}.md` (AC/任务拆解/技术约束/测试标准/依赖)
6. update sprint-status: backlog → ready-for-dev

**artifacts**:

- 输入: epic AC + AD + IR + findings
- 输出: story 文件 (`implementation-artifacts/{id}.md`)
- 状态: backlog → ready-for-dev

**gate** (CS 完成条件):

- story 文件含完整 AC (Given/When/Then, 覆盖 epic 全部 AC + fold 的 findings)
- 任务拆解到可执行子任务
- 技术约束 (AD/CAP) 显式引用
- 测试标准 (TDD red-green)
- 依赖 (前置 story/AD) 标注
- ZERO USER INTERVENTION (除初始选择)

### 2.2 VS (Validate Story)

**流程**:

- reviewer 检查 story 文件质量
- gate: 零歧义 (AC 无多种解读) + 零遗漏 (epic AC 全覆盖) + 可执行 (dev 能直接做)
- pass → 进入 DS; fail → 回 CS 修订

**artifacts**:

- 输入: story 文件
- 输出: VS 报告 (pass/fail + 修订建议)

**VS 无独立 BMad skill** (执行细则见 §5)

### 2.3 DS (Dev Story)

**流程** (bmad-dev-story skill 10 步):

1. find ready story (ready-for-dev)
2. load context
3. detect review continuation
4. mark in-progress (capture baseline_commit)
5. implement red-green-refactor (TDD)
6. author tests
7. run validations
8. mark complete ONLY when done
9. completion → review
10. communication

**artifacts**:

- 输入: story 文件
- 输出: 实现 (代码+测试) + sprint-status (review)
- baseline_commit: dev 起点 (回滚锚)

**gate** (DS 完成条件, NEVER mark complete unless 全 pass):

- 全 AC 实现且测试 pass
- `tsc --noEmit` pass
- `vitest` 全绿 (sdone 前端测试基座)
- `wasm-pack test` pass (若涉及 Wasm)
- `go test` pass (若涉及 Go)
- CI 全绿 (frontend/go/wasm/build-image)
- NEVER implement anything not mapped to task/subtask
- NEVER mark complete unless 全验证门控 pass

### 2.4 CR (Code Review)

**流程** (bmad-code-review skill, step-file 架构):

1. gather context (fresh context, 理想不同 LLM)
2. parallel adversarial review:
   - Blind Hunter: 找隐藏 bug
   - Edge Case Hunter: 边界路径
   - Acceptance Auditor: AC 覆盖
3. 汇总 findings
4. fix (dev) 或 accept (reviewer)
5. sprint-status → done

**artifacts**:

- 输入: 实现 (review 状态)
- 输出: CR 报告 + 修订 (若需)

**gate**: CR pass → done; fail → 回 DS 修订

## 3. sprint-status 状态机

```
epic:          backlog → in-progress → done
story:         backlog → ready-for-dev → in-progress → review → done
retrospective: optional ↔ done
action item:   open → in-progress → done
```

- epic → in-progress: 首个 story 启动
- story backlog → ready-for-dev: CS 生成 story 文件
- story ready-for-dev → in-progress: DS 启动 (capture baseline_commit)
- story in-progress → review: DS 完成 (全验证 pass)
- story review → done: CR pass
- epic → done: 全 story done
- retrospective appends action_items; sprint-status surfaces open ones

## 4. PR 工作流 (NewSD 特化)

- 禁直推 main; 改 main 走 PR
- `gh pr create` → 本地 `tsc --noEmit` + `vitest run` 自检通过 (CI 与 husky hooks 已于 PR #29 移除; 合并门仅 main 分支保护 Require PR, 无 required checks) → `gh pr merge --squash --delete-branch`
- 提交前核暂存区 (`git diff --cached --stat`); 禁止清单: `.claude/` / `package-lock.json` / `.playwright-mcp/` 非白名单 PNG / 根级 PNG (命中则 `git restore --staged <file>`)
- 禁 `git add -A` (用 `git add <显式路径>`)
- 合并后卫生 (手动, `scripts/` 已于 PR #29 移除): `git checkout main && git pull --ff-only origin main && git fetch --prune origin && git branch -D <已合并分支>` (squash 合并后分支 tip 非祖先, 须 `-D` 强删; 删前先 `gh pr view <N> --json state` 确认 MERGED)
- 提交信息: 标题 + 要点 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- PR 描述: 总结 + 测试计划 + 末尾 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## 5. VS 执行细则

VS 在 `.claude/skills/` 无独立 skill, 引用 dev-story step1 的 `*validate-create-story`。NewSD 执行方式:

- **选项 A (推荐)**: 用 bmad-code-review skill 对 story 文件做 review (fresh context, 输入是 story 文件而非实现)
- **选项 B**: 手动检查清单:
  - AC 完备 (Given/When/Then, 覆盖 epic 全 AC)
  - 任务可执行 (子任务粒度 dev 能直接做)
  - 约束引用 (AD/CAP 显式)
  - 测试标准 (TDD red-green)
  - 依赖标注 (前置 story/AD)
- **gate**: 零歧义 + 零遗漏 + 可执行

## 6. 单 PR vs sub-PR 决策

- **Story 1a.3 起默认单 PR 走完整 story-cycle** (一个 story → 一个 PR)
- 不再像 1a.1/1a.2 拆 sub-PR (1a.1 五 sub-PR / 1a.2 两 sub-PR+halo 调优; sub-PR 是 story-cycle 缺失期的权宜)
- **例外**: 若 story scope 实施期 (CS 阶段) 发现过大, 可回退 sub-PR, 但须在 DS step4 前决策并记录于 story 文件
- **sub-PR 判据**: story 含 ≥3 个独立技术子系统 (如 1a.1 含项目骨架+画布+gate+Docker+SQLite 五子系统) 或 findings fold 致 AC > 20 条

## 7. gate 红线 (NewSD 特化)

CR/DS 必查红线 (违则 fail):

- 禁 per-glyph shadowBlur (CAP-11, AD-9): CR 必查, 降级路径是删渲染质感非回退 shadowBlur
- 规格基准是 epic 不是 prototype (冲突以 epic 为准)
- memory 只记已验证状态 (有验证命令证实), 不记意图; 收尾时尤高危
- 读图 (PNG/截图/设计稿/视觉 gate) 前先 ⚠ 切多模态停手等确认
- 文档标点: prd 全角 / epics+spine 半角
- 定位变更须传播到全部措辞

---

关联: [sprint-plan-2026-07-05.md](sprint-plan-2026-07-05.md) | [epics.md](epics.md) | sprint-status: `../implementation-artifacts/sprint-status.yaml`
