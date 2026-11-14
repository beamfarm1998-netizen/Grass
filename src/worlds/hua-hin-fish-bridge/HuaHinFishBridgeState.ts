// src/worlds/hua-hin-fish-bridge/HuaHinFishBridgeState.ts
// บันทึก "World ปัจจุบัน + ตำแหน่งผู้เล่นต่อ World" แยก key ใหม่ ไม่แตะ Save Schema เดิม
// - key ขึ้นต้นด้วย beam_farm_ → ถูกล้างอัตโนมัติเมื่อกด "เริ่มเล่นเกมใหม่" (saveReset.ts)
// - Shared Player Data (เหรียญ/กระเป๋า/เลเวล) ยังอยู่ใน save เดิมทั้งหมด ไม่ถูกแตะ

import { safeGetLocalStorageItem, safeSetLocalStorageItem } from '../../utils/farmAutoSave';
import { isSaveSuppressed } from '../../utils/saveReset';
import { WORLD_IDS, isWorldId, type WorldId } from '../../core/world/WorldRegistry';

export const WORLD_STATE_STORAGE_KEY = 'beam_farm_world_state_v1';
export const WORLD_STATE_VERSION = 1;

export interface WorldPlayerPosition {
  x: number;
  z: number;
  heading: number;
}

export interface WorldSaveState {
  version: number;
  activeWorld: WorldId;
  positions: Partial<Record<WorldId, WorldPlayerPosition>>;
}

function defaultState(): WorldSaveState {
  return { version: WORLD_STATE_VERSION, activeWorld: WORLD_IDS.FARM, positions: {} };
}

function validPos(p: unknown): p is WorldPlayerPosition {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return [o.x, o.z, o.heading].every((n) => typeof n === 'number' && Number.isFinite(n));
}

// ✅ FIX Q-4: cache state ใน memory → autosave ไม่ต้อง parse JSON ซ้ำทุกครั้ง
let cachedState: WorldSaveState | null = null;

/** Migration: ไม่มี key / เวอร์ชันไม่รู้จัก → เริ่มที่ฟาร์ม (ปลอดภัยที่สุด) */
export function loadWorldState(): WorldSaveState {
  if (cachedState) return cachedState;
  try {
    const raw = safeGetLocalStorageItem(WORLD_STATE_STORAGE_KEY);
    if (!raw) {
      cachedState = defaultState();
      return cachedState;
    }
    const parsed = JSON.parse(raw) as Partial<WorldSaveState>;
    if (parsed.version !== WORLD_STATE_VERSION) {
      cachedState = defaultState();
      return cachedState;
    }
    const positions: WorldSaveState['positions'] = {};
    for (const id of Object.values(WORLD_IDS)) {
      const p = parsed.positions?.[id];
      if (validPos(p)) positions[id] = { x: p.x, z: p.z, heading: p.heading };
    }
    cachedState = {
      version: WORLD_STATE_VERSION,
      activeWorld: isWorldId(parsed.activeWorld) ? parsed.activeWorld : WORLD_IDS.FARM,
      positions,
    };
    return cachedState;
  } catch {
    cachedState = defaultState();
    return cachedState;
  }
}

function write(state: WorldSaveState): void {
  if (isSaveSuppressed()) return;
  cachedState = state;
  safeSetLocalStorageItem(WORLD_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function saveActiveWorld(world: WorldId): void {
  const s = loadWorldState();
  s.activeWorld = world;
  write(s);
}

export function saveWorldPosition(world: WorldId, pos: WorldPlayerPosition): void {
  const s = loadWorldState();
  s.positions[world] = { x: pos.x, z: pos.z, heading: pos.heading };
  write(s);
}

export function getSavedWorldPosition(world: WorldId): WorldPlayerPosition | null {
  return loadWorldState().positions[world] ?? null;
}

/**
 * ✅ FIX Q-5: เรียกจาก saveReset.ts หลังล้าง localStorage
 * ไม่งั้น cache จะค้างค่าเก่า → กดเริ่มใหม่แล้วตำแหน่งไม่ reset
 */
export function resetWorldStateCache(): void {
  cachedState = null;
}