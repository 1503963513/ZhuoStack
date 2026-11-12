# 新增业务模块示例

本指南用现有“部门管理”模块说明新增业务功能时需要串联的项目约定。它是参考实现，不是代码生成器；具体字段和页面应按业务调整。

## 1. 先看现有模块

部门模块的后端位于 `apps/api/src/modules/system/dept/`，包含 module、controller、service 和 `dto/`；前端页面位于 `apps/web/src/app/(dashboard)/system/dept/`。先阅读同目录的模块代码、DTO 和页面，沿用已有的认证、异常、表格、表单和权限模式。

建议按以下顺序开发：数据结构 → DTO/Service/Controller → 模块注册与权限菜单 → OpenAPI 客户端 → 前端页面和文案 → 验证。

## 2. 增加数据模型（如需要）

PostgreSQL 和 MySQL 的模型必须分别维护：

```text
apps/api/prisma/postgres/models/<model>.prisma
apps/api/prisma/mysql/models/<model>.prisma
```

遵循仓库现有命名、时间戳、`@@map`、关系和索引约定。MySQL 字段长度与唯一索引长度需和迁移 SQL 一致。修改后依次执行：

```bash
pnpm db:migrate --pg
pnpm db:migrate --mysql
pnpm db:schema:check
```

每套迁移生成后都要检查并提交对应的 `migrations.postgres/` 和 `migrations.mysql/` 文件。然后根据当前开发环境生成 Prisma Client：

```bash
pnpm db:generate
```

双数据库细节、空库验证和生产迁移规则见[Prisma 双数据库与迁移规范](../apps/api/prisma/README.md)。

## 3. 实现 NestJS 模块

参照 `apps/api/src/modules/system/dept/` 创建功能目录，通常包含：

```text
<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
└── dto/
    ├── create-<feature>.dto.ts
    ├── update-<feature>.dto.ts
    └── <feature>-response.dto.ts
```

DTO 使用 `class-validator` 校验并添加 Swagger 属性。Controller 负责路由、权限和响应文档；业务与 Prisma 操作放在 Service。接口响应使用项目的 `@ApiResultResponse`、`@ApiPaginatedResultResponse` 等装饰器，不要用未声明结构的裸响应。

在所属模块（例如 `SystemModule`）中注册新模块；不要把每个管理功能都直接塞进 `AppModule`。如果模块需要调用另一个模块的 Service，由提供方导出 Provider，并在 imports 中显式导入其 Module。

权限要同时落实在后端路由和菜单数据：Controller/路由使用 `@Permissions(...)`，菜单树中配置对应菜单与按钮 `perms`。菜单只控制导航展示，不能替代后端权限校验。初始开发数据按需维护 `apps/api/prisma/seed.ts`；线上授权通过菜单与角色管理完成，不运行 seed。

## 4. 同步 API 契约

新增或修改 Controller、DTO、路由后运行：

```bash
pnpm contract:sync
```

该命令从 NestJS Swagger/OpenAPI 生成 Web 客户端。页面只能调用生成的 `apps/web/src/api/generated/` 客户端，不手写请求 URL、请求函数或生成目录内容。提交前检查 OpenAPI 和生成文件的差异与 API 类型。

## 5. 增加前端页面

参照 `apps/web/src/app/(dashboard)/system/dept/` 创建路由页面，并使用已有的共享组件、表单和 TanStack Query 模式。菜单 `path`、`component` 与页面目录要对应；菜单名由数据库菜单数据提供，页面标签标题按当前 i18n 约定解析。

中英文文案分别维护在 `apps/web/src/locales/zh-CN/` 和 `apps/web/src/locales/en-US/`。如果增加菜单路由，更新两种语言中的菜单路径映射；如果扩充通用文案，保持两种语言的键结构一致。

## 6. 缓存、日志与事件

只有在有明确收益时才给查询增加 Redis 缓存。新增缓存键时，清晰定义失效时机，并按用途登记到 `apps/api/src/modules/monitor/monitor.service.ts` 的允许或保护前缀列表。写操作应清理相关缓存。

用户可见的站内通知可以复用 `NotificationService` 或 `notification.send` 事件。事件监听器是进程内处理，不是可靠消息队列；有持久化重试要求的外部副作用需要单独设计任务记录和恢复机制。

## 7. 验收清单

```bash
pnpm db:schema:check
pnpm contract:sync
pnpm typecheck
pnpm lint
```

同时确认：

- PostgreSQL 与 MySQL 两份模型和迁移都已提交（如有数据库变更）。
- 菜单、按钮权限和角色授权链路完整。
- 前端只使用生成的 API 客户端，新增文案中英文齐全。
- 缓存可在写入后正确失效，日志没有记录密码、令牌等凭据。
- 数据库迁移在空库可部署；生产升级遵循备份与前向修复原则。
