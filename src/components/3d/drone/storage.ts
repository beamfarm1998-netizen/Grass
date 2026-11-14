// src/components/3d/drone/storage.ts
import type { DroneMode, DroneAltitude, DroneStats } from './types';
import { DEFAULT_STATS } from './types';

export function loadDronePrefs(key: string): {
  mode: DroneMode; altitude: DroneAltitude; stats: DroneStats;
} {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode ?? 'AUTO',
        altitude: parsed.altitude ?? 'GROUND',
        stats: { ...DEFAULT_STATS, ...(parsed.stats ?? {}) },
      };
    }
  } catch {}
  return { mode: 'AUTO', altitude: 'GROUND', stats: { ...DEFAULT_STATS } };
}

export function saveDronePrefs(
  key: string, mode: DroneMode, altitude: DroneAltitude, stats: DroneStats
) {
  try {
    localStorage.setItem(key, JSON.stringify({ mode, altitude, stats }));
  } catch {}
}