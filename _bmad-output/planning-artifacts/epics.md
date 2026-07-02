---
stepsCompleted: [step-01, step-02, step-03]
inputDocuments:
  - prds/prd-NewSD-2026-06-26/prd.md
  - prds/prd-NewSD-2026-06-26/addendum.md
  - architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md
  - ../specs/spec-NewSD/SPEC.md
  - ../specs/spec-NewSD/architecture-diagrams.md
  - ../specs/spec-NewSD/math-constraints.md
  - ../specs/spec-NewSD/stack.md
---

# NewSD - Epic Breakdown

## Overview

本文件提供 NewSD(赛博朋克 ASCII 系统动力学多人协作建模平台 MVP)的完整 epic 与 story 分解。需求来源:PRD(36 FR + NFR)、addendum(工程机制/被拒方案)、架构 spine(18 ADs,status:final)、spec(SPEC.md 13 CAPs + 3 companions)。spec 的 13 个能力域(CAP)是 PRD 36 FR 的精炼归并,作为 epic 分解的核心驱动;spine 18 AD 是已裁定的架构不变量,约束 story 实现取向。

> 语言约定:正文中文,ID 与技术术语保留英文(FR-n / AD-n / CAP-n / CRDT / OAuth / Wasm 等),与 PRD/spine/spec 既成风格一致。

## 架构即内容(产品级美学定位)

NewSD 遵循“形式即内容”(form is content)美学原理 — 与 17 世纪具象诗(乔治·赫伯特《复活节翅膀》文字排成翅膀形状,形状本身强化信仰坠落飞升的诗意)及 20 世纪 ASCII 艺术(字符拼出可辨认图形)的美学亲缘一致。三原理:

1. **形式即内容** — ASCII 字符排列既是建模语言(存量/流量/公式 AST 可读语义)又是视觉图像(系统拓扑可看图形),形状本身强化建模语义(流量箭头 `>>>>>>>` 双义静态/动态两层皆是形式即内容载体:静态层—字符排列成箭矢形状既是流向标注(语义)又是箭矢图形(视觉),排列即图形(1a.4 交付静态排列即满足双义);动态层—行进动画既是流向标注又是动态视觉(对齐 PRD §1.1),Epic 5 第①项强化沉浸)
2. **等宽网格为画布** — 等宽字体终端网格是共同创作画布(类活字印刷铅字网格),图元/连线/公式网格对齐,建模即网格作画
3. **阅读与观看双重性** — 用户可逐字符读公式/存量语义,也可退一步看系统拓扑图形,双重性是核心体验

此定位跨整个产品而非单 epic:Epic 1a ASCII 建模图元(形式即内容)/ Epic 1a VRAM 渲染基座(AD-9 等宽网格画布)/ Epic 5 赛博朋克质感(FR-UI-6 沉浸强化)。由此 VRAM 渲染管线(AD-9)+ 禁 per-glyph shadowBlur(CAP-11)是维护此美学完整性的技术铁律(保等宽网格+字符堆叠视觉不被光栅化模糊破坏,非“技术架构 vs 内容”二分)。PRD §1.1“结构即内容”特点 + “架构即内容”硬约束(交互简洁性门槛 KPI)是此定位的产品层渊源;本段将”架构即内容”从交互硬约束提升为美学原理定位(形式即内容/等宽网格/阅读观看双重性),覆盖建模图元(Epic 1a)/仿真结果(Epic 1b sparkline)/协作(Epic 3)/传输(Epic 4 剪贴板)/质感强化(Epic 5)全链(5 节点亲缘,4 epic desc 点明 + Epic 2 使能层豁免);VRAM 渲染管线(AD-9)+ 禁 per-glyph shadowBlur(CAP-11)是跨 1a+5 的技术铁律非独立节点。使能层(Epic 2 认证)豁免美学定位:认证无独立用户旅程价值(无协作对象时空转),不承担美学亲缘点明(声明层豁免);此豁免非豁免 UI 实现美学(登录页/分享链接实施期仍应赛博朋克化,保美学入口一致);此豁免是”跨整个产品”的显式边界,非声称覆盖全部 epic。亲缘层次与验收:1b sparkline 是视觉形式强亲缘(字符序列=趋势图形,验收代理=FR-SIM-VIZ-1 纯字符锁保等宽网格);3 CRDT AST/4 剪贴板协议是结构形式类比亲缘(数据结构形式,类比视觉形式非等同,结构性体现非需独立美学 AC)。

## Requirements Inventory

### Functional Requirements

> 提取自 PRD §三,按能力域分组(与 spec CAP 域对应)。共 37 条(含 FR-GAME-3 后续非 MVP,列出供后续 epic 规划)。

**画布渲染系统(CAP-1)**

- **FR-CANVAS-1** 无限画布导航:中键拖拽或空格+左键平移;滚轮/双指捏合/缩放控件缩放;minZoom=0.05,maxZoom=20;Float64 世界坐标系 + 3×2 仿射投影矩阵。
- **FR-CANVAS-2** 网格吸附对齐:1 世界单位 = 1 字符格;屏幕空间吸附容差恒 8px(`snapTolerance = 8 / currentZoom`,换算回屏幕恒 8px);网格步长可配。
- **FR-CANVAS-3** ASCII 字符渲染:等宽字体(Courier New 等效);3 类图元——源/汇 cloud(`.--.`/`(    )`/`` '--' ``)、存量 stock(方框 `┌┐└┘─│`)、流量 flow 箭头 `→`(可变 `▼`/常数 `○` 变体);▼/○ 为 flow 渲染变体非独立图元;反馈回路为涌现结果非独立标记;文本标签对齐字符网格。
- **FR-CANVAS-4** 空间索引与视口剔除:R 树空间索引;每帧仅查询绘制与视口相交元素;脏矩形追踪仅重绘变化区域;目标 10000 图元 ≥ 30 FPS。
- **FR-CANVAS-5** 小地图(MVP):角落常驻缩略图,低精度采样投影全部图元;高亮框指示当前视口;点击/拖拽跳转主视口;采样粒度与更新频率架构期定,须与脏矩形(FR-CANVAS-4)联动增量更新,避免 10000 图元全量重绘。

**模型图元系统(CAP-1/CAP-2)**

- **FR-ELEM-1** 存量元素:属性 id(UUIDv4)/type:"stock"/x,y/width,height/name/initialValue/units/currentValue(运行时不持久化)/allowNegative(默认 false);ASCII 方框居中显示 name+currentValue+units,仿真未运行显 initialValue,无 units 仅显数值;交互:拖拽移动/调整大小/点击选中/双击编辑。
- **FR-ELEM-2** 源/汇元素:属性 id/type:"cloud"/x,y/name(可选);ASCII 云朵图案;边界元素无限容量;源/汇语义由 flow 方向涌现(cloud 作 flow fromId 为源、作 toId 为汇),不设独立极性字段。
- **FR-ELEM-3** 流量连接器:属性 id/type:"flow"/fromId/toId/formula(支持 `数值 [单位]` 标注)/units(自动派生为目标存量 units/时间单位,只读)/isVariable(true `▼`/false `○`);方向由 fromId→toId 表达,不设极性字段;公式以 `@<uuid>` 引用存量(stockId),编辑器显 name,重命名只改 name 不动 id;Bresenham 网格寻路 + 端点箭头 + 端口吸附;重名软警告(允许同名,量纲推导以 id 解析)。
- **FR-ELEM-4** 连接端口:每元素周边预定义连接点;创建连线自动吸附端口;拖拽元素端口位置随更新。

**模拟引擎系统(CAP-3/CAP-4)**

- **FR-SIM-1** 数值求解器:隐式求解器(后向欧拉/BDF),每步牛顿迭代收敛,适用刚性系统;模型级时间单位(年/月/日/时/分/秒);dt 可配(默认 0.1);雅可比由 AST 自动微分(与 FR-SIM-7 量纲 AST 复用),每步含 LU 分解线性求解 + 收敛判定;播放/暂停/单步/重置;仅房主运行模拟。
- **FR-SIM-2** 存量断路器(代数环检测):编译期构建依赖有向图 → 移除所有存量流出边 → 残余图有环则检测到代数环,高亮+弹窗拒绝运行;无环则交隐式求解器联立求解;隐式法下仍严格剪边,代数环一律拒绝不因隐式可解放行。
- **FR-SIM-3** 流量守恒原则:单收敛值——每步收敛后每流量产单一一致速率,所有连接该流量的存量引用同一收敛速率;防止浮点漂移与物质凭空产生/消失;约束作用于收敛结果非牛顿迭代过程。
- **FR-SIM-4** 非负钳制机制:allowNegative=false 的存量,在牛顿迭代中施加 stock≥0 约束(投影到可行域),钳制后实际流出速率不超使存量恰归零的速率;级联重算,雅可比体现活动约束方程结构变化;绝不幽灵渗漏。**禁止后置钳制 `if(nv<0) nv=0`**(违 FR-SIM-3 物质守恒),prototype 现实现须重写为速率级钳制。
- **FR-SIM-5** DELAY 函数:不作历史队列,编译期转为串联隐式存量(如 `DELAY3(X,6.0)` 插入 3 个串联一阶微分方程),纳入统一联立求解保连续性。
- **FR-SIM-6** 数值溢出熔断:任一存量绝对值 > max(所有存量初始绝对值)×1e6,或 NaN/Inf,或相邻步相对变化率 >1e3,则自动暂停;阈值 MVP 默认可调(含调参引导);ASCII 弹窗 `[SYSTEM HALTED: NUMERICAL OVERFLOW AT t=<time>s]`。
- **FR-SIM-7** 量纲一致性校验(MVP):编译期对每流量公式遍历 AST 逐子表达式推导单位,比对目标单位(目标存量 units/时间单位);一致通过,不一致软警告(红色高亮+预期/推导单位,不阻断运行);常数单位标注参与推导;无 units 视无量纲;校验在公式编辑时实时进行(FR-UI-2 扩展)。
- **FR-SIM-8** 求解器自适应降级+一键简化(MVP):BDF 步进内嵌收敛监控,步长崩溃/残差超阈自动降级后向欧拉→显式试探步;一级状态层(用户无感):sparkline 旁黄点闪烁+状态栏"求解器自适应调节中",不弹窗不暂停;二级一键(罕见):降级链仍失败弹单按钮"简化模型以继续",点击自动执行预设降级组合续跑,无第二按钮无参数面板。与 FR-SIM-6(数值域熔断)、§5.1 逃生阀(MVP 体量超载)边界不混淆。

**仿真结果呈现(CAP-5)**

- **FR-SIM-VIZ-1** 内联 ASCII 趋势可视化(MVP):每存量方框旁实时 ASCII sparkline(`▁▂▃▄▅▆▇█`,默认保留近 N=32 步,与 dt 解耦);存量方框同步显示 currentValue+units(不归一化),仿真未运行显 initialValue,无 units 仅显数值;量纲识读反馈在状态栏概要;纯字符渲染不引图表库;完整多存量时序面板(L3)后续不含 MVP。

**实时协作系统(CAP-6/CAP-7)**

- **FR-COLLAB-1** CRDT 文档模型:Yjs;`Y.Map("elements")`(id→JSON 状态),流量 formula 以结构化 AST 存储(`Y.Map` 嵌套,引用节点存 stockId)非扁平字符串;`Y.Array("elementOrder")` Z 轴排序;`Y.Map("boardMetadata")` 看板名/设置/所有者;服务端 SQLite 存快照+追加式操作日志(单节点 10 人认证规模)。
- **FR-COLLAB-2** 存在感知协议:非持久化独立通道传光标位置{x,y}/选区{elementIds,anchor,head}/用户信息{id,name,color}/心跳;广播最大 30Hz 节流;视口剔除仅绘可见区光标。
- **FR-COLLAB-3** 房主迁移机制:第一个用户为房主运行模拟;房主断开心跳丢失→先申请者当选新房主→从服务端仿真态快照(FR-COLLAB-5)续跑不回退 t=0→广播 `SIMULATION RESUMED`。反指标:房主迁移仿真清零=0。
- **FR-COLLAB-4** 模拟状态广播:独立二进制通道(不混 CRDT);`[stockId<string>, currentValue<float64>]` 数组;≤30Hz 变化检测节流;隐式求解器每步收敛后整步结果(非子迭代中间值);客户端接收渲染不回写 CRDT;currentValue 会话级临时态经 FR-COLLAB-5 快照供房主迁移。
- **FR-COLLAB-5** 房间仿真态快照:房主周期性上报 `{simulationTime, stockValues, paused, dt}`;服务端进程内存持有最新快照(不落 SQLite,会话结束丢弃);房主迁移新房主从服务端拉取续跑;会话级临时态不跨会话持久化。
- **FR-COLLAB-6** 公式语义感知合并:流量公式结构化 AST 存 CRDT,并发编辑不同 AST 子节点按节点级 CRDT 合并避免文本冲突破坏语义;AST↔文本双向同步(编辑器实时解析文本→AST 写 CRDT,CRDT→文本序列化);不完整语法以待定节点承载不阻断输入;合并后做语法+量纲校验(FR-SIM-7),AST 始终可解析。

**多画板与剪贴板(CAP-8)**

- **FR-BOARD-1** 标签页界面:每客户端最多同时开 5 画板;超限提示+"关闭不活跃"对话框;最近画板列表(最多 10 项);切换画板暂停/恢复 Y.Doc 同步。
- **FR-BOARD-2** 跨画板复制粘贴:剪贴板 Base64+JSON + `SD_ASCII_ENGINE://` 协议头 + CRC32;粘贴流程:校验协议头→CRC32 完整性→结构白名单校验(字段类型合法/UUIDv4/fromId-toId 引用存在于 payload/无未知字段,任一不合规拒绝)→分配新 UUID→重映射连接→位置偏移(x+2,y+2)→插入空间索引;原子事务单 CRDT 操作;安全边界:不经 eval,防畸形结构非密码学认证。反指标:剪贴板畸形图元注入=0。
- **FR-BOARD-3** 外部文件阻断:拖放文件阻止所有类型默认行为;外部粘贴仅接受有效协议前缀纯文本;图片/二进制静默拒绝。

**撤销/重做(CAP-9)**

- **FR-HISTORY-1** 画板独立撤销栈:每画板独立 Y.UndoManager;粘贴视为单一原子事务;撤销粒度用户操作级(非按键级);栈限 100 步。

**用户界面(CAP-10/CAP-11)**

- **FR-UI-1** 顶部工具栏:文件(新建/打开/保存)+编辑(撤销/重做/复制/粘贴/删除)+工具切换(选择/存量/源汇/流量)+模拟控制(暂停/播放/重置/单步)+dt 选择器[0.01,0.1,0.5,1.0]+缩放指示器+滑块。
- **FR-UI-2** 右侧属性面板:显示选中元素属性;存量(名称/初始值/单位/允许负值复选框)+流量(公式编辑器支持常数单位标注/可变常数切换/派生流量单位只读);实时校验:公式语法错误红色高亮+量纲不一致软警告(FR-SIM-7)。
- **FR-UI-3** 底部状态栏:模拟时间计数器+图元计数+在线用户数+头像堆栈+FPS(Debug)+连接状态+量纲校验概要(L2 渐显,如 `量纲:3/5 一致·2 软警告`,点击展开不一致流量清单)。
- **FR-UI-4** 界面语言(中/英双语可切换):运行时切换即时生效无需刷新;入口设置面板,选择持久化 localStorage;切换范围工具栏/属性面板/状态栏/弹窗/提示;不切换用户输入的 name/公式/ASCII 图元字符画;默认跟随 navigator.language 无匹配回退 English。
- **FR-UI-5** 模型设置:模型级配置项——时间单位(年/月/日/时/分/秒单选,作量纲校验与 dt 计量基准)+默认 dt(与 FR-SIM-1 联动);修改时间单位触发全模型量纲重校验(FR-SIM-7)。
- **FR-UI-6** 交互质感层(赛博朋克沉浸反馈):硬 FR 8 项 MVP 渲染——(1)流量流动 `>>>>>>>` 行进动画(2)方波合成 blip 音频(3)徽章碎裂粒子 ASCII 弹片(4)数值 glitch 解码动画(5)LVL UP 大字 overlay(6)呼吸辉光(dt 按钮高亮)(7)ASCII 风格控件(色相循环按钮/下拉菜单带 `>` 闪烁/徽章四角扫描器)(8)输入火花;视渲染裁决 2 项——(9)CRT 背景漂移(10)per-glyph 霓虹辉光,经 AD-9 VRAM 图集路径复刻,验收口径目视不可区分(图集辉光须与 prototype per-glyph shadowBlur 目视无差异,达不到不得回退 shadowBlur 违 AD-9)。

**游戏化(CAP-12)**

- **FR-GAME-1** 游戏化总开关:用户设置中开/关游戏化层,默认状态待 UI 细化;关闭后徽章不显示不触发,不影响建模与协作核心。
- **FR-GAME-2** 行为徽章系统(MVP):基于建模动作触发(不依赖仿真结果质量);内置触发器——首个存量/首次连流量/首次跑仿真/连 10 图元/完成首模型(≥1 存量+≥1 流量并成功跑一次仿真);ASCII 图标+即时 toast 霓虹动效;徽章记录绑账号跨设备持久化(AD-16)。
- **FR-GAME-3** 挑战关卡(后续,紧随 MVP 第一优先项,非 MVP):内置少量预设挑战场景(人口模型/库存振荡),每关提供起始模型+达标条件;达标判定依赖仿真结果数值比对引擎(后续);MVP 不含。

### NonFunctional Requirements

> 提取自 PRD §四。NFR 编号为本分解新增(PRD 未编号),便于 epic/story 引用。

**性能(PRD §4.1)**

- **NFR-PERF-1** 1000 图元画布帧率 ≥ 60 FPS。
- **NFR-PERF-2** 10000 图元画布帧率 ≥ 30 FPS。
- **NFR-PERF-3** 协作延迟 P95 ≤ 100ms。
- **NFR-PERF-4** 1000 图元画板加载时间 ≤ 2 秒。
- **NFR-PERF-5** 1000 图元内存占用 ≤ 50 MB。
- **NFR-PERF-6** 模拟运算速度 100 存量 ≥ 100 步/秒(PRD §1.4)。
- **NFR-PERF-7** 多客户端间模拟数值偏差 < 0.001%(PRD §1.4)。

**可靠性(PRD §4.2)**

- **NFR-REL-1** 协作服务可用性 99.9%。
- **NFR-REL-2** 服务器重启无数据丢失(持久化快照)。
- **NFR-REL-3** 自动重连 + 操作重放。

**安全性(PRD §4.3,AD-16/17)**

- **NFR-SEC-1** 剪贴板协议校验:拒绝所有畸形 payload(完整性 + 结构白名单,见 FR-BOARD-2)。
- **NFR-SEC-2** 公式求值禁用 eval():仅 Rust/Wasm 表达式解析器。
- **NFR-SEC-3** CORS 保护(HTTP 接口)。
- **NFR-SEC-4** WebSocket 握手首帧 token 鉴权 + Origin 头校验(AD-16);OAuth GitHub+Google 认证,session token 双通道(HttpOnly Secure Cookie + JSON body),SameSite=Lax 防 CSRF。
- **NFR-SEC-5** WebSocket 连接速率限制。

**兼容性(PRD §4.4)**

- **NFR-COMPAT-1** 浏览器:Chrome/Firefox/Safari(最新两版本)。
- **NFR-COMPAT-2** MVP 阶段不支持移动端。
- **NFR-COMPAT-3** 国际化:界面文本中/英双语可切换(FR-UI-4);i18n 框架为后续扩展语言预留。
- **NFR-COMPAT-4** 浏览器须支持 WebAssembly.Memory 64MB 上限 + WebGL 片段着色器(AD-5/AD-9 硬约束)。

**产品成功指标(PRD §1.4,作验收基准)**

- **NFR-SUCCESS-1** 首次建模时间(新手上路)≤ 5 分钟。
- **NFR-SUCCESS-2** 单会话模型迭代次数中位数 ≥ 3 次。
- **NFR-SUCCESS-3** 行为徽章首次会话解锁 ≥1 枚用户占比 ≥ 60%。
- **NFR-SUCCESS-4** 模型保存/加载失败率 < 0.1%。
- **NFR-SUCCESS-5** 反指标:剪贴板畸形图元注入 = 0;房主迁移仿真清零 = 0(live migration scope:房主断开且他人在线时新房主从快照续跑不回退 t=0;不含全员断线 cold restart,见 Story 3.5 B12)。

### Additional Requirements

> 提取自架构 spine(18 ADs,status:final)与 stack.md。这些是已裁定的架构不变量,约束 story 实现取向。spine 的 AD-1..AD-18 逐条 Rule 见 `ARCHITECTURE-SPINE.md`,此处列影响 epic/story 创建的要点。

**Starter Template & 项目骨架(影响 Epic 1a Story 1)**

- 项目为 **greenfield-new** + 沿用 prototype 客户端栈(brownfield)。spine Structural Seed 给出 Minimal Source Tree:`src/lib/{sd,render,collab,solver}` + `wasm/src`(Rust)+ `server/main.go` + `package.json` + `Dockerfile` + `.github/workflows/`。
- **brownfield 客户端栈**(沿用 prototype):React ^19.2.0 / TanStack Start ^1.168 / TanStack Router ^1.170 / Vite ^8.0.16 / Tailwind v4 / TypeScript ^5.8.3 / bun。
- **greenfield-new 栈**:Rust stable + wasm-pack / faer 0.24.4(LU 线性求解)/ autodiff 0.7.0(雅可比)/ Go stable(单体后端)/ yjs-go(averyyan/yjs-go,实现期 pin)/ SQLite 3.x WAL。
- prototype 现有 `src/lib/sd/formula.ts` 的 `evalFormula`(纯 TS 递归下降)仅留作非仿真场景(UI 实时预览/量纲预览),仿真路径须替换为 Wasm 内核调用(AD-5)。
- 实现 kickoff 首个 TS/JS 代码落 main 前建根 `.prettierrc` 使 format-on-save 确定性激活(继承 prototype eslint-plugin-prettier 隐式默认)(spine Deferred,非架构不变量)。

**四范式顶层不变量(AD-1)**

- Host-Authoritative Simulation(仿真仅房主客户端跑,服务端中继不计算)/ CRDT Document Model(Yjs)/ Wasm Numeric Core(所有仿真步数值经 Rust+Wasm)/ Canvas 2D Fixed-Point Render(VRAM 双缓冲,禁 per-glyph shadowBlur)。子系统不得违背。

**单节点云托管部署(AD-2/AD-18)**

- MVP 单节点单 Go 二进制 + SQLite WAL;部署目标 = 云托管单节点(Fly.io/Railway/Render/云 VM,实现期选);Dockerfile 多阶段构建(Rust→wasm-pack + Go build + 前端 dist,单镜像)+ GitHub Actions CI/CD(lint→test→build→deploy,main 合并触发);域名 + Let's Encrypt TLS 自动;SQLite 持久卷挂载(平台不支持则提前触发 addendum §3.2 PG 迁移);密钥走云平台 secret env;可观测走云平台内置(熔断事件经 WS 上报服务端写 stdout);垂直扩容优先,水平迁移(PG/Redis/多节点 WS 网关)走 addendum §3.2 阈值触发非 MVP。

**后端中继(AD-3/AD-4)**

- 后端单 Go 进程不引入 Node 服务;CRDT 中继用 yjs-go(averyyan/yjs-go,reputation Medium,实现期首验 sync protocol,遇阻回评自研非退 Node);进程内存持 Presence + 仿真态快照;SQLite 存 CRDT 快照 + 操作日志(单文件服务进程内)。

**Wasm 求解器内核边界(AD-5/AD-6/AD-7/AD-8)**

- 所有仿真步数值求值经 Wasm,TS 不得直接跑仿真步;编译期拓扑检查切 stock 流出边后检测残余环拒绝代数环(FR-SIM-2),不因隐式可解放行。
- 熔断(资源耗尽:Wasm.Memory 64MB / 单步 wall-clock >500ms / AST >5000 节点编译期 / 牛顿 >100 迭代仍不收敛)→ `[SYSTEM HALTED]` 暂停;降级(残差非收敛)→ FR-SIM-8 降级链(不阻断)。两者不混淆。
- crate 组合:手写递归下降 parser(复用 prototype formula.ts 结构扩 `@uuid`/`[单位]` 产生式)+ autodiff crate 0.7.0 + faer 0.24.4 LU;mexpr/meval 已弃用(不存在 crates.io);AST 为单一真相源供 autodiff 图/量纲校验/tokenizer 共用。
- BDF-1~2 不上 BDF-3+,按阶数状态机起步 + 牛顿初始猜测按阶数分配外推法;雅可比约束激活后全重算(非 Broyden)+ 滞回带防 Chattering。

**渲染(AD-9)**

- VRAM 双缓冲(字符码缓冲 + 颜色索引缓冲)+ 辉光图集(离屏预渲染每 ASCII 字符 × 亮度档)+ 色相偏移 GPU 片段着色器(nearest 采样保像素风);禁 per-glyph shadowBlur。FR-UI-6 第 9/10 项(CRT 漂移+per-glyph 辉光)经此路径复刻,验收目视不可区分。

**CRDT 协作(AD-10/AD-11/AD-12/AD-13/AD-14/AD-15)**

- AST 冲突分级回退:合并后拓扑比较检测,轻冲突(括号改结合性/运算符替换局部)标区+锁子树,重冲突(删子树幽灵编辑)回退文本级 CRDT 降级;阈值判定"运算符语义改变或幽灵引用=重"。
- 快照-CRDT 版本对齐:快照附 clientID+clock 向量,新房主校验对齐→续跑/不对齐→增量重跑,不阻塞 CRDT。保反指标房主迁移仿真清零=0。
- 降级接口抽象:MVP 须定义三项抽象接口(数据兼容层支持 Y.Map AST 与 flat string 两种公式格式/编辑器抽象/校验管道抽象)隔离降级两端且非空,降级逻辑本身可不实现但接口契约须可验证。
- 待定节点 `{type:'pending', rawText:Y.Text, cursorHint:number|null}` 并发输入合并不丢字;paren 作 AST 外旁路 Y.Array of maps 按 nid(UUIDv4)引用,非 AST 内 group 节点;nid 单调递增计数器非 hash,子树重建旧 nid 保留语义。
- 非房主订阅非计算:非房主客户端权威仿真显示态由房主广播驱动(订阅非计算),本地 Wasm 仅限非仿真预览(量纲/视觉)。

**认证与权限(AD-16/AD-17)**

- OAuth 直连 GitHub+Google(零费用,不经 Auth0/Clerk),双 provider 共享 users 表 UNIQUE(oauth_provider, oauth_user_id);session token(非 JWT)双通道下发——HttpOnly Secure Cookie + JSON body(解 JS 不可读 cookie 致 WS 首帧 token 矛盾);Go 内存 + SQLite session 表持久化(进程重启会话不丢);WS 握手首帧 token 鉴权(token 仅存 JS 内存,Origin 头 defense-in-depth);SameSite=Lax 防 HTTP CSRF;client_secret 走 server env 不入前端 bundle;MVP 不含自托管账号密码。
- 三角色 owner(全部+删+转让+改权限)/editor(编辑 CRDT)/viewer(只读订阅,CRDT op 网关拒收非客户端自检);owner 转让与角色修改走认证 HTTP 端点(非 CRDT,防 editor 伪造提权);权限变更经 `role_change` WS frame 传播(drain 待处理 op 保原子性);share_token crypto/rand ≥128 bits + URL-safe base64 + owner 可轮换 + Referrer-Policy no-referrer;CRDT 持久化表按 board_id 分区;徽章触发由服务端从 CRDT op 流判定(防客户端伪造解锁);`[SYSTEM HALTED]` 熔断事件经 WS 上报服务端写 stdout。

**监控与可观测**

- 无独立可观测栈产品(MVP),走云平台内置日志/监控;客户端 `[SYSTEM HALTED]` 熔断事件(AD-5)经 WS 上报服务端写 stdout 供云日志捕获(AD-16/AD-18)。

**API 与数据契约**

- WS 协议:握手首帧 token 鉴权 + `role_change` frame + 仿真态广播 `[stockId, currentValue]` 数组 + 存在感知(光标/选区/用户信息);CRDT op 走 yjs-go relay;OAuth callback HTTP 端点 + owner 转让/角色修改认证 HTTP 端点。
- 数据库 schema(spine ERD):users(id, username, oauth_provider, oauth_user_id, created_at)/ sessions(token, user_id, expires_at)/ boards(id, owner_user_id, share_token, last_opened_at)/ user_badges(user_id, badge_id, unlocked_at)/ CRDTSnapshot(board_id, versionVector, simulationTime, docState)/ OpLog(board_id, opData, timestamp)【SQLite 持久化,按 board_id 分区(AD-17)】;PresenceSnapshot(board_id, hostClientId, simState, capturedAt)【进程内存态按 board_id 键,不落 SQLite,会话结束丢弃,FR-COLLAB-5】。

**实现期标定(defer 项,非 epic 阻断但须显式列)**

- F5-perf(雅可比全重算+稀疏 LU 能否 100 存量达 100 步/秒)/ F1-quality(图集辉光 vs shadowBlur 目视对比)/ F6-threshold(AST 冲突轻/重分级阈值)/ F7-snapshot-freq(快照上报频率)/ F15-op-quota(editor op/s 配额 + Awareness 限制 + 房间容量硬限 10 人 + stockId/delete 存在性验证)/ F16-restart-recovery(服务端重启会话恢复协议)/ F17-host-migration-trigger(房主迁移触发判定)/ F18-sqlite-backup(已提升至 Story 1a.1 MVP 验收,B1 决策)/ FR-SIM-8-convergence-params(降级收敛监控阈值)。详见 SPEC.md Open Questions,各 story 处理。

### UX Design Requirements

- **无独立 UX 设计契约**(无 `ux-designs/` 目录)。赛博朋克 ASCII 视觉规范与交互模式已内化于 PRD(§1.1 产品愿景/§1.3 默认可见性规约/§3.7 用户界面)与 spec(CAP-10 界面 chrome/CAP-11 交互质感层)。交互质感 10 项见 FR-UI-6,视觉层级(L1/L2/L3 成熟度可见性)见 PRD §1.3。如实现期需独立 UX 详化,作为 epic/story 内的任务产出,不作为前置输入文档。

### FR Coverage Map

> 37 FR(36 MVP + FR-GAME-3 后续)全覆盖核验。FR-COLLAB-1 / FR-GAME-2 跨 epic split(CRDT 文档模型/徽章触发主体归功能 epic,owner 归属/绑账号子句归 Epic 2,与 AD-10/AD-17 不同 AD 对应);step-03 拆 story 时各出两个 story 分属两 epic。

```
FR-CANVAS-1: Epic 1a - 无限画布导航(平移/缩放/Float64 世界坐标)
FR-CANVAS-2: Epic 1a - 网格吸附对齐(1 世界单位=1 字符格,8px 屏幕容差)
FR-CANVAS-3: Epic 1a - ASCII 字符渲染(存量方框/源汇 cloud/流量箭头)
FR-CANVAS-4: Epic 1a - 空间索引(R 树)与视口剔除+脏矩形
FR-CANVAS-5: Epic 1a - 小地图(角落缩略图,增量更新)
FR-ELEM-1: Epic 1a - 存量元素(stock 属性+方框渲染+交互)
FR-ELEM-2: Epic 1a - 源/汇元素(cloud,语义由 flow 方向涌现)
FR-ELEM-3: Epic 1a - 流量连接器(flow,@uuid 引用+Bresenham 寻路+端口吸附)
FR-ELEM-4: Epic 1a - 连接端口(预定义连接点+自动吸附)
FR-SIM-1: Epic 1b - 数值求解器(隐式 BDF+牛顿+autodiff+LU,Wasm 内核)
FR-SIM-2: Epic 1b - 存量断路器(代数环检测,严格剪边)
FR-SIM-3: Epic 1b - 流量守恒(单收敛值,防浮点漂移)
FR-SIM-4: Epic 1b - 非负钳制(速率级投影/活动集,禁后置钳制)
FR-SIM-5: Epic 1b - DELAY 函数(编译期转串联隐式存量)
FR-SIM-6: Epic 1b - 数值溢出熔断([SYSTEM HALTED] 暂停)
FR-SIM-7: Epic 1b - 量纲一致性校验(AST 推导,软警告不阻断)
FR-SIM-8: Epic 1b - 求解器自适应降级+一键简化(BDF→后向欧拉→显式试探步)
FR-SIM-VIZ-1: Epic 1b - 内联 ASCII sparkline(每存量旁近 N=32 步)
FR-UI-1: Epic 1a - 顶部工具栏(文件/编辑/工具/模拟控制/dt/缩放)
FR-UI-2: Epic 1a - 右侧属性面板(存量/流量属性+实时校验)
FR-UI-3: Epic 1a - 底部状态栏(时间/图元数/在线/FPS/量纲概要)
FR-UI-4: Epic 1a - 界面语言(中/英双语运行时切换)
FR-UI-5: Epic 1a - 模型设置(时间单位+默认 dt+量纲重校验)
FR-COLLAB-1: Epic 3(CRDT 文档模型主体 Yjs AST)+ Epic 2(owner 归属子句 boardMetadata/owner_user_id)[split,AD-10/AD-17]
FR-COLLAB-2: Epic 3 - 存在感知协议(光标/选区/用户信息,30Hz 节流)
FR-COLLAB-3: Epic 3 - 房主迁移机制(心跳丢失→当选→快照续跑不回退)
FR-COLLAB-4: Epic 3 - 模拟状态广播(独立二进制通道,整步收敛值)
FR-COLLAB-5: Epic 3 - 房间仿真态快照(进程内存,会话级不持久化)
FR-COLLAB-6: Epic 3 - 公式语义感知合并(AST 节点级合并+分级回退)
FR-BOARD-1: Epic 4 - 标签页界面(≤5 画板+最近列表)
FR-BOARD-2: Epic 4 - 跨画板复制粘贴(协议头+CRC32+结构白名单+原子事务方案 C)
FR-BOARD-3: Epic 4 - 外部文件阻断(拖放/粘贴仅接受协议前缀)
FR-HISTORY-1: Epic 4 - 画板独立撤销栈(用户操作级粒度,100 步,统一删除 RI 规则)
FR-UI-6: Epic 5 - 交互质感层(10 项:流量动画/blip/粒子/glitch/LVL UP/呼吸辉光/ASCII 控件/输入火花/CRT 漂移/per-glyph 辉光)
FR-GAME-1: Epic 5 - 游戏化总开关(开/关,关后徽章不显示)
FR-GAME-2: Epic 5(徽章系统主体,触发器+toast+服务端判定)+ Epic 2(绑账号跨设备持久化子句)[split,AD-16]
FR-GAME-3: 后续(非 MVP)- 挑战关卡(预设场景+达标判定,依赖仿真结果比对引擎)
```

**全覆盖核验**:14(Epic 1a)+ 9(Epic 1b)+ 6(Epic 3,含 FR-COLLAB-1 split 主体)+ 4(Epic 4)+ 3(Epic 5)+ 1(后续 FR-GAME-3)= 37 = inventory 37(36 MVP + 1 后续),每 FR 恰一处映射(split 标注的 FR-COLLAB-1/FR-GAME-2 主体归功能 epic,子句归 Epic 2 支撑,无重复计数)。零遗漏零重复。依赖序无环:1a→1b→2→3→4→5(Epic 4 依 Epic 3.1 Yjs:FR-BOARD-1 标签页切换暂停 Y.Doc 同步、FR-BOARD-2 剪贴板单 CRDT op 原子事务、FR-HISTORY-1 Y.UndoManager 均依 3.1,1a.3/1a.4 用 plain properties 无 Yjs,非 3/4 并行;Epic 5 依 1a+1b+2+3)。

## Epic List

> 设计原则(step-02):用户价值导向非技术层;spine+spec+PRD 全 finalized → 方向确定性高 → fewer but larger epics;最高风险子系统经高级引导压测后拆分隔离——Epic 1a 建模+渲染(prototype 有雏形低风险,首 story F1-quality spike 早暴露辉光风险,建模价值不被 Wasm 阻塞)+ Epic 1b Wasm 求解器(F5-perf 高风险集中隔离);每 epic 独立可交付,无环依赖(1a→1b→2→3/4→5;Epic 2 使能 epic 例外—独立可交付指其使能层可独立实施非独立用户价值交付,见 ADR-EPIC-2)。部署(AD-18)/Wasm 求解器内核(AD-5/6/7/8)无独立用户价值,并入相关 epic 的 story 非单列技术层 epic(step-02 反例规避)。

### Epic 1a: 建模与渲染核心

用户能启动应用、在无限画布上创建存量/源汇/流量图元与公式、配置量纲与时间单位、用属性面板编辑公式并看实时量纲校验,但点"运行"尚无仿真结果(可建模不可仿真阶段,中间价值里程碑使 Epic 1a 非原子巨石先行交付价值)。单人建模闭环,不依赖协作与求解器。含项目骨架(brownfield 客户端 React/TanStack 栈沿用 prototype)+ VRAM 渲染基座(AD-9,双缓冲+辉光图集+色相偏移 Shader,从开始即 VRAM 非 shadowBlur)+ 基础部署骨架(AD-18 单节点云托管 Dockerfile+CI/CD,Epic 收尾 story"应用可被访问"承接部署价值)。实现要点:**首 story 做 F1-quality spike**(图集辉光 vs shadowBlur 目视原型,早暴露 F1-quality 风险,风险经 VRAM 基座传导至 Epic 5 第 9/10 项,达不达验收口径早知);prototype 客户端栈有雏形低风险,建模价值不被 Epic 1b Wasm 高风险阻塞。**删除能力**:1a.7 删除按钮激活 plain properties 本地删除(单人无 CRDT);4.2 升级为 CRDT 事务删除+统一 RI 规则(级联/dangling,受控 rework,类 1a.7→1a.9 i18n 抽 key)— 确保 1a 单人建模闭环可用(无删除则闭环不成立,AR-1)。

**FRs covered:** FR-CANVAS-1, FR-CANVAS-2, FR-CANVAS-3, FR-CANVAS-4, FR-CANVAS-5, FR-ELEM-1, FR-ELEM-2, FR-ELEM-3, FR-ELEM-4, FR-UI-1, FR-UI-2, FR-UI-3, FR-UI-4, FR-UI-5(共 14)

#### Story 1a.1: 应用骨架与无限画布导航

As a 单人建模者,
I want 启动应用并在无限画布上平移与缩放,
So that 我能在超大世界坐标系下定位建模区域。

**Acceptance Criteria:**

**Given** 应用部署到云托管单节点(AD-18)
**When** 用户通过浏览器访问应用 URL
**Then** 应用加载并显示空白无限画布
**And** Dockerfile 多阶段构建含 Go build + 前端 dist 两阶段,Rust→wasm 阶段以占位注释 `# TODO 1b.1: Rust→wasm-pack 阶段` 预留(1b.1 补)
**And** GitHub Actions CI/CD(lint→test→build→deploy)在 main 合并时触发部署
**And** 画布以 Float64 世界坐标系为底,中键拖拽或空格+左键平移视图
**And** 滚轮/双指捏合/缩放控件缩放,minZoom=0.05,maxZoom=20
**And** 3×2 仿射投影矩阵将世界坐标映射到屏幕坐标
**And** SQLite WAL 定时备份(整库 cp 到第二路径/卷,AD-18 单节点数据持久化),备份恢复可验证(恢复测试:F18-sqlite-backup 从 defer 提升为 MVP 验收,B1 决策:单节点无备份=数据永久丢失,MVP 级风险;备份治全丢不治定点回滚,A3 见 PRD 后续候选)

#### Story 1a.2: VRAM 渲染基座与 F1-quality spike

As a 单人建模者,
I want 画布以 VRAM 双缓冲+辉光图集渲染 ASCII 字符,
So that 渲染从开始即走 VRAM 路径(AD-9)非 shadowBlur,且早验证图集辉光可达目视不可区分。

**Acceptance Criteria(基座段 — 交付物):**

**Given** 1a.1 画布导航就绪
**When** 实现渲染层
**Then** 采用 VRAM 双缓冲(字符码缓冲 + 颜色索引缓冲)
**And** 离屏预渲染辉光图集(每 ASCII 字符 × 亮度档)
**And** 色相偏移 GPU 片段着色器使用 nearest 采样保像素风
**And** 禁用 per-glyph shadowBlur(AD-9)
**And** 本 story 交付 VRAM 渲染基座(AD-9),FR-CANVAS-3 图元渲染(存量方框/cloud/流量箭头)在 1a.3/1a.4 衔接落地

**Acceptance Criteria(spike 段 — 验证性子任务):**

**Given** VRAM 渲染基座就绪
**When** 制作图集辉光与 prototype per-glyph shadowBlur 的目视对比原型
**Then** 产出可行性结论记录(可达目视不可区分 / 不可达),记录写入 story 备注
**And** spike 段以"结论记录产出"为完成判据,不论结论正负
**And** 若结论为不可达,标记触发 Epic 5 第 9/10 项逃生阀(可 deferred,见 Decision Log ADR-EPIC-1)

#### Story 1a.3: 网格吸附与存量/源汇图元

As a 单人建模者,
I want 在画布上放置存量/源汇图元并对齐网格,
So that 构建系统动力学模型的基础图元。

**Acceptance Criteria(网格子段):**

**Given** 1a.2 渲染基座就绪
**When** 实现网格吸附
**Then** 1 世界单位 = 1 字符格
**And** 屏幕空间吸附容差恒 8px(`snapTolerance = 8 / currentZoom`,换算回屏幕恒 8px)
**And** 网格步长可配

**Acceptance Criteria(存量子段):**

**When** 用户创建存量(stock)
**Then** 显示 ASCII 方框(┌┐└┘─│)居中显示 name+currentValue+units
**And** 属性含 id(UUIDv4)/type:"stock"/x,y/width,height/name/initialValue/units/currentValue(运行时不持久化)/allowNegative(默认 false)
**And** 仿真未运行显 initialValue,无 units 仅显数值
**And** 交互:拖拽移动/调整大小/点击选中/双击编辑

**Acceptance Criteria(源汇子段):**

**When** 用户创建源/汇(cloud)
**Then** 显示 ASCII 云朵图案(`.--.`/`(    )`/`'--'`)
**And** 属性含 id/type:"cloud"/x,y/name(可选)
**And** 边界元素无限容量,源/汇语义由 flow 方向涌现(1a.4)

#### Story 1a.4: 流量连接器与端口吸附

As a 单人建模者,
I want 在存量/源汇间连流量并自动吸附端口,
So that 表达图元间的物质/信息流。

**Acceptance Criteria:**

**Given** 1a.3 存量/源汇图元存在
**When** 用户创建流量(flow)
**Then** flow 属性含 id/type:"flow"/fromId/toId/formula(支持 `数值 [单位]` 标注)/units(自动派生为目标存量 units/时间单位,只读)/isVariable(true `▼`/false `○`)
**And** 方向由 fromId→toId 表达,不设极性字段
**And** 公式以 `@<uuid>` 引用存量(stockId),编辑器显 name,重命名只改 name 不动 id
**And** Bresenham 网格寻路 + 端点箭头
**And** 每元素周边预定义连接点,创建连线自动吸附端口
**And** 拖拽元素时端口位置随更新
**And** 可变流量显 `▼`,常数流量显 `○`
**And** 重名软警告(允许同名,量纲推导以 id 解析)

#### Story 1a.5: 空间索引与视口剔除

As a 单人建模者,
I want 画布在万级图元下保持流畅,
So that 大模型不卡顿。

**Acceptance Criteria:**

**Given** 1a.4 图元渲染就绪
**When** 实现空间索引
**Then** R 树空间索引构建
**And** 每帧仅查询绘制与视口相交元素(视口剔除)
**And** 脏矩形追踪仅重绘变化区域
**And** 10000 图元画布帧率 ≥ 30 FPS(NFR-PERF-2)
**And** 脏矩形 API 须前瞻支持小地图低精度采样查询(供 1a.6 用,API 契约预留)

#### Story 1a.6: 小地图

As a 单人建模者,
I want 角落小地图显示画布全貌,
So that 在大模型中快速定位与跳转。

**Acceptance Criteria:**

**Given** 1a.5 空间索引+脏矩形就绪
**When** 实现小地图
**Then** 角落常驻缩略图,低精度采样投影全部图元(调用 1a.5 脏矩形低精度采样 API)
**And** 高亮框指示当前视口
**And** 点击/拖拽小地图跳转主视口
**And** 增量更新联动脏矩形,避免 10000 图元全量重绘

#### Story 1a.7: 顶部工具栏与底部状态栏

As a 单人建模者,
I want 工具栏切换工具与状态栏查看模型信息,
So that 高效操作建模与监控状态。

**Acceptance Criteria(工具栏):**

**Given** 1a.4 图元存在
**When** 实现顶部工具栏
**Then** 含 文件(新建/打开/保存)+ 编辑(撤销/重做/复制/粘贴/删除)+ 工具切换(选择/存量/源汇/流量)+ 模拟控制(暂停/播放/重置/单步)+ dt 选择器[0.01,0.1,0.5,1.0]+ 缩放指示器+滑块
**And** 模拟控制按钮(播放/暂停/单步/重置)在 1a 存在但 disabled(无仿真,1b 解锁;且无图元时禁用仿真触发防空模型跑仿真崩 1b.3,B10)
**And** 删除按钮(编辑菜单 Delete / 选中图元后 Delete 键)在 1a 激活:plain properties 本地删除选中图元(stock/cloud/flow,1a 单人无 CRDT);删除存量时的级联 RI 与 formula-reference dangling 规则在 4.2 CRDT 事务化时补(受控 rework,类 1a.7→1a.9 i18n 抽 key;AR-1 修订:无删除则单人建模闭环不成立)
**And** 工具栏文案写死中文(1a.9 抽 i18n key,接受返工)

**Acceptance Criteria(状态栏):**

**When** 实现底部状态栏
**Then** 含 模拟时间计数器 + 图元计数 + 在线用户数 + 头像堆栈 + FPS(Debug)+ 连接状态 + 量纲校验概要(L2 渐显,如 `量纲:3/5 一致·2 软警告`)
**And** 量纲概要点击展开不一致流量清单(L2)
**And** 在线用户数/FPS/连接状态在 1a 单人模式下显示占位(单人为 1 / 连接状态本地)

#### Story 1a.8: 右侧属性面板与公式编辑器

As a 单人建模者,
I want 右侧面板编辑图元属性与公式并看实时校验,
So that 精确配置模型参数。

**Acceptance Criteria:**

**Given** 1a.4 图元存在
**When** 选中图元
**Then** 右侧属性面板显示选中元素属性
**And** 存量属性:名称/初始值/单位/允许负值复选框
**And** 流量属性:公式编辑器(支持常数单位标注/可变常数切换/派生流量单位只读)
**And** 公式语法错误红色高亮(1a 语法校验)
**And** 量纲校验入口存在,编辑公式时触发校验逻辑
**And** 量纲推导 stub 返回"待 1b"(推导逻辑 FR-SIM-7 在 1b 接入)
**And** 1a 验收只验入口存在+触发逻辑就绪,不验推导结果

#### Story 1a.9: 界面语言切换

As a 单人建模者,
I want 中/英双语运行时切换,
So that 按偏好使用界面。

**Acceptance Criteria:**

**Given** 1a.7 工具栏/状态栏就绪(文案写死中文)
**When** 实现 i18n
**Then** 搭建 i18n 框架,运行时切换中/英即时生效无需刷新
**And** 入口在设置面板,选择持久化 localStorage
**And** 切换范围:工具栏/属性面板/状态栏/弹窗/提示
**And** 不切换用户输入的 name/公式/ASCII 图元字符画
**And** 默认跟随 navigator.language,无匹配回退 English
**And** 抽 key 完整性校验:grep 残留中文文案点(防 1a.7 写死时遗漏),漏抽点须补

#### Story 1a.10: 模型设置

As a 单人建模者,
I want 配置模型级时间单位与默认 dt,
So that 统一模型的时间计量基准。

**Acceptance Criteria:**

**Given** 1a.8 属性面板就绪
**When** 实现模型设置
**Then** 模型级配置项:时间单位(年/月/日/时/分/秒单选,作量纲校验与 dt 计量基准)+ 默认 dt(与 FR-SIM-1 联动,1b 接入实际求解)
**And** 修改时间单位触发全模型量纲重校验
**And** 量纲重校验触发逻辑在 1a,推导 stub 返回"待 1b"(同 1a.8 占位策略)
**And** 1a 验收只验触发逻辑就绪,不验推导结果

### Epic 1b: Wasm 仿真求解器

sparkline `▁▂▃▄▅▆▇█` 是 20 世纪 ASCII 艺术亲缘(字符拼趋势图形),且是原理③"阅读/观看双重性"的仿真结果层体现(读数值/看趋势图形双重性);纯字符渲染锁(FR-SIM-VIZ-1),不引图表库,美学服从等宽网格非引库做花哨可视化。在 Epic 1a 建模基础上接入 Wasm 求解器,用户能运行隐式求解器仿真、看实时 ASCII sparkline 结果,完成单人建模→仿真闭环。含 Wasm 求解器内核(AD-5/6/7/8,手写 parser+autodiff+faer,禁 TS 跑仿真步;prototype formula.ts evalFormula 仅留非仿真预览,仿真路径替换为 Wasm 内核)+ Dockerfile 补 Rust→wasm-pack 多阶段构建并入 Epic 1a 既有 Dockerfile。实现要点:高风险隔离(F5-perf 雅可比全重算+稀疏 LU 能否 100 存量达 100 步/秒、FR-SIM-8 降级收敛监控等实现期标定集中此 epic);**求解器须预留 t0→t1 追赶 API**(从快照 simulationTime 赶至现在)供 Epic 3 房主迁移增量重跑调用(房主迁移不阻塞 CRDT,保反指标清零=0)。

**FRs covered:** FR-SIM-1, FR-SIM-2, FR-SIM-3, FR-SIM-4, FR-SIM-5, FR-SIM-6, FR-SIM-7, FR-SIM-8, FR-SIM-VIZ-1(共 9)

#### Story 1b.1: Wasm 内核骨架与 Dockerfile Rust 阶段

As a 单人建模者,
I want 仿真数值经 Wasm 内核求值(AD-5),
So that 仿真步不被 TS 直接执行,保证数值一致性。

**Acceptance Criteria:**

**Given** 1a.10 模型设置就绪
**When** 搭建 Wasm 内核骨架
**Then** Rust stable + wasm-pack 骨架建立,TS 薄边界(AD-5)定义 Wasm exports 调用契约
**And** 手写递归下降 parser(复用 prototype formula.ts 结构,扩 `@uuid`/`[单位]` 产生式)
**And** crate 组合:autodiff 0.7.0(雅可比)+ faer 0.24.4(LU);mexpr/meval 已弃用确认(不存在 crates.io)
**And** AST 为单一真相源供 autodiff 图/量纲校验/tokenizer 共用
**And** Dockerfile 补 Rust→wasm-pack 多阶段(替换 1a.1 占位注释 `# TODO 1b.1: Rust→wasm-pack 阶段` 为实际阶段)
**And** prototype formula.ts evalFormula 仅留非仿真预览(UI 实时预览/量纲预览),仿真路径占位待 1b.3 接入
**And** Wasm 求解器在 Web Worker 隔离运行(AD-5 安全边界),trap/panic 不阻塞主线程渲染与协作,仅仿真暂停报错;主线程与 worker 经 postMessage 通信(入参图元 AST / 返回步进结果)
**And** Wasm 产物经 wasm-opt + gzip 压缩;首屏懒加载(1a 建模/渲染不依赖 Wasm,仿真首次触发时加载),HTTP 长缓存 + 内容哈希指纹;首屏不阻塞建模价值(F5-perf 隔离)
**And** 最小可验证点:解析简单公式 AST(如 `@stock1 * 2`)并跑最简前向欧拉步证明 Wasm 通路畅通

#### Story 1b.2: 代数环检测与 DELAY 转换

As a 单人建模者,
I want 仿真前检测代数环并转换 DELAY 函数,
So that 仿真不会陷入循环依赖且 DELAY 连续性保持。

**Acceptance Criteria:**

**Given** 1b.1 Wasm 内核骨架就绪
**When** 编译期模型变换
**Then** 代数环检测:编译期构建依赖有向图 → 移除所有存量流出边 → 残余图有环则检测到代数环,高亮+弹窗拒绝运行
**And** 无环则交隐式求解器(1b.3)联立求解
**And** 隐式法下仍严格剪边,代数环一律拒绝不因隐式可解放行
**And** DELAY 函数:编译期转为串联隐式存量(如 `DELAY3(X,6.0)` 插入 3 个串联一阶微分方程)
**And** 纳入统一联立求解保连续性(1b.3)

#### Story 1b.3: 隐式求解器主循环与流量守恒

As a 单人建模者,
I want 隐式求解器跑刚性系统仿真并保证流量守恒,
So that 仿真数值正确且物质不凭空产生消失。

**Acceptance Criteria(主循环段):**

**Given** 1b.2 模型变换就绪
**When** 实现隐式求解器主循环
**Then** 隐式求解器(后向欧拉/BDF-1~2,不上 BDF-3+)按阶数状态机起步
**And** 每步牛顿迭代收敛,牛顿初始猜测按阶数分配外推法
**And** 雅可比由 AST 自动微分(autodiff crate),每步含 LU 分解线性求解(faer)+ 收敛判定
**And** 雅可比约束激活后全重算(非 Broyden)+ 滞回带防 Chattering
**And** dt 可配(默认 0.1),模型级时间单位(年/月/日/时/分/秒)
**And** 播放/暂停/单步/重置控制逻辑在求解器 API 层(UI 按钮解锁在 1b.8)
**And** 仅房主运行模拟(单人模式即用户)

**Acceptance Criteria(守恒段):**

**And** 流量守恒:每步收敛后每流量产单一一致速率,所有连接该流量的存量引用同一收敛速率(FR-SIM-3)
**And** 防止浮点漂移与物质凭空产生/消失
**And** 约束作用于收敛结果非牛顿迭代过程

**Acceptance Criteria(F5-perf 标定段):**

**And** F5-perf 标定:雅可比全重算+稀疏 LU 能否 100 存量达 100 步/秒(NFR-PERF-6),标定结果记录入 Deferred

**Acceptance Criteria(t0→t1 追赶 API 前瞻条,原 1b.9 并入):**

**And** 求解器 API 须支持 t_start 参数(从指定 t0 跑到 t1 非从 0)+ 接受外部初始状态向量
**And** 供 Epic 3 房主迁移从快照 simulationTime 续跑调用(完整从快照拉状态续跑逻辑在 Epic 3 实现,1b 仅 API 支持)
**And** 可验证点:开发者能从指定 t0 跑到 t1 验证 API(单人模式无直接用户价值,Epic 3 房主迁移调用)

#### Story 1b.4: 非负钳制机制

As a 单人建模者,
I want allowNegative=false 的存量不被打成负数,
So that 物质守恒不被幽灵渗漏破坏。

**Acceptance Criteria:**

**Given** 1b.3 主循环就绪
**When** 牛顿迭代中施加非负约束
**Then** allowNegative=false 的存量,在牛顿迭代中施加 stock≥0 约束(投影到可行域)
**And** 钳制后实际流出速率不超使存量恰归零的速率
**And** 级联重算,雅可比体现活动约束方程结构变化
**And** 绝不幽灵渗漏
**And** 禁止后置钳制 `if(nv<0) nv=0`(违 FR-SIM-3 物质守恒,prototype 现实现须重写为速率级钳制)

#### Story 1b.5: 数值溢出熔断

As a 单人建模者,
I want 仿真数值溢出时自动暂停,
So that 不会显示无意义的爆炸结果。

**Acceptance Criteria:**

**Given** 1b.3 主循环就绪
**When** 仿真运行中检测溢出
**Then** 任一存量绝对值 > max(所有存量初始绝对值)×1e6,或 NaN/Inf,或相邻步相对变化率 >1e3,则自动暂停
**And** 阈值 MVP 默认可调(含调参引导)
**And** ASCII 弹窗 `[SYSTEM HALTED: NUMERICAL OVERFLOW AT t=<time>s]`
**And** 熔断事件经 WS 上报服务端写 stdout(AD-5/AD-16/AD-18,单人模式本地 stdout)
**And** 与 FR-SIM-8 降级(残差非收敛)边界不混淆:熔断=资源耗尽暂停,降级=残差非收敛不阻断

#### Story 1b.6: 量纲校验接入

As a 单人建模者,
I want 公式量纲实时校验,
So that 发现单位不一致错误。

**Acceptance Criteria:**

**Given** 1b.1 Wasm 内核(parser/AST)就绪 + 1a.8/1a.10 量纲 stub 入口存在
**When** 实现量纲校验
**Then** 编译期对每流量公式遍历 AST 逐子表达式推导单位,比对目标单位(目标存量 units/时间单位)
**And** 一致通过,不一致软警告(红色高亮+预期/推导单位,不阻断运行)
**And** 常数单位标注参与推导;无 units 视无量纲
**And** 替换 1a.8/1a.10 量纲 stub 为实际推导(stub 返回"待 1b"→实际推导结果)
**And** 校验在公式编辑时实时进行(FR-UI-2 扩展,1a.8 入口就绪)

#### Story 1b.7: 求解器自适应降级与一键简化

As a 单人建模者,
I want 求解器步长崩溃时自动降级不弹窗打扰,
So that 仿真在刚性区域继续不中断。

**Acceptance Criteria:**

**Given** 1b.3 主循环就绪
**When** BDF 步进内嵌收敛监控
**Then** 步长崩溃/残差超阈自动降级后向欧拉→显式试探步
**And** 一级状态层(用户无感):sparkline 旁黄点闪烁+状态栏"求解器自适应调节中",不弹窗不暂停(状态栏 1a.7 就绪)
**And** 二级一键(罕见):降级链仍失败弹单按钮"简化模型以继续",点击自动执行预设降级组合续跑
**And** 无第二按钮无参数面板
**And** 与 FR-SIM-6(数值域熔断)、§5.1 逃生阀(MVP 体量超载)边界不混淆

#### Story 1b.8: 仿真闭环:控制解锁+sparkline+dt 联动

As a 单人建模者,
I want 点播放看实时 sparkline 结果,
So that 完成单人建模→仿真闭环。

**Acceptance Criteria(控制解锁):**

**Given** 1b.3-1b.7 求解器就绪
**When** 接入模拟控制
**Then** 1a.7 模拟按钮(播放/暂停/单步/重置)从 disabled 解锁为激活
**And** 播放/暂停/单步/重置接求解器主循环(1b.3)

**Acceptance Criteria(sparkline):**

**And** 每存量方框旁实时 ASCII sparkline(`▁▂▃▄▅▆▇█`,默认保留近 N=32 步,与 dt 解耦)
**And** 存量方框同步显示 currentValue+units(不归一化)
**And** 仿真未运行显 initialValue,无 units 仅显数值
**And** 量纲识读反馈在状态栏概要(1a.7)
**And** 纯字符渲染不引图表库

**Acceptance Criteria(dt 联动):**

**And** 默认 dt(1a.10 UI)与 FR-SIM-1 求解器 dt 联动,dt 选择器[0.01,0.1,0.5,1.0]切换生效
**And** 完整多存量时序面板(L3)后续不含 MVP

### Epic 2: 认证与画板归属权限(使能 epic)

用户能 OAuth 登录(GitHub/Google)、拥有自己的画板、作为 owner 管理 editor/viewer 角色、生成可轮换的只读分享链接。无独立 PRD FR 编号(auth 落 AD-16/17 + spec CAP-13 + PRD 开放问题 3 决策,PRD 原 §4.3 匿名前提已由 AD-16/17 推翻);支撑 FR-COLLAB-1(owner 归属子句)+ FR-GAME-2(徽章绑账号子句)。**使能 epic 定位**:认证本身非独立用户旅程价值(无协作对象时"管角色/分享"空转),但为 Epic 3 协作归属、Epic 4 画板 owner、Epic 5 徽章绑账号提供使能层;因 AD-16/17 架构重单独成 epic 便于实施,是"用户价值导向"原则的显式例外(标注使能 epic 非隐式技术层)。

**FRs covered:** (无独立 PRD FR 编号;支撑 FR-COLLAB-1 owner 归属子句 + FR-GAME-2 绑账号子句)

#### Story 2.1: OAuth 登录与 session 双通道

**前置:** 1a.1(Dockerfile Go build 阶段 + CI/CD + AD-18 部署就绪)
**AD:** AD-16(OAuth GitHub+Google 直连 + session 双通道 + users 表)

**Acceptance Criteria(OAuth 登录):**

**Given** 用户访问登录页
**When** 点击 GitHub 或 Google 登录
**Then** 重定向到 provider OAuth 授权页(state 参数防 CSRF)
**And** provider 回调 callback HTTP 端点接收 authorization code
**And** 服务端用 code 换 access_token(client_secret 从 server env 读取,不入前端 bundle)
**And** 获取 provider 返回的 oauth_user_id + email

**Acceptance Criteria(users 表与 B9):**

**And** users 表按 UNIQUE(oauth_provider, oauth_user_id) 锚点(双 provider 共享表,GitHub/Google 各占一行)
**And** **B9 显式验收**:同邮箱(如 alice@example.com)首次 GitHub 登录建 user 行,后 Google 同邮箱登录建**第二行独立 user**(provider 不同),两账号画板不互通(不自动合并账号)

**Acceptance Criteria(session 双通道):**

**And** 登录成功创建 session,token 双通道下发:HttpOnly + Secure + SameSite=Lax Cookie(JS 不可读,防 XSS 偷 token)+ JSON body 返回 token(供 WS 首帧鉴权,解 JS 不可读 cookie 致 WS 无法首帧带 token 矛盾)
**And** session 持久化到 SQLite sessions 表(进程重启会话不丢)

**Acceptance Criteria(Go 后端 skeleton):**

**And** Go 后端 auth 骨架:routing + SQLite connection pool + env config(1a.1 Go server 仅 serve 前端 dist,本 story 扩展为 auth 后端,后续 Epic 2 story 复用)
**And** auth Go 代码纳入 1a.1 既有 Dockerfile Go build 阶段(AD-18 部署骨架在 1a.1/1b.1,本 epic 无独立部署 story)
**And** client_secret 存 server env,grep 前端 dist 无 client_secret 残留

#### Story 2.2: 画板归属与静态权限模型

**前置:** 2.1(OAuth + users 表 ready)
**AD:** AD-17(owner_user_id + 三角色 + HTTP 端点 + CRDT 持久化按 board_id 分区)
**支撑:** FR-COLLAB-1 owner 归属子句(boardMetadata/owner_user_id)
**方案 B(极限场景结论):** 静态权限模型;runtime enforcement(role_change WS frame + drain + viewer op 拒收)推 Epic 3

**Acceptance Criteria(画板归属):**

**Given** 用户已登录(2.1)
**When** 创建画板
**Then** boards 表写入 owner_user_id = 当前 user_id(role 默认 owner)
**And** boardMetadata 暴露 owner_user_id(支撑 FR-COLLAB-1 owner 归属子句)

**Acceptance Criteria(三角色权限矩阵):**

**And** 三角色定义:owner(全权 + 转让/角色修改)/ editor(编辑图元 + 跑仿真)/ viewer(只读)
**And** owner_user_id 存 boards DB 表(非 CRDT 可改字段;owner 转让只走 HTTP 端点,防 CRDT 伪造提权)

**Acceptance Criteria(owner 转让/角色修改 HTTP 端点):**

**And** owner 转让走认证 HTTP 端点 POST /api/boards/{id}/transfer(new_owner_id)
**And** 角色修改走认证 HTTP 端点 POST /api/boards/{id}/members/{user_id}/role(role ∈ editor/viewer)
**And** HTTP 端点鉴权:仅 owner 可调 transfer/role-modify(非 owner 调用返 403)

**Acceptance Criteria(前瞻条 — 边界声明):**

**And** CRDT 持久化表(ops/snapshot)按 board_id 分区(AD-17 数据隔离约束,实际表在 Epic 3 yjs-go relay 创建时落地)
**And** role_change WS frame + drain 待处理 op 原子性 + viewer CRDT op 网关拒收 + CRDT op 改 owner_user_id 网关拒收属 **runtime enforcement**,在 Epic 3 WS server(yjs-go relay)接入,本 story 不实现(Epic 2 无 collaborator runtime,无法端到端验证)
**And** 可验证点(静态):boards.owner_user_id 是 DB 字段;HTTP 端点写入 owner_user_id/role 字段,DB 状态正确断言

#### Story 2.3: share_token 生成与轮换

**前置:** 2.2(boards.owner_user_id + owner 角色概念 ready)
**AD:** AD-17(share_token 安全属性)

**Acceptance Criteria(生成):**

**Given** owner 已认证(2.2)
**When** 生成分享链接
**Then** share_token = crypto/rand ≥128 bits + URL-safe base64 编码
**And** token 存 hash(防 DB 泄露致 token 被冒用),查时 hash 比对
**And** 分享链接只读(viewer 角色)

**Acceptance Criteria(轮换):**

**And** owner 可轮换 token(POST /api/boards/{id}/share/rotate),旧 token 立即失效
**And** 鉴权:仅 owner 可生成/轮换 token(非 owner 调用返 403)

**Acceptance Criteria(防泄露):**

**And** 响应头含 Referrer-Policy: no-referrer(防 Referer 头泄露 token 到第三方)

#### Story 2.4: 徽章绑账号持久化基座

**前置:** 2.1(users 表 ready)
**AD:** AD-16(user_badges 表;服务端判定从 op 流在 Epic 5 主体,本 story 只做持久化基座)
**支撑:** FR-GAME-2 绑账号子句(主体触发器在 Epic 5)
**方案 A(极限场景结论):** 独立基座 + 最小可验证点

**Acceptance Criteria(user_badges 表):**

**Given** users 表 ready(2.1)
**When** 建立 user_badges 表
**Then** schema:user_id + badge_id + unlocked_at(服务端填 now(),防客户端伪造时间)+ UNIQUE(user_id, badge_id)

**Acceptance Criteria(write/read API):**

**And** write API:award(user_id, badge_id) — 供 Epic 5 服务端判定调用(unlocked_at 服务端填);幂等:重复 award 同徽章 INSERT OR IGNORE 不报错(UNIQUE(user_id, badge_id) 约束防重复插入,B14)
**And** award write API 速率限制(防 API 滥用刷 award 致查询/鉴权负载升;INSERT OR IGNORE 防重复写入但查询无防护,B2 决策:award API 滥用防护)
**And** read API:list_by_user(user_id) — 跨设备同步徽章记录(供前端徽章 UI 读)

**Acceptance Criteria(最小可验证点 — 开发者级,类 1b.3 t0→t1):**

**And** 开发者能通过 write API 手动 award 一条徽章记录,通过 read API 跨设备读取验证持久化

**Acceptance Criteria(前瞻条 — 边界声明):**

**And** 实际触发器逻辑(服务端从 CRDT op 流判定解锁,防客户端伪造)在 Epic 5 主体(FR-GAME-2 主体),依 Epic 3 yjs-go relay expose ops;本 story 只交付持久化基座,无触发器(split 子句要求 Epic 2 提供基座,无独立用户价值)

### Epic 3: 实时多人协作

CRDT 结构化 AST 公式存储是原理①"形式即内容"协作层体现(公式既是可读语义又是结构化内容,语义感知合并保形式完整);多人共在等宽网格作画是原理②"等宽网格为画布"多人版(类活字印刷多人共排铅字,网格对齐即协同作画)。美学连续性边界(原理②多人版固有代价):并发编辑合并瞬间可能视觉跳变——同图元对拖 last-write-wins 跳到赢家位置(Yjs Map 固有)/公式重冲突回退文本级跳变(FR-COLLAB-6)/连线端点对拖跳变;房主迁移有固有视觉代价(迁移间隙仿真态广播冻结真空/快照版本不对齐增量重跑追赶跳变/快照周期上报边界跳变),sparkline 迁移历史断点(新房主近 N=32 步历史清空续填,但会话级临时态 FR-SIM-VIZ-1 近 N 步非持久化,迁移后续填是新会话历史,断点是临时态固有特性非缺陷),视觉连续性是美学目标实施期最小化非硬 AC,定性口径:跳变不破坏建模语义可读性(原理①"阅读"半义保全为底线,图元/公式/数值可辨非重叠不可辨);美学定位在协作层承认此边界(原理②多人版有 CRDT 合并代价,非暗示无缝),使亲缘点明平衡非只夸优点。多人能同时编辑同一画板看到彼此实时光标/编辑,房主权威跑仿真他人看结果,房主断开新房主无缝续跑不回退 t=0。实现要点:CRDT 文档模型(Yjs,FR-COLLAB-1 主体,Y.Map 嵌套 AST + paren 旁路 + Y.Text 待定节点)+ yjs-go relay(AD-3/4,Go 单体中继,实现期首验 sync protocol)+ CRDTSnapshot/OpLog SQLite 持久化按 board_id 分区(AD-17,PresenceSnapshot 进程内存态不落 SQLite)+ 存在感知(30Hz 节流)+ 房主迁移(快照附 clientID+clock 版本向量,对齐续跑/不对齐增量重跑,保反指标清零=0)+ 仿真态广播(独立二进制通道,整步收敛值)+ 公式语义感知合并(拓扑比较检测,轻冲突标区+锁子树/重冲突回退文本级)。依赖 Epic 1a 建模 + Epic 1b 求解器(房主迁移调 t0→t1 追赶 API)+ Epic 2 鉴权。**降级交付路径**:若 Epic 1b Wasm 求解器延期,Epic 3 可先交付"无房主迁移"协作(实时编辑+存在感知+CRDT 持久化+公式合并),房主迁移(FR-COLLAB-3)与房主权威仿真广播(FR-COLLAB-4/5)作可剥离 story 后置——因房主迁移强依赖 1b t0→t1 追赶 API,无 1b 则房主迁移无法续跑。step-03 须将房主迁移标为"依赖 1b 解锁"story,余协作 story 可与 1a 并行。

**FRs covered:** FR-COLLAB-1(CRDT 文档模型主体), FR-COLLAB-2, FR-COLLAB-3, FR-COLLAB-4, FR-COLLAB-5, FR-COLLAB-6(共 6,含 FR-COLLAB-1 split 主体)

#### Story 3.1: CRDT 文档模型 + yjs-go relay + WS 基座 + 持久化

**前置:** 1a(建模图元 AST)+ 2.1(session token)
**AD:** AD-3/4(yjs-go relay)+ AD-10(CRDT 文档模型)+ AD-17(持久化按 board_id 分区)
**FR:** FR-COLLAB-1 完整(文档模型 + relay + WS + 持久化)
**方案 A(极限场景结论):** monolith,分段 AC;持久化是 relay oplog 不可分,B4 端到端验收不可拆

**Acceptance Criteria(文档模型段):**

**Given** 1a 建模图元 AST 就绪 + 2.1 session token 就绪
**When** 实现 CRDT 协作基座
**Then** Yjs 文档模型:Y.Map("elements")(id→JSON 状态),流量 formula 以结构化 AST 存储(Y.Map 嵌套,引用节点存 stockId)非扁平字符串
**And** Y.Array("elementOrder") Z 轴排序
**And** Y.Map("boardMetadata") 看板名/设置/所有者(owner_user_id from 2.2)

**Acceptance Criteria(relay + WS 段):**

**And** yjs-go relay(AD-3/4,Go 单体中继,实现期首验 sync protocol 性能/兼容 — 不达标 fallback:降级全量同步快照对齐 oplog 一致性,不引入备选 sync lib 以控 scope)
**And** WS server 首帧 token 鉴权(2.1 session token)+ Origin 头校验(AD-16)
**And** WS 连接速率限制(NFR-SEC-5 落地:防高频连/断 DoS 耗尽单节点 relay 资源,token bucket/固定窗口实现期选,B2 决策:单节点 MVP 基线防护)

**Acceptance Criteria(持久化段):**

**And** SQLite 存快照 + 追加式操作日志(按 board_id 分区,落地 2.2 约束,AD-17)

**Acceptance Criteria(B4 验收段):**

**And** **B4 验收**:10 人认证并发编辑同画板,CRDT 同步压力可承受(sync protocol + WS 传输 + oplog 写入,单节点 10 人规模,FR-COLLAB-1)

**Acceptance Criteria(前瞻条 — 供 3.3 + 5.3):**

**And** WS 网关预留 op 过滤 hook 接口(3.3 实现 role_change/drain/viewer op 拒收/owner op 拒收)
**And** relay expose ops 订阅接口预留(供 5.3 徽章服务端判定读取 op 流,AD-16 防伪造)— 与 op 过滤 hook 对称(写侧 hook 阻断越权 op / 读侧订阅读取 op 流),relay 侧定义两接口,消费方(3.3/5.3)接
**And** expose ops 订阅契约:relay push 结构化 op 非 raw Y.js update(免消费方反序列化依赖 yjs 库,5.3 服务端直接判读);安全相关字段 spec 锁:origin_user_id(防伪造,AD-16)+ ts(时序判定);其余字段结构(type/payload)实现期 relay 与消费方对齐(B5 c 折中 / A1:安全字段 spec 锁防实施期漏,结构字段实现期定保 relay 灵活,反推极限1 全降级→安全字段漏 / 极限2 全保留→锁死 两难化解)
**And** op 过滤 hook 拒收的越权 op 不入 expose ops 订阅流(hook 在 relay 入口拒,不广播不订阅),5.3 徽章判定只读合法 op 流(被拒 op 不参与判定)

#### Story 3.2: 存在感知协议

**前置:** 3.1(WS server)
**FR:** FR-COLLAB-2

**Acceptance Criteria:**

**Given** 3.1 WS server 就绪
**When** 实现存在感知
**Then** 非持久化独立通道传光标位置{x,y}/选区{elementIds,anchor,head}/用户信息{id,name,color}/心跳
**And** 广播最大 30Hz 节流
**And** 视口剔除仅绘可见区光标
**And** PresenceSnapshot 进程内存态(不落 SQLite,会话结束丢弃)

#### Story 3.3: 权限 runtime enforcement

**前置:** 3.1(WS server + op 过滤 hook 接口)+ 2.2(静态权限 model)
**AD:** AD-17(runtime enforcement)
**支撑:** FR-COLLAB-1 owner runtime + 通用权限
**方案 A(极限场景结论):** 独立,实现 3.1 预留的 op 过滤 hook

**Acceptance Criteria:**

**Given** 3.1 WS server + op 过滤 hook 就绪 + 2.2 静态权限 model 就绪
**When** 实现权限 runtime enforcement
**Then** role_change WS frame:owner 角色变更广播(frame 落地 2.2 静态 model 的 role/owner 字段)
**And** drain 待处理 op 原子性:角色变更瞬间,待处理 CRDT op 在变更前 flush 或变更后拒收(保原子性,无权限窗口)
**And** viewer CRDT op 网关拒收:viewer 角色 CRDT 写 op 被网关拒收(viewer 只读)
**And** CRDT op 改 owner_user_id 网关拒收:任何角色 CRDT op 改 owner_user_id 被拒(owner 转让只走 HTTP 端点 2.2)
**And** 可验证点(端到端):collaborator runtime 就绪(3.1),role_change/drain/op 拒收端到端测

#### Story 3.4: 模拟状态广播 + 房间仿真态快照

**前置:** 3.1(WS server)+ 1b.8(求解器闭环)
**FR:** FR-COLLAB-4 + FR-COLLAB-5
**标"依赖 1b 解锁":** 1b 延期则本 story 后置

**Acceptance Criteria(模拟状态广播 — FR-COLLAB-4):**

**Given** 3.1 WS server 就绪 + 1b.8 求解器闭环就绪
**When** 实现仿真态广播
**Then** 独立二进制通道(不混 CRDT)传 [stockId<string>, currentValue<float64>] 数组
**And** ≤30Hz 变化检测节流
**And** 隐式求解器每步收敛后整步结果(非子迭代中间值)
**And** 客户端接收渲染不回写 CRDT

**Acceptance Criteria(房间仿真态快照 — FR-COLLAB-5):**

**And** 房主周期性上报 {simulationTime, stockValues, paused, dt}
**And** 服务端进程内存持最新快照(不落 SQLite,会话结束丢弃)
**And** 标"依赖 1b 解锁":1b 延期则本 story 后置(降级交付路径)

#### Story 3.5: 房主迁移机制

**前置:** 3.4(仿真态快照)+ 1b.3(t0→t1 追赶 API)
**FR:** FR-COLLAB-3
**B6 验收:** 整步边界竞态
**标"依赖 1b 解锁":** 1b 延期则本 story 后置

**Acceptance Criteria:**

**Given** 3.4 仿真态快照就绪 + 1b.3 t0→t1 追赶 API 就绪
**When** 实现房主迁移
**Then** 第一个用户为房主运行模拟
**And** 房主断开心跳丢失→先申请者当选新房主
**And** 从服务端仿真态快照(3.4)续跑不回退 t=0(调 1b.3 t0→t1 追赶 API)
**And** 广播 SIMULATION RESUMED
**And** 反指标:房主迁移仿真清零=0(live migration scope:房主断开且他人在线时新房主从快照续跑不回退 t=0;不含全员断线 cold restart—B12 cold restart 在 1b 未就绪时允许重置 t=0 属降级路径非反指标违背,AR-2 修订)
**And** owner(画板所有者,权限层,HTTP 转让)≠ 房主(仿真运行者,协作层,心跳迁移),两机制独立:owner 转让走 HTTP 不影响房主,房主迁移走心跳不改 owner;房主按 board_id 画板级(多画板每画板独立房主,与 AD-17 按 board_id 分区一致)

**Acceptance Criteria(B6 验收 — 整步边界竞态):**

**And** 房主迁移瞬间,原房主可能正处牛顿迭代中间步,快照须取整步收敛值(非中间步),迁移触发与整步边界竞态在“快照不含中间步值”上闭合
**And** 标“依赖 1b 解锁”:1b 延期则本 story 后置(降级交付路径)

**Acceptance Criteria(B12 验收 — 全员断线恢复):**

**And** 全员断线后无房主时(cold restart,非 live migration 反指标 scope,AR-2 修订),重连后从 3.1 持久化快照恢复 CRDT 状态,首位重连者触发房主重新当选(本 story 当选机制),仿真态从 3.4 快照续跑(1b 就绪)或重置 t=0(1b 未就绪,降级路径)

#### Story 3.6: 公式语义感知合并

**前置:** 3.1(CRDT AST)+ 1a.8(公式编辑器)
**FR:** FR-COLLAB-6

**Acceptance Criteria:**

**Given** 3.1 CRDT AST 就绪 + 1a.8 公式编辑器就绪
**When** 实现公式语义感知合并
**Then** 流量公式结构化 AST 存 CRDT
**And** 并发编辑不同 AST 子节点按节点级 CRDT 合并(避免文本冲突破坏语义)
**And** AST↔文本双向同步(编辑器实时解析文本→AST 写 CRDT,CRDT→文本序列化)
**And** 不完整语法以待定节点承载不阻断输入
**And** 合并后做语法+量纲校验(FR-SIM-7)
**And** AST 始终可解析
**And** 量纲校验(FR-SIM-7/1b.6)未就绪时用 1a.8 stub 降级(量纲识读返回"待 1b")

### Epic 4: 多画板、剪贴板与撤销重做

剪贴板 `SD_ASCII_ENGINE://` ASCII 协议是原理①"形式即内容"传输层体现(跨画板搬运的是 ASCII 字符排列本身——图元数据即 ASCII 形式,渲染时成字符排列);结构白名单+CRC32 校验(非密码学,仅传输完整性,见 FR-BOARD-2)即守护 ASCII 形式完整性,是安全美学的结构性注脚(数据即图形,校验即守护图形,非装饰性美学)。用户能同时开多画板标签页、跨画板复制粘贴图元(原子事务方案 C)、用户操作级撤销重做。实现要点:标签页(≤5 画板+最近列表+切换暂停 Y.Doc 同步)+ 剪贴板协议(`SD_ASCII_ENGINE://`+CRC32 完整性+结构白名单校验,禁 eval 防畸形注入)+ 统一删除 RI 规则(endpoint RI 级联删端点流量 + formula-reference RI C2 dangling 红色高亮不删流量,方案 C)+ 撤销栈(每画板独立 Y.UndoManager,用户操作级粒度非按键级,100 步,无跨事务 undo 归并)。依赖 Epic 1a(建模图元/公式编辑器)+ Epic 2(画板 owner 归属:owner_user_id 是 AD-17 Epic 2 子句,Epic 4 在认证前提下才无匿名画板后续迁账号债)+ Epic 3.1(Yjs Y.Doc/CRDT:标签页切换暂停 Y.Doc 同步、剪贴板单 CRDT op 原子事务、撤销栈 Y.UndoManager 均依 3.1,1a.3/1a.4 用 plain properties 无 Yjs)。

**FRs covered:** FR-BOARD-1, FR-BOARD-2, FR-BOARD-3, FR-HISTORY-1(共 4)

#### Story 4.1: 标签页界面

As a 多画板建模者,
I want 同时开多画板标签页并切换,
So that 并行管理多个模型且非活跃画板不占同步带宽。

**前置:** 1a.1(画布)+ 1a.7(工具栏)+ 2.2(board owner 归属)+ 3.1(Yjs Y.Doc)
**AD:** AD-17(board owner 归属)
**FR:** FR-BOARD-1

**Acceptance Criteria(标签页段):**

**Given** 1a.1 画布 + 2.2 board owner 归属 + 3.1 Yjs Y.Doc 就绪
**When** 实现多画板标签页
**Then** 每客户端最多同时开 5 画板标签页
**And** 超限时弹"关闭不活跃"对话框(列当前 5 画板最近活动时间,用户选一关闭或取消,不强制丢弃)
**And** 最近画板列表(最多 10 项,按 `last_opened_at` 降序;boards 表补 `last_opened_at` 字段,切换/打开时更新)
**And** 标签页 ≤5 是客户端软限(非 board 总数限,owner 可在 boards 表拥有 >5 画板,客户端仅同时开 5)

**Acceptance Criteria(切换段):**

**When** 用户切换画板标签页
**Then** 非活跃画板暂停 Y.Doc 同步(停止 sync 省流量,CRDT 状态保留不丢弃)
**And** 恢复活跃时续传增量(非全量重载)
**And** 活跃画板独占渲染/交互

#### Story 4.2: 统一删除 RI 规则

As a 建模者,
I want 删除图元时按引用完整性规则处理级联与悬挂,
So that 删除存量后流量引用状态明确(级联删或高亮悬挂,无静默损坏)。

**前置:** 1a.4(流量 fromId/toId + formula @uuid 引用)+ 1a.7(工具栏删除按钮 UI 壳)+ 3.1(CRDT delete op)
**AD:** AD-10(CRDT 文档模型)+ 统一删除 RI 方案 C
**FR:** (支撑,无独立 FR — 供 4.3 B7 dangling + 4.4 删除 undo 复用,类 3.3)

**Acceptance Criteria(删除入口段):**

**Given** 1a.4 流量引用 + 1a.7 工具栏删除按钮 UI 壳 + 3.1 CRDT 就绪
**When** 接通删除逻辑
**Then** 选中图元 + Delete 键 或 1a.7 工具栏"删除"按钮触发删除(1a.7 仅 UI 壳,本 story 补删除 CRDT op 逻辑)
**And** 删除为单 CRDT 事务(原子性)

**Acceptance Criteria(endpoint RI 段):**

**When** 删除存量(stock)
**Then** 以该 stock 为端点的流量(flow.fromId 或 toId == stock.id)按 endpoint RI 级联删除
**And** 级联删与主删并入同一 CRDT 事务(原子,无半删态)

**Acceptance Criteria(formula-reference RI 段):**

**When** 删除存量(stock)
**And** 某流量 formula 以 `@<uuid>` 引用该 stock(formula-reference RI C2)
**Then** 该流量不级联删,改为 dangling 红色高亮(formula 引用目标不存在,标红)
**And** 流量结构保留(不删流量,方案 C dangling 不删)

**Acceptance Criteria(可验证点段 — 最小触发,类 2.4 基座):**

**When** 开发者选中一 stock(既有端点流量又有 formula 引用流量)→ 触发删除
**Then** 验证 endpoint RI 流量级联删(CRDT 状态无该流量)
**And** 验证 formula-reference RI 流量 dangling 红色高亮(流量在,formula 引用标红)

**Acceptance Criteria(前瞻条):**

**And** dangling 流量端点引用的仿真侧解析(1b.6 量纲校验 / 3.6 formula 语义)在 1b/3 接入兜底,本 story 只交付删除时高亮标记,不实现仿真解析

#### Story 4.3: 跨画板复制粘贴 + 外部文件阻断

As a 多画板建模者,
I want 跨画板复制粘贴图元且阻断外部文件,
So that 复用模型结构并防畸形注入。

**前置:** 4.1(标签页跨画板)+ 4.2(dangling 高亮机制)+ 1a.5(空间索引)+ 1a.7(工具栏复制/粘贴按钮 UI 壳)+ 3.1(CRDT op)
**AD:** AD-5(粘贴不经 eval)+ 统一删除 RI 方案 C(B7 dangling 复用 4.2)
**FR:** FR-BOARD-2, FR-BOARD-3

**Acceptance Criteria(剪贴板协议段):**

**Given** 4.1 标签页 + 1a.5 空间索引 + 3.1 CRDT 就绪
**When** 用户复制选中图元
**Then** 序列化为 Base64+JSON,加协议头 `SD_ASCII_ENGINE://` + CRC32 完整性校验值,写入剪贴板
**And** CRC32 仅作传输完整性非加密认证(防畸形结构,非密码学)

**Acceptance Criteria(粘贴流程段):**

**When** 用户粘贴(1a.7 工具栏粘贴按钮 / Ctrl+V)
**Then** 协议头校验(非 `SD_ASCII_ENGINE://` 前缀拒绝)
**And** CRC32 完整性校验(不符拒绝)
**And** 结构白名单校验(字段类型合法 / UUIDv4 / 无未知字段,任一不合规拒绝)
**And** 分配新 UUID(防跨画板 id 冲突)
**And** 重映射连接:flow.fromId/toId 指向 payload 内存量则重映射新 UUID,指向 payload 外存量则标 dangling 红色高亮(B7 决策,复用 4.2 formula-reference RI dangling 机制)
**And** 位置偏移(x+2, y+2)防原地重叠
**And** 插入 1a.5 空间索引(R 树)
**And** 粘贴为单 CRDT 操作(方案 C 原子事务),不经 eval(AD-5,防畸形结构非密码学认证)

**Acceptance Criteria(外部文件阻断段):**

**When** 拖放文件到画布
**Then** 阻止所有类型文件拖放默认行为(preventDefault)
**And** 外部粘贴仅接受有效 `SD_ASCII_ENGINE://` 协议前缀纯文本,其他文本拒绝
**And** 图片/二进制静默拒绝(不报错不写入)

**Acceptance Criteria(B7 决策段 — dangling 高亮,方案 b):**

**When** 粘贴 flow 的 fromId/toId 引用 payload 外 stock
**Then** 不拒绝,标 dangling 红色高亮(端点箭头断头渲染)
**And** 与统一删除 RI formula-reference dangling 同机制(4.2 复用,方案 C 一致)
**And** 反指标维持:剪贴板畸形图元注入=0(字段级畸形仍拒);dangling 是引用级有效结构不属畸形范畴

#### Story 4.4: 画板独立撤销栈

As a 建模者,
I want 每画板独立撤销栈用户操作级粒度,
So that 误操作可逐画板回退不影响其他画板。

**前置:** 3.1(Yjs Y.UndoManager)+ 1a.7(工具栏撤销/重做按钮 UI 壳)+ 4.2(删除可 undo)+ 4.3(粘贴单 CRDT op 可 undo)
**AD:** AD-10(CRDT)
**FR:** FR-HISTORY-1

**Acceptance Criteria:**

**Given** 3.1 Yjs Y.UndoManager + 1a.7 撤销/重做按钮 UI 壳 + 4.2 删除 + 4.3 粘贴就绪
**When** 实现画板独立撤销栈
**Then** 每画板独立 Y.UndoManager(切换画板不影响各画板撤销栈,无跨画板 undo)
**And** 用户操作级粒度(非按键级):多个 CRDT op 归并为一个用户操作(如拖拽多步 op 归为一次移动),经 Y.UndoManager captureTransaction / addEventListener 归并
**And** 粘贴(4.3 单 CRDT op)undo 为一步(无跨事务 undo 归并)
**And** 栈限 100 步,超限丢弃最旧
**And** 入口复用 1a.7 工具栏撤销/重做按钮(Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
**And** 撤销/重做仅作用于当前活跃画板
**And** UX:切换画板时撤销栈独立(撤销作用于当前活跃画板,非上次操作画板)— 按下 Ctrl+Z 时若活跃画板栈空,toast 提示”当前画板无可撤销操作”(防用户预期”撤销跨画板粘贴”错位,B13)

### Epic 5: 赛博朋克交互质感与游戏化

**架构即内容(美学定位)**:承接产品级“架构即内容”定位(见上 §架构即内容),本 epic 是此美学的赛博朋克沉浸强化层 — FR-UI-6 10 项质感是“形式即内容”原理的沉浸强化(流量动画/blip/粒子/glitch/LVL UP/呼吸辉光/ASCII 控件/输入火花/CRT 漂移/per-glyph 辉光);VRAM 渲染管线(AD-9)+ 禁 per-glyph shadowBlur(CAP-11)是维护美学完整性的技术铁律;5.2 逃生阀可降级第 9/10 项,但“形式即内容”原理不破。

用户在建模中获得赛博朋克沉浸反馈(流量动画/辉光/CRT/音频/粒子)并解锁行为徽章触发 LVL UP,游戏化可开关。实现要点:FR-UI-6 全 10 项质感(前 8 硬渲染:流量流动/blip/粒子/glitch/LVL UP/呼吸辉光/ASCII 控件/输入火花;第 9/10 CRT 漂移+per-glyph 辉光经 AD-9 VRAM 图集路径复刻,验收口径目视不可区分 F1-quality,达不到不得回退 shadowBlur)+ 徽章系统(FR-GAME-2,内置触发器首个存量/首次连流量等,服务端从 CRDT op 流判定防伪造解锁,绑账号跨设备持久化)+ 总开关(FR-GAME-1,关后徽章不显示不影响建模协作)。**F1-quality spike 失败逃生阀**:Epic 1a 首 story F1-quality spike 若证实图集辉光无法达目视不可区分,第 9/10 项(CRT 漂移+per-glyph 辉光)作可 deferred story 不阻塞 Epic 5 前 8 项硬渲染交付——因 spec CAP-11 已锁"不得回退 shadowBlur 违 AD-9",失败时降级路径是"删除第 9/10 项渲染质感"而非"回退 shadowBlur";该决策在 spike story 内闭合,不在 epic 层预设删除。渲染质感依赖 Epic 1a VRAM 基座(F1-quality 风险经 1a 首 story spike 早暴露),徽章触发器含"首次跑仿真"依赖 Epic 1b 求解器,徽章从 CRDT op 流服务端判定依赖 Epic 3 yjs-go relay,徽章绑账号跨设备持久化依赖 Epic 2。

**FRs covered:** FR-UI-6, FR-GAME-1, FR-GAME-2(共 3,含 FR-GAME-2 split 主体)

#### Story 5.1: 交互质感前 8 项硬渲染

As a 建模者,
I want 赛博朋克沉浸反馈质感,
So that 建模过程有视觉与音频沉浸感。

**前置:** 1a.2(VRAM 基座)+ 1a.4(流量图元)+ 1a.7(工具栏控件)+ 1a.8(公式编辑器输入)
**AD:** AD-9(VRAM 图集,禁 per-glyph shadowBlur)
**FR:** FR-UI-6 前 8 项

**Acceptance Criteria(渲染基座段):**

**Given** 1a.2 VRAM 基座 + 1a.4 流量图元 + 1a.7 工具栏控件 + 1a.8 公式编辑器就绪
**When** 实现前 8 项交互质感
**Then** 前 8 项经 VRAM 渲染管线(AD-9),禁 per-glyph shadowBlur(per-glyph 辉光第 10 项在 5.2 经图集路径复刻)

**Acceptance Criteria(8 项分段):**

**And** (1)流量流动:流量箭头 `>>>>>>>` 行进动画(渲染循环驱动,依流量图元存在)
**And** (2)blip 音频:方波合成 blip(Web Audio API,事件触发)
**And** (3)徽章碎裂粒子 ASCII 弹片:粒子系统渲染基座(开发者手动触发验证,模拟徽章解锁事件;5.3 徽章解锁时触发,类 2.4/4.2 最小触发基座)
**And** (4)数值 glitch 解码动画(渲染循环)
**And** (5)LVL UP 大字 overlay:overlay 渲染基座(开发者手动触发验证;5.3 徽章升级时触发)
**And** (6)呼吸辉光:dt 按钮高亮(1a.7 工具栏 dt 选择器)
**And** (7)ASCII 风格控件:色相循环按钮 / 下拉菜单带 `>` 闪烁 / 徽章四角扫描器(1a.7 工具栏控件风格化)
**And** (8)输入火花:1a.8 公式编辑器输入火花动效

#### Story 5.2: 交互质感第 9/10 项 F1-quality 复刻

As a 建模者,
I want CRT 漂移与 per-glyph 霓虹辉光质感,
So that 赛博朋克氛围完整(经 VRAM 图集路径,目视不可区分)。

**前置:** 5.1(VRAM 渲染基座)+ 1a.2 spike 结论(可达 / 不可达)
**AD:** AD-9(VRAM 图集路径复刻)
**FR:** FR-UI-6 后 2 项

**Acceptance Criteria:**

**Given** 5.1 VRAM 渲染基座 + 1a.2 F1-quality spike 结论就绪
**When** 实现第 9/10 项
**Then** (9)CRT 背景漂移(经 VRAM 渲染管线)
**And** (10)per-glyph 霓虹辉光:经 AD-9 VRAM 图集路径复刻(离屏预渲染辉光图集 × 亮度档)
**And** 验收口径目视不可区分(与 prototype per-glyph shadowBlur 目视无差异,F1-quality)
**And** 不得回退 shadowBlur(CAP-11 锁,AD-9;降级路径是删第 9/10 项非回退)

**Acceptance Criteria(逃生阀段):**

**When** 1a.2 spike 结论为不可达(图集辉光无法达目视不可区分)
**Then** 本 story 标 deferred(不阻塞 5.1 前 8 项硬渲染 + 5.3 徽章)
**And** 降级路径是删除第 9/10 项渲染质感,非回退 shadowBlur(违 AD-9)
**And** 降级后原理③"阅读/观看双重性"不对称:"阅读"半义(读字符/存量语义)保全,"观看"半义(退一步看系统拓扑图形沉浸感)受损;核心建模语义可读性不降级,仅沉浸强化层缺失
**And** spike 可达则本 story 正常交付复刻

#### Story 5.3: 徽章系统 + 总开关

As a 建模者,
I want 行为徽章触发与游戏化总开关,
So that 建模动作有奖励反馈且可关闭游戏化层。

**前置:** 1a(首个存量/首次连流量/连 10 图元触发器)+ 1b(首次跑仿真/完成首模型触发器)+ 3.1(yjs-go relay ops 流)+ 2.4(user_badges write API)+ 5.1(toast 霓虹动效渲染基座)
**AD:** AD-16(绑账号 + 服务端判定防伪造)
**FR:** FR-GAME-2 主体 + FR-GAME-1

**Acceptance Criteria(触发器段 — 5 个):**

**Given** 1a 建模 + 1b 仿真 + 3.1 CRDT ops + 2.4 user_badges + 5.1 toast 渲染就绪
**When** 实现徽章触发器
**Then** (1)首个存量(依 1a)
**And** (2)首次连流量(依 1a)
**And** (3)首次跑仿真(标"依赖 1b 解锁")
**And** (4)连 10 图元(依 1a)
**And** (5)完成首模型(≥1 存量+≥1 流量并成功跑一次仿真,标"依赖 1b 解锁")

**Acceptance Criteria(服务端判定段 — 防伪造):**

**When** 触发器条件达成
**Then** 服务端调 3.1 expose ops 订阅接口读取 op 流判定达成(防客户端伪造,AD-16)
**And** 服务端判定达成并 award 后,经 AD-16 session WebSocket 通道 push 解锁事件到该 user 客户端,客户端触发 toast 动效(非客户端自判,防伪造)
**And** 判定语义:徽章达成后永久解锁(用户后续删图元/拆流量不回收,op 流累计历史达成事件);服务端重启重放 3.1 oplog 重建累计判定(幂等,award 表 INSERT OR IGNORE 防重复解锁)

**Acceptance Criteria(持久化段):**

**And** 触发器达成时调 2.4 `award(user_id, badge_id)` 写 user_badges(unlocked_at 服务端填 now() 防伪造时间)
**And** 徽章记录绑账号跨设备持久化(2.4 read API 跨设备同步)

**Acceptance Criteria(toast 动效段):**

**And** 徽章解锁即时 toast 霓虹动效(调 5.1 toast/粒子/LVL UP 渲染基座)+ ASCII 图标

**Acceptance Criteria(总开关段):**

**When** 用户在设置中开/关游戏化层(FR-GAME-1)
**Then** 关后徽章不显示不触发
**And** 不影响建模与协作核心(建模/协作功能不受总开关影响)

**Acceptance Criteria(降级段):**

**When** 1b 延期
**Then** "首次跑仿真"+"完成首模型"触发器后置(标"依赖 1b 解锁")
**And** 其他触发器(首个存量/首次连流量/连 10 图元)依 1a 可交付

### 后续(非 MVP)

**FR-GAME-3** 挑战关卡:内置预设场景(人口模型/库存振荡)+达标条件+达标判定(依赖仿真结果数值比对引擎,后续前置)。紧随 MVP 第一优先项,不进 MVP epic。

#### PRD 后续候选(本轮 epic 会审产出)

- **版本回滚/历史恢复**(来源 #18 客户支持剧场 → A3):share_token 泄露后 owner rotate(2.3)阻后续,但 rotate 前陌生人删图元已 CRDT 同步持久化无定点回滚;B1 备份治全丢不治定点回滚,定点回滚需版本历史 FR(非 MVP,PRD 后续)
- **审计日志**(来源 B3):owner 转让(2.2)/角色变更审计追溯;MVP 10 人单节点规模审计非核心(纠纷可人工排查单节点日志/数据库直查),后续规模化时加
- **硬核游戏化扩展**(来源 B4):MVP 入门徽章(FR-GAME-2)验证后,若用户要异星工厂式深度成就/自动化循环,PRD 加 FR-GAME 深度线(紧随 FR-GAME-3 后续)

## step-03 关注边界清单

> 来源:高级引导 #69 边界极值扫(epic 层预扫,为 step-03 story 验收标准铺垫)。下列边界需在 step-03 创建 story 时显式验收或决策;未列边界按 story 常规验收处理。

- **B4 协作 CRDT 同步压力**:NFR-PERF-2(10000 图元 ≥30 FPS)是单画板渲染指标,10 人认证并发编辑同画板的 CRDT 同步压力未显式覆盖。step-03 协作 story 须补"10 人并发编辑"验收点。
- **B6 房主迁移与整步边界竞态**:房主迁移瞬间,原房主可能正处牛顿迭代中间步(非整步收敛值)。快照须取整步收敛值(FR-COLLAB-4),迁移触发与整步边界的竞态须在房主迁移 story 验收(快照不含中间步值)。
- **B7 剪贴板粘贴流量端点存量不在 payload**:外部粘贴的流量 fromId/toId 引用 payload 外存量时,FR-BOARD-2 结构白名单"fromId-toId 引用存在于 payload"倾向拒绝,但与统一删除 RI 的 formula-reference dangling(不删流量,红色高亮)取向需对齐。step-03 须决策:跨 payload 端点引用是拒绝(白名单严)还是 dangling 高亮(与 RI 取向一致)。
- **B9 OAuth 双 provider 同邮箱两账号不合并**:users 表 UNIQUE(oauth_provider, oauth_user_id) 允许同邮箱两行(GitHub 账号 + Google 账号各一行),两账号画板不互通。step-03 Epic 2 登录 story 须明示此行为(不自动合并账号)。

**#68 Performance Profiler Panel 补充:**

- **B-perf-1 行进动画性能 AC 缺失**:Story 5.1(1)流量箭头行进动画是渲染循环驱动(依流量图元存在),NFR-PERF-1(1000 图元 ≥ 60 FPS)在 Epic 1a 静态渲染验收,Epic 5 动态行进未显式补"1000 流量图元全行进 ≥ 60FPS"验收。step-03 Story 5.1 须补 60FPS 约束 AC(行进动画不破 NFR-PERF-1),或显式声明行进动画图元数上限为性能边界。
- **B-perf-2 CRDT 合并重绘突刺未 KPI**:NFR-PERF-1 稳态帧率,NFR-PERF-3 协作延迟 P95,但远端批量操作(如粘贴大量图元)到达瞬间触发大范围脏矩形重绘掉帧未覆盖。F4 美学连续性边界承认视觉跳变(美学非硬 AC),但合并瞬间渲染性能突刺(硬 KPI 维度)未补。step-03 协作 story 须补"批量操作合并瞬间帧率"验收,或显式声明合并突刺为可接受瞬时掉帧(定性口径,类 F4 美学连续性非硬)。

**#1 可观测性/监控 + #6 可访问性补充:**

- **B-obs-1 前端性能 metrics 采集未覆盖**:NFR-PERF-1~5(60FPS/协作延迟/加载/内存)是 KPI,但客户端侧性能 metrics 采集上报未定——云平台内置监控是后端侧(stdout/进程),前端浏览器侧 60FPS/加载/内存 RUM(Real User Monitoring)未覆盖,运维无法知线上客户端性能达标。step-03 须补前端性能 metrics 采集 AC,或声明实施期 RUM 接入。
- **B-obs-2 CRDT 同步延迟测量未定**:NFR-PERF-3(协作延迟 P95 ≤ 100ms)有 KPI,但 yjs-go relay 是否记录 op 延迟 metrics / 测量方式未定。step-03 协作 story 须补 op 延迟测量 AC(relay 侧记录 + 上报)。
- **B-a11y-1 a11y 范围=视觉工具定位(产品决策)**:MVP a11y 范围定为视觉工具定位——覆盖:键盘导航/色盲(字符双编码)/前庭(prefers-reduced-motion)/对比度 + 图元属性(name/formula/value)屏幕阅读器可达;显式声明拓扑图形本质视觉不可达(原理③"观看"半义),非屏幕阅读器覆盖拓扑。step-03 各 story 须按此范围补 a11y AC;拓扑图形屏幕阅读器不可达是显式边界非遗漏。
- **B-a11y-2 prefers-reduced-motion 未覆盖**:Epic 5 行进动画/glitch/CRT 漂移对前庭功能障碍用户,须响应 prefers-reduced-motion。降级路径(删第 9/10 项或减弱动画)可由 prefers-reduced-motion 触发。step-03 Story 5.1/5.2 须补 prefers-reduced-motion AC。

**BMad AR/ECH 审查登记（2026-07-02）:**

> 来源:bmad-review-adversarial-general（AR，15 finding）+ bmad-review-edge-case-hunter（ECH，28 unhandled path）两轮正交审查。epic 层硬伤已直接修订:AR#1 删除前移（Story 1a.7 AC + Epic 1a desc）/ AR#2 反指标 live-migration scope（NFR-SUCCESS-5 + Story 3.5 反指标 AC + B12 AC）/ AR#7a ERD last_opened_at / AR#10 Epic 2 使能层例外注。下列为转 step-03 story AC 期落实或决策项。

**AR 剩余登记（12 项，转 step-03 story AC）:**

- **AR#3 origin_user_id stamping authority 未定**（Story 3.1 / 5.3）:expose ops 的 origin_user_id 标注"防伪造（AD-16）"，但未明示由 relay 在 ingress 从认证 WS session stamp 还是读客户端 Yjs op.origin。若后者，任何客户端可伪造 op 作者——瓦解 5.3 服务端徽章判定依赖的该字段。step-03 Story 3.1/5.3 须补 AC:origin_user_id 由 relay ingress 从认证 session stamp，忽略客户端 op.origin。
- **AR#4 share_token viewer 身份/在线模型未定义**（Story 2.3 → 3.1 → 3.2）:viewer 持只读 token 仍经 WS 连接（3.1）并出现于在线列表（3.2 需 {id,name,color}）。viewer 是否获 AD-16 session / 瞬时身份 / 匿名在线未定。step-03 Story 2.3/3.2 须决策 viewer 身份模型并补 AC。
- **AR#5 七条 NFR 无 story 级验收 AC**:NFR-PERF-1（1000 图元 ≥60FPS）/ PERF-4（加载 ≤2s）/ PERF-5（内存 ≤50MB）/ PERF-7（多客户端偏差 <0.001%）/ REL-1（99.9%）/ REL-3（auto-reconnect + op replay）/ SUCCESS-1（首次建模 ≤5min）零 story AC。step-03 各相关 story 须补可验证 AC（PERF-1→1a.5/5.1；PERF-4→1a.1/1b.1；PERF-5→1b.x；PERF-7→1b.3；REL-1/3→3.x；SUCCESS-1→1a 闭环验收）。
- **AR#6 Story 格式不一致**:Epic 2/3 全部 story 缺 "As a... I want... So that..." framing，违反 step-02"用户价值导向"原则。step-03 须补齐 Epic 2/3 各 story 的用户价值陈述。
- **AR#7b boards 表 board name 字段缺失**（line 199 ERD vs Story 4.1）:board name 仅存 CRDT boardMetadata（FR-COLLAB-1），但最近画板列表（4.1）须渲染画板名——要么 lazy-load 每板 CRDT（昂贵），要么关系表缺 name 列。step-03 Story 4.1 须决策:boards 表加 name 冗余列（CRDT 同步时 server stamp）或列表 lazy-load CRDT。
- **AR#8 B# 决策可追溯性断裂**:ACs 引用 B2/B3/B5/B10/B12/B13/B14，但本边界清单仅登记 B4/B6/B7/B9 + B-perf/B-obs/B-a11y，其余 B# 仅 inline 括注无索引，读者/step-03 story 作者无法追溯其来源与全文。step-03 须从 epics.md 各 inline 括注回收 B2/B3/B5/B10/B12/B13/B14 全文归入本清单，或确认其失效。
- **AR#9 yjs-go 全量重同步 fallback 性能未界**（Story 3.1 line 762）:"降级全量同步快照对齐 oplog"对 10000 图元板每次重连触发将破 NFR-PERF-3（P95 ≤100ms）。step-03 Story 3.1 须补 AC:全量重同步的频率/成本上限/防重连风暴守卫。
- **AR#11 a11y 零 epic 级 AC**:B-a11y-1 承诺范围（键盘/色盲/前庭/对比度/屏幕阅读器），但无 story 带 a11y AC，step-03 继承全部 a11y 负担 cold，欠交付风险高。step-03 各 story 须按 B-a11y-1/B-a11y-2 范围补 a11y AC（见上文 B-a11y 段，本项强调 epic 层无 hook 的风险，非重复登记）。
- **AR#12 无 UX-state stories**:板加载（≤2s 窗 NFR-PERF-4）/ WS 重连（NFR-REL-3）/ 空画板 / 运行时错误 / 404/403（share token 失效）的 UX 状态未定，仅仿真域弹窗（代数环/溢出/降级）有 spec。step-03 须决策:新增 UX-state story 或并入各相关 story AC。
- **AR#13 live badge push 多 tab/off-board 路径未处理**（Story 5.3 line 1100）:push 经"该 user 当前 board WS 通道"，但用户多 tab（≤5）或不在任何板时哪个 WS 接收?徽章在板 A 赚得而用户在板 B 时 live toast 丢失（仅 2.4 读最终一致兜底）。step-03 Story 5.3 须补 AC:多 tab 推送 / 离板时降级 2.4 读最终一致。
- **AR#14 award API 限速 threat model 不清**（Story 2.4 line 728）:award() 供 Epic 5 服务端判定调用（server-to-server），却加"award write API 速率限制"。若仅可信服务端可调，限速无 threat model；若客户端可调，5.3"防客户端伪造"弱化。step-03 Story 2.4 须澄清 award API 调用面（仅 server 内部 vs 暴露 client）并相应调整限速/鉴权 AC。
- **AR#15 SQLite WAL 备份机制 underspecified**（Story 1a.1 line 281）:"整库 cp 到第二路径"对 WAL 模式 SQLite（raw cp）捕获不一致状态。step-03 Story 1a.1 须补 AC:备份原语用 VACUUM INTO / .backup API / checkpoint+cp（main+-wal），恢复测试验证可还原。

**ECH 28 unhandled paths 登记（按域分组，step-03 各 story 补 guard AC）:**

- **数值边界（6，Epic 1b Wasm Numeric Core）:**
  - E1（line 59）:全 stock initialValue=0 → threshold=max(abs)*1e6=0 熔断。guard:threshold=max(maxAbsInitial,epsilon)*1e6 带 epsilon floor。→ Story 1b 数值核心
  - E2（line 543-547）:allowNegative=false 的 stock 以负 initialValue 创建。guard:创建时 reject initialValue<0 when allowNegative=false。→ Story 1b
  - E3（line 493-495）:Flow fromId==toId（self-loop）。guard:创建时 reject fromId==toId。→ Story 1a/4
  - E4（line 496）:DELAY delay≤0。guard:compile transform 时 reject delay≤0。→ Story 1b
  - E5（line 511）:Jacobian rank-deficient LU 奇异。guard:catch LU singular → FR-SIM-8 降级或 halt。→ Story 1b
  - E6（line 593）:已最简模型上点 Simplify。guard:无降级组合时 disable 按钮 + toast。→ Story 1b
- **画布边界（5，Epic 1a/3 Canvas）:**
  - E7（line 39）:Pan 到 Float64 精度极限。guard:clamp world coord 范围或 warn precision loss。→ Story 1a
  - E8（line 381-384）:zero 图元 minimap。guard:空画板渲染 empty minimap placeholder。→ Story 1a
  - E9（line 47）:stock width/height≤0 或非数。guard:创建时 validate width/height>0 numeric。→ Story 1a
  - E10（line 48）:无 flow 附着的 orphan cloud。guard:allow orphan 或 persist 时 warn。→ Story 1a/4
  - E11（line 49）:两 parallel flows 同 fromId/toId。guard:allow 或 warn duplicate。→ Story 1a/4
- **CRDT 竞态（4，Epic 3/4）:**
  - E12（line 845-846）:host 心跳丢失窗口后重连（flapping）。guard:grace period + old-host 在 re-election 时 stand down，防 split-brain。→ Story 3.5
  - E13（line 822）:stockValue NaN broadcast。guard:NaN 时 skip/halt broadcast。→ Story 3.x
  - E14（line 768）:OpLog 无界增长。guard:oplog compaction/snapshot threshold 策略。→ Story 3.1
  - E28（line 870）:三路并发重冲突 AST merge。guard:定义 multi-way merge order 或 last-writer-wins。→ Story 4.x
- **剪贴板/undo（3，Epic 4）:**
  - E15（line 963-964）:CRC32 碰撞（非加密）。guard:CRC32 后加结构 parse validation。→ Story 4.x
  - E16（line 963）:paste payload 0 或巨量 element count。guard:insert 前 enforce count bounds [1..N]。→ Story 4.x
  - E17（line 1009）:undo 后新 op 使 redo stack stale。guard:new user op 时 clear redo stack。→ Story 4.x
- **认证边界（5，Epic 2/3）:**
  - E18（line 638-641）:OAuth provider down / email null / state expired。guard:toast 处理 provider error/null-email/expiry。→ Story 2.2
  - E19（line 650）:session token 中途过期（active WS）。guard:WS token-expiry → graceful reconnect + refresh。→ Story 2.4/3.1
  - E20（line 680-682）:owner transfer 到 self / non-member / non-existent。guard:validate target is member, !=self, exists。→ Story 2.x
  - E21（line 705）:token rotation 时 viewer 持 active session。guard:invalidate rotated token 派生的 sessions。→ Story 2.4
  - E22（line 727）:award() 给 non-existent badge_id/user_id。guard:INSERT OR IGNORE 前 FK check。→ Story 2.4/5.3
- **Wasm（1，Epic 1b）:**
  - E23（line 479）:Wasm worker 反复 crash loop。guard:crash-loop limit → halt + notify。→ Story 1b
- **徽章/质感（4，Epic 5/1a）:**
  - E24（line 1094）:sim 经 FR-SIM-6 熔断 halt 时"完成首模型"badge。guard:定义 halted sim 是否算"成功跑一次"。→ Story 5.3
  - E25（line 1041）:Web Audio autoplay policy 阻挡 blip。guard:首次 user gesture 时 resume AudioContext。→ Story 5.x
  - E26（line 513）:仿真运行中改 time unit。guard:time-unit 变更前 pause sim。→ Story 1b
  - E27（line 439）:i18n missing translation key。guard:missing key 时 fallback English。→ Story 1a.9

## Decision Log

> 来源:高级引导 #64 ADR 化。记录本轮 epic 设计的关键决策与依据,供 step-03 story 创建与后续审计追溯。

**ADR-EPIC-1: 拆 Epic 1 → 1a(建模+渲染)+ 1b(Wasm 求解器)**

- **Context**: 原 Epic 1 单体 23 FR 含双高风险(F5-perf 雅可比全重算+稀疏 LU 性能 / F1-quality 图集辉光目视验收),#59 批判视角检出 step-02"fewer larger 前提对 Epic 1 内高风险子系统方向未定不成立"(F5-perf/F1-quality open question 使方向未定)。
- **Options**: (a) 维持单体[高风险阻塞建模价值交付] / (b) 拆 1a/1b[高风险隔离,建模价值不被 Wasm 阻塞] / (c) 按技术层拆[违 step-02 用户价值导向,反例]。
- **Decision**: (b) — Epic 1a(14 FR:画布/图元/UI/VRAM 基座)+ Epic 1b(9 FR:Wasm 求解器/sparkline)。
- **Rationale**: F5-perf 隔离不阻塞 prototype 有雏形的建模/渲染价值;1a 首 story 做 F1-quality spike 早暴露辉光风险(传导至 Epic 5 第 9/10 项);规避技术层 epic 反例。

**ADR-EPIC-2: Epic 2 认证标"使能 epic"显式例外**

- **Context**: Epic 2 零 PRD FR 编号,step-02 用户价值导向下零 FR 本是反例。
- **Options**: (a) 并入 Epic 3[auth 与协作耦合] / (b) 单列标使能 epic[AD-16/17 架构重独立便于实施] / (c) 拆散到各 epic[auth 逻辑分散难实施]。
- **Decision**: (b) — Epic 2 单列并显式标"使能 epic"。
- **Rationale**: AD-16/17 架构重独立成 epic 便于实施;显式标注是用户价值导向原则的显式例外(非隐式技术层),规避 step-02 反例。

**ADR-EPIC-3: FR-COLLAB-1 / FR-GAME-2 split 标注**

- **Context**: 两 FR 跨功能 epic 主体 + Epic 2 子句,不同 AD 对应(FR-COLLAB-1: AD-10 CRDT 文档模型 + AD-17 owner 归属;FR-GAME-2: AD-16 绑账号)。
- **Decision**: split 标注,主体归功能 epic(FR-COLLAB-1 主体→Epic 3,FR-GAME-2 主体→Epic 5),子句归 Epic 2,step-03 各拆两 story 分属两 epic。
- **Rationale**: AD 锚点不同,实施期不同 story;标注使覆盖率无重复计数(主体一处、子句支撑)。

**ADR-EPIC-4: 依赖序修正(FM-1/FM-2)**

- **Context**: 原 Epic 4"仅需 Epic 1"、Epic 5"需 Epic 1+2"逻辑错(#58 失效模式检出)。
- **Decision**: Epic 4 依 Epic 1a + Epic 2 + Epic 3.1(Yjs);Epic 5 依 Epic 1a + Epic 1b + Epic 2 + Epic 3。
- **Rationale**: FM-1 画板 owner_user_id 是 AD-17 Epic 2 子句,Epic 4 在认证前提下才无匿名画板后续迁账号债;FM-2 徽章“首次跑仿真”触发器依赖 1b,徽章从 CRDT op 流服务端判定依赖 Epic 3 yjs-go relay;FM-3(step-04 依赖核验补)Epic 4 的 FR-BOARD-1 标签页切换暂停 Y.Doc 同步、FR-BOARD-2 剪贴板单 CRDT op 原子事务、FR-HISTORY-1 Y.UndoManager 均依 Epic 3.1 Yjs(1a.3/1a.4 用 plain properties 无 Yjs),story 前置已含 3.1,epic-level 描述同步修正非 3/4 并行。
