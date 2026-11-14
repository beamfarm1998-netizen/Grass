import * as THREE from 'three';
import { HapticsManager } from '../../platform/HapticsManager';
import { CaughtFishRecord } from '../../storage/SaveSchema';
import { AudioSystem } from '../audio/AudioSystem';
import { EquipmentManager } from '../equipment/EquipmentManager';
import { BaitSignal } from '../fish/ai/FishPerception';
import { FishAIState } from '../fish/ai/FishStateMachine';
import { FishController } from '../fish/FishController';
import { FishManager } from '../fish/FishManager';
import { LinePhysics } from '../physics/fishing-line/LinePhysics';
import { CastProjectile, PhysicsWorld } from '../physics/PhysicsWorld';
import { ReelMechanics } from '../physics/reel/ReelMechanics';
import { FishingController } from './FishingController';
import { FishingSession } from './FishingSession';
import { FishingState } from './FishingState';

export interface FishingSystemCallbacks {
  onWaterSplash: (position: THREE.Vector3, intensity: number) => void;
  onCastRecorded: () => void;
  onOutcomeReached: (
    outcome: 'landed' | 'escaped' | 'hook_failed' | 'line_broken',
    fishRecord?: CaughtFishRecord
  ) => void;
}

export class FishingSystem {
  public readonly session = new FishingSession();
  public readonly controller: FishingController;
  public readonly reelMechanics = new ReelMechanics();
  public readonly projectile: CastProjectile = {
    active: false,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
  };

  private readonly baitSignal: BaitSignal;
  private readonly dockTip: { x: number; y: number; z: number };
  private readonly physicsWorld: PhysicsWorld;
  private readonly fishManager: FishManager;
  private readonly equipmentManager: EquipmentManager;
  private readonly audio: AudioSystem;
  private readonly haptics: HapticsManager;
  private readonly callbacks: FishingSystemCallbacks;
  private lastNibbleSoundAt = 0;
  private lastLureTwitchAt = 0;

  constructor(
    dockTip: { x: number; y: number; z: number },
    physicsWorld: PhysicsWorld,
    fishManager: FishManager,
    equipmentManager: EquipmentManager,
    audio: AudioSystem,
    callbacks: FishingSystemCallbacks,
    haptics: HapticsManager = new HapticsManager()
  ) {
    this.dockTip = dockTip;
    this.physicsWorld = physicsWorld;
    this.fishManager = fishManager;
    this.equipmentManager = equipmentManager;
    this.audio = audio;
    this.haptics = haptics;
    this.callbacks = callbacks;

    const loadout = equipmentManager.getLoadout();
    this.baitSignal = {
      active: false,
      claimedByFishId: null,
      position: this.session.bobberPosition,
      bait: loadout.bait,
      line: loadout.line,
    };

    this.session.resetToIdle(dockTip);

    this.controller = new FishingController(this.session, {
      onCastLaunch: (power, aimDeg) => this.launchCast(power, aimDeg),
      onStrikeAttempt: () => this.attemptHookStrike(),
      onCancelWaiting: () => this.retrieveToIdle(),
    });
  }

  getBaitSignal(): BaitSignal {
    const loadout = this.equipmentManager.getLoadout();
    this.baitSignal.bait = loadout.bait;
    this.baitSignal.line = loadout.line;
    return this.baitSignal;
  }

  private launchCast(power: number, aimAngleDeg: number): void {
    if (!this.session.transitionTo(FishingState.CASTING)) return;

    const loadout = this.equipmentManager.getLoadout();
    const aimRad = THREE.MathUtils.degToRad(aimAngleDeg);
    const launchSpeed = (10.5 + power * 13.5) * loadout.rod.castDistanceBonus;
    const launchElev = THREE.MathUtils.degToRad(34);

    this.projectile.active = true;
    this.projectile.position.set(
      this.dockTip.x + Math.sin(aimRad) * 1.6,
      this.dockTip.y + 1.45,
      this.dockTip.z - Math.cos(aimRad) * 1.6
    );
    this.projectile.velocity.set(
      Math.sin(aimRad) * Math.cos(launchElev) * launchSpeed,
      Math.sin(launchElev) * launchSpeed,
      -Math.cos(aimRad) * Math.cos(launchElev) * launchSpeed
    );

    this.session.bobberPosition.copy(this.projectile.position);
    this.session.previousBobberPosition.copy(this.projectile.position);
    this.audio.playCast();
    this.haptics.pulseCastLaunch(power);
    this.callbacks.onCastRecorded();
  }

  private attemptHookStrike(): void {
    const state = this.session.getState();

    // Striking prematurely while only nibbling or waiting scares the fish
    if (state === FishingState.WAITING) {
      if (this.baitSignal.claimedByFishId) {
        const fish = this.fishManager.getFishById(this.baitSignal.claimedByFishId);
        fish?.brain.fsm.transitionTo(FishAIState.FLEE);
      }
      this.baitSignal.active = false;
      this.baitSignal.claimedByFishId = null;
      this.controller.resetInputs();
      this.haptics.stop();
      if (this.session.transitionTo(FishingState.HOOK_FAILED)) {
        this.session.lastOutcome = 'hook_failed';
        this.callbacks.onOutcomeReached('hook_failed');
      }
      return;
    }

    if (state !== FishingState.BITE) return;

    const fish = this.fishManager.getFishById(this.session.activeFishId);
    if (!fish) {
      this.retrieveToIdle();
      return;
    }

    const timing = this.session.stateElapsed / this.session.biteWindowDuration;
    this.session.hookQuality = timing < 0.48 ? 'perfect' : 'good';

    this.baitSignal.active = false;
    if (this.session.transitionTo(FishingState.HOOKED)) {
      fish.brain.fsm.transitionTo(FishAIState.FIGHT);
      this.session.bobberPosition.copy(fish.position);
      this.session.unstrainedLineLengthM = Math.max(2.0, this.session.currentDistanceM - 0.18);
      this.callbacks.onWaterSplash(fish.position, 0.95);
      this.audio.playSplash(0.95);
      this.haptics.pulseHookStrike(this.session.hookQuality);
    }
  }

  retrieveToIdle(): void {
    if (this.baitSignal.claimedByFishId) {
      const fish = this.fishManager.getFishById(this.baitSignal.claimedByFishId);
      if (fish && fish.brain.fsm.getState() !== FishAIState.PATROL) {
        fish.brain.fsm.forceReset();
      }
    }
    this.baitSignal.active = false;
    this.baitSignal.claimedByFishId = null;
    this.projectile.active = false;
    this.controller.resetInputs();
    this.haptics.stop();
    this.session.resetToIdle(this.dockTip);
  }

  acknowledgeOutcomeAndReset(): void {
    const st = this.session.getState();
    if (
      st === FishingState.RESULT ||
      st === FishingState.FISH_ESCAPED ||
      st === FishingState.HOOK_FAILED ||
      st === FishingState.LINE_BROKEN
    ) {
      this.controller.resetInputs();
      this.haptics.stop();
      if (this.session.transitionTo(FishingState.IDLE)) {
        this.session.resetToIdle(this.dockTip);
      }
    }
  }

  fixedUpdate(dt: number, elapsed: number, rodTipWorldPos: THREE.Vector3): void {
    this.session.stateElapsed += dt;
    this.haptics.decayVisualRumble(dt);
    const state = this.session.getState();
    const loadout = this.equipmentManager.getLoadout();

    // Charge power oscillation while player holds Cast button or Right Joystick
    if (state === FishingState.IDLE && this.session.isChargingCast) {
      this.session.castPower += this.session.castChargeDirection * dt * 1.15;
      if (this.session.castPower >= 1.0) {
        this.session.castPower = 1.0;
        this.session.castChargeDirection = -1;
      } else if (this.session.castPower <= 0.15) {
        this.session.castPower = 0.15;
        this.session.castChargeDirection = 1;
      }
    }

    if (state === FishingState.CASTING) {
      this.session.previousBobberPosition.copy(this.session.bobberPosition);
      const flightStatus = this.physicsWorld.stepCastProjectile(this.projectile, dt, elapsed);
      this.session.bobberPosition.copy(this.projectile.position);
      this.session.currentDistanceM = rodTipWorldPos.distanceTo(this.session.bobberPosition);
      this.session.unstrainedLineLengthM = this.session.currentDistanceM + 0.12;
      this.session.lineTensionN = 1.5;

      if (flightStatus === 'water_hit') {
        this.callbacks.onWaterSplash(this.session.bobberPosition, 0.75);
        this.audio.playSplash(0.75);
        this.baitSignal.active = true;
        this.baitSignal.claimedByFishId = null;
        this.session.transitionTo(FishingState.WAITING);
      } else if (flightStatus === 'land_hit') {
        this.retrieveToIdle();
      }
      return;
    }

    if (state === FishingState.WAITING) {
      this.session.previousBobberPosition.copy(this.session.bobberPosition);

      // Allow slow retrieve during WAITING to twitch bait and attract fish
      if (this.session.isReelingInput) {
        const toDockX = this.dockTip.x - this.session.bobberPosition.x;
        const toDockZ = (this.dockTip.z - 2.2) - this.session.bobberPosition.z;
        const distToDock = Math.hypot(toDockX, toDockZ);
        if (distToDock < 2.2) {
          this.retrieveToIdle();
          return;
        }
        const pullStep =
          loadout.reel.recoveryRateMps * 0.55 * this.session.reelSpeedMultiplier * dt;
        this.session.bobberPosition.x += (toDockX / distToDock) * pullStep;
        this.session.bobberPosition.z += (toDockZ / distToDock) * pullStep;
      }

      // Gentle Left-Joystick rod twitching creates subtle lure ripples
      const rodTwitchMag = Math.hypot(this.session.rodPullX, this.session.rodPullY);
      if (rodTwitchMag > 0.45 && elapsed - this.lastLureTwitchAt > 0.85) {
        this.lastLureTwitchAt = elapsed;
        this.session.bobberPosition.x += this.session.rodPullX * 0.08;
        this.callbacks.onWaterSplash(this.session.bobberPosition, 0.22);
      }

      // Check claimed fish interaction
      let dipOffset = 0;
      this.session.isNibbling = false;
      const interactingFish = this.fishManager.getFishById(this.baitSignal.claimedByFishId);

      if (interactingFish) {
        const fishState = interactingFish.brain.fsm.getState();
        if (fishState === FishAIState.NIBBLE) {
          this.session.isNibbling = true;
          dipOffset = Math.abs(Math.sin(elapsed * 9.5)) * 0.09;
          if (elapsed - this.lastNibbleSoundAt > 0.65) {
            this.lastNibbleSoundAt = elapsed;
            this.audio.playNibble();
            this.haptics.pulseNibble();
            this.callbacks.onWaterSplash(this.session.bobberPosition, 0.25);
          }
        } else if (fishState === FishAIState.STRIKE_BITE) {
          this.session.activeFishId = interactingFish.id;
          this.session.biteWindowDuration = 1.9 + loadout.rod.flexibility * 0.9;
          if (this.session.transitionTo(FishingState.BITE)) {
            this.audio.playBiteAlert();
            this.haptics.pulseBiteAlert();
            this.callbacks.onWaterSplash(this.session.bobberPosition, 0.65);
          }
          return;
        }
      }

      this.session.nibbleDipOffset = dipOffset;
      this.physicsWorld.stepFloatingBobber(this.session.bobberPosition, dipOffset, dt, elapsed);
      this.session.currentDistanceM = rodTipWorldPos.distanceTo(this.session.bobberPosition);
      this.session.unstrainedLineLengthM = this.session.currentDistanceM + 0.08;
      this.session.lineTensionN = this.session.isReelingInput ? 4.5 : 0.8;
      return;
    }

    if (state === FishingState.BITE) {
      // Bobber is pulled sharply underwater
      this.session.nibbleDipOffset = 0.34 + Math.sin(elapsed * 16) * 0.05;
      this.physicsWorld.stepFloatingBobber(
        this.session.bobberPosition,
        this.session.nibbleDipOffset,
        dt,
        elapsed
      );
      this.session.currentDistanceM = rodTipWorldPos.distanceTo(this.session.bobberPosition);
      this.session.lineTensionN = 12 + Math.sin(elapsed * 18) * 4;

      if (this.session.stateElapsed > this.session.biteWindowDuration) {
        const fish = this.fishManager.getFishById(this.session.activeFishId);
        fish?.brain.fsm.transitionTo(FishAIState.FLEE);
        this.baitSignal.active = false;
        this.baitSignal.claimedByFishId = null;
        this.haptics.stop();
        if (this.session.transitionTo(FishingState.HOOK_FAILED)) {
          this.session.lastOutcome = 'hook_failed';
          this.callbacks.onOutcomeReached('hook_failed');
        }
      }
      return;
    }

    if (state === FishingState.HOOKED) {
      const fish = this.fishManager.getFishById(this.session.activeFishId);
      if (!fish) {
        this.controller.resetInputs();
        this.haptics.stop();
        if (this.session.transitionTo(FishingState.FISH_ESCAPED)) {
          this.session.lastOutcome = 'escaped';
          this.callbacks.onOutcomeReached('escaped');
        }
        return;
      }
      this.session.bobberPosition.copy(fish.position);
      this.session.currentDistanceM = rodTipWorldPos.distanceTo(fish.position);
      // Keep unstrained line length calibrated to live fish distance during 0.28s hook-set so starter lines never suffer an artificial instant-snap spike on frame 1 of FIGHTING
      this.session.unstrainedLineLengthM = Math.max(2.0, this.session.currentDistanceM - 0.16);
      this.session.lineTensionN = Math.min(loadout.line.breakStrengthN * 0.55, 26);
      if (this.session.stateElapsed >= 0.28) {
        this.session.transitionTo(FishingState.FIGHTING);
      }
      return;
    }

    if (state === FishingState.FIGHTING || state === FishingState.REELING) {
      const fish = this.fishManager.getFishById(this.session.activeFishId);
      if (!fish) {
        this.controller.resetInputs();
        this.haptics.stop();
        if (this.session.transitionTo(FishingState.FISH_ESCAPED)) {
          this.session.lastOutcome = 'escaped';
          this.callbacks.onOutcomeReached('escaped');
        }
        return;
      }

      this.updateActiveFightPhysics(fish, rodTipWorldPos, dt, elapsed);
      return;
    }

    if (state === FishingState.LANDED) {
      if (this.session.stateElapsed >= 0.55) {
        this.session.transitionTo(FishingState.RESULT);
      }
    }
  }

  private updateActiveFightPhysics(
    fish: FishController,
    rodTipWorldPos: THREE.Vector3,
    dt: number,
    elapsed: number
  ): void {
    const loadout = this.equipmentManager.getLoadout();
    const prevDist = this.session.currentDistanceM;
    this.session.previousBobberPosition.copy(this.session.bobberPosition);
    this.session.bobberPosition.copy(fish.position);

    const newDist = rodTipWorldPos.distanceTo(fish.position);
    const dLdt = (newDist - prevDist) / Math.max(0.0001, dt);
    this.session.currentDistanceM = newDist;

    // Track horizontal swim direction of hooked fish (-1 left .. +1 right)
    this.session.fishPullDirX = THREE.MathUtils.clamp(fish.velocity.x / 1.4, -1, 1);

    // Evaluate Left-Joystick Rod Counter-Pull & Upward Pump
    const opposingSidePull =
      this.session.rodPullX * this.session.fishPullDirX < -0.16
        ? Math.min(1, Math.abs(this.session.rodPullX))
        : 0;
    const upwardPump = Math.max(0, this.session.rodPullY);
    const counterLeverage = Math.min(1, opposingSidePull * 0.75 + upwardPump * 0.5);
    this.session.isCounterPulling = counterLeverage > 0.22;

    if (this.session.isCounterPulling) {
      // Counter-steering tires the fish faster and cushions sudden runs
      fish.stamina = Math.max(0, fish.stamina - counterLeverage * 3.8 * dt);
    }

    const maxDragN = this.reelMechanics.getEffectiveMaxDragN(loadout.reel.maxDragN);

    // Retrieve line when player holds Reel button or cranks Right Joystick
    const retrievedM = this.reelMechanics.computeLineRetrieved(
      this.session.isReelingInput,
      loadout.reel.recoveryRateMps * this.session.reelSpeedMultiplier,
      this.session.lineTensionN,
      maxDragN,
      dt
    );
    this.session.unstrainedLineLengthM = Math.max(1.1, this.session.unstrainedLineLengthM - retrievedM);

    // Add fish active pull contribution to effective extension velocity
    const fishPullSpeed = (fish.getCurrentPullForceN() / Math.max(25, loadout.line.stiffnessK)) * 1.4;
    const prevL0 = this.session.unstrainedLineLengthM;

    const lineStep = LinePhysics.step({
      currentDistanceM: newDist,
      unstrainedLengthM: this.session.unstrainedLineLengthM,
      extensionVelocityMps: dLdt + fishPullSpeed,
      stiffnessK: loadout.line.stiffnessK,
      dampingC: loadout.line.dampingC,
      maxDragForceN: maxDragN,
      breakStrengthN: loadout.line.breakStrengthN,
      rodFlexShockAbsorb: Math.min(0.95, loadout.rod.flexibility + counterLeverage * 0.2),
      dt,
    });

    this.session.unstrainedLineLengthM = lineStep.newUnstrainedLengthM;
    this.session.lineTensionN = lineStep.tensionN;

    // Continuous mobile haptic vibration synced to live line tension, fish bursts & drag slip
    this.haptics.updateFightRumble(
      lineStep.tensionRatio,
      fish.brain.isBursting,
      lineStep.isDragSlipping
    );

    if (lineStep.isDragSlipping) {
      this.reelMechanics.advanceDragSlipAngle(lineStep.newUnstrainedLengthM - prevL0);
      this.audio.playReelClick(lineStep.tensionRatio, true);
    } else if (this.session.isReelingInput) {
      this.audio.playReelClick(lineStep.tensionRatio, false);
    }

    // Surface splash when fighting fish surges near surface
    if (fish.brain.isBursting && Math.random() < dt * 2.2) {
      this.callbacks.onWaterSplash(fish.position, 0.55);
    }

    // Transition dynamically between FIGHTING and REELING based on fish stamina & player reeling
    if (fish.getStaminaRatio() < 0.25 && this.session.isReelingInput) {
      if (this.session.getState() === FishingState.FIGHTING) {
        this.session.transitionTo(FishingState.REELING);
      }
    } else if (fish.brain.isBursting && this.session.getState() === FishingState.REELING) {
      this.session.transitionTo(FishingState.FIGHTING);
    }

    // Check line break condition
    this.session.overloadAccumulator = Math.max(
      0,
      this.session.overloadAccumulator + lineStep.overloadDelta
    );
    if (
      lineStep.isInstantSnap ||
      this.session.overloadAccumulator >= this.physicsWorld.config.overloadSnapImpulse
    ) {
      fish.brain.fsm.forceReset();
      fish.brain.fsm.transitionTo(FishAIState.FLEE);
      this.controller.resetInputs();
      this.audio.playLineSnap();
      this.haptics.pulseLineSnap();
      if (this.session.transitionTo(FishingState.LINE_BROKEN)) {
        this.session.lastOutcome = 'line_broken';
        this.callbacks.onOutcomeReached('line_broken');
      }
      return;
    }

    // Check excess slack escape condition
    if (lineStep.isSlack && !this.session.isReelingInput) {
      this.session.slackDurationSeconds += dt;
      if (this.session.slackDurationSeconds >= this.physicsWorld.config.slackEscapeSeconds) {
        fish.brain.fsm.forceReset();
        fish.brain.fsm.transitionTo(FishAIState.FLEE);
        this.controller.resetInputs();
        this.haptics.stop();
        if (this.session.transitionTo(FishingState.FISH_ESCAPED)) {
          this.session.lastOutcome = 'escaped';
          this.callbacks.onOutcomeReached('escaped');
        }
        return;
      }
    } else {
      this.session.slackDurationSeconds = Math.max(0, this.session.slackDurationSeconds - dt * 1.4);
    }

    // Check landing condition when fish is brought close to the pier tip
    const horizontalDistToDock = Math.hypot(
      fish.position.x - this.dockTip.x,
      fish.position.z - (this.dockTip.z - 1.4)
    );
    if (horizontalDistToDock <= 2.95 || newDist <= 2.75) {
      fish.brain.fsm.transitionTo(FishAIState.LANDED);
      this.controller.resetInputs();
      const record: CaughtFishRecord = {
        id: `catch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        speciesId: fish.species.id,
        weightKg: fish.weightKg,
        lengthCm: fish.lengthCm,
        rarity: fish.species.rarity,
        valueCoins: Math.max(12, Math.round(fish.weightKg * fish.species.baseCoinsPerKg)),
        caughtAtIso: new Date().toISOString(),
      };
      this.session.pendingCatchRecord = record;
      this.session.lastOutcome = 'landed';
      this.audio.playCatchSuccess();
      this.haptics.pulseLanded();
      this.callbacks.onWaterSplash(fish.position, 0.85);
      if (this.session.transitionTo(FishingState.LANDED)) {
        this.callbacks.onOutcomeReached('landed', record);
      }
      void elapsed;
    }
  }
}
