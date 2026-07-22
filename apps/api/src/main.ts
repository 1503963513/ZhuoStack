import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfTokensMatch,
  durationToSeconds,
} from './modules/auth/auth-security';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // 检查必需的环境变量
  const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`缺少必需的环境变量: ${envVar}`);
      process.exit(1);
    }
  }

  // 检查 JWT_SECRET 强度
  const jwtSecret = process.env.JWT_SECRET!;
  const WEAK_SECRETS = [
    'default-secret',
    'your-super-secret-jwt-key-change-in-production',
    'secret',
    'jwt-secret',
    'changeme',
    '123456',
  ];
  if (WEAK_SECRETS.includes(jwtSecret.toLowerCase()) || jwtSecret.length < 32) {
    logger.error(
      'JWT_SECRET 不安全！当前值为已知的弱密钥或长度不足 32 字符。' +
        '请运行以下命令生成安全密钥：\n' +
        "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
    process.exit(1);
  }
  try {
    durationToSeconds(process.env.JWT_EXPIRES_IN || '8h');
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // 检查敏感环境变量不为空
  if (!process.env.OPENAI_API_KEY && isProduction) {
    logger.warn('OPENAI_API_KEY 未设置，AI 功能将不可用');
  }

  // HTTPS 配置（仅生产环境）
  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslKeyPath = process.env.SSL_KEY_PATH;
  if (Boolean(sslCertPath) !== Boolean(sslKeyPath)) {
    logger.error('SSL_CERT_PATH 与 SSL_KEY_PATH 必须同时配置');
    process.exit(1);
  }
  const hasHttps = isProduction && sslCertPath && sslKeyPath;

  const rawTrustProxy = process.env.TRUST_PROXY?.trim();
  const unsafeTrustAll = ['true', '*', 'all'].includes(rawTrustProxy?.toLowerCase() || '');
  if (isProduction && unsafeTrustAll) {
    logger.error('生产环境 TRUST_PROXY 禁止信任全部来源，请配置可信代理网段');
    process.exit(1);
  }
  const trustProxy = !rawTrustProxy
    ? isProduction
      ? 'loopback, linklocal, uniquelocal'
      : false
    : unsafeTrustAll
      ? true
      : ['false', 'none'].includes(rawTrustProxy.toLowerCase())
        ? false
        : rawTrustProxy;

  const httpsOptions = hasHttps
    ? {
        https: {
          cert: fs.readFileSync(sslCertPath),
          key: fs.readFileSync(sslKeyPath),
          minVersion: 'TLSv1.2' as const,
        },
      }
    : undefined;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ ...(httpsOptions || {}), trustProxy }),
    { bufferLogs: true },
  );

  // Use NestJS built-in logger
  app.useLogger(app.get(Logger));

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.includes('*')) {
    logger.error('启用凭证 Cookie 时 CORS_ORIGIN 禁止使用通配符 *');
    process.exit(1);
  }
  if (isProduction && allowedOrigins.some((origin) => !origin.startsWith('https://'))) {
    logger.error('生产环境 CORS_ORIGIN 必须全部使用 https:// 来源');
    process.exit(1);
  }

  // 解析认证与 CSRF Cookie。JWT Cookie 不签名：JWT 本身已经使用服务端密钥验签。
  await app.register(fastifyCookie);

  // Cookie 认证的非安全方法必须通过双提交 CSRF 校验；显式 Bearer 客户端不受影响。
  const fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastifyInstance.addHook('onRequest', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const pathname = request.url.split('?')[0];
    if (pathname === '/api/auth/login' || pathname === '/api/auth/register') return;

    const authCookie = request.cookies[AUTH_COOKIE_NAME];
    const authorization = request.headers.authorization;
    if (!authCookie || authorization?.match(/^Bearer\s+/i)) return;

    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    const csrfHeaderValue = request.headers[CSRF_HEADER_NAME];
    const csrfHeader = Array.isArray(csrfHeaderValue)
      ? csrfHeaderValue[0]
      : csrfHeaderValue;

    if (!csrfTokensMatch(csrfCookie, csrfHeader)) {
      return reply.code(403).send({
        statusCode: 403,
        message: 'CSRF 校验失败，请刷新页面后重试',
        error: 'Forbidden',
      });
    }
  });

  // 安全响应头（X-Content-Type-Options, Strict-Transport-Security 等）
  const swaggerEnabled = process.env.SWAGGER_ENABLED === 'true';
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: swaggerEnabled
        ? {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'", ...allowedOrigins],
            imgSrc: ["'self'", 'data:'],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
          }
        : {
            defaultSrc: ["'none'"],
            baseUri: ["'none'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'none'"],
          },
    },
    frameguard: swaggerEnabled ? false : { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  });

  // 文件上传支持（multipart/form-data）
  const maxFileSizeMB = parseInt(process.env.FILE_MAX_SIZE_MB || '50', 10);
  await app.register(fastifyMultipart, {
    limits: { fileSize: maxFileSizeMB * 1024 * 1024 },
  });

  // 本地静态文件服务；云存储模式下如果本地目录仍存在，继续提供历史文件。
  const fileStorageType = process.env.FILE_STORAGE_TYPE || 'local';
  const storagePath = process.env.FILE_STORAGE_PATH || 'uploads';
  const urlPrefix = process.env.FILE_URL_PREFIX || '/files';
  const uploadsDir = path.isAbsolute(storagePath)
    ? storagePath
    : path.join(process.cwd(), storagePath);
  const shouldServeLocalFiles = fileStorageType === 'local' || fs.existsSync(uploadsDir);
  if (shouldServeLocalFiles) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    await app.register(fastifyStatic, {
      root: uploadsDir,
      prefix: `${urlPrefix}/`,
      decorateReply: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 天
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // 即使历史目录中残留 HTML/SVG，也禁止其在同源上下文执行脚本。
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    });
    logger.log(`本地静态文件服务: ${urlPrefix} → ${uploadsDir}`);
  } else {
    logger.log(`云文件存储已启用: ${fileStorageType}`);
  }

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // Enable CORS（支持多源配置，逗号分隔）
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (
        err: Error | null,
        allow: string | boolean | RegExp | Array<string | boolean | RegExp>,
      ) => void,
    ) => {
      // 允许无 origin 的请求（如服务端调用、Postman）
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} 不在允许列表中`), false);
      }
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger setup（通过 SWAGGER_ENABLED=true 启用，不受 NODE_ENV 限制）
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('NodeJs 全栈模板 API')
      .setDescription('基于 NestJS + Fastify + Prisma 的 API 文档')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // 优雅关闭
  app.enableShutdownHooks();

  const port = process.env.PORT || 3100;
  await app.listen(port, '0.0.0.0');

  const protocol = hasHttps ? 'https' : 'http';
  logger.log(`应用运行在: ${protocol}://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger 文档: ${protocol}://localhost:${port}/api/docs`);
  }
}

bootstrap();
