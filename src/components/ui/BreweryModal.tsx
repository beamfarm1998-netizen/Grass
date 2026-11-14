// src/components/ui/BreweryModal.tsx
import React, { useEffect, useState } from 'react';
import { Coins, Flame, LogOut, Timer, Leaf, CheckCircle2 } from 'lucide-react';
import {
  BREW_DRINK_DEFS,
  BREWERY_SLOTS_PER_BUILDING,
  BrewDrinkType,
  BrewingJob,
  CropType,
  FarmerGender,
  TreeType,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  formatBrewDuration,
  getBrewDrinkDesc,
  getBrewDrinkName,
} from '../../i18n/translations';
import { farmAudio } from '../../utils/audio';

export interface BreweryModalProps {
  isOpen: boolean;
  breweryHouseId: string | null;
  playerGender: FarmerGender;
  coins: number;
  inventoryCrops: Record<CropType, number>;
  inventoryTreeFruits: Record<TreeType, number>;
  inventoryDrinks: Record<BrewDrinkType, number>;
  brewingJobs: BrewingJob[];
  onStartBrewing: (houseId: string, drinkType: BrewDrinkType) => boolean;
  onCollectBrew: (jobId: string) => boolean;
  onCollectAllReady: (houseId?: string) => number;
  onSellDrink: (drinkType: BrewDrinkType, count: number) => void;
  onClose: () => void;
}

const PROGRESS_SEGMENTS = 12;

// คลาสสำหรับทำพื้นผิวแก้วใส (Glass Bubble Effect) - ปรับให้เล็กลง
const GLASS_PILL = "relative overflow-hidden bg-gradient-to-br from-white/70 via-white/20 to-white/10 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_5px_rgba(255,255,255,0.9),inset_0_-1px_3px_rgba(255,255,255,0.3),0_5px_10px_rgba(0,0,0,0.1),-1px_0_2px_rgba(255,100,100,0.3),1px_0_2px_rgba(100,150,255,0.3)]";
const GLASS_CIRCLE = "relative overflow-hidden flex items-center justify-center rounded-full bg-gradient-to-br from-white/80 via-white/30 to-white/10 backdrop-blur-md border border-white/70 shadow-[inset_0_1px_4px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(255,255,255,0.4),0_4px_8px_rgba(0,0,0,0.15),-1px_0_1px_rgba(255,150,150,0.4),1px_0_1px_rgba(150,200,255,0.4)]";

// 🔹 ปรับ text-shadow ให้เป็นเงาสีดำเข้ม เพื่อให้ตัวหนังสือสีเหลืองเด้งออกมาจากพื้นกระจก
const TEXT_SHARP_HALO = "[text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]";
const TEXT_SOFT_HALO = "[text-shadow:0_1px_2px_rgba(0,0,0,0.7)]";
const TEXT_LIGHT_HALO = "[text-shadow:0_1px_1px_rgba(0,0,0,0.5)]";

// 🔹 map emoji ต่อชนิดเครื่องดื่ม
const DRINK_EMOJI: Partial<Record<BrewDrinkType, string>> = {
  // ตัวอย่าง:
  // oliveOil:   '🫒',
  // oliveWine:  '🍷',
  // oliveBeer:  '🍺',
  // whiskey:    '🥃',
  // sake:       '🍶',
};

// fallback: เดา emoji จากชื่อ id
function inferDrinkEmoji(id: string): string {
  const s = id.toLowerCase();
  if (s.includes('wine')) return '🍷';
  if (s.includes('beer') || s.includes('ale')) return '🍺';
  if (s.includes('whiskey') || s.includes('whisky')) return '🥃';
  if (s.includes('sake') || s.includes('rice')) return '🍶';
  if (s.includes('gin') || s.includes('vodka')) return '🍸';
  if (s.includes('rum')) return '🥃';
  if (s.includes('juice')) return '🧃';
  if (s.includes('cider')) return '🍎';
  if (s.includes('oil')) return '🫒';
  return '🍶';
}

const DrinkIcon = ({
  drinkType,
  size = 'md',
}: {
  drinkType: BrewDrinkType;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const emoji = DRINK_EMOJI[drinkType] ?? inferDrinkEmoji(String(drinkType));
  // ปรับขนาด emoji ให้เล็กลงสำหรับ 4 คอลัมน์
  const sizeClass =
    size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <span
      className={`${sizeClass} leading-none select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]`}
      aria-hidden
    >
      {emoji}
    </span>
  );
};

export const BreweryModal: React.FC<BreweryModalProps> = ({
  isOpen,
  breweryHouseId,
  playerGender,
  coins,
  inventoryCrops,
  inventoryTreeFruits,
  inventoryDrinks,
  brewingJobs,
  onStartBrewing,
  onCollectBrew,
  onCollectAllReady,
  onSellDrink,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'recipes' | 'cellar'>('recipes');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !breweryHouseId) return null;

  const houseJobs = brewingJobs.filter((j) => j.houseId === breweryHouseId);
  const readyCount = houseJobs.filter((j) => nowMs >= j.finishAt).length;
  const slotsFull = houseJobs.length >= BREWERY_SLOTS_PER_BUILDING;

  const drinksList = Object.values(BREW_DRINK_DEFS);
  const totalCellarBottles = drinksList.reduce(
    (sum, item) => sum + (inventoryDrinks[item.id] || 0),
    0
  );

  const canAffordRecipe = (drinkId: BrewDrinkType): boolean => {
    const def = BREW_DRINK_DEFS[drinkId];
    if (def.cropsRequired) {
      for (const [c, needed] of Object.entries(def.cropsRequired)) {
        if (needed && (inventoryCrops[c as CropType] || 0) < needed) return false;
      }
    }
    if (def.fruitsRequired) {
      for (const [f, needed] of Object.entries(def.fruitsRequired)) {
        if (needed && (inventoryTreeFruits[f as TreeType] || 0) < needed) return false;
      }
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto cursor-pointer"
        onClick={onClose}
      />
      
      {/* คอนเทนเนอร์หลัก */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto flex flex-col h-[96dvh] sm:h-auto max-h-[96dvh] sm:max-h-[92dvh] pointer-events-auto overflow-hidden sm:overflow-visible z-10 rounded-t-[1.5rem] sm:rounded-[1.5rem] px-1.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-0"
      >
        
        {/* Header Glass Pill */}
        <div className={`${GLASS_PILL} flex items-center justify-between gap-1.5 px-3 sm:px-3 py-2.5 rounded-[1.25rem] mb-2 shrink-0`}>
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/90 blur-[1px] rounded-full pointer-events-none" />
          
          <div className="flex items-center gap-1.5 min-w-0 z-10">
            <div className={`${GLASS_CIRCLE} p-1.5 text-yellow-400`}>
              <Leaf className="w-3 h-3 drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              {/* เปลี่ยนเป็นสีเหลือง */}
              <h2 className={`text-sm sm:text-base font-black text-yellow-300 tracking-tight truncate ${TEXT_SHARP_HALO}`}>
                {t('โรงผลิตเบียร์และเหล้า', 'Olive Press & Brewery')}
              </h2>
              {/* เปลี่ยนเป็นสีเหลือง */}
              <div className={`flex items-center gap-1 text-[10px] font-semibold text-yellow-200 flex-wrap ${TEXT_LIGHT_HALO}`}>
                <span>
                  {playerGender === 'female'
                    ? t('👩‍🌾 ชาวไร่หญิงคัดเกรดมะกอก', '👩‍🌾 Female Farmer sorting olives')
                    : t('👨‍🌾 ชาวไร่ชายคุมเครื่องบ่ม', '👨‍🌾 Male Farmer operating press')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 z-10">
            {/* เปลี่ยนเป็นสีเหลือง */}
            <div className={`${GLASS_PILL} flex items-center gap-1 px-2 py-1 rounded-full text-yellow-300 font-mono font-bold text-[10px] sm:text-xs tabular-nums ${TEXT_LIGHT_HALO}`}>
              <Coins className="w-3 h-3 text-yellow-400 shrink-0 drop-shadow-sm" />
              <span>{coins.toLocaleString()}</span>
            </div>

            <button
              onClick={() => {
                farmAudio.playDoorSound();
                onClose();
              }}
              className={`${GLASS_CIRCLE} min-h-11 min-w-11 px-3 py-2 text-yellow-300 hover:bg-white/80 transition-colors active:scale-95`}
            >
              <LogOut className="w-3 h-3 shrink-0 drop-shadow-sm" />
            </button>
          </div>
        </div>

        {/* Active Vats & Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] space-y-3 px-0.5 pb-3 custom-scrollbar">
          
          {/* Vats Section */}
          <div className={`${GLASS_PILL} p-3 sm:p-3 rounded-[1.5rem]`}>
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4/5 h-0.5 bg-white/80 blur-[1px] rounded-full pointer-events-none" />
            
            <div className="flex items-center justify-between gap-1 mb-1.5 relative z-10">
              {/* เปลี่ยนเป็นสีเหลือง */}
              <div className={`flex items-center gap-1 text-[10px] font-extrabold text-yellow-300 ${TEXT_LIGHT_HALO}`}>
                <Flame className={`w-3 h-3 shrink-0 ${houseJobs.length > 0 ? 'text-orange-400 animate-pulse' : 'text-yellow-400'}`} />
                <span>
                  {t(`ถังหมัก (${houseJobs.length}/${BREWERY_SLOTS_PER_BUILDING})`, `Vats (${houseJobs.length}/${BREWERY_SLOTS_PER_BUILDING})`)}
                </span>
              </div>

              {readyCount > 0 && (
                <button
                  onClick={() => onCollectAllReady(breweryHouseId)}
                  className="min-h-11 px-4 py-2 rounded-full bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] border border-[#6a8a32]"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span>{t(`เก็บทั้งหมด (${readyCount})`, `Collect All (${readyCount})`)}</span>
                </button>
              )}
            </div>

            {/* ✅ ปรับเป็น 4 คอลัมน์ */}
            <div className="grid grid-cols-4 gap-1.5 relative z-10">
              {Array.from({ length: BREWERY_SLOTS_PER_BUILDING }).map((_, slotIdx) => {
                const job = houseJobs[slotIdx];
                if (!job) {
                  return (
                    <div
                      key={`empty-vat-${slotIdx}`}
                      className={`${GLASS_PILL} flex flex-col items-center justify-center gap-1 p-1.5 rounded-[0.75rem] opacity-60 aspect-square`}
                    >
                      {/* เปลี่ยนเป็นสีเหลือง */}
                      <div className="w-3 h-3 rounded-full border border-dashed border-yellow-200/50" />
                      <span className={`text-yellow-200/80 text-[8px] font-semibold text-center leading-tight ${TEXT_LIGHT_HALO}`}>
                        {t(`ถัง ${slotIdx + 1}`, `Vat ${slotIdx + 1}`)}
                      </span>
                    </div>
                  );
                }

                const totalMs = Math.max(1000, job.finishAt - job.startedAt);
                const elapsedMs = Math.max(0, Math.min(totalMs, nowMs - job.startedAt));
                const remainingSec = Math.max(0, Math.ceil((job.finishAt - nowMs) / 1000));
                const isReady = remainingSec === 0;
                const filledSegments = Math.min(PROGRESS_SEGMENTS, Math.round((elapsedMs / totalMs) * PROGRESS_SEGMENTS));

                return (
                  <div
                    key={job.id}
                    className={`${GLASS_PILL} flex flex-col gap-1 p-1.5 rounded-[0.75rem] aspect-square justify-between ${isReady ? 'bg-[#a3b86c]/30 border-[#a3b86c]/80 shadow-[inset_0_1px_5px_rgba(255,255,255,0.9),0_0_8px_rgba(163,184,108,0.5)]' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-0.5 relative z-10 min-w-0">
                      <div className={`${GLASS_CIRCLE} w-5 h-5 shrink-0`}>
                        <DrinkIcon drinkType={job.drinkType} size="sm" />
                      </div>
                      {/* เปลี่ยนเป็นสีเหลือง */}
                      <div className={`text-[8px] font-extrabold text-yellow-300 truncate w-full text-center leading-tight ${TEXT_SOFT_HALO}`}>
                        {getBrewDrinkName(job.drinkType, lang)}
                      </div>
                      {/* เปลี่ยนเป็นสีเหลือง */}
                      <div className={`flex items-center justify-center gap-0.5 text-[8px] font-bold text-yellow-200 font-mono tabular-nums ${TEXT_LIGHT_HALO}`}>
                        <Timer className="w-2 h-2 shrink-0" />
                        <span className="truncate">{isReady ? t('พร้อม!', 'Ready!') : formatBrewDuration(remainingSec, lang)}</span>
                      </div>
                    </div>

                    {/* Progress bar as tiny glass segments */}
                    <div className="grid grid-cols-12 gap-[1px] relative z-10">
                      {Array.from({ length: PROGRESS_SEGMENTS }).map((__, segIdx) => (
                        <div
                          key={segIdx}
                          className={`h-0.5 rounded-full transition-colors ${
                            segIdx < filledSegments
                              ? isReady ? 'bg-[#8fb351] shadow-[0_0_3px_rgba(143,179,81,0.8)]' : 'bg-yellow-300 shadow-[0_0_3px_rgba(253,224,71,0.8)]'
                              : 'bg-black/10 shadow-inner'
                          }`}
                        />
                      ))}
                    </div>

                    {isReady ? (
                      <button
                        onClick={() => onCollectBrew(job.id)}
                        className="relative z-10 min-h-7 w-full px-1 py-1 rounded-full bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white font-bold text-[8px] transition-all active:scale-95 shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] border border-[#6a8a32]"
                      >
                        {t('🍾 เก็บ', '🍾 Get')}
                      </button>
                    ) : (
                      <span className={`relative z-10 text-[8px] font-mono font-bold text-yellow-300 tabular-nums text-center bg-black/20 px-1 py-0.5 rounded-full border border-white/20 ${TEXT_LIGHT_HALO}`}>
                        {Math.floor((elapsedMs / totalMs) * 100)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs as Glass Pills */}
          <div className="grid grid-cols-2 gap-2 justify-center relative z-10 sticky top-0">
            {/* เปลี่ยนเป็นสีเหลือง */}
            <button
              onClick={() => setActiveTab('recipes')}
              className={`${activeTab === 'recipes' ? GLASS_PILL : 'bg-white/10 backdrop-blur-sm border-white/20'} min-h-11 flex-1 px-4 py-2 rounded-full text-xs sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 ${TEXT_LIGHT_HALO}`}
            >
              {t('🍺 สูตรบ่ม', '🍺 Recipes')}
            </button>
            {/* เปลี่ยนเป็นสีเหลือง */}
            <button
              onClick={() => setActiveTab('cellar')}
              className={`${activeTab === 'cellar' ? GLASS_PILL : 'bg-white/10 backdrop-blur-sm border-white/20'} min-h-11 flex-1 px-4 py-2 rounded-full text-xs sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 ${TEXT_LIGHT_HALO}`}
            >
              {t(`🍾 คลัง (${totalCellarBottles})`, `🍾 Cellar (${totalCellarBottles})`)}
            </button>
          </div>

          {/* ✅ Recipes List: 4-column layout */}
          {activeTab === 'recipes' && (
            <div className="grid grid-cols-4 gap-1.5 pb-3">
              {drinksList.map((drink) => {
                const hasIngredients = canAffordRecipe(drink.id);
                const canStart = hasIngredients && !slotsFull;
                const ownedBottles = inventoryDrinks[drink.id] || 0;

                return (
                  <div
                    key={drink.id}
                    className={`${GLASS_PILL} relative flex min-w-0 flex-col gap-1 p-1.5 rounded-[0.75rem]`}
                  >
                    <div className="absolute top-0.5 left-2 w-1/2 h-0.5 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center gap-0.5 min-w-0">
                      <div className={`${GLASS_CIRCLE} w-6 h-6 shrink-0`}>
                        <DrinkIcon drinkType={drink.id} size="md" />
                      </div>
                      <h3 className={`min-w-0 w-full text-center font-extrabold text-yellow-300 text-[8px] leading-tight line-clamp-2 ${TEXT_SOFT_HALO}`}>
                        {getBrewDrinkName(drink.id, lang)}
                      </h3>
                    </div>

                    <div className={`relative z-10 min-h-[2.6em] text-[7px] font-medium text-yellow-100 leading-tight line-clamp-2 text-center ${TEXT_LIGHT_HALO}`}>
                      {getBrewDrinkDesc(drink.id, lang)}
                    </div>

                    <div className={`relative z-10 flex min-h-[30px] content-start items-center justify-center gap-x-0.5 gap-y-0.5 flex-wrap text-[7px] font-semibold text-yellow-200 tabular-nums bg-black/20 px-1 py-0.5 rounded-md border border-white/20 ${TEXT_LIGHT_HALO}`}>
                      <span className="text-yellow-300">⏱{formatBrewDuration(drink.brewTimeSeconds, lang)}</span>
                      <span className="text-white/50">·</span>
                      <span className="text-yellow-400">{drink.sellPrice}G</span>
                      <span className="text-white/50">·</span>
                      <span className="text-yellow-300">+{drink.xpReward}XP</span>
                      {ownedBottles > 0 && (
                        <span className="text-yellow-300 font-bold w-full text-center">
                          {t(`มี ${ownedBottles}`, `Owned ${ownedBottles}`)}
                        </span>
                      )}
                    </div>

                    <button
                      disabled={!canStart}
                      onClick={() => onStartBrewing(breweryHouseId, drink.id)}
                      className={`relative z-10 mt-auto min-h-8 w-full px-1 py-1 rounded-full font-bold text-[8px] transition-all active:scale-95 whitespace-nowrap border ${
                        canStart
                          ? 'bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white border-[#6a8a32] shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:brightness-110'
                          : 'bg-white/30 text-black/50 border-white/40 shadow-inner cursor-not-allowed'
                      }`}
                    >
                      {slotsFull ? t('ถังเต็ม', 'Full') : !hasIngredients ? t('ของไม่พอ', 'Need') : t('🔥 ผลิต', '🔥 Brew')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ✅ Cellar Storage: 4-column layout */}
          {activeTab === 'cellar' && (
            <div className="grid grid-cols-4 gap-1.5 pb-4">
              {totalCellarBottles === 0 ? (
                /* เปลี่ยนเป็นสีเหลือง */
                <div className={`${GLASS_PILL} col-span-full p-4 text-center rounded-[1rem] text-yellow-300 font-semibold text-[11px] ${TEXT_SOFT_HALO}`}>
                  {t('ยังไม่มีเครื่องดื่มในคลัง', 'No beverages in cellar yet.')}
                </div>
              ) : (
                drinksList.map((drink) => {
                  const count = inventoryDrinks[drink.id] || 0;
                  if (count <= 0) return null;
                  return (
                    <div key={drink.id} className={`${GLASS_PILL} flex flex-col items-center gap-1 p-1.5 rounded-[0.75rem]`}>
                      <div className="flex flex-col items-center gap-0.5 min-w-0 relative z-10 w-full">
                        <div className={`${GLASS_CIRCLE} w-6 h-6 shrink-0`}>
                          <DrinkIcon drinkType={drink.id} size="md" />
                        </div>
                        {/* เปลี่ยนเป็นสีเหลือง */}
                        <h4 className={`font-bold text-yellow-300 text-[8px] truncate w-full text-center leading-tight ${TEXT_SOFT_HALO}`}>
                          {getBrewDrinkName(drink.id, lang)}
                        </h4>
                        {/* เปลี่ยนเป็นสีเหลือง */}
                        <div className={`text-[7px] font-semibold text-yellow-200 font-mono tabular-nums text-center ${TEXT_LIGHT_HALO}`}>
                          {t('มี:', 'Own:')} <strong className="text-yellow-400">{count}</strong>
                          <br />
                          <span className="text-yellow-400">{drink.sellPrice} G</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 w-full shrink-0 relative z-10">
                        <button
                          onClick={() => onSellDrink(drink.id, 1)}
                          className="min-h-7 w-full px-1 py-1 rounded-full bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] text-[#3a2a05] border border-[#c9a03a] font-bold text-[8px] transition-all active:scale-95 whitespace-nowrap shadow-[0_2px_5px_rgba(201,160,58,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)]"
                        >
                          {t(`ขาย 1`, `Sell 1`)}
                        </button>
                        {count > 1 && (
                          <button
                            onClick={() => onSellDrink(drink.id, count)}
                            className="min-h-7 w-full px-1 py-1 bg-white/40 hover:bg-white/60 text-black border border-white/60 font-bold rounded-full text-[8px] transition-all active:scale-95 whitespace-nowrap"
                          >
                            {t(`ขายหมด`, `Sell All`)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};