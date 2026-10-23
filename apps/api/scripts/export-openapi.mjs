import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportOpenApi() {
  process.env.NODE_ENV = 'development';
  process.env.REDIS_REQUIRED = 'false';

  // 引入已经通过 nest build 产出的 dist/src/app.module.js
  const appModulePath = path.resolve(__dirname, '../dist/src/app.module.js');
  if (!fs.existsSync(appModulePath)) {
    throw new Error(
      `未找到编译产物: ${appModulePath}，请先执行 pnpm --filter api build`,
    );
  }

  const { AppModule } = await import(appModulePath);

  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });

  const config = new DocumentBuilder()
    .setTitle('ZhuoStack API')
    .setDescription('ZhuoStack 基于 NestJS + Fastify + Prisma 的 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const targetDir = path.resolve(__dirname, '../../web');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const outputPath = path.resolve(targetDir, 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`[OpenAPI] 成功导出规范至: ${outputPath}`);

  await app.close();
  process.exit(0);
}

exportOpenApi().catch((err) => {
  console.error('[OpenAPI] 导出失败:', err);
  process.exit(1);
});
