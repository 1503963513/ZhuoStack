import { Injectable, Logger, OnModuleInit, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../database/redis.service';
import {
  CreateIpRuleDto,
  QueryIpRuleDto,
  CreateThrottleRuleDto,
  UpdateThrottleRuleDto,
  SecurityStatsDto,
} from './dto/security-rule.dto';
import { Prisma, Status } from '@prisma/client';

export const REDIS_IP_WHITE_SET = 'security:ip:white';
export const REDIS_IP_BLACK_SET = 'security:ip:black';
export const REDIS_IP_TEMP_BLOCK_PREFIX = 'security:ip:temp_block:';
export const REDIS_THROTTLE_PREFIX = 'security:throttle:';
export const REDIS_SECURITY_BLOCKED_TODAY = 'security:stats:blocked:today';

@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly logger = new Logger(SecurityService.name);

  // 本地内存限流规则快照（高并发下微秒级匹配）
  private activeThrottleRules: Array<{
    id: string;
    name: string;
    path: string;
    method: string;
    limit: number;
    ttl: number;
    dimension: string;
    autoBlock: boolean;
    blockMinutes: number;
  }> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.initDefaultRules();
    await this.syncRulesToRedis();
  }

  /**
   * 初始化内置安全限流规则（如不存在则自动注入种子）
   */
  async initDefaultRules() {
    const defaults = [
      {
        name: '登录接口防暴力破解',
        path: '/api/auth/login',
        method: 'POST',
        limit: 5,
        ttl: 60,
        dimension: 'IP',
        autoBlock: true,
        blockMinutes: 15,
      },
      {
        name: '注册接口防刷',
        path: '/api/auth/register',
        method: 'POST',
        limit: 3,
        ttl: 60,
        dimension: 'IP',
        autoBlock: false,
        blockMinutes: 15,
      },
      {
        name: '用户修改密码频控',
        path: '/api/user/password',
        method: 'PUT',
        limit: 5,
        ttl: 60,
        dimension: 'USER',
        autoBlock: false,
        blockMinutes: 15,
      },
      {
        name: '文件上传高频防护',
        path: '/api/system/file/upload',
        method: 'POST',
        limit: 10,
        ttl: 60,
        dimension: 'IP',
        autoBlock: false,
        blockMinutes: 15,
      },
      {
        name: '全局接口频控兜底',
        path: '/*',
        method: 'ALL',
        limit: 120,
        ttl: 60,
        dimension: 'IP',
        autoBlock: false,
        blockMinutes: 15,
      },
    ];

    for (const rule of defaults) {
      const exists = await this.prisma.sysThrottleRule.findFirst({
        where: { path: rule.path, method: rule.method },
      });
      if (!exists) {
        await this.prisma.sysThrottleRule.create({ data: rule });
      }
    }
  }

  /**
   * 同步数据库名单与限流规则至 Redis 和本地内存
   */
  async syncRulesToRedis() {
    try {
      const client = this.redisService.getClient();
      if (!client) return;

      // 1. IP 白名单与黑名单
      const ipRules = await this.prisma.sysIpRule.findMany({
        where: { status: Status.ACTIVE },
      });

      const whiteIps = ipRules.filter((r) => r.type === 'WHITELIST').map((r) => r.ip);
      const blackIps = ipRules.filter((r) => r.type === 'BLACKLIST').map((r) => r.ip);

      await client.del(REDIS_IP_WHITE_SET, REDIS_IP_BLACK_SET);
      if (whiteIps.length > 0) await client.sadd(REDIS_IP_WHITE_SET, ...whiteIps);
      if (blackIps.length > 0) await client.sadd(REDIS_IP_BLACK_SET, ...blackIps);

      // 2. 限流规则缓存至内存
      const throttleRules = await this.prisma.sysThrottleRule.findMany({
        where: { status: Status.ACTIVE },
      });

      this.activeThrottleRules = throttleRules.map((r) => ({
        id: r.id,
        name: r.name,
        path: r.path,
        method: r.method,
        limit: r.limit,
        ttl: r.ttl,
        dimension: r.dimension,
        autoBlock: r.autoBlock,
        blockMinutes: r.blockMinutes,
      }));

      this.logger.log(`安全防护规则已同步: 白名单=${whiteIps.length}, 黑名单=${blackIps.length}, 限流规则=${throttleRules.length}`);
    } catch (e) {
      this.logger.warn(`同步安全规则异常: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ========== 核心校验：IP 拦截与动态限流 (微秒级) ==========

  /**
   * 检查请求 IP 是否允许访问
   */
  async checkIpAllowed(ip: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!ip) return { allowed: true };
    const client = this.redisService.getClient();
    if (!client) return { allowed: true };

    try {
      // 1. 命中白名单直接放行
      const isWhite = await client.sismember(REDIS_IP_WHITE_SET, ip);
      if (isWhite) return { allowed: true };

      // 2. 检查临时封禁
      const tempBlock = await client.get(`${REDIS_IP_TEMP_BLOCK_PREFIX}${ip}`);
      if (tempBlock) {
        await this.incrementBlockedCount();
        return { allowed: false, reason: '该 IP 因频繁异常访问已被系统临时封禁' };
      }

      // 3. 检查永久黑名单
      const isBlack = await client.sismember(REDIS_IP_BLACK_SET, ip);
      if (isBlack) {
        await this.incrementBlockedCount();
        return { allowed: false, reason: '该 IP 已被列入系统安全黑名单' };
      }

      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  /**
   * 滑动窗口限流检查
   */
  async checkThrottle(
    path: string,
    method: string,
    ip: string,
    userId?: string,
  ): Promise<{ allowed: boolean; limit: number; remaining: number; retryAfter?: number }> {
    const matchedRule = this.matchRule(path, method);
    if (!matchedRule) return { allowed: true, limit: 0, remaining: 0 };

    const client = this.redisService.getClient();
    if (!client) return { allowed: true, limit: matchedRule.limit, remaining: matchedRule.limit };

    // 计算维度 Key
    let dimensionId = ip;
    if (matchedRule.dimension === 'USER' && userId) {
      dimensionId = `user:${userId}`;
    } else if (matchedRule.dimension === 'IP_AND_USER' && userId) {
      dimensionId = `ip:${ip}_user:${userId}`;
    }

    const bucketKey = `${REDIS_THROTTLE_PREFIX}${matchedRule.id}:${dimensionId}`;
    const now = Date.now();
    const windowStart = now - matchedRule.ttl * 1000;

    try {
      // 滑动窗口：清除过期请求记录并统计当前次数
      const multi = client.multi();
      multi.zremrangebyscore(bucketKey, '-inf', windowStart);
      multi.zcard(bucketKey);
      multi.zadd(bucketKey, now, `${now}_${Math.random()}`);
      multi.expire(bucketKey, matchedRule.ttl);

      const results = await multi.exec();
      const currentCount = (results?.[1]?.[1] as number) || 0;

      if (currentCount >= matchedRule.limit) {
        await this.incrementBlockedCount();

        // 超限自动封禁 IP
        if (matchedRule.autoBlock && ip) {
          const blockSeconds = matchedRule.blockMinutes * 60;
          await client.set(`${REDIS_IP_TEMP_BLOCK_PREFIX}${ip}`, '1', 'EX', blockSeconds);
          this.logger.warn(`[🚨防刷拦截] IP ${ip} 突破 ${matchedRule.name} 限流阈值，已自动封禁 ${matchedRule.blockMinutes} 分钟`);
        }

        return {
          allowed: false,
          limit: matchedRule.limit,
          remaining: 0,
          retryAfter: matchedRule.ttl,
        };
      }

      return {
        allowed: true,
        limit: matchedRule.limit,
        remaining: Math.max(0, matchedRule.limit - currentCount - 1),
      };
    } catch {
      return { allowed: true, limit: matchedRule.limit, remaining: 1 };
    }
  }

  private matchRule(path: string, method: string) {
    // 1. 精确匹配
    let rule = this.activeThrottleRules.find(
      (r) => r.path === path && (r.method === 'ALL' || r.method === method),
    );
    if (rule) return rule;

    // 2. 通配路径匹配
    rule = this.activeThrottleRules.find((r) => {
      if (r.method !== 'ALL' && r.method !== method) return false;
      if (r.path === '/*') return true;
      if (r.path.endsWith('/*')) {
        const prefix = r.path.slice(0, -2);
        return path.startsWith(prefix);
      }
      return false;
    });

    return rule;
  }

  private async incrementBlockedCount() {
    try {
      const client = this.redisService.getClient();
      if (!client) return;
      await client.incr(REDIS_SECURITY_BLOCKED_TODAY);
      await client.expire(REDIS_SECURITY_BLOCKED_TODAY, 86400);
    } catch (e) { this.logger.debug(String(e)); }
  }

  // ========== 后台管理 API ==========

  async getSecurityStats(): Promise<SecurityStatsDto> {
    const [blackIpCount, whiteIpCount, activeThrottleRuleCount] = await Promise.all([
      this.prisma.sysIpRule.count({ where: { type: 'BLACKLIST', status: Status.ACTIVE } }),
      this.prisma.sysIpRule.count({ where: { type: 'WHITELIST', status: Status.ACTIVE } }),
      this.prisma.sysThrottleRule.count({ where: { status: Status.ACTIVE } }),
    ]);

    let todayBlockedCount = 0;
    try {
      const client = this.redisService.getClient();
      if (client) {
        const val = await client.get(REDIS_SECURITY_BLOCKED_TODAY);
        todayBlockedCount = parseInt(val || '0', 10);
      }
    } catch (e) { this.logger.debug(String(e)); }

    return {
      blackIpCount,
      whiteIpCount,
      activeThrottleRuleCount,
      todayBlockedCount,
    };
  }

  // --- IP 规则管理 ---

  async findIpRules(query: QueryIpRuleDto) {
    const { page = 1, pageSize = 10, search, type, status } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SysIpRuleWhereInput = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { ip: { contains: search } },
        { reason: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.sysIpRule.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sysIpRule.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createIpRule(dto: CreateIpRuleDto) {
    const existing = await this.prisma.sysIpRule.findUnique({
      where: { ip: dto.ip },
    });
    if (existing) {
      throw new ConflictException(`IP ${dto.ip} 的规则已存在`);
    }

    let expiredAt: Date | undefined = undefined;
    if (dto.expireMinutes && dto.expireMinutes > 0) {
      expiredAt = new Date(Date.now() + dto.expireMinutes * 60 * 1000);
    }

    const res = await this.prisma.sysIpRule.create({
      data: {
        ip: dto.ip,
        type: dto.type,
        reason: dto.reason,
        expiredAt,
        status: Status.ACTIVE,
      },
    });

    await this.syncRulesToRedis();
    return res;
  }

  async removeIpRule(id: string) {
    const item = await this.prisma.sysIpRule.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('规则不存在');

    await this.prisma.sysIpRule.delete({ where: { id } });
    await this.syncRulesToRedis();
    return { message: '解除成功' };
  }

  // --- 限流规则管理 ---

  async findAllThrottleRules() {
    return this.prisma.sysThrottleRule.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createThrottleRule(dto: CreateThrottleRuleDto) {
    const existing = await this.prisma.sysThrottleRule.findFirst({
      where: { path: dto.path, method: dto.method || 'ALL' },
    });
    if (existing) {
      throw new ConflictException(`该路径与方法下的限流规则已存在`);
    }

    const res = await this.prisma.sysThrottleRule.create({
      data: {
        name: dto.name,
        path: dto.path,
        method: dto.method || 'ALL',
        limit: dto.limit,
        ttl: dto.ttl,
        dimension: dto.dimension || 'IP',
        autoBlock: dto.autoBlock ?? false,
        blockMinutes: dto.blockMinutes ?? 15,
        status: Status.ACTIVE,
      },
    });

    await this.syncRulesToRedis();
    return res;
  }

  async updateThrottleRule(id: string, dto: UpdateThrottleRuleDto) {
    const existing = await this.prisma.sysThrottleRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('规则不存在');

    const res = await this.prisma.sysThrottleRule.update({
      where: { id },
      data: dto,
    });

    await this.syncRulesToRedis();
    return res;
  }

  async removeThrottleRule(id: string) {
    const existing = await this.prisma.sysThrottleRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('规则不存在');

    await this.prisma.sysThrottleRule.delete({ where: { id } });
    await this.syncRulesToRedis();
    return { message: '删除成功' };
  }
}
