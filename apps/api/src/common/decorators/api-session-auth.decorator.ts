import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiHeader } from '@nestjs/swagger';
import { CSRF_HEADER_NAME } from '../../modules/auth/auth-security';

/**
 * 声明 API 同时支持浏览器 HttpOnly Cookie 与非浏览器 Bearer Token。
 * 使用 Cookie 的写请求还需携带与 CSRF Cookie 一致的请求头。
 */
export function ApiSessionAuth() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiCookieAuth('cookie'),
    ApiHeader({
      name: CSRF_HEADER_NAME,
      required: false,
      description: '浏览器 Cookie 认证下的写请求必须携带，值需与 csrf_token Cookie 一致',
    }),
  );
}
