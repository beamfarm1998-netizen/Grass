// src/components/3d/animals/ChickenAnimal.ts
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

interface ChickenProceduralRefs {
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

interface ChickenGlbData {
  mixer: THREE.AnimationMixer;
  actions: {
    idle?: THREE.AnimationAction;
    walk?: THREE.AnimationAction;
    peck?: THREE.AnimationAction;
  };
  currentAction: 'idle' | 'walk' | 'peck';
  wrapper: THREE.Group;
}

export interface AnimatedChickenInstance {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    isWalking: boolean,
    speed: number,
    walkPhase: number,
    isGrazing?: boolean,
    petBounce?: number
  ) => void;
  dispose: () => void;
}

// ─── Module-level GLTF Cache for /chicken.glb ───
let _cachedChickenGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let _isLoadingChickenGltf = false;
let _chickenLoadFailed = false;
const _chickenWaiters: Array<
  (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void
> = [];

export function loadChickenGlb(
  callback?: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void,
  forceBypassCache = false
): void {
  if (_cachedChickenGltf) {
    callback?.(_cachedChickenGltf);
    return;
  }
  if (callback) {
    _chickenWaiters.push(callback);
  }
  if (_isLoadingChickenGltf || (_chickenLoadFailed && !forceBypassCache)) return;
  _isLoadingChickenGltf = true;
  if (forceBypassCache) {
    _chickenLoadFailed = false;
  }

  const candidatePaths = ['/chicken.glb', '/Chicken.glb', '/models/chicken.glb'];

  void (async () => {
    for (const candidateUrl of candidatePaths) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidateUrl, {
          bypassCache: forceBypassCache,
        });
        if (!gltf?.scene || gltf.scene.children.length === 0) {
          continue;
        }
        optimizeGLTFSceneForDevice(gltf.scene, inspection);
        _isLoadingChickenGltf = false;
        _chickenLoadFailed = false;
        _cachedChickenGltf = {
          scene: gltf.scene,
          animations: gltf.animations || [],
        };
        const pending = _chickenWaiters.splice(0, _chickenWaiters.length);
        pending.forEach((cb) => cb(_cachedChickenGltf!));
        return;
      } catch {
        // Fallback to next candidate or procedural chicken rig
      }
    }

    _isLoadingChickenGltf = false;
    _chickenLoadFailed = true;
  })();
}

if (typeof window !== 'undefined') {
  loadChickenGlb();
  subscribeGlbDiscovery((resolvedUrl) => {
    if (
      !_cachedChickenGltf &&
      (resolvedUrl === '/chicken.glb' ||
        resolvedUrl === '/Chicken.glb' ||
        resolvedUrl === '/models/chicken.glb')
    ) {
      loadChickenGlb(undefined, true);
    }
  });
}

function buildProceduralChickenRig(
  holder: THREE.Group,
  sharedMats?: Partial<AnimalRigMaterials>
): ChickenProceduralRefs {
  const geometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];

  const trackGeo = <G extends THREE.BufferGeometry>(g: G): G => {
    geometries.push(g);
    return g;
  };
  const makeMat = (params: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(params);
    ownedMaterials.push(m);
    return m;
  };

  const featherMat =
    sharedMats?.chickenMat ?? makeMat({ color: 0xfff8e1, roughness: 0.8, metalness: 0.02 });
  const combMat =
    sharedMats?.chickenCombMat ?? makeMat({ color: 0xd32f2f, roughness: 0.45 });
  const beakMat =
    sharedMats?.chickenBeakMat ?? makeMat({ color: 0xffb300, roughness: 0.45 });
  const eyeMat =
    sharedMats?.darkEyeMat ?? makeMat({ color: 0x111111, roughness: 0.3 });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.3, 0);
  holder.add(bodyGroup);

  const bodyGeo = trackGeo(new THREE.SphereGeometry(0.22, 12, 10));
  bodyGeo.scale(0.85, 1.0, 1.25);
  const bodyMesh = new THREE.Mesh(bodyGeo, featherMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Fan Tail
  const tailGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.24, 0.19));
  const tail = new THREE.Mesh(tailGeo, featherMat);
  tail.position.set(0, 0.12, -0.25);
  tail.rotation.x = -0.55;
  tail.castShadow = true;
  bodyGroup.add(tail);

  // Head and Neck Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.16, 0.17);
  bodyGroup.add(headGroup);

  const skullGeo = trackGeo(new THREE.SphereGeometry(0.11, 10, 8));
  const skull = new THREE.Mesh(skullGeo, featherMat);
  skull.castShadow = true;
  headGroup.add(skull);

  const combGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.12, 0.18));
  const comb = new THREE.Mesh(combGeo, combMat);
  comb.position.set(0, 0.11, 0);
  headGroup.add(comb);

  const wattleGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.085, 0.055));
  const wattle = new THREE.Mesh(wattleGeo, combMat);
  wattle.position.set(0, -0.075, 0.085);
  headGroup.add(wattle);

  const beakGeo = trackGeo(new THREE.ConeGeometry(0.048, 0.12, 6));
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.01, 0.135);
  headGroup.add(beak);

  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.02, 6, 6));
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.09, 0.022, 0.055);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.09, 0.022, 0.055);
  headGroup.add(eyeL, eyeR);

  // Wings
  const wingGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.17, 0.28));
  const wingL = new THREE.Group();
  wingL.position.set(0.2, 0.025, 0);
  const wMeshL = new THREE.Mesh(wingGeo, featherMat);
  wMeshL.position.set(0, -0.05, 0);
  wMeshL.castShadow = true;
  wingL.add(wMeshL);
  bodyGroup.add(wingL);

  const wingR = new THREE.Group();
  wingR.position.set(-0.2, 0.025, 0);
  const wMeshR = new THREE.Mesh(wingGeo, featherMat);
  wMeshR.position.set(0, -0.05, 0);
  wMeshR.castShadow = true;
  wingR.add(wMeshR);
  bodyGroup.add(wingR);

  // Bipedal Legs & Feet
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.014, 0.2, 6));
  const footGeo = trackGeo(new THREE.BoxGeometry(0.095, 0.022, 0.12));

  const makeChickenLeg = (x: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.2, 0);

    const leg = new THREE.Mesh(legGeo, beakMat);
    leg.position.set(0, -0.09, 0);
    leg.castShadow = true;
    hip.add(leg);

    const foot = new THREE.Mesh(footGeo, beakMat);
    foot.position.set(0, -0.188, 0.025);
    foot.castShadow = true;
    hip.add(foot);

    holder.add(hip);
    return hip;
  };

  const legL = makeChickenLeg(0.09);
  const legR = makeChickenLeg(-0.09);

  return {
    bodyGroup,
    headGroup,
    wingL,
    wingR,
    legL,
    legR,
    geometries,
    materials: ownedMaterials,
  };
}

function mountChickenGlb(
  root: THREE.Group,
  gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }
): ChickenGlbData {
  const cloned = SkeletonUtils.clone(gltf.scene);
  cloned.name = 'ChickenGlbInstance';

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.isSharedGlbGeometry = true;
      child.userData.isSharedGlbMaterial = true;
    }
  });

  cloned.updateMatrixWorld(true);
  const preciseBox = new THREE.Box3().setFromObject(cloned, true);
  const size = new THREE.Vector3();
  preciseBox.getSize(size);

  const targetHeight = 0.56;
  const rawHeight = size.y > 0.02 ? size.y : 0.45;
  const scaleFactor = THREE.MathUtils.clamp(targetHeight / rawHeight, 0.015, 25.0);

  const wrapper = new THREE.Group();
  wrapper.name = 'ChickenGlbWrapper';
  wrapper.add(cloned);

  cloned.scale.multiplyScalar(scaleFactor);
  wrapper.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(cloned, true);
  if (!scaledBox.isEmpty()) {
    cloned.position.x -= (scaledBox.min.x + scaledBox.max.x) * 0.5;
    cloned.position.y -= scaledBox.min.y;
    cloned.position.z -= (scaledBox.min.z + scaledBox.max.z) * 0.5;
  }

  root.add(wrapper);

  const mixer = new THREE.AnimationMixer(cloned);
  const actions: ChickenGlbData['actions'] = {};

  if (gltf.animations && gltf.animations.length > 0) {
    const defaultClip = gltf.animations[0];
    const idleClip =
      gltf.animations.find((c) => c.name.toLowerCase().includes('idle')) || defaultClip;
    const walkClip =
      gltf.animations.find((c) => {
        const n = c.name.toLowerCase();
        return n.includes('walk') || n.includes('run') || n.includes('move');
      }) || defaultClip;
    const peckClip =
      gltf.animations.find((c) => {
        const n = c.name.toLowerCase();
        return (
          n.includes('peck') ||
          n.includes('eat') ||
          n.includes('feed') ||
          n.includes('graze')
        );
      }) || idleClip;

    actions.idle = mixer.clipAction(idleClip);
    actions.walk = mixer.clipAction(walkClip);
    actions.peck = mixer.clipAction(peckClip);

    actions.idle.play();
    mixer.update(Math.random() * 1.5);
  }

  return {
    mixer,
    actions,
    currentAction: 'idle',
    wrapper,
  };
}

function evaluateChickenVisualAnimation(
  glbData: ChickenGlbData | null,
  procRefs: ChickenProceduralRefs | null,
  dt: number,
  elapsed: number,
  isWalking: boolean,
  speed: number,
  walkPhase: number,
  isGrazing = false,
  petBounce = 0
): void {
  const step = Math.min(0.1, Math.max(0, dt));

  if (glbData) {
    const { mixer, actions, wrapper } = glbData;
    const desired: 'idle' | 'walk' | 'peck' = isWalking
      ? 'walk'
      : isGrazing
        ? 'peck'
        : 'idle';

    if (glbData.currentAction !== desired) {
      const prev = actions[glbData.currentAction];
      const next = actions[desired] || actions.idle;
      if (next && prev && prev !== next) {
        prev.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
      } else if (next && !next.isRunning()) {
        next.play();
      }
      glbData.currentAction = desired;
    }

    if (actions.walk && desired === 'walk') {
      actions.walk.timeScale = THREE.MathUtils.clamp(speed / 0.85, 0.65, 2.0);
    } else if (
      actions.idle &&
      actions.idle === actions.walk &&
      desired !== 'walk'
    ) {
      // Single-clip walk GLB: pause walk cycle smoothly when resting
      actions.idle.timeScale = THREE.MathUtils.lerp(
        actions.idle.timeScale,
        0,
        Math.min(1, step * 8.0)
      );
    }

    mixer.update(step);

    if (isWalking) {
      wrapper.position.y = Math.abs(Math.sin(walkPhase)) * 0.032;
      wrapper.rotation.z = Math.sin(walkPhase) * 0.04;
      wrapper.rotation.x = THREE.MathUtils.lerp(
        wrapper.rotation.x,
        Math.sin(walkPhase * 2) * 0.05,
        step * 6.0
      );
    } else if (isGrazing) {
      const peckPulse = Math.max(0, Math.sin(elapsed * 5.2));
      wrapper.position.y = THREE.MathUtils.lerp(wrapper.position.y, 0, step * 6.0);
      wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, 0, step * 6.0);
      wrapper.rotation.x = THREE.MathUtils.lerp(
        wrapper.rotation.x,
        peckPulse * 0.22,
        step * 8.0
      );
    } else {
      wrapper.position.y = THREE.MathUtils.lerp(
        wrapper.position.y,
        Math.sin(elapsed * 2.4) * 0.005,
        step * 4.0
      );
      wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, 0, step * 5.0);
      wrapper.rotation.x = THREE.MathUtils.lerp(
        wrapper.rotation.x,
        Math.sin(elapsed * 1.9) * 0.035,
        step * 4.0
      );
    }

    if (petBounce > 0.001) {
      wrapper.position.y += Math.sin(petBounce * Math.PI) * 0.14;
      wrapper.rotation.y = Math.sin(petBounce * Math.PI * 4.0) * 0.18;
    } else {
      wrapper.rotation.y = THREE.MathUtils.lerp(wrapper.rotation.y, 0, step * 6.0);
    }
    return;
  }

  if (procRefs) {
    const legPhase = isWalking ? Math.sin(walkPhase) : 0;
    procRefs.legL.rotation.x = legPhase * 0.65;
    procRefs.legR.rotation.x = -legPhase * 0.65;

    const isExcited = petBounce > 0.05;
    const wingFreq = isExcited ? elapsed * 18.0 : walkPhase * 2;
    const wingAmp = isExcited ? 0.55 : 0.22;
    const wingFlap = isWalking || isExcited ? Math.sin(wingFreq) * wingAmp : 0;
    procRefs.wingL.rotation.z = wingFlap;
    procRefs.wingR.rotation.z = -wingFlap;

    const peckFreq = isGrazing ? 4.8 : 2.0;
    const peckAmp = isGrazing ? 0.42 : 0.14;
    procRefs.headGroup.rotation.x = Math.sin(elapsed * peckFreq) * peckAmp;

    const hop = isWalking ? Math.abs(Math.sin(walkPhase)) * 0.045 : 0;
    procRefs.bodyGroup.position.y = 0.3 + hop + petBounce * 0.18;
  }
}

export function createAnimatedChickenInstance(
  materials?: Partial<AnimalRigMaterials>
): AnimatedChickenInstance {
  const group = new THREE.Group();
  group.name = 'ChickenModelInstance';

  let glbData: ChickenGlbData | null = null;
  let procRefs: ChickenProceduralRefs | null = null;
  let fallbackHolder: THREE.Group | null = null;
  let isDisposed = false;

  if (_cachedChickenGltf) {
    glbData = mountChickenGlb(group, _cachedChickenGltf);
  } else {
    fallbackHolder = new THREE.Group();
    fallbackHolder.name = 'ChickenFallbackHolder';
    group.add(fallbackHolder);
    procRefs = buildProceduralChickenRig(fallbackHolder, materials);

    loadChickenGlb((loadedGltf) => {
      if (isDisposed) return;
      if (fallbackHolder) {
        group.remove(fallbackHolder);
        fallbackHolder = null;
      }
      if (procRefs) {
        procRefs.geometries.forEach((g) => g.dispose());
        procRefs.materials.forEach((m) => m.dispose());
        procRefs = null;
      }
      glbData = mountChickenGlb(group, loadedGltf);
    });
  }

  return {
    group,
    update: (dt, elapsed, isWalking, speed, walkPhase, isGrazing = false, petBounce = 0) => {
      if (isDisposed) return;
      evaluateChickenVisualAnimation(
        glbData,
        procRefs,
        dt,
        elapsed,
        isWalking,
        speed,
        walkPhase,
        isGrazing,
        petBounce
      );
    },
    dispose: () => {
      if (isDisposed) return;
      isDisposed = true;
      if (glbData) {
        glbData.mixer.stopAllAction();
        glbData = null;
      }
      if (procRefs) {
        procRefs.geometries.forEach((g) => g.dispose());
        procRefs.materials.forEach((m) => m.dispose());
        procRefs = null;
      }
      group.clear();
    },
  };
}

/**
 * 🐔 Chicken Species Controller (ไก่ฟาร์ม — chicken.glb)
 */
export class ChickenAnimalController implements AnimalSpeciesController {
  public readonly type = 'chicken' as const;
  public readonly nameEn = 'Chicken';
  public readonly nameTh = 'ไก่';
  public readonly emoji = '🐔';

  private readonly _instances = new WeakMap<THREE.Group, AnimatedChickenInstance>();

  private resolveInstance(group: THREE.Group): AnimatedChickenInstance | null {
    const direct = this._instances.get(group);
    if (direct) return direct;
    for (const child of group.children) {
      if (child instanceof THREE.Group) {
        const hit = this._instances.get(child);
        if (hit) return hit;
      }
    }
    return null;
  }

  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'ChickenRig';

    const hitBoxGeo = new THREE.BoxGeometry(0.62, 0.72, 0.72);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitMesh.position.set(0, 0.36, 0);
    hitMesh.name = 'ChickenHitBox';
    root.add(hitMesh);

    const instance = createAnimatedChickenInstance(materials);
    root.add(instance.group);
    this._instances.set(root, instance);

    return {
      root,
      bodyMesh: hitMesh,
      headGroup: root,
      legs: [],
    };
  }

  public disposeRig(group: THREE.Group): void {
    const instance = this.resolveInstance(group);
    if (instance) {
      instance.dispose();
      this._instances.delete(group);
    }
  }

  public animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    const instance = this.resolveInstance(runtime.group);
    if (!instance) return;
    instance.update(
      dt,
      elapsed,
      isWalking,
      currentSpeed,
      runtime.walkCycle,
      runtime.state === 'grazing',
      runtime.petBounce
    );
  }
}

export const chickenSpecies = new ChickenAnimalController();
