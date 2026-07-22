import {
  csrfTokensMatch,
  durationToSeconds,
  extractAuthToken,
} from './auth-security';

describe('auth security helpers', () => {
  it('优先提取显式 Bearer token', () => {
    expect(
      extractAuthToken({
        headers: { authorization: 'Bearer api-token' },
        cookies: { access_token: 'cookie-token' },
      }),
    ).toBe('api-token');
  });

  it('浏览器请求可从 HttpOnly Cookie 提取 token', () => {
    expect(extractAuthToken({ cookies: { access_token: 'cookie-token' } })).toBe(
      'cookie-token',
    );
  });

  it('只接受明确单位的正整数时长', () => {
    expect(durationToSeconds('8h')).toBe(28_800);
    expect(durationToSeconds('7d')).toBe(604_800);
    expect(() => durationToSeconds('3600')).toThrow('JWT_EXPIRES_IN');
  });

  it('使用等长比较校验双提交 CSRF token', () => {
    expect(csrfTokensMatch('csrf-value', 'csrf-value')).toBe(true);
    expect(csrfTokensMatch('csrf-value', 'wrong-value')).toBe(false);
    expect(csrfTokensMatch('csrf-value', undefined)).toBe(false);
  });
});
