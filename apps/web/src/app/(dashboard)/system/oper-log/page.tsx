'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { buildUrl } from '@/lib/utils';
import { RefreshCw, Trash2 } from 'lucide-react';
import { PermissionButton } from '@/components/common/permission-button';
import { Pagination } from '@/components/common/pagination';
import { useDict } from '@/hooks/use-dict';
import { useConfirm } from '@/hooks/use-confirm';

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

export default function OperLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [title, setTitle] = useState('');
  const debouncedTitle = useDebounce(title, 300);
  const { labelMap: businessTypeMap } = useDict('sys_business_type');
  const { labelMap: operStatusMap } = useDict('sys_oper_status');
  const { confirm, ConfirmDialog } = useConfirm();
  const { data, isLoading, refetch } = useApiQuery<any>(
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
    } catch (err: any) {
      toast.error('清空失败', { description: err.message });
    }
  };

  const logs = data?.data?.data || [];
  const pagination = data?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">操作日志</h1>
          <p className="text-muted-foreground">记录系统操作行为</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <PermissionButton perm="log:oper:delete" variant="destructive" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空
          </PermissionButton>
        </div>
      </div>

      <Input
        placeholder="搜索操作标题"
        value={title}
        onChange={(e) => { setTitle(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">操作标题</div>
              <div className="col-span-2">业务类型</div>
              <div className="col-span-2">请求方式</div>
              <div className="col-span-2">操作人</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-3">操作时间</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无操作日志</div>
          ) : (
            logs.map((log: OperLog) => (
              <div key={log.id} className="border-b px-4 py-3 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2 font-medium">{log.title}</div>
                  <div className="col-span-2">
                    <Badge variant="outline">{businessTypeMap[String(log.businessType)] || '其他'}</Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="secondary">{log.requestMethod}</Badge>
                  </div>
                  <div className="col-span-2 text-sm">{log.operName || '-'}</div>
                  <div className="col-span-1">
                    <Badge variant={log.status === 1 ? 'default' : 'destructive'}>
                      {operStatusMap[String(log.status)] || (log.status === 1 ? '成功' : '失败')}
                    </Badge>
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">
                    {new Date(log.operTime).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
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
