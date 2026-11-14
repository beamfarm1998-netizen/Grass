import { useCallback, useSyncExternalStore } from 'react';
import { languageManager } from './LanguageManager';
import { LanguageCode, SUPPORTED_LANGUAGES, TranslationParams } from './LanguageTypes';

export function t(key: string, params?: TranslationParams): string {
  return languageManager.translate(key, params);
}

export function useI18n() {
  const language = useSyncExternalStore(
    (onStoreChange) => languageManager.subscribe(onStoreChange),
    () => languageManager.getLanguage(),
    () => languageManager.getLanguage()
  );

  const setLanguage = useCallback((next: LanguageCode) => {
    languageManager.setLanguage(next, true);
  }, []);

  const translate = useCallback(
    (key: string, params?: TranslationParams) => languageManager.translate(key, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  );

  return {
    language,
    setLanguage,
    t: translate,
    languages: SUPPORTED_LANGUAGES,
  };
}
