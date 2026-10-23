'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { authControllerGetUserMenus } from '@/api/generated/endpoints/auth/auth';
import type { UserMenuTreeNodeDto } from '@/api/generated/models';

/**
 * 获取当前用户的权限标识列表
 * 从 /api/auth/menus 接口递归提取所有 BUTTON 类型的 perms 字段
 */
export function usePermissions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: response, isLoading } = useQuery({
    queryKey: ['user-menus'],
    queryFn: () => authControllerGetUserMenus(),
    enabled: isAuthenticated,
  });

  const permissions = useMemo(() => {
    const perms = new Set<string>();
    const menus = response?.data || [];

    const collect = (items: UserMenuTreeNodeDto[]) => {
      for (const item of items) {
        if (item.type === 'BUTTON' && (item as unknown as { perms?: string }).perms) {
          perms.add((item as unknown as { perms: string }).perms);
        }
        if (item.children?.length) {
          collect(item.children);
        }
      }
    };

    collect(menus);
    return perms;
  }, [response]);

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
