export type LanguageCode = 'th' | 'en' | 'zh' | 'ja' | 'ko';

export interface LanguageMetadata {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  flag: string;
}

export type TranslationDictionary = Record<string, string>;

export type TranslationParams = Record<string, string | number>;

export const SUPPORTED_LANGUAGES: readonly LanguageMetadata[] = [
  { code: 'th', nativeName: 'ภาษาไทย', englishName: 'Thai', flag: '🇹🇭' },
  { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇺🇸' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', flag: '🇰🇷' },
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'th';
