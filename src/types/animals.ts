// src/types/animals.ts
import type { CropType } from './crops';

// ───────────────────────── สัตว์เลี้ยง ─────────────────────────

export type AnimalType = 'chicken' | 'duck' | 'pig' | 'cow' | 'goat' | 'dog' | 'cat' | 'horse' | 'sheep';

export interface AnimalDef {
  id: AnimalType;
  name: string;
  nameEn: string;
  icon: string;
  desc: string;
  walkSpeed: number;
  scale: number;
  buyCost: number;
  gemCost?: number;
  swatch: string;
}

export const ANIMAL_DEFS: Record<AnimalType, AnimalDef> = {
  chicken: {
    id: 'chicken',
    name: 'ไก่ฟาร์ม',
    nameEn: 'Farm Chicken',
    icon: '🐔',
    desc: 'ไก่ฟาร์มขนสวยเดินคุ้ยเขี่ยจิกหาอาหารอย่างมีชีวิตชีวา (chicken.glb)',
    walkSpeed: 1.6,
    scale: 0.85,
    buyCost: 600,
    swatch: '#fff8e1',
  },
  duck: {
    id: 'duck',
    name: 'เป็ดเทศอารมณ์ดี',
    nameEn: 'Farm Duck',
    icon: '🦆',
    desc: 'เป็ดฟาร์มขนฟูสะอาด เดินเตาะแตะในเล้าและสระน้ำ ให้ไข่เป็ดสดและขนเป็ดนุ่มสำหรับแปรรูป (public/duck_walk.glb)',
    walkSpeed: 1.35,
    scale: 1.0,
    buyCost: 100,
    swatch: '#fef08a',
  },
  pig: {
    id: 'pig',
    name: 'หมูชมพู',
    nameEn: 'Rosy Pig',
    icon: '🐷',
    desc: 'ลำตัวกลมอ้วน จมูกชมพู หางม้วนดุ๊กดิ๊ก ชอบเดินดมหาของอร่อย',
    walkSpeed: 1.9,
    scale: 1.0,
    buyCost: 1200,
    swatch: '#f8bbd0',
  },
  goat: {
    id: 'goat',
    name: 'แพะภูเขา',
    nameEn: 'Meadow Goat',
    icon: '🐐',
    desc: 'เขาโค้งสง่างาม เคราแพะใต้คาง เดินกระฉับกระเฉงและเล็มหญ้า',
    walkSpeed: 2.2,
    scale: 1.05,
    buyCost: 1800,
    swatch: '#d7ccc8',
  },
  cow: {
    id: 'cow',
    name: 'วัวนมฮอลสไตน์',
    nameEn: 'Holstein Cow',
    icon: '🐮',
    desc: 'ลายขาว-ดำคลาสสิก ปากนุ่มสีเนื้อ เดินช้าๆ และเคี้ยวเอื้องอย่างผ่อนคลาย',
    walkSpeed: 1.4,
    scale: 1.35,
    buyCost: 2500,
    swatch: '#cfd8dc',
  },
  dog: {
    id: 'dog',
    name: 'หมาฟาร์มแสนรู้',
    nameEn: 'Farm Dog (Shiba)',
    icon: '🐕',
    desc: 'ขนสีทองอบอุ่น หางม้วนแกว่งดุ๊กดิ๊ก วิ่งเล่นรอบฟาร์ม เห่าทักทายอย่างร่าเริง',
    walkSpeed: 2.4,
    scale: 0.95,
    buyCost: 2200,
    gemCost: 3,
    swatch: '#d97706',
  },
  cat: {
    id: 'cat',
    name: 'แมวสามสีฟาร์ม',
    nameEn: 'Calico Farm Cat',
    icon: '🐱',
    desc: 'ขนสามสีลายแต้ม นั่งอาบแดดหน้าบ้าน ร้องเหมียวๆ คลอเคลียอย่างน่ารัก',
    walkSpeed: 1.8,
    scale: 0.8,
    buyCost: 1500,
    gemCost: 2,
    swatch: '#ea580c',
  },
  horse: {
    id: 'horse',
    name: 'ม้าพันธุ์ดีในคอก',
    nameEn: 'Thoroughbred Horse',
    icon: '🐴',
    desc: 'ม้ากำยำสง่างาม ขนน้ำตาลเงางาม แผงคอยาวสลวย อาศัยในคอกม้า วิ่งเหยาะและเล็มหญ้า (horse.glb)',
    walkSpeed: 2.8,
    scale: 1.25,
    buyCost: 3500,
    gemCost: 5,
    swatch: '#795548',
  },
  sheep: {
    id: 'sheep',
    name: 'แกะขนฟู',
    nameEn: 'Fluffy Sheep',
    icon: '🐑',
    desc: 'ขนสีขาวนุ่มฟูเต็มตัว หางสั้นกระดิกเบา ๆ เดินเล็มหญ้าเป็นฝูง (sheep.glb)',
    walkSpeed: 1.5,
    scale: 1.0,
    buyCost: 2000,
    gemCost: 3,
    swatch: '#f5f5f5',
  },
};

export interface PlacedAnimal {
  id: string;
  type: AnimalType;
  x: number;
  z: number;
  rot: number;
  homeX: number;
  homeZ: number;
}

// ───────────────────────── ผลผลิตเป็ดและการแปรรูปขนเป็ด ─────────────────────────

export const DUCK_EGG_SELL_PRICE = 32;
export const DUCK_FEATHER_SELL_PRICE = 18;

export type ProcessedFeatherType = 'feather_charm' | 'feather_pillow' | 'down_quilt';

export interface ProcessedFeatherDef {
  id: ProcessedFeatherType;
  name: string;
  nameEn: string;
  iconEmoji: string;
  feathersRequired: number;
  sellPrice: number;
  xpReward: number;
  description: string;
  descriptionEn: string;
}

export const PROCESSED_FEATHER_DEFS: Record<ProcessedFeatherType, ProcessedFeatherDef> = {
  feather_charm: {
    id: 'feather_charm',
    name: 'พู่ขนเป็ดนำโชค',
    nameEn: 'Lucky Feather Charm',
    iconEmoji: '🪶',
    feathersRequired: 2,
    sellPrice: 65,
    xpReward: 12,
    description: 'พู่ประดับถักมือจากขนเป็ดคัดพิเศษ นุ่มละมุน เป็นของที่ระลึกยอดนิยมประจำฟาร์ม',
    descriptionEn: 'Hand-woven decorative charm crafted from select soft duck feathers.',
  },
  feather_pillow: {
    id: 'feather_pillow',
    name: 'หมอนขนเป็ดนุ่มฟู',
    nameEn: 'Plush Down Pillow',
    iconEmoji: '🛌',
    feathersRequired: 3,
    sellPrice: 110,
    xpReward: 20,
    description: 'หมอนอิงยัดไส้ขนเป็ดฟาร์มแท้ สัมผัสนุ่มสบายระบายอากาศดี ขายได้ราคาสูง',
    descriptionEn: 'Cloud-soft farmstead pillow stuffed with clean, fluffy duck down.',
  },
  down_quilt: {
    id: 'down_quilt',
    name: 'ผ้านวมขนเป็ดพรีเมียม',
    nameEn: 'Luxury Down Quilt',
    iconEmoji: '🧶',
    feathersRequired: 5,
    sellPrice: 210,
    xpReward: 35,
    description: 'ผ้านวมขนเป็ดเย็บปราณีต เก็บความอบอุ่นดีเยี่ยม สินค้าแปรรูปเกรดพรีเมียมของไร่',
    descriptionEn: 'Artisan quilted comforter filled with warm, high-loft duck down.',
  },
};

// ───────────────────────── เครื่องผลิตอาหารสัตว์ (Animal Feed Making Machine) ─────────────────────────

export const FEED_MILL_SLOTS_PER_BUILDING = 3;
export const FEED_MILL_RUSH_COST_COINS = 4;

export type AnimalFeedType =
  | 'chicken_duck_feed'
  | 'duck_grain_feed'
  | 'pig_goat_feed'
  | 'cow_sheep_feed'
  | 'premium_horse_feed';

export interface AnimalFeedDef {
  id: AnimalFeedType;
  name: string;
  nameEn: string;
  iconEmoji: string;
  targetAnimalsLabel: string;
  targetAnimalsLabelEn: string;
  productionMinutes: number;
  durationSeconds: number;
  cropsRequired: Partial<Record<CropType, number>>;
  sellPrice: number;
  xpReward: number;
  feedBonusCoins: number;
  staminaBonus: number;
  sackColorHex: number;
  description: string;
  descriptionEn: string;
}

export interface FeedMillJob {
  id: string;
  houseId: string;
  feedType: AnimalFeedType;
  durationSeconds: number;
  startedAt: number;
  finishAt: number;
}

export interface FeedAutoCollectEvent {
  id: string;
  houseId: string;
  feedType: AnimalFeedType;
  timestamp: number;
}

export const ANIMAL_FEED_DEFS: Record<AnimalFeedType, AnimalFeedDef> = {
  chicken_duck_feed: {
    id: 'chicken_duck_feed',
    name: 'อาหารไก่และเป็ด',
    nameEn: 'Poultry Grain Feed',
    iconEmoji: '🐔',
    targetAnimalsLabel: 'ไก่ & เป็ด',
    targetAnimalsLabelEn: 'Chickens & Ducks',
    productionMinutes: 1,
    durationSeconds: 60, // 1 นาที
    cropsRequired: { wheat: 2 },
    sellPrice: 85,
    xpReward: 35,
    feedBonusCoins: 95,
    staminaBonus: 12,
    sackColorHex: 0xfacc15,
    description: 'เมล็ดข้าวสาลีบดละเอียดอุดมวิตามิน ใช้เวลาผลิตเพียง 1 นาที เสร็จแล้วลอยเข้าคลังอัตโนมัติ',
    descriptionEn: 'Cracked golden wheat poultry feed milled in 1 minute and auto-floated into storage.',
  },
  duck_grain_feed: {
    id: 'duck_grain_feed',
    name: 'อาหารเป็ดธัญพืชรวม',
    nameEn: 'Waterfowl Barley Mix',
    iconEmoji: '🦆',
    targetAnimalsLabel: 'เป็ดเทศ & สัตว์ปีก',
    targetAnimalsLabelEn: 'Farm Ducks & Poultry',
    productionMinutes: 2,
    durationSeconds: 120, // 2 นาที
    cropsRequired: { wheat: 1, barley: 1 },
    sellPrice: 145,
    xpReward: 65,
    feedBonusCoins: 165,
    staminaBonus: 16,
    sackColorHex: 0x2dd4bf,
    description: 'อาหารเม็ดผสมข้าวบาร์เลย์และข้าวสาลี ช่วยให้เป็ดอารมณ์ดีขนฟู ใช้เวลาผลิต 2 นาที',
    descriptionEn: 'Balanced barley-and-wheat pellets for happy ducks, milled in 2 minutes.',
  },
  pig_goat_feed: {
    id: 'pig_goat_feed',
    name: 'อาหารหมูและแพะคัดพิเศษ',
    nameEn: 'Root & Soy Livestock Feed',
    iconEmoji: '🐷',
    targetAnimalsLabel: 'หมู & แพะภูเขา',
    targetAnimalsLabelEn: 'Pigs & Meadow Goats',
    productionMinutes: 3,
    durationSeconds: 180, // 3 นาที
    cropsRequired: { carrot: 1, soybean: 1 },
    sellPrice: 270,
    xpReward: 115,
    feedBonusCoins: 300,
    staminaBonus: 22,
    sackColorHex: 0xfb923c,
    description: 'หัวแครอทหวานฉ่ำบดคลุกถั่วเหลืองโปรตีนสูง ใช้เวลาผลิต 3 นาที ลอยเก็บอัตโนมัติเมื่อเสร็จ',
    descriptionEn: 'Nutritious chopped carrot and roasted soybean blend milled in 3 minutes.',
  },
  cow_sheep_feed: {
    id: 'cow_sheep_feed',
    name: 'อาหารวัวนมและแกะโปรตีนสูง',
    nameEn: 'Dairy Cow & Sheep Feed',
    iconEmoji: '🐮',
    targetAnimalsLabel: 'วัวนม & แกะขนฟู',
    targetAnimalsLabelEn: 'Dairy Cows & Fluffy Sheep',
    productionMinutes: 4,
    durationSeconds: 240, // 4 นาที
    cropsRequired: { corn: 1, soybean: 1 },
    sellPrice: 390,
    xpReward: 170,
    feedBonusCoins: 430,
    staminaBonus: 28,
    sackColorHex: 0x4ade80,
    description: 'ข้าวโพดหวานบดผสมถั่วเหลืองเกรดคัดพิเศษ บำรุงน้ำนมและขนแกะนุ่มฟู ใช้เวลาผลิต 4 นาที',
    descriptionEn: 'Rich sweet-corn and soy dairy ration for cows and sheep, milled in 4 minutes.',
  },
  premium_horse_feed: {
    id: 'premium_horse_feed',
    name: 'อาหารม้าพันธุ์ดีเกรดพรีเมียม',
    nameEn: 'Premium Thoroughbred Feed',
    iconEmoji: '🐴',
    targetAnimalsLabel: 'ม้าพันธุ์ดี & สัตว์ใหญ่ทั้งฟาร์ม',
    targetAnimalsLabelEn: 'Thoroughbred Horses & All Livestock',
    productionMinutes: 5,
    durationSeconds: 300, // 5 นาที
    cropsRequired: { corn: 1, carrot: 1, barley: 1 },
    sellPrice: 510,
    xpReward: 230,
    feedBonusCoins: 560,
    staminaBonus: 35,
    sackColorHex: 0xf59e0b,
    description: 'ธัญพืช 3 ชนิดคลุกเคล้ามอลต์บาร์เลย์และแครอทสด ให้พลังงานสูงสุด ใช้เวลาผลิต 5 นาที',
    descriptionEn: 'Three-grain championship horse & livestock feed milled in 5 minutes.',
  },
};
