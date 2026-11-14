// src/types/player.ts
import type { PartStyleConfig } from './buildings';

export type ToolType =
  | 'hand'
  | 'hoe'
  | 'watering_can'
  | 'sickle'
  | 'seed_bag'
  | 'tree_sapling'
  | 'axe'
  | 'pickaxe'
  | 'drone';

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night';

export type CameraMode = 'isometric' | 'follow' | 'fpp' | 'topdown';

export type FarmerGender = 'male' | 'female' | 'boy' | 'girl';

export type KidGender = 'boy' | 'girl';

export const isKidGender = (g: FarmerGender): g is KidGender => g === 'boy' || g === 'girl';

/** ข้อมูลตัวละครทั้ง 4 แบบ (ที่เดียว): ไฟล์ GLB, ความสูง (เมตร), สเกลเครื่องมือในมือ */
export const FARMER_CHARACTERS: Record<
  FarmerGender,
  { glb: string; height: number; toolScale: number }
> = {
  male: { glb: '/man.glb', height: 1.76, toolScale: 1 },
  female: { glb: '/woman.glb', height: 1.68, toolScale: 1 },
  boy: { glb: '/boy.glb', height: 1.2, toolScale: 0.72 },
  girl: { glb: '/girl.glb', height: 1.15, toolScale: 0.72 },
};

export interface PlayerStats {
  coins: number;
  gems: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  stamina: number;
  maxStamina: number;
  day: number;
  cropsHarvestedTotal: number;
  coinsEarnedTotal: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  timestamp: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  shadowsEnabled: boolean;
  timeOfDay: TimeOfDay;
  cameraTilt: number;
  autoRotate: boolean;
}

// ───────────────────────── ชุดเครื่องแต่งกาย ─────────────────────────

export type OutfitPartKey = 'hat' | 'shirt' | 'bottom' | 'shoes' | 'accessory';

export const OUTFIT_PART_KEYS: readonly OutfitPartKey[] = [
  'hat',
  'shirt',
  'bottom',
  'shoes',
  'accessory',
] as const;

export type HatStyleId = 'straw' | 'cap' | 'cowboy' | 'bucket' | 'crown' | 'none';
export type AccessoryStyleId = 'none' | 'bandana' | 'apron' | 'cape' | 'backpack';

export interface PlayerOutfitConfig {
  hatStyle: HatStyleId;
  accessoryStyle: AccessoryStyleId;
  parts: Partial<Record<OutfitPartKey, PartStyleConfig>>;
}

export const DEFAULT_PLAYER_OUTFIT: PlayerOutfitConfig = {
  hatStyle: 'straw',
  accessoryStyle: 'none',
  parts: {},
};

export interface PlayerOutfitPreset {
  id: string;
  icon: string;
  nameTh: string;
  nameEn: string;
  config: PlayerOutfitConfig;
}

export const PLAYER_OUTFIT_PRESETS: readonly PlayerOutfitPreset[] = [
  {
    id: 'classic_farmer',
    icon: '🌾',
    nameTh: 'ชาวไร่คลาสสิก',
    nameEn: 'Classic Farmer',
    config: {
      hatStyle: 'straw',
      accessoryStyle: 'bandana',
      parts: {
        hat: { color: '#f2c14e' },
        shirt: { color: '#d9483b' },
        bottom: { color: '#245582' },
        shoes: { color: '#4e342e' },
        accessory: { color: '#eab308' },
      },
    },
  },
  {
    id: 'denim_rancher',
    icon: '🤠',
    nameTh: 'คาวบอยเดนิม',
    nameEn: 'Denim Rancher',
    config: {
      hatStyle: 'cowboy',
      accessoryStyle: 'bandana',
      parts: {
        hat: { color: '#8d5a3b' },
        shirt: { color: '#38bdf8' },
        bottom: { color: '#1e3a8a' },
        shoes: { color: '#5d4037' },
        accessory: { color: '#d9483b' },
      },
    },
  },
  {
    id: 'bakery_artisan',
    icon: '🍞',
    nameTh: 'เชฟเบเกอรี่',
    nameEn: 'Bakery Chef',
    config: {
      hatStyle: 'cap',
      accessoryStyle: 'apron',
      parts: {
        hat: { color: '#e88d38' },
        shirt: { color: '#f5efe6' },
        bottom: { color: '#334155' },
        shoes: { color: '#3e2723' },
        accessory: { color: '#d9483b' },
      },
    },
  },
  {
    id: 'pond_angler',
    icon: '🎣',
    nameTh: 'นักตกปลาริมบ่อ',
    nameEn: 'Pond Angler',
    config: {
      hatStyle: 'bucket',
      accessoryStyle: 'backpack',
      parts: {
        hat: { color: '#14b8a6' },
        shirt: { color: '#eab308' },
        bottom: { color: '#334155' },
        shoes: { color: '#1e293b' },
        accessory: { color: '#4d9a62' },
      },
    },
  },
  {
    id: 'sakura_bloom',
    icon: '🌸',
    nameTh: 'ซากุระสดใส',
    nameEn: 'Sakura Blossom',
    config: {
      hatStyle: 'crown',
      accessoryStyle: 'cape',
      parts: {
        hat: { color: '#ec4899' },
        shirt: { color: '#f472b6' },
        bottom: { color: '#f5efe6' },
        shoes: { color: '#be185d' },
        accessory: { color: '#a855f7' },
      },
    },
  },
  {
    id: 'mountain_explorer',
    icon: '🏔️',
    nameTh: 'นักสำรวจขุนเขา',
    nameEn: 'Trail Explorer',
    config: {
      hatStyle: 'cap',
      accessoryStyle: 'cape',
      parts: {
        hat: { color: '#4d9a62' },
        shirt: { color: '#f5efe6' },
        bottom: { color: '#8d5a3b' },
        shoes: { color: '#334155' },
        accessory: { color: '#4d9a62' },
      },
    },
  },
] as const;

// ═══════════════════════════════════════════════════════════════════
// ───────────────────────── ระบบ Progression ─────────────────────────
// ═══════════════════════════════════════════════════════════════════

export const MAX_LEVEL = 50;
export const STAMINA_GAIN_PER_LEVEL = 5;
export const GEMS_PER_LEVEL = 1;
export const STARTING_COINS = 300;

/**
 * XP ที่ต้องใช้ผ่านเลเวล `level` → `level + 1`
 * (threshold แบบ per-level ไม่ใช่สะสม)
 *   L1: 100  |  L5: 332  |  L10: 1,455  |  L20: 27,900  |  L30: 535,000
 */
export const xpForLevel = (level: number): number =>
  Math.round(100 * Math.pow(1.55, Math.max(0, level - 1)));

// ───────────────────────── ค่าเริ่มต้นของผู้เล่น ─────────────────────────

export const INITIAL_PLAYER_STATS: PlayerStats = {
  coins: STARTING_COINS,
  gems: 0,
  level: 1,
  xp: 0,
  xpToNextLevel: xpForLevel(1),
  stamina: 100,
  maxStamina: 100,
  day: 1,
  cropsHarvestedTotal: 0,
  coinsEarnedTotal: 0,
};

// ───────────────────────── XP & Level-up ─────────────────────────

export interface XpGainResult {
  stats: PlayerStats;
  levelsGained: number;
  gemsAwarded: number;
}

/**
 * เพิ่ม XP และจัดการเลเวลอัปแบบ multi-level (overflow ทำงานถูก)
 * - ฟื้น stamina ตามจำนวนเลเวลที่อัป
 * - ให้เพชร GEMS_PER_LEVEL ต่อเลเวล
 * - ตันที่ MAX_LEVEL (xpToNextLevel = Infinity)
 */
export function gainXp(stats: PlayerStats, amount: number): XpGainResult {
  if (amount <= 0) return { stats, levelsGained: 0, gemsAwarded: 0 };

  let xp = stats.xp + amount;
  let level = stats.level;
  let xpToNextLevel = stats.xpToNextLevel;
  let maxStamina = stats.maxStamina;
  let gems = stats.gems;
  let levelsGained = 0;

  while (xp >= xpToNextLevel && level < MAX_LEVEL) {
    xp -= xpToNextLevel;
    level += 1;
    levelsGained += 1;
    maxStamina += STAMINA_GAIN_PER_LEVEL;
    gems += GEMS_PER_LEVEL;
    xpToNextLevel = xpForLevel(level);
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    xp = 0;
    xpToNextLevel = Infinity;
  }

  return {
    stats: {
      ...stats,
      xp,
      level,
      xpToNextLevel,
      maxStamina,
      stamina: Math.min(stats.stamina + levelsGained * STAMINA_GAIN_PER_LEVEL, maxStamina),
      gems,
    },
    levelsGained,
    gemsAwarded: levelsGained * GEMS_PER_LEVEL,
  };
}

// ───────────────────────── เหรียญ ─────────────────────────

export const addCoins = (stats: PlayerStats, amount: number): PlayerStats => ({
  ...stats,
  coins: stats.coins + amount,
  coinsEarnedTotal: amount > 0 ? stats.coinsEarnedTotal + amount : stats.coinsEarnedTotal,
});

export const canAffordCoins = (stats: PlayerStats, cost: number): boolean =>
  stats.coins >= cost;

/** คืน stats ใหม่ถ้าจ่ายได้, คืน null ถ้าเงินไม่พอ */
export const spendCoins = (stats: PlayerStats, cost: number): PlayerStats | null => {
  if (cost < 0 || stats.coins < cost) return null;
  return { ...stats, coins: stats.coins - cost };
};

// ───────────────────────── เพชร ─────────────────────────

export const addGems = (stats: PlayerStats, amount: number): PlayerStats => ({
  ...stats,
  gems: stats.gems + amount,
});

export const canAffordGems = (stats: PlayerStats, cost: number): boolean =>
  stats.gems >= cost;

export const spendGems = (stats: PlayerStats, cost: number): PlayerStats | null => {
  if (cost < 0 || stats.gems < cost) return null;
  return { ...stats, gems: stats.gems - cost };
};

// ───────────────────────── พลังงาน (Stamina) ─────────────────────────

export const hasStamina = (stats: PlayerStats, cost: number): boolean =>
  stats.stamina >= cost;

export const consumeStamina = (stats: PlayerStats, cost: number): PlayerStats | null => {
  if (cost < 0 || stats.stamina < cost) return null;
  return { ...stats, stamina: stats.stamina - cost };
};

export const regenStamina = (stats: PlayerStats, amount: number): PlayerStats => ({
  ...stats,
  stamina: Math.min(stats.stamina + amount, stats.maxStamina),
});

// ───────────────────────── Save migration ─────────────────────────

/**
 * ใช้ตอนโหลด save เก่า (หรือหลังปรับสูตร) — เติม field ที่ขาด + ซ่อมค่าไม่สอดคล้อง
 */
export const migratePlayerStats = (saved: Partial<PlayerStats>): PlayerStats => {
  const merged: PlayerStats = { ...INITIAL_PLAYER_STATS, ...saved };
  merged.xpToNextLevel =
    merged.level >= MAX_LEVEL ? Infinity : xpForLevel(merged.level);
  merged.maxStamina = Math.max(
    merged.maxStamina,
    100 + (merged.level - 1) * STAMINA_GAIN_PER_LEVEL,
  );
  merged.stamina = Math.min(merged.stamina, merged.maxStamina);
  return merged;
};

// ───────────────────────── ค่าใช้จ่ายพลังงานต่อแอ็กชัน ─────────────────────────

export const STAMINA_COSTS = {
  plow: 2,
  plant: 1,
  water: 1,
  harvest: 2,
  chopTree: 3,
  mineRock: 3,
} as const;

export type StaminaAction = keyof typeof STAMINA_COSTS;