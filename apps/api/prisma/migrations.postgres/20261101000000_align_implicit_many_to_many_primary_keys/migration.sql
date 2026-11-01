-- AlterTable
ALTER TABLE "_SysMenuToSysRole" ADD CONSTRAINT "_SysMenuToSysRole_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_SysMenuToSysRole_AB_unique";

-- AlterTable
ALTER TABLE "_SysPostToUser" ADD CONSTRAINT "_SysPostToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_SysPostToUser_AB_unique";

-- AlterTable
ALTER TABLE "_SysRoleToUser" ADD CONSTRAINT "_SysRoleToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_SysRoleToUser_AB_unique";
