'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * 公共分页组件
 *
 * @example
 * // 基础用法
 * <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
 *
 * // 完整用法（含 pageSize 切换和手动输入页码）
 * <Pagination
 *   page={page}
 *   totalPages={pagination.totalPages}
 *   total={pagination.total}
 *   pageSize={pageSize}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const [inputPage, setInputPage] = useState(String(page));

  useEffect(() => {
    setInputPage(String(page));
  }, [page]);

  if (totalPages <= 1 && !onPageSizeChange) return null;

  const handleJump = () => {
    const num = parseInt(inputPage, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    } else {
      setInputPage(String(page));
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {/* 左侧：总数 + pageSize 选择 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {total !== undefined && <span>共 {total} 条</span>}
        {onPageSizeChange && (
          <Select
            value={String(pageSize || 10)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} 条
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 右侧：翻页 + 页码跳转 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </Button>

        <div className="flex items-center gap-1">
          <Input
            className="h-8 w-12 text-center"
            value={inputPage}
            onChange={(e) => setInputPage(e.target.value)}
            onBlur={handleJump}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
          />
          <span className="text-sm text-muted-foreground">/ {totalPages}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
