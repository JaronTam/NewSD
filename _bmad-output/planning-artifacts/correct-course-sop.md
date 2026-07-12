# Correct-Course (CC) Step 5 回写 SOP - NewSD

> bmad-correct-course skill 的 Step 5 (Apply/回写) 执行 SOP。CC 触发规格层变更时, Step 5 须按本 SOP 回写, 防 PR#41 类遗漏 (漏建 story 块 / 漏清占位 / 漏标执行链 / 漏同步下游)。
> 依据: bmad-correct-course skill (module-help.csv L6); SCCP 产品模板见 [sprint-change-proposal-2026-07-10.md](sprint-change-proposal-2026-07-10.md); 简要 checklist 见 [story-cycle-formalization.md](story-cycle-formalization.md) §8。
> 触发: CC Step 4 用户 Review pass -> Step 5 批准 -> 本 SOP 执行回写。

## 1. 回写四项 checklist (按序, 每项核验后进下一项)

### 项 1: 建 story 块

- 新增 story 须在 epics.md 建完整 block: `#### Story X.Y: 标题` + As a / I want / So that + Acceptance Criteria (Given/When/Then) + 边界 guard 段 (依赖与 defer)。
- 仅加 FR 定义 + FR mapping 不够: SCCP proposal 可能只加 FR, 但 sprint-plan 已定 story 编号时, epic 须有对应 story 块 (PR#41 漏建 1a.11 story 块: SCCP proposal 1 仅加 FR-ELEM-5 定义+mapping, sprint-plan §6.1 已定 1a.11 但 epic 缺块致执行链悬空)。
- 占位 story (AC 细节留 CS) 须显式标注 "留 CS" + 门控条件, 不包装成已定 (噪声门控, memory newsd-design-discussion-noise-gate)。

### 项 2: 清占位

- 清除所有 "编号留 SP" / "待 SP" / "TBD" 占位符: sprint-plan 已定夺编号后, 占位须全量替换为实际编号。
- 标题 / guard 段 / 执行链三处占位必清。
- 核验: `grep -n "编号留 SP\|待 SP\|TBD" epics.md` = 0。

### 项 3: 标执行链

- 执行顺序显式标注于相关 story 的 guard 段 (如 `执行顺序: 1a.8 -> 1a.11(命名机制) -> 1a.12(重构) -> 1a.9(i18n) -> 1a.10`)。
- 不重编号的 story 须注明 "编号不变, 执行后移"。
- 三源对齐: epic guard 段 == sprint-plan §6.x == sprint-status.yaml 注释。

### 项 4: 同步 sprint-plan + sprint-status + memory

- sprint-plan: §6.x 裁定 (编号 / 执行链 / 门控) 写入或更新。
- sprint-status.yaml: 新增 story key (status=backlog) + 执行顺序注释; last_updated 更新。
- memory: CC 回写裁定落项目记忆 (待办更新 / 新 story 记录), 关联 newsd-promptpanel-restructure-pending 等。
- 三源 (sprint-plan + sprint-status + memory) 与 epic 一致性核验。

## 2. 回写产物完整性核验

| 核验项       | 方法                                                    |
| ------------ | ------------------------------------------------------- |
| story 块完整 | grep `#### Story` 新增编号, 确认有 AC + guard 段        |
| 占位清零     | grep `编号留 SP\|待 SP\|TBD` = 0                        |
| 执行链一致   | epic guard 段 == sprint-plan §6.x == sprint-status 注释 |
| 下游同步     | sprint-plan + sprint-status + memory 三源含新 story     |
| scope 路由   | Major scope 走 PR (禁直推 main)                         |

## 3. PR 路由

- CC Step 5 回写改 epic / sprint-plan = 规格层 Major 变更, 走 PR (main 有 Require PR 保护, 禁直推)。
- PR 描述: 总结 + 测试计划 (规格层变更无代码测试, §2 核验清单作测试计划)。
- 合并后: sprint-status done 注释回填 (若涉及 done story); memory 完整性补 (PR sha + 落地点)。

## 4. 历史教训

- PR#41 (2026-07-12 CC Step 5): 漏建 Story 1a.11 story 块 (SCCP proposal 1 仅加 FR-ELEM-5 定义+mapping, sprint-plan §6.1 已定 1a.11 但 epic 缺块) + 漏清 "编号留 SP" 占位 (1a.12/5.4 标题) + 漏标执行链。PR#44 回填修正。本 SOP 固化防复发。
- 关联 memory: newsd-promptpanel-restructure-pending / newsd-review-exhaust-authority-sources (编号类变更须核 epic + sprint-plan + sprint-status + SCCP 全域)。

---

关联: [story-cycle-formalization.md §8](story-cycle-formalization.md) | [sprint-change-proposal-2026-07-10.md](sprint-change-proposal-2026-07-10.md) (SCCP 产品模板) | [sprint-plan-2026-07-05.md §6](sprint-plan-2026-07-05.md)
