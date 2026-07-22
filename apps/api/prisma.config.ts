import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.active',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
