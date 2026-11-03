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

ensure_rsa_keypair() {
  local file=$1 private_b64 public_b64 temp_dir private_file public_file derived_file
  private_b64=$(env_value "$file" RSA_PRIVATE_KEY_B64 '')
  public_b64=$(env_value "$file" RSA_PUBLIC_KEY_B64 '')
  case "$private_b64" in CHANGE_ME_*) private_b64='' ;; esac
  case "$public_b64" in CHANGE_ME_*) public_b64='' ;; esac

  if [ -n "$private_b64" ] && [ -n "$public_b64" ]; then
    command -v openssl >/dev/null 2>&1 || die "校验 RSA 密钥需要 openssl"
    temp_dir=$(mktemp -d)
    trap 'rm -rf "$temp_dir"' RETURN
    printf '%s' "$private_b64" | openssl base64 -d -A > "$temp_dir/private.pem" 2>/dev/null \
      || die "$file 中 RSA_PRIVATE_KEY_B64 不是有效的 Base64"
    printf '%s' "$public_b64" | openssl base64 -d -A > "$temp_dir/public.pem" 2>/dev/null \
      || die "$file 中 RSA_PUBLIC_KEY_B64 不是有效的 Base64"
    openssl pkey -in "$temp_dir/private.pem" -check -noout >/dev/null 2>&1 \
      || die "$file 中 RSA_PRIVATE_KEY_B64 不是有效的私钥"
    openssl pkey -pubin -in "$temp_dir/public.pem" -noout >/dev/null 2>&1 \
      || die "$file 中 RSA_PUBLIC_KEY_B64 不是有效的公钥"
    openssl pkey -in "$temp_dir/private.pem" -pubout -out "$temp_dir/derived-public.pem" >/dev/null 2>&1
    if ! cmp -s "$temp_dir/public.pem" "$temp_dir/derived-public.pem"; then
      die "$file 中 RSA_PUBLIC_KEY_B64 与 RSA_PRIVATE_KEY_B64 不匹配"
    fi
    rm -rf "$temp_dir"
    trap - RETURN
    return 0
  fi

  if [ -n "$private_b64" ] || [ -n "$public_b64" ]; then
    die "$file 中 RSA_PUBLIC_KEY_B64 与 RSA_PRIVATE_KEY_B64 必须同时配置"
  fi

  command -v openssl >/dev/null 2>&1 || die "生成 RSA 密钥需要 openssl"
  temp_dir=$(mktemp -d)
  private_file="$temp_dir/private.pem"
  public_file="$temp_dir/public.pem"
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$private_file" >/dev/null 2>&1
  openssl pkey -in "$private_file" -pubout -out "$public_file" >/dev/null 2>&1
  chmod 600 "$private_file"
  private_b64=$(openssl base64 -A -in "$private_file")
  public_b64=$(openssl base64 -A -in "$public_file")
  set_env_value "$file" RSA_PRIVATE_KEY_B64 "$private_b64"
  set_env_value "$file" RSA_PUBLIC_KEY_B64 "$public_b64"
  rm -rf "$temp_dir"
  info "已为 $file 生成固定 RSA-2048 密钥对"
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

ensure_database_passwords() {
  local file=$1 db_type value key
  # 外部数据库不读取这些内置容器变量，其凭据只通过 DATABASE_URL 管理。
  if [ "$(env_value "$file" EXTERNAL_DB false)" = true ]; then
    return 0
  fi
  db_type=$(db_type_from_file "$file")
  if [ "$db_type" = mysql ]; then
    for key in MYSQL_ROOT_PASSWORD MYSQL_PASSWORD; do
      value=$(env_value "$file" "$key" '')
      case "$value" in
        ''|root|password|123456|root123|zhuostack123|CHANGE_ME_*)
          die "$file 中 $key 仍为空、占位符或弱密码；请先在数据库中修改对应用户密码，再同步更新配置"
          ;;
      esac
    done
    return 0
  fi

  value=$(env_value "$file" POSTGRES_PASSWORD '')
  case "$value" in
    ''|postgres|password|123456|zhuostack123|CHANGE_ME_*)
      die "$file 中 POSTGRES_PASSWORD 仍为空、占位符或弱密码；请先在数据库中修改对应用户密码，再同步更新配置"
      ;;
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
  # 容器以执行部署的用户 UID/GID 运行，上传目录无需再放开为 777。
  set_env_value .env.deploy DOCKER_UID "$(id -u)"
  set_env_value .env.deploy DOCKER_GID "$(id -g)"
  # 旧版模板曾默认开启 Seed；部署时强制关闭，避免误删生产数据。
  set_env_value .env.deploy DB_SEED_ON_START false
  ensure_database_passwords .env.deploy
  ensure_strong_jwt .env.deploy
  ensure_redis_password .env.deploy
  ensure_rsa_keypair .env.deploy
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
  ensure_rsa_keypair "$env_file"
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

compress_cmd() {
  if command -v pigz >/dev/null 2>&1; then
    printf 'pigz'
  else
    printf 'gzip'
  fi
}

resolve_target_platform() {
  if [ -n "${TARGET_ARCH:-}" ]; then
    printf '%s' "$TARGET_ARCH"
    return 0
  fi

  local host_arch native_platform
  host_arch=$(uname -m)
  case "$host_arch" in
    x86_64|amd64) native_platform="linux/amd64" ;;
    aarch64|arm64) native_platform="linux/arm64" ;;
    *) native_platform="linux/amd64" ;;
  esac

  # 非交互终端环境（如 CI/CD 或后台脚本），默认按通用生产服务器架构 linux/amd64
  if [ ! -t 0 ]; then
    printf '%s' "${DEFAULT_ARCH:-linux/amd64}"
    return 0
  fi

  echo >&2
  info "当前主机硬件架构: $host_arch (原生容器平台: $native_platform)" >&2
  echo "请选择打包的目标服务器架构：" >&2
  echo "  1) linux/amd64 (标准 x86_64 云服务器，如阿里云/腾讯云/Intel/AMD)" >&2
  echo "  2) linux/arm64 (ARM 云服务器 / 树莓派 / 本地 Apple Silicon)" >&2
  echo "  3) 本机原生架构 ($native_platform, 无跨平台转译，构建速度最快)" >&2

  local choice
  while true; do
    read -rp "请输入序号 [1-3, 默认 1]: " choice
    choice=${choice:-1}
    case "$choice" in
      1) printf 'linux/amd64'; return 0 ;;
      2) printf 'linux/arm64'; return 0 ;;
      3) printf '%s' "$native_platform"; return 0 ;;
      *) warn "无效选项，请输入 1、2 或 3" >&2 ;;
    esac
  done
}
