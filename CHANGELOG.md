# Changelog

本文件记录 ZhuoStack 的重要变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Changed

- 后续变更在合并到 `main` 前补充到本节，并在发布时归档到对应版本。

## [1.0.0] - 2026-07-23

### Added

- NestJS + Fastify API、Next.js Web 和 shared-types pnpm Monorepo。
- PostgreSQL/MySQL 双 Schema、独立迁移历史和迁移漂移验证。
- JWT 认证、RBAC、Redis、文件存储、AI、监控和 Swagger 能力。
- Docker、PM2、在线/离线部署包和 CI 安全门禁。

### Security

- 默认启用认证守卫、限流、安全响应头、密钥扫描和生产依赖审计。
- 安全问题请通过 [SECURITY.md](SECURITY.md) 的私密渠道报告。

[Unreleased]: https://github.com/1503963513/ZhuoStack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/1503963513/ZhuoStack/releases/tag/v1.0.0
