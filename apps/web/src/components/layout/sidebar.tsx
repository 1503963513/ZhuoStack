'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
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
  children?: MenuItem[];
}

// 硬编码的基础菜单（不在数据库管理范围内）
const baseNavItems = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/profile', label: '个人资料', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();

  // 从 API 获取菜单树（只取 ACTIVE 状态的菜单）
  const { data } = useApiQuery<MenuItem[]>(['menus'], '/api/system/menu/tree');

  // 过滤出活跃的菜单，构建动态系统菜单
  const systemMenus = useMemo(() => {
    if (!data?.data) return [];
    return data.data
      .filter((m) => m.status === 'ACTIVE' && m.type === 'DIRECTORY')
      .sort((a, b) => a.sort - b.sort)
      .map((dir) => ({
        ...dir,
        children: (dir.children || [])
          .filter((c) => c.status === 'ACTIVE' && c.type === 'MENU')
          .sort((a, b) => a.sort - b.sort),
      }));
  }, [data]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // 初始化时自动展开当前路径所在的分组
    const initial: Record<string, boolean> = {};
    if (systemMenus) {
      for (const group of systemMenus) {
        if (group.children?.some((c) => c.path && pathname.startsWith(c.path))) {
          initial[group.id] = true;
        }
      }
    }
    return initial;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getIcon = (iconName: string | null): LucideIcon => {
    if (!iconName || !ICON_MAP[iconName]) return FileText;
    return ICON_MAP[iconName];
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold">{APP_NAME}</h1>
      </div>

      <nav className="flex flex-col gap-1 p-4">
        {/* 基础菜单 */}
        {baseNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* 动态菜单（从 API 获取） */}
        {systemMenus.map((group) => {
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

      <div className="absolute bottom-4 left-0 right-0 px-4">
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
