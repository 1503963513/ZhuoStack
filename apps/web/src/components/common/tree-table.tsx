'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Column } from './data-table';

export interface TreeTableProps<T extends { id: string; children?: T[] }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyText?: string;
  /** 行操作列（放在最后） */
  actions?: (row: T) => ReactNode;
  actionsSpan?: number;
  actionsLabel?: string;
  actionsClassName?: string;
  /** 行点击 */
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T, level: number) => string;
  /** 表格最小保护宽度 */
  minWidth?: string;
  /** 外部控制的已折叠节点 ID 集合 */
  collapsedIds?: Set<string>;
  /** 节点折叠/展开回调 */
  onToggleExpand?: (id: string) => void;
  /** 缩进列的索引（默认 0 即第一列显示折叠展开箭头与层级缩进） */
  indentColumnIndex?: number;
  /** 每一级的缩进像素，默认 24 */
  indentWidth?: number;
}

interface FlattenTreeItem<T> {
  item: T;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/**
 * 递归将树扁平化为当前可见列表（受折叠状态控制）
 */
function flattenTree<T extends { id: string; children?: T[] }>(
  data: T[],
  collapsedIds: Set<string>,
  level = 0,
): FlattenTreeItem<T>[] {
  const result: FlattenTreeItem<T>[] = [];

  for (const node of data) {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = !collapsedIds.has(node.id);

    result.push({
      item: node,
      level,
      hasChildren,
      isExpanded,
    });

    if (hasChildren && isExpanded && node.children) {
      result.push(...flattenTree(node.children, collapsedIds, level + 1));
    }
  }

  return result;
}

/**
 * 通用响应式树形表格组件
 */
export function TreeTable<T extends { id: string; children?: T[] }>({
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
  minWidth = 'min-w-[800px]',
  collapsedIds: externalCollapsedIds,
  onToggleExpand: externalToggleExpand,
  indentColumnIndex = 0,
  indentWidth = 24,
}: TreeTableProps<T>) {
  // 内部折叠状态（未传入 externalCollapsedIds 时使用）
  const [internalCollapsedIds, setInternalCollapsedIds] = useState<Set<string>>(new Set());

  const currentCollapsedIds = externalCollapsedIds ?? internalCollapsedIds;

  const handleToggle = (id: string) => {
    if (externalToggleExpand) {
      externalToggleExpand(id);
    } else {
      setInternalCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const visibleList = useMemo(() => {
    return flattenTree(data, currentCollapsedIds);
  }, [data, currentCollapsedIds]);

  const totalSpan =
    columns.reduce((sum, c) => sum + (c.span || 1), 0) + (actions ? actionsSpan : 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
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

            {/* 内容区 */}
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground text-sm">加载中...</div>
            ) : data.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">{emptyText}</div>
            ) : (
              <div className="divide-y">
                {visibleList.map(({ item, level, hasChildren, isExpanded }) => {
                  const customRowClass = rowClassName ? rowClassName(item, level) : '';

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'px-4 py-2.5 hover:bg-muted/50 transition-colors',
                        onRowClick && 'cursor-pointer',
                        customRowClass,
                      )}
                      onClick={() => onRowClick?.(item)}
                    >
                      <div
                        className="grid gap-4 items-center"
                        style={{ gridTemplateColumns: `repeat(${totalSpan}, minmax(0, 1fr))` }}
                      >
                        {columns.map((col, i) => {
                          const isIndentCol = i === indentColumnIndex;

                          const cellContent = col.render
                            ? col.render(item)
                            : col.key
                              ? ((item[col.key] as ReactNode) ?? '-')
                              : '-';

                          return (
                            <div
                              key={i}
                              className={cn(
                                'text-sm overflow-hidden break-words min-w-0',
                                col.className,
                              )}
                              style={{ gridColumn: `span ${col.span || 1}` }}
                            >
                              {isIndentCol ? (
                                <div
                                  className="flex items-center min-w-0"
                                  style={{ paddingLeft: `${level * indentWidth}px` }}
                                >
                                  {hasChildren ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0 shrink-0 mr-1 hover:bg-muted rounded text-muted-foreground"
                                      aria-label={isExpanded ? '收起子节点' : '展开子节点'}
                                      aria-expanded={isExpanded}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggle(item.id);
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  ) : (
                                    <span className="w-6 shrink-0 mr-1 inline-block" />
                                  )}
                                  <div className="min-w-0 flex-1 truncate">{cellContent}</div>
                                </div>
                              ) : (
                                cellContent
                              )}
                            </div>
                          );
                        })}

                        {actions && (
                          <div
                            className={cn(
                              'flex items-center justify-end gap-1.5 flex-nowrap shrink-0 whitespace-nowrap min-w-0',
                              actionsClassName,
                            )}
                            style={{ gridColumn: `span ${actionsSpan}` }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {actions(item)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
