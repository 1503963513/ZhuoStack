import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import { RedisService } from '../../database/redis.service';

const INCREMENT_SCRIPT = `
local counterKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', counterKey) or '0')
  local counterTtl = redis.call('PTTL', counterKey)
  return { hits, counterTtl, 1, blockTtl }
end

local hits = redis.call('INCR', counterKey)
if hits == 1 or redis.call('PTTL', counterKey) < 0 then
  redis.call('PEXPIRE', counterKey, ttl)
end

local isBlocked = 0
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  isBlocked = 1
  blockTtl = blockDuration
else
  blockTtl = 0
end

return { hits, redis.call('PTTL', counterKey), isBlocked, blockTtl }
`;

/**
 * 生产环境使用 Redis 原子计数，使多实例 API 共享限流额度。
 * 本地开发未启动 Redis 时回退到进程内存，避免破坏现有开发体验。
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private warnedAboutFallback = false;

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ) {
    const client = this.redisService.getClient();
    if (!client) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('限流状态存储不可用');
      }
      if (!this.warnedAboutFallback) {
        this.logger.warn('Redis 未连接，开发环境限流暂时回退到单进程内存');
        this.warnedAboutFallback = true;
      }
      return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    const redisKey = `throttle:${throttlerName}:${key}`;
    const rawResult = (await client.eval(
      INCREMENT_SCRIPT,
      2,
      redisKey,
      `${redisKey}:blocked`,
      Math.max(ttl, 1),
      limit,
      Math.max(blockDuration, 1),
    )) as [number, number, number, number];

    return {
      totalHits: Number(rawResult[0]),
      timeToExpire: this.toSeconds(rawResult[1]),
      isBlocked: Number(rawResult[2]) === 1,
      timeToBlockExpire: this.toSeconds(rawResult[3]),
    };
  }

  private toSeconds(milliseconds: number): number {
    return Math.ceil(Math.max(Number(milliseconds), 0) / 1000);
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
