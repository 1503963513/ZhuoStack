import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './database/redis.module';
import { RedisService } from './database/redis.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { SystemModule } from './modules/system/system.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { LogModule } from './modules/log/log.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { OperLogInterceptor } from './common/interceptors/oper-log.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RedisThrottlerStorage } from './common/throttling/redis-throttler.storage';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';

const nodeEnv = process.env.NODE_ENV || 'development';
const apiEnvFile = `.env.${nodeEnv}`;

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      // 生产环境保留 .env 回退，确保旧版 PM2 部署首次更新时能够平滑迁移。
      envFilePath: nodeEnv === 'production' ? [apiEnvFile, '.env'] : apiEnvFile,
    }),

    // Throttler
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        storage: new RedisThrottlerStorage(redisService),
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
            limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
          },
        ],
      }),
    }),

    // Event emitter
    EventEmitterModule.forRoot(),

    // Database
    PrismaModule,
    RedisModule,

    // Business modules
    AuthModule,
    UserModule,
    HealthModule,
    AiModule,

    // System management modules
    SystemModule,

    // System monitoring
    MonitorModule,

    // Log management
    LogModule,
  ],
  providers: [
    Logger,
    // Global rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // 默认拒绝匿名访问，仅 @Public() 路由例外
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global response transformer
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Global operation log
    { provide: APP_INTERCEPTOR, useClass: OperLogInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
