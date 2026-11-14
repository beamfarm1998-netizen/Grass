// src/components/3d/FarmCrops.ts
import * as THREE from 'three';
import { FarmPlot, CropType } from '../../types/game';
import { createSoilTexture } from '../../utils/textures';

/**
 * FarmCrops3D
 * High-fidelity, organic agricultural plots with furrowed loam mounds,
 * rustic split-log borders, micro-elevation, and anatomically detailed botanical 3D plants.
 *
 * ── Fixes applied ──
 *  #1 Pumpkin lobes rotate full 360° (was 150° → half-squashed fruit)
 *  #2 growthProgress NaN/undefined guard (was → invisible crops)
 *  #3 Selection marker cleared when selected plot is removed
 *  #4 setSelectedPlot() hides marker when target plot doesn't exist yet
 *  #5 Added dispose() to release geometries, materials, and soil textures
 *  #8 Ready badge replaced: diamond → billboarded crop-icon sprite
 *
 * ── v2 Soil PBR overhaul ──
 *  • color: 0xffffff on textured mats   → no double-darkening
 *  • metalness: 0 everywhere            → soil & water are dielectrics
 *  • WET uses MeshPhysicalMaterial.clearcoat instead of metalness hack
 *  • bumpMap reuses albedo canvas       → free micro-relief
 *  • dispose() releases every texture slot (map/bump/normal/clearcoat*)
 *
 * ── v3 Ready Badge overhaul ──
 *  • Billboarding sprite (always faces camera), no more spinning diamond
 *  • Renders above foliage/cobs (depthTest:false + renderOrder:10)
 *
 * ── v4 Ready Badge = crop icon ──
 *  • Emoji icon on rounded plaque (was text-only pill)
 *
 * ── v5 Ready Badge = bare emoji ──
 *  • Removed black background + gold border — icon floats alone
 *  • Emoji rendered at 100px on 128×128 canvas
 *  • Sprite scale 0.55 (icon ~0.43 world units on screen)
 */

export class FarmCrops3D {
  public group: THREE.Group;
  public interactiveMeshes: THREE.Mesh[] = [];
  private plotMeshes: Map<number, THREE.Group> = new Map();
  private soilBedMeshes: Map<number, THREE.Mesh> = new Map();
  private plotBorderParts: Map<
    number,
    {
      lNorth: THREE.Mesh;
      lSouth: THREE.Mesh;
      lEast: THREE.Mesh;
      lWest: THREE.Mesh;
      postNE: THREE.Mesh;
      postNW: THREE.Mesh;
      postSE: THREE.Mesh;
      postSW: THREE.Mesh;
      bridgeNorth: THREE.Mesh;
      bridgeEast: THREE.Mesh;
      bridgeNE: THREE.Mesh;
    }
  > = new Map();
  private plotHitMeshes: Map<number, THREE.Mesh> = new Map();
  private cropModels: Map<number, THREE.Group> = new Map();

  private plotStageKeys: Map<number, string> = new Map();

  private selectedPlotId: number | null = null;
  private selectionMarker: THREE.Group;
  private selectionMarkerMat: THREE.LineBasicMaterial;
  private selectionPlaneMat: THREE.MeshBasicMaterial;

  private soilDryMat: THREE.MeshStandardMaterial;
  private soilWateredMat: THREE.MeshPhysicalMaterial;
  private emptySoilMat: THREE.MeshStandardMaterial;

  private sproutMat: THREE.MeshStandardMaterial;
  private wheatStemMat: THREE.MeshStandardMaterial;
  private wheatHeadMat: THREE.MeshStandardMaterial;
  private barleyStemMat: THREE.MeshStandardMaterial;
  private barleyHeadMat: THREE.MeshStandardMaterial;
  private barleyAwnMat: THREE.MeshStandardMaterial;
  private soybeanPodMat: THREE.MeshStandardMaterial;
  private soybeanRipeMat: THREE.MeshStandardMaterial;
  private cornStalkMat: THREE.MeshStandardMaterial;
  private cornCobMat: THREE.MeshStandardMaterial;
  private cornSilkMat: THREE.MeshStandardMaterial;
  private carrotOrangeMat: THREE.MeshStandardMaterial;
  private carrotFrondMat: THREE.MeshStandardMaterial;
  private tomatoMat: THREE.MeshStandardMaterial;
  private tomatoVineMat: THREE.MeshStandardMaterial;
  private pumpkinMat: THREE.MeshStandardMaterial;
  private pumpkinStemMat: THREE.MeshStandardMaterial;
  private strawberryMat: THREE.MeshStandardMaterial;
  private flowerPetalMat: THREE.MeshStandardMaterial;
  private leafGreenMat: THREE.MeshStandardMaterial;
  private darkLeafMat: THREE.MeshStandardMaterial;
  private woodLogMat: THREE.MeshStandardMaterial;

  private hitBoxMaterial: THREE.MeshBasicMaterial;

  private sharedMoundGeo: THREE.BufferGeometry;
  private sharedBridgeGeoNS: THREE.BufferGeometry;
  private sharedBridgeGeoEW: THREE.BufferGeometry;
  private sharedBridgeGeoCorner: THREE.BufferGeometry;
  private sharedLogGeoNS: THREE.BufferGeometry;
  private sharedLogGeoEW: THREE.BufferGeometry;
  private sharedPostGeo: THREE.BufferGeometry;
  private sharedClodGeo: THREE.BufferGeometry;
  private sharedHitGeo: THREE.BufferGeometry;

  private sharedMaterials: Set<THREE.Material> = new Set();
  private sharedGeometries: Set<THREE.BufferGeometry> = new Set();

  // 👇 สำหรับทำ anisotropy ของ CanvasTexture ของ badge
  private renderer?: THREE.WebGLRenderer;

  // 👇 ตัวแปลงชื่อพืช → ข้อความ (backward compat, ไม่ใช้ใน badge แล้ว)
  private cropLabelResolver: (cropType: CropType) => string = (t) =>
    t.charAt(0).toUpperCase() + t.slice(1);

  // 👇 ตัวแปลงพืช → emoji (หรือสตริงที่ผู้เล่นอยากใช้แทน)
  private cropIconResolver: (cropType: CropType) => string = (t) => {
    const map: Record<CropType, string> = {
      wheat: '🌾',
      barley: '🌾',
      corn: '🌽',
      carrot: '🥕',
      soybean: '🌱',
      tomato: '🍅',
      pumpkin: '🎃',
      strawberry: '🍓',
    };
    return map[t] ?? '🌱';
  };

  constructor(renderer?: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'FarmCrops';

    const dryTex = createSoilTexture(false, renderer);
    const wetTex = createSoilTexture(true, renderer);

    // ═══════════════════════════════════════════════════════════════════
    //  SOIL — Three-state PBR material system
    // ═══════════════════════════════════════════════════════════════════

    // ── EMPTY — bare unplowed ground ─────────────────────────────────
    this.emptySoilMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a68,
      roughness: 0.97,
      metalness: 0.0,
    });

    // ── DRY — tilled, not yet watered ────────────────────────────────
    this.soilDryMat = new THREE.MeshStandardMaterial({
      map: dryTex,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.0,
      bumpMap: dryTex,
      bumpScale: 0.035,
    });

    // ── WET — freshly watered ────────────────────────────────────────
    this.soilWateredMat = new THREE.MeshPhysicalMaterial({
      map: wetTex,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.35,
      bumpMap: wetTex,
      bumpScale: 0.025,
    });

    this.sproutMat = new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0x8bc34a });
    this.wheatStemMat = new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0xd4c27a });
    this.wheatHeadMat = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xf39c12 });
    this.barleyStemMat = new THREE.MeshStandardMaterial({ roughness: 0.68, color: 0xc8a951 });
    this.barleyHeadMat = new THREE.MeshStandardMaterial({ roughness: 0.44, color: 0xd99b26 });
    this.barleyAwnMat = new THREE.MeshStandardMaterial({ roughness: 0.55, color: 0xfde68a });
    this.soybeanPodMat = new THREE.MeshStandardMaterial({ roughness: 0.52, color: 0x9ccc65 });
    this.soybeanRipeMat = new THREE.MeshStandardMaterial({ roughness: 0.48, color: 0xd4b45c });
    this.cornStalkMat = new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0x558b2f });
    this.cornCobMat = new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xffd54f });
    this.cornSilkMat = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xffecb3 });
    this.carrotOrangeMat = new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xf4511e });
    this.carrotFrondMat = new THREE.MeshStandardMaterial({ roughness: 0.8, color: 0x2e7d32 });
    this.tomatoMat = new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.08, color: 0xe53935 });
    this.tomatoVineMat = new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0x33691e });
    this.pumpkinMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.05, color: 0xef6c00 });
    this.pumpkinStemMat = new THREE.MeshStandardMaterial({ roughness: 0.9, color: 0x5d4037 });
    this.strawberryMat = new THREE.MeshStandardMaterial({ roughness: 0.25, color: 0xd81b60 });
    this.flowerPetalMat = new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xffffff });
    this.leafGreenMat = new THREE.MeshStandardMaterial({ roughness: 0.65, color: 0x43a047 });
    this.darkLeafMat = new THREE.MeshStandardMaterial({ roughness: 0.75, color: 0x1b5e20 });
    this.woodLogMat = new THREE.MeshStandardMaterial({ roughness: 0.92, color: 0x5d4037 });

    // Selection highlight marker
    this.selectionMarker = new THREE.Group();
    this.selectionMarker.name = 'PlotSelectionMarker';
    this.selectionMarker.visible = false;

    this.selectionPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.96), this.selectionPlaneMat);
    sPlane.rotation.x = -Math.PI / 2;
    sPlane.position.y = 0.04;
    this.selectionMarker.add(sPlane);

    this.selectionMarkerMat = new THREE.LineBasicMaterial({
      color: 0xfbbf24,
      linewidth: 2,
      depthWrite: false,
    });
    const bGeo = new THREE.BufferGeometry();
    const half = 0.98;
    const cl = 0.42;
    const bPts = [
      -half, 0.05, -half, -half + cl, 0.05, -half,
      -half, 0.05, -half, -half, 0.05, -half + cl,
      half, 0.05, -half, half - cl, 0.05, -half,
      half, 0.05, -half, half, 0.05, -half + cl,
      -half, 0.05, half, -half + cl, 0.05, half,
      -half, 0.05, half, -half, 0.05, half - cl,
      half, 0.05, half, half - cl, 0.05, half,
      half, 0.05, half, half, 0.05, half - cl,
    ];
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPts, 3));
    this.selectionMarker.add(new THREE.LineSegments(bGeo, this.selectionMarkerMat));
    this.group.add(this.selectionMarker);

    const shared: THREE.Material[] = [
      this.emptySoilMat,
      this.soilDryMat,
      this.soilWateredMat,
      this.sproutMat,
      this.wheatStemMat,
      this.wheatHeadMat,
      this.barleyStemMat,
      this.barleyHeadMat,
      this.barleyAwnMat,
      this.soybeanPodMat,
      this.soybeanRipeMat,
      this.cornStalkMat,
      this.cornCobMat,
      this.cornSilkMat,
      this.carrotOrangeMat,
      this.carrotFrondMat,
      this.tomatoMat,
      this.tomatoVineMat,
      this.pumpkinMat,
      this.pumpkinStemMat,
      this.strawberryMat,
      this.flowerPetalMat,
      this.leafGreenMat,
      this.darkLeafMat,
      this.woodLogMat,
    ];
    for (const m of shared) this.sharedMaterials.add(m);

    this.hitBoxMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.sharedMaterials.add(this.hitBoxMaterial);

    this.sharedMoundGeo = this.createFurrowMoundGeometry();
    this.sharedBridgeGeoNS = this.createSeamBridgeGeometry(1.96, 0.28, 'ns');
    this.sharedBridgeGeoEW = this.createSeamBridgeGeometry(0.28, 1.96, 'ew');
    this.sharedBridgeGeoCorner = this.createSeamBridgeGeometry(0.28, 0.28, 'corner');
    this.sharedLogGeoNS = new THREE.CylinderGeometry(0.055, 0.06, 2.02, 8);
    this.sharedLogGeoNS.rotateZ(Math.PI / 2);
    this.sharedLogGeoEW = new THREE.CylinderGeometry(0.055, 0.06, 2.02, 8);
    this.sharedLogGeoEW.rotateX(Math.PI / 2);
    this.sharedPostGeo = new THREE.CylinderGeometry(0.068, 0.075, 0.16, 8);
    this.sharedClodGeo = new THREE.DodecahedronGeometry(0.036, 0);
    this.sharedHitGeo = new THREE.BoxGeometry(1.88, 0.78, 1.88);

    for (const g of [
      this.sharedMoundGeo,
      this.sharedBridgeGeoNS,
      this.sharedBridgeGeoEW,
      this.sharedBridgeGeoCorner,
      this.sharedLogGeoNS,
      this.sharedLogGeoEW,
      this.sharedPostGeo,
      this.sharedClodGeo,
      this.sharedHitGeo,
    ]) {
      this.sharedGeometries.add(g);
    }
  }

  // ✅ FIX #4: hide marker when the target plot does not exist yet.
  public setSelectedPlot(id: number | null) {
    this.selectedPlotId = id;
    if (id === null) {
      this.selectionMarker.visible = false;
      return;
    }
    const targetGroup = this.plotMeshes.get(id);
    if (targetGroup) {
      this.selectionMarker.position.set(targetGroup.position.x, 0, targetGroup.position.z);
      this.selectionMarker.visible = true;
    } else {
      this.selectionMarker.visible = false;
    }
  }

  /**
   * (Backward compat) ต่อกับระบบ i18n ของเกม
   *   farm.setCropLabelResolver(crop => t(`crops.${crop}`));
   *
   * หมายเหตุ: v5 badge ใช้ไอคอน emoji แทนข้อความแล้ว — setter นี้ยังอยู่
   * แต่ไม่มีผลกับ badge ปัจจุบัน (เก็บไว้เผื่อโค้ดเดิมเรียกอยู่)
   */
  public setCropLabelResolver(fn: (cropType: CropType) => string) {
    this.cropLabelResolver = fn;
  }

  /**
   * ต่อกับระบบ icon ของเกม เช่น
   *   farm.setCropIconResolver(crop => CROP_ICONS[crop]);
   *
   * ค่าเริ่มต้นใช้ emoji ในตัว แต่ override ได้ถ้าต้องการใช้สไปรท์/ตัวอักษรอื่น
   */
  public setCropIconResolver(fn: (cropType: CropType) => string) {
    this.cropIconResolver = fn;
  }

  private createFurrowMoundGeometry(): THREE.BufferGeometry {
    const size = 1.96;
    const segments = 16;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const nx = x / (size / 2);
      const nz = z / (size / 2);

      const borderFalloff = Math.max(0, 1 - Math.pow(nx, 8)) * Math.max(0, 1 - Math.pow(nz, 8));
      const ridgePattern = Math.pow(Math.cos((x / size) * Math.PI * 4), 2);
      const microNoise = Math.sin(x * 12.0) * Math.cos(z * 12.0) * 0.012;

      const baseRim = 0.032 * (0.45 + 0.55 * borderFalloff);
      const height = baseRim + (0.04 + ridgePattern * 0.082 + microNoise) * borderFalloff;
      pos.setY(i, height);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private createSeamBridgeGeometry(
    width: number,
    depth: number,
    kind: 'ns' | 'ew' | 'corner'
  ): THREE.BufferGeometry {
    const segX = kind === 'ns' ? 12 : 4;
    const segZ = kind === 'ew' ? 12 : 4;
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ux = width > 0 ? Math.abs(x) / (width / 2) : 0;
      const uz = depth > 0 ? Math.abs(z) / (depth / 2) : 0;

      let taper = 1;
      if (kind === 'ns') {
        taper = Math.max(0, 1 - Math.pow(uz, 2)) * Math.max(0, 1 - Math.pow(ux, 10));
      } else if (kind === 'ew') {
        taper = Math.max(0, 1 - Math.pow(ux, 2)) * Math.max(0, 1 - Math.pow(uz, 10));
      } else {
        taper = Math.max(0, 1 - Math.pow(ux, 2)) * Math.max(0, 1 - Math.pow(uz, 2));
      }

      const furrow = kind === 'ns' ? Math.pow(Math.cos((x / 1.96) * Math.PI * 4), 2) * 0.018 : 0;
      pos.setY(i, 0.016 + (0.042 + furrow) * taper);
    }

    geo.computeVertexNormals();
    return geo;
  }

  private static isNeighborAtOffset(
    plot: FarmPlot,
    plots: FarmPlot[],
    dxTarget: number,
    dzTarget: number
  ): boolean {
    const tx = plot.worldX + dxTarget;
    const tz = plot.worldZ + dzTarget;
    for (let i = 0; i < plots.length; i++) {
      const other = plots[i];
      if (other.id === plot.id) continue;
      if (Math.abs(other.worldX - tx) <= 0.18 && Math.abs(other.worldZ - tz) <= 0.18) {
        return true;
      }
    }
    return false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Plot lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  public updatePlots(plots: FarmPlot[]) {
    const activeIds = new Set<number>();
    let interactiveDirty = false;

    for (const plot of plots) {
      activeIds.add(plot.id);

      let plotGroup = this.plotMeshes.get(plot.id);

      const bedMat =
        plot.status === 'EMPTY'
          ? this.emptySoilMat
          : plot.isWatered
          ? this.soilWateredMat
          : this.soilDryMat;

      if (!plotGroup) {
        plotGroup = new THREE.Group();
        plotGroup.name = `Plot_${plot.id}`;
        plotGroup.position.set(plot.worldX, 0, plot.worldZ);
        plotGroup.rotation.y = plot.rotY ?? 0;

        const moundMesh = new THREE.Mesh(this.sharedMoundGeo, bedMat);
        moundMesh.receiveShadow = true;
        moundMesh.castShadow = false;
        moundMesh.name = `SoilBed_${plot.id}`;
        plotGroup.add(moundMesh);
        this.soilBedMeshes.set(plot.id, moundMesh);

        const bridgeNorth = new THREE.Mesh(this.sharedBridgeGeoNS, bedMat);
        bridgeNorth.position.set(0, 0, 1.0);
        bridgeNorth.receiveShadow = true;
        bridgeNorth.visible = false;
        plotGroup.add(bridgeNorth);

        const bridgeEast = new THREE.Mesh(this.sharedBridgeGeoEW, bedMat);
        bridgeEast.position.set(1.0, 0, 0);
        bridgeEast.receiveShadow = true;
        bridgeEast.visible = false;
        plotGroup.add(bridgeEast);

        const bridgeNE = new THREE.Mesh(this.sharedBridgeGeoCorner, bedMat);
        bridgeNE.position.set(1.0, 0, 1.0);
        bridgeNE.receiveShadow = true;
        bridgeNE.visible = false;
        plotGroup.add(bridgeNE);

        const logOffset = 0.965;
        const lNorth = new THREE.Mesh(this.sharedLogGeoNS, this.woodLogMat);
        lNorth.position.set(0, 0.052, logOffset);
        lNorth.castShadow = true;
        plotGroup.add(lNorth);

        const lSouth = new THREE.Mesh(this.sharedLogGeoNS, this.woodLogMat);
        lSouth.position.set(0, 0.052, -logOffset);
        lSouth.castShadow = true;
        plotGroup.add(lSouth);

        const lEast = new THREE.Mesh(this.sharedLogGeoEW, this.woodLogMat);
        lEast.position.set(logOffset, 0.052, 0);
        lEast.castShadow = true;
        plotGroup.add(lEast);

        const lWest = new THREE.Mesh(this.sharedLogGeoEW, this.woodLogMat);
        lWest.position.set(-logOffset, 0.052, 0);
        lWest.castShadow = true;
        plotGroup.add(lWest);

        const postNE = new THREE.Mesh(this.sharedPostGeo, this.woodLogMat);
        postNE.position.set(logOffset, 0.075, logOffset);
        postNE.castShadow = true;
        plotGroup.add(postNE);

        const postNW = new THREE.Mesh(this.sharedPostGeo, this.woodLogMat);
        postNW.position.set(-logOffset, 0.075, logOffset);
        postNW.castShadow = true;
        plotGroup.add(postNW);

        const postSE = new THREE.Mesh(this.sharedPostGeo, this.woodLogMat);
        postSE.position.set(logOffset, 0.075, -logOffset);
        postSE.castShadow = true;
        plotGroup.add(postSE);

        const postSW = new THREE.Mesh(this.sharedPostGeo, this.woodLogMat);
        postSW.position.set(-logOffset, 0.075, -logOffset);
        postSW.castShadow = true;
        plotGroup.add(postSW);

        this.plotBorderParts.set(plot.id, {
          lNorth,
          lSouth,
          lEast,
          lWest,
          postNE,
          postNW,
          postSE,
          postSW,
          bridgeNorth,
          bridgeEast,
          bridgeNE,
        });

        for (let c = 0; c < 5; c++) {
          const clod = new THREE.Mesh(this.sharedClodGeo, this.soilDryMat);
          clod.position.set(
            (Math.random() - 0.5) * 1.45,
            0.12,
            (Math.random() - 0.5) * 1.45
          );
          clod.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          clod.scale.set(1 + Math.random() * 0.45, 0.7, 1 + Math.random() * 0.45);
          plotGroup.add(clod);
        }

        const hitMesh = new THREE.Mesh(this.sharedHitGeo, this.hitBoxMaterial);
        hitMesh.position.set(0, 0.4, 0);
        hitMesh.userData = { plotId: plot.id, isPlot: true };
        plotGroup.add(hitMesh);
        this.plotHitMeshes.set(plot.id, hitMesh);

        this.plotMeshes.set(plot.id, plotGroup);
        this.group.add(plotGroup);
        interactiveDirty = true;
      } else {
        plotGroup.position.set(plot.worldX, 0, plot.worldZ);
        plotGroup.rotation.y = plot.rotY ?? 0;
      }

      if (this.selectedPlotId === plot.id) {
        this.selectionMarker.position.set(plot.worldX, 0, plot.worldZ);
        this.selectionMarker.rotation.y = plot.rotY ?? 0;
        this.selectionMarker.visible = true;
      }

      const soilBed = this.soilBedMeshes.get(plot.id);
      if (soilBed && soilBed.material !== bedMat) {
        soilBed.material = bedMat;
      }

      const borderParts = this.plotBorderParts.get(plot.id);
      if (borderParts) {
        const isCoveredTwin = Boolean(plot.coveredByHouseId);
        const hasNorth = isCoveredTwin
          ? false
          : FarmCrops3D.isNeighborAtOffset(plot, plots, 0, 2.0);
        const hasSouth = isCoveredTwin
          ? false
          : FarmCrops3D.isNeighborAtOffset(plot, plots, 0, -2.0);
        const hasEast = isCoveredTwin
          ? plot.coveredSlot === 0
          : FarmCrops3D.isNeighborAtOffset(plot, plots, 2.0, 0);
        const hasWest = isCoveredTwin
          ? plot.coveredSlot === 1
          : FarmCrops3D.isNeighborAtOffset(plot, plots, -2.0, 0);
        const hasNE =
          !isCoveredTwin &&
          hasNorth &&
          hasEast &&
          FarmCrops3D.isNeighborAtOffset(plot, plots, 2.0, 2.0);

        borderParts.lNorth.visible = !hasNorth;
        borderParts.lSouth.visible = !hasSouth;
        borderParts.lEast.visible = !hasEast;
        borderParts.lWest.visible = !hasWest;

        borderParts.postNE.visible = !hasNorth && !hasEast;
        borderParts.postNW.visible = !hasNorth && !hasWest;
        borderParts.postSE.visible = !hasSouth && !hasEast;
        borderParts.postSW.visible = !hasSouth && !hasWest;

        borderParts.bridgeNorth.visible = hasNorth;
        borderParts.bridgeEast.visible = hasEast;
        borderParts.bridgeNE.visible = hasNE;

        if (borderParts.bridgeNorth.material !== bedMat) {
          borderParts.bridgeNorth.material = bedMat;
        }
        if (borderParts.bridgeEast.material !== bedMat) {
          borderParts.bridgeEast.material = bedMat;
        }
        if (borderParts.bridgeNE.material !== bedMat) {
          borderParts.bridgeNE.material = bedMat;
        }
      }

      this.updateCropModel(plotGroup, plot);
    }

    const removedIds: number[] = [];
    this.plotMeshes.forEach((_, id) => {
      if (!activeIds.has(id)) removedIds.push(id);
    });

    for (const id of removedIds) {
      const plotGroup = this.plotMeshes.get(id);
      if (plotGroup) {
        this.group.remove(plotGroup);
        this.disposePlotGroup(plotGroup);
        this.plotMeshes.delete(id);
      }
      this.soilBedMeshes.delete(id);
      this.plotBorderParts.delete(id);
      this.plotHitMeshes.delete(id);
      this.cropModels.delete(id);
      this.plotStageKeys.delete(id);
      interactiveDirty = true;

      if (this.selectedPlotId === id) {
        this.selectedPlotId = null;
        this.selectionMarker.visible = false;
      }
    }

    if (interactiveDirty) {
      this.interactiveMeshes = Array.from(this.plotHitMeshes.values());
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Crop lifecycle
  // ───────────────────────────────────────────────────────────────────────────

  private updateCropModel(plotGroup: THREE.Group, plot: FarmPlot) {
    let cropContainer = this.cropModels.get(plot.id);

    if (plot.status === 'EMPTY' || plot.status === 'PLOWED' || !plot.cropType) {
      if (cropContainer) {
        plotGroup.remove(cropContainer);
        this.disposeCropContainer(cropContainer);
        this.cropModels.delete(plot.id);
        this.plotStageKeys.delete(plot.id);
      }
      return;
    }

    const rawProgress =
      typeof plot.growthProgress === 'number' && Number.isFinite(plot.growthProgress)
        ? plot.growthProgress
        : 0;
    const progress = Math.max(0.05, Math.min(1.0, rawProgress));
    const smoothScale = progress * progress * (3 - 2 * progress);

    const stageKey = `${plot.status}_${plot.cropType}`;
    const lastStageKey = this.plotStageKeys.get(plot.id);

    if (cropContainer && lastStageKey === stageKey) {
      this.applyGrowthScale(cropContainer, plot.status, smoothScale);
      return;
    }

    if (cropContainer) {
      plotGroup.remove(cropContainer);
      this.disposeCropContainer(cropContainer);
      this.cropModels.delete(plot.id);
    }

    cropContainer = new THREE.Group();
    cropContainer.name = `Crop_${plot.id}`;
    cropContainer.position.y = plot.coveredByHouseId ? 0.035 : 0;
    plotGroup.add(cropContainer);
    this.cropModels.set(plot.id, cropContainer);
    this.plotStageKeys.set(plot.id, stageKey);

    if (plot.status === 'PLANTED') {
      this.buildSprouts(cropContainer, 1.0);
    } else if (plot.status === 'GROWING') {
      this.buildGrowingCrop(cropContainer, plot.cropType, 1.0);
    } else if (plot.status === 'READY') {
      this.buildMatureCrop(cropContainer, plot.cropType);
      this.addReadyIndicator(cropContainer, plot.cropType);
    }

    this.applyGrowthScale(cropContainer, plot.status, smoothScale);
  }

  private applyGrowthScale(
    container: THREE.Group,
    status: string,
    smoothScale: number
  ) {
    let factor: number;
    if (status === 'PLANTED') {
      factor = Math.max(0.2, smoothScale);
    } else if (status === 'GROWING') {
      factor = Math.max(0.4, smoothScale);
    } else {
      factor = 1.0;
    }

    for (const child of container.children) {
      if (child.name === 'ReadyBadge') continue;
      child.scale.setScalar(factor);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Crop builders
  // ───────────────────────────────────────────────────────────────────────────

  private buildSprouts(container: THREE.Group, scaleFactor: number) {
    const sproutPoints = [
      { x: -0.5, z: -0.4 },
      { x: 0.5, z: -0.4 },
      { x: 0, z: 0 },
      { x: -0.5, z: 0.4 },
      { x: 0.5, z: 0.4 },
    ];

    sproutPoints.forEach((pt) => {
      const g = new THREE.Group();
      g.position.set(pt.x, 0.12, pt.z);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), this.sproutMat);
      stem.position.set(0, 0.08, 0);
      g.add(stem);

      const leafGeo = new THREE.BoxGeometry(0.09, 0.015, 0.05);
      const l1 = new THREE.Mesh(leafGeo, this.sproutMat);
      l1.position.set(0.04, 0.16, 0);
      l1.rotation.z = -0.4;
      const l2 = l1.clone();
      l2.position.set(-0.04, 0.16, 0);
      l2.rotation.z = 0.4;
      g.add(l1, l2);

      g.scale.setScalar(Math.max(0.2, scaleFactor));
      container.add(g);
    });
  }

  private buildGrowingCrop(container: THREE.Group, type: CropType, scaleFactor: number) {
    const midGroup = new THREE.Group();
    switch (type) {
      case 'wheat': this.buildWheat(midGroup, 0.65); break;
      case 'barley': this.buildBarley(midGroup, 0.65); break;
      case 'corn': this.buildCorn(midGroup, 0.6); break;
      case 'carrot': this.buildCarrot(midGroup, 0.7); break;
      case 'soybean': this.buildSoybean(midGroup, 0.68, false); break;
      case 'tomato': this.buildTomato(midGroup, 0.65); break;
      case 'pumpkin': this.buildPumpkin(midGroup, 0.6); break;
      case 'strawberry': this.buildStrawberry(midGroup, 0.7); break;
    }
    midGroup.scale.setScalar(Math.max(0.4, scaleFactor));
    container.add(midGroup);
  }

  private buildMatureCrop(container: THREE.Group, type: CropType) {
    switch (type) {
      case 'wheat': this.buildWheat(container, 1.0); break;
      case 'barley': this.buildBarley(container, 1.0); break;
      case 'corn': this.buildCorn(container, 1.0); break;
      case 'carrot': this.buildCarrot(container, 1.0); break;
      case 'soybean': this.buildSoybean(container, 1.0, true); break;
      case 'tomato': this.buildTomato(container, 1.0); break;
      case 'pumpkin': this.buildPumpkin(container, 1.0); break;
      case 'strawberry': this.buildStrawberry(container, 1.0); break;
    }
  }

  private buildWheat(container: THREE.Group, scale: number) {
    const clusterPositions = [
      { x: -0.5, z: -0.4 },
      { x: 0.5, z: -0.4 },
      { x: 0, z: 0 },
      { x: -0.5, z: 0.4 },
      { x: 0.5, z: 0.4 },
    ];

    clusterPositions.forEach((pos, idx) => {
      const g = new THREE.Group();
      g.position.set(pos.x, 0.12, pos.z);

      for (let s = 0; s < 4; s++) {
        const stalkAngle = (s / 4) * Math.PI * 2 + idx * 0.3;
        const stalkTilt = 0.08 + (s % 2) * 0.06;

        const stalk = new THREE.Group();
        stalk.rotation.y = stalkAngle;
        stalk.rotation.z = stalkTilt;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.025, 0.95 * scale, 6),
          this.wheatStemMat
        );
        stem.position.set(0, 0.47 * scale, 0);
        stem.castShadow = true;
        stalk.add(stem);

        const ear = new THREE.Mesh(
          new THREE.ConeGeometry(0.055 * scale, 0.38 * scale, 8),
          this.wheatHeadMat
        );
        ear.position.set(0, 0.96 * scale, 0);
        ear.castShadow = true;
        stalk.add(ear);

        for (let a = 0; a < 3; a++) {
          const awn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.22 * scale, 4),
            this.wheatHeadMat
          );
          awn.position.set(0, 1.1 * scale, 0);
          awn.rotation.z = (a - 1) * 0.35;
          stalk.add(awn);
        }

        g.add(stalk);
      }

      container.add(g);
    });
  }

  private buildBarley(container: THREE.Group, scale: number) {
    const clusterPositions = [
      { x: -0.48, z: -0.42 },
      { x: 0.48, z: -0.42 },
      { x: 0, z: 0 },
      { x: -0.48, z: 0.42 },
      { x: 0.48, z: 0.42 },
    ];

    clusterPositions.forEach((pos, idx) => {
      const g = new THREE.Group();
      g.position.set(pos.x, 0.12, pos.z);

      for (let s = 0; s < 5; s++) {
        const stalkAngle = (s / 5) * Math.PI * 2 + idx * 0.42;
        const stalkTilt = 0.16 + (s % 2) * 0.08;

        const stalk = new THREE.Group();
        stalk.rotation.y = stalkAngle;
        stalk.rotation.z = stalkTilt;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.024, 0.88 * scale, 6),
          this.barleyStemMat
        );
        stem.position.set(0, 0.44 * scale, 0);
        stem.castShadow = true;
        stalk.add(stem);

        const spikeGroup = new THREE.Group();
        spikeGroup.position.set(0, 0.86 * scale, 0);
        spikeGroup.rotation.z = 0.28;

        for (let k = 0; k < 5; k++) {
          const side = k % 2 === 0 ? 1 : -1;
          const kernel = new THREE.Mesh(
            new THREE.SphereGeometry(0.036 * scale, 6, 6),
            this.barleyHeadMat
          );
          kernel.scale.set(0.85, 1.65, 0.75);
          kernel.position.set(side * 0.02 * scale, k * 0.062 * scale, 0);
          kernel.rotation.z = -side * 0.22;
          kernel.castShadow = true;
          spikeGroup.add(kernel);
        }

        for (let a = 0; a < 5; a++) {
          const awn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.006, 0.36 * scale, 4),
            this.barleyAwnMat
          );
          awn.position.set((a - 2) * 0.012 * scale, 0.38 * scale, 0);
          awn.rotation.z = (a - 2) * 0.14;
          spikeGroup.add(awn);
        }

        stalk.add(spikeGroup);
        g.add(stalk);
      }

      container.add(g);
    });
  }

  private buildSoybean(container: THREE.Group, scale: number, ripe: boolean) {
    const bushes = [
      { x: -0.42, z: -0.34 },
      { x: 0.42, z: -0.34 },
      { x: 0, z: 0.05 },
      { x: -0.38, z: 0.4 },
      { x: 0.38, z: 0.4 },
    ];
    const podMat = ripe ? this.soybeanRipeMat : this.soybeanPodMat;

    bushes.forEach((b, idx) => {
      const g = new THREE.Group();
      g.position.set(b.x, 0.12, b.z);
      g.rotation.y = idx * 1.1;

      const mainStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025 * scale, 0.035 * scale, 0.68 * scale, 6),
        this.cornStalkMat
      );
      mainStem.position.set(0, 0.34 * scale, 0);
      mainStem.castShadow = true;
      g.add(mainStem);

      for (let l = 0; l < 5; l++) {
        const angle = (l / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.16 * scale, 7, 6),
          l % 2 === 0 ? this.leafGreenMat : this.carrotFrondMat
        );
        leaf.scale.set(1.25, 0.38, 0.9);
        leaf.position.set(
          Math.cos(angle) * 0.16 * scale,
          (0.32 + (l % 3) * 0.14) * scale,
          Math.sin(angle) * 0.16 * scale
        );
        leaf.rotation.y = -angle;
        leaf.rotation.z = -0.25;
        leaf.castShadow = true;
        g.add(leaf);
      }

      for (let p = 0; p < 4; p++) {
        const pAngle = (p / 4) * Math.PI * 2 + 0.4;
        const pod = new THREE.Group();
        pod.position.set(
          Math.cos(pAngle) * 0.09 * scale,
          (0.24 + p * 0.09) * scale,
          Math.sin(pAngle) * 0.09 * scale
        );
        pod.rotation.y = -pAngle;
        pod.rotation.z = 0.55;

        for (let bean = 0; bean < 3; bean++) {
          const bMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.038 * scale, 7, 6),
            podMat
          );
          bMesh.scale.set(0.85, 1.15, 0.78);
          bMesh.position.set(0, -bean * 0.048 * scale, 0);
          bMesh.castShadow = true;
          pod.add(bMesh);
        }
        g.add(pod);
      }

      container.add(g);
    });
  }

  private buildCorn(container: THREE.Group, scale: number) {
    const stalks = [
      { x: -0.45, z: -0.3 },
      { x: 0.45, z: -0.3 },
      { x: 0, z: 0.35 },
    ];

    stalks.forEach((p, idx) => {
      const g = new THREE.Group();
      g.position.set(p.x, 0.12, p.z);

      const stalkMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045 * scale, 0.055 * scale, 1.65 * scale, 8),
        this.cornStalkMat
      );
      stalkMesh.position.set(0, 0.82 * scale, 0);
      stalkMesh.castShadow = true;
      g.add(stalkMesh);

      for (let l = 0; l < 5; l++) {
        const leafY = (0.45 + l * 0.24) * scale;
        const leafAngle = (l * 2.399) + idx;

        const leafGroup = new THREE.Group();
        leafGroup.position.set(0, leafY, 0);
        leafGroup.rotation.y = leafAngle;

        const leaf = new THREE.Mesh(
          new THREE.BoxGeometry(0.55 * scale, 0.02, 0.12 * scale),
          this.leafGreenMat
        );
        leaf.position.set(0.24 * scale, -0.06 * scale, 0);
        leaf.rotation.z = -0.45;
        leafGroup.add(leaf);
        g.add(leafGroup);
      }

      for (let c = 0; c < 2; c++) {
        const cobY = (0.75 + c * 0.35) * scale;
        const cobGroup = new THREE.Group();
        cobGroup.position.set(c === 0 ? 0.08 : -0.08, cobY, c === 0 ? 0.06 : -0.06);
        cobGroup.rotation.z = c === 0 ? 0.5 : -0.5;

        const husk = new THREE.Mesh(
          new THREE.ConeGeometry(0.08 * scale, 0.32 * scale, 8),
          this.cornStalkMat
        );
        husk.rotation.x = Math.PI;
        cobGroup.add(husk);

        const cob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055 * scale, 0.065 * scale, 0.28 * scale, 8),
          this.cornCobMat
        );
        cob.position.set(0, 0.06 * scale, 0);
        cobGroup.add(cob);

        const silk = new THREE.Mesh(
          new THREE.ConeGeometry(0.03 * scale, 0.14 * scale, 6),
          this.cornSilkMat
        );
        silk.position.set(0, 0.22 * scale, 0);
        cobGroup.add(silk);

        g.add(cobGroup);
      }

      container.add(g);
    });
  }

  private buildCarrot(container: THREE.Group, scale: number) {
    const carrotPoints = [
      { x: -0.45, z: -0.35 },
      { x: 0.45, z: -0.35 },
      { x: 0, z: 0 },
      { x: -0.45, z: 0.35 },
      { x: 0.45, z: 0.35 },
    ];

    carrotPoints.forEach((pt) => {
      const g = new THREE.Group();
      g.position.set(pt.x, 0.12, pt.z);

      const rootShoulder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * scale, 0.06 * scale, 0.12 * scale, 10),
        this.carrotOrangeMat
      );
      rootShoulder.position.set(0, 0.04 * scale, 0);
      rootShoulder.castShadow = true;
      g.add(rootShoulder);

      for (let f = 0; f < 5; f++) {
        const frondGroup = new THREE.Group();
        frondGroup.rotation.y = (f / 5) * Math.PI * 2;
        frondGroup.rotation.z = 0.35;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.015, 0.42 * scale, 4),
          this.carrotFrondMat
        );
        stem.position.set(0, 0.2 * scale, 0);
        frondGroup.add(stem);

        for (let b = 0; b < 3; b++) {
          const feather = new THREE.Mesh(
            new THREE.BoxGeometry(0.18 * scale, 0.015, 0.08 * scale),
            this.carrotFrondMat
          );
          feather.position.set(0, (0.18 + b * 0.1) * scale, 0);
          frondGroup.add(feather);
        }

        g.add(frondGroup);
      }

      container.add(g);
    });
  }

  private buildTomato(container: THREE.Group, scale: number) {
    const g = new THREE.Group();
    g.position.set(0, 0.12, 0);

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const stake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 1.65 * scale, 6),
        this.woodLogMat
      );
      stake.position.set(Math.cos(angle) * 0.3 * scale, 0.8 * scale, Math.sin(angle) * 0.3 * scale);
      stake.rotation.x = -Math.sin(angle) * 0.18;
      stake.rotation.z = Math.cos(angle) * 0.18;
      stake.castShadow = true;
      g.add(stake);
    }

    const foliage = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.55 * scale, 1),
      this.tomatoVineMat
    );
    foliage.position.set(0, 0.85 * scale, 0);
    foliage.scale.set(0.9, 1.4, 0.9);
    foliage.castShadow = true;
    g.add(foliage);

    const tomatoPositions = [
      { x: 0.32, y: 0.55, z: 0.2 },
      { x: -0.3, y: 0.65, z: 0.22 },
      { x: 0.15, y: 0.8, z: -0.32 },
      { x: -0.22, y: 0.95, z: -0.2 },
      { x: 0.28, y: 1.1, z: 0.15 },
      { x: -0.15, y: 1.25, z: 0.28 },
    ];

    tomatoPositions.forEach((tp) => {
      const tMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 * scale, 12, 10),
        this.tomatoMat
      );
      tMesh.position.set(tp.x * scale, tp.y * scale, tp.z * scale);
      tMesh.castShadow = true;

      const calyx = new THREE.Mesh(
        new THREE.ConeGeometry(0.07 * scale, 0.04 * scale, 5),
        this.darkLeafMat
      );
      calyx.position.set(0, 0.11 * scale, 0);
      calyx.rotation.x = Math.PI;
      tMesh.add(calyx);

      g.add(tMesh);
    });

    container.add(g);
  }

  private buildPumpkin(container: THREE.Group, scale: number) {
    const g = new THREE.Group();
    g.position.set(0, 0.12, 0);

    const leafAngles = [0.3, 1.5, 2.7, 4.1, 5.2];
    leafAngles.forEach((a) => {
      const lx = Math.cos(a) * 0.65;
      const lz = Math.sin(a) * 0.65;
      const leaf = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24 * scale, 0.24 * scale, 0.02, 6),
        this.darkLeafMat
      );
      leaf.position.set(lx, 0.08 * scale, lz);
      leaf.rotation.x = 0.15;
      leaf.rotation.z = -0.15;
      g.add(leaf);
    });

    const pumpkinGroup = new THREE.Group();
    pumpkinGroup.position.set(0, 0.32 * scale, 0);

    for (let lobe = 0; lobe < 6; lobe++) {
      const lobeMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.42 * scale, 10, 8),
        this.pumpkinMat
      );
      lobeMesh.scale.set(0.65, 0.85, 1.15);
      // ✅ FIX #1: full 360° distribution
      lobeMesh.rotation.y = (lobe / 6) * Math.PI * 2;
      lobeMesh.castShadow = true;
      pumpkinGroup.add(lobeMesh);
    }

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045 * scale, 0.065 * scale, 0.26 * scale, 6),
      this.pumpkinStemMat
    );
    stem.position.set(0, 0.38 * scale, 0);
    stem.rotation.z = 0.3;
    pumpkinGroup.add(stem);

    g.add(pumpkinGroup);
    container.add(g);
  }

  private buildStrawberry(container: THREE.Group, scale: number) {
    const mounds = [
      { x: -0.35, z: -0.25 },
      { x: 0.35, z: -0.25 },
      { x: 0, z: 0.35 },
    ];

    mounds.forEach((m) => {
      const g = new THREE.Group();
      g.position.set(m.x, 0.12, m.z);

      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.32 * scale, 8, 8),
        this.leafGreenMat
      );
      bush.scale.set(1.2, 0.65, 1.2);
      bush.position.set(0, 0.15 * scale, 0);
      bush.castShadow = true;
      g.add(bush);

      const flower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.02, 6),
        this.flowerPetalMat
      );
      flower.position.set(0.12 * scale, 0.28 * scale, 0.1 * scale);
      g.add(flower);

      for (let b = 0; b < 3; b++) {
        const bAngle = (b / 3) * Math.PI * 2;
        const berry = new THREE.Mesh(
          new THREE.ConeGeometry(0.075 * scale, 0.18 * scale, 8),
          this.strawberryMat
        );
        berry.position.set(
          Math.cos(bAngle) * 0.22 * scale,
          0.14 * scale,
          Math.sin(bAngle) * 0.22 * scale
        );
        berry.rotation.x = Math.PI - 0.25;
        berry.castShadow = true;

        const calyx = new THREE.Mesh(
          new THREE.ConeGeometry(0.05 * scale, 0.03 * scale, 5),
          this.darkLeafMat
        );
        calyx.position.set(0, 0.09 * scale, 0);
        berry.add(calyx);

        g.add(berry);
      }

      container.add(g);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  READY BADGE — bare crop emoji (no background, no border)
  // ═══════════════════════════════════════════════════════════════════════════

  private addReadyIndicator(container: THREE.Group, cropType: CropType) {
    const tex = this.createReadyBadgeTexture(cropType);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,   // ✅ ไม่ถูกใบ/ฝัก/ดินบัง
      depthWrite: false,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.name = 'ReadyBadge';
    sprite.scale.set(0.55, 0.55, 1);   // 👈 เล็กลงตาม canvas 128
    sprite.position.set(0, 1.95, 0);
    sprite.renderOrder = 10;
    sprite.userData.isPerPlotBadge = true;
    container.add(sprite);
  }

  private createReadyBadgeTexture(cropType: CropType): THREE.CanvasTexture {
    const S = 128;                      // 👈 canvas เล็กลง
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, S, S);

    // ── ไอคอนพืช/ผลไม้ (emoji) กลาง canvas — ไม่มีพื้นหลัง ไม่มีขอบ ──
    const icon = this.cropIconResolver(cropType);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '100px "Apple Color Emoji", "Segoe UI Emoji", ' +
      '"Noto Color Emoji", "Segoe UI Symbol", "Twemoji Mozilla", sans-serif';
    ctx.fillText(icon, S / 2, S / 2 + 4);

    // ── ขึ้น texture ─────────────────────────────────────────────
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (this.renderer) {
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    tex.needsUpdate = true;
    return tex;
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Frame update
  // ───────────────────────────────────────────────────────────────────────────

  public update(delta: number, elapsed: number) {
    this.cropModels.forEach((cropContainer) => {
      const badge = cropContainer.getObjectByName('ReadyBadge');
      if (badge) {
        // ✅ Sprite หันหน้าจอเองโดยอัตโนมัติ — ไม่ต้อง rotate.y
        badge.position.y = 1.95 + Math.sin(elapsed * 3.0) * 0.08;
      }

      const windAngle = Math.sin(elapsed * 2.2 + cropContainer.id * 0.5) * 0.035;
      cropContainer.rotation.z = windAngle;
    });

    if (this.selectionMarker.visible) {
      const pulse = 0.25 + 0.15 * Math.sin(elapsed * 6.0);
      this.selectionPlaneMat.opacity = pulse;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  Disposal — shared helper covers Mesh + Sprite + every texture slot
  // ───────────────────────────────────────────────────────────────────────────

  private disposeObjectTree(root: THREE.Object3D) {
    const disposedGeo = new Set<THREE.BufferGeometry>();
    const disposedMat = new Set<THREE.Material>();
    const disposedTex = new Set<THREE.Texture>();

    const disposeTexSafe = (tex: THREE.Texture | null | undefined) => {
      if (tex && !disposedTex.has(tex)) {
        disposedTex.add(tex);
        tex.dispose();
      }
    };

    const disposeMatSafe = (mat: THREE.Material) => {
      if (this.sharedMaterials.has(mat) || disposedMat.has(mat)) return;
      disposedMat.add(mat);
      const m = mat as THREE.MeshStandardMaterial &
                      THREE.MeshPhysicalMaterial &
                      THREE.SpriteMaterial;
      disposeTexSafe(m.map);
      disposeTexSafe(m.bumpMap);
      disposeTexSafe(m.normalMap);
      disposeTexSafe(m.roughnessMap);
      disposeTexSafe(m.metalnessMap);
      disposeTexSafe(m.emissiveMap);
      disposeTexSafe(m.aoMap);
      disposeTexSafe(m.alphaMap);
      disposeTexSafe(m.clearcoatMap);
      disposeTexSafe(m.clearcoatNormalMap);
      disposeTexSafe(m.clearcoatRoughnessMap);
      mat.dispose();
    };

    root.traverse((child) => {
      if (child instanceof THREE.Sprite) {
        // ⚠️ ห้าม dispose child.geometry (three.js ใช้ geometry กลางร่วมกันทุก Sprite)
        const mat = child.material as THREE.SpriteMaterial;
        if (mat) disposeMatSafe(mat);
      } else if (child instanceof THREE.Mesh) {
        if (
          child.geometry &&
          !this.sharedGeometries.has(child.geometry) &&
          !disposedGeo.has(child.geometry)
        ) {
          disposedGeo.add(child.geometry);
          child.geometry.dispose();
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) if (mat) disposeMatSafe(mat);
      }
    });
  }

  private disposeCropContainer(container: THREE.Group) {
    this.disposeObjectTree(container);
  }

  private disposePlotGroup(plotGroup: THREE.Group) {
    this.disposeObjectTree(plotGroup);
  }

  // ───────────────────────────────────────────────────────────────────────────
  //  ✅ FIX #5 + v2 texture-slot coverage: full teardown of all owned resources.
  //  Call this when the farm view is unmounted / game scene rebuilt.
  // ───────────────────────────────────────────────────────────────────────────
  public dispose() {
    this.plotMeshes.forEach((plotGroup) => {
      this.group.remove(plotGroup);
      this.disposePlotGroup(plotGroup);
    });
    this.plotMeshes.clear();
    this.soilBedMeshes.clear();
    this.plotBorderParts.clear();
    this.plotHitMeshes.clear();
    this.cropModels.clear();
    this.plotStageKeys.clear();
    this.interactiveMeshes = [];

    this.sharedGeometries.forEach((g) => g.dispose());
    this.sharedGeometries.clear();

    this.selectionMarker.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry?.dispose();
      }
    });
    this.selectionPlaneMat.dispose();
    this.selectionMarkerMat.dispose();
    this.group.remove(this.selectionMarker);

    const disposedTextures = new Set<THREE.Texture>();
    const disposeTexture = (tex: THREE.Texture | null | undefined) => {
      if (tex && !disposedTextures.has(tex)) {
        disposedTextures.add(tex);
        tex.dispose();
      }
    };

    this.sharedMaterials.forEach((mat) => {
      const m = mat as THREE.MeshStandardMaterial;
      disposeTexture(m.map);
      disposeTexture(m.bumpMap);
      disposeTexture(m.normalMap);
      disposeTexture(m.roughnessMap);
      disposeTexture(m.metalnessMap);
      disposeTexture(m.emissiveMap);
      disposeTexture(m.aoMap);
      disposeTexture(m.alphaMap);

      const p = mat as THREE.MeshPhysicalMaterial;
      disposeTexture(p.clearcoatMap);
      disposeTexture(p.clearcoatNormalMap);
      disposeTexture(p.clearcoatRoughnessMap);

      mat.dispose();
    });
    this.sharedMaterials.clear();

    this.group.parent?.remove(this.group);
  }
}