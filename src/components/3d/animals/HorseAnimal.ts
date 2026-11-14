// src/components/3d/animals/HorseAnimal.ts
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

interface HorseAnimState {
  phase: number;
  neckPitch: number;
  headPitch: number;
  tailWag: number;
  jaw: number;
}

interface HorseRigRefs {
  legGroups: THREE.Group[];
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  bodyMesh: THREE.Object3D;
  geometries: THREE.BufferGeometry[];
}

interface HorseGlbData {
  mixer: THREE.AnimationMixer;
  actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    run?: THREE.AnimationAction;
    graze?: THREE.AnimationAction;
  };
  currentAction: 'idle' | 'walk' | 'run' | 'graze';
  wrapper: THREE.Group;
  hasBonesOrAnimations: boolean;
}

// ─── Module-level GLTF Cache for horse.glb ───
let _cachedGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let _isLoadingGltf = false;
let _gltfLoadFailed = false;
const _gltfWaiters: Array<(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void> = [];

export function getLoadedHorseGlb() {
  return _cachedGltf;
}

function loadHorseGlb(callback?: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) {
  if (_cachedGltf) {
    callback?.(_cachedGltf);
    return;
  }
  if (callback) {
    _gltfWaiters.push(callback);
  }
  if (_isLoadingGltf || _gltfLoadFailed) return;
  _isLoadingGltf = true;

  const pathsToTry = ['/horse.glb', '/horse-1.glb'];

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
        // Try next candidate path or fall back to procedural horse rig
      }
    }

    _isLoadingGltf = false;
    _gltfLoadFailed = true;
    _gltfWaiters.length = 0;
  })();
}

// โหลดล่วงหน้าทันทีที่เปิดแอป
if (typeof window !== 'undefined') {
  loadHorseGlb();
}

/**
 * 🐴 Horse Species Module (ม้าในคอก)
 * ใช้ horse.glb เพื่อความสมจริง พร้อมระบบ SkeletonUtils clone, AnimationMixer (idle, walk, run, graze)
 * และมีระบบ procedural fallback rig ให้ความรู้สึกสมจริงตลอดเวลา
 */
export class HorseAnimalController implements AnimalSpeciesController {
  public readonly type = 'horse' as const;
  public readonly nameEn = 'Horse';
  public readonly nameTh = 'ม้า';
  public readonly emoji = '🐴';

  private readonly _anim = new WeakMap<AnimalRuntime, HorseAnimState>();
  private readonly _rigRefs = new WeakMap<THREE.Group, HorseRigRefs>();
  private readonly _glbRefs = new WeakMap<THREE.Group, HorseGlbData>();

  private resolveRig(group: THREE.Group): HorseRigRefs | null {
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

  private resolveGlb(group: THREE.Group): HorseGlbData | null {
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
  //  สร้างโมเดลจาก horse.glb หรือ Procedural Fallback
  // ─────────────────────────────────────────────────────────────────
  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'HorseRig';

    // กล่อง Hit Box โปร่งใส ครอบตัวม้าเพื่อให้คลิกหรือลูบตัวได้ง่าย
    const hitBoxGeo = new THREE.BoxGeometry(1.4, 2.2, 2.8);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitMesh.position.set(0, 1.1, 0);
    hitMesh.name = 'HorseHitBox';
    root.add(hitMesh);

    if (_cachedGltf) {
      this.setupGlbModel(root, _cachedGltf);
    } else {
      // สร้างโมเดลสำรองระหว่างรอไฟล์ horse.glb
      const fallbackHolder = new THREE.Group();
      fallbackHolder.name = 'HorseFallbackHolder';
      root.add(fallbackHolder);

      const fallbackRig = this.buildProceduralRig(fallbackHolder, materials);
      this._rigRefs.set(root, fallbackRig);

      // เมื่อโหลด horse.glb เสร็จ ให้สลับโมเดลอัตโนมัติ
      loadHorseGlb((loadedGltf) => {
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
   * ติดตั้งและ Normalization โมเดล horse.glb
   */
  private setupGlbModel(
    root: THREE.Group,
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }
  ) {
    const cloned = SkeletonUtils.clone(gltf.scene);
    cloned.name = 'HorseGlbInstance';

    // คงค่า castShadow / receiveShadow จาก optimizeGLTFSceneForDevice และระบุว่าเป็น shared GLB geometry
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.isSharedGlbGeometry = true;
      }
    });

    // ปรับสเกลให้อยู่ในสัดส่วน 2.5m - 2.8m และจัดระนาบเท้าให้อยู่ที่ Y = 0 พอดี
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    const targetLength = 2.6;
    const currentDim = Math.max(size.x, size.z, 0.001);
    const scaleFactor = targetLength / currentDim;

    const wrapper = new THREE.Group();
    wrapper.name = 'HorseGlbWrapper';
    wrapper.add(cloned);

    cloned.scale.setScalar(scaleFactor);

    // คำนวณ Bounding Box หลังย่อขยายเพื่อจัดกึ่งกลางและยกเท้าไม่ให้จมดิน
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.set(
      -(scaledBox.min.x + scaledBox.max.x) / 2,
      -scaledBox.min.y,
      -(scaledBox.min.z + scaledBox.max.z) / 2
    );

    root.add(wrapper);

    // เซ็ตอัป Animation Mixer
    const mixer = new THREE.AnimationMixer(cloned);
    const actions: HorseGlbData['actions'] = {};

    let hasBonesOrAnimations = gltf.animations && gltf.animations.length > 0;

    if (hasBonesOrAnimations) {
      gltf.animations.forEach((clip) => {
        const nameLower = clip.name.toLowerCase();
        const action = mixer.clipAction(clip);

        if (nameLower.includes('run') || nameLower.includes('gallop') || nameLower.includes('sprint')) {
          actions.run = action;
        } else if (nameLower.includes('walk') || nameLower.includes('trot') || nameLower.includes('move')) {
          actions.walk = action;
        } else if (nameLower.includes('eat') || nameLower.includes('graze') || nameLower.includes('feed')) {
          actions.graze = action;
        } else if (!actions.idle || nameLower.includes('idle') || nameLower.includes('stay') || nameLower.includes('stand')) {
          actions.idle = action;
        }
      });

      if (!actions.idle && gltf.animations[0]) {
        actions.idle = mixer.clipAction(gltf.animations[0]);
      }
      if (!actions.walk && actions.idle) {
        actions.walk = actions.idle;
      }
      if (!actions.run && actions.walk) {
        actions.run = actions.walk;
      }

      if (actions.idle) {
        actions.idle.play();
      }
    }

    const glbData: HorseGlbData = {
      mixer,
      actions,
      currentAction: 'idle',
      wrapper,
      hasBonesOrAnimations,
    };

    this._glbRefs.set(root, glbData);
  }

  /**
   * โมเดลม้าแบบ Procedural (สำรองเมื่อยังไม่มีไฟล์ horse.glb)
   */
  private buildProceduralRig(
    holder: THREE.Group,
    materials: AnimalRigMaterials
  ): HorseRigRefs {
    const geometries: THREE.BufferGeometry[] = [];
    const horseCoatMat = new THREE.MeshStandardMaterial({
      color: 0x6d4229, // สีน้ำตาลเชสต์นัทสง่างาม
      roughness: 0.75,
      metalness: 0.05,
    });
    const darkManeMat = new THREE.MeshStandardMaterial({
      color: 0x1f140e,
      roughness: 0.9,
    });
    const muzzleMat = new THREE.MeshStandardMaterial({
      color: 0xd7ccc8,
      roughness: 0.65,
    });
    const hoofMat = materials.darkHoofMat;

    // ลำตัวม้ากำยำ (Barrel & Chest)
    const bodyGeo = new THREE.BoxGeometry(0.85, 0.92, 1.85);
    geometries.push(bodyGeo);
    const bodyMesh = new THREE.Mesh(bodyGeo, horseCoatMat);
    bodyMesh.position.set(0, 1.25, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    holder.add(bodyMesh);

    // อานม้าและผ้าปูอาน (Saddle pad)
    const saddlePadGeo = new THREE.BoxGeometry(0.92, 0.12, 0.9);
    geometries.push(saddlePadGeo);
    const saddlePadMat = new THREE.MeshStandardMaterial({ color: 0x8d281e, roughness: 0.8 });
    const saddlePad = new THREE.Mesh(saddlePadGeo, saddlePadMat);
    saddlePad.position.set(0, 0.48, -0.05);
    bodyMesh.add(saddlePad);

    const saddleGeo = new THREE.BoxGeometry(0.72, 0.18, 0.6);
    geometries.push(saddleGeo);
    const saddleMat = new THREE.MeshStandardMaterial({ color: 0x2d1a12, roughness: 0.6 });
    const saddle = new THREE.Mesh(saddleGeo, saddleMat);
    saddle.position.set(0, 0.12, 0);
    saddlePad.add(saddle);

    // คอม้า (Arched Neck)
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 1.45, 0.8);
    holder.add(neckGroup);

    const neckGeo = new THREE.BoxGeometry(0.48, 0.95, 0.65);
    geometries.push(neckGeo);
    const neckMesh = new THREE.Mesh(neckGeo, horseCoatMat);
    neckMesh.position.set(0, 0.35, 0.22);
    neckMesh.rotation.x = -0.55;
    neckMesh.castShadow = true;
    neckGroup.add(neckMesh);

    // แผงคอม้า (Mane)
    const maneGeo = new THREE.BoxGeometry(0.14, 0.9, 0.3);
    geometries.push(maneGeo);
    const maneMesh = new THREE.Mesh(maneGeo, darkManeMat);
    maneMesh.position.set(0, 0.38, -0.15);
    maneMesh.rotation.x = -0.55;
    neckGroup.add(maneMesh);

    // หัวม้า (Head)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.72, 0.48);
    neckGroup.add(headGroup);

    const skullGeo = new THREE.BoxGeometry(0.44, 0.45, 0.55);
    geometries.push(skullGeo);
    const skullMesh = new THREE.Mesh(skullGeo, horseCoatMat);
    skullMesh.castShadow = true;
    headGroup.add(skullMesh);

    // สันจมูกและปาก (Muzzle)
    const snoutGeo = new THREE.BoxGeometry(0.36, 0.32, 0.52);
    geometries.push(snoutGeo);
    const snoutMesh = new THREE.Mesh(snoutGeo, muzzleMat);
    snoutMesh.position.set(0, -0.12, 0.44);
    snoutMesh.rotation.x = 0.25;
    snoutMesh.castShadow = true;
    headGroup.add(snoutMesh);

    // จมูก (Nostrils)
    const nostrilGeo = new THREE.SphereGeometry(0.04, 6, 6);
    geometries.push(nostrilGeo);
    const nostrilL = new THREE.Mesh(nostrilGeo, materials.darkEyeMat);
    nostrilL.position.set(0.1, -0.06, 0.68);
    const nostrilR = nostrilL.clone();
    nostrilR.position.set(-0.1, -0.06, 0.68);
    headGroup.add(nostrilL, nostrilR);

    // หูม้า (Ears)
    const earGeo = new THREE.ConeGeometry(0.09, 0.32, 5);
    geometries.push(earGeo);
    const earL = new THREE.Mesh(earGeo, horseCoatMat);
    earL.position.set(0.18, 0.36, -0.1);
    earL.rotation.z = -0.25;
    earL.rotation.x = -0.15;
    const earR = new THREE.Mesh(earGeo, horseCoatMat);
    earR.position.set(-0.18, 0.36, -0.1);
    earR.rotation.z = 0.25;
    earR.rotation.x = -0.15;
    headGroup.add(earL, earR);

    // ดวงตาม้า (Eyes)
    const eyeGeo = new THREE.SphereGeometry(0.055, 6, 6);
    geometries.push(eyeGeo);
    const eyeL = new THREE.Mesh(eyeGeo, materials.darkEyeMat);
    eyeL.position.set(0.23, 0.1, 0.1);
    const eyeR = eyeL.clone();
    eyeR.position.set(-0.23, 0.1, 0.1);
    headGroup.add(eyeL, eyeR);

    // หางม้า (Tail)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.45, -0.92);
    holder.add(tailGroup);

    const tailGeo = new THREE.CylinderGeometry(0.08, 0.16, 0.95, 8);
    geometries.push(tailGeo);
    const tailMesh = new THREE.Mesh(tailGeo, darkManeMat);
    tailMesh.position.set(0, -0.42, -0.15);
    tailMesh.rotation.x = 0.35;
    tailMesh.castShadow = true;
    tailGroup.add(tailMesh);

    // ขาม้าทั้ง 4 ข้าง (Legs with joints & dark hooves)
    const legGroups: THREE.Group[] = [];
    const upperLegGeo = new THREE.BoxGeometry(0.24, 0.58, 0.26);
    const lowerLegGeo = new THREE.BoxGeometry(0.18, 0.52, 0.2);
    const hoofGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.16, 8);
    geometries.push(upperLegGeo, lowerLegGeo, hoofGeo);

    const legPositions: [number, number, string][] = [
      [0.32, 0.65, 'Leg_FL'],
      [-0.32, 0.65, 'Leg_FR'],
      [0.32, -0.65, 'Leg_BL'],
      [-0.32, -0.65, 'Leg_BR'],
    ];

    legPositions.forEach(([x, z, name]) => {
      const hip = new THREE.Group();
      hip.name = name;
      hip.position.set(x, 0.98, z);

      const upper = new THREE.Mesh(upperLegGeo, horseCoatMat);
      upper.position.set(0, -0.24, 0);
      upper.castShadow = true;
      hip.add(upper);

      const knee = new THREE.Group();
      knee.position.set(0, -0.48, 0);
      hip.add(knee);

      const lower = new THREE.Mesh(lowerLegGeo, horseCoatMat);
      lower.position.set(0, -0.22, 0);
      lower.castShadow = true;
      knee.add(lower);

      const hoof = new THREE.Mesh(hoofGeo, hoofMat);
      hoof.position.set(0, -0.46, 0.02);
      hoof.castShadow = true;
      knee.add(hoof);

      holder.add(hip);
      legGroups.push(hip);
    });

    return {
      legGroups,
      neckGroup,
      headGroup,
      tailGroup,
      bodyMesh,
      geometries,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Animation Evaluation Loop
  // ─────────────────────────────────────────────────────────────────
  public animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    const glbData = this.resolveGlb(runtime.group);

    // 1. ถ้ามีโมเดล horse.glb และ AnimationMixer ให้จัดการผ่าน Mixer
    if (glbData) {
      glbData.mixer.update(dt);

      let targetAction: 'idle' | 'walk' | 'run' | 'graze' = 'idle';
      if (runtime.state === 'walking' && currentSpeed > 0.08) {
        targetAction = currentSpeed > 2.0 && glbData.actions.run ? 'run' : 'walk';
      } else if (runtime.state === 'grazing') {
        targetAction = 'graze';
      }

      if (glbData.currentAction !== targetAction) {
        const cur = glbData.actions[glbData.currentAction];
        const next = glbData.actions[targetAction] || glbData.actions.idle;

        if (cur && next && cur !== next) {
          cur.fadeOut(0.25);
          next.reset().fadeIn(0.25).play();
        } else if (next && !next.isRunning()) {
          next.play();
        }
        glbData.currentAction = targetAction;
      }

      // ปรับ playback speed ตามความเร็วการเคลื่อนที่จริง (Calculus: timeScale = v / v_nom)
      if (glbData.currentAction === 'walk' && glbData.actions.walk) {
        glbData.actions.walk.timeScale = Math.max(0.2, (currentSpeed / 2.6) * 1.0);
      } else if (glbData.currentAction === 'run' && glbData.actions.run) {
        glbData.actions.run.timeScale = Math.max(0.2, (currentSpeed / 4.0) * 1.0);
      }

      // ถ้า GLB ไม่มีกระดูก/คลิปแอนิเมชัน ให้ช่วยขยับกระโดดแบบสมจริง
      if (!glbData.hasBonesOrAnimations) {
        if (isWalking) {
          const sway = Math.sin(runtime.walkCycle) * 0.035;
          const bob = Math.abs(Math.sin(runtime.walkCycle)) * 0.055;
          glbData.wrapper.position.y = bob;
          glbData.wrapper.rotation.z = sway;
          glbData.wrapper.rotation.x = Math.sin(runtime.walkCycle * 2) * 0.02;
        } else {
          glbData.wrapper.position.y = 0;
          glbData.wrapper.rotation.x = 0;
          glbData.wrapper.rotation.z = 0;
        }
      }

      // ปฏิกิริยาเมื่อถูกลูบตัว (Pet bounce)
      const bounceY = runtime.petBounce > 0.001 ? Math.sin(runtime.petBounce * Math.PI) * 0.35 : 0;
      if (!glbData.hasBonesOrAnimations) {
        glbData.wrapper.position.y += bounceY;
      } else {
        glbData.wrapper.position.y = bounceY;
      }
      return;
    }

    // 2. แอนิเมชันสำหรับ Procedural Fallback Rig (Calculus: continuous Fourier gait harmonics)
    const rig = this.resolveRig(runtime.group);
    if (!rig) return;

    let anim = this._anim.get(runtime);
    if (!anim) {
      anim = { phase: 0, neckPitch: 0, headPitch: 0, tailWag: 0, jaw: 0 };
      this._anim.set(runtime, anim);
    }

    const step = Math.min(0.1, Math.max(0, dt));
    const ease = 1 - Math.exp(-10.0 * step);
    const walkBlend = isWalking && currentSpeed > 0.05 ? Math.min(1.0, currentSpeed / 1.5) : 0;

    const phase = runtime.walkCycle;
    // 4-beat equine gait phase offsets: FL: 0, FR: π, BL: 0.5π, BR: 1.5π
    const legOffsets = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];

    for (let i = 0; i < 4; i++) {
      const hip = rig.legGroups[i];
      if (!hip) continue;

      const p = phase + legOffsets[i];
      const targetHip = Math.sin(p) * 0.65 * walkBlend;
      const targetKnee = -Math.max(0, Math.sin(p + 0.4)) * 0.7 * walkBlend;

      hip.rotation.x += (targetHip - hip.rotation.x) * ease;

      const knee = hip.children[1] as THREE.Group | undefined;
      if (knee) {
        knee.rotation.x += (targetKnee - knee.rotation.x) * ease;
      }
    }

    const isGrazing = runtime.state === 'grazing';
    const targetNeck = isGrazing
      ? 0.75
      : isWalking
      ? -0.15 + Math.sin(phase) * 0.1 * walkBlend
      : Math.sin(elapsed * 1.2) * 0.05;
    const targetHead = isGrazing
      ? 0.35
      : isWalking
      ? Math.sin(phase) * 0.08 * walkBlend
      : Math.sin(elapsed * 1.5) * 0.04;

    rig.neckGroup.rotation.x += (targetNeck - rig.neckGroup.rotation.x) * ease;
    rig.headGroup.rotation.x += (targetHead - rig.headGroup.rotation.x) * ease;
    rig.tailGroup.rotation.z +=
      ((isWalking ? Math.sin(phase * 1.5) * 0.28 : Math.sin(elapsed * 3.0) * 0.2) -
        rig.tailGroup.rotation.z) *
      ease;
    rig.bodyMesh.position.y +=
      (1.25 + Math.abs(Math.sin(phase)) * 0.06 * walkBlend - rig.bodyMesh.position.y) * ease;

    // ปฏิกิริยาเมื่อถูกลูบตัว
    if (runtime.petBounce > 0.01) {
      const b = runtime.petBounce;
      rig.neckGroup.rotation.x = -0.4 * b;
      rig.headGroup.rotation.x = -0.25 * b;
      rig.bodyMesh.position.y += Math.sin(b * Math.PI) * 0.3;
    }
  }
}

export const horseSpecies = new HorseAnimalController();
