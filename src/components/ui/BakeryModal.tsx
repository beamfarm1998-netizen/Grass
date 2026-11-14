// src/components/ui/BakeryModal.tsx
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Flame,
  LogOut,
  ShoppingBasket,
  Star,
  Timer,
  Zap,
} from 'lucide-react';
import {
  BAKED_GOOD_DEFS,
  BakedGoodDef,
  BakedGoodType,
  BakingJob,
  CROP_DEFINITIONS,
  CropType,
  FarmerGender,
  getOvenMasteryStars,
  OVEN_MASTERY_BOOST_COST_COINS,
  OVEN_MASTERY_STAR_THRESHOLDS,
  OVEN_RUSH_COST_COINS,
  OVEN_SLOTS_PER_BUILDING,
  OvenMachineType,
  TreeType,
  TREE_DEFINITIONS,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  formatBrewDuration,
  getBakedGoodDesc,
  getBakedGoodName,
  getCropName,
  getTreeFruitName,
} from '../../i18n/translations';
import { farmAudio } from '../../utils/audio';

export interface BakeryModalProps {
  isOpen: boolean;
  ovenHouseId: string | null;
  machineType: OvenMachineType;
  playerGender: FarmerGender;
  coins: number;
  inventoryCrops: Record<CropType, number>;
  inventoryTreeFruits?: Record<TreeType, number>;
  inventoryBakedGoods: Record<BakedGoodType, number>;
  bakingJobs: BakingJob[];
  ovenMasterySeconds: Record<OvenMachineType, number>;
  onStartBaking: (
    houseId: string,
    machine: OvenMachineType,
    itemType: BakedGoodType
  ) => boolean;
  onRushBakingJob: (jobId: string) => boolean;
  onCollectBakedJob: (jobId: string) => boolean;
  onCollectOvenBasket: (houseId?: string) => number;
  onBoostOvenMastery: (machine: OvenMachineType) => boolean;
  onSellBakedGood: (itemType: BakedGoodType, count: number) => void;
  onClose: () => void;
}

const PROGRESS_SEGMENTS = 12;

// ============================================================
// DESIGN TOKENS (ปรับให้เล็กลงครึ่ง และเปลี่ยนเป็นโทนสีเหลือง)
// ============================================================
const GLASS_PILL =
  'relative overflow-hidden bg-gradient-to-br from-white/70 via-white/20 to-white/10 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_5px_rgba(255,255,255,0.9),inset_0_-1px_3px_rgba(255,255,255,0.3),0_5px_10px_rgba(0,0,0,0.1),-1px_0_2px_rgba(255,100,100,0.3),1px_0_2px_rgba(100,150,255,0.3)]';
const GLASS_CIRCLE =
  'relative overflow-hidden flex items-center justify-center rounded-full bg-gradient-to-br from-white/80 via-white/30 to-white/10 backdrop-blur-md border border-white/70 shadow-[inset_0_1px_4px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(255,255,255,0.4),0_4px_8px_rgba(0,0,0,0.15),-1px_0_1px_rgba(255,150,150,0.4),1px_0_1px_rgba(150,200,255,0.4)]';

// 🔹 เงาสีดำเพื่อให้ตัวหนังสือสีเหลืองเด่นชัด
const TEXT_SHARP_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]';
const TEXT_SOFT_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.7)]';
const TEXT_LIGHT_HALO = '[text-shadow:0_1px_1px_rgba(0,0,0,0.5)]';

const BTN_GREEN =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white border-[#6a8a32] shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100';
const BTN_AMBER =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] text-[#3a2a05] border-[#c9a03a] shadow-[0_2px_5px_rgba(201,160,58,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GLASS =
  'min-h-[18px] px-2 py-0.5 rounded-full font-bold text-[9px] transition-all active:scale-95 whitespace-nowrap border bg-white/40 hover:bg-white/60 text-black border-white/60 shadow-sm';

// ============================================================
// COMPONENT
// ============================================================
export const BakeryModal: React.FC<BakeryModalProps> = ({
  isOpen,
  ovenHouseId,
  machineType,
  playerGender,
  coins,
  inventoryCrops,
  inventoryTreeFruits = {} as Record<TreeType, number>,
  inventoryBakedGoods,
  bakingJobs,
  ovenMasterySeconds,
  onStartBaking,
  onRushBakingJob,
  onCollectBakedJob,
  onCollectOvenBasket,
  onBoostOvenMastery,
  onSellBakedGood,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'recipes' | 'pantry'>('recipes');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !ovenHouseId) return null;

  const isBakery = machineType === 'bakery';
  const masterySec = ovenMasterySeconds[machineType] || 0;
  const stars = getOvenMasteryStars(masterySec);
  const nextThreshold: number =
    stars === 0
      ? OVEN_MASTERY_STAR_THRESHOLDS[0]
      : stars === 1
        ? OVEN_MASTERY_STAR_THRESHOLDS[1]
        : OVEN_MASTERY_STAR_THRESHOLDS[2];
  const prevThreshold: number =
    stars === 0
      ? 0
      : stars === 1
        ? OVEN_MASTERY_STAR_THRESHOLDS[0]
        : stars === 2
          ? OVEN_MASTERY_STAR_THRESHOLDS[1]
          : OVEN_MASTERY_STAR_THRESHOLDS[2];
  const masteryProgressRatio =
    stars >= 3
      ? 1
      : Math.min(
          1,
          Math.max(0, (masterySec - prevThreshold) / Math.max(1, nextThreshold - prevThreshold))
        );
  const masteryFilledSegments = Math.round(masteryProgressRatio * PROGRESS_SEGMENTS);

  const houseJobs = bakingJobs.filter((j) => j.houseId === ovenHouseId);
  const activeOvenJobs = houseJobs.filter((j) => nowMs < j.finishAt);
  const basketReadyJobs = houseJobs.filter((j) => nowMs >= j.finishAt);
  const slotsFull = activeOvenJobs.length >= OVEN_SLOTS_PER_BUILDING;

  const allDefsForMachine = Object.values(BAKED_GOOD_DEFS).filter(
    (d) => d.machine === machineType
  );
  const breadAndCookieDefs = allDefsForMachine.filter((d) => d.category === 'bread');
  const pizzaDefs = allDefsForMachine.filter((d) => d.category === 'pizza');
  const pieDefs = allDefsForMachine.filter((d) => d.category === 'pie');

  const allBakedList = Object.values(BAKED_GOOD_DEFS);
  const totalPantryCount = allBakedList.reduce(
    (sum, item) => sum + (inventoryBakedGoods[item.id] || 0),
    0
  );

  const canAffordIngredients = (def: BakedGoodDef): boolean => {
    for (const [c, needed] of Object.entries(def.cropsRequired)) {
      if (needed && (inventoryCrops[c as CropType] || 0) < needed) return false;
    }
    if (def.fruitsRequired) {
      for (const [f, needed] of Object.entries(def.fruitsRequired)) {
        if (needed && (inventoryTreeFruits[f as TreeType] || 0) < needed) return false;
      }
    }
    return true;
  };

  // ==========================================================
  // RECIPE CARD
  // ==========================================================
  const renderRecipeCard = (def: BakedGoodDef) => {
    const hasIngredients = canAffordIngredients(def);
    const canBake = hasIngredients && !slotsFull && basketReadyJobs.length < 8;
    const ownedCount = inventoryBakedGoods[def.id] || 0;
    const effectivePrice = stars >= 1 ? Math.round(def.sellPrice * 1.1) : def.sellPrice;
    const effectiveXp = stars >= 2 ? Math.round(def.xpReward * 1.15) : def.xpReward;

    return (
      <div
        key={def.id}
        className={`${GLASS_PILL} flex flex-col justify-between gap-2 p-2.5 rounded-[1rem]`}
      >
        <div className="absolute top-0.5 left-3 w-1/2 h-0.5 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          {/* Header row */}
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`${GLASS_CIRCLE} w-8 h-8 text-lg shrink-0`}>
                {def.iconEmoji}
              </div>
              <div className="min-w-0">
                <h4
                  className={`font-extrabold text-yellow-300 text-[11px] sm:text-xs truncate ${TEXT_SOFT_HALO}`}
                >
                  {getBakedGoodName(def.id, lang)}
                </h4>
                <div
                  className={`flex items-center gap-1 text-[9px] text-yellow-200 mt-0.5 tabular-nums flex-wrap ${TEXT_LIGHT_HALO}`}
                >
                  <span className="text-yellow-400 font-bold font-mono">
                    {effectivePrice} G{stars >= 1 ? ' (★+10%)' : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-yellow-400 font-bold font-mono">
                    +{effectiveXp} XP{stars >= 2 ? ' (★★+15%)' : ''}
                  </span>
                </div>
              </div>
            </div>
            {ownedCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full bg-black/20 border border-white/20 text-[9px] font-mono font-black text-yellow-300 shrink-0 tabular-nums ${TEXT_LIGHT_HALO}`}
              >
                x{ownedCount}
              </span>
            )}
          </div>

          {/* Description */}
          <p className={`text-[9px] font-medium text-yellow-100 leading-snug ${TEXT_LIGHT_HALO}`}>
            {getBakedGoodDesc(def.id, lang)}
          </p>

          {/* Time comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-0.5 text-[9px] tabular-nums">
            <div
              className={`px-1.5 py-1 rounded-full border flex items-center justify-between gap-1 ${
                stars < 3
                  ? 'bg-amber-100/40 border-amber-300/70 text-yellow-300 font-bold'
                  : 'bg-white/20 border-white/40 text-white/50 line-through'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Timer className="w-2.5 h-2.5 shrink-0" />
                {t('ปกติ:', 'Normal:')}
              </span>
              <span className="font-mono">{formatBrewDuration(def.normalTimeSeconds, lang)}</span>
            </div>

            <div
              className={`px-1.5 py-1 rounded-full border flex items-center justify-between gap-1 ${
                stars >= 3
                  ? 'bg-emerald-100/45 border-emerald-300/70 text-emerald-300 font-bold'
                  : 'bg-white/25 border-white/40 text-white/70'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <span>★★★</span>
                {t('3 ดาว:', '3-Star:')}
              </span>
              <span className="font-mono">{formatBrewDuration(def.star3TimeSeconds, lang)}</span>
            </div>
          </div>

          {/* Ingredients */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {Object.entries(def.cropsRequired).map(([cropKey, reqCount]) => {
              if (!reqCount) return null;
              const cId = cropKey as CropType;
              const cDef = CROP_DEFINITIONS[cId];
              const have = inventoryCrops[cId] || 0;
              const ok = have >= reqCount;
              return (
                <span
                  key={cId}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black backdrop-blur-xl border shadow-[inset_0_1px_2px_rgba(255,255,255,0.85)] tabular-nums ${
                    ok
                      ? 'bg-emerald-100/45 border-emerald-200/70 text-emerald-300'
                      : 'bg-rose-300/40 border-rose-300/70 text-rose-300'
                  } ${TEXT_LIGHT_HALO}`}
                >
                  <span>{cDef.iconEmoji}</span>
                  <span>{getCropName(cId, lang)}</span>
                  <span className="font-mono bg-black/20 px-1 rounded-full">
                    {have}/{reqCount}
                  </span>
                </span>
              );
            })}
            {def.fruitsRequired &&
              Object.entries(def.fruitsRequired).map(([fruitKey, reqCount]) => {
                if (!reqCount) return null;
                const fId = fruitKey as TreeType;
                const tDef = TREE_DEFINITIONS[fId];
                const have = inventoryTreeFruits[fId] || 0;
                const ok = have >= reqCount;
                return (
                  <span
                    key={fId}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black backdrop-blur-xl border shadow-[inset_0_1px_2px_rgba(255,255,255,0.85)] tabular-nums ${
                      ok
                        ? 'bg-emerald-100/45 border-emerald-200/70 text-emerald-300'
                        : 'bg-rose-300/40 border-rose-300/70 text-rose-300'
                    } ${TEXT_LIGHT_HALO}`}
                  >
                    <span>{tDef?.iconEmoji || '🍎'}</span>
                    <span>{getTreeFruitName(fId, lang)}</span>
                    <span className="font-mono bg-black/20 px-1 rounded-full">
                      {have}/{reqCount}
                    </span>
                  </span>
                );
              })}
          </div>
        </div>

        {/* Bake button */}
        <button
          disabled={!canBake}
          onClick={() => onStartBaking(ovenHouseId, machineType, def.id)}
          className={`${canBake ? BTN_GREEN : BTN_GREEN.replace(BTN_GREEN, 'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] whitespace-nowrap border bg-white/30 text-black/50 border-white/40 shadow-inner cursor-not-allowed')} w-full flex items-center justify-center gap-1 relative z-10`}
        >
          <Flame className="w-3 h-3 shrink-0" />
          <span>
            {slotsFull
              ? t('คิวเตาอบเต็ม (3/3)', 'Oven Queue Full (3/3)')
              : basketReadyJobs.length >= 8
                ? t('ตะกร้าเต็ม!', 'Basket Full!')
                : stars >= 3
                  ? t(
                      `อบ 3 ดาว (${formatBrewDuration(def.star3TimeSeconds, lang)})`,
                      `Bake 3★ (${formatBrewDuration(def.star3TimeSeconds, lang)})`
                    )
                  : t(
                      `เริ่มอบ (${formatBrewDuration(def.normalTimeSeconds, lang)})`,
                      `Bake (${formatBrewDuration(def.normalTimeSeconds, lang)})`
                    )}
          </span>
        </button>
      </div>
    );
  };

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto cursor-pointer"
        onClick={onClose}
      />
      
      {/* คอนเทนเนอร์หลัก: ปรับให้แคบลง (max-w-md) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto flex flex-col max-h-[92dvh] pointer-events-auto overflow-visible z-10"
      >
        {/* ================================================== */}
        {/* HEADER                                             */}
        {/* ================================================== */}
        <div
          className={`${GLASS_PILL} flex items-center justify-between gap-1.5 px-2 sm:px-3 py-1.5 rounded-[1.25rem] mb-2`}
        >
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-1.5 min-w-0 z-10">
            <div className={`${GLASS_CIRCLE} w-7 h-7 text-lg shrink-0`}>
              {isBakery ? '🍞' : '🥧'}
            </div>
            <div className="min-w-0">
              <h2
                className={`text-sm sm:text-base font-black text-yellow-300 tracking-tight truncate ${TEXT_SHARP_HALO}`}
              >
                {isBakery
                  ? t(
                      'เตาอบขนมปังและพิซซ่า',
                      'Bakery & Pizza Oven'
                    )
                  : t(
                      'เตาอบพาย',
                      'Pie Oven'
                    )}
              </h2>
              <div
                className={`flex items-center gap-1 text-[10px] font-semibold text-yellow-200 flex-wrap ${TEXT_LIGHT_HALO}`}
              >
                <span>
                  {playerGender === 'female'
                    ? t('👩‍🌾 หญิงคุมเตา', '👩‍🌾 Female tending oven')
                    : t('👨‍🌾 ชายคุมเตา', '👨‍🌾 Male tending oven')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 z-10">
            <div
              className={`${GLASS_PILL} flex items-center gap-1 px-2 py-1 rounded-full text-yellow-300 font-mono font-bold text-[10px] sm:text-xs tabular-nums ${TEXT_LIGHT_HALO}`}
            >
              <Coins className="w-3 h-3 text-yellow-400 shrink-0 drop-shadow-sm" />
              <span>{coins.toLocaleString()}</span>
            </div>

            <button
              onClick={() => {
                farmAudio.playDoorSound();
                onClose();
              }}
              className={`${GLASS_CIRCLE} min-h-[22px] min-w-[22px] px-1.5 py-1 text-yellow-300 hover:bg-white/80 transition-colors active:scale-95`}
            >
              <LogOut className="w-3 h-3 shrink-0 drop-shadow-sm" />
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* SCROLL AREA                                        */}
        {/* ================================================== */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
          {/* ================================================= */}
          {/* MASTERY BANNER                                    */}
          {/* ================================================= */}
          <div className={`${GLASS_PILL} p-2 sm:p-3 rounded-[1.5rem]`}>
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white/80 blur-[1px] rounded-full pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 relative z-10">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((idx) => (
                      <Star
                        key={idx}
                        className={`w-3 h-3 ${
                          stars >= idx
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-white/30'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-extrabold text-yellow-300 ${TEXT_LIGHT_HALO}`}
                  >
                    {t(
                      `ความชำนาญ: ${stars}/3 ดาว`,
                      `Mastery: ${stars}/3 Stars`
                    )}
                  </span>
                  <span
                    className={`text-[9px] text-yellow-200 font-semibold tabular-nums ${TEXT_LIGHT_HALO}`}
                  >
                    {stars >= 3
                      ? t(
                          '(ปลดล็อก 3 ดาวแล้ว!)',
                          '(3-Star active!)'
                        )
                      : t(
                          `(${Math.floor(masterySec / 60)}/${Math.floor(nextThreshold / 60)} นาที)`,
                          `(${Math.floor(masterySec / 60)}/${Math.floor(nextThreshold / 60)} min)`
                        )}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="grid grid-cols-12 gap-0.5 max-w-md">
                  {Array.from({ length: PROGRESS_SEGMENTS }).map((_, segIdx) => (
                    <div
                      key={segIdx}
                      className={`h-1 rounded-full transition-colors ${
                        segIdx < masteryFilledSegments
                          ? stars >= 3
                            ? 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.8)]'
                            : 'bg-yellow-300 shadow-[0_0_3px_rgba(253,224,71,0.8)]'
                          : 'bg-black/10 shadow-inner'
                      }`}
                    />
                  ))}
                </div>

                <div
                  className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-semibold ${TEXT_LIGHT_HALO}`}
                >
                  <span
                    className={
                      stars >= 1
                        ? 'text-yellow-400 font-bold'
                        : 'text-white/40'
                    }
                  >
                    ★1: {t('ราคา +10%', 'Price +10%')}
                  </span>
                  <span
                    className={
                      stars >= 2
                        ? 'text-yellow-400 font-bold'
                        : 'text-white/40'
                    }
                  >
                    ★★2: {t('XP +15%', 'XP +15%')}
                  </span>
                  <span
                    className={
                      stars >= 3
                        ? 'text-emerald-400 font-bold'
                        : 'text-white/50'
                    }
                  >
                    ★★★3: {t('ลดเวลาอบ!', 'Fast Bake!')}
                  </span>
                </div>
              </div>

              {stars < 3 && (
                <button
                  disabled={coins < OVEN_MASTERY_BOOST_COST_COINS}
                  onClick={() => onBoostOvenMastery(machineType)}
                  className={`${BTN_AMBER} shrink-0 flex items-center justify-center gap-1`}
                >
                  <Star className="w-2.5 h-2.5 fill-[#3a2a05]" />
                  <span>
                    {t(
                      `ฝึก ${stars + 1}★ (${OVEN_MASTERY_BOOST_COST_COINS} G)`,
                      `Train ${stars + 1}★ (${OVEN_MASTERY_BOOST_COST_COINS} G)`
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ================================================= */}
          {/* TABS                                               */}
          {/* ================================================= */}
          <div className="flex items-center gap-1 justify-center relative z-10">
            <button
              onClick={() => setActiveTab('recipes')}
              className={`${
                activeTab === 'recipes'
                  ? GLASS_PILL
                  : 'bg-white/10 backdrop-blur-sm border-white/20'
              } min-h-[22px] px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 flex items-center gap-1 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <Flame className="w-3 h-3" />
              <span>
                {isBakery
                  ? t('สูตรอบ (6)', 'Recipes (6)')
                  : t('สูตรพาย (3)', 'Pie Recipes (3)')}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('pantry')}
              className={`${
                activeTab === 'pantry'
                  ? GLASS_PILL
                  : 'bg-white/10 backdrop-blur-sm border-white/20'
              } min-h-[22px] px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 flex items-center gap-1 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <ShoppingBasket className="w-3 h-3" />
              <span>
                {t('คลัง', 'Pantry')} ({totalPantryCount})
              </span>
            </button>
          </div>

          {/* ================================================= */}
          {/* CONTENT                                            */}
          {/* ================================================= */}
          {activeTab === 'recipes' ? (
            <>
              {/* ---------- Conveyor -> Basket Panel ---------- */}
              <div className={`${GLASS_PILL} p-2 rounded-[1.5rem]`}>
                <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white/80 blur-[1px] rounded-full pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 relative z-10">
                  <div
                    className={`flex items-center gap-1 flex-wrap text-[10px] font-bold text-yellow-300 ${TEXT_LIGHT_HALO}`}
                  >
                    <span className="flex items-center gap-1">
                      <span>🔥 {t('ในเตา', 'In Oven')}:</span>
                      <strong className="font-mono tabular-nums text-orange-400">
                        {activeOvenJobs.length}/{OVEN_SLOTS_PER_BUILDING}
                      </strong>
                    </span>
                    <ArrowRight className="w-2.5 h-2.5 text-yellow-400 shrink-0" />
                    <span className="flex items-center gap-1">
                      <span>🧺 {t('ในตะกร้า', 'Basket')}:</span>
                      <strong className="font-mono tabular-nums text-yellow-400">
                        {basketReadyJobs.length}
                      </strong>
                    </span>
                  </div>

                  {basketReadyJobs.length > 0 && (
                    <button
                      onClick={() => onCollectOvenBasket(ovenHouseId)}
                      className={`${BTN_GREEN} flex items-center justify-center gap-1 shrink-0`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>
                        {t(
                          `เก็บทั้งหมด (${basketReadyJobs.length})`,
                          `Collect All (${basketReadyJobs.length})`
                        )}
                      </span>
                    </button>
                  )}
                </div>

                {/* Ready items in basket */}
                {basketReadyJobs.length > 0 && (
                  <div className="mt-1.5 p-1.5 rounded-[1rem] bg-emerald-100/30 border border-emerald-300/60 relative z-10">
                    <div
                      className={`text-[10px] font-bold text-emerald-300 mb-1 ${TEXT_LIGHT_HALO}`}
                    >
                      🧺{' '}
                      {t(
                        'พร้อมเก็บ:',
                        'Ready to collect:'
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {basketReadyJobs.map((job) => {
                        const def = BAKED_GOOD_DEFS[job.itemType];
                        return (
                          <button
                            key={job.id}
                            onClick={() => onCollectBakedJob(job.id)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-b from-[#8fb351] to-[#6a8a32] border border-[#6a8a32] text-white font-bold text-[9px] transition-all active:scale-95 shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:brightness-110"
                          >
                            <span className="text-xs">{def.iconEmoji}</span>
                            <span>{getBakedGoodName(job.itemType, lang)}</span>
                            <span className="px-1 py-0.5 rounded-full bg-white/30 text-[8px] font-black">
                              {t('หยิบ', 'Pick')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Oven Slots */}
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5 relative z-10">
                  {Array.from({ length: OVEN_SLOTS_PER_BUILDING }).map((_, slotIdx) => {
                    const job = activeOvenJobs[slotIdx];
                    if (!job) {
                      return (
                        <div
                          key={slotIdx}
                          className={`${GLASS_PILL} p-1.5 rounded-[1rem] opacity-60 flex items-center justify-between text-[9px] font-semibold text-yellow-200`}
                        >
                          <span>
                            {t(
                              `ถาด #${slotIdx + 1}: ว่าง`,
                              `Tray #${slotIdx + 1}: Idle`
                            )}
                          </span>
                          <span className="text-yellow-200/60">
                            {t('พร้อม', 'Ready')}
                          </span>
                        </div>
                      );
                    }

                    const def = BAKED_GOOD_DEFS[job.itemType];
                    const totalMs = Math.max(1000, job.finishAt - job.startedAt);
                    const elapsedMs = Math.min(totalMs, Math.max(0, nowMs - job.startedAt));
                    const remainSec = Math.max(0, Math.ceil((job.finishAt - nowMs) / 1000));
                    const filledSegments = Math.min(
                      PROGRESS_SEGMENTS,
                      Math.max(1, Math.round((elapsedMs / totalMs) * PROGRESS_SEGMENTS))
                    );

                    return (
                      <div
                        key={job.id}
                        className={`${GLASS_PILL} p-1.5 rounded-[1rem] space-y-1`}
                      >
                        <div className="flex items-center justify-between gap-1 relative z-10">
                          <div className="flex items-center gap-1 min-w-0">
                            <div className={`${GLASS_CIRCLE} w-5 h-5 text-sm shrink-0`}>
                              {def.iconEmoji}
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`text-[9px] font-extrabold text-yellow-300 truncate ${TEXT_SOFT_HALO}`}
                              >
                                {getBakedGoodName(job.itemType, lang)}
                              </div>
                              <div
                                className={`text-[9px] font-bold text-yellow-200 font-mono tabular-nums flex items-center gap-0.5 ${TEXT_LIGHT_HALO}`}
                              >
                                <Timer className="w-2.5 h-2.5 shrink-0" />
                                <span>{formatBrewDuration(remainSec, lang)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="grid grid-cols-12 gap-0.5 mt-0.5 relative z-10">
                          {Array.from({ length: PROGRESS_SEGMENTS }).map((__, segIdx) => (
                            <div
                              key={segIdx}
                              className={`h-1 rounded-full transition-colors ${
                                segIdx < filledSegments
                                  ? 'bg-yellow-300 shadow-[0_0_3px_rgba(253,224,71,0.8)]'
                                  : 'bg-black/10 shadow-inner'
                              }`}
                            />
                          ))}
                        </div>

                        <button
                          disabled={coins < OVEN_RUSH_COST_COINS}
                          onClick={() => onRushBakingJob(job.id)}
                          className={`${BTN_AMBER} w-full min-h-[18px] px-1.5 py-0.5 text-[9px] flex items-center justify-center gap-0.5 relative z-10`}
                        >
                          <Zap className="w-2.5 h-2.5" />
                          <span>
                            {t(
                              `เร่ง (${OVEN_RUSH_COST_COINS} G)`,
                              `Rush (${OVEN_RUSH_COST_COINS} G)`
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ---------- Recipe Sections ---------- */}
              {isBakery ? (
                <>
                  <div className="space-y-1.5">
                    <h3
                      className={`text-[11px] sm:text-xs font-black text-yellow-300 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}
                    >
                      <span>🍞 {t('ขนมปังและคุกกี้', 'Bread & Cookie')}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                      {breadAndCookieDefs.map(renderRecipeCard)}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <h3
                      className={`text-[11px] sm:text-xs font-black text-yellow-300 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}
                    >
                      <span>🍕 {t('พิซซ่า', 'Pizza')}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                      {pizzaDefs.map(renderRecipeCard)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <h3
                    className={`text-[11px] sm:text-xs font-black text-yellow-300 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}
                  >
                    <span>🥧 {t('พายโฮมเมด', 'Artisan Pie')}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                    {pieDefs.map(renderRecipeCard)}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ---------- Pantry Tab ---------- */
            <div className="space-y-1.5">
              <div className={`${GLASS_PILL} p-2 rounded-[1.5rem]`}>
                <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white/80 blur-[1px] rounded-full pointer-events-none" />
                <div className="flex items-center justify-between gap-1 flex-wrap relative z-10">
                  <div className="min-w-0">
                    <h3
                      className={`text-[11px] font-black text-yellow-300 ${TEXT_SOFT_HALO}`}
                    >
                      {t(
                        'คลังเบเกอรี่',
                        'Bakery Pantry'
                      )}
                    </h3>
                    <p
                      className={`text-[9px] font-medium text-yellow-100 mt-0.5 ${TEXT_LIGHT_HALO}`}
                    >
                      {t(
                        'ขายขนมเพื่อรับเหรียญ (โบนัส ★1 +10%)',
                        'Sell items for coins (+10% at 1★)'
                      )}
                    </p>
                  </div>
                  <div
                    className={`text-[9px] font-bold text-yellow-300 font-mono tabular-nums bg-black/20 px-1.5 py-0.5 rounded-full border border-white/20 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
                  >
                    {t(
                      `รวม ${totalPantryCount} ชิ้น`,
                      `${totalPantryCount} items`
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {allBakedList.map((item) => {
                  const count = inventoryBakedGoods[item.id] || 0;
                  const itemStars = getOvenMasteryStars(
                    ovenMasterySeconds[item.machine] || 0
                  );
                  const unitPrice =
                    itemStars >= 1 ? Math.round(item.sellPrice * 1.1) : item.sellPrice;
                  return (
                    <div
                      key={item.id}
                      className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-2 rounded-[1rem]`}
                    >
                      <div className="absolute top-0.5 left-3 w-1/2 h-0.5 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

                      <div className="flex items-center gap-1.5 min-w-0 relative z-10">
                        <div className={`${GLASS_CIRCLE} w-6 h-6 text-sm shrink-0`}>
                          {item.iconEmoji}
                        </div>
                        <div className="min-w-0">
                          <h4
                            className={`font-extrabold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}
                          >
                            {getBakedGoodName(item.id, lang)}
                          </h4>
                          <div
                            className={`flex items-center gap-1 text-[9px] font-semibold text-yellow-200 tabular-nums mt-0.5 ${TEXT_LIGHT_HALO}`}
                          >
                            <span>
                              {t('มี:', 'Owned:')}{' '}
                              <strong className="text-yellow-400 font-mono">{count}</strong>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-yellow-400 font-bold font-mono">
                              {unitPrice} G
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 shrink-0 relative z-10">
                        <button
                          disabled={count <= 0}
                          onClick={() => onSellBakedGood(item.id, 1)}
                          className={`${BTN_AMBER} min-h-[18px] px-1.5 py-0.5 text-[9px]`}
                        >
                          {t(
                            `ขาย 1 (+${unitPrice} G)`,
                            `Sell 1 (+${unitPrice} G)`
                          )}
                        </button>
                        {count > 1 && (
                          <button
                            onClick={() => onSellBakedGood(item.id, count)}
                            className={BTN_GLASS}
                          >
                            {t(
                              `ขายหมด (+${count * unitPrice} G)`,
                              `Sell All (+${count * unitPrice} G)`
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};