import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '../../localization/i18n';
import { useOnlineStatus, usePWAInstall } from '../../platform/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useI18n();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300 ${
          compact ? 'px-3.5 py-2 text-xs min-h-[40px]' : 'px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{t('pwa.install')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900 text-slate-100 font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'px-4 py-2.5 text-sm min-h-[44px]'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{t('pwa.installIos')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-white/12 p-6 text-slate-100">
              <h3 className="text-base font-semibold">{t('pwa.iosGuideTitle')}</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>{t('pwa.iosStep1')}</p>
                <p>{t('pwa.iosStep2')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[40px] rounded-lg bg-amber-500 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {t('settings.close')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md whitespace-nowrap"
    >
      {t('pwa.offlineBanner')}
    </div>
  );
};
