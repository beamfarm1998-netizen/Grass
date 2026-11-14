// src/components/3d/animals/DuckAnimal.ts
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
  detectCompressionExtensions,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

interface DuckProceduralRefs {
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tailGroup: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

interface DuckGlbData {
  mixer: THREE.AnimationMixer;
  walkAction?: THREE.AnimationAction;
  wrapper: THREE.Group;
}

export interface AnimatedDuckInstance {
  group: THREE.Group;
  update: (dt: number, elapsed: number, isWalking: boolean, speed: number, walkPhase: number, petBounce?: number) => void;
  dispose: () => void;
}

// ─── Module-level GLTF Cache for /duck_walk.glb ───
let _cachedDuckGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
let _isLoadingDuckGltf = false;
let _duckLoadFailed = false;
const _duckWaiters: Array<(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void> = [];

export function loadDuckGlb(
  callback?: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void,
  forceBypassCache = false
): void {
  if (_cachedDuckGltf) {
    callback?.(_cachedDuckGltf);
    return;
  }
  if (callback) {
    _duckWaiters.push(callback);
  }
  if (_isLoadingDuckGltf || (_duckLoadFailed && !forceBypassCache)) return;
  _isLoadingDuckGltf = true;
  if (forceBypassCache) {
    _duckLoadFailed = false;
  }

  const candidatePaths = ['/duck_walk.glb', '/duck.glb'];

  void (async () => {
    for (const candidateUrl of candidatePaths) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidateUrl, {
          bypassCache: forceBypassCache,
        });
        if (!gltf?.scene || gltf.scene.children.length === 0) {
          console.warn(`[DuckAnimal] ⚠ ${candidateUrl} parsed but scene has no children`);
          continue;
        }

        // Log compression / animation info
        const comp = detectCompressionExtensions(inspection);
        console.info(`[DuckAnimal] ✓ loaded ${candidateUrl}`, {
          children: gltf.scene.children.length,
          animCount: gltf.animations?.length ?? 0,
          clipNames: (gltf.animations ?? []).map((a) => ({
            name: a.name,
            duration: a.duration.toFixed(2),
            tracks: a.tracks.length,
          })),
          ...(comp.length > 0 ? { compression: comp } : {}),
        });

        optimizeGLTFSceneForDevice(gltf.scene, inspection);
        _isLoadingDuckGltf = false;
        _duckLoadFailed = false;
        _cachedDuckGltf = {
          scene: gltf.scene,
          animations: gltf.animations || [],
        };
        const pending = _duckWaiters.splice(0, _duckWaiters.length);
        pending.forEach((cb) => cb(_cachedDuckGltf!));
        return;
      } catch (err) {
        console.warn(`[DuckAnimal] ✗ candidate failed: ${candidateUrl}`, err);
      }
    }

    console.warn('[DuckAnimal] all candidates failed → procedural duck fallback');
    _isLoadingDuckGltf = false;
    _duckLoadFailed = true;
    _duckWaiters.length = 0;   // กัน waiter ค้าง
  })();
}

if (typeof window !== 'undefined') {
  loadDuckGlb();
  subscribeGlbDiscovery((resolvedUrl) => {
    if (!_cachedDuckGltf && /(^|\/)duck(_walk)?\.glb$/i.test(resolvedUrl)) {
      loadDuckGlb(undefined, true);
    }
  });
}

function buildProceduralDuckRig(
  holder: THREE.Group,
  sharedMats?: Partial<AnimalRigMaterials>
): DuckProceduralRefs {
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

  const featherCreamMat = makeMat({ color: 0xfffbeb, roughness: 0.78, metalness: 0.02 });
  const mallardHeadMat = makeMat({ color: 0x1b5e20, roughness: 0.55, metalness: 0.12 });
  const collarWhiteMat = makeMat({ color: 0xffffff, roughness: 0.7 });
  const billMat = sharedMats?.chickenBeakMat ?? makeMat({ color: 0xf59e0b, roughness: 0.45 });
  const eyeMat = sharedMats?.darkEyeMat ?? makeMat({ color: 0x111827, roughness: 0.25 });

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.23, 0);
  holder.add(bodyGroup);

  // Plump oval duck body
  const bodyGeo = trackGeo(new THREE.SphereGeometry(0.16, 16, 12));
  const bodyMesh = new THREE.Mesh(bodyGeo, featherCreamMat);
  bodyMesh.scale.set(0.95, 0.85, 1.38);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyGroup.add(bodyMesh);

  // Upturned duck tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.05, -0.2);
  bodyGroup.add(tailGroup);

  const tailGeo = trackGeo(new THREE.ConeGeometry(0.065, 0.14, 8));
  const tailMesh = new THREE.Mesh(tailGeo, featherCreamMat);
  tailMesh.rotation.x = -Math.PI * 0.62;
  tailMesh.castShadow = true;
  tailGroup.add(tailMesh);

  // Folded wings
  const wingGeo = trackGeo(new THREE.SphereGeometry(0.11, 12, 8));
  const wingL = new THREE.Group();
  wingL.position.set(0.13, 0.02, -0.01);
  const wingMeshL = new THREE.Mesh(wingGeo, featherCreamMat);
  wingMeshL.scale.set(0.32, 0.68, 1.35);
  wingMeshL.castShadow = true;
  wingL.add(wingMeshL);
  bodyGroup.add(wingL);

  const wingR = new THREE.Group();
  wingR.position.set(-0.13, 0.02, -0.01);
  const wingMeshR = new THREE.Mesh(wingGeo, featherCreamMat);
  wingMeshR.scale.set(0.32, 0.68, 1.35);
  wingMeshR.castShadow = true;
  wingR.add(wingMeshR);
  bodyGroup.add(wingR);

  // Neck + Head + Flat Orange Bill
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.09, 0.14);
  bodyGroup.add(headGroup);

  const neckGeo = trackGeo(new THREE.CylinderGeometry(0.052, 0.068, 0.15, 10));
  const neckMesh = new THREE.Mesh(neckGeo, featherCreamMat);
  neckMesh.position.set(0, 0.065, 0.015);
  neckMesh.rotation.x = 0.18;
  neckMesh.castShadow = true;
  headGroup.add(neckMesh);

  const collarGeo = trackGeo(new THREE.TorusGeometry(0.054, 0.012, 6, 12));
  const collarMesh = new THREE.Mesh(collarGeo, collarWhiteMat);
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 0.125, 0.025);
  headGroup.add(collarMesh);

  const skullGeo = trackGeo(new THREE.SphereGeometry(0.078, 14, 10));
  const skullMesh = new THREE.Mesh(skullGeo, mallardHeadMat);
  skullMesh.scale.set(0.92, 0.92, 1.08);
  skullMesh.position.set(0, 0.18, 0.04);
  skullMesh.castShadow = true;
  headGroup.add(skullMesh);

  // Flat broad duck bill
  const billGeo = trackGeo(new THREE.BoxGeometry(0.072, 0.026, 0.105));
  const billMesh = new THREE.Mesh(billGeo, billMat);
  billMesh.position.set(0, 0.165, 0.125);
  billMesh.castShadow = true;
  headGroup.add(billMesh);

  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.014, 8, 8));
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.062, 0.195, 0.065);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.062, 0.195, 0.065);
  headGroup.add(eyeL, eyeR);

  // Webbed orange legs
  const legStemGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.014, 0.13, 8));
  const webbedFootGeo = trackGeo(new THREE.BoxGeometry(0.068, 0.016, 0.095));

  const makeLeg = (x: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.13, 0.0);
    const stem = new THREE.Mesh(legStemGeo, billMat);
    stem.position.set(0, -0.06, 0);
    stem.castShadow = true;
    hip.add(stem);

    const foot = new THREE.Mesh(webbedFootGeo, billMat);
    foot.position.set(0, -0.122, 0.024);
    foot.castShadow = true;
    hip.add(foot);
    holder.add(hip);
    return hip;
  };

  const legL = makeLeg(0.065);
  const legR = makeLeg(-0.065);

  return {
    bodyGroup,
    headGroup,
    wingL,
    wingR,
    legL,
    legR,
    tailGroup,
    geometries,
    materials: ownedMaterials,
  };
}

function mountDuckGlb(
  root: THREE.Group,
  gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }
): DuckGlbData {
  const cloned = SkeletonUtils.clone(gltf.scene);
  cloned.name = 'DuckWalkGlbInstance';

  cloned.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.userData.isSharedGlbGeometry = true;
    }
  });

  cloned.updateMatrixWorld(true);
  // IMPORTANT: use precise=true so SkinnedMesh vertices are evaluated in world bind pose!
  const preciseBox = new THREE.Box3().setFromObject(cloned, true);
  const size = new THREE.Vector3();
  preciseBox.getSize(size);

  const targetHeight = 0.54;
  const rawHeight = size.y > 0.02 ? size.y : 0.42;
  const scaleFactor = THREE.MathUtils.clamp(targetHeight / rawHeight, 0.02, 20.0);

  const wrapper = new THREE.Group();
  wrapper.name = 'DuckGlbWrapper';
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
  let walkAction: THREE.AnimationAction | undefined;

  if (gltf.animations && gltf.animations.length > 0) {
    const walkClip =
      gltf.animations.find((c) => c.name.toLowerCase().includes('walk')) ||
      gltf.animations[0];
    walkAction = mixer.clipAction(walkClip);
    walkAction.play();
    // Stagger initial animation phase per duck so flocks don't march in lockstep
    mixer.update(Math.random() * 1.5);

    console.info('[DuckAnimal] walk clip chosen:', {
      clipName: walkClip.name,
      duration: walkClip.duration.toFixed(2),
      tracks: walkClip.tracks.length,
      isRunning: walkAction.isRunning(),
    });
  } else {
    console.warn('[DuckAnimal] ⚠ GLB has no animation clips — duck will be static');
  }

  return {
    mixer,
    walkAction,
    wrapper,
  };
}

function evaluateDuckVisualAnimation(
  glbData: DuckGlbData | null,
  procRefs: DuckProceduralRefs | null,
  dt: number,
  elapsed: number,
  isWalking: boolean,
  speed: number,
  walkPhase: number,
  petBounce = 0
): void {
  const step = Math.min(0.1, Math.max(0, dt));

  if (glbData) {
    const { mixer, walkAction, wrapper } = glbData;
    if (walkAction) {
      const targetScale = isWalking
        ? THREE.MathUtils.clamp(speed / 0.55, 0.65, 1.85)
        : 0.0;
      walkAction.timeScale = THREE.MathUtils.lerp(
        walkAction.timeScale,
        targetScale,
        Math.min(1, step * 8.0)
      );
    }
    mixer.update(step);

    if (isWalking) {
      wrapper.rotation.z = Math.sin(walkPhase) * 0.045;
      wrapper.position.y = Math.abs(Math.sin(walkPhase)) * 0.015;
      wrapper.rotation.x = THREE.MathUtils.lerp(wrapper.rotation.x, 0, step * 6.0);
    } else {
      wrapper.rotation.z = THREE.MathUtils.lerp(wrapper.rotation.z, 0, step * 5.0);
      wrapper.position.y = THREE.MathUtils.lerp(
        wrapper.position.y,
        Math.sin(elapsed * 2.2) * 0.006,
        step * 4.0
      );
      wrapper.rotation.x = THREE.MathUtils.lerp(
        wrapper.rotation.x,
        Math.sin(elapsed * 1.6) * 0.03,
        step * 3.5
      );
    }

    if (petBounce > 0.001) {
      wrapper.position.y += Math.sin(petBounce * Math.PI) * 0.08;
      wrapper.rotation.y = Math.sin(petBounce * Math.PI * 4.0) * 0.16;
    } else {
      wrapper.rotation.y = THREE.MathUtils.lerp(wrapper.rotation.y, 0, step * 6.0);
    }
    return;
  }

  if (procRefs) {
    const ease = 1 - Math.exp(-10 * step);
    if (isWalking) {
      procRefs.legL.rotation.x = Math.sin(walkPhase) * 0.65;
      procRefs.legR.rotation.x = -Math.sin(walkPhase) * 0.65;
      procRefs.bodyGroup.rotation.z = Math.sin(walkPhase) * 0.09;
      procRefs.bodyGroup.position.y = 0.23 + Math.abs(Math.sin(walkPhase)) * 0.022;
      procRefs.headGroup.rotation.x = Math.sin(walkPhase * 2) * 0.09;
      procRefs.tailGroup.rotation.y = Math.sin(walkPhase * 1.5) * 0.2;
    } else {
      procRefs.legL.rotation.x += (0 - procRefs.legL.rotation.x) * ease;
      procRefs.legR.rotation.x += (0 - procRefs.legR.rotation.x) * ease;
      procRefs.bodyGroup.rotation.z += (0 - procRefs.bodyGroup.rotation.z) * ease;
      procRefs.bodyGroup.position.y += (0.23 - procRefs.bodyGroup.position.y) * ease;
      procRefs.headGroup.rotation.x += (Math.sin(elapsed * 1.8) * 0.06 - procRefs.headGroup.rotation.x) * ease;
      procRefs.tailGroup.rotation.y = Math.sin(elapsed * 3.2) * 0.12;
    }

    if (petBounce > 0.001) {
      const flap = Math.abs(Math.sin(petBounce * Math.PI * 5.0)) * 0.55;
      procRefs.wingL.rotation.z = flap;
      procRefs.wingR.rotation.z = -flap;
      procRefs.bodyGroup.position.y += Math.sin(petBounce * Math.PI) * 0.07;
    } else {
      procRefs.wingL.rotation.z += (0 - procRefs.wingL.rotation.z) * ease;
      procRefs.wingR.rotation.z += (0 - procRefs.wingR.rotation.z) * ease;
    }
  }
}

/**
 * Reusable factory for spawning an animated `duck_walk.glb` duck (with automatic procedural fallback
 * and hot-swap) inside `DuckCoop` enclosures.
 */
export function createAnimatedDuckInstance(
  materials?: Partial<AnimalRigMaterials>
): AnimatedDuckInstance {
  const group = new THREE.Group();
  group.name = 'CoopDuckAgent';

  let glbData: DuckGlbData | null = null;
  let procRefs: DuckProceduralRefs | null = null;
  let fallbackHolder: THREE.Group | null = null;
  let isDisposed = false;

  if (_cachedDuckGltf) {
    glbData = mountDuckGlb(group, _cachedDuckGltf);
  } else {
    fallbackHolder = new THREE.Group();
    fallbackHolder.name = 'DuckFallbackHolder';
    group.add(fallbackHolder);
    procRefs = buildProceduralDuckRig(fallbackHolder, materials);

    loadDuckGlb((loadedGltf) => {
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
      glbData = mountDuckGlb(group, loadedGltf);
    });
  }

  return {
    group,
    update: (dt, elapsed, isWalking, speed, walkPhase, petBounce = 0) => {
      if (isDisposed) return;
      evaluateDuckVisualAnimation(
        glbData,
        procRefs,
        dt,
        elapsed,
        isWalking,
        speed,
        walkPhase,
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
 * 🦆 Duck Species Controller (เป็ดเทศอารมณ์ดี — duck_walk.glb)
 */
export class DuckAnimalController implements AnimalSpeciesController {
  public readonly type = 'duck' as const;
  public readonly nameEn = 'Farm Duck';
  public readonly nameTh = 'เป็ดเทศอารมณ์ดี';
  public readonly emoji = '🦆';

  private readonly _instances = new WeakMap<THREE.Group, AnimatedDuckInstance>();

  private resolveInstance(group: THREE.Group): AnimatedDuckInstance | null {
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
    root.name = 'DuckRig';

    const hitBoxGeo = new THREE.BoxGeometry(0.65, 0.72, 0.78);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitMesh.position.set(0, 0.36, 0);
    hitMesh.name = 'DuckHitBox';
    root.add(hitMesh);

    const instance = createAnimatedDuckInstance(materials);
    root.add(instance.group);
    this._instances.set(root, instance);

    return {
      root,
      bodyMesh: hitMesh,
      headGroup: root,
      legs: [],
    };
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
      runtime.petBounce
    );
  }
}

export const duckSpecies = new DuckAnimalController();