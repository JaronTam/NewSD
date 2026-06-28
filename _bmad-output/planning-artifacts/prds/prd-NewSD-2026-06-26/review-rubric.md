# PRD Quality Review — 系统动力学 ASCII 模拟器 PRD (v2026-06-26)

## Overall verdict

This is a **strong** PRD that earns its claims through explicit decision records, honest weight warnings, and unusually precise engineering constraint framing. The PRD is decision-ready on its core bets (C1-C5) and does not smooth over tensions — it flags them repeatedly. Risk is concentrated not in the PRD's quality but in the MVP scope itself: the four heavyweight decisions (solver + dimensional analysis + semantic merge + sparkline + gamification badges) compound to a build that may exceed a "lightweight educational tool" framing. The PRD documents this faithfully; the question is whether the product thesis and scope are aligned. Primary weaknesses: NFR thresholds are product-level for performance but boilerplate for reliability/security; done-ness clarity on implicit solver non-negative clamping is underspecified for engineering handoff.

## Decision-readiness — strong

The PRD treats decisions as decisions, not considerations. C1-C5 are explicitly labeled `[决策（原开放问题 X）]`, with rejected alternatives named and reasons given (addendum §3.3, §7.5, §8.4). The distinction between "decision" and "deferred" is clean: open questions 2-4 are truly open (no hidden answer in the next sentence). Weight warnings in addendum §7.3 and §8.3 are unusually honest — they name the tension with the product thesis, state that the user confirmed anyway, and spell out de-scope leverage order. The PRD passes the pushback test: an engineer reading §7.3-8.3 would find their objections acknowledged.

### Findings
- **[high]** Pasted decision labels in §六 use `[决策（原开放问题 1）]` but open question 1 is nowhere to be found — it was resolved into a decision label, but a reader cannot trace what the original open question was. *Fix:* Either retain the original open question text as a footnote, or add a brief note: "原开放问题 1: 仿真运行时态是否跨会话持久化？"
- **[low]** §7.5 rejected alternatives ("固定 RK4", "自适应 RK45") are named but no reason is given *in the PRD* — only addendum §7.5 has it. Decision-readiness would be served by a one-liner in the main doc (e.g., "被否：用户明确选隐式" already appears in §7.5 of addendum — this is fine for a chain-PRD but marginal for standalone reading).

## Substance over theater — strong

No persona theater: four personas are listed, two are flagged as MVP-primary, and they drive concrete decisions (gamification off-switch for professional users, educational framing). No innovation theater: the "ASCII aesthetic" and "structure-as-content" claims are earned — the PRD backs them with engineering constraints (VRAM double buffer, Canvas 2D, R-tree indexing). No vision theater: the vision statement ("赛博朋克风格、基于 ASCII 字符渲染的多人协作系统动力学建模平台") is specific and irreplaceable. NFR theater is where the PRD is weakest — see below.

### Findings
- **[medium]** §4.2 reliability NFRs ("协作服务可用性 99.9%", "服务器重启无数据丢失") are boilerplate — no product-specific threshold for what constitutes acceptable downtime in an educational tool context (is 99.9% too tight for MVP? Is "no data loss" realistic for SQLite single-node without replication?). *Fix:* Add a note that 99.9% = ~8.7 hrs/year downtime; for a 10-person educational MVP, 99% (3.65 days) may be more honest. Or remove the 99.9% and say "best-effort, no SLA for MVP."
- **[low]** §4.3 CORS protection and WebSocket Origin header checks are standard-practice boilerplate. They are not wrong but add no product-specific security stance. Minor — the PRD earns most of its substantive weight elsewhere.

## Strategic coherence — strong

The PRD has a clear thesis: "轻量教育工具 + 沉浸式 ASCII 美学 + 可选游戏化." The feature set follows from this thesis — sparkline over heavy charting libraries, CRDT for real-time classroom collaboration, badges for exploration motivation. The MVP scope kind is a "problem-solving MVP" (proves the SD learning loop) with elements of "experience MVP" (ASCII aesthetics as differentiator). Counter-metrics are present (§1.4 anti-metrics) and specific. The scope logic is coherent: implicit solver + dimensional analysis + semantic merge are all justified by the educational use case (correctness matters for learning). The tension between "lightweight" and "heavyweight solver" is flagged, not hidden.

### Findings
- **[medium]** The thesis tension is real and the PRD documents it (addendum §7.3, §8.3), but never resolves it. The de-scope lever order (⑤ > ③ > ①) is in the addendum (§8.3) but not in the main PRD. A reader scanning only the main doc might miss that the MVP has an acknowledged weight problem. *Fix:* Add a one-line reference in §5 MVP scope: "体量警示：四项重决策叠加使 MVP 偏重，减负杠杆顺序见 addendum §8.3."
- **[low]** Success metrics (§1.4) are all technical (FPS, latency, solver speed) — no product-level metric (e.g., "students complete their first SD model in <10 min", "number of models created per session"). The thesis is educational, but the metrics are engineering. *Fix:* Add one product-level SM, e.g., "首次建模完成率 ≥ 80%."

## Done-ness clarity — adequate

FRs generally have testable consequences. FR-CANVAS-1 through FR-CANVAS-4, FR-ELEM-1 through FR-ELEM-4, FR-SIM-5 through FR-SIM-7, FR-COLLAB-1 through FR-COLLAB-6, FR-BOARD-1 through FR-BOARD-3, FR-HISTORY-1, FR-UI-1 through FR-UI-5 all carry enough specificity that an engineer could build from them. The rendering specs (snap tolerance formula, Bresenham pathfinding, VRAM double buffer), the CRDT document structure (Y.Map/Y.Array definitions), and the clipboard protocol (Base64 + CRC32 + schema whitelist) are unusually precise.

### Findings
- **[critical]** FR-SIM-1 and FR-SIM-4 together describe a **constrained nonlinear implicit solver** (backward Euler/BDF + Newton iteration + non-negative clamping via projection/active-set). The PRD correctly flags this as a "难点" needing "专项规约" in addendum §2 and §7.2 — but the engineering team cannot build from the PRD alone. The key question "does the Newton iteration respect non-negativity as a constraint during line search or as a post-step projection?" is unanswered. *Fix:* At minimum, state the architectural decision boundary: "架构阶段须决定：非负钳制是 (a) 牛顿迭代线搜索期施加约束（活动集法），还是 (b) 牛顿步后投影到可行域。选项 (a) 更精确但实现复杂；选项 (b) 更简单但可能影响收敛性。"
- **[high]** FR-SIM-6 ("数值溢出熔断") uses relative magnitude threshold of `1e6 × max initial absolute value` — this threshold is stated as "MVP 默认值，可由用户调整" but there is no guidance on how to set it meaningfully. A user who doesn't understand the system dynamics won't know what value to pick. *Fix:* Provide a sensible default and the rationale (e.g., "默认 1e6 覆盖大多数教育模型；正反馈模型（如指数增长）需上调；用户可通过模型设置面板调整").
- **[medium]** FR-GAME-2 ("行为徽章") lists triggers but has no acceptance criteria for badge display (e.g., "badge appears as ASCII art in a notification area that auto-dismisses after 3s", "badge collection viewable in settings panel"). *Fix:* Add 2-3 acceptance criteria lines.
- **[low]** FR-CANVAS-3 uses "合理性能" implicitly — the performance target is already in §4.1 (1000 elements at 60 FPS). This is acceptable since the NFR section covers it. No fix needed.

## Scope honesty — strong

Non-goals are explicit (§5.2 MVP 排除 — 10 items, all clear). `[NON-GOAL for MVP]` is not a tag style used in this PRD but the MVP/non-MVP separation is unambiguous. Assumptions are tagged `[假设 N]` and indexed in §六. The scope warnings in addendum §7.3 and §8.3 are the strongest signal: they name the exact tension, name the de-scope lever, and record user acknowledgment. Open questions are genuinely open (OQ2: board size; OQ3: auth vs. anonymous; OQ4: data path unification). No silent de-scoping detected.

### Findings
- **[medium]** The PRD uses `[假设 1]`, `[假设 2]`, `[假设 3]` in §六 but these are not indexed in a separate Assumptions Index section as the rubric expects. *Fix:* Add a brief "假设索引" subsection at end of §六 listing all `[假设]` tags with page/FR cross-references.
- **[low]** `[ASSUMPTION: ...]` inline tags (per rubric §5) are absent — the PRD uses a centralized assumptions section instead. Acceptable approach, but inline tags near the point of use would improve traceability.

## Downstream usability — adequate

Glossary is present implicitly (domain terms defined at point of use). FR/UJ/SM IDs are contiguous and unique. Cross-references within the PRD resolve (e.g., FR-SIM-7 references FR-ELEM-3, FR-COLLAB-1, FR-SIM-1). The addendum and main doc are well-separated (PRD = "what", addendum = "how/future"). Each UJ has a named protagonist (学生, 教育工作者, etc.). The structured AST/CRDT schema details in FR-COLLAB-1 are exact enough for architecture handoff.

### Findings
- **[critical]** No Glossary section. Domain terms ("存量断路器", "非负钳制", "双时间轴分离", "单次求值原则", "两遍扫描初始化", "DELAY 隐式存量", "NaN 熔断保护") are defined in §2.2 but not collected into a single Glossary. An architect or story writer pulling out a single FR will not have easy access to all definitions. *Fix:* Add a Glossary section (before or after §六) collecting all 7 math constraints plus key domain nouns (SFD, CLD, CRDT, R-tree, VRAM double buffer).
- **[medium]** The PRD mixes `[假设 N]` and `[开放问题 N]` and `[决策]` in §六 without clear visual separation. A downstream reader extracting open items must scan carefully. *Fix:* Use a table: | Type | ID | Description | Status |, or at minimum add section headers.
- **[low]** FR-SIM-1 mentions "时间单位" and FR-UI-5 defines it, but the cross-reference is implicit. A `(见 FR-UI-5)` after "时间单位" in FR-SIM-1 would help. Minor.

## Shape fit — strong

This is a consumer/educational product with meaningful UX — UJs with named protagonists are load-bearing and present. The PRD uses the BMAD chain-PRD shape (PRD + addendum) which is appropriate for the scope. UJ density is appropriate (each persona has a distinct use case tied to features). The addendum serves its purpose well: it offloads engineering detail without cluttering the product decisions. The PRD is not over-formalized — no excessive UJ count, no unnecessary sections.

### Findings
- **[low]** The "技术架构概览" (§七) duplicates addendum content. It's labeled as "摘录自 Idea 文件" and "供架构阶段参考" so it's defensible, but a reader might wonder why it's in the PRD rather than the addendum. Minor redundancy.

## Mechanical notes

- **Glossary drift**: The 7 math constraints are consistently named across §2.2, addendum §2, and the addendum table. "NaN 熔断保护" / "NaN 熔断" / "数值溢出熔断" are used interchangeably (FR-SIM-6 vs §2.2 vs §6.1) — minor, but standardize to one name.
- **ID continuity**: All FR IDs are contiguous (FR-CANVAS-1-4, FR-ELEM-1-4, FR-SIM-1-7, FR-SIM-VIZ-1, FR-COLLAB-1-6, FR-BOARD-1-3, FR-HISTORY-1, FR-UI-1-5, FR-GAME-1-3). No gaps, no duplicates. Good.
- **Cross-references**: FR-SIM-7 correctly cross-refs FR-COLLAB-1, FR-ELEM-3, FR-SIM-1. FR-SIM-4 cross-refs addendum §2. FR-COLLAB-6 cross-refs addendum §8. All resolve. addendum §7.3 cross-refs §7.4, §7.5 — all resolve.
- **Assumptions Index roundtrip**: Three `[假设]` tags in §六, all present. No inline `[ASSUMPTION]` tags elsewhere. Indexing is centralized rather than roundtripped — acceptable for this PRD's chain-PRD context.
- **UJ protagonist naming**: Personas in §1.3 have named protagonists (学生, 教育工作者, 系统思考者, 爱好者). Each persona's use case is tied to specific FRs (e.g., 学生 → 游戏化徽章/FR-GAME-2, 教育工作者 → 量纲校验/FR-SIM-7). No floating UJs.
- **Required sections**: Product overview, problem statement, user personas, success metrics (with anti-metrics), functional requirements, non-functional requirements, MVP scope, open questions & assumptions, technical architecture — all present. Addendum covers engineering depth, rejected alternatives, roadmap, and risk disclosures.
