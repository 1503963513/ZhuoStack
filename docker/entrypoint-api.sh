#!/bin/sh
set -eu

if [ "${DB_MIGRATE_ON_START:-true}" = "true" ]; then
  echo "[deploy] 正在执行已审核的数据库迁移（DB_MIGRATE_ON_START=true）..."
  ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.active
fi

exec "$@"
