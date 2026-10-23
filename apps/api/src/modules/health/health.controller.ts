import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { Public } from '../../common/decorators';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 综合健康检查（同时检查数据库与 Redis 连通性及耗时）
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: '深度健康检查（就绪检查）' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // 1. 数据库连通性与延迟检测
      async () => {
        const start = Date.now();
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          const latencyMs = Date.now() - start;
          return {
            database: {
              status: 'up' as const,
              latencyMs,
            },
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            database: {
              status: 'down' as const,
              error: message,
            },
          };
        }
      },

      // 2. Redis 连通性与延迟检测
      async () => {
        const client = this.redisService.getClient();
        if (!client) {
          return {
            redis: {
              status: 'up' as const,
              mode: 'disabled_or_mock',
            },
          };
        }

        const start = Date.now();
        try {
          const pong = await client.ping();
          const latencyMs = Date.now() - start;
          const isUp = pong === 'PONG';
          return {
            redis: {
              status: isUp ? ('up' as const) : ('down' as const),
              latencyMs,
            },
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            redis: {
              status: 'down' as const,
              error: message,
            },
          };
        }
      },
    ]);
  }

  /**
   * 容器存活探针（Liveness Probe）
   * 仅验证进程存活与事件循环正常，不深度挂钩外部依赖，避免依赖偶发抖动引发容器恶性反复重启
   */
  @Get('liveness')
  @ApiOperation({ summary: '容器存活探针 (Liveness)' })
  checkLiveness() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 容器就绪探针（Readiness Probe）
   * 别名路由，严格验证 DB 与 Redis 就绪，用于反向代理流量切入
   */
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: '容器就绪探针 (Readiness)' })
  async checkReadiness(): Promise<HealthCheckResult> {
    return this.check();
  }
}
