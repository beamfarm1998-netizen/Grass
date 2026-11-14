// src/components/3d/animals/CowAnimal.ts
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

interface LegRig { hip: THREE.Group; knee: THREE.Group; }

interface CowAnimState {
  phase: number;
  crouch: number;
  neck1: number; neck2: number; head: number;
  jaw: number; jawVel: number;
}

interface CowRigRefs {
  legRigs: LegRig[];
  neck1: THREE.Group;
  neck2: THREE.Group;
  head: THREE.Group;
  bodyBaseY: number;
  geometries: THREE.BufferGeometry[];
}

interface CowGlbData {
  mixer: THREE.AnimationMixer;
  actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    graze?: THREE.AnimationAction;
  };
  currentAction: 'idle' | 'walk' | 'graze';
  wrapper: THREE.Group;
  hasBonesOrAnimations: boolean;
}

// ─── Anatomical constants (Fallback procedural Holstein reference) ───
const BODY_W = 0.70, BODY_H = 0.78, BODY_L = 1.72;
const HIP_Y  = 0.87;
const UPPER_LEG = 0.43, LOWER_LEG = 0.38, HOOF_H = 0.09;
const NECK1_LEN = 0.48, NECK2_LEN = 0.38, HEAD_LEN = 0.48;

const REST_NECK1 = 1.30, REST_NECK2 = 0.00, REST_HEAD = -0.90;
const GRAZE_NECK1 = 2.30, GRAZE_NECK2 = 0.40, GRAZE_HEAD = -1.40;
const GRAZE_CROUCH = 0.10;

const SWING_AMP = 0.45;
const TROT_THRESHOLD = 1.0;
const DUTY_WALK = 0.65, DUTY_TROT = 0.50;
const WALK_OFFSETS = [0.25, 0.75, 0.00, 0.50];
const TROT_OFFSETS = [0.00, 0.50, 0.50, 0.00];

const LOWER_SEG_LEN = LOWER_LEG + HOOF_H;
const JAW_SUBSTEP = 0.033;

// ─── Module-level GLTF Cache for cow.glb ───
let _cachedGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let _isLoadingGltf = false;
let _gltfLoadFailed = false;
const _gltfWaiters: Array<(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void> = [];

export function getLoadedCowGlb() {
  return _cachedGltf;
}

function loadCowGlb(callback?: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) {
  if (_cachedGltf) {
    callback?.(_cachedGltf);
    return;
  }
  if (callback) {
    _gltfWaiters.push(callback);
  }
  if (_isLoadingGltf || _gltfLoadFailed) return;
  _isLoadingGltf = true;

  const pathsToTry = ['/cow.glb', '/cow-1.glb'];

  void (async () => {
    for (const candidateUrl of pathsToTry) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidateUrl);
        if (!gltf?.scene || gltf.scene.children.length === 0) {
          continue;
        }
        optimizeGLTFSceneForDevice(gltf.scene, inspection);
        _isLoadingGltf = false;
        _cachedGltf = {
          scene: gltf.scene,
          animations: gltf.animations || [],
        };
        _gltfWaiters.forEach((cb) => cb(_cachedGltf!));
        _gltfWaiters.length = 0;
        return;
      } catch {
        // Try next candidate path or fall back to procedural cow rig
      }
    }

    _isLoadingGltf = false;
    _gltfLoadFailed = true;
    _gltfWaiters.length = 0;
  })();
}

// เริ่มต้นดาวน์โหลดล่วงหน้าทันทีที่เปิดแอป
if (typeof window !== 'undefined') {
  loadCowGlb();
}

/**
 * 🐮 Cow Species Module (วัว)
 * ใช้ cow.glb เพื่อความสมจริง พร้อมระบบรองรับโมเดลกระดูก/แอนิเมชัน และระบบสำรอง
 */
export class CowAnimalController implements AnimalSpeciesController {
  public readonly type = 'cow' as const;
  public readonly nameEn = 'Cow';
  public readonly nameTh = 'วัว';
  public readonly emoji = '🐮';

  private readonly _anim = new WeakMap<AnimalRuntime, CowAnimState>();
  private readonly _rigRefs = new WeakMap<THREE.Group, CowRigRefs>();
  private readonly _glbRefs = new WeakMap<THREE.Group, CowGlbData>();

  private resolveRig(group: THREE.Group): CowRigRefs | null {
    const direct = this._rigRefs.get(group);
    if (direct) return direct;
    for (const child of group.children) {
      if (child instanceof THREE.Group) {
        const hit = this._rigRefs.get(child);
        if (hit) return hit;
      }
    }
    return null;
  }

  private resolveGlb(group: THREE.Group): CowGlbData | null {
    const direct = this._glbRefs.get(group);
    if (direct) return direct;
    for (const child of group.children) {
      if (child instanceof THREE.Group) {
        const hit = this._glbRefs.get(child);
        if (hit) return hit;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  //  สร้างโมเดลจาก cow.glb หรือ Procedural Fallback
  // ─────────────────────────────────────────────────────────────────
  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'CowRig';

    // สร้างกล่อง Hit Box โปร่งใส ครอบตัววัวเพื่อให้คลิกโดนง่ายในทุกโมเดล
    const hitBoxGeo = new THREE.BoxGeometry(1.2, 1.6, 2.2);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitMesh.position.set(0, 0.8, 0);
    hitMesh.name = 'CowHitBox';
    root.add(hitMesh);

    if (_cachedGltf) {
      this.setupGlbModel(root, _cachedGltf);
    } else {
      // สร้างโมเดลสำรองระหว่างรอไฟล์ GLB
      const fallbackHolder = new THREE.Group();
      fallbackHolder.name = 'CowFallbackHolder';
      root.add(fallbackHolder);

      const fallbackRig = this.buildProceduralRig(fallbackHolder, materials);
      this._rigRefs.set(root, fallbackRig);

      // เมื่อโหลด cow.glb เสร็จ ให้สลับโมเดลอัตโนมัติ
      loadCowGlb((loadedGltf) => {
        if (!root.parent && root.children.length === 0) return;
        root.remove(fallbackHolder);
        fallbackRig.geometries.forEach((g) => g.dispose());
        this._rigRefs.delete(root);

        this.setupGlbModel(root, loadedGltf);
      });
    }

    return {
      root,
      bodyMesh: hitMesh,
      headGroup: root,
      legs: [],
    };
  }

  /**
   * ติดตั้งและ Normalization โมเดล cow.glb
   */
  private setupGlbModel(
    root: THREE.Group,
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }
  ) {
    const calfNode = gltf.scene.getObjectByName('Calf1_Rig');
    const targetNode = calfNode || gltf.scene;
    const cloned = SkeletonUtils.clone(targetNode);
    cloned.name = 'CowGlbInstance';

    // ถ้าเป็นโมเดล Calf ใน cow.glb ซึ่งหันหน้าไปทาง +X ให้หมุน -π/2 รอบแกน Y เพื่อให้หันหน้าไปทาง +Z (ทิศทางการเดิน)
    if (calfNode) {
      cloned.rotation.y = -Math.PI / 2;
    }

    // คงค่า castShadow / receiveShadow จาก optimizeGLTFSceneForDevice และระบุว่าเป็น shared GLB geometry
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.isSharedGlbGeometry = true;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    // ปรับสัดส่วนวัวสมจริง: ความสูง ~1.5m และความยาว ~2.1m
    const targetHeight = 1.5;
    const scaleFactor = targetHeight / Math.max(size.y, 0.001);

    const wrapper = new THREE.Group();
    wrapper.name = 'CowGlbWrapper';
    wrapper.add(cloned);

    cloned.scale.setScalar(scaleFactor);

    // คำนวณ Bounding Box หลังย่อขยายเพื่อจัดกึ่งกลางและยกกีบเท้าไม่ให้จมดิน (Y = 0)
    wrapper.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
    cloned.position.y -= scaledBox.min.y;
    cloned.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;

    root.add(wrapper);

    // เซ็ตอัป Animation Mixer
    const mixer = new THREE.AnimationMixer(cloned);
    const actions: CowGlbData['actions'] = {};
    const hasBonesOrAnimations = gltf.animations.length > 0;

    if (gltf.animations && gltf.animations.length > 0) {
      // ค้นหาคลิป Calf หรือคลิปทั่วไป
      const calfClip = gltf.animations.find((c) => c.name.includes('Calf1')) || gltf.animations[0];
      const feedClip = gltf.animations.find((c) => c.name.toLowerCase().includes('feed')) || calfClip;

      actions.idle = mixer.clipAction(calfClip);
      actions.walk = mixer.clipAction(calfClip);
      actions.graze = mixer.clipAction(feedClip);

      // ตรวจหาคลิปเพิ่มเติมถ้ามี
      gltf.animations.forEach((clip) => {
        const nameLower = clip.name.toLowerCase();
        const action = mixer.clipAction(clip);
        if (nameLower.includes('walk') || nameLower.includes('run') || nameLower.includes('move')) {
          actions.walk = action;
        } else if (nameLower.includes('graze') || nameLower.includes('eat')) {
          actions.graze = action;
        }
      });

      if (actions.idle) {
        actions.idle.play();
      }
    }

    const glbData: CowGlbData = {
      mixer,
      actions,
      currentAction: 'idle',
      wrapper,
      hasBonesOrAnimations,
    };

    this._glbRefs.set(root, glbData);
    root.userData._isCowGlb = true;
  }

  // ─────────────────────────────────────────────────────────────────
  //  แอนิเมชันความสมจริง: ควบคุม AnimationMixer หรือ Procedural Kinematics
  // ─────────────────────────────────────────────────────────────────
  public animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    const glbData = this.resolveGlb(runtime.group);

    // 1. ถ้ามี cow.glb กำลังทำงาน
    if (glbData) {
      const { mixer, actions, wrapper } = glbData;
      const step = Math.min(0.1, Math.max(0, dt));

      mixer.update(step);

      // กำหนด Action ที่ควรเล่น
      let desiredAction: 'idle' | 'walk' | 'graze' = 'idle';
      if (isWalking && currentSpeed > 0.08) {
        desiredAction = 'walk';
      } else if (runtime.state === 'grazing') {
        desiredAction = 'graze';
      }

      if (glbData.currentAction !== desiredAction) {
        const prev = actions[glbData.currentAction];
        const next = actions[desiredAction] || actions.idle;
        if (next && prev && prev !== next) {
          prev.fadeOut(0.3);
          next.reset().fadeIn(0.3).play();
        } else if (next && !next.isRunning()) {
          next.play();
        }
        glbData.currentAction = desiredAction;
      }

      // ปรับความเร็วแอนิเมชันท่าเดินตามความเร็วจริง (Calculus: timeScale = v / v_nom)
      if (desiredAction === 'walk' && actions.walk) {
        actions.walk.timeScale = Math.max(0.3, (currentSpeed / 1.4) * 1.0);
      }

      // เดินแบบมีชีวิตชีวา: ขยับตัวส่ายและโยกขึ้นลงเล็กน้อยตามรอบก้าวเดิน (Harmonic walk bobbing & sway)
      if (isWalking) {
        const sway = Math.sin(runtime.walkCycle) * 0.035;
        const bob = Math.abs(Math.sin(runtime.walkCycle)) * 0.04;
        wrapper.rotation.z = sway;
        wrapper.position.y = bob;
        wrapper.rotation.x = Math.sin(runtime.walkCycle * 2) * 0.015;
      } else if (runtime.state === 'grazing') {
        wrapper.rotation.x = THREE.MathUtils.lerp(wrapper.rotation.x, 0.15, dt * 4.0);
        wrapper.position.y = THREE.MathUtils.lerp(wrapper.position.y, -0.03, dt * 4.0);
        wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, 0, dt * 4.0);
      } else {
        wrapper.rotation.x = THREE.MathUtils.lerp(wrapper.rotation.x, Math.sin(elapsed * 1.5) * 0.012, dt * 3.0);
        wrapper.position.y = THREE.MathUtils.lerp(wrapper.position.y, 0, dt * 3.0);
        wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, 0, dt * 3.0);
      }

      // เอฟเฟกต์เมื่อลูบตัววัว (Petting): ก้มหัวลงอย่างสุภาพและส่ายหัว/ตัวไปมาอย่างมีความสุข ไม่กระโดด
      if (runtime.petBounce > 0.001) {
        const petPhase = runtime.petBounce; // ค่อยๆ ลดลงจาก ~0.8 สู่ 0
        const bowAngle = Math.sin(petPhase * Math.PI) * 0.22; // ก้มหัว/คอลง
        const swayAngle = Math.sin(petPhase * Math.PI * 4.0) * 0.18; // ส่ายหัวไปมา
        const wagAngle = Math.sin(petPhase * Math.PI * 4.0) * 0.08; // ส่ายตัว
        wrapper.rotation.x += bowAngle;
        wrapper.rotation.y += swayAngle;
        wrapper.rotation.z += wagAngle;
        wrapper.position.y -= Math.sin(petPhase * Math.PI) * 0.04; // โน้มตัวลงต่ำอย่างนุ่มนวล (ไม่กระโดด)
      }

      return;
    }

    // 2. ถ้ายังเป็น Procedural Rig สำรอง ให้คำนวณ Gait Harmonics เดิม
    this.animateProcedural(runtime, dt, elapsed, isWalking, currentSpeed);
  }

  // ─────────────────────────────────────────────────────────────────
  //  Procedural Fallback Rig & Animation
  // ─────────────────────────────────────────────────────────────────
  private buildProceduralRig(root: THREE.Group, materials: AnimalRigMaterials): CowRigRefs {
    const geometries: THREE.BufferGeometry[] = [];
    const track = <G extends THREE.BufferGeometry>(g: G): G => {
      geometries.push(g);
      return g;
    };

    const bodyMesh = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 24, 16)), materials.cowMat);
    bodyMesh.scale.set(BODY_W, BODY_H, BODY_L);
    bodyMesh.position.set(0, HIP_Y + BODY_H / 2, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);

    const udder = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 12, 8)), materials.pinkMuzzleMat);
    udder.scale.set(1.25, 0.82, 1.05);
    udder.position.set(0, -BODY_H / 2 - 0.035, -0.36);
    bodyMesh.add(udder);

    const neck1Group = new THREE.Group();
    neck1Group.position.set(0, BODY_H / 2 - 0.15, BODY_L / 2 - 0.2);
    neck1Group.rotation.x = REST_NECK1;
    bodyMesh.add(neck1Group);

    const neck1Mesh = new THREE.Mesh(track(new THREE.CylinderGeometry(0.15, 0.24, NECK1_LEN, 12)), materials.cowMat);
    neck1Mesh.position.y = NECK1_LEN / 2;
    neck1Group.add(neck1Mesh);

    const neck2Group = new THREE.Group();
    neck2Group.position.set(0, NECK1_LEN, 0);
    neck1Group.add(neck2Group);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, NECK2_LEN, 0);
    headGroup.rotation.x = REST_HEAD;
    neck2Group.add(headGroup);

    const skull = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 18, 12)), materials.cowMat);
    skull.scale.set(0.31, 0.34, 0.43);
    skull.position.set(0, 0.1, 0.15);
    headGroup.add(skull);

    const muzzle = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 12, 8)), materials.pinkMuzzleMat);
    muzzle.scale.set(0.23, 0.17, 0.25);
    muzzle.position.set(0, -0.02, HEAD_LEN - 0.1);
    headGroup.add(muzzle);

    const legRigs: LegRig[] = [];
    const makeLeg = (x: number, z: number) => {
      const hip = new THREE.Group();
      hip.position.set(x, HIP_Y, z);
      root.add(hip);

      const upper = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.07, UPPER_LEG, 8)), materials.cowMat);
      upper.position.set(0, -UPPER_LEG / 2, 0);
      hip.add(upper);

      const knee = new THREE.Group();
      knee.position.set(0, -UPPER_LEG, 0);
      hip.add(knee);

      const lower = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.05, LOWER_LEG, 8)), materials.cowMat);
      lower.position.set(0, -LOWER_LEG / 2, 0);
      knee.add(lower);

      legRigs.push({ hip, knee });
    };

    const legW = 0.25;
    makeLeg(legW, BODY_L * 0.36);
    makeLeg(-legW, BODY_L * 0.36);
    makeLeg(legW, -BODY_L * 0.34);
    makeLeg(-legW, -BODY_L * 0.34);

    return {
      legRigs,
      neck1: neck1Group,
      neck2: neck2Group,
      head: headGroup,
      bodyBaseY: bodyMesh.position.y,
      geometries,
    };
  }

  private animateProcedural(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ) {
    let s = this._anim.get(runtime);
    if (!s) {
      s = { phase: 0, crouch: 0, neck1: REST_NECK1, neck2: REST_NECK2, head: REST_HEAD, jaw: 0, jawVel: 0 };
      this._anim.set(runtime, s);
    }

    const step = Math.min(0.1, Math.max(0, dt));
    const ease = 1 - Math.exp(-10 * step);
    const isGrazing = runtime.state === 'grazing';

    const crouchTarget = isGrazing ? GRAZE_CROUCH : 0;
    s.crouch += (crouchTarget - s.crouch) * ease;

    const trotBlend = isWalking
      ? THREE.MathUtils.smoothstep(currentSpeed, TROT_THRESHOLD - 0.2, TROT_THRESHOLD + 0.2)
      : 0;

    const L = UPPER_LEG + LOWER_LEG;
    const D = DUTY_WALK * (1 - trotBlend) + DUTY_TROT * trotBlend;
    let freq = 0;
    if (isWalking && currentSpeed > 0.01) {
      freq = Math.min((Math.PI * currentSpeed * D) / (L * SWING_AMP), 12);
    }
    s.phase = (s.phase + freq * step) % (Math.PI * 2);

    const offsets = WALK_OFFSETS.map((w, i) => {
      let diff = TROT_OFFSETS[i] - w;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      return w + diff * trotBlend;
    });

    const rig = this.resolveRig(runtime.group);
    if (!rig) return;

    const walkScale = isWalking ? 1 : 0;
    const crouchComp =
      s.crouch > 1e-3
        ? Math.acos(THREE.MathUtils.clamp(1 - s.crouch / LOWER_SEG_LEN, -1, 1))
        : 0;

    for (let i = 0; i < 4; i++) {
      const leg = rig.legRigs[i];
      if (!leg) continue;

      const legPhase = s.phase + offsets[i] * Math.PI * 2;
      const cycle = ((legPhase / (Math.PI * 2)) % 1 + 1) % 1;
      let hipAngle = 0;
      let swingLift = 0;

      if (walkScale > 0 && currentSpeed > 0.01) {
        if (cycle < D) {
          hipAngle = -SWING_AMP + 2 * SWING_AMP * (cycle / D);
        } else {
          const swingProgress = (cycle - D) / (1 - D);
          const easedSwing = 0.5 - 0.5 * Math.cos(Math.PI * swingProgress);
          hipAngle = SWING_AMP - 2 * SWING_AMP * easedSwing;
          swingLift = Math.sin(Math.PI * swingProgress);
        }
      }

      const targetHip = hipAngle;
      const targetKnee = -0.7 * SWING_AMP * swingLift * walkScale + crouchComp;
      leg.hip.rotation.x += (targetHip - leg.hip.rotation.x) * ease;
      leg.knee.rotation.x += (targetKnee - leg.knee.rotation.x) * ease;
    }

    const n1T = isGrazing ? GRAZE_NECK1 : REST_NECK1;
    const n2T = isGrazing ? GRAZE_NECK2 : REST_NECK2;
    const hT = isGrazing ? GRAZE_HEAD : REST_HEAD;
    s.neck1 += (n1T - s.neck1) * ease;
    s.neck2 += (n2T - s.neck2) * ease;
    s.head += (hT - s.head) * ease;

    rig.neck1.rotation.x = s.neck1;
    rig.neck2.rotation.x = s.neck2;
    rig.head.rotation.x = s.head + (isGrazing ? 0 : Math.sin(elapsed * 1.2) * 0.03);

    // เอฟเฟกต์ลูบตัวสำหรับ Procedural Rig: ก้มหัวและส่ายหัวไปมา ไม่กระโดด
    if (runtime.petBounce > 0.001) {
      const petPhase = runtime.petBounce;
      rig.neck1.rotation.x += Math.sin(petPhase * Math.PI) * 0.25;
      rig.head.rotation.x += Math.sin(petPhase * Math.PI) * 0.20;
      rig.head.rotation.y = Math.sin(petPhase * Math.PI * 4.0) * 0.25;
      runtime.group.rotation.y += Math.sin(petPhase * Math.PI * 4.0) * 0.08;
    }

    const ud = runtime.group.userData;
    if (ud.__baseY === undefined) ud.__baseY = runtime.group.position.y;
    runtime.group.position.y = ud.__baseY - s.crouch - (runtime.petBounce > 0.001 ? Math.sin(runtime.petBounce * Math.PI) * 0.04 : 0);
  }

  public dispose(rig: AnimalRigResult): void {
    const glbData = this._glbRefs.get(rig.root);
    if (glbData) {
      glbData.mixer.stopAllAction();
      this._glbRefs.delete(rig.root);
    }
    const refs = this._rigRefs.get(rig.root);
    if (refs) {
      refs.geometries.forEach((g) => g.dispose());
      this._rigRefs.delete(rig.root);
    }
  }
}

export const cowSpecies = new CowAnimalController();