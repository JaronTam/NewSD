# Reviewer Gate 启动包

- **用途**:在新对话中粘贴本文档即可启动审稿闸
- **PRD workspace**:`C:\Two\NewSD\_bmad-output\planning-artifacts\prds\prd-NewSD-2026-06-26\`
- **待审文件**:`prd.md`(主)、`addendum.md`(溢出)、`.memlog.md`(决策链)、`session-report-2026-06-27.md`(本轮动作账)
- ** stakes**:launch 级(教育工具但含专业数值子系统)
- **菜单**:rubric walker(默认)+ 5 个 ad-hoc reviewer(本 PRD 关切域)
- **执行**:5+1 个 reviewer 并行子代理,各写 `review-{slug}.md`,只回紧凑摘要

---

## 调度指令(粘贴给主代理)

```
启动 Reviewer Gate。读取下列 6 个 reviewer prompt,以并行子代理调度,每个写 review-{slug}.md 到 workspace 并只回紧凑摘要(整体判定+维度判定+各严重度计数+文件路径)。全部回收后做 synthesis:填 validation-report.html 骨架(.claude/skills/bmad-prd/assets/validation-report-template.html)+ 写 validation-report.md 双生(按严重度分组)+ 开浏览器。grade 规则见 references/validate.md。

workspace = C:\Two\NewSD\_bmad-output\planning-artifacts\prds\prd-NewSD-2026-06-26\
待审 = prd.md + addendum.md(.memlog.md / session-report 为辅证)
```

---

## R0 — Rubric Walker(质量基准,默认入口)

```
你是 PRD 质量审稿员。先读 rubric:C:\Two\NewSD\.claude\skills\bmad-prd\assets\prd-validation-checklist.md,再读 prd.md + addendum.md。对七个维度逐一判定 strong/adequate/thin/broken,只在能增加信息处写 findings。引用具体位置、引述原句、点明缺失。severity 衡量对 PRD 有用性的影响而非修复难度。

本 PRD 背景(校准用):系统动力学 ASCII 模拟器;MVP 含隐式求解器+量纲校验+结构化 AST CRDT+语义合并+sparkline+游戏化徽章;四项重决策(①③⑤)叠加致 MVP 体量偏重,addendum §7.3/§8.3 已四次记录体量警示,减负杠杆 ⑤>③>①。重点关注:决策是否真决策非"权衡";开放问题是否真开放;体量警示是否诚实而非平滑;NFR 是否有产品级阈值非样板。

输出到 review-rubric.md,格式严格遵 rubric 文件"Output format"节。只回紧凑摘要。
```

---

## R1 — 数值子系统 reviewer

```
你是数值分析与 SD 求解器专家,审 prd.md 的 FR-SIM-* 与 addendum §7/§2 的数值一致性。
核查点(逐条核对,不通过即 finding):
1. FR-SIM-1 隐式法(后向欧拉/BDF)+牛顿+LU+autodiff 雅可比:各组件是否自洽?BDF 隐指多步,需历史步,PRD 是否说明起步(后向欧拉单步起步)?
2. FR-SIM-3「单收敛值」与隐式牛顿迭代内多次求值:重定义是否消解守恒冲突?雅可比在迭代中是否一致更新?
3. FR-SIM-4 非负钳制=带约束非线性求解(投影/活动集):与牛顿迭代叠加的活动约束方程结构变化是否被 FR-SIM-1 雅可比更新策略覆盖?
4. FR-SIM-2 严格剪边 vs 隐式可解代数环:剪边后判环逻辑是否与联立求解语义一致(FR-SIM-2 L202 已改)?
5. FR-SIM-6 相对量级阈值(max(初值)×1e6 / NaN-Inf / 相邻步相对变化>1e3):ε 防除零是否定义?阈值对刚性系统合法解(指数增长)的误熔断风险?
6. DELAY 展开为串联隐式存量(FR-SIM-5):纳入联立求解后方程规模膨胀是否有界?
7. 1.4 性能指标「100 存量≥100步/秒」:隐式法每步 k×LU(O(n³)),n=100 实测可达性,flop 量级是否被高估或低估?
8. 三 AST 统一(FR-SIM-7 N7 修正):autodiff/量纲/CRDT 共享一棵 AST,雅可比生成是否依赖该 AST 结构稳定?

判定每条 pass/fail/risk,写 review-numerical.md。只回紧凑摘要。
```

---

## R2 — 协作 CRDT reviewer

```
你是 CRDT 与实时协作编辑器专家,审 FR-COLLAB-1/2/3/4/6 与 addendum §8。
核查点:
1. FR-COLLAB-1 formula 以结构化 AST(Y.Map 嵌套)存:Y.Map 嵌套表达运算符/操作数/引用节点,并发编辑不同子节点的合并语义是否真的无冲突?Y.Map 对键级并发安全,但 AST 重构(如插入括号改变结合性)是否触发结构性冲突?
2. FR-COLLAB-6 AST↔文本双向同步:不完整语法待定节点承载——CRDT 端待定节点是否污染量纲校验(FR-SIM-7)与 autodiff?待定节点的合并行为?
3. FR-COLLAB-3 迁移从服务端快照恢复无 t=0 回滚:快照(FR-COLLAB-5)与 CRDT 文档状态一致性——快照是 sim-state 仅,CRDT 独立持久化,迁移后两者时序对齐?
4. FR-COLLAB-4 整步收敛值广播(stockId<string>):≤30Hz 节流与牛顿迭代收敛时间的关系——刚性系统单步收敛慢时广播频率是否退化?
5. FR-COLLAB-5 房间快照会话级:房主迁移瞬间其他客户端状态连续性?
6. ⑤ 减负杠杆(降级 C→A)的可逆性:结构化 AST 改回扁平字符串的回滚成本?

写 review-collab.md。只回紧凑摘要。
```

---

## R3 — 安全 reviewer

```
你是应用安全审稿员,审 prd.md 4.3 节、FR-BOARD-1/2、FR-COLLAB-*、addendum 相关安全措辞。
核查点:
1. 4.3 WebSocket Origin 校验:Origin 头可被恶意客户端伪造吗?Origin 仅防浏览器跨站,非防恶意客户端——PRD 是否如实定位而非过度承诺?
2. FR-BOARD-2 CRC32=完整性+结构白名单校验(UUIDv4/from-to 引用合法性/无未知字段):白名单是否覆盖所有图元字段?粘贴通道不经 eval 的承诺是否可验证?
3. 匿名协作(10 人):无身份认证下,恶意客户端伪造 stockId/CRDT ops 的防御?Yjs CRDT 对恶意 op 的容忍边界?
4. 服务端 SQLite:SQL 注入面(操作日志追加式)+ 快照反序列化安全?
5. Wasm 求解器:用户构造恶意公式致 OOM/无限循环牛顿迭代的资源耗尽防御?FR-SIM-6 熔断是否覆盖时间维(单步超时)而非仅值维?
6. FR-COLLAB-4 stockId<string>:是否需服务端验证 stockId 属于本房间?

写 review-security.md。只回紧凑摘要。
```

---

## R4 — 教育定位 / 体量张力 reviewer

```
你是产品定位审稿员,审 prd.md 1.x(目标/用户/价值)、5.x(MVP 范围)、addendum §7.3/§8.3 体量警示。
核心矛盾:「轻量匿名教育工具」定位 vs MVP 含隐式求解器+量纲+结构化 AST CRDT+语义合并(=协作版专业 SD 数值平台体量)。
核查点:
1. 定位段是否诚实反映体量?还是用"教育"措辞平滑了专业数值子系统的事实?
2. 目标用户(1.3)是否能驾驭隐式求解器/量纲校验?教育新手 vs 需刚性系统求解的高级用户的张力是否被命名?
3. 体量警示四次记录是否构成 R0 所说的"诚实 trade-off"?还是已成为例行免责声明?
4. 减负杠杆 ⑤>③>① 的优先级是否合理(⑤ 降级对教育价值损失最小?③ 隐式→固定 RK4 对刚性教学场景损失?)
5. 游戏化徽章(FR-GAME-2)与专业数值子系统的定位割裂:一个含 BDF 求解器的工具同时发"建模徽章"是否违和?
6. sparkline(FR-SIM-VIZ-1)作为 MVP 唯一结果呈现:对教育场景的量纲/单位教学是否充分?

写 review-fit.md。只回紧凑摘要。
```

---

## R5 — 范围/范围蔓延 reviewer

```
你是 MVP 范围守门员,审 prd.md 5.1/5.2、开放问题、[ASSUMPTION] 标记、addendum 全部"后续"项。
核查点:
1. 5.1 MVP includes(隐式+量纲+CRDT语义合并+sparkline+徽章):每项是否真为 MVP 不可少,还是决策惯性带入?逐项 challenge。
2. 5.2 MVP excludes 与 includes 是否真互补无重叠?
3. 四次体量警示+减负杠杆(⑤>③>①)已记但未启用:PRD 是否该在 5.x 显式标注"若架构阶段判定超载,按 ⑤>③>① 降级"作为内置逃生阀,而非只在 addendum?
4. 开放问题清单:每条是否真开放(无隐藏答案)?开放问题 4(挑战判定引擎 vs L3 复用)是否 phase-blocker?
5. addendum §3.2 路线图(PG/Redis/多节点)触发条件是否可观测可量化?
6. C3(CLD 后续)/C4(挑战关卡后续)的"后续"边界是否清晰到不回流 MVP?

写 review-scope.md。只回紧凑摘要。
```

---

## Synthesis 回收后动作(主代理执行)

1. 读 `review-rubric.md` + `review-numerical.md` + `review-collab.md` + `review-security.md` + `review-fit.md` + `review-scope.md`
2. 填 `validation-report.html`(骨架:`.claude/skills/bmad-prd/assets/validation-report-template.html`);grade 规则:Excellent=全 strong/adequate 无 high/critical · Good=≤1 thin 无 critical · Fair=多 thin 或任 high · Poor=任 broken 或任 critical
3. 写 `validation-report.md` 双生(按 severity 分组:critical→high→medium→low)
4. 开浏览器:`python -c "import webbrowser,pathlib; webbrowser.open(pathlib.Path(r'C:\Two\NewSD\_bmad-output\planning-artifacts\prds\prd-NewSD-2026-06-26\validation-report.html').resolve().as_uri())"`
5. 向用户分层呈报:一句 gate 判定 → critical/high 逐条 → medium/low 汇总("plus N more in {file}")

## 注意

- 全程 extract 不 ingest:reviewer 子代理读文件写文件,主代理只持摘要
- finding 处置四选一:autofix / discuss / defer to open items / ignore
- 本包不修改 PRD;修改在 findings 处置阶段按用户拍板进行
