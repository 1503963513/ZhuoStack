'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ROUTES, APP_NAME } from '@/lib/constants';
import {
  LayoutDashboard,
  User,
  LogOut,
  Settings,
  Building2,
  Briefcase,
  Shield,
  Menu as MenuIcon,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { useLogout } from '@/hooks/use-auth';

const navItems = [
  { href: ROUTES.DASHBOARD, label: '仪表盘', icon: LayoutDashboard },
  { href: ROUTES.PROFILE, label: '个人资料', icon: User },
];

const systemItems = [
  { href: '/system/dept', label: '部门管理', icon: Building2 },
  { href: '/system/post', label: '岗位管理', icon: Briefcase },
  { href: '/system/role', label: '角色管理', icon: Shield },
  { href: '/system/menu', label: '菜单管理', icon: MenuIcon },
  { href: '/system/dict', label: '字典管理', icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout = useLogout();
  const [systemOpen, setSystemOpen] = useState(pathname.startsWith('/system'));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-lg font-bold">{APP_NAME}</h1>
      </div>

      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        {/* 系统管理菜单 */}
        <div className="mt-2">
          <button
            onClick={() => setSystemOpen(!systemOpen)}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/system')
                ? 'text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              系统管理
            </div>
            <ChevronDown className={cn('h-4 w-4 transition-transform', systemOpen && 'rotate-180')} />
          </button>
          {systemOpen && (
            <div className="ml-4 mt-1 flex flex-col gap-1">
              {systemItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="absolute bottom-4 left-0 right-0 px-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
