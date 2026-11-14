// src/utils/saveReset.ts
import { clearFishingSaveData } from './fishMarketStorage';
// ✅ FIX BUG-RESET-2: import reset cache ของ World state
import { resetWorldStateCache } from '../worlds/hua-hin-fish-bridge/HuaHinFishBridgeState';

let _saveSuppressed = false;
const _resetListeners = new Set<() => void>();

export const FARM_SAVE_KEYS = [
  'beam_farm_3d_save_map_v2_stats',
  'beam_farm_3d_save_map_v2_crops',
  'beam_farm_3d_save_map_v2_seeds',
  'beam_farm_3d_save_map_v2_saplings',
  'beam_farm_3d_save_map_v2_tree_fruits',
  'beam_farm_3d_save_map_v2_wood',
  'beam_farm_3d_save_map_v2_duck_eggs',
  'beam_farm_3d_save_map_v2_duck_feathers',
  'beam_farm_3d_save_map_v2_processed_feathers',
  'beam_farm_3d_save_map_v2_drinks',
  'beam_farm_3d_save_map_v2_brewing_jobs',
  'beam_farm_3d_save_map_v2_baked_goods',
  'beam_farm_3d_save_map_v2_baking_jobs',
  'beam_farm_3d_save_map_v2_oven_mastery',
  'beam_farm_3d_save_map_v2_animal_feeds',
  'beam_farm_3d_save_map_v2_feed_jobs',
  'beam_farm_3d_save_map_v2_plots',
  'beam_farm_3d_save_map_v2_zones',
  'beam_farm_3d_save_map_v2_houses',
  'beam_farm_3d_save_map_v2_animals',
  'beam_farm_3d_save_map_v2_session',
  'beam_farm_3d_save_map_v2_saved_at',
  'beam_farm_3d_rocks_v1',
  'beam_farm_3d_trees_v1',
  'beam_farm_3d_trees_v2',
  'beam_farm_name',
  'beam_farm_user_account',
  'beam_farm_sync_code',
  'beam_farm_fish_shop_seeded_v1',
  'beam_farm_player_outfit_v1',
] as const;

export const PRESERVED_PREF_KEYS: ReadonlySet<string> = new Set([
  'beam_farm_lang',
  'beam_farm_wasd_enabled',
  'beam_farm_touch_slide_enabled',
  'beam_farm_touch_slide_walk_v2',
  'beam_farm_player_hidden',
  'beam_farm_finger_swipe_enabled',
  'beam_farm_structure_edit_enabled',
  'beam_farm_structure_edit_click_mode',
  'beam_farm_graphics_4k_enabled',
  'beam_farm_graphics_quality_mode',
  'beam_farm_sound_sfx_enabled',
  'beam_farm_music_enabled',
]);

export const FARM_AUTOSAVE_IDB_NAME = 'beam_farm_autosave_idb';

export function registerSaveResetListener(listener: () => void): () => void {
  _resetListeners.add(listener);
  return () => {
    _resetListeners.delete(listener);
  };
}

export function isSaveSuppressed(): boolean {
  return _saveSuppressed;
}

export function resumeSavePersistence(): void {
  _saveSuppressed = false;
}

/**
 * ✅ FIX BUG-RESET-1: เปลี่ยนเป็น async + `finally` resume เสมอ
 * - เดิม: ไม่เคยเรียก resumeSavePersistence() → autosave ตายถาวรหลังกด "เริ่มใหม่"
 * - เดิม: clearFishingSaveData() ไม่ถูก await → resume ก่อน IndexedDB ล้างเสร็จ
 * ✅ FIX BUG-RESET-2: เพิ่ม resetWorldStateCache() ล้าง cache ใน memory
 *
 * ⚠️ Caller ทุกจุดต้องเปลี่ยนเป็น `await wipeAllFarmSaveData()`
 */
export async function wipeAllFarmSaveData(): Promise<void> {
  _saveSuppressed = true;
  try {
    // 1. Purge in-memory caches, pending auto-save timers, and IndexedDB stores first
    _resetListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Isolate individual listener errors
      }
    });

    // 2. Remove all farm save keys and texture mirrors from localStorage
    try {
      for (const key of FARM_SAVE_KEYS) {
        localStorage.removeItem(key);
      }
      const extraKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('beam_farm_') && !PRESERVED_PREF_KEYS.has(k)) {
          extraKeys.push(k);
        }
      }
      for (const k of extraKeys) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore restricted storage environments
    }

    // 3. Reset in-memory caches ของ World state (คีย์ถูกล้างในข้อ 2 แล้ว แต่ cache ใน memory ยังค้าง)
    resetWorldStateCache();

    // 4. Clear fishing mode IndexedDB save slot — ต้อง await
    await clearFishingSaveData();
  } finally {
    // ✅ resume เสมอ ไม่ว่า success หรือ error — กัน autosave ตายถาวร
    resumeSavePersistence();
  }
}