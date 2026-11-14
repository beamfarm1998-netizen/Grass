// src/components/3d/scene/SceneGhostPreview.ts
import type { MutableRefObject } from 'react';
import {
  FarmPlot,
  GRID_MAX_X,
  GRID_MAX_Z,
  GRID_MIN_X,
  GRID_MIN_Z,
  gridToWorld,
  HOUSE_DEFS,
  PlacedHouse,
  PlacedRock,
  PlacedTree,
  PlacingState,
  RockType,
} from '../../../types/game';
import { isTerrainBlocked } from '../../../data/terrainFeatures';
import type { FarmHouses3D, GhostState } from '../FarmHouses';
import type { AnimalGhostState, FarmAnimals3D } from '../FarmAnimals';
import type { FarmRocks3D, RockGhostState } from '../FarmRocks';
import type { FarmGrass3D } from '../FarmGrass';
import type { FarmCameraControls } from '../FarmCameraControls';

export type AnyGhostState = GhostState | AnimalGhostState | RockGhostState;

export interface SceneGhostRefs {
  housesRef: MutableRefObject<FarmHouses3D | null>;
  animalsRef: MutableRefObject<FarmAnimals3D | null>;
  rocksRef: MutableRefObject<FarmRocks3D | null>;
  grassRef: MutableRefObject<FarmGrass3D | null>;
  controlsRef: MutableRefObject<FarmCameraControls | null>;
}

export interface RockValidationContext {
  unlockedZones?: number[];
  editId?: string;
  houses: PlacedHouse[];
  plots: FarmPlot[];
  trees: PlacedTree[];
  rocks: PlacedRock[];
}

export interface GhostReporter {
  report: (g: AnyGhostState | null) => void;
  resetCache: () => void;
}

export function createGhostReporter(
  getOnGhostChange: () => ((g: AnyGhostState | null) => void) | undefined
): GhostReporter {
  let lastKey = '';
  return {
    report(g: AnyGhostState | null) {
      const key = g ? `${g.x.toFixed(1)}|${g.z.toFixed(1)}|${g.valid}|${g.reason ?? ''}` : 'none';
      if (key === lastKey) return;
      lastKey = key;
      getOnGhostChange()?.(g);
    },
    resetCache() {
      lastKey = '';
    },
  };
}

export interface DoubleTapPlacementTracker {
  checkConfirmOnTap: (x: number, z: number, valid: boolean) => boolean;
  reset: () => void;
}

export function createDoubleTapPlacementTracker(): DoubleTapPlacementTracker {
  let lastTap: { x: number; z: number; time: number } | null = null;
  return {
    checkConfirmOnTap(x: number, z: number, valid: boolean): boolean {
      const now = Date.now();
      if (
        lastTap &&
        now - lastTap.time < 2500 &&
        Math.hypot(lastTap.x - x, lastTap.z - z) < 2.2 &&
        valid
      ) {
        lastTap = null;
        return true;
      }
      lastTap = { x, z, time: now };
      return false;
    },
    reset() {
      lastTap = null;
    },
  };
}

/**
 * ตรวจสอบตำแหน่งวางก้อนหินบนกริดฟาร์ม
 */
export function validateRockPlacement(
  gx: number,
  gz: number,
  _type: RockType,
  ctx: RockValidationContext
): { valid: boolean; reason?: string } {
  const map2Open = ctx.unlockedZones?.includes(5) ?? false;
  const minGx = map2Open ? -44 : -25;
  const maxGx = 25;
  const maxGz = 18;
  if (gx < minGx || gx > maxGx || gz < -maxGz || gz > maxGz) {
    return { valid: false, reason: 'อยู่นอกขอบเขตเกาะฟาร์ม' };
  }
  return { valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' };
}

/**
 * เลื่อน Ghost Preview ตามพิกัด (x, z) บนพื้นดินสำหรับทั้งสิ่งปลูกสร้าง สัตว์เลี้ยง และก้อนหิน
 */
export function moveActiveGhostAtPoint(
  x: number,
  z: number,
  placing: PlacingState,
  refs: Pick<SceneGhostRefs, 'housesRef' | 'animalsRef' | 'rocksRef'>,
  validateRockFn: (gx: number, gz: number, type: RockType) => { valid: boolean; reason?: string }
): AnyGhostState | null {
  if (placing.category === 'animal' && refs.animalsRef.current) {
    return refs.animalsRef.current.moveGhost(x, z);
  }
  if (placing.category === 'rock' && refs.rocksRef.current) {
    return refs.rocksRef.current.moveGhost(x, z, validateRockFn);
  }
  if (refs.housesRef.current) {
    return refs.housesRef.current.moveGhost(x, z);
  }
  return null;
}

/**
 * ซิงค์วงจรชีวิต Ghost Preview เมื่อเข้า/ออกโหมดวางสิ่งก่อสร้าง สัตว์ หรือหิน
 */
export function syncPlacementGhostLifecycle(params: {
  placing: PlacingState | null;
  refs: SceneGhostRefs;
  reporter: GhostReporter;
  validateRockFn: (gx: number, gz: number, type: RockType) => { valid: boolean; reason?: string };
}): void {
  const { placing, refs, reporter, validateRockFn } = params;
  const h = refs.housesRef.current;
  const a = refs.animalsRef.current;
  if (!h || !a) return;

  const placingActive = placing !== null;
  if (refs.controlsRef.current) {
    refs.controlsRef.current.isPlacing = placingActive;
  }
  reporter.resetCache();

  if (!placing) {
    h.stopGhost();
    h.setHiddenId(null);
    a.stopGhost();
    a.setHiddenId(null);
    refs.rocksRef.current?.hideGhost();
    refs.rocksRef.current?.setHiddenId(null);
    reporter.report(null);
    refs.grassRef.current?.refresh();
    return;
  }

  const defaultTarget = refs.controlsRef.current?.target ?? { x: 0, z: 0 };
  const sx = placing.x ?? defaultTarget.x;
  const sz = placing.z ?? defaultTarget.z;
  const category = placing.category ?? 'house';

  if (category === 'animal' && placing.animalType) {
    h.stopGhost();
    h.setHiddenId(null);
    refs.rocksRef.current?.hideGhost();
    refs.rocksRef.current?.setHiddenId(null);
    a.setHiddenId(placing.editId ?? null);
    reporter.report(a.startGhost(placing.animalType, placing.rot ?? 0, sx, sz));
  } else if (category === 'rock' && placing.rockType) {
    h.stopGhost();
    h.setHiddenId(null);
    a.stopGhost();
    a.setHiddenId(null);
    refs.rocksRef.current?.setHiddenId(placing.editId ?? null);
    refs.rocksRef.current?.startGhost(placing.rockType, placing.rot ?? 0);
    reporter.report(refs.rocksRef.current?.moveGhost(sx, sz, validateRockFn) ?? null);
  } else if (placing.type !== undefined) {
    a.stopGhost();
    a.setHiddenId(null);
    refs.rocksRef.current?.hideGhost();
    refs.rocksRef.current?.setHiddenId(null);
    h.setHiddenId(placing.editId ?? null);
    reporter.report(h.startGhost(placing.type, placing.rot ?? 0, sx, sz));
    refs.grassRef.current?.refresh();
  }
}

export function syncPlacementGhostRotation(params: {
  placingRot: number | undefined;
  placingCategory: string;
  refs: Pick<SceneGhostRefs, 'housesRef' | 'animalsRef' | 'rocksRef'>;
  reporter: GhostReporter;
}): void {
  const { placingRot, placingCategory, refs, reporter } = params;
  if (placingRot === undefined) return;
  if (placingCategory === 'animal' && refs.animalsRef.current?.hasGhost()) {
    reporter.report(refs.animalsRef.current.setGhostRotation(placingRot));
  } else if (placingCategory === 'rock') {
    refs.rocksRef.current?.setGhostRot(placingRot);
  } else if (refs.housesRef.current?.hasGhost()) {
    reporter.report(refs.housesRef.current.setGhostRotation(placingRot));
  }
}

export function syncPlacementGhostPosition(params: {
  placingX: number | undefined;
  placingZ: number | undefined;
  placingCategory: string;
  placingActive: boolean;
  refs: Pick<SceneGhostRefs, 'housesRef' | 'animalsRef' | 'rocksRef'>;
  reporter: GhostReporter;
  validateRockFn: (gx: number, gz: number, type: RockType) => { valid: boolean; reason?: string };
}): void {
  const {
    placingX,
    placingZ,
    placingCategory,
    placingActive,
    refs,
    reporter,
    validateRockFn,
  } = params;
  if (placingX === undefined || placingZ === undefined || !placingActive) return;
  if (placingCategory === 'animal' && refs.animalsRef.current?.hasGhost()) {
    reporter.report(refs.animalsRef.current.moveGhost(placingX, placingZ));
  } else if (placingCategory === 'rock' && refs.rocksRef.current) {
    reporter.report(refs.rocksRef.current.moveGhost(placingX, placingZ, validateRockFn));
  } else if (refs.housesRef.current?.hasGhost()) {
    reporter.report(refs.housesRef.current.moveGhost(placingX, placingZ));
  }
}
