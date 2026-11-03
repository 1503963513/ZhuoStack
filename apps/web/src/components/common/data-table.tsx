'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 列定义 */
export interface Column<T> {
  /** 列标题 */
  label: string;
  /** 相对宽度比例（默认 1） */
  span?: number;
  /** 自定义渲染，默认取 row[key] */
  render?: (row: T) => ReactNode;
  /** 数据字段名（不提供 render 时使用） */
  key?: keyof T;
  /** 自定义单元格对齐方式或类名 */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyText?: string;
  /** 行操作列（放在最后） */
  actions?: (row: T) => ReactNode;
  /** 操作列最小宽度（以 4rem 为一份，最少 1 份） */
  actionsSpan?: number;
  /** 操作列标题，默认为 "操作" */
  actionsLabel?: string;
  /** 操作列自定义类名或对齐样式 */
  actionsClassName?: string;
  /** 行点击 */
  onRowClick?: (row: T) => void;
  /** 行 className */
  rowClassName?: string;
  /** 整体表格容器最小宽度（默认 "min-w-[760px]"） */
  minWidth?: string;
}

/**
 * 数据列使用比例宽度，操作列使用 max-content。
 * 这样按钮不会参与 `minmax(0, 1fr)` 挤压，也不会冲出表格滚动区域。
 */
export function buildTableGridTemplate<T>(
  columns: Column<T>[],
  actions: boolean,
  actionsSpan: number,
): string {
  const dataTracks = columns.map((column) => `minmax(0, ${Math.max(1, column.span || 1)}fr)`);
  if (actions) {
    dataTracks.push(`minmax(${Math.max(1, actionsSpan) * 4}rem, max-content)`);
  }
  return dataTracks.join(' ');
}

/**
 * 通用响应式数据表格组件
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyText = '暂无数据',
  actions,
  actionsSpan = 2,
  actionsLabel = '操作',
  actionsClassName,
  onRowClick,
  rowClassName,
  minWidth = 'min-w-[760px]',
}: DataTableProps<T>) {
  const gridTemplateColumns = buildTableGridTemplate(columns, Boolean(actions), actionsSpan);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: T) => {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <div className={cn('w-full', minWidth)} role="table" aria-rowcount={data.length + 1}>
            <div
              className="border-b bg-muted/20 px-4 py-3 text-sm font-medium text-muted-foreground"
              role="rowgroup"
            >
              <div className="grid items-center gap-4" style={{ gridTemplateColumns }} role="row">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn('min-w-0 overflow-hidden truncate', col.className)}
                    role="columnheader"
                  >
                    {col.label}
                  </div>
                ))}
                {actions && (
                  <div
                    className={cn('min-w-max pr-2 text-right font-medium', actionsClassName)}
                    role="columnheader"
                  >
                    {actionsLabel}
                  </div>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">加载中...</div>
            ) : data.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              <div className="divide-y" role="rowgroup">
                {data.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      'px-4 py-3 transition-colors hover:bg-muted/50',
                      onRowClick && 'cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      rowClassName,
                    )}
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    role="row"
                  >
                    <div className="grid items-center gap-4" style={{ gridTemplateColumns }}>
                      {columns.map((col, i) => (
                        <div
                          key={i}
                          className={cn('min-w-0 overflow-hidden break-words text-sm', col.className)}
                          role="cell"
                        >
                          {col.render
                            ? col.render(row)
                            : col.key
                              ? ((row[col.key] as ReactNode) ?? '-')
                              : '-'}
                        </div>
                      ))}
                      {actions && (
                        <div
                          className={cn(
                            'flex min-w-max flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap',
                            actionsClassName,
                          )}
                          onClick={(event) => event.stopPropagation()}
                          role="cell"
                        >
                          {actions(row)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
