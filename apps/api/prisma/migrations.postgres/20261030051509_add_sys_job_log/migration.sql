-- CreateTable
CREATE TABLE "sys_job_log" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobGroup" TEXT NOT NULL DEFAULT 'DEFAULT',
    "description" TEXT,
    "cronExpression" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "exceptionInfo" TEXT,
    "executionTime" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_job_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sys_job_log_jobName_idx" ON "sys_job_log"("jobName");
CREATE INDEX "sys_job_log_createdAt_idx" ON "sys_job_log"("createdAt");
CREATE INDEX "sys_job_log_status_idx" ON "sys_job_log"("status");
