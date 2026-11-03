#!/usr/bin/env bash
# Docker Compose 部署与离线镜像载入。

compose_command() {
  ensure_deploy_env
  local db_type packaged_db external_db
  db_type=$(db_type_from_file .env.deploy)
  external_db=$(env_value .env.deploy EXTERNAL_DB false)
  if [ -f .offline-db-type ]; then
    packaged_db=$(tr -d '[:space:]' < .offline-db-type)
    if [ "$packaged_db" != "any" ] && [ "$packaged_db" != "$db_type" ]; then
      die "该离线 Docker 包为 $packaged_db 构建，但 .env.deploy 配置为 $db_type"
    fi
  fi
  if [ "$external_db" = true ]; then
    info "检测到 EXTERNAL_DB=true，启用外部独立数据库与缓存模式（仅启动 API 与 Web，不启动内置 DB 与 Redis 容器）"
    if [ -f docker/compose.app-only.yml ]; then
      COMPOSE=(docker compose --env-file .env.deploy -f docker/compose.app-only.yml)
    else
      COMPOSE=(docker compose --env-file .env.deploy -f docker-compose.yml -f docker/compose.external-db.yml)
    fi
  else
    COMPOSE=(docker compose --env-file .env.deploy -f docker-compose.yml)
    if [ "$db_type" = mysql ]; then
      COMPOSE+=(-f docker/compose.mysql.yml)
    fi
  fi
}

load_offline_images_if_needed() {
  local img_file=""
  if [ -f offline-images.tar.gz ]; then
    img_file="offline-images.tar.gz"
  elif [ -f offline-images.tar ]; then
    img_file="offline-images.tar"
  fi
  [ -n "$img_file" ] || return 0

  # 仅当标记文件存在且比镜像压缩包更新时，才跳过导入；否则自动载入新包镜像
  if [ -f .offline-images-loaded ] && [ .offline-images-loaded -nt "$img_file" ]; then
    return 0
  fi

  info "检测到新版本离线 Docker 镜像包 ($img_file)，正在自动导入"
  docker load -i "$img_file"
  touch .offline-images-loaded

  # 如果解压出的模板中包含新版本号，自动同步更新到 .env.deploy 中
  if [ -f .env.deploy.example ] && [ -f .env.deploy ]; then
    local new_app_ver new_web_ver new_api_ver
    new_app_ver=$(env_value .env.deploy.example APP_VERSION '')
    new_web_ver=$(env_value .env.deploy.example WEB_VERSION '')
    new_api_ver=$(env_value .env.deploy.example API_VERSION '')

    if [ -n "$new_web_ver" ]; then
      set_env_value .env.deploy WEB_VERSION "$new_web_ver"
      info "已自动将 .env.deploy 中的 WEB_VERSION 更新为: $new_web_ver"
    elif [ -n "$new_api_ver" ]; then
      set_env_value .env.deploy API_VERSION "$new_api_ver"
      info "已自动将 .env.deploy 中的 API_VERSION 更新为: $new_api_ver"
    elif [ -n "$new_app_ver" ]; then
      set_env_value .env.deploy APP_VERSION "$new_app_ver"
      info "已自动将 .env.deploy 中的 APP_VERSION 更新为: $new_app_ver"
    fi
  fi
}

docker_deploy() {
  command -v docker >/dev/null 2>&1 || die "未安装 Docker"
  local action=${1:-}
  compose_command
  case "$action" in
    up)
      load_offline_images_if_needed
      local upload_dir
      upload_dir=$(env_value .env.deploy HOST_UPLOAD_DIR ./uploads)
      mkdir -p "$upload_dir" docker/uploads 2>/dev/null || true
      chmod -R u+rwX,g+rwX,o-rwx "$upload_dir" docker/uploads 2>/dev/null || true

      local target_services=()
      if [ -f .offline-components ]; then
        local comp_type
        comp_type=$(tr -d '[:space:]' < .offline-components)
        if [ "$comp_type" = web ]; then
          info "检测到仅 Web 离线更新包，仅重启 Web 服务"
          target_services=(web)
        elif [ "$comp_type" = api ]; then
          info "检测到仅 API 离线更新包，仅重启 API 服务"
          target_services=(api)
        fi
      fi

      if [ -f offline-images.tar.gz ] || [ -f offline-images.tar ]; then
        info "使用离线镜像启动服务"
        if [ "${#target_services[@]}" -gt 0 ]; then
          "${COMPOSE[@]}" up -d --no-build --no-deps "${target_services[@]}"
        else
          "${COMPOSE[@]}" up -d --no-build
        fi
      else
        info "构建并启动服务"
        if [ "${#target_services[@]}" -gt 0 ]; then
          "${COMPOSE[@]}" up -d --build --no-deps "${target_services[@]}"
        else
          "${COMPOSE[@]}" up -d --build
        fi
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
