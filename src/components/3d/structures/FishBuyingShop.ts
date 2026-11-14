// src/components/3d/structures/FishBuyingShop.ts
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import type { HouseMaterials } from './HouseMeshBuilder';

export const FISH_BUYING_SHOP_GLB_CANDIDATES: readonly string[] = [
  '/Fish-buying shop.glb',
  '/Fish-buying%20shop.glb',
  '/fish-buying-shop.glb',
  '/fish_buying_shop.glb',
  '/Fish_buying_shop.glb',
  '/models/Fish-buying shop.glb',
];

const TARGET_FISH_SHOP_FOOTPRINT = 6.6;
const SALE_BURST_DURATION_SEC = 1.65;

export interface FishBuyingShopOptions {
  enableMotion?: boolean;
  onGlbMounted?: () => void;
}

export interface FishBuyingShopResult {
  root: THREE.Group;
  setStockCount: (count: number) => void;
  launchSaleCelebration: () => void;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

interface CachedFishShopGlb {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  counterAnchor: THREE.Vector3;
}

interface SaleCoinBurst {
  group: THREE.Group;
  coins: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    vel: THREE.Vector3;
    spin: number;
  }>;
  ringMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  ownedGeos: THREE.BufferGeometry[];
  ownedMats: THREE.Material[];
  age: number;
  duration: number;
}

let _cachedFishShop: CachedFishShopGlb | null = null;
let _loadingPromise: Promise<boolean> | null = null;

function ensureFishShopGlbCached(bypassCache = false): Promise<boolean> {
  if (_cachedFishShop && !bypassCache) {
    return Promise.resolve(true);
  }
  if (_loadingPromise && !bypassCache) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    for (const candidate of FISH_BUYING_SHOP_GLB_CANDIDATES) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidate, { bypassCache });
        const raw = gltf.scene;
        optimizeGLTFSceneForDevice(raw, inspection, false);

        const wrapper = new THREE.Group();
        wrapper.name = 'FishBuyingShopGLBBody';
        wrapper.add(raw);
        wrapper.updateMatrixWorld(true);

        const counterAnchor = new THREE.Vector3(0, 1.55, 1.15);

        const box = new THREE.Box3().setFromObject(wrapper);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxHoriz = Math.max(size.x, size.z, 0.001);
          const scale = TARGET_FISH_SHOP_FOOTPRINT / maxHoriz;
          raw.scale.multiplyScalar(scale);
          wrapper.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(wrapper);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          raw.position.x -= scaledCenter.x;
          raw.position.z -= scaledCenter.z;
          raw.position.y -= scaledBox.min.y;
          wrapper.updateMatrixWorld(true);

          const finalBox = new THREE.Box3().setFromObject(wrapper);
          counterAnchor.set(0, Math.min(2.4, (finalBox.max.y - finalBox.min.y) * 0.52), 1.0);
        }

        _cachedFishShop = {
          scene: wrapper,
          clips: gltf.animations ?? [],
          counterAnchor,
        };
        _loadingPromise = null;
        return true;
      } catch {
        // Try next candidate or stay on procedural Waterfront Fish-Buying Shop fallback
      }
    }
    _loadingPromise = null;
    return false;
  })();

  return _loadingPromise;
}

function buildDisplayFishMesh(
  bodyHex: number,
  finHex: number,
  lengthScale: number,
  regGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  regMat: <T extends THREE.Material>(m: T) => T
): THREE.Group {
  const fish = new THREE.Group();
  fish.userData.excludeFromPaint = true;

  const bodyMat = regMat(
    new THREE.MeshStandardMaterial({
      color: bodyHex,
      roughness: 0.28,
      metalness: 0.22,
    })
  );
  const finMat = regMat(
    new THREE.MeshStandardMaterial({
      color: finHex,
      roughness: 0.45,
      metalness: 0.1,
    })
  );
  const eyeMat = regMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
    })
  );

  const bodyGeo = regGeo(new THREE.SphereGeometry(0.18, 12, 10));
  bodyGeo.scale(1.85 * lengthScale, 0.68, 0.42);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  fish.add(body);

  const tailGeo = regGeo(new THREE.ConeGeometry(0.14, 0.24, 4));
  tailGeo.rotateZ(Math.PI / 2);
  tailGeo.scale(1, 0.85, 0.25);
  const tail = new THREE.Mesh(tailGeo, finMat);
  tail.position.x = -0.34 * lengthScale;
  fish.add(tail);

  const dorsalGeo = regGeo(new THREE.ConeGeometry(0.08, 0.16, 4));
  dorsalGeo.scale(1.3, 0.9, 0.22);
  const dorsal = new THREE.Mesh(dorsalGeo, finMat);
  dorsal.position.set(0.02, 0.12, 0);
  fish.add(dorsal);

  const eyeGeo = regGeo(new THREE.SphereGeometry(0.026, 8, 8));
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.22 * lengthScale, 0.03, 0.055);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.22 * lengthScale, 0.03, -0.055);
  fish.add(eyeL, eyeR);

  return fish;
}

export class FishBuyingShopBuilder {
  public build(
    materials: HouseMaterials,
    options: FishBuyingShopOptions = {}
  ): FishBuyingShopResult {
    const enableMotion = options.enableMotion ?? true;
    const root = new THREE.Group();
    root.name = 'FishBuyingShop';

    const bodyContainer = new THREE.Group();
    bodyContainer.name = 'FishShopBodyContainer';
    root.add(bodyContainer);

    const celebrationGroup = new THREE.Group();
    celebrationGroup.name = 'FishShopCelebrationGroup';
    celebrationGroup.userData.excludeFromPaint = true;
    root.add(celebrationGroup);

    const localGeos: THREE.BufferGeometry[] = [];
    const localMats: THREE.Material[] = [];
    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      localGeos.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(m: T): T => {
      localMats.push(m);
      return m;
    };

    // ─── Procedural Waterfront Fish-Buying Shop Fallback (auto-replaced when Fish-buying shop.glb is present) ───
    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'FishShopProceduralBody';

    const deckPlankMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x7c583a, roughness: 0.86, metalness: 0.05 })
    );
    const cabinWoodMat = materials.wood;
    const trimDarkMat = materials.woodDark;
    const harborBlueMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.52, metalness: 0.08 })
    );
    const awningCreamMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.62, metalness: 0.04 })
    );
    const iceMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        roughness: 0.18,
        metalness: 0.12,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.12,
      })
    );
    const brassMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.3,
        metalness: 0.78,
      })
    );
    const lanternMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.25,
      })
    );
    const barrelIronMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.68 })
    );

    // 1. Stone foundation + raised wooden harbor pier deck (6.2m x 5.2m)
    const stoneBase = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(6.3, 0.24, 5.3)),
      materials.stone
    );
    stoneBase.position.y = 0.12;
    stoneBase.receiveShadow = true;
    fallbackGroup.add(stoneBase);

    const woodDeck = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(6.0, 0.18, 5.0)),
      deckPlankMat
    );
    woodDeck.position.y = 0.31;
    woodDeck.castShadow = true;
    woodDeck.receiveShadow = true;
    fallbackGroup.add(woodDeck);

    // Front welcome step
    const frontStep = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(2.8, 0.16, 0.58)),
      deckPlankMat
    );
    frontStep.position.set(0, 0.16, 2.72);
    frontStep.castShadow = true;
    frontStep.receiveShadow = true;
    fallbackGroup.add(frontStep);

    // 2. Rear shop cabin (merchant room + storage)
    const cabin = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(5.2, 2.65, 2.2)),
      cabinWoodMat
    );
    cabin.position.set(0, 1.72, -1.05);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    fallbackGroup.add(cabin);

    // Pitched cabin roof
    const roofBack = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(5.65, 0.18, 2.75)),
      harborBlueMat
    );
    roofBack.position.set(0, 3.22, -1.05);
    roofBack.rotation.x = -0.18;
    roofBack.castShadow = true;
    fallbackGroup.add(roofBack);

    // Cabin door & framed window
    const door = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.92, 1.85, 0.1)),
      trimDarkMat
    );
    door.position.set(-1.55, 1.32, 0.06);
    fallbackGroup.add(door);

    const windowGlass = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(1.35, 0.95, 0.1)),
      materials.glass
    );
    windowGlass.position.set(0.85, 1.85, 0.06);
    fallbackGroup.add(windowGlass);

    // 3. Front timber posts + nautical blue-and-cream striped market awning
    const postGeo = regGeo(new THREE.CylinderGeometry(0.11, 0.12, 2.75, 10));
    for (const px of [-2.55, 2.55]) {
      const post = new THREE.Mesh(postGeo, trimDarkMat);
      post.position.set(px, 1.76, 1.95);
      post.castShadow = true;
      fallbackGroup.add(post);
    }

    const crossBeam = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(5.5, 0.18, 0.18)),
      trimDarkMat
    );
    crossBeam.position.set(0, 3.04, 1.95);
    crossBeam.castShadow = true;
    fallbackGroup.add(crossBeam);

    // Striped canopy (7 alternating blue & cream slats sloping forward)
    const awningGroup = new THREE.Group();
    awningGroup.position.set(0, 3.12, 1.02);
    awningGroup.rotation.x = 0.24;
    const stripeCount = 7;
    const stripeW = 5.6 / stripeCount;
    const stripeGeo = regGeo(new THREE.BoxGeometry(stripeW + 0.02, 0.1, 2.35));
    for (let i = 0; i < stripeCount; i++) {
      const mat = i % 2 === 0 ? harborBlueMat : awningCreamMat;
      const slat = new THREE.Mesh(stripeGeo, mat);
      slat.position.x = -2.8 + stripeW * (i + 0.5);
      slat.castShadow = true;
      awningGroup.add(slat);
    }
    fallbackGroup.add(awningGroup);

    // 4. Crushed-ice fish buying & weighing counter
    const counterBase = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(3.45, 0.96, 1.15)),
      cabinWoodMat
    );
    counterBase.position.set(0.35, 0.88, 1.38);
    counterBase.castShadow = true;
    counterBase.receiveShadow = true;
    fallbackGroup.add(counterBase);

    const iceTrayGroup = new THREE.Group();
    iceTrayGroup.userData.excludeFromPaint = true;
    iceTrayGroup.position.set(0.35, 1.4, 1.38);
    iceTrayGroup.rotation.x = 0.14;

    const trayRim = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(3.32, 0.16, 1.06)),
      trimDarkMat
    );
    iceTrayGroup.add(trayRim);

    const iceBed = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(3.14, 0.14, 0.9)),
      iceMat
    );
    iceBed.position.y = 0.05;
    iceTrayGroup.add(iceBed);

    // 3 colorful fresh fish displayed on the crushed ice bed
    const fish1 = buildDisplayFishMesh(0xd97706, 0xfbbf24, 1.15, regGeo, regMat); // Golden Mahseer
    fish1.position.set(-0.92, 0.17, 0.04);
    fish1.rotation.set(Math.PI / 2, 0.22, -0.1);
    iceTrayGroup.add(fish1);

    const fish2 = buildDisplayFishMesh(0x0ea5e9, 0xf472b6, 0.98, regGeo, regMat); // Rainbow Trout
    fish2.position.set(0.05, 0.17, -0.05);
    fish2.rotation.set(Math.PI / 2, -0.18, 0.08);
    iceTrayGroup.add(fish2);

    const fish3 = buildDisplayFishMesh(0x3f6212, 0x84cc16, 1.05, regGeo, regMat); // Largemouth Bass
    fish3.position.set(0.98, 0.17, 0.05);
    fish3.rotation.set(Math.PI / 2, 0.15, -0.05);
    iceTrayGroup.add(fish3);

    fallbackGroup.add(iceTrayGroup);

    // 5. Swaying overhead fish shop signboard + brass weighing scale
    const signPivot = new THREE.Group();
    signPivot.position.set(0, 2.96, 2.02);
    signPivot.userData.excludeFromPaint = true;

    const signBoard = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(2.35, 0.56, 0.12)),
      harborBlueMat
    );
    signBoard.position.y = -0.34;
    signBoard.castShadow = true;
    signPivot.add(signBoard);

    const signBorder = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(2.45, 0.64, 0.08)),
      brassMat
    );
    signBorder.position.y = -0.34;
    signPivot.add(signBorder);

    const signFishIcon = buildDisplayFishMesh(0xfbbf24, 0xfef08a, 1.35, regGeo, regMat);
    signFishIcon.position.set(0, -0.34, 0.09);
    signPivot.add(signFishIcon);

    fallbackGroup.add(signPivot);

    // Hanging brass fish scale on the left post
    const scalePivot = new THREE.Group();
    scalePivot.position.set(-1.75, 2.78, 1.75);
    scalePivot.userData.excludeFromPaint = true;

    const scaleChain = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6)),
      brassMat
    );
    scaleChain.position.y = -0.28;
    scalePivot.add(scaleChain);

    const scaleDial = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14)),
      awningCreamMat
    );
    scaleDial.rotation.x = Math.PI / 2;
    scaleDial.position.y = -0.58;
    scalePivot.add(scaleDial);

    const scalePan = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.32, 0.24, 0.08, 14)),
      brassMat
    );
    scalePan.position.y = -0.96;
    scalePivot.add(scalePan);

    fallbackGroup.add(scalePivot);

    // 6. Harbor barrels + warm lantern
    const barrelGeo = regGeo(new THREE.CylinderGeometry(0.36, 0.33, 0.86, 12));
    const hoopGeo = regGeo(new THREE.TorusGeometry(0.35, 0.025, 6, 16));
    hoopGeo.rotateX(Math.PI / 2);

    for (const [bx, bz] of [
      [-2.15, 1.35],
      [-2.35, 0.42],
    ] as const) {
      const barrel = new THREE.Mesh(barrelGeo, trimDarkMat);
      barrel.position.set(bx, 0.82, bz);
      barrel.castShadow = true;
      fallbackGroup.add(barrel);

      const hoop = new THREE.Mesh(hoopGeo, barrelIronMat);
      hoop.position.set(bx, 0.98, bz);
      fallbackGroup.add(hoop);
    }

    const lantern = new THREE.Mesh(
      regGeo(new THREE.SphereGeometry(0.16, 10, 10)),
      lanternMat
    );
    lantern.userData.excludeFromPaint = true;
    lantern.position.set(2.32, 2.55, 1.98);
    fallbackGroup.add(lantern);

    bodyContainer.add(fallbackGroup);

    // ─── State & GLB Hot-Swap Lifecycle ───
    let glbApplied = false;
    let isDisposed = false;
    let stockCount = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let glbActions: THREE.AnimationAction[] = [];
    const counterAnchor = new THREE.Vector3(0.2, 1.65, 1.25);
    const activeBursts: SaleCoinBurst[] = [];

    const applyCachedGlb = () => {
      if (isDisposed || glbApplied || !_cachedFishShop) return;
      glbApplied = true;
      bodyContainer.remove(fallbackGroup);

      const cloned = _cachedFishShop.scene.clone(true);
      bodyContainer.add(cloned);
      counterAnchor.copy(_cachedFishShop.counterAnchor);

      if (enableMotion && _cachedFishShop.clips.length > 0) {
        mixer = new THREE.AnimationMixer(cloned);
        glbActions = _cachedFishShop.clips.map((clip) => {
          const action = mixer!.clipAction(clip);
          action.play();
          return action;
        });
      }

      options.onGlbMounted?.();
    };

    if (_cachedFishShop) {
      applyCachedGlb();
    } else {
      ensureFishShopGlbCached().then((ok) => {
        if (ok) applyCachedGlb();
      });
    }

    const unsubDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (isDisposed || glbApplied) return;
      if (FISH_BUYING_SHOP_GLB_CANDIDATES.includes(resolvedUrl)) {
        ensureFishShopGlbCached(true).then((ok) => {
          if (ok) applyCachedGlb();
        });
      }
    });

    const disposeBurst = (burst: SaleCoinBurst) => {
      celebrationGroup.remove(burst.group);
      for (const g of burst.ownedGeos) g.dispose();
      for (const m of burst.ownedMats) m.dispose();
    };

    const launchSaleCelebration = () => {
      if (isDisposed || !enableMotion) return;

      const burstGroup = new THREE.Group();
      burstGroup.position.copy(counterAnchor);
      const ownedGeos: THREE.BufferGeometry[] = [];
      const ownedMats: THREE.Material[] = [];

      const coinGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.045, 14);
      coinGeo.rotateX(Math.PI / 2);
      ownedGeos.push(coinGeo);

      const coins: SaleCoinBurst['coins'] = [];
      const coinCount = 8;
      for (let i = 0; i < coinCount; i++) {
        const angle = (i / coinCount) * Math.PI * 2 + Math.random() * 0.35;
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.45,
          roughness: 0.22,
          metalness: 0.82,
          transparent: true,
          opacity: 1,
        });
        ownedMats.push(coinMat);
        const mesh = new THREE.Mesh(coinGeo, coinMat);
        burstGroup.add(mesh);
        coins.push({
          mesh,
          mat: coinMat,
          vel: new THREE.Vector3(
            Math.cos(angle) * (0.75 + Math.random() * 0.55),
            2.35 + Math.random() * 1.1,
            Math.sin(angle) * (0.75 + Math.random() * 0.55)
          ),
          spin: 5.5 + Math.random() * 3.5,
        });
      }

      const ringGeo = new THREE.RingGeometry(0.28, 0.46, 24);
      ringGeo.rotateX(-Math.PI / 2);
      ownedGeos.push(ringGeo);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      ownedMats.push(ringMat);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.05;
      burstGroup.add(ringMesh);

      celebrationGroup.add(burstGroup);
      activeBursts.push({
        group: burstGroup,
        coins,
        ringMesh,
        ringMat,
        ownedGeos,
        ownedMats,
        age: 0,
        duration: SALE_BURST_DURATION_SEC,
      });
    };

    const setStockCount = (count: number) => {
      stockCount = Math.max(0, count);
    };

    const update = (dt: number, elapsed: number) => {
      if (isDisposed || !enableMotion) return;

      if (mixer && glbActions.length > 0) {
        mixer.update(dt);
      } else if (!glbApplied) {
        const swayAmp = stockCount > 0 ? 0.09 : 0.04;
        signPivot.rotation.z = Math.sin(elapsed * 2.1) * swayAmp;
        scalePivot.rotation.z = Math.cos(elapsed * 2.6) * (stockCount > 0 ? 0.11 : 0.045);
        lanternMat.emissiveIntensity =
          stockCount > 0
            ? 0.95 + Math.sin(elapsed * 4.2) * 0.25
            : 0.72 + Math.sin(elapsed * 2.0) * 0.1;
      }

      for (let i = activeBursts.length - 1; i >= 0; i--) {
        const b = activeBursts[i];
        b.age += dt;
        const t = Math.min(1, b.age / b.duration);
        if (t >= 1) {
          disposeBurst(b);
          activeBursts.splice(i, 1);
          continue;
        }

        b.ringMesh.scale.setScalar(1 + t * 3.4);
        b.ringMat.opacity = (1 - t) * 0.8;

        for (const c of b.coins) {
          c.mesh.position.x += c.vel.x * dt;
          c.mesh.position.y += c.vel.y * dt;
          c.mesh.position.z += c.vel.z * dt;
          c.vel.y -= 3.6 * dt;
          c.mesh.rotation.y += c.spin * dt;
          c.mat.opacity = t > 0.65 ? (1 - t) / 0.35 : 1;
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
      while (activeBursts.length > 0) {
        disposeBurst(activeBursts.pop()!);
      }
      for (const geo of localGeos) geo.dispose();
      for (const mat of localMats) mat.dispose();
      if (glbApplied) {
        disposeHierarchySafely(bodyContainer);
      }
    };

    return {
      root,
      setStockCount,
      launchSaleCelebration,
      update,
      dispose,
    };
  }
}
