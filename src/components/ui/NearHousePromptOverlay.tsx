// src/components/ui/NearHousePromptOverlay.tsx
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { LogIn, X } from 'lucide-react';
import {
  BREWERY_SLOTS_PER_BUILDING,
  FEED_MILL_SLOTS_PER_BUILDING,
  OVEN_SLOTS_PER_BUILDING,
  type BakingJob,
  type BrewingJob,
  type CropType,
  type FarmPlot,
  type FeedMillJob,
  type OvenMachineType,
  type PlacedHouse,
  type PlayerStats,
} from '../../types/game';
import { farmAudio } from '../../utils/audio';
import { useLanguage } from '../../i18n/LanguageContext';
import { CoveredPlotQuickBar } from './CoveredPlotQuickBar';

export interface NearHousePromptOverlayProps {
  nearHouse: PlacedHouse | null;
  showHouseInterior: boolean;
  showBreweryModal?: boolean;
  showOvenModal?: boolean;
  showFeedMillModal?: boolean;
  showFishShopModal?: boolean;
  onEnterInterior: () => void;
  onEnterBrewery?: (houseId: string) => void;
  onEnterOven?: (houseId: string, machineType: OvenMachineType) => void;
  onEnterFeedMill?: (houseId: string) => void;
  onEnterFishShop?: (houseId: string) => void;
  fishBagCount?: number;
  fishBagTotalCoins?: number;
  onSellAllCaughtFish?: (houseId?: string) => void;
  brewingJobs?: BrewingJob[];
  onCollectAllReadyBrews?: (houseId?: string) => number;
  bakingJobs?: BakingJob[];
  onCollectOvenBasket?: (houseId?: string) => number;
  feedMillJobs?: FeedMillJob[];
  checkPoiCooldown: (poiId: string, durationSec: number) => boolean;
  earnCoins: (amount: number) => void;
  addXP: (amount: number) => void;
  setStats: Dispatch<SetStateAction<PlayerStats>>;
  addNotice: (text: string, color?: string) => void;
  onCollectDuckCoop?: (coopId: string) => void;
  plots?: FarmPlot[];
  seedCounts?: Record<CropType, number>;
  playerCoins?: number;
  onPlantCoveredCrop?: (houseId: string, crop: CropType) => void;
  onWaterCoveredHouse?: (houseId: string) => void;
  onHarvestCoveredHouse?: (houseId: string) => void;
  onOpenInventory?: () => void;
  onDismiss?: () => void;
}

/**
 * ปุ่มโต้ตอบอัตโนมัติเมื่อผู้เล่นเดินเข้าใกล้บ้านพัก คอกสัตว์ สิ่งปลูกสร้าง หรือของตกแต่ง (type 0..30)
 */
export const NearHousePromptOverlay: React.FC<NearHousePromptOverlayProps> = ({
  nearHouse,
  showHouseInterior,
  showBreweryModal = false,
  showOvenModal = false,
  showFeedMillModal = false,
  showFishShopModal = false,
  onEnterInterior,
  onEnterBrewery,
  onEnterOven,
  onEnterFeedMill,
  onEnterFishShop,
  fishBagCount = 0,
  fishBagTotalCoins = 0,
  onSellAllCaughtFish,
  brewingJobs = [],
  onCollectAllReadyBrews,
  bakingJobs = [],
  onCollectOvenBasket,
  feedMillJobs = [],
  checkPoiCooldown,
  earnCoins,
  addXP,
  setStats,
  addNotice,
  onCollectDuckCoop,
  plots = [],
  // 🔧 FIX #15: default เพื่อกัน undefined ตอน type 30
  seedCounts = {} as Record<CropType, number>,
  playerCoins = 0,
  onPlantCoveredCrop,
  onWaterCoveredHouse,
  onHarvestCoveredHouse,
  onOpenInventory,
  onDismiss,
}) => {
  const { t } = useLanguage();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (
      !nearHouse ||
      (nearHouse.type !== 25 &&
        nearHouse.type !== 26 &&
        nearHouse.type !== 27 &&
        nearHouse.type !== 28)
    ) {
      return;
    }
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nearHouse]);

  if (
    !nearHouse ||
    nearHouse.type === 19 ||
    nearHouse.type === 23 ||
    showHouseInterior ||
    showBreweryModal ||
    showOvenModal ||
    showFeedMillModal ||
    showFishShopModal
  ) {
    return null;
  }

  const houseBrews =
    nearHouse.type === 25 ? brewingJobs.filter((j) => j.houseId === nearHouse.id) : [];
  const readyBrewsCount = houseBrews.filter((j) => nowMs >= j.finishAt).length;

  const houseBakes =
    nearHouse.type === 26 || nearHouse.type === 27
      ? bakingJobs.filter((j) => j.houseId === nearHouse.id)
      : [];
  const activeBakesCount = houseBakes.filter((j) => nowMs < j.finishAt).length;
  const basketReadyCount = houseBakes.filter((j) => nowMs >= j.finishAt).length;

  const houseFeeds =
    nearHouse.type === 28
      ? feedMillJobs.filter((j) => j.houseId === nearHouse.id)
      : [];
  const activeFeedsCount = houseFeeds.filter((j) => nowMs < j.finishAt).length;

  return (
    <div
      data-ui
      className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[94vw] safe-bottom flex items-center gap-1.5"
    >
      {nearHouse.type === 5 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 1200)) return;
            farmAudio.playChickenSound();
            farmAudio.playHarvestSound();
            earnCoins(60);
            addXP(35);
            addNotice(
              t(
                '🥚 เก็บไข่ไก่สดเต็มตะกร้าจากเล้าไก่ +3 ฟอง, +60 🪙 (+35 XP)',
                '🥚 Collected full egg basket from Chicken Coop +3 Eggs, +60 🪙 (+35 XP)'
              ),
              '#facc15'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🐔</span>
          <span>
            {t(
              'เก็บไข่ไก่สดเต็มตะกร้า (+3 ไข่, +60 🪙, +35 XP • ทุก 20 นาที)',
              'Collect Egg Basket (+3 Eggs, +60 🪙, +35 XP • Every 20m)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 6 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            farmAudio.playWaterSound();
            addXP(5);
            addNotice(
              t(
                '🚰 เติมน้ำใส่บัวรดน้ำจากหอส่งน้ำเต็มเปี่ยม! (+5 XP)',
                '🚰 Refilled watering can at the Water Tower! (+5 XP)'
              ),
              '#38bdf8'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-400 hover:from-sky-400 hover:to-blue-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🚰</span>
          <span>{t('เปิดวาล์วหอส่งน้ำฟาร์ม (+5 XP)', 'Open Water Tower Valve (+5 XP)')}</span>
        </button>
      ) : nearHouse.type === 7 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 60)) return;
            farmAudio.playHarvestSound();
            earnCoins(18);
            addXP(10);
            addNotice(
              t(
                '🌾 โม่แป้งสาลีด้วยกังหันลมโบราณสำเร็จ +18 🪙 (+10 XP)',
                '🌾 Milled golden flour at the Windmill +18 🪙 (+10 XP)'
              ),
              '#f59e0b'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🌾</span>
          <span>
            {t(
              'ใช้กังหันลมโม่แป้งฟาร์ม (+18 🪙, +10 XP)',
              'Mill Flour at Windmill (+18 🪙, +10 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 8 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 90)) return;
            farmAudio.playCoinSound();
            earnCoins(25);
            addXP(12);
            addNotice(
              t(
                '🚉 รถไฟขนส่งสินค้าแวะมารับผลผลิตที่สถานี! +25 🪙 (+12 XP)',
                '🚉 Freight train picked up farm cargo! +25 🪙 (+12 XP)'
              ),
              '#10b981'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400 hover:from-emerald-400 hover:to-green-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🚉</span>
          <span>
            {t(
              'สถานีรถไฟชนบท (ส่งออกสินค้า +25 🪙, +12 XP)',
              'Rural Train Station (Export +25 🪙, +12 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 9 ? (
        <button
          onClick={() => {
            addNotice(
              t(
                '⚡ เสาไฟฟ้าแรงสูงจ่ายพลังงานหล่อเลี้ยงระบบฟาร์มอย่างเสถียร',
                '⚡ Power tower supplying clean energy across the farm'
              ),
              '#60a5fa'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-cyan-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">⚡</span>
          <span>{t('เสาไฟฟ้าแรงสูงฟาร์ม', 'Farm Power Tower')}</span>
        </button>
      ) : nearHouse.type === 10 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            farmAudio.playCoinSound();
            addXP(3);
            addNotice(
              t(
                '🏮 จุดโคมไฟโบราณ แสงไฟสลัวส่องสว่างอบอุ่นรอบพื้นที่ฟาร์ม (+3 XP)',
                '🏮 Lit the vintage lantern post (+3 XP)'
              ),
              '#fbbf24'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🏮</span>
          <span>{t('โคมไฟเสาโบราณ (+3 XP)', 'Vintage Lamp Post (+3 XP)')}</span>
        </button>
      ) : nearHouse.type === 11 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 60)) return;
            farmAudio.playHarvestSound();
            earnCoins(20);
            addXP(10);
            addNotice(
              t(
                '🚜 บรึ้มมม! สตาร์ตเครื่องยนต์แทรกเตอร์ ช่วยไถเตรียมดิน +20 🪙 (+10 XP)',
                '🚜 Started the farm tractor to till fields! +20 🪙 (+10 XP)'
              ),
              '#22c55e'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-green-500 to-lime-400 hover:from-emerald-500 hover:to-lime-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🚜</span>
          <span>
            {t(
              'สตาร์ตเครื่องยนต์แทรกเตอร์ (+20 🪙, +10 XP)',
              'Run Farm Tractor (+20 🪙, +10 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 12 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 90)) return;
            farmAudio.playCoinSound();
            earnCoins(25);
            addXP(15);
            addNotice(
              t(
                '🏘️ แวะเยี่ยมเยียนชาวบ้านในหมู่บ้านชนบท ได้รับของขวัญต้อนรับ +25 🪙 (+15 XP)',
                '🏘️ Visited neighbors at the Country Village! +25 🪙 (+15 XP)'
              ),
              '#38bdf8'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 hover:from-sky-400 hover:to-purple-400 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🏘️</span>
          <span>
            {t(
              'ทักทายชาวบ้านในหมู่บ้านชนบท (+25 🪙, +15 XP)',
              'Greet Country Villagers (+25 🪙, +15 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 13 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            addXP(3);
            addNotice(
              t(
                '🪵 ตรวจเช็กเสาไฟฟ้าไม้ชนบท: สายไฟทำงานปกติ (+3 XP)',
                '🪵 Checked wooden utility pole: lines nominal (+3 XP)'
              ),
              '#a3e635'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-500 text-amber-50 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-400 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🪵</span>
          <span>{t('เสาไฟฟ้าไม้ชนบท (+3 XP)', 'Wooden Utility Pole (+3 XP)')}</span>
        </button>
      ) : nearHouse.type === 14 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            addXP(3);
            addNotice(
              t(
                '🪜 ตรวจบันไดหนีไฟเหล็ก: แข็งแรงปลอดภัย (+3 XP)',
                '🪜 Inspected steel fire escape: sturdy & safe (+3 XP)'
              ),
              '#94a3b8'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-slate-700 via-gray-600 to-zinc-500 hover:from-slate-600 hover:to-zinc-400 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-slate-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🪜</span>
          <span>{t('บันไดหนีไฟเหล็ก (+3 XP)', 'Steel Fire Escape (+3 XP)')}</span>
        </button>
      ) : nearHouse.type === 15 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            farmAudio.playHorseSound();
            earnCoins(20);
            addXP(10);
            addNotice(
              t(
                '🐴 แปรงขนและให้อาหารหญ้าแห้งม้าในคอกม้า! +20 🪙 (+10 XP)',
                '🐴 Brushed & fed hay at the Horse Stable! +20 🪙 (+10 XP)'
              ),
              '#f59e0b'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-500 hover:from-amber-500 hover:to-orange-400 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🐴</span>
          <span>{t('ดูแลม้าในคอก (+20 🪙, +10 XP)', 'Care for Horses (+20 🪙, +10 XP)')}</span>
        </button>
      ) : nearHouse.type === 16 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 45)) return;
            farmAudio.playCowSound();
            earnCoins(22);
            addXP(12);
            addNotice(
              t(
                '🥛 รีดนมวัวสดและให้อาหารหญ้าแห้งในคอกวัว! +22 🪙 (+12 XP)',
                '🥛 Milked fresh dairy at the Cow Barn! +22 🪙 (+12 XP)'
              ),
              '#86efac'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-green-500 to-teal-400 hover:from-emerald-500 hover:to-teal-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🐮</span>
          <span>
            {t(
              'รีดนมวัวสด & ให้อาหารในคอกวัว (+22 🪙, +12 XP)',
              'Milk Cows & Feed Hay (+22 🪙, +12 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 17 ? (
        <button
          onClick={() => {
            farmAudio.playDoorSound();
            onEnterInterior();
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <LogIn className="w-4 h-4 text-white stroke-[3]" />
          <span>{t('🌴 เข้าพักผ่อนบ้านพักป่าดิบชื้น', '🌴 Enter Jungle Villa')}</span>
        </button>
      ) : nearHouse.type === 18 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 60)) return;
            farmAudio.playDoorSound();
            earnCoins(30);
            addXP(15);
            setStats((prev) => ({
              ...prev,
              stamina: Math.min(prev.maxStamina, prev.stamina + 20),
            }));
            addNotice(
              t(
                '🏡 คนสวนและคนงานช่วยดูแลฟาร์ม! ฟื้นฟูพลัง +20, รับโบนัสผลผลิต +30 🪙 (+15 XP)',
                '🏡 Farmhands tended the grounds! +20 Stamina, +30 🪙 (+15 XP)'
              ),
              '#a5d6a7'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-lime-600 via-green-500 to-emerald-500 hover:from-lime-500 hover:to-emerald-400 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-lime-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🏡</span>
          <span>
            {t(
              'เยี่ยมบ้านพักคนสวน (+30 🪙, +20 พลังกาย, +15 XP)',
              'Visit Worker Lodge (+30 🪙, +20 Stamina, +15 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 20 ? (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={() => {
              if (!checkPoiCooldown(nearHouse.id, 60)) return;
              farmAudio.playHarvestSound();
              earnCoins(20);
              addXP(10);
              addNotice(
                t(
                  '🏭 คัดแยกและเก็บผลผลิตเข้าคลังโรงเก็บ! ผลผลิตคุณภาพดี +20 🪙 (+10 XP)',
                  '🏭 Sorted & stored prime produce at the Storage Facility! +20 🪙 (+10 XP)'
                ),
                '#bc8a5f'
              );
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-800 via-amber-700 to-orange-600 hover:from-amber-700 hover:to-orange-500 text-amber-50 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-400 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
          >
            <span className="text-base">🏭</span>
            <span>
              {t(
                'คัดแยก & เก็บผลผลิตเข้าโรงเก็บ (+20 🪙, +10 XP)',
                'Sort Produce at Storage Facility (+20 🪙, +10 XP)'
              )}
            </span>
          </button>
          {onOpenInventory && (
            <button
              onClick={() => {
                farmAudio.playDoorSound();
                onOpenInventory();
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-stone-950 font-black px-4 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-100 shadow-2xl text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <span className="text-base">📦</span>
              <span>{t('เปิดคลังเก็บของ & ร้านค้า', 'Open Barn & Shop')}</span>
            </button>
          )}
        </div>
      ) : nearHouse.type === 21 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 30)) return;
            addXP(2);
            addNotice(
              t(
                '🪨 ชื่นชมโขดหินริมน้ำอันเงียบสงบ (+2 XP)',
                '🪨 Admired the serene river rock (+2 XP)'
              ),
              '#94a3b8'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-400 hover:from-slate-500 hover:to-slate-300 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-slate-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🪨</span>
          <span>{t('โขดหินริมน้ำ (+2 XP)', 'River Rock (+2 XP)')}</span>
        </button>
      ) : nearHouse.type === 22 ? (
        <button
          onClick={() => {
            if (!checkPoiCooldown(nearHouse.id, 60)) return;
            farmAudio.playHarvestSound();
            earnCoins(10);
            addXP(5);
            addNotice(
              t(
                '🌳 สำรวจต้นโอ๊คและเก็บกิ่งไม้แห้ง +10 🪙 (+5 XP)',
                '🌳 Explored Oak Trees & gathered branches +10 🪙 (+5 XP)'
              ),
              '#2e7d32'
            );
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 hover:from-green-600 hover:to-teal-500 text-white font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-green-300 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🌳</span>
          <span>
            {t(
              'สำรวจต้นโอ๊ค & เก็บกิ่งไม้ (+10 🪙, +5 XP)',
              'Explore Oak Trees (+10 🪙, +5 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 24 ? (
        // 🔧 FIX #6: ลบ fallback ที่ให้เหรียญตรงๆ (ไม่ตรงกับ handler) — ใช้ onCollectDuckCoop เท่านั้น
        <button
          onClick={() => {
            onCollectDuckCoop?.(nearHouse.id);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-300 hover:from-teal-400 hover:to-amber-200 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <span className="text-base">🦆</span>
          <span>
            {t(
              'เก็บไข่เป็ดสด & ขนเป็ดในเล้า (+2 ไข่เป็ด, +2 ขนเป็ด, +12 XP)',
              'Collect Duck Eggs & Feathers (+2 Eggs, +2 Feathers, +12 XP)'
            )}
          </span>
        </button>
      ) : nearHouse.type === 25 ? (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {readyBrewsCount > 0 && onCollectAllReadyBrews && (
            <button
              onClick={() => onCollectAllReadyBrews(nearHouse.id)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black px-4 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
            >
              <span className="text-base">🍾</span>
              <span>
                {t(
                  `เก็บเครื่องดื่มที่กลั่นเสร็จ (${readyBrewsCount} ขวด)`,
                  `Collect Ready Bottles (${readyBrewsCount})`
                )}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              farmAudio.playDoorSound();
              onEnterBrewery?.(nearHouse.id);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
          >
            <LogIn className="w-4 h-4 text-stone-950 stroke-[3]" />
            <span>
              {t(
                `🍺 เดินเข้าโรงกลั่นและหมักเครื่องดื่ม (${houseBrews.length}/${BREWERY_SLOTS_PER_BUILDING} ถัง)`,
                `🍺 Enter Brewery & Distillery (${houseBrews.length}/${BREWERY_SLOTS_PER_BUILDING} Vats)`
              )}
            </span>
          </button>
        </div>
      ) : nearHouse.type === 26 || nearHouse.type === 27 ? (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {basketReadyCount > 0 && onCollectOvenBasket && (
            <button
              onClick={() => onCollectOvenBasket(nearHouse.id)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black px-4 py-2.5 sm:py-3 rounded-2xl border-2 border-emerald-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
            >
              <span className="text-base">🧺</span>
              <span>
                {t(
                  `หยิบจากตะกร้าปลายรางเลื่อน (${basketReadyCount} ชิ้น)`,
                  `Collect from Conveyor Basket (${basketReadyCount})`
                )}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              farmAudio.playDoorSound();
              onEnterOven?.(
                nearHouse.id,
                nearHouse.type === 26 ? 'bakery' : 'pie_oven'
              );
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
          >
            <LogIn className="w-4 h-4 text-stone-950 stroke-[3]" />
            <span>
              {/* 🔧 FIX #14: แสดงจำนวน slot ทั้งหมด (รวมที่รอเก็บในตะกร้า) ให้สอดคล้องกับ Brewery */}
              {nearHouse.type === 26
                ? t(
                    `🍞 เปิดเตาอบขนมปังและพิซซ่า (${houseBakes.length}/${OVEN_SLOTS_PER_BUILDING} ถาด)`,
                    `🍞 Open Bakery & Pizza Oven (${houseBakes.length}/${OVEN_SLOTS_PER_BUILDING} Trays)`
                  )
                : t(
                    `🥧 เปิดเตาอบพาย (${houseBakes.length}/${OVEN_SLOTS_PER_BUILDING} ถาด)`,
                    `🥧 Open Pie Oven (${houseBakes.length}/${OVEN_SLOTS_PER_BUILDING} Trays)`
                  )}
            </span>
          </button>
        </div>
      ) : nearHouse.type === 28 ? (
        <button
          onClick={() => {
            farmAudio.playDoorSound();
            onEnterFeedMill?.(nearHouse.id);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap"
        >
          <LogIn className="w-4 h-4 text-stone-950 stroke-[3]" />
          <span>
            {/* 🔧 FIX #14: รวม slot ทั้งหมด ไม่ใช่แค่ active */}
            {t(
              `🌾 เปิดเครื่องผลิตอาหารสัตว์ (${houseFeeds.length}/${FEED_MILL_SLOTS_PER_BUILDING} ช่อง • ลอยเก็บอัตโนมัติ)`,
              `🌾 Open Animal Feed Mill (${houseFeeds.length}/${FEED_MILL_SLOTS_PER_BUILDING} • Auto-Float)`
            )}
          </span>
        </button>
      ) : nearHouse.type === 29 ? (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {fishBagCount > 0 && onSellAllCaughtFish && (
            <button
              onClick={() => onSellAllCaughtFish(nearHouse.id)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 hover:from-amber-300 hover:to-yellow-200 text-stone-950 font-black px-4 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-100 shadow-2xl text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap tabular-nums"
            >
              <span className="text-base">💰</span>
              <span>
                {t(
                  `ขายปลาทั้งหมดทันที (${fishBagCount} ตัว • +${fishBagTotalCoins.toLocaleString()} 🪙)`,
                  `Quick Sell All (${fishBagCount} Fish • +${fishBagTotalCoins.toLocaleString()} 🪙)`
                )}
              </span>
            </button>
          )}
          <button
            onClick={() => {
              farmAudio.playDoorSound();
              onEnterFishShop?.(nearHouse.id);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap"
          >
            <LogIn className="w-4 h-4 text-stone-950 stroke-[3]" />
            <span>
              {fishBagCount > 0
                ? t(
                    `🐟 เปิดร้านรับซื้อปลาสด (มีปลาพร้อมขาย ${fishBagCount} ตัว)`,
                    `🐟 Open Fish-Buying Shop (${fishBagCount} Ready)`
                  )
                : t(
                    '🐟 เปิดร้านรับซื้อปลาสด & ใบราคารับซื้อ',
                    '🐟 Open Fish-Buying Shop & Rates'
                  )}
            </span>
          </button>
        </div>
      ) : nearHouse.type === 30 &&
        onPlantCoveredCrop &&
        onWaterCoveredHouse &&
        onHarvestCoveredHouse ? (
        <CoveredPlotQuickBar
          houseId={nearHouse.id}
          plots={plots}
          seedCounts={seedCounts}
          playerCoins={playerCoins}
          onPlantCrop={onPlantCoveredCrop}
          onWaterAll={onWaterCoveredHouse}
          onHarvestAll={onHarvestCoveredHouse}
        />
      ) : nearHouse.type <= 4 ? (
        <button
          onClick={() => {
            farmAudio.playDoorSound();
            onEnterInterior();
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
        >
          <LogIn className="w-4 h-4 text-stone-950 stroke-[3]" />
          <span>{t('🍳 เดินเข้าบ้านพัก & เข้าครัวทำอาหาร', '🍳 Enter Farmhouse & Kitchen')}</span>
        </button>
      ) : null}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          title={t('ซ่อนป้ายนี้', 'Hide prompt')}
          aria-label={t('ซ่อนป้ายนี้', 'Hide prompt')}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-stone-950/90 hover:bg-stone-800 text-stone-200 border border-white/25 shadow-xl shrink-0 transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};