import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/database/redis.service';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfTokensMatch,
} from '../src/modules/auth/auth-security';
import { Role, Status, MenuType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

describe('API Contract & Runtime E2E Tests', () => {
  let app: NestFastifyApplication;
  let fastifyInstance: FastifyInstance;

  // 测试用户数据
  const mockAdminUser = {
    id: 'user-admin-1',
    email: 'admin@example.com',
    name: 'Admin User',
    password: '',
    role: Role.ADMIN,
    avatar: 'https://example.com/avatar.png',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  const mockNormalUser = {
    id: 'user-normal-2',
    email: 'normal@example.com',
    name: 'Normal User',
    password: '',
    role: Role.USER,
    avatar: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  const mockMenus = [
    {
      id: 'menu-1',
      parentId: null,
      name: '系统管理',
      type: MenuType.DIRECTORY,
      path: '/system',
      component: null,
      icon: 'Settings',
      sort: 1,
      status: Status.ACTIVE,
      perms: null,
      remark: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'menu-2',
      parentId: 'menu-1',
      name: '用户管理',
      type: MenuType.MENU,
      path: '/system/user',
      component: 'system/user/page',
      icon: 'User',
      sort: 1,
      status: Status.ACTIVE,
      perms: null,
      remark: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'menu-3',
      parentId: 'menu-2',
      name: '用户新增',
      type: MenuType.BUTTON,
      path: null,
      component: null,
      icon: null,
      sort: 1,
      status: Status.ACTIVE,
      perms: 'system:user:add',
      remark: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
    process.env.DATABASE_URL = 'mysql://root:root@127.0.0.1:3309/test';
    process.env.REDIS_REQUIRED = 'false';

    // 预加密密码
    mockAdminUser.password = await bcrypt.hash('admin123', 10);
    mockNormalUser.password = await bcrypt.hash('user123', 10);

    const prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.email === mockAdminUser.email || where.id === mockAdminUser.id) {
            return Promise.resolve({ ...mockAdminUser, roles: [] });
          }
          if (where.email === mockNormalUser.email || where.id === mockNormalUser.id) {
            return Promise.resolve({ ...mockNormalUser, roles: [] });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([mockAdminUser, mockNormalUser]),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            id: where.id,
            email: data.email || mockAdminUser.email,
            name: data.name || mockAdminUser.name,
            role: data.role || mockAdminUser.role,
            avatar: data.avatar ?? mockAdminUser.avatar,
            createdAt: mockAdminUser.createdAt,
            updatedAt: new Date(),
          });
        }),
      },
      sysMenu: {
        findMany: jest.fn().mockResolvedValue(mockMenus),
      },
      sysDept: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'dept-100',
            name: data.name,
            sort: data.sort || 0,
            status: data.status,
            remark: data.remark || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      sysOperLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      sysLoginLog: {
        create: jest.fn().mockResolvedValue({ id: 'login-log-1' }),
      },
    };

    // 基于内存 Map 的 Mock Redis
    const redisStorage = new Map<string, string>();
    const redisMock = {
      getClient: jest.fn().mockReturnValue(null),
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(redisStorage.get(key) || null);
      }),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        redisStorage.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        redisStorage.delete(key);
        return Promise.resolve();
      }),
      exists: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(redisStorage.has(key));
      }),
      getdel: jest.fn().mockImplementation((key: string) => {
        if (key.startsWith('captcha:')) {
          return Promise.resolve('test');
        }
        const val = redisStorage.get(key);
        redisStorage.delete(key);
        return Promise.resolve(val || null);
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.register(fastifyCookie);
    await app.register(fastifyMultipart, {
      limits: { fileSize: 50 * 1024 * 1024 },
    });

    fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;
    fastifyInstance.addHook('onRequest', async (request, reply) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
      const pathname = request.url.split('?')[0];
      if (pathname === '/api/auth/login' || pathname === '/api/auth/register') return;

      const authCookie = request.cookies[AUTH_COOKIE_NAME];
      const authorization = request.headers.authorization;
      if (!authCookie || authorization?.match(/^Bearer\s+/i)) return;

      const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
      const csrfHeaderValue = request.headers[CSRF_HEADER_NAME];
      const csrfHeader = Array.isArray(csrfHeaderValue) ? csrfHeaderValue[0] : csrfHeaderValue;

      if (!csrfTokensMatch(csrfCookie, csrfHeader)) {
        return reply.code(403).send({
          statusCode: 403,
          message: 'CSRF 校验失败，请刷新页面后重试',
          error: 'Forbidden',
        });
      }
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api', { exclude: ['health'] });

    await app.init();
    await fastifyInstance.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ========== 1. 认证 Cookie 与双提交 CSRF 验证 ==========
  describe('认证 Cookie 与双提交 CSRF 机制', () => {
    let authCookie = '';
    let csrfCookie = '';

    it('POST /api/auth/login 成功时返回 Set-Cookie 并匹配 OpenAPI 成功结构', async () => {
      // 1. 获取公钥并加密密码
      const pkRes = await fastifyInstance.inject({
        method: 'GET',
        url: '/api/auth/public-key',
      });
      const pkData = JSON.parse(pkRes.payload);
      const encryptedPassword = crypto
        .publicEncrypt(
          {
            key: pkData.data.publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha-256',
          },
          Buffer.from('admin123', 'utf-8'),
        )
        .toString('base64');

      const loginRes = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@example.com',
          password: encryptedPassword,
          captchaId: 'test-captcha-id',
          captchaCode: 'test',
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const body = JSON.parse(loginRes.payload);

      // 验证外层 { code, data, message } 结构与 OpenAPI 声明的 AuthSuccessResponseDto 一致
      expect(body).toEqual({
        code: 200,
        message: 'success',
        data: {
          user: {
            id: mockAdminUser.id,
            email: mockAdminUser.email,
            name: mockAdminUser.name,
            role: mockAdminUser.role,
            avatar: mockAdminUser.avatar,
          },
        },
      });

      // 验证 Cookie 设置
      const cookies = loginRes.cookies;
      const accessTokenCookie = cookies.find((c) => c.name === AUTH_COOKIE_NAME);
      const csrfTokenCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);

      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie?.httpOnly).toBe(true); // 必须是 HttpOnly
      expect(csrfTokenCookie).toBeDefined();
      expect(csrfTokenCookie?.httpOnly).toBeFalsy(); // CSRF Cookie 前端可读

      authCookie = `${accessTokenCookie?.name}=${accessTokenCookie?.value}`;
      csrfCookie = `${csrfTokenCookie?.name}=${csrfTokenCookie?.value}`;
    });

    it('使用 Cookie 发起 POST 修改操作时，缺失 x-csrf-token 应被 403 阻断', async () => {
      const res = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/system/dept',
        headers: {
          cookie: `${authCookie}; ${csrfCookie}`,
        },
        payload: {
          name: '测试部门',
          status: 'ACTIVE',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.message).toContain('CSRF 校验失败');
    });

    it('使用 Cookie 发起修改并携带匹配的 x-csrf-token 请求头，应顺利通过 CSRF 校验', async () => {
      const csrfValue = csrfCookie.split('=')[1];
      const res = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/system/dept',
        headers: {
          cookie: `${authCookie}; ${csrfCookie}`,
          'x-csrf-token': csrfValue,
        },
        payload: {
          name: '测试部门',
          status: 'ACTIVE',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(201);
      expect(body.data.name).toBe('测试部门');
    });
  });

  // ========== 2. 角色授权与权限菜单响应结构 ==========
  describe('角色授权与权限菜单', () => {
    let userToken = '';
    let adminToken = '';

    beforeAll(async () => {
      // 登录获取普通用户与管理员的 Token
      const pkRes = await fastifyInstance.inject({ method: 'GET', url: '/api/auth/public-key' });
      const pk = JSON.parse(pkRes.payload).data.publicKey;

      const encrypt = (pwd: string) =>
        crypto
          .publicEncrypt(
            { key: pk, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha-256' },
            Buffer.from(pwd, 'utf-8'),
          )
          .toString('base64');

      const loginNormal = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'normal@example.com',
          password: encrypt('user123'),
          captchaId: 'cid',
          captchaCode: 'test',
        },
      });
      userToken = loginNormal.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;

      const loginAdmin = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@example.com',
          password: encrypt('admin123'),
          captchaId: 'cid2',
          captchaCode: 'test',
        },
      });
      adminToken = loginAdmin.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
    });

    it('普通用户访问 @Roles(Role.ADMIN) 接口应返回 403 且结构符合全局异常过滤器', async () => {
      const res = await fastifyInstance.inject({
        method: 'GET',
        url: '/api/user',
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body).toMatchObject({
        code: 403,
        data: null,
      });
      expect(body.message).toMatch(/permission|Forbidden/i);
    });

    it('GET /api/auth/menus 响应结构严格符合 OpenAPI 树形结构', async () => {
      const res = await fastifyInstance.inject({
        method: 'GET',
        url: '/api/auth/menus',
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(200);
      expect(body.message).toBe('success');
      expect(Array.isArray(body.data)).toBe(true);

      // 检验顶级节点和子节点的属性
      const rootMenu = body.data[0];
      expect(rootMenu).toHaveProperty('id');
      expect(rootMenu).toHaveProperty('name', '系统管理');
      expect(rootMenu).toHaveProperty('type', 'DIRECTORY');
      expect(rootMenu).toHaveProperty('sort');
      expect(rootMenu).toHaveProperty('status', 'ACTIVE');
      expect(Array.isArray(rootMenu.children)).toBe(true);
      expect(rootMenu.children[0]).toHaveProperty('name', '用户管理');
    });
  });

  // ========== 3. 用户编辑关联关系与运行时响应结构 ==========
  describe('用户编辑与详情接口契约', () => {
    let adminToken = '';

    beforeAll(async () => {
      const pkRes = await fastifyInstance.inject({ method: 'GET', url: '/api/auth/public-key' });
      const pk = JSON.parse(pkRes.payload).data.publicKey;
      const encrypted = crypto
        .publicEncrypt(
          { key: pk, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha-256' },
          Buffer.from('admin123', 'utf-8'),
        )
        .toString('base64');
      const login = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@example.com',
          password: encrypted,
          captchaId: 'cid',
          captchaCode: 'test',
        },
      });
      adminToken = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
    });

    it('PUT /api/user/:id 更新关联关系时，响应只包含 UserItemDto 基础字段，不返回未查出的虚假关系', async () => {
      const res = await fastifyInstance.inject({
        method: 'PUT',
        url: `/api/user/${mockAdminUser.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Name',
          deptId: 'dept-100',
          postIds: ['post-1', 'post-2'],
          roleIds: ['role-1'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe(200);
      expect(body.data.name).toBe('Updated Name');

      // 关键校验：运行时响应绝不应包含 posts 和 roles 字段
      expect(body.data.posts).toBeUndefined();
      expect(body.data.roles).toBeUndefined();
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('email');
      expect(body.data).toHaveProperty('role');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.data).toHaveProperty('updatedAt');
    });
  });

  // ========== 4. 分页查询结构运行时校验 ==========
  describe('分页查询返回结构', () => {
    let adminToken = '';

    beforeAll(async () => {
      const pkRes = await fastifyInstance.inject({ method: 'GET', url: '/api/auth/public-key' });
      const pk = JSON.parse(pkRes.payload).data.publicKey;
      const encrypted = crypto
        .publicEncrypt(
          { key: pk, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha-256' },
          Buffer.from('admin123', 'utf-8'),
        )
        .toString('base64');
      const login = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@example.com',
          password: encrypted,
          captchaId: 'cid',
          captchaCode: 'test',
        },
      });
      adminToken = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
    });

    it('GET /api/user 分页返回外层包含 code、data.data 与 data.pagination', async () => {
      const res = await fastifyInstance.inject({
        method: 'GET',
        url: '/api/user?page=1&pageSize=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);

      expect(body).toEqual({
        code: 200,
        message: 'success',
        data: {
          data: expect.any(Array),
          pagination: {
            total: expect.any(Number),
            page: 1,
            pageSize: 10,
            totalPages: expect.any(Number),
          },
        },
      });
      expect(body.data.data.length).toBeGreaterThan(0);
    });
  });

  // ========== 5. 文件类型校验与上传错误处理 ==========
  describe('文件接口校验与错误响应包装', () => {
    let adminToken = '';

    beforeAll(async () => {
      const pkRes = await fastifyInstance.inject({ method: 'GET', url: '/api/auth/public-key' });
      const pk = JSON.parse(pkRes.payload).data.publicKey;
      const encrypted = crypto
        .publicEncrypt(
          { key: pk, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha-256' },
          Buffer.from('admin123', 'utf-8'),
        )
        .toString('base64');
      const login = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'admin@example.com',
          password: encrypted,
          captchaId: 'cid',
          captchaCode: 'test',
        },
      });
      adminToken = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
    });

    it('未选择文件发起上传时应返回 400 且响应体格式严格满足全局错误过滤器', async () => {
      const boundary = '----WebKitFormBoundaryTest';
      const emptyPayload = `--${boundary}--\r\n`;

      const res = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/system/file/upload',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: emptyPayload,
      });

      // 400 Bad Request
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body).toEqual({
        code: 400,
        data: null,
        message: expect.stringMatching(/请选择要上传的文件|file/i),
      });
    });

    it('上传不支持的非法文件类型（如 .exe）时应返回 400 并在结构上符合全局错误响应', async () => {
      const boundary = '----WebKitFormBoundaryExeTest';
      const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="malicious.exe"\r\nContent-Type: application/x-msdownload\r\n\r\n`;
      const fileFooter = `\r\n--${boundary}--\r\n`;
      const payload = Buffer.concat([
        Buffer.from(fileHeader, 'utf-8'),
        Buffer.from('MZdummyexecutablecontent', 'utf-8'),
        Buffer.from(fileFooter, 'utf-8'),
      ]);

      const res = await fastifyInstance.inject({
        method: 'POST',
        url: '/api/system/file/upload',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body).toMatchObject({
        code: 400,
        data: null,
      });
      expect(body.message).toMatch(/不支持的文件类型|格式/);
    });
  });
});
