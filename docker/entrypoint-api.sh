#!/bin/sh
set -eu

if [ "${DB_MIGRATE_ON_START:-true}" = "true" ]; then
  echo "[deploy] 正在执行已审核的数据库迁移（DB_MIGRATE_ON_START=true）..."
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.active
fi

if [ "${DB_SEED_ON_START:-false}" = "true" ]; then
  if [ "${NODE_ENV:-production}" = "production" ]; then
    echo "[deploy] 拒绝在生产环境执行数据库 Seed（DB_SEED_ON_START=true）" >&2
    exit 1
  fi
  echo "[deploy] 正在执行数据库种子填充（DB_SEED_ON_START=true）..."
  node dist/prisma/seed.js
fi

exec "$@"
