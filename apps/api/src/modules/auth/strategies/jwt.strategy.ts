import { Injectable, Inject, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import { SessionService } from '../session.service';
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
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(SessionService) private readonly sessionService: SessionService,
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
      issuer: configService.get<string>('JWT_ISSUER', 'zhuostack-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'zhuostack-web'),
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
      const isBlacklisted = await this.redisService.exists(`token:blacklist:${tokenHash}`, true);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token 已失效，请重新登录');
      }
    }

    // jti 校验：单设备登录，旧 token 自动失效
    if (!payload.jti) {
      throw new UnauthorizedException('Token 缺少会话标识，请重新登录');
    }
    // 踢出标记优先检查，以便给用户明确提示；重新登录会清除该标记。
    if (await this.sessionService.isKicked(user.id)) {
      throw new UnauthorizedException('您的账号已被强制下线，请重新登录');
    }

    const activeJti = await this.sessionService.getActiveJti(user.id);
    if (!activeJti || activeJti !== payload.jti) {
      throw new UnauthorizedException('会话已失效，请重新登录');
    }

    // 刷新或重新激活在线用户状态（节流：同一用户 5 分钟内只处理一次）
    const now = Date.now();
    const lastRefresh = this.onlineRefreshMap.get(user.id) || 0;
    if (now - lastRefresh > ONLINE_REFRESH_INTERVAL) {
      await this.sessionService.refreshOnline(user.id, payload.jti, {
        userName: user.name || user.email,
        email: user.email,
        avatar: user.avatar,
        ip: req.ip || 'unknown',
      });
      this.onlineRefreshMap.set(user.id, now);
    }

    return user;
  }
}
