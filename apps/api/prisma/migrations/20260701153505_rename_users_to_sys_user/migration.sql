-- 用户表重命名：users → sys_user（与其他系统表 sys_menu/sys_role/sys_dept 等命名统一）
-- 注意：Prisma migrate 自动生成时误判为 DROP+CREATE（会丢数据），故手动编写 RENAME TABLE。
-- MySQL 的 RENAME TABLE 会自动更新所有引用该表的外键约束（如 sys_login_log.userId、多对多关联表），数据完整保留。
-- RenameTable
RENAME TABLE `users` TO `sys_user`;
