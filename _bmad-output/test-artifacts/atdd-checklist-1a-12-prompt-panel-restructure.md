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
lastSaved: "2026-07-16"
storyId: "1a.12"
storyKey: "1a-12-prompt-panel-restructure"
storyFile: "_bmad-output/implementation-artifacts/1a-12-prompt-panel-restructure.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-1a-12-prompt-panel-restructure.md"
generatedTestFiles:
  [
    "src/lib/render/PromptTabs.test.tsx",
    "src/lib/render/PromptCapsule.test.tsx",
    "src/lib/render/tabs/AlertTab.test.tsx",
    "src/lib/render/tabs/MilestoneTab.test.tsx",
    "src/lib/render/tabs/SourceSinkTab.test.tsx",
    "src/lib/render/tabs/StockTab.test.tsx",
    "src/lib/render/AtMentionAutocomplete.test.tsx",
    "src/lib/sd/errorDetection.test.ts",
    "src/lib/render/promptStore.test.ts",
    "src/lib/render/PromptPanel.test.tsx",
    "src/lib/render/StatusBar.test.tsx",
    "src/lib/render/__tests__/PropertyPanel.test.tsx",
    "src/lib/render/CanvasView.test.tsx",
  ]
inputDocuments:
  - "_bmad-output/implementation-artifacts/1a-12-prompt-panel-restructure.md"
  - "_bmad-output/test-artifacts/atdd-checklist-1a-11-entity-naming-mechanism.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md"
  - "vitest.config.ts"
  - "playwright.config.ts"
  - "src/test/setup.ts"
  - "src/lib/render/PromptPanel.test.tsx"
  - "_bmad/tea/config.yaml"
---

# ATDD Checklist - 1a.12 PromptPanel 4-tab 重构

沟通语言: 中文 半角标点 (story §7 red-line 覆盖 config.yaml English)

## Step 01: Preflight & Context Loading

### 1.1 Stack Detection

- `config.test_stack_type` = `auto` -> 自动检测
- project-root 扫到 `package.json` (react 19.2 / @tanstack/react-router / vite ^8) + `playwright.config.ts` + `vite.config.ts` -> frontend indicators only
- 结论: `{detected_stack}` = **frontend**

### 1.2 Prerequisites (Hard Requirements)

- Story 已批准, AC 清晰 (22 AC): ✅ (VS PASS, ready-for-dev)
- 测试框架配置: ✅ `playwright.config.ts` + `vitest.config.ts`
- 开发环境可用: ✅ (本地工具链已装, 见 memory newsd-local-toolchains-installed)
- 无 HALT 条件

### 1.3 Story Context

- story_file: `_bmad-output/implementation-artifacts/1a-12-prompt-panel-restructure.md`
- story_id: `1a.12` / story_key: `1a-12-prompt-panel-restructure`
- 状态: ready-for-dev, VS PASS
- 规模: 22 AC (AC-1..AC-22) + 22 SDR (#1-#12 设计契约 / #20-#24 不变量 / #30-#34 过程元) + 10 Tasks (T0-T10)
- 关键约束:
  - T0: DS 起手跑 `/bmad-testarch-atdd` 产红脚手架 (本 checklist)
  - 全 22 AC 为 jsdom/组件级, 无 canvas-click e2e (SDR#33 defer 1b)
  - §6 Testing Standards: filter 非 hollow / controlled 双路径 (onChange+onBlur) / camera.center spy 断言参数非仅 toBeCalled / fakeTimers (vi.useFakeTimers + advanceTimersByTime(3000)) for pulseHighlightId/ghostShadowPos 3s auto-clear
- 新文件 (story §file list): PromptTabs.tsx, tabs/{AlertTab,MilestoneTab,SourceSinkTab,StockTab}.tsx, PromptCapsule.tsx, AtMentionAutocomplete.tsx, errorDetection.ts (pure: resolveActivateTab/classifyCloud/filterByTab/detectSetupErrors)
- baseline: 594 passed | 1 skipped / 21 files (vitest @1bb3598) + e2e 29/29
- baseline_commit: **e6b9cea** (main HEAD, 冻结)

### 1.4 Framework & Existing Patterns

- vitest 4.1.9 (jsdom) + @testing-library/react 16.3.2 + @playwright/test 1.61.1
- vitest.config.ts: `environment="jsdom"` / `setupFiles=["./src/test/setup.ts"]` / `include=["src/**/*.test.{ts,tsx}"]`
  - include glob `**/*.test.{ts,tsx}` 同时匹配 `__tests__/1a-12/*.red.test.tsx` 与扁平 `*.test.tsx` (已核验, 非工具阻断)
- src/test/setup.ts stubs: matchMedia / ResizeObserver (no-op fire cb once) / HTMLCanvasElement.getContext->null (CanvasView draw early-return); afterEach cleanup
- 现有 render 测试结构 (Glob 核验) = 全扁平 co-location:
  - 纯模块扁平: camera.test.ts / palette.test.ts / dirty-rect.test.ts / perf-probe.test.ts / cap11-shadowblur-guard.test.ts / vram/*.test.ts
  - 组件测试: PromptPanel.test.tsx / StatusBar.test.tsx / Toolbar.test.tsx / CanvasView.test.tsx 扁平于 src/lib/render/; PropertyPanel.test.tsx 于 **tests**/
  - **无 per-story 子目录** (1a.6/1a.7/1a.8/1a.11 四前例 ATDD checklist + git 1bb3598 核验均无)
- playwright.config.ts: testDir `./e2e`, chromium, WebGL2 SwiftShader args, snapshotDir `./e2e/__snapshots__`
- PromptPanel.test.tsx (1a.7 baseline, 101 行): T10 红脚手架需改 - `caps messages at MAX_MESSAGES` (假设 100, 需 1000) / `⏏ toggle expands then collapses` (假设单 collapsed 结构, 需 4-tab capsule) / confirm+toast+clearResolved 保留

### 1.5 TEA Config Flags

- source: `_bmad/tea/config.yaml`
- tea_use_playwright_utils: **true** (但 1a.12 零 e2e SDR#33 defer 1b -> Playwright Utils profile 不加载, 无收益纯耗 context)
- tea_use_pactjs_utils: false
- tea_pact_mcp: none
- tea_browser_automation: auto
- test_stack_type: auto (-> frontend)
- user_name: Jaron
- communication_language: English (story §7 red-line 覆盖 -> 中文 半角标点)

### 1.6 Knowledge Fragments Loaded

tiered loading per tea-index.csv (路径 `.claude/skills/bmad-testarch-atdd/resources/knowledge/`):

- Core (always): data-factories.md / component-tdd.md / test-quality.md / test-healing-patterns.md
- Frontend: selector-resilience.md / timing-debugging.md
- Playwright Utils (frontend full UI+API profile): **SKIP** - 1a.12 零 e2e (SDR#33 defer 1b)
- 关键提取:
  - component-tdd: Red-Green-Refactor; 组件测试 <100 行; fresh providers per test 防 state bleed
  - test-quality: 确定性 (无 hard wait / 无 conditional flow / 无 try-catch flow) / <300 行 / <1.5min / self-cleaning / 断言显式可见非藏 helper / faker 唯一数据防 parallel 碰撞
  - selector-resilience: 层级 data-testid > ARIA > text > CSS/ID; filter() over nth(); scope container 防歧义
  - timing-debugging: network-first (intercept before navigate); 事件等待非时间等待; toBeVisible() 含动画非 toBeAttached; SPAs 忌 networkidle
  - data-factories: factory(overrides) 返回完整对象; API seed 非 UI setup
  - test-healing-patterns: 5 类失败签名 (stale selector / race / dynamic data / network / hard wait) + healing 策略
- fakeTimers 适用 (§6 要求 pulseHighlightId/ghostShadowPos 3s auto-clear): vi.useFakeTimers + advanceTimersByTime(3000), 非 hard wait (test-quality + timing-debugging 一致)

### 1.7 Step 6 决策 - 测试落位 (用户裁定 2026-07-16)

- **裁定: 扁平 co-location** (用户显式确认, 选 Recommended 项)
- 落地: 新组件/模块新建扁平 `*.test.tsx` 与现有文件同目录 (`src/lib/render/` 或 `__tests__/` 视模块位置); 改现有 `PromptPanel.test.tsx` (T10); 纯 `.test.tsx` 命名 (无 `.red.` infix 无 `1a-12/` 子目录)
- **偏离 story T0**: T0 (line 67/255) 指定 `src/lib/render/__tests__/1a-12/` 子目录 + `PromptPanel-4tab.red.test.tsx` (`.red.` infix), 理由「遵 1a.11 分节」
- **偏离依据**: 核查 1a.6/1a.7/1a.8/1a.11 四前例 ATDD checklist + git 1bb3598, 均用扁平 co-location; 1a.11 实为追加到扁平 `__tests__/PropertyPanel.test.tsx` (checklist line 93「文件尾追加 describe」) 无子目录无 `.red.` -> 「遵 1a.11 分节」理由不实; `.red.` 阶段性命名对 green 后持久文件有误导, TEA 官方示例用纯 `.test.tsx`; T0 单文件对 22 AC 不足 (test-quality <300 行需多文件)
- **traceability**: 此偏离为 ATDD 阶段用户授权决策, story T0 文本不改 (ATDD 不编辑 story); DS/CR 须以本节裁定为准

### 1.8 Green-phase 可行性 (1a.8 教训应用)

- 1a.12 全部新特性 (PromptTabs/4 tabs/PromptCapsule/AtMentionAutocomplete/errorDetection) 均为 DOM 组件/纯函数
- relation jump 断言 selectedId + spy(camera.center) 参数, 非 canvas 视觉 e2e (story line 20 明示)
- setup.ts canvas.getContext->null 不阻断 (CanvasView draw early-return, 组件树 DOM 可渲染可断言)
- 结论: **green-phase 可达成** (对比 1a.8 WebGL canvas e2e selector mismatch 不可行 -> defer B)

---

## Step 02: Generation Mode

### 2.1 模式选择: AI Generation (默认)

- detected_stack = frontend, AC 清晰 (22 AC VS PASS), 场景为标准组件交互 (tab 切换 / autocomplete 下拉 / error surfacing / collapse-expand)
- 录制模式 (Recording) 不适用: 1a.12 处于红阶段, 新特性 (PromptTabs / 4 tabs / PromptCapsule / AtMentionAutocomplete) 尚未实现 -> 无现存 UI 可录制 selector/结构; 录制仅适用于已存在 UI 的 live browser 验证
- tea_browser_automation = auto, 但录制为可选项 (仅复杂 drag/drop/wizard 需 live 验证时), 1a.12 无此类交互
- 1a.8 frontend ATDD 前例亦用 AI generation (无录制)

### 2.2 录制工具 (备查, 本 story 不启用)

- auto 模式下: simple recording 用 CLI (`playwright-cli -s=tea-atdd-${timestamp} open/snapshot`), complex recording 用 MCP (browser_* tools)
- 本 story 不启用 (红阶段无现存 UI); 记此仅备 step-03/04 若发现需 live 验证时回查

### 2.3 确认

- **选定模式: AI Generation**
- 理由: AC 清晰 + 标准场景 + 红阶段 (特性未实现, 录制不可行) + frontend 无复杂 live 交互
- 直接进入 Step 03 (Test Strategy)

## Step 03: Test Strategy

### 3.1 层选择理由 (Level Selection)

detected_stack = `frontend` -> step-03 可选层 = E2E / API / Component / Unit. 本 story 层收窄:

- **Component (vitest + @testing-library/react, jsdom)**: DOM 可渲染可断言的 React 组件 (PromptTabs / PromptCapsule / 4 tab 子组件 / AtMentionAutocomplete / StatusBar ⚠N / CanvasView 跳转通道). 主力层.
- **Unit (vitest, 纯函数)**: 无 React 依赖的纯函数 (resolveActivateTab / filterByTab / classifyCloud / detectSetupErrors 三检测器). 与源文件 flat co-located.
- **E2E (Playwright)**: **本 story 不新增**. SDR#33 显式 defer canvas-click e2e 到 1b (CanvasView = WebGL canvas AD-8, 无 DOM overlay, 1a.8 D4 已 defer). 全 AC 为 jsdom/component/unit (story AC header line 20 明示). e2e 29/29 baseline 维持不动, 不引入新 e2e for tab 骨架 (CS 决定 defer 到 1a-13/1a.9, story §6).
- **API**: 不适用 (无后端).

层去重原则: 同一行为不跨层重复. 纯函数 (resolveActivateTab/classifyCloud/filterByTab/detectSetupErrors) 优先 Unit 单测覆盖组合矩阵 (SDR 守卫指定的 9/4/4/3 组); Component 层只验该函数 wired 进 UI 后的渲染 + 交互, 不重复纯函数矩阵.

### 3.2 AC -> 场景 -> 层 -> 优先级 -> gov 映射表

| AC        | 测试场景 (red 断言样例)                                                                                                                                                                                                                                                                                                                                    | 层                 | 优先级 | gov (SDR)      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------ | -------------- |
| **AC-1**  | (a) 展开态渲染 4 tab 按序 `!`/里程碑/源汇/存量 + 每个 `role=tab` + testid `ns-prompt-panel-tab-{alert\|milestone\|sourcesink\|stock}`; (b) 默认 activeTab=alert (无 lastActiveTab 兜底); (c) 点非激活 tab -> aria-selected 翻转 + `role=tabpanel` 同步                                                                                                     | Component          | **P0** | SDR#1, SDR#3   |
| **AC-2**  | (a) 未答 confirm 渲染 `--confirm` (--ns-err 红基座) + `[确认]`/`[取消]` 按钮; (b) alert 渲染 `--alert` (--ns-warn 橙, 非红); (c) resolved confirm 渲染 `--resolved` 灰; (d) **negative**: info/toast 类型不出现在 "!" tab (filterByTab 排除)                                                                                                               | Component + Unit   | **P0** | SDR#2          |
| **AC-3**  | (a) `★ 已达成` / `☆ 未达成` 两栏占位骨架; (b) defer 提示文案 `游戏化中心 (Epic 5.4) 接入前占位` 存在; (c) 无 store 依赖 (纯静态)                                                                                                                                                                                                                           | Component          | **P2** | SDR#5          |
| **AC-4**  | (a) 表头 `名称\|连接\|流量\|问题` 4 列; (b) C1(仅 out)行首 `☁` + class `--source`; (c) C2(仅 in)行首 `◼` + class `--sink`; (d) **negative**: stock 不出现在此 tab; (e) `流量` 列显 `-` stub; (f) 空 store -> `尚无源/汇` 空态                                                                                                                              | Component + Unit   | **P1** | SDR#6, SDR#7   |
| **AC-5**  | (a) 表头 `名称\|变化值\|单位\|问题` 4 列; (b) S1(>0)行首 `⚪`+`--pos`; (c) S2(<0)行首 `⚫`+`--neg`; (d) S3(=0)行首 `☯`+`--zero`; (e) **negative**: cloud/flow 不出现; (f) 变化值 `-` stub; (g) 空态 `尚无存量`                                                                                                                                             | Component          | **P1** | SDR#6          |
| **AC-6**  | (a) 点 stock/cloud 行 -> `onRowClick(id)` 触发; (b) `setSelectedId(id)` 被调; (c) `camera.center(id)` spy 被调 + **断言参数 = id** (非仅 toBeCalled, memory 1a.8 F-1 教训); (d) PropertyPanel 以 selectedId 展开                                                                                                                                           | Component          | **P1** | SDR#10         |
| **AC-7**  | (a) 收起态单行胶囊 `[!][里程碑][源/汇][存量] ⏏️`; (b) 每 tab 名 testid 复用展开态命名; (c) 不展示内容体; (d) 高度 = COLLAPSED_H=26                                                                                                                                                                                                                         | Component          | **P0** | SDR#3          |
| **AC-8**  | (a) 有未答 confirm -> `"!"` tab 名附 `--flash` class; (b) **negative**: 无未答 -> 无 flash class; (c) flash = CSS animation (非 shadowBlur, AD-9, 仅断言 class 存在非动画帧)                                                                                                                                                                               | Component          | **P1** | SDR#22 (AD-9)  |
| **AC-9**  | (a) 有未答 + 点 ⏏️ -> 展开 + activeTab=alert (强制); (b) 无未答 + lastActiveTab=stock + 点 ⏏️ -> activeTab=stock; (c) 无未答 + 首次会话(无 lastActiveTab) + 点 ⏏️ -> activeTab=alert (兜底)                                                                                                                                                                | Component + Unit   | **P0** | SDR#3          |
| **AC-10** | (a) 有未答 + 点 `里程碑` tab 名 -> 展开 + activeTab=alert (强制路由, 忽略被点 tab); (b) 无未答 + 点 `存量` tab 名 -> 展开 + activeTab=stock                                                                                                                                                                                                                | Component + Unit   | **P1** | SDR#3          |
| **AC-11** | (a) 展开态右上角 ⏏️ aria-label = `收起提示中心` (advisory-1: 引用 L181-189 非 L138-146); (b) 点击 -> setExpanded(false) + persist lastActiveTab (sessionStorage `ns-prompt-panel-last-tab`)                                                                                                                                                                | Component          | **P1** | SDR#3, SDR#8   |
| **AC-12** | (a) flow 端点未连 (fromId 指向已删元素) -> ⚠N 显示 + tab 行 `问题` 列 badge `端点未连`; (b) 孤立 cloud -> badge `孤立`; (c) parallel flow -> badge `平行`; (d) **negative**: N=0 -> ⚠N `display:none`; (e) 无运算错误路由 "!" tab                                                                                                                          | Component + Unit   | **P0** | SDR#9          |
| **AC-13** | (a) alert 渲染于 "!" tab; (b) `promptStore.alert(text)` 后 messages count=2 (alert + toast 副本); (c) `vi.useFakeTimers + advanceTimersByTime(4000)` -> toast 消失 (count-1) alert 保留; (d) 主 alert 不 auto-remove; (e) "!" tab 未读角标 count += 1                                                                                                      | Component + Unit   | **P0** | SDR#4          |
| **AC-14** | (a) orphan-cloud + dangling-flow-endpoint + parallel-flow 独立检测 (返回非空); (b) **negative/占位**: 量纲检测函数存在但返回 `[]`; (c) 公式悬空检测函数存在但返回 `[]` (非 UI 骨架, 仅函数存在性 + 返回空)                                                                                                                                                 | Unit               | **P2** | SDR#9          |
| **AC-15** | (a) push 到 MAX_MESSAGES=1000 后 trim 保留最新 1000; (b) **negative**: 未答 confirm 永不被 trim (push 1000+ 后 confirm 仍在); (c) 每 tab 内容体 `overflow-y:auto`                                                                                                                                                                                          | Unit + Component   | **P1** | SDR#12, SDR#21 |
| **AC-16** | (a) 点 ⚠N -> popover 打开 + `role=listbox` + 列错误清单 (每项 `[类型] 主体名 - 问题描述`); (b) 点某项 -> setSelectedId(subjectId) + camera.center spy 被调 (**断言参数=id**); (c) 主体 mark `pulse-highlight` class; (d) `advanceTimersByTime(3000)` -> class 自动移除                                                                                     | Component          | **P0** | SDR#10         |
| **AC-17** | (a) 点 tab 行 `问题` badge + 主体存在: 同 AC-16 (setSelectedId + camera.center + pulse-highlight); (b) **主体已删** (flow fromId 元素已 delete): 不调 camera.center, mark `ghost-shadow` class (lastKnown pos); (c) `advanceTimersByTime(3000)` -> class 移除                                                                                              | Component          | **P1** | SDR#10         |
| **AC-18** | (a) **negative**: 错误清单不含 `duplicate-name` 分类 (1a.11 @1bb3598 已根除, assertNameAvailable); (b) 剩三类: orphan-cloud + dangling-flow-endpoint + parallel-flow                                                                                                                                                                                       | Unit               | **P2** | SDR#23, SDR#9  |
| **AC-19** | (a) 选中 flow formula=`10 * @s1` + store 含 stock "库存"(id=s1) + 焦点 -> 显示 `10 * 库存` (formatFormulaForEditor 复用); (b) 输入 `@` -> autocomplete 下拉列 stock+cloud 名 (**过滤 flow**); (c) 选中 "库存" -> 插入 `@s1` (nameMap 反向映射); (d) blur -> formula 存 `@s1` 形; (e) controlled: onChange + onBlur **双路径** (SDR#11, 避免 F-2 类 hollow) | Component          | **P0** | SDR#11, SDR#23 |
| **AC-20** | (a) 输入 `@x` 无匹配 -> 下拉显 `无匹配` 空态 (不阻塞 typing); (b) Esc -> 关闭下拉 + 输入内容保留                                                                                                                                                                                                                                                           | Component          | **P1** | SDR#11         |
| **AC-21** | (meta/guard) 依赖链 (1a.8 done @ee63b1d + 1a.11 done @1bb3598 + FR-ELEM-6 + FR-UI-3 修订) + 执行顺序 + defer 项 (里程碑->5.4 / 量纲->1b / 公式悬空->4.2 / e2e->1b). **无运行时测试** - process AC, DS 执行顺序遵 story 即满足                                                                                                                              | (无)               | **P3** | meta/guard     |
| **AC-22** | (a) vitest 全套件 N/N 绿 (N = 594 baseline + 新增, DS 实测 count, 非子集 - memory newsd-e2e-attestation-full-suite-not-subset); (b) 含改写 1a.7 PromptPanel.test.tsx (cap 1000 + tab 结构) + 1a.8 PropertyPanel.test.tsx (D1) 无回归; (c) e2e Playwright 29/29 绿 (baseline 不动); (d) tsc 0 errors                                                        | Integration (gate) | **P0** | SDR#24         |

### 3.3 优先级判据 (P0-P3)

- **P0 (must-have red-first, 9 项)**: AC-1/2/7/9/12/13/16/19/22. 核心 tab 结构 + 错误二分归宿 + alert 双推 + 关联跳转 + autocomplete + 回归 gate. 阻塞 story 交付.
- **P1 (重要行为, 10 项)**: AC-4/5/6/8/10/11/15/17/20 + AC-8. tab 内容渲染 + 行点击 + flash + 路由 + cap + ghost-shadow + 空态. 故事完整性.
- **P2 (stub/不变量, 3 项)**: AC-3 (里程碑 stub defer 5.4) / AC-14 (占位返回 []) / AC-18 (重名源消失不变量验证). 低风险但 SDR 守卫要求覆盖.
- **P3 (meta, 1 项)**: AC-21. 无运行时测试, process-level.

### 3.4 红相验证方法 (Red Phase Verification)

红相 = 所有新测试在实现前 **FAIL**, baseline 594/1skip 保持绿 (新测试文件不影响现有). 验证机制:

- **新组件不存在** (`PromptTabs` / `PromptCapsule` / `AlertTab` / `MilestoneTab` / `SourceSinkTab` / `StockTab` / `AtMentionAutocomplete`): import 抛 `module not found` -> render 抛 TypeError -> 断言 fail. (裁决 A: 不放宽严禁改产品代码, 不为红相造 stub 源文件; 红即红在 import-resolution.)
- **新纯函数不存在** (`resolveActivateTab` / `filterByTab` / `classifyCloud` / `detectSetupErrors` + 三检测器): import 抛 `module not found` 或 `is not a function` -> 断言 fail.
- **新 store 测试 (B2)**: `promptStore.test.ts` (new flat) 测**已存在**的 `promptStore` 单例. 非 import-red (模块在), 而是**断言红**: (a) AC-13 `alert()` 后 count=2 (alert+toast 副本, SDR#4) - 实现 alert() 只 push 1 -> 期望 2 实得 1 fail; (b) AC-15 cap=1000 (push 1002 -> 期望 length 1000) - 实现 MAX_MESSAGES=100 -> 期望 1000 实得 100 fail; (c) filterByTab 4×4 矩阵 import-red (函数未导出).
- **改写 baseline 测试 (T10, B2 拆分)**: cap-1000 逻辑迁 `promptStore.test.ts` (见上, 断言红); `PromptPanel.test.tsx` 仅留 `⏏ toggle` (baseline L88-100 假设单行) -> 改 4 tab + capsule 结构断言后 fail (改写即红) + AC-15 scroll container (`overflow-y:auto` 断言, 结构未建 fail). store 行为 (alert 双推 / filterByTab) 不在此测 (B2 迁 promptStore.test.ts).
- **D1 controlled 转换 (T9)**: PropertyPanel formula textarea controlled + autocomplete 断言 -> uncontrolled baseline 下 onChange/autocomplete 不触发 -> fail.
- **绿相前置**: 594 baseline 全绿 (新测试隔离在新文件 + 改写部分预期 fail). 若 baseline 出现非预期 fail -> 测试本身写错 (非红相), 须修测试非改实现.

### 3.5 断言纪律 (Assertion Discipline)

遵 story §6 + memory `newsd-story-cycle-test-quality-and-step8-audit-trail`:

1. **filter 类不 hollow**: filterByTab / detectSetupErrors / SourceSinkTab+StockTab 内 filter. red 先验证非空返回 + 包含预期项 (非"返回空即通过"). AC-2(d) / AC-4(d) / AC-5(e) / AC-14(a) / AC-18(b) 均含 positive 断言 (返回包含预期) + negative 断言 (排除不应有项).
2. **controlled 双路径**: AC-19 PropertyPanel formula controlled. 须触发 onChange (插入文本) + onBlur (persist) 双路径 (SDR#11, 避免 1a.8 F-2 类 hollow). 仅断 onChange 不够.
3. **spy 断言参数**: AC-6 / AC-16 camera.center spy. 断言 `toHaveBeenCalledWith(id)` 或 `expect(spy.mock.calls[0][0]).toBe(id)`, 非 `toBeCalled()` (memory 1a.8 F-1 教训).
4. **fakeTimers (非 hard wait)**: AC-13 (4s toast auto-remove) / AC-16 (3s pulse-highlight auto-clear) / AC-17 (3s ghost-shadow auto-clear). 用 `vi.useFakeTimers()` + `vi.advanceTimersByTime(ms)` + 断言状态翻转. **禁** `waitForTimeout` / `setTimeout(real)` / `await new Promise(r=>setTimeout(r,ms))` (test-quality.md).
5. **selector 层级**: data-testid > ARIA (role/aria-label/aria-selected) > text > CSS/ID. 本 story 已指定 testid (`ns-prompt-panel-tab-{key}` / `ns-prompt-panel-toggle` / `ns-prompt-panel-clear`). 动态内容 (行名) 用 regex. `filter()` over `nth()` (selector-resilience.md).
6. **test-quality DoD**: deterministic (无 if/else 流控 / 无 try-catch 流控) / <300 lines per file / <1.5min / self-cleaning (afterEach 清 sessionStorage/fakeTimers restore) / explicit assertions (无 helper 内 hidden expect) / faker 不需要 (story 元素 id 固定).
7. **绿相可达性**: 全 1a.12 特性 = DOM 组件 + 纯函数. setup.ts canvas.getContext->null 不阻塞 (CanvasView draw 早退, 组件树 DOM 可渲染可断言). 异于 1a.8 WebGL canvas e2e (selector mismatch, defer B). 绿相可行 (§1.8 已确认).

### 3.6 产出文件映射 (Output File Mapping)

遵 §1.7 用户裁定 = 扁平 co-location (new flat *.test.tsx co-located with source; modify existing; 无 `1a-12/` subdir, 无 `.red.` infix). 现有布局核 (Glob 实测): 多数 flat (`palette.ts`+`palette.test.ts`), 2 legacy `__tests__/` 例外 (`__tests__/PropertyPanel.test.tsx` / `sd/__tests__/dimensionalCheck.test.ts`), 无 `promptStore.test.ts`.

**新增 flat test 文件 (co-located with new source, 9 文件; B2 裁决新增 #9):**

| #   | 测试文件 (new)                                  | 源文件 (new/existing)                      | 覆盖 AC                                                                                         | 层        |
| --- | ----------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------- |
| 1   | `src/lib/render/PromptTabs.test.tsx`            | `src/lib/render/PromptTabs.tsx`            | AC-1, AC-8(展开态 flash)                                                                        | Component |
| 2   | `src/lib/render/PromptCapsule.test.tsx`         | `src/lib/render/PromptCapsule.tsx`         | AC-7, AC-8(胶囊 flash), AC-9, AC-10, AC-11                                                      | Component |
| 3   | `src/lib/render/tabs/AlertTab.test.tsx`         | `src/lib/render/tabs/AlertTab.tsx`         | AC-2, AC-13                                                                                     | Component |
| 4   | `src/lib/render/tabs/MilestoneTab.test.tsx`     | `src/lib/render/tabs/MilestoneTab.tsx`     | AC-3                                                                                            | Component |
| 5   | `src/lib/render/tabs/SourceSinkTab.test.tsx`    | `src/lib/render/tabs/SourceSinkTab.tsx`    | AC-4, AC-6(row), AC-17(badge)                                                                   | Component |
| 6   | `src/lib/render/tabs/StockTab.test.tsx`         | `src/lib/render/tabs/StockTab.tsx`         | AC-5, AC-6(row), AC-17(badge)                                                                   | Component |
| 7   | `src/lib/render/AtMentionAutocomplete.test.tsx` | `src/lib/render/AtMentionAutocomplete.tsx` | AC-19(trigger+insert), AC-20                                                                    | Component |
| 8   | `src/lib/sd/errorDetection.test.ts`             | `src/lib/sd/errorDetection.ts`             | AC-12(检测器), AC-14, AC-18                                                                     | Unit      |
| 9   | `src/lib/render/promptStore.test.ts` (B2)       | `src/lib/render/promptStore.ts` (existing) | AC-13(store: alert 双推+toast 4s), AC-15(store: cap 1000+未答 confirm 不 trim), filterByTab 4×4 | Unit      |

**修改 existing test 文件 (4 文件, T2/T7/T8/T9/T10):**

| #   | 测试文件 (existing)                                                                    | 修改内容                                                                                                                                                                                                                                                                   | 覆盖 AC                                               | 层        |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------- |
| 9   | `src/lib/render/PromptPanel.test.tsx` (flat, 1a.7 baseline)                            | ⏏ toggle 单行->4 tab+capsule 结构 (T10 改写即红) + AC-15 scroll container (`overflow-y:auto`) + AC-1 integration smoke + 1a.7 回归 (confirm T/F / pin / toast / clearResolved 保留绿). store 行为 (alert 双推 / filterByTab / cap 1000) B2 迁 promptStore.test.ts 不在此测 | AC-11, AC-15(scroll), AC-22(回归) + AC-1(integration) | Component |
| 10  | `src/lib/render/__tests__/PropertyPanel.test.tsx` (legacy subdir, 1a.8/1a.11 baseline) | D1 controlled formula + autocomplete 集成 + F-2 回归 (切 selectedId -> draft 同步不泄漏, SDR#11 守卫)                                                                                                                                                                      | AC-19(集成), AC-22(F-2 回归)                          | Component |
| 11  | `src/lib/render/StatusBar.test.tsx` (flat, exists)                                     | 新增 ⚠N 字段 (N=0 hidden / N>0 显) + popover (role=listbox, 项 click)                                                                                                                                                                                                      | AC-12(⚠N), AC-16(popover)                             | Component |
| 12  | `src/lib/render/CanvasView.test.tsx` (flat, exists)                                    | onRowClick/onErrorClick 通道 -> setSelectedId + camera.center spy (参数断言) + pulseHighlightId (3s fakeTimers) + ghostShadowPos (3s fakeTimers)                                                                                                                           | AC-6, AC-16, AC-17                                    | Component |

**纯函数 unit test 归宿 (co-locate with source):**

| 纯函数                                                                                  | SDR 守卫     | 组合矩阵                           | 测试归宿                                                                                          |
| --------------------------------------------------------------------------------------- | ------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `resolveActivateTab(hasUnanswered, requestedTab, lastActiveTab)`                        | SDR#3 (9 组) | hasUnanswered×requested×lastActive | 与 PromptCapsule.tsx 或 PromptTabs.tsx (export 处) flat co-located; 若抽独立 util 则 util.test.ts |
| `filterByTab(msg, tab)`                                                                 | SDR#2 (4×4)  | type×tab                           | promptStore.ts 内 -> `promptStore.test.ts` (B2 新建 #9); 若抽独立 util 则 util.test.ts            |
| `classifyCloud(cloud, elements)`                                                        | SDR#7 (4 组) | 仅 out / 仅 in / 双向 / 均无       | 与 SourceSinkTab.tsx (export 处) flat co-located                                                  |
| `detectSetupErrors` + `detectOrphanCloud` / `detectDanglingFlow` / `detectParallelFlow` | SDR#9 (3 组) | 三错误源独立                       | `src/lib/sd/errorDetection.test.ts` (#8)                                                          |

**Step 4 生成时落实此映射; `generatedTestFiles` frontmatter 数组随生成逐个填入.**

> **裁决 C1 (纯函数矩阵归宿)**: `resolveActivateTab` / `filterByTab` / `classifyCloud` / `detectSetupErrors` 的组合矩阵 unit 测试, 按 T-task 最可能 export 的源文件 flat co-locate (上表 "测试归宿" 列). 这是 ATDD 红相的**最佳推测落点**, 非规格锁死; DS 实现 filterByTab 抽独立 util 或改落 promptStore.ts 时, 可**整体迁移**对应矩阵测试到实际 export 处 (test 跟 source 走, 不算改产品代码). 矩阵断言本身 (9/4×4/4/3 组) 不变.

### 3.7 红相边界与豁免

- **禁改产品代码** (memory 严禁): ATDD 仅产红脚手架, 不动 PromptPanel.tsx / promptStore.ts / PropertyPanel.tsx / errorDetection.ts(未建) 等实现.
- **禁 subagent** (memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`): orchestrator-direct, 不起 hunter subagent.
- **禁 canvas-click e2e** (SDR#33): 关联跳转仅 jsdom 断言 selectedId + spy(camera.center) + class 加/移, 视觉不做 e2e.
- **禁合并推 PR** (memory `newsd-one-push-per-story` + `newsd-sprint-status-separate-from-story-pr`): ATDD 产 scaffold only, 不 merge/push.
- **AC-21 无测试**: process AC, DS 执行顺序遵 story 即满足, 不产运行时测试 (P3).
- **vitest.config include** `src/**/*.test.{ts,tsx}` (实测): flat `tabs/*.test.tsx` / `src/lib/sd/*.test.ts` / `__tests__/*.test.tsx` 全匹配, 非 tooling blocker.

进入 Step 04 (Generate Tests) - 按 §3.6 产出文件映射生成红脚手架代码 + 验证红相.

## Step 04: Generate Tests

### 4.1 生成产物 (13 测试文件 = 9 新 + 4 改, 全部 Glob 落盘核验)

**新增 flat test 文件 (9, 裁决 A/B2/C1 落地):**

| #   | 测试文件 (new)                                  | 红相类型                                                | 覆盖 AC                        |
| --- | ----------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| 1   | `src/lib/render/PromptTabs.test.tsx`            | import-red (0 test)                                     | AC-1, AC-8                     |
| 2   | `src/lib/render/PromptCapsule.test.tsx`         | import-red (0 test)                                     | AC-7, AC-8, AC-9, AC-10, AC-11 |
| 3   | `src/lib/render/tabs/AlertTab.test.tsx`         | import-red (0 test)                                     | AC-2, AC-13                    |
| 4   | `src/lib/render/tabs/MilestoneTab.test.tsx`     | import-red (0 test)                                     | AC-3                           |
| 5   | `src/lib/render/tabs/SourceSinkTab.test.tsx`    | import-red (0 test)                                     | AC-4, AC-6, AC-17              |
| 6   | `src/lib/render/tabs/StockTab.test.tsx`         | import-red (0 test)                                     | AC-5, AC-6, AC-17              |
| 7   | `src/lib/render/AtMentionAutocomplete.test.tsx` | import-red (0 test)                                     | AC-19, AC-20                   |
| 8   | `src/lib/sd/errorDetection.test.ts`             | import-red (0 test)                                     | AC-12, AC-14, AC-18            |
| 9   | `src/lib/render/promptStore.test.ts` (B2)       | **assertion-red** (8 tests \| 6 failed \| 2 green 回归) | AC-13, AC-15, filterByTab 4×4  |

- 8 文件 import-red = `Failed to resolve import "src/lib/render/PromptTabs"` 等 (模块未建, 裁决 A 不放宽严禁改产品代码, 不造 stub 源文件).
- promptStore.test.ts (B2) = 模块已存在 (`./promptStore`), 文件**加载 + 测试运行 + 断言 fail** (非 import-red). 6 failed = AC-13 alert 双推 (count=2) + AC-13 toast 4s auto-remove (fakeTimers) + AC-15 cap 1000 (push 1002 -> 期望 1000 实得 100) + filterByTab toBeDefined anchor + filterByTab alert-tab 矩阵 (throw on undefined) + filterByTab element-tab 矩阵 (throw on undefined). 2 green = AC-13 alert 不 auto-remove (回归守卫) + AC-15 未答 confirm 不被 trim (回归守卫).

**修改 existing test 文件 (4, assertion-red 改写/追加):**

| #   | 测试文件 (existing)                               | 改写/追加                                                                                                                                          | 红相 (run + fail)                 |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 10  | `src/lib/render/PromptPanel.test.tsx`             | ⏏ toggle 单行->4 tab+capsule 改写即红 + AC-1 integration + AC-11 aria-label + AC-15 scroll container                                               | 10 tests \| 4 failed              |
| 11  | `src/lib/render/StatusBar.test.tsx`               | ⚠N 字段 (N=0 hidden / N>0 显) + popover (role=listbox + 项 click) 追加                                                                             | 17 tests \| 4 failed              |
| 12  | `src/lib/render/__tests__/PropertyPanel.test.tsx` | D1 controlled formula + autocomplete 集成 + F-2 回归追加 (1a.11 describe 尾)                                                                       | 52 tests \| 3 failed \| 1 skipped |
| 13  | `src/lib/render/CanvasView.test.tsx`              | onRowClick/onErrorClick 通道 -> setSelectedId + camera.center 参数断言 + pulse-highlight overlay 追加 (NO fakeTimers, 避 renderReady waitFor 冲突) | 92 tests \| 3 failed              |

### 4.2 红相验证结果 (vitest run 实测, baseline_commit e6b9cea)

```
Test Files  13 failed | 17 passed (30)
Tests       20 failed | 596 passed | 1 skipped (617)
Duration    46.42s
```

**20 failed 逐文件分布 (全为新红, 无 baseline 回归):**

| 文件                   | failed | AC                                     | 失败签名                                                         |
| ---------------------- | ------ | -------------------------------------- | ---------------------------------------------------------------- |
| promptStore.test.ts    | 6      | AC-13×2 / AC-15 / filterByTab×3        | count 1≠2 / length 100≠1000 / TypeError (undefined)              |
| PromptPanel.test.tsx   | 4      | AC-1 / AC-11 / AC-15(scroll) / ⏏toggle | null / aria-label 不匹配 / 无 overflow-y / 结构不匹配            |
| StatusBar.test.tsx     | 4      | AC-12×2 / AC-16×2                      | null (无 ⚠N 字段) / 无 listbox / onErrorClick 未调               |
| PropertyPanel.test.tsx | 3      | AC-19(a)/(b)/(e)                       | 显示 @uuid 非 name / 无 listbox / uncontrolled 不反映 store 更新 |
| CanvasView.test.tsx    | 3      | AC-6 / AC-16 / AC-17                   | null (无 tab row / 无 popover item / 无 pulse-highlight overlay) |

**8 import-resolution red 文件 (0 test, 集合错误):** AtMentionAutocomplete / PromptCapsule / PromptTabs / tabs/Alert / tabs/Milestone / tabs/SourceSink / tabs/Stock / errorDetection - 均 `Failed to resolve import "<new module>"`.

### 4.3 基线完整性核验

- baseline (vitest @1bb3598) = **594 passed | 1 skipped / 21 files**.
- 红相实测 = **596 passed | 1 skipped | 20 failed / 30 files**.
- 596 = 594 baseline + **2 新 green 回归守卫** (promptStore.test.ts: AC-13 alert 持久 + AC-15 confirm 不被 trim).
- 4 改写文件均保留其 baseline-green 测试: PromptPanel (1a.7 confirm/pin/toast/clearResolved 6 绿) / StatusBar (baseline 13 绿) / PropertyPanel (1a.8+1a.11 baseline 48 绿 + 1 skipped, L461 @uuid 形测试兼容 D1 仍绿) / CanvasView (baseline 89 绿).
- 唯一有意转 red = PromptPanel ⏏ toggle 改写 (T10 改写即红, 非 baseline 回归).
- **结论: baseline 594 完整不动, 无意外回归.** 红相 = 经典 red (run + fail) per T0/§6, 非 test.skip 脚手架.

### 4.4 裁决落地核验

- **A (禁改产品代码)**: 8 文件 import-red (不造 stub 源文件, 红即红在 import-resolution). ✅
- **B2 (新 promptStore.test.ts, 断言红非 import 红)**: 文件加载 + 测试运行 + 6 assertion/throw red + 2 green 回归. ✅
- **C1 (纯函数矩阵 best-guess 落点)**: filterByTab 矩阵落 promptStore.test.ts (锚 `import * as PromptStoreNS` + cast); classifyCloud 矩阵落 SourceSinkTab.test.tsx; detectSetupErrors 矩阵落 errorDetection.test.ts; resolveActivateTab 矩阵落 PromptCapsule.test.tsx. 均 import-red (待 DS export 后生效, DS 可整体迁移 test 跟 source 走). ✅
- **禁 canvas-click e2e (SDR#33)**: 关联跳转仅 jsdom 断言 selectedId + camera.center spy + pulse-highlight/ghost-shadow DOM class, 无 Playwright e2e. ✅
- **禁合并推 PR**: ATDD 产 scaffold only, 未 merge/push. ✅

### 4.5 DS 移交注记

- **filterByTab 矩阵 throw-on-undefined**: promptStore.test.ts L108/L117 矩阵测试当前因 filterByTab undefined 抛 TypeError red (非 clean assertion red). DS export filterByTab 后转 assertion red -> green. `toBeDefined()` anchor (L97) 为 clean 断言红. 可接受, DS 无需改测试.
- **CanvasView AC-16/17 pulse 3s auto-clear 未断言**: renderReady() 用 waitFor (real timers), 与 fakeTimers 冲突. 当前仅断 overlay class 存在 (非 3s 后移除). 3s auto-clear 的 fakeTimers 断言 defer 到 DS (test 注释已标 follow-up).
- **AC-21 (P3 meta)**: 无运行时测试, DS 执行顺序遵 story 即满足.
- **绿相可达性 (§1.8)**: 全 1a.12 特性 = DOM 组件 + 纯函数, setup.ts canvas.getContext->null 不阻塞, 绿相可行.

### 4.6 tsc 类型核验 (step-04c TDD 合规前修)

红相下 vitest 用 oxc (不类型检查), 但测试文件本身不应遗留 tsc 类型 bug (否则 DS 继承). `npx tsc --noEmit` 实测:

- 首跑: 17 errors = 8 TS2307 (missing module, 预期红) + 9 errorDetection.test.ts 类型 bug (1×TS2322 flow 缺 `units` + 8×TS7006 `findings` 隐式 any 级联).
- errorDetection.test.ts 修 (测试文件, 非产品代码, 属 step-04 红相生成): (a) `flow()` factory 补 `units: ""` (Flow 类型 from `./types` 要求); (b) `import { type ErrorFinding }` 从 `./errorDetection` (同一 missing 模块, 红相时退化为 `any`, 不增 TS2307); (c) 6 处 `const findings` 标注 `: ErrorFinding[]` (contextual type 消 TS7006; DS 建模块导出 ErrorFinding 后转实类型 = 契约信号, 强制 DS 导出该类型).
- 复跑: **8 errors, 全 TS2307** (8 import-red 文件各 1, 裁决 A 预期红). **零测试文件类型 bug 残留.**
- 这 8 TS2307 是 import-resolution 红的 tsc 侧表现 (vitest 侧 = "Failed to resolve import" 0 test). DS 建模块后两侧同步消. tsc 0-errors (AC-22d) 为 green-phase gate, 非红相要求.

进入 Step 04c (Aggregate) - 验 TDD red 合规 + 生成 ATDD checklist 汇总.

## Step 04c: Aggregate (TDD Red 合规验证 + 汇总)

> **协议适配声明**: step-04c 原协议基于 subagent (读 /tmp/tea-atdd-{api,e2e}-tests-*.json 临时产物) + 强制 `test.skip()` 脚手架. 本 flow 为 **orchestrator-direct** (无 subagent, memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`) + **零 API 层 + 零 e2e** (SDR#33 defer 1b) + story T0/§6 明令 **classic red (run+fail) 非 test.skip 脚手架** (§3.4 已立). 故:
>
> - "Read subagent outputs" -> 13 on-disk 测试文件即产物 (Glob 落盘核验, §4.1).
> - "Verify test.skip()" -> 适配为 "实际运行 + fail" 验证 (classic red). 20 failed (run+fail) 实测.
> - "API + E2E tests" -> N/A (无 API/E2E 层); 替换为 Component + Unit (vitest jsdom).
> - 故事链接 -> SKIP (§1.7 boundary: ATDD 不编辑 story); 保留 checklist 内 handoff (step-04c fallback).

### 4c.1 TDD Red 合规裁定

| 检查项                 | step-04c 原判据              | 本 flow 适配                             | 结果                                                                                                   |
| ---------------------- | ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 测试红相机制           | `test.skip()` 脚手架         | classic red (run+fail), story T0/§6 授权 | ✅ 20 failed (run+fail)                                                                                |
| placeholder 断言       | 禁 `expect(true).toBe(true)` | 同                                       | ✅ 0 placeholder (全真实断言: count/length/null/notNull/toContain/toBe/toHaveBeenCalledWith/DOM class) |
| 期望行为断言           | 非 placeholder               | 同                                       | ✅ 全断言预期行为                                                                                      |
| 测试落盘               | 写盘                         | 同                                       | ✅ 13 文件 Glob 核验                                                                                   |
| 基线无回归             | (隐含)                       | baseline 594 完整                        | ✅ 596 = 594 + 2 新 green 回归守卫                                                                     |
| 产品代码未改           | (隐含)                       | 裁决 A 严禁改产品代码                    | ✅ git status 仅测试文件 + checklist, 零产品源码改动                                                   |
| tsc 测试文件无类型 bug | (隐含)                       | 测试文件不应留 tsc 类型 bug              | ✅ 8 TS2307 全为 missing-module (预期红), 0 测试文件类型 bug                                           |

**裁定: TDD Red Phase 合规 PASS** (classic-red 适配, 非 test.skip 脚手架, 经 story T0/§6 + §3.4 授权).

### 4c.2 AC 覆盖矩阵 (22 AC -> 红测试)

| AC    | 优先级 | 红测试文件                                                                           | 红相类型                      | 覆盖状态                                          |
| ----- | ------ | ------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------- |
| AC-1  | P0     | PromptTabs.test.tsx + PromptPanel.test.tsx(AC-1 integration)                         | import-red + assertion-red    | ✅                                                |
| AC-2  | P0     | AlertTab.test.tsx + promptStore.test.tsx(filterByTab alert 矩阵)                     | import-red + assertion-red    | ✅                                                |
| AC-3  | P2     | MilestoneTab.test.tsx                                                                | import-red                    | ✅                                                |
| AC-4  | P1     | SourceSinkTab.test.tsx                                                               | import-red                    | ✅                                                |
| AC-5  | P1     | StockTab.test.tsx                                                                    | import-red                    | ✅                                                |
| AC-6  | P1     | SourceSinkTab+StockTab + CanvasView.test.tsx(AC-6)                                   | import-red + assertion-red    | ✅                                                |
| AC-7  | P0     | PromptCapsule.test.tsx                                                               | import-red                    | ✅                                                |
| AC-8  | P1     | PromptTabs+PromptCapsule                                                             | import-red                    | ✅                                                |
| AC-9  | P0     | PromptCapsule.test.tsx                                                               | import-red                    | ✅                                                |
| AC-10 | P1     | PromptCapsule.test.tsx                                                               | import-red                    | ✅                                                |
| AC-11 | P1     | PromptCapsule + PromptPanel.test.tsx(AC-11 aria-label)                               | import-red + assertion-red    | ✅                                                |
| AC-12 | P0     | errorDetection.test.ts + StatusBar.test.tsx(AC-12)                                   | import-red + assertion-red    | ✅                                                |
| AC-13 | P0     | AlertTab + promptStore.test.tsx(AC-13 双推+toast 4s)                                 | import-red + assertion-red    | ✅                                                |
| AC-14 | P2     | errorDetection.test.ts(AC-14 占位)                                                   | import-red                    | ✅                                                |
| AC-15 | P1     | promptStore.test.tsx(cap 1000) + PromptPanel.test.tsx(scroll)                        | assertion-red + assertion-red | ✅                                                |
| AC-16 | P0     | CanvasView.test.tsx(AC-16) + StatusBar.test.tsx(AC-16 popover)                       | assertion-red + assertion-red | ✅                                                |
| AC-17 | P1     | CanvasView.test.tsx(AC-17) + SourceSinkTab+StockTab                                  | assertion-red + import-red    | ✅                                                |
| AC-18 | P2     | errorDetection.test.ts(AC-18 重名源消失)                                             | import-red                    | ✅                                                |
| AC-19 | P0     | AtMentionAutocomplete.test.tsx + PropertyPanel.test.tsx(AC-19 a/b/e)                 | import-red + assertion-red    | ✅                                                |
| AC-20 | P1     | AtMentionAutocomplete.test.tsx                                                       | import-red                    | ✅                                                |
| AC-21 | P3     | (无, meta/process AC, DS 执行顺序遵 story)                                           | N/A                           | ⏭ 无测试 (P3)                                     |
| AC-22 | P0     | integration gate: promptStore 2 green 回归守卫 + 全套件 count + e2e 29/29 不动 + tsc | green 回归守卫 + gate         | ✅ (回归守卫已绿; 全套件绿为 DS green-phase gate) |

**覆盖: 21/22 AC 有红测试 (AC-21 meta 无测试, P3 预期).** 9 P0 全覆盖.

### 4c.3 汇总统计

```
tdd_phase:                   RED (classic run+fail, 非 test.skip 脚手架)
total_test_files:            13 (9 new + 4 modified)
new_red_tests (run+fail):    20
  - promptStore.test.ts (B2):    6 failed (AC-13×2, AC-15, filterByTab×3)
  - PromptPanel.test.tsx:        4 failed (AC-1, AC-11, AC-15-scroll, ⏏toggle)
  - StatusBar.test.tsx:          4 failed (AC-12×2, AC-16×2)
  - PropertyPanel.test.tsx:      3 failed (AC-19 a/b/e)
  - CanvasView.test.tsx:         3 failed (AC-6, AC-16, AC-17)
import_resolution_red_files: 8 (0 tests each, collection error, 裁决 A)
  AtMentionAutocomplete / PromptCapsule / PromptTabs / tabs×4 / errorDetection
new_green_regression_guards:  2 (promptStore: AC-13 alert 持久 + AC-15 confirm 不被 trim)
baseline:                    594 passed | 1 skipped (intact, @1bb3598)
red_phase_vitest:            20 failed | 596 passed | 1 skipped | 617 total | 30 files (13 failed)
red_phase_tsc:               8 TS2307 (missing-module, 预期红) | 0 测试文件类型 bug
e2e:                         29/29 baseline 不动 (无新 e2e, SDR#33 defer 1b)
acceptance_criteria_covered: 21/22 (AC-21 meta 无测试)
shared_fixtures_created:     0 (全 inline 自包含: setupStore/renderPanel helpers + errorDetection factory 函数; 无 faker, story 元素 id 固定)
subagent_execution:          N/A (orchestrator-direct, 无 subagent)
story_linking:               SKIPPED (§1.7 boundary: ATDD 不编辑 story; handoff 保留本 checklist)
baseline_commit:             e6b9cea (main HEAD, 冻结)
```

### 4c.4 DS 移交 handoff

- **red 脚手架位置**: 13 测试文件 (§4.1 表) + 本 checklist (`_bmad-output/test-artifacts/atdd-checklist-1a-12-prompt-panel-restructure.md`).
- **绿相激活**: DS 实现各 T-task 后, 对应红测试转绿. 无需移除 `test.skip()` (本 flow 用 classic red, 无 skip 标记). import-red 文件: DS 建对应模块后 import 解析, 测试运行转 assertion-red -> green.
- **DS 须导出类型契约**: errorDetection.ts 须 `export type ErrorFinding` (errorDetection.test.ts 已 `import { type ErrorFinding }`, DS 不导出则 tsc 持续 TS2307). promptStore.ts 须 `export filterByTab` (B2 anchor L97 + 矩阵测试依赖). 各 tab/PromptTabs/PromptCapsule/AtMentionAutocomplete 须 default 或 named export 对应 import.
- **DS 须守 SDR**: DS 实现偏离 SDR 致红测试不绿 = 实现错 (非测试错), 须改实现 (memory `newsd-ds-follows-task-not-cspin`).
- **green-phase gate (AC-22)**: DS 须达 vitest 全套件绿 (全套件 count 非 子集, memory `newsd-e2e-attestation-full-suite-not-subset`) + e2e 29/29 不动 + tsc 0 errors (8 TS2307 消).

进入 Step 05 (Validate & Complete) - 验红脚手架 + handoff metadata (step-04c nextStepFile).

## Step 05: Validate & Complete

### 5.1 校验 (against checklist)

| 校验项                   | step-05 判据             | 结果                                                                                                                                    |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisites 满足       | §1.2                     | ✅ story VS PASS / vitest+playwright 配置 / 本地工具链                                                                                  |
| 测试文件正确创建         | 13 文件落盘              | ✅ Glob 核验 (9 new + 4 modified)                                                                                                       |
| Checklist 匹配 AC        | 22 AC 覆盖               | ✅ 21/22 有红测试 (AC-21 meta P3 无测试, §4c.2)                                                                                         |
| 红相脚手架               | step-05 原 `test.skip()` | ✅ classic-red (run+fail) 适配, story T0/§6 授权 (§4c.1); 20 failed 实测, 0 test.skip 脚手架 (1 pre-existing baseline it.skip 非 1a.12) |
| Story metadata + handoff | frontmatter + §4c.4      | ✅ storyId/storyKey/storyFile/atddChecklistPath/generatedTestFiles(13) 全填                                                             |
| CLI 会话清理             | 无 orphaned browsers     | ✅ N/A (orchestrator-direct, 无录制, 无 browser 启动)                                                                                   |
| 临时产物落位             | {test_artifacts}/        | ✅ checklist + 全产物在 `_bmad-output/test-artifacts/`, 无散落 /tmp                                                                     |

**校验: 全 PASS, 无 gap 待修.**

### 5.2 Polish 核查

- 去重: Step 03 §3.6 (策略映射) 与 Step 04 §4.1 (生成结果) 表内容相关但分司"策略"与"落地产物", 非冗余重复, 保留.
- 一致性: 术语 (classic-red / import-resolution red / assertion-red) 全文一致; baseline 数字 (594/596) + commit (e6b9cea) 全文一致.
- 完整性: 模板段全填或标 N/A (AC-21 P3 标"无测试", subagent_execution 标 N/A).
- 格式: 表格/标题层级一致, 无 orphan 引用.

### 5.3 完成总结

- **产物**: 13 测试文件 (9 new flat + 4 modified) + 本 checklist.
- **checklist 路径**: `_bmad-output/test-artifacts/atdd-checklist-1a-12-prompt-panel-restructure.md`.
- **story handoff**: `_bmad-output/implementation-artifacts/1a-12-prompt-panel-restructure.md` (ATDD 不编辑 story, §1.7; handoff 保留本 checklist).
- **红相**: vitest 20 failed | 596 passed | 1 skipped | 617 (baseline 594 完整 + 2 green 回归守卫); tsc 8 TS2307 (missing-module 预期红) | 0 测试文件类型 bug; e2e 29/29 不动.
- **关键假设/风险**:
  - 裁决 A (禁改产品代码) -> 8 import-red 文件, DS 建模块即消.
  - 裁决 B2 (promptStore.test.ts assertion-red) -> filterByTab 矩阵当前 throw-on-undefined, DS export 后转 assertion-red -> green.
  - 裁决 C1 (纯函数矩阵 best-guess 落点) -> DS 可整体迁移 test 跟 source 走 (不算改产品代码).
  - CanvasView AC-16/17 pulse 3s auto-clear 未断言 (fakeTimers 与 renderReady waitFor 冲突), defer DS follow-up.
  - DS 须导出 `ErrorFinding` 类型 + `filterByTab` (契约信号, §4c.4).
- **下一步推荐 workflow**: `dev-story` (DS = bmad-dev-story, 实现 1a.12 使红测试转绿). `automate` 在实现后.
- **边界遵守**: 禁改产品代码 ✅ / 禁 subagent ✅ / 禁 canvas-click e2e ✅ / 禁合并推 PR ✅ (ATDD 产 scaffold only, 未 merge/push).

ATDD 红脚手架生成完成 (step-01 -> 05 全闭合). 交 DS.
