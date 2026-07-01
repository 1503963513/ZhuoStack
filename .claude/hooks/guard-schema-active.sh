#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): 禁止直接编辑 prisma/schema.active/**
# schema.active 是 db:use:mysql/db:use:pg 自动生成的目录（已 gitignore），
# 直接编辑会被下次同步覆盖。对应 rules/database.md 的硬约束。
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

if [[ -n "$file" && "$file" == *"prisma/schema.active"* ]]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"schema.active/ 是自动生成目录（已 gitignore），禁止直接编辑。请改 prisma/postgres 或 prisma/mysql 源文件，再跑 pnpm --filter api db:use:mysql 同步。"}}'
fi
exit 0
