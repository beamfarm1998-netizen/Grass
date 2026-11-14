import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import th from './locales/th.json';
import zh from './locales/zh.json';
import { LanguageStorage } from './LanguageStorage';
import {
  DEFAULT_LANGUAGE,
  LanguageCode,
  SUPPORTED_LANGUAGES,
  TranslationDictionary,
  TranslationParams,
} from './LanguageTypes';

const LOCALES: Record<LanguageCode, TranslationDictionary> = {
  th,
  en,
  zh,
  ja,
  ko,
};

type LanguageChangeListener = (lang: LanguageCode) => void;

export class LanguageManager {
  private currentLanguage: LanguageCode;
  private listeners = new Set<LanguageChangeListener>();

  constructor(initialLanguage?: LanguageCode) {
    this.currentLanguage = initialLanguage ?? LanguageStorage.resolveInitialLanguage();
    this.applyDocumentLang(this.currentLanguage);
  }

  getLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  setLanguage(lang: LanguageCode, persist = true): void {
    if (!LanguageStorage.isSupported(lang)) return;
    const changed = this.currentLanguage !== lang;
    this.currentLanguage = lang;
    if (persist) {
      LanguageStorage.saveLanguage(lang);
    }
    this.applyDocumentLang(lang);
    if (changed) {
      this.listeners.forEach((listener) => listener(lang));
    }
  }

  translate(key: string, params?: TranslationParams): string {
    const activeDict = LOCALES[this.currentLanguage] ?? LOCALES[DEFAULT_LANGUAGE];
    const template =
      activeDict[key] ??
      LOCALES[DEFAULT_LANGUAGE][key] ??
      LOCALES.en[key] ??
      key;

    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (_, token: string) => {
      const val = params[token];
      return val !== undefined ? String(val) : `{${token}}`;
    });
  }

  subscribe(listener: LanguageChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  static getDictionary(lang: LanguageCode): TranslationDictionary {
    return LOCALES[lang];
  }

  private applyDocumentLang(lang: LanguageCode): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
  }
}

export const languageManager = new LanguageManager();
