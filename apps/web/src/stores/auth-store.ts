'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/user';
import {
  AUTH_STATE_STORAGE_KEY,
  LEGACY_AUTH_STORAGE_KEY,
} from '@/lib/constants';

// v1 曾将 JWT 持久化到 localStorage；升级后立即清除旧存储，要求用户重新登录一次。
if (typeof window !== 'undefined') {
  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user: User) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
      setUser: (user: User) => set({ user }),
    }),
    {
      name: AUTH_STATE_STORAGE_KEY,
    },
  ),
);
