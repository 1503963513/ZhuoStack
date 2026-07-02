#!/usr/bin/env bash
# 交互式发布向导 - 统一入口
# 用法: pnpm release  或  bash scripts/release.sh
#
# 流程: ① 询问是否重新 build（检测到现有产物时可跳过）
#       ② 询问打哪种包（在线 / 离线 / 都打）
#       ③ 调用 deploy-pack.sh 执行打包
# 非交互场景请直接: bash scripts/deploy-pack.sh [online|offline|all]

set -euo pipefail

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# 切到项目根（保证从任意 cwd 调用都正确）
cd "$(dirname "$0")/.."

# 文件修改时间（macOS BSD stat；失败回退 '?'）
mtime() {
  stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$1" 2>/dev/null || echo '?'
}

echo -e "${BOLD}${GREEN}🚀 发布向导${NC}\n"

# ============ ① 是否重新 build ============
HAVE_API=$([ -f apps/api/dist/src/main.js ] && echo 1 || echo 0)
HAVE_WEB=$([ -f apps/web/out/index.html ] && echo 1 || echo 0)

if [ "$HAVE_API" = "1" ] && [ "$HAVE_WEB" = "1" ]; then
  echo -e "检测到已有构建产物："
  echo -e "  ${CYAN}apps/api/dist/src/main.js${NC}  ($(mtime apps/api/dist/src/main.js))"
  echo -e "  ${CYAN}apps/web/out/index.html${NC}   ($(mtime apps/web/out/index.html))"
  read -rp $'\n是否重新执行 pnpm build？[Y/n] ' ans
  case "${ans:-Y}" in
    [nN]*)
      echo -e "${YELLOW}→ 跳过 build，使用现有产物${NC}"
      ;;
    *)
      echo -e "${GREEN}→ 开始 pnpm build ...${NC}\n"
      pnpm build
      ;;
  esac
else
  echo -e "${YELLOW}未检测到完整构建产物，必须先 build。${NC}"
  echo -e "${GREEN}→ 开始 pnpm build ...${NC}\n"
  pnpm build
fi

# ============ ② 选择打包模式 ============
echo ""
echo -e "${BOLD}选择部署包类型：${NC}"
PS3=$'\n请输入序号 > '
MODE=""
select opt in \
  "在线 + 离线（都打）" \
  "仅在线（~800K，服务器需 npm 源）" \
  "仅离线（~130M，服务器零安装）" \
  "取消"; do
  case "$opt" in
    "在线 + 离线（都打）")              MODE=all; break ;;
    "仅在线（~800K，服务器需 npm 源）") MODE=online; break ;;
    "仅离线（~130M，服务器零安装）")    MODE=offline; break ;;
    "取消") echo "已取消"; exit 0 ;;
    *) echo -e "${RED}无效选项，请重选${NC}" ;;
  esac
done

# 离线需 Docker 预检（在 linux 容器内构建原生模块）
if [ "$MODE" = "offline" ] || [ "$MODE" = "all" ]; then
  command -v docker >/dev/null 2>&1 || {
    echo -e "\n${RED}❌ 离线模式需要 Docker（在 linux 容器内构建原生模块）。${NC}"
    echo -e "${YELLOW}   请安装 Docker，或改选「仅在线」。${NC}"
    exit 1
  }
fi

# ============ ③ 执行打包 ============
echo ""
echo -e "${GREEN}→ 开始打包（mode=${MODE}）...${NC}\n"
bash scripts/deploy-pack.sh "$MODE"
