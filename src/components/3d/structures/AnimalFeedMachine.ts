// src/components/3d/structures/AnimalFeedMachine.ts
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import type { AnimalFeedType } from '../../../types/game';
import type { HouseMaterials } from './HouseMeshBuilder';

const FEED_MACHINE_GLB_CANDIDATES: readonly string[] = [
  '/Animal feed making machine.glb',
  '/Animal%20feed%20making%20machine.glb',
  '/animal_feed_making_machine.glb',
  '/models/Animal feed making machine.glb',
];

const TARGET_FEED_MACHINE_FOOTPRINT = 6.6;
const CHAFF_PUFF_COUNT = 12;
const FLOAT_COLLECT_DURATION_SEC = 1.9;

export interface AnimalFeedMachineOptions {
  enableMotionAndParticles?: boolean;
  onGlbMounted?: () => void;
}

export interface AnimalFeedMachineResult {
  root: THREE.Group;
  setActiveCount: (count: number) => void;
  launchAutoCollectFloat: (feedType: AnimalFeedType, targetWorldPos?: THREE.Vector3) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

interface ChaffPuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  age: number;
  lifetime: number;
  driftX: number;
  driftZ: number;
  phase: number;
}

interface FloatingFeedBag {
  group: THREE.Group;
  haloMat: THREE.MeshBasicMaterial;
  sparkles: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: THREE.Vector3 }>;
  ownedGeos: THREE.BufferGeometry[];
  ownedMats: THREE.Material[];
  startLocal: THREE.Vector3;
  endLocal: THREE.Vector3;
  age: number;
  duration: number;
  spinSpeed: number;
}

interface CachedFeedMachineGlb {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  hopperAnchor: THREE.Vector3;
  feedOutLocal: THREE.Vector3;
}

let _cachedFeedMachine: CachedFeedMachineGlb | null = null;
let _loadingPromise: Promise<boolean> | null = null;

function ensureFeedMachineGlbCached(bypassCache = false): Promise<boolean> {
  if (_cachedFeedMachine && !bypassCache) {
    return Promise.resolve(true);
  }
  if (_loadingPromise && !bypassCache) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    for (const candidate of FEED_MACHINE_GLB_CANDIDATES) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidate, { bypassCache });
        const raw = gltf.scene;
        optimizeGLTFSceneForDevice(raw, inspection, false);

        raw.traverse((obj) => {
          if (
            obj.name === 'Feed_Pour' ||
            obj.name === 'Feed_Sack' ||
            obj.name === 'Hopper_Feed' ||
            obj.name === 'Feed_Mound'
          ) {
            obj.userData.excludeFromPaint = true;
          }
        });

        const wrapper = new THREE.Group();
        wrapper.name = 'AnimalFeedMachineGLBBody';
        wrapper.add(raw);
        wrapper.updateMatrixWorld(true);

        const hopperAnchor = new THREE.Vector3(0, 2.35, -1.35);
        const feedOutLocal = new THREE.Vector3(0, 0.72, -1.65);

        const box = new THREE.Box3().setFromObject(wrapper);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxHoriz = Math.max(size.x, size.z, 0.001);
          const scale = TARGET_FEED_MACHINE_FOOTPRINT / maxHoriz;
          raw.scale.multiplyScalar(scale);
          wrapper.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(wrapper);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          raw.position.x -= scaledCenter.x;
          raw.position.z -= scaledCenter.z;
          raw.position.y -= scaledBox.min.y;
          wrapper.updateMatrixWorld(true);

          const hopperObj = wrapper.getObjectByName('Hopper_Feed');
          if (hopperObj) {
            hopperObj.getWorldPosition(hopperAnchor);
            wrapper.worldToLocal(hopperAnchor);
            hopperAnchor.y += 0.55;
          }

          const socketOut =
            wrapper.getObjectByName('SOCKET_FeedOut') ??
            wrapper.getObjectByName('Trough_Slide');
          if (socketOut) {
            socketOut.getWorldPosition(feedOutLocal);
            wrapper.worldToLocal(feedOutLocal);
            feedOutLocal.y += 0.28;
          }
        }

        _cachedFeedMachine = {
          scene: wrapper,
          clips: gltf.animations ?? [],
          hopperAnchor,
          feedOutLocal,
        };
        _loadingPromise = null;
        return true;
      } catch {
        // Try next candidate or stay on procedural Feed Mill fallback
      }
    }
    _loadingPromise = null;
    return false;
  })();

  return _loadingPromise;
}

function getFeedRibbonHex(feedType: AnimalFeedType): number {
  switch (feedType) {
    case 'chicken_duck_feed':
      return 0xfacc15; // Golden corn yellow
    case 'duck_grain_feed':
      return 0x38bdf8; // Sky aqua blue
    case 'pig_goat_feed':
      return 0xf97316; // Carrot orange
    case 'cow_sheep_feed':
      return 0x22c55e; // Meadow green
    case 'premium_horse_feed':
      return 0xa855f7; // Royal purple
  }
}

function createFloatingFeedSack(feedType: AnimalFeedType): {
  group: THREE.Group;
  haloMat: THREE.MeshBasicMaterial;
  sparkles: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: THREE.Vector3 }>;
  ownedGeos: THREE.BufferGeometry[];
  ownedMats: THREE.Material[];
} {
  const group = new THREE.Group();
  group.name = `FloatingFeedSack_${feedType}`;
  group.userData.excludeFromPaint = true;

  const ownedGeos: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    ownedMats.push(m);
    return m;
  };

  const ribbonHex = getFeedRibbonHex(feedType);

  const burlapMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xd6b37c,
      roughness: 0.85,
      metalness: 0.04,
      emissive: 0x78350f,
      emissiveIntensity: 0.14,
    })
  );
  const bandMat = regMat(
    new THREE.MeshStandardMaterial({
      color: ribbonHex,
      roughness: 0.42,
      metalness: 0.12,
      emissive: ribbonHex,
      emissiveIntensity: 0.28,
    })
  );
  const ropeMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.5,
      metalness: 0.1,
    })
  );

  // Plump burlap sack body
  const bodyGeo = regGeo(new THREE.SphereGeometry(0.32, 14, 12));
  bodyGeo.scale(1.0, 1.22, 0.84);
  const body = new THREE.Mesh(bodyGeo, burlapMat);
  body.position.y = 0.34;
  body.castShadow = true;
  group.add(body);

  // Color-coded recipe band around the middle of the sack
  const bandGeo = regGeo(new THREE.CylinderGeometry(0.305, 0.315, 0.16, 16, 1, true));
  bandGeo.scale(1.0, 1.0, 0.86);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = 0.34;
  group.add(band);

  // Tied neck rope
  const ropeGeo = regGeo(new THREE.TorusGeometry(0.13, 0.032, 8, 16));
  ropeGeo.rotateX(Math.PI / 2);
  const rope = new THREE.Mesh(ropeGeo, ropeMat);
  rope.position.y = 0.67;
  group.add(rope);

  // Ruffled sack top flare
  const topFlareGeo = regGeo(new THREE.ConeGeometry(0.19, 0.18, 10));
  const topFlare = new THREE.Mesh(topFlareGeo, burlapMat);
  topFlare.rotation.x = Math.PI;
  topFlare.position.y = 0.77;
  group.add(topFlare);

  // Glowing golden collection aura ring beneath the floating sack
  const haloGeo = regGeo(new THREE.RingGeometry(0.32, 0.48, 20));
  haloGeo.rotateX(-Math.PI / 2);
  const haloMat = regMat(
    new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 0.06;
  group.add(halo);

  // Orbiting golden grain sparkles
  const sparkles: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: THREE.Vector3 }> = [];
  const sparkGeo = regGeo(new THREE.OctahedronGeometry(0.065, 0));
  for (let i = 0; i < 4; i++) {
    const sMat = regMat(
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xfef08a : ribbonHex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    );
    const sMesh = new THREE.Mesh(sparkGeo, sMat);
    const angle = (i / 4) * Math.PI * 2;
    const offset = new THREE.Vector3(Math.cos(angle) * 0.46, 0.36 + (i % 2) * 0.18, Math.sin(angle) * 0.46);
    sMesh.position.copy(offset);
    group.add(sMesh);
    sparkles.push({ mesh: sMesh, mat: sMat, offset });
  }

  return { group, haloMat, sparkles, ownedGeos, ownedMats };
}

export class AnimalFeedMachineBuilder {
  public build(
    houseMats: HouseMaterials,
    options: AnimalFeedMachineOptions = {}
  ): AnimalFeedMachineResult {
    const enableMotion = options.enableMotionAndParticles ?? true;
    const root = new THREE.Group();
    root.name = 'AnimalFeedMachineRoot';

    const bodyContainer = new THREE.Group();
    bodyContainer.name = 'FeedMachineBodyContainer';
    root.add(bodyContainer);

    const localMats: THREE.Material[] = [];
    const localGeos: THREE.BufferGeometry[] = [];
    const regMat = <T extends THREE.Material>(m: T): T => {
      localMats.push(m);
      return m;
    };
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      localGeos.push(g);
      return g;
    };

    // Procedural fallback Feed Mill (shown immediately before GLB finishes loading)
    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'ProceduralFeedMillFallback';

    const steelRed = regMat(
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.48, metalness: 0.32 })
    );
    const brassMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.62 })
    );
    const ironMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.52, metalness: 0.58 })
    );
    const grainMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.05 })
    );

    const basePad = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.6, 0.18, 5.6)), houseMats.stone);
    basePad.position.y = 0.09;
    basePad.receiveShadow = true;
    fallbackGroup.add(basePad);

    const millHousing = new THREE.Mesh(regGeo(new THREE.BoxGeometry(2.1, 1.7, 1.9)), steelRed);
    millHousing.position.set(0, 0.98, -0.7);
    millHousing.castShadow = true;
    millHousing.receiveShadow = true;
    fallbackGroup.add(millHousing);

    const hopperMesh = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.95, 0.42, 1.05, 8)),
      brassMat
    );
    hopperMesh.position.set(0, 2.32, -0.7);
    hopperMesh.castShadow = true;
    fallbackGroup.add(hopperMesh);

    const grainTop = new THREE.Mesh(regGeo(new THREE.CylinderGeometry(0.82, 0.78, 0.14, 8)), grainMat);
    grainTop.position.set(0, 2.78, -0.7);
    grainTop.userData.excludeFromPaint = true;
    fallbackGroup.add(grainTop);

    const fallbackFlywheel = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.58, 0.08, 10, 20)),
      ironMat
    );
    fallbackFlywheel.rotation.y = Math.PI / 2;
    fallbackFlywheel.position.set(1.14, 1.05, -0.7);
    fallbackFlywheel.castShadow = true;
    fallbackGroup.add(fallbackFlywheel);

    const chuteMesh = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.75, 0.24, 1.85)),
      houseMats.woodLight
    );
    chuteMesh.position.set(0, 0.56, 0.85);
    chuteMesh.rotation.x = 0.22;
    chuteMesh.castShadow = true;
    fallbackGroup.add(chuteMesh);

    bodyContainer.add(fallbackGroup);

    // Chaff / Golden Grain Dust Particles when milling
    const particleGroup = new THREE.Group();
    particleGroup.name = 'FeedMillParticles';
    particleGroup.userData.excludeFromPaint = true;
    root.add(particleGroup);

    // Auto-Collect Floating Feed Sacks Group
    const floatGroup = new THREE.Group();
    floatGroup.name = 'FeedAutoFloatGroup';
    floatGroup.userData.excludeFromPaint = true;
    root.add(floatGroup);

    const hopperAnchor = new THREE.Vector3(0, 2.65, -0.7);
    const feedOutLocal = new THREE.Vector3(0, 0.65, 1.35);

    const puffs: ChaffPuff[] = [];
    if (enableMotion) {
      const puffGeo = regGeo(new THREE.DodecahedronGeometry(0.11, 0));
      for (let i = 0; i < CHAFF_PUFF_COUNT; i++) {
        const pMat = regMat(
          new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xfef08a : 0xfde68a,
            roughness: 0.85,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        const pMesh = new THREE.Mesh(puffGeo, pMat);
        pMesh.visible = false;
        particleGroup.add(pMesh);
        puffs.push({
          mesh: pMesh,
          mat: pMat,
          age: (i / CHAFF_PUFF_COUNT) * 1.6,
          lifetime: 1.35 + (i % 3) * 0.25,
          driftX: ((i % 5) - 2) * 0.16,
          driftZ: (((i * 3) % 5) - 2) * 0.16,
          phase: i * 1.1,
        });
      }
    }

    let mixer: THREE.AnimationMixer | null = null;
    let glbActions: THREE.AnimationAction[] = [];
    let glbApplied = false;
    let isDisposed = false;
    let activeCount = 0;
    const floatingBags: FloatingFeedBag[] = [];

    const syncMixerPlayback = () => {
      const running = activeCount > 0 && enableMotion;
      for (const act of glbActions) {
        if (running) {
          act.paused = false;
          if (!act.isRunning()) act.play();
        } else {
          act.paused = true;
        }
      }
    };

    const mountCachedGlb = () => {
      if (isDisposed || glbApplied || !_cachedFeedMachine) return;
      glbApplied = true;

      bodyContainer.remove(fallbackGroup);
      const cloned = _cachedFeedMachine.scene.clone(true);
      bodyContainer.add(cloned);

      hopperAnchor.copy(_cachedFeedMachine.hopperAnchor);
      feedOutLocal.copy(_cachedFeedMachine.feedOutLocal);

      if (enableMotion && _cachedFeedMachine.clips.length > 0) {
        mixer = new THREE.AnimationMixer(cloned);
        glbActions = _cachedFeedMachine.clips.map((clip) => {
          const action = mixer!.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          action.paused = activeCount <= 0;
          return action;
        });
        // Prime pose at t=0
        mixer.update(0.001);
        syncMixerPlayback();
      }
      options.onGlbMounted?.();
    };

    if (_cachedFeedMachine) {
      mountCachedGlb();
    } else {
      void ensureFeedMachineGlbCached().then((loaded) => {
        if (loaded) mountCachedGlb();
      });
    }

    const unsubDiscovery = subscribeGlbDiscovery((url) => {
      if (isDisposed || glbApplied) return;
      if (FEED_MACHINE_GLB_CANDIDATES.includes(url)) {
        void ensureFeedMachineGlbCached(true).then((loaded) => {
          if (loaded) mountCachedGlb();
        });
      }
    });

    const disposeBag = (bag: FloatingFeedBag) => {
      floatGroup.remove(bag.group);
      for (const geo of bag.ownedGeos) geo.dispose();
      for (const mat of bag.ownedMats) mat.dispose();
    };

    const launchAutoCollectFloat = (
      feedType: AnimalFeedType,
      targetWorldPos?: THREE.Vector3
    ) => {
      if (isDisposed || !enableMotion) return;

      const built = createFloatingFeedSack(feedType);
      const startLocal = feedOutLocal.clone();

      // Default upward barn-bound destination if no player world position is supplied
      const endLocal = startLocal.clone().add(new THREE.Vector3(0, 3.8, 1.8));
      if (targetWorldPos) {
        root.updateMatrixWorld(true);
        const desiredWorld = targetWorldPos.clone().add(new THREE.Vector3(0, 1.45, 0));
        const candidateLocal = floatGroup.worldToLocal(desiredWorld);
        // Clamp horizontal travel to 18m so the floating arc stays sleek and readable even across the farm
        const horiz = new THREE.Vector2(
          candidateLocal.x - startLocal.x,
          candidateLocal.z - startLocal.z
        );
        if (horiz.length() > 18) {
          horiz.setLength(18);
          candidateLocal.x = startLocal.x + horiz.x;
          candidateLocal.z = startLocal.z + horiz.y;
          candidateLocal.y = Math.max(candidateLocal.y, 3.2);
        }
        endLocal.copy(candidateLocal);
      }

      built.group.position.copy(startLocal);
      built.group.scale.setScalar(0.32);
      floatGroup.add(built.group);

      floatingBags.push({
        group: built.group,
        haloMat: built.haloMat,
        sparkles: built.sparkles,
        ownedGeos: built.ownedGeos,
        ownedMats: built.ownedMats,
        startLocal,
        endLocal,
        age: 0,
        duration: FLOAT_COLLECT_DURATION_SEC,
        spinSpeed: 3.4,
      });
    };

    const setActiveCount = (count: number) => {
      activeCount = Math.max(0, count);
      syncMixerPlayback();
      if (activeCount === 0) {
        for (const p of puffs) {
          p.mesh.visible = false;
          p.mat.opacity = 0;
        }
      }
    };

    const _lerpPos = new THREE.Vector3();

    const update = (dt: number, elapsed: number) => {
      if (isDisposed || !enableMotion) return;

      const isWorking = activeCount > 0;

      if (isWorking) {
        if (mixer) {
          mixer.update(dt * (1.0 + Math.min(2, activeCount - 1) * 0.18));
        } else {
          fallbackFlywheel.rotation.z += dt * 4.8;
          millHousing.scale.y = 1 + Math.sin(elapsed * 14) * 0.025;
        }

        for (const p of puffs) {
          p.age += dt;
          if (p.age >= p.lifetime) {
            p.age = 0;
          }
          const t = p.age / p.lifetime;
          p.mesh.visible = true;
          p.mesh.position.set(
            hopperAnchor.x + p.driftX * t + Math.sin(elapsed * 3.2 + p.phase) * 0.08,
            hopperAnchor.y + t * 1.45,
            hopperAnchor.z + p.driftZ * t + Math.cos(elapsed * 2.8 + p.phase) * 0.08
          );
          const sc = 0.55 + Math.sin(t * Math.PI) * 0.85;
          p.mesh.scale.setScalar(sc);
          p.mesh.rotation.x += dt * 2.1;
          p.mesh.rotation.y += dt * 2.6;
          p.mat.opacity = Math.sin(t * Math.PI) * 0.72;
        }
      }

      // Animate floating auto-collected feed bags along a smooth parabolic trajectory
      for (let i = floatingBags.length - 1; i >= 0; i--) {
        const bag = floatingBags[i];
        bag.age += dt;
        const rawT = Math.min(1, bag.age / bag.duration);

        if (rawT >= 1) {
          disposeBag(bag);
          floatingBags.splice(i, 1);
          continue;
        }

        // Smooth ease-in-out travel + high parabolic float peak
        const easeT = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
        _lerpPos.lerpVectors(bag.startLocal, bag.endLocal, easeT);
        const arcLift = Math.sin(rawT * Math.PI) * 2.85;
        _lerpPos.y += arcLift;
        bag.group.position.copy(_lerpPos);

        // Pop-in from chute, cruise proudly, then tuck neatly into storage at the end
        let scale = 1.0;
        if (rawT < 0.16) {
          scale = THREE.MathUtils.lerp(0.32, 1.14, rawT / 0.16);
        } else if (rawT < 0.28) {
          scale = THREE.MathUtils.lerp(1.14, 1.0, (rawT - 0.16) / 0.12);
        } else if (rawT > 0.82) {
          scale = THREE.MathUtils.lerp(1.0, 0.18, (rawT - 0.82) / 0.18);
        }
        bag.group.scale.setScalar(scale);
        bag.group.rotation.y += dt * bag.spinSpeed;
        bag.group.rotation.z = Math.sin(elapsed * 6.5 + i) * 0.12;

        bag.haloMat.opacity = (1 - rawT * 0.65) * 0.85;

        for (let s = 0; s < bag.sparkles.length; s++) {
          const sp = bag.sparkles[s];
          const ang = elapsed * 5.2 + (s / bag.sparkles.length) * Math.PI * 2;
          sp.mesh.position.set(
            Math.cos(ang) * 0.48,
            0.34 + Math.sin(elapsed * 7 + s) * 0.16,
            Math.sin(ang) * 0.48
          );
          sp.mesh.rotation.y += dt * 4.5;
          sp.mat.opacity = Math.max(0, 1 - rawT * 0.85);
        }
      }
    };

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;
      unsubDiscovery();
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }
      glbActions = [];
      while (floatingBags.length > 0) {
        const bag = floatingBags.pop()!;
        disposeBag(bag);
      }
      for (const geo of localGeos) geo.dispose();
      for (const mat of localMats) mat.dispose();
      if (glbApplied) {
        disposeHierarchySafely(bodyContainer);
      }
    };

    return {
      root,
      setActiveCount,
      launchAutoCollectFloat,
      update,
      dispose,
    };
  }
}
