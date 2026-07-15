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
- web research 显式记录 (step4: 有新 lib/API→记 version+why+breaking change; 无新依赖→explicit no-op 引用基座 story version 锁; 禁静默 skip — 1a.4 教训:静默 skip 致事后审计无法区分"无新依赖"与"该查未查")
- 测试标准 (TDD red-green)
- 依赖 (前置 story/AD) 标注
- ZERO USER INTERVENTION (除初始选择)
- IR 前置轻量核 (step1 前: AD/CAP 引用存在 + 依赖 story 存在, 防 epic↔story drift - #8 落地)
- e2e AC 门槛实现路径 (AC 含 e2e 测试时): CS 须 pin 实现路径非留 defer - 1a.8 教训: e2e canvas-click 基础设施 (CanvasView WebGL canvas 无 DOM overlay/testid) 应在 CS 识别并归属 story (实现 testid/DOM overlay 或明确 defer 归 1b epic 规划), 禁 defer 到 DS 才发现 selector mismatch
- **CS SDR 编写规范** (SDR = Story Decision Record, ADR-aligned 设计决策权威载体; enforcement 靠 §2.2 VS 核非靠 "SDR" 词 - 1a.7 教训: DS 跟 Task T11 偏离 CS SDR#7, SDR prose section 被结构性绕过; SDR 只写 target 不写 delta/guard 致反向债埋散文, DS "加 throw 留旧软警告分支" 半实现):
  - 分类三段 (禁混, 每条标类别): 设计契约 (真 SDR, 需 DS 实现) / 保留不变量 (勿动, 前序 story 已就位仅声明) / 流程meta (单PR/IR/e2e scope 等 CS SDR 非代码)
  - 每条设计契约 = (现状 / 目标 / 守卫) 三元: 现状 = 当前代码反例 + `file:line` 锚 (含反向债: 当前代码与 SDR 正相反, 如允许重名/软警告/可选字段/max+1 复用序号); 目标 = delta (改/拆什么); 守卫 = 对应 AC# + 红测试断言 (含 "旧态消失" 断言, 如旧 AC-15 "重名允许" 测试组改写为 "重名拒绝")
  - 反向债显式拆除项: 现状与目标相反的 SDR, 目标列标 "拆除 X (`file:line`)" + 独立红测试 (防半实现 - 1a.8 F-1 声明↔代码不一致类)
  - Task 行内联 `gov: SDR#N` (权威倒置): 每 Task/Subtask 行 cite 其 governing SDR# (如 `T6(AC-7) [gov: #4]`), 让 SDR 成 Task 前置依赖而非平行 section, 读 Task 即强制读 SDR

### 2.2 VS (Validate Story)

**流程**:

- reviewer 检查 story 文件质量
- gate: 零歧义 (AC 无多种解读) + 零遗漏 (epic AC 全覆盖) + 可执行 (dev 能直接做) + web research 显式记录 (step4 no-op 也算, 禁静默 skip — VS 门控拦截 CS step4 缺失, 不留到事后审计) + task↔CS SDR 一致性 (Tasks/Subtasks 行实现方向须与 CS SDR 项逐条一致, 矛盾拦在 VS 不漏到 CR, 1a.7 教训: DS 按 T11 偏离 CS SDR#7 致 F-1-4 漏到 CR) + e2e spec 可跑性 gate (AC 含 e2e 时): VS 须核 e2e selector 可跑 - 1a.8 教训: CanvasView 纯 WebGL canvas 无 DOM overlay, property-panel.spec.ts selector mismatch 致 green-phase 不可行 7 test .skip() defer D4 归 1b; AC 含 e2e 时核渲染架构 (DOM 可断言 vs canvas-only), 拦 selector mismatch 不留 DS
- **SDR↔AC↔Task 追溯矩阵** (§2.1 CS SDR 编写规范 的对端核, 1a.7 task↔SDR mismatch 漏到 CR F-1-4 的根因补丁): VS 须机械核 (a) 每 Task 有 `gov: SDR#N` 引用 (b) 每个设计契约 SDR 有 ≥1 Task + ≥1 AC 覆盖 (c) 每守卫红测试存在且断言 "旧态消失" (反向债拆除项必查); 矩阵缺口 = 矛盾, 拦在 VS; 轻量: 内联 `gov:` 引用即矩阵边, 不必单开表
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
- 测试质量 gate (DS step6 author tests 时遵守):
  - reactive AC (AC 含 "实时/响应/刷新/更新/同步" 迁移语义) 测试须断言状态迁移三元组: before 值 + 触发动作 + after 值, 且 `after !== before` + after 语义正确; 禁以 `toBeTruthy()`/`toBeDefined()`/`not.toBeNull()` 作唯一断言收尾 (存在性 AC 用存在性断言 OK; 1a.8 F-1 教训: AC-9 test 3 原仅 truthy, 派生单位不刷新 bug 下字段仍存在测试仍绿)
  - 组件含 "选中实体切换" 交互 (props/state 含 selectedId/selection) 时, 须有跨图元切换测试: 切换后字段显示新图元值 (不泄漏旧图元值) + 切换前未提交编辑 (blur 前) 不污染新图元; 要点骨架 `render A -> change A field (no blur) -> rerender B -> assert B field = B value, ≠ A edit, ≠ A value` (1a.8 F-2 教训: 跨图元字段泄漏无覆盖)
- step8 mark complete 前 baseline diff review: `git diff <baseline_commit>..HEAD` 逐文件核, **须产出可审计逐文件核验表** (防 DS 虚假声明 - 1a.4 F9 抓 12+ false claims / 1a.7 偏离 CS SDR#7; #1 落地):
  - 落 story `## Dev Agent Record` (Dev Log 后) `### step8 baseline diff review`, 表列 `文件 | Dev Log 声明 | diff 实际 | 一致?`, 每个 `git diff baseline..HEAD` 改动文件一行
  - 行号辅助定位: "Dev Log 声明" 列注声明编号(如 T4), "diff 实际" 列注行号 + 内容锚(如 `L203 read selectedElement.units`); 行号会 drift, 以内容锚为准, 行号仅辅助定位
  - 声明↔diff 不一致 = 矛盾, 当场修 (修声明或修代码), 禁过 step8
  - 留痕双目的: (a) 事后审计 (CR/过程审计) 直接查表, 非重跑 diff; (b) 留痕过程本身逼诚实 - DS 须写出 "声明 X / diff Y", 写不出一致行即暴露
  - 教训锚: 1a.8 F-1 (Dev Log T4 声明 `deriveFlowUnits` vs 实读 `selectedElement.units`) 无此表存活到 CR Layer3; 若有表, T4 行 "一致? NO" 当场暴露过不了 step8
- step9 DoD 双源核验: 逐条对照 epic AC ∪ story AC, 遗漏即 fail (防 AC 遗漏 - 1a.4 AC-12b/12c 靠 VS 修订补; #4 落地)
- e2e ATDD scaffold 渲染架构 gate (AC 含 e2e + ATDD 红脚手架时): DS 须核 ATDD scaffold 渲染架构 - green-phase 须 DOM 可断言; 1a.8 教训: CanvasView WebGL canvas 无 DOM overlay, ATDD red-phase 写 DOM selector 致 green-phase 不可行 (e2e defer B accept 落 D4); DS 前 /bmad-testarch-atdd 须核渲染路径, canvas-only 渲染须先实现 testid/DOM overlay 或 defer e2e

### 2.4 CR (Code Review)

**流程** (bmad-code-review skill, step-file 架构):

1. gather context (fresh context, 理想不同 LLM)
2. parallel adversarial review:
   - Blind Hunter: 找隐藏 bug
   - Edge Case Hunter: 边界路径
   - Acceptance Auditor: AC 覆盖
3. 汇总 findings
4. fix (dev) 或 accept (reviewer)
5. sprint-status -> done (独立 chore PR, 合后推) + story 文件 Status -> done (随 story PR 提交, CR pass 时改 - 1a.4 偏离#5 修正: 禁留 review)

- **orchestrator-direct 不起 subagent** (ark-code/DeepSeek 后端): 编排层自己 Read/grep/`git show <baseline>:<path>` 跑全 3 层 (Blind Hunter = Markdown 列表 cynical findings 只描述; Edge Case Hunter = JSON 数组 {location, trigger_condition, guard_snippet, potential_consequence}; Acceptance Auditor = AC-by-AC Markdown 列表); subagent 两轴崩 (同步 prompt-too-long + 异步越界改码 被 TaskStop 杀); 换 Claude 级强模型可重试 subagent 但须 per-file diff + read-only leash + 内联 SKILL.md (1a.4 教训; memory newsd-cr-3-layers-orchestrator-direct-not-subagents + newsd-bmad-skill-strict-invocation-and-prompt)
- read-only 守卫: 每层 review 起止 `git status --porcelain` 断言空 (防 CR 越界改码 - 1a.4 改 elements.ts +11/test +32-5; orchestrator-direct 直跑易加, #2 落地)
- Layer3 交叉核 DS step8 留痕: Acceptance Auditor 审 AC 覆盖时, 核 story `## Dev Agent Record` 有 `### step8 baseline diff review` 逐文件核验表 + 抽样核表内 "diff 实际" 列 ↔ 真实 `git diff baseline..HEAD` 一致 (防 DS 留假表/漏表 - 1a.8 F-1 无表存活到 CR; §2.3 #1 留痕机制的对端审计; patch 前核, CR patch 后表为 DS step8 快照不更新, patch 记 CR Run section)
- Layer3 hollow 测试审计: Acceptance Auditor 审 AC 覆盖时, 核每个 AC 对应测试非 hollow (防名义覆盖零断言 - 1a.8 L878 空 if-body 名义测切换更新字段零断言, F-2 无覆盖漏到 CR):
  - 空 if-body / 空 then 分支 = hollow
  - 唯一断言为 `toBeTruthy()`/`toBeDefined()`/`not.toBeNull()` 且 AC 非存在性 AC = hollow (与 §2.3 测试质量 gate reactive 三元组呼应)
  - `test.skip()` 须有原因注释 (1a.8 T9 re-skip "uncontrolled inputs 设计限制" 有注释 = 合规; 无注释 skip = hollow; TDD 红期 skip 是流程非 hollow)

**artifacts**:

- 输入: 实现 (review 状态)
- 输出: CR 报告 + 修订 (若需)

**gate**: CR pass -> done (须双写: sprint-status->done + story 文件 Status->done; 1a.4 偏离#5 教训: story 文件 Status 禁留 review); fail -> 回 DS 修订

**CR 产物完整性** (pass 前双产物齐, 1a.7 教训: 漏 deferred-work + 漏 CR Run section 回填):

- 产物 1 deferred-work.md: defer 项落 `implementation-artifacts/deferred-work.md` (per-story section `## From Story X CR (Run N, date)` + 表 ID/Item/Target Story/Rationale; accept 项也记, 1a.7 加 处理 列 defer/accept)
- 产物 2 story CR Run section: story 文件回填 `## CR Run` -> `### Run N, date - verdict` (Agent Model / 3 层 Findings 表 ID/类型/处理 / patch 记录 / defer 项交叉引用 deferred-work / 验证口径 tsc+vitest+build+Playwright 全套件 count / Verdict / retrospect)
- report-before-execute gate: 3 层 review 跑完 -> 报告 (决策点 / patch 计划 / defer 项) -> 等用户确认 -> 才 patch/合并 (memory newsd-cr-report-before-execute-gate; 合并 PR 不可逆)
- **e2e 验证口径全套件**: CR 验证须记全套件 count (如 "Playwright e2e 29/29") 非新 story 子集 (如 "7/7"); AC-8 无回归 = 全套件绿; 记子集 understates 验证范围 (共享文件改动可让其他 spec e2e 回归在 done 时未核实即溜过); 1a.6 教训: 记 7/7 退步于 1a.5 的 22/22, 现实全套件 29/29 绿; memory newsd-e2e-attestation-full-suite-not-subset

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
  - task↔CS SDR 一致性 (见 §2.1 CS SDR 编写规范 + §2.2 追溯矩阵; Tasks 须 cite `gov: SDR#N`, 矛盾拦在 VS, 1a.7 教训)
  - 约束引用 (AD/CAP 显式)
  - 测试标准 (TDD red-green)
  - web research 显式记录 (step4: 有新依赖记 version+why+breaking; 无新依赖记 no-op 引用基座 version 锁; 禁静默 skip)
  - 依赖标注 (前置 story/AD)
- **gate**: 零歧义 + 零遗漏 + 可执行 + web research 显式记录 + task↔CS SDR 一致性 + SDR↔AC↔Task 追溯矩阵 (见 §2.2; Tasks 须 cite `gov: SDR#N`, 矛盾拦在 VS)

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

## 8. CC Step 5 回写 checklist (规格层变更回写)

CC (bmad-correct-course) Step 5 触发规格层变更时, 须按四项 checklist 回写, 防 PR#41 类遗漏 (漏建 story 块 / 漏清占位 / 漏标执行链 / 漏同步下游)。完整 SOP 见 [correct-course-sop.md](correct-course-sop.md)。

- 项 1 建 story 块: 新增 story 须在 epics.md 建完整 block (标题 + As a/I want/So that + AC + guard 段), 非仅加 FR 定义+mapping
- 项 2 清占位: 清除 "编号留 SP/待 SP/TBD" 占位 (标题/guard/执行链三处), `grep` 核验 = 0
- 项 3 标执行链: 执行顺序显式标 guard 段, 不重编号 story 注明 "编号不变执行后移", 三源对齐 (epic == sprint-plan §6.x == sprint-status 注释)
- 项 4 同步下游: sprint-plan §6.x 裁定 + sprint-status.yaml 新 key + memory 项目记忆, 三源与 epic 一致性核验

---

关联: [sprint-plan-2026-07-05.md](sprint-plan-2026-07-05.md) | [epics.md](epics.md) | sprint-status: `../implementation-artifacts/sprint-status.yaml`
