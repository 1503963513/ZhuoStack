---
name: backend-module
description: 新建 NestJS 后端 CRUD 模块（controller/service/dto/entities）时使用。涵盖目录结构、Service 开发模式（Prisma+分页+异常）、Controller 装饰器、模块注册规范。
---

# 后端 CRUD 模块开发

本项目使用 NestJS 11 + Fastify 适配器 + Prisma ORM。所有后端模块遵循统一的开发模式，并通过 OpenAPI 为前端提供强类型契约。

## 模块目录结构

每个新模块位于 `apps/api/src/modules/<模块名>/`，结构如下：

```
modules/<name>/
├── <name>.module.ts        # NestJS 模块定义
├── <name>.controller.ts    # 路由处理器 + Swagger 包装装饰器
├── <name>.service.ts       # 业务逻辑
└── dto/
    ├── create-<name>.dto.ts   # 创建 DTO（数据验证）
    ├── update-<name>.dto.ts   # 更新 DTO（PartialType）
    ├── query-<name>.dto.ts    # 分页/搜索查询 DTO
    ├── <name>-response.dto.ts # Swagger 响应实体 DTO
    └── index.ts               # 统一桶导出
```

## Service 开发模式

所有 Service 通过依赖注入使用 `PrismaService`，遵循以下规范：

```typescript
@Injectable()
export class ExampleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExampleDto) {
    // 创建前检查唯一性约束，冲突抛出 ConflictException
    return this.prisma.example.create({ data: dto });
  }

  async findAll(query: QueryExampleDto) {
    // 分页参数：page（默认 1）、pageSize（默认 10）
    // 使用 Promise.all 并行执行 count + findMany
    // 返回格式严格为：{ data, pagination: { total, page, pageSize, totalPages } }
  }

  async findOne(id: string) {
    // 查找资源，不存在则抛出 NotFoundException
  }

  async update(id: string, dto: UpdateExampleDto) {
    // 先调用 findOne 确认资源存在
  }

  async remove(id: string) {
    // 先调用 findOne 确认资源存在
    // 返回 { message: '删除成功' }
  }
}
```

## Controller 开发模式与响应包装

为了确保 OpenAPI 能生成准确反映全局拦截器包装（`{ code, data, message }`）的客户端代码，必须使用通用响应包装装饰器：

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators';
import {
  ApiResultResponse,
  ApiPaginatedResultResponse,
  ApiErrorResponse,
} from '../../common/decorators/api-result.decorator';
import { SimpleMessageResponseDto } from '../user/dto/user-response.dto';
import { Role } from '@prisma/client';

@ApiTags('示例管理')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('example')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建示例' })
  @ApiResultResponse(ExampleItemDto, { status: HttpStatus.CREATED, description: '创建成功' })
  @ApiErrorResponse(HttpStatus.CONFLICT, '已存在冲突记录')
  create(@Body() dto: CreateExampleDto) {
    return this.exampleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取分页列表' })
  @ApiPaginatedResultResponse(ExampleItemDto, { description: '获取成功' })
  findAll(@Query() query: QueryExampleDto) {
    return this.exampleService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取详情' })
  @ApiParam({ name: 'id', description: 'ID' })
  @ApiResultResponse(ExampleItemDto, { description: '获取成功' })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, '记录不存在')
  findOne(@Param('id') id: string) {
    return this.exampleService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新示例' })
  @ApiParam({ name: 'id', description: 'ID' })
  @ApiResultResponse(ExampleItemDto, { description: '更新成功' })
  update(@Param('id') id: string, @Body() dto: UpdateExampleDto) {
    return this.exampleService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除示例' })
  @ApiParam({ name: 'id', description: 'ID' })
  @ApiResultResponse(SimpleMessageResponseDto, { description: '删除成功' })
  remove(@Param('id') id: string) {
    return this.exampleService.remove(id);
  }
}
```

## 核心规则

- **响应包装**：必须使用 `@ApiResultResponse` 与 `@ApiPaginatedResultResponse`，严禁只写没有 `type` 的 `@ApiResponse({ status: 200 })`。
- **可空字段 Swagger 注解**：对带有 `| null` 的字段，在 `@ApiPropertyOptional({ type: String, nullable: true })` 中显式指定基本类型。
- **契约同步**：编写或修改后端 Controller/DTO 后，立即执行 `pnpm contract:sync` 刷新前端。
