import { Injectable, LoggerService } from '@nestjs/common';
import { SystemLogService } from './system-log.service';

/**
 * 自定义全局 AppLogger，将框架日志和业务 Logger 输出既保留在控制台，又同时打入 SystemLogService
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(private readonly systemLogService?: SystemLogService) {}

  log(message: unknown, context?: string) {
    console.log(`[LOG] [${context || 'System'}] ${typeof message === 'object' ? JSON.stringify(message) : message}`);
    this.systemLogService?.record({
      level: 'info',
      context: context || 'System',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
    });
  }

  error(message: unknown, stack?: string, context?: string) {
    console.error(`[ERR] [${context || 'System'}] ${typeof message === 'object' ? JSON.stringify(message) : message}`, stack || '');
    this.systemLogService?.record({
      level: 'error',
      context: context || 'System',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      stack: stack || undefined,
    });
  }

  warn(message: unknown, context?: string) {
    console.warn(`[WARN] [${context || 'System'}] ${typeof message === 'object' ? JSON.stringify(message) : message}`);
    this.systemLogService?.record({
      level: 'warn',
      context: context || 'System',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
    });
  }

  debug(message: unknown, context?: string) {
    console.debug(`[DEBUG] [${context || 'System'}] ${typeof message === 'object' ? JSON.stringify(message) : message}`);
    this.systemLogService?.record({
      level: 'debug',
      context: context || 'System',
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
    });
  }

  verbose(message: unknown, context?: string) {
    this.debug(message, context);
  }
}
