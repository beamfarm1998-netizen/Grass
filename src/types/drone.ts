// src/types/drone.ts
// 📦 Central Types & Configurations for Beam Farm 3D Drone System

import type { FarmPlot, PlacedTree, CropType, TreeType } from './game';
import type { TimeOfDay } from './player';

export type DroneMode = 'AUTO' | 'FOLLOW' | 'LEAD' | 'PATROL' | 'OFF';
export type DroneAltitude = 'GROUND' | 'LOW' | 'NORMAL' | 'HIGH';

export type DroneTaskMode =
  | 'ALL'           // All tasks
  | 'HARVEST_ONLY'  // Crops & fruits only
  | 'WATER_ONLY'    // Water plots only
  | 'PLANT_CROPS'   // Plant vegetable seeds only
  | 'PLANT_TREES';  // Plant tree saplings only

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
  pos: { x: number; y: number; z: number };
  cargo: Cargo;
}

export interface DroneStats {
  harvested: number;
  watered: number;
  replanted: number;
  treesPlanted: number;
  jobsCompleted: number;
  totalDistance: number;
  flightTime: number;
}

export interface DroneSettings {
  mode: DroneMode;
  altitude: DroneAltitude;
  taskMode: DroneTaskMode;
  voiceEnabled: boolean;
  radarEnabled: boolean;
}

export const DRONE_MODE_CONFIG = {
  followDistance: 2.2,
  leadDistance: 2.5,
  patrolRadius: 14,
  patrolSpeed: 0.6,
  droneSpeed: 6.0,
  groundSpeed: 4.0,
  maxFollowSpeed: 14.0,
  batteryMax: 12,
  lowBatteryThreshold: 2, // ~20%
  cargoCapacity: 4,
  altitudeValues: {
    GROUND: 0.75,
    LOW: 2.0,
    NORMAL: 4.0,
    HIGH: 8.0,
  },
} as const;

export const DEFAULT_DRONE_STATS: DroneStats = {
  harvested: 0,
  watered: 0,
  replanted: 0,
  treesPlanted: 0,
  jobsCompleted: 0,
  totalDistance: 0,
  flightTime: 0,
};
