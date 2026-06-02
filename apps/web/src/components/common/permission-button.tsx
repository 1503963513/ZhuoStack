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

  // 加载中不渲染，避免闪烁
  if (isLoading) return null;

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
