'use client';

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  X,
  Megaphone,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotificationStore } from '@/stores/notification-store';
import { useNotification } from '@/hooks/use-notification';
import { notificationControllerFindAll } from '@/api/generated/endpoints/notification/notification';

/** 格式化时间为友好文本 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;

  return date.toLocaleDateString('zh-CN');
}

/** 通知类型对应的图标和颜色 */
function getTypeConfig(type: string) {
  switch (type) {
    case 'announcement':
      return {
        icon: Megaphone,
        label: '公告',
        className: 'text-amber-500',
        badgeVariant: 'outline' as const,
      };
    case 'system':
    default:
      return {
        icon: Info,
        label: '系统',
        className: 'text-blue-500',
        badgeVariant: 'secondary' as const,
      };
  }
}

/** 通知抽屉面板 */
export function NotificationDrawer() {
  const drawerOpen = useNotificationStore((s) => s.drawerOpen);
  const setDrawerOpen = useNotificationStore((s) => s.setDrawerOpen);
  const recentNotifications = useNotificationStore((s) => s.recentNotifications);
  const setRecentNotifications = useNotificationStore((s) => s.setRecentNotifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { markAsRead, markAllAsRead, removeNotification } = useNotification();
  const panelRef = useRef<HTMLDivElement>(null);

  // 打开抽屉时加载最近通知
  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationControllerFindAll({ page: 1, pageSize: 20 });
      if (res.data?.data) {
        setRecentNotifications(res.data.data);
      }
    } catch {
      // 静默失败
    }
  }, [setRecentNotifications]);

  useEffect(() => {
    if (drawerOpen) {
      loadNotifications();
    }
  }, [drawerOpen, loadNotifications]);

  // 点击外部关闭
  useEffect(() => {
    if (!drawerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // 检查是否点击了铃铛按钮（避免点铃铛关闭又立即打开）
        const target = e.target as HTMLElement;
        if (target.closest('[aria-label="通知中心"]')) return;
        setDrawerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [drawerOpen, setDrawerOpen]);

  // Escape 关闭
  useEffect(() => {
    if (!drawerOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-16 top-14 z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="text-sm font-semibold">通知中心</span>
          {unreadCount.total > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              {unreadCount.total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount.total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全部已读
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="max-h-[460px] overflow-y-auto">
        {recentNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">暂无通知</p>
          </div>
        ) : (
          recentNotifications.map((notification) => {
            const typeConfig = getTypeConfig(notification.type);
            const TypeIcon = typeConfig.icon;

            return (
              <div
                key={notification.id}
                className={`group relative border-b px-4 py-3 transition-colors hover:bg-accent/50 ${
                  !notification.isRead ? 'bg-accent/20' : ''
                }`}
              >
                <div className="flex gap-3">
                  {/* 类型图标 */}
                  <div className={`mt-0.5 shrink-0 ${typeConfig.className}`}>
                    <TypeIcon className="h-4 w-4" />
                  </div>

                  {/* 内容 */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`text-sm font-medium leading-tight ${
                          !notification.isRead ? '' : 'text-muted-foreground'
                        }`}
                      >
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.content}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={typeConfig.badgeVariant} className="h-4 px-1 text-[10px]">
                        {typeConfig.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => markAsRead(notification.id)}
                        title="标记已读"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => removeNotification(notification.id)}
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* 底部查看全部链接 */}
      <div className="border-t p-2 text-center">
        <Link
          href="/notifications"
          onClick={() => setDrawerOpen(false)}
          className="text-xs text-primary hover:underline"
        >
          查看全部通知历史 →
        </Link>
      </div>
    </div>
  );
}
