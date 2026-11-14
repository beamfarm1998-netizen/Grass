// src/worlds/hua-hin-fish-bridge/market/SeafoodBag.ts
// กระเป๋าสินค้าทะเลที่ซื้อมาขายต่อ — localStorage key ขึ้นต้น beam_farm_ → ล้างเองเมื่อ "เริ่มเล่นใหม่" (saveReset.ts)
// ไม่แตะ Save Schema เดิม / ไม่ cache ใน memory (อ่านสดทุกครั้ง ข้อมูลเล็ก) จึงไม่ต้องมี reset cache
import { safeGetLocalStorageItem, safeSetLocalStorageItem } from '../../../utils/farmAutoSave';
import { isSaveSuppressed } from '../../../utils/saveReset';
import { getDayKey } from './VendorMarket';
import { GOODS, getGood } from './SeafoodGoods';

export const SEAFOOD_BAG_KEY = 'beam_farm_seafood_bag_v1';
export const SEAFOOD_BAG_EVENT = 'beam-seafood-bag-changed';
export const SEAFOOD_BAG_MAX_UNITS = 60; // ความจุกระเป๋า (ขยายด้วยระบบเลเวลพ่อค้าในขั้น 5)

export interface SeafoodLot {
  goodId: string;
  qty: number;
  /** วันที่ซื้อ (YYYY-MM-DD) ใช้คำนวณความสด */
  boughtDay: string;
  /** ต้นทุนต่อหน่วย (ไว้โชว์กำไร/ขาดทุน) */
  unitCost: number;
}

function valid(l: unknown): l is SeafoodLot {
  if (!l || typeof l !== 'object') return false;
  const o = l as Record<string, unknown>;
  return typeof o.goodId === 'string' && !!getGood(o.goodId) && typeof o.boughtDay === 'string'
    && Number.isFinite(o.qty) && (o.qty as number) > 0 && Number.isFinite(o.unitCost);
}

export function loadSeafoodBag(): SeafoodLot[] {
  try {
    const raw = safeGetLocalStorageItem(SEAFOOD_BAG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: number; lots?: unknown[] };
    if (parsed.v !== 1 || !Array.isArray(parsed.lots)) return [];
    return parsed.lots.filter(valid).map((l) => ({ ...l, qty: Math.floor(l.qty) }));
  } catch {
    return [];
  }
}

function save(lots: SeafoodLot[]): void {
  if (isSaveSuppressed()) return;
  safeSetLocalStorageItem(SEAFOOD_BAG_KEY, JSON.stringify({ v: 1, lots }));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SEAFOOD_BAG_EVENT));
}

export function subscribeSeafoodBag(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SEAFOOD_BAG_EVENT, listener);
  return () => window.removeEventListener(SEAFOOD_BAG_EVENT, listener);
}

export const totalUnits = (lots: readonly SeafoodLot[]): number => lots.reduce((s, l) => s + l.qty, 0);

/** ใส่ของเข้ากระเป๋า (รวม lot เดียวกันถ้าสินค้า+วันที่ซื้อ+ต้นทุนเท่ากัน) คืน false ถ้าเกินความจุ */
export function addToSeafoodBag(goodId: string, qty: number, unitCost: number, now: Date = new Date()): boolean {
  if (!getGood(goodId) || qty <= 0) return false;
  const lots = loadSeafoodBag();
  if (totalUnits(lots) + qty > SEAFOOD_BAG_MAX_UNITS) return false;
  const day = getDayKey(now);
  const same = lots.find((l) => l.goodId === goodId && l.boughtDay === day && l.unitCost === unitCost);
  if (same) same.qty += qty;
  else lots.push({ goodId, qty, boughtDay: day, unitCost });
  save(lots);
  return true;
}

/** เอาออกทั้งหมด (ตอนขาย) คืนรายการที่เอาออก */
export function takeAllSeafood(): SeafoodLot[] {
  const lots = loadSeafoodBag();
  if (lots.length) save([]);
  return lots;
}

export { GOODS };
