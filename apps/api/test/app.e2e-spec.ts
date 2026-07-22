import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/database/redis.service';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
    process.env.REDIS_REQUIRED = 'false';

    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    };
    const redisClient = {
      eval: jest.fn().mockResolvedValue([1, 60_000, 0, 0]),
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    const redis = {
      getClient: jest.fn().mockReturnValue(redisClient),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delPattern: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      incr: jest.fn().mockResolvedValue(1),
      getdel: jest.fn().mockResolvedValue(null),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api', { exclude: ['health'] });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('/health (GET)', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: 200,
      data: { status: 'ok' },
    });
  });

  it('未显式标记 @Public() 的接口默认拒绝匿名访问', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/auth/profile',
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.payload)).toMatchObject({
      code: 401,
      message: 'Authentication required',
    });
  });
});
