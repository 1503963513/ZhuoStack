'use client';

import { useState } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, RefreshCw, Database, HardDrive } from 'lucide-react';

interface CacheInfo {
  status: string;
  totalKeys: number;
  usedMemory: string;
  keys: { key: string; ttl: number; type: string }[];
}

export default function CachePage() {
  const { data, isLoading, refetch } = useApiQuery<CacheInfo>(['cache-info'], '/api/monitor/cache');
  const [deleting, setDeleting] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const handleDeleteKey = async (key: string) => {
    const ok = await confirm({ description: `确定要删除缓存键 "${key}" 吗？`, variant: 'destructive' });
    if (!ok) return;
    setDeleting(key);
    try {
      const { del } = await import('@/lib/api-client');
      await del(`/api/monitor/cache/${encodeURIComponent(key)}`);
      toast.success('删除成功');
      refetch();
    } catch (err: any) {
      toast.error('删除失败', { description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    const ok = await confirm({ description: '确定要清空所有缓存吗？此操作不可恢复！', variant: 'destructive' });
    if (!ok) return;
    try {
      const { del } = await import('@/lib/api-client');
      await del('/api/monitor/cache');
      toast.success('缓存已清空');
      refetch();
    } catch (err: any) {
      toast.error('清空失败', { description: err.message });
    }
  };

  const cacheInfo = data?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">缓存列表</h1>
          <p className="text-muted-foreground">查看和管理 Redis 缓存数据</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button variant="destructive" onClick={handleClearAll}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空缓存
          </Button>
        </div>
      </div>

      {/* 缓存概览 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">连接状态</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={cacheInfo?.status === 'connected' ? 'default' : 'destructive'}>
              {cacheInfo?.status === 'connected' ? '已连接' : '未连接'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">缓存键总数</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cacheInfo?.totalKeys ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">内存使用</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cacheInfo?.usedMemory ?? 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      {/* 缓存键列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-5">缓存键</div>
              <div className="col-span-2">类型</div>
              <div className="col-span-2">TTL</div>
              <div className="col-span-3">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : !cacheInfo?.keys || cacheInfo.keys.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无缓存数据</div>
          ) : (
            cacheInfo.keys.map((item) => (
              <div key={item.key} className="border-b px-4 py-3 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5 font-mono text-sm truncate">{item.key}</div>
                  <div className="col-span-2">
                    <Badge variant="outline">{item.type}</Badge>
                  </div>
                  <div className="col-span-2">
                    {item.ttl === -1 ? (
                      <Badge variant="secondary">永久</Badge>
                    ) : (
                      <span className="text-sm">{item.ttl}s</span>
                    )}
                  </div>
                  <div className="col-span-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKey(item.key)}
                      disabled={deleting === item.key}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  );
}
