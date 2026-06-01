import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    try {
      await this.client.connect();
      this.logger.log('Redis 连接成功');
    } catch (error) {
      this.logger.warn('Redis 连接失败，缓存功能将不可用');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis 已断开连接');
    }
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒），默认 300 秒（5 分钟）
   */
  async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logger.warn(`缓存设置失败: ${key}`);
    }
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`缓存删除失败: ${key}`);
    }
  }

  /**
   * 批量删除缓存（支持模式匹配）
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`缓存批量删除失败: ${pattern}`);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * 获取 Redis 客户端实例（用于高级操作）
   */
  getClient(): Redis {
    return this.client;
  }
}
