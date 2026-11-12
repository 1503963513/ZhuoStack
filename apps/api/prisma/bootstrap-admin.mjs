#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const apiDir = dirname(prismaDir);
const dbType = process.env.DB_TYPE || 'postgres';
const provider = dbType === 'postgresql' ? 'postgres' : dbType;
const compiledSeed = join(apiDir, 'dist/prisma/seed.js');

if (!['postgres', 'mysql'].includes(provider)) {
  throw new Error('DB_TYPE 只能是 postgres、postgresql 或 mysql');
}
if (!existsSync(compiledSeed)) {
  throw new Error('未找到编译后的初始化程序，请先构建 API（pnpm --filter api build）');
}

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: apiDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run([join(prismaDir, 'select-schema.mjs'), provider]);
run([compiledSeed, '--bootstrap-admin']);
