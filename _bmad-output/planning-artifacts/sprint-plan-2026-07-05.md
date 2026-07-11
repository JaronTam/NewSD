# Sprint Plan 2026-07-05 ([SP] bmad-sprint-planning 正式化)

> 本文档为 [SP] bmad-sprint-planning 正式化的本次快照: 裁定记录 + 首片 scope + 逆向 CR findings 余项排期。
> 长期 story-cycle 流程定义见 [story-cycle-formalization.md](story-cycle-formalization.md); 机器可读状态见 `../implementation-artifacts/sprint-status.yaml`。

## 1. 裁定记录

### 1.1 起算 story 裁定: 1a.3

- **决策**: 起算 story = 1a.3 (网格吸附与存量/源汇图元)
- **依据**: epics.md line 344 (权威规格基准, step-03 细化版) 明确 "Story 1a.3 起按 CS→VS→DS→CR story-cycle 推进"
- **memory 修正**: `newsd-bmad-story-cycle-formalization-boundary` 记 "1b.1 起" 已过时, 修正为 "1a.3 起"
- **根因**: memory 写于 1a.2 收尾前 (Epic 1a 仅展开到 1a.2, 误认 1a.2 为末 story); epics.md step-03 已展开 Epic 1a 为 10 story (1a.1-1a.10), 1a.2 非末
- **原则**: 规格基准是 epic 不是 prototype (冲突以 epic 为准); memory 时效以当前权威源修正

### 1.2 实现模式裁定: 单 PR 完整 story-cycle

- **决策**: 单 PR 走完整 story-cycle (CS→VS→DS→CR, 一个 story 一个 PR)
- **不再** 像 1a.1/1a.2 拆 sub-PR (1a.1 五 sub-PR / 1a.2 两 sub-PR+halo 调优)
- **依据**: story-cycle 已正式化 (见 [story-cycle-formalization.md](story-cycle-formalization.md)), 各阶段 gate 完备; sub-PR 是 story-cycle 缺失期的权宜
- **例外**: 1a.3 若 CS 阶段发现 scope 过大可回退 sub-PR (判据见 story-cycle §6), 但 1a.3 AC 体量 + findings fold 预计单 PR 可控

### 1.3 findings fold 策略: A1/A2/A4 + C3 全 fold 首片

- **决策**: A1/A2/A4 (契约债) + C3 (Playwright 基建) 全 fold 进 1a.3 首片
- **依据**: 逆向 CR 处置建议; 契约基座 (RenderInstance 扩字段 + mutation API + GLSL 模板) + 测试基建一次到位, 避免后续 breaking change 成本
- **处置表**: 见 §3

## 2. 首片 scope (Story 1a.3)

### 2.1 epics.md AC (1a.3 原始, line 346-381)

- 1 world unit = 1 char grid (网格单位对齐)
- snapTolerance = 8/currentZoom (恒 8px screen, 缩放下不变)
- grid step configurable (网格步长可配)
- stock 图元: ASCII box (┌┐└┘─│), props (id/type/x,y/width,height/name/initialValue/units/currentValue/allowNegative)
- cloud 图元: `.--.` / `(    )` / `'--'` (源/汇)
- E9 stock size validity guard: 创建时 validate width/height>0 numeric (ECH 边界)

### 2.2 fold 进首片的逆向 CR findings

| finding  | 描述                                                                                                                                                  | 落点      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A1 (②C1) | VRAMRenderer 加 per-instance mutation API (避免 render() full replace 每帧重建 GL buffer)                                                             | 1a.3 首片 |
| A2 (②C2) | RenderInstance 扩字段 (entityType/zOrder/rotation/selected), 涉及 shader+vertexAttrib+buildBootInstances (breaking change, 1a.3 图元契约基座正是时机) | 1a.3 首片 |
| A4 (③C2) | GLSL 模板插值 `u_palette[${PALETTE_SIZE}]` 替代字面量 `uniform vec4 u_palette[8]` (shaders.ts:72/96 双源消除)                                         | 1a.3 首片 |
| C3       | 建 Playwright/e2e 基建 (加 playwright dep, 1a.3 视觉 gate 有自动化基础)                                                                               | 1a.3 首片 |

### 2.3 首片 PR scope

- 一个 PR (单 PR story-cycle)
- 含: 1a.3 AC 实现 + A1/A2/A4 契约债 + C3 Playwright 基建
- CS 阶段 (bmad-create-story) 将把上述拆为子任务, 写入 story 文件
- D1 (gridSnap/snapToGrid 实现) 是 1a.3 自然交付 (非 fold, 是 AC 本身)

## 3. 逆向 CR findings 余项排期表

> 来源: [reverse-cr-1a1-1a2-findings.md](reverse-cr-1a1-1a2-findings.md) (2026-07-05)

| finding | 类别                                | 处置         | 落点                        | 状态      |
| ------- | ----------------------------------- | ------------ | --------------------------- | --------- |
| A1      | ②C1 contract                        | fold 首片    | 1a.3 首片                   | 待 CS     |
| A2      | ②C2 contract                        | fold 首片    | 1a.3 首片                   | 待 CS     |
| A3      | ③C1 guard                           | 已落地       | PR#23                       | ✅ done   |
| A4      | ③C2 contract                        | fold 首片    | 1a.3 首片                   | 待 CS     |
| C3      | test infra                          | 首片内建     | 1a.3 首片                   | 待 CS     |
| B1-B4   | contract major                      | backlog      | 后续 story (3.x/4.x 契约期) | backlog   |
| C1      | test (drawGrid 零覆盖)              | backlog      | 后续补                      | backlog   |
| C2      | test (readTokens 零覆盖)            | backlog      | 后续补                      | backlog   |
| C4-C7   | renderer/CanvasView/camera 测试覆盖 | backlog      | 后续补                      | backlog   |
| D1      | impl (gridSnap/snapToGrid 未实现)   | 1a.3 natural | 1a.3 AC 本身                | 1a.3 交付 |
| E       | minor cleanup                       | backlog      | 后续                        | backlog   |

## 4. sprint-status.yaml 摘要

- **路径**: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **结构**: 6 epic / 35 story + 6 retrospective + action_items
- **状态**:
  - epic-1a: in-progress (首 epic 活跃)
  - 1a-1, 1a-2: done (已合并 main)
  - 1a-3 ~ 1a-10, 1b-1 ~ 5-3: backlog (32 story)
  - epic-1b/2/3/4/5: backlog
  - action_items: [] (无 retrospective)
- **起算**: 1a-3-grid-snap-stock-source-sink (backlog, 下一 CS 目标)

## 5. 下一步

1. [SP] 本 PR 合并 main 后
2. [CS] bmad-create-story: 生成 `1a-3-grid-snap-stock-source-sink.md` story 文件 (含 1a.3 AC + A1/A2/A4/C3 fold 子任务), sprint-status 1a-3 → ready-for-dev
3. [VS] *validate-create-story: review story 文件 (零歧义/零遗漏/可执行)
4. [DS] bmad-dev-story: 单 PR 实现 (TDD red-green-refactor, 全验证门控)
5. [CR] bmad-code-review: 并行对抗审查 (Blind Hunter/Edge Case/Acceptance Auditor)
6. sprint-status 1a-3 → done, 进入 1a.4

## 6. CC Step 5 路由 (2026-07-12, bmad-correct-course)

> 来源: [sprint-change-proposal-2026-07-10.md](sprint-change-proposal-2026-07-10.md) §5 Handoff; **Major scope** 裁定(用户批准 "A" 继续)。
> epics.md 已回写 7 提案(PromptPanel 四 tab 重构 + 游戏化中心规格 + 图元命名机制 + flow 端点完整性 + 错误二分归宿 + FR-UI-3 修订),逐条 old->new 见提案 §4。

### 6.1 新增 story 编号定夺(本节定,提案 "编号留 SP")

| 提案标签               | 编号  | slug                           | Epic | 状态    | 依赖                |
| ---------------------- | ----- | ------------------------------ | ---- | ------- | ------------------- |
| FR-ELEM-5 命名机制     | 1a.11 | 1a-11-entity-naming-mechanism  | 1a   | backlog | 1a.8                |
| 1a.8+ PromptPanel 重构 | 1a.12 | 1a-12-prompt-panel-restructure | 1a   | backlog | 1a-11 命名机制      |
| Story 5.4 游戏化中心   | 5.4   | 5-4-gamification-center        | 5    | backlog | 点3 讨论 + 5.3 就绪 |

- **不重编号**: 1a.9(i18n)/1a.10(model-settings) 编号不变,执行顺序后移。
- **执行顺序**: 1a.8 -> 1a.11(FR-ELEM-5 命名机制) -> 1a.12(1a.8+ 重构) -> 1a.9(i18n) -> 1a.10(model-settings)。i18n 对 1a.8+ 最终 tab 结构抽 key 避免返工。
- **Story 5.4 门控**: 待点 3(游戏化中心详细设计:表盘/等级/徽章墙交互与数据模型)讨论收敛 + 5.3(badge-system-master-switch)就绪后方可启动 CS;AC 细节当前留 CS。

### 6.2 点 3 独立待办(Story 5.4 前置,不阻塞 Epic 1a)

- 游戏化中心详细设计(表盘 + 等级机制 + 徽章墙的交互/触发条件/数据模型)尚未细化,作为独立设计讨论项,不阻塞 Epic 1a 推进。
- 收敛后回写 epics.md Story 5.4 AC 细节(当前留 CS),再启动 5.4 CS(另需 5.3 就绪)。

### 6.3 1a.7 defer 独立推(不夹带本次 CC 回写)

- 1a.7 defer 5 文件(PromptPanel.tsx / PromptPanel.test.tsx / styles.css / deferred-work.md / 1a-7-toolbar-statusbar.md)独立推送,**不夹带**本次 CC epics.md 回写提交。
- 详见提案 §5 附录。

### 6.4 下一步 story-cycle

1. [CC] 本提交(epics.md 回写 + sprint-plan/status 同步)合并 main(Major scope,走 PR)
2. [CS] bmad-create-story: 1a.8 property-panel-formula-editor(功能逻辑层:公式编辑/校验/量纲 stub + 最简 UI 容器;容器层 tab 化/新 tab/错误二分归宿在 1a.12 重构)
3. [VS/DS/CR] 1a.8 完整 story-cycle
4. [CS] 1a.11 entity-naming-mechanism(FR-ELEM-5 命名机制独立小 story)
5. [CS] 1a.12 prompt-panel-restructure(1a.8+ 四 tab 重构)
6. [CS] 1a.9 i18n / 1a.10 model-settings(执行顺序后移)
7. [设计讨论] 点 3 游戏化中心 -> [CS] 5.4 gamification-center(待 5.3 就绪)

---

关联: [story-cycle-formalization.md](story-cycle-formalization.md) | [epics.md](epics.md) | [reverse-cr-1a1-1a2-findings.md](reverse-cr-1a1-1a2-findings.md) | sprint-status: `../implementation-artifacts/sprint-status.yaml`
