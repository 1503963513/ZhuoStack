# 后端 CRUD 模块开发

本项目使用 NestJS 10 + Fastify 适配器 + Prisma ORM。所有后端模块遵循统一的开发模式。

## 模块目录结构

每个新模块位于 `apps/api/src/modules/<模块名>/`，结构如下：

```
modules/<name>/
├── <name>.module.ts        # NestJS 模块定义
├── <name>.controller.ts    # 路由处理器 + Swagger 装饰器
├── <name>.service.ts       # 业务逻辑
├── dto/
│   ├── create-<name>.dto.ts   # 创建 DTO（数据验证）
│   ├── update-<name>.dto.ts   # 更新 DTO（PartialType）
│   ├── query-<name>.dto.ts    # 分页/搜索查询 DTO
│   └── index.ts               # 桶导出
└── entities/
    └── <name>.entity.ts       # Swagger 实体类（用于 API 文档）
```

## Service 开发模式

所有 Service 通过依赖注入使用 `PrismaService`，遵循以下规范：

```typescript
// 1. @Injectable() 装饰器
// 2. 构造函数注入 PrismaService，声明为 readonly
// 3. 每个公开方法都有 JSDoc 注释
// 4. 使用 select 排除 password 等敏感字段
// 5. 抛出 NestJS 内置异常（NotFoundException、ConflictException 等）
// 6. 返回普通对象（TransformInterceptor 会自动包装）

@Injectable()
export class ExampleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExampleDto) {
    // 创建前检查唯一性约束
    // 返回时使用 select 控制字段暴露
  }

  async findAll(query: QueryExampleDto) {
    // 分页参数：page（默认 1）、pageSize（默认 10）
    // 使用 Promise.all 并行执行 count + findMany
    // 返回格式：{ data, pagination: { total, page, pageSize, totalPages } }
  }

  async findOne(id: string) {
    // 查找资源，不存在则抛出 NotFoundException
  }

  async update(id: string, dto: UpdateExampleDto) {
    // 先调用 findOne 确认资源存在
    // 若修改唯一字段，需检查唯一性约束
  }

  async remove(id: string) {
    // 先调用 findOne 确认资源存在
    // 返回 { message: '删除成功' }
  }
}
```

## Controller 开发模式

```typescript
// 1. @ApiTags('<标签>') 用于 Swagger 分组
// 2. @ApiBearerAuth() 标记需要认证的路由
// 3. @UseGuards(JwtAuthGuard, RolesGuard) 保护路由
// 4. @Roles(Role.ADMIN) 限制仅管理员访问
// 5. 每个端点都加 @ApiOperation + @ApiResponse
// 6. Controller 直接返回 Service 结果（Interceptor 负责包装）
```

## 模块注册

创建模块后，在 `apps/api/src/app.module.ts` 中注册：

```typescript
imports: [
  // ... 已有模块
  NewModule,
],
```

## 核心规则

- **永远不要返回 `password` 字段** — 始终使用 Prisma `select` 排除
- **禁止使用 `any`** — ESLint 强制 TypeScript 严格模式
- **注释使用中文** — 所有 JSDoc 和行内注释
- **使用 `readonly`** — 构造函数注入的依赖必须声明为只读
- **DTO 桶导出** — 始终创建 `dto/index.ts` 统一导出所有 DTO
- **Entity 类** — 创建带 `@ApiProperty` 装饰器的 Swagger 实体类
- 分页统一使用 `{ page, pageSize, totalPages, total }` 格式
- 可使用 `database/prisma.repository.ts` 中的 `BaseRepository<T>` 作为通用 CRUD 基类
