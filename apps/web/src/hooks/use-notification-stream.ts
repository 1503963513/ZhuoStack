'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useNotificationStore,
  type NotificationItem,
  type UnreadCount,
} from '@/stores/notification-store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * SSE 实时通知订阅 Hook
 * 在 Dashboard Layout 中使用，自动建立/断开连接
 */
export function useNotificationStream(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleNotification = useCallback(
    (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as NotificationItem;
        addNotification(data);
        toast.info(data.title, {
          description: data.content.length > 60
            ? data.content.slice(0, 60) + '...'
            : data.content,
          duration: 5000,
        });
      } catch {
        // 忽略格式异常的事件
      }
    },
    [addNotification],
  );

  const handleUnreadCount = useCallback(
    (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as UnreadCount;
        setUnreadCount(data);
      } catch {
        // 忽略格式异常
      }
    },
    [setUnreadCount],
  );

  const handleAnnouncementRevoked = useCallback(
    (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { id: string };
        removeNotification(data.id);
      } catch {
        // 忽略格式异常
      }
    },
    [removeNotification],
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const es = new EventSource(`${BASE_URL}/api/notifications/stream`, {
      withCredentials: true,
    });

    es.addEventListener('notification', handleNotification);
    es.addEventListener('unread-count', handleUnreadCount);
    es.addEventListener('announcement-revoked', handleAnnouncementRevoked);

    es.onerror = () => {
      // 若当前已登出，主动关闭避免无限无效重试
      if (!useAuthStore.getState().isAuthenticated) {
        es.close();
        eventSourceRef.current = null;
      }
    };

    eventSourceRef.current = es;

    return () => {
      es.removeEventListener('notification', handleNotification);
      es.removeEventListener('unread-count', handleUnreadCount);
      es.removeEventListener('announcement-revoked', handleAnnouncementRevoked);
      es.close();
      eventSourceRef.current = null;
    };
  }, [
    isAuthenticated,
    handleNotification,
    handleUnreadCount,
    handleAnnouncementRevoked,
  ]);
}
