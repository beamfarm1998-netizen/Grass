// src/components/ui/PWAInstallModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Smartphone,
  Sparkles,
  Zap,
  WifiOff,
  HardDriveDownload,
  Package,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useLanguage } from '../../i18n/LanguageContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  getOfflineCacheStats,
  OfflineCacheStats,
  OfflinePrepProgress,
  prepareAllOfflineAssets,
} from '../../utils/offlineAssets';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalledNotice?: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstalledNotice,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();

  const [activePlatformTab, setActivePlatformTab] = useState<'pwa' | 'apk'>('pwa');
  const [cacheStats, setCacheStats] = useState<OfflineCacheStats | null>(null);
  const [prepProgress, setPrepProgress] = useState<OfflinePrepProgress | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const refreshStats = useCallback(async () => {
    const s = await getOfflineCacheStats();
    setCacheStats(s);
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshStats();
    }
  }, [isOpen, refreshStats]);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        onInstalledNotice?.();
        onClose();
      }
    }
  };

  const handlePrepareOffline = async () => {
    if (isPreparing) return;
    setIsPreparing(true);
    try {
      await prepareAllOfflineAssets((p) => setPrepProgress(p));
      await refreshStats();
    } finally {
      setIsPreparing(false);
      setPrepProgress(null);
    }
  };

  const allOfflineReady =
    cacheStats && cacheStats.cachedGlbCount >= cacheStats.totalGlbCount;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-[#24140b] via-[#1a0f08] to-[#120a05] border-2 border-[#8d5a3b] rounded-3xl p-4 sm:p-6 shadow-2xl text-amber-100 flex flex-col gap-3.5 overflow-y-auto max-h-[92dvh] cursor-default"
      >
        {/* Header with Mobile Icon Preview */}
        <div className="flex items-center justify-between gap-2 border-b border-[#522f18] pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Beam Farm 3D Icon"
              className="w-12 h-12 rounded-2xl shadow-lg border border-amber-300/40 shrink-0 object-cover"
            />
            <div className="min-w-0">
              <h3 className="font-black text-amber-200 text-base sm:text-lg flex items-center gap-1.5 flex-wrap">
                <span>{t('ติดตั้งแอป & ออฟไลน์', 'Install App & Offline')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  Web • PWA • APK
                </span>
              </h3>
              <p className="text-xs text-stone-400 truncate">
                {t(
                  'พร้อมไอคอนมือถือ เล่นเต็มจอ และรองรับโหมดออฟไลน์',
                  'Custom mobile icon, fullscreen PWA & Android APK ready'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#361a0e] hover:bg-[#4d2614] border border-[#6b381d] flex items-center justify-center text-amber-300 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Switcher: PWA vs Android APK */}
        <div className="flex bg-[#160b06] p-1 rounded-xl border border-[#4d2813]">
          <button
            onClick={() => setActivePlatformTab('pwa')}
            className={`flex-1 min-h-[34px] py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activePlatformTab === 'pwa'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-amber-300/80 hover:text-amber-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('มือถือ / คอม (PWA)', 'Mobile & PC (PWA)')}</span>
          </button>
          <button
            onClick={() => setActivePlatformTab('apk')}
            className={`flex-1 min-h-[34px] py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activePlatformTab === 'apk'
                ? 'bg-emerald-500 text-stone-950 shadow-sm'
                : 'text-amber-300/80 hover:text-amber-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Android APK</span>
          </button>
        </div>

        {activePlatformTab === 'pwa' ? (
          <>
            {isInstalled ? (
              <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-200">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">
                    {t('ติดตั้งลงเครื่องเรียบร้อยแล้ว!', 'Installed on Your Device!')}
                  </h4>
                  <p className="text-xs text-emerald-300/80">
                    {t(
                      'คุณกำลังใช้งาน Beam Farm 3D แบบเต็มจอพร้อมไอคอนบนหน้าจอหลัก',
                      'Running Beam Farm 3D in standalone fullscreen mode'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#2d180d] border border-[#5d3219] rounded-xl p-2.5 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('ไอคอนบนจอมือถือ', 'Home Screen Icon')}</span>
                  </div>
                  <div className="bg-[#2d180d] border border-[#5d3219] rounded-xl p-2.5 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('เล่นเต็มจอ ลื่นไหล', 'Fullscreen 60fps')}</span>
                  </div>
                  <div className="bg-[#2d180d] border border-[#5d3219] rounded-xl p-2.5 flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('เล่นออฟไลน์ได้', 'Offline Play Ready')}</span>
                  </div>
                  <div className="bg-[#2d180d] border border-[#5d3219] rounded-xl p-2.5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t('รองรับ ไทย / EN', 'Thai & English')}</span>
                  </div>
                </div>

                {isInstallable ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleInstallClick}
                      className="w-full min-h-[44px] py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2.5 shadow-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <Download className="w-5 h-5" />
                      <span>{t('กดติดตั้งแอปทันที', 'Install App Now')}</span>
                    </button>
                    <p className="text-[11px] text-center text-stone-400">
                      {t(
                        'รองรับ Android, Windows, macOS และ ChromeOS',
                        'Supports Android, Windows, macOS & ChromeOS'
                      )}
                    </p>
                  </div>
                ) : isIOS ? (
                  <div className="bg-[#2a170d] border border-[#6b3a20] rounded-2xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                      <Smartphone className="w-4 h-4 text-amber-400" />
                      <span>
                        {t('วิธีเพิ่มไอคอนบน iPhone / iPad:', 'Add to Home Screen on iOS:')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs text-stone-300">
                      <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl flex-wrap">
                        <span className="font-bold text-amber-300">1.</span>
                        <span>{t('แตะปุ่ม', 'Tap')}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#3d2012] border border-[#6e3c1f] text-amber-200 font-bold">
                          <Share className="w-3.5 h-3.5 text-blue-400" />
                          <span>Share</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl flex-wrap">
                        <span className="font-bold text-amber-300">2.</span>
                        <span>{t('เลือก', 'Select')}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#3d2012] border border-[#6e3c1f] text-amber-200 font-bold">
                          <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{t('เพิ่มไปยังหน้าจอโฮม', 'Add to Home Screen')}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#2a170d] border border-[#6b3a20] rounded-2xl p-3.5 flex flex-col gap-1.5 text-xs text-stone-300">
                    <div className="flex items-center gap-2 font-bold text-amber-200">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        {t('วิธีเพิ่มไอคอนลงหน้าจอมือถือ / คอม:', 'How to Add App Icon:')}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {t(
                        'เปิดในเบราว์เซอร์หลัก (Chrome / Edge / Safari) แล้วแตะเมนู ⋮ เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"',
                        'Open in Chrome / Edge / Safari, tap the browser menu (⋮) and choose "Install App" or "Add to Home Screen".'
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* Android APK Packaging Info */
          <div className="bg-[#2a170d] border border-[#6b3a20] rounded-2xl p-3.5 flex flex-col gap-2.5 text-xs text-stone-200">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <Package className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {t('รองรับการสร้างไฟล์ Android APK (2 วิธี)', 'Android APK Support (2 Ready Modes)')}
              </span>
            </div>
            <div className="bg-black/35 p-2.5 rounded-xl border border-[#522f18] space-y-1">
              <div className="font-bold text-amber-200">
                1. Capacitor Offline APK (capacitor.config.json)
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                {t(
                  'แพ็กไฟล์เกมและโมเดล 3D ทั้งหมดลงใน APK โดยตรง เล่นออฟไลน์ได้ 100% ตั้งแต่วินาทีแรกที่ติดตั้ง',
                  'Bundles the compiled web build & all /public/*.glb assets inside a standalone offline Android APK.'
                )}
              </p>
              <code className="block text-[10px] font-mono text-emerald-300 bg-black/50 px-2 py-1 rounded">
                npm run build &amp;&amp; npx cap sync android
              </code>
            </div>
            <div className="bg-black/35 p-2.5 rounded-xl border border-[#522f18] space-y-1">
              <div className="font-bold text-amber-200">
                2. Trusted Web Activity / Bubblewrap APK
              </div>
              <p className="text-[11px] text-stone-300 leading-relaxed">
                {t(
                  'เตรียมไฟล์ Web Manifest, Maskable Icons (48–512px) และ Digital Asset Links ครบถ้วนพร้อมแปลงเป็น APK ทันที',
                  'Pre-configured with multi-size icons (48–512px), maskable adaptive icons, and .well-known/assetlinks.json.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Offline 3D Asset Preparation Box */}
        <div className="bg-[#1f120b] border border-emerald-600/40 rounded-2xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <HardDriveDownload className="w-4 h-4 shrink-0" />
                <span>
                  {t('เตรียมโมเดล 3D สำหรับเล่นออฟไลน์', 'Prepare 3D Models for Offline Play')}
                </span>
              </h4>
              <p className="text-[11px] text-stone-400">
                {cacheStats
                  ? t(
                      `เก็บไว้ในเครื่องแล้ว ${cacheStats.cachedGlbCount}/${cacheStats.totalGlbCount} โมเดล (${cacheStats.formattedSize})`,
                      `Cached ${cacheStats.cachedGlbCount}/${cacheStats.totalGlbCount} models (${cacheStats.formattedSize})`
                    )
                  : t('กำลังตรวจสอบ...', 'Checking...')}
              </p>
            </div>

            <button
              onClick={handlePrepareOffline}
              disabled={isPreparing || !isOnline || !!allOfflineReady}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-400 text-stone-950 font-bold text-xs transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              {allOfflineReady
                ? t('✓ พร้อมออฟไลน์', '✓ Ready Offline')
                : isPreparing
                  ? `${prepProgress?.completed ?? 0}/${prepProgress?.total ?? 19}`
                  : t('ดาวน์โหลดเก็บไว้', 'Cache Models')}
            </button>
          </div>

          {isPreparing && prepProgress && (
            <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{
                  width: `${Math.round(
                    (prepProgress.completed / Math.max(1, prepProgress.total)) * 100
                  )}%`,
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-1 border-t border-[#4d2813] flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-xl bg-[#381c0f] hover:bg-[#4d2614] border border-[#66351a] text-amber-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            {t('ปิดหน้าต่าง', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
