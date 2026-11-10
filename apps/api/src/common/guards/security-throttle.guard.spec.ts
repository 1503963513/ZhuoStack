import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { SecurityThrottleGuard } from './security-throttle.guard';
import { SecurityService } from '../../modules/system/security/security.service';

describe('SecurityThrottleGuard', () => {
  let guard: SecurityThrottleGuard;
  let securityService: jest.Mocked<Partial<SecurityService>>;

  beforeEach(() => {
    securityService = {
      checkIpAllowed: jest.fn().mockResolvedValue({ allowed: true }),
      checkThrottle: jest.fn().mockResolvedValue({ allowed: true, limit: 60, remaining: 59 }),
    };
    guard = new SecurityThrottleGuard(securityService as unknown as SecurityService);
  });

  function createContext(url = '/api/test', method = 'GET', ip = '127.0.0.1'): ExecutionContext {
    const header = jest.fn();
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          url,
          method,
          ip,
          headers: {},
        }),
        getResponse: () => ({ header }),
      }),
    } as unknown as ExecutionContext;
  }

  it('静态探针路由跳过安全检测', async () => {
    const ctx = createContext('/health');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(securityService.checkIpAllowed).not.toHaveBeenCalled();
  });

  it('命中黑名单时抛出 ForbiddenException (403)', async () => {
    securityService.checkIpAllowed = jest.fn().mockResolvedValue({ allowed: false, reason: 'IP 黑名单拦截' });
    const ctx = createContext('/api/data');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('触发限流超限时抛出 429 TooManyRequests', async () => {
    securityService.checkThrottle = jest.fn().mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      retryAfter: 30,
    });
    const ctx = createContext('/api/auth/login', 'POST');
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });
});
