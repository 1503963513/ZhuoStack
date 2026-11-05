-- CreateTable
CREATE TABLE `sys_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `userId` VARCHAR(191) NULL,
    `senderId` VARCHAR(191) NULL,
    `senderName` VARCHAR(255) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `bizType` VARCHAR(64) NULL,
    `bizId` VARCHAR(64) NULL,
    `status` VARCHAR(32) NULL,
    `createdBy` VARCHAR(64) NULL,
    `updatedBy` VARCHAR(64) NULL,
    `remark` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sys_notifications_userId_isRead_createdAt_idx`(`userId`, `isRead`, `createdAt`),
    INDEX `sys_notifications_type_status_createdAt_idx`(`type`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_notification_reads` (
    `id` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_notification_reads_userId_hidden_idx`(`userId`, `hidden`),
    UNIQUE INDEX `sys_notification_reads_notificationId_userId_key`(`notificationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sys_notification_reads` ADD CONSTRAINT `sys_notification_reads_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `sys_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
