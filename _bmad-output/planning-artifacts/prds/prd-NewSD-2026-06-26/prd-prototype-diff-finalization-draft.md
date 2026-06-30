# PRD ↔ lovable/prototype 比对定稿清单(审查稿)

> 基于 PRD 三件套(`prd.md` / `addendum.md` / `handoff-to-architecture.md`)+ prototype 全量代码(`formula.ts` / `types.ts` / `i18n.ts` / `routes/index.tsx`)比对得出。
> 已经一轮 audit 修正:原第 5 条"二选一含(b)"与"PRD 不改"矛盾,已合入最小熵修正。
> **状态:待用户审查**。审查通过后,PRD/handoff 改动落 main 走 PR。

---

## 背景判定

prototype 是**单用户、显式欧拉、重度游戏质感的 ASCII SD 原型**。它忠实实现了 PRD 的"交互模 + ASCII 美学 + 游戏化"表层,但**数值内核(隐式求解器族)与协作层几乎全部空缺或为门面**。

- prototype 验证了:交互模 + 游戏感可行且效果惊艳。
- prototype 未验证:PRD 真正的重决策(隐式求解器 / 量纲校验 / CRDT 语义合并)——这些在 prototype 里缺失或硬编码门面。

---

## A. PRD 主体改 4 处(走 PR 落 main)

### A1. FR-ELEM-2:删除 source/sink 双类型,改为单一 cloud

- **现状**:PRD FR-ELEM-2 规定 `type:"source" 或 "sink"` 两类。
- **prototype 实现**:单一 `cloud` kind,source/sink 语义由 flow 方向涌现(cloud 作 fromId=源,作 toId=汇)。
- **分歧根因**:FR-ELEM-2 与 FR-ELEM-3 既有哲学自相矛盾——FR-ELEM-3 已明文"流入/流出语义在公式求值时自然体现,不设独立极性字段"。
- **修正动作**:PRD FR-ELEM-2 改为单一 `cloud` kind,方向语义由 flow 承载。吸收 lovable 简化。

### A2. FR-SIM-4:末尾追加反例,禁止"钳制结果"错误简化

- **现状**:PRD FR-SIM-4 要求钳制**流出速率**(投影法/活动集法),使存量恰好归零,且级联重算,明确"绝不发生幽灵渗漏"。
- **prototype 实现**:钳制**结果** `if(!allowNegative && nv<0) nv=0`。
- **分歧根因**:prototype 的"钳制结果"在级联场景下违反 FR-SIM-3 物质守恒——被钳存量下游仍按未钳速率消耗 → 物质凭空消失。
- **修正动作**:PRD FR-SIM-4 末尾追加反例说明——"钳制存量结果(nv=0)而非钳制流出速率"被否,因级联下违反 FR-SIM-3 守恒。作为架构阶段禁止错误简化的约束依据。

### A3. 新增 FR-CANVAS-5:小地图(进 MVP)

- **现状**:prototype 无、PRD 无。
- **判定**:真新增项(prototype 与 PRD 均无对应实现/规约)。
- **修正动作**:PRD §3.1 新增 **FR-CANVAS-5:小地图**。
  - 缩略视口渲染、当前视口框指示、点击跳转。
  - 架构阶段须定:采样粒度、更新频率(须与脏矩形 / R 树联动,否则 10k 图元下小地图本身成性能负担)。
- **范围**:进 MVP(用户决策)。须同步:
  1. PRD §5.1「MVP 包含」清单补一行 `✅ 小地图(FR-CANVAS-5)`;
  2. PRD §5.1 体量逃生阀警示:小地图为 MVP 第 5 项加码,且其 10k 图元性能与 B1 渲染裁决耦合——若架构裁决为 (b) 下调 FPS 目标,小地图须一并纳入性能预算。addendum §8.3 减负杠杆优先级不变(⑤>③>①),小地图不进入降级优先级(非数值内核,降级无意义),但可作为逃生阀触发时的最先可砍项。

### A4. 新增 FR-UI-6 交互质感层规约(分两档)

- **现状**:prototype 已验证 10 项游戏感创新,PRD §1.1 仅作为差异化口号提及、未落 FR。
- **风险**:架构阶段若只读 PRD,这些已验证创新会全部丢失。
- **修正动作**:PRD 新增 **FR-UI-6(交互质感层)**,10 项分两档:

  **硬 FR(架构必须保证,与渲染方案无关的纯交互质感)**:
  1. 流量数据流动画(`>>>>>>>` 沿 flow 线行进,速度/间距可配)
  2. 音频反馈(方波合成 blip,创建图元/播放/解锁徽章各有音调)
  3. 徽章解锁碎裂粒子(按字母拆分的 ASCII 弹片物理,SHARDS 表)
  4. ScrambleText / Number(数值变化时的 glitch 解码动画)
  5. LVL UP 大字 overlay(ASCII 艺术字弹现)
  6. 呼吸辉光(运行中当前 dt 按钮呼吸高亮)
  7. AsciiRainbowButton / TermMenu / AsciiBadge(色相循环按钮 / ASCII 下拉菜单 / 徽章四角扫描器)
  8. TermInput 火花(数值增减时上/下向火花粒子)

  **视 B1 裁决(依赖渲染方案的质感,架构阶段随 B1 定)**:
  9. CRT 背景漂移(稀疏背景字符 + 慢速色相偏移)—— B1 (a) 路径下用 Shader 复刻,B1 (b) 路径下保留 shadowBlur 实现
  10. per-glyph shadowBlur 辉光(glowFor / shiftHue 亮度绑定辉光)—— B1 (a) 路径下用辉光图集 + Shader 复刻,B1 (b) 路径下保留

- **耦合说明**:第 9、10 项与 B1 渲染张力同源(per-glyph shadowBlur)。分档是为避免 FR-UI-6 硬 FR 与 B1 (a) 路径(禁用 per-glyph shadowBlur)正面冲突——这两项的可实现形态完全由 B1 裁决决定,故标"视 B1"。

---

## B. Handoff 补 3 条(与既有 7 条 open high 同级)

### B1. 渲染裁决(第 8 条 open item,可暂停交付)

- **分歧**:prototype 全帧重绘 + **每字符 shadowBlur**(glowFor / textShadow),视觉惊艳;PRD §2.1 明确把"霓虹字体 shadowBlur 极端消耗 GPU"列为边界约束,结论是"Canvas 2D 定点渲染 + 关闭抗锯齿 + VRAM 双缓冲"。
- **判定**:prototype 的美感建立在 PRD 拒绝的技术上;prototype 未验证 PRD 的 VRAM 方案能呈现同等美感——它验证的是会被 1000 图元 @ 60FPS 否决的方案。
- **修正动作**:handoff 新增第 8 条 open item,要求架构专项交付一份裁决,二选一:
  - **(a)** 辉光图集 + VRAM 字符缓冲 + 色相偏移 Shader 复刻霓虹质感。
  - **(b)** 下调 1000 图元 @ 60FPS 目标并保留 per-glyph shadowBlur。
- **PRD 改动边界**:**PRD 主体不改;若架构裁决为 (b),则 §1.4 与 §4.1 的"1000 图元 60 FPS"指标须同步下调,该项属 PRD 改动,走 PR。**
- **audit 修正记录**:原稿此条误称"PRD 不改",与"二选一含 (b)"矛盾(因 (b) 内嵌对 PRD 性能指标的修改语义);已按最小熵修正合入上述边界说明。
- **列为可暂停交付项**:架构阶段若无法定裁决,此项可暂停,不阻断其余架构产物。

### B2. 公式 tokenizer 语法要求

- **现状**:prototype tokenizer 拒绝 `@` 与 `[` 字符,仅支持 `+ - * / ( ) 数字 标识符`。
- **PRD 要求**:FR-ELEM-3 要求 `@<uuid>` id 引用语法 + `数值 [单位]` 常数单位标注语法。
- **修正动作**:handoff 补一条——架构阶段公式 tokenizer 必须支持 `@uuid` 与 `[单位]` 两种语法。

### B3. 公式引用模型:存储 id / 显示 name

- **现状**:prototype 用 **name 引用**(`人口*0.05`),env 按 `s.name` 构建。可读性佳,但重命名断链、并发重命名不安全。
- **PRD 要求**:FR-ELEM-3 要求 **stockId 引用**(`@<uuid>*0.1`),编辑器显示 name,重命名零断链。
- **判定**:PRD 口径正确(为协作安全),prototype 是单用户阶段捷径。
- **修正动作**:handoff 补一条——架构阶段明确:**存储层 = id 引用,编辑/显示层 = name**。

---

## C. 确认保留(不改不立项)

### C1. 空格 + 左键平移画板

- prototype 已实现(`spaceDownRef` + `onKey` Space + `onMouseDown` 中 `e.button===0 && spaceDownRef.current → pan`)。
- PRD 已规约(FR-CANVAS-1:"平移:中键拖拽 或 空格 + 左键")。
- **判定**:既有项,非新增。确认保留,无需立项、无需改 PRD,避免重复 FR。

---

## D. 其余 prototype 门面/空缺(架构阶段从 PRD 建,非本清单更新项)

以下 prototype 未做、PRD 已规约,架构阶段直接按 PRD 落地即可,**无需改 PRD**,handoff 既有 7 条 open high 已覆盖口径:

- FR-SIM-1 / 2 / 5 / 6 / 7 / 8:整个隐式求解器族 + 量纲校验 + DELAY + 熔断 + 降级
- FR-COLLAB-1~6:整个协作层
- FR-BOARD-1~3 / FR-HISTORY-1 / FR-UI-5 时间单位 / FR-CANVAS-2 吸附 / FR-CANVAS-4 R 树 / FR-ELEM-4 端口

---

## E. 变更汇总

| 编号 | 目标文件 | 动作 | 类型 |
|------|---------|------|------|
| A1 | prd.md FR-ELEM-2 | 删 source/sink 双类型 → 单一 cloud | PRD 改 |
| A2 | prd.md FR-SIM-4 | 追加"钳制结果"反例 | PRD 改 |
| A3 | prd.md §3.1 + §5.1 | 新增 FR-CANVAS-5 小地图(进 MVP) | PRD 改 |
| A4 | prd.md | 新增 FR-UI-6 交互质感层(硬 FR 8 项 + 视 B1 2 项) | PRD 改 |
| B1 | handoff-to-architecture.md | 新增第 8 条渲染裁决(可暂停) | handoff 补 |
| B2 | handoff-to-architecture.md | 补公式 tokenizer 语法要求 | handoff 补 |
| B3 | handoff-to-architecture.md | 补公式引用模型 id/name 分层 | handoff 补 |
| C1 | — | 空格+左键平移确认保留 | 不动 |

> A1–A4 + B1(若裁决 b 触发的指标下调)属 PRD 改动,落 main 走 PR;B1–B3 handoff 补注同步随 PR 提交。按既定 SOP,不直推 main。
