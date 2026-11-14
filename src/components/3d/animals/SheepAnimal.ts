// src/components/3d/animals/SheepAnimal.ts
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

interface SheepAnimState {
  phase: number;
  headPitch: number;
  tailWag: number;
}

interface SheepRigRefs {
  legGroups: THREE.Group[];
  headGroup: THREE.Group;
  tailGroup: THREE.Group;
  bodyMesh: THREE.Object3D;
  geometries: THREE.BufferGeometry[];
}

interface SheepGlbData {
  mixer: THREE.AnimationMixer;
  actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    graze?: THREE.AnimationAction;
  };
  currentAction: 'idle' | 'walk' | 'graze';
  wrapper: THREE.Group;
  hasBonesOrAnimations: boolean;
  strideLength: number;
}

// ─────────────────────────────────────────────────────────────────
//  CONFIG — ปรับค่าตรงนี้ให้ตรงกับ GLB ของคุณ
// ─────────────────────────────────────────────────────────────────
const SHEEP_GLB_CONFIG = {
  /** ความสูงไหล่ที่ต้องการ (เมตร) — ดึงจากภาพ Dimensions Y = 0.858 */
  targetHeight: 0.86,
  /** หมุนโมเดลรอบแกน Y (เรเดียน) — ใส่ Math.PI ถ้าแกะเดินถอยหลัง */
  yRotation: 0,
  /** ระยะก้าวต่อ 1 cycle (เมตร) — อัปเดตจากภาพล่าสุด Dimensions Z = 1.7 */
  strideLength: 1.2, 
  /** ความเร็วสูงสุดที่ระบบเคลื่อนที่ (m/s) — ใช้ normalize timeScale */
  maxWalkSpeed: 1.5,
  /** map ชื่อ clip → action (เรียงตามลำดับความสำคัญ) */
  clipMap: [
    { key: 'walk' as const,  keywords: ['walk', 'move', 'trot', 'run', 'locomotion'] },
    { key: 'graze' as const, keywords: ['eat', 'graze', 'feed', 'grass', 'bite'] },
    { key: 'idle' as const,  keywords: ['idle', 'stay', 'stand', 'breath', 'loop'] },
  ],
};

// ─── Module-level GLTF Cache for sheep.glb ───
let _cachedGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let _isLoadingGltf = false;
let _gltfLoadFailed = false;
const _gltfWaiters: Array<(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void> = [];

export function getLoadedSheepGlb() {
  return _cachedGltf;
}

function loadSheepGlb(callback?: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void) {
  if (_cachedGltf) {
    callback?.(_cachedGltf);
    return;
  }
  if (callback) _gltfWaiters.push(callback);
  if (_isLoadingGltf || _gltfLoadFailed) return;
  _isLoadingGltf = true;

  const pathsToTry = ['/sheep.glb', '/sheep-1.glb'];

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
        // Try next candidate path or stay on procedural sheep rig
      }
    }

    _isLoadingGltf = false;
    _gltfLoadFailed = true;
    _gltfWaiters.length = 0;
  })();
}

// โหลดล่วงหน้าทันทีที่เปิดแอป
if (typeof window !== 'undefined') {
  loadSheepGlb();
}

/**
 * 🐑 Sheep Species Module
 * - ใช้ sheep.glb + SkeletonUtils.clone + AnimationMixer (idle/walk/graze)
 * - Normalize ขนาด/ตำแหน่งจาก bounding box จริงของ GLB
 * - อัปเดต hit box ตามขนาดจริงอัตโนมัติ
 * - ล็อกไม่ให้กระโดด (ไม่มี petBounce, ไม่มี bob แนว Y)
 */
export class SheepAnimalController implements AnimalSpeciesController {
  public readonly type = 'sheep' as const;
  public readonly nameEn = 'Sheep';
  public readonly nameTh = 'แกะ';
  public readonly emoji = '🐑';

  private readonly _anim = new WeakMap<AnimalRuntime, SheepAnimState>();
  private readonly _rigRefs = new WeakMap<THREE.Group, SheepRigRefs>();
  private readonly _glbRefs = new WeakMap<THREE.Group, SheepGlbData>();

  private resolveRig(group: THREE.Group): SheepRigRefs | null {
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

  private resolveGlb(group: THREE.Group): SheepGlbData | null {
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
  //  createRig
  // ─────────────────────────────────────────────────────────────────
  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'SheepRig';

    // Hit box เริ่มต้น (จะถูกอัปเดตอัตโนมัติหลัง GLB โหลดเสร็จ)
    const hitBoxGeo = new THREE.BoxGeometry(1.0, 1.2, 1.6);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitMesh.position.set(0, 0.7, 0);
    hitMesh.name = 'SheepHitBox';
    root.add(hitMesh);

    if (_cachedGltf) {
      this.setupGlbModel(root, _cachedGltf);
    } else {
      const fallbackHolder = new THREE.Group();
      fallbackHolder.name = 'SheepFallbackHolder';
      root.add(fallbackHolder);

      const fallbackRig = this.buildProceduralRig(fallbackHolder, materials);
      this._rigRefs.set(root, fallbackRig);

      loadSheepGlb((loadedGltf) => {
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

  // ─────────────────────────────────────────────────────────────────
  //  setupGlbModel — Normalize & Fit to GLB
  // ─────────────────────────────────────────────────────────────────
  private setupGlbModel(
    root: THREE.Group,
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }
  ) {
    const cfg = SHEEP_GLB_CONFIG;
    const cloned = SkeletonUtils.clone(gltf.scene);
    cloned.name = 'SheepGlbInstance';

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.isSharedGlbGeometry = true;
      }
    });

    // ── 1. วัดขนาดจริงก่อน scale (log ไว้ดู) ──
    const rawBox = new THREE.Box3().setFromObject(cloned);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);
    console.log(
      `[Sheep GLB] raw size (m): x=${rawSize.x.toFixed(3)} y=${rawSize.y.toFixed(3)} z=${rawSize.z.toFixed(3)}`
    );

    // ── 2. คำนวณ scale จากความสูงจริง ──
    const scaleFactor = cfg.targetHeight / (rawSize.y || 1);

    // ── 3. Apply scale + orientation ──
    const wrapper = new THREE.Group();
    wrapper.name = 'SheepGlbWrapper';
    wrapper.add(cloned);
    cloned.scale.setScalar(scaleFactor);
    cloned.rotation.y = cfg.yRotation;

    // ── 4. จัดกึ่งกลาง X/Z + วางเท้าที่ Y=0 ──
    const scaledBox = new THREE.Box3().setFromObject(cloned);
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);
    console.log(
      `[Sheep GLB] scaled size (m): x=${scaledSize.x.toFixed(3)} y=${scaledSize.y.toFixed(3)} z=${scaledSize.z.toFixed(3)}`
    );

    cloned.position.set(
      -(scaledBox.min.x + scaledBox.max.x) / 2,
      -scaledBox.min.y,
      -(scaledBox.min.z + scaledBox.max.z) / 2
    );

    root.add(wrapper);

    // ── 5. อัปเดต hit box ให้ตรงขนาดจริง ──
    const finalBox = new THREE.Box3().setFromObject(wrapper);
    const finalSize = new THREE.Vector3();
    const finalCenter = new THREE.Vector3();
    finalBox.getSize(finalSize);
    finalBox.getCenter(finalCenter);

    const hitMesh = root.getObjectByName('SheepHitBox') as THREE.Mesh | undefined;
    if (hitMesh) {
      hitMesh.geometry.dispose();
      hitMesh.geometry = new THREE.BoxGeometry(
        Math.max(finalSize.x, 0.4) * 0.95,
        Math.max(finalSize.y, 0.4) * 0.95,
        Math.max(finalSize.z, 0.4) * 0.95
      );
      hitMesh.position.copy(finalCenter);
    }

    // ── 6. Animation setup ──
    const mixer = new THREE.AnimationMixer(cloned);
    const actions: SheepGlbData['actions'] = {};
    const hasBonesOrAnimations = gltf.animations.length > 0;

    console.log(
      '[Sheep GLB] clips:',
      gltf.animations.map((a) => ({
        name: a.name,
        duration: +a.duration.toFixed(3),
        tracks: a.tracks.length,
      }))
    );

    if (hasBonesOrAnimations) {
      for (const { key, keywords } of cfg.clipMap) {
        const exact = gltf.animations.find((a) =>
          keywords.some((k) => a.name.toLowerCase() === k)
        );
        const partial = gltf.animations.find((a) =>
          keywords.some((k) => a.name.toLowerCase().includes(k))
        );
        const found = exact || partial;
        if (found && !actions[key]) {
          actions[key] = mixer.clipAction(found);
          console.log(`[Sheep GLB] ${key} → "${found.name}"`);
        }
      }

      if (!actions.idle && gltf.animations[0]) {
        actions.idle = mixer.clipAction(gltf.animations[0]);
        console.log(`[Sheep GLB] idle (fallback) → "${gltf.animations[0].name}"`);
      }
      if (!actions.walk) actions.walk = actions.idle;
      if (!actions.graze) actions.graze = actions.idle;

      actions.idle?.play();
    } else {
      console.warn('[Sheep GLB] no animations found — will use sway fallback');
    }

    const glbData: SheepGlbData = {
      mixer,
      actions,
      currentAction: 'idle',
      wrapper,
      hasBonesOrAnimations,
      strideLength: cfg.strideLength,
    };

    this._glbRefs.set(root, glbData);
  }

  // ─────────────────────────────────────────────────────────────────
  //  Procedural Fallback Rig
  // ─────────────────────────────────────────────────────────────────
  private buildProceduralRig(
    holder: THREE.Group,
    materials: AnimalRigMaterials
  ): SheepRigRefs {
    const geometries: THREE.BufferGeometry[] = [];
    const woolMat = materials.goatMat;
    const faceMat = materials.darkHoofMat;
    const eyeMat = materials.darkEyeMat;

    const bodyGeo = new THREE.SphereGeometry(0.55, 16, 12);
    geometries.push(bodyGeo);
    const bodyMesh = new THREE.Mesh(bodyGeo, woolMat);
    bodyMesh.scale.set(1.0, 0.9, 1.35);
    bodyMesh.position.set(0, 0.7, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    holder.add(bodyMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.85, 0.7);
    holder.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.26, 12, 10);
    geometries.push(headGeo);
    const headMesh = new THREE.Mesh(headGeo, faceMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const earGeo = new THREE.BoxGeometry(0.12, 0.05, 0.18);
    geometries.push(earGeo);
    const earL = new THREE.Mesh(earGeo, faceMat);
    earL.position.set(-0.28, 0.05, 0);
    headGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, faceMat);
    earR.position.set(0.28, 0.05, 0);
    headGroup.add(earR);

    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    geometries.push(eyeGeo);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.14, 0.08, 0.2);
    headGroup.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.14, 0.08, 0.2);
    headGroup.add(eyeR);

    const legGroups: THREE.Group[] = [];
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
    geometries.push(legGeo);
    const legPositions: [number, number, string][] = [
      [0.22, 0.35, 'Leg_FL'],
      [-0.22, 0.35, 'Leg_FR'],
      [0.22, -0.35, 'Leg_BL'],
      [-0.22, -0.35, 'Leg_BR'],
    ];
    legPositions.forEach(([x, z, name]) => {
      const hip = new THREE.Group();
      hip.name = name;
      hip.position.set(x, 0.55, z);

      const leg = new THREE.Mesh(legGeo, faceMat);
      leg.position.set(0, -0.25, 0);
      leg.castShadow = true;
      hip.add(leg);

      holder.add(hip);
      legGroups.push(hip);
    });

    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.8, -0.72);
    holder.add(tailGroup);

    const tailGeo = new THREE.SphereGeometry(0.09, 8, 6);
    geometries.push(tailGeo);
    const tailMesh = new THREE.Mesh(tailGeo, woolMat);
    tailMesh.castShadow = true;
    tailGroup.add(tailMesh);

    return { legGroups, headGroup, tailGroup, bodyMesh, geometries };
  }

  // ─────────────────────────────────────────────────────────────────
  //  animate
  // ─────────────────────────────────────────────────────────────────
  public animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    const glbData = this.resolveGlb(runtime.group);

    // ── 1. GLB path ──
    if (glbData) {
      glbData.mixer.update(dt);

      let targetAction: 'idle' | 'walk' | 'graze' = 'idle';
      if (runtime.state === 'walking' && currentSpeed > 0.08) targetAction = 'walk';
      else if (runtime.state === 'grazing') targetAction = 'graze';

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

      // timeScale จาก stride จริง → ขาไม่ลื่น
      if (glbData.currentAction === 'walk' && glbData.actions.walk) {
        const clipDur = glbData.actions.walk.getClip().duration || 1;
        const cyclesPerSec = currentSpeed / Math.max(glbData.strideLength, 0.1);
        const ts = cyclesPerSec * clipDur;
        glbData.actions.walk.timeScale = THREE.MathUtils.clamp(ts, 0.3, 2.5);
      }

      // ── ล็อก Y ให้อยู่ที่ 0 ตลอด (ไม่กระโดด/ไม่ bob) ──
      glbData.wrapper.position.y = 0;

      // sway เบาๆ เฉพาะกรณี GLB ไม่มีกระดูก (แกน X/Z เท่านั้น ไม่ใช่ Y)
      if (!glbData.hasBonesOrAnimations) {
        if (isWalking) {
          glbData.wrapper.rotation.z = Math.sin(runtime.walkCycle) * 0.03;
          glbData.wrapper.rotation.x = Math.sin(runtime.walkCycle * 2) * 0.015;
        } else {
          glbData.wrapper.rotation.x = 0;
          glbData.wrapper.rotation.z = 0;
        }
      }

      // ❌ ไม่มี petBounce → ไม่กระโดดเมื่อถูกลูบ
      return;
    }

    // ── 2. Procedural fallback path ──
    const rig = this.resolveRig(runtime.group);
    if (!rig) return;

    let anim = this._anim.get(runtime);
    if (!anim) {
      anim = { phase: 0, headPitch: 0, tailWag: 0 };
      this._anim.set(runtime, anim);
    }

    const step = Math.min(0.1, Math.max(0, dt));
    const ease = 1 - Math.exp(-10.0 * step);
    const walkBlend =
      isWalking && currentSpeed > 0.05
        ? Math.min(1.0, currentSpeed / SHEEP_GLB_CONFIG.maxWalkSpeed)
        : 0;

    const phase = runtime.walkCycle;
    const legOffsets = [0, Math.PI, Math.PI, 0]; // diagonal trot

    for (let i = 0; i < rig.legGroups.length; i++) {
      const hip = rig.legGroups[i];
      if (!hip) continue;
      const p = phase + legOffsets[i];
      const targetHip = Math.sin(p) * 0.5 * walkBlend;
      hip.rotation.x += (targetHip - hip.rotation.x) * ease;
    }

    const isGrazing = runtime.state === 'grazing';
    const targetHead = isGrazing
      ? 0.85
      : isWalking
      ? Math.sin(phase) * 0.06 * walkBlend
      : Math.sin(elapsed * 1.5) * 0.04;
    rig.headGroup.rotation.x += (targetHead - rig.headGroup.rotation.x) * ease;

    rig.tailGroup.rotation.x +=
      ((isWalking ? Math.sin(phase * 2.0) * 0.2 : Math.sin(elapsed * 2.5) * 0.15) -
        rig.tailGroup.rotation.x) *
      ease;

    // ── ล็อกความสูงลำตัวให้คงที่ (ไม่ bob) ──
    const bodyBaseY = 0.7;
    rig.bodyMesh.position.y += (bodyBaseY - rig.bodyMesh.position.y) * ease;

    // ❌ ไม่มี petBounce
  }
}

export const sheepSpecies = new SheepAnimalController();