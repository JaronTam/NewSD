---
stepsCompleted:
  [
    "step-01-preflight-and-context",
    "step-02-generation-mode",
    "step-03-test-strategy",
    "step-04-generate-tests",
  ]
lastStep: "step-04-generate-tests"
lastSaved: "2026-07-16"
---

# ATDD Checklist — Story 1a.11 图元命名机制

## Step 01 — Preflight & Context

- Story: `_bmad-output/implementation-artifacts/1a-11-entity-naming-mechanism.md` (17 AC / 13 SDR / T1-T9)
- Stack: frontend (React 19 + TS + Vite + Vitest 4.1.9 + RTL 16.3.2 + jsdom 29.1.1)
- No new deps
- 沟通语言: 中文 半角标点 (story §7 red-line 覆盖 config.yaml 的 English)
- 硬约束: orchestrator-direct / 严禁改产品代码 / 严禁 subagent / 严禁 Playwright canvas-click e2e / 严禁合并推 PR

## Step 02 — Generation Mode

- 模式: **AI generation**
- 理由: AC 清晰 / 标准 CRUD + reactive state 模式 / 现存 test 文件已定基调 (store.test.ts / PropertyPanel.test.tsx / CanvasView.test.tsx) / 无需浏览器录制
- 层分配:
  - **store 层** (vitest 纯逻辑, 无 DOM): AC-1/AC-2/AC-3/AC-4(a/b/c)/AC-5/AC-6/AC-8/AC-9/AC-10/AC-11/AC-14/AC-16(a/b)/AC-17(a/b/c)
  - **PropertyPanel 层** (jsdom + RTL): AC-7(a) rename collision surfacing
  - **CanvasView 层** (jsdom + RTL + `window.prompt`/`window.alert` mock): AC-7(b) dbl-click collision surfacing
  - AC-12 (全套件回归) / AC-13 (doc guard) 无 ATDD 覆盖
- Cross-selection test (1a.8 F-2 教训): 落 PropertyPanel 层 AC-7(a) 变体或独立 test

## Step 03 — Test Strategy

### 1. AC → 场景 → 层 → 优先级 → gov

| AC      | 场景摘要                                                                                                       | 层            | 优先级 | gov (SDR#/T)            | 断言形态                                            |
| ------- | -------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ----------------------- | --------------------------------------------------- |
| AC-1    | createCloud 显式撞已有 stock name → throw + store 未新增                                                       | store         | P0     | #1 / T3                 | expect(...).toThrow + getElements().length 前后一致 |
| AC-2    | 空 store 连续 3 次 createStock 无 name → stock_1/2/3                                                           | store         | P0     | #2/#3 / T1              | names 数组精确等于                                  |
| AC-3    | 空 store createCloud + createFlow 无 name → cloud_1 / flow_1                                                   | store         | P0     | #3 / T1                 | .name === 字面量                                    |
| AC-4a   | seq=3 delete stock_3 后 createStock → stock_4 (create 路径不复用)                                              | store         | P0     | #2/#12 / T2             | .name === "stock_4" 非 "stock_3"                    |
| AC-4b   | setElements([stock_1, stock_5]) + createStock → stock_6 (载入推导)                                             | store         | P0     | #2 load 路径 / T2       | .name === "stock_6"                                 |
| AC-4c   | setElements([]) + createStock → stock_1 (归 0)                                                                 | store         | P0     | #2 / T2                 | .name === "stock_1"                                 |
| AC-5    | stock A + stock B, updateElement(B,{name:"A"}) → throw + B.name 仍 "B"                                         | store         | P0     | #4 / T3                 | 三元: before "B" + throw + after "B" ≠ 假想 "A"     |
| AC-6    | stock "A"(s1) + flow @s1 → rename s1→"C" → id 不变 + preview="C"                                               | store         | P0     | #6 / T5                 | 三元: id 前后同 + formatFormulaForEditor 显示 "C"   |
| AC-7a   | PropertyPanel 选 A, name 改 "B" blur → nameError 渲染 + input 恢复 "A" + store.name 仍 "A"                     | PropertyPanel | P0     | #4 / T6                 | 三元 + DOM query nameError + input.value === "A"    |
| AC-7a-x | Cross-selection: render A, 改 A name 未 blur, 切 B → B input = B.name(不泄漏 A 编辑)                           | PropertyPanel | P0     | #4 / T6 + 1a.8 F-2 教训 | input.value === "B name"                            |
| AC-7b   | CanvasView 双击 A, prompt 输入 "B" → window.alert 被调 + s1.name 仍 "A"                                        | CanvasView    | P0     | #4 / T6                 | vi.spyOn(window,"alert") + s1.name 前后一致         |
| AC-8    | flow "X" 存在 + createStock 显式 "X" → throw (跨 flow/stock)                                                   | store         | P0     | #1 / T3                 | expect(...).toThrow                                 |
| AC-9    | createCloud 无 name → Cloud.name === "cloud_1" (非 undefined)                                                  | store         | P0     | #5 / T1                 | .name 字面量 + typeof === "string"                  |
| AC-10   | createStock 连续无 name → 单调递增 (paste 契约代理)                                                            | store         | P1     | #7 / T7                 | names 数组精确等于                                  |
| AC-11   | flowCreateWarning 撞名 input → null (非 "Duplicate flow name")                                                 | store         | P0     | #4 / T4                 | === null + 无 "Duplicate flow name" 子串            |
| AC-14a  | createStock({name:""}) → throw                                                                                 | store         | P0     | #11 / T3                | expect(...).toThrow                                 |
| AC-14b  | updateElement(id,{name:" "}) → throw + 原名保留                                                                | store         | P0     | #11 / T3                | 三元: before + throw + after 原名                   |
| AC-16a  | setElements([stock_7, stock_2, cloud_3]) → createStock → stock_8 + createCloud → cloud_4 + createFlow → flow_1 | store         | P0     | #2/#13 / T2             | 三 name 字面量                                      |
| AC-16b  | setElements 全量替换语义: 二次调用 → 不叠加旧 seq                                                              | store         | P1     | #13 / T2                | seq 从新元素推导                                    |
| AC-17a  | setElements 含 "营收"/"stock_9x"/"my_stock_3"/"stock_5" → createStock → stock_6                                | store         | P0     | #2 / T2                 | .name === "stock_6"                                 |
| AC-17b  | setElements 含 "stock_99999999999999999999" → deriveSeq 跳过 → createStock 不 NaN/Infinity                     | store         | P0     | #2 / T2                 | .name 匹配 `^stock_\d+$` 有限正整数                 |
| AC-17c  | 正则双端锚定: setElements(["my_stock_1"]) → stockSeq=0 → createStock → stock_1                                 | store         | P0     | #2 / T2                 | .name === "stock_1"                                 |

### 2. 层选择理由

- **store 层 (vitest 纯逻辑)**: 命名机制核心 (计数器 / assertNameAvailable / deriveSeq) 无 DOM 依赖, 直测 API 边界; 最快最稳
- **PropertyPanel 层 (jsdom + RTL)**: AC-7(a) 需 DOM 断言 (nameError 元素 + input.value 回退); 复用 1a.8 setupStore + renderPanel fixture
- **CanvasView 层 (jsdom + RTL)**: AC-7(b) 需 window.prompt + window.alert 双 spy; 复用 L354-444 dbl-click describe 已有 mock pattern
- **不用 Playwright canvas-click e2e**: canvas-click 基础设施归 1b (deferred-work D4); story §7 gate 明禁

### 3. 优先级

- **P0 (18 tests)**: 全部命名机制核心 AC (含 AC-14 空名 / AC-16/17 载入推导健壮性); 覆盖 SDR#1/#2/#4/#5/#6/#11/#12/#13 设计契约
- **P1 (2 tests)**: AC-10 粘贴契约代理 (无 paste impl 但 forward-compat) + AC-16b 全量替换语义

### 4. 红相验证方法

- store 层: 每 test 用 `test.skip(...)` (跳过) 或 `expect(realBehavior).toBe(未实现的字面量)` 让当前 store.ts 实际返回值不匹配, 保证 red
- 组件层: 断言目前不渲染的 `data-testid="ns-property-name-error"` (未实现) → RTL query 返回 null, expect(...).toBeInTheDocument() 直接 fail
- CanvasView 层: 断言 `window.alert` 被调用一次 (spyOn); 当前 CanvasView.tsx L1088-1099 无 try/catch 无 alert 调用 → spy 计数 0 → fail

### 5. 断言纪律 (1a.8 教训)

- 三元组: reactive AC (AC-5/AC-6/AC-7 双入口/AC-14b) 必须 before + action + after 三段, after 断言含 "≠ 若行为失败会变的值" 反向锚
- 撞名双重: (a) throw/拒绝 (b) 原 name 保留 (未部分写入) 两条 expect 同 test 内
- 禁 hollow `toBeTruthy()`: 每 expect 断言具体字面量 / 具体计数 / 具体 DOM 节点
- gov comment: 每 test 头 `// gov: AC-N + SDR#N + T-M` 便于 CR 交叉核

### 6. 产出文件映射

| 层            | 文件                                              | 追加位置                                                   |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| store         | `src/lib/sd/store.test.ts`                        | 文件尾追加新 describe blocks (不动 L468-518 现有测试)      |
| PropertyPanel | `src/lib/render/__tests__/PropertyPanel.test.tsx` | 文件尾追加 describe "AC-7(a) rename collision"             |
| CanvasView    | `src/lib/render/CanvasView.test.tsx`              | 追加至 L354 起 "double-click edit name (AC-7)" describe 内 |
