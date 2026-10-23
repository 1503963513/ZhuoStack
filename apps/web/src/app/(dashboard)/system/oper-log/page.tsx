'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useDict } from '@/hooks/use-dict';
import { useConfirm } from '@/hooks/use-confirm';
import { getErrorMessage } from '@/lib/utils';
import {
  logControllerGetOperLogs,
  logControllerClearOperLogs,
} from '@/api/generated/endpoints/系统-日志管理/系统-日志管理';
import type { OperLogItemDto } from '@/api/generated/models';

export default function OperLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [title, setTitle] = useState('');
  const debouncedTitle = useDebounce(title, 300);
  const { labelMap: businessTypeMap } = useDict('sys_business_type');
  const { labelMap: operStatusMap } = useDict('sys_oper_status');
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['oper-logs', page, pageSize, debouncedTitle],
    queryFn: () =>
      logControllerGetOperLogs({
        page,
        pageSize,
        title: debouncedTitle || undefined,
      }),
  });

  const handleClear = async () => {
    const ok = await confirm({ description: '确定要清空所有操作日志吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await logControllerClearOperLogs();
      toast.success('操作日志已清空');
      refetch();
    } catch (error: unknown) {
      toast.error('清空失败', { description: getErrorMessage(error) });
    }
  };

  const logs = response?.data?.data || [];
  const pagination = response?.data?.pagination || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  };

  const columns: Column<OperLogItemDto>[] = [
    { label: '操作标题', key: 'title', span: 2 },
    {
      label: '业务类型',
      span: 2,
      render: (row) => (
        <Badge variant="outline">{businessTypeMap[String(row.businessType)] || '其他'}</Badge>
      ),
    },
    {
      label: '请求方式',
      span: 1,
      render: (row) => <Badge variant="secondary">{row.requestMethod}</Badge>,
    },
    {
      label: '请求地址',
      span: 2,
      render: (row) => (
        <span
          className="font-mono text-xs text-muted-foreground truncate block"
          title={row.operUrl}
        >
          {row.operUrl}
        </span>
      ),
    },
    {
      label: '操作人 IP',
      span: 2,
      render: (row) => <span className="font-mono text-sm">{row.operIp}</span>,
    },
    {
      label: '状态',
      span: 1,
      render: (row) => (
        <Badge variant={row.status === 1 ? 'default' : 'destructive'}>
          {operStatusMap[String(row.status)] || (row.status === 1 ? '成功' : '失败')}
        </Badge>
      ),
    },
    {
      label: '操作时间',
      span: 2,
      render: (row) => new Date(row.operTime).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作日志"
        description="记录系统所有关键操作行为及审计追踪"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="log:oper:delete" variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空日志
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索操作标题..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable columns={columns} data={logs} isLoading={isLoading} emptyText="暂无操作日志" />

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

      <ConfirmDialog />
    </div>
  );
}
