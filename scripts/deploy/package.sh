#!/usr/bin/env bash
# 在线 PM2 包、离线 PM2 包和离线 Docker 镜像包。

prepare_pm2_staging() {
  local staging=$1 mode=$2 db_type=$3
  mkdir -p "$staging/apps/api" "$staging/apps/web" "$staging/packages/shared-types" "$staging/scripts" "$staging/docker"
  cp -R apps/api/dist apps/api/prisma "$staging/apps/api/"
  cp apps/api/package.json apps/api/.env.example "$staging/apps/api/"
  cp -R apps/web/out "$staging/apps/web/"
  cp apps/web/package.json "$staging/apps/web/"
  cp packages/shared-types/package.json "$staging/packages/shared-types/"
  cp package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ecosystem.config.js "$staging/"
  cp scripts/deploy.sh "$staging/scripts/"
  cp -R scripts/deploy "$staging/scripts/"
  cp docker/nginx.pm2.conf "$staging/docker/"
  printf '%s\n' "$mode" > "$staging/.deploy-mode"
  printf '%s\n' "$db_type" > "$staging/.deploy-db-type"
}

pack_pm2() {
  local mode=$1 db_type=${2:-postgres} timestamp staging archive platform release_version
  case "$db_type" in postgres|mysql) ;; *) die "数据库类型只能是 postgres 或 mysql" ;; esac
  timestamp=$(date +%Y%m%d_%H%M%S)
  release_version=${RELEASE_VERSION:-}
  staging=".deploy-temp/pm2-${mode}"
  if [ -n "$release_version" ]; then
    archive="zhuostack-${release_version}-pm2-${mode}-${db_type}.tar.gz"
  else
    archive="deploy_pm2_${mode}_${db_type}_${timestamp}.tar.gz"
  fi
  rm -rf .deploy-temp
  mkdir -p "$staging"
  build_project
  activate_prisma_schema "$db_type"
  prepare_pm2_staging "$staging" "$mode" "$db_type"

  if [ "$mode" = offline ]; then
    command -v docker >/dev/null 2>&1 || die "生成跨平台离线依赖需要 Docker"
    platform=${TARGET_ARCH:-linux/amd64}
    info "在 $platform 容器中安装生产依赖、PM2 和 Prisma Client"
    docker run --rm --platform "$platform" -v "$ROOT_DIR/$staging:/app" -w /app node:24-bookworm-slim bash -lc "
      set -eu
      apt-get update >/dev/null
      apt-get install -y --no-install-recommends openssl ca-certificates >/dev/null
      corepack enable
      corepack prepare pnpm@10.32.1 --activate
      pnpm install --frozen-lockfile --prod --filter 'api...' --config.node-linker=hoisted
      cd apps/api
      node prisma/select-schema.mjs ${db_type}
      pnpm prisma:generate
      cd /app
      mkdir -p runtime/bin
      cp \"\$(command -v node)\" runtime/bin/node
    "
  fi

  find "$staging" -name '._*' -delete 2>/dev/null || true
  COPYFILE_DISABLE=1 tar -C "$staging" -czf "$archive" .
  rm -rf .deploy-temp
  ok "已生成 $archive ($(du -h "$archive" | awk '{print $1}'))"
}

pack_docker_offline() {
  local db_type=${1:-postgres} timestamp staging archive image_list platform db_image version
  case "$db_type" in postgres|mysql) ;; *) die "数据库类型只能是 postgres 或 mysql" ;; esac
  command -v docker >/dev/null 2>&1 || die "生成 Docker 离线包需要 Docker"
  ensure_deploy_env
  platform=${TARGET_ARCH:-linux/amd64}
  timestamp=$(date +%Y%m%d_%H%M%S)
  version="offline-${timestamp}"
  staging=".deploy-temp/docker-offline-${db_type}"
  archive="deploy_docker_offline_${db_type}_${timestamp}.tar.gz"
  rm -rf .deploy-temp
  mkdir -p "$staging/docker" "$staging/scripts"

  cp .env.deploy.example "$staging/.env.deploy.example"
  set_env_value "$staging/.env.deploy.example" APP_IMAGE_PREFIX zhuostack
  set_env_value "$staging/.env.deploy.example" APP_VERSION "$version"
  set_env_value "$staging/.env.deploy.example" DB_TYPE "$db_type"
  if [ "$db_type" = mysql ]; then
    set_env_value "$staging/.env.deploy.example" DATABASE_URL 'mysql://zhuostack:zhuostack123@db:3306/zhuostack'
  else
    set_env_value "$staging/.env.deploy.example" DATABASE_URL 'postgresql://zhuostack:zhuostack123@db:5432/zhuostack'
  fi
  cp docker-compose.yml "$staging/"
  cp docker/compose.mysql.yml "$staging/docker/"
  cp scripts/deploy.sh "$staging/scripts/"
  cp -R scripts/deploy "$staging/scripts/"
  printf '%s\n' "$db_type" > "$staging/.offline-db-type"

  info "为 $platform 构建 $db_type 应用镜像"
  if [ "$db_type" = mysql ]; then
    db_image=mysql:8.0
    DOCKER_DEFAULT_PLATFORM="$platform" APP_IMAGE_PREFIX=zhuostack APP_VERSION="$version" DB_TYPE=mysql docker compose --env-file .env.deploy -f docker-compose.yml -f docker/compose.mysql.yml build
    image_list=$(APP_IMAGE_PREFIX=zhuostack APP_VERSION="$version" DB_TYPE=mysql docker compose --env-file .env.deploy -f docker-compose.yml -f docker/compose.mysql.yml config --images)
  else
    db_image=postgres:16-alpine
    DOCKER_DEFAULT_PLATFORM="$platform" APP_IMAGE_PREFIX=zhuostack APP_VERSION="$version" DB_TYPE=postgres docker compose --env-file .env.deploy -f docker-compose.yml build
    image_list=$(APP_IMAGE_PREFIX=zhuostack APP_VERSION="$version" DB_TYPE=postgres docker compose --env-file .env.deploy -f docker-compose.yml config --images)
  fi
  docker pull --platform "$platform" "$db_image"
  docker pull --platform "$platform" redis:7-alpine
  info "导出 Docker 镜像"
  # image_list 由 docker compose 生成，按换行拆分为 docker save 参数。
  docker image save -o "$staging/offline-images.tar" $image_list
  COPYFILE_DISABLE=1 tar -C "$staging" -czf "$archive" .
  rm -rf .deploy-temp
  ok "已生成 $archive ($(du -h "$archive" | awk '{print $1}'))"
}

package_interactive() {
  local kind db_type skip_build=false

  echo "PM2 发布包向导"
  if [ -f apps/api/dist/src/main.js ] && [ -f apps/web/out/index.html ]; then
    read -rp "检测到现有构建产物，是否复用？[y/N] " answer
    case "${answer:-N}" in [yY]*) skip_build=true ;; esac
  fi

  PS3='请选择发布包类型 > '
  select option in "在线 + 离线" "仅在线" "仅离线" "取消"; do
    case "$option" in
      "在线 + 离线") kind=pm2-all; break ;;
      "仅在线") kind=pm2-online; break ;;
      "仅离线") kind=pm2-offline; break ;;
      "取消") return 0 ;;
      *) warn "请输入有效序号" ;;
    esac
  done

  PS3='请选择数据库 > '
  select option in "PostgreSQL" "MySQL"; do
    case "$option" in
      "PostgreSQL") db_type=postgres; break ;;
      "MySQL") db_type=mysql; break ;;
      *) warn "请输入有效序号" ;;
    esac
  done

  if [ "$kind" != pm2-online ]; then
    command -v docker >/dev/null 2>&1 || die "离线包需要 Docker"
  fi

  case "$kind" in
    pm2-online) DEPLOY_SKIP_BUILD="$skip_build" pack_pm2 online "$db_type" ;;
    pm2-offline) DEPLOY_SKIP_BUILD="$skip_build" pack_pm2 offline "$db_type" ;;
    pm2-all)
      DEPLOY_SKIP_BUILD="$skip_build" pack_pm2 online "$db_type"
      DEPLOY_SKIP_BUILD=true pack_pm2 offline "$db_type"
      ;;
  esac
}

package_deploy() {
  local kind=${1:-} db_type=${2:-postgres}
  case "$kind" in
    pm2-online) pack_pm2 online "$db_type" ;;
    pm2-offline) pack_pm2 offline "$db_type" ;;
    pm2-all)
      pack_pm2 online "$db_type"
      DEPLOY_SKIP_BUILD=true pack_pm2 offline "$db_type"
      ;;
    docker-offline) pack_docker_offline "$db_type" ;;
    interactive) package_interactive ;;
    *) usage; exit 1 ;;
  esac
}
