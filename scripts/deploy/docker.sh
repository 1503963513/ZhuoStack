#!/usr/bin/env bash
# Docker Compose 部署与离线镜像载入。

compose_command() {
  ensure_deploy_env
  local db_type packaged_db
  db_type=$(db_type_from_file .env.deploy)
  if [ -f .offline-db-type ]; then
    packaged_db=$(tr -d '[:space:]' < .offline-db-type)
    [ "$packaged_db" = "$db_type" ] || die "该离线 Docker 包为 $packaged_db 构建，但 .env.deploy 配置为 $db_type"
  fi
  COMPOSE=(docker compose --env-file .env.deploy -f docker-compose.yml)
  if [ "$db_type" = mysql ]; then
    COMPOSE+=(-f docker/compose.mysql.yml)
  fi
}

load_offline_images_if_needed() {
  [ -f offline-images.tar ] || return 0
  [ -f .offline-images-loaded ] && return 0
  info "导入离线 Docker 镜像，首次执行可能需要几分钟"
  docker load -i offline-images.tar
  touch .offline-images-loaded
}

docker_deploy() {
  command -v docker >/dev/null 2>&1 || die "未安装 Docker"
  local action=${1:-}
  compose_command
  case "$action" in
    up)
      load_offline_images_if_needed
      if [ -f offline-images.tar ]; then
        info "使用离线镜像启动服务"
        "${COMPOSE[@]}" up -d --no-build
      else
        info "构建并启动服务"
        "${COMPOSE[@]}" up -d --build
      fi
      "${COMPOSE[@]}" ps
      local tls_dir
      tls_dir=$(env_value .env.deploy TLS_CERT_DIR ./docker/certs)
      if [ -f "$tls_dir/tls.crt" ] && [ -f "$tls_dir/tls.key" ]; then
        ok "部署完成：https://localhost:$(env_value .env.deploy WEB_TLS_PORT 443)"
      else
        warn "未发现本地 TLS 证书；HTTP 入口仅应供外部 HTTPS 负载均衡器/Ingress 回源"
        ok "内部 HTTP 入口：http://localhost:$(env_value .env.deploy WEB_PORT 80)"
      fi
      ;;
    down) "${COMPOSE[@]}" down ;;
    restart) "${COMPOSE[@]}" restart ;;
    logs) "${COMPOSE[@]}" logs -f --tail=200 ;;
    status|ps) "${COMPOSE[@]}" ps ;;
    config) "${COMPOSE[@]}" config ;;
    *) usage; exit 1 ;;
  esac
}
