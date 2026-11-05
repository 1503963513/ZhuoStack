'use client';

import { useCallback } from 'react';
import { useNotificationStore } from '@/stores/notification-store';
import {
  notificationControllerGetUnreadCount,
  notificationControllerMarkAsRead,
  notificationControllerMarkAllAsRead,
  notificationControllerRemove,
} from '@/api/generated/endpoints/notification/notification';

/**
 * 通知操作 Hook：未读计数拉取、标记已读、全部已读、删除
 * 全面遵循契约规范，使用由 Orval 生成的强类型客户端
 */
export function useNotification() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const markAsReadInStore = useNotificationStore((s) => s.markAsRead);
  const markAllAsReadInStore = useNotificationStore((s) => s.markAllAsRead);
  const removeInStore = useNotificationStore((s) => s.removeNotification);

  /** 拉取未读计数 */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationControllerGetUnreadCount();
      if (res.data) {
        setUnreadCount(res.data);
      }
    } catch {
      // 静默失败，不影响主流程
    }
  }, [setUnreadCount]);

  /** 标记单条已读 */
  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await notificationControllerMarkAsRead(id);
        markAsReadInStore(id);
        await fetchUnreadCount();
      } catch {
        // 静默失败
      }
    },
    [markAsReadInStore, fetchUnreadCount],
  );

  /** 全部标记已读 */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationControllerMarkAllAsRead();
      markAllAsReadInStore();
      await fetchUnreadCount();
    } catch {
      // 静默失败
    }
  }, [markAllAsReadInStore, fetchUnreadCount]);

  /** 删除通知 */
  const removeNotification = useCallback(
    async (id: string) => {
      try {
        await notificationControllerRemove(id);
        removeInStore(id);
        await fetchUnreadCount();
      } catch {
        // 静默失败
      }
    },
    [removeInStore, fetchUnreadCount],
  );

  return { fetchUnreadCount, markAsRead, markAllAsRead, removeNotification };
}
