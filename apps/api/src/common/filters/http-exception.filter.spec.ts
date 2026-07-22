import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createHost() {
    const send = jest.fn();
    const status = jest.fn(() => ({ send }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', url: '/api/test' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, send };
  }

  it('保留可公开的 HttpException 消息', () => {
    const { host, status, send } = createHost();

    new HttpExceptionFilter().catch(new BadRequestException('参数无效'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({
      code: 400,
      data: null,
      message: '参数无效',
    });
  });

  it('对未处理异常返回固定消息，不泄露内部细节', () => {
    const { host, status, send } = createHost();

    new HttpExceptionFilter().catch(
      new Error('connect ECONNREFUSED /var/run/private.sock'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      code: 500,
      data: null,
      message: 'Internal server error',
    });
  });
});
