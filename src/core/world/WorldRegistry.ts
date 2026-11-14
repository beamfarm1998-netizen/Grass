// src/core/world/WorldRegistry.ts
// ทะเบียน World ของเกม — ที่เดียวที่กำหนด World ID / จุดเกิด / ปลายทางกลับ
// หมายเหตุ: Farm World ยังเป็นฉากเดิมใน FarmScene.tsx (ไม่ถูกแก้) ทะเบียนนี้แค่ "ตั้งชื่อ" ให้ระบบเดินทางอ้างอิง

export const WORLD_IDS = {
  FARM: 'farm',
  HUA_HIN_FISH_BRIDGE: 'hua-hin-fish-bridge',
} as const;

export type WorldId = (typeof WORLD_IDS)[keyof typeof WORLD_IDS];

export interface WorldSpawn {
  x: number;
  z: number;
  /** เรเดียน: 0 = หันไปทาง +Z (ตามระบบของ FarmPlayer3D) */
  heading: number;
}

export interface WorldDefinition {
  id: WorldId;
  nameTh: string;
  nameEn: string;
  icon: string;
  spawn: WorldSpawn;
  /** World ที่กลับไปเมื่อกด Return Gateway */
  returnTo: WorldId | null;
}

export const WORLD_REGISTRY: Readonly<Record<WorldId, WorldDefinition>> = {
  [WORLD_IDS.FARM]: {
    id: WORLD_IDS.FARM,
    nameTh: 'ฟาร์ม',
    nameEn: 'Farm',
    icon: '🌾',
    // ค่าเดียวกับ DEFAULT ของ FarmPlayer3D (ฟาร์มจำตำแหน่งเองผ่าน session save เดิม)
    spawn: { x: -1, z: 3, heading: 0 },
    returnTo: null,
  },
  [WORLD_IDS.HUA_HIN_FISH_BRIDGE]: {
    id: WORLD_IDS.HUA_HIN_FISH_BRIDGE,
    nameTh: 'สะพานปลาหัวหิน',
    nameEn: 'Hua Hin Fish Bridge',
    icon: '🌉',
    // ยืนกลางลานหน้าซุ้มทางเข้า หันหน้าเข้าซุ้ม (heading 0 = +Z = ทิศไปทางซุ้ม/ทะเล)
    spawn: { x: 0, z: -24, heading: 0 },
    returnTo: WORLD_IDS.FARM,
  },
};

export function isWorldId(value: unknown): value is WorldId {
  return value === WORLD_IDS.FARM || value === WORLD_IDS.HUA_HIN_FISH_BRIDGE;
}

export function getWorldDefinition(id: WorldId): WorldDefinition {
  return WORLD_REGISTRY[id];
}
