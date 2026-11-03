import { Injectable } from '@nestjs/common';
import { RedisService } from '../../database/redis.service';

const ACTIVE_SESSION_PREFIX = 'token:active:';
const REFRESH_SESSION_PREFIX = 'auth:refresh:';
const ONLINE_USER_PREFIX = 'online:user:';
const KICKED_USER_PREFIX = 'kicked:user:';
const ONLINE_USER_TTL = 30 * 60;
const KICKED_TTL = 30;

export interface OnlineSessionInfo {
  userName?: string | null;
  email?: string;
  avatar?: string | null;
  ip: string;
  browser?: string | null;
  os?: string | null;
}

@Injectable()
export class SessionService {
  constructor(private readonly redisService: RedisService) {}

  /** 建立单设备会话，并记录可观测的在线状态。 */
  async activate(
    userId: string,
    jti: string,
    ttlSeconds: number,
    onlineInfo?: OnlineSessionInfo,
  ): Promise<void> {
    await this.redisService.set(`${ACTIVE_SESSION_PREFIX}${userId}`, jti, ttlSeconds, true);
    if (!onlineInfo) return;

    await this.redisService.set(
      `${ONLINE_USER_PREFIX}${userId}`,
      {
        userId,
        userName: onlineInfo.userName || onlineInfo.email || '用户',
        username: onlineInfo.userName || onlineInfo.email || '用户',
        email: onlineInfo.email,
        avatar: onlineInfo.avatar,
        ip: onlineInfo.ip,
        browser: onlineInfo.browser,
        os: onlineInfo.os,
        loginTime: new Date().toISOString(),
      },
      Math.min(ttlSeconds, ONLINE_USER_TTL),
      true,
    );
  }

  /** 吊销用户当前会话；踢下线时额外写入短时标记以返回明确提示。 */
  async revokeUserSessions(userId: string, options: { kicked?: boolean } = {}): Promise<boolean> {
    const activeKey = `${ACTIVE_SESSION_PREFIX}${userId}`;
    const refreshKey = `${REFRESH_SESSION_PREFIX}${userId}`;
    const onlineKey = `${ONLINE_USER_PREFIX}${userId}`;
    const [hadActiveSession, hadOnlineState] = await Promise.all([
      this.redisService.exists(activeKey, true),
      this.redisService.exists(onlineKey, true),
    ]);

    await Promise.all([
      this.redisService.del(activeKey, true),
      this.redisService.del(refreshKey, true),
      this.redisService.del(onlineKey, true),
      options.kicked
        ? this.redisService.set(`${KICKED_USER_PREFIX}${userId}`, true, KICKED_TTL, true)
        : Promise.resolve(),
    ]);

    return hadActiveSession || hadOnlineState;
  }

  async getActiveJti(userId: string): Promise<string | null> {
    return this.redisService.get<string>(`${ACTIVE_SESSION_PREFIX}${userId}`, true);
  }

  /** 保存 Refresh Token 的 SHA-256 摘要，Redis 中不保存可直接使用的 Token。 */
  async activateRefresh(userId: string, tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.redisService.set(
      `${REFRESH_SESSION_PREFIX}${userId}`,
      { tokenHash },
      ttlSeconds,
      true,
    );
  }

  /** 原子轮换 Refresh Token，防止同一旧 Token 被并发重放。 */
  async rotateRefresh(
    userId: string,
    currentHash: string,
    nextHash: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    return this.redisService.compareAndSet(
      `${REFRESH_SESSION_PREFIX}${userId}`,
      { tokenHash: currentHash },
      { tokenHash: nextHash },
      ttlSeconds,
    );
  }

  async isKicked(userId: string): Promise<boolean> {
    return this.redisService.exists(`${KICKED_USER_PREFIX}${userId}`, true);
  }

  async clearKicked(userId: string): Promise<void> {
    await this.redisService.del(`${KICKED_USER_PREFIX}${userId}`, true);
  }

  /**
   * 仅当活跃 JTI 仍匹配时才刷新在线状态。
   * 使用 Lua 原子执行，避免登出与请求并发时重新创建在线记录。
   */
  async refreshOnline(
    userId: string,
    jti: string,
    onlineInfo: OnlineSessionInfo,
  ): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    const activeKey = `${ACTIVE_SESSION_PREFIX}${userId}`;
    const onlineKey = `${ONLINE_USER_PREFIX}${userId}`;
    const payload = JSON.stringify({
      userId,
      userName: onlineInfo.userName || onlineInfo.email || '用户',
      username: onlineInfo.userName || onlineInfo.email || '用户',
      email: onlineInfo.email,
      avatar: onlineInfo.avatar,
      ip: onlineInfo.ip,
      browser: onlineInfo.browser,
      os: onlineInfo.os,
      loginTime: new Date().toISOString(),
    });

    const script = `
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then
        return 0
      end
      if redis.call('EXISTS', KEYS[2]) == 1 then
        redis.call('EXPIRE', KEYS[2], ARGV[2])
      else
        redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[2])
      end
      return 1
    `;

    await client.eval(script, 2, activeKey, onlineKey, jti, ONLINE_USER_TTL, payload);
  }
}
