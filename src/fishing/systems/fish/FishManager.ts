// src/fishing/systems/fish/FishManager.ts
import * as THREE from 'three';
import { BaitSignal } from './ai/FishPerception';
import { FishAIState } from './ai/FishStateMachine';
import { FishController } from './FishController';
import { FishSpawner } from './FishSpawner';

export class FishManager {
  private readonly spawner = new FishSpawner();
  private readonly fishes = new Map<string, FishController>();
  private readonly maxFishCount: number;
  private attachGroup: THREE.Object3D | null;

  constructor(maxFishCount = 14, attachGroup: THREE.Object3D | null = null) {
    this.maxFishCount = maxFishCount;
    this.attachGroup = attachGroup;
  }

  setAttachGroup(group: THREE.Object3D | null): void {
    this.attachGroup = group;
    if (group) {
      for (const fish of this.fishes.values()) {
        fish.buildMesh(group);
      }
    }
  }

  populateInitialSchool(preferredSpeciesIds: string[] = []): void {
    while (this.fishes.size < this.maxFishCount) {
      const fish = this.spawner.spawnFish(preferredSpeciesIds);
      if (this.attachGroup) fish.buildMesh(this.attachGroup);
      this.fishes.set(fish.id, fish);
    }
  }

  getAllFish(): IterableIterator<FishController> {
    return this.fishes.values();
  }

  getFishById(id: string | null): FishController | null {
    return id ? (this.fishes.get(id) ?? null) : null;
  }

  getCount(): number {
    return this.fishes.size;
  }

  removeAndRespawn(fishId: string, preferredSpeciesIds: string[] = []): void {
    const old = this.fishes.get(fishId);
    if (old) {
      old.disposeMesh();
    }
    this.fishes.delete(fishId);

    const replacement = this.spawner.spawnFish(preferredSpeciesIds);
    if (this.attachGroup) replacement.buildMesh(this.attachGroup);
    this.fishes.set(replacement.id, replacement);
  }

  releaseFishBackToLake(fishId: string): void {
    const fish = this.fishes.get(fishId);
    if (!fish) return;
    fish.stamina = fish.maxStamina * 0.8;
    fish.brain.fsm.forceReset();
    fish.brain.fsm.transitionTo(FishAIState.FLEE);
    fish.brain.pickRandomLakePoint(fish.position);
  }

  refreshPatrolSchoolForBait(
    preferredSpeciesIds: string[] = [],
    protectedFishId: string | null = null
  ): void {
    const candidates: string[] = [];
    for (const fish of this.fishes.values()) {
      if (fish.id === protectedFishId) continue;
      if (fish.brain.fsm.getState() === FishAIState.PATROL) {
        candidates.push(fish.id);
      }
    }
    const replaceCount = Math.min(candidates.length, Math.max(4, Math.floor(this.maxFishCount * 0.5)));
    for (let i = 0; i < replaceCount; i++) {
      this.removeAndRespawn(candidates[i], preferredSpeciesIds);
    }
  }

  update(
    dt: number,
    anglerOrigin: THREE.Vector3,
    baitSignal: BaitSignal | null,
    hookedFishId: string | null,
    lineTensionN: number
  ): void {
    for (const fish of this.fishes.values()) {
      const externalPull = fish.id === hookedFishId ? lineTensionN : 0;
      fish.update(dt, anglerOrigin, baitSignal, externalPull);
    }
  }

  clear(): void {
    for (const f of this.fishes.values()) {
      f.disposeMesh();
    }
    this.fishes.clear();
    this.attachGroup = null;
  }
}