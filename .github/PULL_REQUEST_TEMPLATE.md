## 变更说明

<!-- 说明背景、方案和影响范围。关联 Issue 请使用 Closes #123。 -->

## 验证

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm test:e2e`
- [ ] `pnpm build`
- [ ] `pnpm audit:prod`（涉及生产依赖时）

## 发布与兼容性

- [ ] 不涉及数据库变更
- [ ] 若涉及数据库变更，已同步 PostgreSQL/MySQL Schema 和迁移，并说明部署顺序、备份与回滚方案
- [ ] 已同步环境变量、部署文档或 API 文档
- [ ] 未提交密钥、个人数据、构建产物或 `schema.active`
- [ ] UI 变更已附截图或录屏

## 备注

<!-- 已知限制、风险、后续工作或需要审阅者重点关注的内容。 -->
