import {
  Controller,
  Get,
  Logger,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../database/redis.service';
import { Public } from '../../common/decorators';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 就绪检查只对外暴露汇总状态，数据库/Redis 错误细节仅写入服务端日志。
   */
  @Get()
  @ApiOperation({ summary: '深度健康检查（就绪检查）' })
  async check(@Req() request: FastifyRequest) {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.checkRedis(),
    ]);
    const failures = checks.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [];
      const dependency = index === 0 ? 'database' : 'redis';
      this.logger.error(
        `${dependency} 健康检查失败 (${String(request.id)})`,
        result.reason instanceof Error ? result.reason.stack : String(result.reason),
      );
      return [dependency];
    });

    if (failures.length > 0) {
      throw new ServiceUnavailableException({
        status: 'down',
        requestId: String(request.id),
      });
    }

    return { status: 'up', requestId: String(request.id) };
  }

  @Get('liveness')
  @ApiOperation({ summary: '容器存活探针 (Liveness)' })
  checkLiveness(@Req() request: FastifyRequest) {
    return { status: 'up', requestId: String(request.id) };
  }

  @Get('readiness')
  @ApiOperation({ summary: '容器就绪探针 (Readiness)' })
  checkReadiness(@Req() request: FastifyRequest) {
    return this.check(request);
  }

  private async checkRedis(): Promise<void> {
    const client = this.redisService.getClient();
    if (!client) return;

    const pong = await client.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis PING 返回异常');
    }
  }
}
