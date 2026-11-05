import { create } from 'zustand';

/** 通知项 */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  userId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  isRead: boolean;
  readAt?: string | null;
  bizType?: string | null;
  bizId?: string | null;
  status?: string | null;
  remark?: string | null;
  createdAt: string;
}

/** 未读计数 */
export interface UnreadCount {
  total: number;
  announcement: number;
  system: number;
}

interface NotificationState {
  /** 未读计数 */
  unreadCount: UnreadCount;
  /** 最近收到的实时通知（用于抽屉展示，最多保留 50 条） */
  recentNotifications: NotificationItem[];
  /** 抽屉是否打开 */
  drawerOpen: boolean;

  setUnreadCount: (count: UnreadCount) => void;
  addNotification: (notification: NotificationItem) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  /** 全量刷新通知列表（从 API 加载后调用） */
  setRecentNotifications: (notifications: NotificationItem[]) => void;
}

const MAX_RECENT = 50;

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: { total: 0, announcement: 0, system: 0 },
  recentNotifications: [],
  drawerOpen: false,

  setUnreadCount: (count) => set({ unreadCount: count }),

  addNotification: (notification) =>
    set((state) => ({
      recentNotifications: [
        notification,
        ...state.recentNotifications,
      ].slice(0, MAX_RECENT),
    })),

  removeNotification: (id) =>
    set((state) => ({
      recentNotifications: state.recentNotifications.filter((n) => n.id !== id),
    })),

  markAsRead: (id) =>
    set((state) => ({
      recentNotifications: state.recentNotifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      unreadCount: { total: 0, announcement: 0, system: 0 },
      recentNotifications: state.recentNotifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt || new Date().toISOString(),
      })),
    })),

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),

  setRecentNotifications: (notifications) =>
    set({ recentNotifications: notifications.slice(0, MAX_RECENT) }),
}));
