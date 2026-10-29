# Prisma 双数据库与迁移规范

项目同时支持 PostgreSQL 和 MySQL，两种数据库的 schema 与迁移历史独立维护。系统通过 `db-cli.mjs` 统一调度，开发者无需手动切换或记忆底层命令。

## 目录结构

```text
prisma/
├── db-cli.mjs               # 数据库统一调度入口（自动识别 DB_TYPE）
├── postgres/                 # PostgreSQL schema（受版本控制）
├── mysql/                    # MySQL schema（受版本控制）
├── migrations.postgres/     # PostgreSQL 迁移历史（受版本控制）
├── migrations.mysql/        # MySQL 迁移历史（受版本控制）
├── schema.active/            # 当前 schema 副本（自动生成、忽略提交）
└── migrations -> ...        # 指向当前迁移历史的链接（自动生成、忽略提交）
```

调度脚本会自动复制目标 schema，并把 `prisma/migrations` 链接到对应的受版本控制目录。这样 `prisma migrate dev` 新生成的迁移会直接写入对应的版本控制目录。

## 本地开发与日常使用

在 `apps/api/.env.development` 或根目录 `.env` 中设置 `DB_TYPE`（`postgres` 或 `mysql`），日常开发统一执行通用命令：

```bash
# 1. 首次初始化：自动切换当前数据库对应 schema、生成 Client、执行迁移、填充测试数据
pnpm db:setup

# 2. 修改 Schema 后重新生成 Client
pnpm db:generate

# 3. 执行开发迁移（自动生成 SQL 并应用）
pnpm db:migrate

# 4. 填充种子数据
pnpm db:seed

# 5. 打开 Prisma Studio 可视化数据管理
pnpm db:studio
```

> **提示**：所有命令均支持追加 `--pg` 或 `--mysql` 参数强制指定目标，例如 `pnpm db:migrate --mysql`。

一次业务结构变更必须分别修改 `postgres/models/` 与 `mysql/models/`，并分别生成、审核两套迁移 SQL。禁止手工把 MySQL 的反引号、`RENAME TABLE` 等语法复制到 PostgreSQL 目录，反之亦然。

## 生产部署

生产环境只执行已经提交并审核过的迁移：

```bash
# 自动加载 apps/api/.env.production 执行 migrate deploy
pnpm db:deploy

# 如需显式指定
pnpm db:deploy --pg
pnpm db:deploy --mysql
```

Docker 由构建参数 `DB_TYPE` 固化 Prisma Client 和迁移目录，容器启动时在 `DB_MIGRATE_ON_START=true` 的情况下执行 `prisma migrate deploy`。生产环境禁止使用 `prisma db push` 代替迁移。

### 从旧版 `db push` 部署升级

旧版通过 `db push` 创建的非空数据库没有 Prisma 迁移历史，首次切换到 `migrate deploy` 前必须做一次基线登记。先备份数据库并停止写入，确认 `DB_TYPE`、`DATABASE_URL` 指向目标库，然后执行基线命令：

```bash
MIGRATION_BASELINE_CONFIRM=I_HAVE_BACKED_UP pnpm db:baseline
# 或指定目标
MIGRATION_BASELINE_CONFIRM=I_HAVE_BACKED_UP pnpm db:baseline --pg
MIGRATION_BASELINE_CONFIRM=I_HAVE_BACKED_UP pnpm db:baseline --mysql
```

工具会先比较真实数据库与当前 schema；只要存在任何结构漂移就会退出，不会登记。零漂移时，它仅把现有迁移标记为已应用，不执行建表或修改业务数据。完成后执行 `pnpm db:deploy` 确认没有待处理迁移。已经由 Prisma Migrate 管理的数据库不要执行基线命令。

## 空库与漂移验证

以下命令会对一个本机的一次性空数据库执行完整迁移，然后检查数据库结构是否与 schema 一致。脚本只接受 `localhost`、`127.0.0.1` 或 `::1`，避免误连生产库。

```bash
# PostgreSQL 迁移链验证
MIGRATION_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/empty_db \
  pnpm db:verify --pg

# MySQL 迁移链验证
MIGRATION_TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/empty_db \
  pnpm db:verify --mysql
```

验证必须同时满足：schema 语法有效、`migrate deploy` 成功、`prisma migrate diff --exit-code` 返回无漂移。CI 应对 PostgreSQL 和 MySQL 分别执行该流程。

## 变更与回滚原则

- 上线前备份并实际演练恢复；迁移文件一旦在共享环境执行，不再修改原文件。
- 删除列、改类型、添加非空列等破坏性变更采用“扩展 → 双写/回填 → 切换 → 收缩”的多版本流程。
- Prisma 迁移不自动生成 down migration。回滚优先回退应用并前向修复数据库；确需回退 SQL 时，必须预先编写、审核并在备份副本上验证。
- 不要在 PostgreSQL 与 MySQL 之间直接切换同一个业务库；跨数据库迁移属于独立的数据迁移项目。
