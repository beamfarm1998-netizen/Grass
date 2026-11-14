import React from 'react';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import { FishRegistry } from '../../systems/fish/FishRegistry';
import { FishingState } from '../../systems/fishing/FishingState';

interface CatchResultModalProps {
  hud: GameHUDState;
  onKeepFish: () => void;
  onReleaseFish: () => void;
  onDismissFailure: () => void;
}

export const CatchResultModal: React.FC<CatchResultModalProps> = ({
  hud,
  onKeepFish,
  onReleaseFish,
  onDismissFailure,
}) => {
  const { t } = useI18n();
  const state = hud.fishingState;
  const result = hud.lastResult;

  const isSuccess = state === FishingState.RESULT && result?.outcome === 'landed' && result.fish;
  const isFailure =
    state === FishingState.FISH_ESCAPED ||
    state === FishingState.HOOK_FAILED ||
    state === FishingState.LINE_BROKEN;

  if (!isSuccess && !isFailure) return null;

  if (isSuccess && result?.fish) {
    const fish = result.fish;
    const species = FishRegistry.getById(fish.speciesId);

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-xl rounded-xl bg-slate-950/94 border border-white/14 p-5 text-slate-100 shadow-2xl">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-amber-400">
                {t('outcome.landedTitle')}
                {result.isNewRecord ? ` · ${t('outcome.newRecord')}` : ''}
              </p>
              <h2 className="text-xl font-bold text-white mt-0.5">{t(species.nameKey)}</h2>
            </div>
            <span className="text-xs text-slate-300">
              {t('outcome.rarity')} · {t(`rarity.${fish.rarity}`)}
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{t(species.descKey)}</p>

          <div className="grid grid-cols-4 gap-3 my-4 py-3 border-y border-white/10 tabular-nums">
            <div>
              <div className="text-[11px] text-slate-400">{t('outcome.weight')}</div>
              <div className="text-sm font-mono font-semibold text-white mt-0.5">
                {fish.weightKg.toFixed(2)} kg
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{t('outcome.length')}</div>
              <div className="text-sm font-mono font-semibold text-white mt-0.5">
                {fish.lengthCm} cm
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{t('outcome.rewardCoins')}</div>
              <div className="text-sm font-mono font-semibold text-amber-400 mt-0.5">
                +{result.coinsEarned ?? fish.valueCoins}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">{t('outcome.rewardXp')}</div>
              <div className="text-sm font-mono font-semibold text-sky-400 mt-0.5">
                +{result.xpEarned ?? 20} XP
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onReleaseFish}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-white/15 bg-slate-900 hover:bg-slate-800 text-xs sm:text-sm font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t('fishing.releaseFish')}
            </button>
            <button
              type="button"
              onClick={onKeepFish}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs sm:text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t('fishing.keepFish')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const titleKey =
    state === FishingState.LINE_BROKEN
      ? 'outcome.lineBrokenTitle'
      : state === FishingState.HOOK_FAILED
      ? 'outcome.hookFailedTitle'
      : 'outcome.escapedTitle';

  const descKey =
    state === FishingState.LINE_BROKEN
      ? 'outcome.lineBrokenDesc'
      : state === FishingState.HOOK_FAILED
      ? 'outcome.hookFailedDesc'
      : 'outcome.escapedDesc';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-xl bg-slate-950/94 border border-white/14 p-5 text-slate-100 shadow-2xl">
        <h2 className="text-lg font-bold text-white">{t(titleKey)}</h2>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{t(descKey)}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDismissFailure}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs sm:text-sm font-semibold text-slate-950 transition-colors whitespace-nowrap cursor-pointer"
          >
            {t('fishing.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};
