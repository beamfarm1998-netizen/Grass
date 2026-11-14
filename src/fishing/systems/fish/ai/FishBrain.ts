// src/fishing/systems/fish/ai/FishBrain.ts
import * as THREE from 'three';
// ✅ แก้ Path เป็น ../../ (ถอยขึ้น 2 ชั้น: ออกจาก ai -> fish -> systems)
import { WaterPhysics } from '../../physics/water/WaterPhysics'; 
import { FishSpeciesSpec } from '../data/FishCatalog';
import { FishDecision } from './FishDecision';
import { BaitSignal, FishPerception } from './FishPerception';
import { FishAIState, FishStateMachine } from './FishStateMachine';

const NIBBLE_DWELL_MIN_SEC = 0.45;
const NIBBLE_DWELL_MAX_SEC = 0.75;
const NIBBLE_RETREAT_MIN_SEC = 0.30;
const NIBBLE_RETREAT_MAX_SEC = 0.55;
const NIBBLE_ANIM_RADIUS = 0.45;
const NIBBLE_RETREAT_RADIUS = 1.45;
const NIBBLE_CIRCLE_SPEED = 3.4;
const STRIKE_SAFETY_TIMEOUT_SEC = 4.0;
const APPROACH_TIMEOUT_SEC = 8.0;
const MIN_TARGET_DEPTH = 1.1;

export class FishBrain {
  public readonly fsm = new FishStateMachine();
  public readonly targetPosition = new THREE.Vector3();
  public desiredSpeedMps = 1.2;
  public nibbleCount = 0;
  public maxNibbles = 2;
  public fightBurstTimer = 0;
  public isBursting = false;

  private _nibbleDwellSec = NIBBLE_DWELL_MIN_SEC;
  private _nibbleRetreatSec = NIBBLE_RETREAT_MIN_SEC;
  private _nibbleCountedThisEntry = false;

  constructor(initialPos: THREE.Vector3) {
    this.pickRandomLakePoint(initialPos);
  }

  pickRandomLakePoint(originFallback?: THREE.Vector3): void {
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 24;
      const x = Math.cos(angle) * radius;
      const z = -12 + Math.sin(angle) * radius * 0.88;
      const depth = WaterPhysics.waterDepthAt(x, z);
      if (depth > 1.1) {
        const y = -Math.min(depth - 0.35, 0.55 + Math.random() * 2.1);
        this.targetPosition.set(x, y, z);
        return;
      }
    }
    if (originFallback) this.targetPosition.copy(originFallback);
    else this.targetPosition.set(0, -1.2, -12);
  }

  private releaseBait(baitSignal: BaitSignal | null, fishId: string): void {
    if (baitSignal && baitSignal.claimedByFishId === fishId) baitSignal.claimedByFishId = null;
  }

  update(
    fishId: string,
    fishPos: THREE.Vector3,
    species: FishSpeciesSpec,
    staminaRatio: number,
    anglerOrigin: THREE.Vector3,
    baitSignal: BaitSignal | null,
    dt: number
  ): void {
    this.fsm.tickTimer(dt);
    const state = this.fsm.getState();

    switch (state) {
      case FishAIState.PATROL: {
        this.desiredSpeedMps = species.cruiseSpeedMps * 0.72;
        if (fishPos.distanceToSquared(this.targetPosition) < 3.2 || this.fsm.getStateTimer() > 9.0) {
          this.pickRandomLakePoint(fishPos);
        }
        const perception = FishPerception.evaluate(fishPos, species, baitSignal);
        const claimedByOther = Boolean(baitSignal?.claimedByFishId) && baitSignal?.claimedByFishId !== fishId;
        const next = FishDecision.chooseNextPatrolDecision(perception, claimedByOther, dt);
        if (next === FishAIState.APPROACH_BAIT && baitSignal) {
          baitSignal.claimedByFishId = fishId;
          this.nibbleCount = 0;
          this.maxNibbles = 2 + Math.floor(Math.random() * 2);
          this.fsm.transitionTo(FishAIState.APPROACH_BAIT);
        }
        break;
      }
      case FishAIState.APPROACH_BAIT: {
        if (!baitSignal || !baitSignal.active || (baitSignal.claimedByFishId && baitSignal.claimedByFishId !== fishId)) {
          this.releaseBait(baitSignal, fishId);
          this.fsm.transitionTo(FishAIState.PATROL);
          this.pickRandomLakePoint(fishPos);
          break;
        }
        if (this.fsm.getStateTimer() > APPROACH_TIMEOUT_SEC) {
          this.releaseBait(baitSignal, fishId);
          this.fsm.transitionTo(FishAIState.PATROL);
          this.pickRandomLakePoint(fishPos);
          break;
        }
        this.targetPosition.set(baitSignal.position.x, Math.min(-0.35, baitSignal.position.y - 0.32), baitSignal.position.z);
        this.desiredSpeedMps = species.cruiseSpeedMps * 1.05;
        const dist2D = Math.hypot(baitSignal.position.x - fishPos.x, baitSignal.position.z - fishPos.z);
        const interaction = FishDecision.chooseBaitInteraction(dist2D, species, this.nibbleCount, this.maxNibbles);
        if (interaction) this.fsm.transitionTo(interaction);
        break;
      }
      case FishAIState.NIBBLE: {
        if (!baitSignal || !baitSignal.active) {
          this.releaseBait(baitSignal, fishId);
          this.fsm.transitionTo(FishAIState.PATROL);
          break;
        }
        if (baitSignal.claimedByFishId && baitSignal.claimedByFishId !== fishId) {
          this.fsm.transitionTo(FishAIState.PATROL);
          break;
        }
        if (this.fsm.consumeJustEntered()) {
          this._nibbleDwellSec = NIBBLE_DWELL_MIN_SEC + Math.random() * (NIBBLE_DWELL_MAX_SEC - NIBBLE_DWELL_MIN_SEC);
          this._nibbleRetreatSec = NIBBLE_RETREAT_MIN_SEC + Math.random() * (NIBBLE_RETREAT_MAX_SEC - NIBBLE_RETREAT_MIN_SEC);
          this._nibbleCountedThisEntry = false;
        }
        const elapsed = this.fsm.getStateTimer();
        const retreatStart = this._nibbleDwellSec;
        const retreatEnd = retreatStart + this._nibbleRetreatSec;

        if (elapsed <= retreatStart) {
          const angle = elapsed * NIBBLE_CIRCLE_SPEED;
          this.targetPosition.set(baitSignal.position.x + Math.cos(angle) * NIBBLE_ANIM_RADIUS, Math.min(-0.3, baitSignal.position.y - 0.25), baitSignal.position.z + Math.sin(angle) * NIBBLE_ANIM_RADIUS);
        } else {
          const retreatProgress = Math.min(1, (elapsed - retreatStart) / this._nibbleRetreatSec);
          const angle = retreatStart * NIBBLE_CIRCLE_SPEED;
          const r = NIBBLE_ANIM_RADIUS + (NIBBLE_RETREAT_RADIUS - NIBBLE_ANIM_RADIUS) * retreatProgress;
          this.targetPosition.set(baitSignal.position.x + Math.cos(angle) * r, Math.min(-0.3, baitSignal.position.y - 0.25), baitSignal.position.z + Math.sin(angle) * r);
        }
        this.desiredSpeedMps = species.cruiseSpeedMps * 0.65;
        if (!this._nibbleCountedThisEntry && elapsed >= retreatStart) {
          this.nibbleCount++;
          this._nibbleCountedThisEntry = true;
        }
        if (elapsed >= retreatEnd) {
          if (this.nibbleCount >= this.maxNibbles) {
            const ok = this.fsm.transitionTo(FishAIState.STRIKE_BITE);
            if (!ok) { this.releaseBait(baitSignal, fishId); this.fsm.transitionTo(FishAIState.PATROL); }
          } else {
            const ok = this.fsm.transitionTo(FishAIState.APPROACH_BAIT);
            if (!ok) this.fsm.transitionTo(FishAIState.STRIKE_BITE);
          }
        }
        break;
      }
      case FishAIState.STRIKE_BITE: {
        if (!baitSignal || !baitSignal.active || this.fsm.getStateTimer() > STRIKE_SAFETY_TIMEOUT_SEC) {
          this.releaseBait(baitSignal, fishId);
          this.fsm.transitionTo(FishAIState.FLEE);
          break;
        }
        this.targetPosition.set(baitSignal.position.x, Math.min(-0.7, baitSignal.position.y - 0.65), baitSignal.position.z - 0.6);
        this.desiredSpeedMps = species.burstSpeedMps * 0.55;
        break;
      }
      case FishAIState.FIGHT: {
        if (staminaRatio <= 0.14) { this.fsm.transitionTo(FishAIState.TIRED); break; }
        this.fightBurstTimer -= dt;
        if (this.fightBurstTimer <= 0) {
          this.isBursting = !this.isBursting;
          this.fightBurstTimer = this.isBursting ? 1.1 + Math.random() * 1.4 : 1.3 + Math.random() * 1.8;
          const awayX = fishPos.x - anglerOrigin.x;
          const awayZ = fishPos.z - anglerOrigin.z;
          const baseAngle = Math.atan2(awayZ, awayX);
          const lateralSwing = (Math.random() - 0.5) * 1.85;
          const runAngle = baseAngle + lateralSwing;
          const runDist = 8 + Math.random() * 12;
          const tx = THREE.MathUtils.clamp(fishPos.x + Math.cos(runAngle) * runDist, -26, 26);
          const tz = THREE.MathUtils.clamp(fishPos.z + Math.sin(runAngle) * runDist, -38, 9);
          const bedDepth = WaterPhysics.waterDepthAt(tx, tz);
          if (bedDepth >= MIN_TARGET_DEPTH) {
            const ty = -Math.min(Math.max(0.75, bedDepth - 0.4), 0.85 + Math.random() * 1.95);
            this.targetPosition.set(tx, ty, tz);
          } else { this.pickRandomLakePoint(fishPos); }
        }
        this.desiredSpeedMps = this.isBursting ? species.burstSpeedMps * (0.55 + 0.45 * staminaRatio) : species.cruiseSpeedMps * 1.15;
        break;
      }
      case FishAIState.TIRED: {
        if (staminaRatio > 0.28) { this.fsm.transitionTo(FishAIState.FIGHT); break; }
        this.isBursting = false;
        this.desiredSpeedMps = species.cruiseSpeedMps * 0.42;
        break;
      }
      case FishAIState.FLEE: {
        this.desiredSpeedMps = species.burstSpeedMps * 0.95;
        if (this.fsm.consumeJustEntered()) {
          this.releaseBait(baitSignal, fishId);
          this.pickRandomLakePoint(fishPos);
        }
        if (this.fsm.getStateTimer() > 2.6) this.fsm.transitionTo(FishAIState.PATROL);
        break;
      }
      case FishAIState.LANDED: {
        this.desiredSpeedMps = 0;
        break;
      }
    }
  }
}