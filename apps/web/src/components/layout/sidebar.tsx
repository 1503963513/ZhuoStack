'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { authControllerGetUserMenus } from '@/api/generated/endpoints/auth/auth';
import type { UserMenuTreeNodeDto } from '@/api/generated/models';
import {
  LayoutDashboard,
  User,
  LogOut,
  Settings,
  Building2,
  Briefcase,
  Shield,
  Menu as MenuIcon,
  BookOpen,
  ChevronDown,
  Folder,
  FileText,
  MousePointer,
  type LucideIcon,
} from 'lucide-react';
import { useLogout } from '@/hooks/use-auth';
import { useConfirm } from '@/hooks/use-confirm';

// 图标映射
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  Settings,
  Building2,
  Briefcase,
  Shield,
  Menu: MenuIcon,
  BookOpen,
  Folder,
  FileText,
  MousePointer,
};

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const { confirm, ConfirmDialog } = useConfirm();

  const handleLogout = async () => {
    const ok = await confirm({ description: '确定要退出登录吗？', variant: 'destructive' });
    if (ok) logout();
  };

  // 从 API 获取当前用户的菜单（按角色过滤）
  const { data: response } = useQuery({
    queryKey: ['user-menus'],
    queryFn: () => authControllerGetUserMenus(),
  });

  const menuList = useMemo(() => response?.data || [], [response]);

  // 一级菜单（没有父级的 MENU 类型，如仪表盘、个人中心，排除隐藏菜单）
  const topMenus = useMemo(() => {
    return menuList
      .filter((m: UserMenuTreeNodeDto) => m.status === 'ACTIVE' && !m.hidden && m.type === 'MENU' && !m.parentId)
      .sort((a, b) => a.sort - b.sort);
  }, [menuList]);

  // 分组菜单（DIRECTORY 类型，如系统管理，排除隐藏菜单）
  const menuGroups = useMemo(() => {
    return menuList
      .filter((m: UserMenuTreeNodeDto) => m.status === 'ACTIVE' && !m.hidden && m.type === 'DIRECTORY')
      .sort((a, b) => a.sort - b.sort)
      .map((dir) => ({
        ...dir,
        children: (dir.children || [])
          .filter((c: UserMenuTreeNodeDto) => c.status === 'ACTIVE' && !c.hidden && c.type === 'MENU')
          .sort((a, b) => a.sort - b.sort),
      }));
  }, [menuList]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string, defaultOpen: boolean) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? defaultOpen),
    }));
  };

  const getIcon = (iconName: string | null | undefined): LucideIcon => {
    if (!iconName || !ICON_MAP[iconName]) return FileText;
    return ICON_MAP[iconName];
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold">{APP_NAME}</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {/* 一级菜单（仪表盘、个人中心等） */}
        {topMenus.map((item) => {
          const Icon = getIcon(item.icon);
          return (
            <Link
              key={item.id}
              href={item.path || '#'}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}

        {/* 分组菜单（带可折叠子菜单） */}
        {menuGroups.map((group) => {
          const GroupIcon = getIcon(group.icon);
          const hasActiveChild = group.children.some((c) => pathname === c.path);
          const isOpen = openGroups[group.id] ?? hasActiveChild;

          return (
            <div key={group.id} className="pt-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.id, hasActiveChild)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  hasActiveChild
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="h-4 w-4" />
                  <span>{group.name}</span>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {isOpen && (
                <div className="ml-4 mt-1 flex flex-col gap-1 border-l pl-2">
                  {group.children.map((child) => {
                    const ChildIcon = getIcon(child.icon);
                    const isActive = pathname === child.path;

                    return (
                      <Link
                        key={child.id}
                        href={child.path || '#'}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>

      <ConfirmDialog />
    </aside>
  );
}
