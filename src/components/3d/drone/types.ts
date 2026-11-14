// src/components/3d/drone/types.ts
// 📦 Types + Constants ทั้งหมดของโดรน
import * as THREE from 'three';
import type { FarmPlot, PlacedTree, CropType, TreeType } from '../../../types/game';
import type { TimeOfDay } from '../../../types/player';

/* ═══════════════ Public Types ═══════════════ */
export type DroneMode = 'AUTO' | 'FOLLOW' | 'LEAD' | 'PATROL' | 'OFF';
export type DroneAltitude = 'GROUND' | 'LOW' | 'NORMAL' | 'HIGH';

/* ✅ NEW: Task Mode — กำหนดงานที่โดรนจะทำ */
export type DroneTaskMode =
  | 'ALL'           // ทำทุกอย่าง (default)
  | 'HARVEST_ONLY'  // เก็บเกี่ยว/เก็บผลไม้อย่างเดียว
  | 'WATER_ONLY'    // รดน้ำอย่างเดียว
  | 'PLANT_CROPS'   // ปลูกพืชอย่างเดียว
  | 'PLANT_TREES';  // ปลูกต้นไม้อย่่างเดียว

export interface DroneStats {
  harvested: number;
  watered: number;
  replanted: number;
  treesPlanted: number;
  jobsCompleted: number;
  totalDistance: number;
  flightTime: number;
}

export interface DroneAutoHarvestProps {
  isActive: boolean;
  mode?: DroneMode;
  onModeChange?: (mode: DroneMode) => void;
  altitude?: DroneAltitude;
  onAltitudeChange?: (alt: DroneAltitude) => void;
  scene: THREE.Scene | null;
  plots: FarmPlot[];
  trees: PlacedTree[];
  playerPosition?: { x: number; z: number; heading?: number };
  timeOfDay?: number | TimeOfDay;
  storageKey?: string;
  voiceEnabled?: boolean;
  interactPlot: (
    plotId: number, tool: any, seed: CropType, seedCount: number,
    spendSeed: any, addCrop: any, addXP: any,
    spendCoinsForDirectSeed?: (cost: number) => boolean
  ) => void;
  harvestTree: (treeId: string, addTreeHarvest: any, addXP: any) => boolean;
  addXP: (n: number) => void;
  earnCoins: (n: number) => void;
  addNotice: (msg: string, color: string) => void;
  selectedSeed: CropType;
  spendSeed: (crop: CropType) => boolean;
  addCrop: (crop: CropType) => void;
  addTreeHarvest: (treeType: any, count?: number) => void;
  waterPlot: (plotId: number) => boolean;
  replantPlot: (
    plotId: number, seed: CropType,
    spendSeed?: (c: CropType) => boolean,
    spendCoinsForDirectSeed?: (cost: number) => boolean
  ) => boolean;
  spendCoins?: (amount: number) => boolean;
  obstacles?: Array<{ x: number; z: number; radius: number }>;
  seedCounts?: Record<CropType, number>;
  saplingCounts?: Record<TreeType, number>;
  spendSapling?: (type: TreeType) => boolean;
  plantTree?: (
    gx: number, gz: number, treeType: TreeType,
    spendSapling: (type: TreeType) => boolean,
    addXP: (amt: number) => void,
    houses: any[], plots: FarmPlot[], rocks: any[], map2Unlocked: boolean
  ) => boolean;
  isCellFree?: (
    gx: number, gz: number,
    houses: any[], plots: FarmPlot[], rocks: any[], map2Unlocked: boolean
  ) => { free: boolean; reason?: string };
  houses?: any[];
  rocks?: any[];
  map2Unlocked?: boolean;
}

/* ═══════════════ Internal Types ═══════════════ */
export type Phase =
  | 'IDLE' | 'TAKEOFF' | 'LANDING'
  | 'TRAVEL_TO' | 'HARVESTING' | 'WATERING' | 'REPLANTING' | 'PLANTING_TREE'
  | 'VERIFYING' | 'TRAVEL_HOME' | 'UNLOADING' | 'CHARGING'
  | 'FOLLOWING' | 'LEADING' | 'PATROLLING';

export type JobKind = 'HARVEST' | 'WATER' | 'REPLANT' | 'PLANT_TREE';

export interface Cargo {
  kind: 'plot' | 'tree';
  job: JobKind;
  id: string;
  label: string;
  treeType?: TreeType;
  gridX?: number;
  gridZ?: number;
}

export interface DroneTarget {
  pos: THREE.Vector3;
  cargo: Cargo;
}

/* ═══════════════ Constants ═══════════════ */
export const DRONE_SPEED = 6;
export const GROUND_SPEED = 4;
export const HARVEST_DELAY = 0.7;
export const WATER_DELAY = 0.5;
export const REPLANT_DELAY = 0.6;
export const PLANT_TREE_DELAY = 0.8;
export const VERIFY_DELAY = 0.2;
export const UNLOAD_DELAY = 0.4;
export const CHARGE_DELAY = 2.5;
export const TAKEOFF_DURATION = 0.6;
export const LANDING_DURATION = 0.6;
export const CARGO_CAPACITY = 4;
export const BATTERY_MAX = 12;
export const SKIP_TTL_MS = 5000;

export const FOLLOW_DISTANCE = 2.2;
export const LEAD_DISTANCE = 2.5;
export const PATROL_RADIUS = 14;
export const PATROL_SPEED = 0.6;
export const MAX_FOLLOW_SPEED = 14;

export const NIGHT_START = 18;
export const NIGHT_END = 6;
export const SPOTLIGHT_INTENSITY = 3.5;
export const SPOTLIGHT_DISTANCE = 18;

export const JOB_PRIORITY: Record<JobKind, number> = {
  HARVEST: 4, WATER: 3, REPLANT: 2, PLANT_TREE: 1,
};

export const DEFAULT_STATS: DroneStats = {
  harvested: 0, watered: 0, replanted: 0, treesPlanted: 0,
  jobsCompleted: 0, totalDistance: 0, flightTime: 0,
};

export const STORAGE_KEY_DEFAULT = 'beam_farm_drone_v3';
export const TASK_MODE_STORAGE_KEY = 'beam_farm_drone_taskMode';   /* ✅ NEW */