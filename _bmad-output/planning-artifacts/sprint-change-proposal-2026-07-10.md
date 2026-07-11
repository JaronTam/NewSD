# Sprint Change Proposal: PromptPanel 重构 + 游戏化中心规格回写

- 日期: 2026-07-10
- 触发: bmad-correct-course(CC)Incremental 模式
- 模式: Incremental(提案 1-7 逐个 Approved)
- 状态: Step 4 待用户 Review -> Step 5 批准 -> 路由

---

## Section 1: Issue Summary

**问题陈述**:NewSD Epic 1a 执行至 Story 1a.7(顶部工具栏与底部状态栏)后,PromptPanel 重构 + 游戏化中心设计讨论沉淀出一批规格层变更,需通过 CC 正式回写 epic,不能在实现层直接加([[newsd-epic-over-prototype-authority]])。

**触发来源**:

1. Story 1a.7 实现期产出 PromptPanel(prompt center),但 epic 未规格化四 tab/收起态/错误二分归宿--需补规格(决策点 1)。
2. 游戏化体验需求涌现--"徽章"膨胀为"游戏化中心"(表盘+等级),非里程碑 tab 膨胀(决策点 2)。
3. 图元命名机制澄清--讨论中选定"不可重名+序号自增",推翻现有 epic line 49/399/407"允许同名+软警告"(检查点 6 衍生)。
4. 错误二分归宿(设置状态性 vs 运算时序性)、FR-UI-3 状态栏扩展、flow 端点完整性、混合软警告时序、删除 RI 时序等需规格层落定(检查点 1-7 + 修正 1/2)。

**证据**:设计讨论全结论见 memory `newsd-promptpanel-restructure-pending.md`("CC 回写裁定"章节,2026-07-10 全敲定);噪声门控已清完(开放项 3-7 全显式决策)。

---

## Section 2: Impact Analysis

**Epic Impact**:

- **Epic 1a**:FR-ELEM-3(删重名软警告句)/FR-ELEM-4(加端点未连注)/新增 FR-ELEM-5(命名机制)/新增 FR-ELEM-6(flow 端点完整性);FR-UI-3(修订:量纲概要->设置问题概要)/新增 FR-UI-7/8/9(PromptPanel 容器+存量 tab+源/汇 tab);Story 1a.7(line 479 删除时序注)/Story 1a.8(边界注:功能逻辑层+最简 UI 容器)/新增 Story 1a.8+(PromptPanel 重构);FR 映射区 + Epic 1a FRs covered 同步。
- **Epic 5**:新增 FR-GAME-4(游戏化中心)/新增 Story 5.4(表盘+等级+徽章墙,AC 细节留 CS);Epic 5 FRs covered 同步。
- **Story 4.2**(统一删除 RI):时序注(FR-ELEM-6 检测 4.2 后保留作防御)。

**Story Impact**:

- 当前:1a.7(已合并)+ 1a.8(property-panel-formula-editor,待 CS)。
- 新增:1a.8+(PromptPanel 重构,编号留 SP,紧跟 1a.8,1a.9/1a.10 执行顺序后移不重编号);FR-ELEM-5 命名机制独立小 story(编号留 SP,1a.8+ 依赖);Story 5.4 游戏化中心(编号留 SP,依赖 5.3+1a.8+,AC 细节留 CS 待点 3 讨论)。
- 未来:1a.9 i18n 在 1a.8+ 后(对最终 tab 结构抽 key 避免返工)。

**Artifact Conflicts**:

- epics.md(主改):FR 定义区/FR 映射区/Story AC/Epic FRs covered。
- prd.md:§1.3(L1/L2/L3 成熟度可见性)+ §3.7(用户界面)参照渐进暴露--本提案不直接改 prd,措辞与 prd §1.3 一致(L1 默认可见/L2 渐显),若 Review 发现 prd 需同步注则补。
- architecture/spec:无(规格层变更,不涉架构 AD 或 spec CAP 域增减;FR 新增归现有 CAP-10 界面 chrome / CAP-12 游戏化域)。

**Technical Impact**:无代码/基础设施/部署影响(纯规格层)。实现影响在后续 story CS/DS:1a.8+ 重构现有 PromptPanel.tsx(1a.7 defer 文件);FR-ELEM-5 命名机制改图元创建/改名/粘贴/删除路径;FR-ELEM-6 加 flow 端点完整性检测。

---

## Section 3: Recommended Approach

**推荐路径**:**Direct Adjustment**(在现有 epic 内新增/修订 FR + story,不 rollback 已合并的 1a.7,不缩 MVP scope)。

**理由**:

- 1a.7 已合并 main,PromptPanel.tsx 在 defer 文件--重构走新 story 1a.8+(独立 CS->VS->DS->CR),不返工 1a.7。
- 游戏化中心是 Epic 5 内新增 story(5.4),不推翻现有 5.3 徽章系统。
- 图元命名机制(提案 1)推翻"允许同名"是规格层方向修正,1a.4 已合并但未实现重名软警告检测(创建侧 warn)--命名机制 story 落地时无返工(重名源本就未硬实现)。

**effort 估算**:中。7 提案(3 Minor + 3 Moderate + 1 Major 占位)。apply 到 epics.md 是文档编辑;实现分散到 3 个新 story(1a.8+/FR-ELEM-5/5.4)+ 1a.8 边界注。

**risk 评估**:低。规格层变更;点 3 游戏化中心细节留 CS 不阻塞回写;提案 7 Story 5.4 为占位(AC 细节待点 3),明确标注不包装成已定(噪声门控)。

**timeline 影响**:

- 1a.8(property-panel-formula-editor)先行,1a.8+ 重构依赖它。
- FR-ELEM-5 命名机制独立小 story,1a.8+ 依赖(重名源消失)。
- 1a.9 i18n 后移至 1a.8+ 后。
- Story 5.4 依赖 5.3 + 1a.8+ + 点 3 讨论(独立待办,不阻塞 1a 推进)。

---

## Section 4: Detailed Change Proposals

> 提案 1-4 基于前 session Approved 方向 + 本 session Grep 精确 epic 原文重构;提案 5-7 本 session 起草原文。Review 时可 Edit 微调。标点风格跟随 epic(半角)。

### 提案 1:FR-ELEM-5 图元命名机制(推翻"允许同名+软警告")

**变更类型**:Moderate(删现有句 + 新增 FR + 独立小 story)
**归属**:Epic 1a;独立小 story(编号留 SP,1a.8+ 依赖)

**1.1 line 49 FR-ELEM-3**(删重名软警告句)

- OLD:`...Bresenham 网格寻路 + 端点箭头 + 端口吸附;重名软警告(允许同名,量纲推导以 id 解析)。`
- NEW:`...Bresenham 网格寻路 + 端点箭头 + 端口吸附。`(重名软警告源消失,见 FR-ELEM-5 命名机制)

**1.2 line 399**(删重名软警告 AC)

- OLD:`**And** 重名软警告(允许同名,量纲推导以 id 解析)`
- NEW:(删除整行)

**1.3 line 407**(改"与重名软警告取向一致"从句)

- OLD:`...;与重名软警告取向一致(允许+提示非阻断)`
- NEW:`...(parallel 非重名;命名机制 FR-ELEM-5 下重名不可能,parallel 仍 allow + warn duplicate 物质分流)`

**1.4 新增 FR-ELEM-5**(line 50 后,FR-ELEM-4 后)

- NEW:`- **FR-ELEM-5** 图元命名机制:图元 name 全局唯一(跨 stock/cloud/flow);新建序号按类型递增(stock_1/cloud_1/flow_1,默认名格式留 i18n);改名撞名即时禁止(非软警告);删除后序号不复用(继续递增);粘贴图元视为新建序号递增;id=uuid 不变(公式 @uuid 引用不断,line 394 保留)。覆盖 stock/cloud/flow 全部图元。`

**1.5 新增 FR-ELEM-5 映射**(line 222 后)

- NEW:`FR-ELEM-5: Epic 1a - 图元命名机制(name 全局唯一+按类型序号递增+不复用)`

**Rationale**:检查点 6 衍生--讨论选定"不可重名+序号自增",推翻现有"允许同名+软警告"(line 49/399/407)。重名软警告源消失;id=uuid 不变保公式引用不断。命名机制是模型层基础行为,独立小 story 边界清晰,1a.8+ 依赖。

**连锁**:提案 6(图元类错误剩单图元,重名源消失);检查点 6(关联跳转剩单图元)。

---

### 提案 2:FR-UI-3 修订(量纲概要 -> 设置问题概要)

**变更类型**:Moderate(改 FR + 同步 AC/映射)
**归属**:Epic 1a;FR-UI-3 归 1a.8+(状态栏扩展)

**2.1 line 90 FR-UI-3**(主修订)

- OLD:`- **FR-UI-3** 底部状态栏:模拟时间计数器+图元计数+在线用户数+头像堆栈+FPS(Debug)+连接状态+量纲校验概要(L2 渐显,如 `量纲:3/5 一致·2 软警告`,点击展开不一致流量清单)。`
- NEW:`- **FR-UI-3** 底部状态栏:模拟时间计数器+图元计数+在线用户数+头像堆栈+FPS(Debug)+连接状态+设置问题概要(渐进暴露:⚠N count L1 默认可见 + popover 详情 L2 渐显,如 `⚠ X 错误 · Y 软警告`;错误=flow 端点未连(必修致不生效)/软警告=量纲/混合/孤立/parallel(可忽略);popover 清单项点 -> 跳画布对应图元 + 属性面板展开,修复即消;不分组/筛选/排序(预留口))。`

**2.2 line 485 Story 1a.7 状态栏 AC**(同步)

- OLD:`...量纲校验概要(L2 渐显,如 `量纲:3/5 一致·2 软警告`)`
- NEW:`...设置问题概要(⚠N count L1 默认可见 + popover 详情 L2 渐显,如 `⚠ X 错误 · Y 软警告`,见 FR-UI-3)`

**2.3 line 234 FR-UI-3 映射**(同步)

- OLD:`FR-UI-3: Epic 1a - 底部状态栏(时间/图元数/在线/FPS/量纲概要)`
- NEW:`FR-UI-3: Epic 1a - 底部状态栏(时间/图元数/在线/FPS/设置问题概要)`

**Rationale**:检查点 4(渐进暴露 L1 默认可见/L2 渐显)+ 严重性分列(错误=flow端点未连/软警告=量纲/混合/孤立/parallel)+ 开放项 7(状态栏扩展为全图元设置错误入口)。措辞与 prd §1.3 L1/L2/L3 成熟度分层一致。赛博朋克化 UI 文案留 DS(CAP-10)。

**连锁**:提案 6(1a.8+ 错误二分归宿设置错误归状态栏 ⚠N);检查点 4/开放项 7。

---

### 提案 3:FR-ELEM-6 flow 端点完整性(1a.8+)

**变更类型**:Moderate(新增 FR + 注)
**归属**:Epic 1a;FR-ELEM-6 归 1a.8+

**3.1 新增 FR-ELEM-6**(line 50 后,FR-ELEM-5 后)

- NEW:`- **FR-ELEM-6** flow 端点完整性:flow fromId/toId 两端须连已存在图元(stock/cloud);创建中不报/放下后报(设置错误,状态栏 ⚠N 不阻断);源/汇端 flow 连 cloud 算已连;与 1a.4 E10 孤立 cloud 对称;删图元致 flow 端点失连同此检测(4.2 endpoint RI 级联删 flow 后不再产生此源,见 Story 4.2)。`

**3.2 line 50 FR-ELEM-4**(加端点未连注)

- OLD:`- **FR-ELEM-4** 连接端口:每元素周边预定义连接点;创建连线自动吸附端口;拖拽元素端口位置随更新。`
- NEW:`- **FR-ELEM-4** 连接端口:每元素周边预定义连接点;创建连线自动吸附端口;拖拽元素端口位置随更新。端口吸附非端点未连告警;flow 端点未连检测见 FR-ELEM-6。`

**3.3 新增 FR-ELEM-6 映射**(line 222 后,FR-ELEM-5 映射后)

- NEW:`FR-ELEM-6: Epic 1a - flow 端点完整性(两端须连已存在图元,设置错误不阻断)`

**Rationale**:检查点 3(flow 端点未连设置错误,创建中不报/放下后报,与 1a.4 E10 孤立 cloud 对称)+ 修正 2 时序(4.2 后级联删不再产生)。FR-ELEM-4 端口吸附不覆盖端点未连检测。

**连锁**:提案 5(修正 2 删除致失连时序);提案 6(1a.8+ 检测源);检查点 3。

---

### 提案 4:FR-SIM-7 混合软警告注(Minor)

**变更类型**:Minor(注,不改校验语义)
**归属**:修正 1;FR-SIM-7 归 1b

**4.1 line 60 FR-SIM-7**(加混合软警告子情况注)

- OLD:`...常数单位标注参与推导;无 units 视无量纲;校验在公式编辑时实时进行(FR-UI-2 扩展)。`
- NEW:`...常数单位标注参与推导;无 units 视无量纲(混合软警告=量纲不一致子情况,依赖 1b 引擎,1a.8+ 不独立实现);校验在公式编辑时实时进行(FR-UI-2 扩展)。`

**Rationale**:修正 1--line 60"无 units 视无量纲"使混合软警告 = 量纲不一致子情况,依赖 1b 引擎;1a.8+ 不独立实现(量纲类源空待 1b);units 可选方向不变。检查点 1a 触发矩阵作 1b.6 CS 输入提示。

**连锁**:提案 6(1a.8+ 量纲类源空待 1b);修正 1;检查点 1。

---

### 提案 5:修正 2 删除致 flow 端点失连时序注(Minor)

**变更类型**:Minor(时序注,不改 RI 规则/AC 逻辑)
**归属**:修正 2 时序说明;1a.8+ 阶段检测归 1a.8+(FR-ELEM-6);4.2 级联删归 Story 4.2(AC 不变)

**5.1 line 479 Story 1a.7 删除注**

- OLD:`...删除存量时的级联 RI 与 formula-reference dangling 规则在 4.2 CRDT 事务化时补(受控 rework,类 1a.7->1a.9 i18n 抽 key;AR-1 修订:无删除则单人建模闭环不成立)`
- NEW:`...删除存量时的级联 RI 与 formula-reference dangling 规则在 4.2 CRDT 事务化时补(受控 rework,类 1a.7->1a.9 i18n 抽 key;AR-1 修订:无删除则单人建模闭环不成立)。1a.8+ 阶段(4.2 前)plain properties 本地删除无 RI,删存量致 flow 端点失连由 FR-ELEM-6 检测报(状态栏 ⚠N);4.2 endpoint RI 级联删 flow 后不再产生 flow 端点未连源,FR-ELEM-6 检测逻辑保留作防御(可移除)。`

**Rationale**:修正 2--1a.8+ 阶段(4.2 未实现)line 479 plain properties 本地删除无 RI,删存量致 flow 端点失连,FR-ELEM-6 检测报;4.2 后 endpoint RI 级联删 flow(不留失连 flow)+ formula-reference dangling 高亮,删除不再产生 flow 端点未连源。Story 4.2 AC 逻辑不变(级联删 + dangling 已明确),仅注 1a.8+ 阶段时序 + 4.2 后检测保留。FR-ELEM-6(提案 3)已含"4.2 后不再产生此源"。

**连锁**:检查点 3(FR-ELEM-6 检测不变);修正 2 时序说明落地;line 479 AR-1 保留。

---

### 提案 6:新增 FR-UI-7/8/9 + Story 1a.8+(PromptPanel 重构)

**变更类型**:Moderate(新增 3 FR + 新增 story + 1a.8 边界注)
**归属**:Epic 1a 新增 story 1a.8+;依赖 1a.8/FR-ELEM-5/FR-ELEM-6/FR-UI-3 修订

**6.1 新增 FR-UI-7**(line 93 后,FR-UI-6 前)

- NEW:`- **FR-UI-7** PromptPanel 容器:四 tab["!" / 里程碑 / 源/汇 / 存量] + 收起态胶囊(不展示内容,横向 tab 名 + ⏏️ 展开键);"!" tab 收未答 confirm(仪式性不可逆操作,❕红渲染,一次性交互响应后转已解决纯展示)+ 运算错误 alert(⚠橙渲染)+ 非负钳制通知(1b 接入,不计角标 count);收起态"!"有未答 confirm -> tab 名红光闪烁角标;点 ⏏️/tab 名:有未答切"!"/无未答切上次活动或该 tab;里程碑 tab 独占里程碑回顾(★已达成/☆未达成,纯展示无操作),结构在 1a.8+ 内容 defer 游戏化中心(Epic 5);设置错误(状态性,持续 till 修复)归状态栏 ⚠N(FR-UI-3 修订)+ tab 行内,运算错误(时序性,运行时事件)归"!"tab alert;错误源跨 epic--1a.8+ 独立交付 flow 端点未连/孤立/parallel,量纲(含混合)1b 接入,公式悬空 4.2 接入,未实现源空占位(非 UI stub);cap 全保留 + 兜底 1000 + 滚动,"!"额外 toast 4s 自动移除。`

**6.2 新增 FR-UI-8**(FR-UI-7 后)

- NEW:`- **FR-UI-8** 存量 tab:stock 状态表,列 名称|变化值|单位|问题;变化值=净流量(Σ接入源 flow − Σ接入汇 flow,带符号纯数字不附单位);单位列显存量单位;行首标识 ⚫负/⚪正/☯零;单击行选中图元 -> 画布定位 + 右栏属性面板(FR-UI-2,1a.8)展开;cap 全保留 + 兜底 1000 + 滚动。`

**6.3 新增 FR-UI-9**(FR-UI-8 后)

- NEW:`- **FR-UI-9** 源/汇 tab:cloud 状态表,列 名称|连接|流量|问题;流量=流经该 cloud 的 flow 当前速率(多条取代数和);行首标识 ☁源(白渲染)/☁汇(黑渲染);单击选中 -> 画布跳转 + 右栏属性面板展开;cap 全保留 + 兜底 1000 + 滚动。`

**6.4 FR 映射区**(line 237 后,FR-UI-6 映射前)

- NEW 3 行:
  - `FR-UI-7: Epic 1a - PromptPanel 容器(四 tab/收起态/错误二分归宿/"!"tab)`
  - `FR-UI-8: Epic 1a - 存量 tab(stock 状态表)`
  - `FR-UI-9: Epic 1a - 源/汇 tab(cloud 状态表)`

**6.5 新增 Story 1a.8+**(编号留 SP,插 1a.8 后 1a.9 前;1a.9/1a.10 执行顺序后移,不重编号)

- NEW:

```
#### Story 1a.8+(编号留 SP):PromptPanel 重构为四 tab 容器

As a 单人建模者,
I want PromptPanel 重构为四 tab 容器(收"!"提示/里程碑/源汇/存量)+ 收起态胶囊不打扰建模,
So that 建模与提示/状态监视分离不互相干扰。

**Acceptance Criteria(四 tab 容器):**

**Given** 1a.7 prompt center 存在 + 1a.8 属性面板就绪
**When** 重构 PromptPanel 为四 tab 容器
**Then** 四 tab["!" / 里程碑 / 源/汇 / 存量](FR-UI-7),展开态显当前 tab 内容,tab 切换即时
**And** "!" tab 收未答 confirm(仪式性不可逆,❕红渲染,一次性交互响应后转已解决)+ 运算错误 alert(⚠橙渲染)+ 非负钳制通知(1b 接入,不计角标 count)
**And** 里程碑 tab 结构就绪(★已达成/☆未达成占位),内容 defer 游戏化中心 story(Epic 5),1a 验收只验结构就绪不验内容
**And** 存量 tab(FR-UI-8):列 名称|变化值(净流量)|单位|问题,行首 ⚫负/⚪正/☯零;变化值 1b 接入前 stub(1a 无仿真无净流量,显占位)
**And** 源/汇 tab(FR-UI-9):列 名称|连接|流量|问题,行首 ☁源白/汇黑;流量 1b 接入前 stub
**And** 单击行 -> 画布定位/跳转 + 右栏属性面板(1a.8)展开

**Acceptance Criteria(收起态):**

**Given** PromptPanel 收起态
**When** 不展开
**Then** 胶囊状,横向 tab 名 + ⏏️ 展开键,不展示内容
**And** "!" tab 有未答 confirm -> tab 名红光闪烁角标
**And** 点 ⏏️:有未答切"!"/无未答显上次活动 tab
**And** 点 tab 名:有未答切"!"/无未答切该 tab
**And** 展开态提示框右上角原 ⏏️ 位改收起键

**Acceptance Criteria(错误二分归宿):**

**Given** 设置错误(状态性)/ 运算错误(时序性)
**When** 错误产生
**Then** 设置错误归状态栏 ⚠N(FR-UI-3 修订)+ tab 行内(存量/源汇问题列)
**And** 运算错误归"!"tab alert
**And** 错误源跨 epic(检查点5 选项C):1a.8+ 独立交付 flow 端点未连(FR-ELEM-6)/孤立 cloud/parallel flow;量纲(含混合)1b 接入占位空;公式悬空 4.2 接入占位空;未实现源空占位(非 UI stub)
**And** cap 全保留 + 兜底 1000 + 滚动,"!"额外 toast 4s 自动移除

**Acceptance Criteria(关联跳转):**

**Given** 状态栏 ⚠N popover 清单项 / tab 行问题
**When** 点击
**Then** 跳错误主体(画布居中)+ 高亮关联图元(脉冲描边,样式留 DS)
**And** 缺失端点(已删)原位置阴影标记
**And** 图元类错误剩单图元(孤立 cloud),重名错误源因命名机制(FR-ELEM-5)消失

**Acceptance Criteria(边界 guard 段 - 依赖与时序):**

**Given** 1a.8+ 重构 story
**When** 执行
**Then** 依赖 1a.8 属性面板(字段聚焦)+ FR-ELEM-5 命名机制(重名源消失)+ FR-ELEM-6 flow 端点完整性(检测源)+ FR-UI-3 修订(状态栏 ⚠N)
**And** 1a.9 i18n 在 1a.8+ 后(对最终 tab 结构抽 key 避免返工,1a.9/1a.10 执行顺序后移,不重编号)
**And** defer 项:里程碑 tab 内容 -> 游戏化中心 story(Epic 5);量纲类(含混合)-> 1b;钳制通知 -> 1b;公式悬空 -> 4.2
```

**6.6 line 519 Story 1a.8 边界注**

- OLD:`**And** 1a 验收只验入口存在+触发逻辑就绪,不验推导结果`
- NEW:`**And** 1a 验收只验入口存在+触发逻辑就绪,不验推导结果` + 新增 `**And** 1a.8 scope:交付功能逻辑层(公式编辑/校验/量纲 stub)+ 最简 UI 容器;容器层 tab 化/新 tab/错误二分归宿在 1a.8+ 重构(见 Story 1a.8+),功能逻辑复用 UI 不白做`

**Rationale**:决策点 1(PromptPanel 重构独立 story 1a.8+,1a.8 交付功能逻辑层+最简 UI 容器)+ 四 tab 结构 + 收起态胶囊(不展示内容,红光闪烁角标)+ 错误二分归宿 + 检查点 5 选项 C(跨 epic 源空占位)+ 检查点 6(关联跳转主体+高亮)+ 里程碑 tab 结构 defer 游戏化中心(决策点 2)。

**不放处(留 CS/DS)**:数据 schema/组件 slot/挂载点/store 写回路径/脉冲描边样式/红光闪烁动画/深浅色终端适配--规格层不写实现细节(噪声门控)。

**连锁**:决策点 1/2;检查点 1-7;修正 1/2;提案 1(FR-ELEM-5 重名源消失)/提案 2(FR-UI-3 修订)/提案 3(FR-ELEM-6 检测源)/提案 5(修正 2 时序)。

---

### 提案 7:Epic 5 新增游戏化中心 story(占位,点 3 细节留 CS)

**变更类型**:Major(新增 FR + 新增 story;AC 细节留 CS 因点 3 未讨论)
**归属**:Epic 5 新增 story 5.4 + FR-GAME-4;依赖 5.3/1a.8+

**注**:决策点 2(归属 Epic 5 + 范围表盘+等级+徽章墙+等级挂建模行为 + 里程碑 tab 内容 defer 到此)已敲定;点 3 细节未讨论,本提案立 story 占位,AC 骨架(范围+依赖+defer),细节标"留 CS"。

**7.1 新增 FR-GAME-4**(line 99 后,FR-GAME-3 前)

- NEW:`- **FR-GAME-4** 游戏化中心(MVP):表盘 + 等级机制 + 徽章墙;等级触发挂 SD 建模行为(如"完成一个模型搭建升 1 level",完成语义待 CS);表盘归游戏化中心(非状态栏非 PromptPanel);里程碑 tab 回顾内容(FR-UI-7)在本 story 实现(结构在 1a.8+ 重构 story defer 到此);与 FR-GAME-2 行为徽章关系(徽章解锁计入等级?)留 CS;原 5.3 toast 即时反馈是否保留留 CS。`

**7.2 FR 映射区**(line 250 后,FR-GAME-3 映射前)

- NEW:`FR-GAME-4: Epic 5 - 游戏化中心(表盘+等级+徽章墙,等级挂建模行为)`

**7.3 Epic 5 FRs covered**(line 1398)

- OLD:`**FRs covered:** FR-UI-6, FR-GAME-1, FR-GAME-2(共 3,含 FR-GAME-2 split 主体)`
- NEW:`**FRs covered:** FR-UI-6, FR-GAME-1, FR-GAME-2, FR-GAME-4(共 4,含 FR-GAME-2 split 主体)`

**7.4 新增 Story 5.4**(编号留 SP,Story 5.3 后)

- NEW:

```
#### Story 5.4(编号留 SP):游戏化中心(表盘+等级+徽章墙)

As a 单人建模者,
I want 游戏化中心(表盘+等级+徽章墙)奖励建模行为,
So that 建模有进阶感与成就驱动。

**注:** 范围与依赖已定(决策点2),AC 细节留 CS--待点3 游戏化中心讨论钉死(表盘 UI/等级机制 XP 或徽章数/徽章墙数据关系/等级触发"完成搭建"语义/原 5.3 toast 即时反馈是否保留)。

**Acceptance Criteria(范围骨架,细节留 CS):**

**Given** FR-GAME-2 行为徽章(5.3)+ 1a 建模 + 1b 仿真就绪
**When** 实现游戏化中心
**Then** 表盘 + 等级机制 + 徽章墙(范围,UI/数值细节留 CS)
**And** 等级触发挂 SD 建模行为("完成搭建"语义:可运行+通过校验?待 CS 钉死)
**And** 表盘归游戏化中心(非状态栏非 PromptPanel)
**And** 里程碑 tab(FR-UI-7)回顾内容在本 story 实现(结构在 1a.8+ 重构 story defer 到此)
**And** 与 FR-GAME-2 行为徽章关系(徽章解锁计入等级?)留 CS

**Acceptance Criteria(边界 guard 段 - 依赖与 defer):**

**Given** Story 5.4
**When** 执行
**Then** 依赖 5.3(徽章系统+总开关)+ 1a.8+ 重构 story(里程碑 tab 结构)
**And** 游戏化总开关(FR-GAME-1)关闭后表盘/等级/徽章墙不显示不触发(同 FR-GAME-1)
**And** AC 细节留 CS(点3 讨论后):表盘 UI/等级机制/徽章墙数据关系/等级触发语义/原 5.3 toast 保留与否
```

**Rationale**:决策点 2(游戏化中心 Epic 5 新增 story,表盘+等级+徽章墙+等级挂建模行为;里程碑 tab 内容 defer 到此)+ 点 2(表盘归游戏化中心非状态栏非 PromptPanel)。不与 FR-GAME-2 行为徽章合并--游戏化中心是表盘+等级层,FR-GAME-2 是徽章触发层,关系待 CS。

**不放处(留 CS / 点 3 未讨论)**:表盘 UI/等级机制 XP/徽章墙数据关系/等级触发"完成搭建"语义/原 5.3 toast 保留与否--点 3 未讨论,噪声门控不包装成已定结论。

**连锁**:决策点 2;提案 6(里程碑 tab 结构 defer 到此);点 3 待讨论(独立待办,不阻塞 CC 回写)。

---

## Section 5: Implementation Handoff

**整体 scope 分类**:**Major**(含提案 7 新增 Epic story + 提案 1 推翻现有 FR + 提案 6 新增 3 FR + story)。

**分提案 scope**(供路由参考):

- Minor:提案 4(FR-SIM-7 注)/提案 5(line 479 时序注)
- Moderate:提案 1(FR-ELEM-5 命名机制)/提案 2(FR-UI-3 修订)/提案 3(FR-ELEM-6)/提案 6(PromptPanel 重构)
- Major:提案 7(游戏化中心,占位)

**Handoff(单人 CC 模式)**:

- 角色由用户自任(PM/Architect/Dev/PO)。
- **Apply 阶段**(Step 5 批准后):将提案 1-7 old->new apply 到 `_bmad-output/planning-artifacts/epics.md`;同步 Epic 1a FRs covered(line 263,+FR-ELEM-5/6 +FR-UI-7/8/9)。
- **编号定夺**(SP):1a.8+(PromptPanel 重构)/FR-ELEM-5 命名机制独立小 story/Story 5.4(游戏化中心)实际编号由 sprint-plan 定。
- **后续 story-cycle**:1a.8(property-panel-formula-editor)-> FR-ELEM-5 命名机制 -> 1a.8+ 重构 -> 1a.9 i18n;Story 5.4 待点 3 讨论 + 5.3 就绪。
- **独立待办**:点 3 游戏化中心细节讨论(表盘 UI/等级机制/徽章墙数据关系/等级触发语义/原 5.3 toast 保留)-> 钉死 Story 5.4 AC。

**Success Criteria**:

1. 提案 1-7 old->new 全 apply 到 epics.md,FR 定义/映射/Story AC/Epic FRs covered 同步。
2. 新增 story(1a.8+/FR-ELEM-5/5.4)在 epic 有完整块(5.4 AC 细节留 CS 标注)。
3. sprint-plan 反映新 story 编号 + 依赖顺序(1a.8 -> FR-ELEM-5 -> 1a.8+ -> 1a.9;5.4 待点 3)。
4. 记忆 `newsd-promptpanel-restructure-pending.md` 待办更新(CC 回写完成,点 3 独立待办)。
5. 1a.7 defer 5 文件不夹带重构(独立推)。

---

## 附录:未覆盖(留 CS/独立待办,不进本 Proposal apply)

- 点 3 游戏化中心细节(表盘 UI/等级机制 XP/徽章墙数据关系/等级触发"完成搭建"语义/原 5.3 toast 保留):独立讨论,钉死 Story 5.4 AC。
- 1a.8+ / FR-ELEM-5 / Story 5.4 的 CS 钉死(数据 schema/组件 slot/挂载点/store 写回路径/脉冲描边样式/红光闪烁动画/深浅色终端适配):各 story CS 阶段定。
- 1a.7 defer 5 文件 PR(styles.css/PromptPanel.tsx/PromptPanel.test.tsx/deferred-work.md/1a-7-toolbar-statusbar.md):独立推,不夹带重构。
