import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../database/redis.service';
import * as os from 'os';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);
  // 模拟在线用户数据（生产环境应从 Redis 或数据库中获取）
  private onlineUsers: Map<string, { userId: string; username: string; ip: string; loginTime: Date }> = new Map();

  constructor(private readonly redisService: RedisService) {
    // 添加一些模拟数据
    this.onlineUsers.set('mock-1', {
      userId: '1',
      username: 'admin',
      ip: '127.0.0.1',
      loginTime: new Date(),
    });
  }

  /**
   * 获取缓存信息
   */
  async getCacheInfo() {
    const client = this.redisService.getClient();
    if (!client) {
      return { status: 'disconnected', keys: [], info: {} };
    }

    try {
      const info = await client.info('memory');
      const dbSize = await client.dbsize();

      // 获取所有缓存键
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, found] = await client.scan(cursor, 'COUNT', 100);
        cursor = next;
        keys.push(...found);
      } while (cursor !== '0' && keys.length < 500);

      // 获取每个键的详细信息
      const keyDetails = await Promise.all(
        keys.slice(0, 100).map(async (key) => {
          const ttl = await client.ttl(key);
          const type = await client.type(key);
          return { key, ttl, type };
        }),
      );

      // 解析内存信息
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const usedMemory = memoryMatch ? memoryMatch[1] : 'N/A';

      return {
        status: 'connected',
        totalKeys: dbSize,
        usedMemory,
        keys: keyDetails,
      };
    } catch {
      return { status: 'error', keys: [], info: {} };
    }
  }

  /**
   * 删除指定缓存键
   */
  async deleteCacheKey(key: string) {
    const client = this.redisService.getClient();
    if (!client) return { success: false, message: 'Redis 未连接' };

    try {
      await client.del(key);
      return { success: true, message: `已删除缓存键: ${key}` };
    } catch {
      return { success: false, message: '删除失败' };
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache() {
    const client = this.redisService.getClient();
    if (!client) return { success: false, message: 'Redis 未连接' };

    try {
      await client.flushdb();
      return { success: true, message: '缓存已清空' };
    } catch {
      return { success: false, message: '清空失败' };
    }
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers() {
    return Array.from(this.onlineUsers.values()).map((user) => ({
      ...user,
      loginTime: user.loginTime.toISOString(),
    }));
  }

  /**
   * 强制下线用户
   */
  kickUser(userId: string) {
    for (const [key, user] of this.onlineUsers.entries()) {
      if (user.userId === userId) {
        this.onlineUsers.delete(key);
        return { success: true, message: `用户 ${user.username} 已被强制下线` };
      }
    }
    return { success: false, message: '用户不存在' };
  }

  /**
   * 获取定时任务列表（模拟数据，生产环境应接入 node-cron 或 bull）
   */
  getJobs() {
    return [
      {
        id: '1',
        name: '数据备份',
        cron: '0 2 * * *',
        status: 'running',
        description: '每天凌晨 2 点执行数据库备份',
        lastRun: new Date(Date.now() - 86400000).toISOString(),
        nextRun: new Date(Date.now() + 3600000).toISOString(),
      },
      {
        id: '2',
        name: '日志清理',
        cron: '0 3 * * 0',
        status: 'running',
        description: '每周日凌晨 3 点清理过期日志',
        lastRun: new Date(Date.now() - 604800000).toISOString(),
        nextRun: new Date(Date.now() + 259200000).toISOString(),
      },
      {
        id: '3',
        name: '缓存刷新',
        cron: '*/30 * * * *',
        status: 'running',
        description: '每 30 分钟刷新热门数据缓存',
        lastRun: new Date(Date.now() - 1800000).toISOString(),
        nextRun: new Date(Date.now() + 900000).toISOString(),
      },
      {
        id: '4',
        name: '健康检查',
        cron: '*/5 * * * *',
        status: 'running',
        description: '每 5 分钟检查系统健康状态',
        lastRun: new Date(Date.now() - 300000).toISOString(),
        nextRun: new Date(Date.now() + 120000).toISOString(),
      },
    ];
  }

  /**
   * 获取服务器信息
   */
  getServerInfo() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'N/A',
      loadAverage: os.loadavg(),
    };
  }
}
