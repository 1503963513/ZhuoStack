'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/user';

/**
 * 同步认证标记到 Cookie（供 Next.js middleware 读取）
 * Cookie 中仅存储标记位，不含真实 Token
 */
function syncAuthCookie(authenticated: boolean, token?: string): void {
  if (typeof document === 'undefined') return;

  if (authenticated && token) {
    // Cookie 有效期 7 天，与 JWT 过期时间一致
    const maxAge = 7 * 24 * 60 * 60;
    document.cookie = `auth-token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    // 清除 Cookie
    document.cookie = 'auth-token=; path=/; max-age=0';
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token: string, user: User) => {
        syncAuthCookie(true, token);
        set({ token, user, isAuthenticated: true });
      },
      clearAuth: () => {
        syncAuthCookie(false);
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'auth-storage',
    },
  ),
);
