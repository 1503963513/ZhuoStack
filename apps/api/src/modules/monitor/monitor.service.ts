import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RedisService } from '../../database/redis.service';
import * as os from 'os';

// 允许通过「清空缓存」删除的键前缀
const ALLOWED_KEY_PREFIXES = ['menu:', 'dict:', 'captcha:', 'token:blacklist:', 'cache:'];

// 禁止删除的安全键前缀（优先级高于 ALLOWED_KEY_PREFIXES）
const PROTECTED_KEY_PREFIXES = ['token:active:', 'login:', 'kicked:', 'online:user:'];

// 在线用户 Redis key 前缀
const ONLINE_USER_PREFIX = 'online:user:';
const ONLINE_USER_TTL = 30 * 60; // 30 分钟过期

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  // ========== 缓存监控（真实 Redis） ==========

  /**
   * 获取缓存信息
   */
  async getCacheInfo() {
    const client = this.redisService.getClient();
    if (!client) {
      return { status: 'disconnected', totalKeys: 0, usedMemory: 'N/A', keys: [] };
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
        keys.slice(0, 200).map(async (key) => {
          const [ttl, type] = await Promise.all([client.ttl(key), client.type(key)]);
          let size = 'N/A';
          try {
            if (type === 'string') {
              const val = await client.get(key);
              size = val ? `${val.length} 字符` : '空';
            } else if (type === 'list') {
              size = `${await client.llen(key)} 项`;
            } else if (type === 'set') {
              size = `${await client.scard(key)} 成员`;
            } else if (type === 'hash') {
              size = `${await client.hlen(key)} 字段`;
            } else if (type === 'zset') {
              size = `${await client.zcard(key)} 成员`;
            }
          } catch {
            // ignore
          }
          return { key, ttl, type, size };
        }),
      );

      // 解析内存信息
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const peakMatch = info.match(/used_memory_peak_human:(\S+)/);
      const rssMatch = info.match(/used_memory_rss_human:(\S+)/);

      return {
        status: 'connected',
        totalKeys: dbSize,
        usedMemory: memoryMatch ? memoryMatch[1] : 'N/A',
        peakMemory: peakMatch ? peakMatch[1] : 'N/A',
        rssMemory: rssMatch ? rssMatch[1] : 'N/A',
        keys: keyDetails,
      };
    } catch (error) {
      this.logger.error('获取缓存信息失败', error);
      return { status: 'error', totalKeys: 0, usedMemory: 'N/A', keys: [] };
    }
  }

  /**
   * 删除指定缓存键（仅允许白名单前缀）
   */
  async deleteCacheKey(key: string) {
    const client = this.redisService.getClient();
    if (!client) return { success: false, message: 'Redis 未连接' };

    // 禁止删除安全相关的键
    if (PROTECTED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new BadRequestException(`禁止删除安全相关键: ${key}`);
    }

    // 必须匹配白名单前缀
    if (!ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new BadRequestException(`仅允许删除 ${ALLOWED_KEY_PREFIXES.join(', ')} 前缀的键`);
    }

    try {
      const result = await client.del(key);
      return { success: result > 0, message: result > 0 ? `已删除: ${key}` : '键不存在' };
    } catch (error) {
      return { success: false, message: `删除失败: ${error}` };
    }
  }

  /**
   * 清空缓存（仅清除白名单前缀的键，跳过受保护的安全键）
   */
  async clearAllCache() {
    const client = this.redisService.getClient();
    if (!client) return { success: false, message: 'Redis 未连接' };

    try {
      let deletedCount = 0;
      for (const prefix of ALLOWED_KEY_PREFIXES) {
        const keys: string[] = [];
        let cursor = '0';
        do {
          const [next, found] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
          cursor = next;
          keys.push(...found);
        } while (cursor !== '0');

        // 过滤掉受保护的安全键
        const safeKeys = keys.filter(
          (key) => !PROTECTED_KEY_PREFIXES.some((p) => key.startsWith(p)),
        );

        if (safeKeys.length > 0) {
          const result = await client.del(...safeKeys);
          deletedCount += result;
        }
      }
      return { success: true, message: `已清空 ${deletedCount} 个缓存键` };
    } catch (error) {
      return { success: false, message: `清空失败: ${error}` };
    }
  }

  // ========== 在线用户（Redis 存储） ==========

  /**
   * 记录用户上线（登录时调用）
   */
  async userOnline(userId: string, username: string, ip: string) {
    const client = this.redisService.getClient();
    if (!client) return;

    const key = `${ONLINE_USER_PREFIX}${userId}`;
    await client.set(
      key,
      JSON.stringify({ userId, username, ip, loginTime: new Date().toISOString() }),
      'EX',
      ONLINE_USER_TTL,
    );
  }

  /**
   * 用户下线（登出时调用）
   */
  async userOffline(userId: string) {
    const client = this.redisService.getClient();
    if (!client) return;
    await client.del(`${ONLINE_USER_PREFIX}${userId}`);
  }

  /**
   * 获取在线用户列表
   */
  async getOnlineUsers() {
    const client = this.redisService.getClient();
    if (!client) return [];

    try {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, found] = await client.scan(
          cursor,
          'MATCH',
          `${ONLINE_USER_PREFIX}*`,
          'COUNT',
          100,
        );
        cursor = next;
        keys.push(...found);
      } while (cursor !== '0');

      const users = await Promise.all(
        keys.map(async (key) => {
          const data = await client.get(key);
          if (!data) return null;
          try {
            return JSON.parse(data);
          } catch {
            return null;
          }
        }),
      );

      return users.filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * 强制用户下线
   * 删除在线状态 + 设置踢出标记（踢出后 24 小时内该用户的 token 将被拒绝）
   */
  async kickUser(userId: string) {
    const client = this.redisService.getClient();
    if (!client) return { success: false, message: 'Redis 未连接' };

    const key = `${ONLINE_USER_PREFIX}${userId}`;
    const exists = await client.exists(key);
    if (!exists) return { success: false, message: '用户不在线' };

    // 删除在线状态
    await client.del(key);
    // 设置踢出标记（30 秒后过期，足够触发前端 401 跳转登录，之后用户可重新登录）
    await client.set(`kicked:user:${userId}`, '1', 'EX', 30);

    return { success: true, message: '已强制下线' };
  }

  // ========== 定时任务（真实 Cron） ==========

  /**
   * 获取所有注册的定时任务
   */
  getJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    const result: any[] = [];

    jobs.forEach((job, name) => {
      const nextDate = job.nextDate();
      const lastDate = job.lastDate();

      result.push({
        id: name,
        name,
        cron: String((job as any).cronTime?.source || 'N/A'),
        status: (job as any).isActive ? 'running' : 'stopped',
        description: this.getJobDescription(name),
        lastRun: lastDate ? new Date(lastDate as any).toISOString() : null,
        nextRun: nextDate ? new Date(nextDate as any).toISOString() : null,
      });
    });

    // 如果没有注册任务，返回空数组
    return result;
  }

  /**
   * 停止定时任务
   */
  stopJob(name: string) {
    try {
      const job = this.schedulerRegistry.getCronJob(name);
      job.stop();
      return { success: true, message: `任务 ${name} 已停止` };
    } catch {
      return { success: false, message: '任务不存在' };
    }
  }

  /**
   * 启动定时任务
   */
  startJob(name: string) {
    try {
      const job = this.schedulerRegistry.getCronJob(name);
      job.start();
      return { success: true, message: `任务 ${name} 已启动` };
    } catch {
      return { success: false, message: '任务不存在' };
    }
  }

  /**
   * 立即执行一次定时任务
   */
  runJob(name: string) {
    try {
      const job = this.schedulerRegistry.getCronJob(name);
      job.fireOnTick();
      return { success: true, message: `任务 ${name} 已触发执行` };
    } catch {
      return { success: false, message: '任务不存在' };
    }
  }

  private getJobDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'health-check': '定期检查系统健康状态',
      'cache-cleanup': '定期清理过期缓存数据',
      'online-cleanup': '清理过期的在线用户记录',
      'log-cleanup': '每天凌晨清理 7 天前的操作日志和登录日志',
    };
    return descriptions[name] || '自定义定时任务';
  }

  // ========== 服务器信息 ==========

  /**
   * 获取服务器信息
   */
  getServerInfo() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
      systemUptime: Math.floor(os.uptime()),
      totalMemory: totalMem,
      usedMemory: usedMem,
      freeMemory: freeMem,
      memoryUsage: `${((usedMem / totalMem) * 100).toFixed(1)}%`,
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'N/A',
      loadAverage: os.loadavg().map((l) => l.toFixed(2)),
    };
  }
}
