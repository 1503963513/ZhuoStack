'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Trash2, Eye } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import {
  monitorControllerFindJobLogs,
  monitorControllerClearJobLogs,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';
import type { JobLogItemDto } from '@/api/generated/models';

export default function JobLogsPage() {
  const searchParams = useSearchParams();
  const initialJobName = searchParams.get('jobName') || '';

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jobName, setJobName] = useState(initialJobName);
  const [status, setStatus] = useState<string>('all');
  const debouncedJobName = useDebounce(jobName, 300);

  const [activeLog, setActiveLog] = useState<JobLogItemDto | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // 1. 获取分页执行日志
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['job-logs', page, pageSize, debouncedJobName, status],
    queryFn: () =>
      monitorControllerFindJobLogs({
        page,
        pageSize,
        jobName: debouncedJobName || undefined,
        status: status !== 'all' ? parseInt(status, 10) : undefined,
      }),
  });

  const logs = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  // 2. 清空任务日志
  const clearMutation = useMutation({
    mutationFn: () => monitorControllerClearJobLogs(),
    onSuccess: () => {
      toast.success('定时任务日志已清空');
      refetch();
    },
    onError: (err: Error) => {
      toast.error('清空失败', { description: err.message });
    },
  });

  const handleClear = async () => {
    const ok = await confirm({
      description: '确定要清空所有定时任务执行日志吗？此操作不可恢复。',
      variant: 'destructive',
    });
    if (!ok) return;
    clearMutation.mutate();
  };

  const columns: Column<JobLogItemDto>[] = [
    {
      label: '任务标识',
      span: 2,
      render: (row) => <span className="font-semibold text-sm">{row.jobName}</span>,
    },
    {
      label: '任务描述',
      span: 3,
      render: (row) => (
        <span className="text-muted-foreground text-sm">{row.description || '-'}</span>
      ),
    },
    {
      label: 'Cron 表达式',
      span: 2,
      render: (row) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.cronExpression || '-'}
        </Badge>
      ),
    },
    {
      label: '状态',
      span: 1,
      render: (row) => (
        <Badge variant={row.status === 1 ? 'default' : 'destructive'}>
          {row.status === 1 ? '成功' : '失败'}
        </Badge>
      ),
    },
    {
      label: '执行耗时',
      span: 1,
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.executionTime} ms</span>
      ),
    },
    {
      label: '触发时间',
      span: 3,
      render: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="调度日志"
        description="记录系统定时任务历史执行情况、耗时统计与异常追踪"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/monitor/jobs">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                返回任务列表
              </Button>
            </Link>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              清空日志
            </Button>
          </div>
        }
      />

      {/* 搜索过滤条 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="按任务标识筛选..."
          value={jobName}
          onChange={(e) => {
            setJobName(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />

        <Select
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="1">执行成功</SelectItem>
            <SelectItem value="0">执行失败</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyText="暂无调度日志"
        actions={(row) => (
          <div className="flex items-center gap-2">
            {row.exceptionInfo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveLog(row)}
                className="text-destructive hover:text-destructive"
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                异常信息
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground px-2">无异常</span>
            )}
          </div>
        )}
      />

      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* 异常信息详情弹窗框 */}
      <Dialog open={!!activeLog} onOpenChange={() => setActiveLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              任务 [{activeLog?.jobName}] 执行异常详情
            </DialogTitle>
            <DialogDescription>
              触发时间: {activeLog && new Date(activeLog.createdAt).toLocaleString('zh-CN')} | 耗时:{' '}
              {activeLog?.executionTime} ms
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto rounded-md bg-muted p-4 font-mono text-xs text-destructive whitespace-pre-wrap break-all">
            {activeLog?.exceptionInfo || '无异常堆栈'}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveLog(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
