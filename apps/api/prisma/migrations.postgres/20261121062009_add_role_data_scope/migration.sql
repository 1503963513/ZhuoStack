-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('ALL', 'DEPT_AND_CHILD', 'DEPT', 'CUSTOM', 'SELF');

-- AlterTable
ALTER TABLE "sys_role" ADD COLUMN     "dataScope" "DataScope" NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE "_SysDeptToSysRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SysDeptToSysRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SysDeptToSysRole_B_index" ON "_SysDeptToSysRole"("B");

-- AddForeignKey
ALTER TABLE "_SysDeptToSysRole" ADD CONSTRAINT "_SysDeptToSysRole_A_fkey" FOREIGN KEY ("A") REFERENCES "sys_dept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SysDeptToSysRole" ADD CONSTRAINT "_SysDeptToSysRole_B_fkey" FOREIGN KEY ("B") REFERENCES "sys_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
