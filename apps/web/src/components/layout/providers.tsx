'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { type ReactNode, useState, Suspense } from 'react';
import { RouteProgressBar } from '@/components/common/route-progress-bar';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 分钟内保持 fresh，避免切菜单重复 loading
            gcTime: 10 * 60 * 1000,    // 缓存数据保留 10 分钟
            refetchOnWindowFocus: false, // 切换窗口不静默 refetch
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
