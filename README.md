# NodeJs 全栈模板 - NestJS + Next.js 全栈 Monorepo

基于现代 Web 技术构建的生产级全栈应用，采用 pnpm monorepo + Turborepo 组织。

## 技术栈

| 类别 | 技术 |
|------|------|
| 包管理器 | pnpm |
| 构建编排 | Turborepo |
| 后端框架 | NestJS 10+ |
| HTTP 平台 | Fastify |
| ORM | Prisma |
| 数据库 | PostgreSQL / MySQL |
| 缓存 | Redis |
| 前端框架 | Next.js 14+ (App Router) |
| CSS 框架 | Tailwind CSS 3 |
| UI 组件 | shadcn/ui |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query v5 |
| 表单处理 | React Hook Form + Zod |
| 认证 | JWT (passport-jwt) |
| 密码哈希 | bcryptjs |
| API 文档 | Swagger |

## 项目结构

```
my-fullstack-app/
├── apps/
│   ├── api/                  # NestJS 后端
│   │   ├── src/
│   │   │   ├── common/       # 共享工具（装饰器、过滤器、守卫、拦截器）
│   │   │   ├── config/       # 配置模块
│   │   │   ├── database/     # Prisma 数据库层
│   │   │   ├── modules/      # 业务模块（auth、user、health、ai）
│   │   │   └── main.ts       # 应用入口
│   │   └── prisma/           # Prisma Schema 文件
│   │       ├── postgres/     # PostgreSQL Schema
│   │       ├── mysql/        # MySQL Schema
│   │       └── schema.active/ # 当前生效的 Schema（自动生成）
│   └── web/                  # Next.js 前端
│       └── src/
│           ├── app/          # App Router 页面
│           ├── components/   # UI 组件
│           ├── hooks/        # 自定义 Hooks
│           ├── lib/          # 工具函数和 API 客户端
│           ├── schemas/      # Zod 验证 Schema
│           ├── stores/       # Zustand 状态管理
│           └── types/        # TypeScript 类型定义
├── packages/
│   └── shared-types/         # 共享 TypeScript 类型
├── docker/                   # Docker 配置
├── scripts/                  # 部署脚本
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## 快速开始

### 环境要求

- **Node.js** 20+
- **pnpm** 9+
- **Docker**（可选，用于数据库）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
# 后端
cp apps/api/.env.example apps/api/.env.development

# 前端
cp apps/web/.env.example apps/web/.env.local
```

### 3. 启动数据库服务

使用 Docker（推荐）：

```bash
# 启动 MySQL + Redis（仅供本地开发）
docker compose -f docker-compose.dev.yml up -d

# Intel Mac 可覆盖默认的 Apple Silicon 平台
DEV_PLATFORM=linux/amd64 docker compose -f docker-compose.dev.yml up -d

# 查看状态 / 停止服务
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml down
```

### 4. 初始化数据库

选择数据库并运行初始化命令：

```bash
# PostgreSQL
pnpm --filter api db:setup:pg

# MySQL
pnpm --filter api db:setup:mysql
```

该命令会自动完成：
- 复制对应的 Schema 文件到 `schema.active/`
- 生成 Prisma Client
- 运行数据库迁移
- 填充测试数据

### 5. 启动开发服务器

```bash
pnpm dev
```

这会同时启动：
- **API 服务**: http://localhost:3100
- **Web 服务**: http://localhost:3000

### 6. 访问 API 文档

Swagger UI 地址：http://localhost:3100/api/docs

## Prisma Schema 多文件拆分

本项目使用 `prismaSchemaFolder` 预览特性支持多文件 Schema 组织。

### 目录结构

```
apps/api/prisma/
├── postgres/           # PostgreSQL Schema
│   ├── config.prisma   # 生成器 + 数据源
│   ├── enums.prisma    # 枚举定义
│   └── models/
│       └── user.prisma # User 模型
├── mysql/              # MySQL Schema（含 MySQL 特定注解）
│   ├── config.prisma
│   ├── enums.prisma
│   └── models/
│       └── user.prisma
└── schema.active/      # 当前生效的 Schema（自动生成，已加入 gitignore）
```

### 切换数据库

```bash
# 切换到 PostgreSQL（完整初始化）
pnpm --filter api db:setup:pg

# 切换到 MySQL（完整初始化）
pnpm --filter api db:setup:mysql
```

### 添加新模型

1. 创建 `postgres/models/your-model.prisma`（PostgreSQL Schema）
2. 创建 `mysql/models/your-model.prisma`（含 MySQL 特定注解如 `@db.VarChar`）
3. 在 `postgres/enums.prisma` 和 `mysql/enums.prisma` 中添加新枚举
4. 重新运行目标数据库的初始化命令

## 测试账号

数据库填充后，可使用以下测试账号：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@example.com | admin123 | ADMIN（管理员） |
| user1@example.com | password123 | USER（普通用户） |
| user2@example.com | password123 | USER（普通用户） |
| user3@example.com | password123 | USER（普通用户） |

> 💡 密码传输流程：前端 SHA-256 哈希 → 后端 bcrypt 二次哈希存储

## 一键部署

项目使用同一个入口管理 Docker、PM2 和离线内网部署：

```bash
# Docker：首次运行自动创建 .env.deploy，构建并启动完整服务
pnpm ops docker up

# PM2：运行 API（Web 静态文件由 Nginx 托管）
pnpm build:deploy
pnpm ops pm2 start

# 生成无需访问镜像仓库的 Docker 离线包
pnpm ops pack docker-offline postgres

# 生成自带 Linux Node、PM2、依赖和 Prisma Client 的 PM2 离线包
pnpm ops pack pm2-offline postgres
```

Docker 默认使用 PostgreSQL。把 `.env.deploy` 的 `DB_TYPE` 和 `DATABASE_URL` 改为 MySQL 后，部署脚本会自动加载 MySQL Compose 配置。完整操作、升级、日志、备份和内网搬运说明见 [部署指南](doc/deployment.md)。

部署脚本采用单入口结构：`scripts/deploy.sh` 只负责命令路由，具体实现集中在 `scripts/deploy/`，不再保留重复的安装、更新和打包包装脚本。

## 可用脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动所有服务（开发模式） |
| `pnpm build` | 构建所有包 |
| `pnpm build:deploy` | 不依赖 Turbo 远程能力，直接构建部署产物 |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行测试 |
| `pnpm docker:up` | 启动 Docker 服务 |
| `pnpm docker:down` | 停止 Docker 服务 |
| `pnpm ops --help` | 查看统一部署命令 |
| `pnpm ops pm2 start` | 使用项目内置 PM2 启动 API |
| `pnpm ops pack pm2-offline postgres` | 生成 PM2 离线包 |
| `pnpm ops pack docker-offline postgres` | 生成 Docker 离线镜像包 |
| `pnpm --filter api db:setup:pg` | PostgreSQL 完整初始化 |
| `pnpm --filter api db:setup:mysql` | MySQL 完整初始化 |
| `pnpm --filter api prisma:studio` | 打开 Prisma Studio |
| `pnpm --filter api db:use:pg` | 切换到 PostgreSQL |
| `pnpm --filter api db:use:mysql` | 切换到 MySQL |

## 开发规范

- 全局启用 **TypeScript 严格模式** — 禁止使用 `any`
- 注释使用**中文**
- Git 提交遵循**约定式提交**格式（`feat/fix/chore/docs...`）
- 通过 **ESLint + Prettier** + lint-staged + husky 强制代码规范
- 所有 API 响应遵循 `{ code, data, message }` 统一格式

## 许可证

MIT
