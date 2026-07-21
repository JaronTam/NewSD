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
storyId: "5.1"
storyKey: "5-1-cyberpunk-quality-first-8"
storyFile: "_bmad-output/implementation-artifacts/5-1-cyberpunk-quality-first-8.md"
atddChecklistPath: "_bmad-output/test-artifacts/atdd-checklist-5-1-cyberpunk-quality-first-8.md"
generatedTestFiles:
  - "src/lib/render/quality/animation.test.ts"
  - "src/lib/render/quality/audio.test.ts"
  - "src/lib/render/quality/particles.test.ts"
  - "src/lib/render/quality/overlay.test.ts"
  - "src/lib/render/quality/glitch.test.ts"
  - "e2e/quality-first-8.spec.ts"
inputDocuments:
  - "_bmad-output/implementation-artifacts/5-1-cyberpunk-quality-first-8.md"
  - "_bmad-output/project-context.md"
  - "_bmad/tea/config.yaml"
  - "playwright.config.ts"
  - "vitest.config.ts"
  - "src/test/setup.ts"
  - "src/lib/sd/autosave.test.ts"
  - "e2e/autosave-restore.spec.ts"
  - "src/lib/render/cap11-shadowblur-guard.test.ts"
  - "src/lib/render/perf-probe.ts"
  - "src/lib/render/vram/renderer.ts"
  - "src/lib/render/CanvasView.tsx"
---

# ATDD Checklist - Story 5-1 (cyberpunk-quality-first-8)

## Step 1 - Preflight & Context

### Stack detection

- `test_stack_type = auto` (config.yaml) -> auto-detect -> **frontend**
- Indicators: package.json (react 19 / vite / playwright) + vite.config.ts + playwright.config.ts
- wasm/Cargo.toml present but stub kernel; no `server/` build -> not backend

### Prerequisites (hard)

- [x] Story approved, clear AC (14 AC, VS PASS 2026-07-20, status=ready-for-dev, baseline_commit=ca4ce02)
- [x] Test framework configured: playwright.config.ts (testDir ./e2e, SwiftShader args load-bearing) + vitest.config.ts (jsdom, setup ./src/test/setup.ts)
- [x] Dev env available (local toolchain: go/rust/wasm-pack; docker n/a for ATDD)

### Story context

- story_id = `5.1`, story_key = `5-1-cyberpunk-quality-first-8`
- story_file = `_bmad-output/implementation-artifacts/5-1-cyberpunk-quality-first-8.md`
- AC count = 14 (渲染基座 AC-1 / 8 项分段 AC-2~AC-9 / E25 autoplay AC-10 / AR#11 reduced-motion AC-11 / B-perf-1 60FPS AC-12 / 边界 guard AC-13/AC-14)
- Baseline (before 5.1, ca4ce02 actual): vitest 730 passed | 1 skipped / 31 files + tsc 0 + e2e 31 passed | 21 skipped / 52 (story recorded "29|21/50" = pre-1a.13 stale; 1a.13 autosave-restore.spec.ts added 2 active tests -> 31|21)
- ATDD target = T0 (red scaffold 6 files: 4 new modules' tests + glitch + e2e), per story Dev Notes §ATDD Artifacts + SDR#13

### Framework & existing patterns

- vitest.config.ts: environment jsdom; setupFiles [`./src/test/setup.ts`]; include [`src/**/*.test.{ts,tsx}`]
- playwright.config.ts: testDir `./e2e`; baseURL http://localhost:5173; SwiftShader args `--use-gl=angle --use-angle=swiftshader` (load-bearing); webServer `npx vite` port 5173; snapshotDir `./e2e/__snapshots__`
- **test_dir override**: workflow `test_dir={project-root}/tests` is WRONG for NewSD - uses `src/` (unit/component) + `e2e/` (e2e)
- Unit/component tests: `src/lib/render/**/*.test.{ts,tsx}`; e2e specs: `e2e/*.spec.ts`
- **Red-phase convention (1a.13 autosave.test.ts precedent)**: `// RED PHASE SCAFFOLDS` banner + `declare const` ambient block for not-yet-existing module symbols (tsc green, runtime undefined) + `it.skip()` dormant + `// gov: AC-N + SDR#M + T-K` 每测试头. DS 首步: 删 declare const 换真实 `import { ... } from "./<module>"` + 逐 task unskip. (memory newsd-atdd-red-scaffold-declare-const-for-new-file; project-context L94)
- **e2e convention (1a.13 autosave-restore.spec.ts precedent)**: `waitForRenderReady(page)` (skeleton hidden + canvas width>0 + 300ms WebGL settle) + `window.__e2e__` hook (inline-cast `(window as unknown as { __e2e__?: {...} }).__e2e__` for not-yet-exposed fields) + `canvas.ns-canvas__gl` selector + `page.evaluate` for AudioContext state
- **NOTE**: current HEAD `autosave.test.ts` is POST-DS终态 (real import + `it`, 23 green). 1a.13 red scaffold was瞬态 (declare const + it.skip). Mirror STRUCTURE (banner/gov/describe/helper), use declare const + it.skip for 5.1 pre-DS.

### TEA config flags

- tea_use_playwright_utils = true -> §5 says Full UI+API profile (~4500 lines). **NewSD override (same as 1a.13)**: single-machine frontend, NO API/backend/network/auth. e2e uses `__e2e__` hook + perfProbe fpsP95 + page.evaluate AudioContext (SDR#34), no network interception. SKIP Playwright Utils full profile (network-recorder/auth-session/intercept-network-call/api-request/recurse/log/file-utils/network-error-monitor/fixtures-composition) + playwright-cli - 1a.13 autosave-restore.spec.ts is the direct precedent. project-context.md L106-153 (persistent_fact) is authoritative test protocol, takes precedence over generic TEA fragments.
- tea_use_pactjs_utils = false -> skip all pact fragments
- tea_pact_mcp = none -> skip
- tea_browser_automation = auto -> NewSD e2e has mature `__e2e__` pattern; playwright-cli not needed
- test_stack_type = auto -> frontend (resolved above)

### Knowledge fragments loaded (§5)

- Core: project-context.md (persistent_fact, 119 rules) - authoritative NewSD test protocol incl. ATDD red-scaffold rule L94 + e2e canvas/**e2e** strategy L271 + full-suite count rule L146/L148.
- Code precedents (direct authority, > generic fragments): `src/lib/sd/autosave.test.ts` (declare const + it.skip + banner + gov pattern), `e2e/autosave-restore.spec.ts` (e2e **e2e** hook + waitForRenderReady pattern), `src/lib/render/cap11-shadowblur-guard.test.ts` (CAP-11 guard - must stay green, SDR#21), `src/lib/render/perf-probe.ts` (fpsP95 for AC-12), `src/lib/render/vram/renderer.ts:24` (`export interface RenderInstance` for particles type-only import), `src/lib/render/CanvasView.tsx:208-216` (**e2e** hook current exposure).
- Generic TEA fragments (test-quality/data-factories/component-tdd/test-healing-patterns/selector-resilience/timing-debugging): SKIPPED as context-efficiency measure - 5.1 red scaffolds are dormant it.skip shells, story pre-specified all design (SDR#1-13 + Dev Notes §ATDD Artifacts), 1a.13 is concrete precedent. Deviation noted; user can request load if wanted.

### **e2e** hook confirmation (CanvasView.tsx L208-216)

- Exposed only if `typeof window !== "undefined" && import.meta.env.DEV`
- Current exposure: `elementStore`, `spatialIndex`, `dirtyTracker`, `perfProbe`, `createFlow`, `buildInstances`, `seedBulk(n)`
- **5.1 needs NEW exposures (DS work, NOT ATDD)**: animation state (time offset / glyphIdx序列), particle system (spawn/alive), overlay (trigger), audio (blip player / AudioContext). ATDD e2e spec references these via inline-cast `(window as unknown as { __e2e__?: { animation?: {...}; particles?: {...}; ... } }).__e2e__` so tsc stays green without modifying CanvasView. DS T23 implements the real hook exposure.
- **AC-12 e2e viable**: `__e2e__.seedBulk(1000)` (existing) flow elements行进 -> `__e2e__.perfProbe.getMetrics().fpsP95 >= 60` (perfProbe already exposed). SDR#34.

### Red scaffold targets (product code UNTOUCHED in ATDD red phase)

- CREATE: `src/lib/render/quality/animation.test.ts` (vitest) - AC-1/AC-2/AC-11. declare const: `startAnimationTicker`, `computeFlowOffset`.
- CREATE: `src/lib/render/quality/audio.test.ts` (vitest) - AC-3/AC-10. declare const: `createBlipPlayer`. mock AudioContext globally.
- CREATE: `src/lib/render/quality/particles.test.ts` (vitest) - AC-4. declare const: `createParticleSystem`. `import type { RenderInstance } from "../vram/renderer"` (existing, type-only).
- CREATE: `src/lib/render/quality/overlay.test.ts` (vitest) - AC-6. declare const: `createLvlUpOverlay` (lifecycle controller).
- CREATE: `src/lib/render/quality/glitch.test.ts` (vitest) - AC-5. declare const: `computeGlitchGlyphIdx` (glitch.ts 非独立模块 per story §4; 纯函数 lives in animation.ts, DS import from "./animation"). story §4 "可并入 animation.test.ts, DS 定" - ATDD keeps separate per Dev Notes §ATDD Artifacts list.
- CREATE: `e2e/quality-first-8.spec.ts` (Playwright) - AC-12 + AC-2/4/6/3 e2e integration (SDR#34). `test.skip`.
- DO NOT TOUCH (DS green phase): `src/lib/render/quality/{animation,audio,particles,overlay}.ts`, `src/lib/render/CanvasView.tsx`, `src/lib/render/Toolbar.tsx` / `PropertyPanel.tsx`, `src/styles/`, `src/lib/render/vram/*`, `src/lib/render/cap11-shadowblur-guard.test.ts`.

## Step 2 - Generation Mode

- **Mode = AI Generation** (story pre-specified all 6 files + signatures via Dev Notes §ATDD Artifacts + SDR#1-13; no manual authoring ambiguity).
- Generation scope: 6 files (5 vitest unit + 1 Playwright e2e), all `it.skip`/`test.skip` dormant.
- Red compliance: `declare const` ambient for 4 new module symbols + glitch纯函数; `import type { RenderInstance }` (existing) for particles; no real `import` of not-yet-existing modules.

## Step 3 - Test Strategy (AC -> Scenario -> Level -> File -> Pri)

| AC    | Scenario                                        | Level                                       | Pri | File                                      | ATDD red                       |
| ----- | ----------------------------------------------- | ------------------------------------------- | --- | ----------------------------------------- | ------------------------------ |
| AC-1  | VRAM管线 禁shadowBlur (ticker驱动drawRef->VRAM) | Unit (vitest)                               | P0  | animation.test.ts                         | ✅ it.skip (CAP-11 guard 已绿) |
| AC-2  | 流量行进 ticker推进 + flow offset纯函数         | Unit (vitest fake timer)                    | P0  | animation.test.ts                         | ✅ it.skip x2                  |
| AC-3  | blip方波 OscillatorNode                         | Unit (mock AudioContext)                    | P0  | audio.test.ts                             | ✅ it.skip                     |
| AC-4  | 粒子生成->飞散->消亡                            | Unit (纯函数 lifecycle)                     | P0  | particles.test.ts                         | ✅ it.skip x2                  |
| AC-5  | glitch glyphIdx轮转->稳定                       | Unit (纯函数)                               | P0  | glitch.test.ts                            | ✅ it.skip x2                  |
| AC-6  | LVL UP overlay显示->停留->淡出                  | Unit (lifecycle controller)                 | P0  | overlay.test.ts                           | ✅ it.skip x2                  |
| AC-7  | 呼吸辉光 dt select (DOM CSS)                    | Component (DOM class)                       | P1  | Toolbar.test.tsx (existing, DS T13)       | ❌ DS (existing file)          |
| AC-8  | ASCII风格控件 (DOM CSS)                         | Component (DOM class)                       | P1  | Toolbar.test.tsx (existing, DS T15)       | ❌ DS                          |
| AC-9  | 输入火花 (DOM CSS)                              | Component (DOM class)                       | P1  | PropertyPanel.test.tsx (existing, DS T17) | ❌ DS                          |
| AC-10 | E25 autoplay resume                             | Unit (mock AudioContext suspended->running) | P0  | audio.test.ts                             | ✅ it.skip                     |
| AC-11 | prefers-reduced-motion降级                      | Unit (mock matchMedia reduce)               | P0  | animation.test.ts                         | ✅ it.skip                     |
| AC-12 | 1000图元60FPS                                   | E2E (Playwright fpsP95)                     | P0  | quality-first-8.spec.ts                   | ✅ test.skip                   |
| AC-13 | 依赖chain + 前置闭合                            | meta (documentation)                        | P2  | -                                         | meta                           |
| AC-14 | 无回归全套件绿                                  | gate (suite-level)                          | P0  | gate run (T24)                            | meta (0 failures)              |

ATDD red covers: AC-1/2/3/4/5/6/10/11/12 (9 AC, 12 vitest it.skip + 5 e2e test.skip). AC-7/8/9 DOM CSS red in DS (existing files, no declare const). AC-13/14 meta.

## Step 4 - Generate Tests

### 4.1 `src/lib/render/quality/animation.test.ts` (AC-1/2/11)

- declare const: `startAnimationTicker(drawRef, getReducedMotion): () => void` (SDR#1); `computeFlowOffset(timeMs): number` (SDR#3, time->offset纯函数 禁u_time).
- 4 `it.skip`: AC-1 ticker连续帧推进回调drawRef (经VRAM管线, CAP-11 guard守卫) / AC-2 computeFlowOffset单调周期推进 / AC-2 无流量图元无行进 / AC-11 matchMedia reduce=true降级.
- afterEach: `vi.unstubAllGlobals()` + `vi.restoreAllMocks()` (matchMedia stub cleanup for DS).

### 4.2 `src/lib/render/quality/audio.test.ts` (AC-3/10)

- declare const: `createBlipPlayer(): { trigger(), resumeOnGesture() }` (SDR#4).
- `makeMockAudioContext()` factory (jsdom lacks AudioContext): state="suspended", resume()->"running", createOscillator()->{type,frequency,connect,start,stop}, createGain(), destination.
- 2 `it.skip`: AC-3 trigger()创建square wave OscillatorNode接destination / AC-10 初始suspended->resumeOnGesture()->running (autoplay policy).
- afterEach cleanup.

### 4.3 `src/lib/render/quality/particles.test.ts` (AC-4)

- declare const: `createParticleSystem(): { spawn(x,y), update(dt)->RenderInstance[], alive() }` (SDR#5).
- `import type { RenderInstance } from "../vram/renderer"` (renderer.ts:24, existing type-only).
- 2 `it.skip`: AC-4 spawn后update返回飞散instance (glyphIdx弹片+worldX/Y轨迹偏离原点) / AC-4 ttl到期alive()->false+update空.

### 4.4 `src/lib/render/quality/overlay.test.ts` (AC-6)

- declare const: `createLvlUpOverlay(): { trigger(), getState()->"hidden"|"showing"|"fading", update(dt) }` (SDR#7 lifecycle controller).
- 2 `it.skip`: AC-6 trigger->showing停留期showing / AC-6 停留期结束->fading->hidden.

### 4.5 `src/lib/render/quality/glitch.test.ts` (AC-5)

- declare const: `computeGlitchGlyphIdx(timeMs, trueGlyphIdx): number` (SDR#6, time->glitch phase纯函数; lives in animation.ts per story §4, DS import from "./animation").
- 2 `it.skip`: AC-5 周期轮转非恒等于true / AC-5 周期结束回归trueGlyphIdx稳定真值.
- banner note: story §4 "可并入 animation.test.ts, DS 定" - ATDD keeps separate per Dev Notes §ATDD Artifacts; DS may merge.

### 4.6 `e2e/quality-first-8.spec.ts` (AC-12 + AC-2/4/6/3 integration, AC-14 gate)

- `waitForRenderReady(page)` helper (mirror autosave-restore.spec.ts: skeleton hidden + canvas width>0 + 300ms settle).
- 5 `test.skip`: AC-12 seedBulk(1000)->perfProbe.fpsP95>=60 (SAVE Q2=B 上限声明可接受) / AC-2 animation.getOffset()递增 via **e2e**.animation / AC-4 particles.spawn->alive via **e2e**.particles / AC-6 overlay.trigger->getState="showing" via **e2e**.overlay / AC-3+10 AudioContext suspended->resumeOnGesture->running via **e2e**.audio.
- inline-cast `__e2e__` new fields as OPTIONAL (`animation?`, `particles?`, `overlay?`, `audio?`) -> tsc green without touching CanvasView. DS T23 implements real hook exposure.
- AC-14 = suite-level gate (0 failures post-DS, full e2e green).

## Step 4c - Aggregate & Red Compliance

- Total new test files: 6 (5 vitest + 1 e2e).
- Total new dormant tests: 17 (12 vitest `it.skip` + 5 e2e `test.skip`).
- Red compliance checklist:
  - [x] All new module symbols via `declare const` ambient (animation: startAnimationTicker+computeFlowOffset; audio: createBlipPlayer; particles: createParticleSystem; overlay: createLvlUpOverlay; glitch: computeGlitchGlyphIdx). tsc green, runtime undefined.
  - [x] `import type { RenderInstance }` (existing renderer.ts:24) - type-only, no runtime import of non-existent module.
  - [x] All tests `it.skip`/`test.skip` (dormant; DS unskips per T1/T3/T5/T7/T9/T11/T19/T21/T23).
  - [x] Product code 0 改动 (no .ts/.tsx in src/lib/render/quality/ created; CanvasView/Toolbar/PropertyPanel/styles/vram untouched).
  - [x] CAP-11 guard (cap11-shadowblur-guard.test.ts) untouched -> stays green (SDR#21).
  - [x] `// gov: AC-N + SDR#M + T-K` header on every test (traceability).
  - [x] RED PHASE banner on every file (DS first-step instruction: delete declare const,换真实import).
- Formatter (PostToolUse hook) reformatted audio.test.ts + quality-first-8.spec.ts after write - cosmetic only, no semantic change.

## Step 5 - Validate & Complete

### Local gate results (pre-merge, no CI)

| Gate      | Command                              | Result                                                                                                                                |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck | `bun run typecheck` (`tsc --noEmit`) | **0 errors** (declare const ambient保绿)                                                                                              |
| vitest    | `bun run test`                       | **730 passed \| 13 skipped (743)** / 31 passed \| 5 skipped files (36) - passed unchanged, skip 1->13 (+12), files 31->36 (+5 全skip) |
| e2e       | `bun run test:e2e`                   | **31 passed \| 26 skipped** / 0 failures - passed unchanged, skip 21->26 (+5)                                                         |

### Baseline reconciliation

- vitest: 730 passed (unchanged from ca4ce02) ✓. skip 1->13 (+12 = 4 animation + 2 audio + 2 particles + 2 overlay + 2 glitch). files +5 (new quality/ dir, all-skip).
- e2e: 31 passed (unchanged from ca4ce02 actual) ✓. skip 21->26 (+5 = quality-first-8.spec.ts).
- **story recorded e2e baseline "29|21/50" is STALE** (pre-1a.13): 1a.13 autosave-restore.spec.ts added 2 active `test()` -> post-1a.13 (ca4ce02) actual = 31 passed | 21 skipped | 52. ATDD measured 31 passed (no regression) | 26 skipped (+5 new). Story baseline defect (minor, non-blocking) - DS/VS may correct story record; ATDD work unaffected.
- 0 failures across all gates. CAP-11 guard green. Product code 0 改动. Red compliance ✓.

### DS handoff notes

- DS first step per file: delete `declare const` block -> replace with real `import { ... } from "./<module>"` (glitch imports from "./animation"). Then unskip tests per task (T1/T3/T5/T7/T9/T11/T19/T21/T23).
- DS T23: extend CanvasView `__e2e__` hook (L208-216) with `animation` / `particles` / `overlay` / `audio` fields matching the inline-cast shapes in quality-first-8.spec.ts.
- DS T13/T15/T17: AC-7/8/9 DOM CSS red tests in EXISTING Toolbar.test.tsx / PropertyPanel.test.tsx (no declare const - existing components, add CSS class assertions).
- AC-12 SAVE Q2=B: 上限声明可接受 (B-perf-1 口径 = 1000图元含行进子集60FPS; DS 若实测 <60 可改断言为上限声明 + rationale).
- glitch.test.ts merge into animation.test.ts optional (story §4, DS decision).

### ATDD complete

- Status: **RED phase scaffolds generated + baseline verified**. Story 5.1 ready for DS (`bmad-dev-story`).
- Artifacts: 6 test files + this checklist. No story/sprint-status/product-code changes.
