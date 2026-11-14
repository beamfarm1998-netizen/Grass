import React from 'react';
import { useI18n } from '../../localization/i18n';
import { usePWAInstall } from '../../platform/usePWAInstall';
import { PWAInstallButton } from '../components/PWAInstallControl';

export type ActiveModalType = 'equipment' | 'inventory' | 'stats' | 'settings' | null;

interface TopNavBarProps {
  activeModal: ActiveModalType;
  paused: boolean;
  onSelectModal: (modal: ActiveModalType) => void;
  onTogglePause: () => void;
  /** ถ้าส่งมา จะแสดงปุ่มกลับฟาร์มแทนชื่อเกมบนจอเล็ก */
  onExit?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeModal,
  paused,
  onSelectModal,
  onTogglePause,
  onExit,
}) => {
  const { t } = useI18n();
  const { isInstallable, isInstalled, isIOS } = usePWAInstall();
  const showInstallInHeader = !isInstalled && (isInstallable || isIOS);

  const navItems: Array<{ id: Exclude<ActiveModalType, null>; labelKey: string }> = [
    { id: 'equipment', labelKey: 'menu.equipment' },
    { id: 'inventory', labelKey: 'menu.inventory' },
    { id: 'stats', labelKey: 'menu.stats' },
    { id: 'settings', labelKey: 'menu.settings' },
  ];

  return (
    <header className="pointer-events-auto w-full flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 h-13 bg-slate-950/90 border-b border-white/10 z-30">
      {/* Zone 1: Single-element Brand Wordmark */}
      <div className="flex items-center gap-2 shrink-0">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            aria-label="กลับฟาร์ม"
            className="min-h-[40px] px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            ← ฟาร์ม
          </button>
        )}
        <span
          className={`font-display text-sm sm:text-base font-bold tracking-tight text-slate-100 whitespace-nowrap ${
            onExit ? 'hidden sm:inline' : ''
          }`}
        >
          {t('game.title')}
        </span>
      </div>

      {/* Zone 2: 4 Single-line Navigation Links */}
      <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-slate-300 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeModal === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModal(isActive ? null : item.id)}
              className={`min-h-[40px] py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                isActive
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-300 border-transparent hover:text-white hover:border-white/30'
              }`}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center shrink-0">
        {showInstallInHeader ? (
          <PWAInstallButton compact />
        ) : (
          <button
            type="button"
            onClick={onTogglePause}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300"
          >
            {paused ? t('menu.resume') : t('menu.pause')}
          </button>
        )}
      </div>
    </header>
  );
};
