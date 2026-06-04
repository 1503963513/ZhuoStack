#!/bin/bash
# 部署打包脚本 - 创建干净的扁平化部署包
# 用法: bash scripts/deploy-pack.sh [输出名称]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

OUTPUT="${1:-deploy}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${OUTPUT}_${TIMESTAMP}.tar.gz"
TEMP_DIR=".deploy-temp"

echo "📦 正在创建部署包: ${FILENAME}"

# 清理旧文件
rm -rf "${TEMP_DIR}" deploy*.tar.gz

# 创建临时目录
mkdir -p "${TEMP_DIR}"

# 复制 API 文件
echo "  → 复制 API..."
mkdir -p "${TEMP_DIR}/apps/api"
cp -r apps/api/dist "${TEMP_DIR}/apps/api/"
cp -r apps/api/prisma "${TEMP_DIR}/apps/api/"
# 确保 schema.active 也被打包
if [ -d "apps/api/prisma/schema.active" ]; then
  echo "    ✓ 包含 schema.active"
fi
cp apps/api/.env.example "${TEMP_DIR}/apps/api/"
cp apps/api/package.json "${TEMP_DIR}/apps/api/"
cp apps/api/tsconfig.json "${TEMP_DIR}/apps/api/"
# 排除上传文件目录
rm -rf "${TEMP_DIR}/apps/api/uploads" 2>/dev/null || true

# 复制 Web 文件（纯静态导出，产物在 out/ 目录）
echo "  → 复制 Web..."
mkdir -p "${TEMP_DIR}/apps/web"
cp -r apps/web/out "${TEMP_DIR}/apps/web/"
cp apps/web/.env.local.example "${TEMP_DIR}/apps/web/"
cp apps/web/next.config.mjs "${TEMP_DIR}/apps/web/"
cp apps/web/package.json "${TEMP_DIR}/apps/web/"

# 复制共享类型包
echo "  → 复制 shared-types..."
mkdir -p "${TEMP_DIR}/packages/shared-types"
cp -r packages/shared-types/src "${TEMP_DIR}/packages/shared-types/"
cp packages/shared-types/package.json "${TEMP_DIR}/packages/shared-types/"
cp packages/shared-types/tsconfig.json "${TEMP_DIR}/packages/shared-types/"

# 复制根目录配置文件
echo "  → 复制根目录配置..."
cp ecosystem.config.js "${TEMP_DIR}/"
cp .npmrc "${TEMP_DIR}/"
cp package.json "${TEMP_DIR}/"
cp pnpm-lock.yaml "${TEMP_DIR}/"
cp pnpm-workspace.yaml "${TEMP_DIR}/"
cp turbo.json "${TEMP_DIR}/"

# 复制脚本目录
cp -r scripts "${TEMP_DIR}/"

# 复制 Docker 配置（如果有）
if [ -f "docker-compose.yml" ]; then
  echo "  → 复制 docker-compose.yml..."
  cp docker-compose.yml "${TEMP_DIR}/"
  mkdir -p "${TEMP_DIR}/docker/mysql-init"
  touch "${TEMP_DIR}/docker/mysql-init/.gitkeep"
fi

# 清理 macOS 元数据文件（._ 文件会导致 Prisma schema 解析失败）
echo "  → 清理 macOS 元数据文件..."
find "${TEMP_DIR}" -name "._*" -delete 2>/dev/null || true
find "${TEMP_DIR}" -name ".DS_Store" -delete 2>/dev/null || true

# 打包（COPYFILE_DISABLE=1 防止 macOS 再次注入 ._ 文件）
echo "  → 正在压缩..."
export COPYFILE_DISABLE=1
cd "${TEMP_DIR}" && tar czf "../${FILENAME}" . && cd ..

# 获取文件大小
SIZE=$(ls -lh "${FILENAME}" | awk '{print $5}')

# 清理临时目录
rm -rf "${TEMP_DIR}"

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅ 部署包创建完成！                                            ║${NC}"
echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
echo -e "${GREEN}${BOLD}║  📦 文件: ${CYAN}${FILENAME}                                  ║${NC}"
echo -e "${GREEN}${BOLD}║  📏 大小: ${CYAN}${SIZE}                                      ║${NC}"                             
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}${BOLD}📋 服务器部署命令:${NC}"
echo ""
echo -e "  ${RED}${BOLD}# 首次部署:${NC}"
echo -e "  ${CYAN}scp ${FILENAME} user@server:/opt/myapp/${NC}"
echo -e "  ${CYAN}scp -P 15554 ${FILENAME} root@223.254.147.49:/opt/node-app/test/${NC}"
echo -e "  ${CYAN}ssh user@server 'cd /opt/myapp && tar xzf ${FILENAME} && bash scripts/server-setup.sh'${NC}"
echo ""
echo -e "  ${RED}${BOLD}# 更新部署（保留 .env）:${NC}"
echo -e "  ${CYAN}scp ${FILENAME} user@server:/opt/myapp/${NC}"
echo -e "  ${CYAN}scp -P 15554 ${FILENAME} root@223.254.147.49:/opt/node-app/test/${NC}"
echo -e "  ${CYAN}ssh user@server 'cd /opt/myapp && tar xzf ${FILENAME} --skip-old-files && bash scripts/server-update.sh'${NC}"
echo ""
echo -e "  ${GREEN}${BOLD}# 快捷命令（本地一键部署到服务器）:${NC}"
echo -e "  ${CYAN}scp -P 15554 ${FILENAME} root@223.254.147.49:/opt/node-app/test/ && ssh -p 15554 root@223.254.147.49 'cd /opt/node-app/test && bash scripts/server-update.sh'${NC}"
echo ""
