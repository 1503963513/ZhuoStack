'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { useDict } from '@/hooks/use-dict';
import { buildUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { Pagination } from '@/components/common/pagination';
import { PermissionButton } from '@/components/common/permission-button';

interface LoginLog {
  id: string;
  username: string;
  ip: string;
  location: string | null;
  browser: string | null;
  os: string | null;
  status: number;
  msg: string | null;
  loginTime: string;
}

export default function LoginLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [username, setUsername] = useState('');
  const debouncedUsername = useDebounce(username, 300);
  const { labelMap: operStatusMap } = useDict('sys_oper_status');
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading, refetch } = useApiQuery<any>(
    ['login-logs', String(page), String(pageSize), debouncedUsername],
    buildUrl('/api/log/login', { page, pageSize, username: debouncedUsername || undefined }),
  );

  const handleClear = async () => {
    const ok = await confirm({ description: '确定要清空所有登录日志吗？', variant: 'destructive' });
    if (!ok) return;
    try {
      const { del } = await import('@/lib/api-client');
      await del('/api/log/login');
      toast.success('登录日志已清空');
      refetch();
    } catch (err: any) {
      toast.error('清空失败', { description: err.message });
    }
  };

  const logs = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  const columns: Column<LoginLog>[] = [
    { label: '用户名', key: 'username', span: 2 },
    { label: 'IP 地址', span: 2, render: (row) => <span className="font-mono text-sm">{row.ip}</span> },
    { label: '浏览器', span: 2, render: (row) => <span className="text-muted-foreground">{row.browser || '-'}</span> },
    { label: '操作系统', span: 2, render: (row) => <span className="text-muted-foreground">{row.os || '-'}</span> },
    {
      label: '状态', span: 1,
      render: (row) => (
        <Badge variant={row.status === 1 ? 'default' : 'destructive'}>
          {operStatusMap[String(row.status)] || (row.status === 1 ? '成功' : '失败')}
        </Badge>
      ),
    },
    {
      label: '登录时间', span: 3,
      render: (row) => <span className="text-muted-foreground">{new Date(row.loginTime).toLocaleString('zh-CN')}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="登录日志"
        description="记录用户登录行为"
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> 刷新
            </Button>
            <PermissionButton perm="log:login:delete" variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" /> 清空
            </PermissionButton>
          </>
        }
      />

      <Input
        placeholder="搜索用户名"
        value={username}
        onChange={(e) => { setUsername(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyText="暂无登录日志"
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
