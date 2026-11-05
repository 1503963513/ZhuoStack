'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageTabs } from '@/components/layout/page-tabs';
import { Loading } from '@/components/common/loading';
import { ROUTES } from '@/lib/constants';
import { useNotificationStream } from '@/hooks/use-notification-stream';

const subscribeToHydration = (onStoreChange: () => void) =>
  useAuthStore.persist.onFinishHydration(onStoreChange);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push(ROUTES.LOGIN);
    }
  }, [hydrated, isAuthenticated, router]);

  // hydrate 前显示 loading，避免闪跳
  if (!hydrated || !isAuthenticated) {
    return <Loading fullscreen />;
  }

  return <DashboardContent>{children}</DashboardContent>;
}

/** 已认证后渲染的内容，SSE 连接在此建立 */
function DashboardContent({ children }: { children: React.ReactNode }) {
  // 建立 SSE 实时通知连接
  useNotificationStream();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <PageTabs />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
