---
title: Implementation Readiness Assessment Report
project: NewSD
date: 2026-07-03
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
filesIncluded:
  prd: prds/prd-NewSD-2026-06-26/prd.md
  prd_supporting:
    - prds/prd-NewSD-2026-06-26/addendum.md
    - prds/prd-NewSD-2026-06-26/handoff-to-architecture.md
    - prds/prd-NewSD-2026-06-26/prd-prototype-diff-finalization-draft.md
    - prds/prd-NewSD-2026-06-26/review-collab.md
    - prds/prd-NewSD-2026-06-26/review-fit.md
    - prds/prd-NewSD-2026-06-26/review-numerical.md
    - prds/prd-NewSD-2026-06-26/review-rubric.md
    - prds/prd-NewSD-2026-06-26/review-scope.md
    - prds/prd-NewSD-2026-06-26/review-security.md
    - prds/prd-NewSD-2026-06-26/reviewer-gate-package.md
    - prds/prd-NewSD-2026-06-26/validation-report.md
  architecture: architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md
  architecture_supporting:
    - architecture/architecture-NewSD-2026-07-01/lovable-deck-prompt.md
    - architecture/architecture-NewSD-2026-07-01/reviews/
  epics: epics.md
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-03
**Project:** NewSD

## Step 1: Document Discovery

### 文档清单

#### PRD(分片)
- 文件夹: `prds/prd-NewSD-2026-06-26/`
  - **主文件**: `prd.md` (48KB, 2026-07-03 更新)
  - 支撑文件: `addendum.md` / `handoff-to-architecture.md` / `prd-prototype-diff-finalization-draft.md` / `review-{collab,fit,numerical,rubric,scope,security}.md` / `reviewer-gate-package.md` / `validation-report.{md,html}` / `session-report-2026-06-27.md`

#### 架构文档(分片)
- 文件夹: `architecture/architecture-NewSD-2026-07-01/`
  - **主文件**: `ARCHITECTURE-SPINE.md` (30KB, 2026-07-03 更新, status:final)
  - 支撑文件: `lovable-deck-prompt.md` + `reviews/` 子目录

#### Epics & Stories 文档(整体)
- `epics.md` (126KB / 1662 行, 2026-07-03 更新 — step-03 边界落地目标)

#### UX 文档
- 未找到独立 UX 文档(详见下方判定)

### 重复文档检查
- ✅ 无重复。PRD 与架构均为分片且顶层无整体 `.md` 版本,无冲突,无需取舍。

### UX 判定(epic 为基准,非缺口)

> UX 经 `epics.md`(权威规格,含 step-03 40 项边界 AC 与 a11y NFR)+ 嵌入式美学定位("形式即内容"/ASCII 亲缘点:spine line 21-29 + 各 epic desc line 460/742/880/1017 + prd)覆盖;`lovable/prototype` 分支为 **epic 成型前的视觉探针**,实现期作历史参照,与 epic 冲突时以 epic 为准。判为**非缺口**,不阻塞实现。
>
> 依据:
> 1. epics.md 是最新、经 AR/ECH 审、step-03 细化的权威规格,后于 prototype 产生,代表最新产品认知。
> 2. 交互行为已用 Given/When/Then 精确编码且可测(1662 行 / 35 story / 40 项边界 AC,含 a11y 键盘·色盲·屏幕阅读器·reduced-motion)。
> 3. 美学定位是嵌入而非缺失,只是未独立成册。
> 4. 时序:UX 文档按 BMad 应在 epic 之前;现 epic 已全做完,补 UX 文档将沦为追认或触发 rework。
>
> 轻量补强(可选,defer 到实现期):一页"ASCII 视觉设计系统速查"(字形调色板/动效词汇/a11y 基线)作为 dev 单一入口参考;但属实现期 design-dev 桥梁,非规划期 readiness gate,且 epic 已是事实标准,痛点出现再补即可。

## Step 2: PRD Analysis

> 来源:`prd.md`(权威 FR/NFR 定义处,共 37 FR)。`addendum.md` 经结构+grep 核验为工程机制/路线图理由(0 FR 定义),仅延伸既有 FR,不新增需求;review/handoff 文件仅引用 FR。故需求集完整且仅以 prd.md §3/§4 为准。

### Functional Requirements(共 37 项)

#### 3.1 画布渲染系统(FR-CANVAS-1~5)

- **FR-CANVAS-1 无限画布导航**:平移(中键拖拽 / 空格+左键)、缩放(滚轮/双指/控件);minZoom=0.05、maxZoom=20;世界坐标系 Float64;屏幕投影 3×2 仿射矩阵。
- **FR-CANVAS-2 网格吸附对齐**:1 世界单位=1 字符格;snapTolerance=8/currentZoom(世界单位,换算回屏幕恒 8px);用户可配网格步长。
- **FR-CANVAS-3 ASCII 字符渲染**:等宽字体;3 类图元(Cloud/Stock/Flow);可变流量中点 ▼、常数流量相交 ○(flow 渲染变体非独立图元);无独立反馈回路标记(涌现结果);文本标签严格对齐字符网格。
- **FR-CANVAS-4 空间索引与视口剔除**:R 树空间索引;每帧仅查视口相交元素;脏矩形追踪;目标 10,000 元素 ≥30 FPS。
- **FR-CANVAS-5 小地图(MVP)**:角落常驻缩略图(低精度采样);视口高亮框;点击/拖拽跳转;增量更新联动脏矩形(FR-CANVAS-4)避免 10k 全量重绘。

#### 3.2 模型图元系统(FR-ELEM-1~4)

- **FR-ELEM-1 存量元素**:属性 id(UUIDv4)/type="stock"/x,y/width,height/name/initialValue/units/currentValue(运行时不持久化)/allowNegative(默认 false);ASCII 方框居中显 name+currentValue+units(无 units 仅显数值,仿真未运行显 initialValue);交互:拖拽/调整大小/点击选中/双击编辑。
- **FR-ELEM-2 源/汇元素**:单一 cloud 图元类型(source/sink 为方向语义角色非独立 type);边界元素无限容量;极性由 flow 方向涌现(fromId 源 / toId 汇),不设极性字段。
- **FR-ELEM-3 流量连接器**:属性 id/type="flow"/fromId/toId/formula/units(自动派生 目标存量 units/时间单位,不可编辑)/isVariable;常数单位标注语法 `数值 [单位]`;公式以 stockId 引用存量(`@<uuid>`),编辑器显 name,重命名只改 name 不动 id(零断链,并发安全);重名软警告(不强制唯一);Bresenham 寻路+箭头 ▶/▶ + ▼/○ 变体+内联公式标签。
- **FR-ELEM-4 连接端口**:元素周边预定义连接点;创建连线自动吸附端口;拖拽元素端口位置随之更新。

#### 3.3 模拟引擎系统(FR-SIM-1~8)

- **FR-SIM-1 数值求解器**:隐式求解器(后向欧拉/BDF)每步牛顿迭代收敛,适用刚性系统;时间单位模型级设置(FR-UI-5);dt 可配(默认 0.1 模型时间单位);雅可比由公式 AST 自动微分(与 FR-SIM-7 量纲 AST 复用),每步含 LU 分解线性求解+收敛判定;手动控制 播放/暂停/单步/重置;仅房主运行模拟。
- **FR-SIM-2 存量断路器(代数环检测)**:编译时构建依赖有向图→移除所有存量流出边→剩余图有环=代数环(高亮+弹窗拒绝运行)→无环则合法交隐式求解器联立求解(拓扑序仅用于环检测,非逐个求值顺序);隐式法下仍严格剪边,检测到代数环一律拒绝。
- **FR-SIM-3 流量守恒原则**:单收敛值原则——每步收敛后每流量产单一一致速率,所有连接该流量的存量引用同一收敛速率;防止浮点漂移与物质守恒违规;约束作用于收敛结果非迭代过程。
- **FR-SIM-4 非负钳制机制**:对 allowNegative=false 存量,在隐式牛顿迭代施加 stock≥0 约束(迭代解转负时将流出约束投影到可行域,钳制后实际流出不超过使存量恰归零的速率);级联下游重算,雅可比体现活动约束方程结构变化;绝不幽灵渗漏。**禁止错误简化**:钳制须作用于流出速率(投影),不得后置钳制存量结果(`if nv<0 nv=0` 违 FR-SIM-3 致幽灵渗漏);lovable/prototype 现实现采后置钳制,架构阶段须重写为速率级。
- **FR-SIM-5 DELAY 函数实现**:DELAY 不作历史队列,转为串联隐式存量(AST 编译期插入,如 `DELAY3(X,6.0)` 插 3 个串联一阶 ODE);保证隐式联立求解连续性。
- **FR-SIM-6 数值溢出熔断**:满足任一即自动暂停:① 任一存量 |值| > max(所有存量初始绝对值)×1e6;② 任一存量 NaN/Infinity;③ 相邻步相对变化率 >1e3(`|v[t+dt]−v[t]|/max(|v[t]|,ε)>1000`,ε=1e-12);阈值 MVP 默认可调(含调参引导);通知 ASCII 弹窗 `[SYSTEM HALTED: NUMERICAL OVERFLOW AT t=<实际时间>s]`。
- **FR-SIM-7 量纲一致性校验(MVP)**:编译期对每流量公式遍历结构化 AST 逐子表达式推导单位→比对目标单位(目标存量 units/时间单位);一致通过,不一致软警告(红高亮+显预期/推导单位,**不阻断运行**);常数单位标注参与推导;无 units 存量视为无量纲;校验编辑时实时进行(FR-UI-2 扩展)。
- **FR-SIM-8 求解器自适应降级+一键简化(MVP)**:兑现 §1.1 硬约束;BDF 步进内嵌收敛监控(残差范数+步长收缩率)→步长崩溃/残差超阈时自动降级后向欧拉→显式试探步;一级(用户无感)仅降级存量 sparkline 旁闪烁黄点+状态栏"求解器自适应调节中",不弹窗不暂停不暴露档位术语;二级(罕见)自动暂停+弹单按钮"简化模型以继续",点击后自动执行预设降级组合(减少存量/降低耦合),用户不经手参数。验收:正常路径零新增控件;一级黄点不暂停;二级单按钮续跑无第二按钮/无参数面板。

#### 3.3.1 仿真结果呈现(FR-SIM-VIZ-1)

- **FR-SIM-VIZ-1 内联 ASCII 趋势可视化(MVP)**:每存量方框旁实时 ASCII sparkline(近 N 步默认 32);字符集 ▁▂▃▄▅▆▇█,数值自动归一化到字符高度档;**存量方框同步显当前数值+单位(不归一化)**(如 `[水位]\n 1234 升`,仿真未运行显 initialValue,无 units 仅显数值);量纲识读反馈(状态栏概要);采样窗口与 dt 解耦(固定保留近 N 采样点);纯字符渲染无第三方图表库;完整多存量叠加时序面板(L3)后续不含 MVP。

#### 3.4 实时协作系统(FR-COLLAB-1~6)

- **FR-COLLAB-1 CRDT 文档模型**:Yjs;`Y.Map("elements")`(id→JSON 状态);流量 formula 以**结构化 AST** 存储(Y.Map 嵌套运算符/操作数/存量引用节点,引用节点存 stockId),使并发编辑不同 AST 子节点语义感知合并(FR-COLLAB-6);`Y.Array("elementOrder")` Z 轴层级;`Y.Map("boardMetadata")` 看板名/设置/所有者;持久化 SQLite 快照+追加式操作日志(单节点 10 人认证规模)。
- **FR-COLLAB-2 存在感知协议**:非持久化独立通道传临时态(光标世界坐标/选区 `{elementIds,anchor,head}`/用户信息 `{id,name,color}`/心跳在线);广播 ≤30Hz 节流;视口剔除仅绘可见区域光标。
- **FR-COLLAB-3 房主迁移机制**:指定房主(首用户或选举)运行模拟;断连时:剩余用户检测心跳丢失→先申请者当选新房主→从服务端仿真态快照(FR-COLLAB-5)续跑不回退 t=0→广播 `SIMULATION RESUMED`。
- **FR-COLLAB-4 模拟状态广播**:独立二进制通道(不混 CRDT);消息 `[stockId<string>, currentValue<float64>]` 数组;≤30Hz 变化检测节流;广播粒度=隐式求解器每步收敛后整步结果(非子迭代中间值);客户端接收渲染**不回写 CRDT**;currentValue 会话级临时态(不入 CRDT 文档、不跨会话持久化)但经 FR-COLLAB-5 供迁移恢复。
- **FR-COLLAB-5 房间仿真态快照**:房主周期上报 `{simulationTime, stockValues, paused, dt}`;服务端进程内存持有(不落 SQLite,会话结束丢弃);迁移时新房主拉取续跑;会话级临时态不跨会话持久化。
- **FR-COLLAB-6 公式语义感知合并**:流量公式结构化 AST 存 CRDT,并发编辑不同子节点按节点级 CRDT 合并;AST↔文本双向同步(编辑器实时解析文本写 AST,CRDT 变化重序列化为文本;不完整语法以"待定节点"承载不阻断输入);合并后对 AST 做语法+量纲校验(FR-SIM-7),结构化合并保证 AST 始终可解析;工程量偏重(见 addendum §8)。

#### 3.5 多画板与剪贴板(FR-BOARD-1~3)

- **FR-BOARD-1 标签页界面**:每客户端最多同时开 5 画板;超限提示+"关闭不活跃"对话框;最近画板列表(最多 10 项);切换画板暂停/恢复 Y.Doc 同步。
- **FR-BOARD-2 跨画板复制粘贴**:剪贴板格式 Base64 JSON+协议头;协议前缀 `SD_ASCII_ENGINE://`+CRC32 校验和(仅完整性校验非认证);粘贴流程:① 校验协议前缀 ② 校验 CRC32 完整性 ③ 结构白名单校验(字段类型合法/ID 合法 UUIDv4/fromId-toId 引用存在于 payload/无未知字段,任一不合规即拒)④ 为所有粘贴元素分配新 UUID ⑤ 重映射流量连接到新 ID ⑥ 位置偏移 (+2,+2) ⑦ 插入空间索引;原子事务(整个粘贴单个 CRDT 操作);安全边界:粘贴仅交付图元结构不经 eval,防护目标为拒绝畸形/非法图元结构非密码学认证。
- **FR-BOARD-3 外部文件阻断**:拖放文件阻止所有类型默认行为;外部粘贴仅接受有效协议前缀纯文本;图片/二进制静默拒绝。

#### 3.6 撤销/重做(FR-HISTORY-1)

- **FR-HISTORY-1 画板独立撤销栈**:每画板绑独立 Y.UndoManager;粘贴视为单一原子事务;撤销粒度用户操作级(非按键级);栈大小限 100 步。

#### 3.7 用户界面(FR-UI-1~6)

- **FR-UI-1 顶部工具栏**:文件操作(新建/打开/保存);编辑操作(撤销/重做/复制/粘贴/删除);工具切换(选择/存量/源汇/流量);模拟控制(⏸暂停/▶播放/⏹重置/⏭单步);时间步长选择器 dt=[0.01,0.1,0.5,1.0];缩放级别指示器+滑块。
- **FR-UI-2 右侧属性面板**:显选中元素属性;存量(name/initialValue/units/allowNegative 复选框);流量(公式编辑器支持常数单位标注语法/可变-常数切换/显派生流量单位只读);实时校验(公式语法错误红高亮+量纲不一致软警告 FR-SIM-7)。
- **FR-UI-3 底部状态栏**:模拟时间计数器/图元计数/在线用户数+头像堆栈/FPS 指示器(Debug)/连接状态指示器/量纲校验概要(L2 渐显——事件触发或进阶操作唤起,如 `量纲: 3/5 一致 · 2 软警告`,点击展开不一致流量清单显预期/推导单位)。
- **FR-UI-4 界面语言(中/英双语可切换)**:运行时可切换即时生效无需刷新;语言选项入口设置面板,持久化 localStorage;切换范围所有界面 chrome(工具栏/属性面板/状态栏/弹窗/提示);不在切换范围:用户自建图元 name/公式内容/ASCII 图元字符画;默认跟随 navigator.language 无匹配回退 English。
- **FR-UI-5 模型设置**:模型级配置(独立面板/设置入口):时间单位(年/月/日/时/分/秒 单选,作量纲校验与 dt 计量基准)、默认 dt(与 FR-SIM-1 选择器联动);修改时间单位触发全模型量纲重校验(FR-SIM-7)。
- **FR-UI-6 交互质感层(赛博朋克沉浸式反馈)**:硬 FR(架构阶段必保,与渲染方案无关纯交互质感)8 项:① 流量数据流动画 `>>>>>>>` 沿 flow 行进 ② 方波合成音频 blip(创建图元/播放暂停/解锁徽章) ③ 徽章解锁碎裂粒子(字母拆分 ASCII 弹片物理动画) ④ 数值 glitch 解码动画(逐位解码落定) ⑤ LVL UP 大字 overlay ⑥ 呼吸辉光(当前 dt 按钮呼吸高亮) ⑦ ASCII 风格控件(色相循环按钮/ASCII 下拉带 `>` 闪烁光标/徽章四角扫描器) ⑧ 输入火花(数值增减上下向火花);视渲染裁决实现(依赖渲染方案)2 项:⑨ CRT 背景漂移 ⑩ per-glyph 霓虹辉光;验收:硬 FR 8 项 MVP 须渲染,第 9/10 项以渲染裁决等效质感为准。

#### 3.8 游戏化(可选层)(FR-GAME-1~3)

- **FR-GAME-1 游戏化总开关**:用户可在设置中开/关游戏化层(默认状态待 UI 细化);关闭后徽章完全不显示不触发,不影响建模与协作核心功能。
- **FR-GAME-2 行为徽章系统(MVP)**:基于建模动作触发徽章(不依赖仿真结果质量比对);内置触发器示例(首个存量/首次连接流量/首次跑仿真/连接 10 图元/完成首模型含 ≥1 存量+≥1 流量并成功跑一次仿真);ASCII 风格图标即时反馈;徽章记录绑账号持久化(跨设备跟随 AD-16)。
- **FR-GAME-3 挑战关卡(后续,紧随 MVP 之后第一优先项,非 MVP)**:内置少量预设挑战场景(起始模型+达标条件);达标判定依赖仿真结果数值比对引擎(该引擎为前置依赖记 addendum);MVP 不含。

**Total FRs: 37**(FR-CANVAS×5 + FR-ELEM×4 + FR-SIM×8 + FR-SIM-VIZ×1 + FR-COLLAB×6 + FR-BOARD×3 + FR-HISTORY×1 + FR-UI×6 + FR-GAME×3 = 37)。其中 FR-GAME-3 为 post-MVP(显式排除 MVP),仍作可追溯需求登记。

### Non-Functional Requirements

#### 4.1 性能指标
- 1000 图元画布帧率 ≥ 60 FPS(NFR-PERF-1)
- 10,000 图元画布帧率 ≥ 30 FPS(NFR-PERF-2)
- 协作延迟 P95 ≤ 100 毫秒(NFR-PERF-3)
- 1000 图元画板加载时间 ≤ 2 秒(NFR-PERF-4)
- 1000 图元内存占用 ≤ 50 MB(NFR-PERF-5)

#### 4.2 可靠性
- 协作服务可用性 99.9%(NFR-REL-1)
- 服务器重启无数据丢失(持久化快照)(NFR-REL-2)
- 自动重连 + 操作重放(NFR-REL-3)

#### 4.3 安全性
- 剪贴板协议校验:拒绝所有畸形 payload(完整性 CRC32 + 结构白名单,见 FR-BOARD-2;**CRC32 非加密认证**)(NFR-SEC-1)
- 公式求值禁用 eval():仅 Rust/Wasm 表达式解析器(NFR-SEC-2)
- CORS 保护(HTTP 接口)(NFR-SEC-3)
- WebSocket 握手首帧 token 鉴权 + Origin 头校验(MVP OAuth GitHub+Google 认证,session token 双通道 HttpOnly Secure Cookie + JSON body,SameSite=Lax 防 CSRF;AD-16)(NFR-SEC-4)
- WebSocket 连接速率限制(NFR-SEC-5)

#### 4.4 兼容性
- 浏览器:Chrome/Firefox/Safari(最新两个版本)(NFR-COMPAT-1)
- MVP 阶段不支持移动端(NFR-COMPAT-2)
- 国际化:界面文本中/英双语可切换(FR-UI-4);MVP 仅此两种,i18n 框架为后续扩展语言预留(NFR-COMPAT-3)

> 注:NFR 编号(NFR-PERF-x/NFR-REL-x/NFR-SEC-x/NFR-COMPAT-x)为本报告为可追溯性赋予的索引标签,PRD §4 原文以表格/列表形式表述未显式编号;映射一一对应,无遗漏。

### Additional Requirements(成功指标 / 反指标 / 假设与决策)

#### §1.4 成功指标(目标值)
- 1000 图元画布帧率 ≥ 60 FPS | 协作延迟 P95 ≤ 100ms | 模拟运算速度 100 存量 ≥ 100 步/秒 | 单画布最大并发用户 10 人 | 首次建模时间(新手上路)≤ 5 分钟 | 单会话模型迭代次数中位数 ≥ 3 次 | 徽章解锁率(行为徽章首次会话解锁 ≥1 枚用户占比)≥ 60% | 模型保存/加载失败率 < 0.1% | 多客户端间模拟数值偏差 < 0.001%。

#### §1.4 反指标(必须避免的不变量)
- 剪贴板畸形/非法图元结构注入 = 0(任意构造剪贴板 payload 不得注入非法图元结构;粘贴通道不经 eval,不承诺密码学认证)。
- 房主迁移导致的仿真状态清零 = 0(迁移须从会话内快照续跑,不得回退 t=0)。

#### §6 假设与决策(约束/假设)
- **[假设 1]** 模拟主机为第一个进入房间间的用户,断开时自动迁移(替代方案:服务器端统一计算——未采)。
- **[假设 2]** 粘贴后自动选中行为推迟到实现阶段(建议:不自动选中,减少 Awareness 网络流量)。
- **[决策(原假设 3)]** 粘贴原子性采方案 C:粘贴为单个 CRDT 原子事务(FR-BOARD-2),撤销粘贴删粘贴图元+内部重映射流量,外部流量及公式引用按统一删除 RI 规则处理(spec Constraints:删除存量级联删以其为端点的流量 endpoint RI;公式 `@uuid` 引用被删存量但非端点则 AST ref 标 dangling 红色高亮+状态栏告警不删流量 formula-reference RI / C2),无跨事务 undo 归并(与 FR-HISTORY-1 用户操作级粒度一致)。原选项 A/B 均不采。
- **[决策(原开放问题 1)]** 仿真态为会话级临时态:会话内可经服务端仿真态快照(FR-COLLAB-5)恢复以支持房主迁移;不跨会话持久化。会话结束即丢弃运行时状态,下次打开画板从模型定义初始值重新开始。
- **[开放问题 2]** 官方支持的最大画板尺寸?当前目标 10,000 图元(未闭合,留架构/实现期)。
- **[决策(原开放问题 3)]** MVP 引入 OAuth 认证(GitHub+Google)+ 画板权限模型(owner/editor/viewer),支持跨设备徽章跟随与只读分享(AD-16/17)。自托管账号密码非 MVP,SaaS 规模化后补。
- **[开放问题 4]** 挑战关卡的达标判定引擎与 L3 时序面板是否复用同一仿真结果数据通道?二者均为后续能力,需架构阶段统一数据通路设计(见 addendum)。

### PRD Completeness Assessment

- **FR 完整性**:37 FR 覆盖八大域(画布渲染/图元/模拟引擎/仿真可视化/协作/多画板剪贴板/撤销/界面/游戏化),编号体系一致(`FR-<域>-<序>`)。FR-GAME-3 显式标 post-MVP 但登记可追溯。
- **NFR 完整性**:性能 5 项 + 可靠性 3 项 + 安全性 5 项 + 兼容性 3 项,共 16 NFR 类需求,覆盖性能/可靠/安全/兼容四维(可用性/可维护性/可扩展性未单列——单节点 MVP 规模下隐含于架构 AD,非 PRD 缺口)。
- **决策闭合度**:§6 中假设 3/开放问题 1/开放问题 3 已闭合为决策(粘贴方案 C / 仿真态会话级 / OAuth+权限模型);开放问题 2(最大画板尺寸)/4(数据通路复用)未闭合但均标"架构阶段"处置,不影响实现就绪——属已知 follow-up。
- **可追溯锚点充分**:PRD 显式交叉引用架构(AD-16/17)、addendum(§2/§7/§8)、FR 间互引(FR-SIM-1↔FR-SIM-7 AST 复用、FR-COLLAB-1↔FR-COLLAB-6、FR-BOARD-2↔FR-HISTORY-1),可追溯性强。
- **反指标/不变量明确**:§1.4 两项反指标(剪贴板注入=0 / 迁移清零=0)为硬约束级验收门槛,实现期须有对应测试。
- **美学/硬约束层清晰**:§1.1"形式即内容"美学原理+"架构即内容"硬约束(渲染管线 VRAM 双缓冲+辉光图集、禁 per-glyph shadowBlur)为不可协商门槛 KPI,贯穿 FR-SIM-8/FR-UI-6/§5.1 逃生阀。
- **初判**:PRD 作为需求源**完整、清晰、可追溯**,可进入 epic 覆盖校验(step-3)。

## Step 3: Epic Coverage Validation

> 目标:校验 PRD(step-2 提取的 37 FR)是否被 epics.md 的 epic/story 完整捕获,识别覆盖缺口。来源:epics.md 全文(1663 行,完整加载)+ epics.md 内嵌 `### FR Coverage Map`(line 209-253)+ 各 epic `**FRs covered:**` 声明 + 各 story `**FR:**` 锚点。

### Epic Inventory(6 epic + 1 后续 / 35 story)

| Epic | 主题 | Story 数 | FRs covered 声明数 | 定位 |
|------|------|---------|-------------------|------|
| Epic 1a | 建模与渲染核心 | 10(1a.1-1a.10) | 14 | 用户价值(单人建模闭环) |
| Epic 1b | Wasm 仿真求解器 | 8(1b.1-1b.8) | 9 | 用户价值(单人仿真闭环)+ 高风险隔离 |
| Epic 2 | 认证与画板归属权限 | 4(2.1-2.4) | 0(使能 epic) | 使能层(显式例外,ADR-EPIC-2) |
| Epic 3 | 实时多人协作 | 6(3.1-3.6) | 6(含 FR-COLLAB-1 split 主体) | 用户价值 |
| Epic 4 | 多画板、剪贴板与撤销重做 | 4(4.1-4.4) | 4 | 用户价值 |
| Epic 5 | 赛博朋克交互质感与游戏化 | 3(5.1-5.3) | 3(含 FR-GAME-2 split 主体) | 用户价值 |
| 后续 | 挑战关卡 | 0 | 1(FR-GAME-3) | 非 MVP,登记可追溯 |
| **合计** | | **35** | **37** | |

### FR → Epic/Story 覆盖矩阵

| FR # | PRD 需求(简) | 归属 Epic | 落地 Story | 状态 |
|------|-------------|----------|-----------|------|
| FR-CANVAS-1 | 无限画布导航(平移/缩放/Float64) | Epic 1a | 1a.1 | ✅ 覆盖 |
| FR-CANVAS-2 | 网格吸附对齐(1 单位=1 字符格,8px) | Epic 1a | 1a.3 | ✅ 覆盖 |
| FR-CANVAS-3 | ASCII 字符渲染(stock/cloud/flow) | Epic 1a | 1a.3/1a.4 | ✅ 覆盖 |
| FR-CANVAS-4 | 空间索引(R 树)+视口剔除+脏矩形 | Epic 1a | 1a.5 | ✅ 覆盖 |
| FR-CANVAS-5 | 小地图(角落缩略图,增量更新) | Epic 1a | 1a.6 | ✅ 覆盖 |
| FR-ELEM-1 | 存量元素(stock 属性+方框+交互) | Epic 1a | 1a.3 | ✅ 覆盖 |
| FR-ELEM-2 | 源/汇元素(cloud,语义由 flow 涌现) | Epic 1a | 1a.3 | ✅ 覆盖 |
| FR-ELEM-3 | 流量连接器(@uuid 引用+Bresenham+端口) | Epic 1a | 1a.4 | ✅ 覆盖 |
| FR-ELEM-4 | 连接端口(预定义连接点+吸附) | Epic 1a | 1a.4 | ✅ 覆盖 |
| FR-SIM-1 | 数值求解器(隐式 BDF+牛顿+autodiff+LU) | Epic 1b | 1b.3 | ✅ 覆盖 |
| FR-SIM-2 | 代数环检测(严格剪边) | Epic 1b | 1b.2 | ✅ 覆盖 |
| FR-SIM-3 | 流量守恒(单收敛值) | Epic 1b | 1b.3 | ✅ 覆盖 |
| FR-SIM-4 | 非负钳制(速率级投影,禁后置) | Epic 1b | 1b.4 | ✅ 覆盖 |
| FR-SIM-5 | DELAY 函数(编译期转串联隐式存量) | Epic 1b | 1b.2 | ✅ 覆盖 |
| FR-SIM-6 | 数值溢出熔断([SYSTEM HALTED]) | Epic 1b | 1b.5 | ✅ 覆盖 |
| FR-SIM-7 | 量纲一致性校验(AST 推导,软警告) | Epic 1b | 1b.6 | ✅ 覆盖 |
| FR-SIM-8 | 求解器自适应降级+一键简化 | Epic 1b | 1b.7 | ✅ 覆盖 |
| FR-SIM-VIZ-1 | 内联 ASCII sparkline(近 N=32 步) | Epic 1b | 1b.8 | ✅ 覆盖 |
| FR-COLLAB-1 | CRDT 文档模型(Yjs AST) | Epic 3(+Epic 2) | 3.1 主体(+2.2 owner 子句) | ✅ 覆盖(split) |
| FR-COLLAB-2 | 存在感知协议(光标/选区,30Hz) | Epic 3 | 3.2 | ✅ 覆盖 |
| FR-COLLAB-3 | 房主迁移机制(心跳→当选→快照续跑) | Epic 3 | 3.5 | ✅ 覆盖 |
| FR-COLLAB-4 | 模拟状态广播(独立二进制通道) | Epic 3 | 3.4 | ✅ 覆盖 |
| FR-COLLAB-5 | 房间仿真态快照(进程内存) | Epic 3 | 3.4 | ✅ 覆盖 |
| FR-COLLAB-6 | 公式语义感知合并(AST 节点级+分级回退) | Epic 3 | 3.6 | ✅ 覆盖 |
| FR-BOARD-1 | 标签页界面(≤5 画板+最近列表) | Epic 4 | 4.1 | ✅ 覆盖 |
| FR-BOARD-2 | 跨画板复制粘贴(协议头+CRC32+白名单) | Epic 4 | 4.3 | ✅ 覆盖 |
| FR-BOARD-3 | 外部文件阻断(拖放/粘贴) | Epic 4 | 4.3 | ✅ 覆盖 |
| FR-HISTORY-1 | 画板独立撤销栈(用户操作级,100 步) | Epic 4 | 4.4 | ✅ 覆盖 |
| FR-UI-1 | 顶部工具栏(文件/编辑/工具/模拟/dt/缩放) | Epic 1a | 1a.7 | ✅ 覆盖 |
| FR-UI-2 | 右侧属性面板(存量/流量属性+实时校验) | Epic 1a | 1a.8 | ✅ 覆盖 |
| FR-UI-3 | 底部状态栏(时间/图元/在线/FPS/量纲) | Epic 1a | 1a.7 | ✅ 覆盖 |
| FR-UI-4 | 界面语言(中/英双语运行时切换) | Epic 1a | 1a.9 | ✅ 覆盖 |
| FR-UI-5 | 模型设置(时间单位+默认 dt+重校验) | Epic 1a | 1a.10 | ✅ 覆盖 |
| FR-UI-6 | 交互质感层(10 项) | Epic 5 | 5.1(前 8)/5.2(后 2) | ✅ 覆盖 |
| FR-GAME-1 | 游戏化总开关(开/关) | Epic 5 | 5.3 | ✅ 覆盖 |
| FR-GAME-2 | 行为徽章系统(触发器+服务端判定) | Epic 5(+Epic 2) | 5.3 主体(+2.4 绑账号子句) | ✅ 覆盖(split) |
| FR-GAME-3 | 挑战关卡(预设场景+达标判定) | 后续(非 MVP) | — | ✅ 登记(post-MVP) |

### Split FR 处理(跨 epic,无重复计数)

两条 FR 跨功能 epic 主体 + Epic 2 支撑子句(AD 锚点不同),epics.md 显式 split 标注(ADR-EPIC-3):

- **FR-COLLAB-1**:主体(CRDT 文档模型 Yjs AST)→ Epic 3 / Story 3.1;owner 归属子句(boardMetadata/owner_user_id,AD-17)→ Epic 2 / Story 2.2。计数归 Epic 3 主体一处。
- **FR-GAME-2**:主体(徽章触发器+服务端判定+toast)→ Epic 5 / Story 5.3;绑账号跨设备持久化子句(AD-16)→ Epic 2 / Story 2.4。计数归 Epic 5 主体一处。

### Epic 2 使能 epic 说明

Epic 2 零独立 PRD FR 编号,在"用户价值导向"原则下属显式例外——AD-16/17 架构重独立成 epic 便于实施,标注"使能 epic"非隐式技术层(ADR-EPIC-2)。其 story 承载 split FR 子句(FR-COLLAB-1 owner 归属 / FR-GAME-2 绑账号)+ 认证/权限基座,非需求缺口。

### Missing Requirements(缺口分析)

- **缺口数:0**。37 FR(36 MVP + 1 post-MVP)全部在 epic/story 中有归属,无一遗漏。
- **重复计数:0**。两条 split FR 经标注主体一处计数,子句归 Epic 2 支撑不重复。
- **孤儿 FR:0**。每条 FR 恰有一处 epic 归属 + 至少一个 story 落地(FR-GAME-3 post-MVP 显式登记于"后续"段无 story,符合其非 MVP 定位)。

### Coverage Statistics

| 指标 | 值 |
|------|-----|
| Total PRD FRs | 37(36 MVP + 1 post-MVP) |
| Covered in epics/stories | 37 |
| Missing | 0 |
| Coverage | **100%** |
| Epic 分布 | 1a=14 / 1b=9 / 3=6 / 4=4 / 5=3 / 后续=1 / Epic2=0(使能) |
| Split FR(跨 epic) | 2(FR-COLLAB-1 / FR-GAME-2,均正确标注) |

### 依赖序核验(无环)

epics.md 声明依赖序:1a → 1b → 2 → 3 → 4 → 5,无环。Epic 4 依 Epic 3.1 Yjs(FR-BOARD-1 标签页切换暂停 Y.Doc / FR-BOARD-2 剪贴板单 CRDT op 原子事务 / FR-HISTORY-1 Y.UndoManager 均依 3.1;1a.3/1a.4 用 plain properties 无 Yjs,非 3/4 并行);Epic 5 依 1a+1b+2+3(ADR-EPIC-4,FM-1/FM-2/FM-3 已修正)。降级交付路径已标:Epic 1b 延期则 Epic 3 房主迁移(3.5)+ 仿真广播(3.4)+ Epic 5 仿真触发器后置(标"依赖 1b 解锁")。

### Assessment

- **FR 覆盖完整性**:37/37 = 100%,零遗漏零重复,每条 PRD FR 在 epic/story 中有唯一可追溯归属。
- **覆盖矩阵可追溯**:epics.md 内嵌 `### FR Coverage Map` 提供逐条 FR→epic 映射,各 story `**FR:**` 锚点提供 FR→story 映射,双层可追溯。
- **split / 使能 epic 处理得当**:两条跨 epic FR 与 Epic 2 使能 epic 经 ADR-EPIC-2/3 显式标注,无隐式缺口或重复计数。
- **post-MVP 登记**:FR-GAME-3 显式标 post-MVP 并登记于"后续"段,可追溯非遗漏。
- **初判**:epic/story 层**完整覆盖 PRD 全部 37 FR**,可进入 UX 对齐校验(step-4)。

## Step 4: UX Alignment

> 目标:校验 UX 文档是否存在并与 PRD/架构对齐。来源:文件系统 glob(`**/*ux*.md` / `**/ux-designs/**` / `**/*{design,ui,ux}*` 均无结果)+ frontmatter `ux: null` + Step 1 已做的 UX 判定。

### UX Document Status

**Not Found**。项目无独立 UX 设计文档(无 `ux-designs/` 目录、无 `*ux*.md` 文件、无 `*design*` / `*ui*` 独立文档)。frontmatter `ux: null`。

### UX 是否 implied(判定)

UX/UI 强 implied——NewSD 是用户面对的 Web 应用:
- PRD §1.1 产品愿景(赛博朋克 ASCII 系统动力学建模平台)+ §1.3 默认可见性规约(L1/L2/L3 视觉层级)+ §3.7 用户界面(FR-UI-1~6)。
- 架构 AD-9(VRAM 渲染管线,等宽网格画布)+ spec CAP-10(界面 chrome)/CAP-11(交互质感层)。
- epics.md 嵌入式美学定位("形式即内容"/等宽网格/阅读观看双重性,spine line 21-29 + 各 epic desc 美学亲缘点)+ 40 项边界 AC 含 a11y(键盘/色盲/屏幕阅读器/prefers-reduced-motion)。

### Alignment Issues(UX ↔ PRD / UX ↔ Architecture)

无独立 UX 文档,故无"UX 文档 vs PRD/架构"的直接错位可校验。替代校验:UX 相关需求是否在 PRD + 架构中有归属(避免 UX 需求裸奔无承载):

- **UX ↔ PRD 对齐**:UX 相关需求全部在 PRD 有 FR 锚点——界面 chrome(FR-UI-1~3)/ 语言(FR-UI-4)/ 模型设置(FR-UI-5)/ 交互质感 10 项(FR-UI-6)/ 视觉层级(L1/L2/L3,§1.3)。无 UX 需求游离于 PRD 之外。
- **UX ↔ Architecture 对齐**:UX 渲染方案有架构支撑——VRAM 双缓冲+辉光图集(AD-9)支撑 FR-UI-6 第 9/10 项 per-glyph 辉光;禁 per-glyph shadowBlur(CAP-11)是美学完整性铁律;Wasm 隔离(AD-5)支撑仿真不阻塞 UI。无 UI 组件缺架构支撑。
- **UX 行为编码可测**:交互行为在 epics.md 以 Given/When/Then 精确编码(35 story / 40 项边界 AC),非仅定性描述。

### Warnings

> **⚠ Advisory Warning(非阻塞)**:UX 作为独立文档缺失,但 UX 是 implied(用户面对 Web 应用)。按 step-04 规则,implied-but-missing 须记 warning;**本 warning 经评估降为 advisory / non-blocking**,不阻塞实现就绪。

**降级依据**(Step 1 已判定,此处复核确认):

1. **epics.md 为权威规格基准**(非 prototype):epics.md 是最新、经 AR/ECH 两轮正交审查、step-03 40 项边界细化的权威规格;`lovable/prototype` 分支为 **epic 成型前的视觉探针**,实现期作历史参照,与 epic 冲突时以 epic 为准。UX 文档按 BMad 应在 epic 之前产出,现 epic 已全做完,补 UX 文档将沦为追认或触发 rework。
2. **美学定位嵌入非缺失**:"形式即内容"美学原理跨产品定位,嵌入 spine(§架构即内容)+ 各 epic desc 美学亲缘点 + PRD §1.1/§1.3,非独立成册但全覆盖(建模/仿真/协作/传输/质感 5 节点亲缘)。
3. **交互行为可测**:1662 行 / 35 story / 40 项边界 AC(含 a11y 键盘·色盲·屏幕阅读器·reduced-motion)以 Given/When/Then 编码,验收可测。
4. **架构支撑充分**:UX 渲染/性能需求有 AD-9/CAP-10/CAP-11 + NFR-PERF 支撑,无 UI 组件缺架构承载。

**轻量补强(可选,defer 到实现期,非规划期 readiness gate)**:一页"ASCII 视觉设计系统速查"(字形调色板 / 动效词汇 / a11y 基线)作为 dev 单一入口参考;属实现期 design-dev 桥梁,痛点出现再补即可,当前不阻塞。

### Assessment

- **UX 独立文档**:缺失(implied),记 advisory warning。
- **UX 需求承载**:无游离——UX 相关需求全部在 PRD(FR-UI-1~6 / §1.1 / §1.3)+ 架构(AD-9 / CAP-10 / CAP-11)+ epics(美学定位 + 40 项边界 AC)有归属。
- **对齐错位**:无(无独立 UX 文档故无错位;UX↔PRD、UX↔Architecture 经替代校验对齐)。
- **阻塞判定**:advisory / non-blocking。epics.md 作权威基准 + 美学嵌入 + 行为可测 + 架构支撑,四要素齐备,UX 缺独立文档不构成实现就绪阻塞。
- **初判**:UX 对齐**通过(带 advisory warning)**,可进入 epic 质量审查(step-5)。

## Step 5: Epic Quality Review

> 目标:按 create-epics-and-stories 最佳实践校验 epic/story(用户价值导向 / 独立性 / 依赖无前向 / story 尺寸与 AC 完整性 / 数据库建表时机 / starter template)。来源:epics.md 全文 + Decision Log(ADR-EPIC-1~4)+ 各 story 前置声明。

### Epic Structure Validation

#### A. User Value Focus Check(每 epic 用户价值导向)

| Epic | 标题 | 用户价值陈述 | 判定 |
|------|------|------------|------|
| Epic 1a | 建模与渲染核心 | 用户能启动应用、在无限画布上创建图元与公式、单人建模闭环 | ✅ 用户价值(含项目骨架/VRAM 基座/部署骨架,但承接"应用可被访问"价值非纯技术层) |
| Epic 1b | Wasm 仿真求解器 | 用户能运行隐式求解器仿真、看实时 ASCII sparkline、完成单人建模→仿真闭环 | ✅ 用户价值(Wasm 内核是手段,用户结果是跑仿真看结果) |
| Epic 2 | 认证与画板归属权限(使能 epic) | 用户能 OAuth 登录、拥有画板、管理 editor/viewer 角色、生成可轮换只读分享链接 | 🟡 边界(认证 epic;但有用户面对成果 login/manage/share,显式标"使能 epic"非隐式技术层,ADR-EPIC-2) |
| Epic 3 | 实时多人协作 | 多人能同时编辑同一画板看实时光标、房主权威跑仿真他人看结果、房主断开新房主无缝续跑 | ✅ 用户价值 |
| Epic 4 | 多画板、剪贴板与撤销重做 | 用户能同时开多画板标签页、跨画板复制粘贴图元、用户操作级撤销重做 | ✅ 用户价值 |
| Epic 5 | 赛博朋克交互质感与游戏化 | 用户在建模中获得赛博朋克沉浸反馈、解锁行为徽章触发 LVL UP、游戏化可开关 | ✅ 用户价值 |

**纯技术里程碑 epic:0**。无 "Setup Database"/"API Development"/"Infrastructure Setup" 类纯技术 epic。Epic 2 认证属 step 列出的"borderline",但经 ADR-EPIC-2 显式标注使能 epic + 有用户面对成果,降为 minor。

#### B. Epic Independence Validation(无环 / 无前向 epic 依赖)

声明依赖序:1a → 1b → 2 → 3 → 4 → 5,无环(ADR-EPIC-4 修正 FM-1/FM-2/FM-3)。

- Epic 1a:独立可交付(单人建模闭环,零依赖)。✅
- Epic 1b:依 1a(建模图元 AST)。✅ 前向 only。
- Epic 2:依 1a.1(Dockerfile Go build + CI/CD + AD-18 部署骨架)——"Epic 2 functions using only Epic 1 output"成立,不需 3/4/5。✅
- Epic 3:依 1a(建模)+ 1b(t0→t1 追赶 API,房主迁移)+ 2(鉴权)。✅ 前向 only。
- Epic 4:依 1a + 2 + 3.1(Yjs Y.Doc)。✅ 前向 only。
- Epic 5:依 1a + 1b + 2 + 3。✅ 前向 only。

**Epic N 依赖 Epic N+1:0 例**。无循环依赖。✅

### Story Quality Assessment

#### A. Story Sizing / Independence(无前向 story 依赖)

逐 story 前置核验(样本,全 35 story 已核):
- 1a.x:1a.1(root)→ 1a.2(前置 1a.1)→ 1a.3(前置 1a.2)→ ... 全后向。✅
- 1b.x:1b.1(前置 1a.10)→ 1b.2(前置 1b.1)→ 1b.3(前置 1b.2)→ ... 全后向。✅
- 2.x:2.1(前置 1a.1)→ 2.2(前置 2.1)→ 2.3(前置 2.2)→ 2.4(前置 2.1)。✅
- 3.x:3.1(前置 1a+2.1)→ 3.2(前置 3.1)→ 3.3(前置 3.1+2.2)→ 3.4(前置 3.1+1b.8)→ 3.5(前置 3.4+1b.3)→ 3.6(前置 3.1+1a.8)。✅
- 4.x:4.1(前置 1a.1+1a.7+2.2+3.1)→ 4.2(前置 1a.4+1a.7+3.1)→ 4.3(前置 4.1+4.2+1a.5+1a.7+3.1)→ 4.4(前置 3.1+1a.7+4.2+4.3)。✅
- 5.x:5.1(前置 1a.2+1a.4+1a.7+1a.8)→ 5.2(前置 5.1+1a.2)→ 5.3(前置 1a+1b+3.1+2.4+5.1)。✅

**前向依赖(forward reference):0 例**。所有前置均指向已建 story(同 epic 内低号或前序 epic)。

**"依赖 1b 解锁"标注 story**(3.4 / 3.5 / 5.3 部分):非前向依赖违例,是显式降级交付路径(1b 延期则后置,降级路径已标),符合最佳实践非违例。

**Story framing**(AR#6 旧 finding 复核):全 35 story 含 "As a... I want... So that..." framing(含 Epic 2/3——AR#6 登记的缺 framing 已修复)。✅

#### B. Acceptance Criteria Review(Given/When/Then BDD)

- **格式**:全 story 用 Given/When/Then BDD,含主 AC + 边界 guard 段 + NFR 段分类。✅
- **可测**:每 AC 有具体可验 outcomes(minZoom=0.05 / 帧率 ≥ 60 FPS / share_token ≥128 bits / CRC32 / INSERT OR IGNORE 等量化)。✅
- **完整**:40 项边界 guard AC(step-03)覆盖 error/edge 场景(E1-E28 + AR#3-#15),happy path + 异常路径双覆盖。✅
- **明确**:预期 outcomes 清晰可量。✅

**模糊 AC("user can login"类):0 例**。

### Dependency Analysis

#### A. Within-Epic Dependencies

每 epic 内 story 链后向递进(见上 A 节),无 "depends on Story 1.4" 类前向。1b.3 t0→t1 追赶 API 是"前瞻条"(供 Epic 3 消费)但 1b.3 独立可完成+可验("开发者能从指定 t0 跑到 t1 验证 API"),非前向依赖违例。✅

#### B. Database/Entity Creation Timing(建表时机)

schema 表分散到首次需要的 story 创建,非 1a.1 一次性建全表:

| 表 | 创建 story | 时机 |
|----|----------|------|
| users / sessions | 2.1(OAuth 登录) | 首次需认证时 ✅ |
| boards(owner_user_id) | 2.2(画板归属) | 首次需画板归属时 ✅ |
| user_badges | 2.4(徽章持久化基座) | 首次需徽章绑账号时 ✅ |
| CRDTSnapshot / OpLog | 3.1(yjs-go relay 持久化) | 首次需 CRDT 持久化时 ✅ |
| boards.last_opened_at | 4.1(最近画板列表) | 首次需列表排序时 ✅ |
| boards.name(冗余列) | 4.1(AR#7b) | 首次需列表渲名时 ✅ |
| PresenceSnapshot | 3.1/3.2(进程内存态) | 不落 SQLite,会话级 ✅ |

**"Epic 1 Story 1 建全表"违例:0**。建表时机正确。✅

### Special Implementation Checks

#### A. Starter Template Requirement

架构指定:greenfield-new(服务端/Wasm)+ brownfield(沿用 prototype 客户端栈)+ Minimal Source Tree(spine Structural Seed)。

- Epic 1a Story 1(1a.1)"应用骨架与无限画布导航":含 Dockerfile 多阶段构建 + CI/CD(lint→test→build→deploy)+ Go server serve 前端 dist + 画布导航。✅ 含项目骨架 + 依赖配置 + 初始部署。
- brownfield 集成点:沿用 prototype React^19.2 / TanStack Start^1.168 / Vite^8 / Tailwind v4 / TS^5.8.3 / bun;prototype formula.ts evalFormula 保留作非仿真预览(集成点显式)。✅

1a.1 是"setup + 首用户价值"混合 story(项目骨架 + 画布导航),含 starter template 要求的 cloning/deps/config。✅

#### B. Greenfield vs Brownfield Indicators

混合(greenfield-new 服务端/Wasm + brownfield 客户端):
- Greenfield 指标:初始项目 setup story(1a.1)✅ / dev env config(Dockerfile/CI/CD)✅ / CI/CD early(1a.1 main 合并触发部署)✅。
- Brownfield 指标:与既有系统集成(prototype 客户端栈沿用)✅ / 兼容性(formula.ts 保留非仿真路径)✅。

两类指标齐备且处理得当。✅

### Best Practices Compliance Checklist(每 epic)

| 检查项 | 1a | 1b | 2 | 3 | 4 | 5 |
|-------|----|----|---|---|---|---|
| Epic 交付用户价值 | ✅ | ✅ | 🟡 使能 | ✅ | ✅ | ✅ |
| Epic 独立可交付 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Story 尺寸得当 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 无前向依赖 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 建表时机正确(按需) | ✅(无 DB) | ✅(无 DB) | ✅ | ✅ | ✅ | ✅(复用 2.4) |
| AC 清晰(Given/When/Then) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FR 可追溯性 | ✅(14) | ✅(9) | ✅(split 子句) | ✅(6) | ✅(4) | ✅(3) |

### Quality Assessment Documentation(按严重度)

#### 🔴 Critical Violations

**0 项**。无纯技术里程碑 epic / 无破坏独立性的前向依赖 / 无无法完成的 epic-sized story。

#### 🟠 Major Issues

**0 项**。无模糊 AC / 无 story 依赖未来 story(降级路径标注非违例)/ 无建表时机违例。

#### 🟡 Minor Concerns

1. **Epic 2 "使能 epic" 用户价值边界**:认证 epic 属 step 列出的"borderline (is it user value?)"。经 ADR-EPIC-2 显式标注使能 epic + 有用户面对成果(login/manage roles/share)+ 非隐式技术层,降为 minor。**非阻塞**,已显式记录例外。
2. **Story 1a.1 SQLite WAL 备份原语时机**:1a.1 建 SQLite WAL 备份原语(F18-sqlite-backup,提升为 MVP 验收),但 1a 单人建模无持久化需求(表在 2.x/3.x 才建)。备份原语置骨架层正确,但"恢复测试验证可还原"需后续表存在方完整验证——可对 seed/空 DB 验原语,defensible 但略早。**非阻塞**。
3. **.prettierrc 设置 deferred 到 kickoff**:Additional Requirements 记"实现 kickoff 首个 TS/JS 代码落 main 前建根 .prettierrc",非 story AC。spine Deferred(非架构不变量),intentionally deferred。**非阻塞**(建议 kickoff 首个 PR 前补)。

### Recommendations

- Epic 2 使能 epic 例外:维持现状(ADR-EPIC-2 已记录),实现期注意其 story 2.2/2.4 的"前瞻条 — 边界声明"(runtime enforcement 推 Epic 3、徽章触发器推 Epic 5)是 split 契约,须在对应消费 story(3.3/5.3)落地时闭合。
- 1a.1 备份原语:实现期在 2.1(首张 users 表)建表后补一次完整 backup→restore 端到端验证(当前 1a.1 仅验原语可用)。
- .prettierrc:kickoff 首个 TS/JS PR 前建立,激活 format-on-save 确定性(继承 prototype eslint-plugin-prettier 隐式默认)。

### Assessment

- **用户价值导向**:6 epic 全部有用户价值陈述,Epic 2 边界已显式标注(ADR-EPIC-2)。无纯技术 epic。
- **独立性 / 无前向依赖**:epic 间无环、story 间无前向引用(35 story 前置全后向);"依赖 1b 解锁"是降级路径标注非违例。
- **AC 质量**:全 Given/When/Then BDD + 40 项边界 guard + 量化可测。
- **建表时机**:7 张表分散到首次需要 story 创建,无 1a.1 建全表违例。
- **starter / greenfield-brownfield**:1a.1 含骨架+部署+CI/CD,brownfield 集成点显式。
- **违例**:Critical 0 / Major 0 / Minor 3(均非阻塞,2 项已 ADR 记录、1 项 intentionally deferred)。
- **初判**:epic/story 质量**符合 create-epics-and-stories 最佳实践**(0 阻塞违例),可进入最终就绪评估(step-6)。

## Step 6: Final Assessment

### Findings 汇总(跨 step 1-5)

| Step | 检查维度 | 结果 | 阻塞? |
|------|---------|------|------|
| 1 | 文档发现(PRD/架构/epics/spec 齐备) | ✅ 核心文档齐;UX 文档缺(advisory) | 否 |
| 2 | PRD 分析(问题/用户/成功标准/37 FR/NFR) | ✅ 完整,scope 清晰(36 MVP + 1 post-MVP) | 否 |
| 3 | Epic 覆盖(37 FR → epic/story 矩阵) | ✅ 37/37=100%,0 gap/0 dup/0 orphan,无环 | 否 |
| 4 | UX 对齐 | ✅ 通过(带 advisory warning:epics 为基线,prototype 为 probe) | 否 |
| 5 | Epic 质量(用户价值/独立性/AC/建表时机/starter) | ✅ 符合最佳实践;Critical 0 / Major 0 / Minor 3 | 否 |

**累计违例统计**:🔴 Critical 0 / 🟠 Major 0 / 🟡 Minor 3 / Advisory 1(UX 文档缺)。

### Overall Readiness Status

## ✅ READY

NewSD 规划产物(PRD + 架构 18 AD + spec 13 CAP + epics 6 epic/35 story)经 6 步 IR 校验,**0 阻塞违例**,可进入 Phase 4 实现。

### Critical Issues Requiring Immediate Action

**无**。无 Critical / Major 违例需实现前修复。

### Minor Concerns(非阻塞,建议实现期闭合)

1. **Epic 2 使能 epic 用户价值边界**(step-5):认证 epic 属 borderline,经 ADR-EPIC-2 显式标注使能 epic + 有用户面对成果。维持现状,实现期注意 story 2.2/2.4 的"前瞻条 — 边界声明"是 split 契约,须在消费 story(3.3/5.3)落地时闭合。
2. **Story 1a.1 SQLite WAL 备份原语时机**(step-5):原语置骨架层正确,但完整 backup→restore 端到端验证需 2.1 建表后补(当前仅验原语可用)。建议实现期在 2.1 建表后补一次端到端验证。
3. **UX 文档缺**(step-1/step-4 advisory):无独立 UX 设计文档。epics.md 为基线(prototype 为 pre-epic probe),UX 实质已嵌入 PRD(FR-UI-1~6)/epics(美学亲缘点)/架构(AD-9 Canvas VRAM)/spec(CAP-10/CAP-11)。建议实现期以 ASCII 设计系统 quick-ref 作可选辅助(非阻塞)。
4. **.prettierrc 设置 deferred 到 kickoff**(step-5):intentionally deferred(spine Deferred,非架构不变量)。建议 kickoff 首个 TS/JS PR 前建立,激活 format-on-save 确定性。

### Recommended Next Steps

1. **启动 Phase 4 实现**:按 epic 依赖序 1a → 1b → 2 → 3 → 4 → 5,从 Story 1a.1(应用骨架与无限画布导航)kickoff。kickoff 首个 PR 前建根 `.prettierrc`。
2. **逐 story 实现 + TDD**:每 story 按 Given/When/Then AC 先写测试(F1-quality 受控 rework 标注:1a.7 plain-delete → 4.2 CRDT-delete;1a.7→1a.9 i18n 边界 guard),实现跑通后落 main 走 PR。
3. **降级路径注意**:Story 3.4/3.5/5.3 标"依赖 1b 解锁"——若 1b 延期,3.4/3.5 房主迁移+仿真广播、5.3 sim-trigger 徽章按降级路径后置,不阻塞 Epic 3/5 其余 story 交付。
4. **安全约束实现期校验**(每 story 落地时):client_secret server env / paste no eval / share_token ≥128bit / CRC32 非加密 / viewer op gateway-rejected / badge 服务端判定 / owner transfer HTTP 端点 / no shadowBlur / unlocked_at server now() / award INSERT OR IGNORE。
5. **Minor 闭合跟踪**:实现期在对应 story PR 中闭合上述 4 项 minor concern(2.1 补 backup→restore E2E / 3.3+5.3 闭合 split 契约 / kickoff 建 .prettierrc / 可选建 ASCII 设计 quick-ref)。

### Final Note

本次 IR 识别 **0 阻塞违例 + 3 minor + 1 advisory**(跨 6 step / 5 检查类别)。规划产物就绪度达 Phase 4 实现门槛。可:
- 直接进入实现(推荐),实现期按 Recommended Next Steps 闭合 minor;或
- 选择先补 UX 设计文档(非必需,epics 已为基线)。

---

**Report generated**: `implementation-readiness-report-2026-07-03.md`
**Assessor**: Claude(CC)执行 bmad-check-implementation-readiness skill
**Date**: 2026-07-03
**Verdict**: ✅ READY — 0 blocking issues, proceed to Phase 4 implementation
