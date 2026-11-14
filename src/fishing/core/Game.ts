import { EventBus } from './EventBus';
import { GameClock } from './GameClock';
import { CameraPreset, DEFAULT_GAME_CONFIG, GameConfig, WeatherType } from './GameConfig';
import { GameLifecycle } from './GameLifecycle';
import { GameLoop } from './GameLoop';
import { GameHUDState } from './GameState';
import { AssetLoaderAndValidator } from '../engine/animation/AssetLoaderAndValidator';
import { CameraManager } from '../engine/camera/CameraManager';
import { LightingManager } from '../engine/lighting/LightingManager';
import { RendererManager } from '../engine/renderer/RendererManager';
import { SceneManager } from '../engine/scene/SceneManager';
import { languageManager } from '../localization/LanguageManager';
import { LanguageCode } from '../localization/LanguageTypes';
import { HapticsManager } from '../platform/HapticsManager';
import { CaughtFishRecord, EquippedSetup } from '../storage/SaveSchema';
import { SaveManager } from '../storage/SaveManager';
import { AudioSystem } from '../systems/audio/AudioSystem';
import {
  BAIT_CATALOG,
  LINE_CATALOG,
  REEL_CATALOG,
  ROD_CATALOG,
} from '../systems/equipment/EquipmentCatalog';
import { EquipmentManager } from '../systems/equipment/EquipmentManager';
import { FISH_SPECIES_CATALOG } from '../systems/fish/data/FishCatalog';
import { FishModelLoader } from '../systems/fish/data/FishModelLoader';
import { FishManager } from '../systems/fish/FishManager';
import { FishRegistry } from '../systems/fish/FishRegistry';
import { FishingState } from '../systems/fishing/FishingState';
import { FishingSystem } from '../systems/fishing/FishingSystem';
import { PhysicsWorld } from '../systems/physics/PhysicsWorld';
import { WaterPhysics } from '../systems/physics/water/WaterPhysics';
import { FishingRig3D } from '../systems/world/FishingRig3D';
import { LakeEnvironmentBuilder } from '../systems/world/LakeEnvironmentBuilder';

export interface GameEvents extends Record<string, unknown> {
  hudUpdate: GameHUDState;
}

export interface FishingWalletBridge {
  getCoins?: () => number;
  spendCoins?: (amount: number) => boolean;
  onCoinsEarned?: (amount: number) => void;
  onXpEarned?: (amount: number) => void;
}

export class Game {
  public readonly events = new EventBus<GameEvents>();
  public readonly config: GameConfig;
  private readonly clock: GameClock;
  private readonly lifecycle: GameLifecycle;
  private readonly saveManager: SaveManager;
  private readonly audioSystem: AudioSystem;
  private readonly hapticsManager: HapticsManager;
  private readonly equipmentManager: EquipmentManager;
  private readonly physicsWorld: PhysicsWorld;
  private readonly fishManager: FishManager;
  private readonly assetLoader: AssetLoaderAndValidator;

  private rendererManager: RendererManager | null = null;
  private sceneManager: SceneManager | null = null;
  private cameraManager: CameraManager | null = null;
  private lightingManager: LightingManager | null = null;
  private lakeBuilder: LakeEnvironmentBuilder | null = null;
  private fishingRig3D: FishingRig3D | null = null;
  private fishingSystem: FishingSystem | null = null;
  private gameLoop: GameLoop | null = null;

  private glbValidated = false;
  private manualPaused = false;
  private overlayPaused = false;
  private initInProgress = false;
  private initToken = 0;
  private hudEmitAcc = 0;
  private unsubscribeLang: (() => void) | null = null;
  private lastResultSummary: GameHUDState['lastResult'] = null;
  private walletBridge: FishingWalletBridge | null = null;

  // Live Dual Joystick State
  private leftStickX = 0;
  private leftStickY = 0;

  constructor(config: GameConfig = DEFAULT_GAME_CONFIG) {
    this.config = config;
    this.clock = new GameClock(config.maxDeltaSeconds);
    this.saveManager = new SaveManager();
    this.audioSystem = new AudioSystem();
    this.hapticsManager = new HapticsManager();
    this.equipmentManager = new EquipmentManager();
    this.physicsWorld = new PhysicsWorld();
    this.fishManager = new FishManager(config.maxFishCount);
    this.assetLoader = new AssetLoaderAndValidator();

    this.audioSystem.setThunderFlashListener((intensity) => {
      this.lightingManager?.triggerLightningShimmer(intensity);
    });

    this.lifecycle = new GameLifecycle({
      onPause: () => {
        this.clock.setPaused(true);
        this.audioSystem.setPaused(true);
        this.hapticsManager.stop();
        this.leftStickX = 0;
        this.leftStickY = 0;
        this.fishingSystem?.controller.resetInputs();
        void this.saveManager.flushPending();
        this.emitHudState();
      },
      onResume: () => {
        if (!this.manualPaused && !this.overlayPaused) {
          this.clock.setPaused(false);
          this.audioSystem.setPaused(false);
        }
        this.emitHudState();
      },
      onResize: (w, h) => {
        this.rendererManager?.resize(w, h);
        this.cameraManager?.resize(w, h);
      },
    });
  }

  setWalletBridge(bridge: FishingWalletBridge | null): void {
    this.walletBridge = bridge;
  }

  syncWalletCoins(coins: number): void {
    if (!Number.isFinite(coins)) return;
    const normalized = Math.max(0, Math.floor(coins));
    if (this.saveManager.getData().coins === normalized) return;
    this.saveManager.update((draft) => {
      draft.coins = normalized;
    });
    this.emitHudState();
  }

  async init(container: HTMLElement): Promise<void> {
    if (this.gameLoop?.isRunning() || this.initInProgress) return;
    this.initInProgress = true;
    const token = ++this.initToken;

    try {
      // 1. Load saved progression & language
      const saved = await this.saveManager.load();
      if (token !== this.initToken) return;

      if (this.walletBridge?.getCoins) {
        const externalCoins = this.walletBridge.getCoins();
        if (Number.isFinite(externalCoins)) {
          const normalizedCoins = Math.max(0, Math.floor(externalCoins));
          if (saved.coins !== normalizedCoins) {
            this.saveManager.update((draft) => {
              draft.coins = normalizedCoins;
            });
            await this.saveManager.flushPending();
          }
        }
      }

      this.equipmentManager.setEquipped(saved.equipped);
      this.audioSystem.setMuted(saved.settings.audioMuted);
      this.audioSystem.setVolume(saved.settings.audioVolume);
      this.hapticsManager.setEnabled(saved.settings.hapticsEnabled);

      this.unsubscribeLang = languageManager.subscribe((lang: LanguageCode) => {
        this.saveManager.update((draft) => {
          draft.language = lang;
        });
      });

      // 2. Initialize 3D Engine
      this.rendererManager = new RendererManager(container);
      this.sceneManager = new SceneManager(this.rendererManager.renderer);
      const width = Math.max(1, container.clientWidth || window.innerWidth);
      const height = Math.max(1, container.clientHeight || window.innerHeight);
      this.cameraManager = new CameraManager(width, height);
      this.cameraManager.setPreset(saved.settings.cameraPreset);

      this.lightingManager = new LightingManager(
        this.sceneManager.scene,
        this.rendererManager.isSoftwareGl
      );
      const initialWind = this.lightingManager.applyWeather(saved.settings.weather);
      this.physicsWorld.setWindScale(initialWind);
      this.audioSystem.setWeatherAmbience(saved.settings.weather);

      // 3. Preload & validate real GLB 3D models (+ optional custom species GLBs)
      const [coreValidated] = await Promise.all([
        this.assetLoader.preloadCoreModels(),
        FishModelLoader.preloadSpeciesModels(FISH_SPECIES_CATALOG),
      ]);
      this.glbValidated = coreValidated;
      if (token !== this.initToken) {
        this.sceneManager?.dispose();
        this.rendererManager?.dispose();
        this.sceneManager = null;
        this.rendererManager = null;
        return;
      }

    // 4. Construct Lake 3D World & Articulated Rig
    this.lakeBuilder = new LakeEnvironmentBuilder();
    this.lakeBuilder.build(
      this.sceneManager.environmentGroup,
      this.sceneManager.waterGroup,
      this.sceneManager.effectsGroup,
      this.rendererManager.getMaxAnisotropy(),
      this.rendererManager.isSoftwareGl, // 👈 ต้องมีลูกน้ำ (,) ตรงนี้
      this.assetLoader // 👈 เติมตัวนี้เข้าไป
   );

    const loadout = this.equipmentManager.getLoadout();
    this.fishManager.setAttachGroup(this.sceneManager.fishGroup);
    this.fishManager.populateInitialSchool(loadout.bait.preferredSpeciesIds);

    this.fishingRig3D = new FishingRig3D(
      this.sceneManager.rigGroup,
      this.sceneManager.fishGroup,
      this.assetLoader,
      this.rendererManager.getMaxAnisotropy()
    );

    // 5. Initialize Fishing Gameplay System (with Mobile Haptics)
    this.fishingSystem = new FishingSystem(
      this.config.dockTipPosition,
      this.physicsWorld,
      this.fishManager,
      this.equipmentManager,
      this.audioSystem,
      {
        onWaterSplash: (pos, intensity) => {
          this.lakeBuilder?.spawnRipple(pos, intensity);
        },
        onCastRecorded: () => {
          this.lastResultSummary = null;
          this.saveManager.update((draft) => {
            draft.statistics.totalCasts += 1;
          });
          this.emitHudState();
        },
        onOutcomeReached: (outcome, record) => {
          this.handleFishingOutcome(outcome, record);
        },
      },
      this.hapticsManager
    );

    if (!this.rendererManager.isSoftwareGl) {
      this.rendererManager.renderer.compile(this.sceneManager.scene, this.cameraManager.camera);
    }

    this.lifecycle.attach(container);

    // 6. Start Single Authoritative Game Loop
    this.gameLoop = new GameLoop(
      this.clock,
      this.config.fixedTimeStep,
      this.config.maxSubSteps,
      {
        isSoftwareGl: this.rendererManager.isSoftwareGl,
        getGlContext: () => this.rendererManager?.renderer.getContext() ?? null,
        fixedUpdate: (fixedDt, elapsed) => this.fixedUpdate(fixedDt, elapsed),
        render: (frameDt, _alpha, elapsed) => this.render(frameDt, elapsed),
      }
    );
      this.gameLoop.start();
      this.emitHudState();
    } finally {
      this.initInProgress = false;
    }
  }

  private handleFishingOutcome(
    outcome: 'landed' | 'escaped' | 'hook_failed' | 'line_broken',
    record?: CaughtFishRecord
  ): void {
    if (outcome === 'landed' && record) {
      const species = FishRegistry.getById(record.speciesId);
      const xpEarned = Math.max(15, Math.round(record.weightKg * species.baseXpPerKg));
      let isNewRecord = false;

      this.saveManager.update((draft) => {
        draft.statistics.totalCatches += 1;
        if (record.weightKg > draft.statistics.biggestWeightKg) {
          draft.statistics.biggestWeightKg = record.weightKg;
          draft.statistics.biggestSpeciesId = record.speciesId;
          isNewRecord = true;
        }
        this.grantXp(draft, xpEarned);
      });

      this.lastResultSummary = {
        outcome: 'landed',
        fish: record,
        isNewRecord,
        coinsEarned: record.valueCoins,
        xpEarned,
      };
      if (xpEarned > 0) {
        this.walletBridge?.onXpEarned?.(xpEarned);
      }
    } else if (outcome === 'escaped') {
      this.saveManager.update((draft) => {
        draft.statistics.totalEscaped += 1;
      });
      this.lastResultSummary = { outcome: 'escaped' };
    } else if (outcome === 'line_broken') {
      this.saveManager.update((draft) => {
        draft.statistics.totalLineBreaks += 1;
      });
      this.lastResultSummary = { outcome: 'line_broken' };
    } else {
      this.lastResultSummary = { outcome: 'hook_failed' };
    }

    this.emitHudState();
  }

  private grantXp(draft: { level: number; xp: number }, amount: number): void {
    draft.xp += amount;
    let needed = this.xpForLevel(draft.level);
    while (draft.xp >= needed) {
      draft.xp -= needed;
      draft.level += 1;
      needed = this.xpForLevel(draft.level);
    }
  }

  private xpForLevel(level: number): number {
    return 100 + (level - 1) * 75;
  }

  private fixedUpdate(fixedDt: number, elapsed: number): void {
    if (!this.fishingSystem || !this.fishingRig3D) return;

    // Continuous Left-Joystick rod steering / counter-pull & subtle vertical look
    this.fishingSystem.controller.applyLeftJoystick(this.leftStickX, this.leftStickY, fixedDt);

    const session = this.fishingSystem.session;
    const state = session.getState();
    if (
      (state === FishingState.IDLE || state === FishingState.WAITING) &&
      Math.abs(this.leftStickY) > 0.14
    ) {
      this.cameraManager?.addLookDrag(0, this.leftStickY * 45 * fixedDt);
    }

    const hookedId =
      state === FishingState.HOOKED ||
      state === FishingState.FIGHTING ||
      state === FishingState.REELING ||
      state === FishingState.LANDED ||
      state === FishingState.RESULT
        ? session.activeFishId
        : null;

    this.fishManager.update(
      fixedDt,
      this.fishingRig3D.rodTipWorldPos,
      this.fishingSystem.getBaitSignal(),
      hookedId,
      session.lineTensionN
    );

    this.fishingSystem.fixedUpdate(fixedDt, elapsed, this.fishingRig3D.rodTipWorldPos);
  }

  private render(frameDt: number, elapsed: number): void {
    if (
      !this.rendererManager ||
      !this.sceneManager ||
      !this.cameraManager ||
      !this.lightingManager ||
      !this.lakeBuilder ||
      !this.fishingRig3D ||
      !this.fishingSystem
    ) {
      return;
    }

    const effectiveDt = Math.max(0.001, frameDt || 1 / 60);
    const session = this.fishingSystem.session;
    const loadout = this.equipmentManager.getLoadout();
    const isRaining = this.lightingManager.getWeather() === 'rain';

    this.lightingManager.update(effectiveDt);
    this.audioSystem.updateAmbience(effectiveDt);
    this.lakeBuilder.update(effectiveDt, elapsed, this.physicsWorld.getWindScale(), isRaining);

    this.fishingRig3D.update(
      effectiveDt,
      elapsed,
      session,
      loadout,
      this.fishingSystem.reelMechanics.getSpoolAngleRad(),
      this.fishManager.getAllFish(),
      this.config.dockTipPosition
    );

    const tensionRatio =
      loadout.line.breakStrengthN > 0
        ? session.lineTensionN / loadout.line.breakStrengthN
        : 0;

    const hookedFish = session.activeFishId
      ? this.fishManager.getFishById(session.activeFishId)
      : null;

    this.cameraManager.update(
      effectiveDt,
      elapsed,
      session.getState(),
      this.config.dockTipPosition,
      session.bobberPosition,
      session.aimAngleDeg,
      tensionRatio,
      hookedFish ? hookedFish.velocity.x : 0,
      hookedFish ? hookedFish.velocity.y : 0,
      hookedFish ? hookedFish.velocity.z : 0
    );

    this.lightingManager.setUnderwaterFactor(this.cameraManager.getUnderwaterFactor(elapsed));

    this.rendererManager.renderer.render(this.sceneManager.scene, this.cameraManager.camera);

    this.hudEmitAcc += effectiveDt;
    if (this.hudEmitAcc >= 0.065) {
      this.hudEmitAcc = 0;
      this.emitHudState();
    }
  }

  // --- Player Control Methods ---

  unlockAudio(): void {
    this.audioSystem.unlock();
  }

  setLeftJoystick(x: number, y: number): void {
    this.audioSystem.unlock();
    this.leftStickX = Math.max(-1, Math.min(1, x));
    this.leftStickY = Math.max(-1, Math.min(1, y));
    if (x === 0 && y === 0 && this.fishingSystem) {
      this.fishingSystem.session.rodPullX = 0;
      this.fishingSystem.session.rodPullY = 0;
      this.fishingSystem.session.isCounterPulling = false;
    }
  }

  setRightJoystick(x: number, y: number, crankRadPerSec: number, active: boolean): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.applyRightJoystick(x, y, crankRadPerSec, active);
    this.emitHudState();
  }

  beginCastCharge(): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.beginCastCharge();
    this.emitHudState();
  }

  releaseCastCharge(): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.releaseCastCharge();
    this.emitHudState();
  }

  steerAim(deltaDeg: number): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.steerAim(deltaDeg);
    this.emitHudState();
  }

  setAimAngle(angleDeg: number): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.setAimAngle(angleDeg);
    this.emitHudState();
  }

  triggerStrike(): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.triggerStrike();
    this.emitHudState();
  }

  setReeling(reeling: boolean): void {
    this.audioSystem.unlock();
    this.fishingSystem?.controller.setReeling(reeling);
    this.emitHudState();
  }

  cancelWaitingCast(): void {
    this.fishingSystem?.controller.cancelCast();
    this.emitHudState();
  }

  adjustReelDrag(delta: number): void {
    this.fishingSystem?.reelMechanics.adjustDrag(delta);
    this.emitHudState();
  }

  setReelDrag(ratio: number): void {
    this.fishingSystem?.reelMechanics.setDragRatio(ratio);
    this.emitHudState();
  }

  keepCaughtFish(): void {
    if (!this.fishingSystem) return;
    const session = this.fishingSystem.session;
    const record = session.pendingCatchRecord;
    const fishId = session.activeFishId;

    if (record) {
      this.saveManager.update((draft) => {
        draft.inventory.unshift(record);
      });
      void this.saveManager.flushPending().then(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('beam-fish-bag-changed'));
        }
      });
    }
    if (fishId) {
      const loadout = this.equipmentManager.getLoadout();
      this.fishManager.removeAndRespawn(fishId, loadout.bait.preferredSpeciesIds);
    }

    this.lastResultSummary = null;
    this.fishingSystem.acknowledgeOutcomeAndReset();
    this.emitHudState();
  }

  releaseCaughtFish(): void {
    if (!this.fishingSystem) return;
    const session = this.fishingSystem.session;
    const record = session.pendingCatchRecord;
    const fishId = session.activeFishId;

    if (record) {
      const bonusXp = Math.max(10, Math.round(record.weightKg * 14));
      this.saveManager.update((draft) => {
        this.grantXp(draft, bonusXp);
      });
      void this.saveManager.flushPending();
      if (bonusXp > 0) {
        this.walletBridge?.onXpEarned?.(bonusXp);
      }
    }
    if (fishId) {
      this.fishManager.releaseFishBackToLake(fishId);
    }

    this.lastResultSummary = null;
    this.fishingSystem.acknowledgeOutcomeAndReset();
    this.emitHudState();
  }

  dismissFailureOutcome(): void {
    if (!this.fishingSystem) return;
    this.lastResultSummary = null;
    this.fishingSystem.acknowledgeOutcomeAndReset();
    this.emitHudState();
  }

  buyOrEquipItem(category: 'rod' | 'reel' | 'line' | 'bait', itemId: string): void {
    const currentState = this.fishingSystem?.session.getState() ?? FishingState.IDLE;
    const isActiveEncounter =
      currentState === FishingState.BITE ||
      currentState === FishingState.HOOKED ||
      currentState === FishingState.FIGHTING ||
      currentState === FishingState.REELING ||
      currentState === FishingState.LANDED ||
      currentState === FishingState.RESULT;
    if (isActiveEncounter) return;

    const allItems = [...ROD_CATALOG, ...REEL_CATALOG, ...LINE_CATALOG, ...BAIT_CATALOG];
    const spec = allItems.find((i) => i.id === itemId);
    if (!spec) return;

    const snap = this.saveManager.getData();
    if (snap.level < spec.unlockLevel) return;

    const prevBaitId = snap.equipped.baitId;
    const owned = snap.ownedEquipmentIds.includes(itemId);
    const price = Math.max(0, Math.floor(spec.priceCoins));

    if (!owned) {
      const availableCoins = this.walletBridge?.getCoins
        ? Math.max(0, Math.floor(this.walletBridge.getCoins()))
        : snap.coins;
      if (availableCoins < price) return;
      if (price > 0 && this.walletBridge?.spendCoins) {
        if (!this.walletBridge.spendCoins(price)) return;
      }
    }

    if (currentState === FishingState.CASTING || currentState === FishingState.WAITING) {
      this.fishingSystem?.retrieveToIdle();
    }

    this.saveManager.update((draft) => {
      if (!owned) {
        const syncedAfterSpend = this.walletBridge?.getCoins
          ? Math.max(0, Math.floor(this.walletBridge.getCoins()))
          : Math.max(0, draft.coins - price);
        draft.coins = syncedAfterSpend;
        if (!draft.ownedEquipmentIds.includes(itemId)) {
          draft.ownedEquipmentIds.push(itemId);
        }
      }

      const nextEquipped: EquippedSetup = { ...draft.equipped };
      if (category === 'rod') nextEquipped.rodId = itemId;
      if (category === 'reel') nextEquipped.reelId = itemId;
      if (category === 'line') nextEquipped.lineId = itemId;
      if (category === 'bait') nextEquipped.baitId = itemId;
      draft.equipped = nextEquipped;
      this.equipmentManager.setEquipped(nextEquipped);
    });

    if (category === 'bait' && itemId !== prevBaitId) {
      const nextLoadout = this.equipmentManager.getLoadout();
      this.fishManager.refreshPatrolSchoolForBait(
        nextLoadout.bait.preferredSpeciesIds,
        this.fishingSystem?.session.activeFishId ?? null
      );
    }

    void this.saveManager.flushPending();
    this.emitHudState();
  }

  sellFish(recordId: string): void {
    let earned = 0;
    this.saveManager.update((draft) => {
      const idx = draft.inventory.findIndex((f) => f.id === recordId);
      if (idx >= 0) {
        const [removed] = draft.inventory.splice(idx, 1);
        earned = Math.max(0, Math.floor(removed.valueCoins || 0));
        draft.coins += earned;
      }
    });
    if (earned > 0) {
      this.walletBridge?.onCoinsEarned?.(earned);
    }
    void this.saveManager.flushPending().then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('beam-fish-bag-changed'));
      }
    });
    this.emitHudState();
  }

  sellAllFish(): void {
    let earned = 0;
    this.saveManager.update((draft) => {
      earned = draft.inventory.reduce(
        (sum, f) => sum + Math.max(0, Math.floor(f.valueCoins || 0)),
        0
      );
      draft.coins += earned;
      draft.inventory = [];
    });
    if (earned > 0) {
      this.walletBridge?.onCoinsEarned?.(earned);
    }
    void this.saveManager.flushPending().then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('beam-fish-bag-changed'));
      }
    });
    this.emitHudState();
  }

  setWeather(weather: WeatherType): void {
    if (!this.lightingManager) return;
    this.audioSystem.unlock();
    const wind = this.lightingManager.applyWeather(weather);
    this.physicsWorld.setWindScale(wind);
    this.audioSystem.setWeatherAmbience(weather);
    this.saveManager.update((draft) => {
      draft.settings.weather = weather;
    });
    this.emitHudState();
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraManager?.setPreset(preset);
    this.saveManager.update((draft) => {
      draft.settings.cameraPreset = preset;
    });
    this.emitHudState();
  }

  dragCameraLook(dx: number, dy: number): void {
    this.cameraManager?.addLookDrag(dx, dy);
  }

  setAudioMuted(muted: boolean): void {
    this.audioSystem.setMuted(muted);
    if (!muted) {
      this.audioSystem.unlock();
    }
    this.saveManager.update((draft) => {
      draft.settings.audioMuted = muted;
    });
    this.emitHudState();
  }

  setAudioVolume(volume: number): void {
    this.audioSystem.unlock();
    this.audioSystem.setVolume(volume);
    this.saveManager.update((draft) => {
      draft.settings.audioVolume = volume;
    });
    this.emitHudState();
  }

  setVirtualJoysticks(enabled: boolean): void {
    if (!enabled) {
      this.setLeftJoystick(0, 0);
      this.setRightJoystick(0, 0, 0, false);
    }
    this.saveManager.update((draft) => {
      draft.settings.virtualJoysticks = enabled;
    });
    this.emitHudState();
  }

  setHapticsEnabled(enabled: boolean): void {
    this.hapticsManager.setEnabled(enabled);
    if (enabled) {
      this.hapticsManager.pulseNibble();
    }
    this.saveManager.update((draft) => {
      draft.settings.hapticsEnabled = enabled;
    });
    this.emitHudState();
  }

  private applyEffectivePauseState(): void {
    const shouldPause = this.manualPaused || this.overlayPaused;
    this.clock.setPaused(shouldPause);
    this.audioSystem.setPaused(shouldPause);
    if (shouldPause) {
      this.leftStickX = 0;
      this.leftStickY = 0;
      this.fishingSystem?.controller.resetInputs();
      this.hapticsManager.stop();
      void this.saveManager.flushPending();
    }
    this.emitHudState();
  }

  setPaused(paused: boolean): void {
    this.manualPaused = paused;
    this.applyEffectivePauseState();
  }

  setUiOverlayOpen(open: boolean): void {
    if (this.overlayPaused === open) return;
    this.overlayPaused = open;
    this.applyEffectivePauseState();
  }

  resetAllInputs(): void {
    this.leftStickX = 0;
    this.leftStickY = 0;
    this.fishingSystem?.controller.resetInputs();
    this.emitHudState();
  }

  async flushBeforeExit(): Promise<void> {
    await this.saveManager.flushPending();
  }

  exportSaveBackup(): void {
    this.saveManager.exportBackup();
  }

  async resetSaveData(): Promise<void> {
    const fresh = await this.saveManager.reset();
    if (this.walletBridge?.getCoins) {
      const externalCoins = this.walletBridge.getCoins();
      if (Number.isFinite(externalCoins)) {
        const normalizedCoins = Math.max(0, Math.floor(externalCoins));
        this.saveManager.update((draft) => {
          draft.coins = normalizedCoins;
        });
        await this.saveManager.flushPending();
      }
    }
    this.equipmentManager.setEquipped(fresh.equipped);
    this.hapticsManager.setEnabled(fresh.settings.hapticsEnabled);
    this.setWeather(fresh.settings.weather);
    this.setCameraPreset(fresh.settings.cameraPreset);
    this.fishingSystem?.retrieveToIdle();
    this.lastResultSummary = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('beam-fish-bag-changed'));
    }
    this.emitHudState();
  }

  getHudSnapshot(): GameHUDState {
    const save = this.saveManager.getData();
    const loadout = this.equipmentManager.getLoadout();
    const session = this.fishingSystem?.session;
    const hookedFish = session?.activeFishId
      ? this.fishManager.getFishById(session.activeFishId)
      : null;

    const bobberX = session?.bobberPosition.x ?? 0;
    const bobberZ = session?.bobberPosition.z ?? 12;

    return {
      initialized: Boolean(this.gameLoop?.isRunning()),
      paused: this.clock.isPaused(),
      fishingState: session?.getState() ?? FishingState.IDLE,
      castPower: session?.castPower ?? 0,
      aimAngleDeg: session?.aimAngleDeg ?? 0,
      rodPullX: session?.rodPullX ?? 0,
      rodPullY: session?.rodPullY ?? 0,
      fishPullDirX: session?.fishPullDirX ?? 0,
      isCounterPulling: session?.isCounterPulling ?? false,
      hapticRumbleIntensity: this.hapticsManager.getRumbleIntensity(),
      lineTensionN: session?.lineTensionN ?? 0,
      maxLineStrengthN: loadout.line.breakStrengthN,
      optimalTensionMinN: loadout.line.breakStrengthN * 0.25,
      optimalTensionMaxN: loadout.line.breakStrengthN * 0.82,
      reelDragRatio: this.fishingSystem?.reelMechanics.getDragRatio() ?? 0.6,
      fishDistanceM: session?.currentDistanceM ?? 0,
      waterDepthM: WaterPhysics.waterDepthAt(bobberX, bobberZ),
      lineOutM: session?.unstrainedLineLengthM ?? 2.0,
      fishStaminaRatio: hookedFish ? hookedFish.getStaminaRatio() : 1,
      isNibbling: session?.isNibbling ?? false,
      hookQuality: session?.hookQuality ?? null,
      activeFishCount: this.fishManager.getCount(),
      glbAssetsValidated: this.glbValidated,
      weather: save.settings.weather,
      cameraPreset:
        this.cameraManager?.getEffectivePreset(session?.getState() ?? FishingState.IDLE) ??
        save.settings.cameraPreset,
      level: save.level,
      xp: save.xp,
      xpToNextLevel: this.xpForLevel(save.level),
      coins: save.coins,
      equippedRodId: save.equipped.rodId,
      equippedReelId: save.equipped.reelId,
      equippedLineId: save.equipped.lineId,
      equippedBaitId: save.equipped.baitId,
      ownedEquipmentIds: [...save.ownedEquipmentIds],
      inventory: [...save.inventory],
      lastResult: this.lastResultSummary,
      stats: { ...save.statistics },
      audioMuted: save.settings.audioMuted,
      audioVolume: save.settings.audioVolume,
      virtualJoysticks: save.settings.virtualJoysticks,
      hapticsEnabled: save.settings.hapticsEnabled,
    };
  }

  private emitHudState(): void {
    this.events.emit('hudUpdate', this.getHudSnapshot());
  }

  dispose(): void {
    this.initToken++;
    this.initInProgress = false;
    this.gameLoop?.stop();
    this.gameLoop = null;
    this.lifecycle.detach();
    this.unsubscribeLang?.();
    this.unsubscribeLang = null;
    this.leftStickX = 0;
    this.leftStickY = 0;
    this.fishingSystem?.controller.resetInputs();
    this.hapticsManager.stop();
    this.fishingRig3D?.dispose();
    this.fishingRig3D = null;
    this.assetLoader.dispose();
    this.sceneManager?.dispose();
    this.sceneManager = null;
    this.rendererManager?.dispose();
    this.rendererManager = null;
    this.audioSystem.dispose();
    this.saveManager.dispose();
    this.fishManager.clear();
    this.events.clear();
  }
}
