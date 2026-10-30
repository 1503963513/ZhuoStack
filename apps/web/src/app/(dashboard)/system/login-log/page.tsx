'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { useConfirm } from '@/hooks/use-confirm';
import { useDict } from '@/hooks/use-dict';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RefreshCw, Trash2, Eye, ShieldCheck, MapPin, Globe, Laptop, Clock } from 'lucide-react';
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

  const [selectedLog, setSelectedLog] = useState<LoginLogItemDto | null>(null);

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
    const ok = await confirm({
      description: '确定要清空所有登录日志吗？此操作不可恢复。',
      variant: 'destructive',
    });
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
    {
      label: '用户账号',
      span: 2,
      render: (row) => <span className="font-semibold text-sm">{row.username || '-'}</span>,
    },
    {
      label: '登录 IP',
      span: 2,
      render: (row) => <span className="font-mono text-sm">{row.ip || '-'}</span>,
    },
    {
      label: '登录地点',
      span: 2,
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.location || '未知'}</span>
      ),
    },
    {
      label: '浏览器 / 系统',
      span: 2,
      render: (row) => (
        <span
          className="text-xs text-muted-foreground truncate block"
          title={`${row.browser || ''} ${row.os || ''}`}
        >
          {[row.browser, row.os].filter(Boolean).join(' / ') || '-'}
        </span>
      ),
    },
    {
      label: '登录状态',
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
      render: (row) => (
        <span className="text-sm truncate block" title={row.msg || ''}>
          {row.msg || '-'}
        </span>
      ),
    },
    {
      label: '登录时间',
      span: 3,
      render: (row) => new Date(row.loginTime).toLocaleString('zh-CN', { hour12: false }),
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
          placeholder="搜索登录账号..."
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyText="暂无登录日志"
        actions={(row) => (
          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(row)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            详情
          </Button>
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

      {/* 登录日志详情弹窗 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              登录日志详情
            </DialogTitle>
            <DialogDescription>记录用户单次登录环境及鉴权审计结果。</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="py-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">访问标识 (ID)</dt>
                  <dd className="font-mono text-xs mt-0.5 break-all">{selectedLog.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">用户账号</dt>
                  <dd className="font-semibold mt-0.5">{selectedLog.username}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> 登录 IP 地址
                  </dt>
                  <dd className="font-mono text-xs mt-0.5">{selectedLog.ip}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> 登录地点
                  </dt>
                  <dd className="mt-0.5">{selectedLog.location || '未知地区'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Laptop className="h-3.5 w-3.5" /> 客户端环境
                  </dt>
                  <dd className="mt-0.5 text-xs">
                    {[selectedLog.browser, selectedLog.os].filter(Boolean).join(' on ') || '未知'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">登录状态</dt>
                  <dd className="mt-0.5">
                    <Badge
                      variant={selectedLog.status === 1 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {selectedLog.status === 1 ? '登录成功' : '登录失败'}
                    </Badge>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> 登录时间
                  </dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {new Date(selectedLog.loginTime).toLocaleString('zh-CN', { hour12: false })}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">响应/提示信息</dt>
                  <dd className="mt-0.5 p-2 rounded bg-muted/50 text-xs font-mono">
                    {selectedLog.msg || '无提示消息'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
