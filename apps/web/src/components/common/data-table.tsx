'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

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
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyText?: string;
  /** 行操作列（放在最后） */
  actions?: (row: T) => ReactNode;
  actionsSpan?: number;
  /** 行点击 */
  onRowClick?: (row: T) => void;
  /** 行 className */
  rowClassName?: string;
}

/**
 * 通用数据表格组件
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
  onRowClick,
  rowClassName,
}: DataTableProps<T>) {
  const totalSpan = columns.reduce((sum, c) => sum + (c.span || 1), 0) + (actions ? actionsSpan : 0);

  return (
    <Card>
      <CardContent className="p-0">
        {/* 表头 */}
        <div className="border-b px-4 py-3 font-medium">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${totalSpan}, 1fr)` }}>
            {columns.map((col, i) => (
              <div key={i} className="overflow-hidden break-words" style={{ gridColumn: `span ${col.span || 1}`, minWidth: 0 }}>
                {col.label}
              </div>
            ))}
            {actions && <div style={{ gridColumn: `span ${actionsSpan}` }}>操作</div>}
          </div>
        </div>

        {/* 加载状态 */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">加载中...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{emptyText}</div>
        ) : (
          data.map((row) => (
            <div
              key={row.id}
              className={`border-b px-4 py-3 hover:bg-muted/50 ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName || ''}`}
              onClick={() => onRowClick?.(row)}
            >
              <div className="grid gap-4 items-center" style={{ gridTemplateColumns: `repeat(${totalSpan}, 1fr)` }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className="text-sm overflow-hidden break-words"
                    style={{ gridColumn: `span ${col.span || 1}`, minWidth: 0 }}
                  >
                    {col.render
                      ? col.render(row)
                      : col.key
                        ? (row[col.key] as ReactNode) ?? '-'
                        : '-'}
                  </div>
                ))}
                {actions && (
                  <div className="flex gap-2" style={{ gridColumn: `span ${actionsSpan}` }}>
                    {actions(row)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
