'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useProfile } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Moon, Sun, LogOut, User } from 'lucide-react';
import { useLogout } from '@/hooks/use-auth';
import { useConfirm } from '@/hooks/use-confirm';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';

export function Header() {
  const user = useAuthStore((s) => s.user);
  const { data: profileData } = useProfile();
  const { setTheme, theme } = useTheme();
  const logout = useLogout();
  const { confirm, ConfirmDialog } = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    const ok = await confirm({ description: '确定要退出登录吗？', variant: 'destructive' });
    if (ok) logout();
  };

  const currentUser = profileData?.data || user;

  // 点击菜单外部自动关闭
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // 按 Escape 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 主题切换 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="mr-4"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">切换主题</span>
      </Button>

      {/* 用户菜单 */}
      <div className="relative" ref={menuRef}>
        <Button
          variant="ghost"
          className="relative h-8 w-8 rounded-full"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={currentUser?.avatar || undefined} alt={currentUser?.name || '用户'} />
            <AvatarFallback>{getInitials(currentUser?.name)}</AvatarFallback>
          </Avatar>
        </Button>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <div className="flex items-center gap-2 p-2">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{currentUser?.name || '用户'}</p>
                <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
              </div>
            </div>
            <div className="-mx-1 my-1 h-px bg-muted" />
            <Link
              href={ROUTES.PROFILE}
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <User className="mr-2 h-4 w-4" />
              个人资料
            </Link>
            <div className="-mx-1 my-1 h-px bg-muted" />
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </button>
          </div>
        )}
      </div>
    </header>
    <ConfirmDialog />
    </>
  );
}
