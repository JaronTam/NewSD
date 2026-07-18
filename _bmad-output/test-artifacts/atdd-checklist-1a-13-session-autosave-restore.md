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
lastSaved: "2026-07-18"
storyId: "1a.13"
storyKey: "1a-13-session-autosave-restore"
storyFile: "_bmad-output/implementation-artifacts/1a-13-session-autosave-restore.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-1a-13-session-autosave-restore.md"
generatedTestFiles:
  - "src/lib/sd/autosave.test.ts"
  - "e2e/autosave-restore.spec.ts"
inputDocuments:
  - "_bmad-output/implementation-artifacts/1a-13-session-autosave-restore.md"
  - "_bmad-output/project-context.md"
  - "_bmad/tea/config.yaml"
  - "playwright.config.ts"
  - "vitest.config.ts"
  - "src/test/setup.ts"
  - "src/lib/sd/store.test.ts"
  - "e2e/spatial-index.spec.ts"
  - ".claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md"
  - "src/lib/render/CanvasView.tsx"
---

# ATDD Checklist — Story 1a-13 (session-autosave-restore)

## Step 1 — Preflight & Context

### Stack detection

- `test_stack_type = auto` (config.yaml) → auto-detect → **frontend**
- Indicators: package.json (react 19 / vite / playwright) + vite.config.ts + playwright.config.ts
- wasm/Cargo.toml present but is a stub kernel loaded by frontend; no `server/` build → not backend

### Prerequisites (hard)

- [x] Story approved, clear AC (18 ACs, VS PASS, status=ready-for-dev, baseline_commit=8357080)
- [x] Test framework configured: playwright.config.ts (testDir ./e2e, SwiftShader) + vitest.config.ts (jsdom, setup ./src/test/setup.ts)
- [x] Dev env available (local toolchain installed: go/rust/wasm-pack; docker not installed — n/a for ATDD)

### Story context

- story_id = `1a.13`, story_key = `1a-13-session-autosave-restore`
- story_file = `_bmad-output/implementation-artifacts/1a-13-session-autosave-restore.md`
- AC count = 18 (F3 autosave AC-1~~4 / F2 beforeunload AC-5~~7 / A2 hydrate AC-8~~12 / field whitelist AC-13 / boundary guards AC-14~~18)
- Baseline (before 1a.13): 706 passed | 1 skipped vitest + tsc 0 + e2e full green

### Framework & existing patterns

- vitest.config.ts: environment jsdom; setupFiles [`./src/test/setup.ts`]; include [`src/**/*.test.{ts,tsx}`]
- playwright.config.ts: testDir `./e2e`; baseURL http://localhost:5173; SwiftShader args; webServer `npx vite` port 5173; snapshotDir `./e2e/__snapshots__`
- **test_dir override**: workflow.yaml var `test_dir={project-root}/tests` is WRONG for NewSD — NewSD uses `src/` (unit/component) + `e2e/` (e2e). Use actual dirs.
- Unit/component tests: `src/lib/sd/{formulaEditor,formula,store,types,errorDetection}.test.ts` (5)
- e2e specs: `e2e/{cloud-render,stock-render,flow-render,spatial-index,minimap,toolbar-statusbar,property-panel}.spec.ts` (7)
- Red-phase convention (from store.test.ts): `it.skip(...)` red skip + `gov: AC-N + SDR#M + T-K` header + `// RED PHASE SCAFFOLDS` banner + `stockShape/cloudShape` helpers (setElements direct construction bypassing factory, for load-path tests) + `as unknown as Parameters<typeof store.createStock>[0]` cast
- e2e convention (from spatial-index.spec.ts): `waitForRenderReady(page)` (skeleton hidden + canvas width>0 + 300ms) + `window.__e2e__` (setElements([])+seedBulk(n)+spatialIndex.search) + `canvas.ns-canvas__gl` selector

### TEA config flags

- tea_use_playwright_utils = true → §5 says Full UI+API profile (~4500 lines). **NewSD override**: NewSD is a single-machine modeling tool, NO API/backend/network/auth. e2e uses `__e2e__` hook + reload, no network interception. Selectively SKIP network/auth/pact fragments (network-recorder, auth-session, intercept-network-call, api-request, recurse). project-context.md (persistent_fact) L106-153 is the NewSD-specific authoritative test protocol, takes precedence over generic TEA fragments.
- tea_use_pactjs_utils = false → skip all pact fragments
- tea_pact_mcp = none → skip
- tea_browser_automation = auto → NewSD e2e already has mature `__e2e__` pattern; playwright-cli fragment not needed
- test_stack_type = auto → frontend (resolved above)

### Knowledge fragments loaded (§5)

- Core: `test-quality.md` (loaded — hollow-test red line, no-hard-wait/<300-line/explicit-assertion/self-cleaning). `data-factories.md`, `component-tdd.md`, `test-healing-patterns.md` deferred to step-03 (load on-demand when deciding test strategy detail).
- Frontend: `selector-resilience.md`, `timing-debugging.md` deferred to step-03 (timing-debugging relevant for AC-1 debounce fake-timer).
- Persistent_fact: `_bmad-output/project-context.md` (295 lines, 119 rules) — loaded via customize.toml persistent_facts. NewSD test protocol authoritative source.
- Playwright Utils: SKIPPED (no API/auth/network in NewSD; see override above)

### **e2e** hook confirmation (CanvasView.tsx L204-240)

- Exposed only if `typeof window !== "undefined" && import.meta.env.DEV`
- `window.__e2e__` exposes: `elementStore`, `spatialIndex`, `dirtyTracker`, `perfProbe`, `createFlow`, `buildInstances`, `seedBulk(n)`, `charToGlyphIdx`, `minimapProjector`, `minimapDirtyTracker`, `getHighlightBox`
- `seedBulk(n)`: bulk-seed N stock in grid via setElements single notify, O(n) no cascade; uses `name: \`s${i}\`` (non-canonical name)
- `elementStore.getElements()`: read current snapshot
- **AC-17 e2e restore approach viable**: `__e2e__.seedBulk(5)` → reload → `__e2e__.elementStore.getElements()` count==5
- **AC-12 deriveSeq note**: seedBulk uses non-canonical `s${i}` names; deriveSeq tests must construct canonical-name elements directly via `stockShape/cloudShape` helpers (unit test, not e2e)

### Red scaffold targets (product code UNTOUCHED in ATDD red phase)

- CREATE: `src/lib/sd/autosave.test.ts` (vitest unit) — target API surface: `startAutosave`, `restoreFromStorage`, `toPersisted`, `fromPersisted`, `validateEnvelope`, constants `AUTOSAVE_KEY="ns-board-autosave"`, `AUTOSAVE_VERSION=1`, `AUTOSAVE_DEBOUNCE_MS=1000`
- CREATE: `e2e/autosave-restore.spec.ts` (Playwright e2e) — AC-17 restore-after-reload via **e2e** hook
- DO NOT TOUCH (DS green phase): `src/lib/sd/autosave.ts` (new orchestrator), `src/lib/render/CanvasView.tsx` (mount useIsoLayoutEffect + startAutosave integration)
- localStorage key `ns-board-autosave` MUST NOT collide with 1a.12 sessionStorage `ns-prompt-panel-last-tab` (different storage type + different key — confirmed safe)

### Inputs confirmed

Proceeding to step-02 (generation mode).

## Step 2 - Generation Mode

- Mode = **AI Generation** (default when AC clear + standard scenarios; autosave/beforeunload/restore 是逻辑性 AC, 非复杂 drag/drop UI, 无需 recording mode)
- §3 Confirm Mode: AI Generation chosen
- Proceeding to step-03 (test strategy)

## Step 3 - Test Strategy

### AC -> Scenario -> Level -> Priority 映射

| AC    | Scenario                             | Level                                 | Pri | File                     |
| ----- | ------------------------------------ | ------------------------------------- | --- | ------------------------ |
| AC-1  | debounce 1000ms + dirty + write      | Unit (vitest jsdom + fake timer)      | P0  | autosave.test.ts         |
| AC-2  | Quota/Security 容错                  | Unit (mock Storage.prototype.setItem) | P0  | autosave.test.ts         |
| AC-3  | envelope schema version=1 no savedAt | Unit                                  | P1  | autosave.test.ts         |
| AC-4  | 持久化子集剥离运行时字段             | Unit                                  | P0  | autosave.test.ts         |
| AC-5  | beforeunload flush + returnValue     | Unit                                  | P0  | autosave.test.ts         |
| AC-6  | 无 dirty 不弹                        | Unit                                  | P1  | autosave.test.ts         |
| AC-7  | prerender-safe typeof window         | Unit                                  | P0  | autosave.test.ts         |
| AC-8  | mount 恢复路径                       | Unit                                  | P0  | autosave.test.ts         |
| AC-9  | 空/缺 key                            | Unit                                  | P1  | autosave.test.ts         |
| AC-10 | 损坏/版本不符丢弃 (3 组)             | Unit                                  | P0  | autosave.test.ts         |
| AC-11 | 运行时字段重初始化                   | Unit                                  | P0  | autosave.test.ts         |
| AC-12 | deriveSeq skip-forward               | Unit                                  | P1  | autosave.test.ts         |
| AC-13 | 白名单 + 往返不变量                  | Unit                                  | P0  | autosave.test.ts         |
| AC-14 | 依赖链 + 执行顺序                    | meta (documentation, 无独立 test)     | P2  | -                        |
| AC-15 | storage 边界隔离 1a.12 vs 1a-13      | Unit (integration)                    | P1  | autosave.test.ts         |
| AC-16 | handleNew 清空                       | Unit                                  | P1  | autosave.test.ts         |
| AC-17 | e2e restore-after-reload             | E2E (Playwright)                      | P0  | autosave-restore.spec.ts |
| AC-18 | 无回归 全套件绿                      | gate (meta)                           | P0  | gate run                 |

### Negative / edge cases

- AC-2: QuotaExceededError + SecurityError 两分支
- AC-10: 非 JSON / version≠1 / 缺 kind 三组坏数据
- AC-13: roundtrip 不变量 `toPersisted(fromPersisted(toPersisted(e))) === toPersisted(e)`
- AC-17: 正向 (seedBulk5 -> reload -> 5) + 负向 (空 -> reload -> 0)

### Red phase confirmation

- ALL tests `it.skip()` / `test.skip()` (vitest 23 + e2e 2 = 25 skip)
- assert expected behavior (NO `expect(true).toBe(true)` placeholder)
- gov comments `// gov: AC-N + SDR#M + T-K` 每测试头
- 红阶段不破坏基线 (declare const 保 tsc 0)

## Step 4 - Generate Tests

### Execution mode

- resolved = **sequential** (orchestrator-direct, 不起 subagent)
- 原因: memory `newsd-cr-3-layers-orchestrator-direct-not-subagents` - ark-code 后端 subagent 两轴皆崩 (同步 prompt-too-long + 异步越界); ATDD 是 CR orchestrator-direct 兄弟场景, orchestrator 自己生成
- Worker A (unit) + Worker B (e2e) 由 orchestrator 内联生成 (跳过 step-04a/04b subagent dispatch)

### Generated files

- `src/lib/sd/autosave.test.ts` - 23 `it.skip`, AC-1~AC-13/AC-15/AC-16
- `e2e/autosave-restore.spec.ts` - 2 `test.skip`, AC-17 正向 + 负向

### 红阶段 import 策略 (全新文件)

- `autosave.ts` 全新, 直接 `import` 会 tsc 红 (破坏 baseline gate)
- 采用 `declare const` (ambient 声明) 让文件 tsc 绿 + `it.skip()` dormant
- DS T1 删 `declare const` 换真实 `import { ... } from "./autosave"`
- 1a.11 it.skip 模式的全新文件变体 (1a.11 已存在符号 + cast, 1a.13 全新符号 + declare)

## Step 4c - Aggregate

### Red phase compliance verification

- [x] `test.skip()` / `it.skip()` present: 23 vitest + 2 e2e = 25 skip
- [x] NO `expect(true).toBe(true)` placeholder (所有断言 assert expected behavior)
- [x] expected_to_fail: skip + declare const undefined (DS unskip -> TypeError red -> implement -> green)
- [x] gov comments `// gov: AC-N + SDR#M + T-K` 每测试头

### Baseline verification (gate, ATDD 不破坏基线)

- [x] tsc 0 errors (`declare const` 策略生效)
- [x] vitest 全套件 706 passed | 24 skipped (原 706 | 1skip + 23 新 skip; 706 passed 不变 = 无回归 AC-18)
- [x] e2e `autosave-restore.spec.ts` 2 skipped

## Step 5 - Validate & Complete

### Validation

- [x] Prerequisites satisfied (step-01)
- [x] Test files created correctly (2 files)
- [x] Checklist matches AC (18 AC 全覆盖: 16 AC 独立 test + AC-14 meta + AC-18 gate)
- [x] `test.skip()` present
- [x] Story metadata + handoff paths captured (`### ATDD Artifacts` in story `## Dev Notes`)
- [x] CLI cleanup: 无 temp artifacts
- [x] no regression: 706 passed 不变

### Handoff to DS

- DS 入口: story T0-T22 task sequence (T0 red -> T1 green startAutosave -> ... -> T22 gate)
- DS T1 首步: 删 `autosave.test.ts` 顶部 `declare const` 块, 换真实 `import { ... } from "./autosave"`
- DS unskip 顺序按 T0-T19 (vitest) + T20 (e2e)
- DS gate (T22): tsc 0 + vitest 全套件绿 (记 count) + e2e 全套件绿 (记全套件 count 非子集, memory `newsd-e2e-attestation-full-suite-not-subset`)

### Completion summary

- ATDD red phase complete for Story 1a-13
- 25 red scaffolds (23 unit + 2 e2e), all skip, baseline preserved
- Ready for DS (dev-story, green phase)
- on_complete: customize.toml `workflow.on_complete` 未设 -> skip `resolve_customization.py`
