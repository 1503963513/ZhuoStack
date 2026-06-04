import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('未配置 REDIS_URL，缓存功能已禁用');
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 0, // 不重试
        connectTimeout: 1500,
        lazyConnect: true,
        enableOfflineQueue: false, // 离线时不排队
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log('Redis 连接成功');
    } catch {
      this.isConnected = false;
      this.client?.disconnect();
      this.client = null;
      this.logger.warn('Redis 连接失败，缓存功能已禁用');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      this.logger.warn(`Redis GET 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttl = 300): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (e) {
      this.logger.warn(`Redis SET 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch (e) {
      this.logger.warn(`Redis DEL 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
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
  async incr(key: string, ttl?: number): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try {
      const count = await this.client.incr(key);
      if (count === 1 && ttl) {
        await this.client.expire(key, ttl);
      }
      return count;
    } catch (e) {
      this.logger.warn(`Redis INCR 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      return 0;
    }
  }

  /**
   * 原子获取并删除（用于验证码等一次性消费场景，避免 TOCTOU 竞态）
   */
  async getdel<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const value = await this.client.getdel(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      this.logger.warn(`Redis GETDEL 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /**
   * 检查 key 是否存在
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      return (await this.client.exists(key)) === 1;
    } catch (e) {
      this.logger.warn(`Redis EXISTS 失败 [${key}]: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  getClient(): Redis | null {
    return this.client;
  }
}
