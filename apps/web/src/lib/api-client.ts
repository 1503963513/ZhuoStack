import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { useAuthStore } from '@/stores/auth-store';
import { useTabsStore } from '@/stores/tabs-store';
import { useProgressStore } from '@/stores/progress-store';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf';
import { clearPublicKeyCache } from '@/lib/crypto';

// 直接请求后端 API（静态站点无 Node.js 服务端，不做代理）
// 开发环境 .env.local 设置 NEXT_PUBLIC_API_URL=http://localhost:3100
// 生产环境通过 Nginx 同域反向代理，可设为空或后端地址
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/** 防止 401 时多次跳转 */
let isRedirecting = false;

type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean; _progressStarted?: boolean };

interface ApiErrorPayload {
  message?: string;
  requestId?: string;
}

/** 并发 401 共用同一次刷新请求，避免重复轮换 Token。 */
let refreshPromise: Promise<void> | null = null;

function isAuthEntryRequest(url?: string): boolean {
  return Boolean(url && /\/(auth\/login|auth\/register|auth\/refresh)(?:\?|$)/.test(url));
}

function handleSessionExpired(message?: string): void {
  if (typeof window === 'undefined' || isRedirecting) return;
  isRedirecting = true;
  toast.error(message || '登录已过期，请重新登录');
  useAuthStore.getState().clearAuth();
  useTabsStore.getState().resetTabs();
  setTimeout(() => window.location.replace('/login'), 1500);
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${BASE_URL}/api/auth/refresh`,
        undefined,
        {
          withCredentials: true,
          withXSRFToken: true,
          xsrfCookieName: CSRF_COOKIE_NAME,
          xsrfHeaderName: CSRF_HEADER_NAME,
          timeout: 10000,
        },
      )
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Create axios instance with default config */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
    withCredentials: true,
    withXSRFToken: true,
    xsrfCookieName: CSRF_COOKIE_NAME,
    xsrfHeaderName: CSRF_HEADER_NAME,
  });

  // Request interceptor: 启动全局进度条（仅在未启动过的初次请求执行，防止重试时重复计数）
  client.interceptors.request.use((config) => {
    const retryableConfig = config as RetryableRequestConfig;
    if (typeof window !== 'undefined' && !retryableConfig._progressStarted) {
      useProgressStore.getState().start();
      retryableConfig._progressStarted = true;
    }
    return config;
  });

  // Response interceptor: handle 401 and extract backend error message
  client.interceptors.response.use(
    (response) => {
      const retryableConfig = response.config as RetryableRequestConfig | undefined;
      if (typeof window !== 'undefined' && retryableConfig?._progressStarted) {
        retryableConfig._progressStarted = false;
        useProgressStore.getState().done();
      }
      return response;
    },
    async (error: AxiosError) => {
      const status = error.response?.status;
      const requestConfig = error.config as RetryableRequestConfig | undefined;
      const isAuthenticated =
        typeof window !== 'undefined' && useAuthStore.getState().isAuthenticated;

      if (
        status === 401 &&
        isAuthenticated &&
        requestConfig &&
        !requestConfig._retry &&
        !isAuthEntryRequest(requestConfig.url)
      ) {
        requestConfig._retry = true;
        try {
          await refreshAccessToken();
          return await client.request(requestConfig);
        } catch (refreshError) {
          if (typeof window !== 'undefined' && requestConfig._progressStarted) {
            requestConfig._progressStarted = false;
            useProgressStore.getState().done();
          }
          const refreshMessage =
            (refreshError as AxiosError<{ message?: string }>).response?.data?.message ||
            '登录已过期，请重新登录';
          handleSessionExpired(refreshMessage);
          return Promise.reject(refreshError);
        }
      }

      if (typeof window !== 'undefined' && requestConfig?._progressStarted) {
        requestConfig._progressStarted = false;
        useProgressStore.getState().done();
      }

      if (
        status === 401 &&
        isAuthenticated
      ) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        handleSessionExpired(message);
      }

      // 从响应头或后端响应体中提取全链路请求关联 ID，便于排障定位
      const responseData = error.response?.data as ApiErrorPayload | undefined;
      const reqId = error.response?.headers?.['x-request-id'] || responseData?.requestId;
      if (reqId) {
        (error as AxiosError & { requestId?: string }).requestId = reqId;
      }

      // 从后端响应体中提取 message，替换 Axios 默认错误信息
      const backendMessage = responseData?.message;
      if (backendMessage) {
        error.message = backendMessage;
        if (String(backendMessage).includes('密码解密失败')) {
          clearPublicKeyCache();
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

const apiClient = createApiClient();
export { apiClient };

/** Typed GET request */
export async function get<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiClient.get<ApiResponse<T>>(url, { params });
  return response.data;
}

/** Typed POST request */
export async function post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  const response = await apiClient.post<ApiResponse<T>>(url, data);
  return response.data;
}

/** Typed PUT request */
export async function put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  const response = await apiClient.put<ApiResponse<T>>(url, data);
  return response.data;
}

/** Typed DELETE request */
export async function del<T>(url: string): Promise<ApiResponse<T>> {
  const response = await apiClient.delete<ApiResponse<T>>(url);
  return response.data;
}

export default apiClient;
