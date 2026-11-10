import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SystemLogService } from '../../modules/monitor/log-runtime/system-log.service';

interface FastifyRequestWithMeta {
  id?: string;
  method: string;
  url: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { email?: string; id?: string };
}

interface FastifyReplyWithStatus {
  statusCode: number;
}

/**
 * 请求日志记录拦截器：自动抽取客户端 Caller、RequestId 并推入系统运行日志缓冲区
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(private readonly systemLogService?: SystemLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequestWithMeta>();
    const reply = http.getResponse<FastifyReplyWithStatus>();

    // 静态资源、健康检查、长连接推送(SSE)及监控自轮询请求跳过，避免日志刷屏
    const pathname = req.url.split('?')[0];
    if (
      pathname === '/favicon.ico' ||
      pathname.startsWith('/health') ||
      pathname === '/api/monitor/logs/recent' ||
      pathname === '/api/monitor/logs/config' ||
      pathname === '/api/notifications/stream'
    ) {
      return next.handle();
    }

    const startTime = Date.now();
    const clientAppHeader = req.headers['x-client-app'];
    const caller =
      typeof clientAppHeader === 'string'
        ? clientAppHeader
        : req.headers['user-agent']?.includes('Postman')
        ? 'postman'
        : 'web-client';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const status = reply.statusCode || 200;
          this.systemLogService?.record({
            level: 'info',
            context: 'HTTP',
            message: `${req.method} ${req.url} - ${status} (${duration}ms)`,
            caller,
            requestId: req.id,
          });
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          const errMsg = err instanceof Error ? err.message : String(err);
          this.systemLogService?.record({
            level: 'warn',
            context: 'HTTP',
            message: `${req.method} ${req.url} - 异常: ${errMsg} (${duration}ms)`,
            caller,
            requestId: req.id,
            stack: err instanceof Error ? err.stack : undefined,
          });
        },
      }),
    );
  }
}
