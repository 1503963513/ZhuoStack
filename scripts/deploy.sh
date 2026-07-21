#!/usr/bin/env bash
# 唯一公开部署入口。具体实现位于 scripts/deploy/。
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DEPLOY_LIB_DIR="$ROOT_DIR/scripts/deploy"

for module in common docker pm2 package; do
  # shellcheck source=/dev/null
  source "$DEPLOY_LIB_DIR/${module}.sh"
done

cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
统一部署命令

  pnpm ops docker up|down|restart|logs|status|config
  pnpm ops pm2 prepare|start|restart|update|stop|logs|status|db-sync
  pnpm ops pack pm2-online|pm2-offline|pm2-all [postgres|mysql]
  pnpm ops pack docker-offline [postgres|mysql]
  pnpm ops pack interactive

常用示例：
  pnpm ops docker up
  pnpm ops pm2 start
  pnpm ops pm2 update /path/to/new-package.tar.gz
  pnpm ops pack docker-offline mysql
EOF
}

case "${1:-}" in
  docker) shift; docker_deploy "$@" ;;
  pm2) shift; pm2_deploy "$@" ;;
  pack) shift; package_deploy "$@" ;;
  -h|--help|help|'') usage ;;
  *) usage; exit 1 ;;
esac
