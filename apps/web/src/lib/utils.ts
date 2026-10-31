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
export function fileUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base}${path}`;
}

/**
 * 获取文件的绝对完整地址（包含协议与当前访问的完整域名/IP端口，专用于复制分享）
 *
 * @example
 * absoluteFileUrl('/files/2026/10/31/abc.png')
 * // → 'http://24.233.0.241:3000/files/2026/10/31/abc.png'
 */
export function absoluteFileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const relative = fileUrl(path) || path;
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}${relative.startsWith('/') ? '' : '/'}${relative}`;
  }
  return relative;
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
export function buildUrl(
  base: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  if (!params) return base;
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return base;
  const search = new URLSearchParams(entries.map(([key, value]) => [key, String(value)]));
  return `${base}?${search.toString()}`;
}

/** 将未知异常安全地转换为面向用户的消息。 */
export function getErrorMessage(error: unknown, fallback = '操作失败'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 安全复制文本到剪贴板
 * 支持现代 navigator.clipboard，并在非安全上下文（纯 HTTP / IP 访问）下自动平稳降级为 document.execCommand('copy')
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. 优先尝试现代安全上下文 Clipboard API（HTTPS / localhost 环境）
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 出现安全策略限制时继续执行 fallback
    }
  }

  // 2. 降级方案：创建隐藏输入框执行选中复制（兼容纯 HTTP 与所有旧浏览器）
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch {
    return false;
  }
}
