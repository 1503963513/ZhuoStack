#!/bin/bash
# 服务器更新脚本 - 后续部署使用
# 用法: bash scripts/server-update.sh <tarball>

set -e

TARBALL="${1:-}"

if [ -z "$TARBALL" ]; then
  TARBALL=$(ls -t deploy_*.tar.gz 2>/dev/null | head -1)
  if [ -z "$TARBALL" ]; then
    echo "❌ 未找到部署包。用法: bash scripts/server-update.sh <tarball>"
    exit 1
  fi
fi

echo "📦 正在更新: ${TARBALL}"

# 检测依赖是否有变化
NEED_INSTALL=false
tar tzf "${TARBALL}" | grep -q "package.json" && NEED_INSTALL=true
tar tzf "${TARBALL}" | grep -q "pnpm-lock.yaml" && NEED_INSTALL=true

# 解压前清除旧的构建产物（--skip-old-files 会导致旧文件不被覆盖）
echo "🧹 清除旧构建缓存..."
rm -rf apps/web/.next/cache apps/api/dist

# 解压文件（排除 .env 避免覆盖生产配置）
echo "📂 解压文件（保留 .env）..."
tar xzf "${TARBALL}" \
  --exclude="apps/api/.env" \
  --exclude="apps/web/.env.local" \
  2>/dev/null || true

echo "🧹 清理系统隐藏文件..."
find . -type f -name "._*" -delete 2>/dev/null || true

# 仅在依赖变化时安装
if [ "$NEED_INSTALL" = true ]; then
  echo "📦 依赖有变化，正在安装..."
  pnpm install --prod
  echo "⚙️  批准构建脚本..."
  pnpm approve-builds --all 2>/dev/null || true
  pnpm rebuild 2>/dev/null || true
fi

# 重新生成 Prisma Client
echo "🗄️  重新生成 Prisma Client..."
cd apps/api
DB_TYPE=$(grep "^DB_TYPE=" .env 2>/dev/null | cut -d'=' -f2 || echo "postgres")
if [ "$DB_TYPE" = "mysql" ]; then
  pnpm db:use:mysql
else
  pnpm db:use:pg
fi
pnpm prisma:generate
echo "🗄️  同步数据库 Schema..."
pnpm prisma:push
cd ../..

# 重启服务
echo "🔄 重启服务..."
pm2 restart all

echo ""
echo "✅ 更新完成！"
pm2 status
