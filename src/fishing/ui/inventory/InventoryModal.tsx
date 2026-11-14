import React from 'react';
import { X } from 'lucide-react';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import { FishRegistry } from '../../systems/fish/FishRegistry';

interface InventoryModalProps {
  hud: GameHUDState;
  onSellFish: (id: string) => void;
  onSellAll: () => void;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  onSellFish,
  onSellAll,
  onClose,
}) => {
  const { t } = useI18n();
  const totalWeight = hud.inventory.reduce((sum, f) => sum + f.weightKg, 0);
  const totalValue = hud.inventory.reduce((sum, f) => sum + f.valueCoins, 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[84vh] flex flex-col rounded-xl bg-slate-950 border border-white/14 text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">{t('inventory.title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {t('inventory.totalCaught')} {hud.inventory.length} · {t('inventory.totalWeight')} {totalWeight.toFixed(2)} kg
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hud.inventory.length > 0 && (
              <button
                type="button"
                onClick={onSellAll}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('inventory.sellAll', { price: totalValue })}
              </button>
            )}
            <button
              type="button"
              aria-label={t('settings.close')}
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {hud.inventory.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              {t('inventory.empty')}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {hud.inventory.map((item) => {
                const species = FishRegistry.getById(item.speciesId);
                return (
                  <div
                    key={item.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 tabular-nums"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {t(species.nameKey)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {t(`rarity.${item.rarity}`)} · {item.weightKg.toFixed(2)} kg · {item.lengthCm} cm
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSellFish(item.id)}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-white/15 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t('inventory.sell', { price: item.valueCoins })}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
