'use client';

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** 右侧操作按钮区 */
  actions?: ReactNode;
}

/**
 * 页面顶部标题 + 操作按钮
 *
 * @example
 * <PageHeader title="登录日志" description="记录用户登录行为" actions={<Button>新增</Button>} />
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
