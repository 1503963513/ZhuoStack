#!/usr/bin/env bash
# 服务器更新脚本 - 后续部署使用
# 用法: bash scripts/server-update.sh [tarball]
#
# 自动识别部署包模式（读取根目录 .deploy-mode）：
#   online  → pnpm install --prod --filter api... 重新装依赖
#   offline → 跳过安装（包内已含新 node_modules）
# 流程: 解压(保留 .env) → 同步依赖 → 生成 Prisma Client → 同步表 → 重启 PM2 → 健康检查

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

TARBALL="${1:-}"

# 未指定 tarball 时自动找最新的 deploy_*.tar.gz
if [ -z "$TARBALL" ]; then
  TARBALL=$(ls -t deploy_*.tar.gz 2>/dev/null | head -1)
  if [ -z "$TARBALL" ]; then
    echo -e "${RED}❌ 未找到部署包。用法: bash scripts/server-update.sh [tarball]${NC}"
    exit 1
  fi
fi

echo -e "📦 正在更新: ${CYAN}${TARBALL}${NC}"

# 解压前清除旧的构建产物（避免残留）
echo "🧹 清除旧构建产物..."
rm -rf apps/web/out apps/api/dist

# 解压（排除开发/本地环境配置，避免覆盖生产 .env）
echo "📂 解压文件（保留 .env）..."
tar xzf "$TARBALL" \
  --exclude="apps/api/.env" \
  --exclude="apps/web/.env.development" \
  --exclude="apps/web/.env.local" \
  2>/dev/null || true

echo "🧹 清理系统隐藏文件..."
find . -type f -name "._*" -delete 2>/dev/null || true

# 读取部署模式（兼容旧包：无标记视为 online）
MODE=$(cat .deploy-mode 2>/dev/null | tr -d '[:space:]' || true)
case "$MODE" in
  online|offline) ;;
  *) MODE="online" ;;
esac
echo -e "   部署包模式: ${CYAN}${MODE}${NC}"

# ============ 安装依赖（仅 online）============
if [ "$MODE" = "online" ]; then
  echo -e "📦 安装依赖（仅 api）..."
  pnpm install --prod --filter "api..."
  echo "⚙️  批准构建脚本..."
  pnpm approve-builds --all 2>/dev/null || true
  pnpm rebuild 2>/dev/null || true
else
  echo -e "📦 离线模式：node_modules 已随包更新，跳过安装"
fi

# ============ 重新生成 Prisma Client + 同步表 ============
echo -e "🗄️  重新生成 Prisma Client..."
cd apps/api
DB_TYPE=$(grep "^DB_TYPE=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '[:space:]' || echo "postgres")
echo -e "   数据库类型: ${CYAN}${DB_TYPE}${NC}"
if [ "$DB_TYPE" = "mysql" ]; then
  pnpm db:use:mysql
else
  pnpm db:use:pg
fi
pnpm prisma:generate
echo -e "🗄️  同步数据库 Schema（prisma db push）..."
pnpm prisma:push
cd ../..

# ============ 重启 PM2 + 健康检查 ============
PORT_VAL=$(grep "^PORT=" apps/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '[:space:]')
PORT_VAL="${PORT_VAL:-3100}"

echo "🔄 重启服务..."
pm2 restart all

echo -e "🩺 健康检查 http://127.0.0.1:${PORT_VAL}/health ..."
if curl -sf --retry 5 --retry-delay 2 --retry-connrefused "http://127.0.0.1:${PORT_VAL}/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ 更新完成，服务已就绪！${NC}"
else
  echo -e "${RED}❌ 健康检查失败，最近的 PM2 日志:${NC}"
  pm2 logs myapp-api --lines 30 --nostream 2>/dev/null || true
  echo -e "${YELLOW}   请检查日志后重试 pm2 restart all${NC}"
  exit 1
fi

echo ""
pm2 status
