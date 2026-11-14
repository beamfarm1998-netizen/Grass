import * as THREE from 'three';
import { BaitSpec, LineSpec } from '../../equipment/EquipmentCatalog';
import { FishSpeciesSpec } from '../data/FishCatalog';

export interface BaitSignal {
  active: boolean;
  claimedByFishId: string | null;
  position: THREE.Vector3;
  bait: BaitSpec;
  line: LineSpec;
}

export interface PerceptionReport {
  distanceToBaitM: number;
  canDetectBait: boolean;
  desireScore: number; // 0..2
}

export class FishPerception {
  static evaluate(
    fishPos: THREE.Vector3,
    species: FishSpeciesSpec,
    baitSignal: BaitSignal | null
  ): PerceptionReport {
    if (!baitSignal || !baitSignal.active) {
      return { distanceToBaitM: Infinity, canDetectBait: false, desireScore: 0 };
    }

    const dx = baitSignal.position.x - fishPos.x;
    const dz = baitSignal.position.z - fishPos.z;
    const distanceToBaitM = Math.hypot(dx, dz);

    const detectionRadius = 15.5 * baitSignal.bait.attractionMultiplier;
    if (distanceToBaitM > detectionRadius) {
      return { distanceToBaitM, canDetectBait: false, desireScore: 0 };
    }

    const speciesBonus = baitSignal.bait.preferredSpeciesIds.includes(species.id) ? 1.35 : 0.88;
    const stealthFactor = 1.15 - baitSignal.line.visibilityFactor * 0.25;
    const depthDiff = Math.abs(species.preferredDepthM - baitSignal.bait.targetDepthM);
    const depthMatch = Math.max(0.55, 1 - depthDiff * 0.18);

    const desireScore =
      species.aggression *
      baitSignal.bait.attractionMultiplier *
      speciesBonus *
      stealthFactor *
      depthMatch;

    return {
      distanceToBaitM,
      canDetectBait: true,
      desireScore,
    };
  }
}
