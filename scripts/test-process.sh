#!/usr/bin/env sh
# process 层自测: shellcheck + 关键 grep/deny 逻辑断言
# 防 ERE 转义类 bug(如 #27 的 '^\*\|main\|lovable')ship 到 main
# CI(test.yml::process job)与本地均可跑: sh scripts/test-process.sh
set -e

echo "▶ process 自测"

# 1) shellcheck(语法/常见 shell 陷阱;CI 预装,本地无则 skip 不阻断)
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck .husky/pre-commit .husky/pre-push scripts/*.sh
  echo "✓ shellcheck 通过"
else
  echo "(skip shellcheck: 未安装)"
fi

# 2) post-merge-cleanup grep pattern: 必须过滤 main/*main/lovable,保留其他分支
#    从脚本抽 pattern(awk 按单引号切域取 $2),避免复制漂移
pat=$(awk -F"'" '/grep -vE/{print $2}' "scripts/post-merge-cleanup.sh")
[ -n "$pat" ] || { echo "✗ 抽不到 post-merge grep pattern"; exit 1; }
out=$(printf '  main\n* main\n  feat/x\n  lovable/prototype\n' | grep -vE "$pat" || true)
echo "$out" | grep -qE 'main|lovable' && { echo "✗ post-merge grep 漏过滤 main/lovable: out=[$out] pat=[$pat]"; exit 1; }
echo "$out" | grep -q 'feat/x' || { echo "✗ post-merge grep 误伤 feat/x(应保留): out=[$out] pat=[$pat]"; exit 1; }
echo "✓ post-merge grep pattern 正确(pat=[$pat])"

# 3) pre-commit deny patterns: 各禁项命中 + 合法路径不误伤
check_deny() {
  # $1 = pattern, $2 = 应命中(禁项), $3 = 应放行(合法)
  if ! printf '%s\n' "$2" | grep -Eq "$1"; then
    echo "✗ deny pattern [$1] 未命中禁项 [$2]"; exit 1
  fi
  if printf '%s\n' "$3" | grep -Eq "$1"; then
    echo "✗ deny pattern [$1] 误伤合法路径 [$3]"; exit 1
  fi
}
# 从 .husky/pre-commit 抽三条 deny pattern(每行 deny '<pat>' ...,取单引号间 $2)
denies=$(awk -F"'" '/^deny /{print $2}' ".husky/pre-commit")
p1=$(printf '%s\n' "$denies" | sed -n 1p)
p2=$(printf '%s\n' "$denies" | sed -n 2p)
p3=$(printf '%s\n' "$denies" | sed -n 3p)
if [ -z "$p1" ] || [ -z "$p2" ] || [ -z "$p3" ]; then
  echo "✗ 抽不到三条 deny pattern"; exit 1
fi
check_deny "$p1" 'package-lock.json' 'bun.lock'
check_deny "$p2" '.claude/skills/x' 'src/a.ts'
check_deny "$p3" 'sd-sim-0.png' 'src/a.png'
echo "✓ pre-commit deny patterns 正确"

echo "✓ process 自测全部通过"
