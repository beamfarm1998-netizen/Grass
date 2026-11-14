import { FishingSession } from './FishingSession';
import { FishingState } from './FishingState';

export interface FishingInputActions {
  onCastLaunch: (power: number, aimAngleDeg: number) => void;
  onStrikeAttempt: () => void;
  onCancelWaiting: () => void;
}

export class FishingController {
  private readonly session: FishingSession;
  private readonly actions: FishingInputActions;
  private buttonReelingActive = false;
  private rightStickReelingActive = false;
  private rightStickTiltMag = 0;
  private rightCrankBoost = 0;
  private leftStickStrikeLatched = false;
  private rightStickStrikeLatched = false;

  constructor(session: FishingSession, actions: FishingInputActions) {
    this.session = session;
    this.actions = actions;
  }

  resetInputs(): void {
    this.buttonReelingActive = false;
    this.rightStickReelingActive = false;
    this.rightStickTiltMag = 0;
    this.rightCrankBoost = 0;
    this.leftStickStrikeLatched = false;
    this.rightStickStrikeLatched = false;
    this.session.isChargingCast = false;
    this.session.isReelingInput = false;
    this.session.reelSpeedMultiplier = 1.0;
    this.session.rodPullX = 0;
    this.session.rodPullY = 0;
    this.session.isCounterPulling = false;
  }

  steerAim(deltaDeg: number): void {
    if (this.session.getState() !== FishingState.IDLE) return;
    this.session.aimAngleDeg = Math.max(-42, Math.min(42, this.session.aimAngleDeg + deltaDeg));
  }

  setAimAngle(angleDeg: number): void {
    if (this.session.getState() !== FishingState.IDLE) return;
    this.session.aimAngleDeg = Math.max(-42, Math.min(42, angleDeg));
  }

  beginCastCharge(): void {
    if (this.session.getState() !== FishingState.IDLE) return;
    if (this.session.isChargingCast) return;
    this.session.isChargingCast = true;
    this.session.castPower = 0.12;
    this.session.castChargeDirection = 1;
  }

  releaseCastCharge(): void {
    if (this.session.getState() !== FishingState.IDLE || !this.session.isChargingCast) return;
    this.session.isChargingCast = false;
    const finalPower = Math.max(0.22, Math.min(1.0, this.session.castPower));
    this.actions.onCastLaunch(finalPower, this.session.aimAngleDeg);
  }

  triggerStrike(): void {
    const st = this.session.getState();
    if (st === FishingState.BITE || st === FishingState.WAITING) {
      this.actions.onStrikeAttempt();
    }
  }

  setReeling(reeling: boolean): void {
    this.buttonReelingActive = reeling;
    this.syncReelingState();
  }

  /**
   * Left Virtual Joystick:
   * - IDLE: steers cast aim angle left/right & rod posture
   * - BITE: sharp upward pull (y < -0.55) sets the hook (Strike!)
   * - WAITING / FIGHTING / REELING: bends & pulls rod left/right/up to counter-steer fish
   */
  applyLeftJoystick(x: number, y: number, dt: number): void {
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    const st = this.session.getState();

    this.session.rodPullX = clampedX;
    this.session.rodPullY = -clampedY; // Upward thumb drag (-y) lifts rod tip (+rodPullY)

    // Smoothly decay right-stick circular crank boost when thumb stops rotating
    if (this.rightCrankBoost > 0) {
      this.rightCrankBoost = Math.max(0, this.rightCrankBoost - dt * 2.4);
      if (this.rightStickReelingActive) {
        this.session.reelSpeedMultiplier =
          0.78 + Math.max(this.rightStickTiltMag * 0.36, this.rightCrankBoost * 0.58);
      }
    }

    if (st === FishingState.IDLE) {
      if (Math.abs(clampedX) > 0.08) {
        this.steerAim(clampedX * 56 * dt);
      }
      this.leftStickStrikeLatched = false;
      return;
    }

    if (st === FishingState.BITE) {
      if (clampedY < -0.55 && !this.leftStickStrikeLatched) {
        this.leftStickStrikeLatched = true;
        this.triggerStrike();
      } else if (clampedY > -0.25) {
        this.leftStickStrikeLatched = false;
      }
    } else {
      this.leftStickStrikeLatched = false;
    }
  }

  /**
   * Right Virtual Joystick:
   * - IDLE: pull/hold stick to charge cast power, release to launch cast
   * - BITE: tap/flick stick to Strike immediately
   * - WAITING / FIGHTING / REELING: tilt or crank circularly to reel in at variable speed
   */
  applyRightJoystick(x: number, y: number, crankRadPerSec: number, active: boolean): void {
    const mag = Math.min(1, Math.hypot(x, y));
    const st = this.session.getState();

    if (st === FishingState.IDLE) {
      this.rightStickReelingActive = false;
      this.rightStickTiltMag = 0;
      this.rightCrankBoost = 0;
      this.rightStickStrikeLatched = false;
      if (active && mag > 0.24) {
        this.beginCastCharge();
      } else if (!active && this.session.isChargingCast) {
        this.releaseCastCharge();
      }
      this.syncReelingState();
      return;
    }

    if (st === FishingState.BITE) {
      this.rightStickReelingActive = false;
      this.rightStickTiltMag = 0;
      this.rightCrankBoost = 0;
      if (active && (mag > 0.3 || crankRadPerSec > 1.0) && !this.rightStickStrikeLatched) {
        this.rightStickStrikeLatched = true;
        this.triggerStrike();
      } else if (!active) {
        this.rightStickStrikeLatched = false;
      }
      this.syncReelingState();
      return;
    }

    this.rightStickStrikeLatched = false;
    const isReelingGesture = active && (mag > 0.22 || crankRadPerSec > 0.45);
    this.rightStickReelingActive = isReelingGesture;
    this.rightStickTiltMag = isReelingGesture ? mag : 0;

    if (isReelingGesture) {
      const crankFactor = Math.min(1, crankRadPerSec / 7.5);
      this.rightCrankBoost = Math.max(this.rightCrankBoost, crankFactor);
      this.session.reelSpeedMultiplier =
        0.78 + Math.max(this.rightStickTiltMag * 0.36, this.rightCrankBoost * 0.58);
    } else {
      this.rightCrankBoost = 0;
      this.session.reelSpeedMultiplier = 1.0;
    }

    this.syncReelingState();
  }

  private syncReelingState(): void {
    const st = this.session.getState();
    const wantsReel = this.buttonReelingActive || this.rightStickReelingActive;
    if (st === FishingState.FIGHTING || st === FishingState.REELING || st === FishingState.WAITING) {
      this.session.isReelingInput = wantsReel;
      if (!this.rightStickReelingActive) {
        this.session.reelSpeedMultiplier = 1.0;
      }
    } else {
      this.session.isReelingInput = false;
      this.session.reelSpeedMultiplier = 1.0;
    }
  }

  cancelCast(): void {
    if (this.session.getState() === FishingState.WAITING) {
      this.resetInputs();
      this.actions.onCancelWaiting();
    }
  }
}
