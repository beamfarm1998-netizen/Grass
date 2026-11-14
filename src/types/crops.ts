// src/types/crops.ts

export type CropType =
  | 'wheat'
  | 'barley'
  | 'carrot'
  | 'soybean'
  | 'corn'
  | 'pumpkin'
  | 'tomato'
  | 'strawberry';

export type PlotStatus = 'EMPTY' | 'PLOWED' | 'PLANTED' | 'GROWING' | 'READY';

export interface CropDefinition {
  id: CropType;
  name: string;
  nameEn: string;
  seedName: string;
  growthTimeSeconds: number; // in game seconds
  seedCost: number;
  sellPrice: number;
  xpReward: number;
  color: string;
  accentColor: string;
  iconEmoji: string;
  description: string;
}

export interface FarmPlot {
  id: number;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  status: PlotStatus;
  cropType?: CropType;
  plantedAt?: number;
  growthProgress: number; // 0..1
  isWatered: boolean;
  wateredAt?: number;
  coveredByHouseId?: string;
  coveredSlot?: 0 | 1;
  rotY?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  nameEn: string;
  type: 'seed' | 'crop' | 'resource' | 'tool';
  cropType?: CropType;
  count: number;
  price: number;
  icon: string;
  description: string;
}

// ───────────────────────── พืชผล (Crops) ─────────────────────────
// Tier เรียงจากโตเร็ว → ช้า: wheat → carrot → corn → pumpkin → tomato → strawberry
// กำไร/นาที: 10.0 → 12.6 → 15.0 → 16.3 → 16.9 → 17.8

export const CROP_DEFINITIONS: Record<CropType, CropDefinition> = {
  wheat: {
    id: 'wheat',
    name: 'ข้าวสาลี',
    nameEn: 'Wheat',
    seedName: 'เมล็ดข้าวสาลี',
    growthTimeSeconds: 120, // 2 นาที
    seedCost: 5,
    sellPrice: 25,
    xpReward: 20,
    color: '#E5A93C',
    accentColor: '#F7D070',
    iconEmoji: '🌾',
    description: 'พืชพื้นฐานโตเร็ว ให้เมล็ดสีทองสวยงาม ใช้หมักเบียร์และคราฟต์เบียร์',
  },
  barley: {
    id: 'barley',
    name: 'ข้าวบาร์เลย์',
    nameEn: 'Barley',
    seedName: 'เมล็ดข้าวบาร์เลย์',
    growthTimeSeconds: 240, // 4 นาที
    seedCost: 8,
    sellPrice: 50,
    xpReward: 42,
    color: '#D4A017',
    accentColor: '#EEDC82',
    iconEmoji: '🌾',
    description: 'ธัญพืชรวงทองสำหรับทำมอลต์เบียร์มอลต์และแปรรูปคุกกี้',
  },
  carrot: {
    id: 'carrot',
    name: 'แครอท',
    nameEn: 'Carrot',
    seedName: 'เมล็ดแครอท',
    growthTimeSeconds: 420, // 7 นาที
    seedCost: 12,
    sellPrice: 100,
    xpReward: 85,
    color: '#E65100',
    accentColor: '#FFA726',
    iconEmoji: '🥕',
    description: 'ผักหัวสีส้มสดใส หวานกรอบ อุดมด้วยเบต้าแคโรทีน ใช้กลั่นวอดก้าแครอท',
  },
  soybean: {
    id: 'soybean',
    name: 'ถั่วเหลือง',
    nameEn: 'Soybean',
    seedName: 'เมล็ดถั่วเหลือง',
    growthTimeSeconds: 900, // 15 นาที
    seedCost: 20,
    sellPrice: 220,
    xpReward: 190,
    color: '#9E9D24',
    accentColor: '#C0CA33',
    iconEmoji: '🫘',
    description: 'พืชตระกูลถั่วโปรตีนสูง บำรุงดิน เป็นวัตถุดิบหลักในการทำอาหารสัตว์',
  },
  corn: {
    id: 'corn',
    name: 'ข้าวโพดหวาน',
    nameEn: 'Sweet Corn',
    seedName: 'เมล็ดข้าวโพด',
    growthTimeSeconds: 1800, // 30 นาที
    seedCost: 35,
    sellPrice: 485,
    xpReward: 420,
    color: '#FBC02D',
    accentColor: '#FFF176',
    iconEmoji: '🌽',
    description: 'ฝักสีเหลืองทอง เมล็ดเรียงตัวสวยงาม รสหวานฉ่ำ ใช้กลั่นวิสกี้ข้าวโพด',
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'ฟักทองยักษ์',
    nameEn: 'Giant Pumpkin',
    seedName: 'เมล็ดฟักทอง',
    growthTimeSeconds: 3600, // 1 ชั่วโมง
    seedCost: 55,
    sellPrice: 1030,
    xpReward: 920,
    color: '#EF6C00',
    accentColor: '#FFB74D',
    iconEmoji: '🎃',
    description: 'ผลใหญ่ผิวสีส้มทอง เนื้อแน่นหวานมัน เหมาะทำพายฟักทองในเตาอบพาย',
  },
  tomato: {
    id: 'tomato',
    name: 'มะเขือเทศฉ่ำ',
    nameEn: 'Juicy Tomato',
    seedName: 'เมล็ดมะเขือเทศ',
    growthTimeSeconds: 7200, // 2 ชั่วโมง
    seedCost: 80,
    sellPrice: 2110,
    xpReward: 1950,
    color: '#C62828',
    accentColor: '#EF5350',
    iconEmoji: '🍅',
    description: 'ผลสีแดงสดฉ่ำน้ำ รสเปรี้ยวอมหวาน ใช้ทำซอสพิซซ่ารสเผ็ดในเตา Bakery',
  },
  strawberry: {
    id: 'strawberry',
    name: 'สตรอว์เบอร์รี',
    nameEn: 'Strawberry',
    seedName: 'เมล็ดสตรอว์เบอร์รี',
    growthTimeSeconds: 28800, // 8 ชั่วโมง
    seedCost: 140,
    sellPrice: 8700,
    xpReward: 8200,
    color: '#E91E63',
    accentColor: '#81C784',
    iconEmoji: '🍓',
    description: 'ผลไม้สีแดงสดใส กลิ่นหอมหวานเป็นที่นิยม',
  },
};

/**
 * คำนวณ growthProgress (0..1) จาก timestamp — ใช้ได้ทั้งแปลงผักและต้นไม้
 * `timeScale` = ตัวคูณเร่งเวลาเกม (ปกติ = 1)
 */
export const computeGrowthProgress = (
  plantedAt: number,
  growthTimeSeconds: number,
  timeScale = 1,
  now: number = Date.now(),
): number => {
  const durationMs = growthTimeSeconds * 1000 * timeScale;
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, (now - plantedAt) / durationMs));
};

export const isReadyToHarvest = (
  plantedAt: number,
  growthTimeSeconds: number,
  timeScale = 1,
  now: number = Date.now(),
): boolean => computeGrowthProgress(plantedAt, growthTimeSeconds, timeScale, now) >= 1;
