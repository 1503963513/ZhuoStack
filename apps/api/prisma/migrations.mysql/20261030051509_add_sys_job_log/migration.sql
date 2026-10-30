-- CreateTable
CREATE TABLE `sys_job_log` (
    `id` VARCHAR(191) NOT NULL,
    `jobName` VARCHAR(64) NOT NULL,
    `jobGroup` VARCHAR(64) NOT NULL DEFAULT 'DEFAULT',
    `description` VARCHAR(255) NULL,
    `cronExpression` VARCHAR(64) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `exceptionInfo` TEXT NULL,
    `executionTime` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sys_job_log_jobName_idx`(`jobName`),
    INDEX `sys_job_log_createdAt_idx`(`createdAt`),
    INDEX `sys_job_log_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
