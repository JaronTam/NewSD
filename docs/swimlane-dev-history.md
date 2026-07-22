# NewSD 故事可视化(swimlane)开发史

> 线上产物:`gh-pages` 孤儿分支根目录 `index.html`(纯 HTML+CSS+JS 自绘,35KB)
> 部署:https://jarontam.github.io/NewSD/
> 数据:39 story / 6 epic,纵向 6 泳道 × 横向 L0–L16 拓扑层,SVG 自绘 71 条依赖边
> 数据源:`_bmad-output/planning-artifacts/epics.md`
> 开发周期:2026-07-19 ~ 07-20,6 commit(首日 5 + 次日 1 收尾)

---

## 速查表 A:特性演进矩阵(✓=有 / —=无)

| commit    | 日期  | CUR高亮 | devhint | grab-to-pan | EVA卡 | 中文数字 | 散文CUR派生 | URL hash(B) | 进度条 |
| --------- | ----- | ------- | ------- | ----------- | ----- | -------- | ----------- | ----------- | ------ |
| `0719fa1` | 07-19 | —       | —       | —           | —     | —        | —           | —           | —      |
| `4c3a7b1` | 07-19 | ✓       | —       | ✓           | —     | —        | —           | —           | —      |
| `b3479a6` | 07-19 | ✓       | ✓       | ✓           | —     | —        | —           | —           | —      |
| `d858cd8` | 07-19 | ✓       | ✓       | ✓           | —     | —        | ✓           | ✓           | —      |
| `6e5847f` | 07-19 | ✓       | ✓       | ✓           | ✓     | —        | ✓           | ✓           | ✓      |
| `a822a75` | 07-20 | ✓       | ✓       | ✓           | ✓     | ✓        | ✓           | —(回A)      | ✓      |

## 速查表 B:数据维度(commit 间变化)

| commit    | 日期  | NODES | done | E总 | hard | seq | %   | bytes |
| --------- | ----- | ----- | ---- | --- | ---- | --- | --- | ----- |
| `0719fa1` | 07-19 | 39    | 11   | 71  | 69   | 2   | 28% | 23543 |
| `4c3a7b1` | 07-19 | 39    | 11   | 71  | 69   | 2   | 28% | 26135 |
| `b3479a6` | 07-19 | 39    | 11   | 71  | 69   | 2   | 28% | 29108 |
| `d858cd8` | 07-19 | 39    | 11   | 71  | 69   | 2   | 28% | 31088 |
| `6e5847f` | 07-19 | 39    | 11   | 71  | 69   | 2   | 28% | 34677 |
| `a822a75` | 07-20 | 39    | 11   | 71  | 69   | 2   | 28% | 35075 |

**关键结论**:数据层(NODES / E / done / %)自首次部署起零变动,6 commit 演进全在交互/视觉/代码层;唯一递增维度是文件体积(23.5KB → 35KB,+49%)。commit `0719fa1` message 写 "38 stories" 为笔误,实测 39。

---

## 时间线

### `0719fa1`(07-19)首次部署

奠基:纯自绘泳道(HTML+CSS+JS 三段,无 Mermaid/CDN,可离线),纵向 6 Epic 泳道(1a/1b/2/3/4/5)× 横向 L0–L16 拓扑层(Layer=最长前置路径深度,同列=同层=可并行),SVG 自绘 71 条依赖边(灰实线=硬依赖 / 黄虚线=执行序),hover 卡片高亮直连边其余淡出。数据源 `epics.md` 各 Story 的 Given/前置子句。首次启用 Pages 的 POST API 返 403(fine-grained PAT 缺 `pages:write`),但 GET 确认 Pages 已指向 gh-pages,后续推 gh-pages 触发自动重建不需该权限。

### `4c3a7b1`(07-19)CUR 高亮 + grab-to-pan

交互层第一刀。CUR(当次开发故事)= 每会话点名的故事,薄荷色环 + `curPulse` 脉冲 + "开发中"徽章,独立于 hover 的 `.hl`(hover/mouseout 只切 `.hl` 不擦 `.cur`,Playwright 验 curCount 跨 hover 不变)。grab-to-pan:`.scroll-wrap` 光标 `grab`,左键按下空白(`.cell`/非 `.card`)切 `.panning`→`grabbing`,mousemove 改 scrollLeft/Top 平移,卡片与滚动条不触发,拖动中抑制 hover。

### `b3479a6`(07-19)devhint 提示框 + 散文

数据驱动层。`<h2>泳道图</h2>` 下方插 `<div id="devhint">`,IIFE 载入时遍历 NODES/E 重算可开发故事:每 epic 取"入边(硬+seq)from 全 done 且自身非 done"的最前 Layer,同层并行全列。同步追加"本次开发"散文行(此时硬编码)。合并 story 后改 NODES status→done 即自动刷新 devhint,无需手改本框。

### `d858cd8`(07-19)devhint 正确性 + URL hash(B)+ 散文派生

4 优化点:(1) devhint 过滤从 `!done[n[0]]` 改 `n[5]==="todo"`(原把 blocked 态当可开发,blocked 3.4/5.3 永不列);(2) 无可开发 epic 显该 epic 最前非 done 故事 + 阻塞项(⏳ + `.dh-block` dashed + `.dh-wait` pill + "等"标签);(3) CUR 从硬编码改读 URL hash `#cur=1a9,21`(`location.hash.match(/cur=([\w,]*)/)`),裸 URL 无高亮(零 push 不 stale);(4) 散文从硬编码改 `<span id="cur-prose">` + `renderCurProse` IIFE 由 CUR 派生(避 en-dash Edit 失配,永不再手改该行)。

### `6e5847f`(07-19)EVA 卡 + 拓扑层进度条

视觉层。顶部加 EVA 风标题卡合并百分比徽章(黑底红字 + `feTurbulence` 颗粒 overlay + blur/contrast + Type 95 衬线体),只显示数字如 "28%";原"已合并"文字删除。百分比卡 `position:absolute;top:0;right:0` 避免 card 撑高 header 导致左侧留空;左侧同高度区域由"按拓扑层分段"进度条填充(39 小格=39 story,色块=done/待开发/阻塞/开发中,图例在进度条下方),`#progbar` 与 `.legend` 保留 `padding-right:300px` 防与右侧徽章重叠。

### `a822a75`(07-20)中文数字 + CUR 回归(A)+ 批次声明

收尾定案。EVA 卡中文化:`pct+"%"` → `"百分之"+numToCn(pct)`(如"百分之二十八")+ `.pct-val` font 90→56px、字距 6px、`paint-order:stroke fill` + `-webkit-text-stroke:2px #ff0f0f` 描边 + 黑色投影 `0 2px 6px rgba(0,0,0,0.85)`。CUR 回归 option A 硬编码 `Set(["1a9","21","51"])`(L614),裸 URL 恒定高亮当批(1a.9 界面i18n / 2.1 OAuth登录 / 5.1 质感前8项 并行),取代 option B 的 URL hash--"裸 URL 无高亮 / 维护者用书签 URL"已废。批次声明工作流落地:开发前声明当批并行故事 → 同步 memory + project-context → story 合并后 fold 单次 gh-pages 推送;story 代码 PR 仍每 story 单独。

---

## 三条演进主线

**1. 交互层(让图"会指当前")**:纯 hover 高亮 → 加 CUR 恒定高亮 → 加 grab-to-pan 平移。

**2. 数据驱动层(让图"会指下一步")**:devhint v1(`!done` 过滤)→ v2(`status==="todo"` 修 blocked 误判)→ v3(blocked epic 显阻塞项 + 占位文);"本次开发"散文从硬编码 → CUR 派生。

**3. 视觉层(进度可读性)**:无进度指示 → EVA 风格百分比卡 + 按拓扑层进度条 → 中文化 + 描边阴影。

---

## CUR 方案 A↔B↔A 反复

| 阶段 | commit    | 方案                     | 动机 / 问题                                                      |
| ---- | --------- | ------------------------ | ---------------------------------------------------------------- |
| 引入 | `4c3a7b1` | A 硬编码 `Set([...])`    | 默认高亮,但换故事要改代码重推                                    |
| 切换 | `d858cd8` | B 读 URL hash `#cur=...` | 零 push 不 stale,但裸 URL 无高亮,casual visitor 看不到"本次开发" |
| 回归 | `a822a75` | A 硬编码                 | 批次声明工作流:当批并行故事需默认高亮,B 的"裸 URL 无高亮"被废    |

**评估未做的两点**(均经用户确认"记录不可行"):

- sprint-status.yaml 派生 CUR:实测 `development_status:` 块里 `1a-9-i18n: backlog`(dev 未启动即 backlog,非"当次开发目标"语义),status ≠ dev-target,不可派生。
- hashchange 监听重渲染:可行但非必须,维护者用书签 URL 已足,casual visitor 看 devhint 已是主信号。

---

## 踩过的坑(Edit 工具元经验)

非 ASCII + CRLF 在 Edit 工具上系统性失配,贯穿多个 commit:

- **en-dash U+2013 / EM DASH U+2014**:Read 显示为 `-`,copy normalize 致码位变,`old_string` not found → 改 ASCII 锚(如 `main;Epic`)或 Python 行切片 `"".join(lines[a:b])` 提取 verbatim 字节。
- **CRLF 行尾**:Read 归一 `\n`,多行锚失配 → Python 读归一、写 `newline="\r\n"` 还原。

---

## 部署与维护机制

- **隔离**:`gh-pages` orphan 分支只含 `index.html`,不受 main 的 Require-PR 分支保护,可直推;main 有改动时用 worktree(`/c/Two/NewSD-ghpages-tmp`)隔离 Edit,main clean 时可直 `git checkout gh-pages`。
- **部署**:推 `origin/gh-pages` → Pages 自动重建(1–2 min),刷新 URL 验证。
- **验证**:本地 Playwright 端到端(curCount / pan / devhint / console 无 error)。
- **更新触发**:
  1. story 合并 main 后 `NODES` status `todo`→`done`(同 sprint-status 周期,不夹带 story 代码 PR);
  2. 批次声明时设 CUR + 推;
  3. 批次回顾时重设下一批 CUR;
  4. 新增 story/边需同步 `NODES`+`E` 两数组并重算 Layer(最长前置路径,需重排泳道列号)。
- **当前当批**:`1a.9`(界面 i18n)/ `2.1`(OAuth 登录)/ `5.1`(质感前 8 项)并行,`CUR = Set(["1a9","21","51"])`。
- **维护边界**:只改纯 HTML/CSS/JS 三段(NODES/E 数组 + drawLinks 自动连线 SVG),勿引入 Mermaid/CDN。

---

## 数据统计方法

本文表 B 数据由以下脚本对每个 commit 实测得出(`git show <sha>:index.html` → Python 正则):

```python
node_re = re.compile(r'\["[^"]+", "[^"]+", "[^"]+", "[^"]+", \d+, "(done|todo|blocked)"\]')
edge_re = re.compile(r'^\s*\["[^"]+", "[^"]+"(?:, "([^"]+)")?\],?\s*$', re.M)
# NODES = len(node_re.findall(h)); done = status.count('done')
# E 总 = len(edge_re.findall(h)); seq = 第三项=='seq' 计数; hard = E总 - seq
```

特性矩阵(表 A)由 `grep -c` 各关键符号(`const CUR` / `devhint` / `panning` / `pct-val` / `numToCn` / `renderCurProse` / `location.hash` / `progbar`)在每 commit 的 `index.html` 中出现次数判定(>0 即 ✓)。
