# 安全审查 (R3) — review-security.md

**审查人**: 应用安全审稿员 (R3)
**审查对象**: `prd.md` 4.3 节、FR-BOARD-1/2、FR-COLLAB-*、addendum 相关安全措辞
**辅证**: `.memlog.md`、`session-report-2026-06-27.md`
**审查日期**: 2026-06-27

---

## 0. 整体判定

**PRD 安全设计框架基本成形,但存在 3 个重要缺口(2 个 FAIL + 1 个 RISK),集中在无身份认证场景下的防御缺失和资源耗尽防护维度不完整,须在架构阶段补齐。**

- 已覆盖良好的项:Origin 校验定位诚实、剪贴板安全边界清醒(不 eval、CRC32 仅完整性)、NaN 熔断值域保护
- 关键缺项:Yjs CRDT 在匿名无认证场景下的恶意 op 防御完全空白;Wasm 求解器缺时间维/迭代次数维熔断;SQLite 缺参数化查询显式要求
- 所有 finding 均可在架构阶段修复,不阻断 PRD 进入架构阶段

---

## 1. 核查点一:4.3 WebSocket Origin 校验

**判定: PASS** (low)

**引用位置**: `prd.md` 4.3 — "WebSocket 握手 Origin 头校验(防跨站 WS 连接;MVP 匿名无 Cookie 会话,不采用 CSRF Token 模式)"

**分析**: PRD 对 Origin 校验的定位诚实且准确。
- Origin 头确实可被恶意非浏览器客户端伪造(cURL、Python websocket-client 等均可随意设置 Origin)。
- 但 PRD 明确将 Origin 校验限定为"防跨站 WS 连接",且说明 MVP 为匿名无 Cookie 会话——没有 Cookie/Token,浏览器端的 CSRF/WSRF 攻击本身影响有限。
- PRD 未声称 Origin 校验能防御恶意客户端,未过度承诺。

**结论**: 定位合理,无安全幻觉,无需修改。

---

## 2. 核查点二:FR-BOARD-2 CRC32 + 结构白名单校验

**判定: PASS** (low)

**引用位置**: `prd.md` FR-BOARD-2 + FR-ELEM-1/2/3 图元字段定义

**分析**:
- CRC32 已正确定位为"完整性校验,非认证机制"——正确。
- 结构白名单校验步骤 3 覆盖:字段类型合法、UUIDv4 合法、fromId/toId 引用存在于 payload 内、无未知字段。
- 反指标已收窄为"畸形/非法图元结构注入=0"(而非之前笼统的"剪贴板注入"),措辞清醒。
- "粘贴通道不经 eval"承诺可验证:Rust/Wasm mexpr 解析公式,剪贴板处理路径无 eval() 调用。
- 白名单覆盖面:stock(10 字段)、source/sink(5 字段)、flow(7 字段)全部覆盖。无未知字段条款对 MVP 合理。

**注意**: "无未知字段"条款使未来版本新增字段的粘贴向后不兼容。MVP 阶段可接受,但架构阶段应设计白名单版本化或宽松降级策略。

**结论**: 安全边界定义清晰,防护目标合理,可验证。无修改要求。

---

## 3. 核查点三:匿名协作(10 人) — stockId/CRDT ops 伪造

**判定: FAIL** — medium

**引用位置**: `prd.md` FR-COLLAB-1/2/3/4/6, 4.3, addendum §1.3/§3.1

**问题**:
1. **无身份认证**: MVP 为匿名模式,任何 WebSocket 客户端可连接房间并发送任意 CRDT 操作。
2. **服务端纯中继**:PRD 描述的服务端为"CRDT 中继服务器"(第 7 节架构图),未要求对传入 CRDT 操作做任何语义验证。
3. **Yjs 容忍边界**:Yjs CRDT 是协作 CRDT,假设客户端合作(non-byzantine)。恶意客户端可以:
   - 发送 `Y.Map` 操作插入非法/巨量元素
   - 删除房间全部元素
   - 用伪造 stockId 污染公式 AST
   - 模拟大量 Awareness 事件耗尽服务端内存
4. **限流不足**:4.3 仅提及"WebSocket 连接速率限制",未要求**CRDT 操作级速率限制**(per-client op/s 配额)。
5. **无 stockId 服务端验证**:CRDT ops 中引用的 stockId 未经服务端验证是否属于本房间文档。

**修复建议**:
- 架构阶段补充**CRDT 操作准入校验**:服务端对每个传入 CRDT 操作做最小语义合理性检查(如:delete 操作的目标键是否存在于当前文档;update 的值类型是否匹配 schema)
- 增加**CRDT 操作速率限制**:per-client ops/s 阈值(如 100 ops/s),超过断开连接
- 增加**Awareness 消息大小和频率限制**:防止模拟大量光标位置耗尽服务端内存
- 考虑**房间容量硬限制**:超过 10 人时拒绝新连接(而非软限制)
- 如果 CRDT 准入校验过于复杂,最低要求:对 delete 操作做存在性检查 + op 级速率限制

---

## 4. 核查点四:服务端 SQLite

**判定: RISK** — medium

**引用位置**: `prd.md` FR-COLLAB-1, 第 7 节架构图, addendum §1.3/§3.1

**问题**:
1. **SQL 注入面**:操作日志为"追加式写入",但 PRD 未显式要求使用参数化查询(parameterized query / prepared statement)。任何将客户端输入拼接到 SQL 中的路径都是注入点。
2. **快照反序列化**:CRDT 快照以 Yjs 二进制格式存储。从 SQLite 读取并反序列化时,畸形/损坏的二进制数据可能导致 Yjs 解析器异常行为(虽然 Yjs 二进制格式有长度前缀等保护,但非安全审计目标)。
3. **写者模型**:SQLite 单写者,CRDT 中继的写入频率和写入大小无约束,可能因单个大操作阻塞其他写入。

**修复建议**:
- PRD 或架构规约中显式要求:所有 SQLite 查询使用参数化查询,禁止字符串拼接
- 架构阶段增加快照反序列化校验:读取 CRDT 快照后做完整性检查(如总元素计数匹配、UUID 格式验证)
- 写入操作日志时对大操作做分片或大小限制

---

## 5. 核查点五:Wasm 求解器资源耗尽防御

**判定: FAIL** — high

**引用位置**: `prd.md` FR-SIM-6, 2.2 NaN 熔断保护, addendum §7 求解器子系统

**问题**:
1. **FR-SIM-6 仅覆盖值维**:NaN/Inf 检查、相对量级突变检查、相邻步变化率——全部是**数值域**的熔断。
2. **无时间维熔断**:用户构造的恶意公式(如极复杂嵌套函数、含大量 DELAY 展开)可能导致:
   - 牛顿迭代单步无法收敛,无限循环(不产生 NaN,但永远不收敛)
   - 单个仿真步的 wall-clock 执行时间无限延长
3. **无迭代次数熔断**:牛顿迭代缺少最大迭代次数上限(如 max 100 次迭代仍不收敛则熔断)。
4. **无 AST 复杂度限制**:恶意公式 AST 可被构造为指数级展开(DELAY 嵌套 DELAY),导致 Wasm 内存耗尽或编译时间爆炸。
5. **无 Wasm 实例内存硬限制**:WebAssembly 实例内存可增长至 WebAssembly.Memory 上限,未设上限的求解器可因恶意输入耗尽浏览器 tab 内存。

**修复建议**:
- **FR-SIM-6 扩展**:增加"单步 Wall-clock 超时"(如每步求解 ≤ 500ms),超时则熔断并报告"SOLVER TIMEOUT"
- **牛顿迭代增加 maxIterations**:如 100 次仍不收敛则熔断(与 NaN 熔断同级保护)
- **AST 编译阶段增加复杂度预算**:拒绝超过 MAX_NODES(如 5000 AST 节点)的公式
- **Wasm 实例内存上限**:设置 WebAssembly.Memory 上限(如 64 MB),超出则重建实例
- 上述熔断均以 ASCII 通知反馈用户(类比 FR-SIM-6 的 `[SYSTEM HALTED: ...]` 模式)

---

## 6. 核查点六:FR-COLLAB-4 stockId<string> — 服务端验证

**判定: FAIL** — medium

**引用位置**: `prd.md` FR-COLLAB-4, FR-COLLAB-1, 第 7 节架构图

**问题**:
1. FR-COLLAB-4 模拟状态广播格式为 `[stockId<string>, currentValue<float64>]`——stockId 为 UUIDv4 字符串。
2. PRD 未要求服务端/接收端验证 stockId 是否属于当前房间文档中真实存在的元素。
3. 恶意房主(或劫持房主连接的攻击者)可广播:
   - 不存在的 stockId → 客户端可能创建幽灵渲染或抛出异常
   - 高频重复广播 → 客户端渲染过载
4. CRDT 层(FR-COLLAB-1)的 `Y.Map("elements")` 中引用的 stockId 同样缺少服务端存在性验证。

**修复建议**:
- 服务端中继模拟状态广播前,验证每个 stockId 是否存在于房间 CRDT 文档的 `Y.Map("elements")` 中
- 对未知 stockId 的消息做丢弃 + 日志告警(非透传)
- CRDT 中继层对 formula AST 中的 stockId 引用做存在性检查(至少对 update/delete 操作)

---

## 严重度汇总表

| 严重度 | 计数 | 核查点 |
|--------|------|--------|
| Critical | 0 | — |
| High | 1 | #5 Wasm 求解器资源耗尽(时间维/迭代次数维熔断缺失) |
| Medium | 3 | #3 匿名协作 CRDT ops 防御空白、#4 SQLite 参数化查询未显式要求、#6 stockId 服务端验证缺失 |
| Low | 2 | #1 Origin 校验(通过)、#2 剪贴板白名单(通过) |

**修复优先级**: #5(high) > #3(medium) = #6(medium) > #4(medium)

---

## 补充观察(非核查点,供架构阶段参考)

1. **4.3 CORS 保护措辞笼统**:仅写"CORS 保护(HTTP 接口)"——HTTP 接口具体指哪些?如果是 REST API 用于非 WS 通信,应明确 CORS 配置策略(allow-origin、allow-methods 等)。目前措辞对架构阶段指导性不足。
2. **addendum §7.3 体量警示的安全含义**:隐式求解器 + 自动微分 + 牛顿迭代 + LU 分解的复杂度可能分散团队对安全防御实现的注意力。体量越大,安全审查覆盖越易出漏洞——这本身是安全风险。
3. **反指标措辞已收敛**:反指标从"剪贴板注入=0"收窄为"畸形/非法图元结构注入=0",且明确"不经 eval,不承诺密码学认证"——安全边界清晰。
4. **FR-BOARD-3 外部文件阻断**:正确(阻止所有文件类型默认行为,仅接受带协议前缀的纯文本)。但应注明"静默拒绝"的具体行为(无提示 vs 轻提示),防止用户困惑。
