'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import type { LoginFormData, RegisterFormData } from '@/schemas/auth.schema';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import {
  authControllerLogin,
  authControllerRegister,
  authControllerGetProfile,
  authControllerLogout,
} from '@/api/generated/endpoints/auth/auth';

/** Login hook */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginFormData & { captchaId: string }) => authControllerLogin(data),
    onSuccess: (response) => {
      if (response.data?.user) {
        setAuth(response.data.user);
        router.push(ROUTES.DASHBOARD);
      }
    },
  });
}

/** Register hook */
export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: (data: Omit<RegisterFormData, 'confirmPassword'> & { captchaId: string }) =>
      authControllerRegister(data),
    onSuccess: (response) => {
      if (response.data?.user) {
        setAuth(response.data.user);
        router.push(ROUTES.DASHBOARD);
      }
    },
  });
}

/** Get current user profile */
export function useProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authControllerGetProfile(),
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
      await authControllerLogout();
    } catch {
      // 静默失败，不影响清理本地非敏感状态
    }
    // 再清本地状态
    clearAuth();
    queryClient.clear();
    router.push(ROUTES.LOGIN);
  };
}
