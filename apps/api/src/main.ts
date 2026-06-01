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

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('MyApp API')
    .setDescription('The MyApp API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3100;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
