// src/worlds/hua-hin-fish-bridge/market/VendorMarket.ts
// กติการาคา/สิ่งที่พ่อค้าแต่ละหมวดรับซื้อ (logic ล้วน ไม่มี UI / ไม่แตะ storage)
//  - ราคาฐาน = valueCoins ของปลา (เหมือนร้านรับซื้อที่ฟาร์ม แต่ไม่มีโบนัส 15% ตายตัว)
//  - คูณ "ตัวคูณหมวด" (แต่ละคนชอบปลาต่างกัน) × "ตัวคูณรายวัน" (ขึ้นลงตามวัน เดาได้ว่าวันนี้คุ้มไหม)
// ขั้นถัดไป (ซื้อมาขายต่อ) ใช้ dailyMultiplier / dayKey ชุดเดียวกันนี้ต่อได้
import type { CaughtFishRecord, FishRarity } from '../../../fishing/storage/SaveSchema';
import type { VendorRoleId } from '../environment/PierVendors';

export interface RoleBuyRule {
  /** ระดับความหายากที่รับซื้อ (ว่าง = ไม่รับปลาน้ำจืดที่มีตอนนี้) */
  accepts: readonly FishRarity[];
  /** ตัวคูณหมวด */
  multiplier: number;
  thNote: string;
}

export const ROLE_BUY_RULES: Readonly<Record<VendorRoleId, RoleBuyRule>> = {
  'fresh-seafood': { accepts: ['common', 'uncommon', 'rare', 'trophy', 'legendary'], multiplier: 1.1, thNote: 'รับปลาทุกชนิด ราคามาตรฐาน' },
  'shrimp-crab-fish': { accepts: ['common', 'uncommon'], multiplier: 1.2, thNote: 'ชอบปลาตัวเล็ก-กลาง (common / uncommon) ให้ราคาดี' },
  squid: { accepts: [], multiplier: 1, thNote: 'รับเฉพาะปลาหมึก (ยังไม่มีสินค้าหมวดนี้ในเกม)' },
  shellfish: { accepts: [], multiplier: 1, thNote: 'รับเฉพาะหอยทะเล (ยังไม่มีสินค้าหมวดนี้ในเกม)' },
  souvenir: { accepts: ['rare', 'trophy', 'legendary'], multiplier: 1.25, thNote: 'รับปลาหายาก (rare ขึ้นไป) ไปทำของฝาก ให้ราคาสูง' },
};

/** คีย์วัน (เวลาท้องถิ่นของเครื่อง) เช่น 2026-11-10 */
export function getDayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** ตัวคูณรายวันต่อหมวด 0.90–1.20 (วันเดียวกัน = ค่าเดิมเสมอ ไม่ต้องเซฟ) */
export function dailyMultiplier(role: VendorRoleId, dayKey: string = getDayKey()): number {
  return Number((0.9 + hash01(`${dayKey}:${role}`) * 0.3).toFixed(2));
}

export type PriceTrend = 'up' | 'flat' | 'down';
export function trendOf(mult: number): PriceTrend {
  return mult >= 1.1 ? 'up' : mult <= 0.98 ? 'down' : 'flat';
}

export function vendorAccepts(role: VendorRoleId, record: Pick<CaughtFishRecord, 'rarity'>): boolean {
  return ROLE_BUY_RULES[role].accepts.includes(record.rarity);
}

export function vendorOffer(
  role: VendorRoleId,
  record: Pick<CaughtFishRecord, 'valueCoins' | 'rarity'>,
  dayKey: string = getDayKey()
): number {
  if (!vendorAccepts(role, record)) return 0;
  const base = record.valueCoins || 0;
  return Math.max(1, Math.round(base * ROLE_BUY_RULES[role].multiplier * dailyMultiplier(role, dayKey)));
}
