'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { useDict } from '@/hooks/use-dict';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { PermissionButton } from '@/components/common/permission-button';
import { getErrorMessage } from '@/lib/utils';
import {
  logControllerGetLoginLogs,
  logControllerClearLoginLogs,
} from '@/api/generated/endpoints/系统-日志管理/系统-日志管理';
import type { LoginLogItemDto } from '@/api/generated/models';

export default function LoginLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [username, setUsername] = useState('');
  const debouncedUsername = useDebounce(username, 300);
  const { labelMap: operStatusMap } = useDict('sys_oper_status');
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['login-logs', page, pageSize, debouncedUsername],
    queryFn: () =>
      logControllerGetLoginLogs({
        page,
        pageSize,
        username: debouncedUsername || undefined,
      }),
  });

  const handleClear = async () => {
    const ok = await confirm({ description: '确定要清空所有登录日志吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      await logControllerClearLoginLogs();
      toast.success('登录日志已清空');
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

  const columns: Column<LoginLogItemDto>[] = [
    { label: '用户名', key: 'userName', span: 2 },
    {
      label: 'IP 地址',
      span: 2,
      render: (row) => <span className="font-mono text-sm">{row.ipaddr}</span>,
    },
    {
      label: '浏览器',
      span: 2,
      render: (row) => <span className="text-muted-foreground">{row.browser || '-'}</span>,
    },
    {
      label: '操作系统',
      span: 2,
      render: (row) => <span className="text-muted-foreground">{row.os || '-'}</span>,
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
      label: '提示信息',
      span: 2,
      render: (row) => <span className="text-sm">{row.msg || '-'}</span>,
    },
    {
      label: '登录时间',
      span: 3,
      render: (row) => new Date(row.loginTime).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="登录日志"
        description="记录用户登录行为及安全审计"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <PermissionButton perm="log:login:delete" variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空日志
            </PermissionButton>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="搜索用户名..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <DataTable columns={columns} data={logs} isLoading={isLoading} emptyText="暂无登录日志" />

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
