// src/components/3d/structures/DuckCoop.ts
import * as THREE from 'three';
import { shortestAngleDiff } from '../../../utils/calculus';
import type { AnimalRigMaterials } from '../animals/types';
import { createAnimatedDuckInstance, type AnimatedDuckInstance } from '../animals/DuckAnimal';
import type { CoopMaterials } from './ChickenCoop';

const HOUSE_FLOOR_TOP_Y = 0.22;

export interface DuckCoopOptions {
  width?: number;
  depth?: number;
  wallHeight?: number;
  roofPitch?: number;
  yardWidth?: number;
  yardDepth?: number;
  maxDucks?: number;
  initialDucks?: number;
  autoWander?: boolean;
}

export interface DuckCoopResult {
  root: THREE.Group;
  house: THREE.Group;
  yard: THREE.Group;
  pond: THREE.Group;
  ducks: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

export class DuckCoopBuilder {
  public readonly nameEn = 'Duck Coop & Pond Run';
  public readonly nameTh = 'เล้าเป็ดพร้อมสระน้ำ';
  public readonly emoji = '🦆';

  private _animalMaterials: Partial<AnimalRigMaterials> | null = null;

  public setAnimalMaterials(mats: Partial<AnimalRigMaterials>): this {
    this._animalMaterials = mats;
    return this;
  }

  public build(
    materials: CoopMaterials,
    options: DuckCoopOptions = {}
  ): DuckCoopResult {
    const W = options.width ?? 2.6;
    const D = options.depth ?? 2.0;
    const H = options.wallHeight ?? 1.45;
    const PITCH = options.roofPitch ?? 0.56;
    const YW = options.yardWidth ?? 5.2;
    const YD = options.yardDepth ?? 4.3;

    const maxDucks = Math.max(0, options.maxDucks ?? 7);
    const initialDucks = Math.max(0, Math.min(options.initialDucks ?? 5, maxDucks));
    const autoWander = options.autoWander ?? true;

    const ownedMaterials: THREE.Material[] = [];
    const makeOwnedMat = (params: THREE.MeshStandardMaterialParameters) => {
      const mat = new THREE.MeshStandardMaterial(params);
      ownedMaterials.push(mat);
      return mat;
    };

    const pondWaterMat = makeOwnedMat({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86,
    });
    const pebbleMat = makeOwnedMat({
      color: 0x94a3b8,
      roughness: 0.88,
    });
    const lilyMat = makeOwnedMat({
      color: 0x4ade80,
      roughness: 0.72,
    });
    const duckEggMat = makeOwnedMat({
      color: 0xfefce8,
      roughness: 0.35,
    });

    const root = new THREE.Group();
    root.name = 'DuckCoopRig';

    // ═══════════════════════════════════════
    // 1. FENCED YARD & RUN
    // ═══════════════════════════════════════
    const yard = new THREE.Group();
    yard.name = 'DuckYard';

    const yardCenterZ = D * 0.36;

    const yardFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(YW + 0.35, YD + 0.35),
      materials.groundMat
    );
    yardFloor.rotation.x = -Math.PI / 2;
    yardFloor.position.set(0, 0.012, yardCenterZ);
    yardFloor.receiveShadow = true;
    yard.add(yardFloor);

    yard.add(this._buildFence(YW, YD, yardCenterZ, materials));
    root.add(yard);

    // ═══════════════════════════════════════
    // 2. TIMBER DUCK COOP HOUSE (SLAT WALLS)
    // ═══════════════════════════════════════
    const house = new THREE.Group();
    house.name = 'DuckCoopHouse';
    house.position.set(-0.65, 0, -D * 0.45);

    const floorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.16, 0.12, D + 0.16),
      materials.woodDark
    );
    floorSlab.position.set(0, HOUSE_FLOOR_TOP_Y - 0.06, 0);
    floorSlab.castShadow = true;
    floorSlab.receiveShadow = true;
    house.add(floorSlab);

    const legH = HOUSE_FLOOR_TOP_Y - 0.12;
    const legGeo = new THREE.BoxGeometry(0.11, legH, 0.11);
    for (const [lx, lz] of [
      [W / 2 - 0.07, D / 2 - 0.07],
      [-W / 2 + 0.07, D / 2 - 0.07],
      [W / 2 - 0.07, -D / 2 + 0.07],
      [-W / 2 + 0.07, -D / 2 + 0.07],
    ] as Array<[number, number]>) {
      const leg = new THREE.Mesh(legGeo, materials.woodDark);
      leg.position.set(lx, legH / 2, lz);
      leg.castShadow = true;
      house.add(leg);
    }

    // ── Wall slat helper ──────────────────────────────────
    // สร้างกำแพงไม้ซี่แนวตั้งตามแนวยาว `length` (ตามแกน local X)
    // วางตำแหน่งกึ่งกลางที่ (centerX, wallY, centerZ) และหมุนรอบ Y ตาม `rotY`
    const wallThick = 0.06;
    const wallY = HOUSE_FLOOR_TOP_Y + H / 2;

    const slatWallConfig = {
      slatWidth: 0.085, // ความกว้างซี่ (ตามแนวยาว)
      slatGap: 0.02,    // ช่องไฟระหว่างซี่
      slatDepth: wallThick,
    };

    /** สร้างกลุ่มไม้ซี่แนวตั้งสำหรับผนังด้านหนึ่ง */
    const buildSlatWall = (
      length: number,
      centerX: number,
      centerZ: number,
      rotY: number,
      gapStart = 0,
      gapEnd = 0
    ): THREE.Group => {
      const wall = new THREE.Group();
      wall.position.set(centerX, 0, centerZ);
      wall.rotation.y = rotY;

      const { slatWidth, slatGap, slatDepth } = slatWallConfig;
      const usable = length - slatGap;
      const n = Math.max(2, Math.floor(usable / (slatWidth + slatGap)));
      const totalW = n * slatWidth + (n - 1) * slatGap;
      const startX = -totalW / 2 + slatWidth / 2;

      for (let i = 0; i < n; i++) {
        const x = startX + i * (slatWidth + slatGap);
        // ข้ามซี่ที่ตกอยู่ในช่วงช่องประตู (gapStart..gapEnd) ถ้ามี
        if (gapEnd > gapStart && x > gapStart && x < gapEnd) continue;

        const mat = i % 2 === 0 ? materials.woodLight : materials.woodDark;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(slatWidth, H, slatDepth),
          mat
        );
        slat.position.set(x, wallY, 0);
        slat.castShadow = true;
        slat.receiveShadow = true;
        wall.add(slat);
      }
      return wall;
    };

    // ── ผนังหลัง (Back wall) — ตามแนวแกน X ที่ z = -D/2 ──
    house.add(buildSlatWall(W, 0, -D / 2, 0));

    // ── ผนังซ้าย (Left wall) — ตามแนวแกน Z ที่ x = -W/2 ──
    house.add(buildSlatWall(D, -W / 2, 0, Math.PI / 2));

    // ── ผนังขวา (Right wall) — ตามแนวแกน Z ที่ x = +W/2 ──
    house.add(buildSlatWall(D, W / 2, 0, -Math.PI / 2));

    // ── ผนังหน้า (Front wall) — เว้นช่องประตูตรงกลาง ──
    const doorWidth = 0.64;
    const doorHeight = H * 0.76;

    house.add(buildSlatWall(W, 0, D / 2, 0, -doorWidth / 2, doorWidth / 2));

    // คานทับหลังเหนือประตู (lintel) — ยังเป็นไม้ทึบเพื่อความแข็งแรง
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, H - doorHeight, wallThick),
      materials.woodLight
    );
    lintel.position.set(0, HOUSE_FLOOR_TOP_Y + doorHeight + (H - doorHeight) / 2, D / 2);
    lintel.castShadow = true;
    house.add(lintel);

    // ── คานหัว/ท้ายผนัง (wall plates) — เพิ่มความแน่นให้โครงสร้าง ──
    const plateMat = materials.woodDark;
    const topPlateY = HOUSE_FLOOR_TOP_Y + H - 0.03;
    const botPlateY = HOUSE_FLOOR_TOP_Y + 0.03;
    for (const [plLen, plX, plZ, plRotY] of [
      [W + 0.08, 0, -D / 2, 0],
      [W + 0.08, 0, D / 2, 0],
      [D + 0.08, -W / 2, 0, Math.PI / 2],
      [D + 0.08, W / 2, 0, Math.PI / 2],
    ] as Array<[number, number, number, number]>) {
      for (const py of [topPlateY, botPlateY]) {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(plLen, 0.06, wallThick + 0.02),
          plateMat
        );
        plate.position.set(plX, py, plZ);
        plate.rotation.y = plRotY;
        plate.castShadow = true;
        house.add(plate);
      }
    }

    // Open wooden coop door on left hinge
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorWidth / 2, HOUSE_FLOOR_TOP_Y + doorHeight / 2, D / 2 + 0.05);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 0.9, doorHeight * 0.92, 0.04),
      materials.woodDark
    );
    door.position.set(doorWidth * 0.45, 0, 0);
    door.castShadow = true;
    doorPivot.add(door);
    doorPivot.rotation.y = -1.05;
    house.add(doorPivot);

    // ═══════════════════════════════════════
    // WOODEN SLAT ROOF (หลังคาไม้ซี่)
    // ═══════════════════════════════════════
    const roofW = W + 0.36;
    const roofSlopeLen = Math.sqrt((D / 2 + 0.18) ** 2 + ((PITCH * D) / 2) ** 2) + 0.06;
    const roofBaseY = HOUSE_FLOOR_TOP_Y + H;
    const ridgeY = roofBaseY + (PITCH * D) / 2;
    const slatPitchAngle = Math.atan2((PITCH * D) / 2, D / 2 + 0.18);

    const roofSlatCount = 9;
    const roofSlatGap = 0.02;
    const roofSlatThick = 0.045;
    const roofSlatWidth = (roofW - roofSlatGap * (roofSlatCount - 1)) / roofSlatCount;

    for (const side of [1, -1] as const) {
      for (let i = 0; i < roofSlatCount; i++) {
        const slatMat = i % 2 === 0 ? materials.woodLight : materials.woodDark;
        const slat = new THREE.Mesh(
          new THREE.BoxGeometry(roofSlatWidth, roofSlatThick, roofSlopeLen),
          slatMat
        );

        const offsetX = -roofW / 2 + roofSlatWidth / 2 + i * (roofSlatWidth + roofSlatGap);
        slat.position.set(
          offsetX,
          roofBaseY + (PITCH * D) / 4,
          side * (D / 4 + 0.09)
        );
        slat.rotation.x = side * slatPitchAngle;

        slat.castShadow = true;
        slat.receiveShadow = true;
        house.add(slat);
      }
    }

    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(roofW + 0.05, 0.08, 0.16),
      materials.woodDark
    );
    ridge.position.set(0, ridgeY + 0.02, 0);
    ridge.castShadow = true;
    house.add(ridge);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-W / 2, 0);
    gableShape.lineTo(W / 2, 0);
    gableShape.lineTo(0, (PITCH * D) / 2);
    gableShape.lineTo(-W / 2, 0);
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    for (const zSign of [-1, 1] as const) {
      const gable = new THREE.Mesh(gableGeo, materials.woodLight);
      gable.position.set(0, roofBaseY, (zSign * D) / 2 + zSign * 0.01);
      gable.rotation.y = zSign === 1 ? 0 : Math.PI;
      gable.castShadow = true;
      house.add(gable);
    }

    // Exterior side Egg Collection Nest Box with fresh duck eggs
    const sideNestGroup = new THREE.Group();
    sideNestGroup.position.set(W / 2 + 0.2, HOUSE_FLOOR_TOP_Y + 0.24, 0);
    const sideNestBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.34, 1.15),
      materials.woodDark
    );
    sideNestBox.castShadow = true;
    sideNestGroup.add(sideNestBox);

    const sideNestStraw = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.06, 1.05),
      materials.strawMat
    );
    sideNestStraw.position.set(0, 0.15, 0);
    sideNestGroup.add(sideNestStraw);

    const eggGeo = new THREE.SphereGeometry(0.055, 10, 8);
    for (const ez of [-0.32, 0, 0.32]) {
      const egg = new THREE.Mesh(eggGeo, duckEggMat);
      egg.scale.set(0.85, 1.22, 0.85);
      egg.position.set(0.03, 0.2, ez);
      egg.rotation.z = 0.25;
      egg.castShadow = true;
      sideNestGroup.add(egg);
    }
    house.add(sideNestGroup);

    // Interior straw bedding
    const bedding = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.9, 0.045, D * 0.86),
      materials.strawMat
    );
    bedding.position.set(0, HOUSE_FLOOR_TOP_Y + 0.02, 0);
    bedding.receiveShadow = true;
    house.add(bedding);

    root.add(house);

    // Wooden ramp from coop door down into the yard
    const rampLen = 0.85;
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 0.88, 0.05, rampLen),
      materials.woodLight
    );
    ramp.position.set(
      house.position.x,
      HOUSE_FLOOR_TOP_Y / 2,
      house.position.z + D / 2 + rampLen / 2
    );
    ramp.rotation.x = Math.atan2(HOUSE_FLOOR_TOP_Y, rampLen);
    ramp.castShadow = true;
    root.add(ramp);

    // ═══════════════════════════════════════
    // 3. SHALLOW WADING POND & GRAIN FEEDER
    // ═══════════════════════════════════════
    const pond = new THREE.Group();
    pond.name = 'DuckWadingPond';
    const pondCenterX = 1.15;
    const pondCenterZ = yardCenterZ + 0.42;
    pond.position.set(pondCenterX, 0.02, pondCenterZ);

    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.02, 24),
      pondWaterMat
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.scale.set(1.12, 0.88, 1);
    waterDisc.position.y = 0.018;
    waterDisc.receiveShadow = true;
    pond.add(waterDisc);

    // Smooth river pebbles rimming the pond
    const pebbleGeo = new THREE.SphereGeometry(0.11, 8, 6);
    const pebbleCount = 18;
    for (let i = 0; i < pebbleCount; i++) {
      const ang = (i / pebbleCount) * Math.PI * 2;
      const px = Math.cos(ang) * 1.14;
      const pz = Math.sin(ang) * 0.9;
      const pebble = new THREE.Mesh(pebbleGeo, pebbleMat);
      const s = 0.85 + ((i * 37) % 10) * 0.04;
      pebble.scale.set(s * 1.2, s * 0.55, s);
      pebble.position.set(px, 0.02, pz);
      pebble.rotation.y = ang;
      pebble.castShadow = true;
      pebble.receiveShadow = true;
      pond.add(pebble);
    }

    // Floating lily pads
    const lilyGeo = new THREE.CircleGeometry(0.16, 12, 0, Math.PI * 1.82);
    for (const [lx, lz, rot] of [
      [0.42, -0.28, 0.6],
      [-0.48, 0.3, 2.3],
    ] as Array<[number, number, number]>) {
      const lily = new THREE.Mesh(lilyGeo, lilyMat);
      lily.rotation.x = -Math.PI / 2;
      lily.rotation.z = rot;
      lily.position.set(lx, 0.024, lz);
      pond.add(lily);
    }

    root.add(pond);

    // Grain Feed Trough on the left side of the yard
    const feedTroughX = -1.35;
    const feedTroughZ = yardCenterZ + 0.85;
    const feedTrough = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.11, 0.34),
      materials.woodDark
    );
    feedTrough.position.set(feedTroughX, 0.06, feedTroughZ);
    feedTrough.castShadow = true;
    root.add(feedTrough);

    const feedGrain = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.04, 0.26),
      materials.strawMat
    );
    feedGrain.position.set(feedTroughX, 0.1, feedTroughZ);
    root.add(feedGrain);

    // ═══════════════════════════════════════
    // 4. ANIMATED DUCK FLOCK (duck_walk.glb)
    // ═══════════════════════════════════════
    interface CoopDuckAgent {
      instance: AnimatedDuckInstance;
      state: 'walking' | 'resting';
      timer: number;
      target: THREE.Vector3;
      speed: number;
      heading: number;
      walkPhase: number;
    }

    const ducks = new THREE.Group();
    ducks.name = 'CoopDucks';
    root.add(ducks);

    const safeMinX = -(YW / 2 - 0.42);
    const safeMaxX = YW / 2 - 0.42;
    const houseFrontZ = house.position.z + D / 2 + 0.22;
    const safeMinZ = Math.max(yardCenterZ - YD / 2 + 0.42, houseFrontZ);
    const safeMaxZ = yardCenterZ + YD / 2 - 0.42;

    const duckAgents: CoopDuckAgent[] = [];
    const animalMats = this._animalMaterials ?? undefined;

    const pickNextDuckTarget = (target: THREE.Vector3) => {
      if (Math.random() < 0.35) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.72;
        target.set(
          THREE.MathUtils.clamp(pondCenterX + Math.cos(ang) * r, safeMinX, safeMaxX),
          0.02,
          THREE.MathUtils.clamp(pondCenterZ + Math.sin(ang) * r * 0.78, safeMinZ, safeMaxZ)
        );
        return;
      }
      target.set(
        THREE.MathUtils.randFloat(safeMinX, safeMaxX),
        0.02,
        THREE.MathUtils.randFloat(safeMinZ, safeMaxZ)
      );
    };

    for (let i = 0; i < initialDucks; i++) {
      const instance = createAnimatedDuckInstance(animalMats);
      const angle = (i / Math.max(1, initialDucks)) * Math.PI * 2;
      const startX = THREE.MathUtils.clamp(
        Math.cos(angle) * 1.35,
        safeMinX,
        safeMaxX
      );
      const startZ = THREE.MathUtils.clamp(
        (safeMinZ + safeMaxZ) * 0.5 + Math.sin(angle) * 0.75,
        safeMinZ,
        safeMaxZ
      );
      const startHeading = Math.random() * Math.PI * 2;

      instance.group.position.set(startX, 0.02, startZ);
      instance.group.rotation.y = startHeading;

      const target = new THREE.Vector3(startX, 0.02, startZ);
      pickNextDuckTarget(target);

      duckAgents.push({
        instance,
        state: autoWander ? 'walking' : 'resting',
        timer: 1.5 + Math.random() * 3.5,
        target,
        speed: 0.48 + Math.random() * 0.24,
        heading: startHeading,
        walkPhase: Math.random() * Math.PI * 2,
      });

      ducks.add(instance.group);
    }

    // ═══════════════════════════════════════
    // 5. UPDATE LOOP (60 FPS SUB-STEP SAFE)
    // ═══════════════════════════════════════
    const _dir = new THREE.Vector3();

    const update = (dt: number, elapsed: number): void => {
      waterDisc.position.y = 0.018 + Math.sin(elapsed * 2.1) * 0.004;

      for (let i = 0; i < duckAgents.length; i++) {
        const agent = duckAgents[i];
        const obj = agent.instance.group;

        let isWalking = false;
        let activeSpeed = 0;

        if (autoWander) {
          agent.timer -= dt;
          if (agent.state === 'walking') {
            _dir.subVectors(agent.target, obj.position);
            _dir.y = 0;
            const dist = _dir.length();

            if (dist < 0.12 || agent.timer <= 0) {
              agent.state = 'resting';
              agent.timer = 1.2 + Math.random() * 2.4;
            } else {
              isWalking = true;
              _dir.normalize();

              const targetHeading = Math.atan2(_dir.x, _dir.z);
              const diff = shortestAngleDiff(agent.heading, targetHeading);
              agent.heading += diff * Math.min(1, dt * 5.0);
              obj.rotation.y = agent.heading;

              const arriveScale = Math.min(1, dist / 0.55);
              activeSpeed = agent.speed * Math.max(0.35, Math.cos(diff)) * arriveScale;

              obj.position.x = THREE.MathUtils.clamp(
                obj.position.x + Math.sin(agent.heading) * activeSpeed * dt,
                safeMinX,
                safeMaxX
              );
              obj.position.z = THREE.MathUtils.clamp(
                obj.position.z + Math.cos(agent.heading) * activeSpeed * dt,
                safeMinZ,
                safeMaxZ
              );
              agent.walkPhase += (activeSpeed / 0.35) * Math.PI * 2 * dt;
            }
          } else if (agent.timer <= 0) {
            pickNextDuckTarget(agent.target);
            agent.state = 'walking';
            agent.timer = 3.0 + Math.random() * 4.5;
          }
        }

        agent.instance.update(
          dt,
          elapsed,
          isWalking,
          activeSpeed,
          agent.walkPhase
        );
      }
    };

    // ═══════════════════════════════════════
    // 6. DISPOSE
    // ═══════════════════════════════════════
    const dispose = (disposeMaterials = false): void => {
      for (const agent of duckAgents) {
        agent.instance.dispose();
      }
      duckAgents.length = 0;

      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.isSharedGlbGeometry) {
          mesh.geometry?.dispose();
          if (disposeMaterials) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              m?.dispose();
            }
          }
        }
      });

      for (const m of ownedMaterials) {
        m.dispose();
      }
      ownedMaterials.length = 0;
      root.clear();
    };

    return {
      root,
      house,
      yard,
      pond,
      ducks,
      update,
      dispose,
    };
  }

  private _buildFence(
    width: number,
    depth: number,
    zOffset: number,
    materials: CoopMaterials
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'DuckCoopFence';

    const postGeo = new THREE.BoxGeometry(0.085, 0.58, 0.085);
    const railGeo = new THREE.BoxGeometry(1, 0.045, 0.045);
    const halfW = width / 2;
    const halfD = depth / 2;
    const spacing = 0.6;

    const placePost = (x: number, z: number) => {
      const p = new THREE.Mesh(postGeo, materials.woodDark);
      p.position.set(x, 0.29, z + zOffset);
      p.castShadow = true;
      group.add(p);
    };

    const placeRail = (x1: number, z1: number, x2: number, z2: number, y: number) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const rail = new THREE.Mesh(railGeo, materials.woodLight);
      rail.scale.x = len;
      rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2 + zOffset);
      rail.rotation.y = Math.atan2(dz, dx);
      rail.castShadow = true;
      group.add(rail);
    };

    const sides: Array<[number, number, number, number]> = [
      [-halfW, -halfD, halfW, -halfD],
      [-halfW, halfD, halfW, halfD],
      [-halfW, -halfD, -halfW, halfD],
      [halfW, -halfD, halfW, halfD],
    ];

    for (const [x1, z1, x2, z2] of sides) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const nPosts = Math.max(2, Math.round(len / spacing) + 1);
      for (let i = 0; i < nPosts; i++) {
        const t = i / (nPosts - 1);
        placePost(x1 + dx * t, z1 + dz * t);
      }
      placeRail(x1, z1, x2, z2, 0.19);
      placeRail(x1, z1, x2, z2, 0.45);

      const wire = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 0.42),
        materials.wireMat
      );
      wire.position.set((x1 + x2) / 2, 0.31, (z1 + z2) / 2 + zOffset);
      wire.rotation.y = Math.atan2(dz, dx);
      wire.castShadow = true;
      wire.receiveShadow = true;
      group.add(wire);
    }

    return group;
  }
}

export const duckCoopBuilder = new DuckCoopBuilder();