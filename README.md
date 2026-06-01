# MyApp - NestJS + Next.js Fullstack Monorepo

A production-ready fullstack application built with modern web technologies, organized as a pnpm monorepo with Turborepo.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Package Manager | pnpm |
| Build Orchestration | Turborepo |
| Backend Framework | NestJS 10+ |
| HTTP Platform | Fastify |
| ORM | Prisma |
| Databases | PostgreSQL / MySQL |
| Cache | Redis |
| Frontend Framework | Next.js 14+ (App Router) |
| CSS Framework | Tailwind CSS 3 |
| UI Components | shadcn/ui |
| State Management | Zustand |
| Data Fetching | TanStack Query v5 |
| Form Handling | React Hook Form + Zod |
| Authentication | JWT (passport-jwt) |
| Password Hashing | argon2 |
| API Documentation | Swagger |

## Project Structure

```
my-fullstack-app/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── common/       # Shared utilities (decorators, filters, guards, interceptors)
│   │   │   ├── config/       # Configuration modules
│   │   │   ├── database/     # Prisma database layer
│   │   │   ├── modules/      # Business modules (auth, user, health)
│   │   │   └── shared/       # Shared modules
│   │   └── prisma/           # Prisma schema files
│   │       ├── postgres/     # PostgreSQL schema
│   │       ├── mysql/        # MySQL schema
│   │       └── schema.active/ # Active schema (auto-generated)
│   └── web/                  # Next.js frontend
│       └── src/
│           ├── app/          # App Router pages
│           ├── components/   # UI components
│           ├── hooks/        # Custom hooks
│           ├── lib/          # Utilities and API client
│           ├── stores/       # Zustand stores
│           └── types/        # TypeScript types
├── packages/
│   └── shared-types/         # Shared TypeScript types
├── docker/                   # Docker configuration
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** (optional, for databases)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.local.example apps/web/.env.local
```

### 3. Start Database Services

Using Docker (recommended):

```bash
# Start PostgreSQL + Redis
pnpm docker:up

# Or start everything (PostgreSQL + MySQL + Redis)
docker compose -f docker/docker-compose.yml up -d postgres mysql redis
```

### 4. Initialize Database

Choose your database and run the setup command:

```bash
# PostgreSQL
pnpm --filter api db:setup:pg

# MySQL
pnpm --filter api db:setup:mysql
```

This will automatically:
- Copy the appropriate schema files to `schema.active/`
- Generate the Prisma client
- Run migrations
- Seed the database with test data

### 5. Start Development Servers

```bash
pnpm dev
```

This starts both:
- **API**: http://localhost:3100
- **Web**: http://localhost:3000

### 6. Access API Documentation

Swagger UI is available at: http://localhost:3100/api/docs

## Prisma Schema Multi-File Split

This project supports multi-file Prisma schema organization using the `prismaSchemaFolder` preview feature.

### Directory Structure

```
apps/api/prisma/
├── postgres/           # PostgreSQL schema
│   ├── config.prisma   # Generator + datasource
│   ├── enums.prisma    # Enum definitions
│   └── models/
│       └── user.prisma # User model
├── mysql/              # MySQL schema (with MySQL-specific annotations)
│   ├── config.prisma
│   ├── enums.prisma
│   └── models/
│       └── user.prisma
└── schema.active/      # Active schema (auto-generated, git-ignored)
```

### Switching Databases

```bash
# Switch to PostgreSQL (full setup)
pnpm --filter api db:setup:pg

# Switch to MySQL (full setup)
pnpm --filter api db:setup:mysql
```

### Adding a New Model

1. Create `postgres/models/your-model.prisma` with the PostgreSQL schema
2. Create `mysql/models/your-model.prisma` with MySQL-specific annotations (`@db.VarChar`, etc.)
3. Add any new enums to both `postgres/enums.prisma` and `mysql/enums.prisma`
4. Re-run the setup command for your target database

## Test Accounts

After seeding, the following accounts are available:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | admin123 | ADMIN |
| user1@example.com | password123 | USER |
| user2@example.com | password123 | USER |
| user3@example.com | password123 | USER |

## Docker Deployment

```bash
# Start all services (PostgreSQL mode)
docker compose -f docker/docker-compose.yml up -d postgres redis api web

# Start with MySQL
docker compose -f docker/docker-compose.yml up -d mysql redis api web
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |

## Development Guidelines

- **TypeScript strict mode** is enabled everywhere — no `any` types
- **Code comments** in English
- **Git commits** follow conventional commits format (`feat/fix/chore/docs...`)
- **ESLint + Prettier** enforced via lint-staged + husky
- All API responses follow the `{ code, data, message }` format

## License

MIT
