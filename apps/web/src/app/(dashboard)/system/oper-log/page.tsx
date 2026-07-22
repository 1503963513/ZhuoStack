'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildUrl } from '@/lib/utils';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { useDict } from '@/hooks/use-dict';
import { useConfirm } from '@/hooks/use-confirm';
import { getErrorMessage } from '@/lib/utils';

interface OperLog {
  id: string;
  title: string;
  businessType: number;
  method: string;
  requestMethod: string;
  url: string;
  ip: string;
  operName: string | null;
  status: number;
  jsonResult: string | null;
  errorMsg: string | null;
  operTime: string;
}

interface PaginatedOperLogs {
  data: OperLog[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

export default function OperLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [title, setTitle] = useState('');
  const debouncedTitle = useDebounce(title, 300);
  const { labelMap: businessTypeMap } = useDict('sys_business_type');
  const { labelMap: operStatusMap } = useDict('sys_oper_status');
  const { confirm, ConfirmDialog } = useConfirm();
  const { data, isLoading, refetch } = useApiQuery<PaginatedOperLogs>(
    ['oper-logs', String(page), String(pageSize), debouncedTitle],
    buildUrl('/api/log/oper', { page, pageSize, title: debouncedTitle || undefined }),
  );

  const handleClear = async () => {
    const ok = await confirm({ description: '确定要清空所有操作日志吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      const { del } = await import('@/lib/api-client');
      await del('/api/log/oper');
      toast.success('操作日志已清空');
      refetch();
    } catch (error: unknown) {
      toast.error('清空失败', { description: getErrorMessage(error) });
    }
  };

  const logs = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const columns: Column<OperLog>[] = [
    { label: '操作标题', key: 'title', span: 2 },
    {
      label: '业务类型', span: 2,
      render: (row) => <Badge variant="outline">{businessTypeMap[String(row.businessType)] || '其他'}</Badge>,
    },
    {
      label: '请求方式', span: 2,
      render: (row) => <Badge variant="secondary">{row.requestMethod}</Badge>,
    },
    { label: '操作人', span: 2, render: (row) => <span>{row.operName || '-'}</span> },
    {
      label: '状态', span: 1,
      render: (row) => (
        <Badge variant={row.status === 1 ? 'default' : 'destructive'}>
          {operStatusMap[String(row.status)] || (row.status === 1 ? '成功' : '失败')}
        </Badge>
      ),
    },
    {
      label: '操作时间', span: 3,
      render: (row) => <span className="text-muted-foreground">{new Date(row.operTime).toLocaleString('zh-CN')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作日志"
        description="记录系统操作行为"
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> 刷新
            </Button>
            <PermissionButton perm="log:oper:delete" variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" /> 清空
            </PermissionButton>
          </>
        }
      />

      <Input
        placeholder="搜索操作标题"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyText="暂无操作日志"
      />

      {pagination && (
        <Pagination
          page={page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}
