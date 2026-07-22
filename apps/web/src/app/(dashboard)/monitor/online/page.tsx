'use client';

import { useApiQuery } from '@/hooks/use-api';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, UserMinus, Users, Globe, Clock } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface OnlineUser {
  userId: string;
  username: string;
  ip: string;
  loginTime: string;
}

export default function OnlinePage() {
  const { data, isLoading, refetch } = useApiQuery<OnlineUser[]>(['online-users'], '/api/monitor/online');
  const { confirm, ConfirmDialog } = useConfirm();

  const handleKick = async (userId: string, username: string) => {
    const ok = await confirm({ description: `确定要强制用户 "${username}" 下线吗？`, variant: 'destructive' });
    if (!ok) return;
    try {
      const { del } = await import('@/lib/api-client');
      await del(`/api/monitor/online/${userId}`);
      toast.success(`用户 ${username} 已被强制下线`);
      refetch();
    } catch (error: unknown) {
      toast.error('操作失败', { description: getErrorMessage(error) });
    }
  };

  const users = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">在线用户</h1>
          <p className="text-muted-foreground">当前在线用户列表（共 {users.length} 人）</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">在线用户数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Globe className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{new Set(users.map((u) => u.ip)).size}</p>
              <p className="text-sm text-muted-foreground">不同 IP 数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Clock className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {users.length > 0
                  ? new Date(users[0].loginTime).toLocaleTimeString('zh-CN')
                  : '-'}
              </p>
              <p className="text-sm text-muted-foreground">最近登录</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 font-medium">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">用户ID</div>
              <div className="col-span-3">用户名</div>
              <div className="col-span-3">登录 IP</div>
              <div className="col-span-3">登录时间</div>
              <div className="col-span-1">操作</div>
            </div>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">加载中...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无在线用户</div>
          ) : (
            users.map((user) => (
              <div key={user.userId} className="border-b px-4 py-3 hover:bg-muted/50">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2 font-mono text-sm">{user.userId}</div>
                  <div className="col-span-3">
                    <Badge variant="outline">{user.username}</Badge>
                  </div>
                  <div className="col-span-3 font-mono text-sm">{user.ip}</div>
                  <div className="col-span-3 text-sm text-muted-foreground">
                    {new Date(user.loginTime).toLocaleString('zh-CN')}
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKick(user.userId, user.username)}
                      title="强制下线"
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
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
