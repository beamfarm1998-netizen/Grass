import { DEFAULT_LANGUAGE, LanguageCode, SUPPORTED_LANGUAGES } from './LanguageTypes';

const LANGUAGE_STORAGE_KEY = 'rf3d_selected_language_v1';

export class LanguageStorage {
  static isSupported(code: string | null | undefined): code is LanguageCode {
    if (!code) return false;
    return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
  }

  static loadSavedLanguage(): LanguageCode | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return this.isSupported(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  static saveLanguage(code: LanguageCode): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      // Safe no-op in restricted iframe or private mode
    }
  }

  static detectDeviceLanguage(): LanguageCode {
    try {
      if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
      const candidates = [
        ...(navigator.languages || []),
        navigator.language || '',
      ];
      for (const candidate of candidates) {
        const prefix = candidate.toLowerCase().split(/[-_]/)[0];
        if (this.isSupported(prefix)) {
          return prefix;
        }
      }
    } catch {
      // Ignore detection error and fall back to Thai
    }
    return DEFAULT_LANGUAGE;
  }

  static resolveInitialLanguage(): LanguageCode {
    return this.loadSavedLanguage() ?? this.detectDeviceLanguage();
  }
}
