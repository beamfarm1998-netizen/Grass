import React, { useEffect, useState } from 'react';
import { Gamepad2, Monitor, Smartphone, Volume2, VolumeX, X } from 'lucide-react';
import { WeatherType } from '../../core/GameConfig';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import {
  estimateRenderResolutionLabel,
  GRAPHICS_4K_CHANGE_EVENT,
  loadSavedUltra4kEnabled,
  saveUltra4kEnabled,
} from '../../../utils/graphics4k';
import { PWAInstallButton } from '../components/PWAInstallControl';
import { LanguageSelector } from './LanguageSelector';

interface SettingsModalProps {
  hud: GameHUDState;
  onWeatherChange: (weather: WeatherType) => void;
  onMuteToggle: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onJoysticksToggle: (enabled: boolean) => void;
  onHapticsToggle: (enabled: boolean) => void;
  onExportBackup: () => void;
  onResetSave: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  hud,
  onWeatherChange,
  onMuteToggle,
  onVolumeChange,
  onJoysticksToggle,
  onHapticsToggle,
  onExportBackup,
  onResetSave,
  onClose,
}) => {
  const { t, language } = useI18n();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [ultra4k, setUltra4k] = useState<boolean>(() => loadSavedUltra4kEnabled());

  useEffect(() => {
    const sync = () => setUltra4k(loadSavedUltra4kEnabled());
    window.addEventListener(GRAPHICS_4K_CHANGE_EVENT, sync);
    return () => window.removeEventListener(GRAPHICS_4K_CHANGE_EVENT, sync);
  }, []);

  const handleToggle4k = (next: boolean) => {
    setUltra4k(next);
    saveUltra4kEnabled(next);
  };

  const weatherOptions: WeatherType[] = ['clear', 'sunset', 'mist', 'rain'];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col rounded-xl bg-slate-950 border border-white/14 text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{t('settings.title')}</h2>
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. 5-Language Live Selector */}
          <LanguageSelector />

          {/* 1.5 4K Ultra HD Graphics Resolution */}
          <div className="border-t border-white/10 pt-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-100 inline-flex items-center gap-2">
                <Monitor className="w-4 h-4 text-sky-400" />
                <span>
                  {language === 'th'
                    ? 'ความละเอียดภาพกราฟิก 4K Ultra HD'
                    : '4K Ultra HD Graphics'}
                </span>
              </h4>
              <span className="text-xs font-mono text-sky-300">
                {estimateRenderResolutionLabel(ultra4k)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleToggle4k(false)}
                className={`min-h-[42px] px-4 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  !ultra4k
                    ? 'bg-slate-100 text-slate-950 border-white font-semibold'
                    : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                }`}
              >
                {language === 'th' ? 'มาตรฐาน (Standard HD)' : 'Standard HD'}
              </button>
              <button
                type="button"
                onClick={() => handleToggle4k(true)}
                className={`min-h-[42px] px-4 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  ultra4k
                    ? 'bg-sky-400 text-slate-950 border-sky-300 font-semibold'
                    : 'bg-slate-900 text-sky-300 border-sky-500/30 hover:bg-slate-800'
                }`}
              >
                {language === 'th' ? 'ปรับภาพ 4K Ultra HD' : '4K Ultra HD (3840×2160)'}
              </button>
            </div>
          </div>

          {/* 2. Mobile Dual Joysticks & Real Haptics Vibration */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <h4 className="text-sm font-semibold text-slate-100">{t('settings.controls')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onJoysticksToggle(!hud.virtualJoysticks)}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  hud.virtualJoysticks
                    ? 'bg-slate-100 text-slate-950 border-white font-semibold'
                    : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Gamepad2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('settings.joysticks')}</span>
                </span>
                <span className="whitespace-nowrap shrink-0">
                  {hud.virtualJoysticks ? t('settings.joysticksOn') : t('settings.joysticksOff')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onHapticsToggle(!hud.hapticsEnabled)}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  hud.hapticsEnabled
                    ? 'bg-slate-100 text-slate-950 border-white font-semibold'
                    : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('settings.haptics')}</span>
                </span>
                <span className="whitespace-nowrap shrink-0">
                  {hud.hapticsEnabled ? t('settings.hapticsOn') : t('settings.hapticsOff')}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Weather & Atmosphere (including Rain Drizzle + Distant Thunder) */}
          <div className="border-t border-white/10 pt-5 space-y-2.5">
            <h4 className="text-sm font-semibold text-slate-100">{t('settings.weather')}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weatherOptions.map((w) => {
                const active = hud.weather === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onWeatherChange(w)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                      active
                        ? 'bg-slate-100 text-slate-950 border-white font-semibold'
                        : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                    }`}
                  >
                    {t(`weather.${w}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Audio Synthesizer Settings */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-100">{t('settings.audio')}</h4>
              <button
                type="button"
                onClick={() => onMuteToggle(!hud.audioMuted)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-white/12 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {hud.audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{hud.audioMuted ? t('settings.unmute') : t('settings.mute')}</span>
              </button>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <label htmlFor="vol-slider" className="text-xs text-slate-400 whitespace-nowrap">
                {t('settings.volume')} ({Math.round(hud.audioVolume * 100)}%)
              </label>
              <input
                id="vol-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={hud.audioVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>
          </div>

          {/* 5. IndexedDB Save Data & PWA Installation */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{t('settings.saveData')}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings.savedNote')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <PWAInstallButton />
              <button
                type="button"
                onClick={onExportBackup}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-white/15 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('settings.exportBackup')}
              </button>
              {!confirmingReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-red-500/30 bg-red-950/30 hover:bg-red-950/50 text-xs font-medium text-red-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t('settings.resetSave')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onResetSave();
                    setConfirmingReset(false);
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t('settings.resetConfirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
