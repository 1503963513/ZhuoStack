'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** 列定义 */
export interface Column<T> {
  /** 列标题 */
  label: string;
  /** grid col-span（默认 1） */
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
  actionsSpan?: number;
  /** 操作列标题，默认为 "操作" */
  actionsLabel?: string;
  /** 操作列自定义类名或对齐样式 */
  actionsClassName?: string;
  /** 行点击 */
  onRowClick?: (row: T) => void;
  /** 行 className */
  rowClassName?: string;
  /** 整体表格容器最小宽度（防止窄屏挤压溢出，默认 "min-w-[760px]"，可设为 "" 或自定义） */
  minWidth?: string;
}

/**
 * 通用响应式数据表格组件
 *
 * @example
 * <DataTable
 *   columns={[
 *     { label: '名称', key: 'name', span: 3 },
 *     { label: '状态', span: 2, render: (row) => <Badge>{row.status}</Badge> },
 *   ]}
 *   data={list}
 *   isLoading={isLoading}
 *   actions={(row) => <Button onClick={() => edit(row)}>编辑</Button>}
 *   actionsSpan={2}
 * />
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
  const totalSpan = columns.reduce((sum, c) => sum + (c.span || 1), 0) + (actions ? actionsSpan : 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* 外层水平滚动容器，防止列挤压或按钮超出 */}
        <div className="w-full overflow-x-auto">
          <div className={cn('w-full', minWidth)}>
            {/* 表头 */}
            <div className="border-b px-4 py-3 font-medium bg-muted/20 text-muted-foreground text-sm">
              <div
                className="grid gap-4 items-center"
                style={{ gridTemplateColumns: `repeat(${totalSpan}, minmax(0, 1fr))` }}
              >
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn('overflow-hidden truncate', col.className)}
                    style={{ gridColumn: `span ${col.span || 1}` }}
                  >
                    {col.label}
                  </div>
                ))}
                {actions && (
                  <div
                    className={cn('text-right pr-2 font-medium', actionsClassName)}
                    style={{ gridColumn: `span ${actionsSpan}` }}
                  >
                    {actionsLabel}
                  </div>
                )}
              </div>
            </div>

            {/* 加载与数据内容 */}
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">加载中...</div>
            ) : data.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{emptyText}</div>
            ) : (
              <div className="divide-y">
                {data.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      'px-4 py-3 hover:bg-muted/50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      rowClassName,
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    <div
                      className="grid gap-4 items-center"
                      style={{ gridTemplateColumns: `repeat(${totalSpan}, minmax(0, 1fr))` }}
                    >
                      {columns.map((col, i) => (
                        <div
                          key={i}
                          className={cn('text-sm overflow-hidden break-words min-w-0', col.className)}
                          style={{ gridColumn: `span ${col.span || 1}` }}
                        >
                          {col.render
                            ? col.render(row)
                            : col.key
                              ? (row[col.key] as ReactNode) ?? '-'
                              : '-'}
                        </div>
                      ))}
                      {actions && (
                        <div
                          className={cn(
                            'flex items-center justify-end gap-1.5 flex-nowrap shrink-0 whitespace-nowrap min-w-0',
                            actionsClassName,
                          )}
                          style={{ gridColumn: `span ${actionsSpan}` }}
                          onClick={(e) => e.stopPropagation()}
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
