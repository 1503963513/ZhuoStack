-- DropForeignKey
ALTER TABLE `sys_user` DROP FOREIGN KEY `users_deptId_fkey`;

-- AddForeignKey
ALTER TABLE `sys_user` ADD CONSTRAINT `sys_user_deptId_fkey` FOREIGN KEY (`deptId`) REFERENCES `sys_dept`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `sys_user` RENAME INDEX `users_createdAt_idx` TO `sys_user_createdAt_idx`;

-- RenameIndex
ALTER TABLE `sys_user` RENAME INDEX `users_deptId_idx` TO `sys_user_deptId_idx`;

-- RenameIndex
ALTER TABLE `sys_user` RENAME INDEX `users_email_key` TO `sys_user_email_key`;

-- RenameIndex
ALTER TABLE `sys_user` RENAME INDEX `users_role_idx` TO `sys_user_role_idx`;
