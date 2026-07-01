# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 常用命令

```bash
# 同时启动 API 和 Web 开发服务器
pnpm dev

# 单独启动
pnpm --filter api dev    # NestJS 运行在 :3100
pnpm --filter web dev    # Next.js 运行在 :3000

# 构建
pnpm build
pnpm --filter api build  # 仅构建 NestJS
pnpm --filter web build  # 仅构建 Next.js

# 代码检查
pnpm lint
pnpm --filter api lint
pnpm --filter web lint

# 测试
pnpm test
pnpm --filter api test       # Jest 单元测试
pnpm --filter api test:e2e   # E2E 端到端测试

# 数据库初始化（首次使用时执行）
pnpm --filter api db:setup:pg     # PostgreSQL：切换 schema + 生成 + 迁移 + 填充数据
pnpm --filter api db:setup:mysql  # MySQL：切换 schema + 生成 + 迁移 + 填充数据

# 数据库操作
pnpm --filter api prisma:migrate  # 运行迁移
pnpm --filter api prisma:seed     # 填充种子数据
pnpm --filter api prisma:studio   # 打开 Prisma Studio 可视化工具

# Docker
pnpm docker:up
pnpm docker:down
```

## 项目架构

基于 **pnpm monorepo** + Turborepo 的全栈项目，包含三个工作区包：

| 包 | 技术栈 | 端口 |
|---|--------|------|
| `apps/api` | NestJS 10 + Fastify + Prisma | 3100 |
| `apps/web` | Next.js 14 (App Router) + shadcn/ui + TanStack Query + Zustand | 3000 |
| `packages/shared-types` | 共享 TypeScript 类型（`ApiResponse<T>`, `User`, `Role`） | — |

路径别名：`@/*` → `./src/*`（两个应用通用），`@myapp/shared-types` → `packages/shared-types/src`。

### 后端 API 层 (`apps/api`)

使用 **Fastify**（非 Express）作为 HTTP 适配器。异常过滤器使用 `FastifyRequestLike`/`FastifyReplyLike` 接口。

在 `AppModule` 中注册的**全局中间件**：
- `TransformInterceptor`（`APP_INTERCEPTOR`）— 将所有响应包装为 `{ code, data, message }`
- `HttpExceptionFilter`（`APP_FILTER`）— 捕获异常，返回 `{ code, <状态码>, data: null, message }`
- `ValidationPipe` — `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`（含隐式类型转换）

**路由前缀**：`app.setGlobalPrefix('api', { exclude: ['health'] })` — 健康检查在 `/health`，其余均在 `/api/*`。

**认证流程**：基于 JWT。`JwtStrategy.validate()` 每次请求都会查询数据库。`@CurrentUser()` 装饰器提取用户信息。`@Roles(Role.ADMIN)` + `RolesGuard` 实现角色权限控制。密码使用 `bcryptjs` 哈希。

**AI 模块**（`modules/ai`）：使用 OpenAI SDK，支持自定义 `OPENAI_BASE_URL`。端点：`POST /api/ai/chat`、`SSE /api/ai/chat/stream`、`POST /api/ai/prompt`。均需 JWT 认证。

### 前端 (`apps/web`)

Next.js App Router 路由分组：
- `(auth)/` — `/login`、`/register`（公开页面）
- `(dashboard)/` — `/dashboard`、`/profile`（需认证，layout 检查 Zustand Store）

**数据请求**：`useApiQuery(key, url)` / `useApiMutation(method, url)`，位于 `hooks/use-api.ts`，封装 TanStack Query。API 客户端在 `lib/api-client.ts`，基于 Axios，JWT 拦截器从 Zustand persist store 读取（localStorage key `"auth-storage"`）。

**UI 组件**：shadcn/ui + Tailwind CSS。主题切换使用 `next-themes`（暗色/亮色）。提示消息使用 `sonner`。

### 数据库 — 双 PostgreSQL/MySQL 支持

`apps/api/prisma/` 下有两套并行的 Prisma Schema 目录：
- `postgres/` — PostgreSQL 模型（无数据库特定注解）
- `mysql/` — MySQL 模型（含 `@db.VarChar(length)`、`@unique(length)` 注解）

当前生效的 schema 是 `prisma/schema.active/`（自动生成，已加入 gitignore）。通过 `db:use:pg` 或 `db:use:mysql` 切换时会复制对应目录。所有 prisma 命令均使用 `--schema=prisma/schema.active`。

使用 `prismaSchemaFolder` 预览特性 — schema 拆分为 `config.prisma`、`enums.prisma`、`models/*.prisma`。

## 环境变量

- `apps/api/.env` — `DATABASE_URL`、`DB_TYPE`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`PORT`、`CORS_ORIGIN`
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL`

## 编码规范

- 全局启用 TypeScript 严格模式 — **禁止使用 `any`**（ESLint 强制）
- 注释使用中文
- Git：使用约定式提交（`feat/fix/chore/docs...`）
- Pre-commit 钩子运行 lint-staged（ESLint + Prettier 处理 `.ts`/`.tsx` 文件）
- `BaseRepository<T>`（位于 `database/prisma.repository.ts`）可用于新模块的通用 CRUD，当前 UserService 未使用它

## 操作技能（Skills，按需调用）

操作模板/参考文档放在 `.claude/skills/` 下，**不会自动加载**，写对应功能时再调用（输入 `/<skill名>` 或让 Claude 自动触发）。常驻规则见 `.claude/rules/`（认证、数据库、API 规范、Redis、前端开发）。

| Skill | 触发场景 |
|-------|----------|
| `/frontend-crud-page` | 新建前端 CRUD 管理页面（PageHeader + DataTable + Pagination 骨架） |
| `/backend-module` | 新建 NestJS 后端模块（controller/service/dto/entities） |
| `/file-upload` | 集成文件/图片上传功能（@fastify/multipart + FileUpload 组件） |
| `/frontend-hooks` | 查阅前端 Hooks 用法（useApiQuery、useDict、usePermissions、encryptPassword 等） |
