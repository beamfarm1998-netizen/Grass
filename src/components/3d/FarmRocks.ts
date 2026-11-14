// src/components/3d/FarmRocks.ts
import * as THREE from 'three';
import {
  PlacedRock,
  ROCK_DEFS,
  RockType,
  GRID_CELL_SIZE,
  worldToGrid,
} from '../../types/game';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../utils/glbValidator';
import {
  getRockGlbCandidates,
  subscribeGlbDiscovery,
} from '../../utils/glbThumbnail';

export interface RockGhostState {
  x: number;
  z: number;
  valid: boolean;
  reason?: string;
  gridX: number;
  gridZ: number;
}

interface PlacedRockEntry {
  rock: PlacedRock;
  group: THREE.Group;
  picks: THREE.Object3D[];
}

/**
 * Procedural low-poly deformed polyhedron generator for weathered organic rock geometry.
 * Displaces vertices deterministically to create natural geological facets.
 */
function createProceduralRockGeometry(
  radius: number,
  detail: number,
  noiseScale: number = 0.22,
  seedOffset: number = 0
): THREE.BufferGeometry {
  const baseGeo = new THREE.DodecahedronGeometry(radius, detail);
  const posAttr = baseGeo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const nx = Math.sin(v.x * 3.5 + seedOffset) * Math.cos(v.y * 3.2 + seedOffset);
    const ny = Math.cos(v.y * 3.1 + seedOffset * 1.5) * Math.sin(v.z * 3.7);
    const nz = Math.sin(v.z * 3.3 + seedOffset * 2.1) * Math.cos(v.x * 2.8);

    const displacement = 1.0 + (nx + ny + nz) * noiseScale * 0.33;
    v.multiplyScalar(displacement);

    if (v.y < -radius * 0.4) {
      v.y = -radius * 0.4 + (v.y + radius * 0.4) * 0.4;
    }

    posAttr.setXYZ(i, v.x, v.y, v.z);
  }

  baseGeo.computeVertexNormals();
  return baseGeo;
}

export class FarmRocks3D {
  public group: THREE.Group;
  private placed = new Map<string, PlacedRockEntry>();
  private hiddenId: string | null = null;
  private selectedId: string | null = null;
  private isDisposed = false;
  private unsubscribeDiscovery: (() => void) | null = null;

  // Reusable materials
  private stoneMat: THREE.MeshStandardMaterial;
  private stoneDarkMat: THREE.MeshStandardMaterial;
  private stoneAccentMat: THREE.MeshStandardMaterial;
  private mossMat: THREE.MeshStandardMaterial;
  private grassTuftMat: THREE.MeshStandardMaterial;
  private dirtBaseMat: THREE.MeshStandardMaterial;

  // Ghost placement preview
  private ghost: THREE.Group | null = null;
  private ghostType: RockType = 'rock_small';
  private ghostRot: number = 0;
  private ghostPos = new THREE.Vector2();
  private ghostValid = true;
  private ghostMatOk: THREE.MeshBasicMaterial;
  private ghostMatBad: THREE.MeshBasicMaterial;
  private ghostFootprint: THREE.Mesh;
  public selectPlane: THREE.Mesh;

  // Cached procedural & GLB prototype groups for cloning
  private proceduralProtos = new Map<RockType, THREE.Group>();
  private glbProtos = new Map<RockType, THREE.Group>();
  private glbLoading = new Set<RockType>();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FarmRocks';

    this.stoneMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true,
    });

    this.stoneDarkMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.9,
      metalness: 0.03,
      flatShading: true,
    });

    this.stoneAccentMat = new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.82,
      metalness: 0.06,
      flatShading: true,
    });

    this.mossMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });

    this.grassTuftMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.dirtBaseMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.98,
      metalness: 0.0,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    this.ghostMatOk = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.ghostMatBad = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    const footGeo = new THREE.PlaneGeometry(GRID_CELL_SIZE * 0.96, GRID_CELL_SIZE * 0.96);
    footGeo.rotateX(-Math.PI / 2);
    this.ghostFootprint = new THREE.Mesh(footGeo, this.ghostMatOk);
    this.ghostFootprint.position.y = 0.02;

    const selGeo = new THREE.PlaneGeometry(1, 1);
    selGeo.rotateX(-Math.PI / 2);
    this.selectPlane = new THREE.Mesh(
      selGeo,
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

    this.buildPrototypes();

    // Preload decorative rock GLBs (especially Grass on a rock.glb)
    (Object.keys(ROCK_DEFS) as RockType[]).forEach((rtype) => {
      if (ROCK_DEFS[rtype].modelFile) {
        this.ensureRockGlbLoaded(rtype);
      }
    });

    this.unsubscribeDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (this.isDisposed) return;
      (Object.keys(ROCK_DEFS) as RockType[]).forEach((rtype) => {
        if (this.glbProtos.has(rtype)) return;
        const candidates = getRockGlbCandidates(rtype);
        if (candidates.includes(resolvedUrl)) {
          this.ensureRockGlbLoaded(rtype, true);
        }
      });
    });
  }

  private getActivePrototype(type: RockType): THREE.Group | null {
    return (
      this.glbProtos.get(type) ??
      this.proceduralProtos.get(type) ??
      this.proceduralProtos.get('rock_small') ??
      null
    );
  }

  private ensureRockGlbLoaded(type: RockType, bypassCache = false) {
    if (this.isDisposed || this.glbProtos.has(type) || this.glbLoading.has(type)) {
      return;
    }
    const candidates = getRockGlbCandidates(type);
    if (candidates.length === 0) return;

    this.glbLoading.add(type);
    const span = ROCK_DEFS[type]?.gridSpan ?? 1;
    const targetFootprint = span * GRID_CELL_SIZE * 0.92;

    void (async () => {
      for (const candidateUrl of candidates) {
        if (this.isDisposed) break;
        try {
          const { gltf, inspection } = await loadValidatedGLTF(candidateUrl, {
            bypassCache,
          });
          if (!gltf?.scene || gltf.scene.children.length === 0) {
            if (gltf?.scene) disposeHierarchySafely(gltf.scene);
            continue;
          }

          optimizeGLTFSceneForDevice(gltf.scene, inspection);
          const rawModel = gltf.scene;
          rawModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.userData.isSharedGlbGeometry = true;
            }
          });

          rawModel.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(rawModel);
          const size = new THREE.Vector3();
          box.getSize(size);

          const maxHoriz = Math.max(size.x, size.z, 0.001);
          const scaleFactor = THREE.MathUtils.clamp(
            targetFootprint / maxHoriz,
            0.005,
            50.0
          );

          rawModel.scale.multiplyScalar(scaleFactor);
          rawModel.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(rawModel);
          if (!scaledBox.isEmpty()) {
            rawModel.position.x -= (scaledBox.min.x + scaledBox.max.x) * 0.5;
            rawModel.position.y -= scaledBox.min.y;
            rawModel.position.z -= (scaledBox.min.z + scaledBox.max.z) * 0.5;
          }

          const wrapper = new THREE.Group();
          wrapper.name = `Proto_GLB_${type}`;
          wrapper.add(rawModel);

          this.glbLoading.delete(type);
          if (this.isDisposed) {
            disposeHierarchySafely(wrapper);
            return;
          }

          this.glbProtos.set(type, wrapper);
          this.hotSwapPlacedRocksOfType(type);
          return;
        } catch {
          // Try next candidate or stay on procedural prototype
        }
      }
      this.glbLoading.delete(type);
    })();
  }

  private hotSwapPlacedRocksOfType(type: RockType) {
    const proto = this.glbProtos.get(type);
    if (!proto) return;

    for (const entry of this.placed.values()) {
      if (entry.rock.type !== type) continue;
      while (entry.group.children.length > 0) {
        entry.group.remove(entry.group.children[0]);
      }

      const cloned = proto.clone(true);
      const picks: THREE.Object3D[] = [];
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.userData = {
            ...child.userData,
            rockId: entry.rock.id,
            isRock: true,
            rockType: entry.rock.type,
          };
          picks.push(child);
        }
      });

      entry.group.add(cloned);
      entry.picks = picks;
    }

    if (this.ghost && this.ghostType === type) {
      const prevX = this.ghost.position.x;
      const prevZ = this.ghost.position.z;
      const prevRot = this.ghostRot;
      const wasValid = this.ghostValid;
      this.startGhost(type, prevRot);
      if (this.ghost) {
        this.ghost.position.set(prevX, 0, prevZ);
        const mat = wasValid ? this.ghostMatOk : this.ghostMatBad;
        this.ghost.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = mat;
          }
        });
      }
    }
  }

  /**
   * Prebuild composite procedural rock prototypes
   */
  private buildPrototypes() {
    // ──────── 1. ก้อนหินเล็ก (Small Rock: 1x1 grid cell) ────────
    const smallGroup = new THREE.Group();
    smallGroup.name = 'Proto_RockSmall';

    const dirtGeo = new THREE.RingGeometry(0.35, 1.15, 14);
    dirtGeo.rotateX(-Math.PI / 2);
    const dirtMesh = new THREE.Mesh(dirtGeo, this.dirtBaseMat);
    dirtMesh.position.y = 0.015;
    dirtMesh.receiveShadow = true;
    smallGroup.add(dirtMesh);

    const mainGeo = createProceduralRockGeometry(0.72, 1, 0.28, 1.2);
    mainGeo.scale(1.15, 0.85, 0.95);
    const mainMesh = new THREE.Mesh(mainGeo, this.stoneMat);
    mainMesh.position.set(0, 0.32, 0);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    smallGroup.add(mainMesh);

    const mossGeo = new THREE.DodecahedronGeometry(0.32, 0);
    mossGeo.scale(1.1, 0.45, 0.85);
    const mossMesh = new THREE.Mesh(mossGeo, this.mossMat);
    mossMesh.position.set(0.18, 0.62, -0.12);
    mossMesh.rotation.set(0.2, 0.4, -0.3);
    smallGroup.add(mossMesh);

    const p1Geo = createProceduralRockGeometry(0.24, 0, 0.2, 3.4);
    const p1Mesh = new THREE.Mesh(p1Geo, this.stoneDarkMat);
    p1Mesh.position.set(0.65, 0.1, 0.32);
    p1Mesh.castShadow = true;
    p1Mesh.receiveShadow = true;
    smallGroup.add(p1Mesh);

    const p2Geo = createProceduralRockGeometry(0.18, 0, 0.2, 5.8);
    const p2Mesh = new THREE.Mesh(p2Geo, this.stoneAccentMat);
    p2Mesh.position.set(-0.58, 0.08, -0.42);
    p2Mesh.castShadow = true;
    p2Mesh.receiveShadow = true;
    smallGroup.add(p2Mesh);

    this.proceduralProtos.set('rock_small', smallGroup);

    // ──────── 2. ก้อนหินใหญ่ (Large Boulder: 2x2 grid cluster) ────────
    const largeGroup = new THREE.Group();
    largeGroup.name = 'Proto_RockLarge';

    const largeDirtGeo = new THREE.RingGeometry(0.7, 2.1, 18);
    largeDirtGeo.rotateX(-Math.PI / 2);
    const largeDirtMesh = new THREE.Mesh(largeDirtGeo, this.dirtBaseMat);
    largeDirtMesh.position.y = 0.015;
    largeDirtMesh.receiveShadow = true;
    largeGroup.add(largeDirtMesh);

    const centerGeo = createProceduralRockGeometry(1.35, 1, 0.32, 7.3);
    centerGeo.scale(1.2, 1.1, 1.05);
    const centerMesh = new THREE.Mesh(centerGeo, this.stoneDarkMat);
    centerMesh.position.set(-0.15, 0.72, 0.05);
    centerMesh.rotation.y = 0.4;
    centerMesh.castShadow = true;
    centerMesh.receiveShadow = true;
    largeGroup.add(centerMesh);

    const flankGeo = createProceduralRockGeometry(0.92, 1, 0.28, 9.1);
    flankGeo.scale(0.95, 0.85, 1.15);
    const flankMesh = new THREE.Mesh(flankGeo, this.stoneMat);
    flankMesh.position.set(0.98, 0.45, -0.32);
    flankMesh.rotation.set(0.15, -0.6, 0.25);
    flankMesh.castShadow = true;
    flankMesh.receiveShadow = true;
    largeGroup.add(flankMesh);

    const stepGeo = createProceduralRockGeometry(0.78, 0, 0.25, 2.7);
    stepGeo.scale(1.25, 0.52, 0.95);
    const stepMesh = new THREE.Mesh(stepGeo, this.stoneAccentMat);
    stepMesh.position.set(-0.95, 0.28, 0.58);
    stepMesh.rotation.set(-0.1, 0.8, -0.15);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    largeGroup.add(stepMesh);

    const moss1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), this.mossMat);
    moss1.scale.set(1.1, 0.4, 0.8);
    moss1.position.set(0.35, 0.85, -0.15);
    moss1.rotation.set(0.3, 0.5, 0.2);
    largeGroup.add(moss1);

    const moss2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), this.mossMat);
    moss2.scale.set(0.9, 0.35, 0.9);
    moss2.position.set(-0.65, 0.65, 0.25);
    largeGroup.add(moss2);

    this.proceduralProtos.set('rock_large', largeGroup);

    // ──────── 3. หญ้าบนโขดหิน (Grass on a Rock: 1x1 decorative mossy rock + lush grass crown) ────────
    const grassyRockGroup = new THREE.Group();
    grassyRockGroup.name = 'Proto_GrassOnRock';

    const grDirtGeo = new THREE.RingGeometry(0.32, 1.08, 14);
    grDirtGeo.rotateX(-Math.PI / 2);
    const grDirtMesh = new THREE.Mesh(grDirtGeo, this.dirtBaseMat);
    grDirtMesh.position.y = 0.015;
    grDirtMesh.receiveShadow = true;
    grassyRockGroup.add(grDirtMesh);

    const grBoulderGeo = createProceduralRockGeometry(0.76, 1, 0.26, 4.4);
    grBoulderGeo.scale(1.18, 0.72, 1.04);
    const grBoulder = new THREE.Mesh(grBoulderGeo, this.stoneMat);
    grBoulder.position.set(0, 0.28, 0);
    grBoulder.castShadow = true;
    grBoulder.receiveShadow = true;
    grassyRockGroup.add(grBoulder);

    const grSideStoneGeo = createProceduralRockGeometry(0.38, 0, 0.22, 8.2);
    grSideStoneGeo.scale(1.1, 0.68, 0.95);
    const grSideStone = new THREE.Mesh(grSideStoneGeo, this.stoneDarkMat);
    grSideStone.position.set(0.48, 0.16, 0.24);
    grSideStone.castShadow = true;
    grassyRockGroup.add(grSideStone);

    // Thick mossy cushion capping the boulder
    const mossCapGeo = createProceduralRockGeometry(0.58, 1, 0.18, 6.1);
    mossCapGeo.scale(1.15, 0.36, 0.98);
    const mossCap = new THREE.Mesh(mossCapGeo, this.mossMat);
    mossCap.position.set(-0.02, 0.56, 0.02);
    mossCap.castShadow = true;
    grassyRockGroup.add(mossCap);

    // Lush sprouting grass blades crowning the rock and base crevices
    const bladeGeo = new THREE.ConeGeometry(0.055, 0.42, 4);
    bladeGeo.translate(0, 0.21, 0);
    const tuftSpots: Array<[number, number, number, number, number]> = [
      [0.0, 0.62, 0.0, 1.15, 0.0],
      [-0.18, 0.58, 0.12, 0.95, 0.6],
      [0.2, 0.57, -0.1, 1.05, -0.5],
      [0.06, 0.59, -0.2, 0.88, 1.2],
      [-0.24, 0.54, -0.14, 0.82, 2.1],
      [0.54, 0.02, -0.28, 0.85, 0.4],
      [-0.56, 0.02, 0.3, 0.9, -0.8],
    ];

    for (const [tx, ty, tz, sc, baseRot] of tuftSpots) {
      for (let b = 0; b < 5; b++) {
        const ang = baseRot + (b / 5) * Math.PI * 2;
        const blade = new THREE.Mesh(bladeGeo, this.grassTuftMat);
        blade.position.set(
          tx + Math.cos(ang) * 0.06,
          ty,
          tz + Math.sin(ang) * 0.06
        );
        blade.rotation.y = ang;
        blade.rotation.z = 0.18 + (b % 2) * 0.12;
        blade.scale.setScalar(sc * (0.82 + (b % 3) * 0.12));
        blade.castShadow = true;
        grassyRockGroup.add(blade);
      }
    }

    this.proceduralProtos.set('grass_on_rock', grassyRockGroup);
  }

  /**
   * Sync placed rocks in scene with game state
   */
  public sync(rocks: PlacedRock[]) {
    const activeIds = new Set(rocks.map((r) => r.id));

    for (const [id, entry] of this.placed.entries()) {
      if (!activeIds.has(id)) {
        this.group.remove(entry.group);
        this.placed.delete(id);
      }
    }

    for (const rock of rocks) {
      let entry = this.placed.get(rock.id);
      if (!entry) {
        this.ensureRockGlbLoaded(rock.type);
        const proto = this.getActivePrototype(rock.type);
        if (!proto) continue;

        const rockGroup = new THREE.Group();
        rockGroup.name = `Rock_${rock.id}`;
        const modelClone = proto.clone(true);
        rockGroup.add(modelClone);

        const picks: THREE.Object3D[] = [];
        rockGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.userData = {
              ...child.userData,
              rockId: rock.id,
              isRock: true,
              rockType: rock.type,
            };
            picks.push(child);
          }
        });

        this.group.add(rockGroup);
        entry = { rock, group: rockGroup, picks };
        this.placed.set(rock.id, entry);
      }

      entry.group.position.set(rock.x, 0, rock.z);
      entry.group.rotation.y = rock.rot;
      entry.group.visible = rock.id !== this.hiddenId;
      entry.rock = rock;
    }
    this.syncSelectionPlane();
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
    const span = ROCK_DEFS[entry.rock.type]?.gridSpan ?? 1;
    const size = span * GRID_CELL_SIZE;
    this.selectPlane.position.set(entry.rock.x, 0.065, entry.rock.z);
    this.selectPlane.rotation.y = entry.rock.rot;
    this.selectPlane.scale.set(size, 1, size);
    this.selectPlane.visible = true;
  }

  public setSelected(id: string | null) {
    this.selectedId = id;
    this.syncSelectionPlane();
  }

  public setHiddenId(id: string | null) {
    this.hiddenId = id;
    this.placed.forEach((entry, rid) => {
      entry.group.visible = rid !== id;
    });
    this.syncSelectionPlane();
  }

  public pickRockHit(raycaster: THREE.Raycaster): { id: string; distance: number } | null {
    const allPicks: THREE.Object3D[] = [];
    for (const entry of this.placed.values()) {
      if (!entry.group.visible) continue;
      allPicks.push(...entry.picks);
    }
    const hits = raycaster.intersectObjects(allPicks, false);
    if (hits.length > 0) {
      const rockId = hits[0].object.userData.rockId;
      if (typeof rockId === 'string') return { id: rockId, distance: hits[0].distance };
    }
    return null;
  }

  public pickRock(raycaster: THREE.Raycaster): string | null {
    return this.pickRockHit(raycaster)?.id ?? null;
  }

  public startGhost(type: RockType, rot: number = 0) {
    this.hideGhost();
    this.ghostType = type;
    this.ghostRot = rot;
    this.ensureRockGlbLoaded(type);

    const ghostGroup = new THREE.Group();
    ghostGroup.name = 'RockGhost';

    const proto = this.getActivePrototype(type);
    if (proto) {
      const model = proto.clone(true);
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = this.ghostMatOk;
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
      ghostGroup.add(model);
    }

    const span = ROCK_DEFS[type]?.gridSpan ?? 1;
    const footSize = span * GRID_CELL_SIZE * 0.96;
    const footGeo = new THREE.PlaneGeometry(footSize, footSize);
    footGeo.rotateX(-Math.PI / 2);
    this.ghostFootprint.geometry.dispose();
    this.ghostFootprint.geometry = footGeo;
    this.ghostFootprint.material = this.ghostMatOk;
    ghostGroup.add(this.ghostFootprint);

    this.ghost = ghostGroup;
    this.group.add(ghostGroup);
  }

  public setGhostRot(rot: number) {
    this.ghostRot = rot;
    if (this.ghost) {
      this.ghost.rotation.y = rot;
    }
  }

  public moveGhost(
    rawX: number,
    rawZ: number,
    validator?: (gx: number, gz: number, type: RockType) => { valid: boolean; reason?: string }
  ): RockGhostState {
    const x = Math.round(rawX * 2) / 2;
    const z = Math.round(rawZ * 2) / 2;
    const { gx, gz } = worldToGrid(x, z);

    this.ghostPos.set(x, z);

    let valid = true;
    let reason = 'วางได้อย่างอิสระทุกพื้นที่';

    if (validator) {
      const res = validator(gx, gz, this.ghostType);
      valid = res.valid;
      if (res.reason) reason = res.reason;
    }

    this.ghostValid = valid;

    if (this.ghost) {
      this.ghost.position.set(x, 0, z);
      this.ghost.rotation.y = this.ghostRot;

      const mat = valid ? this.ghostMatOk : this.ghostMatBad;
      this.ghost.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = mat;
        }
      });
    }

    return { x, z, valid, reason, gridX: gx, gridZ: gz };
  }

  public hideGhost() {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubscribeDiscovery?.();
    this.unsubscribeDiscovery = null;
    this.glbLoading.clear();
    this.hideGhost();

    for (const entry of this.placed.values()) {
      this.group.remove(entry.group);
    }
    this.placed.clear();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    this.proceduralProtos.forEach((proto) => {
      proto.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry && !disposedGeos.has(mesh.geometry)) {
          disposedGeos.add(mesh.geometry);
          mesh.geometry.dispose();
        }
      });
    });
    this.proceduralProtos.clear();

    this.glbProtos.forEach((proto) => {
      disposeHierarchySafely(proto);
    });
    this.glbProtos.clear();

    this.stoneMat.dispose();
    this.stoneDarkMat.dispose();
    this.stoneAccentMat.dispose();
    this.mossMat.dispose();
    this.grassTuftMat.dispose();
    this.dirtBaseMat.dispose();
    this.ghostMatOk.dispose();
    this.ghostMatBad.dispose();
    this.ghostFootprint.geometry.dispose();
    this.selectPlane.traverse((obj) => {
      if ((obj as THREE.Line).isLine) {
        const line = obj as THREE.Line;
        line.geometry?.dispose();
        if (!Array.isArray(line.material)) {
          line.material?.dispose();
        }
      }
    });
    this.selectPlane.geometry.dispose();
    if (!Array.isArray(this.selectPlane.material)) {
      this.selectPlane.material.dispose();
    }
  }
}
