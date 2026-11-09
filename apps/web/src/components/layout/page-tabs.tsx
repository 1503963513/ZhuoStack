'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTabsStore, type PageTabItem } from '@/stores/tabs-store';
import { useI18n } from '@/hooks/use-i18n';
import { authControllerGetUserMenus } from '@/api/generated/endpoints/auth/auth';
import type { UserMenuTreeNodeDto } from '@/api/generated/models';
import { cn } from '@/lib/utils';
import {
  X,
  MoreVertical,
  RotateCw,
  MinusCircle,
  ArrowRightToLine,
  XCircle,
  LayoutDashboard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// 极少数不在左侧菜单树中的特殊系统独立页面兜底映射
const FALLBACK_STATIC_TITLES: Record<string, string> = {
  '/profile': '个人资料',
  '/dashboard': '仪表盘',
};

export function PageTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, locale } = useI18n();

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    updateTabTitle,
  } = useTabsStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 从 React Query 缓存中直接读取用户菜单树（命中与 Sidebar 相同的缓存，无额外网络请求）
  const { data: menuResponse } = useQuery({
    queryKey: ['user-menus'],
    queryFn: () => authControllerGetUserMenus(),
  });

  // 递归解析菜单树构建动态路由标题映射 Map<path, name>
  const menuTitleMap = useMemo(() => {
    const map = new Map<string, string>();

    const flatten = (items: UserMenuTreeNodeDto[]) => {
      for (const item of items) {
        if (item.path && item.name) {
          map.set(item.path, item.name);
        }
        if (item.children?.length) {
          flatten(item.children);
        }
      }
    };

    if (menuResponse?.data) {
      flatten(menuResponse.data);
    }
    return map;
  }, [menuResponse]);

  /** 动态解析标签标题并应用国际化 */
  const resolveTitle = useCallback(
    (targetPath: string, targetParams?: URLSearchParams | null): string => {
      // 1. 优先尝试从国际化字典解析路径
      const i18nTitle = t(`menu.${targetPath}`, '');
      if (i18nTitle) {
        if (targetPath === '/monitor/jobs/logs' && targetParams) {
          const jobName = targetParams.get('jobName');
          if (jobName) return `${i18nTitle} (${jobName})`;
        }
        return i18nTitle;
      }

      // 2. 从动态菜单树中匹配
      let title = menuTitleMap.get(targetPath);

      // 3. 匹配兜底特殊静态页面（如个人资料）
      if (!title) {
        title = FALLBACK_STATIC_TITLES[targetPath];
      }

      if (title) {
        const translated = t(`menu.${title}`, '');
        if (translated) title = translated;
      }

      // 4. 针对带有动态参数的子页面定制化追加
      if (targetPath === '/monitor/jobs/logs' && targetParams) {
        const jobName = targetParams.get('jobName');
        if (jobName) return `${title || '调度日志'} (${jobName})`;
      }

      // 5. 若未匹配到，则美化路径末段作为兜底名称（例如 /system/my-tool -> My Tool）
      if (!title) {
        const segments = targetPath.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        title = last ? last.charAt(0).toUpperCase() + last.slice(1) : t('common.loading', '新标签页');
      }

      return title;
    },
    [menuTitleMap, t],
  );

  // 鼠标悬停标签时提前预取该页面基础路由资源
  const handlePrefetch = useCallback(
    (path: string) => {
      if (path && path.startsWith('/')) {
        router.prefetch(path);
      }
    },
    [router],
  );

  // 1. 路由变化或语言变化时自动记录/更新当前标签
  useEffect(() => {
    if (!pathname || pathname === '/login' || pathname === '/register') return;

    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
    const title = resolveTitle(pathname, searchParams);

    addTab({
      id: fullPath,
      title,
      path: pathname,
      fullPath,
      icon: pathname === '/dashboard' ? 'LayoutDashboard' : undefined,
    });
  }, [pathname, searchParams, addTab, resolveTitle]);

  // 2. 菜单树加载完成、后台菜单更名或语言切换时，同步刷新已打开标签
  useEffect(() => {
    tabs.forEach((tab) => {
      const queryIndex = tab.fullPath.indexOf('?');
      const query = queryIndex >= 0 ? tab.fullPath.slice(queryIndex + 1) : '';
      const translated = resolveTitle(tab.path, new URLSearchParams(query));
      if (translated && translated !== tab.title) {
        updateTabTitle(tab.id, translated);
      }
    });
  }, [locale, menuTitleMap, resolveTitle, tabs, updateTabTitle]);

  // 3. 激活标签变化时自动将该标签滚动至可视区域
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.querySelector(
      `[data-tab-id="${activeTabId}"]`,
    ) as HTMLElement | null;

    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTabId]);

  // 支持鼠标滚轮横向滚动
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollContainerRef.current && e.deltaY !== 0) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="sticky top-16 z-20 flex h-10 w-full items-center border-b bg-background/95 backdrop-blur px-4 select-none">
      {/* 水平可滚动标签列表 */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab: PageTabItem) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onMouseEnter={() => handlePrefetch(tab.path)}
              onAuxClick={(e) => {
                if (e.button === 1 && tab.closable) {
                  e.preventDefault();
                  closeTab(tab.id, handleNavigate);
                }
              }}
              className={cn(
                'group relative flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all cursor-pointer border',
                isActive
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-xs'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
              )}
            >
              <Link
                href={tab.fullPath}
                prefetch={true}
                className="flex items-center gap-1.5 outline-hidden"
              >
                {tab.path === '/dashboard' && (
                  <LayoutDashboard className="h-3 w-3 shrink-0" />
                )}
                <span className="max-w-[130px] truncate">{tab.title}</span>
              </Link>

              {tab.closable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id, handleNavigate);
                  }}
                  className="rounded-xs p-0.5 opacity-60 hover:opacity-100 hover:bg-background/80 transition-opacity"
                  title={t('tabs.closeTab', '关闭标签')}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 右侧快捷操作菜单 */}
      <div className="relative shrink-0 pl-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            title={t('tabs.actions', '标签页操作')}
            aria-label={t('tabs.actions', '标签页操作')}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={handleRefresh} className="cursor-pointer">
              <RotateCw className="mr-2 h-3.5 w-3.5" />
              {t('tabs.refreshCurrent', '刷新当前页')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => closeOthers(activeTabId, handleNavigate)}
              className="cursor-pointer"
            >
              <MinusCircle className="mr-2 h-3.5 w-3.5" />
              {t('tabs.closeOthers', '关闭其他标签')}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => closeRight(activeTabId, handleNavigate)}
              className="cursor-pointer"
            >
              <ArrowRightToLine className="mr-2 h-3.5 w-3.5" />
              {t('tabs.closeRight', '关闭右侧标签')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => closeAll(handleNavigate)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              {t('tabs.closeAll', '关闭全部标签')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
