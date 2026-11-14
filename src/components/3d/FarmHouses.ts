// src/components/3d/FarmHouses.ts
import * as THREE from 'three';
import {
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../utils/glbValidator';
import { getHouseGlbCandidates, subscribeGlbDiscovery } from '../../utils/glbThumbnail';
import {
  HOUSE_DEFS,
  PlacedHouse,
  type AnimalFeedType,
} from '../../types/game';
import { isTerrainBlocked } from '../../data/terrainFeatures';
import { createWoodPlankTexture } from '../../utils/textures';
import { createAnimalRigMaterials } from './FarmAnimals';
import type { AnimalRigMaterials } from './animals/types';
import {
  createHouseMaterials,
  WalkingAgent,
  type HouseMaterials,
  type WalkingAgentOptions,
  ChickenCoopBuilder,
  type CoopMaterials,
  type CoopResult,
  DuckCoopBuilder,
  type DuckCoopResult,
  BreweryFactoryBuilder,
  type BreweryFactoryResult,
  BakeryOvenBuilder,
  type BakeryOvenResult,
  type OvenVisualState,
  AnimalFeedMachineBuilder,
  type AnimalFeedMachineResult,
  FishBuyingShopBuilder,
  type FishBuyingShopResult,
  CoveredVegetablePlotBuilder,
  type CoveredVegetablePlotResult,
  buildResidentialHouseWithYard,
  buildWaterTowerProcedural,
  buildWindmillProcedural,
  buildTrainStationProcedural,
  buildPowerLineProcedural,
  buildSpookyLampPostProcedural,
  buildTractorProcedural,
  buildVillageProcedural,
  buildUtilityPoleProcedural,
  buildFireEscapeProcedural,
  buildHorseStableProcedural,
  buildCowCorralProcedural,
  buildJungleHouseProcedural,
  buildGardenerQuartersProcedural,
  buildWoodenFenceProcedural,
  buildProduceStorageProcedural,
  buildRiverRockProcedural,
  buildOakTreesProcedural,
  buildMountainTrailProcedural,
  syncEntryHousePaint,
  disposeHousePaintRuntime,
  type HousePaintRuntimeState,
} from './structures';

export { WalkingAgent, type WalkingAgentOptions };

/**
 * FarmHouses3D — จัดการบ้าน สิ่งปลูกสร้าง ฟาร์มปศุสัตว์ และพร็อพตกแต่งทั้งหมด (ประเภท 0..23)
 * แยกตัวสร้างรูปทรง (Procedural Builders) ของแต่ละหลังออกไปไว้ใน ./structures/* เพื่อดูแลรักษาง่าย
 */

const MAP_W = 104;
const MAP_D = 78;

const MAX_PHYSICS_STEP = 1 / 60;
const MAX_FRAME_DT = 0.25;
const WINDMILL_TARGET_ANG_VEL = 1.4;
const WINDMILL_SPIN_UP_K = 1.5;

// ── Heavy GLB budget (รองรับ ~300K tris) ─────────────────────────
const HEAVY_GLB_TRI_WARN = 300_000;   // เกินกว่านี้ถือว่า heavy → track + LOD
const HEAVY_INSTANCE_WARN = 3;        // จำนวน instance สูงสุดก่อนเตือน
const DEFAULT_HEAVY_LOD_DIST = 80;    // เมตร — ไกลกว่านี้ hide (0 = ปิด LOD)

export interface GhostState {
  x: number;
  z: number;
  valid: boolean;
  reason?: string;
}

interface PlacedEntry {
  house: PlacedHouse;
  group: THREE.Group;
  picks: THREE.Object3D[];
  hitProxy?: THREE.Mesh;
  footprintW: number;
  footprintD: number;
  paintState?: HousePaintRuntimeState;
}

export class FarmHouses3D {
  public group = new THREE.Group();

  private placed = new Map<string, PlacedEntry>();
  private protos = new Map<number, THREE.Group>();
  private protoFootprints = new Map<number, { w: number; d: number }>();
  public map2Unlocked = false;
  private glbCache = new Map<number, THREE.Group>();
  private glbLoading = new Set<number>();
  private glbDefs = new Map<
    number,
    { paths: string[]; targetFootprint?: number; targetHeight?: number; hasExplicitModel?: boolean }
  >();
  private unsubscribeDiscovery: (() => void) | null = null;
  private isDisposed = false;
  private obstacles: { x: number; z: number }[] = [];
  private hiddenId: string | null = null;
  private selectedId: string | null = null;

  // 🔧 PATCH — tracking สำหรับ heavy type (tri > HEAVY_GLB_TRI_WARN) และ fast raycast proxy
  private heavyTypes = new Set<number>();
  private proxyOnlyTypes = new Set<number>();
  private heavyPlacedIds = new Set<string>();
  private heavyLodDist = DEFAULT_HEAVY_LOD_DIST;
  private hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
    side: THREE.DoubleSide,
  });

  private ghost: THREE.Group | null = null;
  private ghostType = 0;
  private ghostRot = 0;
  private ghostPos = new THREE.Vector2();
  private ghostValid = true;
  private ghostFoot: THREE.Mesh;
  private ghostOk = new THREE.MeshBasicMaterial({
    color: 0x66ff88,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  private ghostBad = new THREE.MeshBasicMaterial({
    color: 0xff5a5a,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  private selectPlane: THREE.Mesh;

  private coops = new Map<string, CoopResult | DuckCoopResult>();
  private breweries = new Map<string, BreweryFactoryResult>();
  private activeBrewHouseIds = new Set<string>();
  private ovens = new Map<string, BakeryOvenResult>();
  private ovenStates = new Map<string, OvenVisualState>();
  private feedMachines = new Map<string, AnimalFeedMachineResult>();
  private feedActiveCounts = new Map<string, number>();
  private fishShops = new Map<string, FishBuyingShopResult>();
  private fishShopStockCount = 0;
  private coveredPlots = new Map<string, CoveredVegetablePlotResult>();
  private coopMaterials: CoopMaterials;
  private animalRigMaterials: AnimalRigMaterials;
  private windmillAngVel = 0;
  private m: HouseMaterials;
  private paintedWoodTex: THREE.Texture;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.group.name = 'FarmHouses';

    this.coopMaterials = ChickenCoopBuilder.createMaterials();
    this.animalRigMaterials = createAnimalRigMaterials(renderer);
    this.m = createHouseMaterials(renderer);
    this.paintedWoodTex = createWoodPlankTexture('#ebebeb', renderer);

    const footGeo = new THREE.PlaneGeometry(1, 1);
    footGeo.rotateX(-Math.PI / 2);
    this.ghostFoot = new THREE.Mesh(footGeo, this.ghostOk);
    this.ghostFoot.position.y = 0.07;
    this.ghostFoot.renderOrder = 2;
    this.ghostFoot.visible = false;
    this.group.add(this.ghostFoot);

    this.selectPlane = new THREE.Mesh(
      footGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffc107,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    const borderPts = [
      new THREE.Vector3(-0.5, 0.012, -0.5),
      new THREE.Vector3(0.5, 0.012, -0.5),
      new THREE.Vector3(0.5, 0.012, 0.5),
      new THREE.Vector3(-0.5, 0.012, 0.5),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0xffeb3b,
      transparent: true,
      opacity: 0.95,
    });
    const borderLoop = new THREE.LineLoop(borderGeo, borderMat);
    borderLoop.renderOrder = 3;
    this.selectPlane.add(borderLoop);
    this.selectPlane.position.y = 0.065;
    this.selectPlane.renderOrder = 2;
    this.selectPlane.visible = false;
    this.group.add(this.selectPlane);

    this.registerGLBModels();
    this.unsubscribeDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (this.isDisposed) return;
      this.glbDefs.forEach((def, type) => {
        if (!this.glbCache.has(type) && def.paths.includes(resolvedUrl)) {
          this.ensureGLBLoaded(type, true);
        }
      });
    });
  }

  /** ปรับ LOD distance ของ heavy type (เมตร). 0 = ปิด */
  public setHeavyLodDistance(dist: number) {
    this.heavyLodDist = Math.max(0, dist);
    if (this.heavyLodDist === 0) {
      // ปิด LOD → คืน visible ให้ heavy ทุกตัว (ยกเว้นที่ถูกซ่อนด้วย hiddenId)
      this.placed.forEach((e, id) => {
        if (this.heavyPlacedIds.has(id)) {
          e.group.visible = id !== this.hiddenId;
        }
      });
    }
  }

  private registerGLBModels() {
    const sizeOverrides = new Map<
      number,
      { targetFootprint?: number; targetHeight?: number }
    >([
      // 🔧 PATCH #1 — type 2 (two-story-house.glb: 21×8.22×15 m)
      // เดิมใช้ targetFootprint 7.5 → scale 0.357 → สูงแค่ ~2.93 m (เตี้ย ชั้นเดียว)
      // เปลี่ยนเป็น targetHeight 6.5 → scale ≈ 0.79 → footprint ≈ 16.6×11.9 m, สูง 6.5 m
      [2, { targetHeight: 6.5 }],
      [6, { targetFootprint: 4.4 }],
      [7, { targetFootprint: 5.4 }],
      [8, { targetFootprint: 7.6 }],
      [9, { targetHeight: 9.5 }],
      [10, { targetHeight: 3.6 }],
      [11, { targetFootprint: 4.2 }],
      [12, { targetFootprint: 8.2 }],
      [13, { targetHeight: 6.8 }],
      [14, { targetHeight: 4.8 }],
      [17, { targetFootprint: 7.0 }],
      [18, { targetFootprint: 6.5 }],
      [19, { targetFootprint: 2.0 }],
      [20, { targetFootprint: 7.0 }],
      [21, { targetFootprint: 2.2 }],
      [22, { targetFootprint: 4.8 }],
      [23, { targetFootprint: 3.2 }],
    ]);

    for (const def of HOUSE_DEFS) {
      let paths = getHouseGlbCandidates(def);
      if (def.type === 5) {
        paths = paths.filter((p) => p !== '/chicken.glb' && p !== '/Chicken.glb');
      } else if (def.type === 15) {
        paths = paths.filter((p) => p !== '/horse.glb');
      } else if (def.type === 16) {
        paths = paths.filter((p) => p !== '/cow.glb');
      } else if (def.type === 24) {
        paths = paths.filter((p) => p !== '/duck_walk.glb' && p !== '/duck.glb');
      } else if (def.type === 25) {
        // BreweryFactoryBuilder handles beerproductionfactory.glb + animations + dynamic smoke anchor directly
        continue;
      } else if (def.type === 26 || def.type === 27) {
        // BakeryOvenBuilder handles Bakery.glb / PieOven.glb + 3D conveyor belt + woven basket directly
        continue;
      } else if (def.type === 28) {
        // AnimalFeedMachineBuilder handles Animal feed making machine.glb + animations + floating sacks directly
        continue;
      } else if (def.type === 29) {
        // FishBuyingShopBuilder handles Fish-buying shop.glb + animations + procedural harbor shop fallback directly
        continue;
      } else if (def.type === 30) {
        // CoveredVegetablePlotBuilder handles 2Vegetable _plot.glb + animations + procedural covered canopy fallback directly
        continue;
      }
      if (paths.length === 0) continue;

      const override = sizeOverrides.get(def.type);
      this.glbDefs.set(def.type, {
        paths,
        targetFootprint: override?.targetFootprint ?? Math.max(2.0, (def.yard ?? 6) * 0.82),
        targetHeight: override?.targetHeight,
        hasExplicitModel: Boolean(
          def.modelFile &&
            def.type !== 5 &&
            def.type !== 15 &&
            def.type !== 16 &&
            def.type !== 24
        ),
      });
    }
  }

  private ensureGLBLoaded(type: number, bypassCache = false) {
    if (this.isDisposed || this.glbCache.has(type) || this.glbLoading.has(type)) return;
    const def = this.glbDefs.get(type);
    if (!def) return;

    this.glbLoading.add(type);

    // 🔧 PATCH #2 — เพิ่ม type 2 เข้า forceNoShadow (674K tris × shadow pass หนักมาก)
    const forceNoShadow =
      type === 2 ||
      type === 17 ||
      type === 18 ||
      type === 8 ||
      type === 21 ||
      type === 22 ||
      type === 23;

    const tryLoad = (idx: number) => {
      if (this.isDisposed || idx >= def.paths.length) {
        this.glbLoading.delete(type);
        return;
      }

      const candidatePath = def.paths[idx];
      if (def.hasExplicitModel && idx === 0) {
        console.log(`[GLB FarmHouses] กำลังพยายามโหลดไฟล์: ${candidatePath}`);
      }

      loadValidatedGLTF(candidatePath, { bypassCache })
        .then(({ gltf, inspection }) => {
          console.log(`[GLB FarmHouses] ✅ โหลดสำเร็จ: ${candidatePath}`);

          this.glbLoading.delete(type);
          if (this.isDisposed) return;

          const rawModel = gltf.scene;
          optimizeGLTFSceneForDevice(rawModel, inspection, forceNoShadow);

          // 🔧 PATCH — นับ triangle หลัง optimize + register heavy type
          let triCount = 0;
          rawModel.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh && mesh.geometry) {
              const idxAttr = mesh.geometry.index;
              triCount += idxAttr
                ? idxAttr.count / 3
                : (mesh.geometry.attributes.position?.count ?? 0) / 3;
            }
          });

          const isHeavy = triCount > HEAVY_GLB_TRI_WARN;
          if (triCount > 8_000) {
            this.proxyOnlyTypes.add(type);
          }
          if (isHeavy) {
            this.heavyTypes.add(type);
            // นับ instance ที่มีอยู่แล้วของ type นี้
            this.placed.forEach((e, id) => {
              if (e.house.type === type) this.heavyPlacedIds.add(id);
            });

            console.warn(
              `[FarmHouses] type ${type} = ${Math.round(triCount).toLocaleString()} tris (heavy) — ` +
              `ปิด shadow, LOD @ ${this.heavyLodDist || 'off'}m, ` +
              `instance=${this.heavyPlacedIds.size}/${HEAVY_INSTANCE_WARN}`
            );

            if (this.heavyPlacedIds.size > HEAVY_INSTANCE_WARN) {
              console.warn(
                `[FarmHouses] ⚠️ มี heavy type วางอยู่ ${this.heavyPlacedIds.size} หลัง ` +
                `— แนะนำ preprocess ให้ <100K tris หรือทำ LOD0/LOD1 แยก`
              );
            }
          } else if (triCount > 0) {
            console.log(
              `[FarmHouses] type ${type} = ${Math.round(triCount).toLocaleString()} tris (ok)`
            );
          }

          rawModel.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(rawModel);
          const size = new THREE.Vector3();
          box.getSize(size);

          let scaleFactor = 1.0;
          if (def.targetHeight && size.y > 0.001) {
            scaleFactor = def.targetHeight / size.y;
          } else if (def.targetFootprint) {
            const maxHoriz = Math.max(size.x, size.z, 0.001);
            scaleFactor = def.targetFootprint / maxHoriz;
          }

          rawModel.scale.multiplyScalar(scaleFactor);
          rawModel.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(rawModel);
          const scaledSize = new THREE.Vector3();
          scaledBox.getSize(scaledSize);
          rawModel.position.y -= scaledBox.min.y;
          rawModel.position.x -= (scaledBox.min.x + scaledBox.max.x) / 2;
          rawModel.position.z -= (scaledBox.min.z + scaledBox.max.z) / 2;

          const wrapper = new THREE.Group();
          wrapper.name = `House_${type}_GLB`;
          wrapper.add(rawModel);

          this.protoFootprints.set(type, {
            w: Math.max(2.0, scaledSize.x + 0.6),
            d: Math.max(2.0, scaledSize.z + 0.6),
          });
          this.glbCache.set(type, wrapper);
          this.protos.set(type, wrapper);

          this.placed.forEach((e) => {
            if (e.house.type === type) {
              this.replacePlacedMesh(e.house.id, wrapper.clone(true));
            }
          });
          this.syncSelectionPlane();

          if (this.ghost && this.ghostType === type) {
            while (this.ghost.children.length > 0) {
              this.ghost.remove(this.ghost.children[0]);
            }
            const ghostClone = wrapper.clone(true);
            ghostClone.traverse((o) => {
              if ((o as THREE.Mesh).isMesh) {
                (o as THREE.Mesh).castShadow = false;
                (o as THREE.Mesh).receiveShadow = false;
              }
            });
            this.ghost.add(ghostClone);
            this.syncGhostFootScale(type);
            this.applyGhostLook();
          }
        })
        .catch((err) => {
          if (def.hasExplicitModel && idx === 0) {
            console.warn(`[GLB FarmHouses] ❌ โหลดล้มเหลว: ${candidatePath} สาเหตุ:`, err);
          }
          tryLoad(idx + 1);
        });
    };
    tryLoad(0);
  }

  private rebuildEntryPicks(e: PlacedEntry) {
    if (e.hitProxy) {
      e.group.remove(e.hitProxy);
      e.hitProxy.geometry.dispose();
      e.hitProxy = undefined;
    }

    const savedX = e.group.position.x;
    const savedY = e.group.position.y;
    const savedZ = e.group.position.z;
    const savedRotY = e.group.rotation.y;
    const savedVis = e.group.visible;

    e.group.position.set(0, 0, 0);
    e.group.rotation.set(0, 0, 0);
    e.group.visible = true;
    e.group.updateMatrixWorld(true);

    const localBox = new THREE.Box3();
    e.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material !== this.m.dirt && !mesh.userData.isHitProxy) {
        localBox.expandByObject(mesh);
      }
    });

    const defYard = HOUSE_DEFS[e.house.type]?.yard ?? 6;
    let rawW = defYard * 0.75;
    let rawH = 2.6;
    let rawD = defYard * 0.75;
    let cx = 0;
    let cy = 1.3;
    let cz = 0;

    if (!localBox.isEmpty()) {
      rawW = localBox.max.x - localBox.min.x;
      rawH = localBox.max.y - localBox.min.y;
      rawD = localBox.max.z - localBox.min.z;
      cx = (localBox.min.x + localBox.max.x) * 0.5;
      cy = (localBox.min.y + localBox.max.y) * 0.5;
      cz = (localBox.min.z + localBox.max.z) * 0.5;
    }

    e.footprintW = Math.max(defYard, rawW + 0.6);
    e.footprintD = Math.max(defYard, rawD + 0.6);

    const isCoveredVegPlot = e.house.type === 30;
    const hitW = Math.max(1.3, rawW + 0.25);
    const hitH = isCoveredVegPlot ? 0.96 : Math.max(1.6, rawH + 0.2);
    const hitD = Math.max(1.3, rawD + 0.25);

    const proxyGeo = new THREE.BoxGeometry(hitW, hitH, hitD);
    const hitProxy = new THREE.Mesh(proxyGeo, this.hitProxyMat);
    hitProxy.name = `HitProxy_${e.house.id}`;
    hitProxy.position.set(cx, isCoveredVegPlot ? Math.max(1.95, rawH - 0.45) : Math.max(hitH * 0.5, cy), cz);
    hitProxy.userData.houseId = e.house.id;
    hitProxy.userData.isHitProxy = true;
    e.group.add(hitProxy);
    e.hitProxy = hitProxy;

    e.group.position.set(savedX, savedY, savedZ);
    e.group.rotation.y = savedRotY;
    e.group.visible = savedVis;
    e.group.updateMatrixWorld(true);

    e.picks = [];
    const useProxyOnly = this.proxyOnlyTypes.has(e.house.type) || this.heavyTypes.has(e.house.type);
    if (useProxyOnly) {
      e.picks.push(hitProxy);
      return;
    }

    // สำหรับพร็อพ/รั้ว/เสาไฟ/ต้นไม้/ป้าย (type >= 6) ใส่ hitProxy ช่วยจับคลิกตรงช่องว่างด้วย
    if (e.house.type >= 6) {
      e.picks.push(hitProxy);
    }

    e.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !mesh.userData.isHitProxy && mesh.material !== this.m.dirt) {
        mesh.userData.houseId = e.house.id;
        e.picks.push(mesh);
      }
    });
  }

  private replacePlacedMesh(id: string, newModel: THREE.Group) {
    const e = this.placed.get(id);
    if (!e) return;
    this.disposeEntryTintedMaterials(e);
    if (e.hitProxy) {
      e.group.remove(e.hitProxy);
      e.hitProxy.geometry.dispose();
      e.hitProxy = undefined;
    }
    while (e.group.children.length > 0) {
      e.group.remove(e.group.children[0]);
    }
    e.group.add(newModel);
    this.rebuildEntryPicks(e);
    this.applyEntryCustomColor(e);
  }

  private disposeEntryTintedMaterials(e: PlacedEntry) {
    disposeHousePaintRuntime(e.group, e.paintState, true);
    e.paintState = undefined;
  }

  private applyEntryCustomColor(e: PlacedEntry) {
    e.paintState = syncEntryHousePaint(e.group, e.house, e.paintState, {
      houseMaterials: this.m,
      coopMaterials: this.coopMaterials,
      hitProxyMat: this.hitProxyMat,
      paintedWoodTex: this.paintedWoodTex,
      isDisposed: () => this.isDisposed,
      isEntryAlive: (houseId) => this.placed.has(houseId),
    });
  }

  private getProto(type: number): THREE.Group {
    let p = this.protos.get(type);
    if (!p) {
      p = this.buildHouse(type);
      this.protos.set(type, p);
    }
    return p;
  }

  private buildHouse(type: number): THREE.Group {
    if (type === 5) {
      const builder = new ChickenCoopBuilder();
      builder.setChickenMaterials(this.animalRigMaterials);
      const coop = builder.build(this.coopMaterials, {
        initialChickens: 0,
        chickensInside: 0,
        autoWander: false,
      });
      coop.root.name = 'House_5';
      return coop.root;
    }

    if (type === 24) {
      const builder = new DuckCoopBuilder();
      builder.setAnimalMaterials(this.animalRigMaterials);
      const duckCoop = builder.build(this.coopMaterials, {
        initialDucks: 0,
        autoWander: false,
      });
      duckCoop.root.name = 'House_24';
      return duckCoop.root;
    }

    if (type === 25) {
      const builder = new BreweryFactoryBuilder();
      const brewery = builder.build(this.m, { enableSmokeAndMotion: false });
      brewery.root.name = 'House_25';
      return brewery.root;
    }

    if (type === 26 || type === 27) {
      const builder = new BakeryOvenBuilder();
      const oven = builder.build(this.m, {
        machine: type === 26 ? 'bakery' : 'pie_oven',
        enableMotionAndSmoke: false,
      });
      oven.root.name = `House_${type}`;
      return oven.root;
    }

    if (type === 28) {
      const builder = new AnimalFeedMachineBuilder();
      const feedMill = builder.build(this.m, {
        enableMotionAndParticles: false,
      });
      feedMill.root.name = 'House_28';
      return feedMill.root;
    }

    if (type === 29) {
      const builder = new FishBuyingShopBuilder();
      const fishShop = builder.build(this.m, {
        enableMotion: false,
      });
      fishShop.root.name = 'House_29';
      return fishShop.root;
    }

    if (type === 30) {
      const builder = new CoveredVegetablePlotBuilder();
      const covered = builder.build(this.m, {
        enableMotion: false,
      });
      covered.root.name = 'House_30';
      return covered.root;
    }

    if (this.glbCache.has(type)) {
      return this.glbCache.get(type)!.clone(true);
    }

    switch (type) {
      case 6:  return buildWaterTowerProcedural();
      case 7:  return buildWindmillProcedural();
      case 8:  return buildTrainStationProcedural();
      case 9:  return buildPowerLineProcedural();
      case 10: return buildSpookyLampPostProcedural();
      case 11: return buildTractorProcedural();
      case 12: return buildVillageProcedural();
      case 13: return buildUtilityPoleProcedural();
      case 14: return buildFireEscapeProcedural();
      case 15: return buildHorseStableProcedural(this.m);
      case 16: return buildCowCorralProcedural(this.m);
      case 17: return buildJungleHouseProcedural(this.m);
      case 18: return buildGardenerQuartersProcedural(this.m);
      case 19: return buildWoodenFenceProcedural(this.m);
      case 20: return buildProduceStorageProcedural(this.m);
      case 21: return buildRiverRockProcedural();
      case 22: return buildOakTreesProcedural();
      case 23: return buildMountainTrailProcedural();
      default: {
        // 🔧 PATCH #3 — เตือนเมื่อ type นั้นมี GLB เฉพาะแต่ยังโหลดไม่เสร็จ
        const def = this.glbDefs.get(type);
        if (def?.hasExplicitModel) {
          console.warn(
            `[FarmHouses] type ${type} ยังใช้ procedural อยู่ (GLB ยังไม่โหลดเสร็จ) — ` +
            `จะสลับเป็น GLB อัตโนมัติเมื่อโหลดเสร็จ`
          );
        }
        return buildResidentialHouseWithYard(type, this.m);
      }
    }
  }

  // ───────────────────────── จัดการบ้านที่วางแล้ว ─────────────────────────

  /** กลุ่ม 3D ของบ้านที่วางแล้ว (ใช้กับระบบเดิน/ประตู) */
  public getHouseGroup(id: string): THREE.Group | undefined {
    return this.placed.get(id)?.group;
  }

  public setObstacles(points: { x: number; z: number }[]) {
    this.obstacles = points;
  }

  public setHiddenId(id: string | null) {
    this.hiddenId = id;
    this.placed.forEach((e, key) => (e.group.visible = key !== id));
    this.syncSelectionPlane();
  }

  public setHouses(list: PlacedHouse[]) {
    const ids = new Set(list.map((h) => h.id));
    this.placed.forEach((e, id) => {
      if (!ids.has(id)) {
        this.disposeEntryTintedMaterials(e);
        if (e.hitProxy) {
          e.group.remove(e.hitProxy);
          e.hitProxy.geometry.dispose();
        }
        const oldCoop = this.coops.get(id);
        oldCoop?.dispose(false);
        this.coops.delete(id);
        const oldBrewery = this.breweries.get(id);
        oldBrewery?.dispose(false);
        this.breweries.delete(id);
        const oldOven = this.ovens.get(id);
        oldOven?.dispose(false);
        this.ovens.delete(id);
        const oldFeed = this.feedMachines.get(id);
        oldFeed?.dispose(false);
        this.feedMachines.delete(id);
        const oldFishShop = this.fishShops.get(id);
        oldFishShop?.dispose(false);
        this.fishShops.delete(id);
        const oldCovered = this.coveredPlots.get(id);
        oldCovered?.dispose(false);
        this.coveredPlots.delete(id);
        this.group.remove(e.group);
        this.placed.delete(id);
        this.heavyPlacedIds.delete(id);   // 🔧 PATCH
      }
    });
    for (const h of list) {
      const cur = this.placed.get(h.id);
      if (cur && cur.house.type === h.type) {
        cur.group.position.set(h.x, 0, h.z);
        cur.group.rotation.y = h.rot;
        cur.house = h;
        this.applyEntryCustomColor(cur);
        continue;
      }
      if (cur) {
        this.disposeEntryTintedMaterials(cur);
        if (cur.hitProxy) {
          cur.group.remove(cur.hitProxy);
          cur.hitProxy.geometry.dispose();
        }
        const oldCoop = this.coops.get(h.id);
        oldCoop?.dispose(false);
        this.coops.delete(h.id);
        const oldBrewery = this.breweries.get(h.id);
        oldBrewery?.dispose(false);
        this.breweries.delete(h.id);
        const oldOven = this.ovens.get(h.id);
        oldOven?.dispose(false);
        this.ovens.delete(h.id);
        const oldFeed = this.feedMachines.get(h.id);
        oldFeed?.dispose(false);
        this.feedMachines.delete(h.id);
        const oldFishShop = this.fishShops.get(h.id);
        oldFishShop?.dispose(false);
        this.fishShops.delete(h.id);
        const oldCovered = this.coveredPlots.get(h.id);
        oldCovered?.dispose(false);
        this.coveredPlots.delete(h.id);
        this.group.remove(cur.group);
        this.heavyPlacedIds.delete(h.id);   // 🔧 PATCH
      }
      const g = new THREE.Group();
      if (h.type === 5) {
        const builder = new ChickenCoopBuilder();
        builder.setChickenMaterials(this.animalRigMaterials);
        const coop = builder.build(this.coopMaterials, {
          initialChickens: 4,
          chickensInside: 2,
          autoWander: true,
        });
        this.coops.set(h.id, coop);
        g.add(coop.root);
      } else if (h.type === 24) {
        const builder = new DuckCoopBuilder();
        builder.setAnimalMaterials(this.animalRigMaterials);
        const duckCoop = builder.build(this.coopMaterials, {
          initialDucks: 5,
          autoWander: true,
        });
        this.coops.set(h.id, duckCoop);
        g.add(duckCoop.root);
      } else if (h.type === 25) {
        const builder = new BreweryFactoryBuilder();
        const brewery = builder.build(this.m, { enableSmokeAndMotion: true });
        brewery.setActive(this.activeBrewHouseIds.has(h.id));
        this.breweries.set(h.id, brewery);
        g.add(brewery.root);
      } else if (h.type === 26 || h.type === 27) {
        const builder = new BakeryOvenBuilder();
        const oven = builder.build(this.m, {
          machine: h.type === 26 ? 'bakery' : 'pie_oven',
          enableMotionAndSmoke: true,
        });
        const st = this.ovenStates.get(h.id);
        if (st) oven.setOvenState(st);
        this.ovens.set(h.id, oven);
        g.add(oven.root);
      } else if (h.type === 28) {
        const builder = new AnimalFeedMachineBuilder();
        const feedMill = builder.build(this.m, {
          enableMotionAndParticles: true,
          onGlbMounted: () => {
            const mountedEntry = this.placed.get(h.id);
            if (!mountedEntry) return;
            this.disposeEntryTintedMaterials(mountedEntry);
            this.rebuildEntryPicks(mountedEntry);
            this.applyEntryCustomColor(mountedEntry);
            this.syncSelectionPlane();
          },
        });
        feedMill.setActiveCount(this.feedActiveCounts.get(h.id) ?? 0);
        this.feedMachines.set(h.id, feedMill);
        g.add(feedMill.root);
      } else if (h.type === 29) {
        const builder = new FishBuyingShopBuilder();
        const fishShop = builder.build(this.m, {
          enableMotion: true,
          onGlbMounted: () => {
            const mountedEntry = this.placed.get(h.id);
            if (!mountedEntry) return;
            this.disposeEntryTintedMaterials(mountedEntry);
            this.rebuildEntryPicks(mountedEntry);
            this.applyEntryCustomColor(mountedEntry);
            this.syncSelectionPlane();
          },
        });
        fishShop.setStockCount(this.fishShopStockCount);
        this.fishShops.set(h.id, fishShop);
        g.add(fishShop.root);
      } else if (h.type === 30) {
        const builder = new CoveredVegetablePlotBuilder();
        const covered = builder.build(this.m, {
          enableMotion: true,
          onGlbMounted: () => {
            const mountedEntry = this.placed.get(h.id);
            if (!mountedEntry) return;
            this.disposeEntryTintedMaterials(mountedEntry);
            this.rebuildEntryPicks(mountedEntry);
            this.applyEntryCustomColor(mountedEntry);
            this.syncSelectionPlane();
          },
        });
        this.coveredPlots.set(h.id, covered);
        g.add(covered.root);
      } else {
        // 🔧 PATCH #4 — defer: ใส่ procedural ทันที แล้ว swap เป็น GLB เมื่อโหลดเสร็จ
        this.ensureGLBLoaded(h.type);
        g.add(this.getProto(h.type).clone(true));
      }
      g.position.set(h.x, 0, h.z);
      g.rotation.y = h.rot;
      g.visible = h.id !== this.hiddenId;
      const defaultYard = HOUSE_DEFS[h.type]?.yard ?? 6;
      const entry: PlacedEntry = {
        house: h,
        group: g,
        picks: [],
        footprintW: defaultYard,
        footprintD: defaultYard,
      };
      this.group.add(g);
      this.rebuildEntryPicks(entry);
      this.applyEntryCustomColor(entry);
      this.placed.set(h.id, entry);

      // 🔧 PATCH — track heavy instance
      if (this.heavyTypes.has(h.type)) {
        this.heavyPlacedIds.add(h.id);
        if (this.heavyPlacedIds.size > HEAVY_INSTANCE_WARN) {
          console.warn(
            `[FarmHouses] ⚠️ heavy instance = ${this.heavyPlacedIds.size} (เกิน ${HEAVY_INSTANCE_WARN})`
          );
        }
      }
    }
    this.syncSelectionPlane();
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubscribeDiscovery?.();
    this.unsubscribeDiscovery = null;
    this.stopGhost();
    this.coops.forEach((coop) => coop.dispose(false));
    this.coops.clear();
    this.breweries.forEach((brewery) => brewery.dispose(false));
    this.breweries.clear();
    this.ovens.forEach((oven) => oven.dispose(false));
    this.ovens.clear();
    this.ovenStates.clear();
    this.feedMachines.forEach((fm) => fm.dispose(false));
    this.feedMachines.clear();
    this.feedActiveCounts.clear();
    this.fishShops.forEach((shop) => shop.dispose(false));
    this.fishShops.clear();
    this.coveredPlots.forEach((cp) => cp.dispose(false));
    this.coveredPlots.clear();
    this.placed.forEach((e) => this.disposeEntryTintedMaterials(e));
    this.glbLoading.clear();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    const disposedTexs = new Set<THREE.Texture>();

    const disposeObjectTree = (root: THREE.Object3D) => {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
            disposedGeos.add(mesh.geometry);
            mesh.geometry.dispose();
          }
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if (!mat || disposedMats.has(mat)) return;
            disposedMats.add(mat);
            const std = mat as THREE.MeshStandardMaterial;
            if (std.map && !disposedTexs.has(std.map)) {
              disposedTexs.add(std.map);
              std.map.dispose();
            }
            mat.dispose();
          });
        }
      });
    };

    disposeObjectTree(this.group);
    this.protos.forEach((p) => disposeObjectTree(p));
    this.glbCache.forEach((p) => disposeObjectTree(p));
    this.protos.clear();
    this.protoFootprints.clear();
    this.glbCache.clear();
    this.placed.clear();
    this.heavyTypes.clear();        // 🔧 PATCH
    this.proxyOnlyTypes.clear();
    this.heavyPlacedIds.clear();    // 🔧 PATCH

    Object.values(this.m).forEach((mat) => {
      if (mat.map && !disposedTexs.has(mat.map)) {
        disposedTexs.add(mat.map);
        mat.map.dispose();
      }
      if (!disposedMats.has(mat)) {
        disposedMats.add(mat);
        mat.dispose();
      }
    });
    Object.values(this.coopMaterials).forEach((mat) => {
      if (mat instanceof THREE.Material && !disposedMats.has(mat)) {
        disposedMats.add(mat);
        mat.dispose();
      }
    });
    Object.values(this.animalRigMaterials).forEach((mat) => {
      if (mat instanceof THREE.Material && !disposedMats.has(mat)) {
        disposedMats.add(mat);
        mat.dispose();
      }
    });
    this.placed.forEach((e) => this.disposeEntryTintedMaterials(e));
    if (!disposedTexs.has(this.paintedWoodTex)) {
      disposedTexs.add(this.paintedWoodTex);
      this.paintedWoodTex.dispose();
    }
    this.ghostOk.dispose();
    this.ghostBad.dispose();
    this.hitProxyMat.dispose();
    this.selectPlane.traverse((obj) => {
      if ((obj as THREE.Line).isLine) {
        const line = obj as THREE.Line;
        line.geometry?.dispose();
        if (!Array.isArray(line.material)) {
          line.material?.dispose();
        }
      }
    });
    if (!Array.isArray(this.selectPlane.material)) {
      this.selectPlane.material.dispose();
    }
    this.group.clear();
  }

  private syncSelectionPlane() {
    if (!this.selectedId || this.selectedId === this.hiddenId) {
      this.selectPlane.visible = false;
      return;
    }
    const entry = this.placed.get(this.selectedId);
    if (!entry || !entry.group.visible) {
      this.selectPlane.visible = false;
      return;
    }
    const yard = HOUSE_DEFS[entry.house.type]?.yard ?? 6;
    const scaleX = Math.max(yard, entry.footprintW);
    const scaleZ = Math.max(yard, entry.footprintD);
    this.selectPlane.position.set(entry.house.x, 0.065, entry.house.z);
    this.selectPlane.rotation.y = entry.house.rot;
    this.selectPlane.scale.set(scaleX, 1, scaleZ);
    this.selectPlane.visible = true;
  }

  public setSelected(id: string | null) {
    this.selectedId = id;
    this.syncSelectionPlane();
  }

  public pickHouseHit(raycaster: THREE.Raycaster): { id: string; distance: number } | null {
    const objs: THREE.Object3D[] = [];
    this.placed.forEach((e) => {
      if (e.group.visible) objs.push(...e.picks);
    });
    const hits = raycaster.intersectObjects(objs, false);
    if (!hits.length) return null;
    const id = hits[0].object.userData.houseId as string | undefined;
    return id ? { id, distance: hits[0].distance } : null;
  }

  public pickHouse(raycaster: THREE.Raycaster): string | null {
    return this.pickHouseHit(raycaster)?.id ?? null;
  }

  public isInsideYard(x: number, z: number): boolean {
    let inside = false;
    this.placed.forEach((e) => {
      if (inside || !e.group.visible) return;
      if (e.house.type === 30) {
        const cos = Math.cos(-e.house.rot);
        const sin = Math.sin(-e.house.rot);
        const dx = x - e.house.x;
        const dz = z - e.house.z;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) < 2.35 && Math.abs(lz) < 1.35) inside = true;
        return;
      }
      const def = HOUSE_DEFS[e.house.type];
      const factor = e.house.type >= 6 ? 0.42 : 1.0;
      const half = ((def?.yard ?? 6) / 2) * factor + 0.15;
      if (Math.abs(x - e.house.x) < half && Math.abs(z - e.house.z) < half) inside = true;
    });
    if (!inside && this.ghost) {
      if (this.ghostType === 30) {
        const cos = Math.cos(-this.ghostRot);
        const sin = Math.sin(-this.ghostRot);
        const dx = x - this.ghostPos.x;
        const dz = z - this.ghostPos.y;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        if (Math.abs(lx) < 2.35 && Math.abs(lz) < 1.35) inside = true;
      } else {
        const def = HOUSE_DEFS[this.ghostType];
        const factor = this.ghostType >= 6 ? 0.42 : 1.0;
        const half = ((def?.yard ?? 6) / 2) * factor + 0.15;
        if (Math.abs(x - this.ghostPos.x) < half && Math.abs(z - this.ghostPos.y) < half) {
          inside = true;
        }
      }
    }
    return inside;
  }

  // ───────────────────────── โหมดวาง (ภาพโปร่ง) ─────────────────────────

  private checkValid(_type: number, x: number, z: number): { valid: boolean; reason: string } {
    const minBoundX = this.map2Unlocked ? -88 : -(MAP_W / 2 - 1.5);
    const maxBoundX = MAP_W / 2 - 1.5;
    const maxBoundZ = MAP_D / 2 - 1.5;
    if (x < minBoundX || x > maxBoundX || Math.abs(z) > maxBoundZ) {
      return { valid: false, reason: 'ชิดขอบเกาะเกินไป' };
    }
    return { valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' };
  }

  private applyGhostLook() {
    if (!this.ghost) return;
    const mat = this.ghostValid ? this.ghostOk : this.ghostBad;
    this.ghost.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mat;
    });
    this.ghostFoot.material = mat;
  }

  private syncGhostFootScale(type: number) {
    const yard = HOUSE_DEFS[type]?.yard ?? 6;
    const fp = this.protoFootprints.get(type);
    const scaleX = fp ? Math.max(yard, fp.w) : yard;
    const scaleZ = fp ? Math.max(yard, fp.d) : yard;
    this.ghostFoot.scale.set(scaleX, 1, scaleZ);
  }

  public startGhost(type: number, rot: number, x: number, z: number): GhostState {
    this.stopGhost();
    this.ghostType = type;
    this.ghostRot = rot;
    this.ensureGLBLoaded(type);
    const g = new THREE.Group();
    const model = this.getProto(type).clone(true);
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).castShadow = false;
        (o as THREE.Mesh).receiveShadow = false;
      }
    });
    g.add(model);
    this.ghost = g;
    this.group.add(g);
    this.syncGhostFootScale(type);
    this.ghostFoot.visible = true;
    return this.moveGhost(x, z)!;
  }

  public moveGhost(x: number, z: number): GhostState | null {
    if (!this.ghost) return null;
    const minBoundX = this.map2Unlocked ? -88 : -(MAP_W / 2 - 1.5);
    const maxBoundX = MAP_W / 2 - 1.5;
    const maxBoundZ = MAP_D / 2 - 1.5;
    const sx = THREE.MathUtils.clamp(Math.round(x * 2) / 2, minBoundX, maxBoundX);
    const sz = THREE.MathUtils.clamp(Math.round(z * 2) / 2, -maxBoundZ, maxBoundZ);
    this.ghostPos.set(sx, sz);
    this.ghost.position.set(sx, 0, sz);
    this.ghost.rotation.y = this.ghostRot;
    this.ghostFoot.position.set(sx, 0.07, sz);
    this.ghostFoot.rotation.y = this.ghostRot;
    const validation = this.checkValid(this.ghostType, sx, sz);
    this.ghostValid = validation.valid;
    this.applyGhostLook();
    return { x: sx, z: sz, valid: this.ghostValid, reason: validation.reason };
  }

  public setGhostRotation(rot: number): GhostState | null {
    if (!this.ghost) return null;
    this.ghostRot = rot;
    return this.moveGhost(this.ghostPos.x, this.ghostPos.y);
  }

  public stopGhost() {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    this.ghostFoot.visible = false;
  }

  public hasGhost(): boolean {
    return this.ghost !== null;
  }

  private stepPhysics(dt: number, fn: (subDt: number) => void) {
    let remaining = Math.min(dt, MAX_FRAME_DT);
    while (remaining > 1e-6) {
      const step = Math.min(remaining, MAX_PHYSICS_STEP);
      fn(step);
      remaining -= step;
    }
  }

  public setActiveBrewHouses(houseIds: Iterable<string>) {
    this.activeBrewHouseIds = new Set(houseIds);
    this.breweries.forEach((brewery, id) => {
      brewery.setActive(this.activeBrewHouseIds.has(id));
    });
  }

  public setOvenStates(states: Map<string, OvenVisualState>) {
    this.ovenStates = new Map(states);
    this.ovens.forEach((oven, id) => {
      const st = this.ovenStates.get(id) ?? { activeCount: 0, readyItems: [] };
      oven.setOvenState(st);
    });
  }

  public setFeedMachineActiveCounts(counts: Map<string, number>) {
    this.feedActiveCounts = new Map(counts);
    this.feedMachines.forEach((fm, id) => {
      fm.setActiveCount(this.feedActiveCounts.get(id) ?? 0);
    });
  }

  public triggerFeedAutoFloat(
    houseId: string,
    feedType: AnimalFeedType,
    targetWorldPos?: THREE.Vector3
  ) {
    const fm = this.feedMachines.get(houseId);
    if (fm) {
      fm.launchAutoCollectFloat(feedType, targetWorldPos);
    }
  }

  public setFishShopStockCount(count: number) {
    this.fishShopStockCount = Math.max(0, count);
    this.fishShops.forEach((shop) => shop.setStockCount(this.fishShopStockCount));
  }

  public triggerFishSaleCelebration(houseId?: string) {
    if (houseId) {
      const target = this.fishShops.get(houseId);
      if (target) {
        target.launchSaleCelebration();
        return;
      }
    }
    this.fishShops.forEach((shop) => shop.launchSaleCelebration());
  }

  public update(dt: number, elapsed: number, camera?: THREE.Camera) {
    this.stepPhysics(dt, (sub) => {
      this.coops.forEach((coop) => coop.update(sub, elapsed));
    });
    this.breweries.forEach((brewery) => brewery.update(dt, elapsed));
    this.ovens.forEach((oven) => oven.update(dt, elapsed));
    this.feedMachines.forEach((fm) => fm.update(dt, elapsed));
    this.fishShops.forEach((shop) => shop.update(dt, elapsed));
    this.coveredPlots.forEach((cp) => cp.update(dt, elapsed));

    const k = 1 - Math.exp(-WINDMILL_SPIN_UP_K * dt);
    this.windmillAngVel += (WINDMILL_TARGET_ANG_VEL - this.windmillAngVel) * k;

    this.placed.forEach((entry) => {
      if (entry.house.type === 7) {
        const blades = entry.group.getObjectByName('WindmillBlades');
        if (blades) {
          blades.rotation.z += this.windmillAngVel * dt;
        }
      }
      if (entry.house.type === 11) {
        entry.group.position.y = Math.sin(elapsed * 14) * 0.012;
      }
    });

    if (this.ghost && this.ghostType === 7) {
      const ghostBlades = this.ghost.getObjectByName('WindmillBlades');
      if (ghostBlades) {
        ghostBlades.rotation.z += this.windmillAngVel * dt;
      }
    }

    // 🔧 PATCH — distance LOD สำหรับ heavy type
    if (camera && this.heavyLodDist > 0 && this.heavyPlacedIds.size > 0) {
      const cx = camera.position.x;
      const cz = camera.position.z;
      const maxD2 = this.heavyLodDist * this.heavyLodDist;
      this.placed.forEach((entry, id) => {
        if (!this.heavyPlacedIds.has(id)) return;
        const dx = entry.house.x - cx;
        const dz = entry.house.z - cz;
        const within = dx * dx + dz * dz <= maxD2;
        entry.group.visible = within && id !== this.hiddenId;
      });
    }
  }
}