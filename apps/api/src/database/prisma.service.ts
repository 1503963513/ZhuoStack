import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    super({
      log: isProduction
        ? [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
      // 连接池配置 - 针对远程数据库优化
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
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

  /**
   * Enable shutdown hooks for graceful shutdown.
   */
  enableShutdownHooks(): void {
    (this as unknown as { $on: (event: string, callback: () => void) => void })
      .$on('beforeExit', async () => {
        await this.$disconnect();
      });
  }
}
