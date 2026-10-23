# 开发铁律与核心规范

本文档为开发常驻铁律（Invariants）。涉及具体模板和完整开发步骤请按需使用对应 Skill（如 `/crud-module`）。

---

## 1. 契约与 API 规范（OpenAPI 为唯一事实来源）

- **禁止手写 API 请求**：前端业务页面严禁使用手写的 `useApiQuery`、`useApiMutation`、手写 URL 字符串或泛型断言；必须从 `@/api/generated` 导入由 Orval 生成的强类型客户端与 Hooks。
- **后端必须显式包装响应**：Controller 接口严禁使用无 `type` 的裸 `@ApiResponse`。
  - 单项结果：`@ApiResultResponse(ModelDto)`
  - 分页结果：`@ApiPaginatedResultResponse(ModelDto)`，运行时结构严格为 `{ code: 200, data: { data: T[], pagination: { total, page, pageSize, totalPages } }, message: 'success' }`
  - 操作类响应：`@ApiResultResponse(SimpleMessageResponseDto)`
- **可空字段必标基础类型**：DTO 中带有 `| null` 的联合类型字段，必须在 `@ApiPropertyOptional({ type: String, nullable: true })` 中指定具体基本类型，避免 Swagger 反射将其误识别为通用 Object。
- **接口修改必须同步**：后端修改任何 DTO、Controller 或路由后，必须立即执行 `pnpm contract:sync` 刷新前端客户端并确保 `git diff --exit-code apps/web/openapi.json apps/web/src/api/generated/` 为 0 漂移。

---

## 2. 认证与安全规范

- **凭证存储**：认证凭据由 HttpOnly Cookie (`access_token`) 由浏览器自动管理。**严禁在前端 localStorage、sessionStorage 中存放 JWT Token**。前端持久化 Store 只存放非敏感的用户展示信息。
- **双提交 CSRF 防护**：登录成功时下发前端可读的 `csrf_token` Cookie；所有非幂等操作（POST/PUT/DELETE/PATCH）在以 Cookie 认证时，必须在请求头中携带匹配的 `x-csrf-token`。
- **活跃会话校验**：后端 `JwtStrategy` 每次验证必须结合 Redis 检查 `token:active:${user.id}` 是否与 Token 的 `jti` 匹配，实现单设备登录与即时失效。
- **密码安全**：前端在提交密码前必须调用公钥经 RSA-OAEP (SHA-256) 加密；后端解密后经 `bcryptjs`（10 rounds）哈希存储。每个查询必须用 Prisma `select` 排除 `password`。

---

## 3. 数据库与 Prisma 规范

- **必须同时维护双库**：新增或修改模型时，必须同时维护 `apps/api/prisma/postgres/models/` 与 `apps/api/prisma/mysql/models/` 两套 Schema（MySQL 需带 `@db.VarChar(length)` 或 `@db.Text`）。
- **严禁直接编辑 `schema.active/`**：该目录为生成目录，由 `db:use:pg` 或 `db:use:mysql` 自动生成。
- **模型设计**：统一使用 `String @id @default(cuid())`；表名始终使用 `@@map("复数_下划线")`；时间戳包含 `createdAt` 和 `updatedAt`。

---

## 4. Redis 缓存键管理

- **新增 Key 必须登记**：在 `apps/api/src/modules/monitor/monitor.service.ts` 中，纯缓存必须加入 `ALLOWED_KEY_PREFIXES`（支持一键清空），安全/状态键必须加入 `PROTECTED_KEY_PREFIXES`（禁止清空）。

---

## 5. 编码风格与质量底线

- **TypeScript 严格模式**：全仓禁止使用 `any`，类型必须完整推导。
- **注释与文档**：注释必须使用中文，严禁无意义的废话注释。
- **无残留代码**：重构时彻底删除废弃代码与无用导入，不留无用注释代码。
