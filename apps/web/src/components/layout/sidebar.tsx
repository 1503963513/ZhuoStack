'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { useApiQuery } from '@/hooks/use-api';
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

interface MenuItem {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
  path: string | null;
  icon: string | null;
  sort: number;
  status: string;
  hidden: boolean;
  children?: MenuItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();

  // 从 API 获取当前用户的菜单（按角色过滤）
  const { data } = useApiQuery<MenuItem[]>(['user-menus'], '/api/auth/menus');

  // 一级菜单（没有父级的 MENU 类型，如仪表盘、个人中心）
  const topMenus = useMemo(() => {
    if (!data?.data) return [];
    return data.data
      .filter((m) => m.status === 'ACTIVE' && !m.hidden && m.type === 'MENU' && !m.parentId)
      .sort((a, b) => a.sort - b.sort);
  }, [data]);

  // 分组菜单（DIRECTORY 类型，如系统管理）
  const menuGroups = useMemo(() => {
    if (!data?.data) return [];
    return data.data
      .filter((m) => m.status === 'ACTIVE' && !m.hidden && m.type === 'DIRECTORY')
      .sort((a, b) => a.sort - b.sort)
      .map((dir) => ({
        ...dir,
        children: (dir.children || [])
          .filter((c) => c.status === 'ACTIVE' && !c.hidden && c.type === 'MENU')
          .sort((a, b) => a.sort - b.sort),
      }));
  }, [data]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 数据加载后，自动展开当前路径所在的目录
  useEffect(() => {
    if (!menuGroups.length) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of menuGroups) {
        if (group.children?.some((c: MenuItem) => c.path && pathname.startsWith(c.path))) {
          next[group.id] = true;
        }
      }
      return next;
    });
  }, [menuGroups, pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getIcon = (iconName: string | null): LucideIcon => {
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

        {/* 分组菜单（系统管理等目录） */}
        {menuGroups.map((group) => {
          const GroupIcon = getIcon(group.icon);
          const isOpen = openGroups[group.id] ?? false;
          const hasActiveChild = group.children?.some((c) => c.path && pathname.startsWith(c.path));

          return (
            <div key={group.id} className="mt-2">
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  hasActiveChild
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className="h-4 w-4" />
                  {group.name}
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && group.children && group.children.length > 0 && (
                <div className="ml-4 mt-1 flex flex-col gap-1">
                  {group.children.map((child) => {
                    const ChildIcon = getIcon(child.icon);
                    return (
                      <Link
                        key={child.id}
                        href={child.path || '#'}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          pathname === child.path
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <ChildIcon className="h-4 w-4" />
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

      <div className="border-t bg-card p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
