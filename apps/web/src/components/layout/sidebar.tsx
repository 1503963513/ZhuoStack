'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useSystemConfig } from '@/hooks/use-system-config';
import { useI18n } from '@/hooks/use-i18n';
import { authControllerGetUserMenus } from '@/api/generated/endpoints/auth/auth';
import type { UserMenuTreeNodeDto } from '@/api/generated/models';
import { getDynamicIcon } from '@/components/common/dynamic-icon';
import { ChevronDown } from 'lucide-react';

/** 判断当前路由是否属于该菜单项（支持完全匹配或子页面前缀匹配，如 /monitor/jobs/logs 保持激活 /monitor/jobs） */
function isPathActive(currentPath: string, menuPath: string | null | undefined): boolean {
  if (!menuPath) return false;
  if (currentPath === menuPath) return true;
  if (menuPath === '/' || menuPath === '/dashboard') return false;
  return currentPath.startsWith(`${menuPath}/`);
}

export function Sidebar() {
  const { appName } = useSystemConfig();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  // 鼠标悬停在菜单项上时立即触发预加载，降低点击时的网络延迟
  const handlePrefetch = useCallback(
    (path: string | null | undefined) => {
      if (path && path.startsWith('/')) {
        router.prefetch(path);
      }
    },
    [router],
  );

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

  /** 获取国际化菜单名称：优先通过 path 映射，再通过数据库名称映射，最后兜底原名 */
  const getMenuName = (item: { name: string; path?: string | null }) => {
    if (item.path) {
      const translatedByPath = t(`menu.${item.path}`, '');
      if (translatedByPath) return translatedByPath;
    }
    return t(`menu.${item.name}`, item.name);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold">{appName}</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          // 1. 如果是目录（DIRECTORY），渲染为可折叠的分组菜单
          if (item.type === 'DIRECTORY') {
            const GroupIcon = getDynamicIcon(item.icon);
            const children = item.children || [];
            const hasActiveChild = children.some((c) => isPathActive(pathname, c.path));
            const isOpen = openGroups[item.id] ?? hasActiveChild;
            const displayName = getMenuName(item);

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
                    <span>{displayName}</span>
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
                      const ChildIcon = getDynamicIcon(child.icon);
                      const isActive = isPathActive(pathname, child.path);
                      const childDisplayName = getMenuName(child);

                      return (
                        <Link
                          key={child.id}
                          href={child.path || '#'}
                          prefetch={true}
                          onMouseEnter={() => handlePrefetch(child.path)}
                          className={cn(
                            'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5" />
                          {childDisplayName}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // 2. 如果是顶级单项菜单（MENU，如仪表盘、个人中心等），按其自身 sort 权重直接渲染为单项链接
          const ItemIcon = getDynamicIcon(item.icon);
          const isActive = isPathActive(pathname, item.path);
          const displayName = getMenuName(item);

          return (
            <Link
              key={item.id}
              href={item.path || '#'}
              prefetch={true}
              onMouseEnter={() => handlePrefetch(item.path)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {displayName}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
