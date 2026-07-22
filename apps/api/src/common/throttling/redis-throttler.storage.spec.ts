import { RedisService } from '../../database/redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('将 Redis Lua 结果转换为 Throttler 需要的秒级记录', async () => {
    const evalScript = jest.fn().mockResolvedValue([101, 59_001, 1, 30_000]);
    const redisService = {
      getClient: () => ({ eval: evalScript }),
    } as unknown as RedisService;
    const storage = new RedisThrottlerStorage(redisService);

    await expect(
      storage.increment('request-key', 60_000, 100, 30_000, 'default'),
    ).resolves.toEqual({
      totalHits: 101,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 30,
    });
    expect(evalScript).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'throttle:default:request-key',
      'throttle:default:request-key:blocked',
      60_000,
      100,
      30_000,
    );
  });
});
