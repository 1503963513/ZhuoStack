import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const apiDir = dirname(prismaDir);
const configuredType = process.env.DB_TYPE ?? 'postgres';
const databaseUrl = process.env.DATABASE_URL;

const provider = configuredType === 'postgresql' ? 'postgres' : configuredType;

if (!['postgres', 'mysql'].includes(provider)) {
  throw new Error(`DB_TYPE 只能是 postgres 或 mysql，当前为: ${configuredType}`);
}
if (!databaseUrl) {
  throw new Error('apps/api/.env.development 缺少 DATABASE_URL');
}

let protocol;
try {
  protocol = new URL(databaseUrl).protocol;
} catch {
  throw new Error('apps/api/.env.development 中的 DATABASE_URL 不是有效 URL');
}

const expectedProtocols = provider === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:'];
if (!expectedProtocols.includes(protocol)) {
  throw new Error(`DB_TYPE=${configuredType} 与 DATABASE_URL 的 ${protocol} 协议不匹配`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: apiDir,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [join(prismaDir, 'select-schema.mjs'), provider]);
run(process.execPath, [
  join(apiDir, 'node_modules', 'prisma', 'build', 'index.js'),
  'generate',
  '--schema=prisma/schema.active',
]);

console.log(`开发环境 Prisma Client 已按 DB_TYPE=${configuredType} 准备完成`);
