'use client';

import { Folder, FileText, MousePointer, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MenuTypeConfig {
  label: string;
  icon: LucideIcon;
  badgeClassName: string;
  iconColor: string;
  rowBg?: string;
}

/** 统一全局菜单类型规范配置（目录、菜单、按钮） */
export const MENU_TYPE_CONFIG: Record<string, MenuTypeConfig> = {
  DIRECTORY: {
    label: '目录',
    icon: Folder,
    badgeClassName: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500',
    rowBg: '',
  },
  MENU: {
    label: '菜单',
    icon: FileText,
    badgeClassName: 'border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400',
    iconColor: 'text-green-500',
    rowBg: '',
  },
  BUTTON: {
    label: '按钮',
    icon: MousePointer,
    badgeClassName: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
    iconColor: 'text-orange-500',
    rowBg: 'bg-muted/30',
  },
};

export function getMenuTypeConfig(type?: string): MenuTypeConfig {
  return MENU_TYPE_CONFIG[type || 'MENU'] || MENU_TYPE_CONFIG.MENU;
}

interface MenuTypeBadgeProps {
  type?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * 统一渲染菜单类型的徽标组件
 */
export function MenuTypeBadge({ type, showIcon = true, className }: MenuTypeBadgeProps) {
  const config = getMenuTypeConfig(type);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 font-normal', config.badgeClassName, className)}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
