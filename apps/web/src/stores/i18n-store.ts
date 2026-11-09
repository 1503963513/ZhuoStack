'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zhCN } from '@/locales/zh-CN/common';
import { enUS } from '@/locales/en-US/common';

export type Locale = 'zh-CN' | 'en-US';

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
];

const MESSAGES: Record<Locale, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, fallback?: string) => string;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'zh-CN',

      setLocale: (locale: Locale) => {
        set({ locale });
        if (typeof document !== 'undefined') {
          document.documentElement.lang = locale;
        }
      },

      t: (path: string, fallback?: string): string => {
        const { locale } = get();
        const messages = MESSAGES[locale] || MESSAGES['zh-CN'];
        const keys = path.split('.');

        let current: unknown = messages;
        for (const k of keys) {
          if (current && typeof current === 'object' && k in current) {
            current = (current as Record<string, unknown>)[k];
          } else {
            return fallback ?? path;
          }
        }

        return typeof current === 'string' ? current : (fallback ?? path);
      },
    }),
    {
      name: 'zhuostack_locale',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
