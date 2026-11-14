// src/components/ui/InventoryModal.tsx
import React, { useState } from 'react';
import {
  CropType,
  TreeType,
  CROP_DEFINITIONS,
  TREE_DEFINITIONS,
  DUCK_EGG_SELL_PRICE,
  DUCK_FEATHER_SELL_PRICE,
  PROCESSED_FEATHER_DEFS,
  ProcessedFeatherType,
  BREW_DRINK_DEFS,
  BrewDrinkType,
  BAKED_GOOD_DEFS,
  BakedGoodType,
  OvenMachineType,
  getOvenMasteryStars,
  ANIMAL_FEED_DEFS,
  type AnimalFeedType,
} from '../../types/game';
import { X, Coins, ShoppingBag, Store, TreePine, Sprout, Hammer } from 'lucide-react';
import { farmAudio } from '../../utils/audio';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getAnimalFeedName,
  getBakedGoodName,
  getBrewDrinkName,
  getCropDesc,
  getCropName,
  getCropSeedName,
  getProcessedFeatherDesc,
  getProcessedFeatherName,
  getTreeDesc,
  getTreeFruitName,
  getTreeSaplingName,
} from '../../i18n/translations';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'harvests' | 'processing' | 'shop';
  inventoryCrops: Record<CropType, number>;
  inventorySeeds: Record<CropType, number>;
  inventorySaplings?: Record<TreeType, number>;
  inventoryTreeFruits?: Record<TreeType, number>;
  inventoryWood?: number;
  inventoryDuckEggs?: number;
  inventoryDuckFeathers?: number;
  inventoryProcessedFeathers?: Record<ProcessedFeatherType, number>;
  inventoryDrinks?: Record<BrewDrinkType, number>;
  inventoryBakedGoods?: Record<BakedGoodType, number>;
  ovenMasterySeconds?: Record<OvenMachineType, number>;
  inventoryAnimalFeeds?: Record<AnimalFeedType, number>;
  coins: number;
  onSellCrop: (crop: CropType, count: number) => void;
  onSellTreeFruit?: (type: TreeType, count: number) => void;
  onSellWood?: (count: number) => void;
  onSellDuckEgg?: (count: number) => void;
  onSellDuckFeather?: (count: number) => void;
  onCraftFeatherProduct?: (productType: ProcessedFeatherType) => boolean;
  onSellProcessedFeather?: (productType: ProcessedFeatherType, count: number) => void;
  onSellDrink?: (drinkType: BrewDrinkType, count: number) => void;
  onSellBakedGood?: (itemType: BakedGoodType, count: number) => void;
  onSellAnimalFeed?: (feedType: AnimalFeedType, count: number) => void;
  onUseAnimalFeed?: (feedType: AnimalFeedType) => boolean;
  onSellAllCrops: () => void;
  onBuySeed: (crop: CropType, count: number) => void;
  onBuySapling?: (type: TreeType, count: number) => void;
}

const buildEmptyTreeInventory = (): Record<TreeType, number> =>
  Object.keys(TREE_DEFINITIONS).reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<TreeType, number>
  );

const EMPTY_TREE_INVENTORY = buildEmptyTreeInventory();

const EMPTY_DRINKS: Record<BrewDrinkType, number> = {
  beer: 0,
  barley_beer: 0,
  craft_beer: 0,
  carrot_vodka: 0,
  whiskey: 0,
  orchard_brandy: 0,
  schnapps: 0,
  coconut_water: 0,
  coconut_milk: 0,
  tropical_smoothie: 0,
};

const EMPTY_BAKED_GOODS: Record<BakedGoodType, number> = {
  white_bread: 0,
  cookie: 0,
  cornbread: 0,
  cheese_pizza: 0,
  seafood_pizza: 0,
  spicy_pizza: 0,
  carrot_pie: 0,
  pumpkin_pie: 0,
  bacon_pie: 0,
  macaroon: 0,
  coconut_ice_cream: 0,
  coconut_jelly: 0,
};

const EMPTY_OVEN_MASTERY: Record<OvenMachineType, number> = {
  bakery: 0,
  pie_oven: 0,
};

const EMPTY_ANIMAL_FEEDS: Record<AnimalFeedType, number> = {
  chicken_duck_feed: 0,
  duck_grain_feed: 0,
  pig_goat_feed: 0,
  cow_sheep_feed: 0,
  premium_horse_feed: 0,
};

// ============================================================
// LIQUID GLASS DESIGN SYSTEM (ปรับให้เล็กลงครึ่ง)
// ============================================================
const GLASS_PILL =
  'relative overflow-hidden bg-gradient-to-br from-white/70 via-white/20 to-white/10 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_5px_rgba(255,255,255,0.9),inset_0_-1px_3px_rgba(255,255,255,0.3),0_5px_10px_rgba(0,0,0,0.1),-1px_0_2px_rgba(255,100,100,0.3),1px_0_2px_rgba(100,150,255,0.3)]';
const GLASS_CIRCLE =
  'relative overflow-hidden flex items-center justify-center rounded-full bg-gradient-to-br from-white/80 via-white/30 to-white/10 backdrop-blur-md border border-white/70 shadow-[inset_0_1px_4px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(255,255,255,0.4),0_4px_8px_rgba(0,0,0,0.15),-1px_0_1px_rgba(255,150,150,0.4),1px_0_1px_rgba(150,200,255,0.4)]';

// 🔹 เงาสีดำเพื่อให้ตัวหนังสือสีเหลืองเด่นชัด
const TEXT_SHARP_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.6)]';
const TEXT_SOFT_HALO = '[text-shadow:0_1px_2px_rgba(0,0,0,0.7)]';
const TEXT_LIGHT_HALO = '[text-shadow:0_1px_1px_rgba(0,0,0,0.5)]';

const BTN_AMBER =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] text-[#3a2a05] border-[#c9a03a] shadow-[0_2px_5px_rgba(201,160,58,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GREEN =
  'min-h-[22px] px-3 py-1 rounded-full font-bold text-[10px] transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white border-[#6a8a32] shadow-[0_2px_5px_rgba(106,138,50,0.4),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_GLASS =
  'min-h-[18px] px-2 py-0.5 rounded-full font-bold text-[9px] transition-all active:scale-95 whitespace-nowrap border bg-white/40 hover:bg-white/60 text-black border-white/60 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed';

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  initialTab,
  inventoryCrops,
  inventorySeeds,
  inventorySaplings = EMPTY_TREE_INVENTORY,
  inventoryTreeFruits = EMPTY_TREE_INVENTORY,
  inventoryWood = 0,
  inventoryDuckEggs = 0,
  inventoryDuckFeathers = 0,
  inventoryProcessedFeathers = { feather_charm: 0, feather_pillow: 0, down_quilt: 0 },
  inventoryDrinks = EMPTY_DRINKS,
  inventoryBakedGoods = EMPTY_BAKED_GOODS,
  ovenMasterySeconds = EMPTY_OVEN_MASTERY,
  inventoryAnimalFeeds = EMPTY_ANIMAL_FEEDS,
  coins,
  onSellCrop,
  onSellTreeFruit,
  onSellWood,
  onSellDuckEgg,
  onSellDuckFeather,
  onCraftFeatherProduct,
  onSellProcessedFeather,
  onSellDrink,
  onSellBakedGood,
  onSellAnimalFeed,
  onUseAnimalFeed,
  onSellAllCrops,
  onBuySeed,
  onBuySapling,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'harvests' | 'processing' | 'shop'>('harvests');
  const [shopSubTab, setShopSubTab] = useState<'seeds' | 'trees'>('seeds');

  React.useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const cropsList = Object.values(CROP_DEFINITIONS);
  const treesList = Object.values(TREE_DEFINITIONS);
  const processedList = Object.values(PROCESSED_FEATHER_DEFS);
  const drinksList = Object.values(BREW_DRINK_DEFS);
  const bakedList = Object.values(BAKED_GOOD_DEFS);
  const feedsList = Object.values(ANIMAL_FEED_DEFS);

  const totalCropsCount = Object.values(inventoryCrops).reduce((a, b) => a + b, 0);
  const totalFruitsCount = Object.values(inventoryTreeFruits).reduce((a, b) => a + b, 0);
  const totalProcessedCount = Object.values(inventoryProcessedFeathers).reduce((a, b) => a + b, 0);
  const totalDrinksCount = Object.values(inventoryDrinks).reduce((a, b) => a + b, 0);
  const totalBakedCount = Object.values(inventoryBakedGoods).reduce((a, b) => a + b, 0);
  const totalFeedsCount = Object.values(inventoryAnimalFeeds).reduce((a, b) => a + b, 0);
  const totalItemsCount =
    totalCropsCount +
    totalFruitsCount +
    inventoryDuckEggs +
    inventoryDuckFeathers +
    totalProcessedCount +
    totalDrinksCount +
    totalBakedCount +
    totalFeedsCount +
    inventoryWood;

  const cropValue = cropsList.reduce(
    (sum, crop) => sum + (inventoryCrops[crop.id] || 0) * crop.sellPrice,
    0
  );
  const fruitValue = treesList.reduce(
    (sum, trItem) =>
      sum +
      (inventoryTreeFruits[trItem.id] || 0) *
        (trItem.isFruitTree && trItem.fruitSellPrice ? trItem.fruitSellPrice : 0),
    0
  );
  const duckEggValue = inventoryDuckEggs * DUCK_EGG_SELL_PRICE;
  const processedFeatherValue = processedList.reduce(
    (sum, item) => sum + (inventoryProcessedFeathers[item.id] || 0) * item.sellPrice,
    0
  );
  const drinksValue = drinksList.reduce(
    (sum, item) => sum + (inventoryDrinks[item.id] || 0) * item.sellPrice,
    0
  );
  const bakedValue = bakedList.reduce((sum, item) => {
    const count = inventoryBakedGoods[item.id] || 0;
    if (count <= 0) return sum;
    const stars = getOvenMasteryStars(ovenMasterySeconds[item.machine] || 0);
    const unitPrice = stars >= 1 ? Math.round(item.sellPrice * 1.1) : item.sellPrice;
    return sum + count * unitPrice;
  }, 0);
  const feedsValue = feedsList.reduce(
    (sum, item) => sum + (inventoryAnimalFeeds[item.id] || 0) * item.sellPrice,
    0
  );
  const totalSellValue =
    cropValue +
    fruitValue +
    duckEggValue +
    processedFeatherValue +
    drinksValue +
    bakedValue +
    feedsValue;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 bg-black/75 animate-fade-in backdrop-blur-xs cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-stone-900/90 border border-stone-700/80 rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-1.5 px-2 sm:px-3 py-1.5 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="p-1 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
              <ShoppingBag className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-[11px] sm:text-xs font-bold text-yellow-300 truncate ${TEXT_SHARP_HALO}`}>
                {t('กระเป๋าเก็บของ & ร้านค้า', 'Inventory & Market')}
              </h2>
              <p className={`text-[9px] text-yellow-200 truncate ${TEXT_LIGHT_HALO}`}>
                {t('ขายผลผลิต แปรรูป และซื้อเมล็ดพันธุ์', 'Sell, craft, and buy seeds')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className={`${GLASS_PILL} flex items-center gap-1 px-2 py-1 rounded-full text-yellow-300 font-mono font-bold text-[10px] sm:text-xs tabular-nums ${TEXT_LIGHT_HALO}`}>
              <Coins className="w-3 h-3 text-yellow-400 shrink-0" />
              <span>{coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className={`${GLASS_CIRCLE} min-h-[22px] min-w-[22px] px-1.5 py-1 text-yellow-300 hover:bg-white/80 transition-colors active:scale-95`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-800 bg-stone-950/40 px-2 sm:px-3 pt-1.5 gap-1 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('harvests')}
            className={`pb-1.5 px-1.5 text-[10px] font-semibold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap ${
              activeTab === 'harvests'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-white/60 hover:text-yellow-300'
            }`}
          >
            <span>🧺 {t('ผลผลิต', 'Harvest')} ({totalItemsCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`pb-1.5 px-1.5 text-[10px] font-semibold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap ${
              activeTab === 'processing'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-white/60 hover:text-teal-300'
            }`}
          >
            <Hammer className="w-3 h-3 shrink-0" />
            <span>{t('แปรรูปขนเป็ด', 'Craft')} ({inventoryDuckFeathers})</span>
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`pb-1.5 px-1.5 text-[10px] font-semibold border-b-2 transition-all flex items-center gap-1 whitespace-nowrap ${
              activeTab === 'shop'
                ? 'border-yellow-400 text-yellow-300'
                : 'border-transparent text-white/60 hover:text-yellow-300'
            }`}
          >
            <Store className="w-3 h-3 shrink-0" />
            <span>{t('ร้านค้า', 'Shop')}</span>
          </button>
        </div>

        {/* ── Tab Content: HARVESTS ── */}
        {activeTab === 'harvests' && (
          <div className="p-2 sm:p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {/* Sell All Banner */}
            <div className={`${GLASS_PILL} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 p-2 rounded-[1.25rem]`}>
              <div>
                <h4 className={`text-[11px] font-bold text-yellow-300 ${TEXT_SOFT_HALO}`}>
                  {t('ขายผลผลิตเข้าสหกรณ์', 'Sell Produce')}
                </h4>
                <p className={`text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                  {t(
                    `ผัก ${totalCropsCount} · ผลไม้ ${totalFruitsCount} · ไข่ ${inventoryDuckEggs} · แปรรูป ${totalProcessedCount} (รวม ${totalSellValue} G)`,
                    `${totalCropsCount} crops · ${totalFruitsCount} fruits · ${inventoryDuckEggs} eggs · ${totalProcessedCount} crafted (${totalSellValue} G)`
                  )}
                </p>
              </div>
              <button
                disabled={totalSellValue === 0}
                onClick={() => onSellAllCrops()}
                className={`${BTN_AMBER} w-full sm:w-auto flex items-center justify-center gap-1`}
              >
                <Coins className="w-2.5 h-2.5" />
                <span>{t(`ขายทั้งหมด (+${totalSellValue} G)`, `Sell All (+${totalSellValue} G)`)}</span>
              </button>
            </div>

            {/* Section 0: Duck Coop Produce */}
            <div>
              <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center justify-between gap-1 ${TEXT_LIGHT_HALO}`}>
                <span>🦆 {t('ผลผลิตจากเล้าเป็ด', 'Duck Coop Produce')}</span>
                <button onClick={() => setActiveTab('processing')} className="text-[9px] text-teal-300 hover:underline">
                  {t('ไปหน้าแปรรูป', 'Workshop')}
                </button>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {/* ไข่เป็ดสด */}
                <div className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem]`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">🥚</div>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{t('ไข่เป็ดสด', 'Fresh Duck Egg')}</h4>
                      <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                        <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{inventoryDuckEggs}</strong></span>
                        <span>·</span>
                        <span className="text-yellow-400 font-mono">{DUCK_EGG_SELL_PRICE} G</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button disabled={inventoryDuckEggs <= 0 || !onSellDuckEgg} onClick={() => onSellDuckEgg?.(1)} className={`${BTN_AMBER}`}>
                      {t(`ขาย 1`, `Sell 1`)}
                    </button>
                    {inventoryDuckEggs > 1 && (
                      <button disabled={!onSellDuckEgg} onClick={() => onSellDuckEgg?.(inventoryDuckEggs)} className={BTN_GLASS}>
                        {t(`ขายหมด`, `Sell All`)}
                      </button>
                    )}
                  </div>
                </div>

                {/* ขนเป็ดนุ่ม */}
                <div className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem]`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">🪶</div>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{t('ขนเป็ดนุ่ม', 'Soft Duck Feather')}</h4>
                      <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                        <span>{t('มี:', 'Owned:')} <strong className="text-teal-300 font-mono">{inventoryDuckFeathers}</strong></span>
                        <span>·</span>
                        <span className="text-yellow-400 font-mono">{DUCK_FEATHER_SELL_PRICE} G</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => setActiveTab('processing')} className={`${BTN_GREEN}`}>
                      {t('แปรรูป', 'Craft')}
                    </button>
                    <button disabled={inventoryDuckFeathers <= 0 || !onSellDuckFeather} onClick={() => onSellDuckFeather?.(1)} className={BTN_GLASS}>
                      {t(`ขายดิบ`, `Sell`)}
                    </button>
                  </div>
                </div>
              </div>

              {/* Processed Feathers List */}
              {totalProcessedCount > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-1.5">
                  {processedList.map((item) => {
                    const count = inventoryProcessedFeathers[item.id] || 0;
                    if (count <= 0) return null;
                    return (
                      <div key={item.id} className={`${GLASS_PILL} flex items-center justify-between gap-1 p-1.5 rounded-[1rem] bg-teal-950/30`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-sm p-1 bg-black/20 rounded-lg shrink-0">{item.iconEmoji}</span>
                          <div className="min-w-0">
                            <h5 className={`font-bold text-yellow-300 text-[9px] truncate ${TEXT_SOFT_HALO}`}>{getProcessedFeatherName(item.id, lang)}</h5>
                            <div className="text-[8px] text-teal-300 font-mono tabular-nums">x{count} · {item.sellPrice} G</div>
                          </div>
                        </div>
                        <button disabled={!onSellProcessedFeather} onClick={() => onSellProcessedFeather?.(item.id, 1)} className={`${BTN_AMBER} px-1.5`}>
                          {t(`ขาย`, `Sell`)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 0.5: Brewed Beverages */}
            {totalDrinksCount > 0 && (
              <div>
                <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                  <span>🍺 {t('เครื่องดื่มหมักและกลั่น', 'Brewed Beverages')}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {drinksList.map((drink) => {
                    const count = inventoryDrinks[drink.id] || 0;
                    if (count <= 0) return null;
                    return (
                      <div key={drink.id} className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem] bg-amber-950/25`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{drink.iconEmoji}</div>
                          <div className="min-w-0">
                            <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{getBrewDrinkName(drink.id, lang)}</h4>
                            <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                              <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{count}</strong></span>
                              <span>·</span>
                              <span className="text-emerald-300 font-mono">{drink.sellPrice} G</span>
                            </div>
                          </div>
                        </div>
                        <button disabled={!onSellDrink} onClick={() => onSellDrink?.(drink.id, 1)} className={`${BTN_AMBER}`}>
                          {t(`ขาย 1`, `Sell 1`)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 0.6: Baked Goods */}
            {totalBakedCount > 0 && (
              <div>
                <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                  <span>🍞 {t('ขนมปังและพายจากเตาอบ', 'Baked Goods')}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {bakedList.map((baked) => {
                    const count = inventoryBakedGoods[baked.id] || 0;
                    if (count <= 0) return null;
                    const stars = getOvenMasteryStars(ovenMasterySeconds[baked.machine] || 0);
                    const unitPrice = stars >= 1 ? Math.round(baked.sellPrice * 1.1) : baked.sellPrice;
                    return (
                      <div key={baked.id} className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem] bg-orange-950/25`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{baked.iconEmoji}</div>
                          <div className="min-w-0">
                            <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{getBakedGoodName(baked.id, lang)}</h4>
                            <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                              <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{count}</strong></span>
                              <span>·</span>
                              <span className="text-emerald-300 font-mono">{unitPrice} G</span>
                            </div>
                          </div>
                        </div>
                        <button disabled={!onSellBakedGood} onClick={() => onSellBakedGood?.(baked.id, 1)} className={`${BTN_AMBER}`}>
                          {t(`ขาย 1`, `Sell 1`)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 0.7: Animal Feeds */}
            {totalFeedsCount > 0 && (
              <div>
                <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                  <span>🐾 {t('อาหารสัตว์', 'Animal Feed')}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {feedsList.map((feed) => {
                    const count = inventoryAnimalFeeds[feed.id] || 0;
                    if (count <= 0) return null;
                    return (
                      <div key={feed.id} className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem] bg-emerald-950/25`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{feed.iconEmoji}</div>
                          <div className="min-w-0">
                            <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{getAnimalFeedName(feed.id, lang)}</h4>
                            <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                              <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{count}</strong></span>
                              <span>·</span>
                              <span className="text-emerald-300 font-mono">{feed.sellPrice} G</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {onUseAnimalFeed && (
                            <button onClick={() => onUseAnimalFeed(feed.id)} className={`${BTN_GREEN} px-1.5`}>
                              {t('ใช้', 'Use')}
                            </button>
                          )}
                          <button disabled={!onSellAnimalFeed} onClick={() => onSellAnimalFeed?.(feed.id, 1)} className={`${BTN_AMBER} px-1.5`}>
                            {t('ขาย', 'Sell')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: Crops */}
            <div>
              <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                <span>🌾 {t('พืชผักจากแปลงดิน', 'Field Crops')}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {cropsList.map((crop) => {
                  const count = inventoryCrops[crop.id] || 0;
                  return (
                    <div key={crop.id} className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem]`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{crop.iconEmoji}</div>
                        <div className="min-w-0">
                          <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{getCropName(crop.id, lang)}</h4>
                          <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                            <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{count}</strong></span>
                            <span>·</span>
                            <span className="text-yellow-400 font-mono">{crop.sellPrice} G</span>
                          </div>
                        </div>
                      </div>
                      <button disabled={count === 0} onClick={() => onSellCrop(crop.id, 1)} className={`${BTN_AMBER}`}>
                        {t(`ขาย 1`, `Sell 1`)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Tree Fruits */}
            <div>
              <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                <span>🍎 {t('ผลไม้จากต้นไม้', 'Orchard Fruits')}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {treesList.filter((trItem) => trItem.isFruitTree).map((tree) => {
                  const count = inventoryTreeFruits[tree.id] || 0;
                  return (
                    <div key={tree.id} className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem]`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{tree.iconEmoji}</div>
                        <div className="min-w-0">
                          <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{getTreeFruitName(tree.id, lang)}</h4>
                          <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                            <span>{t('มี:', 'Owned:')} <strong className="text-emerald-400 font-mono">{count}</strong></span>
                            <span>·</span>
                            <span className="text-yellow-400 font-mono">{tree.fruitSellPrice} G</span>
                          </div>
                        </div>
                      </div>
                      <button disabled={count === 0 || !onSellTreeFruit} onClick={() => onSellTreeFruit?.(tree.id, 1)} className={`${BTN_AMBER}`}>
                        {t(`ขาย 1`, `Sell 1`)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Timber Logs */}
            <div>
              <h3 className={`text-[10px] font-bold text-yellow-300 tracking-wide mb-1 flex items-center gap-1 ${TEXT_LIGHT_HALO}`}>
                <span>🪵 {t('ทรัพยากรไม้ซุง', 'Timber Logs')}</span>
              </h3>
              <div className={`${GLASS_PILL} flex items-center justify-between gap-1.5 p-1.5 rounded-[1rem]`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">🪵</div>
                  <div className="min-w-0">
                    <h4 className={`font-bold text-yellow-300 text-[10px] truncate ${TEXT_SOFT_HALO}`}>{t('ท่อนไม้ซุง', 'Timber Logs')}</h4>
                    <div className={`flex items-center gap-1 text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>
                      <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{inventoryWood}</strong></span>
                      <span>·</span>
                      <span className="text-yellow-400 font-mono">{t('14 G / ท่อน', '14 G / log')}</span>
                    </div>
                  </div>
                </div>
                <button disabled={inventoryWood <= 0 || !onSellWood} onClick={() => onSellWood?.(1)} className={`${BTN_AMBER}`}>
                  {t('ขาย 1', 'Sell 1')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab Content: PROCESSING ── */}
        {activeTab === 'processing' && (
          <div className="p-2 sm:p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            <div className={`${GLASS_PILL} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 p-2 rounded-[1rem]`}>
              <div>
                <h3 className={`text-[11px] font-bold text-yellow-300 ${TEXT_SOFT_HALO}`}>{t('แปรรูปขนเป็ด', 'Feather Workshop')}</h3>
                <p className={`text-[9px] text-yellow-200 mt-0.5 ${TEXT_LIGHT_HALO}`}>{t('นำขนเป็ดมาแปรรูปเป็นสินค้ามูลค่าสูง', 'Craft feathers into high-value goods')}</p>
              </div>
              <div className={`${GLASS_PILL} flex items-center gap-1 px-1.5 py-0.5 rounded-full text-yellow-300 text-[9px] font-semibold shrink-0 tabular-nums`}>
                <span>🪶 {t('ขนเป็ด:', 'Feathers:')}</span>
                <strong className="text-teal-300 font-mono text-[10px]">{inventoryDuckFeathers}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {processedList.map((item) => {
                const canCraft = inventoryDuckFeathers >= item.feathersRequired;
                const ownedCount = inventoryProcessedFeathers[item.id] || 0;
                return (
                  <div key={item.id} className={`${GLASS_PILL} flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-[1rem]`}>
                    <div className="flex items-start gap-1.5 min-w-0">
                      <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{item.iconEmoji}</div>
                      <div className="min-w-0">
                        <h4 className={`font-bold text-yellow-300 text-[11px] ${TEXT_SOFT_HALO}`}>{getProcessedFeatherName(item.id, lang)}</h4>
                        <p className={`text-[9px] text-yellow-200 mt-0.5 ${TEXT_LIGHT_HALO}`}>{getProcessedFeatherDesc(item.id, lang)}</p>
                        <div className={`flex items-center gap-1 flex-wrap text-[9px] text-yellow-200 mt-1 tabular-nums ${TEXT_LIGHT_HALO}`}>
                          <span>{t('ใช้:', 'Req:')} <strong className={canCraft ? 'text-teal-300 font-mono' : 'text-rose-400 font-mono'}>🪶 {inventoryDuckFeathers}/{item.feathersRequired}</strong></span>
                          <span>·</span>
                          <span className="text-yellow-400 font-mono">{item.sellPrice} G</span>
                          <span>·</span>
                          <span className="text-emerald-400 font-mono">+{item.xpReward} XP</span>
                          <span>·</span>
                          <span>{t('มี:', 'Owned:')} <strong className="text-yellow-400 font-mono">{ownedCount}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-1 shrink-0">
                      <button disabled={!canCraft || !onCraftFeatherProduct} onClick={() => onCraftFeatherProduct?.(item.id)} className={`${BTN_GREEN}`}>
                        {t('แปรรูป', 'Craft')}
                      </button>
                      <button disabled={ownedCount <= 0 || !onSellProcessedFeather} onClick={() => onSellProcessedFeather?.(item.id, 1)} className={`${BTN_AMBER}`}>
                        {t(`ขาย`, `Sell`)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab Content: SHOP ── */}
        {activeTab === 'shop' && (
          <div className="p-2 sm:p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {/* Sub-tab: Seeds vs Saplings */}
            <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-full border border-white/10 w-fit max-w-full flex-wrap">
              <button
                onClick={() => setShopSubTab('seeds')}
                className={`flex items-center gap-1 min-h-[18px] px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                  shopSubTab === 'seeds' ? 'bg-yellow-400 text-black shadow-sm' : 'text-yellow-200 hover:text-yellow-300'
                }`}
              >
                <Sprout className="w-2.5 h-2.5 shrink-0" />
                <span>{t('เมล็ดพันธุ์', 'Seeds')}</span>
              </button>
              <button
                onClick={() => setShopSubTab('trees')}
                className={`flex items-center gap-1 min-h-[18px] px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                  shopSubTab === 'trees' ? 'bg-emerald-400 text-black shadow-sm' : 'text-yellow-200 hover:text-yellow-300'
                }`}
              >
                <TreePine className="w-2.5 h-2.5 shrink-0" />
                <span>{t('ต้นกล้า', 'Saplings')}</span>
              </button>
            </div>

            {/* SEEDS LIST */}
            {shopSubTab === 'seeds' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {cropsList.map((crop) => {
                  const currentSeeds = inventorySeeds[crop.id] || 0;
                  const canAfford = coins >= crop.seedCost;
                  return (
                    <div key={crop.id} className={`${GLASS_PILL} flex flex-col justify-between p-2 rounded-[1rem] gap-1.5`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{crop.iconEmoji}</div>
                          <div>
                            <h4 className={`font-bold text-yellow-300 text-[10px] ${TEXT_SOFT_HALO}`}>{getCropSeedName(crop.id, lang)}</h4>
                            <p className={`text-[9px] text-yellow-200 ${TEXT_LIGHT_HALO}`}>{getCropDesc(crop.id, lang)}</p>
                            <div className={`flex items-center gap-1 text-[8px] text-yellow-200 mt-0.5 tabular-nums ${TEXT_LIGHT_HALO}`}>
                              <span>⏱ {crop.growthTimeSeconds}s</span>
                              <span>·</span>
                              <span className="text-emerald-400">+{crop.xpReward} XP</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                        <span className={`text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>{t('ในกระเป๋า:', 'In bag:')} <strong className="text-yellow-400 font-mono">{currentSeeds}</strong></span>
                        <div className="flex gap-1 shrink-0">
                          <button disabled={!canAfford} onClick={() => { onBuySeed(crop.id, 1); farmAudio.playCoinSound(); }} className={`${BTN_AMBER} flex items-center gap-0.5`}>
                            <Coins className="w-2.5 h-2.5" />
                            <span>{t(`ซื้อ 1`, `Buy 1`)}</span>
                          </button>
                          <button disabled={coins < crop.seedCost * 5} onClick={() => { onBuySeed(crop.id, 5); farmAudio.playCoinSound(); }} className={BTN_GLASS}>
                            x5
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TREES LIST */}
            {shopSubTab === 'trees' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {treesList.map((tree) => {
                  const currentSaplings = inventorySaplings[tree.id] || 0;
                  const canAfford = coins >= tree.saplingCost;
                  return (
                    <div key={tree.id} className={`${GLASS_PILL} flex flex-col justify-between p-2 rounded-[1rem] gap-1.5`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="text-lg p-1 bg-black/20 rounded-lg shrink-0">{tree.iconEmoji}</div>
                          <div>
                            <h4 className={`font-bold text-yellow-300 text-[10px] ${TEXT_SOFT_HALO}`}>{getTreeSaplingName(tree.id, lang)}</h4>
                            <p className={`text-[9px] text-yellow-200 ${TEXT_LIGHT_HALO}`}>{getTreeDesc(tree.id, lang)}</p>
                            <div className={`flex items-center gap-1 text-[8px] text-yellow-200 mt-0.5 tabular-nums ${TEXT_LIGHT_HALO}`}>
                              <span>⏱ {tree.growthTimeSeconds}s</span>
                              <span>·</span>
                              <span className="text-emerald-400">+{tree.xpReward} XP</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                        <span className={`text-[9px] text-yellow-200 tabular-nums ${TEXT_LIGHT_HALO}`}>{t('ในกระเป๋า:', 'In bag:')} <strong className="text-emerald-400 font-mono">{currentSaplings}</strong></span>
                        <div className="flex gap-1 shrink-0">
                          <button disabled={!canAfford || !onBuySapling} onClick={() => { onBuySapling?.(tree.id, 1); farmAudio.playCoinSound(); }} className={`${BTN_GREEN} flex items-center gap-0.5`}>
                            <Coins className="w-2.5 h-2.5" />
                            <span>{t(`ซื้อ 1`, `Buy 1`)}</span>
                          </button>
                          <button disabled={coins < tree.saplingCost * 3 || !onBuySapling} onClick={() => { onBuySapling?.(tree.id, 3); farmAudio.playCoinSound(); }} className={BTN_GLASS}>
                            x3
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};