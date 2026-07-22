import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogService } from '../../modules/log/log.service';

interface RequestWithUser {
  method: string;
  url: string;
  ip?: string;
  user?: { email?: string };
}

/**
 * 操作日志拦截器
 * 自动记录 POST/PUT/DELETE 请求的操作日志
 */
@Injectable()
export class OperLogInterceptor implements NestInterceptor {
  constructor(private readonly logService: LogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const { method, url, ip, user } = request;

    // 只记录写操作（POST/PUT/DELETE）
    if (!['POST', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // 跳过登录/注册（已有登录日志）
    if (url.includes('/auth/login') || url.includes('/auth/register')) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logService.createOperLog({
            title: this.getTitle(method, url),
            businessType: this.getBusinessType(method),
            method: url,
            requestMethod: method,
            url,
            ip: ip || 'unknown',
            operName: user?.email || 'anonymous',
            status: 1,
            jsonResult: `耗时 ${duration}ms`,
          }).catch(() => {}); // 静默失败，不影响主流程
        },
        error: (error: unknown) => {
          this.logService.createOperLog({
            title: this.getTitle(method, url),
            businessType: this.getBusinessType(method),
            method: url,
            requestMethod: method,
            url,
            ip: ip || 'unknown',
            operName: user?.email || 'anonymous',
            status: 0,
            errorMsg: error instanceof Error ? error.message : '操作失败',
          }).catch(() => {});
        },
      }),
    );
  }

  private getTitle(method: string, url: string): string {
    const resource = this.extractResource(url);
    switch (method) {
      case 'POST': return `新增${resource}`;
      case 'PUT': return `修改${resource}`;
      case 'DELETE': return `删除${resource}`;
      default: return `${method} ${url}`;
    }
  }

  private getBusinessType(method: string): number {
    switch (method) {
      case 'POST': return 1;
      case 'PUT': return 2;
      case 'DELETE': return 3;
      default: return 0;
    }
  }

  private extractResource(url: string): string {
    // 从 URL 提取资源名称: /api/system/dept/123 → 部门
    const resourceMap: Record<string, string> = {
      'dept': '部门',
      'post': '岗位',
      'role': '角色',
      'menu': '菜单',
      'dict': '字典',
      'user': '用户',
      'cache': '缓存',
      'online': '在线用户',
      'jobs': '定时任务',
      'oper': '操作日志',
      'login': '登录日志',
      'ai': 'AI',
    };

    const parts = url.split('/').filter(Boolean);
    for (const part of parts) {
      if (resourceMap[part]) return resourceMap[part];
    }
    return '资源';
  }
}
