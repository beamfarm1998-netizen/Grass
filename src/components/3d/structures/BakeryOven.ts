// src/components/3d/structures/BakeryOven.ts
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../../utils/glbThumbnail';
import type { BakedGoodType, OvenMachineType } from '../../../types/game';
import type { HouseMaterials } from './HouseMeshBuilder';

const OVEN_GLB_CANDIDATES: Record<OvenMachineType, readonly string[]> = {
  bakery: ['/Bakery.glb', '/bakery.glb', '/models/Bakery.glb'],
  pie_oven: [
    '/PieOven.glb',
    '/pie-oven.glb',
    '/pie_oven.glb',
    '/Pie_Oven.glb',
    '/models/PieOven.glb',
  ],
};

const TARGET_OVEN_BODY_FOOTPRINT = 3.8;
const SMOKE_PUFF_COUNT = 14;
const CONVEYOR_SLIDE_DURATION_SEC = 2.2;

export interface ReadyOvenVisualItem {
  id: string;
  itemType: BakedGoodType;
}

export interface OvenVisualState {
  activeCount: number;
  readyItems: ReadyOvenVisualItem[];
}

export interface BakeryOvenOptions {
  machine: OvenMachineType;
  enableMotionAndSmoke?: boolean;
}

export interface BakeryOvenResult {
  root: THREE.Group;
  setOvenState: (state: OvenVisualState) => void;
  update: (dt: number, elapsed: number) => void;
  dispose: (disposeMaterials?: boolean) => void;
}

interface SmokePuff {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  age: number;
  lifetime: number;
  driftX: number;
  driftZ: number;
  phase: number;
}

interface TrackedBakedMesh {
  id: string;
  itemType: BakedGoodType;
  mesh: THREE.Group;
  progress: number; // 0 = oven mouth, 1 = landed inside wicker basket
  slotIndex: number;
}

interface CachedOvenGlb {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  smokeAnchor: THREE.Vector3;
}

const _cachedOvenModels = new Map<OvenMachineType, CachedOvenGlb>();
const _loadingPromises = new Map<OvenMachineType, Promise<boolean>>();

function ensureOvenGlbCached(machine: OvenMachineType, bypassCache = false): Promise<boolean> {
  if (_cachedOvenModels.has(machine) && !bypassCache) {
    return Promise.resolve(true);
  }
  const existing = _loadingPromises.get(machine);
  if (existing && !bypassCache) {
    return existing;
  }

  const candidates = OVEN_GLB_CANDIDATES[machine];
  const promise = (async () => {
    for (const candidate of candidates) {
      try {
        const { gltf, inspection } = await loadValidatedGLTF(candidate, { bypassCache });
        const raw = gltf.scene;
        optimizeGLTFSceneForDevice(raw, inspection, false);

        const wrapper = new THREE.Group();
        wrapper.name = machine === 'bakery' ? 'BakeryGLBBody' : 'PieOvenGLBBody';
        wrapper.add(raw);
        wrapper.updateMatrixWorld(true);

        const smokeAnchor = new THREE.Vector3(-0.6, 3.65, -0.35);
        const box = new THREE.Box3().setFromObject(wrapper);
        if (!box.isEmpty()) {
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxHoriz = Math.max(size.x, size.z, 0.001);
          const scale = TARGET_OVEN_BODY_FOOTPRINT / maxHoriz;
          raw.scale.multiplyScalar(scale);
          wrapper.updateMatrixWorld(true);

          const scaledBox = new THREE.Box3().setFromObject(wrapper);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          raw.position.x -= scaledCenter.x;
          raw.position.z -= scaledCenter.z;
          raw.position.y -= scaledBox.min.y;
          wrapper.updateMatrixWorld(true);

          const finalBox = new THREE.Box3().setFromObject(wrapper);
          const topY = finalBox.max.y;
          smokeAnchor.set(-0.65, topY - 0.05, -0.2);
        }

        _cachedOvenModels.set(machine, {
          scene: wrapper,
          clips: gltf.animations ?? [],
          smokeAnchor,
        });
        _loadingPromises.delete(machine);
        return true;
      } catch {
        // Try next candidate or stay on composite procedural oven
      }
    }
    _loadingPromises.delete(machine);
    return false;
  })();

  _loadingPromises.set(machine, promise);
  return promise;
}

/**
 * สร้างโมเดล 3D ของเบเกอรี่ พิซซ่า และพายแต่ละชนิดสำหรับเลื่อนบนรางเลื่อนลงสู่ตะกร้า
 */
function createBakedGoodMesh(itemType: BakedGoodType, localMats: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  g.name = `BakedGood_${itemType}`;
  g.userData.excludeFromPaint = true;

  const regMat = (m: THREE.MeshStandardMaterial) => {
    localMats.push(m);
    return m;
  };

  if (itemType === 'white_bread') {
    const crustMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.68 })
    );
    const scoreMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 })
    );

    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.22, 8, 12), crustMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.scale.set(1, 1, 0.85);
    loaf.position.y = 0.12;
    loaf.castShadow = true;
    g.add(loaf);

    for (const sx of [-0.09, 0, 0.09]) {
      const score = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.16), scoreMat);
      score.position.set(sx, 0.245, 0);
      score.rotation.y = 0.38;
      g.add(score);
    }
    return g;
  }

  if (itemType === 'cornbread') {
    const cornMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 })
    );
    const butterMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.35 })
    );

    const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.28), cornMat);
    block.position.y = 0.08;
    block.castShadow = true;
    g.add(block);

    const butter = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.09), butterMat);
    butter.position.set(0, 0.175, 0);
    butter.rotation.y = 0.3;
    g.add(butter);
    return g;
  }

  if (itemType === 'cookie') {
    const doughMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xc27838, roughness: 0.72 })
    );
    const chipMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.45 })
    );

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.065, 16), doughMat);
    disc.position.y = 0.035;
    disc.castShadow = true;
    g.add(disc);

    const chipCoords: [number, number][] = [
      [-0.07, -0.05],
      [0.08, -0.04],
      [0.0, 0.07],
      [-0.06, 0.08],
      [0.07, 0.06],
    ];
    for (const [cx, cz] of chipCoords) {
      const chip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 6), chipMat);
      chip.position.set(cx, 0.07, cz);
      g.add(chip);
    }
    return g;
  }

  if (
    itemType === 'cheese_pizza' ||
    itemType === 'seafood_pizza' ||
    itemType === 'spicy_pizza'
  ) {
    const crustMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xd98a3c, roughness: 0.74 })
    );
    const sauceMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 })
    );
    const cheeseMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.48 })
    );
    const toppingColor =
      itemType === 'spicy_pizza'
        ? 0xb91c1c
        : itemType === 'seafood_pizza'
          ? 0xfb7185
          : 0x16a34a;
    const topMat = regMat(
      new THREE.MeshStandardMaterial({ color: toppingColor, roughness: 0.5 })
    );

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 18), crustMat);
    base.position.y = 0.02;
    base.castShadow = true;
    g.add(base);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 18), crustMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.042;
    g.add(rim);

    const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.012, 16), sauceMat);
    sauce.position.y = 0.042;
    g.add(sauce);

    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.014, 16), cheeseMat);
    cheese.position.y = 0.05;
    g.add(cheese);

    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const topBit = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 10), topMat);
      topBit.position.set(Math.cos(ang) * 0.1, 0.062, Math.sin(ang) * 0.1);
      g.add(topBit);
    }
    return g;
  }

  // Pies (carrot_pie, pumpkin_pie, bacon_pie)
  const dishMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.35, metalness: 0.15 })
  );
  const pastryMat = regMat(
    new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.68 })
  );
  const fillingHex =
    itemType === 'carrot_pie'
      ? 0xf97316
      : itemType === 'pumpkin_pie'
        ? 0xd97706
        : 0x991b1b;
  const fillMat = regMat(
    new THREE.MeshStandardMaterial({ color: fillingHex, roughness: 0.52 })
  );

  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.09, 16), dishMat);
  dish.position.y = 0.045;
  dish.castShadow = true;
  g.add(dish);

  const crustRim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.032, 8, 18), pastryMat);
  crustRim.rotation.x = Math.PI / 2;
  crustRim.position.y = 0.092;
  g.add(crustRim);

  const filling = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.175, 0.03, 16), fillMat);
  filling.position.y = 0.088;
  g.add(filling);

  if (itemType === 'pumpkin_pie') {
    const creamMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.4 })
    );
    const cream = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.075, 10), creamMat);
    cream.position.y = 0.135;
    g.add(cream);
  } else {
    // Lattice pastry strips across carrot & bacon pies
    for (const offset of [-0.08, 0.08]) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.032), pastryMat);
      s1.position.set(0, 0.108, offset);
      g.add(s1);

      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.018, 0.34), pastryMat);
      s2.position.set(offset, 0.112, 0);
      g.add(s2);
    }
  }

  return g;
}

/**
 * BakeryOvenBuilder — สร้างเครื่องเตาอบขนมปังและพิซซ่า (Bakery.glb) และเตาอบพาย (PieOven.glb)
 * พร้อมรางเลื่อนลูกกลิ้งหมุน (Conveyor Belt) ที่เลื่อนขนมปัง/พิซซ่า/พายที่อบเสร็จแล้วลงสู่ตะกร้าหวาย (Basket) อัตโนมัติ!
 */
export class BakeryOvenBuilder {
  public build(m: HouseMaterials, options: BakeryOvenOptions): BakeryOvenResult {
    const machine = options.machine;
    const enableMotionAndSmoke = options.enableMotionAndSmoke !== false;

    const root = new THREE.Group();
    root.name = machine === 'bakery' ? 'ConveyorBakeryOven' : 'ArtisanPieOven';

    const ovenBodyHolder = new THREE.Group();
    ovenBodyHolder.name = 'OvenBodyHolder';
    // Shift oven hearth slightly left so the conveyor belt + basket sit cleanly on the right within the yard
    ovenBodyHolder.position.set(-0.65, 0, -0.15);
    root.add(ovenBodyHolder);

    const conveyorAndBasketGroup = new THREE.Group();
    conveyorAndBasketGroup.name = 'OvenConveyorAndBasket';
    conveyorAndBasketGroup.userData.excludeFromPaint = true;
    root.add(conveyorAndBasketGroup);

    const smokeGroup = new THREE.Group();
    smokeGroup.name = 'OvenSmokeStack';
    smokeGroup.userData.excludeFromPaint = true;
    root.add(smokeGroup);

    const localGeometries: THREE.BufferGeometry[] = [];
    const localMaterials: THREE.Material[] = [];

    const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      localGeometries.push(g);
      return g;
    };
    const regMat = <T extends THREE.Material>(mat: T): T => {
      localMaterials.push(mat);
      return mat;
    };

    // ── Shared cobblestone hearth pad ──
    const basePadMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.92 })
    );
    const basePad = new THREE.Mesh(regGeo(new THREE.BoxGeometry(5.8, 0.14, 4.4)), basePadMat);
    basePad.position.set(0.15, 0.07, 0);
    basePad.receiveShadow = true;
    root.add(basePad);

    // ── Build procedural oven body (used immediately & swapped if /Bakery.glb or /PieOven.glb loads) ──
    let fireGlowMat: THREE.MeshStandardMaterial | null = null;
    let ovenPaddlePivot: THREE.Group | null = null;

    const buildProceduralOvenBody = (): THREE.Group => {
      const proc = new THREE.Group();
      proc.name = 'OvenProceduralBody';

      const isBakery = machine === 'bakery';
      const brickColor = isBakery ? 0xb45309 : 0x991b1b;
      const domeColor = isBakery ? 0xd97706 : 0x7f1d1d;
      const trimMetalHex = isBakery ? 0x334155 : 0x1e293b;

      const brickMat = regMat(
        new THREE.MeshStandardMaterial({ color: brickColor, roughness: 0.82 })
      );
      const domeMat = regMat(
        new THREE.MeshStandardMaterial({ color: domeColor, roughness: 0.76 })
      );
      const ironMat = regMat(
        new THREE.MeshStandardMaterial({ color: trimMetalHex, metalness: 0.68, roughness: 0.36 })
      );
      const brassMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.72, roughness: 0.28 })
      );
      const fireMat = regMat(
        new THREE.MeshStandardMaterial({
          color: 0xffedd5,
          emissive: new THREE.Color(0xf97316),
          emissiveIntensity: 0.85,
          roughness: 0.3,
        })
      );
      fireMat.userData.excludeFromPaint = true;
      fireGlowMat = fireMat;

      // Brick hearth pedestal
      const pedestal = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(2.9, 1.05, 2.7)),
        brickMat
      );
      pedestal.position.set(0, 0.6, 0);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      proc.add(pedestal);

      // Domed oven chamber (Bakery: warm terracotta dome; Pie Oven: octagonal cast-iron & brick chamber)
      if (isBakery) {
        const dome = new THREE.Mesh(
          regGeo(new THREE.SphereGeometry(1.38, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)),
          domeMat
        );
        dome.position.set(0, 1.08, 0);
        dome.scale.set(1.02, 1.08, 0.96);
        dome.castShadow = true;
        proc.add(dome);

        // Awning roof above bakery front
        const awningMat = regMat(
          new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65 })
        );
        const awning = new THREE.Mesh(
          regGeo(new THREE.BoxGeometry(2.6, 0.1, 0.95)),
          awningMat
        );
        awning.position.set(0, 2.28, 1.18);
        awning.rotation.x = 0.28;
        awning.castShadow = true;
        proc.add(awning);

        // Golden Bread signboard icon on front arch
        const signLoaf = new THREE.Mesh(
          regGeo(new THREE.CapsuleGeometry(0.16, 0.34, 8, 12)),
          brassMat
        );
        signLoaf.rotation.z = Math.PI / 2;
        signLoaf.position.set(0, 2.55, 0.98);
        proc.add(signLoaf);
      } else {
        const chamber = new THREE.Mesh(
          regGeo(new THREE.CylinderGeometry(1.28, 1.42, 1.35, 8)),
          domeMat
        );
        chamber.position.set(0, 1.72, 0);
        chamber.rotation.y = Math.PI / 8;
        chamber.castShadow = true;
        proc.add(chamber);

        const capRoof = new THREE.Mesh(
          regGeo(new THREE.ConeGeometry(1.48, 0.68, 8)),
          ironMat
        );
        capRoof.position.set(0, 2.72, 0);
        capRoof.rotation.y = Math.PI / 8;
        capRoof.castShadow = true;
        proc.add(capRoof);

        // Golden Pie emblem on front
        const pieSign = new THREE.Mesh(
          regGeo(new THREE.TorusGeometry(0.22, 0.055, 8, 16)),
          brassMat
        );
        pieSign.position.set(0, 2.28, 1.28);
        proc.add(pieSign);
      }

      // Front fire mouth + glowing embers
      const archFrame = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(1.15, 0.85, 0.32)),
        ironMat
      );
      archFrame.position.set(0, 1.38, 1.25);
      proc.add(archFrame);

      const fireCore = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.86, 0.58, 0.18)),
        fireMat
      );
      fireCore.position.set(0, 1.35, 1.34);
      fireCore.userData.excludeFromPaint = true;
      proc.add(fireCore);

      // Side discharge hatch feeding the conveyor belt (on +X side of oven body)
      const chuteHood = new THREE.Mesh(
        regGeo(new THREE.BoxGeometry(0.55, 0.62, 0.86)),
        ironMat
      );
      chuteHood.position.set(1.42, 1.22, 0.45);
      chuteHood.castShadow = true;
      proc.add(chuteHood);

      //Tall brick & iron chimney stack
      const chimney = new THREE.Mesh(
        regGeo(new THREE.CylinderGeometry(0.24, 0.32, 1.85, 12)),
        brickMat
      );
      chimney.position.set(-0.65, 2.95, -0.45);
      chimney.castShadow = true;
      proc.add(chimney);

      const chimneyRim = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.26, 0.055, 8, 14)),
        ironMat
      );
      chimneyRim.rotation.x = Math.PI / 2;
      chimneyRim.position.set(-0.65, 3.86, -0.45);
      proc.add(chimneyRim);

      // Animated baker's peel / regulator wheel on side
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(-1.48, 1.45, 0.35);
      const wheelRing = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(0.28, 0.035, 8, 16)),
        brassMat
      );
      wheelRing.rotation.y = Math.PI / 2;
      wheelPivot.add(wheelRing);
      const spokeA = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.04, 0.54, 0.04)), brassMat);
      const spokeB = new THREE.Mesh(regGeo(new THREE.BoxGeometry(0.04, 0.04, 0.54)), brassMat);
      wheelPivot.add(spokeA, spokeB);
      proc.add(wheelPivot);
      ovenPaddlePivot = wheelPivot;

      // Flour sacks & firewood stack beside oven
      const sackMat = regMat(
        new THREE.MeshStandardMaterial({ color: 0xe7d8c1, roughness: 0.9 })
      );
      for (const [sx, sz, rot] of [
        [-1.35, 1.15, 0.2],
        [-0.95, 1.38, -0.35],
      ] as const) {
        const sack = new THREE.Mesh(
          regGeo(new THREE.SphereGeometry(0.28, 10, 8)),
          sackMat
        );
        sack.scale.set(1.0, 1.25, 0.82);
        sack.position.set(sx, 0.36, sz);
        sack.rotation.y = rot;
        sack.castShadow = true;
        proc.add(sack);
      }

      const logGeo = regGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.65, 8));
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(logGeo, m.log);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.22 + (i === 2 ? 0.14 : 0), 1.56 + (i === 2 ? 0 : (i - 0.5) * 0.19));
        log.castShadow = true;
        proc.add(log);
      }

      return proc;
    };

    let proceduralBody: THREE.Group | null = buildProceduralOvenBody();
    ovenBodyHolder.add(proceduralBody);

    // ── Build 3D Conveyor Belt (`รางเลื่อน`) + Woven Wicker Basket (`ตะกร้า`) ──
    // Conveyor runs from x = 0.65, y = 1.04, z = 0.30 down to x = 2.28, y = 0.64, z = 0.30
    const startConveyor = new THREE.Vector3(0.65, 1.06, 0.3);
    const endConveyor = new THREE.Vector3(2.26, 0.66, 0.3);
    const basketCenter = new THREE.Vector3(2.68, 0.14, 0.3);

    const railMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.72, roughness: 0.32 })
    );
    const rollerMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.82, roughness: 0.22 })
    );
    const beltMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    const slatMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.45, roughness: 0.42 })
    );

    const conveyorVec = new THREE.Vector3().subVectors(endConveyor, startConveyor);
    const conveyorLen = conveyorVec.length();
    const conveyorAngleZ = Math.atan2(conveyorVec.y, conveyorVec.x); // negative slope (~ -0.24 rad)
    const conveyorMid = new THREE.Vector3().addVectors(startConveyor, endConveyor).multiplyScalar(0.5);

    const trackFrame = new THREE.Group();
    trackFrame.position.copy(conveyorMid);
    trackFrame.rotation.z = conveyorAngleZ;
    conveyorAndBasketGroup.add(trackFrame);

    // Left & right steel side rails
    const sideRailGeo = regGeo(new THREE.BoxGeometry(conveyorLen + 0.14, 0.11, 0.06));
    const railFront = new THREE.Mesh(sideRailGeo, railMat);
    railFront.position.set(0, 0, 0.36);
    railFront.castShadow = true;
    const railBack = new THREE.Mesh(sideRailGeo, railMat);
    railBack.position.set(0, 0, -0.36);
    railBack.castShadow = true;
    trackFrame.add(railFront, railBack);

    // Belt bed
    const beltBed = new THREE.Mesh(
      regGeo(new THREE.BoxGeometry(conveyorLen, 0.04, 0.64)),
      beltMat
    );
    beltBed.position.set(0, -0.02, 0);
    beltBed.receiveShadow = true;
    trackFrame.add(beltBed);

    // Spinning cylindrical rollers along the conveyor
    const rollers: THREE.Mesh[] = [];
    const rollerGeo = regGeo(new THREE.CylinderGeometry(0.048, 0.048, 0.66, 12));
    const rollerCount = 8;
    for (let i = 0; i < rollerCount; i++) {
      const rx = -conveyorLen * 0.46 + (i / (rollerCount - 1)) * (conveyorLen * 0.92);
      const roller = new THREE.Mesh(rollerGeo, rollerMat);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(rx, 0.015, 0);
      trackFrame.add(roller);
      rollers.push(roller);
    }

    // Moving golden guide slats that visibly travel along the belt
    const beltSlats: { mesh: THREE.Mesh; u: number }[] = [];
    const slatGeo = regGeo(new THREE.BoxGeometry(0.035, 0.022, 0.58));
    const slatCount = 6;
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(slatGeo, slatMat);
      const u = i / slatCount;
      slat.position.set((u - 0.5) * conveyorLen, 0.036, 0);
      trackFrame.add(slat);
      beltSlats.push({ mesh: slat, u });
    }

    // Conveyor support legs down to cobblestone pad
    const legGeo = regGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.85, 8));
    for (const [lx, ly, lz] of [
      [0.92, 0.52, 0.62],
      [0.92, 0.52, -0.02],
      [2.05, 0.36, 0.62],
      [2.05, 0.36, -0.02],
    ] as const) {
      const leg = new THREE.Mesh(legGeo, railMat);
      leg.scale.y = (ly * 2) / 0.85;
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      conveyorAndBasketGroup.add(leg);
    }

    // ── Woven Wicker Basket (`ตะกร้าหวายบุผ้า`) at the end of the conveyor ──
    const wickerMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0xb47b38, roughness: 0.84 })
    );
    const wickerDarkMat = regMat(
      new THREE.MeshStandardMaterial({ color: 0x8c5820, roughness: 0.88 })
    );
    const clothLinerMat = regMat(
      new THREE.MeshStandardMaterial({
        color: machine === 'bakery' ? 0xfef2f2 : 0xfffbeb,
        roughness: 0.78,
      })
    );
    const clothTrimMat = regMat(
      new THREE.MeshStandardMaterial({
        color: machine === 'bakery' ? 0xdc2626 : 0xd97706,
        roughness: 0.72,
      })
    );

    const basketGroup = new THREE.Group();
    basketGroup.name = 'WovenOvenBasket';
    basketGroup.position.copy(basketCenter);
    conveyorAndBasketGroup.add(basketGroup);

    // Basket body + braided horizontal rings
    const basketWall = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.56, 0.42, 0.48, 18, 1, true)),
      wickerMat
    );
    basketWall.position.y = 0.24;
    basketWall.castShadow = true;
    basketGroup.add(basketWall);

    const basketBottom = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16)),
      wickerDarkMat
    );
    basketBottom.position.y = 0.03;
    basketGroup.add(basketBottom);

    for (const ry of [0.14, 0.28, 0.42]) {
      const rRadius = THREE.MathUtils.lerp(0.43, 0.55, ry / 0.48);
      const weaveRing = new THREE.Mesh(
        regGeo(new THREE.TorusGeometry(rRadius, 0.026, 7, 20)),
        wickerDarkMat
      );
      weaveRing.rotation.x = Math.PI / 2;
      weaveRing.position.y = ry;
      basketGroup.add(weaveRing);
    }

    // Thick braided top rim & cloth liner cushion
    const topRim = new THREE.Mesh(
      regGeo(new THREE.TorusGeometry(0.56, 0.048, 8, 22)),
      clothTrimMat
    );
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 0.48;
    basketGroup.add(topRim);

    const clothCushion = new THREE.Mesh(
      regGeo(new THREE.CylinderGeometry(0.49, 0.4, 0.14, 16)),
      clothLinerMat
    );
    clothCushion.position.y = 0.22;
    basketGroup.add(clothCushion);

    // Two side handles on basket
    const handleGeo = regGeo(new THREE.TorusGeometry(0.12, 0.025, 7, 12, Math.PI));
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(handleGeo, wickerDarkMat);
      handle.position.set(0, 0.48, side * 0.56);
      basketGroup.add(handle);
    }

    // Container for 3D breads/pizzas/pies sliding on the conveyor & stacked inside the basket
    const itemsContainer = new THREE.Group();
    itemsContainer.name = 'ConveyorAndBasketItems';
    conveyorAndBasketGroup.add(itemsContainer);

    const trackedItems = new Map<string, TrackedBakedMesh>();

    // Basket resting offsets (neatly arranged inside the woven basket)
    const basketSlots: readonly [number, number, number][] = [
      [-0.14, 0.3, -0.12],
      [0.15, 0.3, 0.1],
      [-0.12, 0.32, 0.16],
      [0.14, 0.32, -0.14],
      [0.0, 0.42, 0.0],
      [-0.1, 0.46, 0.08],
      [0.12, 0.46, -0.06],
      [0.0, 0.52, 0.04],
    ];

    // ── Chimney Steam / Bakery Aroma Puffs ──
    const smokePuffs: SmokePuff[] = [];
    const smokeAnchor = new THREE.Vector3(-1.3, 4.02, -0.6);

    if (enableMotionAndSmoke) {
      const puffGeo = regGeo(new THREE.IcosahedronGeometry(0.22, 1));
      for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
        const puffMat = regMat(
          new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            roughness: 0.95,
            metalness: 0.0,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
          })
        );
        const puffMesh = new THREE.Mesh(puffGeo, puffMat);
        puffMesh.castShadow = false;
        puffMesh.receiveShadow = false;
        const lifetime = 2.4 + (i % 4) * 0.35;
        smokeGroup.add(puffMesh);
        smokePuffs.push({
          mesh: puffMesh,
          mat: puffMat,
          age: (i / SMOKE_PUFF_COUNT) * lifetime,
          lifetime,
          driftX: 0.2 + ((i * 5) % 4) * 0.06,
          driftZ: (((i * 9) % 7) - 3) * 0.05,
          phase: i * 1.15,
        });
      }
    }

    // ── Optional GLB Hot-Swap (`Bakery.glb` / `PieOven.glb`) ──
    let glbInstance: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let isDisposed = false;

    const mountCachedGlb = () => {
      if (isDisposed || glbInstance) return;
      const cached = _cachedOvenModels.get(machine);
      if (!cached) return;

      if (proceduralBody) {
        ovenBodyHolder.remove(proceduralBody);
        proceduralBody = null;
      }

      glbInstance = cached.scene.clone(true);
      ovenBodyHolder.add(glbInstance);
      smokeAnchor.set(
        ovenBodyHolder.position.x + cached.smokeAnchor.x,
        cached.smokeAnchor.y,
        ovenBodyHolder.position.z + cached.smokeAnchor.z
      );

      if (enableMotionAndSmoke && cached.clips.length > 0) {
        mixer = new THREE.AnimationMixer(glbInstance);
        for (const clip of cached.clips) {
          const action = mixer.clipAction(clip);
          action.play();
        }
      }
    };

    if (_cachedOvenModels.has(machine)) {
      mountCachedGlb();
    } else {
      ensureOvenGlbCached(machine).then((loaded) => {
        if (loaded) mountCachedGlb();
      });
    }

    const unsubDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (isDisposed) return;
      if (OVEN_GLB_CANDIDATES[machine].includes(resolvedUrl)) {
        ensureOvenGlbCached(machine, true).then((loaded) => {
          if (loaded) mountCachedGlb();
        });
      }
    });

    // ── Runtime State & Conveyor Animation ──
    let activeBakingCount = 0;

    const positionTrackedMesh = (entry: TrackedBakedMesh, elapsed: number) => {
      if (entry.progress < 1) {
        // Sliding along the 3D conveyor belt from oven mouth to basket!
        const eased = 1 - Math.pow(1 - entry.progress, 1.65);
        const px = THREE.MathUtils.lerp(startConveyor.x, endConveyor.x + 0.16, eased);
        const py =
          THREE.MathUtils.lerp(startConveyor.y + 0.04, endConveyor.y + 0.02, eased) +
          Math.abs(Math.sin(entry.progress * Math.PI * 6)) * 0.018;
        const pz = THREE.MathUtils.lerp(startConveyor.z, endConveyor.z, eased);

        entry.mesh.position.set(px, py, pz);
        entry.mesh.rotation.set(0, entry.progress * 0.6, conveyorAngleZ * (1 - entry.progress * 0.5));
      } else {
        // Settled warmly inside the woven wicker basket
        const slot = basketSlots[entry.slotIndex % basketSlots.length];
        const gentleBob = Math.sin(elapsed * 2.2 + entry.slotIndex) * 0.005;
        entry.mesh.position.set(
          basketCenter.x + slot[0],
          basketCenter.y + slot[1] + gentleBob,
          basketCenter.z + slot[2]
        );
        entry.mesh.rotation.set(0.08, entry.slotIndex * 1.1, -0.06);
      }
    };

    const setOvenState = (state: OvenVisualState) => {
      activeBakingCount = Math.max(0, state.activeCount);

      const nextIds = new Set(state.readyItems.map((it) => it.id));

      // Remove meshes that were collected by the player
      trackedItems.forEach((tracked, id) => {
        if (!nextIds.has(id)) {
          itemsContainer.remove(tracked.mesh);
          disposeHierarchySafely(tracked.mesh);
          trackedItems.delete(id);
        }
      });

      // Spawn new finished items at the oven mouth (progress = 0) so they slide down the conveyor into the basket!
      state.readyItems.forEach((item, idx) => {
        const existing = trackedItems.get(item.id);
        if (existing) {
          existing.slotIndex = idx;
          return;
        }
        const itemMesh = createBakedGoodMesh(item.itemType, localMaterials);
        itemsContainer.add(itemMesh);
        const created: TrackedBakedMesh = {
          id: item.id,
          itemType: item.itemType,
          mesh: itemMesh,
          progress: 0,
          slotIndex: idx,
        };
        positionTrackedMesh(created, 0);
        trackedItems.set(item.id, created);
      });
    };

    const update = (dt: number, elapsed: number) => {
      if (!enableMotionAndSmoke || isDisposed) return;

      let anySliding = false;
      trackedItems.forEach((entry) => {
        if (entry.progress < 1) {
          entry.progress = Math.min(1, entry.progress + dt / CONVEYOR_SLIDE_DURATION_SEC);
          anySliding = true;
        }
        positionTrackedMesh(entry, elapsed);
      });

      const isWorking = activeBakingCount > 0 || anySliding;
      const beltSpeed = anySliding ? 2.4 : activeBakingCount > 0 ? 1.15 : 0.22;

      if (mixer) {
        mixer.timeScale = isWorking ? 1.15 : 0.35;
        mixer.update(dt);
      }

      // Spin conveyor rollers & translate golden belt slats toward the basket
      for (const roller of rollers) {
        roller.rotation.y -= dt * beltSpeed * 4.2;
      }
      for (const slat of beltSlats) {
        slat.u = (slat.u + dt * beltSpeed * 0.42) % 1;
        slat.mesh.position.x = (slat.u - 0.5) * conveyorLen;
      }

      if (ovenPaddlePivot) {
        ovenPaddlePivot.rotation.x += dt * (isWorking ? 1.8 : 0.3);
      }

      if (fireGlowMat) {
        fireGlowMat.emissiveIntensity = isWorking
          ? 0.95 + Math.sin(elapsed * 9.5) * 0.28
          : 0.38 + Math.sin(elapsed * 3.2) * 0.08;
      }

      // Update warm chimney steam puffs
      const riseSpeed = isWorking ? 0.92 : 0.45;
      const maxOpacity = isWorking ? 0.62 : 0.22;

      for (const puff of smokePuffs) {
        puff.age += dt * riseSpeed;
        if (puff.age >= puff.lifetime) {
          puff.age %= puff.lifetime;
        }
        const tNorm = puff.age / puff.lifetime;
        const heightOffset = tNorm * (isWorking ? 2.8 : 1.5);
        const swirl = Math.sin(elapsed * 2.1 + puff.phase) * 0.14 * tNorm;

        puff.mesh.position.set(
          smokeAnchor.x + puff.driftX * tNorm + swirl,
          smokeAnchor.y + heightOffset,
          smokeAnchor.z + puff.driftZ * tNorm + swirl * 0.6
        );

        const scale = 0.38 + tNorm * (isWorking ? 1.45 : 0.85);
        puff.mesh.scale.setScalar(scale);

        const fadeIn = Math.min(1, tNorm * 4.5);
        const fadeOut = Math.pow(1 - tNorm, 1.5);
        puff.mat.opacity = maxOpacity * fadeIn * fadeOut;
      }
    };

    const dispose = () => {
      isDisposed = true;
      unsubDiscovery();
      if (mixer && glbInstance) {
        mixer.stopAllAction();
        mixer.uncacheRoot(glbInstance);
        mixer = null;
      }
      if (glbInstance) {
        ovenBodyHolder.remove(glbInstance);
        disposeHierarchySafely(glbInstance);
        glbInstance = null;
      }
      trackedItems.forEach((t) => {
        itemsContainer.remove(t.mesh);
        disposeHierarchySafely(t.mesh);
      });
      trackedItems.clear();
      localGeometries.forEach((g) => g.dispose());
      localMaterials.forEach((mat) => mat.dispose());
    };

    return {
      root,
      setOvenState,
      update,
      dispose,
    };
  }
}
