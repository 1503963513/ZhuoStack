-- CreateTable
CREATE TABLE `sys_ip_rules` (
    `id` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'BLACKLIST',
    `reason` VARCHAR(255) NULL,
    `expiredAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sys_ip_rules_ip_key`(`ip`(100)),
    INDEX `sys_ip_rules_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sys_throttle_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `method` VARCHAR(10) NOT NULL DEFAULT 'ALL',
    `limit` INTEGER NOT NULL DEFAULT 60,
    `ttl` INTEGER NOT NULL DEFAULT 60,
    `dimension` VARCHAR(20) NOT NULL DEFAULT 'IP',
    `autoBlock` BOOLEAN NOT NULL DEFAULT false,
    `blockMinutes` INTEGER NOT NULL DEFAULT 15,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `sys_throttle_rules_status_idx`(`status`),
    INDEX `sys_throttle_rules_path_method_idx`(`path`, `method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
