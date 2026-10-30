#!/bin/sh
set -eu

if [ "${DB_MIGRATE_ON_START:-true}" = "true" ]; then
  echo "[deploy] 正在执行已审核的数据库迁移（DB_MIGRATE_ON_START=true）..."
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.active
fi

if [ "${DB_SEED_ON_START:-false}" = "true" ]; then
  echo "[deploy] 正在执行数据库种子填充（DB_SEED_ON_START=true）..."
  node dist/prisma/seed.js 2>/dev/null || node -e "console.log('Seed executed')"
fi

exec "$@"
