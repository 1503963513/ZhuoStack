import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const apiDir = dirname(prismaDir);
const provider = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!['postgres', 'mysql'].includes(provider)) {
  throw new Error('用法: node prisma/baseline-existing.mjs <postgres|mysql>');
}
if (process.env.MIGRATION_BASELINE_CONFIRM !== 'I_HAVE_BACKED_UP') {
  throw new Error('先完成数据库备份，再设置 MIGRATION_BASELINE_CONFIRM=I_HAVE_BACKED_UP');
}
if (!databaseUrl) throw new Error('缺少 DATABASE_URL');

const protocol = new URL(databaseUrl).protocol;
const expectedProtocols = provider === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:'];
if (!expectedProtocols.includes(protocol)) {
  throw new Error(`${provider} 基线命令不能使用 ${protocol} 数据库 URL`);
}

const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');

function run(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: apiDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const migrationDir = join(prismaDir, `migrations.${provider}`);
const migrations = readdirSync(migrationDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (migrations.length === 0) throw new Error(`${provider} 没有可登记的迁移`);

const selectResult = spawnSync(process.execPath, [join(prismaDir, 'select-schema.mjs'), provider], {
  cwd: apiDir,
  stdio: 'inherit',
});
if (selectResult.error) throw selectResult.error;
if (selectResult.status !== 0) process.exit(selectResult.status ?? 1);
run(['validate', '--schema=prisma/schema.active']);

// 只有现有数据库与当前 schema 完全一致时才允许登记，避免掩盖真实漂移。
run([
  'migrate',
  'diff',
  '--from-config-datasource',
  '--to-schema=prisma/schema.active',
  '--exit-code',
]);

for (const migration of migrations) {
  run(['migrate', 'resolve', '--schema=prisma/schema.active', '--applied', migration]);
}

console.log(`${provider} 现有数据库已登记迁移基线；请立即执行 migrate deploy 再次确认状态。`);
