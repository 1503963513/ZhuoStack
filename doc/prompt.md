---
# NestJS + Next.js 全栈 Monorepo 模板（支持 PostgreSQL & MySQL默认 + Prisma Schema 拆分）

以下是**完整更新版**提示词，包含了 Prisma Schema 多文件拆分支持：
---

```markdown
# 任务：创建 NestJS + Next.js 全栈 Monorepo 项目模板

请帮我从零搭建一个生产级的全栈 Monorepo 项目，技术栈和结构严格按照以下要求执行。

---

## 一、Monorepo 基础设施

- 包管理器：**pnpm workspace**
- 构建编排：**Turborepo**
- 根目录配置：
    - `pnpm-workspace.yaml`：定义 apps/_ 和 packages/_ 为工作区
    - `turbo.json`：配置 build、dev、lint、test 等 pipeline，启用缓存
    - `tsconfig.base.json`：所有包共享的基础 TS 配置（strict 模式开启）
    - 根 `package.json`：定义公共 scripts（dev、build、lint、test）
    - `.editorconfig`、`.gitignore`、`.npmrc`（shamefully-hoist=false, strict-peer-dependencies=false）

---

## 二、后端：apps/api（NestJS）

### 2.1 基础框架

- **NestJS v10+** + **Fastify** 作为底层平台
- **TypeScript** strict 模式
- 入口文件 `main.ts`：
    - 启用 FastifyAdapter
    - 全局注册 ValidationPipe（whitelist: true, transform: true）
    - 全局注册 Swagger，路径 `/api/docs`
    - 全局注册 CORS
    - 监听端口从环境变量读取，默认 3100
    - 使用 Pino 作为 Logger

### 2.2 目录结构
```

```
apps/api/
├── src/
│ ├── app.module.ts
│ ├── main.ts
│ ├── common/
│ │ ├── decorators/ ← @CurrentUser 等自定义装饰器
│ │ ├── filters/ ← HttpExceptionFilter（统一异常）
│ │ ├── guards/ ← JwtAuthGuard、RolesGuard
│ │ ├── interceptors/ ← TransformInterceptor（统一返回 {code, data, message}）
│ │ ├── pipes/
│ │ └── utils/
│ ├── config/
│ │ ├── app.config.ts
│ │ ├── database.config.ts
│ │ └── jwt.config.ts
│ ├── database/
│ │ ├── prisma.module.ts
│ │ ├── prisma.service.ts
│ │ ├── prisma.repository.ts
│ │ └── seed.ts
│ ├── modules/
│ │ ├── auth/
│ │ │ ├── auth.module.ts
│ │ │ ├── auth.controller.ts ← POST /auth/login, POST /auth/register, GET /auth/profile
│ │ │ ├── auth.service.ts
│ │ │ ├── dto/ ← LoginDto, RegisterDto
│ │ │ ├── strategies/ ← JwtStrategy
│ │ │ └── guards/ ← LocalAuthGuard
│ │ ├── user/
│ │ │ ├── user.module.ts
│ │ │ ├── user.controller.ts
│ │ │ ├── user.service.ts
│ │ │ ├── dto/ ← CreateUserDto, UpdateUserDto, QueryUserDto
│ │ │ └── entities/ ← UserEntity
│ │ └── health/
│ │ ├── health.module.ts
│ │ └── health.controller.ts ← GET /health
│ └── shared/
├── prisma/ ← ⭐ Schema 拆分目录（见 2.3）
├── test/
│ ├── app.e2e-spec.ts
│ └── jest-e2e.json
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

```

### 2.3 Prisma Schema 多文件拆分 ⭐（核心要求）

#### 2.3.1 启用 Prisma Schema Folder 功能

使用 Prisma 的 `prismaSchemaFolder` 特性，将 schema 拆分为多个文件，按业务域组织。

#### 2.3.2 PostgreSQL 版本目录结构

```

```
apps/api/prisma/
├── postgres/ ← PostgreSQL 版 schema 目录
│ ├── config.prisma ← generator + datasource 配置
│ ├── enums.prisma ← 所有枚举定义（Role 等）
│ └── models/
│ └── user.prisma ← User 模型
├── mysql/ ← MySQL 版 schema 目录
│ ├── config.prisma
│ ├── enums.prisma
│ └── models/
│ └── user.prisma
├── schema.active/ ← 当前激活的 schema（由切换脚本生成的符号链接或拷贝）
│ ├── config.prisma
│ ├── enums.prisma
│ └── models/
│ └── user.prisma
├── seed.ts
└── README.md ← 数据库相关说明

```

#### 2.3.3 各文件具体内容

**postgres/config.prisma：**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```

```

**postgres/enums.prisma：**

```prisma
enum Role {
  USER
  ADMIN
}
```

**postgres/models/user.prisma：**

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

**mysql/config.prisma：**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["prismaSchemaFolder"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**mysql/enums.prisma：**

```prisma
enum Role {
  USER
  ADMIN
}
```

**mysql/models/user.prisma：**

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique(50)
  name      String?  @db.VarChar(255)
  password  String
  role      Role     @default(USER)
  avatar    String?  @db.VarChar(500)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

> **注意**：MySQL 版本需要添加 `@db.VarChar()` 等数据库特定注解，因为 MySQL 对 String 映射与 PostgreSQL 不同。MySQL 的 `@unique` 需要指定长度索引名称参数 `@unique(50)` 以避免 key length 问题。

#### 2.3.4 数据库切换脚本

在 `apps/api/package.json` 中提供以下 scripts（ **默认使用 MySQL** ）：：

```json
{
    "scripts": {
        "db:use:pg": "rm -rf prisma/schema.active && cp -r prisma/postgres prisma/schema.active",
        "db:use:mysql": "rm -rf prisma/schema.active && cp -r prisma/mysql prisma/schema.active",
        "prisma:generate": "prisma generate --schema=prisma/schema.active",
        "prisma:migrate": "prisma migrate dev --schema=prisma/schema.active",
        "prisma:migrate:deploy": "prisma migrate deploy --schema=prisma/schema.active",
        "prisma:push": "prisma db push --schema=prisma/schema.active",
        "prisma:studio": "prisma studio --schema=prisma/schema.active",
        "prisma:seed": "ts-node prisma/seed.ts",
        "prisma:reset": "prisma migrate reset --schema=prisma/schema.active",
        "db:setup:pg": "pnpm db:use:pg && pnpm prisma:generate && pnpm prisma:migrate && pnpm prisma:seed",
        "db:setup:mysql": "pnpm db:use:mysql && pnpm prisma:generate && pnpm prisma:migrate && pnpm prisma:seed"
    }
}
```

#### 2.3.5 schema.active 加入 .gitignore

在 `.gitignore` 中添加：

```
# 激活的 schema 是从 postgres/ 或 mysql/ 拷贝生成的，不纳入版本控制
apps/api/prisma/schema.active/
```

#### 2.3.6 PrismaService 实现

`src/database/prisma.service.ts` 必须：

- 继承动态生成的 PrismaClient（从 `prisma/schema.active` 生成的 client）
- 实现 `OnModuleInit` 的 `onModuleInit()` 连接数据库
- 实现 `OnModuleDestroy` 的 `onModuleDestroy()` 断开连接
- 实现 `enableShutdownHooks(app)` 优雅关闭

#### 2.3.7 seed.ts 种子数据

编写完整的种子数据脚本：

- 使用 argon2（或 bcrypt）加密密码
- 创建一个管理员账号（admin@example.com / admin123）
- 创建几个普通用户测试数据
- 使用 `prisma/schema.active` 生成的 PrismaClient

#### 2.3.8 README.md（数据库说明）

在 `prisma/README.md` 中说明：

```
# Prisma Database Setup

## 多数据库支持

本项目支持 PostgreSQL 和 MySQL，通过 Schema 拆分管理两套独立的 Schema 文件。

### 目录结构

- `postgres/` - PostgreSQL 版本的 Schema
- `mysql/` - MySQL 版本的 Schema
- `schema.active/` - 当前激活的 Schema（由切换脚本自动生成，已 gitignore）

### 使用 PostgreSQL

\`\`\`bash
pnpm db:setup:pg
\`\`\`

### 使用 MySQL

\`\`\`bash
pnpm db:setup:mysql
\`\`\`

### 添加新模型

1. 在 `postgres/models/` 下创建新的 `.prisma` 文件
2. 在 `mysql/models/` 下创建对应的 `.prisma` 文件（注意 MySQL 特有的类型注解）
3. 如有新枚举，在对应的 `enums.prisma` 中添加
4. 重新执行切换脚本生成 migration

### Prisma Schema Folder

本项目使用 Prisma 的 `prismaSchemaFolder` 特性实现多文件 Schema 拆分，
每个 `.prisma` 文件按业务域组织，便于维护和团队协作。
```

### 2.4 环境变量

**.env.example：**

```bash
# ========== 数据库配置 ==========
# 选择数据库类型: postgres | mysql
DB_TYPE=postgres

# PostgreSQL 连接
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myapp

# MySQL 连接（切换时替换上面的 DATABASE_URL）
# DATABASE_URL=mysql://root:root@localhost:3306/myapp

# ========== Redis ==========
REDIS_URL=redis://localhost:6379

# ========== JWT ==========
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# ========== 应用配置 ==========
PORT=3100
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# ========== 限流 ==========
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### 2.5 关键实现要求

1. **统一响应格式**：所有接口返回 `{ code: number, data: any, message: string }`，通过 TransformInterceptor 实现
2. **统一异常处理**：HttpExceptionFilter 捕获所有异常，格式化为统一响应
3. **JWT 认证完整流程**：注册（argon2 加密密码）→ 登录（返回 access_token）→ 通过 JwtStrategy 验证 → 通过 @CurrentUser() 装饰器获取用户
4. **Swagger 文档**：所有 DTO 使用 @ApiProperty，Controller 使用 @ApiTags、@ApiOperation、@ApiResponse
5. **配置管理**：使用 @nestjs/config 的 ConfigModule.forRoot()，支持 .env，提供类型安全的配置
6. **健康检查**：GET /health 返回数据库连接状态和 Redis 状态
7. **CORS**：允许前端域名跨域
8. **数据库兼容性**：两套 Schema 中使用的字段类型必须分别适配各自数据库特性（PostgreSQL 用默认 String 映射，MySQL 用 @db.VarChar 等显式注解）

### 2.6 后端依赖清单

**dependencies:**

```
@nestjs/core @nestjs/common @nestjs/platform-fastify @nestjs/config
@nestjs/swagger @nestjs/jwt @nestjs/passport @nestjs/throttler
@nestjs/terminus @nestjs/event-emitter
@prisma/client passport passport-local passport-jwt
argon2 class-validator class-transformer pino pino-nestjs
```

**devDependencies:**

```
@nestjs/cli @nestjs/testing @nestjs/schematics
@types/passport-local @types/passport-jwt
prisma typescript ts-node
jest ts-jest supertest @types/supertest
```

---

## 三、前端：apps/web（Next.js）

### 3.1 基础框架

- **Next.js 14+**（App Router）
- **TypeScript** strict 模式
- **Tailwind CSS 3**
- **shadcn/ui** 组件库（初始化配置，添加 button、input、card、dropdown-menu、avatar、dialog、toast 等常用组件）
- **TanStack Query (React Query v5)**：数据请求 & 缓存
- **Zustand**：轻量客户端状态管理（持久化到 localStorage）
- **React Hook Form + Zod**：表单处理与验证
- **next-themes**：暗色模式支持
- **Axios**：HTTP 请求客户端

### 3.2 目录结构

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← 首页
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx         ← 侧边栏 + 顶部导航
│   │   │   ├── dashboard/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                    ← shadcn/ui 组件
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── providers.tsx
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   └── register-form.tsx
│   │   └── common/
│   │       ├── loading.tsx
│   │       └── error-boundary.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-api.ts
│   │   └── use-debounce.ts
│   ├── lib/
│   │   ├── api-client.ts          ← Axios 封装
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── stores/
│   │   └── auth-store.ts
│   ├── types/
│   │   ├── api.ts
│   │   └── user.ts
│   └── schemas/
│       ├── auth.schema.ts
│       └── user.schema.ts
├── public/
├── components.json
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### 3.3 关键实现要求

1. **API 客户端封装**（`lib/api-client.ts`）：
    - 基于 Axios 创建实例，baseURL 指向后端 `http://localhost:3100`
    - 请求拦截器自动从 Zustand store 读取 token 并附加 Authorization header
    - 响应拦截器：401 自动清除 token 并跳转登录页，错误统一 toast 提示
    - 泛型封装 `get<T>`, `post<T>`, `put<T>`, `delete<T>` 方法

2. **TanStack Query 封装**（`hooks/use-api.ts`）：
    - 封装 `useApiQuery<T>(key, url, options)` 和 `useApiMutation<T>(method, url, options)`
    - mutation 成功后自动 invalidate 相关 query

3. **认证流程**：
    - 登录/注册页面使用 React Hook Form + Zod 验证
    - 登录成功后将 token 存入 Zustand（persist 到 localStorage）
    - Dashboard layout 中检查认证状态，未登录跳转 /login
    - Header 显示用户头像和下拉菜单（个人信息、退出登录）

4. **Next.js 配置**：
    - `next.config.ts` 中用 rewrites 将 `/api/*` 代理到后端 `http://localhost:3100`
    - 环境变量：`NEXT_PUBLIC_API_URL`

5. **UI 要求**：
    - 响应式设计，支持移动端
    - 支持暗色模式切换
    - 使用 shadcn/ui 的 toast（sonner）组件作为全局提示
    - 登录页面美观、简洁，居中卡片样式

---

## 四、共享包：packages/shared-types

```
packages/shared-types/
├── src/
│   ├── index.ts           ← 统一导出
│   ├── api-response.ts    ← ApiResponse<T> { code: number, data: T, message: string }
│   ├── user.ts            ← 共享的 User 类型、Role 枚举
│   └── common.ts          ← 分页类型 PaginationQuery、PaginationResult
├── tsconfig.json
└── package.json           ← name: "@myapp/shared-types"
```

---

## 五、Docker 配置

### docker/docker-compose.yml

```yaml
# 包含以下服务：
# postgres:  PostgreSQL 16, 端口 5432, 健康检查, 持久化 volume
# mysql:     MySQL 8.0, 端口 3306, 健康检查, 持久化 volume
# redis:     Redis 7, 端口 6379
# api:       NestJS 应用, 端口 3100
# web:       Next.js 应用, 端口 3000
#
# 使用方式：
#   PostgreSQL: docker compose up -d postgres redis api web
#   MySQL:      docker compose up -d mysql redis api web
#   全部启动:    docker compose up -d
```

### docker/Dockerfile.api

多阶段构建：build 阶段 + production 阶段，使用 node:20-alpine

### docker/Dockerfile.web

多阶段构建：build 阶段 + production 阶段，使用 node:20-alpine

---

## 六、环境变量文件

除了 .env.example 之外，还需要创建：

### apps/web/.env.local.example

```
NEXT_PUBLIC_API_URL=http://localhost:3100
```

---

## 七、开发脚本 & 文档

### 根目录 package.json scripts：

```json
{
    "scripts": {
        "dev": "turbo run dev",
        "build": "turbo run build",
        "lint": "turbo run lint",
        "test": "turbo run test",
        "db:setup:pg": "pnpm --filter api db:setup:pg",
        "db:setup:mysql": "pnpm --filter api db:setup:mysql",
        "db:migrate": "pnpm --filter api prisma:migrate",
        "db:generate": "pnpm --filter api prisma:generate",
        "db:seed": "pnpm --filter api prisma:seed",
        "db:studio": "pnpm --filter api prisma:studio",
        "docker:up": "docker compose -f docker/docker-compose.yml up -d",
        "docker:down": "docker compose -f docker/docker-compose.yml down",
        "clean": "turbo run clean && rm -rf node_modules"
    }
}
```

### README.md

写一份完整的 README，包含：

1. 项目简介
2. 技术栈一览表
3. 项目结构说明
4. 快速开始
    - 环境要求（Node 20+, pnpm 9+, Docker）
    - 安装依赖：`pnpm install`
    - 选择数据库并初始化：
        - PostgreSQL: `pnpm db:setup:pg`
        - MySQL: `pnpm db:setup:mysql`
    - 启动开发服务器：`pnpm dev`
    - 或使用 Docker：`pnpm docker:up`
5. Prisma Schema 多文件拆分说明
    - 如何组织 Schema 文件
    - 如何切换数据库
    - 如何添加新模型
6. API 文档访问方式：http://localhost:3100/api/docs
7. 部署说明
8. 开发规范

---

## 八、代码质量

- 全部代码使用 **ESLint + Prettier** 格式化
- 所有 TypeScript 文件严格类型，不允许 any
- 代码注释使用英文
- Git commit 规范：conventional commits（feat/fix/chore/docs...）
- 提供 `.husky/pre-commit` 配置（lint-staged）

---

## 九、执行要求

1. **按顺序创建**：先 Monorepo 基础设施 → 再后端（含完整 Prisma 多数据库 Schema 拆分） → 再前端 → 最后共享包和 Docker
2. **每个文件都要写完整可运行的代码**，不要用占位符或省略号
3. **Prisma Schema 必须创建完整的 postgres/ 和 mysql/ 两套目录**，每个目录下按 config、enums、models 组织
4. **schema.active 目录初始时拷贝 postgres 版本**作为默认
5. 创建完成后，输出一份操作指南告诉我如何启动项目
6. 如果某个步骤需要交互式操作（如 shadcn init），请给出具体命令让我手动执行

````

---

## 更新要点总结

| 新增内容 | 说明 |
|---------|------|
| **`prisma/postgres/`** | PostgreSQL 专属 Schema 目录，含 config、enums、models 子目录 |
| **`prisma/mysql/`** | MySQL 专属 Schema 目录，结构相同但含 MySQL 特有注解（`@db.VarChar` 等） |
| **`prisma/schema.active/`** | 当前激活的 Schema 副本，由切换脚本自动生成，已 gitignore |
| **`db:use:pg` / `db:use:mysql`** | 一键切换数据库，自动拷贝对应目录到 `schema.active` |
| **`db:setup:pg` / `db:setup:mysql`** | 一键完成：切换 + 生成 Client + 迁移 + 种子数据 |
| **`prismaSchemaFolder`** | 启用 Prisma 多文件 Schema 预览特性 |
| **模型按文件拆分** | 每个业务域独立 `.prisma` 文件（如 `user.prisma`），便于维护 |
| **`prisma/README.md`** | 数据库相关操作说明文档 |

---

## 使用方式

```bash
# 创建项目目录
mkdir my-fullstack-app && cd my-fullstack-app
git init

# 打开 Claude Code
claude

# 粘贴上面的完整提示词，回车执行
````

> **💡 建议分步执行**：如果 Claude Code 上下文不够，可以拆成：
>
> 1. **第一步**：Monorepo 基础 + 后端 + Prisma 双数据库 Schema 拆分
> 2. **第二步**：前端 + Docker + 文档br

---
