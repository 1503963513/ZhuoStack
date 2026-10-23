import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './api-client';

/**
 * Orval 自定义请求适配器：
 * 接入带有 HttpOnly Cookie、CSRF Token、401 拦截处理的现有 Axios 客户端
 */
export const customInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const response = await apiClient({
    ...config,
    ...options,
  });
  return response.data;
};

export default customInstance;
