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

  return useMutation<ApiResponse<AuthResponse>, Error, LoginFormData & { captchaId: string }>({
    mutationFn: (data) => post<AuthResponse>('/api/auth/login', data),
    onSuccess: (response) => {
      setAuth(response.data.user);
      router.push(ROUTES.DASHBOARD);
    },
  });
}

/** Register hook */
export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation<ApiResponse<AuthResponse>, Error, Omit<RegisterFormData, 'confirmPassword'> & { captchaId: string }>({
    mutationFn: (data) => post<AuthResponse>('/api/auth/register', data),
    onSuccess: (response) => {
      setAuth(response.data.user);
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
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    // 后端负责拉黑 JWT 并清除 HttpOnly/CSRF Cookie。
    try {
      await post('/api/auth/logout');
    } catch {
      // 静默失败，不影响清理本地非敏感状态
    }
    // 再清本地状态
    clearAuth();
    queryClient.clear();
    router.push(ROUTES.LOGIN);
  };
}
