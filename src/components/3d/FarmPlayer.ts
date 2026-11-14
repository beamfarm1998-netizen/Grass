// src/components/3d/FarmPlayer.ts
import * as THREE from 'three';
import {
  isKidGender,
  type FarmerGender,
  type KidGender,
  type PlayerOutfitConfig,
  type ToolType,
} from '../../types/game';
import {
  applyProceduralGenderStyle,
  buildProceduralFarmerRig,
  createPlayerShadowMesh,
  getLoadedKidGlb,
  getLoadedManGlb,
  getLoadedWomanGlb,
  instantiateFarmerGlbModel,
  loadKidGlb,
  loadManGlb,
  loadWomanGlb,
  type CachedFarmerGltf,
  type FarmerGlbRuntimeData,
  type ProceduralFarmerRig,
} from '../../game/player/PlayerMesh';
import {
  updateFarmerGlbAnimation,
  updateProceduralFarmerAnimation,
  type PlayerAnimRuntime,
} from '../../game/player/PlayerAnimations';
import { PlayerOutfitController } from '../../game/player/PlayerOutfitSystem';
import { syncFarmerToolVisibility } from '../../game/player/PlayerTools';

export { getLoadedWomanGlb, getLoadedManGlb };

/**
 * FarmPlayer3D — ตัวควบคุมจลนศาสตร์ (Kinematics) และสถานะของตัวละครชาวไร่
 * แยกโมเดล (PlayerMesh), แอนิเมชัน (PlayerAnimations) และเครื่องมือในมือ (PlayerTools) ออกเป็นโมดูลย่อย
 */
export class FarmPlayer3D {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(-1, 0, 3);
  public targetPosition: THREE.Vector3 | null = null;
  public isMoving: boolean = false;

  /** ความสูงพื้น ณ (x,z) — ระบบเดินบนระเบียง/บันไดบ้าน (ไม่ตั้ง = พื้นราบ y=0) */
  public groundHeightAt: ((x: number, z: number) => number) | null = null;
  /** ตรวจชนผนัง/ขอบระเบียง: คืนตำแหน่งที่เดินไปได้จริง (ไม่ตั้ง = ไม่ชน) */
  public resolveMove:
    | ((ox: number, oz: number, nx: number, nz: number, y: number) => { x: number; z: number })
    | null = null;
  private stuckTime: number = 0;

  public isMovementLocked: boolean = false;
  public isCharacterHidden: boolean = false;
  public map2Unlocked: boolean = false;
  public gender: FarmerGender = 'male';

  private isFppHidden: boolean = false;
  private maxSpeed: number = 5.8;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private currentHeading: number = 0;
  private angularVelocity: number = 0;
  private manualDirX: number = 0;
  private manualDirZ: number = 0;
  private manualSpeedScale: number = 0;

  private rig: ProceduralFarmerRig;
  private outfitController: PlayerOutfitController;
  private shadowMesh: THREE.Mesh;
  private currentTool: ToolType = 'hand';

  private womanGlbGroup: THREE.Group | null = null;
  private womanGlbData: FarmerGlbRuntimeData | null = null;
  private womanToolHolder: THREE.Group = new THREE.Group();
  private womanToolMeshes: Map<ToolType, THREE.Group> = new Map();

  private manGlbGroup: THREE.Group | null = null;
  private manGlbData: FarmerGlbRuntimeData | null = null;
  private manToolHolder: THREE.Group = new THREE.Group();
  private manToolMeshes: Map<ToolType, THREE.Group> = new Map();

  /** ตัวละครเด็ก (boy / girl) */
  private kidSlots = new Map<
    KidGender,
    {
      group: THREE.Group;
      data: FarmerGlbRuntimeData;
      toolHolder: THREE.Group;
      toolMeshes: Map<ToolType, THREE.Group>;
    }
  >();

  private anim: PlayerAnimRuntime = {
    gaitPhase: 0,
    breathePhase: 0,
    toolSwingProgress: 0,
    isSwingingTool: false,
  };

  private isDisposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FarmerCharacter';
    this.group.position.copy(this.position);

    this.rig = buildProceduralFarmerRig(this.currentTool);
    this.group.add(this.rig.pelvis);
    this.outfitController = new PlayerOutfitController(this.rig);

    this.shadowMesh = createPlayerShadowMesh();
    this.group.add(this.shadowMesh);

    this.initManGlbSystem();
  }

  private initManGlbSystem() {
    const cached = getLoadedManGlb();
    if (cached) {
      this.setupGlbInstance(cached, 'male');
    } else {
      loadManGlb((loadedGltf) => {
        if (!this.isDisposed) this.setupGlbInstance(loadedGltf, 'male');
      });
    }
  }

  private initWomanGlbSystem() {
    const cached = getLoadedWomanGlb();
    if (cached) {
      this.setupGlbInstance(cached, 'female');
    } else {
      loadWomanGlb((loadedGltf) => {
        if (!this.isDisposed) this.setupGlbInstance(loadedGltf, 'female');
      });
    }
  }

  private setupGlbInstance(gltf: CachedFarmerGltf, targetGender: FarmerGender) {
    if (isKidGender(targetGender)) {
      this.setupKidGlbInstance(gltf, targetGender);
      return;
    }

    if (targetGender === 'male' && this.manGlbGroup) {
      this.group.remove(this.manGlbGroup);
    } else if (targetGender === 'female' && this.womanGlbGroup) {
      this.group.remove(this.womanGlbGroup);
    }

    const { wrapper, data, toolHolder, toolMeshes } = instantiateFarmerGlbModel(gltf, {
      gender: targetGender,
      currentTool: this.currentTool,
    });

    wrapper.visible = !this.isCharacterHidden && !this.isFppHidden && this.gender === targetGender;
    this.group.add(wrapper);

    if (targetGender === 'male') {
      this.manGlbGroup = wrapper;
      this.manGlbData = data;
      this.manToolHolder = toolHolder;
      this.manToolMeshes = toolMeshes;
    } else {
      this.womanGlbGroup = wrapper;
      this.womanGlbData = data;
      this.womanToolHolder = toolHolder;
      this.womanToolMeshes = toolMeshes;
    }

    this.outfitController.registerGlbInstance(wrapper, targetGender);
    this.applyGenderVisibility();
  }

  private initKidGlbSystem(kind: KidGender) {
    const cached = getLoadedKidGlb(kind);
    if (cached) {
      this.setupKidGlbInstance(cached, kind);
    } else {
      loadKidGlb(kind, (loadedGltf) => {
        if (!this.isDisposed) this.setupKidGlbInstance(loadedGltf, kind);
      });
    }
  }

  private setupKidGlbInstance(gltf: CachedFarmerGltf, kind: KidGender) {
    const old = this.kidSlots.get(kind);
    if (old) this.group.remove(old.group);

    const { wrapper, data, toolHolder, toolMeshes } = instantiateFarmerGlbModel(gltf, {
      gender: kind,
      currentTool: this.currentTool,
    });
    wrapper.visible = !this.isCharacterHidden && !this.isFppHidden && this.gender === kind;
    this.group.add(wrapper);

    this.kidSlots.set(kind, { group: wrapper, data, toolHolder, toolMeshes });
    this.outfitController.registerGlbInstance(wrapper, kind);
    this.applyGenderVisibility();
  }

  private hasGlbFor(g: FarmerGender): boolean {
    if (g === 'male') return !!this.manGlbGroup;
    if (g === 'female') return !!this.womanGlbGroup;
    return this.kidSlots.has(g);
  }

  public setOutfit(outfit: PlayerOutfitConfig) {
    this.outfitController.setOutfit(outfit, this.gender);
  }

  public setMovementLocked(locked: boolean) {
    this.isMovementLocked = locked;
    if (locked) {
      this.targetPosition = null;
      this.manualDirX = 0;
      this.manualDirZ = 0;
      this.manualSpeedScale = 0;
      this.isMoving = false;
      this.velocity.set(0, 0, 0);
    }
  }

  public setCharacterHidden(hidden: boolean) {
    this.isCharacterHidden = hidden;
    if (hidden) {
      this.targetPosition = null;
      this.manualDirX = 0;
      this.manualDirZ = 0;
      this.manualSpeedScale = 0;
      this.isMoving = false;
      this.velocity.set(0, 0, 0);
      this.anim.isSwingingTool = false;
    }
    this.syncVisibility();
  }

  public setGender(gender: FarmerGender) {
    this.gender = gender;
    if (gender === 'female' && !this.womanGlbGroup) {
      this.initWomanGlbSystem();
    } else if (gender === 'male' && !this.manGlbGroup) {
      this.initManGlbSystem();
    } else if (isKidGender(gender) && !this.kidSlots.has(gender)) {
      this.initKidGlbSystem(gender);
    }
    this.applyGenderVisibility();
  }

  private applyGenderVisibility() {
    const g = this.gender;
    if (!this.hasGlbFor(g)) {
      const style = g === 'female' || g === 'girl' ? 'female' : 'male';
      applyProceduralGenderStyle(this.rig, style);
      this.outfitController.syncGenderProcedural(style);
    }
    this.syncVisibility();
  }

  private syncVisibility() {
    const hideMesh = this.isCharacterHidden || this.isFppHidden;
    this.group.visible = !this.isCharacterHidden;

    const isProceduralVisible = !hideMesh && !this.hasGlbFor(this.gender);
    this.rig.headGroup.visible = isProceduralVisible;
    this.rig.chest.visible = isProceduralVisible;
    this.rig.pelvis.visible = isProceduralVisible;
    this.shadowMesh.visible = !hideMesh;
    if (this.womanGlbGroup) {
      this.womanGlbGroup.visible = !hideMesh && this.gender === 'female';
    }
    if (this.manGlbGroup) {
      this.manGlbGroup.visible = !hideMesh && this.gender === 'male';
    }
    this.kidSlots.forEach((slot, kind) => {
      slot.group.visible = !hideMesh && this.gender === kind;
    });
  }

  public setVisibleInFPP(isFpp: boolean) {
    this.isFppHidden = isFpp;
    this.syncVisibility();
  }

  public setTool(tool: ToolType) {
    this.currentTool = tool;
    syncFarmerToolVisibility(tool, [
      this.rig.toolMeshes,
      this.womanToolMeshes,
      this.manToolMeshes,
      ...Array.from(this.kidSlots.values(), (s) => s.toolMeshes),
    ]);
  }

  public getHeading(): number {
    return this.currentHeading;
  }

  public setPositionImmediate(x: number, z: number, heading?: number) {
    const minX = this.map2Unlocked ? -88 : -48;
    const clampedX = Math.max(minX, Math.min(48, x));
    const clampedZ = Math.max(-35, Math.min(35, z));
    this.position.set(clampedX, this.groundHeightAt ? this.groundHeightAt(clampedX, clampedZ) : 0, clampedZ);
    this.group.position.copy(this.position);
    this.targetPosition = null;
    this.velocity.set(0, 0, 0);
    this.isMoving = false;
    if (typeof heading === 'number' && Number.isFinite(heading)) {
      this.currentHeading = heading;
      this.group.rotation.y = heading;
    }
  }

  public moveTo(x: number, z: number) {
    if (this.isMovementLocked || this.isCharacterHidden) return;
    const minX = this.map2Unlocked ? -88 : -48;
    const clampedX = Math.max(minX, Math.min(48, x));
    const clampedZ = Math.max(-35, Math.min(35, z));
    this.targetPosition = new THREE.Vector3(clampedX, 0, clampedZ);
  }

  /**
   * ขับเคลื่อนตัวละครด้วยปุ่ม W / A / S / D หรือการเลื่อนหน้าจอมือถือ ตามเวกเตอร์ทิศทางในโลก 3 มิติ
   */
  public setManualMoveDirection(dirX: number, dirZ: number) {
    if (this.isMovementLocked || this.isCharacterHidden) {
      this.manualDirX = 0;
      this.manualDirZ = 0;
      this.manualSpeedScale = 0;
      return;
    }
    const len = Math.hypot(dirX, dirZ);
    if (len > 0.01) {
      this.manualDirX = dirX / len;
      this.manualDirZ = dirZ / len;
      this.manualSpeedScale = Math.min(1, len);
      this.targetPosition = null;
    } else {
      this.manualDirX = 0;
      this.manualDirZ = 0;
      this.manualSpeedScale = 0;
    }
  }

  public triggerToolSwing() {
    if (this.isCharacterHidden) return;
    this.anim.isSwingingTool = true;
    this.anim.toolSwingProgress = 0;
  }

  public update(delta: number): boolean {
    if (this.isCharacterHidden) {
      this.isMoving = false;
      return false;
    }
    let hasMoved = false;

    let targetSpeed = 0;
    let targetHeading = this.currentHeading;
    const manualLen = Math.hypot(this.manualDirX, this.manualDirZ);
    const usingManualMove = !this.isMovementLocked && manualLen > 0.01 && this.manualSpeedScale > 0.01;

    if (usingManualMove) {
      this.isMoving = true;
      hasMoved = true;
      targetSpeed = this.maxSpeed * this.manualSpeedScale;
      targetHeading = Math.atan2(this.manualDirX, this.manualDirZ);
    } else if (this.targetPosition && !this.isMovementLocked) {
      const deltaX = this.targetPosition.x - this.position.x;
      const deltaZ = this.targetPosition.z - this.position.z;
      const dist = Math.hypot(deltaX, deltaZ);

      if (dist > 0.15) {
        this.isMoving = true;
        hasMoved = true;
        targetSpeed = Math.min(this.maxSpeed, dist * 3.5);
        targetHeading = Math.atan2(deltaX, deltaZ);
      } else {
        this.isMoving = false;
        this.targetPosition = null;
      }
    } else {
      this.isMoving = false;
    }

    const speedDamping = 1 - Math.exp(-(usingManualMove ? 14.0 : 9.0) * delta);
    const currentSpeed = THREE.MathUtils.lerp(this.velocity.length(), targetSpeed, speedDamping);

    let angleDiff = targetHeading - this.currentHeading;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const turnRate = Math.min(1.0, delta * 12.0);
    this.currentHeading += angleDiff * turnRate;
    this.angularVelocity = (angleDiff * turnRate) / Math.max(delta, 0.001);

    if (usingManualMove) {
      this.velocity.set(this.manualDirX * currentSpeed, 0, this.manualDirZ * currentSpeed);
    } else {
      this.velocity.set(
        Math.sin(this.currentHeading) * currentSpeed,
        0,
        Math.cos(this.currentHeading) * currentSpeed
      );
    }

    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.addScaledVector(this.velocity, delta);
    const minX = this.map2Unlocked ? -88 : -48;
    this.position.x = THREE.MathUtils.clamp(this.position.x, minX, 48);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -35, 35);

    if (this.resolveMove) {
      const r = this.resolveMove(prevX, prevZ, this.position.x, this.position.z, this.position.y);
      const intended = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
      this.position.x = r.x;
      this.position.z = r.z;
      const actual = Math.hypot(r.x - prevX, r.z - prevZ);
      // คลิกเดินไปจุดที่ถูกกำแพงกั้น: เลิกเดินต่อเมื่อติดค้างเกิน 0.4 วินาที (กันวิ่งอยู่กับที่)
      if (this.targetPosition && intended > 1e-4 && actual < intended * 0.1) {
        this.stuckTime += delta;
        if (this.stuckTime > 0.4) {
          this.targetPosition = null;
          this.stuckTime = 0;
        }
      } else {
        this.stuckTime = 0;
      }
    }

    const groundY = this.groundHeightAt ? this.groundHeightAt(this.position.x, this.position.z) : 0;
    const dy = groundY - this.position.y;
    this.position.y = Math.abs(dy) < 0.003 ? groundY : this.position.y + dy * (1 - Math.exp(-20 * delta));

    this.group.position.copy(this.position);
    this.group.rotation.y = this.currentHeading;

    const centrifugalForce = (currentSpeed * this.angularVelocity) / 9.81;
    const targetRoll = THREE.MathUtils.clamp(-centrifugalForce * 0.18, -0.35, 0.35);

    const activeKid = isKidGender(this.gender) ? this.kidSlots.get(this.gender) : undefined;
    const activeGlbData = activeKid
      ? activeKid.data
      : this.gender === 'female'
        ? this.womanGlbData
        : this.manGlbData;
    const activeGlbGroup = activeKid
      ? activeKid.group
      : this.gender === 'female'
        ? this.womanGlbGroup
        : this.manGlbGroup;
    const activeToolHolder = activeKid
      ? activeKid.toolHolder
      : this.gender === 'female'
        ? this.womanToolHolder
        : this.manToolHolder;

    if (activeGlbData && activeGlbGroup && activeGlbGroup.visible) {
      updateFarmerGlbAnimation(activeGlbData, activeToolHolder, this.anim, {
        delta,
        isMoving: this.isMoving,
        currentSpeed,
        targetRoll,
      });
      return hasMoved;
    }

    updateProceduralFarmerAnimation(this.rig, this.shadowMesh, this.anim, {
      delta,
      isMoving: this.isMoving,
      currentSpeed,
      targetRoll,
    });

    return hasMoved;
  }

  public dispose() {
    this.isDisposed = true;
    this.outfitController.dispose();
    this.manGlbData?.mixer.stopAllAction();
    this.womanGlbData?.mixer.stopAllAction();
    this.kidSlots.forEach((s) => s.data.mixer.stopAllAction());
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (!obj.userData.isSharedGlbGeometry) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      }
    });
  }
}