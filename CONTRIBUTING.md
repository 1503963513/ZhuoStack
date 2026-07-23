# 贡献指南

感谢你关注 ZhuoStack。欢迎提交问题、文档改进、测试补充和代码变更；提交前请先阅读本文件、[安全策略](SECURITY.md) 和 [Apache License 2.0](LICENSE)。

## 开发环境

- Node.js 24 LTS
- pnpm 10（仓库通过 `packageManager` 固定版本）
- Docker（运行本地 PostgreSQL/MySQL、Redis 或数据库迁移验证时需要）

首次运行：

```bash
pnpm install
cp apps/api/.env.example apps/api/.env.development
cp apps/web/.env.example apps/web/.env.local
```

请不要提交 `.env.*`、访问密钥、数据库连接串、生成的 Prisma Client、`dist/`、`.next/`、`out/` 或部署包。

## 开始工作

1. 先搜索现有 Issue 和 Pull Request，避免重复工作。
2. 对行为变更先创建 Issue，说明问题、目标和兼容性影响；小型修复可以直接提交 PR。
3. 从 `main` 创建分支，推荐使用 `feat/`、`fix/`、`docs/`、`chore/`、`test/` 或 `refactor/` 前缀，例如 `fix/prisma-generate-env`。
4. 保持一个分支只解决一个主题，避免把格式化、无关重构和功能修改混在一起。

## 提交约定

提交消息遵循 Conventional Commits：

```text
<type>(<scope>): <简短描述>
```

常用类型：`feat`、`fix`、`docs`、`test`、`refactor`、`chore`、`ci`、`build`、`security`。

示例：

```text
fix(api): load DATABASE_URL before Prisma generate
docs: add release and security policy
```

本地提交钩子会运行 lint-staged。提交前不要绕过钩子；如果钩子发现问题，请修复后再提交。

## 本地验证

代码提交前至少运行：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

涉及生产依赖时，额外运行：

```bash
pnpm audit:prod
```

CI 还会验证 PostgreSQL/MySQL 两套迁移链、Gitleaks 密钥扫描和 Docker 镜像扫描。不要只验证当前本地使用的数据库。

## Prisma 与数据库变更

PostgreSQL 和 MySQL 的 Schema、迁移目录必须同步维护：

- 同一业务变更必须分别修改 `apps/api/prisma/postgres/` 和 `apps/api/prisma/mysql/`。
- 分别运行 `pnpm db:migrate:pg` 与 `pnpm db:migrate:mysql`，审核生成的两份 SQL。
- 不要提交 `apps/api/prisma/schema.active/` 或 `apps/api/prisma/migrations` 临时链接。
- 已发布的迁移文件不得修改；需要修正时创建新的前向迁移。
- 破坏性变更必须说明备份、回滚和多版本兼容方案。

详细规则见 [Prisma 双数据库与迁移规范](apps/api/prisma/README.md)。

## Pull Request 要求

Pull Request 描述应包含：

- 变更背景、解决方案和影响范围；
- 关联 Issue（如有）；
- 验证命令及结果；
- UI 变更的截图或录屏；
- 数据库变更、环境变量变更和部署注意事项；
- 是否存在兼容性、性能或安全风险。

维护者会重点检查：测试是否覆盖新行为、API 合约是否稳定、双数据库迁移是否完整、是否引入秘密或不必要的依赖，以及文档是否同步。所有必需 CI 检查通过并获得代码所有者批准后，才会合并到 `main`。

## 许可与贡献者权益

提交到本仓库并明确用于合并的贡献，按照 [LICENSE](LICENSE) 中 Apache License 2.0 第 5 节处理。若你的贡献包含第三方代码，请在 PR 中说明来源和许可证，并确认其许可证允许与本项目一起分发。

安全漏洞不要通过公开 Issue 或 Pull Request 披露，请按照 [SECURITY.md](SECURITY.md) 的流程报告。
