import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 构建带查询参数的 URL，自动过滤空值
 *
 * @example
 * buildUrl('/api/user', { page: 1, pageSize: 10, search: 'test' })
 * // → '/api/user?page=1&pageSize=10&search=test'
 *
 * buildUrl('/api/user', { page: 1, search: '' })
 * // → '/api/user?page=1'
 */
export function buildUrl(base: string, params?: Record<string, string | number | undefined | null>): string {
  if (!params) return base;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return base;
  return `${base}?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`;
}
