import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface ErrorResponse {
  code: number;
  data: null;
  message: string;
}

interface FastifyRequestLike {
  method: string;
  url: string;
}

interface FastifyReplyLike {
  status(code: number): { send(body: unknown): void };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

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
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse: ErrorResponse = {
      code: status,
      data: null,
      message,
    };

    // 静默处理浏览器自动请求的 favicon.ico 404
    if (request.url === '/favicon.ico' && status === HttpStatus.NOT_FOUND) {
      response.status(status).send(errorResponse);
      return;
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
    );

    response.status(status).send(errorResponse);
  }
}
