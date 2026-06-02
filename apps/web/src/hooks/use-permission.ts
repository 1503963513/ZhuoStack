'use client';

import { useMemo } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';

interface MenuItem {
  id: string;
  name: string;
  type: string;
  perms: string | null;
  hidden: boolean;
  status: string;
  children?: MenuItem[];
}

/**
 * 获取当前用户的权限标识列表
 * 从 /api/auth/menus 接口递归提取所有 BUTTON 类型的 perms 字段
 */
export function usePermissions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data, isLoading } = useApiQuery<MenuItem[]>(
    ['user-menus'],
    '/api/auth/menus',
    { enabled: isAuthenticated },
  );

  const permissions = useMemo(() => {
    const perms = new Set<string>();
    const menus = data?.data || [];

    const collect = (items: MenuItem[]) => {
      for (const item of items) {
        // 跳过隐藏或停用的按钮
        if (item.type === 'BUTTON' && item.perms && !item.hidden && item.status === 'ACTIVE') {
          perms.add(item.perms);
        }
        if (item.children?.length) {
          collect(item.children);
        }
      }
    };

    collect(menus);
    return perms;
  }, [data]);

  /**
   * 检查是否拥有指定权限
   * @param perm 权限标识，如 'system:user:add'
   */
  const hasPermission = (perm: string): boolean => {
    return permissions.has(perm);
  };

  /**
   * 检查是否拥有任一权限
   * @param perms 权限标识数组
   */
  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some((p) => permissions.has(p));
  };

  return { permissions, hasPermission, hasAnyPermission, isLoading };
}
