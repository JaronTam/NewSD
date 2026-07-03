---
artifact: ascii-design-system
status: foundation
source-of-truth:
  - ../../planning-artifacts/epics.md (美学定位段 line 21-29)
  - ../../planning-artifacts/epics.md (Story 1a.1 AC line 271-301)
  - ../../planning-artifacts/architecture/architecture-NewSD-2026-07-01/ARCHITECTURE-SPINE.md (AD-9 VRAM 渲染管线)
  - ../../specs/spec-NewSD/SPEC.md (CAP-11 禁 per-glyph shadowBlur)
machine-readable-mirror: ../../src/styles/tokens.css
---

# NewSD ASCII Design System

> 本文件是「形式即内容」美学机制的机器可读基座(machine-readable design tokens +
> 美学铁律)。下游每个 story 的美学 AC 以本文件 token + 铁律为验收基准;机制
> A②「per-story aesthetic AC」与 A③「visual review gate」引用本文件。
>
> 机器可读镜像:`src/styles/tokens.css`(二者须保持同步,token 改动先改本文件
> 再改 tokens.css)。本文件是权威源,tokens.css 是其 CSS 物化。

## 1. 美学三原理(source: epics.md line 23-27,verbatim)

1. **形式即内容(form is content)** — ASCII 字符排列既是建模语言(存量/流量/
   公式 AST 可读语义)又是视觉图像(系统拓扑可看图形),形状本身强化建模语义。
   亲缘:17 世纪具象诗(赫伯特《复活节翅膀》文字排成翅膀形状)/ 20 世纪 ASCII
   艺术(字符拼出可辨认图形)。
2. **等宽网格为画布(monospace grid as canvas)** — 等宽字体终端网格是共同创作
   画布(类活字印刷铅字网格),图元/连线/公式网格对齐,建模即网格作画。
3. **阅读与观看双重性(reading-watching duality)** — 用户可逐字符读公式/存量
   语义,也可退一步看系统拓扑图形,双重性是核心体验。

## 2. 美学铁律(技术不变量,跨 1a+5)

| 铁律                               | 来源   | 约束                                                                |
| ---------------------------------- | ------ | ------------------------------------------------------------------- |
| VRAM 双缓冲渲染管线                | AD-9   | 字符码缓冲 + 颜色索引缓冲,离屏预渲染辉光图集,nearest 采样保像素风   |
| 禁 per-glyph `shadowBlur`          | CAP-11 | 保等宽网格 + 字符堆叠视觉不被光栅化模糊破坏(非「技术 vs 内容」二分) |
| 辉光亮度上界(luminance-bound glow) | 本文件 | per-glyph 辉光半径 ∈ [glow-min, glow-max],超界即降级为无辉光        |

> 铁律 1+2 在 Story 1a.2(VRAM 渲染基座)落地;辉光图集目视不可区分 spike 在
> 1a.2 验证性子任务(结论正负皆可过,负则触发 Epic 5 第 9/10 项逃生阀)。

## 3. Design Tokens(machine-readable)

镜像于 `src/styles/tokens.css`。改动顺序:本文件 → tokens.css。

### 3.1 色彩(赛博朋克 dark-first)

| token          | 值        | 语义                    |
| -------------- | --------- | ----------------------- |
| `--ns-bg`      | `#0a0e14` | 画布底色(最深)          |
| `--ns-bg-elev` | `#0f1419` | 抬升面(面板/卡片)       |
| `--ns-grid`    | `#1a1f2e` | 等宽网格线              |
| `--ns-border`  | `#1a1f2e` | 边框                    |
| `--ns-fg`      | `#c9d1d9` | 主前景文字              |
| `--ns-fg-dim`  | `#4a5568` | 次要前景(注释/禁用)     |
| `--ns-stock`   | `#00ffd5` | 存量图元(青)            |
| `--ns-flow`    | `#ff5577` | 流量图元(品红)          |
| `--ns-cloud`   | `#7c3aed` | cloud 图元(紫)          |
| `--ns-spark`   | `#39ff14` | sparkline / spark(霓绿) |
| `--ns-sel`     | `#ffd700` | 选中态(金)              |
| `--ns-err`     | `#ff4444` | 错误态(红)              |

### 3.2 排版与网格

| token            | 值                                           | 语义                      |
| ---------------- | -------------------------------------------- | ------------------------- |
| `--ns-font-mono` | `"JetBrains Mono", "Courier New", monospace` | 等宽字体栈                |
| `--ns-cell-w`    | `9px`                                        | 单字符格宽(CSS 像素)      |
| `--ns-cell-h`    | `16px`                                       | 单字符格高(CSS 像素)      |
| `--radius`       | `2px`                                        | 圆角(非图元,仅 UI chrome) |

### 3.3 辉光(luminance-bound)

| token           | 值     | 语义                           |
| --------------- | ------ | ------------------------------ |
| `--ns-glow-min` | `2px`  | 最小辉光半径                   |
| `--ns-glow-max` | `11px` | 最大辉光半径(超界降级为无辉光) |

## 4. 覆盖图谱(美学亲缘节点)

| 节点                        | 亲缘层次                          | 验收代理                        |
| --------------------------- | --------------------------------- | ------------------------------- |
| Epic 1a ASCII 建模图元      | 视觉形式强亲缘                    | per-story aesthetic AC(机制 A②) |
| Epic 1a VRAM 渲染基座(AD-9) | 技术铁律载体                      | AD-9 + CAP-11                   |
| Epic 1b sparkline           | 视觉形式强亲缘(字符序列=趋势图形) | FR-SIM-VIZ-1 纯字符锁保等宽网格 |
| Epic 3 CRDT AST             | 结构形式类比亲缘(数据结构形式)    | 结构性体现,非需独立美学 AC      |
| Epic 4 剪贴板协议           | 结构形式类比亲缘                  | 结构性体现                      |
| Epic 5 赛博朋克质感         | 视觉形式强亲缘                    | FR-UI-6 沉浸强化                |

### 4.1 使能层豁免(Epic 2 认证)

Epic 2(认证)是声明层豁免:认证无独立用户旅程价值(无协作对象时空转),
不承担美学亲缘点明。**此豁免非豁免 UI 实现美学** — 登录页/分享链接实施期仍须
赛博朋克化(用本文件 token),保美学入口一致。此豁免是「跨整个产品」的显式边界,
非声称覆盖全部 epic。

## 5. 1a.1 基座交付状态(本 PR)

本 PR(Story 1a.1 foundation sub-PR #1)交付:

- ✅ `src/styles/tokens.css`(本文件机器可读镜像)
- ✅ `src/styles.css`(Tailwind v4 入口,token 经 `@theme inline` 接入)
- ✅ 最小 boot screen placeholder(`src/routes/index.tsx`)承美学首绘

本 PR **不**交付(后续 sub-PR):

- ⏳ sub-PR #3:无限画布导航(Float64 pan/zoom + 3×2 仿射投影)— 等宽网格画布在此落地
- ⏳ sub-PR #3+ :VRAM 渲染基座属 Story 1a.2(独立 story,非 1a.1 sub-PR)
