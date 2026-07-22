import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

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

  // 检查敏感环境变量不为空
  if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV === 'production') {
    logger.warn('OPENAI_API_KEY 未设置，AI 功能将不可用');
  }

  // HTTPS 配置（仅生产环境）
  const hasHttps =
    process.env.NODE_ENV === 'production' && process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH;

  const httpsOptions = hasHttps
    ? {
        https: {
          cert: fs.readFileSync(process.env.SSL_CERT_PATH!),
          key: fs.readFileSync(process.env.SSL_KEY_PATH!),
        },
      }
    : undefined;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    httpsOptions ? new FastifyAdapter(httpsOptions) : new FastifyAdapter(),
    { bufferLogs: true },
  );

  // Use NestJS built-in logger
  app.useLogger(app.get(Logger));

  // 安全响应头（X-Content-Type-Options, Strict-Transport-Security 等）
  await app.register(helmet, {
    contentSecurityPolicy: false,
    frameguard: false, // 允许前端 iframe 嵌入 Swagger 文档页
    crossOriginResourcePolicy: false, // 允许跨源访问静态文件（/files/*）
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
      const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // 允许无 origin 的请求（如服务端调用、Postman）
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
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
  if (process.env.SWAGGER_ENABLED === 'true') {
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

  logger.log(`应用运行在: http://localhost:${port}`);
  if (process.env.SWAGGER_ENABLED === 'true') {
    logger.log(`Swagger 文档: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
