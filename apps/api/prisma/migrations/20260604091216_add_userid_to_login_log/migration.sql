-- AlterTable
ALTER TABLE `sys_login_log` ADD COLUMN `userId` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `sys_dict_data_status_idx` ON `sys_dict_data`(`status`);

-- CreateIndex
CREATE INDEX `sys_menu_status_idx` ON `sys_menu`(`status`);

-- RenameIndex
ALTER TABLE `sys_dept` RENAME INDEX `sys_dept_parentId_fkey` TO `sys_dept_parentId_idx`;

-- RenameIndex
ALTER TABLE `sys_dict_data` RENAME INDEX `sys_dict_data_dictId_fkey` TO `sys_dict_data_dictId_idx`;

-- RenameIndex
ALTER TABLE `sys_menu` RENAME INDEX `sys_menu_parentId_fkey` TO `sys_menu_parentId_idx`;
