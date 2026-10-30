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
    if (!ok) return;
    logout();
  };

  // 从 API 获取当前用户的菜单（按角色过滤）
  const { data: response } = useQuery({
    queryKey: ['user-menus'],
    queryFn: () => authControllerGetUserMenus(),
  });

  const menuList = useMemo(() => response?.data || [], [response]);

  // 所有顶级导航项（包括独立页面 MENU 和可折叠目录 DIRECTORY，排除已隐藏项），统一按后端 sort 升序排列
  const navItems = useMemo(() => {
    return menuList
      .filter(
        (m: UserMenuTreeNodeDto) =>
          m.status === 'ACTIVE' && !m.hidden && !m.parentId,
      )
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((item) => {
        if (item.type === 'DIRECTORY') {
          return {
            ...item,
            children: (item.children || [])
              .filter(
                (c: UserMenuTreeNodeDto) =>
                  c.status === 'ACTIVE' && !c.hidden && c.type === 'MENU',
              )
              .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
          };
        }
        return item;
      });
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
        {navItems.map((item) => {
          // 1. 如果是目录（DIRECTORY），渲染为可折叠的分组菜单
          if (item.type === 'DIRECTORY') {
            const GroupIcon = getIcon(item.icon);
            const children = item.children || [];
            const hasActiveChild = children.some((c) => pathname === c.path);
            const isOpen = openGroups[item.id] ?? hasActiveChild;

            return (
              <div key={item.id} className="pt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id, hasActiveChild)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    hasActiveChild
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon className="h-4 w-4" />
                    <span>{item.name}</span>
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
                    {children.map((child) => {
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
          }

          // 2. 如果是顶级单项菜单（MENU，如仪表盘、个人中心等），按其自身 sort 权重直接渲染为单项链接
          const ItemIcon = getIcon(item.icon);
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.id}
              href={item.path || '#'}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {item.name}
            </Link>
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
