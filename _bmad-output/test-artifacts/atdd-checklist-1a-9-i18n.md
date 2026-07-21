---
stepsCompleted:
  [
    "step-01-preflight-and-context",
    "step-02-generation-mode",
    "step-03-test-strategy",
    "step-04-generate-tests",
    "step-04c-aggregate",
    "step-05-validate-and-complete",
  ]
lastStep: "step-05-validate-and-complete"
lastSaved: "2026-07-20"
storyId: "1a.9"
storyKey: "1a-9-i18n"
storyFile: "_bmad-output/implementation-artifacts/1a-9-i18n.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-1a-9-i18n.md"
generatedTestFiles:
  - "src/lib/sd/i18n.test.ts"
  - "src/lib/sd/langStore.test.ts"
  - "src/lib/render/SettingsPanel.test.tsx"
  - "src/lib/render/i18n-switch.test.tsx"
inputDocuments:
  - "_bmad-output/implementation-artifacts/1a-9-i18n.md"
  - "src/lib/sd/i18n.ts"
  - "src/lib/sd/errorDetection.ts"
  - "src/lib/render/CanvasView.tsx"
  - "src/lib/render/Toolbar.test.tsx"
  - "src/lib/sd/autosave.ts"
  - "src/test/setup.ts"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "_bmad-output/project-context.md"
  - "_bmad-output/test-artifacts/atdd-checklist-1a-13-session-autosave-restore.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md"
---

# ATDD Checklist: Story 1a.9 - 界面 i18n / 中英双语运行时切换

> TDD 阶段: **RED**（红脚手架，全部 `it.skip`，DS green 阶段逐 task 解 skip）。
> 执行模式: **sequential orchestrator-direct**（ark-code 后端，无 subagent；见 Step 4 说明）。

---

## Step 1: Preflight & Context Loading

### 1.1 Stack Detection

- **detected_stack = `frontend`**
- 依据: `package.json`（React 19 + Vite + TanStack Start + bun）；无 `server/` 构建产物；wasm 是前端边界 stub。
- 测试栈: vitest 4.1.9（jsdom）= unit/component；Playwright（chromium + SwiftShader）= e2e。
- 影响: skill 的「API worker / E2E worker」二分不适配 NewSD（无 API/backend）；映射为 **Unit worker / Component worker**，E2E worker = N/A（story 1a.9 无新 e2e 门槛）。

### 1.2 Prerequisites

- ✅ Story 1a.9 @ `ready-for-dev`（CS done 2026-07-20，VS PASS，6 SAVE Q 全裁定）。
- ✅ 基线 ca4ce02: vitest 730 passed + tsc 0（memory `newsd-architecture-finalize-pending` 验证；本会话 tsc 0 + vitest 730 passed/0 fail 复验）。
- ✅ TEA v1.19.0 已装（memory `newsd-tea-module-installed`），`bmad-testarch-atdd` skill 可用。
- ✅ 1a.13 红脚手架先例（autosave.test.ts: `declare const` + `it.skip` + gov 注释）已读，作为本 story 模板。

### 1.3 Story Context

- story_key = `1a-9-i18n` / story_id = `1a.9`
- story_file = `_bmad-output/implementation-artifacts/1a-9-i18n.md`
- 15 AC: AC-1（i18n.ts 扩展 + E27 fallback）/ AC-2（langStore subscribe + 运行时即时切换）/ AC-3（Toolbar 齿轮设置面板入口）/ AC-4（localStorage `ns-lang`）/ AC-5（Toolbar i18n）/ AC-6（PropertyPanel 7 字段）/ AC-7（StatusBar 7 字段 + errorDetection ERROR_TYPE_LABEL）/ AC-8（CanvasView L558/L1459/L1346 三处文案）/ AC-9（PromptPanel/PromptTabs/PromptCapsule/tabs×4/AtMentionAutocomplete）/ AC-10（不切换 name/formula/ASCII/testid）/ AC-11（navigator.language 默认）/ AC-12（grep 零残留中文）/ AC-13（E27 fallback 英文）/ AC-14（E27 console 警告）/ AC-15（全套件无回归）。
- 任务 T0-T11；**T0 = ATDD 红脚手架（本产物）**，T1-T11 = DS green。
- 新文件: langStore.ts + test / SettingsPanel.tsx + test / i18n.test.ts。UPDATE: i18n.ts / errorDetection.ts / Toolbar/StatusBar/PropertyPanel/CanvasView/PromptPanel/PromptTabs/PromptCapsule/tabs×4/AtMentionAutocomplete + styles.css + 现有 component test 加 lang=zh fixture（Q4=A）。NOT TOUCHED: store.ts / types.ts / formula.ts / elements.ts / 全部 data-testid / console.warn/log。

### 1.4 Framework & Existing Patterns

- vitest.config.ts: `viteReact()` + jsdom + setupFiles `./src/test/setup.ts` + include `src/**/*.test.{ts,tsx}`。
- setup.ts: `@testing-library/jest-dom/vitest` + afterEach cleanup + matchMedia(matched:false) + ResizeObserverStub + `HTMLCanvasElement.prototype.getContext = () => null`。
- 现有 component test 模式（Toolbar.test.tsx / AlertTab.test.tsx）: `@testing-library/react` render/fireEvent/cleanup + props() factory + `data-testid` query + 中文 getByText 断言。
- store 模式（autosave.ts）: external singleton + `subscribe`/`getSnapshot` + mutation + KEY 常量 + `hasWindow()/hasLocalStorage()` prerender guard + `console.warn` 容错。langStore 镜像此模式。

### 1.5 TEA Config Flags

- `tea_use_playwright_utils=true` / `tea_use_pactjs_utils=false` / `tea_pact_mcp=none` / `tea_browser_automation=auto` / `test_stack_type=auto`。
- NewSD override（project-context.md 权威）: SKIP network/auth/pact fragments（无 API/backend/network）；`communication_language` effective=中文（custom config.user.toml 胜 config.yaml English）。
- knowledge fragments: 加载 `test-quality.md`（核心: no hard wait / no conditionals / <300 行 / <1.5min / 显式断言 / self-cleaning / unique data / parallel-safe）。Playwright utils fragment = SKIPPED（1a.9 无新 e2e）。

### 1.6 红脚手架目标（4 新文件，零改现有绿测试）

| 文件                                    | 级别      | 覆盖 AC    | 新模块策略                                                                     |
| --------------------------------------- | --------- | ---------- | ------------------------------------------------------------------------------ |
| `src/lib/sd/i18n.test.ts`               | Unit      | AC-1/13/14 | i18n.ts brownfield -> real import；missing key 用 `string as DictKey` cast     |
| `src/lib/sd/langStore.test.ts`          | Unit      | AC-2/4/11  | langStore.ts NEW -> `declare function`/`declare const` ambient                 |
| `src/lib/render/SettingsPanel.test.tsx` | Component | AC-3       | SettingsPanel.tsx NEW -> `declare const SettingsPanel: FC` + langStore ambient |
| `src/lib/render/i18n-switch.test.tsx`   | Component | AC-5/10    | Toolbar brownfield -> real import；langStore ambient 驱动切换                  |

**scope 决策（依据 story 任务结构 + 1a.13 先例）**: AC-6/7/8/9 逐组件双语文案由 DS 按任务 T5-T8 加 en 用例到**现有 component test**（lang=zh fixture Q4=A + 新 en case）；AC-12 grep 零残留中文 = DS/CR gate；AC-15 全套件无回归 = 基线 gate（本 checklist 已验证）。本红脚手架覆盖**切换机制**（Toolbar）+ **横切 AC-10 守卫**（testid 不本地化）+ **新模块**（langStore/SettingsPanel）+ **E27 fallback**（i18n）。

---

## Step 2: Generation Mode

- **Mode = AI Generation**（acceptance criteria 清晰，场景标准；frontend 无需 browser recording）。
- Recording 模式跳过（story 无需 live browser 验证 selector；AC-8 三处文案已确认 DOM 渲染见 §3）。

---

## Step 3: Test Strategy

### 3.1 AC -> Scenario -> Level -> Priority

| AC         | Scenario                                                          | Level     | Priority | 文件                                 |
| ---------- | ----------------------------------------------------------------- | --------- | -------- | ------------------------------------ |
| AC-1       | tier1 现有 key 返回 dict 值（sanity，green-ready）                | Unit      | P1       | i18n.test.ts                         |
| AC-1       | tier3 missing key 不 throw                                        | Unit      | P0       | i18n.test.ts                         |
| AC-13      | tier3 missing key 返回 key name（ASCII，非空）                    | Unit      | P0       | i18n.test.ts                         |
| AC-14      | tier3 missing key 触发 console.warn 含 key                        | Unit      | P0       | i18n.test.ts                         |
| AC-2       | subscribe 返回 unsub；setLang 触发 listener；getSnapshot 即时反映 | Unit      | P0       | langStore.test.ts                    |
| AC-4       | setLang 写 localStorage[LANG_KEY="ns-lang"]                       | Unit      | P0       | langStore.test.ts                    |
| AC-11      | detectLang(en-US/zh-CN/fr-FR) 纯函数                              | Unit      | P1       | langStore.test.ts                    |
| AC-3       | SettingsPanel 渲染 + 齿轮入口 + lang toggle 切换+持久化           | Component | P0       | SettingsPanel.test.tsx               |
| AC-5       | Toolbar aria-label 随 langStore 切换（zh=新建/en=New）            | Component | P0       | i18n-switch.test.tsx                 |
| AC-10      | Toolbar button testid 集合切换前后不变（守卫）                    | Component | P1       | i18n-switch.test.tsx                 |
| AC-6/7/8/9 | 逐组件 zh/en 文案                                                 | Component | P1       | **DS T5-T8 加到现有 component test** |
| AC-8       | CanvasView L558/L1459/L1346 三处文案切换                          | Component | P1       | **DS T8 加到 CanvasView.test.tsx**   |
| AC-10      | name/formula/ASCII 切换不变                                       | Component | P1       | **DS T5-T8 en case 内联守卫**        |
| AC-12      | grep 零残留中文（src 非测试代码）                                 | Gate      | P0       | DS/CR 跑 grep                        |
| AC-15      | 全套件无回归（vitest 730 + e2e 29）                               | Gate      | P0       | 基线 gate（本 checklist 已验）       |

### 3.2 负面 / 边界

- E27 tier3: missing key -> 返回 key name + warn（不 throw / 不空）。边界: key name 含 ASCII 前缀（Q3=A）。
- AC-11: navigator.language 未知语种（fr-FR）-> fallback zh。
- AC-4: localStorage 不可用（prerender）-> no-op（DS 实装 hasLocalStorage guard，本红脚手架 jsdom 环境不测 prerender）。

### 3.3 红阶段确认

- 全部 22 个 `it.skip`：assert **预期行为**（非 placeholder，无 `expect(true).toBe(true)`）。
- 新模块（langStore/SettingsPanel）: `declare const/function` ambient -> 运行时 undefined -> 解 skip 后 throw（RED）。
- 现有模块扩展（i18n E27）: `t(missingKey as DictKey, lang)` -> 当前 `dict[key][lang]` throw TypeError（RED）。
- 切换机制（Toolbar）: 当前 Toolbar 硬编码 zh 忽略 langStore -> 解 skip 后 aria-label 仍 `新建` != `New`（RED）。

---

## Step 4: Generate Tests

### 4.1 执行模式解析

- `tea_execution_mode=auto`（config 默认）；ark-code 后端 `runtime.canLaunchSubagents()=false`（memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`: subagent 两轴皆崩）。
- 解析: `auto` -> fallback `sequential`（无 subagent/agent-team 能力）。
- **sequential orchestrator-direct**: 不起 subagent、不走 `/tmp/tea-atdd-*.json` 临时 JSON（subagent 传递机制，N/A）；orchestrator 直接写文件（1a.13 先例）。
- skill 的 Worker A（API）/ Worker B（E2E）映射: **Worker A -> Unit（i18n/langStore）/ Worker B -> Component（SettingsPanel/i18n-switch）**；E2E worker = N/A。

### 4.2 生成文件（4 个，全 RED）

1. `src/lib/sd/i18n.test.ts` — 6 it.skip。E27 fallback（tier1 sanity + tier3 return-key-name/no-throw/no-empty + console.warn spy）。real import `./i18n`。
2. `src/lib/sd/langStore.test.ts` — 9 it.skip。subscribe/getSnapshot/setLang + localStorage[LANG_KEY] + detectLang 纯函数。`declare function`/`declare const` ambient（langStore.ts NEW）。
3. `src/lib/render/SettingsPanel.test.tsx` — 4 it.skip。panel 渲染 + lang toggle（ns-settings-lang-en/zh）切换+持久化。`declare const SettingsPanel: FC` + langStore ambient。
4. `src/lib/render/i18n-switch.test.tsx` — 3 it.skip。Toolbar aria-label zh/en 切换 + testid 集合守卫。real import `./Toolbar`（props() factory 镜像 Toolbar.test.tsx）+ langStore ambient + `act()` flush 外部 store 更新。

### 4.3 红阶段 import 策略（tsc-safe）

- **新模块**（langStore.ts / SettingsPanel.tsx）: `declare const`/`declare function` ambient（1a.13 先例 memory `newsd-atdd-red-scaffold-declare-const-for-new-file`）。DS 首步换 real import。
- **现有模块扩展**（i18n.ts E27 / errorDetection ERROR_TYPE_LABEL）: real import 现有 export；missing key 用 `string as DictKey` cast（string -> literal-union 降型，tsc 允许）；不 augment DictKey。
- **gov 注释**: 每 it.skip 标 `// gov: AC-N + SDR#M + T-K`（可追溯）。
- **无 placeholder 断言**（step-04c §2 合规）。

### 4.4 AC-8 渲染架构核验（ATDD 核心职责，project-context 1a.8 lesson）

grep CanvasView.tsx 三处文案点:

- L558 `guide.textContent = "按 S 放置存量..."` — **DOM textContent**（guide 是 DOM ref）✓ 可 getByText 断言。
- L1346 `warnRef.current = err.message ?? "Flow creation failed"` — warnRef(string holder) -> warnElRef(DOM) 渲染 ✓ DOM 可断言。
- L1459 `promptStore.confirm("新建将清空...")` — PromptPanel confirm modal ✓ DOM 可断言。
- 结论: AC-8 三处均 DOM 渲染，**非 canvas 绘制**；1a.8「WebGL canvas 无 DOM overlay」顾虑**不适用** AC-8。DS 可在 CanvasView.test.tsx 加 zh/en 文案断言（component 级，jsdom null ctx 下 draw 早退但 DOM 文案仍在）。

---

## Step 4C: Aggregate

### 4C.1 TDD 红阶段合规（step-04c §2）

- ✅ 全部测试 `it.skip()`（vitest 35 skipped 含本 4 文件 22 个 + 预存 13）。
- ✅ 无 `expect(true).toBe(true)` placeholder。
- ✅ 全部 assert 预期行为（E27 返回值 / store subscribe / aria-label 切换 / testid 不变）。
- ✅ expected_to_fail: 新行为测试（tier3 / langStore / SettingsPanel / 切换）解 skip 后 RED；sanity/guard 测试 green-ready。

### 4C.2 基线保持验证（AC-15）

| 指标           | baseline (ca4ce02)              | after (4 红文件)                           | 结果                                                          |
| -------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| tsc --noEmit   | 0 errors                        | 0 errors                                   | ✅ 不变                                                       |
| vitest passed  | 730                             | 730                                        | ✅ 不变（it.skip 对 passed 贡献 0，故 730 now == 730 before） |
| vitest failed  | 0                               | 0                                          | ✅ 不变                                                       |
| vitest skipped | 13（预存，memory "1skip" 陈旧） | 35（13 + 22 新红脚手架）                   | 预期上升                                                      |
| test files     | 36（31 pass + 5 all-skip 预存） | 40（31 pass + 9 all-skip = 5 预存 + 4 新） | 预期上升                                                      |

- 命令: `npx tsc --noEmit`（exit 0）/ `npx vitest run`（730 passed | 35 skipped | 0 failed, 92.25s）。
- **回归 gate PASS**: passed 不变 + tsc 0 + 0 fail。skip/file 上升 = 红脚手架预期足迹（4 all-skip 文件 + 22 it.skip）。
- e2e 全套件: 本步骤不跑（红脚手架不改 src 实现，e2e 29 绿基线不受影响；DS green 阶段跑全套件 AC-15）。

### 4C.3 Fixture 需求

- 无独立 fixture 文件（复用现有 setup.ts jsdom stub + 内联 props() factory + localStorage.clear() afterEach）。
- DS green 阶段如需 lang=zh fixture: vi.mock langStore 固定 zh（Q4=A），加到现有 component test。

### 4C.4 汇总统计

- tdd_phase: RED
- total_tests (新): 22（全 skip）
- unit: 15（i18n 6 + langStore 9）/ component: 7（SettingsPanel 4 + i18n-switch 3）/ e2e: 0（N/A）
- execution: SEQUENTIAL orchestrator-direct（无 subagent）
- knowledge_fragments_used: test-quality.md（Playwright utils SKIPPED）

---

## Step 5: Validate & Complete

### 5.1 验证

- ✅ 前置满足（story ready-for-dev / 基线 ca4ce02 / TEA 装齐）。
- ✅ 测试文件创建正确（4 文件，tsc 0 + vitest 收集无错）。
- ✅ checklist 覆盖 AC-1..AC-15（逐 AC 映射文件/gate）。
- ✅ 全 `it.skip`（红阶段）。
- ✅ story metadata + handoff 路径入 frontmatter。
- ✅ 无孤儿 browser / 临时产物入 `_bmad-output/`（非 /tmp）。

### 5.2 DS Green 阶段交接

1. **T1** i18n.ts: 扩展 dict + 实装 E27 fallback（3-tier + console.warn）-> 解 `i18n.test.ts` 6 skip -> RED->GREEN。
2. **T2** langStore.ts: 建 store（subscribe/getSnapshot/setLang + LANG_KEY="ns-lang" + detectLang 纯函数）-> 解 `langStore.test.ts` 9 skip；real import 替换 declare block。
3. **T3** SettingsPanel.tsx: 建组件（testid ns-settings-panel/lang-en/lang-zh/close）-> 解 `SettingsPanel.test.tsx` 4 skip；real import 替换 declare。
4. **T4** 11 文件 UI wiring（Toolbar/StatusBar/PropertyPanel/CanvasView/PromptPanel/PromptTabs/PromptCapsule/tabs×4/AtMentionAutocomplete/styles.css）接 langStore。
5. **T5-T8** 现有 component test 加 lang=zh fixture + 新 en case（AC-5/6/7/8/9 + AC-10 name/formula/ASCII 守卫）。
6. **T9** TABS refactor（Q6=C: 保留 key 删 label，组件内 t(tabKey, lang)）。
7. **T10** errorDetection ERROR_TYPE_LABEL 双语化（reshape Record<ErrorType,{zh,en}> 或路由 t() — DS 设计决策；AC-7 覆盖）。
8. **T11** grep 零残留中文（AC-12 gate）+ 全套件回归（AC-15: vitest 730+ + e2e 29）。

### 5.3 关键风险 / 假设

- **DS 签名自由度**: langStore/SettingsPanel/detectLang 硾切 API 由 DS 定；测试钉行为非签名。DS 若命名不同，declare block 换 real import + 符号名，断言不动。
- **AC-7 ERROR_TYPE_LABEL reshape**: 当前 `Record<ErrorType, string>`（中文常量）。DS 改 `Record<ErrorType,{zh,en}>` 或函数或路由 `t()` — 测试钉「双语 label 可达」结果（DS 在 StatusBar.test.tsx 加 en case）。
- **AC-10 testid 守卫预存 trivially-green**: Toolbar 未接 langStore 前 setLang 不触发 re-render，testid 集合不变（守卫 trivially pass）；DS 接线后变有意义。非红驱动（红驱动是 AC-5 aria-label 切换）。
- **Q2 Toolbar 4 tool button testid 解耦**（select/stock/cloud/flow）: 若 DS 改 `ns-toolbar-btn-选择`->`ns-toolbar-btn-select` 等，现有 Toolbar.test.tsx 相应 selector 须同步（DS 任务，非回归）。

### 5.4 生成文件清单

```
src/lib/sd/i18n.test.ts              (Unit, AC-1/13/14, 6 it.skip)
src/lib/sd/langStore.test.ts         (Unit, AC-2/4/11, 9 it.skip)
src/lib/render/SettingsPanel.test.tsx (Component, AC-3, 4 it.skip)
src/lib/render/i18n-switch.test.tsx  (Component, AC-5/10, 3 it.skip)
_bmad-output/test-artifacts/atdd-checklist-1a-9-i18n.md (本文件)
```

### 5.5 下一步

- **DS (bmad-dev-story)**: T1 起 green 阶段，逐 task 解 skip -> RED -> 实装 -> GREEN。
- ATDD 红脚手架完成，移交 DS。
