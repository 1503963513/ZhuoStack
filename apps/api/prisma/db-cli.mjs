#!/usr/bin/env node

/**
 * ZhuoStack 数据库统一调度脚本 (DB CLI)
 *
 * 作用：自动读取环境配置中的 DB_TYPE (postgres | mysql)，让日常开发命令高度统一：
 *   pnpm db:migrate
 *   pnpm db:generate
 *   pnpm db:seed
 *   pnpm db:setup
 *   pnpm db:studio
 *   pnpm db:deploy
 *
 * 同时支持显式参数覆盖：
 *   node prisma/db-cli.mjs migrate --mysql
 *   node prisma/db-cli.mjs migrate --pg
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const apiDir = dirname(prismaDir);
const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');

// 简单解析 .env 文件的 key=value
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

const envDev = parseEnvFile(join(apiDir, '.env.development'));
const envRoot = parseEnvFile(join(apiDir, '../../.env'));

// 提取当前环境目标数据库类型
function resolveProvider(cliArgs) {
  // 1. 显式 CLI 参数最高优先级
  if (cliArgs.includes('--mysql')) return 'mysql';
  if (cliArgs.includes('--pg') || cliArgs.includes('--postgres')) return 'postgres';

  // 2. 进程环境变量
  if (process.env.DB_TYPE) {
    const envVal = process.env.DB_TYPE.toLowerCase();
    return envVal === 'mysql' ? 'mysql' : 'postgres';
  }

  // 3. 从 .env.development / .env 读取
  if (envDev.DB_TYPE) {
    return envDev.DB_TYPE.toLowerCase() === 'mysql' ? 'mysql' : 'postgres';
  }

  if (envRoot.DB_TYPE) {
    return envRoot.DB_TYPE.toLowerCase() === 'mysql' ? 'mysql' : 'postgres';
  }

  return 'postgres';
}

const rawArgs = process.argv.slice(2);
const action = rawArgs[0] || 'help';
const provider = resolveProvider(rawArgs);
const filteredArgs = rawArgs.slice(1).filter((arg) => !['--mysql', '--pg', '--postgres'].includes(arg));

// 构造安全有效的基础环境变量，确保 Prisma 7+ 在加载 prisma.config.ts 时不报错
const fallbackDbUrl = provider === 'mysql'
  ? 'mysql://root:root@localhost:3309/zhuostack'
  : 'postgresql://zhuostack:zhuostack123@localhost:5432/zhuostack';

const baseEnv = {
  ...envRoot,
  ...envDev,
  ...process.env,
  DB_TYPE: provider,
  DATABASE_URL: process.env.DATABASE_URL || envDev.DATABASE_URL || envRoot.DATABASE_URL || fallbackDbUrl,
};

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: apiDir,
    env: { ...baseEnv, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// 确保已切换到对应 provider
function ensureSchemaSelected() {
  run(process.execPath, [join(prismaDir, 'select-schema.mjs'), provider]);
}

switch (action) {
  case 'switch':
    ensureSchemaSelected();
    break;

  case 'generate':
    ensureSchemaSelected();
    run(process.execPath, [prismaCli, 'generate', '--schema=prisma/schema.active']);
    console.log(`\n✨ 已针对 ${provider} 成功生成 Prisma Client`);
    break;

  case 'migrate':
    ensureSchemaSelected();
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.development',
        prismaCli,
        'migrate',
        'dev',
        '--schema=prisma/schema.active',
        ...filteredArgs,
      ],
    );
    break;

  case 'deploy':
    ensureSchemaSelected();
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.production',
        prismaCli,
        'migrate',
        'deploy',
        '--schema=prisma/schema.active',
      ],
    );
    break;

  case 'seed':
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.development',
        '--import',
        'tsx',
        join(prismaDir, 'seed.ts'),
      ],
    );
    break;

  case 'setup':
    ensureSchemaSelected();
    console.log(`\n🚀 开始针对 ${provider} 执行一键数据库初始化 (generate -> migrate -> seed)...`);
    run(process.execPath, [prismaCli, 'generate', '--schema=prisma/schema.active']);
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.development',
        prismaCli,
        'migrate',
        'dev',
        '--schema=prisma/schema.active',
      ],
    );
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.development',
        '--import',
        'tsx',
        join(prismaDir, 'seed.ts'),
      ],
    );
    console.log(`\n🎉 ${provider} 数据库初始化全部完成！`);
    break;

  case 'studio':
    ensureSchemaSelected();
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.development',
        prismaCli,
        'studio',
        '--schema=prisma/schema.active',
      ],
    );
    break;

  case 'verify':
    run(process.execPath, [join(prismaDir, 'verify-migrations.mjs'), provider]);
    break;

  case 'baseline':
    run(
      process.execPath,
      [
        '--env-file-if-exists=.env.production',
        join(prismaDir, 'baseline-existing.mjs'),
        provider,
      ],
    );
    break;

  default:
    console.log(`
ZhuoStack 数据库统一命令工具 (DB CLI):
当前识别 DB_TYPE: ${provider}

常用命令:
  pnpm db:migrate    # 执行迁移 (开发环境 migrate dev)
  pnpm db:generate   # 切换对应 schema 并生成 Prisma Client
  pnpm db:seed       # 填充种子数据
  pnpm db:setup      # 一键初始化 (切换 + 生成 + 迁移 + 填充)
  pnpm db:studio     # 打开 Prisma Studio 可视化界面
  pnpm db:deploy     # 生产环境部署迁移 (migrate deploy)

参数覆盖:
  可在任意命令后加 --mysql 或 --pg 强制指定目标数据库，例如:
  pnpm db:migrate --mysql
`);
    break;
}
