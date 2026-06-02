import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 受保护的路由前缀（需要登录才能访问）
 */
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/system', '/monitor'];

/**
 * 认证页面（已登录用户应被重定向到仪表盘）
 */
const AUTH_PAGES = ['/login', '/register'];

/**
 * Next.js Edge Middleware — 服务端路由保护
 *
 * 在服务端拦截请求，检查认证 Cookie 是否存在。
 * 这解决了之前仅靠客户端 localStorage 判断导致页面 JS 代码泄露的问题。
 *
 * 注意：Cookie 中仅存储标记位（不含真实 Token），真实 Token 仍在 localStorage 中。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过静态资源和 API 路由
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // 静态文件（favicon.ico 等）
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('auth-token');
  const isAuthenticated = !!authCookie?.value;

  // 受保护路由：未认证 → 重定向到登录页
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 认证页面：已认证 → 重定向到仪表盘
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page);
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // 匹配所有路由，除了 _next/static, _next/image, favicon
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
