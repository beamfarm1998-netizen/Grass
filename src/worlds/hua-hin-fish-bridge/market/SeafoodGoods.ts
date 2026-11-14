// src/worlds/hua-hin-fish-bridge/market/SeafoodGoods.ts
// ขั้น 3: สินค้าทะเล "ซื้อมาขายต่อ" — ซื้อที่สะพานปลา (ถูกตอนเช้า) → ขายที่ร้านรับซื้อที่ฟาร์ม
// logic ล้วน ไม่มี UI/storage. ตัวเลขทั้งหมดปรับสมดุลได้ที่ GOODS / ค่าคงที่ด้านล่างจุดเดียว
import type { VendorRoleId } from '../environment/PierVendors';
import { getDayKey } from './VendorMarket';

export type GoodId =
  | 'mackerel' | 'sea-bass'          // อาหารทะเลสด
  | 'shrimp' | 'crab'                // กุ้ง ปู ปลา
  | 'squid-fresh'                    // ปลาหมึก
  | 'blood-cockle' | 'green-mussel'  // หอยทะเล
  | 'dried-squid' | 'shrimp-paste';  // ของฝาก (เก็บได้นานกว่า)

export interface SeafoodGood {
  id: GoodId;
  nameTh: string;
  icon: string;
  role: VendorRoleId;
  /** ราคาซื้อฐานที่สะพานปลา (เหรียญ/หน่วย) */
  buyBase: number;
  /** ราคารับซื้อฐานที่ฟาร์ม (เหรียญ/หน่วย) — ปกติสูงกว่า buyBase 25–55% */
  farmBase: number;
  /** อายุสดเต็มราคา (วัน) หลังจากนั้นราคาตก; ของแห้งเก็บได้นานกว่า */
  freshDays: number;
  xp: number;
}

export const GOODS: readonly SeafoodGood[] = [
  { id: 'mackerel', nameTh: 'ปลาทู', icon: '🐟', role: 'fresh-seafood', buyBase: 12, farmBase: 17, freshDays: 1, xp: 1 },
  { id: 'sea-bass', nameTh: 'ปลากะพง', icon: '🐠', role: 'fresh-seafood', buyBase: 40, farmBase: 58, freshDays: 1, xp: 2 },
  { id: 'shrimp', nameTh: 'กุ้งทะเล', icon: '🦐', role: 'shrimp-crab-fish', buyBase: 30, farmBase: 44, freshDays: 1, xp: 2 },
  { id: 'crab', nameTh: 'ปูม้า', icon: '🦀', role: 'shrimp-crab-fish', buyBase: 55, farmBase: 80, freshDays: 1, xp: 3 },
  { id: 'squid-fresh', nameTh: 'ปลาหมึกสด', icon: '🦑', role: 'squid', buyBase: 35, farmBase: 50, freshDays: 1, xp: 2 },
  { id: 'blood-cockle', nameTh: 'หอยแครง', icon: '🐚', role: 'shellfish', buyBase: 18, farmBase: 26, freshDays: 1, xp: 1 },
  { id: 'green-mussel', nameTh: 'หอยแมลงภู่', icon: '🦪', role: 'shellfish', buyBase: 14, farmBase: 20, freshDays: 1, xp: 1 },
  { id: 'dried-squid', nameTh: 'หมึกแห้ง', icon: '🥡', role: 'souvenir', buyBase: 60, farmBase: 84, freshDays: 6, xp: 3 },
  { id: 'shrimp-paste', nameTh: 'กะปิหวาน', icon: '🫙', role: 'souvenir', buyBase: 25, farmBase: 34, freshDays: 10, xp: 2 },
];

const BY_ID = new Map<GoodId, SeafoodGood>(GOODS.map((g) => [g.id, g]));
export const getGood = (id: string): SeafoodGood | undefined => BY_ID.get(id as GoodId);
export const goodsOfRole = (role: VendorRoleId): SeafoodGood[] => GOODS.filter((g) => g.role === role);

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** ผันผวนรายวันของแต่ละสินค้า 0.85–1.25 (ฝั่งซื้อ) — วันเดียวกันได้ค่าเดิม */
export function pierDaily(goodId: GoodId, dayKey = getDayKey()): number {
  return Number((0.85 + hash01(`buy:${dayKey}:${goodId}`) * 0.4).toFixed(2));
}
/** ผันผวนรายวันฝั่งฟาร์ม 0.85–1.30 (คนละ seed กับฝั่งซื้อ → บางวันส่วนต่างหด/ขาดทุนได้) */
export function farmDaily(goodId: GoodId, dayKey = getDayKey()): number {
  return Number((0.85 + hash01(`farm:${dayKey}:${goodId}`) * 0.45).toFixed(2));
}

/** ส่วนลดตอนเช้า (เวลาเครื่อง): ก่อน 08:00 ×0.80 / ก่อน 11:00 ×0.90 / ก่อน 16:00 ×1.00 / หลังจากนั้น ×1.10 */
export function timeOfDayMultiplier(d: Date = new Date()): number {
  const h = d.getHours();
  return h < 8 ? 0.8 : h < 11 ? 0.9 : h < 16 ? 1.0 : 1.1;
}
export function timeOfDayLabel(d: Date = new Date()): string {
  const h = d.getHours();
  return h < 8 ? '🌅 ตลาดเช้า ลด 20%' : h < 11 ? '☀️ สายๆ ลด 10%' : h < 16 ? '🌤️ ราคาปกติ' : '🌇 เย็นแล้ว แพงขึ้น 10%';
}

export function buyPrice(goodId: GoodId, now: Date = new Date()): number {
  const g = BY_ID.get(goodId);
  if (!g) return 0;
  return Math.max(1, Math.round(g.buyBase * pierDaily(goodId, getDayKey(now)) * timeOfDayMultiplier(now)));
}

/** ตัวคูณความสด: อายุ ≤ freshDays = 1.0, เกิน 1 วัน = 0.7, เกิน 2 วัน = 0.4, เกินกว่านั้น = 0.15 */
export function freshnessMultiplier(goodId: GoodId, boughtDay: string, now: Date = new Date()): number {
  const g = BY_ID.get(goodId);
  if (!g) return 0;
  const age = daysBetween(boughtDay, getDayKey(now));
  const over = age - g.freshDays;
  return over <= 0 ? 1 : over === 1 ? 0.7 : over === 2 ? 0.4 : 0.15;
}

export function farmSellPrice(goodId: GoodId, boughtDay: string, now: Date = new Date()): number {
  const g = BY_ID.get(goodId);
  if (!g) return 0;
  return Math.max(1, Math.round(g.farmBase * farmDaily(goodId, getDayKey(now)) * freshnessMultiplier(goodId, boughtDay, now)));
}

function daysBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00`);
  const pb = Date.parse(`${b}T00:00:00`);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return 0;
  return Math.max(0, Math.round((pb - pa) / 86400000));
}
