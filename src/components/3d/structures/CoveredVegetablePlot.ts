// src/components/3d/structures/CoveredVegetablePlot.ts
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import type { HouseMaterials } from './HouseMeshBuilder';

export const COVERED_VEGETABLE_PLOT_GLB_CANDIDATES: readonly string[] = [
  '/2Vegetable _plot.glb',
  '/2Vegetable%20_plot.glb',
  '/2Vegetable_plot.glb',
  '/2vegetable_plot.glb',
  '/2vegetable _plot.glb',
  '/Vegetable _plot.glb',
  '/Vegetable_plot.glb',
  '/models/2Vegetable _plot.glb',
  '/assets/2Vegetable _plot.glb',
];

/** Twin 2.0x2.0m crop beds sit at local x = -1.0 and x = +1.0 (4.0m x 2.0m inner soil bed) */
const TARGET_COVERED_PLOT_SPAN = 4.45;

export interface CoveredVegetablePlotOptions {
  enableMotion?: boolean;
  onGlbMounted?: () => void;
}

export interface CoveredVegetablePlotResult {
  root: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

interface CachedCoveredPlotGlb {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

let _cachedCoveredPlot: CachedCoveredPlotGlb | null = null;
let _loadingPromise: Promise<boolean> | null = null;

function ensureCoveredPlotGlbCached(bypassCache = false): Promise<boolean> {
  if (_cachedCoveredPlot && !bypassCache) {
    return Promise.resolve(true);
  }
  if (_loadingPromise && !bypassCache) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    for (const candidate of COVERED_VEGETABLE_PLOT_GLB_CANDIDATES) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidate, { bypassCache });
        const raw = gltf.scene;
        optimizeGLTFSceneForDevice(raw, inspection, false);

        const wrapper = new THREE.Group();
        wrapper.name = 'CoveredVegetablePlotGLBBody';
        wrapper.add(raw);
        wrapper.updateMatrixWorld(true);

        const initialBox = new THREE.Box3().setFromObject(wrapper);
        if (!initialBox.isEmpty()) {
          const initialSize = initialBox.getSize(new THREE.Vector3());
          // Align the longer horizontal twin-bed axis with local X (-1.0 and +1.0 crop beds)
          if (initialSize.z > initialSize.x * 1.15) {
            raw.rotation.y = Math.PI / 2;
            wrapper.updateMatrixWorld(true);
          }

          const orientedBox = new THREE.Box3().setFromObject(wrapper);
          const orientedSize = orientedBox.getSize(new THREE.Vector3());
          const maxHoriz = Math.max(orientedSize.x, orientedSize.z, 0.001);
          const scale = TARGET_COVERED_PLOT_SPAN / maxHoriz;
          raw.scale.multiplyScalar(scale);
          wrapper.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(wrapper);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          raw.position.x -= scaledCenter.x;
          raw.position.z -= scaledCenter.z;
          raw.position.y -= scaledBox.min.y;
          wrapper.updateMatrixWorld(true);
        }

        _cachedCoveredPlot = {
          scene: wrapper,
          clips: gltf.animations ?? [],
        };
        _loadingPromise = null;
        return true;
      } catch {
        // Try next candidate or stay on procedural Covered Vegetable Plot fallback
      }
    }
    _loadingPromise = null;
    return false;
  })();

  return _loadingPromise;
}

export class CoveredVegetablePlotBuilder {
  public build(
    materials: HouseMaterials,
    options: CoveredVegetablePlotOptions = {}
  ): CoveredVegetablePlotResult {
    const enableMotion = options.enableMotion ?? true;
    const root = new THREE.Group();
    root.name = 'CoveredVegetablePlot';

    const bodyContainer = new THREE.Group();
    bodyContainer.name = 'CoveredPlotBodyContainer';
    root.add(bodyContainer);

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

    // ─── Procedural Covered Vegetable Plot Canopy (auto-replaced when 2Vegetable _plot.glb is present) ───
    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'CoveredPlotProceduralBody';

    const postWoodMat = materials.woodDark;
    const beamWoodMat = materials.wood;
    const roofGlassMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xbef264,
        emissive: 0x059669,
        emissiveIntensity: 0.08,
        roughness: 0.16,
        metalness: 0.08,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const roofTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2e7d32,
        roughness: 0.55,
        metalness: 0.12,
      })
    );
    const gutterMetalMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.36,
        metalness: 0.72,
      })
    );
    const barrelWoodMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x7c5334,
        roughness: 0.82,
        metalness: 0.06,
      })
    );
    const hoopIronMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.44,
        metalness: 0.68,
      })
    );
    const lanternGlowMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.24,
      })
    );
    const signBoardMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.72,
        metalness: 0.04,
      })
    );
    const carrotMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    const tomatoMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.32 })
    );
    const leafMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 })
    );
    const waterSurfaceMat = regMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.15,
        metalness: 0.18,
      })
    );

    // 1. Outer raised planter frame & 4 corner stone plinths surrounding the 4.0m x 2.0m twin crop beds
    const plinthGeo = regGeo(new THREE.BoxGeometry(0.28, 0.18, 0.28));
    const postGeo = regGeo(new THREE.BoxGeometry(0.14, 1.84, 0.14));
    const postCoords: Array<[number, number]> = [
      [-2.08, -1.06],
      [2.08, -1.06],
      [-2.08, 1.06],
      [2.08, 1.06],
    ];

    for (const [px, pz] of postCoords) {
      const plinth = new THREE.Mesh(plinthGeo, materials.stone);
      plinth.position.set(px, 0.09, pz);
      plinth.receiveShadow = true;
      plinth.userData.housePart = 'floor';
      fallbackGroup.add(plinth);

      const post = new THREE.Mesh(postGeo, postWoodMat);
      post.position.set(px, 1.04, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      post.userData.housePart = 'wall';
      fallbackGroup.add(post);
    }

    // Outer seasoned cedar curb rails framing the 2 beds
    const longCurbGeo = regGeo(new THREE.BoxGeometry(4.02, 0.16, 0.1));
    for (const cz of [-1.06, 1.06]) {
      const curb = new THREE.Mesh(longCurbGeo, beamWoodMat);
      curb.position.set(0, 0.08, cz);
      curb.castShadow = true;
      curb.receiveShadow = true;
      curb.userData.housePart = 'fence';
      fallbackGroup.add(curb);
    }
    const shortCurbGeo = regGeo(new THREE.BoxGeometry(0.1, 0.16, 1.98));
    for (const cx of [-2.08, 2.08]) {
      const curb = new THREE.Mesh(shortCurbGeo, beamWoodMat);
      curb.position.set(cx, 0.08, 0);
      curb.castShadow = true;
      curb.receiveShadow = true;
      curb.userData.housePart = 'fence';
      fallbackGroup.add(curb);
    }

    // 2. Eave plates, cross-tie beams & diagonal knee braces (open on all 4 sides)
    const eaveLongGeo = regGeo(new THREE.BoxGeometry(4.42, 0.12, 0.12));
    for (const ez of [-1.06, 1.06]) {
      const eave = new THREE.Mesh(eaveLongGeo, beamWoodMat);
      eave.position.set(0, 1.92, ez);
      eave.castShadow = true;
      eave.userData.housePart = 'wall';
      fallbackGroup.add(eave);
    }

    const tieShortGeo = regGeo(new THREE.BoxGeometry(0.12, 0.12, 2.28));
    for (const tx of [-2.08, 0, 2.08]) {
      const tie = new THREE.Mesh(tieShortGeo, beamWoodMat);
      tie.position.set(tx, 1.92, 0);
      tie.castShadow = true;
      tie.userData.housePart = 'wall';
      fallbackGroup.add(tie);
    }

    // 8 diagonal knee braces at corner posts
    const braceGeo = regGeo(new THREE.BoxGeometry(0.46, 0.08, 0.08));
    for (const [px, pz] of postCoords) {
      const dirX = px < 0 ? 1 : -1;
      const braceX = new THREE.Mesh(braceGeo, postWoodMat);
      braceX.position.set(px + dirX * 0.2, 1.72, pz);
      braceX.rotation.z = dirX * (Math.PI / 4);
      braceX.userData.housePart = 'wall';
      fallbackGroup.add(braceX);

      const dirZ = pz < 0 ? 1 : -1;
      const braceZ = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.08, 0.08, 0.42)), postWoodMat);
      braceZ.position.set(px, 1.72, pz + dirZ * 0.18);
      braceZ.rotation.x = -dirZ * (Math.PI / 4);
      braceZ.userData.housePart = 'wall';
      fallbackGroup.add(braceZ);
    }

    // 3. Gable timber rafters, king-posts, ridge beam & translucent polycarbonate roof canopy
    const kingPostGeo = regGeo(new THREE.BoxGeometry(0.11, 0.56, 0.11));
    for (const kx of [-2.08, 0, 2.08]) {
      const king = new THREE.Mesh(kingPostGeo, postWoodMat);
      king.position.set(kx, 2.24, 0);
      king.castShadow = true;
      king.userData.housePart = 'roof';
      fallbackGroup.add(king);
    }

    const ridgeBeam = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(4.62, 0.13, 0.13)),
      roofTrimMat
    );
    ridgeBeam.position.set(0, 2.52, 0);
    ridgeBeam.castShadow = true;
    ridgeBeam.userData.housePart = 'roof';
    fallbackGroup.add(ridgeBeam);

    const slopePitch = 0.44; // ~25.2 deg
    const slopeHalfSpanZ = 0.72;
    const slopeMidY = 2.21;
    const rafterLen = 1.54;
    const rafterGeo = regGeo(new THREE.BoxGeometry(0.08, 0.09, rafterLen));

    for (const rx of [-2.08, -1.04, 0, 1.04, 2.08]) {
      const rafFront = new THREE.Mesh(rafterGeo, beamWoodMat);
      rafFront.position.set(rx, slopeMidY, slopeHalfSpanZ);
      rafFront.rotation.x = slopePitch;
      rafFront.castShadow = true;
      rafFront.userData.housePart = 'roof';
      fallbackGroup.add(rafFront);

      const rafBack = new THREE.Mesh(rafterGeo, beamWoodMat);
      rafBack.position.set(rx, slopeMidY, -slopeHalfSpanZ);
      rafBack.rotation.x = -slopePitch;
      rafBack.castShadow = true;
      rafBack.userData.housePart = 'roof';
      fallbackGroup.add(rafBack);
    }

    // Translucent greenhouse roof slopes (front & back)
    const panelGeo = regGeo(new THREE.BoxGeometry(4.54, 0.035, 1.52));
    const panelFront = new THREE.Mesh(panelGeo, roofGlassMat);
    panelFront.position.set(0, slopeMidY + 0.04, slopeHalfSpanZ);
    panelFront.rotation.x = slopePitch;
    panelFront.userData.housePart = 'roof';
    fallbackGroup.add(panelFront);

    const panelBack = new THREE.Mesh(panelGeo, roofGlassMat);
    panelBack.position.set(0, slopeMidY + 0.04, -slopeHalfSpanZ);
    panelBack.rotation.x = -slopePitch;
    panelBack.userData.housePart = 'roof';
    fallbackGroup.add(panelBack);

    // Green Fascia trim strips along front & rear roof eaves
    const fasciaGeo = regGeo(new THREE.BoxGeometry(4.58, 0.09, 0.06));
    for (const fz of [-1.38, 1.38]) {
      const fascia = new THREE.Mesh(fasciaGeo, roofTrimMat);
      fascia.position.set(0, 1.88, fz);
      fascia.userData.housePart = 'roof';
      fallbackGroup.add(fascia);
    }

    // Galvanized rain gutters along eaves + downspout into rainwater barrel
    const gutterGeo = regGeo(new THREE.CylinderGeometry(0.045, 0.045, 4.56, 8));
    gutterGeo.rotateZ(Math.PI / 2);
    for (const gz of [-1.42, 1.42]) {
      const gutter = new THREE.Mesh(gutterGeo, gutterMetalMat);
      gutter.position.set(0, 1.83, gz);
      gutter.userData.housePart = 'chimney';
      fallbackGroup.add(gutter);
    }

    const downPipe = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.032, 0.032, 1.15, 8)),
      gutterMetalMat
    );
    downPipe.position.set(2.24, 1.24, 1.12);
    downPipe.userData.housePart = 'chimney';
    fallbackGroup.add(downPipe);

    // Side rainwater collection barrel for watering crops
    const barrelGroup = new THREE.Group();
    barrelGroup.position.set(2.32, 0, 1.02);
    barrelGroup.userData.excludeFromPaint = true;

    const barrelBody = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.24, 0.21, 0.66, 12)),
      barrelWoodMat
    );
    barrelBody.position.y = 0.33;
    barrelBody.castShadow = true;
    barrelBody.receiveShadow = true;
    barrelGroup.add(barrelBody);

    for (const hy of [0.16, 0.5]) {
      const hoop = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.23, 0.016, 6, 16)),
        hoopIronMat
      );
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      barrelGroup.add(hoop);
    }

    const barrelWater = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 12)),
      waterSurfaceMat
    );
    barrelWater.position.y = 0.65;
    barrelGroup.add(barrelWater);
    fallbackGroup.add(barrelGroup);

    // 4. Hanging Wooden Crop Signboard + Warm Greenhouse Lantern (gentle breeze sway)
    const hangingSignPivot = new THREE.Group();
    hangingSignPivot.position.set(0, 1.92, 1.06);
    hangingSignPivot.userData.excludeFromPaint = true;

    for (const cx of [-0.32, 0.32]) {
      const chain = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6)),
        hoopIronMat
      );
      chain.position.set(cx, -0.08, 0);
      hangingSignPivot.add(chain);
    }

    const signFrame = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.92, 0.3, 0.06)),
      postWoodMat
    );
    signFrame.position.set(0, -0.22, 0);
    signFrame.castShadow = true;
    hangingSignPivot.add(signFrame);

    const signPlate = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(0.82, 0.22, 0.07)),
      signBoardMat
    );
    signPlate.position.set(0, -0.22, 0);
    hangingSignPivot.add(signPlate);

    // Mini 3D vegetable emblems on sign (carrot, tomato, leafy sprout)
    const miniCarrot = new THREE.Mesh(
      regGeo(new THREE.ConeGeometry(0.042, 0.13, 7)),
      carrotMat
    );
    miniCarrot.position.set(-0.23, -0.22, 0.045);
    miniCarrot.rotation.z = Math.PI * 0.82;
    hangingSignPivot.add(miniCarrot);

    const miniTomato = new THREE.Mesh(
      regGeo(new THREE.SphereGeometry(0.05, 8, 8)),
      tomatoMat
    );
    miniTomato.position.set(0, -0.23, 0.045);
    hangingSignPivot.add(miniTomato);

    const miniLeaf = new THREE.Mesh(
      regGeo(new THREE.SphereGeometry(0.048, 8, 8)),
      leafMat
    );
    miniLeaf.scale.set(1.2, 0.75, 0.5);
    miniLeaf.position.set(0.23, -0.22, 0.045);
    hangingSignPivot.add(miniLeaf);

    fallbackGroup.add(hangingSignPivot);

    const lanternPivot = new THREE.Group();
    lanternPivot.position.set(0, 2.45, 0);
    lanternPivot.userData.excludeFromPaint = true;

    const lanternCord = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6)),
      hoopIronMat
    );
    lanternCord.position.y = -0.12;
    lanternPivot.add(lanternCord);

    const lanternCap = new THREE.Mesh(
      regGeo(new THREE.ConeGeometry(0.11, 0.08, 8)),
      hoopIronMat
    );
    lanternCap.position.y = -0.25;
    lanternPivot.add(lanternCap);

    const lanternBulb = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.065, 0.055, 0.14, 8)),
      lanternGlowMat
    );
    lanternBulb.position.y = -0.34;
    lanternPivot.add(lanternBulb);

    fallbackGroup.add(lanternPivot);
    bodyContainer.add(fallbackGroup);

    // ─── GLB Swap State (2Vegetable _plot.glb) ───
    let isDisposed = false;
    let glbInstance: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;

    const mountCachedGlbIfReady = () => {
      if (isDisposed || !_cachedCoveredPlot || glbInstance) return;
      bodyContainer.remove(fallbackGroup);
      glbInstance = _cachedCoveredPlot.scene.clone(true);
      bodyContainer.add(glbInstance);

      if (enableMotion && _cachedCoveredPlot.clips.length > 0) {
        mixer = new THREE.AnimationMixer(glbInstance);
        for (const clip of _cachedCoveredPlot.clips) {
          mixer.clipAction(clip).play();
        }
      }
      options.onGlbMounted?.();
    };

    if (_cachedCoveredPlot) {
      mountCachedGlbIfReady();
    } else {
      void ensureCoveredPlotGlbCached(false).then((loaded) => {
        if (loaded) mountCachedGlbIfReady();
      });
    }

    const unsubscribeDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (isDisposed || glbInstance) return;
      if (COVERED_VEGETABLE_PLOT_GLB_CANDIDATES.includes(resolvedUrl)) {
        void ensureCoveredPlotGlbCached(true).then((loaded) => {
          if (loaded) mountCachedGlbIfReady();
        });
      }
    });

    const update = (dt: number, elapsed: number) => {
      if (isDisposed) return;
      if (mixer && enableMotion) {
        mixer.update(dt);
      }
      if (enableMotion && !glbInstance) {
        hangingSignPivot.rotation.x = Math.sin(elapsed * 1.9) * 0.055;
        lanternPivot.rotation.z = Math.sin(elapsed * 1.45 + 0.7) * 0.045;
      }
    };

    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;
      unsubscribeDiscovery();
      if (mixer && glbInstance) {
        mixer.stopAllAction();
        mixer.uncacheRoot(glbInstance);
        mixer = null;
      }
      if (glbInstance) {
        bodyContainer.remove(glbInstance);
        disposeHierarchySafely(glbInstance);
        glbInstance = null;
      }
      for (const g of localGeos) g.dispose();
      for (const m of localMats) m.dispose();
      localGeos.length = 0;
      localMats.length = 0;
    };

    return {
      root,
      update,
      dispose,
    };
  }
}
