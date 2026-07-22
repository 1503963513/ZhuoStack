import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import * as crypto from 'crypto';
import { extractAuthToken } from '../auth-security';
import type { FastifyRequest } from 'fastify';

interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
}

/** 在线用户 TTL 刷新间隔（5 分钟） */
const ONLINE_REFRESH_INTERVAL = 5 * 60 * 1000;

/** onlineRefreshMap 清理间隔（10 分钟） */
const MAP_CLEANUP_INTERVAL = 10 * 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) implements OnModuleDestroy {
  /** 记录每个用户上次刷新 TTL 的时间，避免每次请求都刷 Redis */
  private readonly onlineRefreshMap = new Map<string, number>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAuthToken]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
      issuer: configService.get<string>('JWT_ISSUER', 'myapp-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'myapp-web'),
      passReqToCallback: true,
    });

    // 定期清理过期的刷新记录，防止内存泄漏
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [userId, lastRefresh] of this.onlineRefreshMap) {
        if (now - lastRefresh > MAP_CLEANUP_INTERVAL) {
          this.onlineRefreshMap.delete(userId);
        }
      }
    }, MAP_CLEANUP_INTERVAL);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    this.onlineRefreshMap.clear();
  }

  async validate(req: FastifyRequest, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 检查 Token 是否在黑名单中（登出时写入）
    const token = extractAuthToken(req);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
      const isBlacklisted = await this.redisService.exists(
        `token:blacklist:${tokenHash}`,
        true,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException('Token 已失效，请重新登录');
      }
    }

    // jti 校验：单设备登录，旧 token 自动失效
    if (!payload.jti) {
      throw new UnauthorizedException('Token 缺少会话标识，请重新登录');
    }
    const activeJti = await this.redisService.get<string>(
      `token:active:${user.id}`,
      true,
    );
    if (!activeJti || activeJti !== payload.jti) {
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    // 检查是否被管理员踢出
    const isKicked = await this.redisService.exists(`kicked:user:${user.id}`, true);
    if (isKicked) {
      throw new UnauthorizedException('您的账号已被强制下线，请重新登录');
    }

    // 刷新或重新激活在线用户状态（节流：同一用户 5 分钟内只处理一次）
    const now = Date.now();
    const lastRefresh = this.onlineRefreshMap.get(user.id) || 0;
    if (now - lastRefresh > ONLINE_REFRESH_INTERVAL) {
      const client = this.redisService.getClient();
      if (client) {
        const onlineKey = `online:user:${user.id}`;
        const exists = await client.exists(onlineKey);
        if (exists) {
          // 在线 key 存在 → 刷新 TTL
          await client.expire(onlineKey, 1800);
        } else {
          // 在线 key 已过期（用户空闲超过 30 分钟），但 JWT 仍然有效 → 重新激活在线状态
          const ip = req.ip || 'unknown';
          await client.set(
            onlineKey,
            JSON.stringify({
              userId: user.id,
              username: user.name || user.email,
              ip,
              loginTime: new Date().toISOString(),
            }),
            'EX',
            1800,
          );
        }
        this.onlineRefreshMap.set(user.id, now);
      }
    }

    return user;
  }
}
