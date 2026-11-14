import * as THREE from 'three';
import { chickenSpecies } from '../animals/ChickenAnimal';
import type { AnimalRigMaterials, AnimalRuntime } from '../animals/types';
import { createChickenTexture } from '../../../utils/textures';

const HOUSE_FLOOR_TOP_Y = 0.24;
const HOUSE_LIFT = 0.24;

// ✅ cache texture ระดับ module — สร้างครั้งเดียว
let _cachedChickenTexture: THREE.Texture | null = null;
function getChickenTexture(): THREE.Texture {
  if (!_cachedChickenTexture) {
    _cachedChickenTexture = createChickenTexture();
  }
  return _cachedChickenTexture;
}

export interface CoopMaterials {
  woodLight: THREE.Material;
  woodDark: THREE.Material;
  roofMat: THREE.Material;
  strawMat: THREE.Material;
  nailMat: THREE.Material;
  wireMat: THREE.Material;
  groundMat: THREE.Material;
}

export interface CoopOptions {
  width?: number;
  depth?: number;
  wallHeight?: number;
  roofPitch?: number;
  yardWidth?: number;
  yardDepth?: number;
  maxChickens?: number;

  /** ✅ จำนวนไก่ที่ spawn อัตโนมัติ (default 4) */
  initialChickens?: number;
  /** ✅ จำนวนที่อยู่ในเล้า (default 2) — ที่เหลืออยู่ลาน */
  chickensInside?: number;
  /** ✅ ให้ไก่เดินเล่นเอง (wander) */
  autoWander?: boolean;
}

export interface CoopResult {
  root: THREE.Group;
  house: THREE.Group;
  yard: THREE.Group;
  ramp: THREE.Mesh;
  door: THREE.Mesh;
  nestBoxes: THREE.Mesh[];
  perches: THREE.Mesh[];
  waterTrough: THREE.Mesh;
  feedTrough: THREE.Mesh;
  chickens: THREE.Group;

  spawnChicken: (x: number, z: number, y?: number) => THREE.Group;
  spawnInsideCoop: (offsetX?: number, offsetZ?: number) => THREE.Group;
  spawnInYard: (x: number, z: number) => THREE.Group;

  /** ✅ เรียกใน animation loop */
  update: (dt: number, elapsed: number) => void;

  /** ✅ เรียกเมื่อไม่ใช้แล้ว — คืน memory (geometry ทั้งหมด, material ถ้า disposeMaterials=true) */
  dispose: (disposeMaterials?: boolean) => void;
}

export class ChickenCoopBuilder {
  public readonly nameEn = 'Chicken Coop';
  public readonly nameTh = 'เล้าไก่';
  public readonly emoji = '🏠';

  private _chickenMaterials: AnimalRigMaterials | null = null;

  public setChickenMaterials(mats: AnimalRigMaterials): this {
    this._chickenMaterials = mats;
    return this;
  }

  public build(
    materials: CoopMaterials,
    options: CoopOptions = {}
  ): CoopResult {
    if (!this._chickenMaterials) {
      this._chickenMaterials = ChickenCoopBuilder.createDefaultChickenMaterials();
    }
    const W = options.width ?? 2.4;
    const D = options.depth ?? 2.0;
    const H = options.wallHeight ?? 1.4;
    const PITCH = options.roofPitch ?? 0.55;
    const YW = options.yardWidth ?? 5.0;
    const YD = options.yardDepth ?? 4.0;

    // ✅ clamp ค่าให้ปลอดภัย
    const maxChickens = Math.max(0, options.maxChickens ?? 6);
    const initialChickens = Math.max(
      0, Math.min(options.initialChickens ?? 4, maxChickens)
    );
    const chickensInside = Math.max(
      0, Math.min(options.chickensInside ?? 2, initialChickens)
    );
    const autoWander = options.autoWander ?? true;

    const root = new THREE.Group();
    root.name = 'ChickenCoopRig';

    // ═══════════════════════════════════════
    // YARD
    // ═══════════════════════════════════════
    const yard = new THREE.Group();
    yard.name = 'ChickenYard';

    // ✅ ใช้ค่าเดียวกันทั้งพื้นลานและขอบ wander
    const yardCenterZ = D * 0.35;

    const yardFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(YW + 0.4, YD + 0.4),
      materials.groundMat
    );
    yardFloor.rotation.x = -Math.PI / 2;
    yardFloor.position.set(0, 0.01, yardCenterZ);
    yardFloor.receiveShadow = true;
    yard.add(yardFloor);
    yard.add(this._buildFence(YW, YD, yardCenterZ, materials));
    root.add(yard);

    // ═══════════════════════════════════════
    // HOUSE
    // ═══════════════════════════════════════
    const house = new THREE.Group();
    house.name = 'CoopHouse';
    house.position.set(0, 0, -D * 0.45);

    const floorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.15, 0.12, D + 0.15),
      materials.woodDark
    );
    floorSlab.position.set(0, HOUSE_FLOOR_TOP_Y - 0.06, 0);
    floorSlab.castShadow = true;
    floorSlab.receiveShadow = true;
    house.add(floorSlab);

    // ✅ ขาเล้า: วางจากพื้นดิน (y=0) ถึงใต้ slab (y=0.12) ไม่จมดิน
    const slabThickness = 0.12;
    const legH = HOUSE_FLOOR_TOP_Y - slabThickness; // = 0.12
    const legGeo = new THREE.BoxGeometry(0.1, legH, 0.1);
    for (const [x, z] of [
      [ W/2 - 0.06,  D/2 - 0.06], [-W/2 + 0.06,  D/2 - 0.06],
      [ W/2 - 0.06, -D/2 + 0.06], [-W/2 + 0.06, -D/2 + 0.06],
    ] as Array<[number, number]>) {
      const leg = new THREE.Mesh(legGeo, materials.woodDark);
      leg.position.set(x, legH / 2, z);
      leg.castShadow = true;
      house.add(leg);
    }

    // Walls
    const wallThickness = 0.06;
    const wallY = HOUSE_FLOOR_TOP_Y + H / 2;

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, wallThickness), materials.woodLight
    );
    backWall.position.set(0, wallY, -D / 2);
    backWall.castShadow = true; backWall.receiveShadow = true;
    house.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, H, D), materials.woodLight
    );
    leftWall.position.set(-W / 2, wallY, 0);
    leftWall.castShadow = true; leftWall.receiveShadow = true;
    house.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = W / 2;
    house.add(rightWall);

    const doorWidth = 0.55;
    const doorHeight = H * 0.78;
    const frontPanelW = (W - doorWidth) / 2;

    const frontL = new THREE.Mesh(
      new THREE.BoxGeometry(frontPanelW, H, wallThickness), materials.woodLight
    );
    frontL.position.set(-(doorWidth / 2 + frontPanelW / 2), wallY, D / 2);
    frontL.castShadow = true; house.add(frontL);

    const frontR = frontL.clone();
    frontR.position.x = doorWidth / 2 + frontPanelW / 2;
    house.add(frontR);

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, H - doorHeight, wallThickness),
      materials.woodLight
    );
    lintel.position.set(0, HOUSE_FLOOR_TOP_Y + doorHeight + (H - doorHeight)/2, D/2);
    house.add(lintel);

    // ✅ ประตู: ใช้ pivot group ที่ตำแหน่งบานพับ (ขอบซ้าย) เพื่อให้หมุนถูก
    const doorPivot = new THREE.Group();
    doorPivot.position.set(
      -doorWidth / 2,
      HOUSE_FLOOR_TOP_Y + doorHeight / 2,
      D / 2 + 0.06
    );
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 0.92, doorHeight * 0.94, 0.04),
      materials.woodDark
    );
    door.position.set(doorWidth / 2, 0, 0); // offset จาก pivot ไปยังกลางบาน
    door.castShadow = true;
    doorPivot.add(door);
    doorPivot.rotation.y = -0.9;
    house.add(doorPivot);

    // Roof
    const roofW = W + 0.35;
    const roofSlopeLen = Math.sqrt((D/2 + 0.18) ** 2 + (PITCH*D/2) ** 2) + 0.05;
    const roofBaseY = HOUSE_FLOOR_TOP_Y + H;
    const ridgeY = roofBaseY + PITCH * D / 2;

    for (const side of [1, -1] as const) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(roofW, 0.06, roofSlopeLen), materials.roofMat
      );
      panel.position.set(0, roofBaseY + (PITCH*D/2)/2, side*(D/4 + 0.09));
      panel.rotation.x = side * Math.atan2(PITCH*D/2, D/2 + 0.18);
      panel.castShadow = true; panel.receiveShadow = true;
      house.add(panel);
    }

    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(roofW + 0.04, 0.08, 0.16), materials.woodDark
    );
    ridge.position.set(0, ridgeY + 0.02, 0);
    house.add(ridge);

    // Gables
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-W/2, 0); gableShape.lineTo(W/2, 0);
    gableShape.lineTo(0, PITCH*D/2); gableShape.lineTo(-W/2, 0);
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    for (const zSign of [-1, 1] as const) {
      const gable = new THREE.Mesh(gableGeo, materials.woodLight);
      gable.position.set(0, roofBaseY, (zSign*D)/2 + zSign*0.01);
      gable.rotation.y = zSign === 1 ? 0 : Math.PI;
      gable.castShadow = true; house.add(gable);
    }

    // Nest boxes
    const nestBoxes: THREE.Mesh[] = [];
    const nestW = 0.42, nestH = 0.32, nestD = 0.38, nestCount = 3;
    const nestStartX = -((nestCount - 1) * (nestW + 0.06)) / 2;
    for (let i = 0; i < nestCount; i++) {
      const bx = nestStartX + i * (nestW + 0.06);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(nestW, nestH, nestD), materials.woodDark
      );
      box.position.set(bx, HOUSE_FLOOR_TOP_Y + nestH/2 + 0.02, -D/2 + nestD/2 + 0.03);
      box.castShadow = true; house.add(box);

      const straw = new THREE.Mesh(
        new THREE.BoxGeometry(nestW*0.85, 0.06, nestD*0.85), materials.strawMat
      );
      straw.position.set(bx, box.position.y + nestH/2 + 0.01, box.position.z);
      house.add(straw);
      nestBoxes.push(box);
    }

    // Perches
    const perches: THREE.Mesh[] = [];
    const perchGeo = new THREE.CylinderGeometry(0.035, 0.035, W*0.85, 8);
    for (let i = 0; i < 2; i++) {
      const perch = new THREE.Mesh(perchGeo, materials.woodDark);
      perch.rotation.z = Math.PI / 2;
      perch.position.set(0, HOUSE_FLOOR_TOP_Y + 0.55 + i*0.28, -D*0.15 - i*0.12);
      perch.castShadow = true;
      house.add(perch); perches.push(perch);
    }

    // Straw bedding
    const bedding = new THREE.Mesh(
      new THREE.BoxGeometry(W*0.9, 0.04, D*0.85), materials.strawMat
    );
    bedding.position.set(0, HOUSE_FLOOR_TOP_Y + 0.01, 0.02);
    bedding.receiveShadow = true;
    house.add(bedding);

    root.add(house);

    // ═══════════════════════════════════════
    // RAMP
    // ═══════════════════════════════════════
    const rampLen = 0.9;
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth * 0.9, 0.05, rampLen), materials.woodLight
    );
    ramp.position.set(0, HOUSE_FLOOR_TOP_Y / 2, house.position.z + D/2 + rampLen/2);
    ramp.rotation.x = Math.atan2(HOUSE_FLOOR_TOP_Y, rampLen);
    ramp.castShadow = true; root.add(ramp);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, rampLen), materials.woodDark
      );
      rail.position.copy(ramp.position);
      rail.position.x = side * (doorWidth*0.9/2 - 0.02);
      rail.rotation.x = ramp.rotation.x;
      rail.castShadow = true; root.add(rail);
    }

    // ═══════════════════════════════════════
    // FEED / WATER
    // ═══════════════════════════════════════
    const troughZ = house.position.z + D/2 + 1.2;
    const troughY = 0.07;

    const waterTrough = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.18, 0.1, 12), materials.woodDark
    );
    waterTrough.position.set(-YW*0.28, troughY, troughZ);
    waterTrough.castShadow = true; root.add(waterTrough);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 12),
      new THREE.MeshStandardMaterial({
        color: 0x5fa8d3, roughness: 0.15, transparent: true, opacity: 0.85,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(waterTrough.position.x, troughY + 0.045, troughZ);
    root.add(water);

    const feedTrough = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 0.28), materials.woodDark
    );
    feedTrough.position.set(YW*0.28, troughY + 0.01, troughZ);
    feedTrough.castShadow = true; root.add(feedTrough);

    const feed = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.03, 0.22), materials.strawMat
    );
    feed.position.set(feedTrough.position.x, troughY + 0.055, troughZ);
    root.add(feed);

    // ═══════════════════════════════════════
    // CHICKEN MANAGER
    // ═══════════════════════════════════════
    interface CoopChickenEntry {
      group: THREE.Group;
      runtime: AnimalRuntime;
      wander: {
        active: boolean;
        target: THREE.Vector3;
        speed: number;
        timer: number;
        homeY: number;
        minZ: number;
        maxZ: number;
        minX: number;
        maxX: number;
      };
    }

    const chickens = new THREE.Group();
    chickens.name = 'CoopChickens';
    root.add(chickens);

    const houseCenterZ = house.position.z;
    // ✅ ขอบเขตลานจริง — ใช้แทนการคำนวณซ้ำใน wander
    const yardMinZ = yardCenterZ - YD / 2 + 0.3;
    const yardMaxZ = yardCenterZ + YD / 2 - 0.3;
    const chickenEntries: CoopChickenEntry[] = [];

    // ✅ capture ไว้ใน local — TS narrow ได้ชัวร์
    const chickenMats = this._chickenMaterials;

    const spawnChicken = (x: number, z: number, y = 0): THREE.Group => {
      if (chickens.children.length >= maxChickens) {
        // ✅ เตือนให้รู้ ไม่เงียบ
        console.warn(
          `[ChickenCoop] maxChickens (${maxChickens}) reached — spawn ignored`
        );
        const empty = new THREE.Group();
        empty.userData.species = 'chicken';
        empty.userData.isCoopChicken = false;
        return empty;
      }
      if (!chickenMats) {
        console.error('[ChickenCoop] ยังไม่ได้ setChickenMaterials()');
        return new THREE.Group();
      }
      const rig = chickenSpecies.createRig(chickenMats);
      const group = rig.root;
      group.position.set(x, y, z);
      group.rotation.y = Math.random() * Math.PI * 2;
      group.userData.species = 'chicken';
      group.userData.isCoopChicken = true;

      const runtime = {
        group,
        bodyMesh: rig.bodyMesh,
        headGroup: rig.headGroup,
        legs: rig.legs,
        wings: rig.wings ?? [],
        walkCycle: Math.random() * Math.PI * 2,
        petBounce: 0,
        state: 'idle',
      } as unknown as AnimalRuntime;

      // ✅ wander bounds แยกในเล้า / ในลาน
      const insideHouse = y > 0.1;
      const wander = {
        active: autoWander,
        target: new THREE.Vector3(x, y, z),
        speed: 0.4 + Math.random() * 0.3,
        timer: Math.random() * 2,
        homeY: y,
        minX: insideHouse ? -(W / 2 - 0.3)  : -(YW / 2 - 0.3),
        maxX: insideHouse ?  (W / 2 - 0.3)  :  (YW / 2 - 0.3),
        minZ: insideHouse ? houseCenterZ - D / 2 + 0.3 : yardMinZ,
        maxZ: insideHouse ? houseCenterZ + D / 2 - 0.3 : yardMaxZ,
      };

      chickenEntries.push({ group, runtime, wander });
      chickens.add(group);
      return group;
    };

    const spawnInsideCoop = (offsetX = 0, offsetZ = 0): THREE.Group => {
      const maxX = W/2 - 0.25, maxZ = D/2 - 0.25;
      const cx = THREE.MathUtils.clamp(offsetX, -maxX, maxX);
      const cz = THREE.MathUtils.clamp(offsetZ, -maxZ, maxZ);
      return spawnChicken(cx, houseCenterZ + cz, HOUSE_FLOOR_TOP_Y);
    };

    const spawnInYard = (x: number, z: number): THREE.Group => {
      return spawnChicken(x, z, 0.02);
    };

    // ═══════════════════════════════════════
    // AUTO SPAWN
    // ═══════════════════════════════════════
    // ✅ กระจายไก่ในเล้าตามพื้นที่จริง (ไม่ซ้อนกัน)
    for (let i = 0; i < chickensInside; i++) {
      const angle = (i / Math.max(1, chickensInside)) * Math.PI * 2;
      const rx = (W / 2 - 0.35) * 0.75;
      const rz = (D / 2 - 0.35) * 0.75;
      spawnInsideCoop(Math.cos(angle) * rx, Math.sin(angle) * rz);
    }
    // ลูปนี้จะไม่ทำงานถ้า chickensInside === initialChickens (ไก่อยู่เล้าหมด)
    const yardCount = initialChickens - chickensInside;
    for (let i = 0; i < yardCount; i++) {
      const angle = (i / Math.max(1, yardCount)) * Math.PI * 2;
      const r = 1.2;
      spawnInYard(
        Math.cos(angle) * r,
        yardCenterZ + Math.sin(angle) * r * 0.6
      );
    }

    // ═══════════════════════════════════════
    // UPDATE LOOP
    // ═══════════════════════════════════════
    const _v = new THREE.Vector3();

    const update = (dt: number, elapsed: number): void => {
      for (const entry of chickenEntries) {
        const { group: child, runtime, wander } = entry;
        runtime.walkCycle += dt * 6.0;

        let isWalking = false;

        if (wander.active) {
          wander.timer -= dt;
          if (wander.timer <= 0) {
            wander.target.set(
              THREE.MathUtils.randFloat(wander.minX, wander.maxX),
              wander.homeY,
              THREE.MathUtils.randFloat(wander.minZ, wander.maxZ)
            );
            wander.timer = 2 + Math.random() * 3;
          }

          _v.copy(wander.target).sub(child.position);
          _v.y = 0;
          const dist = _v.length();
          if (dist > 0.05) {
            isWalking = true;
            _v.normalize();
            const step = wander.speed * dt;
            child.position.x += _v.x * step;
            child.position.z += _v.z * step;
            const targetYaw = Math.atan2(_v.x, _v.z);
            child.rotation.y = THREE.MathUtils.lerp(
              child.rotation.y, targetYaw, dt * 3.0
            );
          }
        }

        runtime.state = isWalking ? 'walking' : 'grazing';
        chickenSpecies.animate(runtime, dt, elapsed, isWalking, wander.speed);
      }
    };

    // ═══════════════════════════════════════
    // DISPOSE
    // ═══════════════════════════════════════
    // ✅ คืน memory: หยุด mixer ของไก่ และไม่เผลอลบ shared geometry/material ของ chicken.glb
    const dispose = (disposeMaterials = false): void => {
      for (const entry of chickenEntries) {
        chickenSpecies.disposeRig(entry.group);
      }
      chickenEntries.length = 0;

      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          if (!mesh.userData?.isSharedGlbGeometry) {
            mesh.geometry?.dispose();
          }
          if (disposeMaterials && !mesh.userData?.isSharedGlbMaterial) {
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            for (const m of mats) {
              if (m && typeof (m as THREE.Material).dispose === 'function') {
                (m as THREE.Material).dispose();
              }
            }
          }
        }
      });
      root.clear();
    };

    return {
      root, house, yard, ramp, door, nestBoxes, perches,
      waterTrough, feedTrough, chickens,
      spawnChicken, spawnInsideCoop, spawnInYard, update, dispose,
    };
  }

  // ───── Fence ─────
  private _buildFence(
    width: number, depth: number, zOffset: number, materials: CoopMaterials
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'CoopFence';

    const postGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);
    const railGeo = new THREE.BoxGeometry(1, 0.04, 0.04);
    const halfW = width / 2, halfD = depth / 2, spacing = 0.55;

    const placePost = (x: number, z: number) => {
      const p = new THREE.Mesh(postGeo, materials.woodDark);
      p.position.set(x, 0.28, z + zOffset);
      p.castShadow = true; group.add(p);
    };
    const placeRail = (
      x1: number, z1: number, x2: number, z2: number, y: number
    ) => {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      const rail = new THREE.Mesh(railGeo, materials.woodLight);
      rail.scale.x = len;
      rail.position.set((x1 + x2)/2, y, (z1 + z2)/2 + zOffset);
      rail.rotation.y = Math.atan2(dz, dx);
      rail.castShadow = true; group.add(rail);
    };

    const sides: Array<[number, number, number, number]> = [
      [-halfW, -halfD,  halfW, -halfD],
      [-halfW,  halfD,  halfW,  halfD],
      [-halfW, -halfD, -halfW,  halfD],
      [ halfW, -halfD,  halfW,  halfD],
    ];

    for (const [x1, z1, x2, z2] of sides) {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      const nPosts = Math.max(2, Math.round(len / spacing) + 1);
      for (let i = 0; i < nPosts; i++) {
        const t = i / (nPosts - 1);
        placePost(x1 + dx*t, z1 + dz*t);
      }
      placeRail(x1, z1, x2, z2, 0.18);
      placeRail(x1, z1, x2, z2, 0.42);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 0.4), materials.wireMat
      );
      mesh.position.set((x1+x2)/2, 0.3, (z1+z2)/2 + zOffset);
      mesh.rotation.y = Math.atan2(dz, dx);
      // ✅ เปิด shadow ให้สอดคล้องกับส่วนอื่น
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  public static createMaterials(): CoopMaterials {
    return {
      woodLight: new THREE.MeshStandardMaterial({ color: 0xc19a6b, roughness: 0.85 }),
      woodDark:  new THREE.MeshStandardMaterial({ color: 0x8b6b3e, roughness: 0.9 }),
      roofMat:   new THREE.MeshStandardMaterial({ color: 0xa63d2f, roughness: 0.6, metalness: 0.15 }),
      strawMat:  new THREE.MeshStandardMaterial({ color: 0xe6c76b, roughness: 1.0 }),
      nailMat:   new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9 }),
      wireMat:   new THREE.MeshStandardMaterial({
        color: 0x555555, roughness: 0.5, metalness: 0.6,
        transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      }),
      groundMat: new THREE.MeshStandardMaterial({ color: 0x6b7d3a, roughness: 1.0 }),
    };
  }

  public static createDefaultChickenMaterials(): AnimalRigMaterials {
    // ✅ ใช้ texture จาก cache (สร้างครั้งเดียวทั้งโปรเซส)
    const chickenTex = getChickenTexture();
    return {
      cowMat: new THREE.MeshBasicMaterial(),
      pigMat: new THREE.MeshBasicMaterial(),
      chickenMat: new THREE.MeshStandardMaterial({ map: chickenTex, roughness: 0.8, metalness: 0.02 }),
      goatMat: new THREE.MeshBasicMaterial(),
      pinkMuzzleMat: new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0xffb5b5 }),
      darkHoofMat: new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0x2b2b2b }),
      hornIvoryMat: new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xe0d6b5 }),
      chickenCombMat: new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xd32f2f }),
      chickenBeakMat: new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xffb300 }),
      darkEyeMat: new THREE.MeshStandardMaterial({ roughness: 0.3, color: 0x111111 }),
    };
  }
}

export const chickenCoopBuilder = new ChickenCoopBuilder();