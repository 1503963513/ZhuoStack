# API 规范

统一响应格式、错误处理、数据验证和 Swagger 文档注解规范。

## 响应格式

所有 API 响应由 `TransformInterceptor` 自动包装：

**成功响应：**
```json
{
  "code": 200,
  "data": { ... },
  "message": "success"
}
```

**错误响应：**
```json
{
  "code": 404,
  "data": null,
  "message": "User with ID xxx not found"
}
```

**分页响应：**
```json
{
  "code": 200,
  "data": [ ... ],
  "message": "success",
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

> Controller 直接返回原始数据 — Interceptor 负责包装。不要手动构造 `{ code, data, message }`。

## 路由前缀

所有路由使用 `/api` 前缀（在 `main.ts` 中设置）：

```
POST   /api/auth/register     注册
POST   /api/auth/login        登录
GET    /api/auth/profile      获取当前用户资料
GET    /api/user              用户列表（分页）
POST   /api/user              创建用户
GET    /api/user/:id          用户详情
PUT    /api/user/:id          更新用户
DELETE /api/user/:id          删除用户
POST   /api/ai/chat           AI 对话
GET    /api/ai/chat/stream    AI 流式对话（SSE）
POST   /api/ai/prompt         AI 提示
GET    /health                健康检查（无 /api 前缀）
```

## 错误处理

`HttpExceptionFilter` 全局捕获所有异常：

| 场景 | 异常类 | HTTP 状态码 |
|------|--------|-------------|
| 资源不存在 | `NotFoundException` | 404 |
| 资源重复 | `ConflictException` | 409 |
| 认证失败 | `UnauthorizedException` | 401 |
| 权限不足 | `ForbiddenException` | 403 |
| 数据验证失败 | 自动（ValidationPipe） | 400 |
| 未知错误 | 过滤器捕获 | 500 |

### Service 中的用法：
```typescript
if (!user) throw new NotFoundException(`用户 ${id} 不存在`);
if (existing) throw new ConflictException('邮箱已被注册');
if (!valid) throw new UnauthorizedException('认证信息无效');
```

## 数据验证（DTO 模式）

全局 `ValidationPipe` 配置：
- `whitelist: true` — 剥离未知属性
- `forbidNonWhitelisted: true` — 拒绝包含未知字段的请求
- `transform: true` — 自动类型转换（string → number 等）

### 创建 DTO：
```typescript
export class CreateExampleDto {
  @ApiProperty({ description: '名称', example: '示例' })
  @IsNotEmpty({ message: '名称不能为空' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '可选字段' })
  @IsOptional()
  @IsString()
  description?: string;
}
```

### 更新 DTO：
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateExampleDto } from './create-example.dto';

export class UpdateExampleDto extends PartialType(CreateExampleDto) {}
```

### 查询 DTO（分页）：
```typescript
export class QueryExampleDto {
  @IsOptional()
  @Type(() => Number)    // 隐式类型转换必需
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}
```

### DTO 核心规则：
- 使用 `class-validator` 装饰器：`@IsString`、`@IsEmail`、`@IsNotEmpty`、`@IsOptional`、`@MinLength`、`@Min`、`@IsInt`
- 数字查询参数需加 `@Type(() => Number)`（来自 `class-transformer`）
- 使用 `@ApiProperty` / `@ApiPropertyOptional` 编写 Swagger 文档
- 始终创建 `dto/index.ts` 桶导出文件
- 更新 DTO 使用 `@nestjs/swagger` 的 `PartialType`（不是 `@nestjs/mapped-types`）

## Swagger 文档

开发环境访问 `/api/docs`。注解规范：

```typescript
@ApiTags('resource')          // Swagger UI 分组
@ApiBearerAuth()              // 显示锁图标（需要 JWT）
@UseGuards(JwtAuthGuard, RolesGuard)

@ApiOperation({ summary: '接口描述' })
@ApiResponse({ status: 200, description: '成功' })
@ApiResponse({ status: 404, description: '未找到' })
@ApiParam({ name: 'id', description: '资源 ID' })
```

## CORS

在 `main.ts` 中配置 `cors: true`（开发环境允许所有来源）。生产环境应设置 `CORS_ORIGIN` 环境变量。
