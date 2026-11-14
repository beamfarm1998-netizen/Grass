import React from 'react';
import { X } from 'lucide-react';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import { FishRegistry } from '../../systems/fish/FishRegistry';

interface StatsModalProps {
  hud: GameHUDState;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ hud, onClose }) => {
  const { t } = useI18n();
  const { stats } = hud;
  const successRate =
    stats.totalCasts > 0 ? Math.round((stats.totalCatches / stats.totalCasts) * 100) : 0;

  const biggestName = stats.biggestSpeciesId
    ? t(FishRegistry.getById(stats.biggestSpeciesId).nameKey)
    : '—';

  const rows: Array<{ label: string; value: string }> = [
    { label: t('stats.level'), value: `${hud.level}` },
    { label: t('stats.xp'), value: `${hud.xp} / ${hud.xpToNextLevel} XP` },
    { label: t('stats.coins'), value: `${hud.coins}` },
    { label: t('stats.casts'), value: `${stats.totalCasts}` },
    { label: t('stats.catches'), value: `${stats.totalCatches}` },
    { label: t('stats.escaped'), value: `${stats.totalEscaped}` },
    { label: t('stats.lineBreaks'), value: `${stats.totalLineBreaks}` },
    { label: t('stats.successRate'), value: `${successRate}%` },
    {
      label: t('stats.biggestCatch'),
      value: stats.biggestWeightKg > 0 ? `${biggestName} (${stats.biggestWeightKg.toFixed(2)} kg)` : '—',
    },
    { label: t('stats.activeFishInLake'), value: `${hud.activeFishCount}` },
    {
      label: t('stats.glbStatus'),
      value: hud.glbAssetsValidated ? t('stats.glbVerified') : '—',
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
      <div className="w-full max-w-lg max-h-[84vh] flex flex-col rounded-xl bg-slate-950 border border-white/14 text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">{t('stats.title')}</h2>
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto divide-y divide-white/10 tabular-nums">
          {rows.map((row) => (
            <div key={row.label} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-400">{row.label}</span>
              <span className="font-mono font-semibold text-white text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
