'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight, ChevronsUpDown, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  /** 是否默认展开全部节点；默认 false，即全部折叠（仅非受控模式生效） */
  defaultExpandAll?: boolean;
  /** 是否显示全部展开/折叠按钮，默认 true */
  showExpandControls?: boolean;
  /** 是否显示节点数量统计，默认 true */
  showStats?: boolean;
  /** 是否启用节点搜索，默认 false */
  searchable?: boolean;
  /** 搜索框提示文案 */
  searchPlaceholder?: string;
  /** 返回参与搜索匹配的文本 */
  getSearchText?: (row: T) => string;
  /** 刷新按钮回调；不传则不显示刷新按钮 */
  onRefresh?: () => void;
  /** 是否正在刷新 */
  isRefreshing?: boolean;
  /** 外部控制的已展开节点 ID 集合 */
  expandedIds?: Set<string>;
  /** 已展开节点集合变更回调 */
  onExpandedIdsChange?: (ids: Set<string>) => void;
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

interface TreeSearchState {
  includedIds: Set<string>;
  matchedIds: Set<string>;
  parentIds: Set<string>;
}

/**
 * 收集所有拥有子节点的 ID
 */
function collectParentIds<T extends { id: string; children?: T[] }>(data: T[]): Set<string> {
  const ids = new Set<string>();

  for (const node of data) {
    if (node.children && node.children.length > 0) {
      ids.add(node.id);
      for (const childId of collectParentIds(node.children)) {
        ids.add(childId);
      }
    }
  }

  return ids;
}

/**
 * 统计树中全部节点数量
 */
function countTreeNodes<T extends { id: string; children?: T[] }>(data: T[]): number {
  return data.reduce(
    (total, node) => total + 1 + (node.children ? countTreeNodes(node.children) : 0),
    0,
  );
}

/**
 * 收集搜索匹配节点及其祖先节点
 */
function collectSearchState<T extends { id: string; children?: T[] }>(
  data: T[],
  query: string,
  getSearchText: (row: T) => string,
  state: TreeSearchState,
): boolean {
  let hasMatch = false;

  for (const node of data) {
    const selfMatched = getSearchText(node).toLocaleLowerCase().includes(query);
    if (selfMatched) state.matchedIds.add(node.id);

    const childMatched = node.children
      ? collectSearchState(node.children, query, getSearchText, state)
      : false;

    if (selfMatched || childMatched) state.includedIds.add(node.id);
    if (childMatched) state.parentIds.add(node.id);
    hasMatch ||= selfMatched || childMatched;
  }

  return hasMatch;
}

/**
 * 递归将树扁平化为当前可见列表
 */
function flattenTree<T extends { id: string; children?: T[] }>(
  data: T[],
  expandedIds: Set<string>,
  includedIds?: Set<string>,
  level = 0,
): FlattenTreeItem<T>[] {
  const result: FlattenTreeItem<T>[] = [];

  for (const node of data) {
    if (includedIds && !includedIds.has(node.id)) continue;

    const visibleChildren = includedIds
      ? node.children?.filter((child) => includedIds.has(child.id))
      : node.children;
    const hasChildren = Boolean(visibleChildren && visibleChildren.length > 0);
    const isExpanded = expandedIds.has(node.id);

    result.push({
      item: node,
      level,
      hasChildren,
      isExpanded,
    });

    if (hasChildren && isExpanded && node.children) {
      result.push(...flattenTree(node.children, expandedIds, includedIds, level + 1));
    }
  }

  return result;
}

/**
 * 高亮文本中的搜索命中内容
 */
function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;

  const normalizedText = text.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(query);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    parts.push(
      <mark
        key={`match-${matchIndex}`}
        className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/30"
      >
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>,
    );
    cursor = matchIndex + query.length;
    matchIndex = normalizedText.indexOf(query, cursor);
  }

  if (parts.length === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * 递归高亮 ReactNode 中的文本，不修改原有节点结构
 */
function highlightNode(node: ReactNode, query: string): ReactNode {
  if (!query) return node;
  if (typeof node === 'string') return highlightText(node, query);
  if (Array.isArray(node)) return Children.map(node, (child) => highlightNode(child, query));
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.props.children === undefined) return node;
    return cloneElement(node, undefined, highlightNode(node.props.children, query));
  }
  return node;
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
  defaultExpandAll = false,
  showExpandControls = true,
  showStats = true,
  searchable = false,
  searchPlaceholder = '搜索节点...',
  getSearchText,
  onRefresh,
  isRefreshing = false,
  expandedIds: externalExpandedIds,
  onExpandedIdsChange,
  indentColumnIndex = 0,
  indentWidth = 24,
}: TreeTableProps<T>) {
  const allParentIds = useMemo(() => collectParentIds(data), [data]);
  const totalNodeCount = useMemo(() => countTreeNodes(data), [data]);
  const defaultExpandedIds = useMemo(
    () => (defaultExpandAll ? allParentIds : new Set<string>()),
    [allParentIds, defaultExpandAll],
  );

  // null 表示用户尚未操作，仍使用 defaultExpandAll 决定的初始状态
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCollapsedIds, setSearchCollapsedIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentExpandedIds = externalExpandedIds ?? internalExpandedIds ?? defaultExpandedIds;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const isSearching = searchable && normalizedSearchQuery.length > 0;

  const searchState = useMemo<TreeSearchState>(() => {
    const state: TreeSearchState = {
      includedIds: new Set(),
      matchedIds: new Set(),
      parentIds: new Set(),
    };

    if (isSearching) {
      collectSearchState(data, normalizedSearchQuery, getSearchText ?? (() => ''), state);
    }

    return state;
  }, [data, getSearchText, isSearching, normalizedSearchQuery]);

  const searchExpandedIds = useMemo(() => {
    if (!isSearching) return currentExpandedIds;

    const ids = new Set<string>();
    for (const id of searchState.parentIds) {
      if (!searchCollapsedIds.has(id)) ids.add(id);
    }
    return ids;
  }, [currentExpandedIds, isSearching, searchCollapsedIds, searchState.parentIds]);

  const expandableParentIds = isSearching ? searchState.parentIds : allParentIds;

  const isAllExpanded = useMemo(
    () =>
      expandableParentIds.size > 0 &&
      [...expandableParentIds].every((id) => searchExpandedIds.has(id)),
    [expandableParentIds, searchExpandedIds],
  );

  const visibleList = useMemo(() => {
    return flattenTree(data, searchExpandedIds, isSearching ? searchState.includedIds : undefined);
  }, [data, isSearching, searchExpandedIds, searchState.includedIds]);

  const updateExpandedIds = (next: Set<string>) => {
    if (externalExpandedIds !== undefined) {
      onExpandedIdsChange?.(next);
    } else {
      setInternalExpandedIds(next);
    }
  };

  const handleToggle = (id: string) => {
    if (isSearching) {
      setSearchCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }

    const next = new Set(currentExpandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateExpandedIds(next);
  };

  const handleToggleExpandAll = () => {
    if (isSearching) {
      setSearchCollapsedIds(isAllExpanded ? new Set(expandableParentIds) : new Set());
      return;
    }

    updateExpandedIds(isAllExpanded ? new Set() : new Set(allParentIds));
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchCollapsedIds(new Set());
  };

  const clearSearch = () => handleSearchChange('');

  useEffect(() => {
    if (!searchable) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.key === '/' && !isEditable && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        setSearchCollapsedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, searchable]);

  const totalSpan =
    columns.reduce((sum, c) => sum + (c.span || 1), 0) + (actions ? actionsSpan : 0);
  const showToolbar = searchable || showStats || showExpandControls || Boolean(onRefresh);
  const statsSummary = `共 ${totalNodeCount} 个${
    isSearching ? ` · 匹配 ${searchState.matchedIds.size} 个` : ''
  } · 当前显示 ${visibleList.length} 个`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {showToolbar && (
          <div className="flex min-w-0 flex-nowrap items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4">
            {searchable && (
              <div className="relative min-w-0 flex-1 sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-9 pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="清空搜索"
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {showStats && (
              <span
                className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                aria-live="polite"
                title={statsSummary}
              >
                <span className="hidden md:inline">{statsSummary}</span>
                <span className="md:hidden">
                  {visibleList.length}/{totalNodeCount}
                </span>
              </span>
            )}

            <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1">
              {showExpandControls && expandableParentIds.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleExpandAll}
                  aria-label={isAllExpanded ? '折叠全部节点' : '展开全部节点'}
                  title={isAllExpanded ? '折叠全部节点' : '展开全部节点'}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">
                    {isAllExpanded ? '全部折叠' : '全部展开'}
                  </span>
                </Button>
              )}
              {onRefresh && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  aria-label="刷新"
                  title="刷新"
                >
                  <RefreshCw
                    className={cn('h-3.5 w-3.5 sm:mr-1.5', isRefreshing && 'animate-spin')}
                  />
                  <span className="hidden sm:inline">刷新</span>
                </Button>
              )}
            </div>
          </div>
        )}

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
            ) : visibleList.length === 0 && isSearching ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                <span>没有找到与“{searchQuery.trim()}”相关的节点</span>
                <Button type="button" variant="link" size="sm" onClick={clearSearch}>
                  清除搜索
                </Button>
              </div>
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
                          const highlightedContent = isSearching
                            ? highlightNode(cellContent, normalizedSearchQuery)
                            : cellContent;

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
                                  <div className="min-w-0 flex-1 truncate">
                                    {highlightedContent}
                                  </div>
                                </div>
                              ) : (
                                highlightedContent
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
