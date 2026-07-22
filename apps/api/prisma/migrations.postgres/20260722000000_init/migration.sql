-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MenuType" AS ENUM ('DIRECTORY', 'MENU', 'BUTTON');

-- CreateTable
CREATE TABLE "sys_dept" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_dept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dict_data" (
    "id" TEXT NOT NULL,
    "dictId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_dict_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dict" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_dict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_files" (
    "id" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(127) NOT NULL,
    "ext" VARCHAR(32) NOT NULL,
    "storageType" VARCHAR(32) NOT NULL DEFAULT 'local',
    "md5" VARCHAR(64),
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" VARCHAR(500),
    "createBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_login_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "location" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "msg" TEXT,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sys_login_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "MenuType" NOT NULL DEFAULT 'MENU',
    "path" TEXT,
    "component" TEXT,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "perms" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_oper_log" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "businessType" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "requestMethod" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "operName" TEXT,
    "operUrl" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "jsonResult" TEXT,
    "errorMsg" TEXT,
    "operTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sys_oper_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_post" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "deptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sys_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SysMenuToSysRole" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);
CREATE TABLE "_SysPostToUser" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);
CREATE TABLE "_SysRoleToUser" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);

-- CreateIndex
CREATE INDEX "sys_dept_parentId_idx" ON "sys_dept"("parentId");
CREATE INDEX "sys_dict_data_dictId_idx" ON "sys_dict_data"("dictId");
CREATE INDEX "sys_dict_data_status_idx" ON "sys_dict_data"("status");
CREATE UNIQUE INDEX "sys_dict_code_key" ON "sys_dict"("code");
CREATE INDEX "sys_login_log_loginTime_idx" ON "sys_login_log"("loginTime");
CREATE INDEX "sys_menu_parentId_idx" ON "sys_menu"("parentId");
CREATE INDEX "sys_menu_status_idx" ON "sys_menu"("status");
CREATE INDEX "sys_oper_log_operTime_idx" ON "sys_oper_log"("operTime");
CREATE UNIQUE INDEX "sys_post_code_key" ON "sys_post"("code");
CREATE UNIQUE INDEX "sys_role_code_key" ON "sys_role"("code");
CREATE UNIQUE INDEX "sys_user_email_key" ON "sys_user"("email");
CREATE INDEX "sys_user_deptId_idx" ON "sys_user"("deptId");
CREATE INDEX "sys_user_role_idx" ON "sys_user"("role");
CREATE INDEX "sys_user_createdAt_idx" ON "sys_user"("createdAt");
CREATE UNIQUE INDEX "_SysMenuToSysRole_AB_unique" ON "_SysMenuToSysRole"("A", "B");
CREATE INDEX "_SysMenuToSysRole_B_index" ON "_SysMenuToSysRole"("B");
CREATE UNIQUE INDEX "_SysPostToUser_AB_unique" ON "_SysPostToUser"("A", "B");
CREATE INDEX "_SysPostToUser_B_index" ON "_SysPostToUser"("B");
CREATE UNIQUE INDEX "_SysRoleToUser_AB_unique" ON "_SysRoleToUser"("A", "B");
CREATE INDEX "_SysRoleToUser_B_index" ON "_SysRoleToUser"("B");

-- AddForeignKey
ALTER TABLE "sys_dept" ADD CONSTRAINT "sys_dept_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sys_dept"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sys_dict_data" ADD CONSTRAINT "sys_dict_data_dictId_fkey" FOREIGN KEY ("dictId") REFERENCES "sys_dict"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sys_menu" ADD CONSTRAINT "sys_menu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sys_menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sys_user" ADD CONSTRAINT "sys_user_deptId_fkey" FOREIGN KEY ("deptId") REFERENCES "sys_dept"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_SysMenuToSysRole" ADD CONSTRAINT "_SysMenuToSysRole_A_fkey" FOREIGN KEY ("A") REFERENCES "sys_menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SysMenuToSysRole" ADD CONSTRAINT "_SysMenuToSysRole_B_fkey" FOREIGN KEY ("B") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SysPostToUser" ADD CONSTRAINT "_SysPostToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "sys_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SysPostToUser" ADD CONSTRAINT "_SysPostToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SysRoleToUser" ADD CONSTRAINT "_SysRoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SysRoleToUser" ADD CONSTRAINT "_SysRoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "sys_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
