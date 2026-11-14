// src/components/3d/structures/BreweryFactory.ts
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import type { HouseMaterials } from './HouseMeshBuilder';

const BREWERY_GLB_CANDIDATES = [
  '/beerproductionfactory.glb',
  '/beer-production-factory.glb',
  '/beer_production_factory.glb',
  '/models/beerproductionfactory.glb',
];

const TARGET_FOOTPRINT = 6.8;
const SMOKE_PUFF_COUNT = 18;

interface SmokePuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  age: number;
  lifetime: number;
  driftX: number;
  driftZ: number;
  phase: number;
}

export interface BreweryFactoryOptions {
  enableSmokeAndMotion?: boolean;
}

export interface BreweryFactoryResult {
  root: THREE.Group;
  setActive: (active: boolean) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

let _cachedBreweryScene: THREE.Group | null = null;
let _cachedBreweryClips: THREE.AnimationClip[] = [];
let _cachedSmokeAnchor = new THREE.Vector3(1.15, 4.35, -0.85);
let _loadingPromise: Promise<boolean> | null = null;

function ensureBreweryGlbCached(bypassCache = false): Promise<boolean> {
  if (_cachedBreweryScene && !bypassCache) {
    return Promise.resolve(true);
  }
  if (_loadingPromise && !bypassCache) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    for (const candidate of BREWERY_GLB_CANDIDATES) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidate, { bypassCache });
        const raw = gltf.scene;
        optimizeGLTFSceneForDevice(raw, inspection, false);

        const wrapper = new THREE.Group();
        wrapper.name = 'BreweryGLBModel';
        wrapper.add(raw);
        wrapper.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(wrapper);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          const maxHoriz = Math.max(size.x, size.z, 0.001);
          const scale = TARGET_FOOTPRINT / maxHoriz;
          raw.scale.multiplyScalar(scale);
          wrapper.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(wrapper);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          raw.position.x -= scaledCenter.x;
          raw.position.z -= scaledCenter.z;
          raw.position.y -= scaledBox.min.y;
          wrapper.updateMatrixWorld(true);

          // Find highest chimney/stack vertex region so smoke rises from the real chimney!
          const finalBox = new THREE.Box3().setFromObject(wrapper);
          const topY = finalBox.max.y;
          const topThreshold = topY - Math.max(0.28, (finalBox.max.y - finalBox.min.y) * 0.08);
          let sumX = 0;
          let sumZ = 0;
          let topSamples = 0;
          const vTmp = new THREE.Vector3();

          wrapper.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;
            const posAttr = mesh.geometry.attributes.position;
            if (!posAttr) return;
            const stride = Math.max(1, Math.floor(posAttr.count / 120));
            for (let i = 0; i < posAttr.count; i += stride) {
              vTmp.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
              if (vTmp.y >= topThreshold) {
                sumX += vTmp.x;
                sumZ += vTmp.z;
                topSamples++;
              }
            }
          });

          if (topSamples > 0) {
            _cachedSmokeAnchor.set(sumX / topSamples, topY - 0.05, sumZ / topSamples);
          } else {
            _cachedSmokeAnchor.set(0, topY - 0.05, 0);
          }
        }

        _cachedBreweryScene = wrapper;
        _cachedBreweryClips = gltf.animations ?? [];
        _loadingPromise = null;
        return true;
      } catch {
        // Try next candidate
      }
    }
    _loadingPromise = null;
    return false;
  })();

  return _loadingPromise;
}

/**
 * BreweryFactoryBuilder — เครื่องกลั่นและหมักเครื่องดื่ม (beerproductionfactory.glb)
 * - โหลด `/beerproductionfactory.glb` อัตโนมัติพร้อมเล่น Animation ในไฟล์ + ขยับเครื่องจักรกลั่น
 * - ปล่อยควัน 3D ลอยขึ้นจากปล่องไฟอย่างต่อเนื่อง (หนาและแรงขึ้นเมื่อกำลังหมัก/กลั่น)
 * - ไม่มีตัวละคร NPC ใหม่ — เปิดโถงทางเดินด้านหน้าให้ตัวละครชาย/หญิงของผู้เล่นเดินเข้า-ออกได้ทันที
 */
export class BreweryFactoryBuilder {
  public build(
    houseMats: HouseMaterials,
    options: BreweryFactoryOptions = {}
  ): BreweryFactoryResult {
    const enableSmokeAndMotion = options.enableSmokeAndMotion ?? true;
    let isDisposed = false;
    let isActiveBrewing = false;

    const root = new THREE.Group();
    root.name = 'BreweryFactoryRig';

    const ownedGeos: THREE.BufferGeometry[] = [];
    const ownedMats: THREE.Material[] = [];

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      ownedGeos.push(g);
      return g;
    };
    const makeMat = (params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial(params);
      ownedMats.push(m);
      return m;
    };

    const copperMat = makeMat({
      color: 0xc86d3b,
      roughness: 0.24,
      metalness: 0.78,
    });
    const brassMat = makeMat({
      color: 0xeab308,
      roughness: 0.28,
      metalness: 0.82,
    });
    const ironMat = makeMat({
      color: 0x334155,
      roughness: 0.52,
      metalness: 0.68,
    });
    const brickMat = makeMat({
      color: 0x9a3412,
      roughness: 0.86,
      metalness: 0.05,
    });
    const oakBarrelMat = makeMat({
      color: 0x925c34,
      roughness: 0.78,
      metalness: 0.06,
    });
    const fireEmberMat = makeMat({
      color: 0xff6b00,
      emissive: 0xff4500,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 1. PROCEDURAL WALK-IN BREWERY & DISTILLERY (Fallback while GLB loads)
    //    Open front archway (+Z) with central aisle — NO extra NPCs!
    // ═══════════════════════════════════════════════════════════════════
    const proceduralGroup = new THREE.Group();
    proceduralGroup.name = 'BreweryProceduralFallback';
    root.add(proceduralGroup);

    // Stone floor plinth (flush on ground so player walks smoothly across)
    const plinth = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(6.4, 0.08, 5.8)),
      houseMats.stone
    );
    plinth.position.set(0, 0.04, 0);
    plinth.receiveShadow = true;
    proceduralGroup.add(plinth);

    // Back brick wall & left/right half-timber walls (leaving a wide 2.6m front doorway!)
    const backWall = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(6.0, 3.0, 0.22)),
      houseMats.wood
    );
    backWall.position.set(0, 1.54, -2.6);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    proceduralGroup.add(backWall);

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.22, 3.0, 5.2)),
        houseMats.wood
      );
      sideWall.position.set(side * 2.9, 1.54, 0);
      sideWall.castShadow = true;
      sideWall.receiveShadow = true;
      proceduralGroup.add(sideWall);

      // Front flanking wall piers leaving central 2.6m walk-in doorway open
      const frontPier = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(1.6, 3.0, 0.22)),
        houseMats.woodLight
      );
      frontPier.position.set(side * 2.1, 1.54, 2.55);
      frontPier.castShadow = true;
      frontPier.receiveShadow = true;
      proceduralGroup.add(frontPier);
    }

    // High lintel beam above open walk-in doorway (clearance 2.55m for player)
    const doorHeader = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(2.8, 0.45, 0.28)),
      houseMats.woodDark
    );
    doorHeader.position.set(0, 2.82, 2.55);
    doorHeader.castShadow = true;
    proceduralGroup.add(doorHeader);

    // Signboard barrel crest over entrance
    const signBarrel = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.26, 0.26, 0.56, 12)),
      oakBarrelMat
    );
    signBarrel.rotation.z = Math.PI / 2;
    signBarrel.position.set(0, 3.22, 2.75);
    signBarrel.castShadow = true;
    proceduralGroup.add(signBarrel);

    // Pitched industrial monitor roof
    for (const side of [-1, 1]) {
      const roofSlope = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(3.55, 0.14, 5.8)),
        houseMats.roofRed
      );
      roofSlope.position.set(side * 1.56, 3.55, 0);
      roofSlope.rotation.z = -side * 0.36;
      roofSlope.castShadow = true;
      roofSlope.receiveShadow = true;
      proceduralGroup.add(roofSlope);
    }

    // Tall brick chimney stack at rear-right
    const chimneyBase = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.95, 4.45, 0.95)),
      brickMat
    );
    chimneyBase.position.set(1.85, 2.22, -1.85);
    chimneyBase.castShadow = true;
    proceduralGroup.add(chimneyBase);

    const chimneyCrown = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.36, 0.44, 0.55, 12)),
      ironMat
    );
    chimneyCrown.position.set(1.85, 4.55, -1.85);
    chimneyCrown.castShadow = true;
    proceduralGroup.add(chimneyCrown);

    // Firebox furnace with glowing ember grate (excluded from wall paint)
    const fireGrate = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.65, 0.42, 0.16)),
      fireEmberMat
    );
    fireGrate.position.set(1.85, 0.52, -1.34);
    fireGrate.userData.excludeFromPaint = true;
    proceduralGroup.add(fireGrate);

    // Copper Alembic Distillation Still (Left side of interior hall)
    const copperStillRig = new THREE.Group();
    copperStillRig.position.set(-1.65, 0.08, -0.8);
    copperStillRig.userData.excludeFromPaint = true;
    proceduralGroup.add(copperStillRig);

    const boilerPot = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.72, 0.82, 1.25, 16)),
      copperMat
    );
    boilerPot.position.set(0, 0.62, 0);
    boilerPot.castShadow = true;
    copperStillRig.add(boilerPot);

    const onionDome = new THREE.Mesh(
      regGeo(new THREE.SphereGeometry(0.68, 16, 12)),
      copperMat
    );
    onionDome.position.set(0, 1.38, 0);
    onionDome.scale.set(1, 0.88, 1);
    onionDome.castShadow = true;
    copperStillRig.add(onionDome);

    const swanNeck = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.55, 0.09, 10, 18, Math.PI)),
      brassMat
    );
    swanNeck.position.set(0.55, 1.85, 0);
    swanNeck.castShadow = true;
    copperStillRig.add(swanNeck);

    const condenserTank = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.42, 0.42, 1.35, 14)),
      copperMat
    );
    condenserTank.position.set(1.1, 0.72, 0);
    condenserTank.castShadow = true;
    copperStillRig.add(condenserTank);

    // Oak Fermentation Mash Tun + Moving Agitator & Flywheel (Right-front side)
    const mashTunGroup = new THREE.Group();
    mashTunGroup.position.set(1.65, 0.08, 0.55);
    mashTunGroup.userData.excludeFromPaint = true;
    proceduralGroup.add(mashTunGroup);

    const oakVat = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.78, 0.72, 1.35, 16)),
      oakBarrelMat
    );
    oakVat.position.set(0, 0.68, 0);
    oakVat.castShadow = true;
    mashTunGroup.add(oakVat);

    for (const hoopY of [0.28, 0.68, 1.08]) {
      const hoop = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.76, 0.03, 8, 20)),
        ironMat
      );
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(0, hoopY, 0);
      mashTunGroup.add(hoop);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. KINETIC MOVING MACHINERY RIG (Visible both in fallback & on GLB)
    // ═══════════════════════════════════════════════════════════════════
    const kineticRig = new THREE.Group();
    kineticRig.name = 'BreweryKineticMachinery';
    kineticRig.position.set(1.65, 1.62, 0.55);
    kineticRig.userData.excludeFromPaint = true;
    root.add(kineticRig);

    const flywheel = new THREE.Group();
    const rim = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.42, 0.048, 10, 24)),
      brassMat
    );
    rim.castShadow = true;
    flywheel.add(rim);

    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.8, 6)),
        ironMat
      );
      spoke.rotation.z = (i / 6) * Math.PI;
      flywheel.add(spoke);
    }
    const hub = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12)),
      copperMat
    );
    hub.rotation.x = Math.PI / 2;
    flywheel.add(hub);
    flywheel.position.set(0, 0.22, 0.52);
    kineticRig.add(flywheel);

    // Reciprocating brass mash piston shaft
    const pistonRod = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.85, 10)),
      brassMat
    );
    pistonRod.position.set(0, 0.15, 0);
    kineticRig.add(pistonRod);

    // ═══════════════════════════════════════════════════════════════════
    // 3. GLB MOUNT HOLDER + ANIMATION MIXER
    // ═══════════════════════════════════════════════════════════════════
    const glbHolder = new THREE.Group();
    glbHolder.name = 'BreweryGLBHolder';
    root.add(glbHolder);

    let mixer: THREE.AnimationMixer | null = null;
    let hasGlbMounted = false;

    // ═══════════════════════════════════════════════════════════════════
    // 4. RISING 3D CHIMNEY SMOKE EMITTER (มีควันออกให้เห็นชัดเจน)
    // ═══════════════════════════════════════════════════════════════════
    const smokeGroup = new THREE.Group();
    smokeGroup.name = 'BrewerySmokeStack';
    smokeGroup.userData.excludeFromPaint = true;
    smokeGroup.position.set(1.85, 4.78, -1.85);
    root.add(smokeGroup);

    const sharedPuffGeo = regGeo(new THREE.IcosahedronGeometry(0.32, 1));
    const puffs: SmokePuff[] = [];

    if (enableSmokeAndMotion) {
      for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
        const pMat = makeMat({
          color: i % 2 === 0 ? 0xf8fafc : 0xe2e8f0,
          roughness: 0.95,
          metalness: 0.0,
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(sharedPuffGeo, pMat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.excludeFromPaint = true;
        smokeGroup.add(mesh);

        const lifetime = 2.6 + (i % 4) * 0.35;
        puffs.push({
          mesh,
          mat: pMat,
          age: (i / SMOKE_PUFF_COUNT) * lifetime,
          lifetime,
          driftX: 0.28 + ((i * 7) % 5) * 0.06,
          driftZ: -0.18 + ((i * 3) % 5) * 0.05,
          phase: i * 0.85,
        });
      }
    } else {
      smokeGroup.visible = false;
      kineticRig.visible = false;
    }

    const mountCachedGlb = () => {
      if (isDisposed || hasGlbMounted || !_cachedBreweryScene) return;
      hasGlbMounted = true;

      proceduralGroup.visible = false;
      const cloned = _cachedBreweryScene.clone(true);
      glbHolder.add(cloned);

      // Anchor 3D smoke emitter directly above the loaded beerproductionfactory.glb chimney
      smokeGroup.position.copy(_cachedSmokeAnchor);

      // Position kinetic brass flywheel accent cleanly at the side mechanical housing
      kineticRig.position.set(
        _cachedSmokeAnchor.x * 0.55,
        Math.max(1.15, _cachedSmokeAnchor.y * 0.36),
        1.45
      );

      if (_cachedBreweryClips.length > 0 && enableSmokeAndMotion) {
        mixer = new THREE.AnimationMixer(cloned);
        for (const clip of _cachedBreweryClips) {
          const action = mixer.clipAction(clip);
          action.play();
        }
      }
    };

    if (_cachedBreweryScene) {
      mountCachedGlb();
    } else {
      ensureBreweryGlbCached(false).then((ok) => {
        if (ok) mountCachedGlb();
      });
    }

    const unsubDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (isDisposed || hasGlbMounted) return;
      if (BREWERY_GLB_CANDIDATES.includes(resolvedUrl)) {
        ensureBreweryGlbCached(true).then((ok) => {
          if (ok) mountCachedGlb();
        });
      }
    });

    const update = (dt: number, elapsed: number) => {
      if (!enableSmokeAndMotion || isDisposed) return;

      const speedMul = isActiveBrewing ? 1.85 : 1.0;

      // 1. Advance embedded GLB keyframe animations if present
      if (mixer) {
        mixer.timeScale = speedMul;
        mixer.update(dt);
      }

      // 2. Continuous mechanical motion (เครื่องผลิตขยับได้ชัดเจน)
      flywheel.rotation.z -= dt * 3.4 * speedMul;
      pistonRod.position.y = 0.15 + Math.sin(elapsed * 5.5 * speedMul) * 0.16;

      const chugWave = Math.sin(elapsed * 9.0 * speedMul);
      const chugBounce = Math.abs(chugWave) * (isActiveBrewing ? 0.022 : 0.01);

      if (hasGlbMounted) {
        glbHolder.position.y = chugBounce;
        glbHolder.scale.set(
          1 + chugWave * (isActiveBrewing ? 0.008 : 0.004),
          1 - chugWave * (isActiveBrewing ? 0.01 : 0.005),
          1 + chugWave * (isActiveBrewing ? 0.008 : 0.004)
        );
      } else {
        copperStillRig.scale.set(
          1 + chugWave * 0.018,
          1 - chugWave * 0.022,
          1 + chugWave * 0.018
        );
        fireEmberMat.emissiveIntensity =
          (isActiveBrewing ? 2.1 : 1.2) + Math.sin(elapsed * 11.0) * 0.35;
      }

      // 3. Rising 3D Chimney Smoke Puffs (มีควันออกให้เห็นตลอดเวลา)
      const riseHeight = isActiveBrewing ? 3.4 : 2.35;
      const peakOpacity = isActiveBrewing ? 0.72 : 0.48;

      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        p.age += dt * (isActiveBrewing ? 1.35 : 0.95);
        if (p.age >= p.lifetime) {
          p.age %= p.lifetime;
        }

        const t = p.age / p.lifetime; // 0 -> 1
        const easeOut = 1 - (1 - t) * (1 - t);
        const swirl = Math.sin(elapsed * 2.1 + p.phase) * 0.22 * t;

        p.mesh.position.set(
          p.driftX * t * 1.4 + swirl,
          t * riseHeight,
          p.driftZ * t * 1.4 + Math.cos(elapsed * 1.7 + p.phase) * 0.16 * t
        );

        const puffScale = (isActiveBrewing ? 0.42 : 0.32) + easeOut * (isActiveBrewing ? 1.35 : 0.95);
        p.mesh.scale.setScalar(puffScale);
        p.mesh.rotation.y = elapsed * 0.6 + p.phase;
        p.mesh.rotation.z = t * 1.2;

        // Smooth fade-in then billow fade-out
        const fadeIn = Math.min(1, t / 0.16);
        const fadeOut = Math.pow(1 - t, 1.35);
        p.mat.opacity = peakOpacity * fadeIn * fadeOut;
      }
    };

    const setActive = (active: boolean) => {
      isActiveBrewing = active;
    };

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;
      unsubDiscovery();
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }
      if (hasGlbMounted) {
        disposeHierarchySafely(glbHolder);
      }
      for (const g of ownedGeos) g.dispose();
      for (const m of ownedMats) m.dispose();
    };

    return {
      root,
      setActive,
      update,
      dispose,
    };
  }
}
