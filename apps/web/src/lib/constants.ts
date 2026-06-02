export const APP_NAME = 'NodeJs 全栈模板';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
} as const;

// Zustand persist 存储键（auth-store 使用 'auth-storage'）
export const AUTH_STORAGE_KEY = 'auth-storage';
