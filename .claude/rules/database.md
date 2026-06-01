# 数据库与 Prisma

本项目使用 Prisma ORM，同时支持 PostgreSQL 和 MySQL 双数据库，采用 `prismaSchemaFolder` 预览特性。

## Schema 组织结构

```
apps/api/prisma/
├── postgres/               # PostgreSQL Schema
│   ├── config.prisma       # 生成器 + 数据源（postgresql）
│   ├── enums.prisma        # 共享枚举（Role 等）
│   └── models/
│       └── user.prisma     # User 模型
├── mysql/                  # MySQL Schema（模型相同，带数据库特定注解）
│   ├── config.prisma       # 生成器 + 数据源（mysql）
│   ├── enums.prisma        # 相同枚举
│   └── models/
│       └── user.prisma     # User 模型（含 @db.VarChar、@unique(length)）
└── seed.ts                 # 种子数据（管理员 + 测试用户）
```

**当前生效的 schema** 是 `prisma/schema.active/` — 已加入 gitignore，由 `db:use:pg` 或 `db:use:mysql` 自动生成。

## 新增模型

### 1. 在 postgres 和 mysql 两个目录中都创建模型文件：

**`postgres/models/<name>.prisma`：**
```prisma
model Example {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("examples")
}
```

**`mysql/models/<name>.prisma`：**
```prisma
model Example {
  id        String   @id @default(cuid())
  name      String   @db.VarChar(255)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("examples")
}
```

### 2. 切换生效 Schema 并生成：

```bash
pnpm --filter api db:use:pg       # 或 db:use:mysql
pnpm --filter api prisma:generate # 重新生成 Prisma Client
pnpm --filter api prisma:migrate dev --name add_example  # 创建迁移
```

### 3. 按需更新 seed.ts

## 模型规范

- **ID 字段**：统一使用 `String @id @default(cuid())` — 不使用自增 ID
- **表映射**：始终使用 `@@map("复数_下划线")` — 例如 `@@map("users")`
- **时间戳**：始终包含 `createdAt DateTime @default(now())` 和 `updatedAt DateTime @updatedAt`
- **枚举**：在 `enums.prisma` 中共享定义 — 当前有 `enum Role { USER ADMIN }`
- **MySQL 特殊处理**：String 字段加 `@db.VarChar(length)`，唯一索引加 `@unique(length)`
- **可空字段**：使用 `?` 语法或 `@default(null)` — 例如 `name String?`

## PrismaService

在 `database/prisma.module.ts` 中注册为 `@Global()` 模块：

- 全局可用，无需在每个模块中导入 PrismaModule
- 实现 `OnModuleInit`（连接）和 `OnModuleDestroy`（断开）
- `enableShutdownHooks` 确保优雅关闭

## 数据库命令

| 命令 | 用途 |
|------|------|
| `pnpm --filter api db:use:pg` | 切换到 PostgreSQL Schema |
| `pnpm --filter api db:use:mysql` | 切换到 MySQL Schema |
| `pnpm --filter api prisma:generate` | 重新生成 Prisma Client |
| `pnpm --filter api prisma:migrate dev --name <名称>` | 创建新迁移 |
| `pnpm --filter api prisma:migrate:deploy` | 生产环境应用迁移 |
| `pnpm --filter api prisma:studio` | 打开 Prisma Studio 可视化界面 |
| `pnpm --filter api prisma:seed` | 运行种子脚本 |
| `pnpm --filter api prisma:reset` | 重置数据库 + 重新填充 |
| `pnpm --filter api db:setup:pg` | PostgreSQL 完整初始化（切换 + 生成 + 迁移 + 填充） |
| `pnpm --filter api db:setup:mysql` | MySQL 完整初始化 |

## 核心规则

- **必须同时更新 postgres 和 mysql** 两套 Schema
- **禁止直接编辑 `schema.active/`** — 该目录已加入 gitignore，由脚本自动生成
- **始终使用 `@@map()`** — Prisma 模型用 PascalCase，数据库表用 snake_case 复数形式
- **修改 Schema 后先运行 `prisma:generate`** 再启动开发服务器
- **种子数据账号**：管理员为 `admin@example.com` / `admin123` — 生产环境需在 seed.ts 中修改
- **BaseRepository<T>**：位于 `database/prisma.repository.ts`，可继承用于新模块的通用 CRUD
- **所有 prisma 命令**必须带上 `--schema=prisma/schema.active`
