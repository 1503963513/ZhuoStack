import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth-store';

const user = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  role: 'USER' as const,
  avatar: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('auth store', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useAuthStore.getState().clearAuth();
  });

  it('只持有用户认证状态，不包含可被脚本读取的 JWT', () => {
    useAuthStore.getState().setAuth(user);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state).not.toHaveProperty('token');

    state.clearAuth();
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
    });
  });
});
