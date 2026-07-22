import { cpSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prismaDir = dirname(fileURLToPath(import.meta.url));
const provider = process.argv[2];

if (!['postgres', 'mysql'].includes(provider)) {
  throw new Error('数据库类型只能是 postgres 或 mysql');
}

const schemaSource = join(prismaDir, provider);
const migrationSource = join(prismaDir, `migrations.${provider}`);
const activeSchema = join(prismaDir, 'schema.active');
const activeMigrations = join(prismaDir, 'migrations');

if (!existsSync(schemaSource) || !existsSync(migrationSource)) {
  throw new Error(`缺少 ${provider} 的 Prisma schema 或迁移历史`);
}

rmSync(activeSchema, { recursive: true, force: true });
rmSync(activeMigrations, { recursive: true, force: true });
cpSync(schemaSource, activeSchema, { recursive: true });

// Prisma 固定从 schema 同级的 migrations/ 读取迁移。使用链接而不是复制，确保
// `prisma migrate dev` 生成的新迁移直接写入对应数据库的受版本控制目录。
// Windows 的 junction 需要绝对目标；Unix 使用相对链接，便于 Docker/离线包搬运。
symlinkSync(
  process.platform === 'win32' ? migrationSource : basename(migrationSource),
  activeMigrations,
  process.platform === 'win32' ? 'junction' : 'dir',
);

console.log(`Prisma 已切换到 ${provider} schema 与迁移历史`);
