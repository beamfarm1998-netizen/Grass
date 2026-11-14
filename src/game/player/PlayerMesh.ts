// src/game/player/PlayerMesh.ts
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FARMER_CHARACTERS, type FarmerGender, type KidGender, type ToolType } from '../../types/game';
import { loadValidatedGLTF, optimizeGLTFSceneForDevice } from '../../utils/glbValidator';
import { createFarmerToolModels } from './PlayerTools';
import { attachHeldTools } from './HeldToolRig';

export interface CachedFarmerGltf {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

export interface FarmerGlbRuntimeData {
  wrapper: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    swing?: THREE.AnimationAction;
  };
  currentAction: 'idle' | 'walk' | 'swing';
  hasAnimations: boolean;
  toolHolder: THREE.Group;
}

export interface ProceduralFarmerRig {
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  headGroup: THREE.Group;
  hatGroup: THREE.Group;
  femaleHairGroup: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  overallsMat: THREE.MeshStandardMaterial;
  hatStrawMat: THREE.MeshStandardMaterial;
  hatRibbonMat: THREE.MeshStandardMaterial;
  bootMat: THREE.MeshStandardMaterial;
  leftClavicle: THREE.Group;
  leftUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  rightClavicle: THREE.Group;
  rightUpperArm: THREE.Group;
  rightForearm: THREE.Group;
  toolHolder: THREE.Group;
  toolMeshes: Map<ToolType, THREE.Group>;
  leftHip: THREE.Group;
  leftThigh: THREE.Group;
  leftCalf: THREE.Group;
  leftFoot: THREE.Group;
  rightHip: THREE.Group;
  rightThigh: THREE.Group;
  rightCalf: THREE.Group;
  rightFoot: THREE.Group;
}

// ─── Module-level GLTF Cache for woman.glb and man.glb ───
let _cachedWomanGltf: CachedFarmerGltf | null = null;
let _isLoadingWomanGltf = false;
const _womanWaiters: Array<(gltf: CachedFarmerGltf) => void> = [];

let _cachedManGltf: CachedFarmerGltf | null = null;
let _isLoadingManGltf = false;
const _manWaiters: Array<(gltf: CachedFarmerGltf) => void> = [];

export function getLoadedWomanGlb(): CachedFarmerGltf | null {
  return _cachedWomanGltf;
}

export function getLoadedManGlb(): CachedFarmerGltf | null {
  return _cachedManGltf;
}

function markSharedGeometries(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.userData.isSharedGlbGeometry = true;
    }
  });
}

export function loadWomanGlb(callback?: (gltf: CachedFarmerGltf) => void): void {
  if (_cachedWomanGltf) {
    callback?.(_cachedWomanGltf);
    return;
  }
  if (callback) {
    _womanWaiters.push(callback);
  }
  if (_isLoadingWomanGltf) return;
  _isLoadingWomanGltf = true;

  loadValidatedGLTF('/woman.glb')
    .then(({ gltf, inspection }) => {
      _isLoadingWomanGltf = false;
      optimizeGLTFSceneForDevice(gltf.scene, inspection, true);
      markSharedGeometries(gltf.scene);
      _cachedWomanGltf = {
        scene: gltf.scene,
        animations: gltf.animations || [],
      };
      _womanWaiters.forEach((cb) => cb(_cachedWomanGltf!));
      _womanWaiters.length = 0;
    })
    .catch((err) => {
      _isLoadingWomanGltf = false;
      _womanWaiters.length = 0;
      console.info('ℹ️ ใช้โมเดลผู้หญิงชาวสวนสำรอง (woman.glb fallback):', err);
    });
}

export function loadManGlb(callback?: (gltf: CachedFarmerGltf) => void): void {
  if (_cachedManGltf) {
    callback?.(_cachedManGltf);
    return;
  }
  if (callback) {
    _manWaiters.push(callback);
  }
  if (_isLoadingManGltf) return;
  _isLoadingManGltf = true;

  loadValidatedGLTF('/man.glb')
    .then(({ gltf, inspection }) => {
      _isLoadingManGltf = false;
      optimizeGLTFSceneForDevice(gltf.scene, inspection);
      markSharedGeometries(gltf.scene);
      _cachedManGltf = {
        scene: gltf.scene,
        animations: gltf.animations || [],
      };
      _manWaiters.forEach((cb) => cb(_cachedManGltf!));
      _manWaiters.length = 0;
    })
    .catch((err) => {
      _isLoadingManGltf = false;
      _manWaiters.length = 0;
      console.info('ℹ️ ใช้โมเดลชาวไร่หนุ่มสำรอง (man.glb fallback):', err);
    });
}

// ─── โหลด boy.glb / girl.glb (แคชแยกตามตัวละคร) ───
const _kidCache = new Map<KidGender, CachedFarmerGltf>();
const _kidLoading = new Set<KidGender>();
const _kidWaiters = new Map<KidGender, Array<(gltf: CachedFarmerGltf) => void>>();

export function getLoadedKidGlb(kind: KidGender): CachedFarmerGltf | null {
  return _kidCache.get(kind) ?? null;
}

export function loadKidGlb(kind: KidGender, callback?: (gltf: CachedFarmerGltf) => void): void {
  const cached = _kidCache.get(kind);
  if (cached) {
    callback?.(cached);
    return;
  }
  if (callback) {
    const list = _kidWaiters.get(kind) ?? [];
    list.push(callback);
    _kidWaiters.set(kind, list);
  }
  if (_kidLoading.has(kind)) return;
  _kidLoading.add(kind);

  loadValidatedGLTF(FARMER_CHARACTERS[kind].glb)
    .then(({ gltf, inspection }) => {
      _kidLoading.delete(kind);
      optimizeGLTFSceneForDevice(gltf.scene, inspection, true);
      markSharedGeometries(gltf.scene);
      const entry: CachedFarmerGltf = { scene: gltf.scene, animations: gltf.animations || [] };
      _kidCache.set(kind, entry);
      (_kidWaiters.get(kind) ?? []).forEach((cb) => cb(entry));
      _kidWaiters.delete(kind);
    })
    .catch((err) => {
      _kidLoading.delete(kind);
      _kidWaiters.delete(kind);
      console.info('ℹ️ โหลดโมเดลเด็กไม่ได้ ใช้ตัวสำรองแทน (' + kind + '.glb):', err);
    });
}

if (typeof window !== 'undefined') {
  loadManGlb();
}

/**
 * สร้างอินสแตนซ์โมเดล GLB ของผู้เล่น (man.glb หรือ woman.glb) พร้อมติดกระดูกถือเครื่องมือและ AnimationMixer
 */
export function instantiateFarmerGlbModel(
  gltf: CachedFarmerGltf,
  options: { gender: FarmerGender; currentTool: ToolType }
): {
  wrapper: THREE.Group;
  data: FarmerGlbRuntimeData;
  toolHolder: THREE.Group;
  toolMeshes: Map<ToolType, THREE.Group>;
} {
  const isMale = options.gender === 'male';
  const cloned = SkeletonUtils.clone(gltf.scene);
  cloned.name = isMale ? 'ManFarmerGlbInstance' : 'WomanFarmerGlbInstance';

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.isSharedGlbGeometry = true;
      child.castShadow = isMale;
      child.receiveShadow = isMale;
    }
  });

  const box = new THREE.Box3().setFromObject(cloned);
  const size = new THREE.Vector3();
  box.getSize(size);

  const targetHeight = FARMER_CHARACTERS[options.gender].height;
  const scaleFactor = targetHeight / Math.max(size.y, 0.001);
  cloned.scale.setScalar(scaleFactor);

  const scaledBox = new THREE.Box3().setFromObject(cloned);
  cloned.position.set(
    -(scaledBox.min.x + scaledBox.max.x) / 2,
    -scaledBox.min.y,
    -(scaledBox.min.z + scaledBox.max.z) / 2
  );

  const wrapper = new THREE.Group();
  wrapper.name = isMale ? 'ManFarmerWrapper' : 'WomanFarmerWrapper';
  wrapper.add(cloned);

  // หาโหนดมือขวา: ต้องเป็น "มือ" ไม่ใช่นิ้ว และเป็นฝั่งขวา (เจอตัวแรกพอ)
  // (โค้ดเดิมใช้ includes('r') แล้วเขียนทับทุกครั้ง ทำให้ไปจับนิ้ว/มือซ้ายได้ในบางโมเดล)
  let handBone: THREE.Object3D | null = null;
  cloned.traverse((child) => {
    if (handBone || !(child as THREE.Bone).isBone) return;
    const n = child.name.toLowerCase();
    const isHand = n.includes('hand') && !/(finger|thumb|index|middle|ring|pinky|little)/.test(n);
    const isRight = n.includes('right') || /hand[._:\-]?r$/.test(n) || /(^|[._:\-])r[._:\-]?hand/.test(n);
    if (isHand && isRight) handBone = child;
  });

  const toolHolder = new THREE.Group();
  toolHolder.name = isMale ? 'ManToolHolder' : 'WomanToolHolder';
  if (handBone) {
    (handBone as THREE.Object3D).add(toolHolder); // ตำแหน่ง/ทิศ/ขนาดจริงตั้งโดย attachHeldTools ด้านล่าง
  } else {
    const rightArm = isMale ? cloned.getObjectByName('RightArm') : null;
    if (rightArm) {
      rightArm.add(toolHolder);
      toolHolder.position.set(0, -0.56, 0.1);
    } else {
      toolHolder.position.set(isMale ? 0.3 : 0.28, isMale ? 0.75 : 0.72, 0.2);
      wrapper.add(toolHolder);
    }
  }

  const toolMeshes = new Map<ToolType, THREE.Group>();
  createFarmerToolModels(toolHolder, toolMeshes, { heldSpec: Boolean(handBone) });
  toolMeshes.forEach((mesh, t) => {
    mesh.visible = t === options.currentTool;
  });

  const mixer = new THREE.AnimationMixer(cloned);
  const actions: FarmerGlbRuntimeData['actions'] = {};
  const hasAnimations = Boolean(gltf.animations && gltf.animations.length > 0);

  if (hasAnimations) {
    gltf.animations.forEach((clip) => {
      const nameLower = clip.name.toLowerCase();
      const action = mixer.clipAction(clip);
      if (nameLower.includes('walk') || nameLower.includes('run') || nameLower.includes('move')) {
        actions.walk = action;
      } else if (
        nameLower.includes('swing') ||
        nameLower.includes('action') ||
        nameLower.includes('attack') ||
        nameLower.includes('work') ||
        nameLower.includes('chop')
      ) {
        actions.swing = action;
      } else if (!actions.idle || nameLower.includes('idle') || nameLower.includes('stand')) {
        actions.idle = action;
      }
    });

    if (!actions.idle && gltf.animations[0]) {
      actions.idle = mixer.clipAction(gltf.animations[0]);
    }
    if (!actions.walk && actions.idle) {
      actions.walk = actions.idle;
    }
    if (actions.idle) {
      actions.idle.play();
    }
  }

  // ผูกเครื่องมือกับมือขวาตามท่า idle (ต้อง update mixer ก่อนเพื่อให้กระดูกอยู่ในท่า idle)
  if (handBone) {
    mixer.update(0);
    attachHeldTools(wrapper, handBone as THREE.Object3D, toolHolder, toolMeshes);
    toolHolder.scale.multiplyScalar(FARMER_CHARACTERS[options.gender].toolScale);
  }

  const data: FarmerGlbRuntimeData = {
    wrapper,
    mixer,
    actions,
    currentAction: 'idle',
    hasAnimations,
    toolHolder,
  };

  return { wrapper, data, toolHolder, toolMeshes };
}

/**
 * สร้างโครงสร้างข้อต่อตัวละครสำรอง (Procedural Chibi Farmer Rig) สำหรับใช้ระหว่างรอโหลด GLB หรือออฟไลน์
 */
export function buildProceduralFarmerRig(currentTool: ToolType): ProceduralFarmerRig {
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf5c096,
    roughness: 0.55,
    metalness: 0.05,
  });
  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xef8878,
    roughness: 0.6,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xdf382b,
    roughness: 0.75,
  });
  const overallsMat = new THREE.MeshStandardMaterial({
    color: 0x245582,
    roughness: 0.8,
  });
  const overallsPocketMat = new THREE.MeshStandardMaterial({
    color: 0x1c446a,
    roughness: 0.82,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xffca28,
    metalness: 0.85,
    roughness: 0.25,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x3d271d,
    roughness: 0.7,
  });
  const hatStrawMat = new THREE.MeshStandardMaterial({
    color: 0xf2c14e,
    roughness: 0.85,
  });
  const hatRibbonMat = new THREE.MeshStandardMaterial({
    color: 0x9b1d20,
    roughness: 0.65,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 1. Pelvis & Torso
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.82;

  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.26, 12),
    overallsMat
  );
  pelvisMesh.position.y = -0.04;
  pelvisMesh.castShadow = true;
  pelvis.add(pelvisMesh);

  const spine = new THREE.Group();
  spine.position.y = 0.08;
  pelvis.add(spine);

  const chest = new THREE.Group();
  chest.position.y = 0.16;
  spine.add(chest);

  const chestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.23, 0.36, 12),
    shirtMat
  );
  chestMesh.position.y = 0.16;
  chestMesh.scale.set(1.0, 1.0, 0.78);
  chestMesh.castShadow = true;
  chest.add(chestMesh);

  const bib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), overallsMat);
  bib.position.set(0, 0.14, 0.16);
  chest.add(bib);

  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.02), overallsPocketMat);
  pocket.position.set(0, 0.12, 0.205);
  chest.add(pocket);

  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.03), overallsMat);
    strap.position.set(s * 0.13, 0.18, 0.155);
    chest.add(strap);

    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10),
      brassMat
    );
    button.rotation.x = Math.PI / 2;
    button.position.set(s * 0.13, 0.26, 0.18);
    chest.add(button);
  }

  // 2. Head & Straw Hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.38, 0);
  chest.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10), skinMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), skinMat);
  headMesh.scale.set(1.0, 1.05, 0.98);
  headMesh.position.y = 0.25;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.025, 4, 8), eyeMat);
    eye.position.set(s * 0.085, 0.25, 0.215);
    headGroup.add(eye);

    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), eyeHighlightMat);
    highlight.position.set(s * 0.085 + 0.008, 0.265, 0.235);
    headGroup.add(highlight);

    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), blushMat);
    blush.scale.set(1.2, 0.6, 0.3);
    blush.position.set(s * 0.135, 0.2, 0.2);
    headGroup.add(blush);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.04, 6), skinMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.23, 0.25);
  headGroup.add(nose);

  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 0.34, 0.01);
  hatGroup.rotation.x = -0.06;

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.04, 20), hatStrawMat);
  brim.castShadow = true;
  hatGroup.add(brim);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.22, 18), hatStrawMat);
  crown.position.y = 0.12;
  crown.castShadow = true;
  hatGroup.add(crown);

  const ribbon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.272, 0.273, 0.06, 18),
    hatRibbonMat
  );
  ribbon.position.y = 0.045;
  hatGroup.add(ribbon);
  headGroup.add(hatGroup);

  const femaleHairGroup = new THREE.Group();
  femaleHairGroup.visible = false;
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
  const hairTieMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });

  for (const side of [-1, 1]) {
    const braidGroup = new THREE.Group();
    braidGroup.position.set(side * 0.22, 0.18, -0.05);
    for (let b = 0; b < 3; b++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.045 - b * 0.006, 7, 7), hairMat);
      seg.position.y = -b * 0.07;
      seg.scale.set(1.0, 1.3, 0.9);
      braidGroup.add(seg);
    }
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), hairTieMat);
    bow.position.y = -0.22;
    braidGroup.add(bow);
    femaleHairGroup.add(braidGroup);
  }
  headGroup.add(femaleHairGroup);

  // 3. Two-Segment Arms
  const armRadius = 0.055;
  const upperArmLen = 0.25;
  const forearmLen = 0.23;

  const leftClavicle = new THREE.Group();
  leftClavicle.position.set(-0.25, 0.28, 0);
  chest.add(leftClavicle);

  const leftUpperArm = new THREE.Group();
  leftClavicle.add(leftUpperArm);

  const lUpperMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLen, 10),
    shirtMat
  );
  lUpperMesh.position.y = -upperArmLen / 2;
  lUpperMesh.castShadow = true;
  leftUpperArm.add(lUpperMesh);

  const leftForearm = new THREE.Group();
  leftForearm.position.y = -upperArmLen;
  leftUpperArm.add(leftForearm);

  const lForearmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadius * 0.88, armRadius * 0.78, forearmLen, 10),
    skinMat
  );
  lForearmMesh.position.y = -forearmLen / 2;
  lForearmMesh.castShadow = true;
  leftForearm.add(lForearmMesh);

  const lHand = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.92, 10, 8), skinMat);
  lHand.position.y = -forearmLen;
  leftForearm.add(lHand);

  const rightClavicle = new THREE.Group();
  rightClavicle.position.set(0.25, 0.28, 0);
  chest.add(rightClavicle);

  const rightUpperArm = new THREE.Group();
  rightClavicle.add(rightUpperArm);

  const rUpperMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadius, armRadius * 0.9, upperArmLen, 10),
    shirtMat
  );
  rUpperMesh.position.y = -upperArmLen / 2;
  rUpperMesh.castShadow = true;
  rightUpperArm.add(rUpperMesh);

  const rightForearm = new THREE.Group();
  rightForearm.position.y = -upperArmLen;
  rightUpperArm.add(rightForearm);

  const rForearmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(armRadius * 0.88, armRadius * 0.78, forearmLen, 10),
    skinMat
  );
  rForearmMesh.position.y = -forearmLen / 2;
  rForearmMesh.castShadow = true;
  rightForearm.add(rForearmMesh);

  const rHand = new THREE.Mesh(new THREE.SphereGeometry(armRadius * 0.92, 10, 8), skinMat);
  rHand.position.y = -forearmLen;
  rightForearm.add(rHand);

  const toolHolder = new THREE.Group();
  toolHolder.position.set(0, -forearmLen - 0.03, 0.06);
  rightForearm.add(toolHolder);

  const toolMeshes = new Map<ToolType, THREE.Group>();
  createFarmerToolModels(toolHolder, toolMeshes);
  toolMeshes.forEach((mesh, t) => {
    mesh.visible = t === currentTool;
  });

  // 4. Two-Segment Legs
  const legRadius = 0.082;
  const thighLen = 0.36;
  const calfLen = 0.34;

  const leftHip = new THREE.Group();
  leftHip.position.set(-0.13, -0.06, 0);
  pelvis.add(leftHip);

  const leftThigh = new THREE.Group();
  leftHip.add(leftThigh);

  const lThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legRadius * 1.05, legRadius * 0.92, thighLen, 12),
    overallsMat
  );
  lThighMesh.position.y = -thighLen / 2;
  lThighMesh.castShadow = true;
  leftThigh.add(lThighMesh);

  const leftCalf = new THREE.Group();
  leftCalf.position.y = -thighLen;
  leftThigh.add(leftCalf);

  const lCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legRadius * 0.92, legRadius * 0.85, calfLen, 12),
    overallsMat
  );
  lCalfMesh.position.y = -calfLen / 2;
  lCalfMesh.castShadow = true;
  leftCalf.add(lCalfMesh);

  const leftFoot = new THREE.Group();
  leftFoot.position.y = -calfLen;
  leftCalf.add(leftFoot);

  const lBoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.12, 6, 10), bootMat);
  lBoot.rotation.x = Math.PI / 2;
  lBoot.position.set(0, -0.04, 0.05);
  lBoot.castShadow = true;
  leftFoot.add(lBoot);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.13, -0.06, 0);
  pelvis.add(rightHip);

  const rightThigh = new THREE.Group();
  rightHip.add(rightThigh);

  const rThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legRadius * 1.05, legRadius * 0.92, thighLen, 12),
    overallsMat
  );
  rThighMesh.position.y = -thighLen / 2;
  rThighMesh.castShadow = true;
  rightThigh.add(rThighMesh);

  const rightCalf = new THREE.Group();
  rightCalf.position.y = -thighLen;
  rightThigh.add(rightCalf);

  const rCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(legRadius * 0.92, legRadius * 0.85, calfLen, 12),
    overallsMat
  );
  rCalfMesh.position.y = -calfLen / 2;
  rCalfMesh.castShadow = true;
  rightCalf.add(rCalfMesh);

  const rightFoot = new THREE.Group();
  rightFoot.position.y = -calfLen;
  rightCalf.add(rightFoot);

  const rBoot = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.12, 6, 10), bootMat);
  rBoot.rotation.x = Math.PI / 2;
  rBoot.position.set(0, -0.04, 0.05);
  rBoot.castShadow = true;
  rightFoot.add(rBoot);

  return {
    pelvis,
    spine,
    chest,
    headGroup,
    hatGroup,
    femaleHairGroup,
    shirtMat,
    overallsMat,
    hatStrawMat,
    hatRibbonMat,
    bootMat,
    leftClavicle,
    leftUpperArm,
    leftForearm,
    rightClavicle,
    rightUpperArm,
    rightForearm,
    toolHolder,
    toolMeshes,
    leftHip,
    leftThigh,
    leftCalf,
    leftFoot,
    rightHip,
    rightThigh,
    rightCalf,
    rightFoot,
  };
}

export function applyProceduralGenderStyle(
  rig: ProceduralFarmerRig,
  gender: FarmerGender
): void {
  if (gender === 'female' || gender === 'girl') {
    rig.shirtMat.color.setHex(0xf472b6);
    rig.overallsMat.color.setHex(0x1d4ed8);
    rig.hatRibbonMat.color.setHex(0xec4899);
    rig.femaleHairGroup.visible = true;
  } else {
    rig.shirtMat.color.setHex(0xdf382b);
    rig.overallsMat.color.setHex(0x245582);
    rig.hatRibbonMat.color.setHex(0x9b1d20);
    rig.femaleHairGroup.visible = false;
  }
}

export function createPlayerShadowMesh(): THREE.Mesh {
  const shadowGeo = new THREE.CircleGeometry(0.48, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x182412,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.set(0, 0.02, 0);
  return shadowMesh;
}