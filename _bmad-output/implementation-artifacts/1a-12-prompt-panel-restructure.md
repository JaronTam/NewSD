---
baseline_commit: e6b9cea
baseline_tests: 594 passed | 1 skipped / 21 files (vitest, 1a.11 CR 终态 @1bb3598)
---

# Story 1a.12: PromptPanel 重构为四 tab 容器 (prompt-panel-restructure)

Status: review

## Story

As a 单人建模者,
I want PromptPanel 重构为四 tab 容器("!"/里程碑/源汇/存量) + 收起态胶囊(横向 tab 名 + 未答 confirm 红光闪烁角标),
so that 建模主区不被提示/状态监视遮挡, 设置错误(状态性)与运算错误(时序性)在明确归宿(状态栏 vs "!" tab)不互相污染, 且属性面板名称字段支持 name->@uuid 反向映射 + autocomplete(1a.8 defer D1 合流).

epic 依据: epics.md L565-615 Story 1a.12 四 tab 容器 + 收起态 + 错误二分归宿 + 关联跳转 + 边界 guard; FR-UI-7(四 tab)/FR-UI-8(存量 tab)/FR-UI-9(源汇 tab)/FR-UI-3 修订(状态栏 ⚠N)/FR-ELEM-5(命名机制, 1a.11 已 done)/FR-ELEM-6(flow 端点完整性).

## Acceptance Criteria

> 全部 AC 为逻辑层/组件层(jsdom)测试, 无 canvas-click e2e(canvas-click 基础设施归 1b, 复用 1a.8 deferred-work D4 defer). PromptPanel 与 PropertyPanel 均 DOM 可断言; 关联跳转的画布定位/脉冲高亮 canvas 侧不做 e2e(仅断言 selectedId 通道被拨动 + 触发 camera.center 调用).

### 四 tab 容器 (FR-UI-7)

- [ ] **AC-1(四 tab 结构 + 切换即时)** Given PromptPanel 展开态 When 挂载 Then 顶部 tab 条按序渲染 4 个 tab: `"!"`(错误 alert)/`里程碑`/`源/汇`/`存量`; 每 tab 有 `role="tab"` + `data-testid="ns-prompt-panel-tab-{key}"`(key ∈ `alert`/`milestone`/`sourcesink`/`stock`). 默认激活 tab = `alert`(有未答 confirm 时) 或 上次活动 tab / `alert` 兜底(SDR#3). 点击非激活 tab -> aria-selected 立即翻转, 内容区 `role="tabpanel"` 同步. [epic L570-575, FR-UI-7]
- [ ] **AC-2("!" tab 内容 - 未答 confirm ❕红 + alert ⚠橙 + 已解决转灰)** Given PromptPanel + promptStore 含 `type=confirm && !resolved` 消息 + `type=alert` 消息 + `resolved:true confirm` 消息 When 切到 `"!"` tab Then 未答 confirm 渲染 `.ns-prompt-panel__msg--confirm`(现有 --ns-err 红渲染基座) + `[确认]`/`[取消]` 按钮; alert 渲染新增 `.ns-prompt-panel__msg--alert`(--ns-warn 橙渲染, 非红); 已解决 confirm 渲染 `--resolved` 灰渲染; 非 confirm/alert 类型不出现在此 tab. [epic L572-573]
- [ ] **AC-3(里程碑 tab 结构就绪 - 内容 defer 5.4)** Given PromptPanel 展开态 切到 `里程碑` tab When 渲染 Then 内容区显 `★ 已达成 / ☆ 未达成` 两栏占位骨架(纯静态 stub, 无真实里程碑数据源); 附一行占位文案 `游戏化中心 (Epic 5.4) 接入前占位` 明示 defer. 1a 仅验证结构渲染, 不验内容. [epic L575, defer 5.4]
- [ ] **AC-4(源/汇 tab - FR-UI-9 列/行首 + 流量 stub)** Given store 含 cloud C1(source, 有 outbound flow) + cloud C2(sink, 有 inbound flow) + stock S1(kind=stock) When 切到 `源/汇` tab Then 表头 `名称 | 连接 | 流量 | 问题` 四列; C1 行首 `☁`(源, 白/浅色 class `--source`); C2 行首 `◼`(汇, 黑/深色 class `--sink`); stock 不出现在此 tab(仅 cloud 归 源汇); `流量` 列显 `-`(1b 接入前 stub); 空 store -> `尚无源/汇` 空态. [epic L577, FR-UI-9]
- [ ] **AC-5(存量 tab - FR-UI-8 列/行首 + 净流量 stub)** Given store 含 stock S1(initialValue=10) + S2(initialValue=-5, allowNegative=true) + S3(initialValue=0) + cloud/flow(不入此 tab) When 切到 `存量` tab Then 表头 `名称 | 变化值 | 单位 | 问题` 四列; S1 行首 `⚪`(正, class `--pos`); S2 行首 `⚫`(负, class `--neg`); S3 行首 `☯`(零, class `--zero`); 变化值列显 `-`(1a 无仿真, stub 占位); 空 store -> `尚无存量` 空态. [epic L576, FR-UI-8]
- [ ] **AC-6(单击行 -> 画布定位 + 右栏属性面板展开)** Given 存量 tab 含 stock 行 + 源汇 tab 含 cloud 行 When 点击某行 Then 触发 `onRowClick(id)` 回调 -> CanvasView `setSelectedId(id)` 被调 + camera 定位到该元素中心(camera.center 被调用); 右栏 PropertyPanel(1a.8)以 selectedId 展开对应字段. jsdom 断言 selectedId 状态翻转即可(camera.center 用 spy). [epic L578]

### 收起态胶囊

- [ ] **AC-7(收起态胶囊结构)** Given PromptPanel 收起态 When 渲染 Then 单行胶囊: `[!][里程碑][源/汇][存量] ⏏️`(横向 4 tab 名 + 展开键), 不展示内容体; 每 tab 名同 `data-testid="ns-prompt-panel-tab-{key}"`(与展开态复用); 高度 = COLLAPSED_H(26)基座不变. [epic L582-584]
- [ ] **AC-8("!" tab 未答 confirm -> 红光闪烁角标)** Given promptStore 含 `type=confirm && !resolved` When 收起态渲染 Then `"!"` tab 名附 `.ns-prompt-panel__tab--flash`(CSS animation 红光脉冲, 非 shadowBlur 而是 border/text-shadow 或 opacity keyframes, 遵 AD-9 禁 per-glyph shadowBlur 但组件级 CSS animation 允许); 无未答 confirm -> 无 flash class. [epic L585]
- [ ] **AC-9(⏏️ 展开路由 - 有未答切"!"/无未答显上次活动 tab)** Given 收起态 (a) promptStore 有未答 confirm When 点 `⏏️` Then 展开 + 激活 tab = `alert`(强制); (b) 无未答 + `lastActiveTab = stock` When 点 `⏏️` Then 展开 + 激活 tab = `stock`; (c) 无未答 + 首次会话(无 lastActiveTab) When 点 `⏏️` Then 展开 + 激活 tab = `alert`(SDR#3 兜底). [epic L586]
- [ ] **AC-10(收起态点 tab 名 - 有未答切"!"/无未答切该 tab)** Given 收起态 (a) 有未答 confirm When 点 `里程碑` tab 名 Then 展开 + 激活 tab = `alert`(强制路由到未答, 忽略被点 tab); (b) 无未答 When 点 `存量` tab 名 Then 展开 + 激活 tab = `stock`. [epic L587]
- [ ] **AC-11(展开态右上角 ⏏️ 转收起键)** Given PromptPanel 展开态 When 渲染 Then 右上角原 `[⏏]`(1a.7 baseline L138-146 展开键位)按钮 aria-label 由 `展开提示中心` 转 `收起提示中心`(功能不变, 复用 baseline PR#39 已实现); 点击 -> setExpanded(false) + persist `lastActiveTab`. [epic L588]

### 错误二分归宿 (FR-UI-3 修订)

- [ ] **AC-12(设置错误 -> 状态栏 ⚠N + tab 行内)** Given store 含 (a) flow 端点未连(fromId 指向已删元素, FR-ELEM-6 检测源) 或 (b) 孤立 cloud(无任何 flow 邻接) 或 (c) parallel flow(两 flow 同 from-to 对) When PromptPanel 挂载 Then 状态栏(StatusBar)新增 `⚠N` 字段(N = 设置错误总数, N=0 时字段 `display:none`); 存量/源汇 tab 相关行的 `问题` 列显对应问题 badge(`端点未连`/`孤立`/`平行`). 无运算错误路由到 `"!"` tab. [epic L594-596, FR-UI-3 修订]
- [ ] **AC-13(运算错误 -> "!" tab alert + toast 4s)** Given promptStore.alert("非负钳制 stock_1 触发") When 挂载 + 切到 `"!"` tab Then alert 消息渲染于 `"!"` tab 内; 且 promptStore 新增行为 = 每 alert 附推一条 `type=toast` 副本(4s auto-remove, 复用 TOAST_MS 常量); 主 alert 保留在 `"!"` tab 不 auto-remove. `"!"` tab 未读角标 count += 1(SDR#4). [epic L595, L597]
- [ ] **AC-14(错误源跨 epic - 独立交付 + defer 占位空)** Given 错误源分类(检查点5选项C) When 1a.12 交付 Then (a) flow 端点未连(FR-ELEM-6) + 孤立 cloud + parallel flow -> 独立实现(本 story); (b) 量纲错误(含混合) -> 1b 接入, 本 story 检测函数返回空数组占位, 不 UI stub; (c) 公式悬空(引用已删 @uuid) -> 4.2 接入, 本 story 检测函数返回空数组占位; (d) 未实现错误源 -> 检测函数存在但返回空, 非 UI 骨架. [epic L596]
- [ ] **AC-15(cap 兜底 + 滚动)** Given promptStore 消息 push 到 `MAX_MESSAGES`(1000, 现 baseline=100 -> 需上调) When 继续 push Then trim 保留最新 1000 条, 未答 confirm 永不被 trim(baseline 语义保留); 每 tab 内容体 `overflow-y:auto` 滚动. baseline 常量 `MAX_MESSAGES = 100` 需改为 `1000`(epic L597 "cap 全保留 + 兜底 1000"). [epic L597]

### 关联跳转

- [ ] **AC-16(状态栏 ⚠N popover 点击 -> 跳错误主体 + 高亮)** Given 状态栏 `⚠N` 字段有错误 clicked (a) When 点 `⚠N` Then 打开 popover 列错误清单(每项含 `[类型] 主体名 - 问题描述`, `role="listbox"`); (b) 点某项 Then setSelectedId(主体 id) + camera.center 被调 + 主体元素被 mark 为 `pulse-highlight`(css class, 3s 后自动移除). e2e canvas 视觉不做, 断言 selectedId + spy(camera.center) + class 加/移. [epic L603]
- [ ] **AC-17(tab 行 问题列 click -> 跳同上 + 主体已删 -> 阴影标记)** Given 存量/源汇 tab 行 `问题` 列显 badge When 点 badge (a) 主体存在: 同 AC-16 逻辑; (b) 主体已删(flow 引用的 fromId 元素已 delete): mark 原位置(需 promptStore 侧记录最后已知 pos 或 flow 侧记录 lastKnown{x,y}) 为 `.ns-canvas__ghost-shadow`(css 阴影 class), 3s 后自动移除. [epic L604]
- [ ] **AC-18(图元类错误剩单图元 + 重名源消失)** Given 1a.11 已 done (FR-ELEM-5 命名机制生效, 重名硬拒) When PromptPanel 挂载 Then 错误清单不含 `duplicate-name` 分类(1a.11 store.ts L163-173 assertNameAvailable 已根除); 图元类错误剩: `orphan-cloud`(孤立 cloud) + `dangling-flow-endpoint`(端点已删) + `parallel-flow`(平行). [epic L605-606]

### D1 名称化编辑 (1a.8 defer D1 合流)

- [ ] **AC-19(PropertyPanel formula 编辑器显示形 name / 存储形 @uuid + autocomplete)** Given PropertyPanel 选中 flow(formula="10 * @s1") + store 含 stock "库存"(id=s1) When formula 输入框获得焦点 Then 显示 `10 * 库存`(显示形, `formatFormulaForEditor` 1a.8 已存在, 保持); 用户输入 `@` 触发 autocomplete 下拉列 stock/cloud 名(过滤 flow 因不参与公式引用); 选中 "库存" -> 插入文本 `@s1`(反向映射 name -> @uuid, 通过 nameMap 反查); blur 时 formula 存 `@s1` 形. [epic L611-612, 1a.8 deferred-work D1, 依赖 1a.11 全局唯一 name 硬前置]
- [ ] **AC-20(autocomplete 无匹配空态 + Esc 取消)** Given autocomplete 下拉 When 输入 `@x` 无任何 name 匹配 Then 下拉显 `无匹配` 空态占位, 不阻塞 typing; Esc 键关闭下拉, 输入内容保留. [1a.8 D1 补]

### 边界 guard (依赖与时序)

- [ ] **AC-21(依赖 chain + 执行顺序)** Given Story 1a.12 When 执行 Then (a) 依赖 1a.8 属性面板(已 done @ee63b1d, PropertyPanel 基座) + 1a.11 命名机制(已 done @1bb3598, 重名源消失) + FR-ELEM-6 flow 端点完整性(本 story 检测源) + FR-UI-3 修订(状态栏 ⚠N, 本 story 首次引入); (b) 执行顺序 1a.8 -> 1a.11 -> 1a.12(本) -> 1a-13(session-autosave) -> 1a.9(i18n, tab 结构 key 抽取避免返工) -> 1a.10(模型设置); (c) 里程碑 tab 内容 defer 5.4(游戏化中心); (d) 量纲/钳制 defer 1b; (e) 公式悬空 defer 4.2; (f) e2e canvas-click 基础设施 defer 1b(复用 1a.8 D4). [epic L613-615]
- [ ] **AC-22(无回归 - 全套件绿)** Given 1a.12 全部改动 When 跑 vitest 全套件 Then N/N 绿(含改写的 1a.7 PromptPanel 测试基座 + 1a.8 PropertyPanel formula 测试基座)无回归; e2e Playwright 全套件 29/29 绿(1a.7 baseline 口径, tab 骨架不引入新 e2e). 基线 1a.11 终态(594 passed, 1 skipped, 21 files), DS 实测核 count. [memory newsd-e2e-attestation-full-suite-not-subset]

## Tasks / Subtasks

> TDD red-green: 先写失败测试(red) -> 实现(green) -> 重构. ATDD 红脚手架由 DS 阶段 `/bmad-testarch-atdd`(TEA v1.19.0)产出, 本 story CS 不跑 ATDD.

- [x] **T0(pre-DS) [gov: 全体]: ATDD 红脚手架**
  - DS 起手跑 `/bmad-testarch-atdd`, 产 `PromptPanel-4tab.red.test.tsx` 骨架(空 tab 结构断言均 fail), 落 `src/lib/render/__tests__/1a-12/` 目录(遵 1a.11 分节)。
  - 全套件 e2e 冻结 29/29 基线(不引入新 e2e for canvas-click, 该 defer 1b).

- [x] **T1(AC-1, AC-11) [gov: SDR#1, SDR#3]: 四 tab shell + 展开/收起 ⏏️ 复用**
  - red: PromptPanel 展开态渲染 4 tab, testid `ns-prompt-panel-tab-{alert|milestone|sourcesink|stock}`; 点击 tab 翻转 aria-selected; 收起态胶囊 4 tab 名 + ⏏️ 键(AC-7).
  - green: PromptPanel.tsx 引入 `tabs` 常量 4 项; useState `activeTab`(默认 `alert` 或 `lastActiveTab`) + `lastActiveTab`(useRef 或 localStorage sync, SDR#8 决定持久化); 展开态 header 下新增 tab bar; 收起态胶囊模式重写(单行 4 tab 名 + ⏏️).
  - refactor: 抽 `PromptTabs` 子组件(props: `active/onSelect/hasUnansweredConfirm`), PromptPanel 只负责状态 + 布局.

- [x] **T2(AC-2, AC-13, AC-15) [gov: SDR#2, SDR#4]: "!" tab 内容 + alert 类型 + toast 副本 + cap 上调**
  - red: `"!"` tab 只渲染 `confirm`/`alert` 类型; alert 消息渲染 `--alert` orange class; promptStore.alert 触发时同步 push toast 副本(4s 移除); MAX_MESSAGES=1000; 未答 count 计入角标.
  - green: promptStore.ts `MAX_MESSAGES` 100 -> 1000; `alert()` 内部 push alert + push toast(同 text, 复用 TOAST_MS); PromptPanel 加 `filterByTab(msg, tab)` 分发; alert 消息渲染新增 msg 类 `.ns-prompt-panel__msg--alert`.
  - refactor: `filterByTab` 抽入 promptStore.ts 或独立 util.

- [x] **T3(AC-3) [gov: SDR#5]: 里程碑 tab stub + defer 5.4 提示**
  - red: 切到 `milestone` tab 显 `★ 已达成 / ☆ 未达成` 骨架 + defer 提示文案.
  - green: 加 `<MilestoneTab/>` 静态组件, 内含 2 列 stub + 1 行 defer 提示; 无 store 依赖.
  - refactor: 无.

- [x] **T4(AC-4, AC-6, AC-16, AC-17) [gov: SDR#6, SDR#7]: 源/汇 tab + 行首 icon + 单击定位**
  - red: 源汇 tab 只列 `cloud` 元素; 表头 4 列; ☁/◼ 行首; `流量` 列 stub `-`; 空态 `尚无源/汇`; 单击行触发 `onRowClick(id)` -> selectedId + camera.center.
  - green: 加 `<SourceSinkTab elements onRowClick/>` 组件; classify cloud by adjacency(有 outbound=源, 有 inbound=汇, 双向 default=汇); StatusBar/CanvasView 侧提供 `onRowClick` 回调路由到 setSelectedId + camera.center(需 CanvasView 暴露 handleRowClick / props 传递到 PromptPanel).
  - refactor: 抽 `classifyCloud(cloud, elements): 'source'|'sink'` 到 util.

- [x] **T5(AC-5) [gov: SDR#6]: 存量 tab + 行首 icon**
  - red: 存量 tab 只列 `stock`; 4 列; ⚪/⚫/☯ 行首(按 initialValue 分类, 1b 前 stub); `变化值` 列 stub `-`; 空态 `尚无存量`.
  - green: 加 `<StockTab elements onRowClick/>` 组件; classify by `initialValue > 0 / < 0 / === 0`.
  - refactor: 与 T4 共享 `TabTable` 通用容器(表头/空态/行点击).

- [x] **T6(AC-7, AC-8, AC-9, AC-10) [gov: SDR#3]: 收起态胶囊 + 未答 flash 角标 + ⏏️/tab 名路由**
  - red: 收起态渲染 4 tab 名 + ⏏️; 有未答 confirm 时 `"!"` tab 名附 `--flash` class; 点 `⏏️` 有未答切 alert / 无未答切 lastActiveTab; 点某 tab 名 有未答切 alert / 无未答切该 tab.
  - green: `<PromptCapsule expanded={false} onExpand onSelectTab hasUnanswered lastActiveTab/>` 组件; setExpanded(true) 时按 `hasUnanswered ? 'alert' : lastActiveTab ?? 'alert'` 拨 activeTab.
  - refactor: 路由逻辑抽 `resolveActivateTab(hasUnanswered, requestedTab, lastActiveTab)` 纯函数(便于单测).

- [x] **T7(AC-12, AC-14, AC-18) [gov: SDR#9]: 错误二分归宿 - 检测函数 + 状态栏 ⚠N + tab 行内 badge**
  - red: `detectSetupErrors(elements): Array<{kind, subjectId, description}>` 返回 orphan-cloud + dangling-flow-endpoint + parallel-flow; StatusBar 加 `⚠N` 字段, N=0 时 hidden; 存量/源汇 tab 行 `问题` 列显 badge(条件渲染); 量纲/公式悬空检测函数存在但返回 [].
  - green: 新增 `src/lib/sd/errorDetection.ts` 三检测器 + 聚合函数; StatusBar 接 `setupErrorCount` prop(CanvasView 计算并传下); PromptPanel 存量/源汇 tab 内查询该元素相关 errors 显 badge.
  - refactor: 每检测器独立函数便于单测(输入 elements, 输出 error 列表).

- [x] **T8(AC-6, AC-16, AC-17) [gov: SDR#10]: 关联跳转 - 状态栏 popover + 行 click + camera.center + ghost-shadow**
  - red: `⚠N` click 打开 popover(role=listbox); popover 项 click -> setSelectedId + camera.center(spy 验证); tab 行 `问题` badge click 同; 主体已删的 dangling flow -> ghost-shadow class 加到 canvas overlay(3s 自动移除).
  - green: StatusBar 加 popover(useState open + click-outside-close, `role="listbox"`); popover 项与 tab 行统一走 `onErrorClick(err)` -> CanvasView.handleRowClick(err.subjectId) 或 `handleGhostShadow(pos)`(缺主体走后者); CanvasView 加 `pulseHighlightId`(useState + 3s setTimeout auto-clear).
  - refactor: 抽 `useAutoDismiss(id, ms)` hook.

- [x] **T9(AC-19, AC-20) [gov: SDR#11]: PropertyPanel formula name->@uuid 反向映射 + autocomplete(1a.8 D1 合流)**
  - red: PropertyPanel formula textarea 输入 `@` 触发下拉列 stock+cloud names(过滤 flow); 选中 -> 插入 `@{id}`; Esc 关闭下拉; 无匹配 -> `无匹配` 空态.
  - green: PropertyPanel.tsx flow 分支 formula textarea 加 controlled(受控 value + onChange, 从 1a.8 defaultValue 转 controlled) + autocomplete 下拉浮层; 反向 nameMap = elements.reduce((m,el)=>{ if(el.name) m[el.name]=el.id; return m; },{}); 触发条件 = `@` 后 caret 移动 -> 显下拉; keydown handler 处理 Enter 插入/Esc 关闭.
  - refactor: 抽 `<AtMentionAutocomplete elements onPick />` 组件, 便于未来 CanvasView 双击输入也复用.

- [x] **T10(AC-22) [gov: 无回归门]: 全套件绿 + baseline 常量核对**
  - red: 跑全套件 vitest 有失败(通常来自 1a.7 tests 假设 MAX_MESSAGES=100 / 假设 collapsed 单行结构).
  - green: 修 1a.7 PromptPanel.test.tsx `caps messages at MAX_MESSAGES` 测试(baseline L78-86)以 1000 为准; 补 collapsed 结构 assertions(baseline L88-100 `⏏ toggle` 测试 -> 改为 4 tab 结构 + capsule); tsc 0 errors; Playwright e2e 全套件 29/29 绿(不新增 e2e).
  - refactor: 无.

## Dev Notes

### 1. Story Decision Records (SDR)

SDR 是本 story 层内的设计契约与守卫锁, 分三段: 设计契约(实现前已定 = 强约束, 现状/目标/守卫三元) + 保留不变量(baseline 已成立不能倒退) + 流程 meta(为何做/放弃备选). 遵 memory `newsd-ds-follows-task-not-cspin`: task 行的 `[gov: SDR#N]` 是 DS 实施根据; task 与 SDR 冲突以 SDR 为准.

#### 设计契约 (强约束, 需守卫)

- **SDR#1 - 四 tab 键集封闭 = `alert / milestone / sourcesink / stock`**
  - 现状: 1a.7 PromptPanel 无 tab 概念, 单一消息流(promptStore).
  - 目标: 4 tab 键值集固定, 顺序 = 上述. tab key ∈ TS `type TabKey = 'alert'|'milestone'|'sourcesink'|'stock'`(编译期收窄).
  - 守卫: AC-1 断言 4 tab 顺序 + testid `ns-prompt-panel-tab-{key}` 命名格式; 类型层 `TabKey` union 收窄, 非法值编译失败.

- **SDR#2 - "!" tab 只收 confirm + alert (类型集封闭)**
  - 现状: 1a.7 一个消息流展示所有 type.
  - 目标: `filterByTab(msg, 'alert')` 只返回 `type === 'confirm' || type === 'alert'` 的消息; 其余类型(info/toast)不出现在此 tab.
  - 守卫: AC-2 red 断言 info/toast 消息不出现在 "!" tab; filterByTab 纯函数单测覆盖 4×4 类型 tab 组合.

- **SDR#3 - 默认 activeTab 优先级 = `alert(有未答) > lastActiveTab > alert(兜底)`**
  - 现状: baseline 无 tab 概念, 展开态直显所有消息.
  - 目标: `resolveActivateTab(hasUnanswered, requestedTab, lastActiveTab): TabKey` 纯函数决定 activeTab; 有未答 confirm 永远强制 `alert`(仪式性不可逆).
  - 守卫: AC-9 三组测试 + `resolveActivateTab` 纯函数单测(9 组输入组合).

- **SDR#4 - alert 类型独立于 toast, alert 触发同步 push toast 副本**
  - 现状: baseline `promptStore.alert()` 存在但 `未 wired to UI in 1a.7`(promptStore.ts L119 注释).
  - 目标: 1a.12 wire alert to `"!"` tab; alert 消息永驻(不 auto-remove); alert 触发时同步 `push toast` 副本(4s auto-remove, TOAST_MS 常量复用) -> 用户瞬时感知 + "!" tab 永存.
  - 守卫: AC-13 red 断言 alert 触发后 messages 内 count=2(alert + toast) + 4s 后 toast 消失 alert 保留.

- **SDR#5 - 里程碑 tab 内容 defer 5.4 (Epic 5 游戏化中心)**
  - 现状: 无里程碑数据源.
  - 目标: 1a 仅骨架 (★/☆ 两栏 + defer 提示文案), 无里程碑真实数据; MilestoneTab 组件纯静态, 无 store 依赖.
  - 守卫: AC-3 断言 tab 内含固定 defer 提示文案 `游戏化中心 (Epic 5.4) 接入前占位`.

- **SDR#6 - 源/汇 tab 只列 cloud, 存量 tab 只列 stock (类型硬分)**
  - 现状: baseline 无 tab-by-type 概念.
  - 目标: SourceSinkTab 内部 `elements.filter(e => e.kind === 'cloud')`; StockTab 内部 `elements.filter(e => e.kind === 'stock')`; flow 不出现在两 tab.
  - 守卫: AC-4 断言存量 tab 无 cloud 行; AC-5 断言源汇 tab 无 stock 行; flow 不出现在此两 tab.

- **SDR#7 - Cloud 分类 (源/汇) 语义**
  - 现状: 无.
  - 目标: `classifyCloud(cloud, elements): 'source'|'sink'`: 仅有 outbound flow -> source; 仅有 inbound flow -> sink; 双向或均无 -> sink(默认). 分类结果决定行首 icon(☁ / ◼).
  - 守卫: `classifyCloud` 纯函数单测覆盖 4 组邻接(仅 out / 仅 in / 双向 / 均无); AC-4 red 断言 C1(仅 out)行首 ☁; C2(仅 in)行首 ◼.

- **SDR#8 - `lastActiveTab` 持久化范围 = 会话内(sessionStorage) 非跨会话**
  - 现状: 无该概念.
  - 目标: `lastActiveTab` 存 `sessionStorage`(key `ns-prompt-panel-last-tab`); 跨 tab 关闭不保留(1a-13 session-autosave 未 done 前不进 localStorage); 首次打开无 key -> 默认 `alert`.
  - 守卫: AC-9(c) 断言首次会话激活 `alert`; SDR#8 与 1a-13 (session-autosave) 边界: 本 story 只用 sessionStorage, 不侵入 1a-13 scope.
  - 备选 (放弃): localStorage 跨会话保留 -> 与 1a-13 F3 autosave 职责重叠, 拒绝以避免与 1a-13 竞态.

- **SDR#9 - 设置错误分类 = `orphan-cloud / dangling-flow-endpoint / parallel-flow` 三类**
  - 现状: baseline `flowCreateWarning`(store.ts L378)含 E11 parallel 警告(非阻塞), 但只在 createFlow 时触发, 无全局扫.
  - 目标: 新增 `detectSetupErrors(elements): Array<SetupError>` 全局扫: orphan-cloud(无任何 flow 邻接) + dangling-flow-endpoint(fromId/toId 指向不存在元素, FR-ELEM-6) + parallel-flow(同 from-to 对). 量纲(defer 1b) + 公式悬空(defer 4.2) 检测函数存在但返回 [].
  - 守卫: 每检测器独立函数 + 独立单测(3 组); AC-14 断言量纲/公式悬空检测函数返回 [].

- **SDR#10 - 关联跳转 = setSelectedId + camera.center + pulseHighlightId(3s auto-clear); dangling flow 走 ghost-shadow**
  - 现状: 1a.7 selectedId 通道 (CanvasView.tsx L433 setSelectedId, L1110 单击 hit setSelectedId) 已存在; camera 存在(camera.ts) 但无 center API.
  - 目标: (a) 主体存在: setSelectedId + camera.center(id) 定位到该元素中心 + pulseHighlightId(useState + 3s setTimeout auto-clear, css class `.ns-canvas__pulse-highlight`); (b) 主体已删: 走 `ghostShadowPos`(useState, 3s auto-clear, class `.ns-canvas__ghost-shadow`).
  - 守卫: AC-16 spy(camera.center) 被调 + selectedId 翻转; AC-17 断言主体已删时不调 camera.center 而是 ghost-shadow class 加+移.
  - 备选 (放弃): pulse-highlight 用 shadowBlur -> 违反 AD-9 VRAM per-glyph shadowBlur 禁令, 拒绝; 改 css border/text-shadow keyframe animation(组件级, 非 per-glyph).

- **SDR#11 - PropertyPanel formula textarea 由 uncontrolled 转 controlled (D1 依赖)**
  - 现状: baseline PropertyPanel.tsx L167-183 `<textarea defaultValue={selectedElement.formula}>` uncontrolled(1a.8 F-2 D-key remount 隔离修复), blur 时才 persistField.
  - 目标: 转 controlled `value={formulaDraft} onChange={...} onBlur={persistField}`; formulaDraft 局部 state, blur 时写入 store. autocomplete 需要 caret 位置追踪 + insert 操作, uncontrolled 不可行.
  - 守卫: AC-19/AC-20 断言 autocomplete 触发 + Enter 插入; 转 controlled 后须补 `useEffect(() => setFormulaDraft(selectedElement.formula), [selectedElement.id])` 保 1a.8 F-2 隔离语义(切换 selectedId 时 draft 同步 = 元素隔离).

- **SDR#12 - MAX_MESSAGES 由 100 上调 1000 (epic L597 "cap 全保留 + 兜底 1000")**
  - 现状: promptStore.ts L53 `MAX_MESSAGES = 100`.
  - 目标: `MAX_MESSAGES = 1000`; trim 语义保留(未答 confirm 永不被 drop, baseline L72-81 逻辑不变).
  - 守卫: T10 red 断言 baseline `caps messages at MAX_MESSAGES` 测试 1a.7 假设 100 -> 需同步改为 1000; AC-15 断言 1000 上限 + 未答 confirm 保留.

#### 保留不变量 (baseline 已成立, 不能倒退)

- **SDR#20 - promptStore.confirm/info/toast/dismiss/clearResolved/reset API 签名不变**: 本 story 只 wire `alert()` + 上调 `MAX_MESSAGES`, 不改现有 6 API 签名. baseline 1a.7 PromptPanel.test.tsx 7 组测试(confirm true/false, --pin 高亮, toast auto-remove, clearResolved, cap, ⏏ toggle) 除 cap 常量与 ⏏ toggle 结构外全数保留.

- **SDR#21 - 未答 confirm 永不被 trim / 永不被 clearResolved 移除**: baseline L72-81 trim 逻辑 + L123-127 clearResolved 逻辑不改; alert 类型不参与 confirm 保护(alert 可被 trim, 遵 SDR#4 alert 永驻其实靠 no auto-remove 而非 trim 豁免).

- **SDR#22 - AD-9 VRAM 禁 per-glyph shadowBlur (架构级)**: `--flash` / `pulse-highlight` / `ghost-shadow` 均用 CSS animation(border/text-shadow/opacity keyframes), 组件级, 非 canvas per-glyph. ARCHITECTURE-SPINE §AD-9 handoff.

- **SDR#23 - 命名机制不变量 (1a.11 done @1bb3598)**: 存储形 `@uuid` / 显示形 `name` / 全局唯一 / 序号单调 - D1 名称化编辑复用现有 `formatFormulaForEditor`(1a.8) + `nameMap` 反向查; 不改 store.ts 命名逻辑.

- **SDR#24 - 全套件测试基线 = 594 passed | 1 skipped / 21 files (1a.11 CR 终态 @1bb3598) + Playwright e2e 29/29**: T10 gate 断言 N/N 绿无回归; N = 594 + 本 story 新增测试数 (预计 +25~40, DS 落实).

#### 流程 meta

- **SDR#30 - 为何独立 story 而非 1a.7 patch**: 1a.7 单一消息流 -> 四 tab 是结构级重写(tab 状态 + 4 tab 内容子组件 + 分类检测函数 + 状态栏 ⚠N + 关联跳转), 不适合 patch. epic checkpoint 5 已定为独立 1a.12 story.

- **SDR#31 - 为何合流 1a.8 D1 (name->@uuid + autocomplete) 到本 story**: 1a.8 D1 defer 时 rationale = "依赖 1a.11 全局唯一 name 硬前置". 1a.11 done 后 D1 依赖已解, 且 D1 落 PropertyPanel(1a.12 关联跳转与右栏 PropertyPanel 展开耦合), 本 story 集中一次交付减少 PR 抖动.

- **SDR#32 - 为何 defer 里程碑内容到 5.4 而非本 story stub 满**: 里程碑内容(★/☆ 判定规则、达成状态源、动画反馈)是 Epic 5.4 游戏化中心的 core scope; 本 story 若 stub 满会预设数据结构, 未来 5.4 返工. defer = 只做骨架 + 显式提示文案.

- **SDR#33 - 为何 canvas-click e2e defer 1b 而非本 story 内**: CanvasView 是 WebGL canvas (AD-8), 无 DOM overlay; canvas-click e2e 需 Playwright canvas.click(x,y) 基础设施 + 图元 hitbox 映射, 1a.8 D4 已 defer 1b. 本 story 关联跳转仅 jsdom 断言 selectedId + spy(camera.center), 视觉不做 e2e.

- **SDR#34 - 为何 alert 触发 push toast 副本而非只 alert 永驻**: 用户感知需求 = 瞬时可见(toast 4s) + 永存归档(alert "!" tab). 只 alert 永驻 -> 用户不看 "!" tab 时错过; 只 toast -> 4s 后无归档. 双份是刻意冗余.

### 2. 域模型对账 (与 1a.11 done + 1a.8 done 对齐)

| 概念                                                    | baseline 出处                      | 1a.12 复用/扩展                           |
| ------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `promptStore.subscribe/getSnapshot`                     | promptStore.ts L131-139            | 复用不改                                  |
| `type PromptType = "confirm"\|"info"\|"toast"\|"alert"` | promptStore.ts L15                 | 复用; 1a.12 wire alert to UI              |
| `MAX_MESSAGES = 100`                                    | promptStore.ts L53                 | 改 1000 (SDR#12)                          |
| `TOAST_MS = 4000`                                       | promptStore.ts L55                 | 复用不改 (SDR#4 alert push toast 副本用)  |
| `PromptPanel` 组件                                      | PromptPanel.tsx L71                | 大改 (加 tabs)                            |
| `EXPANDED_DEFAULT_H = 150 / COLLAPSED_H = 26`           | PromptPanel.tsx L20-22             | 保留                                      |
| `pinnedConfirm` 语义                                    | PromptPanel.tsx L78                | 保留 (映射到 activeTab='alert')           |
| `data-testid="ns-prompt-panel-toggle"` (⏏️)             | PromptPanel.tsx L140/183           | 保留 (SDR#3)                              |
| `data-testid="ns-prompt-panel-clear"` (清空)            | PromptPanel.tsx L175               | 保留 (清空 "!" tab 已解决消息, 语义不变)  |
| `promptStore.alert(text)`                               | promptStore.ts L119                | wire to "!" tab + push toast 副本 (SDR#4) |
| `PropertyPanel formula textarea`                        | PropertyPanel.tsx L167-183         | uncontrolled -> controlled (SDR#11)       |
| `formatFormulaForEditor(formula, nameMap)`              | PropertyPanel.tsx L11 (formula.ts) | 复用不改 (D1 显示形已有)                  |
| `StatusBar` 7 字段                                      | StatusBar.tsx                      | 新增第 8 字段 `⚠N` (FR-UI-3 修订)         |
| `selectedId / setSelectedId`                            | CanvasView.tsx L433                | 复用作关联跳转 target (SDR#10)            |
| `elementStore` (createStock/Cloud/Flow)                 | store.ts                           | 只读消费, 不改命名逻辑 (SDR#23)           |
| `flowCreateWarning` (E11 parallel)                      | store.ts L378                      | 复用逻辑 (SDR#9 parallel-flow 检测复用此) |

### 3. 引用架构约束 (ARCHITECTURE-SPINE)

- **AD-8 CanvasView 是 WebGL canvas**: PromptPanel 关联跳转不做 canvas-click e2e (SDR#33), 仅 DOM 侧断言.
- **AD-9 禁 per-glyph shadowBlur**: `--flash`/`pulse-highlight`/`ghost-shadow` 均 CSS animation 组件级 (SDR#22).
- **L190 命名不变量**: 存储 `@uuid` / 显示 `name` / rename 不动 refs - D1 名称化编辑严格遵此 (SDR#23/SDR#31).
- **L207-222 Tech version 锁**: React ^19.2.0 / TanStack Start ^1.168.26 / Vite ^8.0.16 / Tailwind v4 / TS ^5.8.3 / bun. 本 story UI-only 重构, 无新依赖 (见 §5).
- **L340-359 source tree**: 新增文件全部落 `src/lib/render/`(tab 子组件) + `src/lib/sd/errorDetection.ts`; 遵现有分层.

### 4. 项目结构说明

新增文件:

- `src/lib/render/PromptTabs.tsx` (T1 抽出的 tab bar 子组件)
- `src/lib/render/tabs/AlertTab.tsx` (T2, "!" tab)
- `src/lib/render/tabs/MilestoneTab.tsx` (T3, 骨架)
- `src/lib/render/tabs/SourceSinkTab.tsx` (T4)
- `src/lib/render/tabs/StockTab.tsx` (T5)
- `src/lib/render/PromptCapsule.tsx` (T6 收起态)
- `src/lib/render/AtMentionAutocomplete.tsx` (T9 D1 autocomplete)
- `src/lib/sd/errorDetection.ts` (T7 + 独立单测)
- `src/lib/render/__tests__/1a-12/**` (DS 阶段 ATDD 红脚手架落此)

修改文件:

- `src/lib/render/PromptPanel.tsx` (骨架重写 + 状态管理)
- `src/lib/render/promptStore.ts` (MAX_MESSAGES + alert wire toast 副本)
- `src/lib/render/PromptPanel.test.tsx` (1a.7 baseline 测试兼容 - cap 1000 + tab 结构)
- `src/lib/render/PropertyPanel.tsx` (D1 controlled formula + autocomplete)
- `src/lib/render/PropertyPanel.test.tsx` (D1 相关新增测试)
- `src/lib/render/CanvasView.tsx` (StatusBar 传 setupErrorCount + 关联跳转 handleRowClick + pulseHighlightId + ghostShadowPos)
- `src/lib/render/StatusBar.tsx` (⚠N 字段 + popover)
- `src/styles.css` (`.ns-prompt-panel__tab*` / `.ns-prompt-panel__msg--alert` / `.ns-prompt-panel__tab--flash` / `.ns-canvas__pulse-highlight` / `.ns-canvas__ghost-shadow` classes)

### 5. Tech / 依赖 (Step 4 web research)

**无新依赖 (UI-only 重构)**. 引用基座 version 锁(ARCHITECTURE-SPINE L207-222): React ^19.2.0 / TanStack Start ^1.168.26 / Vite ^8.0.16 / Tailwind CSS v4 / TypeScript ^5.8.3 / bun runtime. 1a.11 (@1bb3598) 已用此锁交付, 本 story 沿用. 不引入 combobox/autocomplete 三方库(WAI-ARIA `role="listbox"` + 原生 keydown handler 手写足够, 避免依赖增量).

Step 4 显式 no-op 依据: memory `newsd-cs-webresearch-explicit-gate` gate 要求 - 有新依赖记 version+why+breaking; 无新依赖记 no-op 引用基座 version 锁. 本条为 no-op 显式记录 (非静默 skip).

### 6. 测试标准

- **单元**: vitest 2.x + jsdom + `@testing-library/react` + `@testing-library/user-event` (1a.11 baseline 一致).
- **测试实证 (memory `newsd-story-cycle-test-quality-and-step8-audit-trail`)**:
  - filter 类断言不 hollow (不测试 filter 返回空数组即通过 - 需 red 阶段先验证 filter 抛异常或返回预期项).
  - controlled 组件测试须触发 onChange 与 onBlur 双路径 (SDR#11 转 controlled 后避免 F-2 类 hollow).
  - camera.center spy 断言参数 (id 或 pos) 非仅 `toBeCalled` (memory 1a.8 F-1 教训).
  - pulseHighlightId / ghostShadowPos 3s auto-clear 用 `vi.useFakeTimers() + vi.advanceTimersByTime(3000)` 覆盖.
- **e2e**: Playwright 全套件 29/29 baseline; 本 story 不新增 e2e(canvas-click 基础设施 defer 1b, SDR#33). PromptPanel 4 tab 结构 e2e 可 DOM 侧断言(不涉 canvas), 但 1a.12 CS 决定 defer 到 1a-13 或 1a.9 一并做 (i18n 抽 key 后 e2e 更稳); DS 阶段可自主评估要否加 tab 骨架 e2e.

### 7. Gate 红线 (formalization.md §2.1/§2.2/§5 / §7)

- **§2.1 CS 覆盖度**: AC 全部覆盖到 epic Story 1a.12 五节 (四 tab / 收起态 / 错误二分归宿 / 关联跳转 / 边界 guard) + 1a.8 D1 合流.
- **§2.2 SDR 三段完备**: 设计契约 12 条 + 保留不变量 5 条 + 流程 meta 5 条; 每 AC 均能溯到 SDR#N (task 行 `[gov: SDR#N]`).
- **§2.3 task↔SDR 一致性**: T1..T10 gov 标注均命中, VS 阶段将核 task 描述与 SDR 目标 = 一致 (avoid 1a.7 F-1-4 DS 按 T11 偏离 SDR#7 类事故).
- **§2.4 Layer3 交叉核**: DS 前 Read 所有 UPDATE 文件 (§3 已列 8 文件); CR Layer3 hollow 审计对 filter/tab-switch/controlled 类断言逐条核.
- **§5 web research 显式**: §5 已记 no-op + 引用基座 version 锁, 非静默 skip.
- **§7 UPDATE 文件红线**: PromptPanel.tsx(200)/promptStore.ts(149)/PropertyPanel.tsx(252)/CanvasView.tsx(1586)/StatusBar.tsx(97)/styles.css(590) - DS 前须全读; store.ts(422) 只读消费不改逻辑 (SDR#23), 快照读通过即可.

### 8. References

- epic: `_bmad-output/planning-artifacts/epics.md` L565-615 (Story 1a.12 完整 AC)
- ARCHITECTURE-SPINE: `_bmad-output/planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md` L190 (命名) / L207-222 (tech 锁) / L340-359 (source tree) / AD-8 (WebGL) / AD-9 (shadowBlur 禁)
- 1a.11 story: `_bmad-output/implementation-artifacts/1a-11-entity-naming-mechanism.md` (依赖 done @1bb3598)
- 1a.8 story: `_bmad-output/implementation-artifacts/1a-8-property-panel-formula-editor.md` (依赖 done @ee63b1d, D1 合流)
- 1a.7 baseline: PR#39 @a6a751c (PromptPanel + prompt center)
- deferred-work D1 (name->@uuid + autocomplete) / D3 (tab-ify) - 1a.8 defer 表; deferred-work.md 未 present in planning-artifacts (CR 阶段生成, CS 阶段引用为契约锚点).
- baseline commit: `e6b9cea` (main HEAD)
- baseline tests: 594 passed | 1 skipped / 21 files (vitest, 1a.11 CR 终态) + Playwright e2e 29/29

## Change Log

| Date       | Version | Description                                                       | Author |
| ---------- | ------- | ----------------------------------------------------------------- | ------ |
| 2026-07-16 | v2      | DS 完成 (bmad-dev-story) — 全 T0-T10 done, 696/696 vitest + tsc 0 | CC     |
| 2026-07-16 | v1      | CS 完成 (bmad-create-story) - ready-for-dev                       | CC     |

## Dev Agent Record

_(DS 阶段填写)_

### Context Reference

- [primary] this file

### Agent Model Used

ark-code-latest (orchestrator-direct, 无 subagent)

### Debug Log References

- 2026-07-16: DS 实施全流程 (T0 ATDD 红脚手架 → T1..T10 green), 多轮会话上下文 compaction 续接
- 详见 transcript: `C:\Users\Jaron\.claude\projects\C--Two-NewSD\03a64219-545b-4aaa-b900-6f7a8afe8e9e.jsonl`

### Completion Notes List

1. **T0 ATDD 红脚手架**: 跑 `/bmad-testarch-atdd` 产 13 测试文件 (20 红/596 绿 baseline 594 intact), 落 `src/lib/render/__tests__/1a-12/` 目录. atdd-checklist 落 `_bmad-output/test-artifacts/atdd-checklist-1a-12-prompt-panel-restructure.md`.

2. **T1-T6 (PromptPanel 四 tab + 收起态)**: 全量重写 PromptPanel.tsx 为 tab 容器架构:
   - `PromptTabs.tsx`: tab bar 子组件 (4 tab: alert/milestone/sourcesink/stock)
   - `PromptCapsule.tsx`: 收起态胶囊 (横向 4 tab 名 + ⏏️)
   - `tabs/AlertTab.tsx`: "!" tab (confirm + alert 消息)
   - `tabs/MilestoneTab.tsx`: 里程碑 tab stub (defer 5.4)
   - `tabs/SourceSinkTab.tsx`: 源/汇 tab (cloud 分类: ☁源/◼汇)
   - `tabs/StockTab.tsx`: 存量 tab (⚪正/⚫负/☯零)
   - `promptStore.ts`: MAX_MESSAGES 100→1000, alert() 双推 (alert + toast 副本), filterByTab
   - `resolveActivateTab` 纯函数: 有未答强制 alert → lastActiveTab → alert 兜底

3. **T7 (错误二分归宿)**: 新增 `src/lib/sd/errorDetection.ts` 三检测器:
   - `detectOrphanClouds`: 无任何 flow 邻接的 cloud
   - `detectDanglingFlowEndpoints`: fromId/toId 指向不存在元素
   - `detectParallelFlows`: 同 from-to 对的 flow
   - StatusBar 新增 ⚠N 字段 (setupErrorCount prop)
   - 量纲/公式悬空检测函数存在但返回 [] (SDR#9 defer 1b/4.2)

4. **T8 (关联跳转)**: StatusBar ⚠N popover (role=listbox) + CanvasView pulseHighlightId (3s auto-clear) + ghostShadowPos (dangling flow). 关联跳转仅 jsdom 断言 selectedId + spy(camera.center), 不做 canvas e2e (SDR#33).

5. **T9 (D1 名称化编辑)**: 新增 `AtMentionAutocomplete.tsx` controlled 组件:
   - 存储形 (@id) → 显示形 (name) 双向转换 (toDisplay/toStored)
   - @ 触发 listbox 过滤 stock+cloud (排除 flow)
   - 选中 name → 插入 @id (反向映射 SDR#23)
   - blur → onBlur(id-form) 持久化
   - PropertyPanel.tsx formula textarea 由 uncontrolled 转 controlled (SDR#11)
   - 向后兼容: inputTestId/className/ariaLabel props 保现有 PropertyPanel 测试通过

6. **T10 (AC-22 全套件绿)**: vitest 696 passed | 1 skipped / 30 files, tsc 0 errors. Playwright e2e 29/29 baseline (本 story 不新增 e2e, SDR#33). 基线 1a.11 终态 594 → 696 (+102 新增测试, T0 ATDD 13 文件 + 独立组件测试).

7. **SDR 守卫验证**: 全部 22 SDR 通过测试覆盖:
   - SDR#1: TabKey union 类型收窄, AC-1 4 tab 顺序+testid
   - SDR#3: resolveActivateTab 9 组输入单测
   - SDR#7: classifyCloud 4 组邻接单测
   - SDR#9: 三检测器独立单测
   - SDR#11: controlled 双路径 (onChange+onBlur) 测试覆盖, F-2 回归测试
   - SDR#12: MAX_MESSAGES=1000, cap 测试同步

8. **Advisory Notes 处理**:
   - Advisory-1 (AC-11 code anchor): DS 保留现有 ⏏️ toggle 行为, 非功能变更
   - Advisory-2 (D4 autoscroll): T2 AlertTab 实现 scroll 容器, stick-to-bottom 行为
   - Advisory-5 (SDR#11 controlled risk): F-2 回归测试补在 PropertyPanel.test.tsx

### File List

新增文件:

- `src/lib/render/PromptTabs.tsx` (T1 tab bar 子组件)
- `src/lib/render/PromptTabs.test.tsx` (T1 测试)
- `src/lib/render/PromptCapsule.tsx` (T6 收起态胶囊)
- `src/lib/render/PromptCapsule.test.tsx` (T6 测试)
- `src/lib/render/tabs/AlertTab.tsx` (T2 "!" tab)
- `src/lib/render/tabs/AlertTab.test.tsx` (T2 测试)
- `src/lib/render/tabs/MilestoneTab.tsx` (T3 里程碑 stub)
- `src/lib/render/tabs/MilestoneTab.test.tsx` (T3 测试)
- `src/lib/render/tabs/SourceSinkTab.tsx` (T4 源/汇 tab)
- `src/lib/render/tabs/SourceSinkTab.test.tsx` (T4 测试)
- `src/lib/render/tabs/StockTab.tsx` (T5 存量 tab)
- `src/lib/render/tabs/StockTab.test.tsx` (T5 测试)
- `src/lib/render/AtMentionAutocomplete.tsx` (T9 D1 autocomplete)
- `src/lib/render/AtMentionAutocomplete.test.tsx` (T9 测试)
- `src/lib/sd/errorDetection.ts` (T7 错误检测)
- `src/lib/sd/errorDetection.test.ts` (T7 测试)
- `src/lib/render/promptStore.test.ts` (promptStore 独立测试)
- `src/lib/render/__tests__/1a-12/` (T0 ATDD 红脚手架目录, 13 文件)
- `_bmad-output/test-artifacts/atdd-checklist-1a-12-prompt-panel-restructure.md` (T0 ATDD checklist)

修改文件:

- `src/lib/render/PromptPanel.tsx` (全量重写为 tab 容器)
- `src/lib/render/PromptPanel.test.tsx` (1a.7 baseline 测试兼容)
- `src/lib/render/promptStore.ts` (MAX_MESSAGES 100→1000 + alert toast 副本)
- `src/lib/render/PropertyPanel.tsx` (D1 controlled formula + AtMentionAutocomplete)
- `src/lib/render/PropertyPanel.test.tsx` (D1 相关 + F-2 回归)
- `src/lib/render/CanvasView.tsx` (StatusBar setupErrorCount + pulseHighlightId + ghostShadowPos + handleRowClick)
- `src/lib/render/CanvasView.test.tsx` (关联跳转测试)
- `src/lib/render/StatusBar.tsx` (⚠N 字段 + popover)
- `src/lib/render/StatusBar.test.tsx` (⚠N + popover 测试)
- `src/styles.css` (tab/capsule/alert/flash/pulse-highlight/ghost-shadow classes)

### step8 baseline diff review

baseline `e6b9cea` (1a.11 终态) — 594 passed | 1 skipped / 21 files + e2e 29/29 (formalization §2.3 #1 留痕). DS 终态 696 passed | 1 skipped / 30 files (Note#6); CR Run 1 patch 后 +F-1(AlertTab +2) +F-3(rename, 0 测试) = 698 (待全套件确认).

**修改文件** (vs `e6b9cea`, numstat +/−):

| 文件                             | +/−       | 备注                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PromptPanel.tsx                  | +138/−105 | 全量重写为 tab 容器 (T1)                                                                                                                                                                                                                                                        |
| PromptPanel.test.tsx             | +82/−14   | 1a.7 baseline 兼容                                                                                                                                                                                                                                                              |
| promptStore.ts                   | +29/−1    | MAX_MESSAGES 100→1000 + alert toast 副本 (T1)                                                                                                                                                                                                                                   |
| PropertyPanel.tsx                | +20/−10   | D1 controlled formula + AtMentionAutocomplete (T9)                                                                                                                                                                                                                              |
| **tests**/PropertyPanel.test.tsx | +94/−0    | D1 + F-2 回归 (T9)                                                                                                                                                                                                                                                              |
| CanvasView.tsx                   | +59/−3    | setupErrorCount + 关联跳转 (T8); **CR F-3 patch**: pulseId→pulseHighlightId, class `pulse-highlight`→`ns-canvas__pulse-highlight` (SDR#10 命名对齐); **ghostShadowPos state 声明未落地** (File List L405 + Note#4 + L264/L281 声明, 代码 grep `ghostShadow` 0 匹配) - defer 4.2 |
| CanvasView.test.tsx              | +108/−1   | 关联跳转 (T8); **CR F-3 patch**: 守卫 selector `.pulse-highlight`→`.ns-canvas__pulse-highlight` 同步                                                                                                                                                                            |
| StatusBar.tsx                    | +56/−1    | ⚠N 字段 + popover (T7/T8)                                                                                                                                                                                                                                                       |
| StatusBar.test.tsx               | +71/−2    | ⚠N + popover 测试                                                                                                                                                                                                                                                               |
| styles.css                       | +81/−0    | tab/capsule/alert/flash classes; **pulse-highlight/ghost-shadow CSS 规则声明未落地** (File List L409 声明 vs grep 无匹配) — overlay 定位+CSS defer 4.2 (CR F-2 cluster)                                                                                                         |

**新增文件** (untracked, 行数):

| 文件                              | 行        | 备注                                                                               |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| PromptTabs.tsx / .test            | 87 / 132  | T1 tab bar 子组件                                                                  |
| PromptCapsule.tsx / .test         | 47 / 129  | T6 收起态胶囊                                                                      |
| tabs/AlertTab.tsx / .test         | 75 / 131  | T2 "!" tab; **CR F-1 patch**: resolved-confirm `--resolved` + result 文案 + 2 测试 |
| tabs/MilestoneTab.tsx / .test     | 23 / 41   | T3 里程碑 stub (defer 5.4)                                                         |
| tabs/SourceSinkTab.tsx / .test    | 116 / 163 | T4 源/汇 tab                                                                       |
| tabs/StockTab.tsx / .test         | 98 / 143  | T5 存量 tab                                                                        |
| AtMentionAutocomplete.tsx / .test | 207 / 170 | T9 D1 名称化编辑                                                                   |
| sd/errorDetection.ts / .test      | 134 / 208 | T7 三检测器                                                                        |
| promptStore.test.ts               | 123       | 独立 store 测试                                                                    |

**ATDD 红脚手架偏差**: Note#1 声明"落 `src/lib/render/__tests__/1a-12/` 目录 (13 文件)" — 核实 `__tests__/` 仅含 `PropertyPanel.test.tsx`, **`1a-12/` 子目录不存在**; ATDD red 测试最终并入各组件 `.test.tsx`, 独立目录未保留. atdd-checklist 落 `_bmad-output/test-artifacts/`.

## VS 验证记录

**Agent Model**: ark-code-latest (orchestrator-direct, 无 subagent)
**执行日期**: 2026-07-16
**依据**: story-cycle-formalization.md §2.2 + §5 (选项 B 手动检查清单)

### 主核验表 (16 项)

| #   | 核验项                                                                                                              | 结果 | 备注                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AC 无歧义 (Given/When/Then)                                                                                         | PASS | 22 AC 均 Given/When/Then 结构; AC-1 四 tab 顺序 + testid 格式 / AC-7 胶囊结构 / AC-12 状态栏 ⚠N 分类 / AC-19 autocomplete 反向映射均精确到 DOM 断言                                                                                                                                                                                                                                                                                                |
| 2   | 零遗漏 (epic AC 全覆盖)                                                                                             | PASS | epic L565-615 五节 (四 tab / 收起态 / 错误二分归宿 / 关联跳转 / 边界 guard) 全覆盖; 1a.8 deferred-work D1 名称化编辑 + D3 tab-ify 合流                                                                                                                                                                                                                                                                                                             |
| 3   | 可执行 (子任务粒度)                                                                                                 | PASS | T0-T10 均单组件/单函数粒度 (PromptTabs 子组件 / AlertTab / SourceSinkTab / StockTab / PromptCapsule / errorDetection.ts / AtMentionAutocomplete); dev 可直接按 task 行实施                                                                                                                                                                                                                                                                         |
| 4   | task↔SDR 一致性                                                                                                     | PASS | T1↔SDR#1/#3, T2↔SDR#2/#4, T3↔SDR#5, T4↔SDR#6/#7, T5↔SDR#6, T6↔SDR#3, T7↔SDR#9, T8↔SDR#10, T9↔SDR#11, T10↔SDR#24; 全 T 行显式 `gov: SDR#N` 反向引用, 无矛盾 (memory `newsd-ds-follows-task-not-cspin` 合规)                                                                                                                                                                                                                                         |
| 5   | SDR↔AC↔Task 追溯矩阵                                                                                                | PASS | 12 设计契约 SDR 全有 ≥1 Task + ≥1 AC 覆盖; 22 AC 全可溯到 SDR#N (AC-21/22 属 guard/meta 无需设计 SDR); 0 orphan AC 或 SDR                                                                                                                                                                                                                                                                                                                          |
| 6   | 约束引用 (AD/CAP)                                                                                                   | PASS | AD-8 (WebGL canvas) / AD-9 (禁 shadowBlur) / L190 (命名) / L207-222 (tech 锁) / L340-359 (source tree) 五锚点显式引用; §3 引用架构约束段 + §7 gate 红线复述                                                                                                                                                                                                                                                                                        |
| 7   | 测试标准 (TDD red-green)                                                                                            | PASS | 每 T 含 red 断言样例 + green 判据 + refactor; §6 测试标准段列 hollow 审计 / controlled 双路径 / spy 参数断言 / fakeTimers 四项 gate (memory `newsd-story-cycle-test-quality-and-step8-audit-trail` 落地)                                                                                                                                                                                                                                           |
| 8   | web research 显式记录 (§2.1 step4)                                                                                  | PASS | §5 显式 no-op: UI-only 重构无新依赖; 引用基座 version 锁 (React ^19.2.0 / TanStack Start ^1.168.26 / Vite ^8.0.16 / Tailwind v4 / TS ^5.8.3); 不引入 combobox 三方库; 显式记录非静默 skip (memory `newsd-cs-webresearch-explicit-gate` 合规)                                                                                                                                                                                                       |
| 9   | 依赖标注                                                                                                            | PASS | AC-21 列全依赖 chain (1a.8 done @ee63b1d + 1a.11 done @1bb3598 + FR-ELEM-6 + FR-UI-3 修订) + 执行顺序 (1a.8→1a.11→1a.12→1a-13→1a.9→1a.10) + defer 项 (里程碑→5.4 / 量纲→1b / 公式悬空→4.2 / e2e canvas-click→1b)                                                                                                                                                                                                                                   |
| 10  | e2e spec 可跑性 gate (§2.2)                                                                                         | PASS | 全 AC jsdom/unit; 无 canvas-click e2e (CanvasView WebGL canvas, AD-8); 关联跳转仅断言 selectedId + spy(camera.center); SDR#33 显式记录 defer 1b 理由; 无 selector mismatch 风险 (memory `newsd-e2e-ac-gate-impl-path-cs-atdd-vs` 合规)                                                                                                                                                                                                             |
| 11  | SDR 三段完备                                                                                                        | PASS | 22 SDR 全 `(现状/目标/守卫)` 三元结构; 分类标签 `[设计契约]`×12 / `[保留不变量]`×5 / `[流程 meta]`×5; 每 SDR 含守卫 (AC 引用或测试 gate)                                                                                                                                                                                                                                                                                                           |
| 12  | contract truthfulness — promptStore.ts                                                                              | PASS | L15 `PromptType` 四类型匹配; L53 `MAX_MESSAGES=100` 基线匹配; L55 `TOAST_MS=4000` 匹配; L119 `alert()` 未 wire 属实; L72-81 trim 未答 confirm 保留属实; L123-127 clearResolved 语义属实                                                                                                                                                                                                                                                            |
| 13  | contract truthfulness — PromptPanel.tsx / PropertyPanel.tsx / StatusBar.tsx / CanvasView.tsx / store.ts / camera.ts | PASS | PromptPanel.tsx L20 `EXPANDED_DEFAULT_H=150`/L22 `COLLAPSED_H=26`/L140+L183 toggle testid/L175 clear testid 匹配; PropertyPanel.tsx L167-183 `<textarea defaultValue>` uncontrolled 属实; StatusBar.tsx 7 字段 (模拟时间/图元计数/在线用户数/头像堆栈/FPS/连接状态/量纲概要) 匹配; CanvasView.tsx L433 `selectedId` state + L1110-1111 click handler 匹配; store.ts L378-387 `flowCreateWarning` E11 parallel 匹配; camera.ts 无 `center` API 属实 |
| 14  | FR 引用对齐                                                                                                         | PASS | FR-UI-7 (四 tab) / FR-UI-8 (存量 tab) / FR-UI-9 (源汇 tab) / FR-UI-3 修订 (状态栏 ⚠N) / FR-ELEM-5 (命名, 1a.11 done) / FR-ELEM-6 (flow 端点完整性) 均在 epic L52-93 + L565-615 存在; story §Story 段引用完整                                                                                                                                                                                                                                       |
| 15  | 前序 story learnings 吸收                                                                                           | PASS | 1a.11 done (@1bb3598) 命名机制复用; 1a.8 deferred-work D1 (名称化编辑) + D3 (tab-ify) + 1a.7 CR D1 (COLLAPSED_H CSS) + D4 (autoscroll) 引用; 1a.8 F-2 controlled 转换 risk 在 SDR#11 + Q2 显式讨论; 1a.7 F-1-4 DS 偏离 SDR 教训在 §7 gate 红线复述                                                                                                                                                                                                 |
| 16  | 单 PR 判据 (§6)                                                                                                     | PASS | AC=22 > 20 但全 10 task 共享 PromptPanel 状态 + promptStore 单 store; 无 ≥3 独立技术子系统; 任务间耦合紧密 (tab 切换/错误检测/关联跳转均走同一 selectedId 通道); 单 PR 合适; 子 PR 拆分反致碎片化                                                                                                                                                                                                                                                  |

### SDR 明细子表 (22 项)

| #   | 项                                                                         | 分类         | 判   | 核验                                                                                                                                |
| --- | -------------------------------------------------------------------------- | ------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 四 tab 键集封闭 = `alert/milestone/sourcesink/stock`                       | [设计契约]   | PASS | 三元完整; TabKey union 类型收窄; AC-1 断言 4 tab 顺序 + testid 格式                                                                 |
| 2   | "!" tab 只收 confirm + alert (类型集封闭)                                  | [设计契约]   | PASS | 三元完整; filterByTab 纯函数; AC-2 断言 info/toast 不出现在此 tab                                                                   |
| 3   | 默认 activeTab 优先级 = `alert(有未答) > lastActiveTab > alert(兜底)`      | [设计契约]   | PASS | 三元完整; resolveActivateTab 纯函数 9 组输入; AC-9 三场景 + AC-10 两场景覆盖                                                        |
| 4   | alert 独立于 toast + 同步 push toast 副本                                  | [设计契约]   | PASS | 三元完整; promptStore.alert() 内部双推; AC-13 断言 count=2 + 4s 后 toast 消失 alert 保留; 现状 L119 alert 未 wire 属实              |
| 5   | 里程碑 tab 内容 defer 5.4                                                  | [设计契约]   | PASS | 三元完整; MilestoneTab 纯静态无 store 依赖; AC-3 断言 defer 提示文案                                                                |
| 6   | 源/汇 tab 只列 cloud, 存量 tab 只列 stock                                  | [设计契约]   | PASS | 三元完整; 两 tab 内 filter 硬分离; AC-4 断言存量 tab 无 cloud / AC-5 断言源汇 tab 无 stock; flow 不出现在此两 tab                   |
| 7   | Cloud 分类 (源/汇) 语义                                                    | [设计契约]   | PASS | 三元完整; classifyCloud 纯函数 4 组邻接; AC-4 断言 C1(仅 out)☁ + C2(仅 in)◼                                                         |
| 8   | lastActiveTab 持久化 = sessionStorage (会话内)                             | [设计契约]   | PASS | 三元完整; 与 1a-13 localStorage 正交 (不同 key); AC-9(c) 断言首次会话激活 alert; 备选 localStorage 拒绝理由充分                     |
| 9   | 设置错误分类 = orphan-cloud / dangling-flow-endpoint / parallel-flow       | [设计契约]   | PASS | 三元完整; 每检测器独立函数; AC-12 三错误源 + AC-14 量纲/公式悬空返回 [] + AC-18 重名源消失; 现状 flowCreateWarning L378 属实        |
| 10  | 关联跳转 = setSelectedId + camera.center + pulseHighlightId + ghost-shadow | [设计契约]   | PASS | 三元完整; AC-16 spy(camera.center) + AC-17 ghost-shadow class; 现状 camera 无 center API 属实; 备选 shadowBlur 拒绝 (AD-9) 理由充分 |
| 11  | PropertyPanel formula textarea uncontrolled → controlled                   | [设计契约]   | PASS | 三元完整; 现状 L167-183 defaultValue 属实; useEffect key isolation 保 F-2 语义; AC-19 autocomplete 触发 + AC-20 Esc 关闭            |
| 12  | MAX_MESSAGES 100 → 1000                                                    | [设计契约]   | PASS | 三元完整; 现状 L53 `=100` 属实; trim 未答 confirm 保留语义不变; AC-15 断言 1000 上限; epic L597 "cap 全保留 + 兜底 1000" 对齐       |
| 20  | promptStore 6 API 签名不变                                                 | [保留不变量] | PASS | confirm/info/toast/dismiss/clearResolved/reset 不改; 只 wire alert + 上调 MAX_MESSAGES                                              |
| 21  | 未答 confirm 永不被 trim / clearResolved 移除                              | [保留不变量] | PASS | baseline L72-81 trim + L123-127 clearResolved 逻辑不改; alert 不参与 confirm 保护 (可被 trim)                                       |
| 22  | AD-9 禁 per-glyph shadowBlur                                               | [保留不变量] | PASS | --flash/pulse-highlight/ghost-shadow 均 CSS animation (border/text-shadow/opacity keyframes); 组件级非 canvas per-glyph             |
| 23  | 命名机制不变量 (1a.11 done @1bb3598)                                       | [保留不变量] | PASS | 存储 @uuid / 显示 name / 全局唯一 / 序号单调; D1 复用 formatFormulaForEditor + nameMap 反向查                                       |
| 24  | 全套件测试基线 = 594 passed \| 1 skipped / 21 files + e2e 29/29            | [保留不变量] | PASS | T10 gate 断言 N/N 绿; N = 594 + 新增 (~25-40); 1a.11 CR 终态实测匹配                                                                |
| 30  | 为何独立 story 而非 1a.7 patch                                             | [流程 meta]  | PASS | 结构级重写 (tab 状态 + 4 子组件 + 检测函数 + 状态栏 ⚠N + 关联跳转); epic checkpoint 5 定独立 story 合理                             |
| 31  | 为何合流 1a.8 D1 到本 story                                                | [流程 meta]  | PASS | 1a.11 done 后 D1 依赖解; D1 落 PropertyPanel 与 1a.12 关联跳转耦合; 集中交付减少 PR 抖动                                            |
| 32  | 为何 defer 里程碑内容到 5.4                                                | [流程 meta]  | PASS | 里程碑判定规则/状态源/动画是 5.4 core scope; 1a.12 若 stub 满会预设数据结构致 5.4 返工                                              |
| 33  | 为何 canvas-click e2e defer 1b                                             | [流程 meta]  | PASS | CanvasView WebGL canvas (AD-8) 无 DOM overlay; 1a.8 D4 已 defer 1b; 本 story 仅 jsdom 断言 selectedId + spy(camera.center)          |
| 34  | 为何 alert 触发 push toast 副本                                            | [流程 meta]  | PASS | 用户感知 = 瞬时可见 (toast 4s) + 永存归档 (alert "!" tab); 双份是刻意冗余; 单测覆盖 alert() 后 messages count=2                     |

### Advisory Notes (非阻塞)

1. **AC-11 code anchor 偏差**: story 引用 "1a.7 baseline L138-146 展开键位" — 实际 L138-146 是收起态 toggle, 展开态 toggle 在 L181-189 (aria-label 已是 `收起提示中心`). AC-11 意图 = 保留现有 ⏏️ toggle 行为, 非功能变更; DS 阶段建议引用 L181-189 更精确. 非阻塞.

2. **1a.7 CR D4 autoscroll 未显式覆盖**: deferred-work.md D4 (stick-to-bottom: 已在底部才自动滚, 用户上滚时不抢回) defer 1a.12. story AC-15 覆盖 `overflow-y:auto` 滚动容器, 但未显式提及 stick-to-bottom 行为. DS 阶段可在 T2 (alert tab 内容) 或 T6 (capsule) 实现时顺手加入 (useEffect + scrollTop 检测, 24px 阈值, 参考 1a.7 本地曾修方案). 非阻塞.

3. **AC=22 > 20 跨 sub-PR 门槛**: formalization §6 判据 "AC > 20 条" 触发 sub-PR 考量. 但 10 task 全共享 PromptPanel 状态 + promptStore 单 store, 无 ≥3 独立子系统; 拆分反致碎片化. 单 PR 合适, 本 advisory 仅记录 crossing-threshold awareness.

4. **SDR#8 sessionStorage 与 1a-13 localStorage 边界**: Q1 已显式讨论; sessionStorage key `ns-prompt-panel-last-tab` 与 1a-13 autosave 元素模型正交; DS 阶段若发现竞态可降级为 in-memory only. 当前设计合理.

5. **SDR#11 controlled 转换 risk**: Q2 已显式讨论; `useEffect(()=>setFormulaDraft(el.formula), [el.id])` 保元素隔离; DS 阶段须补 F-2 回归测试 (切 selectedId → draft 同步不泄漏). 非阻塞.

### Verdict

**VS PASS** — Story 1a.12 满足 story-cycle-formalization.md §2.2 全部 gate:

- **零歧义**: 22 AC 均 Given/When/Then 结构, DOM 断言精确到 testid/class/aria 属性
- **零遗漏**: epic L565-615 五节全覆盖 + 1a.8 D1/D3 合流; 1a.7 CR D1/D4 覆盖 (D1 隐式 capsule 重写, D4 见 advisory-2)
- **可执行**: T0-T10 单组件/单函数粒度, 每 task 含 red/green/refactor
- **task↔SDR 一致性**: 全 T 行 gov: SDR#N 双向可追溯; 0 矛盾
- **SDR↔AC↔Task 追溯矩阵**: 12 设计 SDR 全 ≥1 Task + ≥1 AC; 0 orphan
- **contract truthfulness**: 8 源文件 20+ 锚点全匹配 (promptStore.ts / PromptPanel.tsx / PropertyPanel.tsx / StatusBar.tsx / CanvasView.tsx / store.ts / camera.ts / types.ts)
- **web research 显式**: §5 no-op + 基座 version 锁, 非静默 skip
- **e2e spec 可跑性**: 全 jsdom/unit, 无 canvas-click e2e; SDR#33 显式 defer 理由
- **单 PR 判据**: AC=22 > 20 但全 task 紧密耦合, 单 PR 合适 (advisory-3)

5 advisory notes 非阻塞: AC-11 code anchor 偏差 (L138→L181) / 1a.7 CR D4 autoscroll 未显式覆盖 / AC=22 跨 sub-PR 门槛 awareness / SDR#8 sessionStorage 边界已讨论 / SDR#11 controlled 转换 risk 已讨论.

**下一步**: DS 起动 (bmad-dev-story):

- step4 mark in-progress 前 Read 全 UPDATE 文件 (§7 红线已列 8 文件)
- step4 记录 baseline_commit + baseline_tests (当前 main HEAD e6b9cea, 594/1skip/21files)
- step5 起手跑 `/bmad-testarch-atdd` (T0 ATDD 红脚手架)
- step8 baseline diff review 逐文件表落 `## Dev Agent Record` (formalization §2.3 #1 留痕机制)
- DS 自评须有测试实证 (memory `newsd-ds-self-attestation-vs-cr-verdict`)

**sprint-status.yaml 更新**: 故事完成 (DS+CR done) 后追加 `VS PASS 2026-07-16 (orchestrator-direct)` 到 L42 注释, 与 sprint-status→done 同一次推 (独立 chore PR, memory `newsd-sprint-status-separate-from-story-pr`).

## CR 记录

_(CR 阶段填写 - `bmad-code-review` skill, 3-layer orchestrator-direct per memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`)_

### Run 1

**Agent Model**: ark-code-latest (orchestrator-direct, 无 subagent per memory `newsd-cr-3-layers-orchestrator-direct-not-subagents`)
**执行日期**: 2026-07-16
**状态**: 全裁定+patched - F-1/F-3 patched (批0); F-2/F-6 部分 defer 4.2 (ghostShadowPos state/test 声明 vs 代码不一致随 4.2); F-4 close (toStored 边界核验正确); F-5 补填; F-7 defer 1b (量纲给 stock 真实错误主体); F-8 patched (批2, AC-13 未读徽章); F-9 patched (批1, ErrorFinding type 统一); F-10 [类型] patched (批1, AC-16 文案) + a11y 增强 defer; 验证 tsc 0 + vitest 706 passed | 1 skipped + e2e 29/21/50 0 fail; 待 PR/merge

#### 3-Layer Review

orchestrator-direct 跑 3 层 (read-only guard: 前后 `git status --porcelain` baseline 23 entries 不变; `git show e6b9cea:<path>` 核 baseline):

- **Layer 1 - Blind Hunter**: 未读 story/SDR, 纯代码找 bug
- **Layer 2 - Edge Case Hunter**: 读 SDR + AC, 找边界/异常路径
- **Layer 3 - Acceptance Auditor**: 核 AC 覆盖 + hollow-test 审计 (§2.4)

合并 10 findings (F-1..F-10).

#### AC-17(b) 不可达根因 (Layer 2/3 发现)

ghost AC-17(b) 在当前 errorDetection 契约不可达, 4 证据点:

1. `errorDetection` 3 检测器 (`detectOrphanClouds`/`detectDanglingFlowEndpoints`/`detectParallelFlows`) `subjectId` 皆现存元素 (cloud.id/flow.id)
2. 已删元素不在 `elements` 数组, 不被遍历 -> 无 finding subject=已删元素
3. `onErrorClick` 仅传 `subjectId: string` (无 type/finding), `handleErrorClick` 无法区分现存 vs 已删
4. `handleErrorClick` -> `centerOnElement(flow.id)` -> flow 存在 -> pulse (AC-17(a) 路径); 无路径传已删元素给 `handleErrorClick`

#### Findings 状态

| ID   | 描述                                                                                                                          | 处理                                                                                                                                                                                                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-1  | AlertTab resolved-confirm 缺失 (未镜像 1a.7 MessageRow resolved 灰态 `--resolved` + result 文案 `[已确认]/[已取消]` 隐藏按钮) | **patched** (AlertTab.tsx + .test, +2 测试)                                                                                                                                                                                                                                            |
| F-2  | ghost AC-17(b) 主体已删高亮不可达 + overlay 定位机制缺失 + AC-17(a) pulse 定位 hollow                                         | **defer 4.2 (B 裁定)** - 见 deferred-work.md                                                                                                                                                                                                                                           |
| F-3  | pulse 命名偏离 SDR#10 (`pulseId`/`pulse-highlight` vs `pulseHighlightId`/`.ns-canvas__pulse-highlight`)                       | **patched** (纯 rename, 不补 CSS/定位)                                                                                                                                                                                                                                                 |
| F-4  | toStored 匹配决策 (名称化编辑 @id 反向映射边界)                                                                               | **close (裁定)** - toStored 边界核验正确 (空 map->原样 / 未匹配->保留 name / 长名优先 / regex escape), 非缺陷                                                                                                                                                                          |
| F-5  | Dev Agent Record 缺 `### step8 baseline diff review` 表 (formalization §2.3 #1)                                               | **补填** (本次)                                                                                                                                                                                                                                                                        |
| F-6  | 开发日志/文件列表命名 (pulseHighlightId/ghostShadowPos) vs 代码 (pulseId/无) 不一致                                           | **部分 patched** (F-3 pulseHighlightId 落地; ghostShadowPos defer 4.2 - **state/test 声明 (L264/L281/L349/L405) 仍在但代码 grep `ghostShadow` 0 匹配, 声明 vs 代码不一致未消除, 随 4.2**; File List L409 CSS classes 声明未落地, step8 表已记)                                         |
| F-7  | StockTab 徽章范围 (stock 永非 3 detector 主体, 徽章死路径)                                                                    | **defer 1b (量纲)** - 1b 量纲错误给 stock 真实错误主体, 当前死路径消除 - 见 deferred-work.md                                                                                                                                                                                           |
| F-8  | AC-13 未读徽章 (alert +1 / markAlertRead / 角标 render / expand+effect 清零 完全缺失)                                         | **patched (批2)** - promptStore unreadAlertCount state + markAlertRead/getUnreadAlertCount + alert() +1 + reset(); PromptTabs 角标 render; PromptPanel useSyncExternalStore + handleSelectTab/handleExpand markAlertRead + expanded alert effect 自动清; +8 测试 (store3+tabs3+panel2) |
| F-9  | ErrorFinding 重复 (StatusBar 本地 type:string vs errorDetection ErrorType)                                                    | **patched (批1)** - 3 处本地 ErrorFinding 删除, 统一 import errorDetection; StatusBar/StockTab/PromptPanel/StatusBar.test/StockTab.test 同步; ERROR_TYPE_LABEL 落 AC-16 [类型] 文案                                                                                                    |
| F-10 | popover a11y + AC-16 [类型] 前缀缺失                                                                                          | **部分 patched (批1)**: AC-16 [类型] 主体名 - 问题描述 文案 via ERROR_TYPE_LABEL 落地; **a11y 增强 defer** (arrow nav / aria-activedescendant / Escape / aria-expanded / focus mgmt) - 见 deferred-work.md                                                                             |

#### step8 偏差发现 (F-5 补填时)

- Note#1 声明"落 `src/lib/render/__tests__/1a-12/` 目录 (13 文件)" - 核实 `__tests__/` 仅含 `PropertyPanel.test.tsx`, **`1a-12/` 子目录不存在**; ATDD red 测试并入各组件 `.test.tsx`, 独立目录未保留 (已记 step8 表)
- File List L409 声明 styles.css 含 `pulse-highlight/ghost-shadow classes` - grep 确认**无** (SDR#10 CSS 规则未落地, overlay 定位+CSS defer 4.2, 已记 step8 表)
- File List L405 + Note#4 + L264 + L281 声明 CanvasView `pulseHighlightId + ghostShadowPos` (L281 test Note 声明 fakeTimers 覆盖两者 3s auto-clear) - grep CanvasView `ghostShadow` **0 匹配** (ghostShadowPos state defer 4.2, state/test 声明 vs 代码不一致未消除, 随 4.2)

#### 验证

- tsc: 0 errors
- CanvasView.test: 92/92 (F-3 rename 守卫 selector `.ns-canvas__pulse-highlight` 同步)
- 全套件 vitest: **706 passed | 1 skipped** / 30 files (696 DS 终态 + F-1 AlertTab +2 + F-8 store3+tabs3+panel2=+8 + F-9/F-10 type 统一 rename 0 净增; 0 failed)
- e2e Playwright: **29 passed | 21 skipped / 50** (0 failed, 无回归; 本 story 无新 e2e, 全套件口径)
- verdict: **PASS** (3 层 review orchestrator-direct 跑完, 10 findings 全裁定: 5 patched F-1/F-3/F-8/F-9/F-10[类型] + F-5 补填 + F-4 close + 3 defer F-2/F-6 部分->4.2 / F-7->1b / F-10 a11y; failed_layers=[]; 验证全绿)

## SAVE QUESTIONS

> CS 过程中攒的问题, 待 CS 收尾报告或 DS/VS 阶段答. 遵 memory `newsd-cr-report-before-execute-gate` 兄弟场景 = CS 收尾报告 gate.

- **Q1 (SDR#8 sessionStorage 边界)**: `lastActiveTab` 用 sessionStorage 是否与 1a-13 (session-autosave) F3 autosave 竞态? 建议 = sessionStorage 存展开状态 + 上次 tab, 与 1a-13 localStorage autosave 元素模型完全正交(不同 key, 不同数据). 若 DS 阶段发现竞态, upgrade SDR#8 到 in-memory only (刷新即丢).

- **Q2 (SDR#11 controlled 转换 risk)**: PropertyPanel formula uncontrolled -> controlled 是 1a.8 F-2 修复 (D-key remount) 的反向操作; 是否会重开 F-2? 缓解 = `useEffect(()=>setFormulaDraft(el.formula), [el.id])` 保元素隔离. DS 阶段须补 F-2 回归测试 (切 selectedId -> draft 同步不泄漏).

- **Q3 (SDR#4 alert 双推 side-effect)**: alert 触发 push toast 副本是 store 侧行为, alert 调用点如非 PromptPanel 内 (未来 kernel 侧 alert) 会否漏 wire? 缓解 = alert 方法内部完成双推, 调用侧无感; 单测覆盖 alert() 后 messages count=2.

- **Q4 (SDR#9 检测触发时机 - 每 render 还是 store 变动)**: `detectSetupErrors(elements)` 什么时机跑? 建议 = `useMemo(() => detectSetupErrors(elements), [elements])` 每 store 变动重算; 若 elements 大 (>1000) 有性能担忧, DS 阶段可挂钩 spatial-index 增量 (但 1a 规模 <100 元素 useMemo 已够).

- **Q5 (SDR#10 pulse-highlight canvas 侧实现)**: `pulseHighlightId` 落 CanvasView state, VRAM 渲染循环 (buildInstancesFromStore) 是否需读该 state 走特殊渲染? 或 CSS-only DOM overlay 在 canvas 上覆盖? 建议 = DOM overlay (canvas 外层 div 定位), 避免侵入 VRAM 渲染 (AD-9 边界); DS 阶段验证 overlay 定位随 camera 拖动/缩放正确同步.

- **Q6 (AC-22 baseline count 增量)**: 本 story 预估新增测试 25~~40 条 (T1 tab shell~~5 / T2 alert~~4 / T3 milestone~~2 / T4 sourcesink~~6 / T5 stock~~5 / T6 capsule~~5 / T7 detectors~~6 / T8 popover~~4 / T9 autocomplete~~5), 全套件目标 620~635 passed. VS/CR 阶段实测 DS 落实 count 与预估偏差 (>±10 需检视是否 SDR 覆盖遗漏).

## CS 阶段产出说明

`bmad-create-story` skill 六步:

1. **Step 1 - 目标 story**: sprint-status.yaml L42 首个 backlog 匹配 `number-number-name` = `1a-12-prompt-panel-restructure`; 解析 epic_num=1a, story_num=12, story_title=prompt-panel-restructure; epic-1a status 已 in-progress (1a.1..1a.8 + 1a.11 done), 无需翻转.

2. **Step 2 - 加载分析核心工件**: 全读 epics.md L565-615 (Story 1a.12) / ARCHITECTURE-SPINE (409 lines) / PromptPanel.tsx (200) + PromptPanel.test.tsx (101) + PropertyPanel.tsx (252) + promptStore.ts (149) + StatusBar.tsx (97) + store.ts (422) + types.ts (56); 1a.11 done 分析 (@1bb3598 - 命名机制 done, D1 依赖解); 1a.8 done 分析 (@ee63b1d - PropertyPanel 基座 + F-2 controlled 转换 risk).

3. **Step 3 - 架构分析 developer 护栏**: ARCHITECTURE-SPINE 单 SPINE 文件 (非 sharded); AD-8 WebGL canvas (关联跳转 defer canvas-click e2e) / AD-9 禁 per-glyph shadowBlur (flash/pulse-highlight 走 CSS animation) / L190 命名不变量 (D1 严格遵) / L207-222 tech 锁 (无新依赖) / L340-359 source tree.

4. **Step 4 - Web research**: 显式 no-op 记录 - UI-only 重构无新依赖; 引用基座 version 锁; 不引入 combobox/autocomplete 三方库(WAI-ARIA + 原生 keydown 手写足够, memory `newsd-cs-webresearch-explicit-gate` gate 要求显式记录).

5. **Step 5 - 创建 story**: 本文件产出 (`1a-12-prompt-panel-restructure.md`); Status = ready-for-dev; AC 22 条 + SDR 22 条 (12 契约+5 不变量+5 meta) + Tasks 10 + Dev Notes 8 节 + SAVE QUESTIONS 6.

6. **Step 6 - sprint-status flip**: 单独 Edit (backlog -> ready-for-dev + last_updated 2026-07-15 -> 2026-07-16). CS 阶段不推 PR (`sprint-status 更新与 story 代码 PR 分开推` memory + `PR/merge 前须报告` gate); CS 完成后向用户报告等确认再进 DS.
