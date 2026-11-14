// src/hooks/useFarmEconomy.ts
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  Dispatch,
  SetStateAction,
} from 'react';
import {
  CropType,
  TreeType,
  PlayerStats,
  CROP_DEFINITIONS,
  TREE_DEFINITIONS,
  INITIAL_PLAYER_STATS,
  DUCK_EGG_SELL_PRICE,
  DUCK_FEATHER_SELL_PRICE,
  PROCESSED_FEATHER_DEFS,
  ProcessedFeatherType,
  BREW_DRINK_DEFS,
  BrewDrinkType,
  BrewingJob,
  BREWERY_SLOTS_PER_BUILDING,
  BAKED_GOOD_DEFS,
  BakedGoodType,
  BakingJob,
  OvenMachineType,
  OVEN_SLOTS_PER_BUILDING,
  OVEN_RUSH_COST_COINS,
  OVEN_MASTERY_BOOST_COST_COINS,
  OVEN_MASTERY_STAR_THRESHOLDS,
  getOvenMasteryStars,
  ANIMAL_FEED_DEFS,
  type AnimalFeedType,
  type FeedMillJob,
  type FeedAutoCollectEvent,
  FEED_MILL_SLOTS_PER_BUILDING,
  FEED_MILL_RUSH_COST_COINS,
} from '../types/game';
import { farmAudio } from '../utils/audio';
import {
  createAutoSaveChannel,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
} from '../utils/farmAutoSave';
import { isSaveSuppressed } from '../utils/saveReset';
import {
  tr,
  getCropName,
  getCropSeedName,
  getTreeName,
  getTreeSaplingName,
  getTreeFruitName,
  getProcessedFeatherName,
  getBrewDrinkName,
  getBakedGoodName,
  getAnimalFeedName,
  formatBrewDuration,
} from '../i18n/translations';

const STORAGE_KEY = 'beam_farm_3d_save_map_v2';
const WOOD_SELL_PRICE = 14;

const INITIAL_CROPS: Record<CropType, number> = {
  wheat: 0,
  barley: 0,
  carrot: 0,
  soybean: 0,
  corn: 0,
  pumpkin: 0,
  tomato: 0,
  strawberry: 0,
};

const INITIAL_SEEDS: Record<CropType, number> = {
  wheat: 5,
  barley: 3,
  carrot: 2,
  soybean: 2,
  corn: 0,
  pumpkin: 0,
  tomato: 0,
  strawberry: 0,
};

const INITIAL_PROCESSED_FEATHERS: Record<ProcessedFeatherType, number> = {
  feather_charm: 0,
  feather_pillow: 0,
  down_quilt: 0,
};

const INITIAL_TREE_FRUITS: Record<TreeType, number> = {
  apple: 0,
  orange: 0,
  peach: 0,
  cherry: 0,
  pine: 0,
  oak: 0,
  lemon: 0,
  coconut: 0,
};

const INITIAL_DRINKS: Record<BrewDrinkType, number> = {
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

const INITIAL_BAKED_GOODS: Record<BakedGoodType, number> = {
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

const INITIAL_OVEN_MASTERY: Record<OvenMachineType, number> = {
  bakery: 0,
  pie_oven: 0,
};

const INITIAL_ANIMAL_FEEDS: Record<AnimalFeedType, number> = {
  chicken_duck_feed: 0,
  duck_grain_feed: 0,
  pig_goat_feed: 0,
  cow_sheep_feed: 0,
  premium_horse_feed: 0,
};

interface FarmState {
  stats: PlayerStats;
  inventoryCrops: Record<CropType, number>;
  inventorySeeds: Record<CropType, number>;
  inventorySaplings: Record<TreeType, number>;
  inventoryTreeFruits: Record<TreeType, number>;
  inventoryWood: number;
  inventoryDuckEggs: number;
  inventoryDuckFeathers: number;
  inventoryProcessedFeathers: Record<ProcessedFeatherType, number>;
  inventoryDrinks: Record<BrewDrinkType, number>;
  brewingJobs: BrewingJob[];
  inventoryBakedGoods: Record<BakedGoodType, number>;
  bakingJobs: BakingJob[];
  ovenMasterySeconds: Record<OvenMachineType, number>;
  inventoryAnimalFeeds: Record<AnimalFeedType, number>;
  feedMillJobs: FeedMillJob[];
}

function loadState(): FarmState {
  const load = <T,>(key: string, fallback: T): T => {
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY + key);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return fallback;
  };

  const rawStats = load<Partial<PlayerStats> | null>('_stats', null);
  const stats: PlayerStats = rawStats
    ? {
        ...INITIAL_PLAYER_STATS,
        ...rawStats,
        gems: typeof rawStats.gems === 'number' ? rawStats.gems : INITIAL_PLAYER_STATS.gems,
      }
    : { ...INITIAL_PLAYER_STATS };

  const rawCrops = load<Partial<Record<CropType, number>> | null>('_crops', null);
  const rawSeeds = load<Partial<Record<CropType, number>> | null>('_seeds', null);
  const rawProcessed = load<Partial<Record<ProcessedFeatherType, number>> | null>(
    '_processed_feathers',
    null
  );
  const rawDrinks = load<Partial<Record<BrewDrinkType, number>> | null>('_drinks', null);
  const rawJobs = load<BrewingJob[] | null>('_brewing_jobs', null);
  const rawBaked = load<Partial<Record<BakedGoodType, number>> | null>('_baked_goods', null);
  const rawBakingJobs = load<BakingJob[] | null>('_baking_jobs', null);
  const rawMastery = load<Partial<Record<OvenMachineType, number>> | null>('_oven_mastery', null);
  const rawFeeds = load<Partial<Record<AnimalFeedType, number>> | null>('_animal_feeds', null);
  const rawFeedJobs = load<FeedMillJob[] | null>('_feed_jobs', null);

  return {
    stats,
    inventoryCrops: { ...INITIAL_CROPS, ...(rawCrops ?? {}) },
    inventorySeeds: rawSeeds ? { ...INITIAL_CROPS, ...rawSeeds } : { ...INITIAL_SEEDS },
    inventorySaplings: {
      apple: 0,
      orange: 0,
      peach: 0,
      cherry: 0,
      pine: 0,
      oak: 0,
      lemon: 0,
      coconut: 0,
      ...(load<Record<string, number>>('_saplings', {}) || {}),
    },
    inventoryTreeFruits: {
      apple: 0,
      orange: 0,
      peach: 0,
      cherry: 0,
      pine: 0,
      oak: 0,
      lemon: 0,
      coconut: 0,
      ...(load<Record<string, number>>('_tree_fruits', {}) || {}),
    },
    inventoryWood: load('_wood', 0),
    inventoryDuckEggs: Math.max(0, Number(load('_duck_eggs', 0)) || 0),
    inventoryDuckFeathers: Math.max(0, Number(load('_duck_feathers', 0)) || 0),
    inventoryProcessedFeathers: {
      ...INITIAL_PROCESSED_FEATHERS,
      ...(rawProcessed ?? {}),
    },
    inventoryDrinks: {
      ...INITIAL_DRINKS,
      ...(rawDrinks ?? {}),
    },
    brewingJobs: Array.isArray(rawJobs)
      ? rawJobs.filter(
          (j) =>
            j &&
            typeof j.id === 'string' &&
            typeof j.houseId === 'string' &&
            j.drinkType in BREW_DRINK_DEFS
        )
      : [],
    inventoryBakedGoods: {
      ...INITIAL_BAKED_GOODS,
      ...(rawBaked ?? {}),
    },
    bakingJobs: Array.isArray(rawBakingJobs)
      ? rawBakingJobs.filter(
          (j) =>
            j &&
            typeof j.id === 'string' &&
            typeof j.houseId === 'string' &&
            j.itemType in BAKED_GOOD_DEFS
        )
      : [],
    ovenMasterySeconds: {
      bakery: Math.max(0, Number(rawMastery?.bakery) || 0),
      pie_oven: Math.max(0, Number(rawMastery?.pie_oven) || 0),
    },
    inventoryAnimalFeeds: {
      ...INITIAL_ANIMAL_FEEDS,
      ...(rawFeeds ?? {}),
    },
    feedMillJobs: Array.isArray(rawFeedJobs)
      ? rawFeedJobs.filter(
          (j) =>
            j &&
            typeof j.id === 'string' &&
            typeof j.houseId === 'string' &&
            j.feedType in ANIMAL_FEED_DEFS
        )
      : [],
  };
}

export function useFarmEconomy(addNotice: (text: string, color?: string) => void) {
  const [state, setStateInternal] = useState<FarmState>(loadState);
  const [feedAutoCollectEvents, setFeedAutoCollectEvents] = useState<FeedAutoCollectEvent[]>([]);
  const [levelUpReward, setLevelUpReward] = useState<{
    level: number;
    coins: number;
    gems: number;
  } | null>(null);
  const stateRef = useRef<FarmState>(state);

  const setState = useCallback(
    (updater: FarmState | ((prev: FarmState) => FarmState)): FarmState => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: FarmState) => FarmState)(stateRef.current)
          : updater;
      stateRef.current = next;
      setStateInternal(next);
      return next;
    },
    []
  );

  // ===== Quota-Safe, Starvation-Free Auto-Save =====
  const writeEconomyToStorage = useCallback(() => {
    if (isSaveSuppressed()) return;
    const cur = stateRef.current;
    safeSetLocalStorageItem(STORAGE_KEY + '_stats', JSON.stringify(cur.stats));
    safeSetLocalStorageItem(STORAGE_KEY + '_crops', JSON.stringify(cur.inventoryCrops));
    safeSetLocalStorageItem(STORAGE_KEY + '_seeds', JSON.stringify(cur.inventorySeeds));
    safeSetLocalStorageItem(STORAGE_KEY + '_saplings', JSON.stringify(cur.inventorySaplings));
    safeSetLocalStorageItem(STORAGE_KEY + '_tree_fruits', JSON.stringify(cur.inventoryTreeFruits));
    safeSetLocalStorageItem(STORAGE_KEY + '_wood', JSON.stringify(cur.inventoryWood));
    safeSetLocalStorageItem(STORAGE_KEY + '_duck_eggs', JSON.stringify(cur.inventoryDuckEggs));
    safeSetLocalStorageItem(
      STORAGE_KEY + '_duck_feathers',
      JSON.stringify(cur.inventoryDuckFeathers)
    );
    safeSetLocalStorageItem(
      STORAGE_KEY + '_processed_feathers',
      JSON.stringify(cur.inventoryProcessedFeathers)
    );
    safeSetLocalStorageItem(STORAGE_KEY + '_drinks', JSON.stringify(cur.inventoryDrinks));
    safeSetLocalStorageItem(STORAGE_KEY + '_brewing_jobs', JSON.stringify(cur.brewingJobs));
    safeSetLocalStorageItem(STORAGE_KEY + '_baked_goods', JSON.stringify(cur.inventoryBakedGoods));
    safeSetLocalStorageItem(STORAGE_KEY + '_baking_jobs', JSON.stringify(cur.bakingJobs));
    safeSetLocalStorageItem(
      STORAGE_KEY + '_oven_mastery',
      JSON.stringify(cur.ovenMasterySeconds)
    );
    safeSetLocalStorageItem(
      STORAGE_KEY + '_animal_feeds',
      JSON.stringify(cur.inventoryAnimalFeeds)
    );
    safeSetLocalStorageItem(STORAGE_KEY + '_feed_jobs', JSON.stringify(cur.feedMillJobs));
  }, []);

  const saveChannelRef = useRef<ReturnType<typeof createAutoSaveChannel> | null>(null);
  useEffect(() => {
    const channel = createAutoSaveChannel(writeEconomyToStorage, {
      delayMs: 200,
      maxWaitMs: 1000,
    });
    saveChannelRef.current = channel;
    channel.schedule();
    return () => {
      channel.dispose();
      saveChannelRef.current = null;
    };
  }, [writeEconomyToStorage]);

  useEffect(() => {
    saveChannelRef.current?.schedule();
  }, [state]);

  // ===== XP & Level Up Bonus =====
  const addXP = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const xpGain = Math.floor(amount);
      if (xpGain <= 0) return;

      let leveledUpTo: number | null = null;
      let bonusCoins = 0;
      let bonusGems = 0;

      setState((prev) => {
        let newXP = prev.stats.xp + xpGain;
        let newLevel = prev.stats.level;
        let newXPToNext = prev.stats.xpToNextLevel;

        while (newXP >= newXPToNext) {
          newXP -= newXPToNext;
          newLevel += 1;
          bonusCoins += newLevel * 30;
          bonusGems += 1;
          newXPToNext = Math.round(newXPToNext * 1.5);
        }

        if (newLevel > prev.stats.level) {
          leveledUpTo = newLevel;
          return {
            ...prev,
            stats: {
              ...prev.stats,
              xp: newXP,
              level: newLevel,
              xpToNextLevel: newXPToNext,
              stamina: Math.max(prev.stats.stamina, prev.stats.maxStamina),
              coins: prev.stats.coins + bonusCoins,
              gems: (prev.stats.gems || 0) + bonusGems,
              coinsEarnedTotal: prev.stats.coinsEarnedTotal + bonusCoins,
            },
          };
        }

        return {
          ...prev,
          stats: { ...prev.stats, xp: newXP, level: newLevel, xpToNextLevel: newXPToNext },
        };
      });

      if (leveledUpTo !== null) {
        farmAudio.playLevelUpSound();
        setLevelUpReward({
          level: leveledUpTo,
          coins: bonusCoins,
          gems: bonusGems,
        });
        addNotice(
          tr(
            `🎉 เลเวลอัป Lv.${leveledUpTo}! รับโบนัส +${bonusCoins} เหรียญ & +${bonusGems} 💎 เพชร`,
            `🎉 Level Up Lv.${leveledUpTo}! Bonus +${bonusCoins} Coins & +${bonusGems} 💎 Gems`
          ),
          '#ffd54f'
        );
      }
    },
    [setState, addNotice]
  );

  const clearLevelUpReward = useCallback(() => {
    setLevelUpReward(null);
  }, []);

  // ===== Spend & Earn Coins / Gems =====
  const spendCoins = useCallback(
    (amount: number): boolean => {
      if (!Number.isFinite(amount) || amount < 0) return false;
      const cost = Math.floor(amount);
      if (cost === 0) return true;
      if (stateRef.current.stats.coins < cost) return false;
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, coins: Math.max(0, prev.stats.coins - cost) },
      }));
      return true;
    },
    [setState]
  );

  const spendGems = useCallback(
    (amount: number): boolean => {
      if (!Number.isFinite(amount) || amount < 0) return false;
      const cost = Math.floor(amount);
      if (cost === 0) return true;
      if ((stateRef.current.stats.gems || 0) < cost) return false;
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, gems: Math.max(0, (prev.stats.gems || 0) - cost) },
      }));
      return true;
    },
    [setState]
  );

  const earnGems = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const gain = Math.floor(amount);
      if (gain <= 0) return;
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, gems: (prev.stats.gems || 0) + gain },
      }));
    },
    [setState]
  );

  const spendSeed = useCallback(
    (crop: CropType): boolean => {
      if (!CROP_DEFINITIONS[crop]) return false;
      if ((stateRef.current.inventorySeeds[crop] || 0) <= 0) return false;
      setState((prev) => ({
        ...prev,
        inventorySeeds: {
          ...prev.inventorySeeds,
          [crop]: Math.max(0, (prev.inventorySeeds[crop] || 0) - 1),
        },
      }));
      return true;
    },
    [setState]
  );

  const spendSapling = useCallback(
    (type: TreeType): boolean => {
      if (!TREE_DEFINITIONS[type]) return false;
      if ((stateRef.current.inventorySaplings[type] || 0) <= 0) return false;
      setState((prev) => ({
        ...prev,
        inventorySaplings: {
          ...prev.inventorySaplings,
          [type]: Math.max(0, (prev.inventorySaplings[type] || 0) - 1),
        },
      }));
      return true;
    },
    [setState]
  );

  const earnCoins = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const gain = Math.floor(amount);
      if (gain <= 0) return;
      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + gain,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + gain,
        },
      }));
    },
    [setState]
  );

  // ===== Add =====
  const addCrop = useCallback(
    (crop: CropType, count: number = 1) => {
      setState((prev) => ({
        ...prev,
        inventoryCrops: {
          ...prev.inventoryCrops,
          [crop]: (prev.inventoryCrops[crop] || 0) + count,
        },
        stats: {
          ...prev.stats,
          cropsHarvestedTotal: prev.stats.cropsHarvestedTotal + count,
        },
      }));
    },
    [setState]
  );

  // ✅ NEW: ฟังก์ชันเพิ่มเมล็ดพืชเข้าคลัง
  const addSeed = useCallback(
    (crop: CropType, count: number = 1) => {
      setState((prev) => ({
        ...prev,
        inventorySeeds: {
          ...prev.inventorySeeds,
          [crop]: (prev.inventorySeeds[crop] || 0) + count,
        },
      }));
    },
    [setState]
  );

  const addTreeHarvest = useCallback(
    (type: TreeType, count: number = 1) => {
      setState((prev) => ({
        ...prev,
        inventoryTreeFruits: {
          ...prev.inventoryTreeFruits,
          [type]: (prev.inventoryTreeFruits[type] || 0) + count,
        },
        stats: {
          ...prev.stats,
          cropsHarvestedTotal: prev.stats.cropsHarvestedTotal + count,
        },
      }));
    },
    [setState]
  );

  const addWood = useCallback(
    (count: number) => {
      setState((prev) => ({ ...prev, inventoryWood: prev.inventoryWood + count }));
    },
    [setState]
  );

  const addDuckProduce = useCallback(
    (eggs: number, feathers: number) => {
      if (eggs <= 0 && feathers <= 0) return;
      setState((prev) => ({
        ...prev,
        inventoryDuckEggs: prev.inventoryDuckEggs + Math.max(0, eggs),
        inventoryDuckFeathers: prev.inventoryDuckFeathers + Math.max(0, feathers),
        stats: {
          ...prev.stats,
          cropsHarvestedTotal: prev.stats.cropsHarvestedTotal + Math.max(0, eggs),
        },
      }));
    },
    [setState]
  );

  // ===== Buy =====
  const handleBuySeed = useCallback(
    (crop: CropType, count: number) => {
      const def = CROP_DEFINITIONS[crop];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;

      const cost = def.seedCost * qty;
      if (!Number.isFinite(cost) || cost < 0) return;
      if (stateRef.current.stats.coins < cost) {
        addNotice(tr('❌ เหรียญทองไม่เพียงพอ', '❌ Not enough coins'), '#ef5350');
        return;
      }
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, coins: Math.max(0, prev.stats.coins - cost) },
        inventorySeeds: {
          ...prev.inventorySeeds,
          [crop]: (prev.inventorySeeds[crop] || 0) + qty,
        },
      }));
      addNotice(
        tr(`ซื้อ ${getCropSeedName(crop)} x${qty}`, `Bought ${getCropSeedName(crop)} x${qty}`),
        '#a5d6a7'
      );
    },
    [setState, addNotice]
  );

  const handleBuySapling = useCallback(
    (type: TreeType, count: number) => {
      const def = TREE_DEFINITIONS[type];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;

      const cost = def.saplingCost * qty;
      if (!Number.isFinite(cost) || cost < 0) return;
      if (stateRef.current.stats.coins < cost) {
        addNotice(
          tr('❌ เหรียญทองไม่เพียงพอสำหรับซื้อต้นกล้า', '❌ Not enough coins for saplings'),
          '#ef5350'
        );
        return;
      }
      setState((prev) => ({
        ...prev,
        stats: { ...prev.stats, coins: Math.max(0, prev.stats.coins - cost) },
        inventorySaplings: {
          ...prev.inventorySaplings,
          [type]: (prev.inventorySaplings[type] || 0) + qty,
        },
      }));
      addNotice(
        tr(
          `ซื้อ ${getTreeSaplingName(type)} x${qty}`,
          `Bought ${getTreeSaplingName(type)} x${qty}`
        ),
        '#a5d6a7'
      );
    },
    [setState, addNotice]
  );

  const addSapling = useCallback(
    (type: TreeType, qty: number = 1) => {
      setState((prev) => ({
        ...prev,
        inventorySaplings: {
          ...prev.inventorySaplings,
          [type]: (prev.inventorySaplings[type] || 0) + qty,
        },
      }));
      addNotice(
        tr(
          `🎁 ได้รับ ${getTreeSaplingName(type)} +${qty} ต้น!`,
          `🎁 Received ${getTreeSaplingName(type)} +${qty} saplings!`
        ),
        '#81c784'
      );
    },
    [setState, addNotice]
  );

  // ===== Sell =====
  const handleSellCrop = useCallback(
    (crop: CropType, count: number) => {
      const def = CROP_DEFINITIONS[crop];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;
      if ((stateRef.current.inventoryCrops[crop] || 0) < qty) return;

      const revenue = def.sellPrice * qty;

      setState((prev) => ({
        ...prev,
        inventoryCrops: {
          ...prev.inventoryCrops,
          [crop]: Math.max(0, (prev.inventoryCrops[crop] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย ${getCropName(crop)} x${qty} ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold ${getCropName(crop)} x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const handleSellTreeFruit = useCallback(
    (type: TreeType, count: number) => {
      const def = TREE_DEFINITIONS[type];
      if (!def || !def.isFruitTree || def.fruitSellPrice == null || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;

      if ((stateRef.current.inventoryTreeFruits[type] || 0) < qty) return;

      const revenue = def.fruitSellPrice * qty;

      setState((prev) => ({
        ...prev,
        inventoryTreeFruits: {
          ...prev.inventoryTreeFruits,
          [type]: Math.max(0, (prev.inventoryTreeFruits[type] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย${getTreeFruitName(type)} x${qty} ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold ${getTreeFruitName(type)} x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const handleSellWood = useCallback(
    (count: number) => {
      if (!Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0 || stateRef.current.inventoryWood < qty) return;

      const revenue = WOOD_SELL_PRICE * qty;

      setState((prev) => ({
        ...prev,
        inventoryWood: Math.max(0, prev.inventoryWood - qty),
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `🪵 ขายไม้ซุง x${qty} ท่อน ได้ +${revenue} เหรียญทอง!`,
          `🪵 Sold Timber Logs x${qty} for +${revenue} Coins!`
        ),
        '#d7ccc8'
      );
    },
    [setState, addNotice]
  );

  const handleSellDuckEgg = useCallback(
    (count: number) => {
      if (!Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0 || stateRef.current.inventoryDuckEggs < qty) return;
      const revenue = DUCK_EGG_SELL_PRICE * qty;

      setState((prev) => ({
        ...prev,
        inventoryDuckEggs: Math.max(0, prev.inventoryDuckEggs - qty),
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `🥚 ขายไข่เป็ดสด x${qty} ฟอง ได้ +${revenue} เหรียญทอง!`,
          `🥚 Sold Fresh Duck Eggs x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const handleSellDuckFeather = useCallback(
    (count: number) => {
      if (!Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0 || stateRef.current.inventoryDuckFeathers < qty) return;
      const revenue = DUCK_FEATHER_SELL_PRICE * qty;

      setState((prev) => ({
        ...prev,
        inventoryDuckFeathers: Math.max(0, prev.inventoryDuckFeathers - qty),
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `🪶 ขายขนเป็ดนุ่ม x${qty} เส้น ได้ +${revenue} เหรียญทอง!`,
          `🪶 Sold Duck Feathers x${qty} for +${revenue} Coins!`
        ),
        '#fef08a'
      );
    },
    [setState, addNotice]
  );

  const handleCraftFeatherProduct = useCallback(
    (productType: ProcessedFeatherType): boolean => {
      const def = PROCESSED_FEATHER_DEFS[productType];
      if (!def) return false;

      const available = stateRef.current.inventoryDuckFeathers;
      if (available < def.feathersRequired) {
        const missing = def.feathersRequired - available;
        addNotice(
          tr(
            `❌ ขนเป็ดไม่พอแปรรูป! ต้องใช้อีก ${missing} เส้น`,
            `❌ Need ${missing} more Duck Feather(s) to craft!`
          ),
          '#ef5350'
        );
        return false;
      }

      setState((prev) => ({
        ...prev,
        inventoryDuckFeathers: prev.inventoryDuckFeathers - def.feathersRequired,
        inventoryProcessedFeathers: {
          ...prev.inventoryProcessedFeathers,
          [productType]: (prev.inventoryProcessedFeathers[productType] || 0) + 1,
        },
      }));

      addXP(def.xpReward);
      farmAudio.playBuildSound();
      addNotice(
        tr(
          `🪡 แปรรูป "${getProcessedFeatherName(productType)}" สำเร็จ! (+${def.xpReward} XP)`,
          `🪡 Crafted "${getProcessedFeatherName(productType)}"! (+${def.xpReward} XP)`
        ),
        '#a7f3d0'
      );
      return true;
    },
    [setState, addXP, addNotice]
  );

  const handleSellProcessedFeather = useCallback(
    (productType: ProcessedFeatherType, count: number) => {
      const def = PROCESSED_FEATHER_DEFS[productType];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;
      const owned = stateRef.current.inventoryProcessedFeathers[productType] || 0;
      if (owned < qty) return;

      const revenue = def.sellPrice * qty;

      setState((prev) => ({
        ...prev,
        inventoryProcessedFeathers: {
          ...prev.inventoryProcessedFeathers,
          [productType]: Math.max(0, (prev.inventoryProcessedFeathers[productType] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย "${getProcessedFeatherName(productType)}" x${qty} ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold "${getProcessedFeatherName(productType)}" x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const handleSellAllCrops = useCallback(() => {
    const snap = stateRef.current;
    let totalRevenue = 0;

    (Object.keys(snap.inventoryCrops) as CropType[]).forEach((crop) => {
      const count = snap.inventoryCrops[crop] || 0;
      if (count > 0) totalRevenue += CROP_DEFINITIONS[crop].sellPrice * count;
    });

    (Object.keys(snap.inventoryTreeFruits) as TreeType[]).forEach((t) => {
      const count = snap.inventoryTreeFruits[t] || 0;
      const def = TREE_DEFINITIONS[t];
      if (count > 0 && def.isFruitTree && def.fruitSellPrice != null) {
        totalRevenue += def.fruitSellPrice * count;
      }
    });

    if (snap.inventoryDuckEggs > 0) {
      totalRevenue += snap.inventoryDuckEggs * DUCK_EGG_SELL_PRICE;
    }

    (Object.keys(PROCESSED_FEATHER_DEFS) as ProcessedFeatherType[]).forEach((pType) => {
      const count = snap.inventoryProcessedFeathers[pType] || 0;
      if (count > 0) {
        totalRevenue += count * PROCESSED_FEATHER_DEFS[pType].sellPrice;
      }
    });

    (Object.keys(BREW_DRINK_DEFS) as BrewDrinkType[]).forEach((dType) => {
      const count = snap.inventoryDrinks[dType] || 0;
      if (count > 0) {
        totalRevenue += count * BREW_DRINK_DEFS[dType].sellPrice;
      }
    });

    (Object.keys(BAKED_GOOD_DEFS) as BakedGoodType[]).forEach((bType) => {
      const count = snap.inventoryBakedGoods[bType] || 0;
      if (count > 0) {
        const def = BAKED_GOOD_DEFS[bType];
        const stars = getOvenMasteryStars(snap.ovenMasterySeconds[def.machine] || 0);
        const unitPrice = stars >= 1 ? Math.round(def.sellPrice * 1.1) : def.sellPrice;
        totalRevenue += count * unitPrice;
      }
    });

    (Object.keys(ANIMAL_FEED_DEFS) as AnimalFeedType[]).forEach((fType) => {
      const count = snap.inventoryAnimalFeeds[fType] || 0;
      if (count > 0) {
        totalRevenue += count * ANIMAL_FEED_DEFS[fType].sellPrice;
      }
    });

    if (totalRevenue === 0) {
      addNotice(
        tr(
          'ไม่มีผลผลิต ไข่เป็ด เครื่องดื่ม เบเกอรี่ อาหารสัตว์ หรือสินค้าแปรรูปในคลังสำหรับขาย',
          'No harvested crops, duck eggs, drinks, bakery goods, animal feed, or crafted items to sell'
        ),
        '#ffb74d'
      );
      return;
    }

    setState((prev) => ({
      ...prev,
      inventoryCrops: { ...INITIAL_CROPS },
      inventoryTreeFruits: { ...INITIAL_TREE_FRUITS },
      inventoryDuckEggs: 0,
      inventoryProcessedFeathers: { ...INITIAL_PROCESSED_FEATHERS },
      inventoryDrinks: { ...INITIAL_DRINKS },
      inventoryBakedGoods: { ...INITIAL_BAKED_GOODS },
      inventoryAnimalFeeds: { ...INITIAL_ANIMAL_FEEDS },
      stats: {
        ...prev.stats,
        coins: prev.stats.coins + totalRevenue,
        coinsEarnedTotal: prev.stats.coinsEarnedTotal + totalRevenue,
      },
    }));

    farmAudio.playCoinSound();
    addNotice(
      tr(
        `🎉 ขายผลผลิต เบเกอรี่ เครื่องดื่ม และสินค้าแปรรูปทั้งหมดสำเร็จ! ได้รับ +${totalRevenue} เหรียญทอง`,
        `🎉 Sold all produce, bakery goods, drinks & crafted items for +${totalRevenue} Coins!`
      ),
      '#ffd54f'
    );
  }, [setState, addNotice]);

  // ===== Brewery & Distillery =====
  const handleStartBrewing = useCallback(
    (houseId: string, drinkType: BrewDrinkType): boolean => {
      const def = BREW_DRINK_DEFS[drinkType];
      if (!def || !houseId) return false;

      const snap = stateRef.current;
      const houseJobsCount = snap.brewingJobs.filter((j) => j.houseId === houseId).length;
      if (houseJobsCount >= BREWERY_SLOTS_PER_BUILDING) {
        addNotice(
          tr(
            `⏳ ถังหมักและกลั่นของโรงงานนี้เต็มแล้ว (${BREWERY_SLOTS_PER_BUILDING}/${BREWERY_SLOTS_PER_BUILDING})! กรุณารอหรือเก็บขวดที่เสร็จก่อน`,
            `⏳ All ${BREWERY_SLOTS_PER_BUILDING} brewing vats in this Brewery are busy!`
          ),
          '#fbbf24'
        );
        return false;
      }

      if (def.cropsRequired) {
        for (const [c, needed] of Object.entries(def.cropsRequired)) {
          const owned = snap.inventoryCrops[c as CropType] || 0;
          if (needed && owned < needed) {
            const missing = needed - owned;
            addNotice(
              tr(
                `❌ วัตถุดิบไม่พอ! ต้องใช้ ${getCropName(c as CropType)} อีก ${missing} ชิ้น`,
                `❌ Missing ${missing}x ${getCropName(c as CropType)}!`
              ),
              '#ef5350'
            );
            return false;
          }
        }
      }

      if (def.fruitsRequired) {
        for (const [f, needed] of Object.entries(def.fruitsRequired)) {
          const owned = snap.inventoryTreeFruits[f as TreeType] || 0;
          if (needed && owned < needed) {
            const missing = needed - owned;
            addNotice(
              tr(
                `❌ ผลไม้ไม่พอ! ต้องใช้ ${getTreeFruitName(f as TreeType)} อีก ${missing} ชิ้น`,
                `❌ Missing ${missing}x ${getTreeFruitName(f as TreeType)}!`
              ),
              '#ef5350'
            );
            return false;
          }
        }
      }

      const now = Date.now();
      const newJob: BrewingJob = {
        id: `brew_${now}_${Math.random().toString(36).slice(2, 7)}`,
        houseId,
        drinkType,
        startedAt: now,
        finishAt: now + def.brewTimeSeconds * 1000,
      };

      setState((prev) => {
        const nextCrops = { ...prev.inventoryCrops };
        if (def.cropsRequired) {
          for (const [c, needed] of Object.entries(def.cropsRequired)) {
            if (needed) {
              nextCrops[c as CropType] = Math.max(0, (nextCrops[c as CropType] || 0) - needed);
            }
          }
        }
        const nextFruits = { ...prev.inventoryTreeFruits };
        if (def.fruitsRequired) {
          for (const [f, needed] of Object.entries(def.fruitsRequired)) {
            if (needed) {
              nextFruits[f as TreeType] = Math.max(0, (nextFruits[f as TreeType] || 0) - needed);
            }
          }
        }
        return {
          ...prev,
          inventoryCrops: nextCrops,
          inventoryTreeFruits: nextFruits,
          brewingJobs: [...prev.brewingJobs, newJob],
        };
      });

      farmAudio.playWaterSound();
      addNotice(
        tr(
          `${def.iconEmoji} เริ่มหมักและกลั่น "${getBrewDrinkName(drinkType)}" แล้ว! (ใช้เวลา ${formatBrewDuration(def.brewTimeSeconds)})`,
          `${def.iconEmoji} Started brewing "${getBrewDrinkName(drinkType)}"! (${formatBrewDuration(def.brewTimeSeconds)})`
        ),
        '#fbbf24'
      );
      return true;
    },
    [setState, addNotice]
  );

  const handleCollectBrew = useCallback(
    (jobId: string): boolean => {
      const snap = stateRef.current;
      const job = snap.brewingJobs.find((j) => j.id === jobId);
      if (!job) return false;
      if (Date.now() < job.finishAt) {
        addNotice(
          tr(
            '⏳ เครื่องดื่มยังบ่ม/กลั่นไม่ครบเวลา!',
            '⏳ This beverage is still fermenting/distilling!'
          ),
          '#fbbf24'
        );
        return false;
      }

      const def = BREW_DRINK_DEFS[job.drinkType];
      setState((prev) => ({
        ...prev,
        brewingJobs: prev.brewingJobs.filter((j) => j.id !== jobId),
        inventoryDrinks: {
          ...prev.inventoryDrinks,
          [job.drinkType]: (prev.inventoryDrinks[job.drinkType] || 0) + 1,
        },
      }));

      addXP(def.xpReward);
      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `${def.iconEmoji} บรรจุขวด "${getBrewDrinkName(job.drinkType)}" สำเร็จ +1 ขวด! (+${def.xpReward} XP)`,
          `${def.iconEmoji} Bottled "${getBrewDrinkName(job.drinkType)}" +1! (+${def.xpReward} XP)`
        ),
        '#fde68a'
      );
      return true;
    },
    [setState, addXP, addNotice]
  );

  const handleCollectAllReadyBrews = useCallback(
    (houseId?: string): number => {
      const now = Date.now();
      const snap = stateRef.current;
      const readyJobs = snap.brewingJobs.filter(
        (j) => now >= j.finishAt && (!houseId || j.houseId === houseId)
      );
      if (readyJobs.length === 0) return 0;

      const readyIds = new Set(readyJobs.map((j) => j.id));
      let totalXp = 0;

      setState((prev) => {
        const nextDrinks = { ...prev.inventoryDrinks };
        for (const job of readyJobs) {
          nextDrinks[job.drinkType] = (nextDrinks[job.drinkType] || 0) + 1;
        }
        return {
          ...prev,
          brewingJobs: prev.brewingJobs.filter((j) => !readyIds.has(j.id)),
          inventoryDrinks: nextDrinks,
        };
      });

      for (const job of readyJobs) {
        totalXp += BREW_DRINK_DEFS[job.drinkType]?.xpReward ?? 0;
      }
      if (totalXp > 0) addXP(totalXp);
      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `🍾 เก็บเครื่องดื่มที่กลั่นเสร็จแล้วรวม ${readyJobs.length} ขวดเข้าคลัง! (+${totalXp} XP)`,
          `🍾 Collected ${readyJobs.length} finished bottle(s) into storage! (+${totalXp} XP)`
        ),
        '#fde68a'
      );
      return readyJobs.length;
    },
    [setState, addXP, addNotice]
  );

  const handleSellDrink = useCallback(
    (drinkType: BrewDrinkType, count: number) => {
      const def = BREW_DRINK_DEFS[drinkType];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;
      const owned = stateRef.current.inventoryDrinks[drinkType] || 0;
      if (owned < qty) return;

      const revenue = def.sellPrice * qty;
      setState((prev) => ({
        ...prev,
        inventoryDrinks: {
          ...prev.inventoryDrinks,
          [drinkType]: Math.max(0, (prev.inventoryDrinks[drinkType] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย "${getBrewDrinkName(drinkType)}" x${qty} ขวด ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold "${getBrewDrinkName(drinkType)}" x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const pruneDeletedHouseBrews = useCallback(
    (deletedHouseId: string) => {
      setState((prev) => {
        const hasBrew = prev.brewingJobs.some((j) => j.houseId === deletedHouseId);
        const hasBake = prev.bakingJobs.some((j) => j.houseId === deletedHouseId);
        const hasFeed = prev.feedMillJobs.some((j) => j.houseId === deletedHouseId);
        if (!hasBrew && !hasBake && !hasFeed) return prev;
        return {
          ...prev,
          brewingJobs: hasBrew
            ? prev.brewingJobs.filter((j) => j.houseId !== deletedHouseId)
            : prev.brewingJobs,
          bakingJobs: hasBake
            ? prev.bakingJobs.filter((j) => j.houseId !== deletedHouseId)
            : prev.bakingJobs,
          feedMillJobs: hasFeed
            ? prev.feedMillJobs.filter((j) => j.houseId !== deletedHouseId)
            : prev.feedMillJobs,
        };
      });
    },
    [setState]
  );

  // ===== Bakery & Pie Oven =====
  const handleStartBaking = useCallback(
    (houseId: string, machine: OvenMachineType, itemType: BakedGoodType): boolean => {
      const def = BAKED_GOOD_DEFS[itemType];
      if (!def || def.machine !== machine || !houseId) return false;

      const snap = stateRef.current;
      const now = Date.now();
      const activeHouseJobs = snap.bakingJobs.filter(
        (j) => j.houseId === houseId && now < j.finishAt
      );
      if (activeHouseJobs.length >= OVEN_SLOTS_PER_BUILDING) {
        addNotice(
          tr(
            `⏳ คิวเตาอบนี้เต็มแล้ว (${OVEN_SLOTS_PER_BUILDING}/${OVEN_SLOTS_PER_BUILDING} ช่อง)!`,
            `⏳ Oven queue is full (${OVEN_SLOTS_PER_BUILDING}/${OVEN_SLOTS_PER_BUILDING})!`
          ),
          '#fbbf24'
        );
        return false;
      }

      const basketCount = snap.bakingJobs.filter(
        (j) => j.houseId === houseId && now >= j.finishAt
      ).length;
      if (basketCount >= 8) {
        addNotice(
          tr(
            '🧺 ตะกร้าปลายรางเลื่อนเต็มแล้ว! กรุณาหยิบขนมปัง/พายออกจากตะกร้าก่อน',
            '🧺 The conveyor basket is full! Collect baked items first'
          ),
          '#fbbf24'
        );
        return false;
      }

      for (const [c, needed] of Object.entries(def.cropsRequired)) {
        const owned = snap.inventoryCrops[c as CropType] || 0;
        if (needed && owned < needed) {
          const missing = needed - owned;
          addNotice(
            tr(
              `❌ วัตถุดิบไม่พอ! ต้องใช้ ${getCropName(c as CropType)} อีก ${missing} ชิ้น`,
              `❌ Missing ${missing}x ${getCropName(c as CropType)}!`
            ),
            '#ef5350'
          );
          return false;
        }
      }

      if (def.fruitsRequired) {
        for (const [f, needed] of Object.entries(def.fruitsRequired)) {
          const owned = snap.inventoryTreeFruits[f as TreeType] || 0;
          if (needed && owned < needed) {
            const missing = needed - owned;
            addNotice(
              tr(
                `❌ วัตถุดิบไม่พอ! ต้องใช้ ${getTreeFruitName(f as TreeType)} อีก ${missing} ผล`,
                `❌ Missing ${missing}x ${getTreeFruitName(f as TreeType)}!`
              ),
              '#ef5350'
            );
            return false;
          }
        }
      }

      const stars = getOvenMasteryStars(snap.ovenMasterySeconds[machine] || 0);
      const durationSeconds = stars >= 3 ? def.star3TimeSeconds : def.normalTimeSeconds;

      const newJob: BakingJob = {
        id: `bake_${now}_${Math.random().toString(36).slice(2, 7)}`,
        houseId,
        machine,
        itemType,
        durationSeconds,
        startedAt: now,
        finishAt: now + durationSeconds * 1000,
      };

      setState((prev) => {
        const nextCrops = { ...prev.inventoryCrops };
        for (const [c, needed] of Object.entries(def.cropsRequired)) {
          if (needed) {
            nextCrops[c as CropType] = Math.max(0, (nextCrops[c as CropType] || 0) - needed);
          }
        }
        const nextFruits = { ...prev.inventoryTreeFruits };
        if (def.fruitsRequired) {
          for (const [f, needed] of Object.entries(def.fruitsRequired)) {
            if (needed) {
              nextFruits[f as TreeType] = Math.max(0, (nextFruits[f as TreeType] || 0) - needed);
            }
          }
        }
        return {
          ...prev,
          inventoryCrops: nextCrops,
          inventoryTreeFruits: nextFruits,
          bakingJobs: [...prev.bakingJobs, newJob],
        };
      });

      farmAudio.playBuildSound();
      addNotice(
        tr(
          `${def.iconEmoji} นำ "${getBakedGoodName(itemType)}" เข้าเตาอบแล้ว! (${
            stars >= 3 ? '★★★ เร็วพิเศษ ' : ''
          }${formatBrewDuration(durationSeconds)} = ${durationSeconds.toLocaleString()} วินาที)`,
          `${def.iconEmoji} Baking "${getBakedGoodName(itemType)}"! (${
            stars >= 3 ? '★★★ Mastery ' : ''
          }${formatBrewDuration(durationSeconds)} = ${durationSeconds.toLocaleString()}s)`
        ),
        '#fbbf24'
      );
      return true;
    },
    [setState, addNotice]
  );

  const handleRushBakingJob = useCallback(
    (jobId: string): boolean => {
      const snap = stateRef.current;
      const job = snap.bakingJobs.find((j) => j.id === jobId);
      if (!job || Date.now() >= job.finishAt) return false;

      if (snap.stats.coins < OVEN_RUSH_COST_COINS) {
        addNotice(
          tr(
            `❌ เหรียญไม่พอเร่งเตาไฟ! ต้องใช้ ${OVEN_RUSH_COST_COINS} เหรียญทอง`,
            `❌ Need ${OVEN_RUSH_COST_COINS} Coins to rush baking!`
          ),
          '#ef5350'
        );
        return false;
      }

      const def = BAKED_GOOD_DEFS[job.itemType];
      const finishedNow = Date.now() - 20;

      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          coins: prev.stats.coins - OVEN_RUSH_COST_COINS,
        },
        bakingJobs: prev.bakingJobs.map((j) =>
          j.id === jobId ? { ...j, finishAt: finishedNow } : j
        ),
      }));

      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `⚡ อบ "${getBakedGoodName(job.itemType)}" สุกเหลืองหอมแล้ว! ${def.iconEmoji} กำลังเลื่อนตามรางไปลงตะกร้า!`,
          `⚡ "${getBakedGoodName(job.itemType)}" finished baking and is sliding along the conveyor into the basket!`
        ),
        '#fde68a'
      );
      return true;
    },
    [setState, addNotice]
  );

  const handleCollectBakedJob = useCallback(
    (jobId: string): boolean => {
      const snap = stateRef.current;
      const job = snap.bakingJobs.find((j) => j.id === jobId);
      if (!job) return false;
      if (Date.now() < job.finishAt) {
        addNotice(
          tr('⏳ ขนมปัง/พายกำลังอบอยู่ในเตา ยังไม่เลื่อนออกมาที่ตะกร้า!', '⏳ Still baking in the oven!'),
          '#fbbf24'
        );
        return false;
      }

      const def = BAKED_GOOD_DEFS[job.itemType];
      const prevStars = getOvenMasteryStars(snap.ovenMasterySeconds[job.machine] || 0);
      const nextMasterySec =
        (snap.ovenMasterySeconds[job.machine] || 0) + Math.max(60, job.durationSeconds);
      const newStars = getOvenMasteryStars(nextMasterySec);
      const earnedXp =
        prevStars >= 2 ? Math.round(def.xpReward * 1.15) : def.xpReward;

      setState((prev) => ({
        ...prev,
        bakingJobs: prev.bakingJobs.filter((j) => j.id !== jobId),
        inventoryBakedGoods: {
          ...prev.inventoryBakedGoods,
          [job.itemType]: (prev.inventoryBakedGoods[job.itemType] || 0) + 1,
        },
        ovenMasterySeconds: {
          ...prev.ovenMasterySeconds,
          [job.machine]: nextMasterySec,
        },
      }));

      addXP(earnedXp);
      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `🧺 หยิบ "${getBakedGoodName(job.itemType)}" จากตะกร้าเข้าคลัง +1 ชิ้น! (+${earnedXp} XP)`,
          `🧺 Picked up "${getBakedGoodName(job.itemType)}" from the basket +1! (+${earnedXp} XP)`
        ),
        '#fde68a'
      );

      if (newStars > prevStars) {
        farmAudio.playLevelUpSound();
        addNotice(
          tr(
            `⭐ เตาอบเลื่อนขั้นความชำนาญเป็น ${newStars} ดาวแล้ว! ${
              newStars === 3 ? 'ปลดล็อกความเร็วอบพิเศษระดับ 3 ดาว!' : ''
            }`,
            `⭐ Oven Mastery reached ${newStars} Star(s)! ${
              newStars === 3 ? 'Unlocked 3-Star fast baking speed!' : ''
            }`
          ),
          '#ffd54f'
        );
      }
      return true;
    },
    [setState, addXP, addNotice]
  );

  const handleCollectOvenBasket = useCallback(
    (houseId?: string): number => {
      const now = Date.now();
      const snap = stateRef.current;
      const readyJobs = snap.bakingJobs.filter(
        (j) => now >= j.finishAt && (!houseId || j.houseId === houseId)
      );
      if (readyJobs.length === 0) return 0;

      const readyIds = new Set(readyJobs.map((j) => j.id));
      let totalXp = 0;

      const addedMastery: Record<OvenMachineType, number> = { bakery: 0, pie_oven: 0 };
      for (const job of readyJobs) {
        const def = BAKED_GOOD_DEFS[job.itemType];
        const stars = getOvenMasteryStars(snap.ovenMasterySeconds[job.machine] || 0);
        totalXp += stars >= 2 ? Math.round(def.xpReward * 1.15) : def.xpReward;
        addedMastery[job.machine] += Math.max(60, job.durationSeconds);
      }

      setState((prev) => {
        const nextBaked = { ...prev.inventoryBakedGoods };
        for (const job of readyJobs) {
          nextBaked[job.itemType] = (nextBaked[job.itemType] || 0) + 1;
        }
        return {
          ...prev,
          bakingJobs: prev.bakingJobs.filter((j) => !readyIds.has(j.id)),
          inventoryBakedGoods: nextBaked,
          ovenMasterySeconds: {
            bakery: (prev.ovenMasterySeconds.bakery || 0) + addedMastery.bakery,
            pie_oven: (prev.ovenMasterySeconds.pie_oven || 0) + addedMastery.pie_oven,
          },
        };
      });

      if (totalXp > 0) addXP(totalXp);
      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `🧺 หยิบเบเกอรี่/พายร้อนๆ จากตะกร้าปลายรางเลื่อนรวม ${readyJobs.length} ชิ้น! (+${totalXp} XP)`,
          `🧺 Collected ${readyJobs.length} warm item(s) from the conveyor basket! (+${totalXp} XP)`
        ),
        '#fde68a'
      );
      return readyJobs.length;
    },
    [setState, addXP, addNotice]
  );

  const handleBoostOvenMastery = useCallback(
    (machine: OvenMachineType): boolean => {
      const snap = stateRef.current;
      const curSec = snap.ovenMasterySeconds[machine] || 0;
      const curStars = getOvenMasteryStars(curSec);
      if (curStars >= 3) {
        addNotice(
          tr('⭐ เตาอบนี้เชี่ยวชาญสูงสุดระดับ 3 ดาวแล้ว!', '⭐ Oven is already at max 3-Star Mastery!'),
          '#ffd54f'
        );
        return false;
      }
      if (snap.stats.coins < OVEN_MASTERY_BOOST_COST_COINS) {
        addNotice(
          tr(
            `❌ เหรียญไม่พอฝึกความชำนาญเตา! ต้องใช้ ${OVEN_MASTERY_BOOST_COST_COINS} เหรียญทอง`,
            `❌ Need ${OVEN_MASTERY_BOOST_COST_COINS} Coins to upgrade Oven Mastery!`
          ),
          '#ef5350'
        );
        return false;
      }

      const nextThreshold: number =
        curStars === 0
          ? OVEN_MASTERY_STAR_THRESHOLDS[0]
          : curStars === 1
            ? OVEN_MASTERY_STAR_THRESHOLDS[1]
            : OVEN_MASTERY_STAR_THRESHOLDS[2];
      const nextStars = (curStars + 1) as 1 | 2 | 3;

      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          coins: prev.stats.coins - OVEN_MASTERY_BOOST_COST_COINS,
        },
        ovenMasterySeconds: {
          ...prev.ovenMasterySeconds,
          [machine]: Math.max(curSec, nextThreshold),
        },
      }));

      farmAudio.playLevelUpSound();
      addNotice(
        tr(
          `⭐ อัปเกรดความชำนาญเตาอบเป็น ${nextStars} ดาวสำเร็จ! ${
            nextStars === 3
              ? 'ปลดล็อกเวลาอบเร็วพิเศษระดับ 3 ดาวทุกเมนู!'
              : nextStars === 2
                ? 'โบนัสรับ XP +15% ทุกครั้งที่เก็บจากตะกร้า!'
                : 'โบนัสราคาขายเบเกอรี่/พาย +10%!'
          }`,
          `⭐ Upgraded Oven Mastery to ${nextStars} Star(s)! ${
            nextStars === 3 ? 'All recipes now use 3-Star fast bake times!' : ''
          }`
        ),
        '#ffd54f'
      );
      return true;
    },
    [setState, addNotice]
  );

  const handleSellBakedGood = useCallback(
    (itemType: BakedGoodType, count: number) => {
      const def = BAKED_GOOD_DEFS[itemType];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;
      const snap = stateRef.current;
      const owned = snap.inventoryBakedGoods[itemType] || 0;
      if (owned < qty) return;

      const stars = getOvenMasteryStars(snap.ovenMasterySeconds[def.machine] || 0);
      const unitPrice = stars >= 1 ? Math.round(def.sellPrice * 1.1) : def.sellPrice;
      const revenue = unitPrice * qty;

      setState((prev) => ({
        ...prev,
        inventoryBakedGoods: {
          ...prev.inventoryBakedGoods,
          [itemType]: Math.max(0, (prev.inventoryBakedGoods[itemType] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย "${getBakedGoodName(itemType)}" x${qty} ชิ้น ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold "${getBakedGoodName(itemType)}" x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  // ===== Cooking Dish =====
  const handleCookDish = useCallback(
    (
      dishName: string,
      ingredients: {
        crops?: Partial<Record<CropType, number>>;
        fruits?: Partial<Record<TreeType, number>>;
        duckEggs?: number;
      },
      staminaGain: number,
      xpGain: number
    ): boolean => {
      const snap = stateRef.current;
      if (ingredients.duckEggs && snap.inventoryDuckEggs < ingredients.duckEggs) {
        const missing = ingredients.duckEggs - snap.inventoryDuckEggs;
        addNotice(
          tr(
            `วัตถุดิบไม่พอ! ขาดไข่เป็ดสดอีก ${missing} ฟอง`,
            `Missing ${missing}x Fresh Duck Egg(s)!`
          ),
          '#ef5350'
        );
        return false;
      }
      if (ingredients.crops) {
        for (const [c, needed] of Object.entries(ingredients.crops)) {
          if (needed && (snap.inventoryCrops[c as CropType] || 0) < needed) {
            const missing = needed - (snap.inventoryCrops[c as CropType] || 0);
            addNotice(
              tr(
                `วัตถุดิบไม่พอ! ขาด ${getCropName(c as CropType)} อีก ${missing} ชิ้น`,
                `Missing ${missing}x ${getCropName(c as CropType)}!`
              ),
              '#ef5350'
            );
            return false;
          }
        }
      }
      if (ingredients.fruits) {
        for (const [f, needed] of Object.entries(ingredients.fruits)) {
          if (needed && (snap.inventoryTreeFruits[f as TreeType] || 0) < needed) {
            const missing = needed - (snap.inventoryTreeFruits[f as TreeType] || 0);
            addNotice(
              tr(
                `วัตถุดิบไม่พอ! ขาด ${getTreeName(f as TreeType)} อีก ${missing} ชิ้น`,
                `Missing ${missing}x ${getTreeFruitName(f as TreeType)}!`
              ),
              '#ef5350'
            );
            return false;
          }
        }
      }

      setState((prev) => {
        const nextCrops = { ...prev.inventoryCrops };
        if (ingredients.crops) {
          for (const [c, needed] of Object.entries(ingredients.crops)) {
            if (needed) {
              nextCrops[c as CropType] = Math.max(0, (nextCrops[c as CropType] || 0) - needed);
            }
          }
        }
        const nextFruits = { ...prev.inventoryTreeFruits };
        if (ingredients.fruits) {
          for (const [f, needed] of Object.entries(ingredients.fruits)) {
            if (needed) {
              nextFruits[f as TreeType] = Math.max(0, (nextFruits[f as TreeType] || 0) - needed);
            }
          }
        }
        const nextDuckEggs = ingredients.duckEggs
          ? Math.max(0, prev.inventoryDuckEggs - ingredients.duckEggs)
          : prev.inventoryDuckEggs;
        const newStamina = Math.min(prev.stats.maxStamina, prev.stats.stamina + staminaGain);
        return {
          ...prev,
          inventoryCrops: nextCrops,
          inventoryTreeFruits: nextFruits,
          inventoryDuckEggs: nextDuckEggs,
          stats: {
            ...prev.stats,
            stamina: newStamina,
          },
        };
      });

      addXP(xpGain);
      farmAudio.playHarvestSound();
      addNotice(
        tr(
          `🍲 ปรุงเมนู "${dishName}" ร้อนๆ สำเร็จ! ฟื้นฟูพลังงาน +${staminaGain} (+${xpGain} XP)`,
          `🍲 Cooked "${dishName}"! Restored +${staminaGain} Stamina (+${xpGain} XP)`
        ),
        '#81c784'
      );
      return true;
    },
    [setState, addXP, addNotice]
  );

  // ===== Animal Feed Making Machine =====
  const finalizeReadyFeedJobs = useCallback(
    (readyJobs: FeedMillJob[]) => {
      if (readyJobs.length === 0) return;
      const now = Date.now();
      const readyIds = new Set(readyJobs.map((j) => j.id));
      let totalXp = 0;

      for (const job of readyJobs) {
        const def = ANIMAL_FEED_DEFS[job.feedType];
        if (def) totalXp += def.xpReward;
      }

      setState((prev) => {
        const nextFeeds = { ...prev.inventoryAnimalFeeds };
        for (const job of readyJobs) {
          nextFeeds[job.feedType] = (nextFeeds[job.feedType] || 0) + 1;
        }
        return {
          ...prev,
          feedMillJobs: prev.feedMillJobs.filter((j) => !readyIds.has(j.id)),
          inventoryAnimalFeeds: nextFeeds,
        };
      });

      if (totalXp > 0) addXP(totalXp);
      farmAudio.playHarvestSound();

      const newEvents: FeedAutoCollectEvent[] = readyJobs.map((job, idx) => ({
        id: `float_${job.id}_${now}_${idx}`,
        houseId: job.houseId,
        feedType: job.feedType,
        timestamp: now,
      }));
      setFeedAutoCollectEvents((prev) => [
        ...prev.filter((ev) => now - ev.timestamp < 8000),
        ...newEvents,
      ]);

      if (readyJobs.length === 1) {
        const job = readyJobs[0];
        const def = ANIMAL_FEED_DEFS[job.feedType];
        addNotice(
          tr(
            `${def.iconEmoji} ผลิต "${getAnimalFeedName(job.feedType)}" เสร็จแล้ว! กระสอบอาหารลอยเข้าคลังอัตโนมัติ +1 ถุง (+${def.xpReward} XP)`,
            `${def.iconEmoji} "${getAnimalFeedName(job.feedType)}" finished! Bag floated into storage automatically +1 (+${def.xpReward} XP)`
          ),
          '#fde047'
        );
      } else {
        addNotice(
          tr(
            `🌾 ผลิตอาหารสัตว์เสร็จ ${readyJobs.length} ถุง! ลอยเข้าคลังอัตโนมัติเรียบร้อย (+${totalXp} XP)`,
            `🌾 ${readyJobs.length} Animal Feed bags finished & floated into storage automatically! (+${totalXp} XP)`
          ),
          '#fde047'
        );
      }
    },
    [setState, addXP, addNotice]
  );

  useEffect(() => {
    const tick = () => {
      const snap = stateRef.current;
      if (snap.feedMillJobs.length === 0) return;
      const now = Date.now();
      const due = snap.feedMillJobs.filter((j) => now >= j.finishAt);
      if (due.length > 0) {
        finalizeReadyFeedJobs(due);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [finalizeReadyFeedJobs]);

  const handleStartFeedMill = useCallback(
    (houseId: string, feedType: AnimalFeedType): boolean => {
      const def = ANIMAL_FEED_DEFS[feedType];
      if (!def || !houseId) return false;

      const now = Date.now();
      const snap = stateRef.current;
      const activeForHouse = snap.feedMillJobs.filter(
        (j) => j.houseId === houseId && now < j.finishAt
      );
      if (activeForHouse.length >= FEED_MILL_SLOTS_PER_BUILDING) {
        addNotice(
          tr(
            `⚠️ เครื่องโม่หลังนี้กำลังเดินเครื่องเต็ม ${FEED_MILL_SLOTS_PER_BUILDING}/${FEED_MILL_SLOTS_PER_BUILDING} ช่องแล้ว!`,
            `⚠️ This Feed Mill is full (${FEED_MILL_SLOTS_PER_BUILDING}/${FEED_MILL_SLOTS_PER_BUILDING} slots)!`
          ),
          '#fbbf24'
        );
        return false;
      }

      for (const [c, needed] of Object.entries(def.cropsRequired)) {
        const owned = snap.inventoryCrops[c as CropType] || 0;
        if (needed && owned < needed) {
          const missing = needed - owned;
          addNotice(
            tr(
              `❌ วัตถุดิบไม่พอ! ต้องใช้ ${getCropName(c as CropType)} อีก ${missing} ชิ้น`,
              `❌ Missing ${missing}x ${getCropName(c as CropType)}!`
            ),
            '#ef5350'
          );
          return false;
        }
      }

      const durationSeconds = def.durationSeconds;
      const newJob: FeedMillJob = {
        id: `feed_${now}_${Math.random().toString(36).slice(2, 7)}`,
        houseId,
        feedType,
        durationSeconds,
        startedAt: now,
        finishAt: now + durationSeconds * 1000,
      };

      setState((prev) => {
        const nextCrops = { ...prev.inventoryCrops };
        for (const [c, needed] of Object.entries(def.cropsRequired)) {
          if (needed) {
            nextCrops[c as CropType] = Math.max(0, (nextCrops[c as CropType] || 0) - needed);
          }
        }
        return {
          ...prev,
          inventoryCrops: nextCrops,
          feedMillJobs: [...prev.feedMillJobs, newJob],
        };
      });

      farmAudio.playBuildSound();
      addNotice(
        tr(
          `${def.iconEmoji} เริ่มผลิต "${getAnimalFeedName(feedType)}" (${def.productionMinutes} นาที) — เมื่อเสร็จจะลอยเข้าคลังอัตโนมัติ!`,
          `${def.iconEmoji} Milling "${getAnimalFeedName(feedType)}" (${def.productionMinutes} min) — auto-floats to storage when ready!`
        ),
        '#a7f3d0'
      );
      return true;
    },
    [setState, addNotice]
  );

  const handleRushFeedMillJob = useCallback(
    (jobId: string): boolean => {
      const snap = stateRef.current;
      const job = snap.feedMillJobs.find((j) => j.id === jobId);
      if (!job) return false;

      if (Date.now() >= job.finishAt) {
        finalizeReadyFeedJobs([job]);
        return true;
      }

      if (snap.stats.coins < FEED_MILL_RUSH_COST_COINS) {
        addNotice(
          tr(
            `❌ เหรียญไม่พอเร่งเครื่องโม่! ต้องใช้ ${FEED_MILL_RUSH_COST_COINS} เหรียญทอง`,
            `❌ Need ${FEED_MILL_RUSH_COST_COINS} Coins to rush feed milling!`
          ),
          '#ef5350'
        );
        return false;
      }

      setState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          coins: Math.max(0, prev.stats.coins - FEED_MILL_RUSH_COST_COINS),
        },
      }));

      finalizeReadyFeedJobs([job]);
      return true;
    },
    [setState, addNotice, finalizeReadyFeedJobs]
  );

  const handleSellAnimalFeed = useCallback(
    (feedType: AnimalFeedType, count: number) => {
      const def = ANIMAL_FEED_DEFS[feedType];
      if (!def || !Number.isFinite(count)) return;
      const qty = Math.floor(count);
      if (qty <= 0) return;
      const owned = stateRef.current.inventoryAnimalFeeds[feedType] || 0;
      if (owned < qty) return;

      const revenue = def.sellPrice * qty;
      setState((prev) => ({
        ...prev,
        inventoryAnimalFeeds: {
          ...prev.inventoryAnimalFeeds,
          [feedType]: Math.max(0, (prev.inventoryAnimalFeeds[feedType] || 0) - qty),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + revenue,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + revenue,
        },
      }));

      farmAudio.playCoinSound();
      addNotice(
        tr(
          `💰 ขาย "${getAnimalFeedName(feedType)}" x${qty} ถุง ได้ +${revenue} เหรียญทอง!`,
          `💰 Sold "${getAnimalFeedName(feedType)}" x${qty} for +${revenue} Coins!`
        ),
        '#ffd54f'
      );
    },
    [setState, addNotice]
  );

  const handleUseAnimalFeed = useCallback(
    (feedType: AnimalFeedType): boolean => {
      const def = ANIMAL_FEED_DEFS[feedType];
      if (!def) return false;
      const owned = stateRef.current.inventoryAnimalFeeds[feedType] || 0;
      if (owned <= 0) return false;

      const bonusCoins = def.feedBonusCoins;
      const staminaGain = def.staminaBonus;
      const bonusXp = Math.max(8, Math.round(def.xpReward * 0.6));

      setState((prev) => ({
        ...prev,
        inventoryAnimalFeeds: {
          ...prev.inventoryAnimalFeeds,
          [feedType]: Math.max(0, (prev.inventoryAnimalFeeds[feedType] || 0) - 1),
        },
        stats: {
          ...prev.stats,
          coins: prev.stats.coins + bonusCoins,
          coinsEarnedTotal: prev.stats.coinsEarnedTotal + bonusCoins,
          stamina: Math.min(prev.stats.maxStamina, prev.stats.stamina + staminaGain),
        },
      }));

      addXP(bonusXp);
      farmAudio.playCoinSound();
      addNotice(
        tr(
          `🐾 ให้อาหารสัตว์ด้วย "${getAnimalFeedName(feedType)}"! สัตว์อารมณ์ดี มอบผลผลิต +${bonusCoins} 🪙, พลังงาน +${staminaGain} ⚡ (+${bonusXp} XP)`,
          `🐾 Fed animals with "${getAnimalFeedName(feedType)}"! Earned +${bonusCoins} 🪙, +${staminaGain} ⚡ Stamina (+${bonusXp} XP)`
        ),
        '#86efac'
      );
      return true;
    },
    [setState, addXP, addNotice]
  );

  // ===== setStats (external API) =====
  const setStats: Dispatch<SetStateAction<PlayerStats>> = useCallback(
    (action) => {
      setState((prev) => {
        const newStats =
          typeof action === 'function'
            ? (action as (p: PlayerStats) => PlayerStats)(prev.stats)
            : action;
        return { ...prev, stats: newStats };
      });
    },
    [setState]
  );

  return {
    stats: state.stats,
    setStats,
    levelUpReward,
    clearLevelUpReward,
    inventoryCrops: state.inventoryCrops,
    inventorySeeds: state.inventorySeeds,
    inventorySaplings: state.inventorySaplings,
    inventoryTreeFruits: state.inventoryTreeFruits,
    inventoryWood: state.inventoryWood,
    inventoryDuckEggs: state.inventoryDuckEggs,
    inventoryDuckFeathers: state.inventoryDuckFeathers,
    inventoryProcessedFeathers: state.inventoryProcessedFeathers,
    inventoryDrinks: state.inventoryDrinks,
    brewingJobs: state.brewingJobs,
    inventoryBakedGoods: state.inventoryBakedGoods,
    bakingJobs: state.bakingJobs,
    ovenMasterySeconds: state.ovenMasterySeconds,
    inventoryAnimalFeeds: state.inventoryAnimalFeeds,
    feedMillJobs: state.feedMillJobs,
    feedAutoCollectEvents,
    addXP,
    spendCoins,
    earnCoins,
    spendGems,
    earnGems,
    spendSeed,
    spendSapling,
    addCrop,
    addSeed, // ✅ ส่งออก addSeed
    addTreeHarvest,
    addWood,
    addDuckProduce,
    handleBuySeed,
    handleBuySapling,
    addSapling,
    handleSellCrop,
    handleSellTreeFruit,
    handleSellWood,
    handleSellDuckEgg,
    handleSellDuckFeather,
    handleCraftFeatherProduct,
    handleSellProcessedFeather,
    handleStartBrewing,
    handleCollectBrew,
    handleCollectAllReadyBrews,
    handleSellDrink,
    handleStartBaking,
    handleRushBakingJob,
    handleCollectBakedJob,
    handleCollectOvenBasket,
    handleBoostOvenMastery,
    handleSellBakedGood,
    handleStartFeedMill,
    handleRushFeedMillJob,
    handleSellAnimalFeed,
    handleUseAnimalFeed,
    pruneDeletedHouseBrews,
    handleSellAllCrops,
    handleCookDish,
  };
}