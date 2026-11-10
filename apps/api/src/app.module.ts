import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { NotificationModule } from './modules/notification/notification.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { OperLogInterceptor } from './common/interceptors/oper-log.interceptor';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { SecurityThrottleGuard } from './common/guards/security-throttle.guard';
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

    // Notification center
    NotificationModule,
  ],
  providers: [
    Logger,
    // Global dynamic rate limiting & IP firewall
    { provide: APP_GUARD, useClass: SecurityThrottleGuard },
    // 默认拒绝匿名访问，仅 @Public() 路由例外
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // 菜单/按钮级权限校验，默认对未声明权限的接口放行
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Global response transformer
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Global operation log
    { provide: APP_INTERCEPTOR, useClass: OperLogInterceptor },
    // Global request stream log
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
