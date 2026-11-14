// src/components/ui/AnimalFeedModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Coins,
  Clock,
  Sparkles,
  Wheat,
  X,
  Zap,
} from 'lucide-react';

import {
  ANIMAL_FEED_DEFS,
  AnimalFeedType,
  CROP_DEFINITIONS,
  CropType,
  FEED_MILL_RUSH_COST_COINS,
  FEED_MILL_SLOTS_PER_BUILDING,
  FarmerGender,
  FeedMillJob,
} from '../../types/game';

import { useLanguage } from '../../i18n/LanguageContext';
import {
  getAnimalFeedDesc,
  getAnimalFeedName,
  getCropName,
} from '../../i18n/translations';

// ============================================================
// TYPES
// ============================================================

export interface AnimalFeedModalProps {
  isOpen: boolean;
  feedMillHouseId: string | null;
  playerGender: FarmerGender;
  coins: number;
  inventoryCrops: Record<CropType, number>;
  inventoryAnimalFeeds: Record<AnimalFeedType, number>;
  feedMillJobs: FeedMillJob[];

  onStartFeedMill: (houseId: string, feedType: AnimalFeedType) => boolean;
  onRushFeedMillJob: (jobId: string) => boolean;
  onSellAnimalFeed: (feedType: AnimalFeedType, count: number) => void;
  onUseAnimalFeed: (feedType: AnimalFeedType) => boolean;

  onClose: () => void;
}

// ============================================================
// CONFIGURATION & STYLES
// ============================================================

const FEED_ORDER: readonly AnimalFeedType[] = [
  'chicken_duck_feed',
  'duck_grain_feed',
  'pig_goat_feed',
  'cow_sheep_feed',
  'premium_horse_feed',
];

// Liquid Glass Design System
const GLASS_PILL =
  'relative overflow-hidden bg-gradient-to-br from-white/70 via-white/20 to-white/10 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_5px_rgba(255,255,255,0.9),inset_0_-1px_3px_rgba(255,255,255,0.3),0_5px_10px_rgba(0,0,0,0.1),-1px_0_2px_rgba(255,100,100,0.3),1px_0_2px_rgba(100,150,255,0.3)]';

const GLASS_CIRCLE =
  'relative overflow-hidden flex items-center justify-center rounded-full bg-gradient-to-br from-white/80 via-white/30 to-white/10 backdrop-blur-md border border-white/70 shadow-[inset_0_1px_4px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(255,255,255,0.4),0_4px_8px_rgba(0,0,0,0.15),-1px_0_1px_rgba(255,150,150,0.4),1px_0_1px_rgba(150,200,255,0.4)]';

const TEXT_SHARP_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]';
const TEXT_SOFT_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.7)]';
const TEXT_LIGHT_HALO = '[text-shadow:0_1px_1px_rgba(0,0,0,0.5)]';

const BTN_GREEN =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white border-[#6a8a32] shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100';
const BTN_GREEN_DISABLED =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] whitespace-nowrap border bg-white/30 text-black/50 border-white/40 shadow-inner cursor-not-allowed';
const BTN_AMBER =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] text-[#3a2a05] border-[#c9a03a] shadow-[0_2px_5px_rgba(201,160,58,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed';

// ============================================================
// HELPERS
// ============================================================

function formatMinutesCountdown(msRemaining: number, lang: 'th' | 'en'): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const secStr = String(secs).padStart(2, '0');
  if (lang === 'en') return `${mins}m ${secStr}s`;
  return `${mins} นาที ${secStr} วินาที`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

// --- 1. Active Slot Card ---
interface ActiveSlotCardProps {
  slotIdx: number;
  job?: FeedMillJob;
  nowMs: number;
  lang: 'th' | 'en';
  t: (th: string, en: string) => string;
  onRush: (jobId: string) => void;
}

const ActiveSlotCard: React.FC<ActiveSlotCardProps> = ({ slotIdx, job, nowMs, lang, t, onRush }) => {
  if (!job) {
    return (
      <div className={`${GLASS_PILL} aspect-square p-1.5 flex flex-col items-center justify-center text-center gap-1 rounded-[0.75rem] opacity-70`}>
        <div className={`${GLASS_CIRCLE} w-5 h-5 text-sm opacity-80`}>⚙️</div>
        <span className={`text-[8px] font-black text-yellow-200 leading-tight ${TEXT_LIGHT_HALO}`}>
          {t(`ช่อง ${slotIdx + 1}`, `Slot ${slotIdx + 1}`)}
        </span>
      </div>
    );
  }

  const def = ANIMAL_FEED_DEFS[job.feedType];
  const totalMs = Math.max(1000, job.finishAt - job.startedAt);
  const remMs = Math.max(0, job.finishAt - nowMs);
  const pct = Math.min(100, Math.max(4, Math.round(((totalMs - remMs) / totalMs) * 100)));
  const filledSegments = Math.max(1, Math.round((pct / 100) * 12));

  return (
    <div className={`${GLASS_PILL} aspect-square p-1.5 flex flex-col justify-between gap-1 rounded-[0.75rem]`}>
      <div className="flex flex-col items-center gap-0.5 min-w-0 relative z-10">
        <div className={`${GLASS_CIRCLE} w-5 h-5 text-sm shrink-0`}>{def.iconEmoji}</div>
        <div className={`text-[8px] font-extrabold text-yellow-300 truncate w-full text-center leading-tight ${TEXT_SOFT_HALO}`}>
          {getAnimalFeedName(job.feedType, lang)}
        </div>
        <div className={`flex items-center justify-center gap-0.5 text-[7px] font-bold text-yellow-200 font-mono tabular-nums ${TEXT_LIGHT_HALO}`}>
          <Clock className="w-2 h-2 shrink-0" />
          <span className="truncate">{formatMinutesCountdown(remMs, lang)}</span>
        </div>
      </div>

      <div className="space-y-1 relative z-10">
        <div className="grid grid-cols-12 gap-[1px]">
          {Array.from({ length: 12 }).map((_, segIdx) => (
            <div
              key={segIdx}
              className={`h-0.5 rounded-full transition-colors ${
                segIdx < filledSegments
                  ? 'bg-yellow-300 shadow-[0_0_3px_rgba(253,224,71,0.8)]'
                  : 'bg-black/10 shadow-inner'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => onRush(job.id)}
          className={`${BTN_AMBER} w-full min-h-[16px] py-0.5 px-1 text-[7px] flex items-center justify-center gap-0.5`}
        >
          <Zap className="w-2 h-2" />
          {t(`เร่ง ${FEED_MILL_RUSH_COST_COINS}🪙`, `Rush ${FEED_MILL_RUSH_COST_COINS}🪙`)}
        </button>
      </div>
    </div>
  );
};

// --- 2. Recipe Card ---
interface RecipeCardProps {
  feedId: AnimalFeedType;
  def: typeof ANIMAL_FEED_DEFS[AnimalFeedType];
  inventoryCrops: Record<CropType, number>;
  inventoryAnimalFeeds: Record<AnimalFeedType, number>;
  slotsFull: boolean;
  lang: 'th' | 'en';
  t: (th: string, en: string) => string;
  onStart: () => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ feedId, def, inventoryCrops, inventoryAnimalFeeds, slotsFull, lang, t, onStart }) => {
  const cropEntries = Object.entries(def.cropsRequired) as [CropType, number][];
  const hasAllIngredients = cropEntries.every(([cropId, need]) => (inventoryCrops[cropId] || 0) >= need);
  const canStart = hasAllIngredients && !slotsFull;
  const storedCount = inventoryAnimalFeeds[feedId] || 0;

  return (
    <div className={`${GLASS_PILL} p-1.5 flex flex-col justify-between gap-1 rounded-[0.75rem]`}>
      <div className="absolute top-0.5 left-2 w-1/2 h-0.5 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

      <div className="space-y-0.5 relative z-10">
        <div className="flex flex-col items-center gap-0.5">
          <div className={`${GLASS_CIRCLE} w-6 h-6 text-base shrink-0`}>{def.iconEmoji}</div>
          <h4 className={`font-extrabold text-yellow-300 text-[8px] truncate w-full text-center leading-tight ${TEXT_SOFT_HALO}`}>
            {getAnimalFeedName(feedId, lang)}
          </h4>
          <div className={`flex items-center justify-center gap-0.5 flex-wrap text-[7px] font-semibold text-yellow-200 tabular-nums bg-black/20 px-1 py-0.5 rounded-full border border-white/20 w-full ${TEXT_LIGHT_HALO}`}>
            <span className="text-yellow-300">⏱{def.productionMinutes}{t('น', 'm')}</span>
            <span className="text-white/50">·</span>
            <span className="text-yellow-400">{def.sellPrice}G</span>
          </div>
          {storedCount > 0 && (
            <span className={`text-[7px] font-mono font-black text-yellow-300 tabular-nums bg-black/20 px-1 py-0.5 rounded-full border border-white/20 ${TEXT_LIGHT_HALO}`}>
              {t(`มี ${storedCount}`, `Own ${storedCount}`)}
            </span>
          )}
        </div>

        <p className={`text-[7px] font-medium text-yellow-100 leading-tight line-clamp-2 text-center ${TEXT_LIGHT_HALO}`}>
          {getAnimalFeedDesc(feedId, lang)}
        </p>

        <div className="flex flex-wrap gap-0.5 pt-0.5 justify-center">
          {cropEntries.map(([cropId, need]) => {
            const owned = inventoryCrops[cropId] || 0;
            const ok = owned >= need;
            const cDef = CROP_DEFINITIONS[cropId];
            return (
              <span
                key={cropId}
                className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[7px] font-black backdrop-blur-xl border shadow-[inset_0_1px_2px_rgba(255,255,255,0.85)] ${
                  ok
                    ? 'bg-emerald-100/45 border-emerald-200/70 text-emerald-300'
                    : 'bg-rose-300/40 border-rose-300/70 text-rose-300'
                } ${TEXT_LIGHT_HALO}`}
              >
                <span>{cDef.iconEmoji}</span>
                <span className="font-mono bg-black/20 px-0.5 rounded-full tabular-nums">
                  {owned}/{need}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <button
        disabled={!canStart}
        onClick={onStart}
        className={`${canStart ? BTN_GREEN : BTN_GREEN_DISABLED} w-full !text-[8px] !min-h-[20px] !px-1`}
      >
        {slotsFull
          ? t('เต็ม', 'Full')
          : hasAllIngredients
          ? t('🌾 ผลิต', '🌾 Mill')
          : t('ของไม่พอ', 'Need')}
      </button>
    </div>
  );
};

// --- 3. Storage Card ---
interface StorageCardProps {
  feedId: AnimalFeedType;
  def: typeof ANIMAL_FEED_DEFS[AnimalFeedType];
  count: number;
  lang: 'th' | 'en';
  t: (th: string, en: string) => string;
  onUse: () => void;
  onSell: () => void;
}

const StorageCard: React.FC<StorageCardProps> = ({ feedId, def, count, lang, t, onUse, onSell }) => (
  <div className={`${GLASS_PILL} p-1.5 flex flex-col justify-between gap-1 rounded-[0.75rem]`}>
    <div className="absolute top-0.5 left-2 w-1/2 h-0.5 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

    <div className="flex flex-col items-center gap-0.5 min-w-0 relative z-10">
      <div className={`${GLASS_CIRCLE} w-6 h-6 text-base shrink-0`}>{def.iconEmoji}</div>
      <h4 className={`font-extrabold text-yellow-300 text-[8px] truncate w-full text-center leading-tight ${TEXT_SOFT_HALO}`}>
        {getAnimalFeedName(feedId, lang)}
      </h4>
      <div className={`text-[7px] font-semibold text-yellow-200 font-mono tabular-nums ${TEXT_LIGHT_HALO}`}>
        {t('มี:', 'Own:')} <strong className="text-yellow-400">{count}</strong>
      </div>
    </div>

    <div className="flex flex-col gap-0.5 relative z-10 w-full">
      <button onClick={onUse} className={`${BTN_GREEN} w-full !text-[7px] !min-h-[18px] !px-1`}>
        🐾 {t('ให้', 'Feed')}
      </button>
      <button onClick={onSell} className={`${BTN_AMBER} w-full !text-[7px] !min-h-[18px] !px-1`}>
        {t('ขาย', 'Sell')}
      </button>
    </div>
  </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AnimalFeedModal: React.FC<AnimalFeedModalProps> = ({
  isOpen,
  feedMillHouseId,
  playerGender,
  coins,
  inventoryCrops,
  inventoryAnimalFeeds,
  feedMillJobs,
  onStartFeedMill,
  onRushFeedMillJob,
  onSellAnimalFeed,
  onUseAnimalFeed,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'mill' | 'storage'>('mill');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [isOpen]);

  // --- Memoized Calculations ---
  const activeHouseJobs = useMemo(() => {
    if (!feedMillHouseId) return [];
    return feedMillJobs.filter((job) => job.houseId === feedMillHouseId && nowMs < job.finishAt);
  }, [feedMillJobs, feedMillHouseId, nowMs]);

  const slotsFull = activeHouseJobs.length >= FEED_MILL_SLOTS_PER_BUILDING;

  const totalStoredFeeds = useMemo(() => {
    return FEED_ORDER.reduce((acc, id) => acc + (inventoryAnimalFeeds[id] || 0), 0);
  }, [inventoryAnimalFeeds]);

  if (!isOpen || !feedMillHouseId) return null;

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
      
      {/* Main Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-auto flex flex-col max-h-[92dvh] pointer-events-auto overflow-visible z-10"
      >
        {/* HEADER */}
        <div className={`${GLASS_PILL} flex items-center justify-between gap-1.5 px-2 sm:px-3 py-1.5 rounded-[1.25rem] mb-2`}>
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-1.5 min-w-0 z-10">
            <div className={`${GLASS_CIRCLE} p-1.5 text-yellow-400`}>
              <Wheat className="w-3 h-3 drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-sm sm:text-base font-black text-yellow-300 tracking-tight truncate ${TEXT_SHARP_HALO}`}>
                {t('เครื่องผลิตอาหารสัตว์', 'Animal Feed Mill')}
              </h2>
              <div className={`flex items-center gap-1 text-[10px] font-semibold text-yellow-200 flex-wrap ${TEXT_LIGHT_HALO}`}>
                <span>
                  {playerGender === 'female'
                    ? t('👩‍🌾 หญิงคุมเครื่องโม่', '👩‍🌾 Female operator')
                    : t('👨‍🌾 ชายคุมเครื่องโม่', '👨‍🌾 Male operator')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 z-10">
            <div className={`${GLASS_PILL} flex items-center gap-1 px-2 py-1 rounded-full text-yellow-300 font-mono font-bold text-[10px] sm:text-xs tabular-nums ${TEXT_LIGHT_HALO}`}>
              <Coins className="w-3 h-3 text-yellow-400 shrink-0 drop-shadow-sm" />
              <span>{coins.toLocaleString()}</span>
            </div>

            <button
              onClick={onClose}
              aria-label={t('ปิดหน้าต่าง', 'Close')}
              className={`${GLASS_CIRCLE} min-h-[22px] min-w-[22px] px-1.5 py-1 text-yellow-300 hover:bg-white/80 transition-colors active:scale-95`}
            >
              <X className="w-3 h-3 shrink-0 drop-shadow-sm" />
            </button>
          </div>
        </div>

        {/* SCROLL AREA */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
          {/* AUTO FLOAT BANNER */}
          <div className={`${GLASS_PILL} px-2 sm:px-3 py-1.5 rounded-[1.5rem]`}>
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white/80 blur-[1px] rounded-full pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-1 relative z-10">
              <div className={`flex items-center gap-1 text-[10px] font-bold text-yellow-300 ${TEXT_LIGHT_HALO}`}>
                <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
                <span>{t('ลอยเก็บอัตโนมัติ: ครบเวลากระสอบลอยเข้าคลัง!', 'Auto-Float: Finished sacks float to storage!')}</span>
              </div>
              <span className={`text-[9px] font-black text-yellow-300 tabular-nums whitespace-nowrap bg-black/20 px-1.5 py-0.5 rounded-full border border-white/20 ${TEXT_LIGHT_HALO}`}>
                {t(`ช่อง ${activeHouseJobs.length}/${FEED_MILL_SLOTS_PER_BUILDING}`, `Slots ${activeHouseJobs.length}/${FEED_MILL_SLOTS_PER_BUILDING}`)}
              </span>
            </div>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-1 justify-center relative z-10">
            <button
              onClick={() => setActiveTab('mill')}
              className={`${activeTab === 'mill' ? GLASS_PILL : 'bg-white/10 backdrop-blur-sm border-white/20'} min-h-[22px] px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 flex items-center gap-1 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <Wheat className="w-3 h-3" />
              {t(`สูตรโม่ (${activeHouseJobs.length}/${FEED_MILL_SLOTS_PER_BUILDING})`, `Mill (${activeHouseJobs.length}/${FEED_MILL_SLOTS_PER_BUILDING})`)}
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`${activeTab === 'storage' ? GLASS_PILL : 'bg-white/10 backdrop-blur-sm border-white/20'} min-h-[22px] px-3 py-1 rounded-full text-[10px] sm:text-xs font-extrabold text-yellow-300 transition-all border shadow-sm hover:bg-white/50 flex items-center gap-1 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <span>🐾</span>
              {t(`คลัง (${totalStoredFeeds})`, `Storage (${totalStoredFeeds})`)}
            </button>
          </div>

          {/* CONTENT */}
          {activeTab === 'mill' ? (
            <>
              {/* ACTIVE SLOTS */}
              <div>
                <h3 className={`text-[11px] font-black tracking-wide text-yellow-300 mb-1.5 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                  <Clock className="w-3 h-3 text-yellow-400" />
                  {t('ช่องเดินเครื่องโม่', 'Active Milling Slots')}
                </h3>

                {/* ✅ ปรับเป็น 4 คอลัมน์ */}
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: FEED_MILL_SLOTS_PER_BUILDING }).map((_, slotIdx) => (
                    <ActiveSlotCard
                      key={`slot-${slotIdx}`}
                      slotIdx={slotIdx}
                      job={activeHouseJobs[slotIdx]}
                      nowMs={nowMs}
                      lang={lang}
                      t={t}
                      onRush={onRushFeedMillJob}
                    />
                  ))}
                </div>
              </div>

              {/* RECIPES */}
              <div>
                <h3 className={`text-[11px] font-black tracking-wide text-yellow-300 mb-1.5 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  {t('สูตรผลิตอาหารสัตว์', 'Animal Feed Recipes')}
                </h3>

                {/* ✅ ปรับเป็น 4 คอลัมน์ */}
                <div className="grid grid-cols-4 gap-1.5">
                  {FEED_ORDER.map((feedId) => (
                    <RecipeCard
                      key={feedId}
                      feedId={feedId}
                      def={ANIMAL_FEED_DEFS[feedId]}
                      inventoryCrops={inventoryCrops}
                      inventoryAnimalFeeds={inventoryAnimalFeeds}
                      slotsFull={slotsFull}
                      lang={lang}
                      t={t}
                      onStart={() => onStartFeedMill(feedMillHouseId, feedId)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* STORAGE TAB */
            <div className="space-y-1.5">
              {totalStoredFeeds === 0 ? (
                <div className={`${GLASS_PILL} text-center py-8 px-3 rounded-[1rem]`}>
                  <div className={`${GLASS_CIRCLE} w-10 h-10 mx-auto mb-2 text-xl`}>🌾</div>
                  <p className={`text-[11px] font-black text-yellow-300 ${TEXT_SOFT_HALO}`}>
                    {t('ยังไม่มีกระสอบอาหารสัตว์ในคลัง', 'No animal feed bags in storage yet')}
                  </p>
                </div>
              ) : (
                /* ✅ ปรับเป็น 4 คอลัมน์ */
                <div className="grid grid-cols-4 gap-1.5">
                  {FEED_ORDER.map((feedId) => {
                    const count = inventoryAnimalFeeds[feedId] || 0;
                    if (count <= 0) return null;
                    return (
                      <StorageCard
                        key={feedId}
                        feedId={feedId}
                        def={ANIMAL_FEED_DEFS[feedId]}
                        count={count}
                        lang={lang}
                        t={t}
                        onUse={() => onUseAnimalFeed(feedId)}
                        onSell={() => onSellAnimalFeed(feedId, 1)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimalFeedModal;