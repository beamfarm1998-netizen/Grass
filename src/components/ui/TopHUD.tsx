// src/components/ui/TopHUD.tsx
import React, { useState, useRef, useEffect } from 'react';
import { PlayerStats, TimeOfDay } from '../../types/game';
import {
  Globe, WifiOff, Zap, Camera, User, Sun, Sunset, Moon, Sparkles,
  Volume2, VolumeX, Smartphone,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { AspectRatioMode } from '../../types/aspectRatio';
import { getAspectRatioLabel } from '../../types/aspectRatio';

interface TopHUDProps {
  stats: PlayerStats;
  timeOfDay?: TimeOfDay;
  onCycleTimeOfDay?: () => void;
  skyVistaEnabled?: boolean;
  onToggleSkyVista?: () => void;
  /* 🔊 เปิด/ปิดเสียงทั้งเกม */
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  /* ✅ Aspect Ratio (ใหม่) */
  aspectRatioMode?: AspectRatioMode;
  onCycleAspectRatioMode?: () => void;
}

const TopHUDInner: React.FC<TopHUDProps> = ({
  stats,
  timeOfDay = 'morning',
  onCycleTimeOfDay,
  skyVistaEnabled = false,
  onToggleSkyVista,
  soundEnabled = true,
  onToggleSound,
  aspectRatioMode,
  onCycleAspectRatioMode,
}) => {
  const { lang, toggleLang, t } = useLanguage();
  const isOnline = useOnlineStatus();
  const currentLevelProgress = Math.min(100, (stats.xp / stats.xpToNextLevel) * 100);
  const staminaPercent = Math.min(100, (stats.stamina / stats.maxStamina) * 100);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAvatar = localStorage.getItem('farmer_avatar');
    if (savedAvatar) setAvatarUrl(savedAvatar);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t('รูปภาพใหญ่เกินไป (กรุณาใช้รูปขนาดไม่เกิน 2MB)', 'Image is too large (Max 2MB)'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAvatarUrl(base64String);
      localStorage.setItem('farmer_avatar', base64String);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const aspectLabel = aspectRatioMode
    ? getAspectRatioLabel(aspectRatioMode)
    : null;

  return (
    <div
      data-ui
      className="absolute top-0 left-0 z-20 pointer-events-none p-2 sm:p-3 short:p-1 safe-top safe-left flex items-center gap-1.5 sm:gap-2 short:gap-1 max-w-[calc(100vw-0.5rem)]"
    >
      {/* Profile / Level / XP / Stamina */}
      <div
        data-ui
        className="flex items-center gap-2.5 sm:gap-3 short:gap-2 pointer-events-auto bg-stone-950/88 text-stone-100 border border-white/15 shadow-xl shadow-black/30 ring-1 ring-inset ring-white/10 rounded-2xl px-3 sm:px-3.5 short:px-2 py-2 short:py-1 min-w-0"
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          title={t('เปลี่ยนรูปโปรไฟล์', 'Change Profile Picture')}
          className="relative group shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-amber-300/50 transition-all active:scale-95"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 short:w-8 short:h-8 rounded-full overflow-hidden border-2 border-white/20 bg-black/30 shadow-inner flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-stone-300 drop-shadow-sm" />
            )}
          </div>
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-300 text-stone-900 font-black text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full border-2 border-stone-900 shadow-md min-w-[20px] text-center">
            {stats.level}
          </div>
        </button>

        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

        <div className="flex flex-col gap-1 min-w-[118px] sm:min-w-[150px] short:min-w-[110px]">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-stone-100 whitespace-nowrap">
            <span className="tracking-wide truncate drop-shadow-sm">BEAM FARM 3D</span>
            <span className="text-[11px] text-amber-200 font-mono shrink-0 drop-shadow-sm">
              {stats.xp}/{stats.xpToNextLevel} XP
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/30 border border-white/5 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
              style={{ width: `${currentLevelProgress}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Zap className="w-3 h-3 text-emerald-200 shrink-0 drop-shadow-sm" />
            <div className="w-full h-1.5 bg-black/30 border border-white/5 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-300 font-mono shrink-0 drop-shadow-sm">{stats.stamina}</span>
          </div>
        </div>
      </div>

      {/* 🔊 ปุ่มเปิด/ปิดเสียง */}
      {onToggleSound && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSound(); }}
          title={soundEnabled ? t('ปิดเสียงทั้งหมด', 'Mute All Sounds') : t('เปิดเสียงทั้งหมด', 'Unmute All Sounds')}
          className={`pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl border shadow-lg shadow-black/25 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap ${
            soundEnabled
              ? 'bg-stone-950/88 hover:bg-stone-900/95 text-emerald-200 border-white/15'
              : 'bg-red-950/90 hover:bg-red-900/95 text-red-100 border-red-300/45'
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-red-200 shrink-0" />
          )}
          <span className="drop-shadow-sm">{soundEnabled ? t('เสียง', 'Sound') : t('ปิด', 'Muted')}</span>
        </button>
      )}

      {/* Language */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleLang(); }}
        title={t('สลับภาษาไทย / English', 'Switch Language (TH / EN)')}
        className="pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl bg-stone-950/88 hover:bg-stone-900/95 text-amber-200 border border-white/15 shadow-lg shadow-black/25 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap"
      >
        <Globe className="w-3.5 h-3.5 text-amber-200 shrink-0" />
        <span className="drop-shadow-sm">{lang === 'th' ? 'TH' : 'EN'}</span>
      </button>

      {/* 📱 Aspect Ratio (ใหม่) */}
      {onCycleAspectRatioMode && aspectLabel && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCycleAspectRatioMode(); }}
          title={t(
            'สัดส่วนหน้าจอ: วนสลับ ออโต้ → 18:9 → 16:9 → 19.5:9 → เต็มจอ',
            'Aspect Ratio: cycle Auto → 18:9 → 16:9 → 19.5:9 → Full'
          )}
          className="pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl bg-stone-950/88 hover:bg-stone-900/95 text-sky-200 border border-white/15 shadow-lg shadow-black/25 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-200 shrink-0" />
          <span className="drop-shadow-sm">
            {lang === 'th' ? aspectLabel.th : aspectLabel.en}
          </span>
        </button>
      )}

      {/* Time of Day */}
      {onCycleTimeOfDay && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCycleTimeOfDay(); }}
          title={t('เปลี่ยนช่วงเวลา (เช้า • กลางวัน • เย็น • ค่ำชมพระจันทร์/ดวงดาว)', 'Cycle Time of Day (Morning • Noon • Sunset • Starry Night)')}
          className={`pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl border shadow-lg shadow-black/25 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap ${
            timeOfDay === 'night'
              ? 'bg-indigo-950/92 hover:bg-indigo-900/95 text-indigo-100 border-indigo-300/45'
              : timeOfDay === 'sunset'
                ? 'bg-orange-950/90 hover:bg-orange-900/95 text-orange-100 border-orange-300/45'
                : 'bg-stone-950/88 hover:bg-stone-900/95 text-amber-100 border-white/15'
          }`}
        >
          {timeOfDay === 'night' ? (
            <Moon className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
          ) : timeOfDay === 'sunset' ? (
            <Sunset className="w-3.5 h-3.5 text-orange-300 shrink-0" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          )}
          <span className="drop-shadow-sm">
            {timeOfDay === 'morning' ? t('เช้า', 'Morn')
              : timeOfDay === 'day' ? t('เที่ยง', 'Noon')
              : timeOfDay === 'sunset' ? t('เย็น', 'Dusk')
              : t('ค่ำ', 'Night')}
          </span>
        </button>
      )}

      {/* Sky Vista */}
      {onToggleSkyVista && (timeOfDay === 'night' || timeOfDay === 'sunset' || skyVistaEnabled) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSkyVista(); }}
          title={t('สลับมุมกล้องชมพระจันทร์และดวงดาว / มุมสูงทำฟาร์ม', 'Toggle Moon & Stars Sky Vista / Standard Farm Angle')}
          className={`pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl border shadow-lg shadow-black/25 flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap ${
            skyVistaEnabled
              ? 'bg-sky-900/90 hover:bg-sky-800/95 text-sky-100 border-sky-300/55'
              : 'bg-stone-950/88 hover:bg-stone-900/95 text-stone-200 border-white/15'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-200 shrink-0" />
          <span className="drop-shadow-sm">{skyVistaEnabled ? t('ชมดาว', 'Sky') : t('มองฟ้า', 'Sky')}</span>
        </button>
      )}

      {/* Offline */}
      {!isOnline && (
        <div
          className="pointer-events-auto min-h-[38px] short:min-h-[28px] px-2.5 short:px-2 py-1.5 short:py-0.5 rounded-xl bg-amber-950/90 text-amber-50 border border-amber-300/45 shadow-lg shadow-black/25 flex items-center gap-1.5 text-[11px] font-bold shrink-0 whitespace-nowrap"
          title={t('โหมดออฟไลน์: เล่นต่อได้ด้วยข้อมูลที่เตรียมไว้ในเครื่อง', 'Offline Mode: Playing with cached local assets')}
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-200 shrink-0 drop-shadow-sm" />
          <span className="drop-shadow-sm">{t('ออฟไลน์', 'Offline')}</span>
        </div>
      )}
    </div>
  );
};

export const TopHUD = React.memo(TopHUDInner);