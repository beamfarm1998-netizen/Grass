// src/utils/fishMarketStorage.ts
import { IndexedDBStorage } from '../fishing/storage/IndexedDBStorage';
import { SaveMigration } from '../fishing/storage/SaveMigration';
import {
  CaughtFishRecord,
  createDefaultSaveData,
  FishRarity,
  SaveData,
} from '../fishing/storage/SaveSchema';
import { SaveValidator } from '../fishing/storage/SaveValidator';
import { PRIMARY_SAVE_SLOT } from '../fishing/storage/SaveVersion';
import { FishRegistry } from '../fishing/systems/fish/FishRegistry';
import type { FishSpeciesSpec } from '../fishing/systems/fish/data/FishCatalog';
import thFishingLocale from '../fishing/localization/locales/th.json';
import enFishingLocale from '../fishing/localization/locales/en.json';

/** โบนัสร้านรับซื้อปลาริมบ่อ (+15% จากราคาปกติเมื่อนำมาชั่งกิโลขายสดที่ร้าน) */
export const FISH_SHOP_BONUS_RATE = 1.15;

export const FISH_BAG_CHANGED_EVENT = 'beam-fish-bag-changed';

const _storage = new IndexedDBStorage();
let _txChain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = _txChain.then(task, task);
  _txChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function notifyFishBagChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FISH_BAG_CHANGED_EVENT));
  }
}

export function subscribeFishBagChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener();
  window.addEventListener(FISH_BAG_CHANGED_EVENT, handler);
  return () => window.removeEventListener(FISH_BAG_CHANGED_EVENT, handler);
}

async function readFishingSave(): Promise<SaveData> {
  const raw = await _storage.get<unknown>(PRIMARY_SAVE_SLOT);
  if (!raw) {
    return createDefaultSaveData();
  }
  const migrated = SaveMigration.migrate(raw);
  if (SaveValidator.isValid(migrated)) {
    return migrated;
  }
  return createDefaultSaveData();
}

async function writeFishingSave(data: SaveData): Promise<void> {
  data.updatedAtIso = new Date().toISOString();
  await _storage.set(PRIMARY_SAVE_SLOT, data);
}

export function getFishShopPrice(record: Pick<CaughtFishRecord, 'valueCoins'>): number {
  return Math.max(1, Math.round((record.valueCoins || 0) * FISH_SHOP_BONUS_RATE));
}

export function getFishShopXp(record: Pick<CaughtFishRecord, 'weightKg'>): number {
  return Math.max(6, Math.round((record.weightKg || 0.5) * 8));
}

export function getFishShopPricePerKg(baseCoinsPerKg: number): number {
  return Math.max(1, Math.round(baseCoinsPerKg * FISH_SHOP_BONUS_RATE));
}

export async function loadFishBag(): Promise<CaughtFishRecord[]> {
  try {
    const save = await readFishingSave();
    const list = Array.isArray(save.inventory) ? [...save.inventory] : [];
    list.sort((a, b) => {
      const ta = Date.parse(a.caughtAtIso || '') || 0;
      const tb = Date.parse(b.caughtAtIso || '') || 0;
      return tb - ta;
    });
    return list;
  } catch {
    return [];
  }
}

export interface SellSingleFishResult {
  sold: CaughtFishRecord | null;
  coinsEarned: number;
  xpEarned: number;
  remaining: CaughtFishRecord[];
}

export function sellFishInShop(recordId: string): Promise<SellSingleFishResult> {
  return runSerialized(async () => {
    const save = await readFishingSave();
    const idx = save.inventory.findIndex((item) => item.id === recordId);
    if (idx === -1) {
      return {
        sold: null,
        coinsEarned: 0,
        xpEarned: 0,
        remaining: [...save.inventory],
      };
    }

    const [sold] = save.inventory.splice(idx, 1);
    const coinsEarned = getFishShopPrice(sold);
    const xpEarned = getFishShopXp(sold);

    // Keep fishing mode wallet synchronized so tackle upgrades also reflect fish sales
    save.coins = Math.max(0, (save.coins || 0) + coinsEarned);
    await writeFishingSave(save);
    notifyFishBagChanged();

    const remaining = [...save.inventory].sort(
      (a, b) => (Date.parse(b.caughtAtIso || '') || 0) - (Date.parse(a.caughtAtIso || '') || 0)
    );
    return {
      sold,
      coinsEarned,
      xpEarned,
      remaining,
    };
  });
}

export interface SellAllFishResult {
  count: number;
  totalWeightKg: number;
  coinsEarned: number;
  xpEarned: number;
  remaining: CaughtFishRecord[];
}

export function sellAllFishInShop(): Promise<SellAllFishResult> {
  return runSerialized(async () => {
    const save = await readFishingSave();
    if (!Array.isArray(save.inventory) || save.inventory.length === 0) {
      return {
        count: 0,
        totalWeightKg: 0,
        coinsEarned: 0,
        xpEarned: 0,
        remaining: [],
      };
    }

    const count = save.inventory.length;
    let totalWeightKg = 0;
    let coinsEarned = 0;
    let xpEarned = 0;

    for (const item of save.inventory) {
      totalWeightKg += item.weightKg || 0;
      coinsEarned += getFishShopPrice(item);
      xpEarned += getFishShopXp(item);
    }

    save.inventory = [];
    save.coins = Math.max(0, (save.coins || 0) + coinsEarned);
    await writeFishingSave(save);
    notifyFishBagChanged();

    return {
      count,
      totalWeightKg: Number(totalWeightKg.toFixed(2)),
      coinsEarned,
      xpEarned,
      remaining: [],
    };
  });
}

export async function clearFishingSaveData(): Promise<void> {
  await runSerialized(async () => {
    await _storage.delete(PRIMARY_SAVE_SLOT);
    notifyFishBagChanged();
  });
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export interface LocalizedFishSpeciesInfo {
  spec: FishSpeciesSpec;
  name: string;
  desc: string;
  bodyCss: string;
  bellyCss: string;
  accentCss: string;
}

export function getFishSpeciesInfo(
  speciesId: string,
  lang: 'th' | 'en'
): LocalizedFishSpeciesInfo {
  const spec = FishRegistry.getById(speciesId);
  const dict = (lang === 'en' ? enFishingLocale : thFishingLocale) as Record<string, string>;
  const name = dict[spec.nameKey] || spec.id;
  const desc = dict[spec.descKey] || '';
  return {
    spec,
    name,
    desc,
    bodyCss: hexToCss(spec.bodyColorHex),
    bellyCss: hexToCss(spec.bellyColorHex),
    accentCss: hexToCss(spec.accentStripeHex),
  };
}

export function getAllFishSpeciesCatalog(): readonly FishSpeciesSpec[] {
  return FishRegistry.getAll();
}

export interface FishRarityVisualInfo {
  label: string;
  badgeClass: string;
  textClass: string;
}

export function getFishRarityInfo(
  rarity: FishRarity,
  lang: 'th' | 'en'
): FishRarityVisualInfo {
  const dict = (lang === 'en' ? enFishingLocale : thFishingLocale) as Record<string, string>;
  const label = dict[`rarity.${rarity}`] || rarity;

  switch (rarity) {
    case 'legendary':
      return {
        label,
        badgeClass: 'bg-amber-400/35 text-amber-950 border-amber-500/50',
        textClass: 'text-amber-800',
      };
    case 'trophy':
      return {
        label,
        badgeClass: 'bg-orange-400/30 text-orange-950 border-orange-500/45',
        textClass: 'text-orange-800',
      };
    case 'rare':
      return {
        label,
        badgeClass: 'bg-purple-400/25 text-purple-950 border-purple-500/40',
        textClass: 'text-purple-800',
      };
    case 'uncommon':
      return {
        label,
        badgeClass: 'bg-sky-400/25 text-sky-950 border-sky-500/40',
        textClass: 'text-sky-800',
      };
    default:
      return {
        label,
        badgeClass: 'bg-emerald-400/25 text-emerald-950 border-emerald-600/35',
        textClass: 'text-emerald-900',
      };
  }
}

// ───────── ขายปลาให้พ่อค้าที่สะพานปลา (ราคากำหนดเองต่อคนขาย) ─────────
export interface SellFishAtPriceResult {
  count: number;
  totalWeightKg: number;
  coinsEarned: number;
  xpEarned: number;
  remaining: CaughtFishRecord[];
}

/**
 * ขายปลาตาม id ที่ระบุ โดยให้ผู้เรียกกำหนดราคาต่อตัว (priceFor)
 * ใช้ transaction แบบ serialized เดียวกับร้านรับซื้อเดิม → ไม่ชนกับการขายที่ฟาร์ม
 */
export function sellFishAtPrice(
  recordIds: readonly string[],
  priceFor: (record: CaughtFishRecord) => number
): Promise<SellFishAtPriceResult> {
  return runSerialized(async () => {
    const save = await readFishingSave();
    const wanted = new Set(recordIds);
    const keep: CaughtFishRecord[] = [];
    let count = 0;
    let totalWeightKg = 0;
    let coinsEarned = 0;
    let xpEarned = 0;
    for (const item of save.inventory ?? []) {
      if (wanted.has(item.id)) {
        count += 1;
        totalWeightKg += item.weightKg || 0;
        coinsEarned += Math.max(1, Math.round(priceFor(item)));
        xpEarned += getFishShopXp(item);
      } else {
        keep.push(item);
      }
    }
    if (count === 0) {
      return { count: 0, totalWeightKg: 0, coinsEarned: 0, xpEarned: 0, remaining: [...keep] };
    }
    save.inventory = keep;
    save.coins = Math.max(0, (save.coins || 0) + coinsEarned);
    await writeFishingSave(save);
    notifyFishBagChanged();
    return { count, totalWeightKg: Number(totalWeightKg.toFixed(2)), coinsEarned, xpEarned, remaining: [...keep] };
  });
}