#!/usr/bin/env bash
# 在线 PM2 包、离线 PM2 包和离线 Docker 镜像包。

prepare_pm2_staging() {
  local staging=$1 mode=$2 db_type=$3
  mkdir -p "$staging/apps/api" "$staging/apps/web" "$staging/scripts" "$staging/docker"
  cp -R apps/api/dist apps/api/prisma "$staging/apps/api/"
  cp apps/api/package.json apps/api/.env.example "$staging/apps/api/"
  cp -R apps/web/out "$staging/apps/web/"
  cp apps/web/package.json "$staging/apps/web/"
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
    platform=$(resolve_target_platform)
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
  local db_type=${1:-postgres}
  local components=${2:-all}             # all | api | web
  local include_middleware=${3:-all}     # all | none | db-only | redis-only
  local timestamp staging archive image_list platform db_image version comp build_services

  case "$db_type" in postgres|mysql) ;; *) die "数据库类型只能是 postgres 或 mysql" ;; esac
  case "$components" in all|api|web) ;; *) die "应用组件只能是 all、api 或 web" ;; esac
  case "$include_middleware" in all|none|db-only|redis-only) ;; *) die "中间件策略只能是 all、none、db-only 或 redis-only" ;; esac

  command -v docker >/dev/null 2>&1 || die "生成 Docker 离线包需要 Docker"
  ensure_deploy_env
  platform=$(resolve_target_platform)
  info "已选定目标容器平台: $platform"
  info "打包范围配置: 组件=[$components], 数据库=[$db_type], 中间件=[$include_middleware]"

  timestamp=$(date +%Y%m%d_%H%M%S)
  version="offline-${timestamp}"
  staging=".deploy-temp/docker-offline-${db_type}"

  if [ "$components" = web ]; then
    archive="deploy_docker_web_${timestamp}.tar.gz"
  elif [ "$components" = api ]; then
    archive="deploy_docker_api_${db_type}_${timestamp}.tar.gz"
  elif [ "$include_middleware" = none ]; then
    archive="deploy_docker_app_only_${db_type}_${timestamp}.tar.gz"
  else
    archive="deploy_docker_offline_${db_type}_${timestamp}.tar.gz"
  fi

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

  if [ "$include_middleware" = none ]; then
    set_env_value "$staging/.env.deploy.example" EXTERNAL_DB 'true'
  fi

  cp docker-compose.yml "$staging/"
  cp docker/compose.mysql.yml "$staging/docker/"
  cp docker/compose.external-db.yml "$staging/docker/"
  cp scripts/deploy.sh "$staging/scripts/"
  cp -R scripts/deploy "$staging/scripts/"
  printf '%s\n' "$db_type" > "$staging/.offline-db-type"

  # 1. 构建所选的应用组件镜像
  local compose_files=(-f docker-compose.yml)
  if [ "$db_type" = mysql ]; then
    db_image="mysql:8.0"
    compose_files+=(-f docker/compose.mysql.yml)
  else
    db_image="postgres:16-alpine"
  fi

  build_services=()
  if [ "$components" = all ] || [ "$components" = api ]; then
    build_services+=(api)
  fi
  if [ "$components" = all ] || [ "$components" = web ]; then
    build_services+=(web)
  fi

  info "为 $platform 构建应用镜像: ${build_services[*]}"
  DOCKER_DEFAULT_PLATFORM="$platform" APP_IMAGE_PREFIX=zhuostack APP_VERSION="$version" DB_TYPE="$db_type" \
    docker compose --env-file .env.deploy "${compose_files[@]}" build "${build_services[@]}"

  # 收集应用镜像名称
  local app_images=()
  if [ "$components" = all ] || [ "$components" = api ]; then
    app_images+=("zhuostack-api:${version}")
  fi
  if [ "$components" = all ] || [ "$components" = web ]; then
    app_images+=("zhuostack-web:${version}")
  fi

  # 2. 拉取与收集基础中间件镜像
  local middleware_images=()
  if [ "$components" != web ]; then
    if [ "$include_middleware" = all ] || [ "$include_middleware" = db-only ]; then
      info "拉取基础数据库镜像 ($platform: $db_image)"
      docker pull --platform "$platform" "$db_image"
      middleware_images+=("$db_image")
    fi
    if [ "$include_middleware" = all ] || [ "$include_middleware" = redis-only ]; then
      info "拉取 Redis 镜像 ($platform: redis:7-alpine)"
      docker pull --platform "$platform" "redis:7-alpine"
      middleware_images+=("redis:7-alpine")
    fi
  fi

  local all_save_images=("${app_images[@]}")
  if [ "${#middleware_images[@]}" -gt 0 ]; then
    all_save_images+=("${middleware_images[@]}")
  fi
  info "待导出镜像列表: ${all_save_images[*]}"

  comp=$(compress_cmd)
  info "流式压缩导出 Docker 镜像 ($comp)"
  # 流式压缩直接写入文件，避免在 Docker 虚拟机内部产生未压缩巨型临时文件而报 no space left
  docker image save "${all_save_images[@]}" | $comp -c > "$staging/offline-images.tar.gz"

  info "归档离线部署包为 $archive"
  COPYFILE_DISABLE=1 tar -C "$staging" -cf - . | $comp -1 -c > "$archive"
  rm -rf .deploy-temp
  ok "已生成 $archive ($(du -h "$archive" | awk '{print $1}'))"
}

package_interactive() {
  local kind db_type skip_build=false
  local docker_components="all"
  local docker_middleware="all"

  echo "============================================================"
  echo "                ZhuoStack 全栈部署发布向导"
  echo "============================================================"

  PS3='请选择发布包类型 > '
  select option in \
    "Docker 离线镜像包 (推荐，可自选是否打入数据库/Redis)" \
    "PM2 在线 + 离线包 (标准裸机部署)" \
    "PM2 仅在线包 (目标机自带 Node/pnpm 网络环境)" \
    "PM2 仅离线包 (自带 Node 运行时和全量生产依赖)" \
    "取消"; do
    case "$option" in
      "Docker 离线镜像包 (推荐，可自选是否打入数据库/Redis)") kind=docker-offline; break ;;
      "PM2 在线 + 离线包 (标准裸机部署)") kind=pm2-all; break ;;
      "PM2 仅在线包 (目标机自带 Node/pnpm 网络环境)") kind=pm2-online; break ;;
      "PM2 仅离线包 (自带 Node 运行时和全量生产依赖)") kind=pm2-offline; break ;;
      "取消") return 0 ;;
      *) warn "请输入有效序号" ;;
    esac
  done

  # 如果是 Docker 离线包，进入细粒度组件与中间件询问
  if [ "$kind" = docker-offline ]; then
    echo
    echo "--- [步骤 1/3] 选择应用组件打包范围 ---"
    PS3='请选择要打包的应用组件 > '
    select comp_opt in \
      "前后端完整打包 (API + Web，推荐)" \
      "仅后端 API 镜像 (纯后端接口服务更新)" \
      "仅前端 Web 镜像 (纯静态页面与 Nginx 更新)"; do
      case "$comp_opt" in
        "前后端完整打包 (API + Web，推荐)") docker_components="all"; break ;;
        "仅后端 API 镜像 (纯后端接口服务更新)") docker_components="api"; break ;;
        "仅前端 Web 镜像 (纯静态页面与 Nginx 更新)") docker_components="web"; break ;;
        *) warn "请输入有效序号" ;;
      esac
    done

    # 只有包含 API 时才需要关心数据库类型与中间件
    if [ "$docker_components" != web ]; then
      echo
      echo "--- [步骤 2/3] 选择数据库引擎 ---"
      PS3='请选择目标数据库类型 > '
      select db_opt in "PostgreSQL (默认推荐)" "MySQL (兼容 8.0+)"; do
        case "$db_opt" in
          "PostgreSQL (默认推荐)") db_type=postgres; break ;;
          "MySQL (兼容 8.0+)") db_type=mysql; break ;;
          *) warn "请输入有效序号" ;;
        esac
      done

      echo
      echo "--- [步骤 3/3] 中间件（数据库 & Redis）镜像打包策略 ---"
      PS3='是否将数据库与 Redis 镜像一同打包？ > '
      select mid_opt in \
        "不打包中间件 (纯应用包，推荐！服务器已有 MySQL/PostgreSQL/Redis 时选此项，体积最小、打包最快)" \
        "打包全部中间件 (全套离线交付包，含数据库 + Redis 镜像，开箱即用)" \
        "仅打包数据库镜像 (不包含 Redis 镜像)" \
        "仅打包 Redis 镜像 (不包含数据库镜像)"; do
        case "$mid_opt" in
          "不打包中间件 (纯应用包，推荐！服务器已有 MySQL/PostgreSQL/Redis 时选此项，体积最小、打包最快)")
            docker_middleware="none"; break ;;
          "打包全部中间件 (全套离线交付包，含数据库 + Redis 镜像，开箱即用)")
            docker_middleware="all"; break ;;
          "仅打包数据库镜像 (不包含 Redis 镜像)")
            docker_middleware="db-only"; break ;;
          "仅打包 Redis 镜像 (不包含数据库镜像)")
            docker_middleware="redis-only"; break ;;
          *) warn "请输入有效序号" ;;
        esac
      done
    else
      db_type="postgres" # Web 独打时数据库占位
      docker_middleware="none"
    fi

    pack_docker_offline "$db_type" "$docker_components" "$docker_middleware"
    return 0
  fi

  # PM2 打包流程
  if [ -f apps/api/dist/src/main.js ] && [ -f apps/web/out/index.html ]; then
    read -rp "检测到现有本地构建产物，是否复用？[y/N] " answer
    case "${answer:-N}" in [yY]*) skip_build=true ;; esac
  fi

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
    docker-offline)
      local components=${3:-all}
      local include_middleware=${4:-all}
      pack_docker_offline "$db_type" "$components" "$include_middleware"
      ;;
    interactive) package_interactive ;;
    *) usage; exit 1 ;;
  esac
}
