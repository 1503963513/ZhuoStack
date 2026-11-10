import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { AlertService } from '../../modules/system/alert/alert.service';
import { SystemLogService } from '../../modules/monitor/log-runtime/system-log.service';

interface ErrorResponse {
  code: number;
  data: null;
  message: string;
  requestId?: string;
}

interface FastifyRequestLike {
  id?: string;
  method: string;
  url: string;
  ip?: string;
  user?: { email?: string; id?: string };
}

interface FastifyReplyLike {
  status(code: number): { send(body: unknown): void };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Optional()
    @Inject(AlertService)
    private readonly alertService?: AlertService,
    @Optional()
    @Inject(SystemLogService)
    private readonly systemLogService?: SystemLogService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReplyLike>();
    const request = ctx.getRequest<FastifyRequestLike>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(resp['message'])) {
          message = (resp['message'] as string[]).join(', ');
        } else if (typeof resp['message'] === 'string') {
          message = resp['message'];
        } else {
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      // 未受控异常的原始消息只写服务端日志，避免泄露 SQL、路径和 SDK 细节。
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    const reqId = request.id;
    const errorResponse: ErrorResponse = {
      code: status,
      data: null,
      message,
      ...(reqId && { requestId: reqId }),
    };

    // 静默处理浏览器自动请求的 favicon.ico 404
    if (request.url === '/favicon.ico' && status === HttpStatus.NOT_FOUND) {
      response.status(status).send(errorResponse);
      return;
    }

    const logPrefix = reqId ? `[${reqId}] ` : '';
    this.logger.error(`${logPrefix}${request.method} ${request.url} - ${status} - ${message}`);

    // 触发可控异步告警（非阻塞处理，不影响主流程响应）
    if (this.alertService) {
      const errorMsg =
        exception instanceof Error ? exception.message : typeof message === 'string' ? message : String(exception);
      this.alertService
        .trigger({
          method: request.method,
          url: request.url,
          statusCode: status,
          message: errorMsg,
          requestId: reqId,
          user: request.user?.email,
          ip: request.ip,
          stack: exception instanceof Error ? exception.stack : undefined,
        })
        .then((triggered) => {
          if (triggered) {
            this.systemLogService?.record({
              level: "error",
              context: "AlertRobot",
              message: `[🚨告警已推送] ${request.method} ${request.url} 触发群机器人告警: ${errorMsg.slice(0, 80)}`,
              caller: "system-alert",
              requestId: reqId,
            });
          }
        })
        .catch(() => {});
    }

    response.status(status).send(errorResponse);
  }
}
