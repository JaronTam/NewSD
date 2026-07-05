#!/usr/bin/env sh
# 合并门控: 验非-deploy CI 全 SUCCESS + CLEAN → gh pr merge --squash --delete-branch → 收尾
# 不依赖分支保护 UI: 即便没设 required checks,本脚本也不让 CI 红/未跑的 PR 合并
# 用法: sh scripts/merge-pr.sh <PR号>
set -e
PR="${1:?用法: merge-pr.sh <PR号>}"

echo "▶ 合并门控 PR #$PR"

# 1) CI: 非 deploy(PR 上永远 SKIPPED)检查须存在且全 SUCCESS
total=$(gh pr view "$PR" --json statusCheckRollup \
  -q '[.statusCheckRollup[] | select(.name!="deploy")] | length')
[ "$total" -ge 1 ] || { echo "✗ CI 未运行(无检查记录,等 CI 跑完再合)"; exit 1; }

not_green=$(gh pr view "$PR" --json statusCheckRollup \
  -q '[.statusCheckRollup[] | select(.name!="deploy") | .conclusion]
       | map(select(. != "SUCCESS")) | length')
[ "$not_green" = "0" ] || {
  echo "✗ CI 未全绿(非 deploy 检查 $not_green/$total 个非 SUCCESS):"
  gh pr view "$PR" --json statusCheckRollup -q '.statusCheckRollup[]
    | select(.name!="deploy") | "  \(.name): \(.conclusion // "PENDING")"'
  exit 1
}

# 2) 可合并(GitHub 已计 checks 状态;未跑完/有 conflict 不会是 CLEAN)
ms=$(gh pr view "$PR" --json mergeStateStatus -q .mergeStateStatus)
[ "$ms" = "CLEAN" ] || { echo "✗ mergeStateStatus=$ms(需 CLEAN;可能有未解决 review/conflict)"; exit 1; }

# 3) 合并 + 收尾
echo "✓ 门控通过(CI 全绿 + CLEAN),合并..."
gh pr merge "$PR" --squash --delete-branch
sh scripts/post-merge-cleanup.sh
echo "✓ PR #$PR 已合并,本地 main 已同步"
