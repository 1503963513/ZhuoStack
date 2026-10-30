'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PageTabItem {
  /** 唯一标识符：推荐使用 fullPath（包含 pathname + query），确保不同参数为独立标签 */
  id: string;
  /** 标签展示标题 */
  title: string;
  /** 纯路径，如 /system/user */
  path: string;
  /** 包含查询参数的完整路径，如 /monitor/jobs/logs?jobName=health-check */
  fullPath: string;
  /** 是否允许关闭（仪表盘等常驻页为 false） */
  closable: boolean;
  /** 可选图标名称 */
  icon?: string;
}

const DASHBOARD_TAB: PageTabItem = {
  id: '/dashboard',
  title: '仪表盘',
  path: '/dashboard',
  fullPath: '/dashboard',
  closable: false,
  icon: 'LayoutDashboard',
};

interface TabsState {
  tabs: PageTabItem[];
  activeTabId: string;

  /** 添加或激活标签 */
  addTab: (tab: Omit<PageTabItem, 'closable'> & { closable?: boolean }) => void;

  /** 设置当前激活标签 */
  setActiveTabId: (id: string) => void;

  /** 更新指定标签的标题 */
  updateTabTitle: (id: string, title: string) => void;

  /** 关闭指定标签（若关闭当前项，通过 navigate 回调自动跳转到邻近标签） */
  closeTab: (id: string, navigate?: (path: string) => void) => void;

  /** 关闭其他标签（保留固定项与目标项） */
  closeOthers: (id: string, navigate?: (path: string) => void) => void;

  /** 关闭右侧标签 */
  closeRight: (id: string, navigate?: (path: string) => void) => void;

  /** 关闭全部标签（仅保留固定项并重定向回首页） */
  closeAll: (navigate?: (path: string) => void) => void;
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [DASHBOARD_TAB],
      activeTabId: DASHBOARD_TAB.id,

      addTab: (tab) => {
        const { tabs } = get();
        const closable =
          tab.closable ?? (tab.id !== DASHBOARD_TAB.id && tab.path !== DASHBOARD_TAB.path);
        const existingIndex = tabs.findIndex((t) => t.id === tab.id);

        if (existingIndex > -1) {
          // 已存在：激活并更新可能变化的标题
          const updatedTabs = [...tabs];
          updatedTabs[existingIndex] = {
            ...updatedTabs[existingIndex],
            title: tab.title || updatedTabs[existingIndex].title,
            fullPath: tab.fullPath,
          };
          set({ tabs: updatedTabs, activeTabId: tab.id });
        } else {
          // 新增标签并激活
          const newTab: PageTabItem = {
            ...tab,
            closable,
          };
          set({ tabs: [...tabs, newTab], activeTabId: tab.id });
        }
      },

      setActiveTabId: (id) => {
        set({ activeTabId: id });
      },

      updateTabTitle: (id, title) => {
        const { tabs } = get();
        set({
          tabs: tabs.map((t) => (t.id === id ? { ...t, title } : t)),
        });
      },

      closeTab: (id, navigate) => {
        const { tabs, activeTabId } = get();
        const targetIndex = tabs.findIndex((t) => t.id === id);
        if (targetIndex === -1) return;

        const targetTab = tabs[targetIndex];
        if (!targetTab.closable) return; // 不可关闭的标签直接跳过

        const newTabs = tabs.filter((t) => t.id !== id);

        // 如果关闭的是当前激活标签，需平滑切换到邻近标签
        if (activeTabId === id) {
          // 优先切换到左边一个，若没有左边则取右边
          const nextIndex = targetIndex > 0 ? targetIndex - 1 : 0;
          const nextTab = newTabs[nextIndex] || DASHBOARD_TAB;

          set({ tabs: newTabs, activeTabId: nextTab.id });
          navigate?.(nextTab.fullPath);
        } else {
          set({ tabs: newTabs });
        }
      },

      closeOthers: (id, navigate) => {
        const { tabs, activeTabId } = get();
        const targetTab = tabs.find((t) => t.id === id);
        if (!targetTab) return;

        // 保留不可关闭的项（如仪表盘）与当前目标项
        const newTabs = tabs.filter((t) => !t.closable || t.id === id);

        set({ tabs: newTabs, activeTabId: id });

        if (activeTabId !== id) {
          navigate?.(targetTab.fullPath);
        }
      },

      closeRight: (id, navigate) => {
        const { tabs, activeTabId } = get();
        const targetIndex = tabs.findIndex((t) => t.id === id);
        if (targetIndex === -1) return;

        // 仅关闭该项右侧的可关闭标签
        const newTabs = tabs.filter((t, idx) => idx <= targetIndex || !t.closable);

        // 如果原激活标签在右侧被关掉了，跳转到目标标签
        const activeStillExists = newTabs.some((t) => t.id === activeTabId);
        if (!activeStillExists) {
          const targetTab = tabs[targetIndex];
          set({ tabs: newTabs, activeTabId: id });
          navigate?.(targetTab.fullPath);
        } else {
          set({ tabs: newTabs });
        }
      },

      closeAll: (navigate) => {
        const { tabs } = get();
        // 仅保留不可关闭的项
        const unclosableTabs = tabs.filter((t) => !t.closable);
        const finalTabs = unclosableTabs.length > 0 ? unclosableTabs : [DASHBOARD_TAB];

        set({ tabs: finalTabs, activeTabId: DASHBOARD_TAB.id });
        navigate?.(DASHBOARD_TAB.fullPath);
      },
    }),
    {
      name: 'zhuostack_page_tabs',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
