#!/usr/bin/env sh
# 合并后卫生: 回到 main + 拉取 + 剪枝 + 列已合并的本地分支
# 用法: 合并 PR 后执行 `sh scripts/post-merge-cleanup.sh`
#   (远端分支已由 `gh pr merge --delete-branch` 删除;本脚本清本地残留)
set -e

git checkout main
git pull --ff-only
git fetch --prune
echo "✓ main 已同步,远端已剪枝"

echo ""
echo "已合并但未删的本地分支(手动 git branch -d <name> 删除):"
git branch --merged main | grep -vE '^\*\|main\|lovable' || echo "  (无)"
