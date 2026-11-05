-- CreateTable
CREATE TABLE "sys_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT,
    "senderId" TEXT,
    "senderName" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "bizType" TEXT,
    "bizId" TEXT,
    "status" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_notification_reads" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sys_notifications_userId_isRead_createdAt_idx" ON "sys_notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "sys_notifications_type_status_createdAt_idx" ON "sys_notifications"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "sys_notification_reads_userId_hidden_idx" ON "sys_notification_reads"("userId", "hidden");

-- CreateIndex
CREATE UNIQUE INDEX "sys_notification_reads_notificationId_userId_key" ON "sys_notification_reads"("notificationId", "userId");

-- AddForeignKey
ALTER TABLE "sys_notification_reads" ADD CONSTRAINT "sys_notification_reads_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "sys_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
