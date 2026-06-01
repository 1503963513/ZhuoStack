export const APP_NAME = 'NodeJs 全栈模板';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
} as const;

export const STORAGE_KEYS = {
  TOKEN: 'auth-token',
  USER: 'auth-user',
} as const;
