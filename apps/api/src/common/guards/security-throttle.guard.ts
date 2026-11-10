import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SecurityService } from '../../modules/system/security/security.service';

interface FastifyRequestLike {
  url: string;
  method: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id?: string; email?: string };
}

interface FastifyReplyLike {
  header(name: string, value: unknown): void;
}

@Injectable()
export class SecurityThrottleGuard implements CanActivate {
  constructor(private readonly securityService: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequestLike>();
    const reply = http.getResponse<FastifyReplyLike>();

    // 静态资源与探针跳过
    const pathname = req.url.split('?')[0];
    if (pathname === '/favicon.ico' || pathname.startsWith('/health')) {
      return true;
    }

    // 提取客户端真实 IP
    const cfIp = req.headers['cf-connecting-ip'];
    const xRealIp = req.headers['x-real-ip'];
    const xForwardedFor = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : typeof xForwardedFor === 'string'
      ? xForwardedFor.split(',')[0].trim()
      : undefined;

    const clientIp =
      (typeof cfIp === 'string' && cfIp) ||
      (typeof xRealIp === 'string' && xRealIp) ||
      firstForwarded ||
      req.ip ||
      '127.0.0.1';

    // 1. 第一关：IP 黑白名单拦截
    const ipCheck = await this.securityService.checkIpAllowed(clientIp);
    if (!ipCheck.allowed) {
      throw new ForbiddenException(ipCheck.reason || '当前 IP 受到系统安全访问限制');
    }

    // 2. 第二关：动态多维滑动窗口限流
    const throttleResult = await this.securityService.checkThrottle(
      pathname,
      req.method,
      clientIp,
      req.user?.id,
    );

    if (throttleResult.limit > 0) {
      reply.header('X-RateLimit-Limit', throttleResult.limit);
      reply.header('X-RateLimit-Remaining', throttleResult.remaining);
    }

    if (!throttleResult.allowed) {
      reply.header('Retry-After', throttleResult.retryAfter || 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `请求过于频繁，请在 ${throttleResult.retryAfter || 60} 秒后再试`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
