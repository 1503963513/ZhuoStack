'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
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
import { RefreshCw, Trash2, Eye, FileText, User, Globe, Clock, AlertTriangle } from 'lucide-react';
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

  const [selectedLog, setSelectedLog] = useState<OperLogItemDto | null>(null);

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
    const ok = await confirm({
      description: '确定要清空所有操作日志吗？此操作不可恢复。',
      variant: 'destructive',
    });
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
    {
      label: '操作标题',
      key: 'title',
      span: 2,
      render: (row) => <span className="font-semibold text-sm">{row.title}</span>,
    },
    {
      label: '业务类型',
      span: 2,
      render: (row) => (
        <Badge variant="outline">{businessTypeMap[String(row.businessType)] || '其他'}</Badge>
      ),
    },
    {
      label: '操作人员',
      span: 1,
      render: (row) => <span className="text-sm font-medium">{row.operName || '-'}</span>,
    },
    {
      label: '方式',
      span: 1,
      render: (row) => <Badge variant="secondary">{row.requestMethod}</Badge>,
    },
    {
      label: '请求地址',
      span: 2,
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground truncate block" title={row.url}>
          {row.url}
        </span>
      ),
    },
    {
      label: '操作人 IP',
      span: 2,
      render: (row) => <span className="font-mono text-sm">{row.ip || '-'}</span>,
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
      render: (row) => new Date(row.operTime).toLocaleString('zh-CN', { hour12: false }),
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
          onChange={(e) => {
            setTitle(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyText="暂无操作日志"
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

      {/* 操作日志详情弹窗 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              操作日志详情
            </DialogTitle>
            <DialogDescription>记录用户单次业务操作调用链与响应快照。</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-b pb-4">
                <div>
                  <dt className="text-xs text-muted-foreground">操作模块 / 标题</dt>
                  <dd className="font-semibold text-sm mt-0.5">{selectedLog.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">业务类型</dt>
                  <dd className="mt-0.5">
                    <Badge variant="outline">
                      {businessTypeMap[String(selectedLog.businessType)] || '其他'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> 操作人员
                  </dt>
                  <dd className="font-medium mt-0.5">{selectedLog.operName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> 操作人 IP
                  </dt>
                  <dd className="font-mono text-xs mt-0.5">{selectedLog.ip || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">请求方式</dt>
                  <dd className="mt-0.5">
                    <Badge variant="secondary">{selectedLog.requestMethod}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">操作状态</dt>
                  <dd className="mt-0.5">
                    <Badge
                      variant={selectedLog.status === 1 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {selectedLog.status === 1 ? '操作成功' : '操作异常'}
                    </Badge>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">请求地址</dt>
                  <dd className="font-mono text-xs mt-0.5 break-all text-muted-foreground">
                    {selectedLog.url}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">调用方法</dt>
                  <dd className="font-mono text-xs mt-0.5 break-all">{selectedLog.method}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> 操作时间
                  </dt>
                  <dd className="font-mono text-xs mt-0.5">
                    {new Date(selectedLog.operTime).toLocaleString('zh-CN', { hour12: false })}
                  </dd>
                </div>
              </dl>

              {/* 错误堆栈 */}
              {selectedLog.errorMsg && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    错误消息与异常信息
                  </div>
                  <pre className="p-3 rounded-md bg-destructive/10 text-destructive text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto border border-destructive/20">
                    {selectedLog.errorMsg}
                  </pre>
                </div>
              )}

              {/* 返回结果快照 */}
              {selectedLog.jsonResult && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">返回参数快照</div>
                  <pre className="p-3 rounded-md bg-muted text-xs font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.jsonResult), null, 2);
                      } catch {
                        return selectedLog.jsonResult;
                      }
                    })()}
                  </pre>
                </div>
              )}
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
