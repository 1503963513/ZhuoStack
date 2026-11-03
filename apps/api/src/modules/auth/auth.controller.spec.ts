import { AuthController } from './auth.controller';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from './auth-security';

describe('AuthController cookies', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'USER',
    avatar: null,
  };

  function createController() {
    const authService = {
      login: jest.fn().mockResolvedValue({
        access_token: 'signed-jwt',
        refresh_token: 'user.refresh-token',
        user,
      }),
      refreshSession: jest.fn(),
      blacklistToken: jest.fn().mockResolvedValue(undefined),
      revokeUserSessions: jest.fn().mockResolvedValue(true),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_EXPIRES_IN') return '8h';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return fallback;
      }),
    };
    const controller = new AuthController(authService as never, configService as never);
    return { controller, authService };
  }

  it('登录响应不暴露 JWT，并签发 HttpOnly JWT 与 CSRF Cookie', async () => {
    const { controller } = createController();
    const reply = {
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const response = await controller.login(
      {} as never,
      { ip: '127.0.0.1', headers: {} } as never,
      reply as never,
    );

    expect(response).toEqual({ user });
    expect(reply.setCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'signed-jwt',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 28_800,
      }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'lax' }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'user.refresh-token',
      expect.objectContaining({ httpOnly: true, path: '/api/auth', maxAge: 604_800 }),
    );
  });

  it('刷新会话时轮换 Refresh Cookie，并复用当前 CSRF Token', async () => {
    const { controller, authService } = createController();
    authService.refreshSession.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'user.new-refresh',
      user,
    });
    const reply = { setCookie: jest.fn(), clearCookie: jest.fn() };

    const response = await controller.refresh(
      {
        cookies: {
          [REFRESH_COOKIE_NAME]: 'user.old-refresh',
          [CSRF_COOKIE_NAME]: 'csrf-value',
        },
        headers: {},
        ip: '127.0.0.1',
      } as never,
      reply as never,
    );

    expect(response).toEqual({ user });
    expect(authService.refreshSession).toHaveBeenCalledWith(
      'user.old-refresh',
      '127.0.0.1',
      { browser: undefined, os: undefined },
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'user.new-refresh',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      'csrf-value',
      expect.objectContaining({ httpOnly: false }),
    );
  });

  it('刷新失败时清除认证 Cookie', async () => {
    const { controller, authService } = createController();
    authService.refreshSession.mockRejectedValue(new Error('expired'));
    const reply = { setCookie: jest.fn(), clearCookie: jest.fn() };

    await expect(
      controller.refresh(
        {
          cookies: {
            [REFRESH_COOKIE_NAME]: 'expired-refresh',
            [CSRF_COOKIE_NAME]: 'csrf-value',
          },
          headers: {},
        } as never,
        reply as never,
      ),
    ).rejects.toThrow('expired');

    expect(reply.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth' }),
    );
  });

  it('登出时吊销会话、拉黑 Cookie JWT 并清除三个 Cookie', async () => {
    const { controller, authService } = createController();
    const reply = {
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    await controller.logout(
      'user-1',
      { cookies: { [AUTH_COOKIE_NAME]: 'cookie-jwt' }, headers: {} } as never,
      reply as never,
    );

    expect(authService.revokeUserSessions).toHaveBeenCalledWith('user-1');
    expect(authService.blacklistToken).toHaveBeenCalledWith('cookie-jwt');
    expect(reply.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({ path: '/', sameSite: 'lax' }),
    );
    expect(reply.clearCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.objectContaining({ path: '/', sameSite: 'lax' }),
    );
    expect(reply.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth', sameSite: 'lax' }),
    );
  });
});
