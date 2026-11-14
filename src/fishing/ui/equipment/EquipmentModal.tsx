import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import {
  BAIT_CATALOG,
  LINE_CATALOG,
  REEL_CATALOG,
  ROD_CATALOG,
} from '../../systems/equipment/EquipmentCatalog';
import { FishingState } from '../../systems/fishing/FishingState';

interface EquipmentModalProps {
  hud: GameHUDState;
  onBuyOrEquip: (category: 'rod' | 'reel' | 'line' | 'bait', itemId: string) => void;
  onClose: () => void;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  hud,
  onBuyOrEquip,
  onClose,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'rod' | 'reel' | 'line' | 'bait'>('rod');

  const tabs: Array<{ id: 'rod' | 'reel' | 'line' | 'bait'; labelKey: string }> = [
    { id: 'rod', labelKey: 'equip.rod' },
    { id: 'reel', labelKey: 'equip.reel' },
    { id: 'line', labelKey: 'equip.line' },
    { id: 'bait', labelKey: 'equip.bait' },
  ];

  const isEncounterLocked =
    hud.fishingState === FishingState.BITE ||
    hud.fishingState === FishingState.HOOKED ||
    hud.fishingState === FishingState.FIGHTING ||
    hud.fishingState === FishingState.REELING ||
    hud.fishingState === FishingState.LANDED ||
    hud.fishingState === FishingState.RESULT;

  const renderAction = (
    category: 'rod' | 'reel' | 'line' | 'bait',
    id: string,
    unlockLevel: number,
    priceCoins: number
  ) => {
    const equippedId =
      category === 'rod'
        ? hud.equippedRodId
        : category === 'reel'
        ? hud.equippedReelId
        : category === 'line'
        ? hud.equippedLineId
        : hud.equippedBaitId;

    const isEquipped = equippedId === id;
    const isOwned = hud.ownedEquipmentIds.includes(id);
    const isLocked = hud.level < unlockLevel;
    const canAfford = hud.coins >= priceCoins;

    if (isEquipped) {
      return (
        <span className="text-xs font-semibold text-amber-400 whitespace-nowrap shrink-0">
          {t('equip.equipped')}
        </span>
      );
    }

    if (isLocked) {
      return (
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          {t('equip.lockedLevel', { level: unlockLevel })}
        </span>
      );
    }

    if (isOwned) {
      return (
        <button
          type="button"
          disabled={isEncounterLocked}
          onClick={() => onBuyOrEquip(category, id)}
          className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            isEncounterLocked
              ? 'bg-slate-900 text-slate-500 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer'
          }`}
        >
          {t('equip.equip')}
        </button>
      );
    }

    const canBuyNow = canAfford && !isEncounterLocked;
    return (
      <button
        type="button"
        disabled={!canBuyNow}
        onClick={() => onBuyOrEquip(category, id)}
        className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
          canBuyNow
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {t('equip.buy', { price: priceCoins })}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[84vh] flex flex-col rounded-xl bg-slate-950 border border-white/14 text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">{t('equip.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {t('stats.level')} {hud.level} · {hud.coins} {t('stats.coins')}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Segmented Controls */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-white/8 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  tab === item.id
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto divide-y divide-white/10">
          {tab === 'rod' &&
            ROD_CATALOG.map((rod) => (
              <div key={rod.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t(rod.nameKey)}</div>
                  <div className="text-xs text-slate-400 mt-1 tabular-nums">
                    {t('equip.strength')} {rod.strengthRatingN} N · {t('equip.flexibility')} {Math.round(rod.flexibility * 100)}%
                  </div>
                </div>
                {renderAction('rod', rod.id, rod.unlockLevel, rod.priceCoins)}
              </div>
            ))}

          {tab === 'reel' &&
            REEL_CATALOG.map((reel) => (
              <div key={reel.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t(reel.nameKey)}</div>
                  <div className="text-xs text-slate-400 mt-1 tabular-nums">
                    {t('equip.dragPower')} {reel.maxDragN} N · {t('equip.reelSpeed')} {reel.recoveryRateMps.toFixed(1)} m/s
                  </div>
                </div>
                {renderAction('reel', reel.id, reel.unlockLevel, reel.priceCoins)}
              </div>
            ))}

          {tab === 'line' &&
            LINE_CATALOG.map((line) => (
              <div key={line.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t(line.nameKey)}</div>
                  <div className="text-xs text-slate-400 mt-1 tabular-nums">
                    {t('equip.lineTest')} {line.breakStrengthN} N · k={line.stiffnessK} N/m
                  </div>
                </div>
                {renderAction('line', line.id, line.unlockLevel, line.priceCoins)}
              </div>
            ))}

          {tab === 'bait' &&
            BAIT_CATALOG.map((bait) => (
              <div key={bait.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t(bait.nameKey)}</div>
                  <div className="text-xs text-slate-400 mt-1 tabular-nums">
                    {t('equip.attraction')} ×{bait.attractionMultiplier.toFixed(2)} · {t('fishing.depth')} {bait.targetDepthM.toFixed(1)}m
                  </div>
                </div>
                {renderAction('bait', bait.id, bait.unlockLevel, bait.priceCoins)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
