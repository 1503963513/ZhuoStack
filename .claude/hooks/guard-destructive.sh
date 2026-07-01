#!/usr/bin/env bash
# PreToolUse (Bash): 拦截不可逆高危命令（重置数据库 / 强推 / 删库）
# 不拦可恢复的清理（rm -rf dist、node_modules）以免误伤。
set -euo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[[ -z "$cmd" ]] && exit 0

reason=""
if echo "$cmd" | grep -qE 'prisma[[:space:]]+(migrate[[:space:]]+reset|db[[:space:]]+reset)'; then
  reason="拦截 prisma reset（会清空数据库且不可逆）。如确需重置，请用户手动执行。"
elif echo "$cmd" | grep -qiE 'DROP[[:space:]]+(DATABASE|SCHEMA)'; then
  reason="拦截 DROP DATABASE/SCHEMA（删库不可逆）。如确需，请用户手动执行。"
elif echo "$cmd" | grep -q 'force-with-lease'; then
  : # --force-with-lease 是安全的 force，放行
elif echo "$cmd" | grep -qE 'git[[:space:]]+push.*(-f([[:space:]]|$)|--force([[:space:]]|$))'; then
  reason="拦截 git push --force（会覆盖远端历史）。如确需，请用 --force-with-lease 或由用户手动执行。"
fi

if [[ -n "$reason" ]]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}' "$reason"
fi
exit 0
