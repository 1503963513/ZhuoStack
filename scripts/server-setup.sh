#!/usr/bin/env bash
# 服务器初始化脚本 - 首次部署时运行
# 用法: bash scripts/server-setup.sh
#
# 自动识别部署包模式（读取根目录 .deploy-mode）：
#   online  → pnpm install --prod --filter api...（需服务器能访问 npm 源）
#   offline → 跳过安装（node_modules 已内置）
# 无论哪种模式：生成 .env（含强随机 JWT_SECRET）→ 生成 Prisma Client → 同步表 → 启动 PM2 → 健康检查

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}🔧 正在初始化服务器配置...${NC}\n"

# 检查目录
if [ ! -d "apps/api" ] || [ ! -d "apps/web" ]; then
  echo -e "${RED}❌ 错误: 请在项目根目录下运行此脚本${NC}"
  exit 1
fi

# 读取部署模式（兼容旧包：无标记视为 online）
MODE=$(cat .deploy-mode 2>/dev/null | tr -d '[:space:]' || true)
case "$MODE" in
  online|offline) ;;
  *) MODE="online" ;;
esac
echo -e "   部署包模式: ${CYAN}${MODE}${NC}"

# 检查依赖工具
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ 未安装 node${NC}"; exit 1; }
if [ "$MODE" = "online" ]; then
  command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}❌ 未安装 pnpm，请执行 npm i -g pnpm${NC}"; exit 1; }
fi
command -v pm2 >/dev/null 2>&1 || echo -e "${YELLOW}⚠️ 未检测到 pm2（后续需 npm i -g pm2 才能启动服务）${NC}"

# ============ 创建环境变量文件 ============
setup_env() {
  local example_file=$1
  local target_file=$2
  if [ ! -f "$target_file" ]; then
    if [ -f "$example_file" ]; then
      echo -e "📝 从模板创建 $target_file ..."
      cp "$example_file" "$target_file"
    else
      echo -e "${RED}❌ 找不到模板 $example_file${NC}"
      return 1
    fi
  else
    echo -e "✅ $target_file 已存在，跳过..."
  fi
}

echo -e "\n📝 准备环境变量..."
setup_env "apps/api/.env.example" "apps/api/.env"
# web 的 .env.production 已在包内（NEXT_PUBLIC_API_URL 留空走 Nginx 同域代理），无需生成

# ============ 强制注入强随机 JWT_SECRET ============
# main.ts 启动时会校验：弱密钥或 <32 字符直接 process.exit(1)，必须保证 .env 里是强密钥
ensure_strong_jwt() {
  local envfile="$1"
  # 用 node 做检测+替换，跨平台无 sed -i 差异
  node -e '
    const fs = require("fs");
    const f = process.argv[1];
    const c = fs.readFileSync(f, "utf8");
    const m = c.match(/^JWT_SECRET=(.*)$/m);
    const cur = m ? m[1].trim() : "";
    const weak = ["default-secret","your-super-secret-jwt-key-change-in-production","secret","jwt-secret","changeme","123456",""];
    const need = weak.includes(cur.toLowerCase()) || cur.length < 32;
    if (!need) { console.log("  ✅ JWT_SECRET 已是强密钥，保留"); process.exit(0); }
    const strong = require("crypto").randomBytes(64).toString("hex");
    const out = c.replace(/^JWT_SECRET=.*/m, "JWT_SECRET=" + strong);
    fs.writeFileSync(f, out);
    console.log("  🔐 已自动生成强随机 JWT_SECRET（128 位 hex）。如需固定请手改 " + f);
  ' "$envfile"
}
ensure_strong_jwt "apps/api/.env"

echo "🧹 清理系统隐藏文件..."
find . -type f -name "._*" -delete 2>/dev/null || true

# 创建日志目录（PM2 写入）
mkdir -p logs

# ============ 安装依赖（仅 online）============
if [ "$MODE" = "online" ]; then
  echo -e "\n📦 安装生产依赖（仅 api，排除 web 的 next/react）..."
  pnpm install --prod --filter "api..."
  echo -e "⚙️  批准构建脚本..."
  pnpm approve-builds --all 2>/dev/null || true
  pnpm rebuild 2>/dev/null || true
else
  echo -e "\n📦 离线模式：node_modules 已内置，跳过安装"
fi

# ============ 生成 Prisma Client ============
echo -e "\n🗄️  准备数据库配置..."
cd apps/api

DB_TYPE=$(grep "^DB_TYPE=" .env 2>/dev/null | cut -d'=' -f2 | tr -d '[:space:]' || echo "postgres")
DB_URL=$(grep "^DATABASE_URL=" .env 2>/dev/null | cut -d'=' -f2- || echo "")

echo -e "   数据库类型: ${CYAN}${DB_TYPE}${NC}"
echo -e "   连接地址:   ${CYAN}${DB_URL:0:30}...${NC}"
echo ""
echo -e "${YELLOW}⚠️  请确认 apps/api/.env 中以下配置正确:${NC}"
echo -e "   ${CYAN}DB_TYPE${NC}       = postgres | mysql（必须与 DATABASE_URL 协议一致）"
echo -e "   ${CYAN}DATABASE_URL${NC}  = postgresql://... 或 mysql://..."
echo ""

if [ "$DB_TYPE" = "mysql" ]; then
  pnpm db:use:mysql
else
  pnpm db:use:pg
fi
echo -e "🗄️  生成 Prisma Client..."
pnpm prisma:generate
cd ../..

# ============ 启动 PM2 + 健康检查 ============
PORT_VAL=$(grep "^PORT=" apps/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '[:space:]')
PORT_VAL="${PORT_VAL:-3100}"

if command -v pm2 >/dev/null 2>&1; then
  echo -e "\n🚀 启动 PM2..."
  pm2 start ecosystem.config.js || pm2 restart all

  echo -e "🩺 健康检查 http://127.0.0.1:${PORT_VAL}/health ..."
  if curl -sf --retry 5 --retry-delay 2 --retry-connrefused "http://127.0.0.1:${PORT_VAL}/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 服务启动成功！${NC}"
  else
    echo -e "${RED}❌ 健康检查失败，最近的 PM2 日志:${NC}"
    pm2 logs myapp-api --lines 30 --nostream 2>/dev/null || true
    echo -e "${YELLOW}   请检查 apps/api/.env（数据库连接、JWT）后重试 pm2 restart all${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  未安装 pm2，跳过启动。请先 npm i -g pm2，再 pm2 start ecosystem.config.js${NC}"
fi

echo -e "\n${GREEN}🎉 初始化完成！${NC}\n"
echo -e "📋 ${YELLOW}下一步:${NC}"
echo "   1. ✏️  检查 apps/api/.env（数据库、AI 配置；JWT_SECRET 已自动生成）"
echo "      ⚠️  确保 DB_TYPE 与 DATABASE_URL 协议一致！"
echo "         MySQL:  DB_TYPE=mysql    + DATABASE_URL=mysql://..."
echo "         PgSQL:  DB_TYPE=postgres + DATABASE_URL=postgresql://..."
if [ "$DB_TYPE" = "mysql" ]; then
  echo "   2. 🗄️  如需初始化表结构（main 进程已起则表已 push）:"
  echo "         cd apps/api && pnpm prisma:push && cd ../.. && pnpm run db:seed"
fi
echo "   3. 🌐 配置 Nginx（前端静态 out/ + 反代 /api + /files），见 scripts/nginx-guide.md"
echo "   4. 💾 pm2 save && pm2 startup   # 开机自启"
