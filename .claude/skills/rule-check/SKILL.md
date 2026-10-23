---
name: rule-check
description: 按项目铁律与核心规范自动化检查代码质量。覆盖契约一致性、OpenAPI 包装规范、前端 API 调用合规性、全仓类型检查、Lint 规范与端到端测试。
---

# 项目规则与代码规范检查工作流

本技能用于在研发迭代完成后，全面核验代码是否符合项目的核心铁律与架构约定。

---

## 检查清单与执行步骤

### 1. 契约合规性静态审查

- **前端 API 调用**：检查业务代码是否残留手写的 `useApiQuery`、`useApiMutation` 或手写泛型断言。业务页面必须直接从 `@/api/generated/endpoints/...` 导入生成的强类型函数。
- **后端 Swagger 包装**：检查所有 Controller 路由方法是否均使用了 `@ApiResultResponse` 或 `@ApiPaginatedResultResponse`。禁止使用未指定具体数据模型的裸 `@ApiResponse({ status: 200 })`。
- **DTO 可空类型标注**：检查 DTO 中带有 `| null` 的联合类型是否在 `@ApiPropertyOptional({ type: String, nullable: true })` 中显式指定了具体类型。

### 2. 数据库与安全审查

- **双库模型对称性**：检查 `apps/api/prisma/postgres/models/` 与 `apps/api/prisma/mysql/models/` 中的模型文件是否保持同步。
- **凭据管理**：确保无任何地方在前端 localStorage/sessionStorage 中存放 JWT Token。

### 3. 全自动化验证流水线

在终端中依次执行以下自动化验证命令，要求全部 100% 通过（0 error, 0 warning）：

```bash
# 步骤 1: 契约同步与零漂移验证
pnpm contract:sync
git diff --exit-code apps/web/openapi.json apps/web/src/api/generated/

# 步骤 2: 全仓 TypeScript 严格模式检查
pnpm typecheck

# 步骤 3: 代码规范检查
pnpm lint

# 步骤 4: 单元测试
pnpm test

# 步骤 5: 真实运行时 E2E 契约测试
pnpm test:e2e

# 步骤 6: 全栈生产打包构建
pnpm build
```

如果某一步骤未通过，立即根据输出报告具体的违规文件与修复建议。
