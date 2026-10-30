'use client';

import { useQuery } from '@tanstack/react-query';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { RefreshCw, UserMinus, Users, Globe, Clock, Laptop } from 'lucide-react';
import { getErrorMessage, fileUrl } from '@/lib/utils';
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
        <Button variant="outline" size="icon" onClick={() => refetch()} title="刷新">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">当前在线用户数</p>
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
              {users.map((user: OnlineUserItemDto) => {
                const displayName = user.userName || user.email || '用户';
                const initial = (displayName || 'U')[0].toUpperCase();

                return (
                  <div
                    key={user.userId}
                    className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        {user.avatar && (
                          <AvatarImage src={fileUrl(user.avatar)} alt={displayName} />
                        )}
                        <AvatarFallback className="font-bold bg-primary/10 text-primary">
                          {initial}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{displayName}</span>
                          {user.email && (
                            <span className="text-xs text-muted-foreground">({user.email})</span>
                          )}
                          <Badge
                            variant="outline"
                            className="text-xs border-green-500 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                          >
                            在线
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono">
                            <Globe className="h-3.5 w-3.5" />
                            {user.ip}
                          </span>

                          {(user.browser || user.os) && (
                            <span className="flex items-center gap-1">
                              <Laptop className="h-3.5 w-3.5" />
                              {[user.browser, user.os].filter(Boolean).join(' / ')}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(user.loginTime).toLocaleString('zh-CN', { hour12: false })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleKick(user.userId, displayName)}
                      >
                        <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                        强退
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}
