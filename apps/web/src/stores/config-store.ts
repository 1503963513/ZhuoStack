'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { configControllerGetPublicConfigs } from '@/api/generated/endpoints/system-config/system-config';
import { APP_NAME } from '@/lib/constants';

interface ConfigState {
  configs: Record<string, string>;
  isLoaded: boolean;
  appName: string;
  copyright: string;
  fetchPublicConfigs: () => Promise<void>;
  getConfig: (key: string, fallback?: string) => string;
  getBoolean: (key: string, fallback?: boolean) => boolean;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: {},
      isLoaded: false,
      appName: APP_NAME,
      copyright: '© 2026 ZhuoStack. All rights reserved.',

      fetchPublicConfigs: async () => {
        try {
          const res = await configControllerGetPublicConfigs();
          const data = (res.data?.configs || {}) as Record<string, string>;
          set({
            configs: data,
            isLoaded: true,
            appName: data['sys.app.name'] || APP_NAME,
            copyright: data['sys.app.copyright'] || '© 2026 ZhuoStack. All rights reserved.',
          });
        } catch {
          // 网络或离线状态下保持默认值
          set({ isLoaded: true });
        }
      },

      getConfig: (key: string, fallback = '') => {
        return get().configs[key] ?? fallback;
      },

      getBoolean: (key: string, fallback = false) => {
        const val = get().configs[key];
        if (val === undefined) return fallback;
        return val === 'true' || val === '1';
      },
    }),
    {
      name: 'zhuostack_public_configs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        configs: state.configs,
        appName: state.appName,
        copyright: state.copyright,
      }),
    },
  ),
);
