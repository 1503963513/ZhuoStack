import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 系统定时任务
 * 使用 @nestjs/schedule 的 @Cron 装饰器注册真实定时任务
 * 任务会自动注册到 SchedulerRegistry，可在监控页面查看和管理
 */
@Injectable()
export class SystemJobsService {
  private readonly logger = new Logger(SystemJobsService.name);

  /**
   * 健康检查 - 每 5 分钟
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'health-check' })
  handleHealthCheck() {
    this.logger.debug('执行健康检查任务');
    // 这里可以添加实际的健康检查逻辑
    // 例如：检查数据库连接、Redis 连接、磁盘空间等
  }

  /**
   * 缓存清理 - 每 30 分钟
   */
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'cache-cleanup' })
  handleCacheCleanup() {
    this.logger.debug('执行缓存清理任务');
    // 这里可以添加实际的缓存清理逻辑
    // 例如：清理过期的会话数据、临时文件等
  }

  /**
   * 在线用户清理 - 每 10 分钟
   * 清理 Redis 中过期的在线用户记录
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'online-cleanup' })
  handleOnlineCleanup() {
    this.logger.debug('执行在线用户清理任务');
    // Redis 会自动过期 key（TTL 30分钟），这里可以做额外的清理工作
  }
}
