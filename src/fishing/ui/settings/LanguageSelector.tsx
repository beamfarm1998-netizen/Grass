import React from 'react';
import { useI18n } from '../../localization/i18n';
import { LanguageCode } from '../../localization/LanguageTypes';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, languages, t } = useI18n();

  return (
    <div className="space-y-2.5">
      <div>
        <h4 className="text-sm font-semibold text-slate-100">{t('settings.language')}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{t('settings.languageDesc')}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label={t('settings.language')}>
        {languages.map((item) => {
          const active = language === item.code;
          return (
            <button
              key={item.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLanguage(item.code as LanguageCode)}
              className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                  : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800 hover:border-white/20'
              }`}
            >
              <span aria-hidden="true">{item.flag}</span>
              <span className="truncate">{item.nativeName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
