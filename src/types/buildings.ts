// src/types/buildings.ts

export interface HouseDef {
  type: number;
  name: string;
  nameEn?: string;
  desc: string;
  yard: number;
  swatch: string;
  modelFile?: string;
  icon?: string;
  cost?: number;
  gemCost?: number;
  collisionBox?: { w: number; d: number };
}

export const HOUSE_DEFS: HouseDef[] = [
  { type: 0, name: 'กระท่อมไม้เล็ก', nameEn: 'Cozy Wood Cabin', desc: 'กระท่อมหลังเล็กน่ารัก มีปล่องไฟ', yard: 7, swatch: '#6d4c41', icon: '🏡' },
  { type: 1, name: 'บ้านไม้มีระเบียง', nameEn: 'Porch Farmhouse', desc: 'บ้านชั้นเดียว ระเบียงหน้าบ้านกว้าง', yard: 8, swatch: '#8d5a3b', icon: '🏠' },
  { type: 2, name: 'บ้านไม้สองชั้น', nameEn: 'Two-Story Timber House', desc: 'สองชั้น มีระเบียงชั้นบน', yard: 9, swatch: '#5d4037', icon: '🏡', modelFile: '/two-story-timber-house.glb' }, 
  { type: 3, name: 'กระท่อมทรงสามเหลี่ยม', nameEn: 'A-Frame Log Cabin', desc: 'A-Frame ซุงทั้งหลัง พร้อมกองฟืน', yard: 8, swatch: '#8d6e63', icon: '⛺' },
  { type: 4, name: 'เรือนไม้ยกพื้น', nameEn: 'Stilt Country House', desc: 'ใต้ถุนสูง หลังคาจั่วทรงสูงสีดินเผา', yard: 9, swatch: '#b5532e', icon: '🛖' },
  { type: 5, name: 'เล้าไก่พร้อมลานวิ่ง', nameEn: 'Chicken Coop & Run', desc: 'เล้าไม้พร้อมรังไข่ รางอาหาร รางน้ำ และฝูงไก่เดินเล่น (เก็บไข่ไก่สดทุก 20 นาที • 20m cycle)', yard: 6, swatch: '#c19a6b', modelFile: 'chicken.glb', icon: '🐔' },
  { type: 6, name: 'หอส่งน้ำฟาร์ม', nameEn: 'Water Tower', desc: 'หอแท็งก์น้ำไม้พร้อมบันไดตรวจการและโครงค้ำถ่อ (water-tower.glb)', yard: 5, swatch: '#0288d1', modelFile: 'water-tower.glb', icon: '🚰', cost: 5000 },
  { type: 7, name: 'กังหันลมฟาร์ม', nameEn: 'Windmill', desc: 'กังหันลมโบราณใบพัดผ้าใบหมุนรับลมธรรมชาติ (windmill.glb)', yard: 6, swatch: '#f57c00', modelFile: 'windmill.glb', icon: '🌾', cost: 8000 },
  { type: 8, name: 'สถานีรถไฟชนบท', nameEn: 'Train Station', desc: 'สถานีชานชาลารถไฟพร้อมรางเหล็ก นาฬิกา และม้านั่ง (train-station.glb)', yard: 8, swatch: '#2e7d32', modelFile: 'train-station.glb', icon: '🚉', cost: 12000 },
  { type: 9, name: 'เสาไฟฟ้าแรงสูง', nameEn: 'Power Line', desc: 'เสาโครงเหล็กถักแรงสูงพร้อมลูกถ้วยฉนวนและสายไฟ (power-line.glb)', yard: 4, swatch: '#546e7a', modelFile: 'power-line.glb', icon: '⚡', cost: 3500 },
  { type: 10, name: 'โคมไฟเสาโบราณ', nameEn: 'Spooky Lamp Post', desc: 'เสาไฟเหล็กดัดสไตล์วินเทจพร้อมตะเกียงเรืองแสง (spooky-lamp-post.glb)', yard: 3, swatch: '#1f2421', modelFile: 'spooky-lamp-post.glb', icon: '🏮', cost: 1500 },
  { type: 11, name: 'รถแทรกเตอร์ฟาร์ม', nameEn: 'Farm Tractor', desc: 'รถแทรกเตอร์การเกษตรสีแดงคลาสสิกพร้อมล้อยางบึกบึน (tractor.glb)', yard: 5, swatch: '#d32f2f', modelFile: 'tractor.glb', icon: '🚜', cost: 6500 },
  { type: 12, name: 'หมู่บ้านชนบท', nameEn: 'Rural Village', desc: 'กลุ่มบ้านพักชนบท ลานหิน และบ่อน้ำอธิษฐานใจกลางชุมชน (village.glb)', yard: 9, swatch: '#78716c', modelFile: 'village.glb', icon: '🏘️', cost: 15000 },
  { type: 13, name: 'เสาไฟฟ้าไม้ชนบท', nameEn: 'Utility Pole', desc: 'เสาโทรเลข/ไฟฟ้าไม้พร้อมหม้อแปลงและลูกถ้วยฉนวน (utility-pole.glb)', yard: 4, swatch: '#5d4037', modelFile: 'utility-pole.glb', icon: '🪵', cost: 2500 },
  { type: 14, name: 'บันไดหนีไฟเหล็ก', nameEn: 'Fire Escape', desc: 'โครงสร้างบันไดหนีไฟเหล็กพร้อมชานพักและบันไดลิง (fire-escape.glb)', yard: 4, swatch: '#212529', modelFile: 'fire-escape.glb', icon: '🪜', cost: 3000 },
  { type: 15, name: 'คอกม้าชนบท', nameEn: 'Horse Stable & Paddock', desc: 'คอกม้าไม้โอ๊คพร้อมซุ้มหลังคาพักผ่อน รางหญ้า กองฟาง และรั้วลานวิ่งสำหรับม้า (horse.glb)', yard: 7, swatch: '#795548', modelFile: 'horse.glb', icon: '🐴', cost: 4500 },
  { type: 16, name: 'คอกวัวชนบท', nameEn: 'Cow Barn & Corral', desc: 'คอกวัวไม้เนื้อแข็งพร้อมโรงนอน รางฟาง หญ้าแห้ง รางน้ำดื่ม และรั้วคอกลานกว้างสำหรับวัว (cow.glb)', yard: 7, swatch: '#8d6e63', modelFile: 'cow.glb', icon: '🐮', cost: 4200 },
  { type: 17, name: 'บ้านพักป่าดิบชื้น', nameEn: 'Jungle Villa & House', desc: 'บ้านพักตากอากาศสไตล์ป่าดิบชื้น ยกพื้นสูงพร้อมระเบียงชมวิว บันไดไม้ และหลังคาธรรมชาติ (jungle_house_3d_model_free.glb)', yard: 8, swatch: '#2e7d32', modelFile: 'jungle_house_3d_model_free.glb', icon: '🌴', cost: 1000 },
  { type: 18, name: 'บ้านพักคนสวนและคนงาน', nameEn: 'Worker & Gardener Quarters', desc: 'บ้านพักคนสวนและคนงาน (baankhonsuan.glb)', yard: 8, swatch: '#2e7d32', modelFile: 'baankhonsuan.glb', icon: '👷', cost: 2000 },
  { type: 19, name: 'รั้วไม้', nameEn: 'Wooden Fence', desc: 'รั้วไม้สำหรับกั้นพื้นที่และตกแต่งฟาร์ม (Wooden_ fence.glb)', yard: 2, swatch: '#a0743c', modelFile: 'Wooden_ fence.glb', icon: '🪵', cost: 80, collisionBox: { w: 2.0, d: 0.15 } },
  { type: 20, name: 'โรงเก็บผลผลิต', nameEn: 'Produce Storage Facility', desc: 'โรงเก็บผลผลิตการเกษตร หลังคาสูงโปร่ง ระบายอากาศดี ป้องกันความชื้นและแมลง (produce-storage-facility.glb)', yard: 8, swatch: '#795548', modelFile: 'produce-storage-facility.glb', icon: '🏭', cost: 9500 },
  { type: 21, name: 'โขดหินริมน้ำ', nameEn: 'River Rock', desc: 'โขดหินธรรมชาติจากลำธาร ใช้ตกแต่งริมน้ำหรือจัดสวนหิน (river_rock.glb)', yard: 3, swatch: '#607d8b', modelFile: 'river_rock.glb', icon: '🪨', cost: 150, collisionBox: { w: 1.8, d: 1.8 } },
  { type: 22, name: 'กลุ่มต้นโอ๊ค', nameEn: 'Oak Trees Cluster', desc: 'กลุ่มต้นโอ๊คโบราณใช้ตกแต่งฟาร์ม เพิ่มความร่มรื่น (oak_trees.glb)', yard: 6, swatch: '#2e7d32', modelFile: 'oak_trees.glb', icon: '🌳', cost: 80 },
  { type: 23, name: 'เส้นทางเดินป่าภูเขา', nameEn: 'Mountain Hiking Trail', desc: 'ป้ายบอกทางเดินป่าพร้อมกองหิน marker ใช้ตกแต่งขอบฟาร์ม เพิ่มบรรยากาศการผจญภัย (mountain_hiking_trail.glb)', yard: 3, swatch: '#8b6f47', modelFile: 'mountain_hiking_trail.glb', icon: '🥾', cost: 8 },
  { type: 24, name: 'เล้าเป็ดพร้อมสระน้ำ', nameEn: 'Duck Coop & Pond Run', desc: 'เล้าเป็ดไม้อบอุ่นพร้อมสระน้ำตื้น รังวางไข่ รางอาหาร และฝูงเป็ดเดินเตาะแตะในเล้า (duck_walk.glb)', yard: 6, swatch: '#2e7d32', modelFile: 'duck_walk.glb', icon: '🦆', cost: 120 },
  { type: 25, name: 'เครื่องกลั่นและหมักเครื่องดื่ม', nameEn: 'Brewery & Distillery', desc: 'โรงกลั่นและหมักเบียร์-เหล้าจากธัญพืช ข้าวบาร์เลย์ ถั่วเหลือง ข้าวโพด และผลไม้ เครื่องจักรขยับได้มีควันออกให้เห็น เดินเข้า-ออกได้อิสระ (beerproductionfactory.glb)', yard: 8, swatch: '#b45309', modelFile: 'beerproductionfactory.glb', icon: '🍺', cost: 10 },
  { type: 26, name: 'เตาอบขนมปังและพิซซ่า', nameEn: 'Conveyor Bakery & Pizza Oven', desc: 'เตาอบขนมปัง คุกกี้ และพิซซ่าพร้อมรางเลื่อนส่งขนมปังที่อบเสร็จไหลลงตะกร้าอัตโนมัติ รองรับความชำนาญ 3 ดาว (Bakery.glb)', yard: 7, swatch: '#d97706', modelFile: 'Bakery.glb', icon: '🍞', cost: 10 },
  { type: 27, name: 'เตาอบพาย', nameEn: 'Artisan Pie Oven', desc: 'เตาอบพายแครอท พายฟักทอง และพายเบคอน พร้อมรางเลื่อนส่งพายร้อนๆ ไหลลงตะกร้าอัตโนมัติ รองรับความชำนาญ 3 ดาว (PieOven.glb)', yard: 7, swatch: '#b91c1c', modelFile: 'PieOven.glb', icon: '🥧', cost: 10 },
  { type: 28, name: 'เครื่องผลิตอาหารสัตว์', nameEn: 'Animal Feed Making Machine', desc: 'เครื่องโม่และผสมอาหารสัตว์จากพืชไร่ เวลาการผลิตเป็นนาที เมื่อผลิตเสร็จถุงอาหารจะลอยไปเก็บเข้าคลังโดยอัตโนมัติ (Animal feed making machine.glb)', yard: 8, swatch: '#ca8a04', modelFile: 'Animal feed making machine.glb', icon: '🌾', cost: 10 },
  { type: 29, name: 'ร้านรับซื้อปลา', nameEn: 'Fish-Buying Shop', desc: 'ร้านรับซื้อปลาสดริมบ่อ ชั่งกิโลรับซื้อปลาทุกสายพันธุ์ที่ตกมาได้จากสระน้ำในราคาพิเศษ +15% พร้อมใบราคารับซื้อประจำวัน (Fish-buying shop.glb)', yard: 8, swatch: '#0284c7', modelFile: 'Fish-buying shop.glb', icon: '🐟', cost: 10 },
  { type: 30, name: 'แปลงผักแบบมีหลังคา', nameEn: 'Covered Vegetable Plot', desc: 'แปลงปลูกผักแบบมีหลังคาโปร่งแสงกันแดดกันฝน ปลูกผักได้ครบทุกชนิดในเกม โตไวขึ้น +25% และดินชุ่มชื้นข้ามคืน (2Vegetable _plot.glb)', yard: 5, swatch: '#43a047', modelFile: '2Vegetable _plot.glb', icon: '🌱', cost: 10 },
];

export const MAX_PER_HOUSE_TYPE = 1;
export const getMaxForHouseType = (type: number): number => {
  if (type === 5) return 3;
  if (type === 6) return 3;
  if (type === 7) return 3;
  if (type === 8) return 2;
  if (type === 9) return 8;
  if (type === 10) return 10;
  if (type === 11) return 3;
  if (type === 12) return 2;
  if (type === 13) return 8;
  if (type === 14) return 5;
  if (type === 15) return 3;
  if (type === 16) return 3;
  if (type === 17) return 3;
  if (type === 18) return 3;
  if (type === 19) return 200;
  if (type === 20) return 2;
  if (type === 21) return 50;
  if (type === 22) return 10;  
  if (type === 23) return 10;  
  if (type === 24) return 4;
  if (type === 25) return 3;
  if (type === 26) return 3;
  if (type === 27) return 3;
  if (type === 28) return 3;
  if (type === 29) return 3;
  if (type === 30) return 20;
  return MAX_PER_HOUSE_TYPE;
};

export type HousePartKey = 'roof' | 'wall' | 'fence' | 'floor' | 'chimney';

export const HOUSE_PART_KEYS: readonly HousePartKey[] = [
  'roof',
  'wall',
  'fence',
  'floor',
  'chimney',
] as const;

export interface PartStyleConfig {
  color?: string;
  textureDataUrl?: string;
  textureRepeat?: number;
}

export interface HousePartMeta {
  key: HousePartKey;
  icon: string;
  labelTh: string;
  labelEn: string;
}

export const HOUSE_PART_META: readonly HousePartMeta[] = [
  { key: 'roof', icon: '🏠', labelTh: 'หลังคา', labelEn: 'Roof' },
  { key: 'wall', icon: '🧱', labelTh: 'ผนังบ้าน', labelEn: 'Walls' },
  { key: 'fence', icon: '🪵', labelTh: 'รั้วบ้าน', labelEn: 'Fence' },
  { key: 'floor', icon: '🟫', labelTh: 'พื้นบ้าน', labelEn: 'Floor' },
  { key: 'chimney', icon: '🔥', labelTh: 'ปล่องไฟ', labelEn: 'Chimney' },
] as const;

export interface PlacedHouse {
  id: string;
  type: number;
  x: number;
  z: number;
  rot: number;
  customColor?: string;
  customTexture?: string;
  customTextureRepeat?: number;
  partStyles?: Partial<Record<HousePartKey, PartStyleConfig>>;
}

export interface StructureColorPreset {
  id: string;
  name: string;
  nameEn: string;
  hex: string;
  swatchClass: string;
}

export const STRUCTURE_COLOR_PRESETS: StructureColorPreset[] = [
  { id: 'barn_red', name: 'แดงโรงนา', nameEn: 'Barn Red', hex: '#d9483b', swatchClass: 'bg-[#d9483b]' },
  { id: 'amber_ochre', name: 'ส้มอำพัน', nameEn: 'Amber Ochre', hex: '#e88d38', swatchClass: 'bg-[#e88d38]' },
  { id: 'sunflower', name: 'เหลืองทานตะวัน', nameEn: 'Sunflower Gold', hex: '#eab308', swatchClass: 'bg-[#eab308]' },
  { id: 'meadow_sage', name: 'เขียวทุ่งหญ้า', nameEn: 'Meadow Sage', hex: '#4d9a62', swatchClass: 'bg-[#4d9a62]' },
  { id: 'harbor_teal', name: 'เขียวมินต์ทะเล', nameEn: 'Harbor Teal', hex: '#14b8a6', swatchClass: 'bg-[#14b8a6]' },
  { id: 'sky_cottage', name: 'ฟ้าสดใส', nameEn: 'Sky Cottage', hex: '#38bdf8', swatchClass: 'bg-[#38bdf8]' },
  { id: 'indigo_slate', name: 'น้ำเงินคราม', nameEn: 'Indigo Blue', hex: '#6366f1', swatchClass: 'bg-[#6366f1]' },
  { id: 'lavender', name: 'ม่วงลาเวนเดอร์', nameEn: 'Lavender Mist', hex: '#a855f7', swatchClass: 'bg-[#a855f7]' },
  { id: 'sakura_pink', name: 'ชมพูซากุระ', nameEn: 'Sakura Pink', hex: '#ec4899', swatchClass: 'bg-[#ec4899]' },
  { id: 'warm_cream', name: 'ขาวครีมอบอุ่น', nameEn: 'Warm Cream', hex: '#f5efe6', swatchClass: 'bg-[#f5efe6]' },
  { id: 'cedar_wood', name: 'น้ำตาลไม้สน', nameEn: 'Cedar Wood', hex: '#8d5a3b', swatchClass: 'bg-[#8d5a3b]' },
  { id: 'charcoal', name: 'เทาเข้มโมเดิร์น', nameEn: 'Charcoal Slate', hex: '#334155', swatchClass: 'bg-[#334155]' },
];

import type { AnimalType } from './animals';
import type { RockType } from './rocks';

export type PlacingCategory = 'house' | 'animal' | 'rock';

export interface PlacingState {
  category?: PlacingCategory;
  type: number;
  animalType?: AnimalType;
  rockType?: RockType;
  rot: number;
  editId?: string;
  x?: number;
  z?: number;
  customColor?: string;
  customTexture?: string;
  customTextureRepeat?: number;
  partStyles?: Partial<Record<HousePartKey, PartStyleConfig>>;
}
