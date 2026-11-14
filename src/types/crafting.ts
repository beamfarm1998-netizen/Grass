// src/types/crafting.ts
import type { CropType } from './crops';
import type { TreeType } from './trees';

// ───────────────────────── เครื่องกลั่นและหมักเครื่องดื่ม (Brewery & Distillery) ─────────────────────────

export const BREWERY_SLOTS_PER_BUILDING = 2;

export type BrewDrinkType =
  | 'beer'
  | 'barley_beer'
  | 'craft_beer'
  | 'carrot_vodka'
  | 'whiskey'
  | 'orchard_brandy'
  | 'schnapps'
  | 'coconut_water'
  | 'coconut_milk'
  | 'tropical_smoothie';

export interface BrewDrinkDef {
  id: BrewDrinkType;
  name: string;
  nameEn: string;
  iconEmoji: string;
  brewTimeSeconds: number;
  cropsRequired?: Partial<Record<CropType, number>>;
  fruitsRequired?: Partial<Record<TreeType, number>>;
  sellPrice: number;
  xpReward: number;
  description: string;
  descriptionEn: string;
  unlockLevel?: number;
}

export interface BrewingJob {
  id: string;
  houseId: string;
  drinkType: BrewDrinkType;
  startedAt: number;
  finishAt: number;
}

export const BREW_DRINK_DEFS: Record<BrewDrinkType, BrewDrinkDef> = {
  beer: {
    id: 'beer',
    name: 'เบียร์',
    nameEn: 'Beer',
    iconEmoji: '🍺',
    brewTimeSeconds: 15 * 60, // 15 นาที
    cropsRequired: { wheat: 2 },
    sellPrice: 165,
    xpReward: 85,
    description: 'สูตรคลาสสิกสำหรับเบียร์ลาเกอร์หรือเอลที่เน้นมอลต์จากข้าวสาลี วัตถุดิบหาง่าย ผลิตได้เร็ว',
    descriptionEn: 'Classic golden wheat lager brewed fast for steady farm market sales.',
  },
  barley_beer: {
    id: 'barley_beer',
    name: 'เบียร์มอลต์ข้าวบาร์เลย์',
    nameEn: 'Barley Malt Beer',
    iconEmoji: '🍻',
    brewTimeSeconds: 20 * 60, // 20 นาที
    cropsRequired: { barley: 2, wheat: 1 },
    sellPrice: 340,
    xpReward: 155,
    description: 'เบียร์สีอำพันหอมกรุ่นจากมอลต์ข้าวบาร์เลย์แท้ผสานข้าวสาลี (ใช้ธัญพืช 3 ชิ้นต่อ 1 ขวด)',
    descriptionEn: 'Rich amber malt ale brewed from two golden barley sheaves and wheat.',
  },
  craft_beer: {
    id: 'craft_beer',
    name: 'คราฟต์เบียร์',
    nameEn: 'Craft Beer',
    iconEmoji: '🌾',
    brewTimeSeconds: 30 * 60, // 30 นาที
    cropsRequired: { wheat: 1, corn: 1 },
    sellPrice: 480,
    xpReward: 220,
    description: 'เบียร์สูตรพิเศษที่มีความหวานจากข้าวโพด ต้องใช้เวลาบ่มรสชาติเพิ่มขึ้นเป็นเท่าตัว',
    descriptionEn: 'Small-batch artisan beer balancing golden wheat malt with sweet corn.',
  },
  carrot_vodka: {
    id: 'carrot_vodka',
    name: 'เหล้าแครอท / วอดก้า',
    nameEn: 'Carrot Vodka',
    iconEmoji: '🥕',
    brewTimeSeconds: 45 * 60, // 45 นาที
    cropsRequired: { carrot: 2 },
    sellPrice: 450,
    xpReward: 260,
    description: 'เหล้ากลั่นดีกรีแรงที่แปรรูปจากพืชหัว ใช้เวลาในการกรองและกลั่นซ้ำหลายรอบจนบริสุทธิ์',
    descriptionEn: 'Crystal-clear root-crop spirit triple-distilled and filtered from fresh carrots.',
  },
  whiskey: {
    id: 'whiskey',
    name: 'เหล้าวิสกี้',
    nameEn: 'Whiskey',
    iconEmoji: '🥃',
    brewTimeSeconds: 60 * 60, // 1 ชั่วโมง
    cropsRequired: { corn: 2 },
    sellPrice: 920,
    xpReward: 440,
    description: 'เหล้าเบอร์เบินวิสกี้แบบดั้งเดิมที่กลั่นจากข้าวโพดเป็นหลัก และบ่มในถังไม้โอ๊คอย่างพิถีพิถัน',
    descriptionEn: 'Traditional corn bourbon whiskey distilled in copper stills and oak-aged.',
  },
  orchard_brandy: {
    id: 'orchard_brandy',
    name: 'บรั่นดีผลไม้บาร์เลย์',
    nameEn: 'Orchard Fruit Brandy',
    iconEmoji: '🍸',
    brewTimeSeconds: 75 * 60, // 1 ชั่วโมง 15 นาที
    cropsRequired: { barley: 1 },
    fruitsRequired: { apple: 2 },
    sellPrice: 1280,
    xpReward: 490,
    description: 'เครื่องดื่มกลั่นหอมละมุนจากผลแอปเปิ้ลสวนและมอลต์ข้าวบาร์เลย์ (แปรรูปธัญพืชและผลไม้ 3 ชิ้น)',
    descriptionEn: 'Aromatic copper-pot brandy distilled from crisp orchard apples and malted barley.',
  },
  schnapps: {
    id: 'schnapps',
    name: 'เหล้าหวาน / บรั่นดี (Schnapps)',
    nameEn: 'Schnapps',
    iconEmoji: '🍷',
    brewTimeSeconds: 90 * 60, // 1 ชั่วโมง 30 นาที
    cropsRequired: { carrot: 1, soybean: 1 },
    sellPrice: 890,
    xpReward: 560,
    description: 'เครื่องดื่มระดับพรีเมียมที่ใช้เวลานานที่สุด เพื่อดึงรสสัมผัสและกลิ่นอายเฉพาะตัวออกมา',
    descriptionEn: 'Reserve artisan schnapps slow-matured to extract nuanced carrot & soybean notes.',
  },
  coconut_water: {
    id: 'coconut_water',
    name: 'น้ำมะพร้าว',
    nameEn: 'Coconut Water',
    iconEmoji: '🥥',
    brewTimeSeconds: 10 * 60, // 10 นาที
    fruitsRequired: { coconut: 1 },
    sellPrice: 320,
    xpReward: 120,
    description: 'น้ำมะพร้าวสดหวานธรรมชาติ ดื่มแล้วสดชื่น คืนความกระปรี้กระเปร่า',
    descriptionEn: 'Chilled natural coconut water straight from fresh tropical green coconuts.',
    unlockLevel: 101,
  },
  coconut_milk: {
    id: 'coconut_milk',
    name: 'กะทิมะพร้าว',
    nameEn: 'Coconut Milk',
    iconEmoji: '🥛',
    brewTimeSeconds: 15 * 60, // 15 นาที
    fruitsRequired: { coconut: 2 },
    sellPrice: 510,
    xpReward: 180,
    description: 'หัวกะทิมะพร้าวคั้นสดเข้มข้น หอมมัน สำหรับปรุงอาหารและของหวานรสเลิศ',
    descriptionEn: 'Rich, creamy freshly-pressed coconut milk essential for fine confectionery.',
    unlockLevel: 101,
  },
  tropical_smoothie: {
    id: 'tropical_smoothie',
    name: 'สมูทตี้ทรอปิคอล',
    nameEn: 'Tropical Smoothie',
    iconEmoji: '🍹',
    brewTimeSeconds: 20 * 60, // 20 นาที
    cropsRequired: { carrot: 1 },
    fruitsRequired: { coconut: 1, apple: 1 },
    sellPrice: 750,
    xpReward: 280,
    description: 'สมูทตี้ปั่นเย็นฉ่ำผสานมะพร้าวหอมหวาน แอปเปิ้ลกรอบ และแครอทสด',
    descriptionEn: 'Refreshing frosty tropical smoothie blended with coconut, orchard apple, and sweet carrot.',
    unlockLevel: 101,
  },
};

// ───────────────────────── เตาอบขนมปัง พิซซ่า และเตาอบพาย (Bakery & Pie Oven + 3-Star Mastery) ─────────────────────────

export type OvenMachineType = 'bakery' | 'pie_oven';
export type BakedGoodCategory = 'bread' | 'pizza' | 'pie';

export const OVEN_SLOTS_PER_BUILDING = 3;
export const OVEN_RUSH_COST_COINS = 5;
export const OVEN_MASTERY_BOOST_COST_COINS = 50;

/**
 * ชั่วโมงสะสมของเตาอบเพื่อปลดล็อกดาวความชำนาญ (Mastery Stars):
 * ★ 1 ดาว (1,800 วินาที): ขายเบเกอรี่/พายได้เหรียญเพิ่มขึ้น +10%
 * ★ 2 ดาว (5,400 วินาที): เก็บจากตะกร้าได้ XP เพิ่มขึ้น +15%
 * ★ 3 ดาว (10,800 วินาที): ลดเวลาอบเหลือเวลาพิเศษระดับ 3 ดาวตามสูตร!
 */
export const OVEN_MASTERY_STAR_THRESHOLDS: readonly [number, number, number] = [
  1800,
  5400,
  10800,
];

export function getOvenMasteryStars(totalBakedSeconds: number): 0 | 1 | 2 | 3 {
  if (totalBakedSeconds >= OVEN_MASTERY_STAR_THRESHOLDS[2]) return 3;
  if (totalBakedSeconds >= OVEN_MASTERY_STAR_THRESHOLDS[1]) return 2;
  if (totalBakedSeconds >= OVEN_MASTERY_STAR_THRESHOLDS[0]) return 1;
  return 0;
}

export type BakedGoodType =
  | 'white_bread'
  | 'cookie'
  | 'cornbread'
  | 'cheese_pizza'
  | 'seafood_pizza'
  | 'spicy_pizza'
  | 'carrot_pie'
  | 'pumpkin_pie'
  | 'bacon_pie'
  | 'macaroon'
  | 'coconut_ice_cream'
  | 'coconut_jelly';

export interface BakedGoodDef {
  id: BakedGoodType;
  machine: OvenMachineType;
  category: BakedGoodCategory;
  name: string;
  nameEn: string;
  iconEmoji: string;
  normalTimeSeconds: number;
  star3TimeSeconds: number;
  cropsRequired: Partial<Record<CropType, number>>;
  fruitsRequired?: Partial<Record<TreeType, number>>;
  sellPrice: number;
  xpReward: number;
  description: string;
  descriptionEn: string;
  unlockLevel?: number;
}

export interface BakingJob {
  id: string;
  houseId: string;
  machine: OvenMachineType;
  itemType: BakedGoodType;
  durationSeconds: number;
  startedAt: number;
  finishAt: number;
}

export const BAKED_GOOD_DEFS: Record<BakedGoodType, BakedGoodDef> = {
  // 🍞 เมนูขนมปังและคุกกี้ในเตาอบขนมปัง (Bakery.glb)
  white_bread: {
    id: 'white_bread',
    machine: 'bakery',
    category: 'bread',
    name: 'ขนมปังขาว (Bread)',
    nameEn: 'Bread',
    iconEmoji: '🍞',
    normalTimeSeconds: 300, // 5 นาที = 300 วินาที
    star3TimeSeconds: 240, // เมื่อได้ 3 ดาว: 4 นาที = 240 วินาที
    cropsRequired: { wheat: 3 },
    sellPrice: 95,
    xpReward: 45,
    description: 'ขนมปังขาวอบร้อนจากข้าวสาลีสีทอง เปลือกกรอบเนื้อนุ่ม เลื่อนจากรางเข้าตะกร้าหอมกรุ่น',
    descriptionEn: 'Classic golden-crust white loaf baked from 3 wheat sheaves and slid into the basket.',
  },
  cornbread: {
    id: 'cornbread',
    machine: 'bakery',
    category: 'bread',
    name: 'ขนมปังข้าวโพด (Cornbread)',
    nameEn: 'Cornbread',
    iconEmoji: '🌽',
    normalTimeSeconds: 1800, // 30 นาที = 1,800 วินาที
    star3TimeSeconds: 1500, // เมื่อได้ 3 ดาว: 25 นาที = 1,500 วินาที
    cropsRequired: { corn: 2, wheat: 1 },
    sellPrice: 460,
    xpReward: 185,
    description: 'ขนมปังข้าวโพดเนื้อนุ่มหอมหวานธรรมชาติ อบจนเหลืองทองพร้อมเลื่อนลงตะกร้า',
    descriptionEn: 'Warm golden farmstead cornbread with sweet corn kernels and tender crumb.',
  },
  cookie: {
    id: 'cookie',
    machine: 'bakery',
    category: 'bread',
    name: 'คุกกี้ (Cookie)',
    nameEn: 'Cookie',
    iconEmoji: '🍪',
    normalTimeSeconds: 3600, // 1 ชั่วโมง = 3,600 วินาที
    star3TimeSeconds: 3060, // เมื่อได้ 3 ดาว: 51 นาที = 3,060 วินาที
    cropsRequired: { wheat: 2, barley: 2 },
    sellPrice: 540,
    xpReward: 240,
    description: 'คุกกี้มอลต์ข้าวบาร์เลย์และข้าวสาลีอบกรอบ หอมหวานละมุนเคี้ยวเพลิน',
    descriptionEn: 'Crisp golden-baked farmstead cookie crafted with wheat flour and sweet barley malt.',
  },

  // 🍕 เมนูพิซซ่าในเตาอบขนมปัง (Bakery.glb)
  cheese_pizza: {
    id: 'cheese_pizza',
    machine: 'bakery',
    category: 'pizza',
    name: 'พิซซ่าชีส (Pizza)',
    nameEn: 'Pizza',
    iconEmoji: '🍕',
    normalTimeSeconds: 900, // 15 นาที = 900 วินาที
    star3TimeSeconds: 720, // เมื่อได้ 3 ดาว: 12 นาที = 720 วินาที
    cropsRequired: { wheat: 2, corn: 1 },
    sellPrice: 360,
    xpReward: 145,
    description: 'พิซซ่าแป้งบางกรอบหน้าชีสเยิ้มและข้าวโพดหวาน อบด้วยไฟแรงในเตา Bakery',
    descriptionEn: 'Wood-fired crispy crust topped with bubbling golden cheese and sweet corn.',
  },
  seafood_pizza: {
    id: 'seafood_pizza',
    machine: 'bakery',
    category: 'pizza',
    name: 'พิซซ่าซีฟู้ด (Frutti di Mare Pizza)',
    nameEn: 'Frutti di Mare Pizza',
    iconEmoji: '🦐',
    normalTimeSeconds: 900, // 15 นาที = 900 วินาที
    star3TimeSeconds: 720, // เมื่อได้ 3 ดาว: 12 นาที = 720 วินาที
    cropsRequired: { wheat: 2, soybean: 1, carrot: 1 },
    sellPrice: 440,
    xpReward: 175,
    description: 'พิซซ่าหน้าซีฟู้ดสมุนไพรสไตล์อิตาเลียน กลิ่นหอมกรุ่นจากเตาอบขนมปัง',
    descriptionEn: 'Savory Frutti di Mare artisan pizza baked golden in the brick bakery hearth.',
  },
  spicy_pizza: {
    id: 'spicy_pizza',
    machine: 'bakery',
    category: 'pizza',
    name: 'พิซซ่าเผ็ด (Spicy Pizza)',
    nameEn: 'Spicy Pizza',
    iconEmoji: '🌶️',
    normalTimeSeconds: 900, // 15 นาที = 900 วินาที
    star3TimeSeconds: 720, // เมื่อได้ 3 ดาว: 12 นาที = 720 วินาที
    cropsRequired: { wheat: 2, tomato: 1, carrot: 1 },
    sellPrice: 490,
    xpReward: 195,
    description: 'พิซซ่าซอสมะเขือเทศเข้มข้นรสจัดจ้านเผ็ดร้อน อบสดใหม่ไหลตามรางลงตะกร้า',
    descriptionEn: 'Zesty tomato & chili-spiced wood-fired pizza fresh off the bakery conveyor.',
  },

  // 🥧 เตาอบพาย (Pie Oven — แยกเครื่องผลิตเฉพาะ)
  carrot_pie: {
    id: 'carrot_pie',
    machine: 'pie_oven',
    category: 'pie',
    name: 'พายแครอท (Carrot Pie)',
    nameEn: 'Carrot Pie',
    iconEmoji: '🥕',
    normalTimeSeconds: 3600, // 1 ชั่วโมง = 3,600 วินาที
    star3TimeSeconds: 3060, // เมื่อได้ 3 ดาว: 51 นาที = 3,060 วินาที
    cropsRequired: { carrot: 3, wheat: 2 },
    sellPrice: 580,
    xpReward: 260,
    description: 'พายแป้งพัฟสานลายตารางสอดไส้แครอทกวนหอมหวาน อบจากเตาอบพายโดยเฉพาะ',
    descriptionEn: 'Flaky lattice-crust pie filled with sweet spiced farm carrots.',
  },
  pumpkin_pie: {
    id: 'pumpkin_pie',
    machine: 'pie_oven',
    category: 'pie',
    name: 'พายฟักทอง (Pumpkin Pie)',
    nameEn: 'Pumpkin Pie',
    iconEmoji: '🎃',
    normalTimeSeconds: 7200, // 2 ชั่วโมง = 7,200 วินาที
    star3TimeSeconds: 6120, // เมื่อได้ 3 ดาว: 1 ชั่วโมง 42 นาที = 6,120 วินาที
    cropsRequired: { pumpkin: 1, wheat: 2 },
    sellPrice: 980,
    xpReward: 420,
    description: 'พายฟักทองเนื้อเนียนนุ่มเข้มข้น หอมเครื่องเทศอบเชย ขายได้ราคาดีเยี่ยม',
    descriptionEn: 'Velvety golden pumpkin custard pie baked slowly in the dedicated Pie Oven.',
  },
  bacon_pie: {
    id: 'bacon_pie',
    machine: 'pie_oven',
    category: 'pie',
    name: 'พายเนื้อ/พายเบคอน (Bacon Pie)',
    nameEn: 'Bacon Pie',
    iconEmoji: '🥓',
    normalTimeSeconds: 10800, // 3 ชั่วโมง = 10,800 วินาที
    star3TimeSeconds: 9180, // เมื่อได้ 3 ดาว: 2 ชั่วโมง 33 นาที = 9,180 วินาที
    cropsRequired: { soybean: 2, corn: 1, wheat: 2 },
    sellPrice: 1380,
    xpReward: 580,
    description: 'พายคาวระดับพรีเมียมอบนานจนแป้งกรอบร่วน ไส้แน่นหอมกรุ่นคุ้มค่าราคาสูงสุด',
    descriptionEn: 'Rich savory artisan bacon pie slow-baked to golden perfection.',
  },

  // 🥥 ผลิตภัณฑ์แปรรูปจากมะพร้าว (Coconut Goods - ปลดล็อก Lv. 101)
  macaroon: {
    id: 'macaroon',
    machine: 'bakery',
    category: 'bread',
    name: 'มาการอง (Macaroon)',
    nameEn: 'Coconut Macaroon',
    iconEmoji: '🧁',
    normalTimeSeconds: 1800, // 30 นาที = 1,800 วินาที
    star3TimeSeconds: 1440, // 3 ดาว: 24 นาที
    cropsRequired: { wheat: 2 },
    fruitsRequired: { coconut: 1 },
    sellPrice: 620,
    xpReward: 210,
    description: 'มาการองมะพร้าวอบกรอบนอกนุ่มใน หอมหวานละมุนจากเนื้อมะพร้าวแท้ ปลดล็อกเลเวล 101',
    descriptionEn: 'French artisan coconut macaron with crisp golden shell and chewy coconut center. Unlocks at Lv.101.',
    unlockLevel: 101,
  },
  coconut_ice_cream: {
    id: 'coconut_ice_cream',
    machine: 'bakery',
    category: 'bread',
    name: 'ไอศกรีมมะพร้าว (Coconut Ice Cream)',
    nameEn: 'Coconut Ice Cream',
    iconEmoji: '🍨',
    normalTimeSeconds: 2400, // 40 นาที = 2,400 วินาที
    star3TimeSeconds: 1920, // 3 ดาว: 32 นาที
    cropsRequired: { wheat: 1 },
    fruitsRequired: { coconut: 2 },
    sellPrice: 590,
    xpReward: 195,
    description: 'ไอศกรีมกะทิมะพร้าวสดปั่นเย็นจัด รสชาติหวานมันชื่นใจสไตล์บ้านสวน',
    descriptionEn: 'Creamy artisanal coconut ice cream churned from fresh coconut milk and topped with toasted flakes.',
    unlockLevel: 101,
  },
  coconut_jelly: {
    id: 'coconut_jelly',
    machine: 'bakery',
    category: 'bread',
    name: 'วุ้นมะพร้าว (Coconut Jelly)',
    nameEn: 'Coconut Jelly',
    iconEmoji: '🍮',
    normalTimeSeconds: 1200, // 20 นาที = 1,200 วินาที
    star3TimeSeconds: 960, // 3 ดาว: 16 นาที
    cropsRequired: { corn: 1 },
    fruitsRequired: { coconut: 1 },
    sellPrice: 480,
    xpReward: 160,
    description: 'วุ้นน้ำมะพร้าวธรรมชาติ เคี้ยวหนึบหนับ หอมสดชื่น ดับกระหายคลายร้อน',
    descriptionEn: 'Silky crystal coconut jelly cubes set from pure coconut water and sweet corn starch.',
    unlockLevel: 101,
  },
};
