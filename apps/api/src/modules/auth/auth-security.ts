import * as crypto from 'crypto';

export const AUTH_COOKIE_NAME = 'access_token';
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function csrfTokensMatch(
  cookieToken: string | undefined,
  headerToken: string | undefined,
): boolean {
  if (!cookieToken || !headerToken) return false;
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return (
    cookieBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  );
}

interface AuthRequestLike {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}

/** Bearer 用于非浏览器客户端；浏览器默认使用 HttpOnly Cookie。 */
export function extractAuthToken(request: AuthRequestLike): string | null {
  const authorization = request.headers?.authorization;
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  const bearer = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || request.cookies?.[AUTH_COOKIE_NAME] || null;
}

/** 将受支持的 JWT 时长转换为 Cookie Max-Age 秒数。 */
export function durationToSeconds(value: string): number {
  const match = value.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) {
    throw new Error('JWT_EXPIRES_IN 必须使用整数加 s/m/h/d 单位，例如 30m、8h 或 7d');
  }

  const amount = Number(match[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('JWT_EXPIRES_IN 必须为正整数时长');
  }

  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return amount * unitSeconds[match[2].toLowerCase()];
}
