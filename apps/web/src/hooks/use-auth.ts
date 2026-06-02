'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { post, get } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { AuthResponse } from '@/types/user';
import type { User } from '@/types/user';
import type { ApiResponse } from '@/types/api';
import type { LoginFormData } from '@/schemas/auth.schema';
import type { RegisterFormData } from '@/schemas/auth.schema';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';

/** Login hook */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation<ApiResponse<AuthResponse>, Error, LoginFormData>({
    mutationFn: (data) => post<AuthResponse>('/api/auth/login', data),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      setAuth(access_token, user);
      router.push(ROUTES.DASHBOARD);
    },
  });
}

/** Register hook */
export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation<ApiResponse<AuthResponse>, Error, Omit<RegisterFormData, 'confirmPassword'>>({
    mutationFn: (data) => post<AuthResponse>('/api/auth/register', data),
    onSuccess: (response) => {
      const { access_token, user } = response.data;
      setAuth(access_token, user);
      router.push(ROUTES.DASHBOARD);
    },
  });
}

/** Get current user profile */
export function useProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery<ApiResponse<User>, Error>({
    queryKey: ['profile'],
    queryFn: () => get<User>('/api/auth/profile'),
    enabled: isAuthenticated,
  });
}

/** Logout hook */
export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    // 先调用后端登出（Token 加入黑名单 + 清除在线记录）
    if (token) {
      try {
        const axios = (await import('axios')).default;
        const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';
        await axios.post(`${BASE_URL}/api/auth/logout`, null, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 3000,
        });
      } catch {
        // 静默失败，不影响登出
      }
    }
    // 再清本地状态
    clearAuth();
    queryClient.clear();
    router.push(ROUTES.LOGIN);
  };
}
