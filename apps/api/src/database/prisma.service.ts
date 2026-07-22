import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function createPrismaAdapter(): PrismaMariaDb | PrismaPg {
  const databaseUrl = process.env.DATABASE_URL;
  const configuredType = process.env.DB_TYPE ?? 'postgres';
  const dbType = configuredType === 'postgresql' ? 'postgres' : configuredType;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  if (dbType === 'mysql') {
    return new PrismaMariaDb(databaseUrl);
  }

  if (dbType === 'postgres') {
    return new PrismaPg({ connectionString: databaseUrl });
  }

  throw new Error(`DB_TYPE must be postgres or mysql, received: ${configuredType}`);
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    super({
      adapter: createPrismaAdapter(),
      log: isProduction
        ? [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('数据库连接成功');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('数据库已断开连接');
  }
}
