'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permission';

interface PermissionButtonProps extends ButtonProps {
  /** 权限标识，如 'system:user:add' */
  perm: string;
  /** 无权限时是否隐藏（默认 true），设为 false 则禁用 */
  hideWhenNoPerm?: boolean;
  children: ReactNode;
}

/**
 * 权限按钮组件
 * 根据用户拥有的按钮权限控制按钮显示/隐藏或禁用
 *
 * @example
 * <PermissionButton perm="system:user:add" onClick={handleAdd}>
 *   新增用户
 * </PermissionButton>
 */
export function PermissionButton({
  perm,
  hideWhenNoPerm = true,
  children,
  ...props
}: PermissionButtonProps) {
  const { hasPermission, isLoading } = usePermissions();

  // 加载期间保留按钮占位，避免权限请求完成时工具栏和操作列跳动。
  if (isLoading) {
    return (
      <Button {...props} disabled aria-busy="true">
        {children}
      </Button>
    );
  }

  const permitted = hasPermission(perm);

  // 无权限时：隐藏或禁用
  if (!permitted) {
    if (hideWhenNoPerm) return null;
    return (
      <Button {...props} disabled>
        {children}
      </Button>
    );
  }

  return <Button {...props}>{children}</Button>;
}
