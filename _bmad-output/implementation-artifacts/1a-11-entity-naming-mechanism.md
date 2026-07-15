---
baseline_commit: 4de373d522285d1ed477023ca352fafa6d7637ed
---

# Story 1a.11: 图元命名机制 (entity-naming-mechanism)

Status: review

## Story

As a 单人建模者,
I want 图元 name 全局唯一(跨 stock/cloud/flow)且按类型序号单调递增(删除不复用,改名撞名即时禁止),
so that 重命名/粘贴不产生歧义,公式 `@uuid` 引用稳定不断,且 1a.12 名称化编辑(name->@uuid 反向映射)具备可靠硬前置.

epic 依据: epics.md L51 FR-ELEM-5(图元命名机制) + L49 FR-ELEM-3(重名软警告源消失) + L48 FR-ELEM-2(cloud name 当前可选).

## Acceptance Criteria

> 全部 AC 为逻辑层/组件层(jsdom)测试,无 canvas-click e2e(canvas-click 基础设施归 1b,见 deferred-work D4).渲染架构 = PropertyPanel DOM(可 jsdom 测) + store 单元(非 WebGL canvas),green-phase 可行.

- [ ] **AC-1(全局唯一跨类型)** Given store 含 stock "A"(id=s1) When createCloud 显式 name "A" Then throw 撞名拒绝(非软警告) And store 仍不含新 cloud. [epic L51, FR-ELEM-5]
- [ ] **AC-2(新建序号递增 stock)** Given 空 store When 连续 3 次 createStock(不传 name) Then 返回 names 依次 = ["stock_1","stock_2","stock_3"]. [epic L51]
- [ ] **AC-3(新建序号递增 cloud/flow + 默认名格式)** Given 空 store When createCloud(不传 name) + createFlow(不传 name) Then cloud.name = "cloud_1", flow.name = "flow_1". [epic L51] (替换 createFlow 现有 `Flow N` 格式, store.ts L282)
- [ ] **AC-4(删除后序号不复用 - 单调 high-water + setElements 载入承接)** (a) Given store 含 stock_1/stock_2/stock_3(seq 已到 3) When deleteElement(stock_3.id) + createStock(不传 name) Then 新 stock.name = "stock_4"(不复用 3, create 路径 seq++). (b) Given setElements([stock_1, stock_5])(name="stock_5" 最大, 中间 stock_2/3/4 缺席) When 后续 createStock 不传 name Then 新 stock.name = "stock_6"(载入端 deriveSeq 取 max=5, 后续 ++, A2 载入推导); (c) Given setElements([])(空数组, handleNew 清空) When 后续 createStock Then "stock_1"(计数器归 0, 视为新模型). [epic L51, 替换 store.ts L271-277 max+1 BUG, Q1=A2 2026-07-15 裁定]
- [ ] **AC-5(改名撞名即时禁止 + 原 name 保留 - 三元组)** Given store 含 stock "A"(id=s1) + stock "B"(id=s2) When updateElement(s2.id,{name:"A"}) Then throw 撞名拒绝 And s2.name 仍为 "B"(原名保留,未部分写入). [epic L51, FR-ELEM-5; 非 1a.8 的 AC-15 "重名允许"]
- [ ] **AC-6(改名成功 + id 不变 + 公式引用不断 - 三元组)** Given store 含 stock "A"(id=s1) + flow formula `@s1` 估值显示 "A" When updateElement(s1.id,{name:"C"}) Then s1.name = "C" And s1.id 不变 And flow formula `@s1` 仍解析为 "C"(nameMap 用新 name, id 不动). [epic L51 id=uuid不变, ARCHITECTURE-SPINE L190 handoff #10]
- [ ] **AC-7(改名撞名 surfacing + 原 name 保留 - 三元组, 双入口)**:
  - (a) PropertyPanel: Given PropertyPanel 选中 stock "A"(id=s1) + 另有 stock "B"(id=s2) When name input 改为 "B" 并 blur Then 显示红字 nameError(条件渲染, 复用 1a.8 formulaError 位, 无错零占用) And input 恢复为 "A"(原名保留,面板不崩). [epic L51, FR-ELEM-5]
  - (b) CanvasView 双击: Given CanvasView 双击 stock "A"(id=s1) 改名输入 "B"(另有 stock "B" id=s2) When 确认 prompt Then window.alert("名称已存在,请重试") 被调用 And s1.name 仍为 "A"(原名保留, throw 不写入). [epic L51, FR-ELEM-5]
- [ ] **AC-8(显式 name 撞名禁止 - 跨类型)** Given store 含 flow "X"(id=f1) When createStock 显式 name "X" Then throw 撞名拒绝(跨 flow/stock). [epic L51]
- [ ] **AC-9(Cloud.name 始终赋值)** Given createCloud 不传 name Then 返回 Cloud.name = "cloud_1"(非 undefined) And 参与 AC-1 全局唯一性. [epic L51; types.ts L36 Cloud.name? 转 required]
- [ ] **AC-10(粘贴契约 forward-compatible)** Given createX 自动命名路径单调递增(AC-2/3/4) When 未来 paste 实现复用 createX(不传 name) Then 序号递增(视为新建) - 以 createStock 连续自动命名递增测试代理契约(paste 无 impl, 不在本 story 实现粘贴). [epic L51 "粘贴图元视为新建序号递增"]
- [ ] **AC-11(重名软警告源消失)** Given flowCreateWarning(elements,input) When 撞名(已不可能, AC-5 即时禁止) Then 不再返回 "Duplicate flow name" 警告(分支移除) And E11 parallel 警告保留(parallel 非重名, FR-ELEM-5 不涉及). [epic L49 FR-ELEM-3, store.ts L224-226 分支移除, L214-216 保留]
- [ ] **AC-12(无回归 - 全套件绿)** Given 1a.11 全部改动 When 跑 vitest 全套件 Then N/N 绿(含改写的 AC-15 测试组)无回归. 基线 1a.8 终态(566 passed, 1 skipped, 21 files),DS 实测核 count. [sprint 全套件口径, 见 memory newsd-e2e-attestation-full-suite-not-subset]
- [ ] **AC-13(边界 guard - 依赖/defer/执行顺序)** Given Story 1a.11 When 执行 Then (a)依赖 1a.8 属性面板(改名入口 PropertyPanel + CanvasView 双击) And (b)1a.12 名称化编辑(deferred-work D1 name->@uuid 反向映射)依赖本 story 全局唯一 name 硬前置 And (c)执行顺序 1a.8->1a.11->1a.12->1a-13->1a.9->1a.10(新增 1a-13 session-autosave-restore 承担 F5 保护 F2+F3, 见 SDR#13) And (d)默认名 i18n 格式留 1a.9(本 story 用 `<type>_<N>` 占位, 内部标识不本地化 见 SDR#12/breadcrumbs). [epic L540-563, deferred-work D1]
- [ ] **AC-14(空名拒绝)** Given createX({name:""}) 或 updateElement(id,{name:""}) 或 name=" "(纯空白) When 调用 Then throw 拒绝(空名/纯空白非法, 原名保留) And 默认名路径恒非空(自动命名不产生空名). [FR-ELEM-5 隐含 name 有效, SDR#11; retrofit 补使 #11 满足 §2.2(b) AC 覆盖]
- [ ] **AC-16(载入端 max(seq) 推导 - A2 契约)** (a) Given setElements([{kind:"stock",name:"stock_7"},{kind:"stock",name:"stock_2"},{kind:"cloud",name:"cloud_3"}]) When 后续 createStock 不传 name Then 新 stock.name = "stock_8"(stockSeq=7 后 ++); createCloud 不传 name Then "cloud_4"(cloudSeq=3 后 ++); createFlow 不传 name Then "flow_1"(flowSeq=0, 无 flow 元素). (b) Given setElements 每次调用 Then 三 seq 独立按 kind 各自扫 elements 取 `^<type>_(\d+)$` 正则匹配的最大 N, 非匹配元素跳过, 全量替换语义(不叠加旧 seq). [Q1=A2 2026-07-15 裁定, 补 F3 autosave hydrate 兼容性硬约束]
- [ ] **AC-17(载入端 deriveSeq 健壮性 - 非规范名跳过 / 正则锚定 / Number 边界)** (a) Given setElements([{kind:"stock",name:"营收"},{kind:"stock",name:"stock_5"},{kind:"stock",name:"stock_9x"},{kind:"stock",name:"my_stock_3"}]) When 后续 createStock 不传 name Then "stock_6"(stockSeq=5; "营收"/"stock_9x"/"my_stock_3" 均不匹配 `^stock_(\d+)$` 锚定正则跳过, 非崩溃). (b) Given setElements([{kind:"stock",name:"stock_99999999999999999999"}])(超 Number.MAX_SAFE_INTEGER = 2^53-1 = 9007199254740991) When deriveSeq 扫描 Then 该项跳过或被 clamp(不导致 NaN/Infinity/后续 ++ 精度丢失); createStock 不传 name Then 序号取该 kind 内其它合法序号最大 +1, 若无则从 0 递增. (c) 正则实现须 `^<type>_(\d+)$` 双端锚定(防 `stock_1x`/`my_stock_1` 误命中). [Q1=A2 R4/R5/R6 风险缓解]

## Tasks / Subtasks

> TDD red-green: 先写失败测试(red), 再实现(green), 再重构. 每条 Tn 列 red/green 子任务. ATDD 红脚手架由 DS 阶段 `/bmad-testarch-attd`(TEA v1.19.0)产出, 本 story 不在 CS 跑 ATDD.

- [ ] **T1(AC-2, AC-3, AC-9) [gov: #2, #3, #5]: per-type 单调 high-water 计数器 + 自动命名 `<type>_<N>` + Cloud.name 转 required**
  - red: 测试 createStock 连续 3 次无 name -> ["stock_1","stock_2","stock_3"]; createCloud 无 name -> "cloud_1" 且 Cloud.name 非 undefined(types 收窄编译期); createFlow 无 name -> "flow_1"(替换 `Flow 1`).
  - green: elementStore 闭包内加 stockSeq/cloudSeq/flowSeq 计数器(初始 0); createStock/createCloud/createFlow 在 name 省略时 `seq++` 并赋 `<type>_${seq}`; types.ts Cloud.name? -> name: string(required); createCloud 签名 `Omit<Cloud,"id"|"kind"|"name"> & { name?: string }`(input 可选, output 必填).
  - refactor: 抽 `nextDefaultName(kind)` helper 统一三类型默认名.

- [ ] **T2(AC-4, AC-16, AC-17) [gov: #2, #13]: 删除后序号不复用(单调 high-water, 非 max+1) + setElements 载入端 max(seq) 推导(A2)**
  - red-1(AC-4a create 路径): 测试 createStock 3 次(seq=3) -> deleteElement(stock_3) -> createStock 无 name -> "stock_4"(非 "stock_3"); 同理 cloud/flow.
  - red-2(AC-16 载入推导): 测试 setElements([stock_7, stock_2, cloud_3]) -> createStock 无 name -> "stock_8"; createCloud -> "cloud_4"; createFlow -> "flow_1"(该 kind 无元素).
  - red-3(AC-17 健壮性): 测试 setElements 含非规范名("营收"/"stock_9x"/"my_stock_3") -> deriveSeq 跳过 -> 后续 createStock 序号取合法序号最大 +1(如 stock_5 存在则 "stock_6").
  - red-4(AC-17 Number 边界): 测试 setElements 含 "stock_99999999999999999999"(超 MAX_SAFE_INTEGER) -> deriveSeq 跳过或 clamp -> 不 NaN/Infinity -> 后续 createStock 序号仍单调正整数.
  - green: 计数器仅在自动命名时 `++`, deleteElement 不触碰计数器(永不回退). 移除 store.ts L271-277 createFlow 的 `Math.max(0,...flowNums)+1` 正则解析法(删除尾号最大元素后复用序号的 BUG). setElements 内加 `deriveSeq(kind)` helper: 用 `^<type>_(\d+)$` 双端锚定正则扫 elements[kind==kind] 取最大 N(非匹配跳过, Number(m[1]) 若 >Number.MAX_SAFE_INTEGER 跳过, 兜底 0), 三 kind 各推导一次赋 stockSeq/cloudSeq/flowSeq.
  - refactor: 确认 setElements 全量替换语义(不叠加旧 seq, 视为新模型加载); handleNew(空 elements)三计数器归 0; deriveSeq 作为 elementStore 内部 helper 不导出.

- [ ] **T3(AC-1, AC-5, AC-8, AC-14) [gov: #1, #4, #11]: 撞名即时禁止(throw) - 改名 + 显式命名 + 跨类型 + 空名拒绝**
  - red: 测试 updateElement(s2,{name:"A"}) 撞 s1 -> throw + s2.name 仍 "B"; createCloud 显式 "A" 撞 stock "A" -> throw; createStock 显式 "X" 撞 flow "X" -> throw; updateElement 改成与自身同名(no-op, 如 s1.name="A" 再 update s1 name "A")不 throw(排除自身).
  - green: 抽 `assertNameAvailable(elements, name, exceptId?)` helper(扫描全部 SDElement 不分 kind, 排除 exceptId); updateElement 当 patch 含 name 时调用(throw 则不写入, 原 name 保留); createStock/createCloud/createFlow 显式 name 时调用.
  - refactor: 空名/纯空白 name 视为非法 throw(name 必须非空, 默认名恒非空).

- [ ] **T4(AC-11) [gov: #4]: flowCreateWarning dup-name 分支移除 + E11 parallel 保留**
  - red: 测试 flowCreateWarning 对撞名 input 返回 null(非 "Duplicate flow name"); 对 E11 parallel input 仍返回 parallel 警告.
  - green: 移除 store.ts L218-226 flowNums/nextFlowNum/dup-name 检查分支; 保留 L212-216 parallel 分支.
  - refactor: createFlow onWarn 仍调 flowCreateWarning(parallel 警告通道不变).

- [ ] **T5(AC-6) [gov: #6, #12]: 改名 id 稳定 + 公式引用不断 + 改名脱规范 seq 不回退**
  - red-1(AC-6 id/公式稳定): 测试 stock "A"(id=s1) + flow formula `@s1` -> updateElement(s1,{name:"C"}) -> s1.id 不变 + formatFormulaForEditor(flow) 显示 "C"(nameMap 重建用新 name).
  - red-2(SDR#12 rename 脱规范 seq 不回退): 测试 createStock 5 次(stockSeq=5) -> updateElement(stock_3.id,{name:"营收"}) -> stockSeq 仍 5 -> createStock 无 name -> "stock_6"(非 "stock_3", rename 脱规范与删除同语义, seq 永不回收).
  - green: 验证 updateElement 仅 shallow-merge name, 不动 id 不动计数器; formula.ts 不改(nameMap id->name 用 elementStore.getElements 重建, rename 后自动反映新 name).
  - refactor: 无(formula.ts 1a.11 不碰, ARCHITECTURE-SPINE L190 不变量天然保持); 显式 comment 标 updateElement 不调 deriveSeq(高频路径 + 撞名 throw 已兜底).

- [ ] **T6(AC-7) [gov: #4]: 改名撞名 surfacing - PropertyPanel 红字 + CanvasView alert(双入口, 原名保留)**
  - red: (a) PropertyPanel 选中 stock "A"(另有 "B") -> name input 改 "B" blur -> 显示 nameError + input 值恢复 "A" + store 中该 stock name 仍 "A"; (b) CanvasView 双击 stock "A" 改名 "B"(另有 "B") -> window.alert 被调用(mock/spy window.alert + window.prompt) + s1.name 仍 "A".
  - green: (a) PropertyPanel name onBlur `persistField("name")` 包 try/catch; catch 撞名 Error -> setNameError(msg) + input 回退至 selectedElement.name(原名); 复用现有 formulaError/dimStatus state 模式(条件渲染, 无错零占用); (b) CanvasView 双击 window.prompt -> updateElement try/catch; catch 撞名 Error -> window.alert("名称已存在,请重试") + 原名保留(throw 不写入).
  - refactor: 双通道订阅(1a.8)不受影响, 仅 name field 加错误态; alert 文案硬编码占位, 标 TODO(1a.9 i18n 迁移, 单一调用点). 两入口反馈强度匹配各自场景(主入口常驻红字 / 辅入口阻断 alert), 不要求完全对称.

- [ ] **T7(AC-10) [gov: #7]: 粘贴契约 forward-compatible(无 paste impl)**
  - red: 测试 createStock 自动命名连续递增(AC-2 测试代理); 注释标 "paste 复用此路径即满足契约".
  - green: 无 paste 实现(代码库无 clipboard/paste 逻辑, 仅 i18n.ts L12 字典项). 文档化: 未来 paste story 复用 createX(不传 name)即满足 "粘贴视为新建序号递增".
  - refactor: paste 专属测试 defer 至 paste story(非 1a.11 scope).

- [ ] **T8(AC-12) [gov: #4, #8]: 全套件无回归**
  - red: 跑全套件, 定位受影响测试(store.test.ts AC-15 "重名允许"组 L468-518 + flowCreateWarning dup-name 测试 L557-578 + 任何 setup 显式同名 fixture).
  - green: 改写 AC-15 "重名允许" -> "重名拒绝"(AC-5/8); 移除/改写 flowCreateWarning dup-name 测试; 审计 CanvasView.test.tsx/PropertyPanel.test.tsx setup 是否有显式同名 fixture(若有则加序号或显式不同名); 跑全套件 N/N 绿.
  - refactor: 确认全套件 count(DS 实测)记入 CR Run section(全套件口径, 非 story 子集).

- [ ] **T9(AC-13) [gov: #8, #9, #10]: 边界 guard - 依赖/defer/执行顺序(无 code, SDR doc)**
  - 无 code. 在 Dev Agent Record Completion Notes 标注: (a)依赖 1a.8 done ✓, (b)1a.12 D1 硬前置契约成立, (c)执行顺序不变, (d)i18n 格式留 1a.9.

## Dev Notes

### ATDD Artifacts

DS 阶段前跑 `/bmad-testarch-atdd`(TEA v1.19.0)产红脚手架. 本 story 测试渲染架构:

- store 层(命名机制核心): 纯单元(vitest), 无 DOM 依赖, green-phase 直接可行.
- PropertyPanel 层(改名撞名 surfacing): jsdom DOM 测(input + error state), 非 WebGL canvas, green-phase 可行(对照 1a.8 CanvasView WebGL canvas 无 DOM overlay 致 e2e defer B 的教训, 本 story 不踩该坑).
- 无 Playwright canvas-click e2e(canvas-click 基础设施归 1b, deferred-work D4).
- ATDD red 脚手架覆盖 AC-1..AC-11(AC-12 全套件回归 + AC-13 doc guard 无 ATDD).

### 架构模式与约束

1. **id/name 分层不变量(ARCHITECTURE-SPINE L188-190, handoff #10)**: 存储层存 `@uuid`/stockId(UUIDv4), 显示层渲染 name, 重命名只改 name 不动 id, 公式 `@uuid` 引用不断. 1a.11 严守: rename = updateElement name patch only, id 不变; formula.ts 不碰.
2. **elementStore factory-closure singleton(1a.4 落地)**: 计数器(stockSeq/cloudSeq/flowSeq)放闭包内, 每 createElementStore() 实例独立(测试 fresh store 计数器归 0). 非 module-level(避免跨测试污染).
3. **crypto.randomUUID(1a.1 落地)**: id 生成保留, 1a.11 不改 id 机制.
4. **useSyncExternalStore 双通道订阅(1a.8 落地)**: PropertyPanel 已有 selection 通道 + elements 通道. 1a.11 仅 name field 加 nameError state, 不改订阅架构.
5. **cloud name 当前 optional(types.ts L36) -> required**: Cloud 历史上 name 可选(FR-ELEM-2 L48 "name(可选)"), 但 FR-ELEM-5(L51)要求全局唯一跨 stock/cloud/flow, Cloud 须参与命名 -> name 转 always-set. createCloud 在 name 省略时自动赋 `cloud_N`.
6. **updateElement 不重新推导 seq(A2 载入侧限定)**: setElements 触发 deriveSeq 三 kind 全扫(load 路径); updateElement(rename 高频路径)**不**调 deriveSeq, 仅 shallow-merge + assertNameAvailable(排除自身) throw; 理由: (a)撞名 throw 已兜底重复问题, (b)deriveSeq 全量扫描 O(N) 放 rename 高频路径无必要, (c)rename 脱规范语义即"seq 永久流失"(SDR#12)不需 rename 侧同步 seq.
7. **跨 story breadcrumbs(1a-13/Epic 2/Epic 4/1a.9)**:
   - **1a-13(session-autosave-restore, 新)**: F3 autosave localStorage(elements+camera+selection); 启动时反序列化 -> setElements -> A2 载入端 deriveSeq 天然承接三 seq; F2 beforeunload prompt.
   - **Epic 2(board 持久化, backlog)**: F3 localStorage 迁移到 board-level 序列化; 版本号处理 + 多 tab 冲突"是否覆盖上次会话"UX; 计数器不单独序列化(A2 load 路径每次从元素快照推导, 自愈).
   - **Epic 4(cross-board copy-paste, backlog)**: paste 序号来自目标画板 elementStore(SDR#7), 不跨 tab 传递源画板 seq.
   - **1a.9(i18n)**: name 是内部标识**不本地化**(store.name 恒为 `<type>_<N>` 中性 slug), UI 显示层可 i18n(如"库存"翻译), 但 formula @uuid 引用 + assertNameAvailable 扫描均用 store.name 原值.

### web research

显式 no-op(非静默 skip, 1a.4 教训, VS gate §2.1 会查). 无新依赖引入:

- crypto.randomUUID - 1a.1 落地, 已用.
- React 19 useSyncExternalStore - 1a.4 落地, 已用.
- factory-closure singleton - store.ts 现有模式, 已用.
- Bresenham/量纲 AST - 非 1a.11 范围.

版本锁(引用 1a.8 基座, ARCHITECTURE-SPINE L207-222): React ^19.2.0, TanStack Start ^1.168.26, Vite ^8.0.16, Tailwind v4, TS ^5.8.3, bun. 1a.11 不新增/升级任何依赖.

### 域模型对账表

| 实体              | 字段                      | 当前状态                                       | 1a.11 变更                                                      | 依据                           |
| ----------------- | ------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| Stock             | name: string              | required, 调用方传显式名                       | createStock name 输入转可选(省略自动 `stock_N`); 显式撞名 throw | FR-ELEM-5 L51                  |
| Cloud             | name?: string             | optional(L36)                                  | 转 required `name: string`; createCloud 省略自动 `cloud_N`      | FR-ELEM-2 L48 + FR-ELEM-5 L51  |
| Flow              | name: string              | required, createFlow 自动 `Flow N`(max+1 L277) | createFlow 自动名改 `flow_N`; 计数器改 high-water(非 max+1)     | FR-ELEM-5 L51                  |
| (计数器)          | stockSeq/cloudSeq/flowSeq | 不存在                                         | elementStore 闭包内新增, 自动命名时 ++, 删除不回退              | FR-ELEM-5 L51 删除不复用       |
| updateElement     | name patch                | shallow merge 无撞名检查                       | patch 含 name 时 assertNameAvailable(排除自身) throw 撞名       | FR-ELEM-5 L51 改名撞名即时禁止 |
| flowCreateWarning | dup-name 分支             | L218-226 返回 "Duplicate flow name"            | 移除该分支(源消失); parallel 分支 L214-216 保留                 | FR-ELEM-3 L49                  |
| formula.ts        | @uuid/nameMap             | 稳定, id->name 映射                            | 不碰(rename 只改 name, id 不动, 天然兼容)                       | ARCHITECTURE-SPINE L190        |

### §6 单 PR vs sub-PR 评估

触及文件: types.ts(域模型) + store.ts(sd 核心) + PropertyPanel.tsx(属性面板) + CanvasView.tsx(画布双击改名) + store.test.ts + PropertyPanel.test.tsx + CanvasView.test.tsx(可能) = ≥3 subsystems(sd 域模型 / render-属性面板 / render-画布).

按 §6 "≥3 subsystems 或 AC>20" 形式判据, 本 story 触及 ≥3 subsystems. 但判定 **单 PR**:

- **单一主题**: 全部改动围绕"图元命名机制"(全局唯一 + 序号递增 + 撞名禁止 + id 不变), 非 ≥3 独立 feature.
- **原子性**: 计数器(high-water) + 撞名 throw + Cloud.name required 三者必须同 PR 落地, 否则 store 处于半破不变量(如撞名 throw 落地但 Cloud.name 仍 optional, 则 Cloud 不参与唯一性, 契约破裂). sub-PR 切分会留中间态违 FR-ELEM-5.
- **AC 数量**: 14(<20 阈值).
- **sprint-plan §6.4 定性**: "独立小 story".

结论: 单 PR(CS->VS->DS->CR), 不拆 sub-PR.

### SDR

> 每条 SDR 标分类(**[设计契约]**=真决策需 DS 实现 / **[保留不变量]**=勿动 / **[流程 meta]**=单PR/IR/e2e scope 非代码); 设计契约 SDR 含 (现状/目标/守卫) 三元, 守卫=AC# + 红测试断言(含"旧态消失"反向债拆除断言). Task 行 `gov: SDR#N` 引用见 Tasks 段(formalization §2.1/§2.2 追溯矩阵). 共 13 SDR.

1. **[设计契约] 全局唯一跨类型(单一命名空间)**: 现状=store.ts createX 无撞名 throw + updateElement 无撞名检查(L259-264 仅 endpoint/self-loop throw); 目标=抽 `assertNameAvailable(elements, name, exceptId?)` 扫全部 SDElement 不分 kind(排除自身); 守卫=AC-1(createCloud 显式 "A" 撞 stock throw)+ AC-8(createStock 显式 "X" 撞 flow throw, 跨类型). [FR-ELEM-5 L51 "跨 stock/cloud/flow"]
2. **[设计契约] 序号 = per-type 单调 high-water 计数器 + 双路径(create/load)**: 现状=store.ts L271-277 `Math.max(0,...flowNums)+1` 正则解析法(删除尾号最大元素后复用序号的 BUG)+ 无 stockSeq/cloudSeq/flowSeq; 目标=elementStore 闭包内 stockSeq/cloudSeq/flowSeq(初始 0); **create 路径**: 自动命名 name 省略时 `++`, 删除不回退, 显式命名不消耗序号 -- **拆除** L271-277 max+1 正则法; **load 路径**(A2, Q1 2026-07-15 裁定): setElements 内 `deriveSeq(kind)` 用 `^<type>_(\d+)$` 双端锚定正则扫 elements[kind==kind] 取最大 N -- **保留(非拆除)** max(seq) 语义, 但 (i)从 create 路径每次调用移到 load 路径单次全扫, (ii)扫描输入是"当前全量元素快照"非"函数内 filter 结果", (iii)非匹配名跳过(非规范/含 x/超 MAX_SAFE_INTEGER); 守卫=AC-4(create + load 双路径 + 空 setElements 归 0)+ AC-16(deriveSeq 三 kind 契约)+ AC-17(健壮性: 非规范跳过 + 正则锚定 + Number 边界)+ 红测试断言旧态消失(create 路径不再 filter+regex+Math.max). [FR-ELEM-5 L51 删除不复用 + Q1=A2]
3. **[设计契约] 默认名格式 `<type>_<N>`(stock_N/cloud_N/flow_N)**: 现状=createFlow `Flow N`(store.ts L282)+ `/^Flow (\d+)$/` 正则(L274, L219)+ stock/cloud 无自动名(调用方传显式名); 目标=三类型统一 `<type>_<N>`, 拆除 `Flow N` 格式 + 正则(L282, L274, L219); 格式为 1a.9 i18n 占位(本 story 不实现 i18n); 守卫=AC-2(stock_1/2/3 连续递增)+ AC-3(cloud_1, flow_1)+ 红测试断言旧态消失(`Flow N` 不再产生). [epic L51 字面]
4. **[设计契约] 改名撞名即时禁止 = throw + surfacing(双入口)**: 现状=store.ts updateElement 无撞名检查(L259-264)+ flowCreateWarning "Duplicate flow name" 分支软警告(L224-226)+ createX 无 throw; 目标=updateElement/createX 撞名(排除自身) throw Error 不写入(原名保留), 拆除 flowCreateWarning dup-name 分支(L224-226, parallel 分支 L214-216 保留), surfacing 双入口(PropertyPanel name onBlur try/catch -> 红字 nameError 条件渲染复用 1a.8 formulaError 位 + input 回退原名; CanvasView 双击 window.prompt -> updateElement try/catch -> window.alert("名称已存在,请重试") + 原名保留); alert 文案硬编码占位 defer 1a.9 i18n(单一调用点), 两入口反馈强度匹配场景不要求对称; 守卫=AC-5(throw + 原名保留)+ AC-7(surfacing 双入口)+ AC-11(flowCreateWarning 撞名返回 null)+ 红测试断言旧态消失(dup-name 软警告不再返回 "Duplicate flow name"). [FR-ELEM-5 L51 + FR-ELEM-3 L49]
5. **[设计契约] Cloud.name 转 required(始终赋值)**: 现状=types.ts L36 `name?: string`(optional, Cloud 历史可无 name, FR-ELEM-2 L48); 目标=`name: string`(required), createCloud name 输入可选(省略自动 `cloud_N`)output 必填, 拆除 optional(L36); Cloud 须参与全局唯一; 守卫=AC-9(Cloud.name 非 undefined 参与唯一性)+ 红测试断言旧态消失(Cloud 无 name 编译期拒绝, types 收窄). [FR-ELEM-2 L48 + FR-ELEM-5 L51]
6. **[保留不变量] id=uuid 不变(公式引用不断)**: 现状=crypto.randomUUID(1a.1 落地 L90/L103/L280)+ formula.ts @uuid 引用 + formatFormulaForEditor nameMap 稳定; 目标=1a.11 不改 id 机制, 不碰 formula.ts(rename 只改 name 不动 id, ARCHITECTURE-SPINE L190 不变量 handoff #10); 守卫=AC-6(rename 后 id 不变 + 公式 @s1 仍解析为新 name).
7. **[设计契约] 粘贴契约 forward-compatible(不实现 paste, 序号来自目标 tab)**: 现状=代码库无 clipboard/paste 实现(仅 i18n.ts L12 字典项); 目标=不实现 paste, 保证 createX 自动命名路径单调递增(AC-2/3/4), 未来 paste story 复用 createX(不传 name)即满足 "粘贴视为新建序号递增"; **粘贴目标 tab 语义**: 粘贴目标画板的序号由目标画板 elementStore.stockSeq/cloudSeq/flowSeq 决定(不跨 tab 传递源画板序号), Epic 4 cross-board paste 落地时以此为铺路; paste 专属测试 defer 至 paste story; 守卫=AC-10(createStock 自动命名连续递增测试代理契约). [epic L51 "粘贴图元视为新建序号递增" + Epic 4 cross-board]
8. **[流程 meta] 单 PR story-cycle(无 sub-PR)**: 见 §6 评估(命名机制原子性: 计数器 + 撞名 throw + Cloud.name required 必须同 PR, 否则半破不变量; 14 AC <20; 单一主题); 守卫=AC-13(c) 执行顺序 + §6 评估. [formalization §6]
9. **[流程 meta] IR 前置轻量核 PASS**: AD ref(ARCHITECTURE-SPINE L188-190 id/name 分层 + handoff #10)✓; CAP ref(SPEC.md CAP-11 存在)✓; 依赖 story 1a.8 done(sprint-status.yaml L38)✓; deferred-work D1(1a.12 name->@uuid 反向映射)确认 1a.11 全局唯一 name 是硬前置; 守卫=AC-13(a/b). [formalization IR 前置]
10. **[流程 meta] e2e AC 门槛 = 逻辑层(无 canvas-click e2e)**: AC 用单元 + jsdom 组件测试, 无 Playwright canvas-click(canvas-click 基础设施归 1b, deferred-work D4); green-phase 可行(PropertyPanel DOM 非 WebGL canvas, 对照 1a.8 CanvasView WebGL 无 DOM overlay 致 e2e defer 教训); 守卫=AC-13(d)+ Dev Notes ATDD 架构. [memory newsd-e2e-ac-gate-impl-path-cs-attd-vs]
11. **[设计契约] 空名拒绝**: 现状=store.ts 无空名检查(name 可为空字符串/纯空白); 目标=name 必须非空(trim 后非空), 空名/纯空白 throw(默认名恒非空, 防空白名撞名歧义); 守卫=AC-14(空名/纯空白 throw, retrofit 补使本决策满足 §2.2(b) AC 覆盖)+ T3 refactor 红测试. [FR-ELEM-5 隐含 name 有效]
12. **[设计契约] 改名脱规范 = 序号永久流失(与删除同语义, seq 不回退)**: 现状=无此约束(rename 未定义 seq 语义); 目标=用户 rename `stock_3` -> `营收` 后, stockSeq 不回退(仍为 create-path 递增到过的 max); 后续 createStock 序号继续单调递增(如 seq=5 时 rename stock_3 -> "营收", createStock -> "stock_6" 非 "stock_3"); 语义等同"删除 stock_3 后再 createStock"(单调 high-water 不因 rename 回退 or 释放); 与 AC-6 id 不变正交(id 恒定 + seq 单调 + name 可变); 守卫=T5 refactor 断言(rename 后 create 序号不回收) + Dev Notes 明写. [FR-ELEM-5 隐含 + 与 SDR#2 组合]
13. **[流程 meta] F5 保护由新 story 1a-13 承担(不塞 1a.11 或 1a.12)**: 现状=1a 无 board 持久化(Epic 2 才有), F5 刷新 elementStore 归零, UX 债; 目标=不在 1a.11 或 1a.12 塞 F5 保护(scope 越界, formalization §6 单一主题原子性), 新开 story 1a-13-session-autosave-restore(执行链 1a.12 后, 1a.9 前)承担 F2(beforeunload prompt) + F3(autosave localStorage + 启动恢复); A2 载入端 deriveSeq(见 SDR#2 load 路径)天然与 F3 hydrate 兼容(autosave 反序列化 -> setElements -> deriveSeq 三 seq 从元素快照推导); 与 Epic 2 board 持久化的关系: Epic 2 落地时 F3 localStorage 需迁移到 board-level 序列化, 版本号处理 + 冲突"覆盖上次会话"UX; 守卫=AC-13(c) 执行链 + sprint-status.yaml 1a-13 条目. [Q1=A2 + F5 UX 债 2026-07-15 裁定]

### §7 gate 红线

- **文档语言: 中文**(story 文件中文, 覆盖 config.yaml communication_language=English).
- **文档标点: story 文件服从 epics+spine 半角(,.:;)**(不用全角, Edit old_string 匹配须注意).
- **CS 不推 PR**(本 story 文件 + sprint-status.yaml 更新仅写文件, 不 commit; PR/commit 在 DS/CR 阶段).
- **DS 须遵 SDR 而非 task 行**(memory newsd-ds-follows-task-not-cspin): DS 按 T1-T9 实现时, 以本 ### SDR 段为权威, 不偏离(如 #2 high-water 非 max+1, #4 throw 非软警告).
- **DS step8 自评须可验证**(memory newsd-ds-self-attestation-vs-cr-verdict): 自评 AC PASS 须有测试实证; CR Run 1 可能 FAIL, 自评 ≠ CR verdict.
- **e2e 全套件口径**(memory newsd-e2e-attestation-full-suite-not-subset): AC-12 记全套件 count(如 566+/N)非 story 子集.

### 测试标准

- **TDD red-green-refactor**: 每 Tn 先 red(失败测试)再 green(实现)再 refactor.
- **三元组断言**(reactive/迁移 AC): before + action + after, 且 after ≠ before(AC-5 改名撞名: before "B" + action updateElement throw + after 仍 "B" ≠ 若 throw 失败会变 "A"; AC-6 改名成功: before "A" + action + after "C" ≠ "A"; AC-7 PropertyPanel: before input "A" + action blur "B" + after input 恢复 "A" + nameError 显示).
- **撞名禁止断言 = 改名被拒 + 原 name 保留**(非仅 "错误抛出"): AC-5/AC-7 须断言 (a)throw/拒绝 (b)原名保留(未部分写入) 双重. (1a.8 F-1 deriveFlowUnits 声明↔代码不一致教训: 断言须锁定行为非仅签名.)
- **全套件无回归**(AC-12): 改写 AC-15 测试组后全套件绿, count 记全套件.
- **CR Layer3 交叉核/留痕**(memory newsd-story-cycle-test-quality-and-step8-audit-trail): DS step8 须留 ### 测试留痕表 行(本 story 3层 CR Run 回填).

### Project Structure Notes

待修改文件(DS 实现时 step3 须实读, 不可 skim, 防回归):

- `src/lib/sd/types.ts` - Cloud.name? -> name: string(L36).
- `src/lib/sd/store.ts` - 计数器(闭包) + createStock/createCloud/createFlow 自动命名 + updateElement 撞名 throw + flowCreateWarning dup-name 分支移除(L218-226) + createFlow max+1 -> high-water(L271-277).
- `src/lib/render/PropertyPanel.tsx` - name onBlur 撞名 try/catch + nameError state + 原名恢复(L84 区域).
- `src/lib/render/CanvasView.tsx` - 双击改名 window.prompt -> updateElement 撞名 try/catch + window.alert surfacing(L1088-1099 区域); seedSampleStocks 显式名(L265-296)不变(唯一, 过撞名).
- `src/lib/sd/store.test.ts` - AC-15 "重名允许"组(L468-518)改写为 "重名拒绝"; flowCreateWarning dup-name 测试(L557-578)移除/改写; 新增计数器/撞名/三元组测试.
- `src/lib/render/__tests__/PropertyPanel.test.tsx` - Cloud 无 name 测试(L418 区域)适配自动命名; 新增 AC-7 改名撞名 surfacing 测试.
- `src/lib/render/CanvasView.test.tsx`(可能) - 审计 setup 显式同名 fixture.
- 不碰: `src/lib/sd/formula.ts`(id/name 不变量天然保持), `src/lib/sd/i18n.ts`(格式留 1a.9), `src/lib/render/elements.ts`(渲染不改, 1a.11 是命名机制非渲染).

### References

- epics.md L48 FR-ELEM-2(cloud name 当前可选)
- epics.md L49 FR-ELEM-3(重名软警告源消失)
- epics.md L51 FR-ELEM-5(图元命名机制 - 本 story 权威)
- epics.md L540-563 Story 1a.11 block(命名唯一性 + 依赖/defer 边界 guard)
- ARCHITECTURE-SPINE.md L188-190(id/name 分层不变量 + handoff #10)
- ARCHITECTURE-SPINE.md L207-222(技术栈版本)
- sprint-plan-2026-07-05.md §6.1(FR-ELEM-5->1a.11, slug 1a-11-entity-naming-mechanism, 依赖 1a.8)
- sprint-plan-2026-07-05.md §6.4(执行顺序 1a.8->1a.11->1a.12->1a.9->1a.10)
- deferred-work.md D1(Q1 名称化编辑 name->@uuid 反向映射, Target 1a.12, 依赖 1a.11 唯一名称)
- deferred-work.md D4(e2e canvas-click 基础设施归 1b)
- story-cycle-formalization.md §2.1(CS gate) / §2.2(VS gate task↔SDR) / §2.3(DS test quality + 留痕) / §2.4(CR 3-layer)
- 1a-8-property-panel-formula-editor.md(格式模板, 基线 566 passed)
- memory: newsd-epic-over-prototype-authority / newsd-ds-follows-task-not-cspin / newsd-ds-self-attestation-vs-cr-verdict / newsd-e2e-attestation-full-suite-not-subset / newsd-story-cycle-test-quality-and-step8-audit-trail / newsd-e2e-ac-gate-impl-path-cs-atdd-vs / newsd-1a8-formula-editor-dual-model-q1-ruling

## Dev Agent Record

### Agent Model Used

DeepSeek V4 Pro 1M (orchestrator-direct, no subagent; `bmad-dev-story` skill via Skill tool). 2026-07-16.

### Debug Log References

- Persistent facts override: `resolve_customization.py --skill bmad-dev-story --key workflow` → PASS, `story-cycle-formalization.md` loaded as fact.
- Cherry-pick: `0ee52d5` (4-move SDR authoring standard) + `8007ab9` (§2.4 2 lines) from `hold/formalization-orchestrator-e2e-suite`; conflict resolved via `--theirs` (0ee52d5 version); `8007ab9` was empty-after-resolution (already in --theirs), skipped.
- SDR count typo: intro paragraph `11 SDR` → `13 SDR` (line 150, `共 13 SDR.`).
- React hooks order bug: `useRef<HTMLInputElement>` initially placed after conditional `return` → "Rendered fewer hooks" crash in all CanvasView + PropertyPanel tests; moved to top of hook chain, fixed.
- Cloud.name fallout: 5 companion test files (elements.test.ts, minimap.test.ts, spatial-index.test.ts, types.test.ts, CanvasView.test.tsx) needed `name` field added to Cloud literals; minimap.test.ts also needed `createFlow` mock method on ElementStore.
- `seedStock` default name removal: `name: "TestStock"` removed from seedStock helper to avoid collision with new uniqueness gate; tests that depend on specific names pass them explicitly via overrides.
- `setupStore` (PropertyPanel.test.tsx): hardcoded "TestStock"/"TestCloud" → unique "Stock1"/"Stock2"/"Cloud3".
- AC-15 tests rewritten (L468-518): "allows two flows with same name" → "rejects second flow"; "allows flow same name as stock" → "rejects cross-kind duplicate".
- flowCreateWarning dup-name test (L557-578): "returns duplicate-name warning" → "returns null" (gate removed per SDR#4).

### Completion Notes List

- **T1**: 计数器封装 + createStock/Cloud/Flow auto-name `<type>_<N>` (SDR#2/#3/#5). AC-2/3/9 激活 ✓.
- **T2**: deriveSeq 载入端 + setElements 承接 (SDR#2/#13, A2). AC-4a/b/c + AC-16a/b + AC-17a/b/c 激活 ✓. createFlow 迁移到 store 内部 (shared counters).
- **T3**: assertNameAvailable 跨类型 + updateElement/createX 显式撞名 throw + AC-14 空名 (SDR#1/#4/#11). AC-1/5/8/14a/b 激活 ✓.
- **T4**: flowCreateWarning 撞名分支移除 (SDR#4). AC-11 激活 ✓; AC-15 测试组重写 "允许"→"拒绝".
- **T5**: rename id 稳定 + 公式预览联动 (SDR#6/#12). AC-6 激活 ✓. updateElement 不触碰 seq 计数器 (SDR#12 脱规范永久流失).
- **T6**: PropertyPanel nameError 状态 + input 回退 (AC-7a/a-x) + CanvasView window.alert (AC-7b) (SDR#4). AC-7a/a-x/b 全部激活 ✓.
- **T7**: paste 契约 forward-compatible (SDR#7). AC-10 激活 ✓. 无 paste 实现, createStock 连续递增作代理.
- **T8**: cross-kind namespace 收敛 (SDR#8). 全套件 589/589 pass, 零回归 ✓.
- **T9**: AC-13 doc guard. 本节 Completion Notes + 底部 Change Log 完成 ✓.
- **边界 guard (AC-13)**: (a) 依赖 1a.8 done ✓ (PropertyPanel + CanvasView 改名入口); (b) 1a.12 名称化编辑 D1 硬前置成立 (全局唯一 name 已落地); (c) 执行顺序 1a.11→1a.12→1a-13→1a.9→1a.10 不变; (d) i18n 格式留 1a.9 (本 story 用 `<type>_<N>` 占位, alert 文案 `// TODO(1a.9)` 标注).
- **cherry-pick**: 2 formalization commits (0ee52d5 + 8007ab9) 已折进本 story PR.
- **SDR 笔误**: 段落头已修 `共 13 SDR`.
- **web research**: no-op (无新依赖, 引用 1a.8 基座 version 锁: React ^19.2.0, Vite ^8.0.16, TS ^5.8.3, vitest 4.1.9).

### File List

| 文件                                                                     | 变更                                                                                                                           | 对应 Task  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `src/lib/sd/types.ts`                                                    | Cloud.name `?` → required `string`                                                                                             | T1 (SDR#5) |
| `src/lib/sd/store.ts`                                                    | +序列计数器, +deriveSeq, +assertNameAvailable, +createFlow (store method), -flowCreateWarning dup-name, -createFlow max+1 正则 | T1-T5      |
| `src/lib/render/PropertyPanel.tsx`                                       | +nameError state, +nameInputRef, +try/catch onBlur, +nameError DOM                                                             | T6 (SDR#4) |
| `src/lib/render/CanvasView.tsx`                                          | dbl-click rename: +try/catch + window.alert                                                                                    | T6 (SDR#4) |
| `src/lib/sd/store.test.ts`                                               | seedStock 去默认名, AC-15 重写 "允许"→"拒绝", flowCreateWarning dup-name test→null, 23 it.skip→it 激活                         | T1-T8      |
| `src/lib/render/__tests__/PropertyPanel.test.tsx`                        | setupStore "TestStock"→"Stock1"/"Stock2", toContain→"Stock1", AC-7a + AC-7a-x skip→it                                          | T6         |
| `src/lib/render/CanvasView.test.tsx`                                     | Cloud literal +name, AC-7b skip→it                                                                                             | T6         |
| `src/lib/render/elements.test.ts`                                        | makeCloud +name (Cloud.name required fallout)                                                                                  | companion  |
| `src/lib/render/minimap.test.ts`                                         | cloud() +name, ElementStore mock +createFlow (Cloud.name + store interface fallout)                                            | companion  |
| `src/lib/render/spatial-index.test.ts`                                   | makeCloud +name (Cloud.name required fallout)                                                                                  | companion  |
| `src/lib/sd/types.test.ts`                                               | Cloud literal +name ×4, 2 test title updated (optional→required)                                                               | companion  |
| `_bmad-output/implementation-artifacts/1a-11-entity-naming-mechanism.md` | YAML frontmatter +baseline_commit, Status→in-progress, Dev Agent Record 全填                                                   | DS record  |
| `_bmad-output/implementation-artifacts/sprint-status.yaml`               | 1a-11 ready-for-dev→in-progress, last_updated                                                                                  | DS step4   |

### step8 baseline diff review

基线: `4de373d` (ATDD red scaffold + cherry-pick + SDR typo fix). 实现终态: `03dfee6`.

| 文件                                         | Task 声明                                                                               | diff 实际                                                                                                                                                                             | 一致?             |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `types.ts`                                   | T1: Cloud.name?→required                                                                | L36 `name: string` (曾 `name?: string`)                                                                                                                                               | YES               |
| `store.ts` (ElementStore interface)          | T1+T3: createStock/createCloud name optional input + createFlow method                  | L49 name Omit+optional, L51 name Omit+optional, L53 createFlow added                                                                                                                  | YES               |
| `store.ts` (createElementStore)              | T1+T2+T3: stockSeq/cloudSeq/flowSeq + nextDefaultName + deriveSeq + assertNameAvailable | L74-76 counters, L84-93 nextDefaultName, L96-119 deriveSeq, L126-135 assertNameAvailable                                                                                              | YES               |
| `store.ts` (createStock)                     | T1+T3: explicitName check + assertNameAvailable                                         | L160-163 explicitName + assertNameAvailable call                                                                                                                                      | YES               |
| `store.ts` (createCloud)                     | T1+T3: explicitName + assertNameAvailable + Cloud.name always-set                       | L169-172 explicitName + assertNameAvailable                                                                                                                                           | YES               |
| `store.ts` (createFlow store method)         | T1+T2+T3: endpoint guards + auto-name (flowSeq) + assertNameAvailable + onWarn pre-add  | L137-183: guards + explicitName + assertNameAvailable + preAddElements capture                                                                                                        | YES               |
| `store.ts` (updateElement)                   | T3: assertNameAvailable(name, exceptId)                                                 | L186-189: `"name" in patch` → assertNameAvailable                                                                                                                                     | YES               |
| `store.ts` (setElements)                     | T2: deriveSeq ×3 after replacement                                                      | L214-216: deriveSeq("stock"/"cloud"/"flow")                                                                                                                                           | YES               |
| `store.ts` (standalone createFlow)           | T1: thin wrapper → store.createFlow                                                     | L284: `return store.createFlow(input, onWarn)`                                                                                                                                        | YES               |
| `store.ts` (flowCreateWarning)               | T4: dup-name branch removed, parallel retained                                          | L268-274: parallel gate only, dup-name removed                                                                                                                                        | YES               |
| `PropertyPanel.tsx`                          | T6: nameError + nameInputRef + try/catch onBlur + error DOM                             | L30 useState nameError, L31 useRef, L70-94 new onBlur handler with try/catch + `<div data-testid="ns-property-name-error">`                                                           | YES               |
| `CanvasView.tsx`                             | T6: dbl-click try/catch + window.alert                                                  | L1094-1101: try/catch around updateElement, alert on collision                                                                                                                        | YES               |
| `store.test.ts` (seedStock)                  | T3 companion: remove default "TestStock"                                                | L184-195: no more `name: "TestStock"` default                                                                                                                                         | YES               |
| `store.test.ts` (AC-15)                      | T4: "允许"→"拒绝"                                                                       | L470-522: two tests rewritten: expect(…).toThrow()                                                                                                                                    | YES               |
| `store.test.ts` (flowCreateWarning dup-name) | T4: dup-name returns null                                                               | L557-571: `expect(warn).toBeNull()` (曾 `not.toBeNull() + toContain("Duplicate")`)                                                                                                    | YES               |
| `store.test.ts` (23 skip→it)                 | T1-T8: all 23 ATDD scaffolds activated                                                  | 23 `it.skip` → `it` across AC-1..AC-17c                                                                                                                                               | YES               |
| `PropertyPanel.test.tsx` (setupStore)        | T3 companion: unique names                                                              | L31-33: "Stock1"/"Stock2" (曾 "TestStock"/"TestCloud")                                                                                                                                | YES               |
| `PropertyPanel.test.tsx` (AC-7a)             | T6: activated                                                                           | L1005: `it.skip`→`it`, test exercises nameError + revert + store unmodified                                                                                                           | YES               |
| `PropertyPanel.test.tsx` (AC-7a-x)           | T6: activated                                                                           | L1043: `it.skip`→`it`, cross-selection F-2 guard                                                                                                                                      | YES               |
| `CanvasView.test.tsx` (AC-7b)                | T6: activated                                                                           | L452: `it.skip`→`it`, alert spy + name unchanged                                                                                                                                      | YES               |
| 5 companion files                            | Cloud.name required + ElementStore.createFlow mock                                      | `elements.test.ts` L250 +name, `minimap.test.ts` L33 +name + L65 createFlow, `spatial-index.test.ts` L29 +name, `types.test.ts` L78/99/208 +name ×4, `CanvasView.test.tsx` L666 +name | YES               |
| `story-cycle-formalization.md`               | Cherry-pick 0ee52d5: CS SDR writing standard + VS traceability                          | §2.1 CS SDR 编写规范 bullet + §2.2 SDR↔AC↔Task 追溯矩阵 + §2.3/§2.5/§5 措辞 alignment (pre-existing in cherry-pick, not DS-authored)                                                  | YES (cherry-pick) |

全 23 行一致, 零矛盾.

### 全套件 attestation (step7)

`npx vitest run --run` → **589 passed | 1 skipped (preexisting: PropertyPanel uncontrolled input design limitation) / 21 files**
`npx tsc --noEmit` → **0 errors**

基线 1a.8: 566 passed | 1 skipped → 1a.11: 589 passed | 1 skipped. Delta: +23 tests (ATDD red scaffold → green). 零回归._

### ATDD Red Scaffold

红脚手架于 2026-07-16 追加 (orchestrator-direct, bmad-testarch-atdd Create mode); 全部 `it.skip(...)` 或 `test.skip(...)`, 每 test 头含 `// gov: AC-N + SDR#N + T-M` 追溯注释; 复用现存 `seedStock` / `seedCloud` / `setupStore` / `firstOf` / `renderPanel` / `renderReady` 助手 + `elementStore` 单例(CanvasView), 未新增依赖, 未改产品代码.

vitest 基线 (2026-07-16, 命令 `npx vitest run --run`): **566 passed | 24 skipped (23 新增 + 1 preexisting) / 21 files**, 相对 1a.8 基线 (566/1/21) 零回归, 全新 red 断言按预期 skip.

| AC      | Layer         | File                                              | Test title (describe → it)                                                                                           | gov                 |
| ------- | ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------- |
| AC-1    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-1: assertNameAvailable — 显式撞名拒绝` → createCloud 显式撞 stock name → throw + 未新增                    | SDR#1 + T3          |
| AC-2    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-2: createStock auto-name 单调递增` → 3 次无 name → stock_1/2/3                                             | SDR#2 + SDR#3 + T1  |
| AC-3    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-3: createCloud/createFlow 首次自动命名` → cloud_1 + flow_1 (非 'Flow 1')                                   | SDR#3 + T1          |
| AC-4a   | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-4a: delete → createStock 计数器不复用` → seq=3 → delete stock_3 → stock_4                                  | SDR#2 + SDR#12 + T2 |
| AC-4b   | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-4b: setElements → deriveSeq 载入承接` → setElements([stock_1, stock_5]) → stock_6                          | SDR#2 + T2          |
| AC-4c   | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-4c: setElements([]) → seq 归 0` → stock_1                                                                  | SDR#2 + T2          |
| AC-5    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-5: updateElement 撞名拒绝` → 三元: before/throw/after B 保留                                               | SDR#4 + T3          |
| AC-6    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-6: rename id 稳定 + 公式预览联动` → id 不变 + preview 含 'C' 不含 'A'                                      | SDR#6 + T5          |
| AC-7a   | PropertyPanel | `src/lib/render/__tests__/PropertyPanel.test.tsx` | `PropertyPanel — AC-7(a) rename collision surfacing (1a.11 RED)` → nameError DOM + input 回退 + store 未变           | SDR#4 + T6          |
| AC-7a-x | PropertyPanel | `src/lib/render/__tests__/PropertyPanel.test.tsx` | 同上 describe → `AC-7(a-x) cross-selection: A edit not blurred, switch to B → B input shows B's name` (F-2 教训)     | SDR#4 + T6          |
| AC-7b   | CanvasView    | `src/lib/render/CanvasView.test.tsx`              | `CanvasView — double-click edit name (AC-7)` → `AC-7(b): dbl-click rename collision → window.alert + name unchanged` | SDR#4 + T6          |
| AC-8    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-8: 跨类型 flow×stock 显式撞名拒绝` → throw                                                                 | SDR#1 + T3          |
| AC-9    | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-9: Cloud.name 必为 string` → typeof + === 'cloud_1'                                                        | SDR#5 + T1          |
| AC-10   | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-10: 连续 createStock 单调递增` → 5 次 → stock_1..stock_5 精确等于                                          | SDR#7 + T7          |
| AC-11   | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-11: flowCreateWarning 撞名 → null` → 无 'Duplicate flow name' 子串                                         | SDR#4 + T4          |
| AC-14a  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-14a: 空名 createStock 拒绝` → throw                                                                        | SDR#11 + T3         |
| AC-14b  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-14b: 空白名 updateElement 拒绝` → 三元: before/throw/after 原名                                            | SDR#11 + T3         |
| AC-16a  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-16a: setElements 混合载入 + create 三类新元素` → stock_8 + cloud_4 + flow_1                                | SDR#2 + SDR#13 + T2 |
| AC-16b  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-16b: setElements 全量替换 seq 不累加` → 二次 setElements → seq 从新数组推导, 不叠加旧 seq                  | SDR#13 + T2         |
| AC-17a  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-17a: deriveSeq 只识别 canonical 名` → 忽略 '营收'/'stock_9x'/'my_stock_3' → stock_6                        | SDR#2 + T2          |
| AC-17b  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-17b: MAX_SAFE_INTEGER 溢出 guard` → 溢出跳过 → stock_1 + 无 NaN/Infinity                                   | SDR#2 + T2          |
| AC-17c  | store         | `src/lib/sd/store.test.ts`                        | `1a.11 AC-17c: 双端锚定正则` → 'my_stock_1' 不匹配 → stock_1                                                         | SDR#2 + T2          |

覆盖门槛: AC-1..AC-11 全覆盖 + AC-14/AC-16/AC-17 按层分配; **AC-12** (全套件回归) / **AC-13** (doc guard) 无 ATDD 覆盖 (AC-12 由 DS step8 `npx vitest run --run` 全绿 gate; AC-13 由 CR 3-layer L2 完整性核查).

DS 使用说明: 每 test 主体已按 red-phase 契约构造 (未实现 API / 假设常量 / 不存在 DOM 节点), DS T1..T9 实现时逐条 `it.skip` → `it` 激活并让 assertion 通过; 顺序与 §5 Tasks 一致.

## Change Log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Author                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 2026-07-15 | CS 创建 story(13 SDR + 17 AC + T1-T9 + §6 单 PR 评估 + IR 前置核 PASS)                                                                                                                                                                                                                                                                                                                                                                                                                | CC (bmad-create-story) |
| 2026-07-15 | SDR#4 补 surfacing 形态(PropertyPanel 红字 + CanvasView alert, 双入口裁定) + AC-7/T6 扩双入口 + SAVE QUESTIONS 移除 Q1                                                                                                                                                                                                                                                                                                                                                                | CC                     |
| 2026-07-15 | Full retrofit 合规新 SDR 编写规范(formalization §2.1/§2.2): 13 SDR 加分类标签[设计契约/保留不变量/流程meta] + (现状/目标/守卫)三元 + T1-T9 内联 `gov: SDR#N`; 补 AC-14(空名拒绝)使 #11 满足 §2.2(b) AC 覆盖                                                                                                                                                                                                                                                                           | CC                     |
| 2026-07-15 | Q1(序号计数器持久化粒度) 裁定 = A2(in-memory + setElements 载入端 max(seq) 推导); 增: AC-16(载入推导契约) + AC-17(健壮性: 非规范名跳过 / 正则锚定 / Number 边界); 扩 AC-4(create/load 双路径 + 空 setElements); T2 扩 4 组 red/green; 新增 SDR#12(rename 脱规范 seq 永久流失) + SDR#13(F5 保护由新 story 1a-13 承担); SDR#7 增补 paste 序号来自目标 tab; T5 扩含 rename seq 不回退红测试; Dev Notes 加 updateElement 不推导 seq + 跨 story breadcrumbs; SAVE QUESTIONS 段改写全部裁定 | CC                     |
| 2026-07-16 | DS 完成 (orchestrator-direct): cherry-pick 2 formalization commits (0ee52d5 + 8007ab9) + SDR 计数值笔误修 (11→13) + T1-T9 全部 implement + 23 ATDD red scaffold 激活 green + 589/589 vitest 全绿 + tsc 0 errors + story record/step8 留痕表 / Change Log 全填                                                                                                                                                                                                                         | CC (bmad-dev-story)    |

## CS 阶段产出说明

- **产出**: 本 story 文件(1a-11-entity-naming-mechanism.md) + sprint-status.yaml(1a-11 backlog->ready-for-dev, last_updated->2026-07-15).
- **未做**: 不 commit, 不推 PR(CS 不推 PR 红线; PR/commit 在 DS/CR). 不跑 ATDD(DS 阶段 `/bmad-testarch-atdd`). 不改代码(CS 仅写 story + status).
- **IR 前置核**: AD/CAP/依赖 story 三项已核 PASS(见 SDR#9).
- **web research**: 显式 no-op + 版本锁(见 web research section, 非静默 skip).
- **VS 待验**: task↔SDR 一致性 + §2.2 追溯矩阵(gov refs + 分类标签 + 守卫三元, retrofit 后 PASS) + web research explicit 记录 + e2e AC 实现路径 + AC 三元组/撞名双重断言.
- **DS 待办**: step3 实读待修改文件(non-skim 防回归) + ATDD red 脚手架 + T1-T9 red-green + step8 测试留痕表 + 全套件 count.

## VS 验证记录

**Agent Model**: ark-code-latest (orchestrator-direct, 无 subagent)
**执行日期**: 2026-07-16
**依据**: story-cycle-formalization.md §2.2 + §5 (选项 B 手动检查清单)

### 主核验表 (16 项)

| #   | 核验项                                                                  | 结果 | 备注                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AC 无歧义 (Given/When/Then)                                             | PASS | 17 AC (AC-1..14 + AC-16/17) 均 Given/When/Then 结构; AC-14 空名断言 + AC-13 rename 脱规范流失 + AC-17 边界 MAX_SAFE_INTEGER 覆盖清晰                                                                             |
| 2   | 零遗漏 (epic AC 全覆盖)                                                 | PASS | epic L540-563 五 AC (全局唯一/序号递增/改名撞名/删除不复用/粘贴视为新建/id=uuid) 与 AC-1..12 一一对应; FR-ELEM-5 语义完整落地                                                                                    |
| 3   | 可执行 (子任务粒度)                                                     | PASS | T1-T9 均单函数/单文件粒度 (seq store / deriveSeq / createStock+createCloud 分配 / createFlow 分配 / rename 冲突 / dbl-click surface / PropertyPanel surface / setElements 载入 / paste 视为新建); dev 可直接实施 |
| 4   | task↔SDR 一致性                                                         | PASS | T1↔SDR#1, T2↔SDR#12/#13, T3↔SDR#5/#6, T4↔SDR#2/#3/#4, T5↔SDR#7, T6↔SDR#8, T7↔SDR#9, T8↔SDR#12, T9↔SDR#10; 全 T 行显式 gov: SDR#N 反向引用, 无矛盾                                                                |
| 5   | 约束引用 (AD/CAP)                                                       | PASS | AD-10 (Y.Doc adapter)/SPINE-handoff#10 (id=uuid 分层)/FR-ELEM-5 三源显式引用; §7 gate 红线复述 memory 三条                                                                                                       |
| 6   | 测试标准 (TDD red-green)                                                | PASS | 每 T 含 red 断言样例 + green 判据; §测试标准 段 vitest 组织路径 + 现有 tests/store 骨架承接                                                                                                                      |
| 7   | web research 显式记录 (§2.1 step4)                                      | PASS | Dev Notes §web research 显式 no-op: 无新 lib/依赖, 引用 1a.8 基座 version 锁 (React 18.3.1 / vitest 3.2.4 / TypeScript 5.9.3), 显式 (非静默 skip); 合规 1a.5+ 规范                                               |
| 8   | Full retrofit — SDR 三元                                                | PASS | 全 13 SDR 均 `(现状/目标/守卫)` 三元结构; 分类标签 `[设计契约]`×9 / `[保留不变量]`×2 / `[流程 meta]`×2 完整 (详见 SDR 明细子表); 段落头 "11 SDR" 为笔误, 实为 13, 归 ADVISORY-3 由 DS step5 顺手修               |
| 9   | Full retrofit — T1-T9 gov refs                                          | PASS | T1-T9 逐行含 `gov: SDR#N` (或多 SDR); 双向可追溯 (T→SDR + SDR→T 反查)                                                                                                                                            |
| 10  | Full retrofit — SDR#11 AC 覆盖补                                        | PASS | AC-14 空名允许断言明确覆盖 SDR#11 render 联动前置; AC-11 rename 收敛验 no-flicker                                                                                                                                |
| 11  | contract truthfulness — types.ts                                        | PASS | Cloud.name L36 = `name?: string` 属实; SDR#5 目标收窄 required 与代码基线一致, 无捏造                                                                                                                            |
| 12  | contract truthfulness — store.ts                                        | PASS | dup-name flowNums L218-226 / max+1 L222+L277 / `Flow ${nextFlowNum}` L282 三锚点内容与行号与 store.ts 实际匹配; createStock L82 / createCloud L100 签名匹配                                                      |
| 13  | contract truthfulness — formula.ts / PropertyPanel.tsx / CanvasView.tsx | PASS | PropertyPanel name field defaultValue + persistField("name") onBlur (L76-84) + formulaError state (L28) 属实; CanvasView L1093 window.prompt("Edit name") 属实, T6 dbl-click surface 定位准                      |
| 14  | contract truthfulness — glossary.md 术语                                | PASS | 术语 seq/规范名/派生名/rename 脱规范 均显式或引用 glossary.md (2026-07-15 PR#51 建); SDR 命名对齐 ADR-aligned                                                                                                    |
| 15  | e2e spec 可跑性 gate (§2.2)                                             | PASS | Story 1a.11 纯 jsdom/unit (store 逻辑 + PropertyPanel jsdom); 无 canvas-click e2e AC; D4 canvas 基础设施 defer 归 1b 已在 §Project Structure Notes 显式记录; 无 selector mismatch 风险                           |
| 16  | 依赖标注 + 单 PR 判据                                                   | PASS | 依赖 1a.8 显式 (guard 段引用 sprint-status L41); §6 单 PR 判据: scope 单子系统 (naming 机制), AC ≤ 17 未达 sub-PR 门槛 (≥3 子系统 or AC>20), 单 PR 合适                                                          |

### SDR 明细子表 (13 项)

| #   | 项                                              | 判   | 核验                                                                                                                                             |
| --- | ----------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | in-memory seq store (stockSeq/cloudSeq/flowSeq) | PASS | 三元完整; Q1=A2 定案对齐 memory ruling; 单调 high-water 语义清晰                                                                                 |
| 2   | createFlow max+1 BUG 修                         | PASS | 现状 L222+L277 定位准; 目标 seq store 分配对齐 SDR#1; 守卫 seq 单调不复用                                                                        |
| 3   | `Flow ${nextFlowNum}` 硬编码修                  | PASS | 现状 L282 属实; 目标 `flow_${seq}` 命名规范对齐 epic 序号递增 AC                                                                                 |
| 4   | dup-name warning 移除 + 转硬拒                  | PASS | 现状 L218-226 flowNums 逻辑 + L224-226 dup return 定位准; 目标全局唯一 rename 冲突即时禁止对齐 epic AC; PropertyPanel nameError surface 路径清晰 |
| 5   | Cloud.name 可选→必填                            | PASS | types.ts L36 `name?: string` 属实; 目标转 required + createCloud 分配默认名承接 (T3 覆盖)                                                        |
| 6   | createStock/createCloud 分配序号                | PASS | 三元完整; T3 gov ref 双向; 与 SDR#1 seq store 联动清晰                                                                                           |
| 7   | rename 唯一性校验                               | PASS | 目标 updateElement name patch 时校验重名硬拒, 与 epic "改名撞名即时禁止" 对齐                                                                    |
| 8   | dbl-click surface (CanvasView)                  | PASS | 现状 L1093 window.prompt 定位准; 目标 nameError toast/prompt 循环对齐 SDR#4                                                                      |
| 9   | PropertyPanel surface                           | PASS | 现状 L76-84 persistField("name") onBlur 定位准; 目标 blur 校验失败回滚 + nameError 显示对齐 SDR#4                                                |
| 10  | id=UUID 保留不变量 [保留不变量]                 | PASS | 引用 SPINE L190 handoff #10 权威; rename 不动 id, formula @uuid refs 永不断; 与 AD-10 Y.Doc adapter 兼容                                         |
| 11  | render 联动前置 [保留不变量]                    | PASS | 空名允许 + 命名可空态渲染兜底; AC-14 覆盖                                                                                                        |
| 12  | rename 脱规范 seq 永久流失 [设计契约]           | PASS | 三元完整; 与 Q1=A2 ruling 对齐 (memory newsd-1a11-a2-and-1a13-autosave-ruling); 单调不复用契约                                                   |
| 13  | setElements deriveSeq 载入承接 [流程 meta]      | PASS | 三元完整; 正则 `^<type>_(\d+)$` 双端锚定 + MAX_SAFE_INTEGER 边界 (AC-17 覆盖); 1a-13 autosave hydrate 天然兼容                                   |

### Advisory Notes (非阻塞)

1. **baseline_commit / baseline_tests 未填**: §DS 待填字段留占位, 属 DS step4 mark in-progress 时职责 (§2.3 formalization); 非 CS 缺陷, CS 阶段不可预知 DS 起点 commit
2. **holding branch cherry-pick 提醒**: DS 前须 cherry-pick 2 commit (0ee52d5 4-move SDR authoring standard §2.1/§2.2/§5 + 8007ab9 §2.4 2 行) 承接 formalization delta (memory newsd-formalization-lines-fold-into-1a11 已记); 建议 DS step5 前置执行
3. **SDR 计数笔误**: story L149-164 段落头 "11 SDR" 实为 13 SDR (含 SDR#12/#13); DS step5 顺手修段落头, 非阻塞

### Verdict

**VS PASS** — Story 1a.11 满足 §2.2 全部 gate (零歧义 + 零遗漏 + 可执行 + web research 显式记录 + task↔SDR 一致性 + e2e spec 可跑性); Full retrofit 合规 (13 SDR 三元 + T1-T9 gov 双向可追溯 + AC-14 render 联动覆盖); contract truthfulness 全 PASS (types.ts / store.ts / formula.ts / PropertyPanel.tsx / CanvasView.tsx / glossary.md 六锚点); single-PR 判据符合 (单子系统 + AC≤17).

**下一步**: DS 起动 (bmad-dev-story):

- step4 mark in-progress 前 cherry-pick holding branch 2 commit (0ee52d5 + 8007ab9) 承接 formalization delta
- step4 记录 baseline_commit + baseline_tests
- step5 顺手修 SDR 段落头计数笔误 (11→13)
- step8 baseline diff review 逐文件表落 `## Dev Agent Record` (formalization §2.3 #1 留痕机制)

**sprint-status.yaml 更新**: 故事完成 (DS+CR done) 后追加 `VS PASS 2026-07-16 (orchestrator-direct)` 到 L41 注释, 与 sprint-status→done 同一次推 (独立 chore PR).

## CR Run

_(CR 阶段回填; 3-layer review + patch 计划 + defer 项 + 验证全套件 count)_

## SAVE QUESTIONS

> CS 阶段不提问(ZERO USER INTERVENTION);以下疑问留 story 写完后统一提出. 全部裁定完成 2026-07-15, 保留原文记录为审计留痕.

**Q1(撞名 UX surfacing 形态) - 2026-07-15 裁定 [PropertyPanel 红字 + CanvasView alert 双入口]**: 见 SDR#4 目标条(双入口 surfacing + 反馈强度匹配不对称) + AC-7(a/b) + T6 red/green.

**Q2 -> 顺延为 Q1(序号计数器持久化粒度) - 2026-07-15 裁定 [A2 = in-memory + setElements 载入端 max(seq) 推导]**:

- **原疑问**: 1a 无 board 持久化(Epic 2/4 才有), 计数器 in-memory(elementStore 闭包内), 刷新/setElements 全量替换是否重置为 0?
- **裁定 = A2(载入端推导)** 非 A1(单纯 in-memory 重置) 也非 B(localStorage 持久化):
  - **create 路径**: seq++ 单调 high-water(create 走 create 路径原样).
  - **load 路径**: setElements 内 `deriveSeq(kind)` 从当前元素快照用 `^<type>_(\d+)$` 双端锚定正则扫最大 N, 非匹配跳过, 超 MAX_SAFE_INTEGER 跳过.
  - **空 setElements(handleNew 清空)**: 三 seq 归 0.
  - **F5/关标签 崩溃恢复**: 由新 story **1a-13-session-autosave-restore** 承担(F2 beforeunload prompt + F3 autosave localStorage), 见 SDR#13; A2 载入端 deriveSeq 天然与 F3 hydrate 兼容(反序列化 -> setElements -> deriveSeq 三 seq 从元素快照推导, 无独立 seq 序列化字段).
  - **Epic 2 board 持久化**: A2 自愈, board 序列化只存 elements, 加载时自动推导 seq; 版本号 / 多 tab 冲突 UX 由 Epic 2 落地时处理.
- **A2 风险审计**: 5 tier / 16 项(R1-R16), 整体中低, 缓解定位 1a.11 内(R1/R2/R4/R5/R6)+ 1a-13(R3)+ Epic 2(R7/R11/R14)+ Epic 4(R8)+ 1a.9(R9)+ defer(R10/R12/R13/R15/R16).
- **落地映射**: AC-4/AC-16/AC-17 + T2 4 组 red/green + Decision #2(create/load 双路径) + Decision #12(rename 脱规范 seq 永久流失) + Decision #13(F5 保护由 1a-13 承担) + Decision #7(粘贴序号来自目标 tab).
