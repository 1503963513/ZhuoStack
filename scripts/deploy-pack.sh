#!/bin/bash
# 部署打包脚本 - 创建干净的扁平化部署包
# 用法: bash scripts/deploy-pack.sh [输出名称]

set -e

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

# 复制 Web 文件
echo "  → 复制 Web..."
mkdir -p "${TEMP_DIR}/apps/web"
cp -r apps/web/.next "${TEMP_DIR}/apps/web/"
cp -r apps/web/public "${TEMP_DIR}/apps/web/"
cp apps/web/.env.local.example "${TEMP_DIR}/apps/web/"
cp apps/web/next.config.mjs "${TEMP_DIR}/apps/web/"
cp apps/web/package.json "${TEMP_DIR}/apps/web/"
cp apps/web/tsconfig.json "${TEMP_DIR}/apps/web/"
cp apps/web/postcss.config.js "${TEMP_DIR}/apps/web/"
cp apps/web/tailwind.config.ts "${TEMP_DIR}/apps/web/"
cp apps/web/components.json "${TEMP_DIR}/apps/web/"

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

# 打包
echo "  → 正在压缩..."
cd "${TEMP_DIR}" && tar czf "../${FILENAME}" . && cd ..

# 获取文件大小
SIZE=$(ls -lh "${FILENAME}" | awk '{print $5}')

# 清理临时目录
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ 部署包创建完成: ${FILENAME} (${SIZE})"
echo ""
echo "📋 服务器部署命令:"
echo ""
echo "  # 首次部署:"
echo "  scp ${FILENAME} user@server:/opt/myapp/"
echo "  ssh user@server 'cd /opt/myapp && tar xzf ${FILENAME} && bash scripts/server-setup.sh'"
echo ""
echo "  # 更新部署（保留 .env）:"
echo "  scp ${FILENAME} user@server:/opt/myapp/"
echo "  ssh user@server 'cd /opt/myapp && tar xzf ${FILENAME} --skip-old-files && bash scripts/server-update.sh'"
