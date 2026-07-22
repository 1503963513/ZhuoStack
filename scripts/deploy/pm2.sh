#!/usr/bin/env bash
# PM2 运行、首次安装、更新和数据库同步。

select_node_runtime() {
  if [ -x "$ROOT_DIR/runtime/bin/node" ]; then
    export PATH="$ROOT_DIR/runtime/bin:$ROOT_DIR/node_modules/.bin:$ROOT_DIR/apps/api/node_modules/.bin:$PATH"
    export NODE_BINARY="$ROOT_DIR/runtime/bin/node"
  else
    command -v node >/dev/null 2>&1 || die "未安装 Node.js，且部署包中未包含离线运行时"
    export NODE_BINARY
    NODE_BINARY=$(command -v node)
  fi
}

pm2_command() {
  select_node_runtime
  if [ -f "$ROOT_DIR/node_modules/pm2/bin/pm2" ]; then
    "$NODE_BINARY" "$ROOT_DIR/node_modules/pm2/bin/pm2" "$@"
  elif [ -f "$ROOT_DIR/apps/api/node_modules/pm2/bin/pm2" ]; then
    "$NODE_BINARY" "$ROOT_DIR/apps/api/node_modules/pm2/bin/pm2" "$@"
  elif command -v pm2 >/dev/null 2>&1; then
    pm2 "$@"
  else
    die "未找到 PM2，请先执行 pnpm ops pm2 prepare"
  fi
}

pm2_prepare() {
  ensure_api_env
  select_node_runtime
  local mode db_type packaged_db
  mode=$(tr -d '[:space:]' < .deploy-mode 2>/dev/null || true)
  db_type=$(db_type_from_file apps/api/.env.production)
  packaged_db=$(tr -d '[:space:]' < .deploy-db-type 2>/dev/null || true)

  if [ "$mode" = offline ]; then
    [ -d node_modules ] || die "离线包缺少 node_modules"
    if [ -n "$packaged_db" ] && [ "$packaged_db" != "$db_type" ]; then
      die "该离线包为 $packaged_db 构建，但 apps/api/.env.production 配置为 $db_type；请重新打对应数据库的包"
    fi
    info "离线依赖和 Prisma Client 已就绪，跳过安装"
    return 0
  fi

  command -v pnpm >/dev/null 2>&1 || die "在线 PM2 部署需要 pnpm 10+"
  if [ "$mode" = online ]; then
    info "安装 API 生产依赖（包含项目本地 PM2）"
    pnpm install --frozen-lockfile --prod --filter "api..."
  else
    info "源码目录模式：复用现有依赖"
  fi
  activate_prisma_schema "$db_type"
  (cd apps/api && pnpm prisma:generate)
}

pm2_health_check() {
  local port
  port=$(env_value apps/api/.env.production PORT 3100)
  info "健康检查 http://127.0.0.1:${port}/health"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --retry 10 --retry-delay 2 --retry-connrefused "http://127.0.0.1:${port}/health" >/dev/null
  else
    "$NODE_BINARY" -e "fetch('http://127.0.0.1:${port}/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  fi
}

pm2_start() {
  [ -f apps/api/dist/src/main.js ] || die "缺少 apps/api/dist/src/main.js，请先 pnpm build:deploy 或使用部署包"
  pm2_prepare
  mkdir -p logs
  pm2_command start ecosystem.config.js --update-env
  pm2_health_check || {
    pm2_command logs myapp-api --lines 50 --nostream || true
    die "API 健康检查失败"
  }
  pm2_command save
  ok "API 已由 PM2 启动"
}

pm2_restart() {
  pm2_prepare
  pm2_command restart ecosystem.config.js --update-env
  pm2_health_check
  ok "API 已重启"
}

pm2_update() {
  local archive=${1:-} saved_env=''
  if [ -n "$archive" ]; then
    [ -f "$archive" ] || die "找不到部署包: $archive"
    ensure_api_env
    saved_env=$(mktemp)
    if [ -f apps/api/.env.production ]; then cp apps/api/.env.production "$saved_env"; fi
    info "解压更新包并保留生产环境配置"
    tar -xzf "$archive"
    if [ -s "$saved_env" ]; then cp "$saved_env" apps/api/.env.production; fi
    rm -f "$saved_env"
  fi
  pm2_restart
}

pm2_sync_database() {
  ensure_api_env
  select_node_runtime
  local db_type
  db_type=$(db_type_from_file apps/api/.env.production)
  activate_prisma_schema "$db_type"
  (cd apps/api && ./node_modules/.bin/prisma db push --schema=prisma/schema.active --skip-generate)
  ok "数据库结构同步完成"
}

pm2_deploy() {
  local action=${1:-}
  shift || true
  case "$action" in
    prepare) pm2_prepare; ok "PM2 运行环境准备完成" ;;
    start) pm2_start ;;
    restart) pm2_restart ;;
    update) pm2_update "${1:-}" ;;
    stop) pm2_command stop ecosystem.config.js ;;
    logs) pm2_command logs myapp-api --lines 200 ;;
    status|ps) pm2_command status ;;
    db-sync) pm2_sync_database ;;
    *) usage; exit 1 ;;
  esac
}
