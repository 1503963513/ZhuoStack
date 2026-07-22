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
全栈项目统一部署工具

用法：
  pnpm ops <类型> <操作> [参数]

命令索引：
  pnpm ops docker up|down|restart|logs|status|config
  pnpm ops pm2 prepare|start|restart|update|stop|logs|status|db-sync
  pnpm ops pack pm2-online|pm2-offline|pm2-all [postgres|mysql]
  pnpm ops pack docker-offline [postgres|mysql]
  pnpm ops pack interactive

────────────────────────────────────────────────────────────
1. Docker 首次部署（推荐）

  # 生成带随机数据库密码和 JWT 密钥的配置文件
  pnpm ops docker config >/dev/null

  # 编辑生产配置，重点检查 DATABASE_URL、CORS_ORIGIN、端口和 AI 配置
  vim .env.deploy

  # 构建镜像并启动 PostgreSQL/MySQL、Redis、API 和 Web
  pnpm ops docker up

  配置文件：根目录 .env.deploy
  数据库选择：DB_TYPE=postgres 或 DB_TYPE=mysql
  MySQL 模式会自动加载 docker/compose.mysql.yml。

────────────────────────────────────────────────────────────
2. PM2 首次部署

  pnpm build:deploy
  cp apps/api/.env.example apps/api/.env.production
  vim apps/api/.env.production
  pnpm ops pm2 start

  配置文件：apps/api/.env.production
  API 由 PM2 运行；Web 静态文件 apps/web/out 交给 Nginx。
  Nginx 模板：docker/nginx.pm2.conf

────────────────────────────────────────────────────────────
3. 制作 PM2 部署包

  # PM2 在线包：目标机需要 Node.js、pnpm 和 npm 源
  pnpm ops pack pm2-online postgres

  # PM2 离线包：自带 Linux Node、PM2、依赖和 Prisma Client
  pnpm ops pack pm2-offline postgres

  # 同时生成 PM2 在线包和离线包
  pnpm ops pack pm2-all postgres

  # 交互式选择包类型与数据库
  pnpm release

  postgres 可替换为 mysql。离线包数据库类型必须与目标环境一致。

────────────────────────────────────────────────────────────
4. 构建并导出 Docker 镜像

  AMD x86 Ubuntu 服务器对应 linux/amd64，服务器执行 uname -m 应输出 x86_64。

  # PostgreSQL：构建 API、Web，并导出 PostgreSQL、Redis 等全部镜像
  TARGET_ARCH=linux/amd64 pnpm ops pack docker-offline postgres

  # MySQL：构建 API、Web，并导出 MySQL、Redis 等全部镜像
  TARGET_ARCH=linux/amd64 pnpm ops pack docker-offline mysql

  linux/amd64 是默认目标，AMD x86 服务器也可直接执行：
  pnpm ops pack docker-offline postgres

  输出文件：
  deploy_docker_offline_<数据库>_<时间>.tar.gz

  压缩包包含：
    offline-images.tar       # docker save 导出的全部镜像
    docker-compose.yml       # 服务编排
    .env.deploy.example      # 生产配置模板，不包含生产密钥
    docker/                  # MySQL override 等配置
    scripts/                 # 内网服务器部署入口

  # 只构建 API 和 Web 镜像，不导出、不启动
  pnpm ops docker config >/dev/null
  docker compose --env-file .env.deploy build

  其他架构示例：
  TARGET_ARCH=linux/arm64 pnpm ops pack docker-offline postgres

────────────────────────────────────────────────────────────
5. 部署离线包

  Docker 离线包：
    tar -xzf deploy_docker_offline_*.tar.gz
    bash scripts/deploy.sh docker config >/dev/null
    vim .env.deploy
    bash scripts/deploy.sh docker up

  PM2 离线包：
    tar -xzf deploy_pm2_offline_*.tar.gz
    cp apps/api/.env.example apps/api/.env.production
    vim apps/api/.env.production
    bash scripts/deploy.sh pm2 start

  生产密钥不会从打包机写入离线包，应在目标服务器配置。

────────────────────────────────────────────────────────────
6. 更新服务

  Docker 联网更新：
    # 更新代码后重新构建并替换发生变化的容器，保留 .env.deploy 和数据卷
    pnpm ops docker up

  Docker 离线更新：
    tar -xzf deploy_docker_offline_*.tar.gz
    docker load -i offline-images.tar
    # 将新 .env.deploy.example 的 APP_VERSION 同步到原 .env.deploy
    bash scripts/deploy.sh docker up

  PM2 更新：
    # 保留 apps/api/.env.production，更新文件、依赖，重启并健康检查
    bash scripts/deploy.sh pm2 update /path/to/new-package.tar.gz

  回滚时使用上一个部署包重复对应更新流程。

────────────────────────────────────────────────────────────
7. 数据库结构变更

  Docker：
    .env.deploy 中 DB_AUTO_SYNC=true 时，API 启动前自动执行 prisma db push。

  PM2：
    bash scripts/deploy.sh pm2 db-sync
    bash scripts/deploy.sh pm2 restart

  删除字段、字段重命名或类型变更前必须先备份数据库，并优先使用审核过的迁移 SQL。
  应用更新不会清空 Docker 数据卷或外部数据库中的业务数据。

────────────────────────────────────────────────────────────
8. 常用运维

  pnpm ops docker status      # 查看容器状态
  pnpm ops docker logs        # 持续查看容器日志
  pnpm ops docker restart     # 重启容器
  pnpm ops docker down        # 停止容器，不删除数据卷

  pnpm ops pm2 status         # 查看 PM2 状态
  pnpm ops pm2 logs           # 查看 API 日志
  pnpm ops pm2 restart        # 重启 API
  pnpm ops pm2 stop           # 停止 API

更多说明：doc/deployment.md
EOF
}

case "${1:-}" in
  docker) shift; docker_deploy "$@" ;;
  pm2) shift; pm2_deploy "$@" ;;
  pack) shift; package_deploy "$@" ;;
  -h|--help|help|'') usage ;;
  *) usage; exit 1 ;;
esac
