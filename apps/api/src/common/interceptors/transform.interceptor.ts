import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  requestId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ id?: string }>();
    const response = http.getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((data) => ({
        code: response.statusCode || 200,
        data,
        message: 'success',
        ...(request.id && { requestId: request.id }),
      })),
    );
  }
}
