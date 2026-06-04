import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import * as crypto from 'crypto';

interface JwtPayload {
  sub: string;
  email: string;
}

/** 在线用户 TTL 刷新间隔（5 分钟） */
const ONLINE_REFRESH_INTERVAL = 5 * 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /** 记录每个用户上次刷新 TTL 的时间，避免每次请求都刷 Redis */
  private readonly onlineRefreshMap = new Map<string, number>();

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    // 检查 Token 是否在黑名单中（与 AuthService.blacklistToken 使用相同的哈希格式）
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
      const isBlacklisted = await this.redisService.exists(`token:blacklist:${tokenHash}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token 已失效，请重新登录');
      }
    }

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

    // 检查是否被管理员踢出
    const isKicked = await this.redisService.exists(`kicked:user:${user.id}`);
    if (isKicked) {
      throw new UnauthorizedException('您的账号已被强制下线，请重新登录');
    }

    // 刷新在线用户 TTL（节流：同一用户 5 分钟内只刷新一次）
    const now = Date.now();
    const lastRefresh = this.onlineRefreshMap.get(user.id) || 0;
    if (now - lastRefresh > ONLINE_REFRESH_INTERVAL) {
      const client = this.redisService.getClient();
      if (client) {
        const onlineKey = `online:user:${user.id}`;
        const exists = await client.exists(onlineKey);
        if (exists) {
          await client.expire(onlineKey, 1800);
          this.onlineRefreshMap.set(user.id, now);
        }
      }
    }

    return user;
  }
}
