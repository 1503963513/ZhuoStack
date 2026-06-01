#!/bin/bash
# 服务器初始化脚本 - 首次部署时运行
# 用法: bash scripts/server-setup.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔧 正在初始化服务器配置...${NC}\n"

# 检查目录
if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
  echo -e "${RED}❌ 错误: 请在项目根目录下运行此脚本${NC}"
  exit 1
fi

# 检查依赖
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}❌ 未安装 pnpm，请执行 npm i -g pnpm${NC}"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️ 未检测到 pm2，后续需执行 npm i -g pm2${NC}"; }

# 创建环境变量文件
setup_env() {
  local example_file=$1
  local target_file=$2
  if [ ! -f "$target_file" ]; then
    if [ -f "$example_file" ]; then
      echo -e "📝 从模板创建 $target_file ..."
      cp "$example_file" "$target_file"
      echo -e "${YELLOW}⚠️ 请务必修改 $target_file 中的生产配置！${NC}"
    else
      echo -e "${RED}❌ 找不到模板 $example_file${NC}"
    fi
  else
    echo -e "✅ $target_file 已存在，跳过..."
  fi
}

setup_env "apps/api/.env.example" "apps/api/.env"
setup_env "apps/web/.env.local.example" "apps/web/.env.local"

echo "🧹 清理系统隐藏文件..."
find . -type f -name "._*" -delete 2>/dev/null || true

# 创建日志目录
mkdir -p logs

# 安装依赖
echo -e "\n📦 安装生产依赖..."
pnpm install --prod

# 批准构建脚本
echo -e "\n⚙️  批准构建脚本..."
pnpm approve-builds --all 2>/dev/null || true
pnpm rebuild 2>/dev/null || true

# 生成 Prisma Client（关键步骤！）
echo -e "\n🗄️  生成 Prisma Client..."
cd apps/api
DB_TYPE=$(grep "^DB_TYPE=" .env 2>/dev/null | cut -d'=' -f2 || echo "postgres")
if [ "$DB_TYPE" = "mysql" ]; then
  pnpm db:use:mysql
else
  pnpm db:use:pg
fi
pnpm prisma:generate
cd ../..

echo -e "\n${GREEN}🎉 初始化完成！${NC}\n"
echo -e "📋 ${YELLOW}下一步:${NC}"
echo "   1. ✏️  编辑 apps/api/.env（数据库、JWT、AI 配置）"
echo "   2. ✏️  编辑 apps/web/.env.local（API 地址）"
echo "   3. 🚀 pm2 start ecosystem.config.js"
echo "   4. 💾 pm2 save && pm2 startup"
