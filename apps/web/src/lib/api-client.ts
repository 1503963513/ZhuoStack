import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

// 直接请求后端 API（静态站点无 Node.js 服务端，不做代理）
// 开发环境 .env.local 设置 NEXT_PUBLIC_API_URL=http://localhost:3100
// 生产环境通过 Nginx 同域反向代理，可设为空或后端地址
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/** 防止 401 时多次跳转 */
let isRedirecting = false;

/** Create axios instance with default config */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
  });

  // Request interceptor: attach JWT token from localStorage
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('auth-storage');
          if (stored) {
            const { state } = JSON.parse(stored) as {
              state: { token: string | null };
            };
            if (state?.token) {
              config.headers.Authorization = `Bearer ${state.token}`;
            }
          }
        } catch {
          // Ignore parsing errors
        }
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor: handle 401 and extract backend error message
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && typeof window !== 'undefined' && !isRedirecting) {
        isRedirecting = true;
        // 提取后端错误信息并弹出提示
        const message = error.response?.data?.message || '登录已过期，请重新登录';
        toast.error(message);
        // 清除 localStorage 和 Cookie
        localStorage.removeItem('auth-storage');
        document.cookie = 'auth-token=; path=/; max-age=0';
        // 延迟跳转，让 toast 显示一会儿
        setTimeout(() => {
          window.location.replace('/login');
        }, 1500);
      }

      // 从后端响应体中提取 message，替换 Axios 默认错误信息
      const backendMessage = error.response?.data?.message;
      if (backendMessage) {
        error.message = backendMessage;
      }

      return Promise.reject(error);
    },
  );

  return client;
}

const apiClient = createApiClient();

/** Typed GET request */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
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
