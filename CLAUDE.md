# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both API and Web dev servers
pnpm dev

# Start individually
pnpm --filter api dev    # NestJS on :3100
pnpm --filter web dev    # Next.js on :3000

# Build
pnpm build
pnpm --filter api build  # NestJS only
pnpm --filter web build  # Next.js only

# Lint
pnpm lint
pnpm --filter api lint
pnpm --filter web lint

# Test
pnpm test
pnpm --filter api test       # Jest unit tests
pnpm --filter api test:e2e   # E2E tests

# Database setup (one-time per target DB)
pnpm --filter api db:setup:pg     # PostgreSQL: switch schema + generate + migrate + seed
pnpm --filter api db:setup:mysql  # MySQL: switch schema + generate + migrate + seed

# Database operations
pnpm --filter api prisma:migrate  # Run migrations
pnpm --filter api prisma:seed     # Seed data
pnpm --filter api prisma:studio   # Open Prisma Studio

# Docker
pnpm docker:up
pnpm docker:down
```

## Architecture

**pnpm monorepo** with Turborepo. Three workspace packages:

| Package | Stack | Port |
|---------|-------|------|
| `apps/api` | NestJS 10 + Fastify + Prisma | 3100 |
| `apps/web` | Next.js 14 (App Router) + shadcn/ui + TanStack Query + Zustand | 3000 |
| `packages/shared-types` | Shared TypeScript types (`ApiResponse<T>`, `User`, `Role`) | — |

Path aliases: `@/*` → `./src/*` in both apps, `@myapp/shared-types` → `packages/shared-types/src`.

### API layer (`apps/api`)

Uses **Fastify** (not Express) as the HTTP adapter. Exception filter uses `FastifyRequestLike`/`FastifyReplyLike` interfaces.

**Global middleware** registered in `AppModule`:
- `TransformInterceptor` (`APP_INTERCEPTOR`) — wraps all responses as `{ code, data, message }`
- `HttpExceptionFilter` (`APP_FILTER`) — catches exceptions, returns `{ code, <status>, data: null, message }`
- `ValidationPipe` — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` with implicit conversion

**Route prefix**: `app.setGlobalPrefix('api', { exclude: ['health'] })` — health is at `/health`, everything else at `/api/*`.

**Auth flow**: JWT-based. `JwtStrategy.validate()` does a DB lookup on every request. `@CurrentUser()` decorator extracts user. `@Roles(Role.ADMIN)` + `RolesGuard` for role-based access. Passwords hashed with `bcryptjs`.

**AI module** (`modules/ai`): OpenAI SDK with configurable `OPENAI_BASE_URL`. Endpoints: `POST /api/ai/chat`, `SSE /api/ai/chat/stream`, `POST /api/ai/prompt`. All require JWT auth.

### Frontend (`apps/web`)

Next.js App Router with route groups:
- `(auth)/` — `/login`, `/register` (public)
- `(dashboard)/` — `/dashboard`, `/profile` (requires auth, layout checks Zustand store)

**Data fetching**: `useApiQuery(key, url)` / `useApiMutation(method, url)` in `hooks/use-api.ts` wrapping TanStack Query. API client in `lib/api-client.ts` is Axios-based with JWT interceptor reading from Zustand persist store (localStorage key `"auth-storage"`).

**UI**: shadcn/ui components with Tailwind CSS. Theme via `next-themes` (dark/light). Toasts via `sonner`.

### Database — dual PostgreSQL/MySQL support

Two parallel Prisma schema directories under `apps/api/prisma/`:
- `postgres/` — PostgreSQL models (no DB-specific annotations)
- `mysql/` — MySQL models (with `@db.VarChar(length)`, `@unique(length)`)

Active schema is `prisma/schema.active/` (auto-generated, git-ignored). Switching with `db:use:pg` or `db:use:mysql` copies the target directory. All prisma commands use `--schema=prisma/schema.active`.

Uses `prismaSchemaFolder` preview feature — schema is split across `config.prisma`, `enums.prisma`, `models/*.prisma`.

## Environment Variables

- `apps/api/.env` — `DATABASE_URL`, `DB_TYPE`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `PORT`, `CORS_ORIGIN`
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL`

## Code Conventions

- TypeScript strict mode everywhere — **no `any`** (enforced by ESLint)
- Comments in English
- Git: conventional commits (`feat/fix/chore/docs...`)
- Pre-commit hook runs lint-staged (ESLint + Prettier on `.ts`/`.tsx`)
- `BaseRepository<T>` in `database/prisma.repository.ts` is available for new modules but not currently used by UserService
