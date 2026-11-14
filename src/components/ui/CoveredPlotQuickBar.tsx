// src/components/ui/CoveredPlotQuickBar.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Droplets, Sparkles, Sprout } from 'lucide-react';
import {
  CROP_DEFINITIONS,
  type CropType,
  type FarmPlot,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCropName } from '../../i18n/translations';

const ALL_CROP_KEYS = Object.keys(CROP_DEFINITIONS) as CropType[];

export interface CoveredPlotQuickBarProps {
  houseId: string;
  plots: FarmPlot[];
  seedCounts: Record<CropType, number>;
  playerCoins: number;
  onPlantCrop: (houseId: string, crop: CropType) => void;
  onWaterAll: (houseId: string) => void;
  onHarvestAll: (houseId: string) => void;
}

export const CoveredPlotQuickBar: React.FC<CoveredPlotQuickBarProps> = ({
  houseId,
  plots,
  seedCounts,
  playerCoins,
  onPlantCrop,
  onWaterAll,
  onHarvestAll,
}) => {
  const { lang, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const beds = plots
    .filter((p) => p.coveredByHouseId === houseId)
    .sort((a, b) => (a.coveredSlot ?? 0) - (b.coveredSlot ?? 0));

  const openBedsCount = beds.filter(
    (b) => b.status === 'EMPTY' || b.status === 'PLOWED'
  ).length;
  const dryGrowingCount = beds.filter(
    (b) => (b.status === 'PLANTED' || b.status === 'GROWING') && !b.isWatered
  ).length;
  const readyCount = beds.filter((b) => b.status === 'READY').length;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-2 w-[min(26rem,92vw)]"
    >
      {expanded && (
        <div className="w-full rounded-2xl bg-stone-950/95 border border-emerald-300/35 p-2.5 sm:p-3 shadow-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sprout className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-xs font-black text-white truncate">
                {t(
                  'แปลงผักแบบมีหลังคา • ปลูกผักได้ทุกชนิด (+25% โตไว)',
                  'Covered Vegetable Plot • Grow All Crops (+25% Speed)'
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[11px] font-bold text-white/75 hover:text-white px-2 py-0.5 rounded-lg bg-white/10"
            >
              {t('ย่อ', 'Hide')}
            </button>
          </div>

          {/* Live status of the 2 sheltered beds */}
          <div className="grid grid-cols-2 gap-1.5">
            {[0, 1].map((slotIdx) => {
              const bed = beds[slotIdx];
              const cropDef = bed?.cropType ? CROP_DEFINITIONS[bed.cropType] : null;
              const pct = bed ? Math.round(bed.growthProgress * 100) : 0;
              return (
                <div
                  key={slotIdx}
                  className="flex items-center justify-between gap-1.5 rounded-xl bg-white/[0.06] border border-white/15 px-2.5 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm leading-none shrink-0">
                      {cropDef ? cropDef.iconEmoji : '🌱'}
                    </span>
                    <span className="font-bold text-white truncate">
                      {cropDef
                        ? getCropName(cropDef.id, lang)
                        : t(`ช่อง #${slotIdx + 1} ว่าง`, `Bed #${slotIdx + 1} Ready`)}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-black shrink-0 ${
                      bed?.status === 'READY'
                        ? 'text-amber-300'
                        : cropDef
                          ? bed?.isWatered
                            ? 'text-sky-300'
                            : 'text-emerald-300'
                          : 'text-white/60'
                    }`}
                  >
                    {bed?.status === 'READY'
                      ? t('สุกแล้ว!', 'Ready!')
                      : cropDef
                        ? `${pct}%${bed?.isWatered ? '💧' : ''}`
                        : t('พร้อมปลูก', 'Open')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All 8 crops in the game */}
          <div className="grid grid-cols-4 gap-1.5">
            {ALL_CROP_KEYS.map((cropKey) => {
              const def = CROP_DEFINITIONS[cropKey];
              const owned = seedCounts[cropKey] || 0;
              const canPlant =
                openBedsCount > 0 && (owned > 0 || playerCoins >= def.seedCost);
              return (
                <button
                  key={cropKey}
                  type="button"
                  disabled={!canPlant}
                  onClick={() => onPlantCrop(houseId, cropKey)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-1.5 transition-all ${
                    canPlant
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-300/40 text-white active:scale-95'
                      : 'bg-white/[0.03] border-white/10 text-white/35 cursor-not-allowed'
                  }`}
                >
                  <span className="text-base leading-none">{def.iconEmoji}</span>
                  <span className="text-[10px] font-black truncate max-w-full mt-0.5">
                    {getCropName(cropKey, lang)}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-amber-200/90">
                    {owned > 0
                      ? t(`ถุง:${owned}`, `Bag:${owned}`)
                      : `${def.seedCost}🪙`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Action Strip */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {readyCount > 0 && (
          <button
            type="button"
            onClick={() => onHarvestAll(houseId)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-stone-950 font-black px-3.5 py-2.5 rounded-2xl border-2 border-amber-100 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-stone-950" />
            <span>
              {t(
                `เก็บเกี่ยวผัก (${readyCount} ช่อง)`,
                `Harvest Ready (${readyCount})`
              )}
            </span>
          </button>
        )}

        {dryGrowingCount > 0 && (
          <button
            type="button"
            onClick={() => onWaterAll(houseId)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-400 hover:from-sky-400 hover:to-blue-300 text-stone-950 font-black px-3.5 py-2.5 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
          >
            <Droplets className="w-4 h-4 text-stone-950" />
            <span>
              {t(
                `รดน้ำเร่งโต (${dryGrowingCount} ช่อง)`,
                `Water Beds (${dryGrowingCount})`
              )}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 via-green-400 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-stone-950 font-black px-4 py-2.5 rounded-2xl border-2 border-emerald-100 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base leading-none">🌱</span>
          <span>
            {openBedsCount > 0
              ? t(
                  `เลือกปลูกผักทุกชนิด (${openBedsCount}/2 ช่องว่าง)`,
                  `Plant Any Crop (${openBedsCount}/2 Open)`
                )
              : t('ดูสถานะแปลงผักมีหลังคา', 'Covered Plot Crops')}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-stone-950" />
          ) : (
            <ChevronUp className="w-4 h-4 text-stone-950" />
          )}
        </button>
      </div>
    </div>
  );
};
