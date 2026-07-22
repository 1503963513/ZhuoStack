#!/usr/bin/env bash
# Stop: 仅当 apps/api 下有 .ts 改动时跑类型检查，失败则 block 强制修复
set -euo pipefail

has_ts_changes() {
  local tracked untracked
  tracked=$(git diff --name-only HEAD -- apps/api/ 2>/dev/null || true)
  untracked=$(git ls-files --others --exclude-standard -- apps/api/ 2>/dev/null || true)
  { printf '%s\n' "$tracked"; printf '%s\n' "$untracked"; } | grep -qE '\.tsx?$'
}

# 无 api 的 .ts 改动 → 跳过，避免无谓开销
if ! has_ts_changes; then
  exit 0
fi

# 跑类型检查（用 api 的 typescript + tsconfig，含 @/* 与 @zhuostack/shared-types 别名）
if out=$(pnpm --filter api exec tsc --noEmit 2>&1); then
  exit 0
fi

# 失败：取前 40 行，block 强制 Claude 继续修复
err=$(printf '%s' "$out" | head -40)
reason=$'类型检查未通过（apps/api），请修复后再结束：\n'"$err"
jq -n --arg r "$reason" '{decision:"block", reason:$r}'
exit 0
