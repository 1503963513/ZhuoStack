#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): 对刚编辑的文件跑项目本地 prettier
# 不碰 .prisma（项目未装 prisma prettier 插件）、生成目录、依赖目录。
set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

# 空路径或文件不存在 → 跳过
[[ -z "$file" || ! -f "$file" ]] && exit 0

# 排除生成/依赖/构建目录
case "$file" in
  *node_modules*|*dist*|*out*|*.next*|*coverage*|*schema.active*) exit 0 ;;
esac

# 只处理 prettier 支持的后缀（无 prisma 插件，故排除 .prisma）
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac

# 静默格式化，失败不阻塞（prettier 解析失败等）
npx --no-install prettier --write "$file" >/dev/null 2>&1 || true
exit 0
