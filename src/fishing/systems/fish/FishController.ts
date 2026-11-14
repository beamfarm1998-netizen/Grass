// src/fishing/systems/fish/FishController.ts
import * as THREE from 'three';
// ✅ แก้ Path เป็น ../ (ถอยขึ้น 1 ชั้นไปโฟลเดอร์ systems)
import { WaterPhysics } from '../physics/water/WaterPhysics'; 
import { FishBrain } from './ai/FishBrain';
import { BaitSignal } from './ai/FishPerception';
import { FishAIState } from './ai/FishStateMachine';
import { FishSpeciesSpec } from './data/FishCatalog';
import { FishModelLoader } from './data/FishModelLoader';

const _toTarget = new THREE.Vector3();
const _pullTowardAngler = new THREE.Vector3();

export class FishController {
  public readonly id: string;
  public readonly species: FishSpeciesSpec;
  public readonly weightKg: number;
  public readonly lengthCm: number;
  public readonly scaleFactor: number;
  public readonly position = new THREE.Vector3();
  public readonly velocity = new THREE.Vector3();
  public headingYawRad = 0;
  public pitchRad = 0;
  public tailPhase = Math.random() * Math.PI * 2;
  public tailFrequencyHz = 2.0;
  public stamina: number;
  public readonly maxStamina: number;
  public readonly brain: FishBrain;

  // Visual Properties (สำหรับ GLB)
  public mesh: THREE.Object3D | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public swimAction: THREE.AnimationAction | null = null;
  public isGlbModel = false;

  constructor(id: string, species: FishSpeciesSpec, spawnPos: THREE.Vector3, rng: () => number = Math.random) {
    this.id = id;
    this.species = species;
    const sizeRoll = Math.pow(rng(), 1.35);
    this.weightKg = Number((species.minWeightKg + (species.maxWeightKg - species.minWeightKg) * sizeRoll).toFixed(2));
    this.lengthCm = Math.round(species.minLengthCm + (species.maxLengthCm - species.minLengthCm) * Math.pow(sizeRoll, 0.82));
    this.scaleFactor = 0.65 + (this.lengthCm / 100) * 0.72;
    this.maxStamina = species.maxStamina * (0.8 + sizeRoll * 0.55);
    this.stamina = this.maxStamina;
    this.position.copy(spawnPos);
    this.headingYawRad = rng() * Math.PI * 2;
    this.brain = new FishBrain(spawnPos);
  }

  getStaminaRatio(): number {
    return this.maxStamina > 0 ? Math.max(0, Math.min(1, this.stamina / this.maxStamina)) : 0;
  }

  getCurrentPullForceN(): number {
    const state = this.brain.fsm.getState();
    const weightRatio = this.weightKg / Math.max(0.5, this.species.maxWeightKg);
    const sizeMultiplier = 0.62 + weightRatio * 0.68;
    if (state === FishAIState.FIGHT) {
      const burstFactor = this.brain.isBursting ? 1.32 : 0.78;
      return this.species.basePullForceN * sizeMultiplier * burstFactor * (0.45 + 0.55 * this.getStaminaRatio());
    }
    if (state === FishAIState.TIRED) return this.species.basePullForceN * sizeMultiplier * 0.28;
    return 0;
  }

  update(dt: number, anglerOrigin: THREE.Vector3, baitSignal: BaitSignal | null, externalLinePullN = 0): void {
    const state = this.brain.fsm.getState();
    this.brain.update(this.id, this.position, this.species, this.getStaminaRatio(), anglerOrigin, baitSignal, dt);

    if (state === FishAIState.LANDED) {
      this.tailFrequencyHz = 1.4;
      this.tailPhase += dt * this.tailFrequencyHz * Math.PI * 2;
      if (this.mixer) this.mixer.update(dt);
      return;
    }

    if (state === FishAIState.FIGHT || state === FishAIState.TIRED) {
      const exertion = (this.brain.isBursting ? 9.5 : 4.2) + externalLinePullN * 0.085;
      this.stamina = Math.max(0, this.stamina - exertion * dt);
    } else if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 6.0 * dt);
    }

    _toTarget.copy(this.brain.targetPosition).sub(this.position);
    const dist = _toTarget.length();
    if (dist > 0.05) _toTarget.divideScalar(dist);
    else _toTarget.set(Math.sin(this.headingYawRad), 0, Math.cos(this.headingYawRad));

    const desiredVelX = _toTarget.x * this.brain.desiredSpeedMps;
    const desiredVelY = _toTarget.y * this.brain.desiredSpeedMps * 0.65;
    const desiredVelZ = _toTarget.z * this.brain.desiredSpeedMps;

    const accel = state === FishAIState.FIGHT && this.brain.isBursting ? 5.5 : 3.2;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, desiredVelX, accel, dt);
    this.velocity.y = THREE.MathUtils.damp(this.velocity.y, desiredVelY, accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, desiredVelZ, accel, dt);

    if ((state === FishAIState.FIGHT || state === FishAIState.TIRED) && externalLinePullN > 0) {
      _pullTowardAngler.copy(anglerOrigin).sub(this.position);
      const horizAnglerDist = Math.hypot(_pullTowardAngler.x, _pullTowardAngler.z);
      _pullTowardAngler.y *= horizAnglerDist > 4.2 ? 0.08 : 0.42;
      const anglerDist = _pullTowardAngler.length();
      if (anglerDist > 0.2) {
        _pullTowardAngler.divideScalar(anglerDist);
        const resistanceForce = this.getCurrentPullForceN();
        const netPull = externalLinePullN - resistanceForce * 0.62;
        const effectiveMass = Math.max(1.4, this.weightKg * 1.15);
        const pullSpeedDelta = (netPull / effectiveMass) * dt * 1.85;
        this.velocity.addScaledVector(_pullTowardAngler, pullSpeedDelta);
      }
    }

    this.position.addScaledVector(this.velocity, dt);

    const waterDepth = WaterPhysics.waterDepthAt(this.position.x, this.position.z);
    if (waterDepth < 0.55) {
      const backX = -this.position.x * 0.18;
      const backZ = (-12 - this.position.z) * 0.18;
      this.position.x += backX * dt * 6;
      this.position.z += backZ * dt * 6;
    }

    const bedY = WaterPhysics.terrainHeightAt(this.position.x, this.position.z);
    const isFighting = state === FishAIState.FIGHT || state === FishAIState.TIRED;
    const minY = Math.min(-0.38, bedY + 0.3);
    const maxY = isFighting && bedY < -1.1 ? -0.62 : -0.22;
    this.position.y = THREE.MathUtils.clamp(this.position.y, minY, maxY);

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > 0.08) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetYaw - this.headingYawRad;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.headingYawRad += diff * Math.min(1, dt * 6.5);
      this.pitchRad = THREE.MathUtils.damp(this.pitchRad, THREE.MathUtils.clamp(-this.velocity.y * 0.25, -0.45, 0.45), 5, dt);
    }

    this.tailFrequencyHz = 1.6 + horizSpeed * 1.85 + (this.brain.isBursting ? 2.4 : 0);
    this.tailPhase = (this.tailPhase + dt * this.tailFrequencyHz * Math.PI * 2) % (Math.PI * 2);

    if (this.mixer) this.mixer.update(dt);
    if (this.swimAction) this.swimAction.timeScale = Math.max(0.4, this.tailFrequencyHz / 2.0);
  }

  buildMesh(parent: THREE.Object3D): void {
    if (this.mesh) return;

    if (this.species.modelUrl) {
      const inst = FishModelLoader.instantiate(this.species.modelUrl);
      if (inst) {
        this.mesh = inst.root;
        this.mixer = inst.mixer;
        this.isGlbModel = true;
        this.mesh.scale.setScalar(this.scaleFactor * (this.species.modelScale ?? 1));

        const action =
          (this.species.swimClipName ? inst.actions.get(this.species.swimClipName) : null) ??
          inst.defaultAction;
        if (action) {
          this.swimAction = action;
          this.swimAction.play();
        }
      }
    }

    if (!this.mesh) {
      this.isGlbModel = false;
      return;
    }

    const yOffset = this.species.modelYOffset ?? 0;
    this.mesh.position.set(this.position.x, this.position.y + yOffset, this.position.z);
    parent.add(this.mesh);
  }

  syncMesh(): void {
    if (!this.mesh) return;
    const yOffset = this.isGlbModel ? (this.species.modelYOffset ?? 0) : 0;
    this.mesh.position.set(this.position.x, this.position.y + yOffset, this.position.z);
    const yawOffset = this.isGlbModel ? (this.species.modelYawOffset ?? 0) : 0;
    this.mesh.rotation.set(this.pitchRad, this.headingYawRad + yawOffset, 0, 'YXZ');
  }

  disposeMesh(): void {
    if (this.mixer && this.mesh) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mesh);
    }
    if (this.mesh) {
      this.mesh.parent?.remove(this.mesh);
    }
    this.mesh = null;
    this.mixer = null;
    this.swimAction = null;
    this.isGlbModel = false;
  }
}