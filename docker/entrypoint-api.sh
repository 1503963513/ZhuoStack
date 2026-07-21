#!/bin/sh
set -eu

if [ "${DB_AUTO_SYNC:-true}" = "true" ]; then
  echo "[deploy] 正在同步数据库结构（DB_AUTO_SYNC=true）..."
  ./node_modules/.bin/prisma db push --schema=prisma/schema.active --skip-generate
fi

exec "$@"
