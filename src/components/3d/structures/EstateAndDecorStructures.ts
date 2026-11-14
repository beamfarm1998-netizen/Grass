// src/components/3d/structures/EstateAndDecorStructures.ts
import * as THREE from 'three';
import { HouseMaterials, HouseMeshBuilder } from './HouseMeshBuilder';

/** 17) บ้านพักป่าดิบชื้น (Jungle House Villa) */
export function buildJungleHouseProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 0.65 });
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.9 });

  const yard = 8.0;
  const dirtPlane = new THREE.PlaneGeometry(yard - 0.2, yard - 0.2);
  dirtPlane.rotateX(-Math.PI / 2);
  b.add(dirtPlane, m.dirt, 0, 0.02, 0);

  const stiltH = 1.4;
  const deckW = 5.2, deckD = 5.0;
  const deckX = 0, deckZ = -0.4;
  b.setPart('floor');
  for (const sx of [-deckW / 2 + 0.3, 0, deckW / 2 - 0.3]) {
    for (const sz of [-deckD / 2 + 0.3, 0, deckD / 2 - 0.3]) {
      b.cyl(0.18, stiltH, m.log, deckX + sx, stiltH / 2, deckZ + sz);
      b.box(0.5, 0.2, 0.5, m.stone, deckX + sx, 0.1, deckZ + sz);
    }
  }

  b.box(deckW, 0.2, deckD, m.woodLight, deckX, stiltH, deckZ);

  const houseW = 3.6, houseD = 3.2, houseH = 2.4;
  const houseX = 0, houseZ = deckZ - 0.7;
  const houseFloorY = stiltH + 0.1;

  b.setPart('wall');
  b.box(houseW, houseH, houseD, m.wood, houseX, houseFloorY + houseH / 2, houseZ);
  for (const cx of [-houseW / 2, houseW / 2]) {
    for (const cz of [-houseD / 2, houseD / 2]) {
      b.box(0.24, houseH + 0.1, 0.24, m.woodDark, houseX + cx, houseFloorY + houseH / 2, houseZ + cz);
    }
  }

  b.box(0.9, 1.8, 0.1, m.woodDark, houseX, houseFloorY + 0.9, houseZ + houseD / 2 + 0.02);
  b.setPart(undefined);
  b.box(0.8, 0.8, 0.06, m.glass, houseX - 1.1, houseFloorY + 1.2, houseZ + houseD / 2 + 0.02);
  b.box(0.8, 0.8, 0.06, m.glass, houseX + 1.1, houseFloorY + 1.2, houseZ + houseD / 2 + 0.02);
  b.box(0.06, 0.8, 1.0, m.glass, houseX + houseW / 2 + 0.02, houseFloorY + 1.2, houseZ);
  b.box(0.06, 0.8, 1.0, m.glass, houseX - houseW / 2 - 0.02, houseFloorY + 1.2, houseZ);

  b.gable(houseW, houseD, 1.4, 0.5, thatchMat, m.wood, houseFloorY + houseH, houseZ);

  b.setPart('chimney');
  b.box(0.48, 1.45, 0.48, m.stone, houseX + 1.05, houseFloorY + houseH + 0.95, houseZ - 0.7);
  b.box(0.6, 0.1, 0.6, m.stone, houseX + 1.05, houseFloorY + houseH + 1.7, houseZ - 0.7);

  const porchZ = deckZ + deckD / 2 - 0.6;
  b.setPart('fence');
  for (const rx of [-deckW / 2 + 0.3, deckW / 2 - 0.3]) {
    b.box(0.12, 0.9, deckD, bambooMat, deckX + rx, houseFloorY + 0.45, deckZ);
  }
  b.box(1.6, 0.9, 0.12, bambooMat, deckX - 1.7, houseFloorY + 0.45, deckZ + deckD / 2 - 0.1);
  b.box(1.6, 0.9, 0.12, bambooMat, deckX + 1.7, houseFloorY + 0.45, deckZ + deckD / 2 - 0.1);

  b.setPart(undefined);
  b.cyl(0.35, 0.55, m.woodDark, deckX + 1.3, houseFloorY + 0.28, porchZ);
  b.box(0.7, 0.45, 0.4, m.wood, deckX + 1.3, houseFloorY + 0.22, porchZ - 0.6);

  const stairSteps = 5;
  const stairLen = 1.4;
  b.setPart('floor');
  for (let i = 0; i < stairSteps; i++) {
    const stepY = (stiltH * (i + 1)) / (stairSteps + 1);
    const stepZ = deckZ + deckD / 2 + (stairLen * (stairSteps - 1 - i)) / stairSteps;
    b.box(1.2, 0.15, 0.35, m.woodDark, deckX, stepY, stepZ);
  }
  b.setPart('fence');
  b.box(0.1, 0.9, stairLen, m.woodDark, deckX - 0.65, stiltH * 0.5 + 0.3, deckZ + deckD / 2 + stairLen / 2, 0, -0.45, 0);
  b.box(0.1, 0.9, stairLen, m.woodDark, deckX + 0.65, stiltH * 0.5 + 0.3, deckZ + deckD / 2 + stairLen / 2, 0, -0.45, 0);
  b.setPart(undefined);

  for (const px of [-deckW / 2 + 0.2, deckW / 2 - 0.2]) {
    b.box(0.6, 0.5, 0.6, m.stone, deckX + px, 0.25, deckZ + deckD / 2 + 0.2);
    b.box(0.8, 0.9, 0.8, palmMat, deckX + px, 0.8, deckZ + deckD / 2 + 0.2);
  }
  b.box(0.9, 1.2, 0.9, palmMat, deckX - deckW / 2 - 0.5, 0.6, deckZ);
  b.box(0.8, 1.0, 0.8, palmMat, deckX + deckW / 2 + 0.5, 0.5, deckZ);

  b.box(0.2, 0.3, 0.2, m.glass, houseX - 0.7, houseFloorY + 1.8, houseZ + houseD / 2 + 0.15);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.roofRed,
    m.stone,
    m.fence,
    palmMat,
    bambooMat,
    thatchMat,
    ropeMat,
  ]);
  const group = b.build(cast, new Set([m.dirt]), m.fence);
  group.name = 'House_17_JungleHouse';
  return group;
}

/** 18) บ้านพักคนสวนและคนงาน (baankhonsuan) */
export function buildGardenerQuartersProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  const thatchMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.95 });
  const thatchDarkMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.95 });
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.8 });
  const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.9 });
  const cabbageMat = new THREE.MeshStandardMaterial({ color: 0x7cb342, roughness: 0.85 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    roughness: 0.1,
    metalness: 0.1,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xeceff1,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });

  const yard = 7.0;
  const h = yard / 2 - 0.2;
  const gateW = 1.2;

  const dirtPlane = new THREE.PlaneGeometry(yard - 0.2, yard - 0.2);
  dirtPlane.rotateX(-Math.PI / 2);
  b.add(dirtPlane, m.dirt, 0, 0.02, 0);

  const houseW = 3.6, houseD = 2.8, houseH = 2.3;
  const houseX = 0, houseZ = -h + houseD / 2 + 0.4;

  b.setPart('floor');
  b.box(houseW + 0.2, 0.25, houseD + 0.2, m.stone, houseX, 0.125, houseZ);

  b.setPart('wall');
  b.box(houseW, houseH, houseD, m.woodLight, houseX, 0.25 + houseH / 2, houseZ);

  for (const cx of [-houseW / 2, houseW / 2]) {
    for (const cz of [-houseD / 2, houseD / 2]) {
      b.box(0.2, houseH + 0.2, 0.2, m.woodDark, houseX + cx, 0.25 + houseH / 2, houseZ + cz);
    }
  }

  b.gable(houseW, houseD, 1.3, 0.55, thatchMat, m.wood, 0.25 + houseH, houseZ);
  b.setPart('roof');
  b.box(houseW + 1.2, 0.08, 0.18, thatchDarkMat, houseX, 0.25 + houseH + 0.55, houseZ + houseD / 2 + 0.5);
  b.box(houseW + 1.2, 0.08, 0.18, thatchDarkMat, houseX, 0.25 + houseH + 0.55, houseZ - houseD / 2 - 0.5);

  const fz = houseZ + houseD / 2;
  b.setPart('wall');
  b.box(0.5, 1.7, 0.1, m.woodDark, -0.28, 0.25 + 0.85, fz + 0.03);
  b.box(0.5, 1.7, 0.1, m.woodDark, 0.28, 0.25 + 0.85, fz + 0.03);
  b.setPart(undefined);
  b.box(0.06, 0.06, 0.06, m.stone, -0.05, 0.25 + 0.85, fz + 0.1);
  b.box(0.06, 0.06, 0.06, m.stone, 0.05, 0.25 + 0.85, fz + 0.1);

  b.window(-1.15, 0.25 + 1.4, fz + 0.02, 0, m.woodDark, m.glass, 0.75, 0.75);
  b.window(1.15, 0.25 + 1.4, fz + 0.02, 0, m.woodDark, m.glass, 0.75, 0.75);
  b.window(-houseW / 2 - 0.02, 0.25 + 1.4, houseZ, -Math.PI / 2, m.woodDark, m.glass, 0.7, 0.75);
  b.window(houseW / 2 + 0.02, 0.25 + 1.4, houseZ, Math.PI / 2, m.woodDark, m.glass, 0.7, 0.75);

  b.setPart('chimney');
  b.box(0.5, 1.4, 0.5, m.stone, houseX - 1.0, 0.25 + houseH + 0.7, houseZ - 0.6);
  b.box(0.6, 0.1, 0.6, m.stone, houseX - 1.0, 0.25 + houseH + 1.4, houseZ - 0.6);

  const porchD = 1.0;
  const porchZ = fz + porchD / 2 + 0.05;
  b.setPart('floor');
  b.box(houseW, 0.15, porchD, m.woodDark, houseX, 0.15, porchZ);
  b.setPart('roof');
  b.box(houseW + 0.4, 0.08, porchD + 0.4, thatchMat, houseX, 0.25 + houseH + 0.05, porchZ, 0, 0.12, 0);

  b.setPart('wall');
  for (const px of [-houseW / 2 + 0.15, houseW / 2 - 0.15]) {
    b.box(0.14, 2.2, 0.14, m.woodDark, px, 1.25, fz + porchD - 0.1);
  }

  b.setPart('fence');
  const railLen = houseW / 2 - 0.6;
  b.box(railLen, 0.06, 0.06, m.woodDark, -(0.6 + houseW / 2) / 2, 0.85, fz + porchD - 0.1);
  b.box(railLen, 0.06, 0.06, m.woodDark, (0.6 + houseW / 2) / 2, 0.85, fz + porchD - 0.1);
  for (const px of [-houseW / 2 + 0.05, houseW / 2 - 0.05, -0.6, 0.6]) {
    b.box(0.1, 0.8, 0.1, m.woodDark, px, 0.5, fz + porchD - 0.1);
  }

  b.setPart('floor');
  b.box(1.4, 0.12, 0.35, m.woodDark, 0, 0.06, fz + porchD + 0.2);
  b.box(1.4, 0.12, 0.35, m.woodDark, 0, 0.18, fz + porchD + 0.5);
  b.setPart(undefined);

  for (const gx of [-1.0, 1.0]) {
    b.box(0.45, 0.08, 0.45, m.wood, gx, 0.45, porchZ);
    b.box(0.45, 0.5, 0.06, m.wood, gx, 0.7, porchZ - 0.2);
    for (const lx of [-0.18, 0.18]) {
      for (const lz of [-0.18, 0.18]) {
        b.box(0.06, 0.4, 0.06, m.woodDark, gx + lx, 0.2, porchZ + lz);
      }
    }
  }

  b.cyl(0.28, 0.06, m.wood, 0, 0.5, porchZ);
  b.cyl(0.05, 0.5, m.woodDark, 0, 0.25, porchZ);

  const gardenPlot = (gx: number, gz: number, cropMat: THREE.Material, withCarrot: boolean) => {
    b.box(1.0, 0.15, 0.8, m.woodDark, gx, 0.075, gz);
    b.box(0.88, 0.08, 0.68, m.dirt, gx, 0.16, gz);
    if (withCarrot) {
      for (let i = -1; i <= 1; i++) {
        b.cyl(0.08, 0.25, carrotMat, gx + i * 0.25, 0.32, gz);
        b.cyl(0.12, 0.18, leafMat, gx + i * 0.25, 0.55, gz);
      }
    } else {
      for (let i = -1; i <= 1; i++) {
        b.cyl(0.18, 0.22, cropMat, gx + i * 0.25, 0.28, gz, 0, 0, 6);
      }
    }
  };

  gardenPlot(-1.9, 0.8, cabbageMat, false);
  gardenPlot(1.9, 0.8, cabbageMat, true);

  const tankX = -2.2, tankZ = 1.8;
  b.cyl(0.35, 0.9, m.woodDark, tankX, 0.45, tankZ);
  b.cyl(0.32, 0.05, waterMat, tankX, 0.88, tankZ);
  b.cyl(0.32, 0.05, m.woodDark, tankX, 0.0, tankZ);
  b.cyl(0.12, 0.35, m.stone, tankX + 0.5, 0.18, tankZ + 0.2);

  const lineX = 2.5;
  for (const lz of [-1.5, 0.5]) {
    b.box(0.1, 1.8, 0.1, m.woodDark, lineX, 0.9, lz);
    b.box(0.3, 0.1, 0.3, m.stone, lineX, 0.05, lz);
  }
  b.box(0.03, 0.03, 2.0, m.woodDark, lineX, 1.7, -0.5);
  for (const cz of [-1.3, -0.6, 0.1]) {
    b.box(0.35, 0.5, 0.03, clothMat, lineX, 1.45, cz);
  }

  const fenceH = 0.85;
  const postStep = 0.55;
  const runFence = (
    alongX: boolean,
    fixed: number,
    from: number,
    to: number,
    gapFrom?: number,
    gapTo?: number
  ) => {
    const len = to - from;
    const n = Math.max(1, Math.floor(len / postStep));
    for (let i = 0; i <= n; i++) {
      const t = from + (len * i) / n;
      if (gapFrom !== undefined && gapTo !== undefined && t > gapFrom && t < gapTo) continue;
      if (alongX) b.box(0.12, fenceH, 0.06, m.fence, t, fenceH / 2, fixed);
      else b.box(0.12, fenceH, 0.06, m.fence, fixed, fenceH / 2, t, Math.PI / 2);
    }
    const inner = fixed - Math.sign(fixed) * 0.05;
    const mid = (from + to) / 2;
    for (const y of [0.3, 0.65]) {
      if (alongX) {
        if (gapFrom !== undefined && gapTo !== undefined) {
          const leftLen = gapFrom - from;
          const rightLen = to - gapTo;
          if (leftLen > 0.1) b.box(leftLen, 0.06, 0.05, m.fence, from + leftLen / 2, y, inner);
          if (rightLen > 0.1) b.box(rightLen, 0.06, 0.05, m.fence, gapTo + rightLen / 2, y, inner);
        } else {
          b.box(len, 0.06, 0.05, m.fence, mid, y, inner);
        }
      } else {
        b.box(0.05, 0.06, len, m.fence, inner, y, mid);
      }
    }
  };

  b.setPart('fence');
  runFence(true, -h, -h, h);
  runFence(false, -h, -h, h);
  runFence(false, h, -h, h);
  runFence(true, h, -h, h, -gateW / 2, gateW / 2);

  b.box(0.18, 1.3, 0.18, m.woodDark, -gateW / 2, 0.65, h);
  b.box(0.18, 1.3, 0.18, m.woodDark, gateW / 2, 0.65, h);
  b.box(gateW + 0.2, 0.1, 0.1, m.woodDark, 0, 1.28, h);
  b.box(0.9, 0.28, 0.08, m.woodLight, 0, 1.55, h);
  b.setPart(undefined);

  const treeSpots: [number, number][] = [
    [-h + 0.5, h - 0.5],
    [h - 0.5, -h + 0.5],
  ];
  for (const [tx, tz] of treeSpots) {
    b.cyl(0.08, 0.8, m.woodDark, tx, 0.4, tz);
    b.cyl(0.35, 0.6, leafMat, tx, 0.9, tz, 0, 0, 8);
  }

  b.box(0.18, 0.28, 0.18, m.glass, 1.5, 2.0, fz + porchD - 0.2);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.roofRed,
    m.stone,
    m.fence,
    thatchMat,
    thatchDarkMat,
    bambooMat,
    leafMat,
    carrotMat,
    cabbageMat,
    clothMat,
  ]);
  const group = b.build(cast, new Set([m.dirt, waterMat]), m.fence);
  group.name = 'House_18_GardenerQuarters';
  return group;
}

/** 19) รั้วไม้ (Wooden Fence fallback procedural) */
export function buildWoodenFenceProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  b.setPart('fence');
  for (const x of [-0.8, 0.8]) {
    b.box(0.14, 1.1, 0.14, m.woodDark, x, 0.55, 0);
    b.box(0.2, 0.06, 0.2, m.woodDark, x, 1.13, 0);
  }
  for (const y of [0.4, 0.8]) {
    b.box(1.7, 0.1, 0.06, m.wood, 0, y, 0);
  }
  b.setPart(undefined);

  const cast = new Set<THREE.Material>([m.wood, m.woodDark]);
  const group = b.build(cast, new Set(), m.wood);
  group.name = 'House_19_WoodenFence';
  return group;
}

/** 20) โรงเก็บผลผลิต (Produce Storage Facility fallback procedural) */
export function buildProduceStorageProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.95 });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x607d8b,
    roughness: 0.4,
    metalness: 0.6,
  });
  const sackMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.95 });

  const yard = 8.0;
  b.setPart('floor');
  const concretePlane = new THREE.PlaneGeometry(yard - 0.3, yard - 0.3);
  concretePlane.rotateX(-Math.PI / 2);
  b.add(concretePlane, concreteMat, 0, 0.02, 0);

  const W = 4.6, D = 3.2, H = 2.8;
  const cz = -0.4;

  b.box(W + 0.3, 0.25, D + 0.3, concreteMat, 0, 0.125, cz);
  b.setPart('wall');
  b.box(W, H, D, m.wood, 0, 0.25 + H / 2, cz);
  for (const cx of [-W / 2, W / 2]) {
    for (const czz of [-D / 2, D / 2]) {
      b.box(0.22, H + 0.15, 0.22, m.woodDark, cx, 0.25 + H / 2, cz + czz);
    }
  }

  b.gable(W, D, 1.8, 0.5, m.roofBrown, m.woodLight, 0.25 + H, cz);
  b.setPart('chimney');
  b.cyl(0.22, 1.3, metalMat, 1.35, 0.25 + H + 1.35, cz - 0.6);
  b.setPart('wall');

  for (const sx of [-1.2, 1.2]) {
    for (const sz of [-D / 2 - 0.02, D / 2 + 0.02]) {
      for (let i = 0; i < 3; i++) {
        b.box(1.0, 0.08, 0.06, m.woodDark, sx, 0.25 + H * 0.65 + i * 0.18, cz + sz);
      }
    }
  }
  b.setPart(undefined);

  const fz = cz + D / 2 + 0.03;
  b.box(1.8, 2.0, 0.08, metalMat, 0, 0.25 + 1.0, fz);
  b.box(0.9, 0.12, 0.1, m.woodDark, -0.45, 0.25 + 2.05, fz + 0.02);
  b.box(0.9, 0.12, 0.1, m.woodDark, 0.45, 0.25 + 2.05, fz + 0.02);

  b.box(0.7, 0.5, 0.5, sackMat, -1.6, 0.25, fz + 0.6);
  b.box(0.65, 0.45, 0.48, sackMat, -1.55, 0.72, fz + 0.62, 0.1);
  b.box(0.7, 0.5, 0.5, sackMat, -0.7, 0.25, fz + 0.65);

  b.box(0.9, 0.6, 0.7, m.woodDark, W / 2 + 0.4, 0.3, cz + 0.5);
  b.box(0.85, 0.55, 0.65, m.wood, W / 2 + 0.4, 0.87, cz + 0.5, 0.15);

  b.box(0.18, 0.28, 0.18, m.glass, 0, 0.25 + H * 0.75, fz + 0.05);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.roofRed,
    m.stone,
    concreteMat,
    metalMat,
    sackMat,
  ]);
  const group = b.build(cast, new Set([concreteMat]), m.wood);
  group.name = 'House_20_ProduceStorage';
  return group;
}

/** 21) โขดหินริมน้ำ (River Rock fallback procedural ระหว่างรอ river_rock.glb) */
export function buildRiverRockProcedural(): THREE.Group {
  const b = new HouseMeshBuilder();

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x607d8b,
    roughness: 0.95,
    flatShading: true,
  });
  const rockDarkMat = new THREE.MeshStandardMaterial({
    color: 0x455a64,
    roughness: 0.95,
    flatShading: true,
  });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a6741, roughness: 0.95 });

  b.add(new THREE.DodecahedronGeometry(0.9, 0), rockMat, 0, 0.55, 0);
  b.add(new THREE.DodecahedronGeometry(0.55, 0), rockDarkMat, 0.75, 0.3, 0.35);
  b.add(new THREE.DodecahedronGeometry(0.45, 0), rockMat, -0.65, 0.25, -0.25);
  b.add(new THREE.DodecahedronGeometry(0.32, 0), mossMat, 0.15, 0.95, 0.05);
  b.add(new THREE.DodecahedronGeometry(0.22, 0), mossMat, -0.5, 0.5, -0.1);

  const cast = new Set<THREE.Material>([rockMat, rockDarkMat, mossMat]);
  const group = b.build(cast, new Set(), rockMat);
  group.name = 'House_21_RiverRock';
  return group;
}
// ───────────────────────── Oak Trees Cluster (type 22) ─────────────────────────
/**
 * Procedural fallback สำหรับ type 22 (กลุ่มต้นโอ๊ค)
 * ใช้เมื่อ GLB ยังโหลดไม่เสร็จ, ไฟล์หาย, หรือผู้เล่นเปิดโหมดออฟไลน์แต่ยังไม่แคช
 */
export function buildOakTreesProcedural(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'House_22_Procedural';

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 });
  const leafMatAlt = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.85 });

  // กลุ่ม 3 ต้น จัดวางเหลื่อมกันให้ดูเป็น cluster
  const trees: { x: number; z: number; s: number }[] = [
    { x: 0, z: 0, s: 1.0 },
    { x: -1.4, z: 0.8, s: 0.85 },
    { x: 1.3, z: -0.9, s: 0.9 },
  ];

  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const tree = new THREE.Group();

    // ลำต้น
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 1.9, 8),
      trunkMat
    );
    trunk.position.y = 0.95;
    trunk.castShadow = true;
    tree.add(trunk);

    // พุ่มใบโอ๊ค — 4 ก้อน icosahedron ซ้อนให้ดูหนา
    const canopy: [number, number, number, number][] = [
      [0, 2.3, 0, 1.0],
      [0.45, 2.55, 0.3, 0.72],
      [-0.45, 2.5, -0.25, 0.78],
      [0.2, 2.85, -0.45, 0.62],
    ];
    for (let k = 0; k < canopy.length; k++) {
      const [ox, oy, oz, r] = canopy[k];
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        k % 2 === 0 ? leafMat : leafMatAlt
      );
      foliage.position.set(ox, oy, oz);
      foliage.castShadow = true;
      tree.add(foliage);
    }

    tree.position.set(t.x, 0, t.z);
    tree.scale.setScalar(t.s);
    tree.rotation.y = i * 1.7;
    group.add(tree);
  }

  return group;
}
// ───────────────────────── Mountain Hiking Trail (type 23) ─────────────────────────
// fallback procedural ใช้เมื่อ mountain_hiking_trail.glb ยังโหลดไม่เสร็จ / ล้มเหลว / ออฟไลน์
export function buildMountainTrailProcedural(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MountainHikingTrail';

  const woodMat     = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.85, metalness: 0.02 });
  const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.9 });
  const signMats    = [
    new THREE.MeshStandardMaterial({ color: 0xc9a961, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x9c7a45, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.8 }),
  ];
  const inkMat      = new THREE.MeshStandardMaterial({ color: 0x2b1f12, roughness: 0.95 });
  const rockMat     = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
  const rockDarkMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
  const trailMat    = new THREE.MeshStandardMaterial({ color: 0xa88960, roughness: 1.0 });
  const markerMat   = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.7 });

  // ── เสาหลัก ──
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 2.6, 8),
    woodMat,
  );
  post.position.y = 1.3;
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.2, 8),
    woodDarkMat,
  );
  cap.position.y = 2.72;
  cap.castShadow = true;
  group.add(cap);

  // ── ป้าย fingerpost 3 อัน ชี้ทิศต่างกัน ──
  const configs = [
    { len: 0.95, y: 2.35, ang:  0.15,           tipLen: 0.28 },
    { len: 0.80, y: 2.05, ang:  Math.PI * 0.55, tipLen: 0.24 },
    { len: 0.70, y: 1.75, ang: -Math.PI * 0.40, tipLen: 0.22 },
  ];
  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    const arm = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(c.len, 0.22, 0.05),
      signMats[i],
    );
    body.position.x = c.len / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    arm.add(body);

    const tipGeo = new THREE.ConeGeometry(0.14, c.tipLen, 4);
    tipGeo.rotateZ(-Math.PI / 2);
    const tip = new THREE.Mesh(tipGeo, signMats[i]);
    tip.position.x = c.len + c.tipLen / 2 - 0.02;
    tip.castShadow = true;
    arm.add(tip);

    for (let j = 0; j < 2; j++) {
      const ink = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.045, 0.06),
        inkMat,
      );
      ink.position.set(0.22 + j * 0.18, j === 0 ? 0.04 : -0.06, 0.001);
      arm.add(ink);
    }

    arm.position.y = c.y;
    arm.rotation.y = c.ang;
    group.add(arm);
  }

  // ── ผ้า trail marker สีส้มผูกติดเสา ──
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.38, 0.03),
    markerMat,
  );
  ribbon.position.set(0.10, 2.15, 0.02);
  ribbon.rotation.z = -0.12;
  group.add(ribbon);

  // ── กองหิน cairn 4 ก้อนรอบโคนเสา (rotation ตายตัว = ทุก instance เหมือนกัน) ──
  const rocks: Array<
    [x: number, y: number, z: number, r: number,
     rx: number, ry: number, rz: number, dark: boolean]
  > = [
    [ 0.48, 0.15, -0.32, 0.22, 0.3, 0.8, 0.2, false],
    [-0.44, 0.13, -0.28, 0.19, 0.7, 1.5, 0.4, true ],
    [-0.36, 0.10,  0.42, 0.16, 0.2, 2.1, 0.6, false],
    [ 0.30, 0.08,  0.50, 0.13, 1.1, 0.4, 0.3, true ],
  ];
  for (const [x, y, z, r, rx, ry, rz, dark] of rocks) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      dark ? rockDarkMat : rockMat,
    );
    rock.position.set(x, y, z);
    rock.rotation.set(rx, ry, rz);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  // ── พื้นทางเดินดินใต้ป้าย ──
  const trailGeo = new THREE.CircleGeometry(0.75, 14);
  trailGeo.rotateX(-Math.PI / 2);
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.position.y = 0.02;
  trail.receiveShadow = true;
  group.add(trail);

  return group;
}