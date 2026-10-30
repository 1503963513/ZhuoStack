import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabsStore } from './tabs-store';

describe('tabs store', () => {
  beforeEach(() => {
    // 重置状态
    useTabsStore.setState({
      tabs: [
        {
          id: '/dashboard',
          title: '仪表盘',
          path: '/dashboard',
          fullPath: '/dashboard',
          closable: false,
        },
      ],
      activeTabId: '/dashboard',
    });
  });

  it('添加与切换新标签页', () => {
    useTabsStore.getState().addTab({
      id: '/system/user',
      title: '用户管理',
      path: '/system/user',
      fullPath: '/system/user',
    });

    const state = useTabsStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe('/system/user');
    expect(state.tabs[1].closable).toBe(true);
  });

  it('关闭非激活标签时，当前激活标签保持不变', () => {
    const navigate = vi.fn();
    useTabsStore.getState().addTab({
      id: '/system/user',
      title: '用户管理',
      path: '/system/user',
      fullPath: '/system/user',
    });
    useTabsStore.getState().addTab({
      id: '/system/role',
      title: '角色管理',
      path: '/system/role',
      fullPath: '/system/role',
    });

    // 当前在 role，关闭 user
    useTabsStore.getState().closeTab('/system/user', navigate);

    const state = useTabsStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe('/system/role');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('关闭当前激活标签时，自动跳转到邻近标签', () => {
    const navigate = vi.fn();
    useTabsStore.getState().addTab({
      id: '/system/user',
      title: '用户管理',
      path: '/system/user',
      fullPath: '/system/user',
    });
    useTabsStore.getState().addTab({
      id: '/system/role',
      title: '角色管理',
      path: '/system/role',
      fullPath: '/system/role',
    });

    // 当前在 role，关闭 role，应退回到 user
    useTabsStore.getState().closeTab('/system/role', navigate);

    const state = useTabsStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe('/system/user');
    expect(navigate).toHaveBeenCalledWith('/system/user');
  });

  it('关闭其他标签只保留常驻仪表盘和目标标签', () => {
    const navigate = vi.fn();
    useTabsStore.getState().addTab({
      id: '/system/user',
      title: '用户管理',
      path: '/system/user',
      fullPath: '/system/user',
    });
    useTabsStore.getState().addTab({
      id: '/system/role',
      title: '角色管理',
      path: '/system/role',
      fullPath: '/system/role',
    });

    useTabsStore.getState().closeOthers('/system/user', navigate);

    const state = useTabsStore.getState();
    expect(state.tabs.map((t) => t.id)).toEqual(['/dashboard', '/system/user']);
    expect(state.activeTabId).toBe('/system/user');
  });
});
