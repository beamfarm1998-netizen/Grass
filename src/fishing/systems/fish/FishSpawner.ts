import * as THREE from 'three';
import { WaterPhysics } from '../physics/water/WaterPhysics';
import { FishController } from './FishController';
import { FishRegistry } from './FishRegistry';

export class FishSpawner {
  private nextId = 1;

  spawnFish(preferredSpeciesIds: string[] = []): FishController {
    const species = FishRegistry.pickWeightedRandom(preferredSpeciesIds);
    const pos = this.findUnderwaterSpawnPoint(species.preferredDepthM);
    const id = `fish_${this.nextId++}`;
    return new FishController(id, species, pos);
  }

  private findUnderwaterSpawnPoint(preferredDepthM: number): THREE.Vector3 {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 22;
      const x = Math.cos(angle) * r;
      const z = -11 + Math.sin(angle) * r * 0.85;
      const depth = WaterPhysics.waterDepthAt(x, z);
      if (depth >= 1.1) {
        const y = -Math.min(depth - 0.3, Math.max(0.4, preferredDepthM * (0.6 + Math.random() * 0.5)));
        return new THREE.Vector3(x, y, z);
      }
    }
    return new THREE.Vector3(0, -1.4, -10);
  }
}
