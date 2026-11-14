// src/i18n/LanguageContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  Language,
  getCurrentLang,
  setCurrentLangStorage,
} from './translations';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (th: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'th',
  setLang: () => {},
  toggleLang: () => {},
  t: (th) => th,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(getCurrentLang);

  useEffect(() => {
    setCurrentLangStorage(lang);
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setCurrentLangStorage(next);
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next: Language = prev === 'th' ? 'en' : 'th';
      setCurrentLangStorage(next);
      return next;
    });
  }, []);

  const t = useCallback(
    (th: string, en: string) => (lang === 'en' ? en : th),
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
