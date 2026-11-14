// src/components/ui/HarvestHUD.tsx
// Presentational ล้วน — ไม่มี business logic
// รับ props จาก useHarvestMode ผ่าน FarmWorld
import React from 'react';
import type {
  HarvestBatchResult,
  HarvestPhase,
  SelectionSummary,
} from '../../hooks/useHarvestMode';
import { useLanguage } from '../../i18n/LanguageContext';

interface HarvestHUDProps {
  phase: HarvestPhase;
  summary: SelectionSummary;
  totalReadyCount?: number;
  cooldownRemaining: number;
  cooldownTotal?: number;
  canExecute: boolean;
  lastResult: HarvestBatchResult | null;
  onHarvestAll: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

const HarvestHUDInner: React.FC<HarvestHUDProps> = ({
  phase,
  summary,
  totalReadyCount,
  cooldownRemaining,
  cooldownTotal = 800,
  canExecute,
  lastResult,
  onHarvestAll,
  onConfirm,
  onCancel,
  disabled = false,
}) => {
  const { t } = useLanguage();
  if (phase === 'IDLE') return null;

  const isCooldown = phase === 'COOLDOWN';
  const isExecuting = phase === 'EXECUTING';
  const isBusy = isCooldown || isExecuting || disabled;
  const worldReadyCount = totalReadyCount ?? summary.ready;

  const cooldownPct =
    cooldownRemaining > 0
      ? Math.max(0, Math.min(100, (cooldownRemaining / cooldownTotal) * 100))
      : 0;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-ui
      className="fixed inset-x-0 bottom-16 sm:bottom-24 z-30 flex justify-center px-3 sm:px-4 pointer-events-none safe-bottom"
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
    >
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-emerald-500/40 bg-slate-900/95 shadow-2xl shadow-emerald-900/40 p-3.5 sm:p-4 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-semibold tracking-wide text-emerald-300">
              {t('โหมดเก็บเกี่ยว', 'Batch Harvest Mode')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isExecuting}
            className="min-h-[34px] text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            {t('ยกเลิกโหมด', 'Exit Mode')}
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <Stat
            label={t('พร้อมทั้งฟาร์ม', 'Farm Ready')}
            value={worldReadyCount}
            accent="text-emerald-300"
          />
          <Stat
            label={t('แปลงที่เลือก', 'Selected Plots')}
            value={summary.readyPlots}
            accent="text-lime-300"
          />
          <Stat
            label={t('ต้นไม้ที่เลือก', 'Selected Trees')}
            value={summary.readyTrees}
            accent="text-amber-300"
          />
        </div>

        {/* Last result line */}
        {lastResult && lastResult.totalItems > 0 && (
          <div className="mb-3 text-xs text-emerald-200/90 bg-emerald-500/10 rounded-lg px-3 py-1.5">
            {t(
              `รอบล่าสุด: เก็บเข้ากระเป๋า ${lastResult.totalItems} ชิ้น${
                lastResult.totalCoins > 0 ? ` · โบนัส +${lastResult.totalCoins} เหรียญ` : ''
              } · +${lastResult.totalXp} XP`,
              `Last batch: Stored ${lastResult.totalItems} items${
                lastResult.totalCoins > 0 ? ` · Bonus +${lastResult.totalCoins} G` : ''
              } · +${lastResult.totalXp} XP`
            )}
          </div>
        )}

        {/* Cooldown bar */}
        {isCooldown && (
          <div className="mb-3">
            <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-100"
                style={{ width: `${100 - cooldownPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400 text-right">
              {(cooldownRemaining / 1000).toFixed(1)}s
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onHarvestAll}
            disabled={isBusy || worldReadyCount === 0}
            className="min-h-[42px] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            {t(
              `เก็บทั้งหมดที่พร้อม (${worldReadyCount})`,
              `Harvest All Ready (${worldReadyCount})`
            )}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy || !canExecute}
            className="min-h-[42px] rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            {t(`เก็บเฉพาะที่เลือก (${summary.ready})`, `Harvest Selected (${summary.ready})`)}
          </button>
        </div>

        {summary.notReady > 0 && (
          <p className="mt-2 text-[11px] text-slate-400 text-center">
            {t(
              `มีอีก ${summary.notReady} เป้าหมายที่ยังไม่สุก`,
              `${summary.notReady} selected target(s) are not ripe yet`
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export const HarvestHUD = React.memo(HarvestHUDInner);

const Stat: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => (
  <div className="rounded-lg bg-slate-800/60 py-2 px-1">
    <div className={`text-lg font-bold ${accent}`}>{value}</div>
    <div className="text-[11px] text-slate-400 truncate">{label}</div>
  </div>
);

export default HarvestHUD;