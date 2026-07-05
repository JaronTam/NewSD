## 变更摘要

<!-- 一句话：做了什么、为什么 -->

## 测试计划

- [ ] `bun run lint` 绿
- [ ] `bun run typecheck` 绿
- [ ] `bun run test` 绿
- [ ] 涉及渲染/VRAM 时：`bun run test:e2e` 或截图比对（⚠ 切多模态后读图）

## 合并前自检清单

- [ ] `bun.lock` 与 `package.json` 同步（无 `package-lock.json` 混入）
- [ ] 暂存区已核（`git diff --cached --stat`，无 `.claude/` / `package-lock.json` / 根级 PNG / `.playwright-mcp/`）
- [ ] 文档反映合并态（无 stale「待用户明示」类措辞）
- [ ] 红线未破：
  - CAP-11：唯一 `shadowBlur` 站点 = `src/lib/render/vram/glowAtlas.ts:bakeGlowAtlasCanvas`
  - PALETTE_SIZE 单源 = `src/lib/render/vram/shaders.ts:16`（不硬编码 8）
  - F1 常量锁定：GLOW_PAD=16 / LUMA_BLUR_PX=[0,4,8,14] / GLOW_PASSES=3

<!-- 关联 story / CR：#NN -->
