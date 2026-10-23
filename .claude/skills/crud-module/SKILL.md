---
name: crud-module
description: 新增全栈业务 CRUD 模块时的标准研发工作流。涵盖字段梳理、Prisma 双库模型、后端 DTO/Service/Controller（含 OpenAPI 响应包装）、契约生成、前端强类型管理页面（PageHeader+DataTable+Pagination）与权限菜单 Seed 注册全流程。
---

# 全栈 CRUD 模块开发工作流

在 ZhuoStack 中新增业务 CRUD 模块时，必须遵循以下标准工作流，避免死板套用模板生成不符合业务逻辑的代码。

---

## 步骤 1：业务需求与规则梳理（先确认，不擅自假设）

在编写代码前，必须先理清以下关键业务规则。如果用户指令中存在不明确项，**必须先与用户确认，禁止擅自做出不合理的业务假设**：

1. **字段清单与类型**：字段名称、类型（文本、数字、枚举状态、日期、富文本）、是否必填。
2. **唯一性约束**：是否有业务唯一性字段（如编码 code、邮箱 email、同级下名称唯一等）。
3. **关联关系**：是否关联其他实体（如所属部门 `deptId`、关联角色 `roleIds`、多对多还是多对一）。
4. **删除策略**：是物理删除（`delete`）还是逻辑软删除（`status: 'DELETED'`），删除前是否需要校验子项或关联依赖（如部门下存在子部门禁止删除）。
5. **查询与过滤条件**：哪些字段支持模糊搜索、哪些字段支持精确过滤（如状态下拉筛选）。
6. **权限与操作级别**：哪些操作需要管理员角色（`Role.ADMIN`），操作按钮对应的权限标识符命名规则（如 `<module>:add`, `<module>:edit`, `<module>:delete`）。

---

## 步骤 2：参考现有相邻模块实现

在编写新模块前，查阅仓库中成熟的相邻模块作为直接参考：

- **扁平列表型 CRUD**：参考 `apps/api/src/modules/system/post/` 与 `apps/web/src/app/(dashboard)/system/post/page.tsx`。
- **关联关系型 CRUD**：参考 `apps/api/src/modules/user/` 与 `apps/web/src/app/(dashboard)/system/user/page.tsx`。
- **树形层级型 CRUD**：参考 `apps/api/src/modules/system/dept/` 与 `apps/web/src/app/(dashboard)/system/dept/page.tsx`。

---

## 步骤 3：数据模型与后端实现

### 1. Prisma 模型定义（必须同时维护双库）

分别在以下两个目录添加模型文件：

- `apps/api/prisma/postgres/models/<name>.prisma`
- `apps/api/prisma/mysql/models/<name>.prisma`（MySQL 版本必须为 String 字段添加 `@db.VarChar(length)` 或 `@db.Text`）

**命名规范**：

- 模型名称：PascalCase（如 `Post`、`Article`）
- 表映射：始终包含 `@@map("复数_下划线")`（如 `@@map("articles")`）
- 主键：统一使用 `id String @id @default(cuid())`
- 时间戳：包含 `createdAt DateTime @default(now())` 和 `updatedAt DateTime @updatedAt`

### 2. 后端 DTO 开发（`apps/api/src/modules/<name>/dto/`）

- `create-<name>.dto.ts`：使用 `class-validator` 装饰器严格校验必填项与数据类型。
- `update-<name>.dto.ts`：继承 `@nestjs/swagger` 的 `PartialType(Create<Name>Dto)`。
- `query-<name>.dto.ts`：分页查询参数（`page`, `pageSize`, `search` 等），数字参数必须加 `@Type(() => Number)`。
- `<name>-response.dto.ts`：定义用于 OpenAPI Swagger 文档的返回模型（如 `<Name>ItemDto`），**带有 `| null` 的字段必须显式声明 `type: String` 等基础类型，避免 union 被误解析为 object**。
- `index.ts`：统一桶导出所有 DTO。

### 3. Service 开发（`apps/api/src/modules/<name>/<name>.service.ts`）

- 注入 `PrismaService`，公开方法添加中文 JSDoc。
- 创建前检查唯一性冲突，冲突时抛出 `ConflictException`。
- 分页查询使用 `Promise.all` 并行执行 `findMany` 与 `count`，返回结构必须为：
  ```typescript
  return {
    data,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  };
  ```
- 查找单项不存在时抛出 `NotFoundException`。
- 删除前确认资源存在，返回 `{ message: '删除成功' }`。

### 4. Controller 开发（`apps/api/src/modules/<name>/<name>.controller.ts`）

- 统一使用 `@ApiTags('<中文名>管理')` 和 `@ApiBearerAuth()`。
- 关键安全端点加 `@Roles(Role.ADMIN)` 和 `@UseGuards(RolesGuard)`。
- **必须使用统一定义的响应包装装饰器，真实反映运行时结构**：
  - 单项接口（GET/PUT/POST）：`@ApiResultResponse(<Name>ItemDto)`
  - 分页列表接口（GET）：`@ApiPaginatedResultResponse(<Name>ItemDto)`
  - 删除操作：`@ApiResultResponse(SimpleMessageResponseDto)`
- 注册模块至 `apps/api/src/app.module.ts`。

---

## 步骤 4：生成端到端强类型契约

后端模块编写完成后，**必须立即运行契约同步命令**：

```bash
pnpm contract:sync
```

该命令会自动：

1. 编译后端并导出最新的离线 OpenAPI 规范至 `apps/web/openapi.json`。
2. 调用 Orval 从 OpenAPI 规范自动生成前端 TypeScript 类型与请求函数至 `apps/web/src/api/generated/`。

---

## 步骤 5：前端强类型管理页面开发

在 `apps/web/src/app/(dashboard)/<name>/page.tsx` 编写管理页面：

- **禁止使用手写的 `useApiQuery<T>(url)` 或手写泛型断言**。
- **全面导入由 Orval 生成的请求函数与模型**（位于 `@/api/generated/endpoints/...` 和 `@/api/generated/models`）。
- 页面标准组件骨架：
  - 顶部导航：使用 `PageHeader`（标题 + 说明 + 动作按钮）。
  - 数据呈现：使用 `DataTable`（配置 `columns: Column<T>[]` 与 `actions` 操作列）。
  - 列表分页：使用 `Pagination`。
  - 操作按钮：使用 `PermissionButton` 结合权限标识（如 `<module>:add`, `<module>:edit`, `<module>:delete`）。
  - 确认对话框：使用 `useConfirm`（`const { confirm, ConfirmDialog } = useConfirm()`）。
  - 增改弹窗：使用 `Dialog` + shadcn/ui 表单组件。

---

## 步骤 6：权限与菜单 Seed 注册

在 `apps/api/prisma/seed.ts` 中注册菜单与操作权限：

```typescript
// 1. 创建二级菜单
const menu<Name> = await prisma.sysMenu.create({
  data: {
    name: '<中文名>管理',
    parentId: menuSystem.id, // 或指定顶级目录
    type: MenuType.MENU,
    path: '/system/<name>', // 前端路由地址
    component: 'system/<name>/page',
    icon: 'FileText',
    sort: 10,
    status: Status.ACTIVE,
  },
});

// 2. 创建三级操作权限按钮
await prisma.sysMenu.createMany({
  data: [
    { name: '<中文名>新增', parentId: menu<Name>.id, type: MenuType.BUTTON, perms: '<module>:add', sort: 1, status: Status.ACTIVE },
    { name: '<中文名>编辑', parentId: menu<Name>.id, type: MenuType.BUTTON, perms: '<module>:edit', sort: 2, status: Status.ACTIVE },
    { name: '<中文名>删除', parentId: menu<Name>.id, type: MenuType.BUTTON, perms: '<module>:delete', sort: 3, status: Status.ACTIVE },
  ],
});
```

---

## 步骤 7：验证闭环（确保 0 报错）

完成开发后，执行以下闭环校验确保代码质量：

```bash
# 1. 契约防漂移验证
git diff --exit-code apps/web/openapi.json apps/web/src/api/generated/

# 2. 全局类型检查与代码规范
pnpm typecheck
pnpm lint
```
