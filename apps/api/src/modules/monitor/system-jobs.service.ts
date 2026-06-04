import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { LogService } from '../log/log.service';

/** 健康检查结果 */
export interface HealthCheckResult {
  timestamp: string;
  database: 'up' | 'down';
  redis: 'up' | 'down' | 'skipped';
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * 系统定时任务
 * 使用 @nestjs/schedule 的 @Cron 装饰器注册真实定时任务
 * 任务会自动注册到 SchedulerRegistry，可在监控页面查看和管理
 */
@Injectable()
export class SystemJobsService {
  private readonly logger = new Logger(SystemJobsService.name);

  /** 最近一次健康检查结果（存内存，不依赖 Redis） */
  private lastHealthCheck: HealthCheckResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly logService: LogService,
  ) {}

  /** 获取最近一次健康检查结果 */
  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  // ========== 健康检查 - 每 5 分钟 ==========

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'health-check' })
  async handleHealthCheck() {
    try {
      let dbStatus: 'up' | 'down' = 'up';
      let redisStatus: 'up' | 'down' | 'skipped' = 'skipped';

      // 检查数据库连接
      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = 'down';
      }

      // 检查 Redis 连接
      const client = this.redisService.getClient();
      if (client) {
        try {
          await client.ping();
          redisStatus = 'up';
        } catch {
          redisStatus = 'down';
        }
      }

      // 计算综合状态
      let overall: HealthCheckResult['overall'] = 'healthy';
      if (dbStatus === 'down') {
        overall = 'unhealthy';
      } else if (redisStatus === 'down') {
        overall = 'degraded';
      }

      this.lastHealthCheck = {
        timestamp: new Date().toISOString(),
        database: dbStatus,
        redis: redisStatus,
        overall,
      };

      if (overall === 'healthy') {
        this.logger.debug(`健康检查通过 [DB: ${dbStatus}, Redis: ${redisStatus}]`);
      } else {
        this.logger.warn(`健康检查异常 [DB: ${dbStatus}, Redis: ${redisStatus}]`);
      }
    } catch (error) {
      this.logger.error(`定时任务 [health-check] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
      this.lastHealthCheck = {
        timestamp: new Date().toISOString(),
        database: 'down',
        redis: 'down',
        overall: 'unhealthy',
      };
    }
  }

  // ========== 缓存清理 - 每 30 分钟 ==========

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'cache-cleanup' })
  async handleCacheCleanup() {
    try {
      const client = this.redisService.getClient();
      if (!client) {
        this.logger.debug('缓存清理跳过: Redis 未配置');
        return;
      }

      // 应有 TTL 的 key 前缀，清理无 TTL 的孤儿 key
      const stalePrefixes = ['login:lock:', 'login:attempts:'];
      let totalCleaned = 0;
      const stats: Record<string, number> = {};

      for (const prefix of stalePrefixes) {
        let cursor = '0';
        let count = 0;
        let cleaned = 0;

        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
          cursor = nextCursor;
          count += keys.length;

          // 检查每个 key 的 TTL，删除无过期时间的孤儿 key
          for (const key of keys) {
            const ttl = await client.ttl(key);
            if (ttl === -1) {
              // -1 表示没有设置过期时间，属于异常状态
              await client.del(key);
              cleaned++;
            }
          }
        } while (cursor !== '0');

        stats[prefix] = count;
        totalCleaned += cleaned;
      }

      if (totalCleaned > 0) {
        this.logger.warn(`缓存清理完成: 清理 ${totalCleaned} 个无 TTL 的孤儿 key`);
      } else {
        this.logger.debug(`缓存清理完成: 无需清理 (${Object.entries(stats).map(([k, v]) => `${k}${v}个`).join(', ')})`);
      }
    } catch (error) {
      this.logger.warn(`定时任务 [cache-cleanup] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ========== 在线用户清理 - 每 10 分钟 ==========

  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'online-cleanup' })
  async handleOnlineCleanup() {
    try {
      const client = this.redisService.getClient();
      if (!client) {
        this.logger.debug('在线用户清理跳过: Redis 未配置');
        return;
      }

      let cursor = '0';
      let total = 0;
      let cleaned = 0;

      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'online:user:*', 'COUNT', 200);
        cursor = nextCursor;
        total += keys.length;

        for (const key of keys) {
          const ttl = await client.ttl(key);
          if (ttl === -1) {
            // 没有 TTL 的孤儿 key，删除
            await client.del(key);
            cleaned++;
          }
        }
      } while (cursor !== '0');

      this.logger.debug(`在线用户清理完成: ${total} 个在线用户, 清理 ${cleaned} 个过期记录`);
    } catch (error) {
      this.logger.warn(`定时任务 [online-cleanup] 执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ========== 日志清理 - 每天凌晨 3 点 ==========

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'log-cleanup' })
  async handleLogCleanup() {
    // 操作日志
    try {
      const operResult = await this.logService.clearOperLogs();
      this.logger.log(`操作日志清理: ${operResult.message}`);
    } catch (error) {
      this.logger.error(`定时任务 [log-cleanup] 操作日志清理失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 登录日志
    try {
      const loginResult = await this.logService.clearLoginLogs();
      this.logger.log(`登录日志清理: ${loginResult.message}`);
    } catch (error) {
      this.logger.error(`定时任务 [log-cleanup] 登录日志清理失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
