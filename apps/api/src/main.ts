import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  // HTTPS 配置（仅生产环境）
  const hasHttps =
    process.env.NODE_ENV === 'production' &&
    process.env.SSL_CERT_PATH &&
    process.env.SSL_KEY_PATH;

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

  // Global prefix
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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

  // Swagger setup (仅开发环境)
  if (process.env.NODE_ENV !== 'production') {
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
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger 文档: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
