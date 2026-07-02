#!/usr/bin/env bash
# 部署打包脚本 - 产出在线 / 离线部署包
#
# 用法:
#   bash scripts/deploy-pack.sh           # 默认 all，同时产出 online + offline
#   bash scripts/deploy-pack.sh online    # 仅在线包（服务器 pnpm install --prod）
#   bash scripts/deploy-pack.sh offline   # 仅离线包（内置 linux node_modules，服务器零安装）
#   bash scripts/deploy-pack.sh all
#
# 在线包: ~10MB，服务器需能访问 npm 源
# 离线包: ~150MB，服务器无需联网，解压后 bash scripts/server-setup.sh 即用（需 Docker 构建）
#
# 两种包内容一致（dist + out + prisma + 配置 + scripts），离线包额外内置 node_modules，
# 并写一个 .deploy-mode 标记文件让服务器脚本自检模式。

set -euo pipefail

# ============ 颜色 ============
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

MODE="${1:-all}"
case "$MODE" in
  online|offline|all) ;;
  *) echo -e "${RED}用法: $0 [online|offline|all]${NC}"; exit 1 ;;
esac

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR=".deploy-temp"
OFFLINE_SRC="$TEMP_DIR/offline-src"

# ============ 构建产物断言 ============
assert_built() {
  local missing=0
  for f in apps/api/dist/src/main.js apps/web/out/index.html; do
    if [ ! -f "$f" ]; then
      echo -e "${RED}❌ 缺失构建产物: $f${NC}"
      missing=1
    fi
  done
  if [ $missing -eq 1 ]; then
    echo -e "${YELLOW}请先执行 pnpm build（构建后端 dist + 前端静态导出 out）${NC}"
    exit 1
  fi
}

# ============ 公共内容（两种包共用）============
# 参数: $1 = staging 目录
prepare_common_staging() {
  local s="$1"

  echo "  → 复制 API..."
  mkdir -p "$s/apps/api"
  cp -r apps/api/dist "$s/apps/api/"
  cp -r apps/api/prisma "$s/apps/api/"
  cp apps/api/.env.example "$s/apps/api/" 2>/dev/null || true
  cp apps/api/package.json "$s/apps/api/"
  cp apps/api/tsconfig.json "$s/apps/api/"
  # 排除上传文件目录（运行时生成）
  rm -rf "$s/apps/api/uploads" 2>/dev/null || true

  echo "  → 复制 Web（纯静态导出产物 out/）..."
  mkdir -p "$s/apps/web"
  cp -r apps/web/out "$s/apps/web/"
  cp apps/web/.env.production "$s/apps/web/" 2>/dev/null || true
  cp apps/web/.env.example "$s/apps/web/" 2>/dev/null || true
  cp apps/web/next.config.mjs "$s/apps/web/"
  cp apps/web/package.json "$s/apps/web/"

  echo "  → 复制 shared-types..."
  mkdir -p "$s/packages/shared-types"
  cp -r packages/shared-types/src "$s/packages/shared-types/"
  cp packages/shared-types/package.json "$s/packages/shared-types/"
  cp packages/shared-types/tsconfig.json "$s/packages/shared-types/" 2>/dev/null || true

  echo "  → 复制根目录配置 + 脚本..."
  cp ecosystem.config.js "$s/" 2>/dev/null || true
  cp .npmrc "$s/"
  cp package.json "$s/"
  cp pnpm-lock.yaml "$s/"
  cp pnpm-workspace.yaml "$s/"
  cp turbo.json "$s/" 2>/dev/null || true
  cp -r scripts "$s/"

  # 清理 macOS 元数据（._ 文件会让 Prisma schema 解析失败）
  find "$s" -name "._*" -delete 2>/dev/null || true
  find "$s" -name ".DS_Store" -delete 2>/dev/null || true
}

# ============ 离线依赖构建（核心）============
# 在 node:20 linux 容器内，用 hoisted linker 装 api 的 prod 依赖 + 生成 prisma client，
# 得到一棵可移植的扁平 node_modules（含 linux 原生模块：esbuild / prisma engine）。
build_offline_node_modules() {
  command -v docker >/dev/null 2>&1 || {
    echo -e "${RED}❌ 离线模式需要 Docker（在 linux 容器内构建原生模块）。未检测到 docker。${NC}"
    echo -e "${YELLOW}   请安装 Docker，或改用 online 模式：bash scripts/deploy-pack.sh online${NC}"
    exit 1
  }

  # 按构建机的 DB_TYPE 决定容器内激活哪套 schema（生成对应的 prisma engine）
  local db_type gen_cmd
  db_type=$(grep '^DB_TYPE=' apps/api/.env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
  case "$db_type" in
    postgres|postgresql) gen_cmd="pnpm db:use:pg" ;;
    *) gen_cmd="pnpm db:use:mysql" ;;
  esac
  echo -e "  → 数据库类型: ${CYAN}${db_type:-mysql(默认)}${NC} → 容器内用 ${CYAN}${gen_cmd}${NC} 生成 client"

  # 锁定与构建机一致的 pnpm 版本（避免 lockfile 不兼容）
  local pnpm_ver
  pnpm_ver=$(pnpm --version)
  echo -e "  → 锁定容器内 pnpm 版本: ${CYAN}${pnpm_ver}${NC}"

  # 目标平台：默认 linux/amd64（绝大多数内网服务器）。
  # Apple Silicon 上 docker 默认走 arm64，会让生成的原生二进制（prisma engine / esbuild）跑不在 x86 服务器上。
  # 部署到 arm 服务器时用: TARGET_ARCH=linux/arm64 bash scripts/deploy-pack.sh offline
  local target_platform="${TARGET_ARCH:-linux/amd64}"
  echo -e "  → 目标平台: ${CYAN}${target_platform}${NC}（覆盖可用 TARGET_ARCH=... 环境变量）"

  echo -e "  → 在 linux 容器内构建离线依赖（hoisted prod node_modules）..."
  rm -rf "$OFFLINE_SRC"
  mkdir -p "$OFFLINE_SRC/apps/api" "$OFFLINE_SRC/apps/web" "$OFFLINE_SRC/packages/shared-types"

  # 仅拷贝安装/生成所需的最小文件集（不拷业务源码，避免污染与体积膨胀）
  cp package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc "$OFFLINE_SRC/"
  cp apps/api/package.json "$OFFLINE_SRC/apps/api/"
  cp -r apps/api/prisma "$OFFLINE_SRC/apps/api/"
  cp apps/web/package.json "$OFFLINE_SRC/apps/web/"
  cp packages/shared-types/package.json "$OFFLINE_SRC/packages/shared-types/"

  # 容器内：启用 corepack → 装 pnpm → hoisted prod 安装（只装 api 依赖，排除 web 的 next/react）
  #         → 激活 schema → 生成 prisma client（带 linux engine，烤进 node_modules）
  docker run --rm \
    --platform "$target_platform" \
    -v "$PWD/$OFFLINE_SRC":/app \
    -w /app \
    node:20-bookworm \
    bash -lc "
      set -e
      corepack enable
      corepack prepare pnpm@${pnpm_ver} --activate
      pnpm install --prod --filter 'api...' --config.node-linker=hoisted
      cd apps/api
      ${gen_cmd}
      pnpm prisma:generate
      echo '✅ 容器内依赖构建完成'
    "

  # 清理容器可能注入的 macOS 元数据（挂载卷在 macOS 上时 docker 有时会写入 ._ 文件）
  find "$OFFLINE_SRC/node_modules" -name "._*" -delete 2>/dev/null || true
  find "$OFFLINE_SRC/node_modules" -name ".DS_Store" -delete 2>/dev/null || true

  echo -e "  → 离线 node_modules 就绪: $(du -sh "$OFFLINE_SRC/node_modules" | cut -f1)"
}

# ============ 打包单个模式 ============
# 参数: $1 = online | offline
pack_one() {
  local mode="$1"
  local filename="deploy_${TIMESTAMP}_${mode}.tar.gz"
  local staging="$TEMP_DIR/staging-${mode}"

  echo ""
  echo -e "${BOLD}📦 创建 ${mode} 包: ${CYAN}${filename}${NC}"
  rm -rf "$staging"
  mkdir -p "$staging"

  prepare_common_staging "$staging"

  if [ "$mode" = "offline" ]; then
    [ -d "$OFFLINE_SRC/node_modules" ] || build_offline_node_modules
    echo "  → 拷贝离线 node_modules 进包..."
    cp -R "$OFFLINE_SRC/node_modules" "$staging/node_modules"
  fi

  # 服务器脚本据此自检模式（跳过/执行 install）
  printf '%s\n' "$mode" > "$staging/.deploy-mode"

  # 压缩（COPYFILE_DISABLE=1 防止 macOS 再次注入 ._ 文件）
  echo "  → 压缩..."
  export COPYFILE_DISABLE=1
  ( cd "$staging" && tar czf "../../${filename}" . )

  local size
  size=$(ls -lh "$filename" | awk '{print $5}')
  echo -e "  ${GREEN}✅ ${filename} (${size})${NC}"
}

# ============ 主流程 ============
assert_built
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# 离线依赖只构建一次（all 模式下 online/offline 复用同一棵 node_modules）
if [ "$MODE" = "offline" ] || [ "$MODE" = "all" ]; then
  build_offline_node_modules
fi

case "$MODE" in
  online)  pack_one online ;;
  offline) pack_one offline ;;
  all)     pack_one online; pack_one offline ;;
esac

rm -rf "$TEMP_DIR"

# ============ 部署提示 ============
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅ 打包完成                                                   ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}${BOLD}📋 服务器部署:${NC}"
echo ""
echo -e "  ${BOLD}# 上传（任选一种包）:${NC}"
echo -e "  ${CYAN}scp -P 15554 deploy_*_<mode>.tar.gz root@<server>:/opt/node-app/test/${NC}"
echo ""
echo -e "  ${BOLD}# 服务器首次部署:${NC}"
echo -e "  ${CYAN}cd /opt/node-app/test && tar xzf deploy_*.tar.gz && bash scripts/server-setup.sh${NC}"
echo -e "  ${BOLD}# 然后编辑 apps/api/.env（数据库、JWT、AI），配置 Nginx（见 scripts/nginx-guide.md）${NC}"
echo ""
echo -e "  ${BOLD}# 后续更新（保留 .env）:${NC}"
echo -e "  ${CYAN}tar xzf deploy_*.tar.gz && bash scripts/server-update.sh${NC}"
echo ""
echo -e "  ${BOLD}在线包${NC}(online): 服务器需能访问 npm 源，会执行 pnpm install --prod --filter api..."
echo -e "  ${BOLD}离线包${NC}(offline): 服务器无需联网，node_modules 已内置，零安装直接启动"
echo ""
