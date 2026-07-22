import { AuthController } from './auth.controller';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from './auth-security';

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
      login: jest.fn().mockResolvedValue({ access_token: 'signed-jwt', user }),
      blacklistToken: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_EXPIRES_IN') return '8h';
        return fallback;
      }),
    };
    const controller = new AuthController(
      authService as never,
      configService as never,
    );
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
        sameSite: 'strict',
        maxAge: 28_800,
      }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, sameSite: 'strict' }),
    );
  });

  it('登出时拉黑 Cookie JWT 并清除两个 Cookie', async () => {
    const { controller, authService } = createController();
    const reply = {
      setCookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    await controller.logout(
      { cookies: { [AUTH_COOKIE_NAME]: 'cookie-jwt' }, headers: {} } as never,
      reply as never,
    );

    expect(authService.blacklistToken).toHaveBeenCalledWith('cookie-jwt');
    expect(reply.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({ path: '/', sameSite: 'strict' }),
    );
    expect(reply.clearCookie).toHaveBeenCalledWith(
      CSRF_COOKIE_NAME,
      expect.objectContaining({ path: '/', sameSite: 'strict' }),
    );
  });
});
