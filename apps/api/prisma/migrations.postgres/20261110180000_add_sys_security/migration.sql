-- CreateTable
CREATE TABLE "sys_ip_rules" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BLACKLIST',
    "reason" TEXT,
    "expiredAt" TIMESTAMP(3),
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_ip_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_throttle_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'ALL',
    "limit" INTEGER NOT NULL DEFAULT 60,
    "ttl" INTEGER NOT NULL DEFAULT 60,
    "dimension" TEXT NOT NULL DEFAULT 'IP',
    "autoBlock" BOOLEAN NOT NULL DEFAULT false,
    "blockMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_throttle_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_ip_rules_ip_key" ON "sys_ip_rules"("ip");

-- CreateIndex
CREATE INDEX "sys_ip_rules_type_status_idx" ON "sys_ip_rules"("type", "status");

-- CreateIndex
CREATE INDEX "sys_throttle_rules_status_idx" ON "sys_throttle_rules"("status");

-- CreateIndex
CREATE INDEX "sys_throttle_rules_path_method_idx" ON "sys_throttle_rules"("path", "method");
