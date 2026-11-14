// src/components/ui/SettingsModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  X,
  Volume2,
  Music,
  User,
  Cloud,
  BookOpen,
  Clapperboard,
  ShieldCheck,
  Trash2,
  RotateCcw,
  RotateCw,
  Compass,
  Pencil,
  Key,
  Copy,
  Download,
  AlertTriangle,
  Globe,
  HardDriveDownload,
  Wifi,
  WifiOff,
  Keyboard,
  MousePointerClick,
  Smartphone,
  Monitor,
  Save,
  Zap,
  Eye,
  EyeOff,
  Hand,
} from 'lucide-react';
import type { FarmerGender } from '../../types/game';
import { farmAudio } from '../../utils/audio';
import {
  estimateRenderResolutionLabel,
  type GraphicsQualityMode,
} from '../../utils/graphics4k';
import {
  flushAllPendingFarmSaves,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  writeFullSnapshotToIdb,
} from '../../utils/farmAutoSave';
import { FARM_SAVE_KEYS } from '../../utils/saveReset';
import { useLanguage } from '../../i18n/LanguageContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  clearOfflineAssetCaches,
  getOfflineCacheStats,
  OfflineCacheStats,
  OfflinePrepProgress,
  prepareAllOfflineAssets,
} from '../../utils/offlineAssets';
import type { AspectRatioMode } from '../../types/aspectRatio';
import { ASPECT_RATIO_OPTIONS } from '../../types/aspectRatio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGuide: () => void;
  onOpenDevDocs?: () => void;
  onReplayLoadingScreen: () => void;
  onResetProgress: () => void;
  soundEffectsEnabled: boolean;
  musicEnabled: boolean;
  onToggleSoundEffects: () => void;
  onToggleMusic: () => void;
  wasdEnabled?: boolean;
  onToggleWasd?: () => void;
  touchSlideEnabled?: boolean;
  onToggleTouchSlide?: () => void;
  isPlayerHidden?: boolean;
  onTogglePlayerHidden?: () => void;
  fingerSwipeEnabled?: boolean;
  onToggleFingerSwipe?: () => void;
  autoRotateCamera?: boolean;
  onToggleAutoRotateCamera?: () => void;
  autoRotateSpeed?: number;
  onChangeAutoRotateSpeed?: (speed: number) => void;
  twoFingerRotateEnabled?: boolean;
  onToggleTwoFingerRotate?: () => void;
  onRotateCameraByAngle?: (deltaRad: number) => void;
  onResetCameraAngle?: () => void;
  playerGender?: FarmerGender;
  onToggleFarmerGender?: () => void;
  structureEditEnabled?: boolean;
  onToggleStructureEdit?: () => void;
  structureEditClickMode?: 'double' | 'single';
  onChangeStructureEditClickMode?: (mode: 'double' | 'single') => void;
  graphicsQualityMode?: GraphicsQualityMode;
  onSetGraphicsQualityMode?: (mode: GraphicsQualityMode) => void;
  ultra4kEnabled?: boolean;
  onToggleUltra4k?: () => void;
  onSetUltra4k?: (enabled: boolean) => void;
  onSaveNow?: () => void;
  addNotice: (text: string, color?: string) => void;
  onOpenInstall?: () => void;
  /* ✅ Aspect Ratio (ใหม่) */
  aspectRatioMode?: AspectRatioMode;
  onChangeAspectRatioMode?: (mode: AspectRatioMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenGuide,
  onOpenDevDocs,
  onReplayLoadingScreen,
  onResetProgress,
  soundEffectsEnabled,
  musicEnabled,
  onToggleSoundEffects,
  onToggleMusic,
  wasdEnabled = true,
  onToggleWasd,
  touchSlideEnabled = true,
  onToggleTouchSlide,
  isPlayerHidden = false,
  onTogglePlayerHidden,
  fingerSwipeEnabled = false,
  onToggleFingerSwipe,
  autoRotateCamera = false,
  onToggleAutoRotateCamera,
  autoRotateSpeed = 0.08,
  onChangeAutoRotateSpeed,
  twoFingerRotateEnabled = true,
  onToggleTwoFingerRotate,
  onRotateCameraByAngle,
  onResetCameraAngle,
  playerGender = 'male',
  onToggleFarmerGender,
  structureEditEnabled = true,
  onToggleStructureEdit,
  structureEditClickMode = 'double',
  onChangeStructureEditClickMode,
  graphicsQualityMode,
  onSetGraphicsQualityMode,
  ultra4kEnabled = false,
  onToggleUltra4k,
  onSetUltra4k,
  onSaveNow,
  addNotice,
  onOpenInstall,
  aspectRatioMode,
  onChangeAspectRatioMode,
}) => {
  const { lang, setLang, t } = useLanguage();
  const isOnline = useOnlineStatus();

  const [farmName, setFarmName] = useState<string>(() => {
    try {
      return localStorage.getItem('beam_farm_name') || 'My Cozy Farm';
    } catch {
      return 'My Cozy Farm';
    }
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(farmName);

  const [activeSubModal, setActiveSubModal] = useState<
    'none' | 'account' | 'cloud' | 'security' | 'confirmReset'
  >('none');

  const [userAccount, setUserAccount] = useState<{
    loggedIn: boolean;
    name: string;
    email: string;
    provider: 'guest' | 'google' | 'facebook';
  }>(() => {
    try {
      const saved = localStorage.getItem('beam_farm_user_account');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { loggedIn: false, name: 'Farmer Guest', email: '', provider: 'guest' };
  });

  const [cloudSyncCode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('beam_farm_sync_code');
      if (saved) return saved;
      const code = 'BF-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('beam_farm_sync_code', code);
      return code;
    } catch {
      return 'BF-8849';
    }
  });
  const [restoreCodeInput, setRestoreCodeInput] = useState('');

  const [cacheStats, setCacheStats] = useState<OfflineCacheStats | null>(null);
  const [prepProgress, setPrepProgress] = useState<OfflinePrepProgress | null>(null);
  const [isPreparingOffline, setIsPreparingOffline] = useState(false);

  const refreshCacheStats = useCallback(async () => {
    const stats = await getOfflineCacheStats();
    setCacheStats(stats);
  }, []);

  const [lastSavedTs, setLastSavedTs] = useState<number>(() => {
    const raw = safeGetLocalStorageItem('beam_farm_3d_save_map_v2_saved_at');
    return Number(raw || '0') || 0;
  });

  useEffect(() => {
    if (isOpen) {
      flushAllPendingFarmSaves();
      const raw = safeGetLocalStorageItem('beam_farm_3d_save_map_v2_saved_at');
      setLastSavedTs(Number(raw || '0') || Date.now());
      refreshCacheStats();
    }
  }, [isOpen, refreshCacheStats]);

  if (!isOpen) return null;

  const handleSaveFarmName = () => {
    const trimmed = nameInput.trim() || 'My Cozy Farm';
    setFarmName(trimmed);
    localStorage.setItem('beam_farm_name', trimmed);
    setIsEditingName(false);
    addNotice(
      t(
        `✏️ บันทึกชื่อฟาร์มใหม่: "${trimmed}" เรียบร้อย!`,
        `✏️ Saved farm name: "${trimmed}"!`
      ),
      '#a5d6a7'
    );
  };

  const handleSimulateLogin = (provider: 'google' | 'facebook') => {
    const mockEmail =
      provider === 'google' ? 'farmer.cozy@gmail.com' : 'farmer.fb@facebook.com';
    const mockName = provider === 'google' ? 'Google Farmer' : 'Facebook Farm';
    const newAcc = { loggedIn: true, name: mockName, email: mockEmail, provider };
    setUserAccount(newAcc);
    localStorage.setItem('beam_farm_user_account', JSON.stringify(newAcc));
    setActiveSubModal('none');
    farmAudio.playCoinSound();
    addNotice(
      t(
        `🎉 เชื่อมต่อบัญชี ${provider.toUpperCase()} สำเร็จ!`,
        `🎉 Connected ${provider.toUpperCase()} account!`
      ),
      '#81c784'
    );
  };

  const handleLogout = () => {
    const guestAcc = {
      loggedIn: false,
      name: 'Farmer Guest',
      email: '',
      provider: 'guest' as const,
    };
    setUserAccount(guestAcc);
    localStorage.setItem('beam_farm_user_account', JSON.stringify(guestAcc));
    setActiveSubModal('none');
    addNotice(
      t('ออกจากระบบ กลับสู่ Guest Mode', 'Signed out to Guest Mode'),
      '#ffb74d'
    );
  };

  const handlePrepareOffline = async () => {
    if (isPreparingOffline) return;
    setIsPreparingOffline(true);
    try {
      const result = await prepareAllOfflineAssets((p) => setPrepProgress(p));
      await refreshCacheStats();
      farmAudio.playCoinSound();
      addNotice(
        t(
          `📦 เตรียมข้อมูลออฟไลน์สำเร็จ (${result.cachedCount}/${result.total} โมเดล 3D)`,
          `📦 Offline assets ready (${result.cachedCount}/${result.total} 3D models cached)`
        ),
        '#4ade80'
      );
    } finally {
      setIsPreparingOffline(false);
      setPrepProgress(null);
    }
  };

  const handleClearCache = async () => {
    await clearOfflineAssetCaches();
    await refreshCacheStats();
    farmAudio.playWaterSound();
    addNotice(
      t('🧹 ล้างแคชข้อมูลออฟไลน์เรียบร้อยแล้ว', '🧹 Cleared cached offline assets'),
      '#60a5fa'
    );
  };

  const getAllSaveData = () => {
    flushAllPendingFarmSaves();
    const data: Record<string, string | null> = {};
    FARM_SAVE_KEYS.forEach((k) => {
      data[k] = safeGetLocalStorageItem(k);
    });
    return data;
  };

  const handleExportBackup = () => {
    try {
      const data = getAllSaveData();
      const jsonStr = JSON.stringify(data);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      navigator.clipboard?.writeText(b64);
      addNotice(
        t(
          '📦 สำรองข้อมูลฟาร์มสำเร็จ! คัดลอกรหัส Backup ลงคลิปบอร์ดแล้ว',
          '📦 Farm backup copied to clipboard!'
        ),
        '#81c784'
      );
    } catch {
      addNotice(
        t('❌ ไม่สามารถส่งออกข้อมูลสำรองได้', '❌ Could not export backup code'),
        '#ef5350'
      );
    }
  };

  const handleRestoreFromCode = async () => {
    const code = restoreCodeInput.trim();
    if (!code) {
      addNotice(
        t('กรุณากรอกรหัสสำรองข้อมูล', 'Please enter a backup code'),
        '#ef5350'
      );
      return;
    }
    try {
      let parsed: Record<string, string | null>;
      if (code.startsWith('{')) {
        parsed = JSON.parse(code);
      } else {
        const decoded = decodeURIComponent(escape(atob(code)));
        parsed = JSON.parse(decoded);
      }
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== null && typeof v === 'string') {
          safeSetLocalStorageItem(k, v);
        }
      });
      safeSetLocalStorageItem('beam_farm_3d_save_map_v2_saved_at', String(Date.now()));
      await writeFullSnapshotToIdb();
      farmAudio.playLevelUpSound();
      addNotice(
        t('🎉 กู้คืนข้อมูลสำเร็จ! กำลังโหลดหน้าใหม่...', '🎉 Backup restored! Reloading farm...'),
        '#81c784'
      );
      setTimeout(() => window.location.reload(), 250);
    } catch {
      addNotice(
        t('❌ รหัสกู้คืนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', '❌ Invalid backup code — please check and try again'),
        '#ef5350'
      );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/80 animate-fade-in backdrop-blur-xs select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[540px] bg-[#1a1411] border-2 border-[#543b27] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#3e271a] bg-[#140e0b]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2e1d13] border border-[#5d3b24] flex items-center justify-center text-amber-300 shadow-inner shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-amber-200 tracking-wide font-sans truncate">
                {t('การตั้งค่าฟาร์ม', 'Farm Settings')}
              </h2>
              <p className="text-[11px] font-semibold text-amber-500/90 font-mono tracking-wider flex items-center gap-1.5">
                <span>Beam Farm 3D</span>
                <span>•</span>
                <span className={isOnline ? 'text-emerald-400' : 'text-amber-300'}>
                  {isOnline ? t('ออนไลน์', 'Online') : t('ออฟไลน์', 'Offline')}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 border border-red-400 shrink-0"
            title={t('ปิดหน้าต่าง', 'Close')}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-stone-800">
          {/* 0. Bilingual Language Selector */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                  {t('ภาษาของตัวเกม (Language)', 'Game Language (ภาษา)')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('สลับภาษาไทย / อังกฤษได้ทันที', 'Switch between Thai & English anytime')}
                </p>
              </div>
            </div>

            <div className="flex bg-[#150d0a] p-1 rounded-xl border border-[#482d1c] shrink-0">
              <button
                onClick={() => setLang('th')}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  lang === 'th'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                ไทย
              </button>
              <button
                onClick={() => setLang('en')}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* 1. Farm Name Section */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3.5 flex flex-col gap-1.5 shadow-sm">
            <span className="text-xs text-amber-400/80 font-bold">
              {t('ชื่อฟาร์มของคุณ:', 'Your Farm Name:')}
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={28}
                  className="flex-1 bg-[#150d0a] border border-amber-600/60 rounded-xl px-3 py-1.5 text-sm font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <button
                  onClick={handleSaveFarmName}
                  className="min-h-[34px] px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-xl transition-all"
                >
                  {t('บันทึก', 'Save')}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-amber-200 tracking-wide">
                  {farmName}
                </span>
                <button
                  onClick={() => {
                    setNameInput(farmName);
                    setIsEditingName(true);
                  }}
                  className="p-1.5 text-stone-400 hover:text-amber-300 transition-colors"
                  title={t('แก้ไขชื่อฟาร์ม', 'Edit Farm Name')}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 1.05 ✅ Aspect Ratio (ใหม่) */}
          {onChangeAspectRatioMode && aspectRatioMode && (
            <div className="bg-gradient-to-r from-sky-950/60 via-[#1b242c] to-[#241712] border border-sky-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/45 text-sky-300 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                    {t('สัดส่วนหน้าจอ (Aspect Ratio)', 'Aspect Ratio')}
                  </h4>
                  <p className="text-[11px] text-stone-300/90">
                    {t(
                      'เลือกกรอบมือถือที่ต้องการให้แสดงผลบนคอมพิวเตอร์ (มือถือจะเต็มจออัตโนมัติ)',
                      'Choose the phone frame to display on desktop (mobile is always fullscreen)'
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2">
                {ASPECT_RATIO_OPTIONS.map((opt) => {
                  const active = opt.mode === aspectRatioMode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => onChangeAspectRatioMode(opt.mode)}
                      className={`text-left min-h-[62px] px-2.5 py-2 rounded-lg border transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400/70 ring-2 ring-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.25)]'
                          : 'bg-[#241712] border-[#3c2518] hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">{opt.icon}</span>
                        <span
                          className={`text-[12px] font-black ${
                            active ? 'text-cyan-200' : 'text-amber-200'
                          }`}
                        >
                          {t(opt.labelTh, opt.labelEn)}
                        </span>
                        {active && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
                        )}
                      </div>
                      <p className="text-[10px] leading-tight text-stone-400">
                        {t(opt.descTh, opt.descEn)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1.25 Graphics Quality & Mobile Smooth 60 FPS Section */}
          {(onSetGraphicsQualityMode || onToggleUltra4k || onSetUltra4k) && (() => {
            const resolvedQualityMode: GraphicsQualityMode =
              graphicsQualityMode ?? (ultra4kEnabled ? 'ultra4k' : 'standard');
            const applyMode = (mode: GraphicsQualityMode) => {
              if (onSetGraphicsQualityMode) {
                onSetGraphicsQualityMode(mode);
              } else if (onSetUltra4k) {
                onSetUltra4k(mode === 'ultra4k');
              } else if (
                (mode === 'ultra4k' && !ultra4kEnabled) ||
                (mode !== 'ultra4k' && ultra4kEnabled)
              ) {
                onToggleUltra4k?.();
              }
            };
            return (
              <div
                className={`rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm transition-colors border ${
                  resolvedQualityMode === 'smooth'
                    ? 'bg-gradient-to-r from-emerald-950/65 via-[#17231d] to-[#241712] border-emerald-400/55'
                    : resolvedQualityMode === 'ultra4k'
                      ? 'bg-gradient-to-r from-sky-950/65 via-[#1f222d] to-[#241712] border-sky-400/60'
                      : 'bg-[#241712] border-amber-700/45'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        resolvedQualityMode === 'smooth'
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : resolvedQualityMode === 'ultra4k'
                            ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                            : 'bg-[#150d0a] border-[#482d1c] text-amber-400'
                      }`}
                    >
                      {resolvedQualityMode === 'smooth' ? (
                        <Zap className="w-5 h-5" />
                      ) : (
                        <Monitor className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                          {t('ระดับความลื่นไหล & กราฟิก 3D', '3D Smoothness & Graphics Quality')}
                        </h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black tracking-wider ${
                            resolvedQualityMode === 'smooth'
                              ? 'bg-emerald-400 text-stone-950'
                              : resolvedQualityMode === 'ultra4k'
                                ? 'bg-sky-400 text-stone-950'
                                : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          {resolvedQualityMode === 'smooth'
                            ? 'SMOOTH 60 FPS'
                            : resolvedQualityMode === 'ultra4k'
                              ? '4K UHD'
                              : 'STANDARD HD'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-300/90">
                        {resolvedQualityMode === 'smooth'
                          ? t(
                              'เน้นความลื่นไหลสูงสุดบนมือถือ ปิดเงาหนักและลดภาระการ์ดจอให้เล่นได้นิ่ง 60 FPS',
                              'Optimized for mobile phones: disables heavy shadows & cuts GPU load for steady 60 FPS'
                            )
                          : resolvedQualityMode === 'ultra4k'
                            ? t(
                                'ปรับความละเอียดเรนเดอร์ 3D เป็นระดับ 4K (3840×2160) เพิ่มความคมชัดสูงสุด',
                                'Supersample 3D rendering up to 4K (3840×2160) with ultra-sharp shadows & textures'
                              )
                            : t(
                                'สมดุลระหว่างความคมชัดและเฟรมเรต พร้อมเงามาตรฐาน',
                                'Balanced HD clarity and frame rate with standard shadows'
                              )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2">
                  <div className="text-[11px] text-stone-300 px-1 flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-stone-400 shrink-0">
                      {t('ความละเอียดเรนเดอร์:', 'Render Buffer:')}
                    </span>
                    <span
                      className={`font-mono font-bold truncate ${
                        resolvedQualityMode === 'smooth'
                          ? 'text-emerald-300'
                          : resolvedQualityMode === 'ultra4k'
                            ? 'text-sky-300'
                            : 'text-amber-200'
                      }`}
                    >
                      {estimateRenderResolutionLabel(resolvedQualityMode)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyMode('smooth')}
                      className={`min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
                        resolvedQualityMode === 'smooth'
                          ? 'bg-emerald-400 text-stone-950 shadow-sm font-black'
                          : 'bg-[#241712] text-emerald-300 hover:bg-emerald-950/60 border border-emerald-500/30'
                      }`}
                    >
                      <span>⚡</span>
                      <span className="truncate">
                        {t('ลื่นไหล (60 FPS)', 'Smooth 60 FPS')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMode('standard')}
                      className={`min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                        resolvedQualityMode === 'standard'
                          ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
                          : 'bg-[#241712] text-stone-300 hover:text-white border border-stone-700/60'
                      }`}
                    >
                      {t('มาตรฐาน (HD)', 'Standard HD')}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyMode('ultra4k')}
                      className={`min-h-[32px] px-2 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                        resolvedQualityMode === 'ultra4k'
                          ? 'bg-sky-400 text-stone-950 shadow-sm font-black'
                          : 'bg-[#241712] text-sky-300 hover:bg-sky-950/60 border border-sky-500/30'
                      }`}
                    >
                      {t('4K Ultra HD', '4K Ultra HD')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 1.35 ซ่อนตัวละครชาย/หญิง & โหมดใช้นิ้วทำทุกอย่างเหมือน Hay Day */}
          {(onTogglePlayerHidden || onToggleFingerSwipe || onToggleFarmerGender) && (
            <div className="bg-gradient-to-r from-sky-950/60 via-[#1b242c] to-[#241712] border border-sky-400/50 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/45 text-sky-300 flex items-center justify-center shrink-0">
                    {isPlayerHidden ? <EyeOff className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                      {t(
                        'ซ่อนผู้ชาย/ผู้หญิง & ใช้นิ้วทำทุกอย่างแบบ Hay Day',
                        'Hide Male/Female Farmer & Hay Day Finger Mode'
                      )}
                    </h4>
                    <p className="text-[11px] text-stone-300/90">
                      {t(
                        'ย้ายปุ่มจากหน้าจอหลักมาไว้ในการตั้งค่านี้ เพื่อไม่ให้มีปุ่มลอยบังหน้าจอขณะเล่นบนมือถือ แตะทำฟาร์มได้เต็มผืนดิน',
                        'Moved from the main HUD into Settings so no floating buttons block your mobile screen. Tap plots directly!'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2">
                {onTogglePlayerHidden && (
                  <button
                    type="button"
                    onClick={onTogglePlayerHidden}
                    className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isPlayerHidden
                        ? 'bg-sky-400 text-stone-950 shadow-sm'
                        : 'bg-[#241712] text-stone-200 hover:bg-stone-800 border border-stone-700/70'
                    }`}
                  >
                    {isPlayerHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-300" />}
                    <span className="truncate">
                      {isPlayerHidden
                        ? t('ซ่อนตัวละครอยู่ (แตะเพื่อแสดง)', 'Farmer Hidden (Tap to Show)')
                        : t('แสดงตัวละครอยู่ (แตะเพื่อซ่อน)', 'Farmer Visible (Tap to Hide)')}
                    </span>
                  </button>
                )}

                {onToggleFarmerGender && (
                  <button
                    type="button"
                    onClick={onToggleFarmerGender}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#241712] text-amber-200 hover:bg-stone-800 border border-amber-700/45 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{playerGender === 'female' ? '👩' : playerGender === 'boy' ? '👦' : playerGender === 'girl' ? '👧' : '👨'}</span>
                    <span className="truncate">
                      {playerGender === 'female'
                        ? t('ตัวละคร: ชาวไร่หญิง (แตะสลับ)', 'Avatar: Female (Tap to swap)')
                        : playerGender === 'boy'
                          ? t('ตัวละคร: เด็กชาย (แตะสลับ)', 'Avatar: Boy (Tap to swap)')
                          : playerGender === 'girl'
                            ? t('ตัวละคร: เด็กหญิง (แตะสลับ)', 'Avatar: Girl (Tap to swap)')
                            : t('ตัวละคร: ชาวไร่ชาย (แตะสลับ)', 'Avatar: Male (Tap to swap)')}
                    </span>
                  </button>
                )}

                {onToggleFingerSwipe && (
                  <button
                    type="button"
                    onClick={onToggleFingerSwipe}
                    className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      fingerSwipeEnabled
                        ? 'bg-amber-400 text-stone-950 shadow-sm'
                        : 'bg-[#241712] text-amber-200 hover:bg-stone-800 border border-amber-700/45'
                    }`}
                  >
                    <Hand className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {fingerSwipeEnabled
                        ? t('ปาดนิ้วเก็บ/ปลูก: เปิดอยู่', 'Swipe Farm: ON')
                        : t('ปาดนิ้วเก็บ/ปลูก: ปิด (1 นิ้วลากจอ)', 'Swipe Farm: OFF (1-finger pan)')}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 1.36 การหมุนหน้าจอกล้องฟาร์ม */}
          <div className="bg-gradient-to-r from-emerald-950/60 via-[#1b242c] to-[#241712] border border-emerald-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 flex items-center justify-center shrink-0">
                  <RotateCw className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                    {t(
                      'การหมุนหน้าจอกล้อง (อัตโนมัติ 360° & หมุนด้วยมือ)',
                      'Camera & Screen Rotation (Auto 360° & Manual)'
                    )}
                  </h4>
                  <p className="text-[11px] text-stone-300/90">
                    {t(
                      'ตั้งค่าหมุนรอบฟาร์มพาโนรามาอัตโนมัติ, บิด 2 นิ้วหมุนบนจอ, หรือกดปุ่มหมุนตามองศาที่ต้องการ',
                      'Configure 360° auto-orbit panorama, 2-finger twist on mobile, or manual 45° angle steps'
                    )}
                  </p>
                </div>
              </div>

              {onToggleAutoRotateCamera && (
                <button
                  type="button"
                  onClick={onToggleAutoRotateCamera}
                  aria-pressed={autoRotateCamera}
                  title={autoRotateCamera ? t('ปิดหมุนอัตโนมัติ', 'Turn OFF Auto-Rotate') : t('เปิดหมุนอัตโนมัติ', 'Turn ON Auto-Rotate')}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                    autoRotateCamera ? 'bg-emerald-500' : 'bg-stone-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      autoRotateCamera ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>

            {autoRotateCamera && onChangeAutoRotateSpeed && (
              <div className="flex items-center justify-between gap-2 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2">
                <span className="text-[11px] text-stone-300 font-bold">
                  {t('ความเร็วหมุนอัตโนมัติ:', 'Auto-Rotate Speed:')}
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: t('ช้าสบายตา', 'Slow'), val: 0.05 },
                    { label: t('ปานกลาง', 'Medium'), val: 0.08 },
                    { label: t('เร็ว', 'Fast'), val: 0.15 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => onChangeAutoRotateSpeed(s.val)}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        Math.abs(autoRotateSpeed - s.val) < 0.02
                          ? 'bg-emerald-400 text-stone-950 font-black shadow-sm'
                          : 'bg-[#241712] text-stone-300 hover:bg-stone-800 border border-stone-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2">
              <div className="flex items-center justify-between text-[11px] text-amber-200 font-bold mb-0.5">
                <span>{t('หมุนมุมกล้องด้วยมือ (ทีละ 45°):', 'Manual Camera Angles (45° Steps):')}</span>
                {onResetCameraAngle && (
                  <button
                    type="button"
                    onClick={onResetCameraAngle}
                    className="text-[10px] text-sky-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Compass className="w-3 h-3" />
                    <span>{t('มุม Hay Day เริ่มต้น', 'Default Hay Day')}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onRotateCameraByAngle?.(-Math.PI / 4)}
                  className="min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-black bg-[#241712] text-stone-200 hover:bg-stone-800 border border-stone-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t('ซ้าย 45°', 'Left 45°')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRotateCameraByAngle?.(Math.PI / 4)}
                  className="min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-black bg-[#241712] text-stone-200 hover:bg-stone-800 border border-stone-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t('ขวา 45°', 'Right 45°')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRotateCameraByAngle?.(Math.PI)}
                  className="min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-black bg-[#241712] text-stone-200 hover:bg-stone-800 border border-stone-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>180°</span>
                </button>
                <button
                  type="button"
                  onClick={onResetCameraAngle}
                  className="min-h-[34px] px-2 py-1 rounded-lg text-[11px] font-black bg-[#241712] text-emerald-300 hover:bg-emerald-950/70 border border-emerald-500/40 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('รีเซ็ต', 'Reset')}</span>
                </button>
              </div>

              {onToggleTwoFingerRotate && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800 mt-1">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-stone-200">
                      {t('บิด 2 นิ้วหมุนมุมกล้องบนหน้าจอมือถือ', '2-Finger Twist to Rotate Camera')}
                    </span>
                    <p className="text-[10px] text-stone-400">
                      {t('ใช้นิ้ว 2 นิ้วบิดบนจอเพื่อหมุนมองฟาร์มรอบทิศทางได้อย่างอิสระ', 'Twist two fingers on screen to rotate angle smoothly')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTwoFingerRotate}
                    aria-pressed={twoFingerRotateEnabled}
                    className={`w-10 h-5 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                      twoFingerRotateEnabled ? 'bg-sky-500' : 'bg-stone-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                        twoFingerRotateEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  try {
                    if ('orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
                      await (screen.orientation as any).lock('landscape');
                      addNotice(t('📱 ล็อกหน้าจอเป็นแนวนอนเรียบร้อยแล้ว', '📱 Screen locked to landscape'), '#38bdf8');
                    } else {
                      addNotice(t('📱 อุปกรณ์รองรับการหมุนหน้าจอตามการเอียงของเครื่อง (Auto-Rotate)', '📱 Device supports automatic rotation with tilt'), '#eab308');
                    }
                  } catch {
                    addNotice(t('📱 สำหรับมือถือ: สามารถเปิด Auto-Rotate ในเมนูด่วนของเครื่องแล้วพลิกเครื่องแนวนอนได้เลย', '📱 Mobile tip: turn on Auto-Rotate in your device settings and hold horizontally'), '#eab308');
                  }
                }}
                className="min-h-[30px] px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#241712] text-amber-200 hover:bg-stone-800 border border-amber-700/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{t('คำแนะนำ/ล็อกหน้าจอแนวนอนสำหรับมือถือ', 'Landscape Orientation Tip for Mobile')}</span>
              </button>
            </div>
          </div>

          {/* 1.5 Keyboard WASD Movement Toggle */}
          {onToggleWasd && (
            <div className="bg-[#241712] border border-amber-700/45 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Keyboard className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                      {t('การเดินด้วยปุ่มคีย์บอร์ด (W / A / S / D)', 'WASD Keyboard Movement')}
                    </h4>
                    <p className="text-[11px] text-stone-400 truncate">
                      {t('เปิด/ปิด การบังคับตัวละครเดินด้วยแป้นพิมพ์', 'Toggle character walking via W, A, S, D keys')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onToggleWasd}
                  aria-pressed={wasdEnabled}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    wasdEnabled ? 'bg-emerald-500' : 'bg-stone-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      wasdEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 bg-[#150d0a] border border-[#3c2518] rounded-xl p-2 text-[11px] text-stone-300">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2c1b12] border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">W</kbd>
                  <span>{t('เดินหน้า', 'Move Forward')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2c1b12] border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">S</kbd>
                  <span>{t('ถอยหลัง', 'Move Backward')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2c1b12] border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">A</kbd>
                  <span>{t('เอี้ยวซ้าย (เดินไปทางซ้าย)', 'Turn / Walk Left')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2c1b12] border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px]">D</kbd>
                  <span>{t('เอี้ยวขวา (เดินไปทางขวา)', 'Turn / Walk Right')}</span>
                </div>
              </div>
            </div>
          )}

          {/* 1.55 Mobile Hay Day Touch Drag vs Slide-to-Walk Toggle */}
          {onToggleTouchSlide && (
            <div className="bg-[#241712] border border-amber-700/45 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                      {!touchSlideEnabled
                        ? t('ลากหน้าจอแบบ Hay Day 100% (กำลังใช้งาน)', 'Hay Day 1-Finger Camera Pan (Active)')
                        : t('โหมดจอยลากนิ้วเดินตัวละคร (เปิดอยู่)', '1-Finger Slide-to-Walk Joystick (On)')}
                    </h4>
                    <p className="text-[11px] text-stone-400">
                      {!touchSlideEnabled
                        ? t(
                            'ลาก 1 นิ้วเลื่อนดูฟาร์มลื่นไหล 60 FPS พร้อมแรงเฉื่อยแบบ Hay Day (แตะพื้นสั้นๆ เพื่อเดินไปจุดนั้น)',
                            'Drag 1 finger to pan smoothly across the farm at 60 FPS with Hay Day inertia (tap ground to walk)'
                          )
                        : t(
                            'สลับกลับ (ปิดสวิตช์) เพื่อใช้ 1 นิ้วลากเลื่อนหน้าจอกล้องแบบ Hay Day',
                            'Turn off to use 1-finger Hay Day screen dragging'
                          )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onToggleTouchSlide}
                  aria-pressed={!touchSlideEnabled}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    !touchSlideEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      !touchSlideEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 1.6 Structure & Decoration Edit Toggle */}
          {onToggleStructureEdit && (
            <div className="bg-[#241712] border border-amber-700/45 rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <MousePointerClick className="w-5 h-5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                      {t('ป้ายย้าย/หมุน/เก็บ สิ่งปลูกสร้างและของตกแต่ง', 'Building & Decor Move / Rotate / Store')}
                    </h4>
                    <p className="text-[11px] text-stone-400">
                      {t(
                        'แสดงแถบป้ายย้าย/หมุน/เก็บ และกรอบสีเหลืองใต้ฐาน ย้ายไปวางตรงไหนก็ได้',
                        'Show yellow base frame & Move/Rotate/Store bar to place anywhere'
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onToggleStructureEdit}
                  aria-pressed={structureEditEnabled}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    structureEditEnabled ? 'bg-emerald-500' : 'bg-stone-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      structureEditEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {structureEditEnabled && onChangeStructureEditClickMode && (
                <div className="flex items-center justify-between gap-2 bg-[#150d0a] border border-[#3c2518] rounded-xl p-1.5">
                  <span className="text-[11px] text-stone-300 pl-1.5 truncate">
                    {t('วิธีเลือกวัตถุในฉาก:', 'Selection method:')}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onChangeStructureEditClickMode('double')}
                      className={`min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                        structureEditClickMode === 'double'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {t('ดับเบิลคลิกเมาส์ซ้าย', 'Double-Click')}
                    </button>
                    <button
                      onClick={() => onChangeStructureEditClickMode('single')}
                      className={`min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                        structureEditClickMode === 'single'
                          ? 'bg-amber-500 text-stone-950 shadow-sm'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {t('คลิกซ้าย 1 ครั้ง', 'Single-Click')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Sound Effects Toggle */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Volume2 className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                  {t('เสียงเอฟเฟกต์ (Sound Effects)', 'Sound Effects')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('เสียงเก็บเกี่ยว รดน้ำ และสัตว์ร้อง', 'Harvest, watering, and animal sounds')}
                </p>
              </div>
            </div>

            <button
              onClick={onToggleSoundEffects}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                soundEffectsEnabled ? 'bg-emerald-500' : 'bg-stone-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  soundEffectsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Background Music Toggle */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Music className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                  {t('เสียงบรรยากาศฟาร์ม (Ambient Audio)', 'Ambient Farm Audio')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('ลมพัดผ่านทุ่งนาและนกร้อง (ทำงานออฟไลน์)', 'Procedural breeze & birdsong (works offline)')}
                </p>
              </div>
            </div>

            <button
              onClick={onToggleMusic}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                musicEnabled ? 'bg-emerald-500' : 'bg-stone-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  musicEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. Offline Play & 3D Asset Preparation */}
          <div className="bg-[#241712] border border-emerald-700/40 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-300 truncate">
                    {t('เตรียมข้อมูลเล่นออฟไลน์ (Offline 3D Assets)', 'Offline Play & 3D Asset Cache')}
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    {cacheStats
                      ? t(
                          `พร้อมออฟไลน์ ${cacheStats.cachedGlbCount}/${cacheStats.totalGlbCount} โมเดล 3D • พื้นที่แคช ${cacheStats.formattedSize}`,
                          `Cached ${cacheStats.cachedGlbCount}/${cacheStats.totalGlbCount} 3D models • Storage ${cacheStats.formattedSize}`
                        )
                      : t('กำลังตรวจสอบแคช...', 'Checking local cache...')}
                  </p>
                </div>
              </div>

              <button
                onClick={handlePrepareOffline}
                disabled={isPreparingOffline || !isOnline}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-700 disabled:text-stone-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              >
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>
                  {isPreparingOffline
                    ? `${prepProgress?.completed ?? 0}/${prepProgress?.total ?? 19}`
                    : t('เตรียมออฟไลน์', 'Download All')}
                </span>
              </button>
            </div>

            {isPreparingOffline && prepProgress && (
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{
                      width: `${Math.round((prepProgress.completed / Math.max(1, prepProgress.total)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-emerald-300 font-mono truncate">
                  {t('กำลังตรวจสอบและบันทึก:', 'Validating & caching:')} {prepProgress.currentAsset}
                </p>
              </div>
            )}
          </div>

          {/* 5. Web, PWA & Android APK Install */}
          {onOpenInstall && (
            <div className="bg-gradient-to-r from-emerald-950/60 to-[#241712] border border-emerald-600/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <Download className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-300 truncate">
                    {t('ติดตั้งแอปมือถือ (Web / PWA / Android APK)', 'Install App (Web / PWA / APK)')}
                  </h4>
                  <p className="text-[11px] text-stone-400 truncate">
                    {t('เพิ่มไอคอนลงหน้าจอมือถือ เล่นเต็มจอ รองรับ Android, iOS และ PC', 'Add mobile home icon, fullscreen standalone PWA & Android APK')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { onClose(); onOpenInstall(); }}
                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <span>{t('ติดตั้งแอป', 'Install')}</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 6. Farmer Account */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <User className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                  {t('บัญชีผู้เล่น (Farmer Account)', 'Farmer Profile')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {userAccount.loggedIn
                    ? `${t('ผูกแล้ว:', 'Linked:')} ${userAccount.email || userAccount.name}`
                    : t('โหมดผู้เล่นทั่วไป (Local Save)', 'Local Profile (Guest Mode)')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubModal('account')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{userAccount.loggedIn ? t('ข้อมูลบัญชี', 'Account') : t('จัดการ', 'Manage')}</span>
              <Key className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 6.5 Auto-Save Status & Manual Save Now */}
          <div className="bg-gradient-to-r from-emerald-950/55 to-[#241712] border border-emerald-600/45 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Save className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-emerald-300 truncate">
                  {t('บันทึกเซฟอัตโนมัติ (Auto-Save + IndexedDB)', 'Auto-Save & Local Database')}
                </h4>
                <p className="text-[11px] text-stone-300/90 truncate">
                  {lastSavedTs > 0
                    ? t(
                        `บันทึกล่าสุด ${new Date(lastSavedTs).toLocaleTimeString()} • เซฟลงเครื่องและฐานข้อมูลสำรองอัตโนมัติ`,
                        `Last saved ${new Date(lastSavedTs).toLocaleTimeString()} • Auto-mirrored to IndexedDB`
                      )
                    : t('บันทึกอัตโนมัติทุกครั้งที่ปลูก เก็บเกี่ยว สร้างบ้าน และเดินในฟาร์ม', 'Saves automatically on farming, building & walking')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onSaveNow) {
                  onSaveNow();
                } else {
                  flushAllPendingFarmSaves();
                  farmAudio.playCoinSound();
                  addNotice(t('💾 บันทึกเซฟฟาร์มเรียบร้อยแล้ว!', '💾 Farm progress saved!'), '#4ade80');
                }
                setLastSavedTs(Date.now());
              }}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('บันทึกเซฟตอนนี้', 'Save Now')}</span>
            </button>
          </div>

          {/* 7. Cloud Save & Cross-Device Backup */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Cloud className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                  {t('สำรองและย้ายเครื่อง (Save Backup)', 'Cross-Device Save Backup')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('คัดลอกรหัสเซฟเพื่อย้ายไปมือถือหรือคอมเครื่องอื่น', 'Export or restore save code across devices')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubModal('cloud')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('สำรองเซฟ', 'Backup')}</span>
              <Cloud className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 8. Game Walkthrough */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                  {t('คู่มือแนะนำการเล่น (Walkthrough)', 'Controls & Quest Guide')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('วิธีทำฟาร์ม ปลูกพืช เลี้ยงสัตว์ และปุ่มลัด', 'Learn farming tools, camera modes & quests')}
                </p>
              </div>
            </div>

            <button
              onClick={() => { onClose(); onOpenGuide(); }}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('เปิดคู่มือ', 'Open Guide')}</span>
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 8.5 Realistic Fishing 3D & Trees Dev Docs Dashboard */}
          <div className="bg-[#241712] border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Compass className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                  {t('แดชบอร์ดคู่มือพัฒนา Realistic Fishing 3D', 'Realistic Fishing 3D Dev Dashboard')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('ระบบฟิสิกส์ตกปลา • เศรษฐกิจมะนาว & มะพร้าว • ตัวตรวจสอบ 3D GLB', 'Fishing physics • Lemon & Coconut economy • 3D GLB inspector')}
                </p>
              </div>
            </div>

            <button
              onClick={() => { onClose(); onOpenDevDocs?.(); }}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('เปิดแดชบอร์ด', 'Open Dashboard')}</span>
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 9. Loading Screen Replay */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Clapperboard className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                  {t('หน้าจอเริ่มเกม (Intro Screen)', 'Intro Loading Screen')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('เล่นฉากเปิดเกมอีกครั้ง', 'Replay the Beam Farm 3D intro screen')}
                </p>
              </div>
            </div>

            <button
              onClick={() => { onClose(); onReplayLoadingScreen(); }}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('เล่นซ้ำ', 'Replay')}</span>
              <Clapperboard className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 10. Data Integrity Info */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                  {t('ความปลอดภัยและตรวจสอบ GLB', 'Save & GLB Asset Integrity')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('ตรวจสอบไบนารี GLB ก่อนโหลดและป้องกัน GPU รั่วไหล', 'Pre-flight GLB binary validation & GPU disposal')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubModal('security')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('รายละเอียด', 'Details')}</span>
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 11. Clear Offline Cache */}
          <div className="bg-[#241712] border border-[#482d1c] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Trash2 className="w-5 h-5 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-sky-400 truncate">
                  {t('ล้างแคชไฟล์โมเดล (Clear Asset Cache)', 'Clear Offline Asset Cache')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {cacheStats
                    ? t(
                        `มีไฟล์แคช ${cacheStats.totalCacheEntries} รายการ (${cacheStats.formattedSize}) — ไม่กระทบเซฟเกม`,
                        `${cacheStats.totalCacheEntries} cached files (${cacheStats.formattedSize}) — keeps save progress`
                      )
                    : t('ล้างเฉพาะไฟล์แคชโมเดล ไม่ลบเซฟเกม', 'Clears cached 3D files without touching save data')}
                </p>
              </div>
            </div>

            <button
              onClick={handleClearCache}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('ล้างแคช', 'Clear')}</span>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 12. Reset Progress */}
          <div className="bg-[#241712] border border-red-950/80 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <RotateCcw className="w-5 h-5 text-red-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-red-400 truncate">
                  {t('เริ่มเล่นใหม่ (New Game Reset)', 'Start New Game (Reset Progress)')}
                </h4>
                <p className="text-[11px] text-stone-400 truncate">
                  {t('ล้างเซฟทั้งหมดและเริ่มฟาร์มใหม่ตั้งแต่ต้น', 'Wipe all farm progress and start fresh from Day 1')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubModal('confirmReset')}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              <span>{t('รีเซ็ต', 'Reset')}</span>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#3e271a] bg-[#140e0b] text-center">
          <p className="text-[10px] text-amber-500/70 font-mono tracking-wide">
            {t(
              'Beam Farm 3D • รองรับ Web, PWA, Android APK และโหมดออฟไลน์',
              'Beam Farm 3D • Web, PWA, Android APK & Offline Ready'
            )}
          </p>
        </div>

        {/* SubModal: Farmer Account */}
        {activeSubModal === 'account' && (
          <div className="absolute inset-0 z-20 bg-black/85 p-5 flex flex-col justify-center items-center text-center animate-fade-in">
            <div className="w-full max-w-sm bg-[#221611] border border-[#523522] rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-amber-200">
                {t('โปรไฟล์ผู้เล่นฟาร์ม', 'Farmer Profile')}
              </h3>
              <p className="text-xs text-stone-300">
                {userAccount.loggedIn
                  ? t(
                      `เชื่อมต่อกับ ${userAccount.provider.toUpperCase()} เรียบร้อยแล้ว`,
                      `Connected to ${userAccount.provider.toUpperCase()} profile`
                    )
                  : t(
                      'เซฟเกมถูกบันทึกอัตโนมัติในเครื่อง สามารถผูกโปรไฟล์หรือส่งออกรหัส Backup ได้',
                      'Your farm saves automatically on this device. Link a profile or use Save Backup to transfer.'
                    )}
              </p>

              {userAccount.loggedIn ? (
                <div className="bg-[#150d0a] p-3 rounded-xl border border-stone-800 text-left text-xs space-y-1">
                  <div>
                    <strong className="text-stone-400">{t('ชื่อ:', 'Name:')}</strong>{' '}
                    <span className="text-amber-300 font-bold">{userAccount.name}</span>
                  </div>
                  <div>
                    <strong className="text-stone-400">{t('อีเมล:', 'Email:')}</strong>{' '}
                    <span className="text-stone-200 font-mono">{userAccount.email}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={() => handleSimulateLogin('google')}
                    className="w-full min-h-[40px] py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                  >
                    <span>{t('ตั้งโปรไฟล์ Google Farmer', 'Set Google Farmer Profile')}</span>
                  </button>
                  <button
                    onClick={() => handleSimulateLogin('facebook')}
                    className="w-full min-h-[40px] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                  >
                    <span>{t('ตั้งโปรไฟล์ Facebook Farm', 'Set Facebook Farm Profile')}</span>
                  </button>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                {userAccount.loggedIn && (
                  <button
                    onClick={handleLogout}
                    className="flex-1 min-h-[38px] py-2 rounded-xl bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-400 text-xs font-bold transition-colors"
                  >
                    {t('ออกจากระบบ', 'Sign Out')}
                  </button>
                )}
                <button
                  onClick={() => setActiveSubModal('none')}
                  className="flex-1 min-h-[38px] py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
                >
                  {t('ปิด', 'Close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SubModal: Save Backup */}
        {activeSubModal === 'cloud' && (
          <div className="absolute inset-0 z-20 bg-black/85 p-5 flex flex-col justify-center items-center text-center animate-fade-in">
            <div className="w-full max-w-sm bg-[#221611] border border-[#523522] rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto">
                <Cloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-sky-200">
                {t('สำรองและกู้คืนเซฟเกม', 'Cross-Device Save Backup')}
              </h3>
              <p className="text-xs text-stone-300">
                {t(
                  'คัดลอกรหัส Backup เพื่อย้ายฟาร์มไปเล่นบนมือถือหรือเครื่องอื่นได้ทันที (แม้ไม่มีอินเทอร์เน็ต)',
                  'Copy your encoded save string to transfer your farm to another phone or PC'
                )}
              </p>

              <div className="bg-[#150d0a] p-3.5 rounded-xl border border-sky-600/40 flex items-center justify-between gap-2">
                <div className="text-left">
                  <span className="text-[10px] text-stone-400 block">
                    {t('รหัสประจำฟาร์ม:', 'Farm ID:')}
                  </span>
                  <span className="text-lg font-mono font-black text-sky-300 tracking-wider">
                    {cloudSyncCode}
                  </span>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="min-h-[36px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-stone-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-md whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('คัดลอก Backup', 'Copy Backup')}</span>
                </button>
              </div>

              <div className="text-left space-y-1.5 pt-1">
                <span className="text-[11px] text-stone-300 font-bold block">
                  {t('วางรหัส Backup เพื่อกู้คืน:', 'Paste Backup Code to Restore:')}
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={restoreCodeInput}
                    onChange={(e) => setRestoreCodeInput(e.target.value)}
                    placeholder={t('วางรหัส Backup หรือ JSON...', 'Paste backup string or JSON...')}
                    className="flex-1 bg-[#150d0a] border border-stone-700 rounded-xl px-3 py-1.5 text-xs font-mono text-amber-200 focus:outline-none focus:border-sky-400"
                  />
                  <button
                    onClick={handleRestoreFromCode}
                    className="min-h-[36px] px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
                  >
                    {t('กู้คืน', 'Restore')}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setActiveSubModal('none')}
                className="mt-2 w-full min-h-[38px] py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
              >
                {t('ปิด', 'Close')}
              </button>
            </div>
          </div>
        )}

        {/* SubModal: Engine & Asset Integrity */}
        {activeSubModal === 'security' && (
          <div className="absolute inset-0 z-20 bg-black/85 p-5 flex flex-col justify-center items-center text-center animate-fade-in">
            <div className="w-full max-w-sm bg-[#221611] border border-[#523522] rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-300">
                {t('ระบบตรวจสอบคุณภาพเกม', 'Engine & Asset Protection')}
              </h3>

              <div className="bg-[#150d0a] p-3 rounded-xl border border-emerald-600/30 text-left text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">GLB Pre-Flight Validator:</span>
                  <span className="font-mono text-emerald-400 font-bold">Active (glTF v2)</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">GPU &amp; Texture Disposal:</span>
                  <span className="font-mono text-emerald-400 font-bold">Protected</span>
                </div>
                <div className="flex justify-between items-center border-b border-stone-800 pb-1.5">
                  <span className="text-stone-400">Touch Event Deduplication:</span>
                  <span className="font-mono text-emerald-400 font-bold">Enabled</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">Offline Service Worker:</span>
                  <span className="font-mono text-emerald-400 font-bold">CacheFirst GLB</span>
                </div>
              </div>

              <button
                onClick={() => setActiveSubModal('none')}
                className="mt-1 w-full min-h-[38px] py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold transition-colors"
              >
                {t('ปิด', 'Close')}
              </button>
            </div>
          </div>
        )}

        {/* SubModal: Confirm Reset Progress */}
        {activeSubModal === 'confirmReset' && (
          <div className="absolute inset-0 z-20 bg-black/85 p-5 flex flex-col justify-center items-center text-center animate-fade-in">
            <div className="w-full max-w-sm bg-[#241311] border border-red-600/70 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-red-200">
                {t('ยืนยันเริ่มเล่นใหม่?', 'Start a Brand New Game?')}
              </h3>
              <p className="text-xs text-stone-300">
                {t(
                  'การเริ่มเล่นใหม่จะคืนค่าสถานะฟาร์มทั้งหมด ลบแปลงผัก อาคาร สัตว์เลี้ยง และต้นไม้ที่ปลูกไว้ แล้วเริ่มใหม่ที่ระดับเริ่มต้น',
                  'This wipes your current crops, buildings, animals, and coins, resetting your farm cleanly to Day 1 Level 1.'
                )}
              </p>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setActiveSubModal('none');
                    onClose();
                    onResetProgress();
                  }}
                  className="flex-1 min-h-[40px] py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {t('ยืนยันรีเซ็ต', 'Confirm Reset')}
                </button>
                <button
                  onClick={() => setActiveSubModal('none')}
                  className="flex-1 min-h-[40px] py-2 rounded-xl bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold text-xs transition-colors"
                >
                  {t('ยกเลิก', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};