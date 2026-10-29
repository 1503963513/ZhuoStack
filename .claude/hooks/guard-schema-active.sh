#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): 禁止直接编辑 prisma/schema.active/**
# schema.active 是由调度脚本自动生成的目录（已 gitignore），
# 直接编辑会被下次同步覆盖。对应 invariants.md 的硬约束。
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

if [[ -n "$file" && "$file" == *"prisma/schema.active"* ]]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"schema.active/ 是自动生成目录（已 gitignore），禁止直接编辑。请修改 prisma/postgres 或 prisma/mysql 源文件，再运行 pnpm db:generate 自动同步。"}}'
fi
exit 0
