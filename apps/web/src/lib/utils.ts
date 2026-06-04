import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 拼接文件完整地址（静态站点无代理，需加上后端地址前缀）
 *
 * @example
 * fileUrl('/files/2026/06/04/abc.png')
 * // → 'http://localhost:3100/files/2026/06/04/abc.png'（开发环境）
 * // → '/files/2026/06/04/abc.png'（生产环境，Nginx 同域代理时留空）
 */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base}${path}`;
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
