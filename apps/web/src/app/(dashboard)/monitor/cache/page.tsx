'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, RefreshCw, Database, HardDrive } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import {
  monitorControllerGetCacheInfo,
  monitorControllerDeleteCacheKey,
  monitorControllerClearAllCache,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';

export default function CachePage() {
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['cache-info'],
    queryFn: () => monitorControllerGetCacheInfo(),
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const handleDeleteKey = async (key: string) => {
    const ok = await confirm({
      description: `确定要删除缓存键 "${key}" 吗？`,
      variant: 'destructive',
    });
    if (!ok) return;
    setDeleting(key);
    try {
      await monitorControllerDeleteCacheKey(key);
      toast.success('删除成功');
      refetch();
    } catch (error: unknown) {
      toast.error('删除失败', { description: getErrorMessage(error) });
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      description: '确定要清空所有缓存吗？此操作不可恢复！',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await monitorControllerClearAllCache();
      toast.success('缓存已清空');
      refetch();
    } catch (error: unknown) {
      toast.error('清空失败', { description: getErrorMessage(error) });
    }
  };

  const cacheInfo = response?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">缓存列表</h1>
          <p className="text-muted-foreground">Redis 缓存状态监控与管理</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button variant="destructive" onClick={handleClearAll}>
            <Trash2 className="mr-2 h-4 w-4" />
            清空所有缓存
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">连接状态</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheInfo?.status === 'connected' ? (
                <Badge variant="default">正常运行</Badge>
              ) : (
                <Badge variant="destructive">未连接</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总键数量</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheInfo?.totalKeys ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已用内存</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheInfo?.usedMemory ?? 'N/A'}</div>
          </CardContent>
        </Card>
      </div>

      {/* 键列表 */}
      <Card>
        <CardHeader>
          <CardTitle>缓存键列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">加载中...</div>
          ) : !cacheInfo?.keys || cacheInfo.keys.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">暂无缓存键</div>
          ) : (
            <div className="divide-y">
              {cacheInfo.keys.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{item.key}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      TTL: {item.ttl === -1 ? '永久' : `${item.ttl}s`} | 大小: {item.size}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteKey(item.key)}
                    disabled={deleting === item.key}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}
