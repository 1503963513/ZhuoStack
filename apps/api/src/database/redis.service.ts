import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private required = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.required =
      this.configService.get<string>('REDIS_REQUIRED') === 'true' ||
      (this.configService.get<string>('REDIS_REQUIRED') !== 'false' &&
        this.configService.get<string>('NODE_ENV') === 'production');
    if (!redisUrl) {
      if (this.required) {
        throw new Error('生产环境必须配置 REDIS_URL');
      }
      this.logger.warn('未配置 REDIS_URL，缓存功能已禁用');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.client.on('error', (error) => {
        this.logger.warn(`Redis 连接异常: ${error.message}`);
      });
      this.client.on('ready', () => this.logger.log('Redis 连接就绪'));
      this.client.on('end', () => this.logger.warn('Redis 连接已断开'));

      await this.client.connect();
      this.logger.log('Redis 连接成功');
    } catch (error) {
      this.client?.disconnect();
      this.client = null;
      if (this.required) {
        throw new Error(
          `Redis 连接失败，拒绝以不安全的降级模式启动: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      this.logger.warn('Redis 连接失败，缓存功能已禁用');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      if (this.client.status === 'ready') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
      this.client = null;
      this.logger.log('Redis 连接已关闭');
    }
  }

  private unavailable(strict: boolean, operation: string): void {
    if (strict || this.required) {
      throw new ServiceUnavailableException(`安全状态存储不可用，无法执行 ${operation}`);
    }
  }

  private isReady(): boolean {
    return this.client?.status === 'ready';
  }

  async get<T>(key: string, strict = false): Promise<T | null> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'GET');
      return null;
    }
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      this.logger.warn(`Redis GET 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'GET');
      return null;
    }
  }

  async set(key: string, value: unknown, ttl = 300, strict = false): Promise<void> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'SET');
      return;
    }
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (e) {
      this.logger.warn(`Redis SET 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'SET');
    }
  }

  async del(key: string, strict = false): Promise<void> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'DEL');
      return;
    }
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis DEL 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'DEL');
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isReady() || !this.client) {
      this.unavailable(false, 'DELPATTERN');
      return;
    }
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch (e) {
      this.logger.warn(`Redis DELPATTERN 失败 [${pattern}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * 原子递增并设置过期时间（用于登录失败计数等）
   */
  async incr(key: string, ttl?: number, strict = false): Promise<number> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'INCR');
      return 0;
    }
    try {
      const count = await this.client.incr(key);
      if (count === 1 && ttl) {
        await this.client.expire(key, ttl);
      }
      return count;
    } catch (e) {
      this.logger.warn(`Redis INCR 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'INCR');
      return 0;
    }
  }

  /**
   * 原子获取并删除（用于验证码等一次性消费场景，避免 TOCTOU 竞态）
   */
  async getdel<T>(key: string, strict = false): Promise<T | null> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'GETDEL');
      return null;
    }
    try {
      const value = await this.client.getdel(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      this.logger.warn(`Redis GETDEL 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'GETDEL');
      return null;
    }
  }

  /**
   * 检查 key 是否存在
   */
  async exists(key: string, strict = false): Promise<boolean> {
    if (!this.isReady() || !this.client) {
      this.unavailable(strict, 'EXISTS');
      return false;
    }
    try {
      return (await this.client.exists(key)) === 1;
    } catch (e) {
      this.logger.warn(`Redis EXISTS 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      this.unavailable(strict, 'EXISTS');
      return false;
    }
  }

  getClient(): Redis | null {
    return this.isReady() ? this.client : null;
  }
}
