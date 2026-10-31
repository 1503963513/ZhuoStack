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

# 数据库操作（自动按 .env 中的 DB_TYPE 识别 PostgreSQL 或 MySQL）
pnpm db:setup       # 首次初始化：切换 schema + 生成 client + 迁移 + 填充种子数据
pnpm db:migrate     # 运行迁移 (migrate dev)
pnpm db:generate    # 重新生成 Prisma Client
pnpm db:seed        # 填充种子数据
pnpm db:studio      # 打开 Prisma Studio 可视化工具
# 如需强制指定，末尾加 --pg 或 --mysql，如：pnpm db:migrate --mysql

# 契约与代码生成
pnpm contract:sync  # 导出 OpenAPI 并同步生成前端强类型客户端

# Docker
pnpm docker:up
pnpm docker:down

# 发布与打包（交互向导，支持选择组件/数据库/是否包含中间件）
pnpm release
```

## 项目架构

基于 **pnpm monorepo** + Turborepo 的全栈项目，包含两个核心工作区：

| 包         | 技术栈                                                         | 端口 |
| ---------- | -------------------------------------------------------------- | ---- |
| `apps/api` | NestJS 11 + Fastify + Prisma                                   | 3100 |
| `apps/web` | Next.js 16 (App Router) + shadcn/ui + TanStack Query + Zustand | 3000 |

路径别名：`@/*` → `./src/*`。前后端契约由 OpenAPI 与 Orval 自动生成（`pnpm contract:sync`），类型安全且防漂移。

### 后端 API 层 (`apps/api`)

使用 **Fastify**（非 Express）作为 HTTP 适配器。异常过滤器使用 `FastifyRequestLike`/`FastifyReplyLike` 接口。

在 `AppModule` 中注册的**全局中间件与可观测性**：

- `x-request-id` 全链路追踪 — 请求头自动透传或生成 `req_xxx`，响应头及错误体均附带此 ID，日志自动打标
- `TransformInterceptor`（`APP_INTERCEPTOR`）— 将所有成功响应包装为 `{ code, data, message, requestId }`
- `HttpExceptionFilter`（`APP_FILTER`）— 捕获异常，打印包含 `[requestId]` 的堆栈，返回 `{ code, <状态码>, data: null, message, requestId }`
- `ValidationPipe` — `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`（含隐式类型转换）
- 深度探针：`/health`（就绪检查，探测 DB+Redis 延迟）、`/health/liveness`（存活检查）。排障详见 `docs/troubleshooting.md`。

**路由前缀**：`app.setGlobalPrefix('api', { exclude: ['health'] })` — 健康检查在 `/health`，其余均在 `/api/*`。

**认证流程**：基于 JWT + HttpOnly Cookie 架构。登录/注册成功下发 HttpOnly `access_token` 和前端可读 `csrf_token`；对修改操作实施双提交 CSRF 防护（`x-csrf-token` 请求头）。每次请求由 `JwtStrategy` 结合 Redis 会话进行单设备活跃校验（Jti 验证）。密码传输前经 RSA-OAEP 加密，后端使用 `bcryptjs` 哈希存储。详见 `.claude/rules/invariants.md`。

**AI 模块**（`modules/ai`）：使用 OpenAI SDK，支持自定义 `OPENAI_BASE_URL`。端点：`POST /api/ai/chat`、`SSE /api/ai/chat/stream`、`POST /api/ai/prompt`。均需认证。

### 前端 (`apps/web`)

Next.js App Router 路由分组：

- `(auth)/` — `/login`、`/register`（公开页面）
- `(dashboard)/` — `/dashboard`、`/profile`、各管理页面（需认证，layout 检查 Zustand Store 状态）

**数据请求**：全面采用由 OpenAPI 规范自动生成的强类型客户端与 TanStack Query Hooks（位于 `@/api/generated/`），通过 `lib/api-mutator.ts` 桥接现有带有 Cookie、CSRF Token 和 401 自动跳转拦截的 Axios 实例。详见 `.claude/rules/frontend-development.md`。

**UI 组件**：shadcn/ui + Tailwind CSS。主题切换使用 `next-themes`（暗色/亮色）。提示消息使用 `sonner`。

### 数据库 — 双 PostgreSQL/MySQL 自动调度

`apps/api/prisma/` 下有两套并行的 Prisma Schema 目录：

- `postgres/` — PostgreSQL 模型（无数据库特定注解）
- `mysql/` — MySQL 模型（含 `@db.VarChar(length)`、`@unique(length)` 注解）

**自动识别调度**：所有 `pnpm db:*` 命令由 `db-cli.mjs` 统一接管，自动读取当前 `.env` 中的 `DB_TYPE`（默认 `postgres`），自动完成 `schema.active/` 切换、生成与执行，无需人工记忆底层差异。也可以在命令后附带 `--pg` 或 `--mysql` 参数强制指定。

## 环境变量

本地配置文件均已 gitignore（含密钥/连接串）。**clone 后需从模板恢复**：

```bash
cp apps/api/.env.example apps/api/.env.development      # 后端 dev
cp apps/web/.env.example apps/web/.env.development      # 前端 dev
```

- `apps/api/.env.development` / `apps/api/.env.production` — `DATABASE_URL`、`DB_TYPE`、`JWT_SECRET`、`JWT_EXPIRES_IN`、`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`PORT`、`CORS_ORIGIN`、`FILE_STORAGE_TYPE` 及对应的本地 / 阿里云 OSS / 腾讯云 COS 配置
- `apps/web/.env.development` — `NEXT_PUBLIC_API_URL`（dev 直连后端 `http://localhost:3100`；生产走 Nginx 同域代理留空）
- 模板 `*.env.example`（tracked，团队共享默认值）

## 编码规范

- 全局启用 TypeScript 严格模式 — **禁止使用 `any`**（ESLint 强制）
- 注释使用中文
- Git：使用约定式提交（`feat/fix/chore/docs...`）
- Pre-commit 钩子运行 lint-staged（ESLint + Prettier 处理暂存的 `.ts`/`.tsx` 文件）
- `BaseRepository<T>`（位于 `database/prisma.repository.ts`）可用于新模块的通用 CRUD，当前 UserService 未使用它

## 操作技能与规则说明

常驻核心底线见 `.claude/rules/invariants.md`（极简铁律，常驻生效）。业务模板与研发工作流放在 `.claude/skills/` 下，按需调用（输入 `/<skill名>` 触发）。

| Skill                 | 触发场景                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/rule-check`         | 按项目铁律全自动化检查代码质量（契约防漂移、Swagger包装、类型检查、Lint规范、E2E测试）                                                      |
| `/crud-module`        | 新增全栈业务 CRUD 模块时的标准研发工作流（字段澄清 -> 双库模型 -> DTO/Service/Controller -> 契约生成 -> 前端页面 -> 权限 Seed -> 校验闭环） |
| `/frontend-crud-page` | 新建前端 CRUD 管理页面（PageHeader + DataTable + Pagination 骨架，基于 Orval 强类型客户端）                                                 |
| `/backend-module`     | 新建 NestJS 后端模块（controller/service/dto，含 @ApiResultResponse 包装规范）                                                              |
| `/file-upload`        | 集成文件/图片上传功能（@fastify/multipart + FileUpload 组件，含真实字节进度监听）                                                           |
| `/frontend-hooks`     | 查阅前端 Hooks 用法（useDict、usePermissions、encryptPassword 等）                                                                          |
