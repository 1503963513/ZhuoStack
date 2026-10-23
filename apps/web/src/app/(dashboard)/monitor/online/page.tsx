'use client';

import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, UserMinus, Users, Globe, Clock } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import {
  monitorControllerGetOnlineUsers,
  monitorControllerKickUser,
} from '@/api/generated/endpoints/系统-系统监控/系统-系统监控';
import type { OnlineUserItemDto } from '@/api/generated/models';

export default function OnlinePage() {
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => monitorControllerGetOnlineUsers(),
  });
  const { confirm, ConfirmDialog } = useConfirm();

  const users = response?.data || [];

  const handleKick = async (userId: string, username: string) => {
    const ok = await confirm({
      description: `确定要强制用户 "${username}" 下线吗？`,
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await monitorControllerKickUser(userId);
      toast.success(`用户 ${username} 已被强制下线`);
      refetch();
    } catch (error: unknown) {
      toast.error('操作失败', { description: getErrorMessage(error) });
    }
  };

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
      </div>

      {/* 用户列表 */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">加载中...</div>
          ) : users.length === 0 ? (
            <div className="flex justify-center py-8 text-muted-foreground">暂无在线用户</div>
          ) : (
            <div className="divide-y">
              {users.map((user: OnlineUserItemDto) => (
                <div key={user.userId} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {(user.userName || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.userName}</span>
                        <Badge variant="outline" className="text-xs">
                          在线
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {user.ip}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(user.loginTime).toLocaleTimeString('zh-CN')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleKick(user.userId, user.userName)}
                  >
                    <UserMinus className="mr-1 h-3.5 w-3.5" />
                    强退
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
