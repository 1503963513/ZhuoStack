# 发布流程

本文定义 ZhuoStack 的版本、GitHub Release、部署包和生产发布流程。项目是应用模板而不是 npm 可发布库，发布版本由 Git tag 和 GitHub Release 管理，`apps/*` 的 `version` 字段不单独驱动生产发布。

## 发布物

每个稳定版本使用 `vMAJOR.MINOR.PATCH` tag，例如 `v1.1.0`。Tag 发布工作流会重新安装锁定依赖、生成 Prisma Client、运行完整质量门禁、构建生产产物并上传：

- GitHub Release 自动生成的源码归档；
- PostgreSQL PM2 在线部署包；
- MySQL PM2 在线部署包；
- `SHA256SUMS` 校验文件。

Docker 镜像默认在目标环境根据 `DB_TYPE` 构建；这保证 Prisma Client 与目标数据库匹配。若未来接入镜像仓库，必须为 PostgreSQL 和 MySQL 分别发布并标记镜像，不能用一个数据库类型生成的 Client 伪装成通用镜像。

## 版本规则

- `MAJOR`：不兼容的 API、配置、部署或数据库升级。
- `MINOR`：向后兼容的新功能、模块或部署能力。
- `PATCH`：向后兼容的错误修复、安全修复、文档或依赖修复。
- 预发布版本使用 `vX.Y.Z-rc.1` 等后缀，不能直接作为稳定生产版本。
- 每个版本必须在 [CHANGELOG.md](../CHANGELOG.md) 中有条目；安全修复还要同步 Security Advisory。

## 发布前检查

发布负责人确认：

- 变更已经合并到 `main`，工作区干净；
- `CHANGELOG.md` 的 `Unreleased` 已整理到目标版本；
- API/Web/共享包版本和文档没有遗留旧版本信息；
- 数据库变更已分别审核 PostgreSQL/MySQL 迁移 SQL，并写明扩展、迁移、回滚顺序；
- 没有密钥、真实数据、`.env.production` 或未跟踪构建产物；
- CI 的 quality、migrations、secrets、images 全部通过；
- 已准备数据库备份、健康检查和上一个可回滚部署包。

本地建议先执行：

```bash
pnpm install --frozen-lockfile
pnpm test:ci
pnpm build
pnpm audit:prod
git diff --check
git status --short
```

## 创建发布

在最新 `main` 上执行：

```bash
git pull --ff-only github main
git tag -a v1.1.0 -m "release: v1.1.0"
git push github v1.1.0
```

推送 `v*.*.*` tag 后，`.github/workflows/release.yml` 会运行发布门禁并创建 GitHub Release。发布完成后：

1. 在 GitHub Release 页面确认变更说明和两个数据库部署包；
2. 下载包并用 `sha256sum -c SHA256SUMS` 校验；
3. 在一次性或预生产环境安装，执行 `/health`、登录、迁移和关键业务检查；
4. 再按 [部署指南](deployment.md) 更新生产环境；
5. 在 Issue/公告中记录上线时间、版本、数据库类型和回滚点。

不要复用已发布 tag。发现问题时创建新的 patch 版本，例如 `v1.1.1`。

## 数据库发布顺序

生产发布遵循“向后兼容迁移优先”：

1. 备份并验证恢复；
2. 先发布兼容旧结构的新迁移；
3. 再发布使用新结构的应用；
4. 完成回填和指标观察后，单独发布收缩/删除旧结构的迁移。

不要在发布过程中运行 `prisma db push`，不要修改已经在共享环境执行过的迁移文件。两套数据库必须分别执行迁移验证。

## 回滚与安全发布

- 应用问题优先回滚到上一个部署包，数据库只做前向修复；
- 只有在备份副本验证过的情况下才执行人工回退 SQL；
- 安全漏洞按照 [SECURITY.md](../SECURITY.md) 私下协调，修复完成后再发布公告；
- 撤回或标记有问题的 Release，并在 Changelog 中记录影响范围和替代版本；
- 发布凭据、生产环境文件和数据库备份不得进入 Release 附件。

## 权限与审计

- Release tag、工作流和生产配置只由维护者操作；
- `.github/`、`docker/`、`scripts/`、Prisma 迁移和安全文件由 [CODEOWNERS](../.github/CODEOWNERS) 强制审核；
- GitHub Actions 使用最小权限，发布工作流只在 tag 上运行；
- 发布后保留 CI 运行记录、Release、校验和以及部署记录，便于审计和回滚。
