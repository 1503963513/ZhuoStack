'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useProgressStore } from '@/stores/progress-store';

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { visible, progress, start, done } = useProgressStore();
  const isNavigatingRef = useRef(false);

  // 1. 路由变化后结束导航进度
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      done();
    }
  }, [pathname, searchParams, done]);

  // 2. 监听点击内部链接触发路由跳转进度条
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        target.getAttribute('target') !== '_blank' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          isNavigatingRef.current = true;
          start();
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [start]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed left-0 top-0 z-[9999] h-0.5 w-full pointer-events-none bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-200 ease-out shadow-[0_0_8px_hsl(var(--primary))]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: 'width, opacity',
        }}
      />
    </div>
  );
}
