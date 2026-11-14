// src/components/ui/FarmStatusOverlays.tsx
import React from 'react';
import type { FloatingText } from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';

export interface FarmStatusOverlaysProps {
  hasWorkerQuarters: boolean;
  workerQuartersCount: number;
  isMovingPlotMode: boolean;
  selectedPlotToMove: number | null;
  onToggleMovingPlotMode: () => void;
  floatingTexts: FloatingText[];
}

/**
 * แบนเนอร์โบนัสบ้านพักคนสวน, แบนเนอร์โหมดย้ายแปลงผัก และข้อความแจ้งเตือนลอยกลางจอ (Floating Notices)
 */
export const FarmStatusOverlays: React.FC<FarmStatusOverlaysProps> = ({
  hasWorkerQuarters,
  workerQuartersCount,
  isMovingPlotMode,
  selectedPlotToMove,
  onToggleMovingPlotMode,
  floatingTexts,
}) => {
  const { lang, t } = useLanguage();

  return (
    <>
      {hasWorkerQuarters && (
        <div className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 z-20 pointer-events-none safe-top safe-right">
          <div className="bg-lime-500/90 text-stone-950 font-bold px-2.5 sm:px-3 py-1 rounded-xl shadow-lg border border-lime-300 text-[10px] sm:text-xs flex items-center gap-1 whitespace-nowrap">
            <span>🏡</span>
            <span>
              {lang === 'en'
                ? `Workers ×${workerQuartersCount} • +${workerQuartersCount * 10}%`
                : `คนสวน ×${workerQuartersCount} • โบนัส +${workerQuartersCount * 10}%`}
            </span>
          </div>
        </div>
      )}

      {isMovingPlotMode && (
        <div
          data-ui
          className="absolute top-16 sm:top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[94vw]"
        >
          <div className="bg-amber-500 text-stone-950 font-bold pl-3.5 pr-2 py-1.5 rounded-2xl shadow-lg border border-amber-300 text-xs flex items-center gap-2">
            <span className="truncate">
              {t(
                '📍 โหมดย้ายแปลงผัก: แตะแปลงผักที่ต้องการย้าย',
                '📍 Move Plot Mode: Tap a crop plot to move'
              )}
            </span>
            <button
              onClick={onToggleMovingPlotMode}
              className="min-h-[28px] bg-stone-900/90 hover:bg-stone-800 text-amber-200 px-2.5 py-0.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              {t('เสร็จสิ้น ✕', 'Done ✕')}
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2 z-40 px-3">
        {floatingTexts.map((item) => {
          const isPlotSelectMsg = item.text.includes('เลือกแปลง') || item.text.includes('selected');
          if (isPlotSelectMsg) return null;

          return (
            <div
              key={item.id}
              className="px-4 py-2 rounded-2xl bg-stone-900/95 border border-stone-700/80 shadow-2xl font-bold text-xs sm:text-sm tracking-wide pointer-events-none text-center max-w-[92vw]"
              style={{ color: item.color }}
            >
              {item.text}
            </div>
          );
        })}
      </div>
    </>
  );
};