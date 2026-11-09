'use client';

import { useEffect } from 'react';
import { useConfigStore } from '@/stores/config-store';

/**
 * 获取全局系统公开配置 Hook
 * 首次调用自动触发拉取，缓存于 Zustand store
 */
export function useSystemConfig() {
  const configs = useConfigStore((s) => s.configs);
  const isLoaded = useConfigStore((s) => s.isLoaded);
  const appName = useConfigStore((s) => s.appName);
  const copyright = useConfigStore((s) => s.copyright);
  const fetchPublicConfigs = useConfigStore((s) => s.fetchPublicConfigs);
  const getConfig = useConfigStore((s) => s.getConfig);
  const getBoolean = useConfigStore((s) => s.getBoolean);

  useEffect(() => {
    if (!isLoaded) {
      fetchPublicConfigs();
    }
  }, [isLoaded, fetchPublicConfigs]);

  return {
    configs,
    isLoaded,
    appName,
    copyright,
    getConfig,
    getBoolean,
    refresh: fetchPublicConfigs,
  };
}
