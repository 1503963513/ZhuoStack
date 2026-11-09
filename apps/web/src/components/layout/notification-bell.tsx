'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/stores/notification-store';
import { useNotification } from '@/hooks/use-notification';

/** 顶栏通知铃铛：展示未读红点，点击切换抽屉 */
export function NotificationBell({ className }: { className?: string }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const toggleDrawer = useNotificationStore((s) => s.toggleDrawer);
  const { fetchUnreadCount } = useNotification();

  // 初始化时拉取一次未读计数
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className || "relative"}
      onClick={toggleDrawer}
      aria-label="通知中心"
    >
      <Bell className="h-5 w-5" />
      {unreadCount.total > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
          {unreadCount.total > 99 ? '99+' : unreadCount.total}
        </span>
      )}
    </Button>
  );
}
