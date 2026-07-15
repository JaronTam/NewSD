# NewSD 术语表 (Glossary)

> 权威锚 - 长期参考文档, 定义 story-cycle 内多义术语的精确用法。跨文档引用以本表为准。
> 关联: [story-cycle-formalization.md](story-cycle-formalization.md) | [epics.md](epics.md)

## 1. SDR (Story Decision Record)

**定义**: Story 层决策记录, 与 ADR (Architecture Decision Record) 平行的粒度层级 - ADR 记跨 story 架构决策 (AD-1..AD-18), SDR 记 story 内实现决策 (`SDR#1..SDR#N`, story 局部编号)。

**编写规范**: 每条 SDR 须含

- 分类标签: `[设计契约]` (真决策, 需 DS 实现) / `[保留不变量]` (勿动) / `[流程 meta]` (单 PR/IR/e2e scope 等非代码)
- 三元 (仅 `[设计契约]` 类必须): **现状** (当前代码/规格状态) / **目标** (SDR 实现后期望态) / **守卫** (AC# + 红测试断言, 含"旧态消失"反向债拆除断言)
- 引用: Task 行须内联 `gov: SDR#N` (让 SDR 成 Task 前置依赖)

**位置**: 位于 story 文件的 `### SDR` 段 (原 `### CS 钉死` / `### CS 决策` 段)。

**来源**: 由 CS (bmad-create-story) 生成, VS (validate-create-story) 追溯矩阵门控核, DS (bmad-dev-story) 遵循实现, CR (bmad-code-review) Layer3 交叉核 Task↔SDR 一致性。

---

## 2. SDR 相关术语精确用法

原 `钉死` 一词在 NewSD 项目中被跨 5 种技术角色复用, 现按角色拆分为精确术语:

| 原用法 (钉死)                        | 角色                 | 精确术语                                      | 用例                              |
| ------------------------------------ | -------------------- | --------------------------------------------- | --------------------------------- |
| `CS钉死#7` / `钉死#N`                | #1 决策对象 (名词)   | **`SDR#N`**                                   | `SDR#7`                           |
| `CS钉死区` / `钉死 prose section`    | #2 决策所在段 (区块) | **`SDR 段`** / **`SDR section`**              | `story 文件 ### SDR 段`           |
| `CS 须钉实现路径` / `钉实现路径`     | #3 编写动作 (动词)   | **pin** (英语动词)                            | `CS 须 pin 实现路径, 非留 defer`  |
| `钉死 device audit` / `钉死机制审计` | #4 机制/装置 (元层)  | **SDR 机制** / **SDR device**                 | `SDR 机制审计`                    |
| `钉死 authoring standard`            | #5 编写规范 (修饰)   | **SDR 编写规范** / **SDR authoring standard** | `formalization §2.1 SDR 编写规范` |

**为何拆分**: `钉死` 一词兜底多义 (决策对象/段/动作/装置/规范) 致文档歧义, CS 决策项/编写规范/pin 动作混淆 -> VS 门控无法机械核 Task↔决策项 一致性 (1a.7 F-1-4 教训: DS 按 T11 偏离 SDR#7 漏到 CR)。SDR 术语与 ADR 对齐, 引入英语精确技术词组 (pin/SDR) 消歧, 中文体裁段落用 `SDR` (直借英文缩写) + `pin` (动词)。

**为何用 SDR 而非 `决策`**: `决策` 泛化程度过高, 与 CS/VS/DS/CR 各阶段的"决策"混淆; SDR 是 story 层特定粒度的决策记录, 与 ADR 工业术语对齐, 单义。

---

## 3. 迁移记录

**Term migration PR (2026-07-15 process PR)**: 全域 `钉死` -> SDR 迁移, 覆盖:

- Phase 0 本 glossary.md (新建)
- Phase 1 story-cycle-formalization.md
- Phase 2 sprint-status.yaml
- Phase 3 1a-11-entity-naming-mechanism.md (二次 retrofit: `决策` -> SDR, 追认 1a-11 的分类标签+三元编写规范, 名称锚定 SDR)
- Phase 4 History stories 1a-4..1a-8 (已合并 main, doc-only sweep)
- Phase 5 SCCP 2026-07-10 (归档亦 sweep 保术语一致)
- Phase 6 epics.md
- Phase 7 memory items + MEMORY.md
- Phase 8 Holding branch fc29ee6 重写
- Phase 9 test-artifacts ATDD (`ds-prompt-1a5.md` + `atdd-checklist-1a-7/8.md`, 12 hits)

**不纳入 sweep**: `src/**/*.{ts,tsx,css}` 代码 comment 中的 `CS钉死 #N` 引用 - doc-only PR 边界, 代码 comment 作 grandfathered 保留 (新增代码 comment 用 SDR 术语)。

---

## 4. 关联文档

- [story-cycle-formalization.md](story-cycle-formalization.md) §2.1 SDR 编写规范 / §2.2 VS 追溯矩阵
- [epics.md](epics.md) - epic 层规格, SDR 引用 epic AC
- ADR 定义位于 architecture.md (AD-1..AD-18)
