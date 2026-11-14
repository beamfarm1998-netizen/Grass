import * as THREE from 'three';
import { CaughtFishRecord } from '../../storage/SaveSchema';
import { canTransitionFishingState, FishingState } from './FishingState';

export class FishingSession {
  private state: FishingState = FishingState.IDLE;
  public stateElapsed = 0;

  // Casting & Aiming
  public isChargingCast = false;
  public castPower = 0; // 0..1
  public castChargeDirection = 1;
  public aimAngleDeg = 0; // -42..+42 deg

  // Dual Joystick Rod & Reel Modulation
  public rodPullX = 0; // -1 (pull left) .. +1 (pull right)
  public rodPullY = 0; // -1 (lower tip) .. +1 (pump rod upward)
  public reelSpeedMultiplier = 1.0; // 0.7..1.4
  public fishPullDirX = 0; // -1..+1 horizontal swim direction of hooked fish
  public isCounterPulling = false;

  // Rig & Physics state
  public readonly bobberPosition = new THREE.Vector3(0, 0.25, 11.8);
  public readonly previousBobberPosition = new THREE.Vector3(0, 0.25, 11.8);
  public unstrainedLineLengthM = 2.0; // L0
  public currentDistanceM = 2.0; // L
  public lineTensionN = 0; // T
  public isNibbling = false;
  public nibbleDipOffset = 0;
  public slackDurationSeconds = 0;
  public overloadAccumulator = 0;
  public isReelingInput = false;

  // Hook & Fight state
  public activeFishId: string | null = null;
  public biteWindowDuration = 2.25;
  public hookQuality: 'perfect' | 'good' | null = null;
  public pendingCatchRecord: CaughtFishRecord | null = null;
  public lastOutcome: 'landed' | 'escaped' | 'hook_failed' | 'line_broken' | null = null;
  public isNewPersonalBest = false;

  getState(): FishingState {
    return this.state;
  }

  transitionTo(next: FishingState): boolean {
    if (!canTransitionFishingState(this.state, next)) {
      return false;
    }
    this.state = next;
    this.stateElapsed = 0;
    return true;
  }

  resetToIdle(dockTip: { x: number; y: number; z: number }): void {
    this.state = FishingState.IDLE;
    this.stateElapsed = 0;
    this.isChargingCast = false;
    this.castPower = 0;
    this.castChargeDirection = 1;
    this.rodPullX = 0;
    this.rodPullY = 0;
    this.reelSpeedMultiplier = 1.0;
    this.fishPullDirX = 0;
    this.isCounterPulling = false;
    this.lineTensionN = 0;
    this.isNibbling = false;
    this.nibbleDipOffset = 0;
    this.slackDurationSeconds = 0;
    this.overloadAccumulator = 0;
    this.isReelingInput = false;
    this.activeFishId = null;
    this.hookQuality = null;
    this.pendingCatchRecord = null;
    this.lastOutcome = null;
    this.isNewPersonalBest = false;
    this.bobberPosition.set(dockTip.x, dockTip.y - 0.55, dockTip.z - 2.1);
    this.previousBobberPosition.copy(this.bobberPosition);
    this.unstrainedLineLengthM = 2.1;
    this.currentDistanceM = 2.1;
  }
}
