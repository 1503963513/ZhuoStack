#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): 编辑 Prisma 源 schema 后提醒同步
# 对应 rules/database.md「修改 Schema 后先运行 prisma:generate 再启动」
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

case "$file" in
  */prisma/postgres/models/*.prisma|*/prisma/mysql/models/*.prisma)
    # stdout 会注入 Claude 上下文
    echo "⚠️ 已修改 Prisma 源 schema（${file}）。完成编辑后必须同步：1) pnpm --filter api db:use:mysql  2) pnpm --filter api prisma:generate  3) pnpm --filter api prisma:migrate --name <迁移名>"
    ;;
esac
exit 0
