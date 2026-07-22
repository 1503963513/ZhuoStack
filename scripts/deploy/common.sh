#!/usr/bin/env bash
# 部署公共能力：输出、环境文件、数据库类型和项目构建。

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}→${NC} $*"; }
ok() { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
die() { echo -e "${RED}❌ $*${NC}" >&2; exit 1; }

env_value() {
  local file=$1 key=$2 fallback=${3:-} value
  value=$(awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file" 2>/dev/null || true)
  printf '%s' "${value:-$fallback}"
}

set_env_value() {
  local file=$1 key=$2 value=$3 temp
  temp="${file}.tmp.$$"
  awk -v key="$key" -v value="$value" '
    BEGIN { found=0 }
    $0 ~ "^" key "=" { print key "=" value; found=1; next }
    { print }
    END { if (!found) print key "=" value }
  ' "$file" > "$temp"
  mv "$temp" "$file"
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 64
  else
    od -An -N64 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

ensure_strong_jwt() {
  local file=$1 secret
  secret=$(env_value "$file" JWT_SECRET '')
  case "$secret" in
    ''|default-secret|your-super-secret-jwt-key-change-in-production|secret|jwt-secret|changeme|123456|CHANGE_ME_*)
      set_env_value "$file" JWT_SECRET "$(random_secret)"
      info "已为 $file 生成强随机 JWT_SECRET"
      ;;
    *)
      if [ "${#secret}" -lt 32 ]; then
        set_env_value "$file" JWT_SECRET "$(random_secret)"
        info "已替换 $file 中长度不足的 JWT_SECRET"
      fi
      ;;
  esac
}

ensure_redis_password() {
  local file=$1 password
  password=$(env_value "$file" REDIS_PASSWORD '')
  case "$password" in
    ''|CHANGE_ME_*)
      set_env_value "$file" REDIS_PASSWORD "$(random_secret)"
      info "已为 $file 生成强随机 REDIS_PASSWORD"
      ;;
  esac
}

db_type_from_file() {
  local file=$1 value
  value=$(env_value "$file" DB_TYPE postgres)
  case "$value" in
    postgres|postgresql) printf 'postgres' ;;
    mysql) printf 'mysql' ;;
    *) die "DB_TYPE 只能是 postgres 或 mysql，当前为: $value" ;;
  esac
}

ensure_database_config() {
  local file=$1 db_type database_url
  db_type=$(db_type_from_file "$file")
  database_url=$(env_value "$file" DATABASE_URL '')
  [ -n "$database_url" ] || die "$file 缺少 DATABASE_URL"
  case "$db_type:$database_url" in
    postgres:postgres://*|postgres:postgresql://*|mysql:mysql://*) ;;
    *) die "$file 的 DB_TYPE=$db_type 与 DATABASE_URL 协议不匹配" ;;
  esac
}

ensure_deploy_env() {
  if [ ! -f .env.deploy ]; then
    local postgres_password mysql_password mysql_root_password db_type
    cp .env.deploy.example .env.deploy
    postgres_password=$(random_secret)
    mysql_password=$(random_secret)
    mysql_root_password=$(random_secret)
    postgres_password=${postgres_password:0:32}
    mysql_password=${mysql_password:0:32}
    mysql_root_password=${mysql_root_password:0:32}
    set_env_value .env.deploy POSTGRES_PASSWORD "$postgres_password"
    set_env_value .env.deploy MYSQL_PASSWORD "$mysql_password"
    set_env_value .env.deploy MYSQL_ROOT_PASSWORD "$mysql_root_password"
    db_type=$(db_type_from_file .env.deploy)
    if [ "$db_type" = mysql ]; then
      set_env_value .env.deploy DATABASE_URL "mysql://zhuostack:${mysql_password}@db:3306/zhuostack"
    else
      set_env_value .env.deploy DATABASE_URL "postgresql://zhuostack:${postgres_password}@db:5432/zhuostack"
    fi
    chmod 600 .env.deploy 2>/dev/null || true
    warn "已创建 .env.deploy 并生成数据库密码和 JWT 密钥；生产部署前请检查 CORS_ORIGIN 与 TLS 证书"
  fi
  ensure_strong_jwt .env.deploy
  ensure_redis_password .env.deploy
  ensure_database_config .env.deploy
}

ensure_api_env() {
  local env_file=apps/api/.env.production legacy_env_file=apps/api/.env
  if [ ! -f "$env_file" ]; then
    if [ -f "$legacy_env_file" ]; then
      mv "$legacy_env_file" "$env_file"
      warn "已将旧配置 apps/api/.env 迁移为 $env_file"
    else
      cp apps/api/.env.example "$env_file"
      warn "已创建 $env_file；启动前请检查 DATABASE_URL 和 CORS_ORIGIN"
    fi
  fi
  set_env_value "$env_file" NODE_ENV production
  chmod 600 "$env_file" 2>/dev/null || true
  ensure_strong_jwt "$env_file"
  ensure_database_config "$env_file"
}

activate_prisma_schema() {
  local db_type=$1
  (cd apps/api && node prisma/select-schema.mjs "$db_type")
}

build_project() {
  command -v pnpm >/dev/null 2>&1 || die "打包机需要 pnpm"
  if [ "${DEPLOY_SKIP_BUILD:-false}" = true ] \
    && [ -f apps/api/dist/src/main.js ] \
    && [ -f apps/web/out/index.html ]; then
    info "复用现有 API 与 Web 构建产物"
    return 0
  fi
  info "构建 API 与 Web"
  pnpm build:deploy
  [ -f apps/api/dist/src/main.js ] || die "API 构建产物缺失"
  [ -f apps/web/out/index.html ] || die "Web 构建产物缺失"
}
