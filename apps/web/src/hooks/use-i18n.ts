'use client';

import { useI18nStore } from '@/stores/i18n-store';

/**
 * 国际化多语言 Hook
 * 导出当前语言、切换方法以及翻译函数 t(key, fallback)
 *
 * @example
 * const { t, locale, setLocale } = useI18n();
 * <span>{t('common.confirm')}</span>
 */
export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);

  return {
    locale,
    setLocale,
    t,
  };
}
