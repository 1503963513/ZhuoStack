'use client';

import { useState } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, Trash2 } from 'lucide-react';

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
  const [username, setUsername] = useState('');
  const debouncedUsername = useDebounce(username, 300);
  const { data, isLoading, refetch } = useApiQuery<any>(
    ['login-logs', String(page), debouncedUsername],
    `/api/log/login?page=${page}&pageSize=10${debouncedUsername ? `&username=${debouncedUsername}` : ''}`,
  );

  const handleClear = async () => {
    if (!confirm('确定要清空所有登录日志吗？')) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">登录日志</h1>
          <p className="text-muted-foreground">记录用户登录行为</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button variant="destructive" onClick={handleClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空
          </Button>
        </div>
      </div>

      <Input
        placeholder="搜索用户名"
        value={username}
        onChange={(e) => { setUsername(e.target.value); setPage(1); }}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">用户名</div>
              <div className="col-span-2">IP 地址</div>
              <div className="col-span-2">浏览器</div>
              <div className="col-span-2">操作系统</div>
              <div className="col-span-1">状态</div>
              <div className="col-span-3">登录时间</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无登录日志</div>
          ) : (
            logs.map((log: LoginLog) => (
              <div key={log.id} className="border-b px-4 py-3 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2 font-medium">{log.username}</div>
                  <div className="col-span-2 font-mono text-sm">{log.ip}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{log.browser || '-'}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{log.os || '-'}</div>
                  <div className="col-span-1">
                    <Badge variant={log.status === 1 ? 'default' : 'destructive'}>
                      {log.status === 1 ? '成功' : '失败'}
                    </Badge>
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">
                    {new Date(log.loginTime).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="flex items-center px-4">第 {page} / {pagination.totalPages} 页</span>
          <Button variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
