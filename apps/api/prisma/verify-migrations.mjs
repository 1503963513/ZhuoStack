import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const apiDir = dirname(prismaDir);
const provider = process.argv[2];
const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;

if (!['postgres', 'mysql'].includes(provider)) {
  throw new Error('用法: node prisma/verify-migrations.mjs <postgres|mysql>');
}
if (!databaseUrl) {
  throw new Error('必须提供仅用于测试的 MIGRATION_TEST_DATABASE_URL（目标应为空数据库）');
}

const parsedUrl = new URL(databaseUrl);
const expectedProtocols = provider === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:'];
if (!expectedProtocols.includes(parsedUrl.protocol)) {
  throw new Error(`${provider} 迁移不能使用 ${parsedUrl.protocol} 数据库 URL`);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)) {
  throw new Error('迁移链验证仅允许连接本机一次性数据库，防止误操作生产环境');
}

const lockFile = join(prismaDir, `migrations.${provider}`, 'migration_lock.toml');
const expectedLockProvider = provider === 'postgres' ? 'postgresql' : 'mysql';
if (!readFileSync(lockFile, 'utf8').includes(`provider = "${expectedLockProvider}"`)) {
  throw new Error(`${lockFile} 的 provider 与 ${provider} 不一致`);
}

const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: apiDir,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [join(prismaDir, 'select-schema.mjs'), provider]);
run(process.execPath, [prismaCli, 'validate', '--schema=prisma/schema.active'], {
  DATABASE_URL: databaseUrl,
});
run(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema=prisma/schema.active'], {
  DATABASE_URL: databaseUrl,
});
run(
  process.execPath,
  [
    prismaCli,
    'migrate',
    'diff',
    '--from-config-datasource',
    '--to-schema=prisma/schema.active',
    '--exit-code',
  ],
  { DATABASE_URL: databaseUrl },
);

console.log(`${provider} 迁移链执行成功，迁移结果与 Prisma schema 无漂移。`);
