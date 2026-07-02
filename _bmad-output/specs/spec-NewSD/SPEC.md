---
id: SPEC-NewSD
companions:
  - ../planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md
  - architecture-diagrams.md
  - math-constraints.md
  - stack.md
sources:
  - ../planning-artifacts/prds/prd-NewSD-2026-06-26/prd.md
  - ../planning-artifacts/prds/prd-NewSD-2026-06-26/addendum.md
---

> **Canonical contract.** 本 SPEC 及 `companions:` 所列文件共同构成 NewSD 的完整、经保留性验证的"建什么/测什么/验什么"契约。frontmatter 中 `sources:` 仅供追溯——其每条 load-bearing 内容已落入 kernel 或 companion,下游不再读 sources。spine 作为 adopted companion 仍是下游必读(AD ID 为稳定引用锚点)。

# NewSD — 赛博朋克 ASCII 系统动力学多人协作建模平台 MVP

## Why

一款**赛博朋克风格、基于 ASCII 字符渲染**的多人协作系统动力学建模平台。现有工具(Vensim / Stella / Insight Maker)的痛点是:界面复杂入门门槛高、缺乏实时多人协作、设计千篇一律缺乏沉浸感、仿真工具用陈旧架构与渲染方式。

NewSD 要让用户在无限 ASCII 画布上用字符图元搭存量-流量模型(SFD)、运行数值模拟、并实时多人协作,把"复杂系统的运行逻辑"在游戏化交互中被自行感知——而非对用户实施"教学"。

这是一组**愿景 + 痛点**组合:愿景是"赛博朋克终端里的高阶建模玩具"这个我们想让它存在的东西;痛点是上述四类工具缺陷。受众合并为单一"游戏者"(按 L1/L2/L3 成熟度分层暴露数值内核,非按角色单列)。MVP 主打游戏化探索场景。

锚定张力(每个下游 trade-off 都对此求解):**交互简洁性 ↔ 数值深度**。硬约束门槛是"数值深度不妥协交互简洁性",逃生阀是"MVP 体量超载时的降级回调"。这两者共同定义本产品的可接受解空间。

## Capabilities

> CAP 按"用户/系统能做什么"蒸馏,非 1:1 复读 PRD 的 19 个 FR。FR ID 在 `success` 里作可测证据保留。能力域归并:画布 → 图元 → 求解 → 仿真可视化 → 协作 → 多画板/剪贴板 → 撤销 → 界面 → 游戏化。

- **CAP-1  ASCII 无限画布建模**
  - **intent:** 用户在无限 ASCII 画布上平移/缩放视图,放置存量、源/汇、流量三类图元,连线建 SFD 模型。
  - **success:** 1000 图元画布 ≥ 60 FPS,10000 图元 ≥ 30 FPS(FR-CANVAS-4);minZoom=0.05/maxZoom=20,Float64 世界坐标 + 3×2 仿射投影(FR-CANVAS-1);网格吸附换算回屏幕恒 8px(FR-CANVAS-2);存量/源汇/流量三类图元字符画渲染(FR-CANVAS-3, FR-ELEM-1/2);源汇为单一图元类型 cloud,source/sink 为方向语义角色非独立 type,不设极性字段(方向由 flow fromId→toId 涌现,FR-ELEM-2);流量 Bresenham 网格寻路 + 端点箭头 + 端口吸附(FR-ELEM-3/4);小地图常驻 + 脏矩形联动增量更新(FR-CANVAS-5)。

- **CAP-2  公式与量纲语义建模**
  - **intent:** 用户为流量写公式(以 `@<uuid>` 引用存量),系统编译期推导量纲并软警告不一致,重命名存量不断公式引用。
  - **success:** 公式 AST 以 stockId 引用存量,重命名只改 name 不动 id(FR-ELEM-3);常数可带单位标注 `[单位]`(FR-ELEM-3);量纲校验编译期逐子表达式推导,不一致仅软警告不阻断(FR-SIM-7);公式编辑时实时校验红色高亮(FR-UI-2)。

- **CAP-3  隐式求解器数值模拟**
  - **intent:** 用户点播放,系统用隐式 BDF + 牛顿迭代 + 自动微分求解刚性系统,全程不暴露求解器档位术语。
  - **success:** 隐式 BDF + 牛顿迭代 + 自动微分求解刚性系统(FR-SIM-1);后向欧拉/BDF 按阶数状态机起步(AD-7);雅可比由 AST 自动微分 + LU 分解(AD-6/AD-8);100 存量 ≥ 100 步/秒(PRD §1.4);代数环编译期剪边拒绝不因隐式可解放行(FR-SIM-2);单收敛值保物质守恒(FR-SIM-3);非负钳制作用于流出速率非存量结果,无幽灵渗漏(FR-SIM-4);DELAY 展开为串联幽灵存量(FR-SIM-5/7)。

- **CAP-4  透明降级与熔断**
  - **intent:** 不收敛或数值溢出时,系统自动降级或熔断,用户仅经"播放-暂停-一键恢复"单一透明手势应对,不接触档位。
  - **success:** 收敛压力 → FR-SIM-8 降级链(BDF→后向欧拉→显式),sparkline 旁黄点闪烁不暂停不弹窗;降级链仍失败 → 弹**单按钮**"简化模型以继续",点击后自动执行预设降级组合续跑(无第二按钮无参数面板);数值域溢出(NaN/Inf/量级突变)→ FR-SIM-6 `[SYSTEM HALTED]` 熔断暂停;资源耗尽(Wasm.Memory 64MB / 单步 >500ms / AST >5000 节点 / 牛顿 >100 迭代)→ 熔断(AD-5 边界裁定,熔断与降级不混淆触发)。

- **CAP-5  ASCII 趋势可视化**
  - **intent:** 用户点播放后,每个存量方框旁实时显示 ASCII sparkline 趋势 + 当前数值与单位,看"人口(人)随时间增长"而非无量纲曲线。
  - **success:** 每存量方框旁 ASCII sparkline(FR-SIM-VIZ-1),字符集 `▁▂▃▄▅▆▇█`,保留最近 N 步(默认 32)与 dt 解耦;存量方框同步显示 currentValue + units(不归一化);纯字符渲染不引图表库;L3 完整时序面板为后续不含 MVP。

- **CAP-6  CRDT 实时多人协作**
  - **intent:** 多用户同时编辑同一画板,光标/选区实时跟随,公式语义感知合并不破坏 AST 语义,房主断线自动迁移续跑。
  - **success:** Yjs CRDT 文档模型——Y.Map("elements") 嵌套 AST + paren 旁路 Y.Array + pending 节点 Y.Text(FR-COLLAB-1, AD-13/AD-14);存在感知协议——光标/选区/用户信息 ≤30Hz 节流广播 + 视口剔除(FR-COLLAB-2);并发编辑不同 AST 子节点按节点级合并(FR-COLLAB-6);结构冲突分级回退(AD-10:轻标区锁子树 / 重文本级);协作延迟 P95 ≤ 100ms(PRD §1.4);多客户端数值偏差 < 0.001%;房主迁移续跑带 CRDT 版本校验,反指标"房主迁移仿真清零 = 0"(AD-11/FR-COLLAB-3);非房主订阅房主广播不本地算仿真步(AD-15)。

- **CAP-7  仿真态房主权威与迁移**
  - **intent:** 仅房主客户端跑仿真,服务端中继不计算;房主断线新房主从服务端仿真态快照续跑不回退 t=0。
  - **success:** 仿真态广播 ≤30Hz 整步结果,客户端接收渲染不回写 CRDT(FR-COLLAB-4);服务端进程内存持有最新仿真态快照,会话级不持久化(FR-COLLAB-5);快照附 clientID+clock 版本向量,新房主校验对齐→续跑 / 不对齐→增量重跑(AD-11)。

- **CAP-8  多画板与跨画板剪贴板**
  - **intent:** 用户最多同时开 5 个画板,可跨画板复制粘贴图元,粘贴通道拒绝畸形/非法结构。
  - **success:** 每客户端 ≤5 画板,超限提示(FR-BOARD-1);剪贴板 Base64+JSON + `SD_ASCII_ENGINE://` 协议头 + CRC32,结构白名单校验(字段类型合法 / UUIDv4 / fromId-toId 引用存在于 payload / 无未知字段)任一不合规拒绝(FR-BOARD-2);粘贴为单个 CRDT 插入事务(分配新 UUID 重映射连接 + 位置偏移),粘贴完成前**允许连线**(假设 3 = 选项 B),撤销时**级联删除**粘贴图元及其后所连流量;外部文件/图片/无协议头二进制静默拒绝(FR-BOARD-3);反指标"剪贴板畸形图元注入 = 0"(不经 eval,不承诺密码学认证)。

- **CAP-9  画板独立撤销栈**
  - **intent:** 每个画板独立撤销/重做,粘贴等操作视为单一原子事务。
  - **success:** 每画板独立 Y.UndoManager,撤销粒度用户操作级非按键级,栈限 100 步(FR-HISTORY-1);粘贴后连线的流量与粘贴图元绑定为级联删除组,撤销粘贴时一并删除(假设 3 = 选项 B,级联边界 = 粘贴事务插入的图元 + 其后在同一撤销窗口内连出的流量)。

- **CAP-10  赛博朋克界面 chrome 与双语**
  - **intent:** 用户在赛博朋克终端风界面里操作,中英双语可即时切换,工具栏/属性面板/状态栏齐全。
  - **success:** 顶部工具栏(文件/编辑/工具切换/模拟控制/dt 选择器/缩放指示器)(FR-UI-1);右侧属性面板存量/流量属性编辑 + 实时校验(FR-UI-2);底部状态栏(模拟时间/图元计数/在线用户/FPS/连接状态/量纲概要 L2 渐显)(FR-UI-3);中英双语运行时切换即时生效,用户输入 name/公式不切换,默认跟随 navigator.language(FR-UI-4);模型级时间单位设置触发全模型量纲重校验(FR-UI-5)。

- **CAP-11  交互质感层(赛博朋克沉浸反馈)**
  - **intent:** 用户操作时获得类游戏工具的爽快像素级反馈,沉浸于赛博朋克氛围。
  - **success:** 硬 FR 8 项 MVP 渲染(流量流动 `>>>>>>>` / 音频 blip / 徽章碎裂粒子 / 数值 glitch 解码 / LVL UP 大字 / 呼吸辉光 / ASCII 风格控件 / 输入火花)(FR-UI-6);第 9/10 项(CRT 背景漂移 + per-glyph 辉光)经 AD-9 VRAM 图集路径复刻质感,验收口径锁定为**目视不可区分**——图集辉光须与 prototype per-glyph shadowBlur 目视无差异;实现期跑质感原型 vs shadowBlur 目视对比验证,达不到此口径不得回退 shadowBlur(违 AD-9),须按 FR-UI-6 不达标处理并重评渲染方案(F1-quality open question 由此 spec 收口为严格口径)。

- **CAP-12  可选游戏化层**
  - **intent:** 用户可开关游戏化层,基于建模动作触发行为徽章激励探索(不依赖仿真结果质量)。
  - **success:** 总开关关后徽章不显示不触发(FR-GAME-1);行为徽章 MVP 内置触发器(首个存量/首次连流量/首次跑仿真/连 10 图元/完成首模型),ASCII 图标 + 即时 toast 霓虹动效(FR-GAME-2);徽章记录绑账号跨设备持久化(AD-16,见 CAP-13);挑战关卡为后续不含 MVP(FR-GAME-3)。

- **CAP-13  OAuth 认证与画板权限**
  - **intent:** 用户经 GitHub/Google 登录获跨设备身份,徽章跟随账号;画板 owner 可邀 editor 协作、生成只读分享链接给 viewer,权限由服务端网关强制非客户端自检。
  - **success:** OAuth 直连 GitHub+Google(零费用,双 provider 共享 users 表 UNIQUE(oauth_provider, oauth_user_id))(AD-16, FR-GAME-2 跨设备持久化);登录后 session token(非 JWT)双通道下发——HttpOnly Secure Cookie + JSON body(解 JS 不可读 cookie 致 WS 首帧 token 矛盾),WS 握手首帧 token 鉴权(token 仅存 JS 内存不可跨域读取致浏览器端 WS CSRF 不可行,Origin 头 defense-in-depth),SameSite=Lax 防 HTTP CSRF;三角色 owner(全部+删+转让+改权限)/ editor(编辑 CRDT)/ viewer(只读订阅,CRDT op 网关拒收)(AD-17);owner 转让与角色修改走认证 HTTP 端点(非 CRDT,防 editor 伪造提权);权限变更经 `role_change` WS frame 传播到已连接客户端(drain 待处理 op 保原子性);share_token crypto/rand ≥128 bits + URL-safe base64 + owner 可轮换;徽章触发由服务端从 CRDT op 流判定(防客户端伪造解锁);`[SYSTEM HALTED]` 熔断事件经 WS 上报服务端写 stdout(AD-18 云日志捕获)。

## Constraints

> 架构层 18 条 AD 是已裁定的 design-bender(逐条 Rule 见 spine companion)。此处列 kernel 级要点 + 产品/数学层约束。下游子系统不得违背 AD,见 `ARCHITECTURE-SPINE.md` AD-1..AD-18。

- **四范式为顶层不变量(AD-1):** Host-Authoritative Simulation / CRDT Document Model / Wasm Numeric Core / Fixed-Point Canvas Render。子系统 AD 不得违背。防止:仿真散到多客户端 / 渲染回退 shadowBlur / 数值跑 TS 主线程。
- **单节点云托管部署包络(AD-2/AD-18):** MVP 单节点单 Go 二进制 + SQLite WAL,部署目标 = 云托管单节点(Fly.io/Railway/Render/云 VM,实现期选),Dockerfile + CI/CD 必备;裸机直跑技术可行但非官方目标。独立可观测栈走云平台内置(非独立产品);客户端 `[SYSTEM HALTED]` 熔断事件经 WS 上报服务端写 stdout。水平迁移(PostgreSQL/Redis/多节点 WS 网关)走 addendum §3.2 可观测阈值触发,非 MVP;垂直扩容优先。防止:运行包络整维度空缺 / 裸机部署无 CI/CD / SaaS 无域名 TLS。
- **Go 单体后端 + yjs-go 中继(AD-3/AD-4):** 后端单 Go 进程不引入 Node 服务;CRDT 中继用 yjs-go(averyyan/yjs-go),遇阻回评自研非退 Node。caveat:reputation Medium 成熟度低于 JS y-websocket,实现期首验 sync protocol。防止:双语言栈 IPC 复杂度 / Node 弱类型演进。
- **Wasm 求解器内核边界(AD-5):** 所有仿真步数值求值经 Wasm,TS 不得直接跑仿真步;编译期拓扑检查拒绝代数环(FR-SIM-2)不因隐式可解放行;熔断(资源/迭代预算超限)与降级(残差非收敛)边界不混淆(见 CAP-4)。防止:TS 主线程数值爆炸污染 UI / 恶意公式无沙箱逃逸。
- **求解器 crate 组合(AD-6):** 手写递归下降 parser(复用 prototype formula.ts 结构扩 `@uuid`/`[单位]` 产生式) + autodiff crate 0.7.0 + faer 0.24.4 LU。**mexpr/meval 不存在于 crates.io 已弃用**;不引入 meval。AST 为单一真相源供 autodiff 图/量纲校验/tokenizer 共用。防止:meval 不暴露 AST 致双源翻译层 / 全手写 AD 数值正确性自担。
- **BDF 起步 + 雅可比活动集(AD-7/AD-8):** BDF-1~2 不上 BDF-3+,按阶数状态机起步 + 牛顿初始猜测按阶数分配外推法;雅可比约束激活后全重算(非 Broyden,100 存量规模收益边际小) + 滞回带防 Chattering。防止:BDF-2+ 恒值外推退化 / Broyden 累积漂移后期发散难排查 / Chattering 性能崩。
- **VRAM 渲染(AD-9):** 辉光图集(离屏预渲染每 ASCII 字符 × 亮度档) + VRAM 双缓冲(字符码缓冲 + 颜色索引缓冲) + 色相偏移 GPU 片段着色器,nearest 采样保像素风。**禁 per-glyph shadowBlur**(prototype 逐字符 shadowBlur 弃用)。防止:shadowBlur 逐字符 GPU 模糊致 1000 图元@60FPS 不可达 / 改 PRD 违硬约束门槛 KPI。
- **AST 冲突分级回退(AD-10):** 合并后拓扑比较检测,轻冲突(括号改结合性 / 运算符替换局部)标区 + 锁子树,重冲突(删子树幽灵编辑)回退文本级 CRDT 降级。阈值判定"运算符语义改变或幽灵引用 = 重"。防止:单一策略场景 C 覆盖硬伤。
- **快照-CRDT 版本对齐(AD-11):** 快照附 clientID+clock 向量,新房主校验对齐→续跑 / 不对齐→增量重跑,不阻塞 CRDT。保反指标"房主迁移仿真清零 = 0"。防止:旧模型结构+新初始值续跑跳跃不连续 / 阻塞 CRDT 损协作。
- **降级接口抽象(AD-12):** MVP 须定义三项抽象接口(数据兼容层支持 Y.Map AST 与 flat string 两种公式格式 / 编辑器抽象 / 校验管道抽象)隔离降级两端且非空,降级逻辑本身可不实现但接口契约须可验证。防止:⑤ 降级名存实亡 / 体量超载时重构成本非线性。
- **待定节点 Y.Text + paren 旁路(AD-13/AD-14):** pending 节点 `{type:'pending', rawText:Y.Text, cursorHint:number|null}` 并发输入合并不丢字;paren 作 AST 外旁路 Y.Array of maps 按 nid(UUIDv4)引用,非 AST 内 group 节点;nid 单调递增计数器非 hash,子树重建旧 nid 保留语义。防止:string 键级 LWW 并发输入一边丢 / 显式 group 啰嗦+静默改写用户输入。
- **非房主订阅非计算(AD-15):** 非房主客户端权威仿真显示态由房主广播驱动(订阅非计算),本地 Wasm 仅限非仿真预览(量纲/视觉)。防止:非房主本地算仿真步致与房主结果分叉 / 每次按键仿真显示闪烁。
- **OAuth 认证(AD-16):** GitHub+Google 直连(零费用,不经 Auth0/Clerk),双 provider 共享 users 表 UNIQUE(oauth_provider, oauth_user_id);session token(非 JWT)双通道下发——HttpOnly Secure Cookie + JSON body(解 JS 不可读 cookie 致 WS 首帧 token 矛盾);Go 内存 + SQLite session 表持久化(进程重启会话不丢);WS 握手首帧 token 鉴权,token 仅存 JS 内存不可跨域读取致浏览器端 WS CSRF 不可行,Origin 头作 defense-in-depth;client_secret 走 server env 不入前端 bundle;MVP 不含自托管账号密码。防止:匿名前提致徽章跨设备丢失 / WS 网关无握手鉴权。
- **画板权限模型(AD-17):** owner/editor/viewer 三角色,viewer CRDT op 网关拒收(非客户端自检);owner 转让与角色修改走认证 HTTP 端点(非 CRDT,防 editor 伪造提权);权限变更经 `role_change` WS frame 传播(drain 待处理 op 保原子性);share_token crypto/rand ≥128 bits + URL-safe base64 + owner 可轮换;CRDT 持久化表按 board_id 分区。防止:共享链接=共享编辑权 / 无 owner 致画板无主。
- **单节点云托管部署(AD-18,演进 AD-2):** 部署目标 = 云托管单节点(Fly.io/Railway/Render/云 VM,实现期选),Dockerfile(多阶段 Rust→wasm + Go + 前端 dist)+ GitHub Actions CI/CD 必备;SQLite 持久卷挂载(平台不支持则提前触发 §3.2 PG 迁移);域名 + Let's Encrypt TLS;密钥走云平台 secret env;可观测走云平台内置(熔断事件经 WS 上报 stdout);垂直扩容优先,水平迁移走 §3.2 阈值。防止:裸机无 CI/CD / SaaS 无域名 TLS / 密钥无管理。
- **七大数学约束(SD 域不变量,见 `math-constraints.md`):** 存量断路器 / 单次求值 / 非负钳制(速率级非存量结果级)/ DELAY 隐式存量 / 双时间轴分离 / NaN 熔断 / 两遍扫描初始化。这七条不是 AD 而是 SD 域工程不变量,由 Wasm 内核实现,PRD §2.2 与 addendum §2 为其机制出处。
- **公式求值禁 eval():** 仅 Rust/Wasm 表达式解析器(安全约束,FR §4.3)。prototype 现有 formula.ts evalFormula 纯 TS 递归下降仅留作非仿真场景(UI 实时预览/量纲预览),仿真路径须替换(AD-5)。
- **粘贴通道不经 eval,结构白名单校验:** 防护目标为"拒绝畸形/非法图元结构",非密码学认证(CRC32 仅防传输损坏不防伪造)(FR-BOARD-2)。
- **浏览器要求:** 须支持 WebAssembly.Memory 64MB 上限 + WebGL 片段着色器(AD-5/AD-9 硬约束)。
- **技术栈固定(见 `stack.md`):** React 19.2 / TanStack Start 1.168 / Vite 8 / Tailwind v4 / TS / bun(沿用 prototype) + Rust + wasm-pack + faer 0.24.4 + autodiff 0.7.0 + Go + yjs-go + SQLite WAL(greenfield-new)。

## Non-goals

> PRD §5.2 + addendum 被拒绝方案显式列出,防下游填空。

- **CLD 因果回路图** — MVP 仅 SFD,CLD 为后续(addendum §5)。
- **挑战关卡** — 紧随 MVP 后第一优先项,依赖仿真结果数值比对引擎,非 MVP(FR-GAME-3)。
- **重型第三方图表库(ECharts/D3)** + **完整多存量时序面板(L3)** — MVP 纯 ASCII sparkline 呈现(FR-SIM-VIZ-1)。
- **自托管账号密码认证** — 非 MVP;OAuth GitHub+Google 直连已覆盖 MVP 认证(AD-16),自托管密码 SaaS 规模化后补。
- **离线编辑模式 / 模板库市场 / 导出 PNG·SVG·PDF / 模拟历史回放 / 参数滑块与敏感性分析** — PRD §5.2 排除。
- **移动端响应式布局** — MVP 不支持(PRD §4.4)。
- **PostgreSQL / Redis / 多节点 WS 网关 / 独立可观测栈产品** — 非 MVP,addendum §3.2 可观测阈值触发(云托管单节点部署本身是 MVP,见 AD-18;容器化 Dockerfile + CI/CD 亦 MVP)。
- **嵌入式 SQLite(无服务端)** — 被否:实时多人协作必须有服务端做 CRDT 中继,与协作模型根本冲突(addendum §3.3)。
- **MVP 即上 PostgreSQL+Redis** — 被否:10 人认证单节点引入运维负担收益为零违 YAGNI(addendum §3.3)。
- **固定步长 RK4 / 自适应 RK45 求解器** — 被否:用户选隐式 BDF(addendum §7.5)。
- **公式合并方案 A 检测+提示 / 方案 B 字段级锁** — 被否:用户选方案 C 语义感知合并(addendum §8.4)。
- **后置钳制 `if (nv<0) nv=0`** — 被否:违反 FR-SIM-3 物质守恒致幽灵渗漏,架构阶段须按速率级钳制重写(prototype 现实现为捷径须替换)(FR-SIM-4 禁止错误简化)。

## Success signal

> PRD §1.4 成功指标 + 反指标。世界改变的瞬间,非 dashboard。

- **核心可用性达成:** 新用户首次建模 ≤ 5 分钟;单会话模型迭代次数中位数 ≥ 3 次(同一会话修改并重跑,衡量"复杂系统直觉唤醒"是否被激发);徽章解锁率——行为徽章首次会话解锁 ≥1 枚的用户占比 ≥ 60%(游戏化激励成效)。
- **性能门槛达成:** 1000 图元 ≥ 60 FPS;协作延迟 P95 ≤ 100ms;100 存量 ≥ 100 步/秒;模型保存/加载失败率 < 0.1%;多客户端数值偏差 < 0.001%。
- **反指标归零(硬性,违反即产品失败):**
  - **剪贴板畸形/非法图元结构注入 = 0** — 任意构造的剪贴板 payload 不得注入非法图元结构(粘贴通道不经 eval,不承诺密码学认证)。
  - **房主迁移导致的仿真状态清零 = 0** — 迁移须从会话内快照续跑,不得回退 t=0。
- **可演示瞬间:** 一个 L1 用户在预置人口模型上写一个方程(出生率 = 0.02 × 人口),点播放看 sparkline 指数上升,顺手解锁四个徽章(初探/连线/点火/成模),全程不接触"隐式求解器"四字——一气呵成 demo 完整故事。同时一个 L3 用户在刚性化学动力学模型上触发 BDF 自动降级,仅见黄点闪烁或点一次"简化模型以继续"即续跑,仍只经历"播放-暂停-继续"。

## Assumptions

- **模拟主机为第一个进入房间的用户**,断开时自动迁移(替代方案"服务器端统一计算"被否,见 PRD 假设 1 / AD-1 房主权威)。
- **粘贴后不自动选中**——推迟到实现阶段,减少 Awareness 网络流量(PRD 假设 2)。
- **粘贴原子性硬阻断**(选项 A:粘贴完成前禁止连线)——PRD 假设 3 的两个选项中按更安全的硬阻断假设推进,实现期可复核。
- **仿真态为会话级临时态**——会话内可经服务端仿真态快照恢复以支持房主迁移,不跨会话持久化,会话结束丢弃(PRD 决策,原开放问题 1 已闭合)。
- **默认即 L1 体验**,L2/L3 能力按既有 FR 渐进暴露不新增切换 UI(PRD §1.3)。

## Open Questions

> 接纳 spine Deferred(实现期标定类,非 spec 阻断但须显式列)+ PRD 未闭合开放问题。

- **[F5-perf]** 全重算雅可比 + 稀疏 LU 在 100 存量下能否达 100 步/秒?实测前不可定;若不达 Broyden 近似须重评(spine Deferred)。
- **[F1-quality]** VRAM 图集辉光须复刻 prototype per-glyph shadowBlur 霓虹质感,验收口径已锁**目视不可区分**(spec 收口,严于 spine Deferred 的"待定");实现期跑图集辉光 vs shadowBlur 目视对比验证,达不到则按 FR-UI-6 不达标处理(不得回退 shadowBlur 违 AD-9)。建议此口径回写 spine F1-quality 同步一致(offer)。
- **[F6-threshold]** AST 冲突轻/重分级阈值须与 #4 待定节点合并规则联调,实现期枚举真实冲突场景校准(spine Deferred)。
- **[F7-snapshot-freq]** FR-COLLAB-5"周期性上报"未给频率,须定快照上报频率平衡追赶成本 vs 房主启动延迟(spine Deferred)。
- **[F15-op-quota]** 认证后 editor 角色 CRDT ops/stockId 伪造防御(viewer 已在网关拒收,#15,R3 medium)——editor op/s 配额 + Awareness 限制 + 房间容量硬限制(10 人)+ stockId 存在性验证 + delete 目标存在性,defer 到安全规约细化,实现期协作服务端上线前定阈值(spine Deferred)。
- **[F16-restart-recovery]** 服务端进程重启后的会话恢复协议——session token 持久化已使会话不丢(AD-16),但 WS 连接须重连 + CRDT op log 续传 + 仿真态快照恢复时序须规约,实现期协作服务端上线前定(spine Deferred)。
- **[F17-host-migration-trigger]** 房主迁移触发协议细节(AD-11)——续跑对齐机制已规约,但触发判定(心跳超时阈值 / 主动让出信号 / 多候选新房主选举)须实现期联调标定(spine Deferred)。
- **[F18-sqlite-backup]** SQLite 备份/恢复与零停机部署——单节点云托管下(AD-18),镜像重新部署时 SQLite 持久卷须保证不丢 + 零停机切换(健康检查 + 滚动)须实现期定方案(spine Deferred)。
- **[FR-SIM-8-convergence-params]** 求解器自适应降级收敛监控阈值(残差 tol / 步长收缩率 N·ρ / BDF→后向欧拉→显式切换条件 / 显式失败→二级单按钮降级组合)无法在架构期穷举,defer 到求解器专项规约与 #1 步长 + #2 雅可比策略联调标定(spine Deferred)。
- **[prettier baseline]** 继承 lovable/prototype 的 eslint-plugin-prettier 隐式默认,实现 kickoff 首个 TS/JS 代码落 main 前建根 `.prettierrc` 使 format-on-save 确定性激活(spine Deferred,非架构不变量)。
- **[PRD 开放问题 2]** 官方支持的最大画板尺寸?当前目标 10000 图元,须复核是否为硬上限。
- **[PRD 开放问题 3 — 已闭合]** MVP 引入 OAuth 认证(GitHub+Google)+ 画板权限模型(owner/editor/viewer),跨设备徽章跟随 + 只读分享(AD-16/17,见 CAP-13)。自托管账号密码非 MVP。
- **[PRD 开放问题 4]** 挑战关卡达标判定引擎与 L3 时序面板是否复用同一仿真结果数据通道?二者均为后续能力,须在架构阶段(已部分由 spine 覆盖)统一数据通路设计避免重复造轮子。
