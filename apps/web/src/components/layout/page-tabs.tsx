'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useTabsStore, type PageTabItem } from '@/stores/tabs-store';
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

// 路由路径到标签标题的中文映射表
const ROUTE_TITLE_MAP: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/profile': '个人资料',
  '/system/user': '用户管理',
  '/system/role': '角色管理',
  '/system/dept': '部门管理',
  '/system/menu': '菜单管理',
  '/system/dict': '字典管理',
  '/system/post': '岗位管理',
  '/system/file': '文件管理',
  '/system/login-log': '登录日志',
  '/system/oper-log': '操作日志',
  '/monitor/cache': '缓存监控',
  '/monitor/online': '在线用户',
  '/monitor/jobs': '定时任务',
  '/monitor/jobs/logs': '调度日志',
  '/monitor/server': '服务监控',
  '/monitor/swagger': 'API 文档',
};

/** 根据 pathname 与 searchParams 动态解析标签标题 */
function resolveTabTitle(pathname: string, searchParams: URLSearchParams): string {
  const baseTitle = ROUTE_TITLE_MAP[pathname] || '新标签页';

  // 针对带有特殊业务参数的页面动态追加标题
  if (pathname === '/monitor/jobs/logs') {
    const jobName = searchParams.get('jobName');
    if (jobName) return `调度日志 (${jobName})`;
  }

  return baseTitle;
}

export function PageTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
  } = useTabsStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 1. 路由变化时自动记录历史标签
  useEffect(() => {
    // 排除公开登录注册页
    if (!pathname || pathname === '/login' || pathname === '/register') return;

    const queryString = searchParams?.toString();
    const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
    const title = resolveTabTitle(pathname, searchParams);

    addTab({
      id: fullPath,
      title,
      path: pathname,
      fullPath,
      icon: pathname === '/dashboard' ? 'LayoutDashboard' : undefined,
    });
  }, [pathname, searchParams, addTab]);

  // 2. 激活标签变化时自动将该标签滚动至可视区域
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
    setDropdownOpen(false);
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
              onAuxClick={(e) => {
                // 鼠标中键快捷关闭标签
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
                className="flex items-center gap-1.5 outline-hidden"
              >
                {tab.path === '/dashboard' && (
                  <LayoutDashboard className="h-3 w-3 shrink-0" />
                )}
                <span className="max-w-[130px] truncate">{tab.title}</span>
              </Link>

              {/* 关闭小叉图标（不可关闭的常驻项如仪表盘不显示） */}
              {tab.closable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id, handleNavigate);
                  }}
                  className="rounded-xs p-0.5 opacity-60 hover:opacity-100 hover:bg-background/80 transition-opacity"
                  title="关闭标签"
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
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="标签页操作"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>

          {dropdownOpen && (
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={handleRefresh} className="cursor-pointer">
                <RotateCw className="mr-2 h-3.5 w-3.5" />
                刷新当前页
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  closeOthers(activeTabId, handleNavigate);
                }}
                className="cursor-pointer"
              >
                <MinusCircle className="mr-2 h-3.5 w-3.5" />
                关闭其他标签
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  closeRight(activeTabId, handleNavigate);
                }}
                className="cursor-pointer"
              >
                <ArrowRightToLine className="mr-2 h-3.5 w-3.5" />
                关闭右侧标签
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  setDropdownOpen(false);
                  closeAll(handleNavigate);
                }}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <XCircle className="mr-2 h-3.5 w-3.5" />
                关闭全部标签
              </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}
