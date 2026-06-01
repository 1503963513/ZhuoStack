# Prisma Database Setup

## Multi-Database Support

This project supports both PostgreSQL and MySQL, managed through separate Schema directories.

### Directory Structure

- `postgres/` - PostgreSQL schema files
- `mysql/` - MySQL schema files
- `schema.active/` - Currently active schema (auto-generated, git-ignored)

### Switch to PostgreSQL

```bash
pnpm db:setup:pg
```

### Switch to MySQL

```bash
pnpm db:setup:mysql
```

### Add a New Model

1. Create a new `.prisma` file in `postgres/models/`
2. Create the corresponding `.prisma` file in `mysql/models/` (note MySQL-specific type annotations like `@db.VarChar`)
3. If there are new enums, add them to the respective `enums.prisma`
4. Re-run the switch script to generate the migration

### Prisma Schema Folder

This project uses Prisma's `prismaSchemaFolder` preview feature for multi-file Schema organization.
Each `.prisma` file is organized by business domain for easier maintenance and team collaboration.
