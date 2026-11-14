// src/components/3d/structures/ResidentialHouses.ts
import * as THREE from 'three';
import { HOUSE_DEFS } from '../../../types/game';
import {
  HouseMaterials,
  HouseMeshBuilder,
  buildPicketYardFence,
} from './HouseMeshBuilder';
import { STILT_DIMS, HOUSE_DOOR_PIVOT_NAME } from './stiltDims';

/** 0) กระท่อมไม้เล็ก */
export function buildCabinHouse(b: HouseMeshBuilder, m: HouseMaterials): number {
  const cz = -0.6, W = 3.4, D = 3.0, H = 2.2;

  b.setPart('floor');
  b.box(W + 0.9, 0.08, D + 0.9, m.woodLight, 0, 0.04, cz + 0.15);
  b.box(W + 0.2, 0.3, D + 0.2, m.stone, 0, 0.15, cz);
  b.box(1.5, 0.15, 0.6, m.woodDark, 0, 0.075, cz + D / 2 + 0.4);

  b.setPart('wall');
  b.box(W, H, D, m.wood, 0, 0.3 + H / 2, cz);
  b.box(0.95, 1.65, 0.1, m.woodDark, 0, 0.3 + 0.83, cz + D / 2 + 0.03);

  b.setPart(undefined);
  b.box(0.08, 0.08, 0.14, m.glass, 0.3, 0.3 + 0.85, cz + D / 2 + 0.1);

  b.gable(W, D, 1.5, 0.35, m.roofBrown, m.woodLight, 0.3 + H, cz);
  b.window(-W / 2 - 0.02, 1.5, cz, -Math.PI / 2, m.woodLight, m.glass);
  b.window(W / 2 + 0.02, 1.5, cz, Math.PI / 2, m.woodLight, m.glass);
  b.window(-1.15, 1.55, cz + D / 2 + 0.02, 0, m.woodLight, m.glass, 0.7, 0.7);

  b.setPart('chimney');
  b.box(0.55, 1.6, 0.55, m.stone, 1.0, 3.3, cz - 0.6);
  b.box(0.66, 0.12, 0.66, m.stone, 1.0, 4.14, cz - 0.6);

  b.setPart(undefined);
  return cz + D / 2 + 0.7;
}

/** 1) บ้านไม้มีระเบียง */
export function buildPorchHouse(b: HouseMeshBuilder, m: HouseMaterials): number {
  const cz = -0.9, W = 4.6, D = 3.4, H = 2.4;
  const fz = cz + D / 2;

  b.setPart('floor');
  b.box(W + 0.8, 0.08, D + 2.1, m.woodLight, 0, 0.04, cz + 0.85);
  b.box(W + 0.2, 0.3, D + 0.2, m.stone, 0, 0.15, cz);
  b.box(W, 0.2, 1.5, m.woodDark, 0, 0.3, fz + 0.75);
  b.box(1.6, 0.15, 0.5, m.woodDark, 0, 0.075, fz + 1.75);

  b.setPart('wall');
  b.box(W, H, D, m.woodLight, 0, 0.3 + H / 2, cz);
  b.box(1.0, 1.75, 0.1, m.woodDark, 0, 0.4 + 0.87, fz + 0.03);
  for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) {
    b.box(0.15, 2.4, 0.15, m.woodDark, x, 1.5, fz + 1.4);
  }

  b.setPart('fence');
  const rl = W / 2 - 0.7;
  b.box(rl, 0.07, 0.07, m.woodDark, -(0.7 + W / 2) / 2, 0.95, fz + 1.4);
  b.box(rl, 0.07, 0.07, m.woodDark, (0.7 + W / 2) / 2, 0.95, fz + 1.4);

  b.setPart('roof');
  b.box(W + 0.4, 0.1, 1.9, m.roofBrown, 0, 2.75, fz + 0.85, 0, 0.12);

  b.gable(W, D, 1.7, 0.4, m.roofBrown, m.wood, 0.3 + H, cz);
  b.window(-1.5, 1.6, fz + 0.02, 0, m.wood, m.glass);
  b.window(1.5, 1.6, fz + 0.02, 0, m.wood, m.glass);
  b.window(-W / 2 - 0.02, 1.6, cz, -Math.PI / 2, m.wood, m.glass);
  b.window(W / 2 + 0.02, 1.6, cz, Math.PI / 2, m.wood, m.glass);

  b.setPart('chimney');
  b.box(0.6, 1.8, 0.6, m.stone, -1.4, 3.5, cz - 0.7);
  b.box(0.72, 0.12, 0.72, m.stone, -1.4, 4.44, cz - 0.7);

  b.setPart(undefined);
  return fz + 2.0;
}

/** 2) บ้านไม้สองชั้น */
export function buildTwoStoryHouse(b: HouseMeshBuilder, m: HouseMaterials): number {
  const cz = -1.0, W = 4.0, D = 3.4;
  const fz = cz + D / 2;

  b.setPart('floor');
  b.box(W + 0.9, 0.08, D + 1.5, m.woodLight, 0, 0.04, cz + 0.5);
  b.box(W + 0.2, 0.3, D + 0.2, m.stone, 0, 0.15, cz);
  b.box(2.6, 0.14, 1.1, m.woodDark, 0, 2.62, fz + 0.55);
  b.box(1.6, 0.15, 0.5, m.woodDark, 0, 0.075, fz + 0.4);

  b.setPart('wall');
  b.box(W, 2.2, D, m.wood, 0, 0.3 + 1.1, cz);
  b.box(W + 0.12, 0.14, D + 0.12, m.woodDark, 0, 2.55, cz);
  b.box(W, 2.0, D, m.woodLight, 0, 2.62 + 1.0, cz);
  b.box(0.95, 1.7, 0.1, m.woodDark, 0, 0.3 + 0.85, fz + 0.03);
  b.box(0.9, 1.6, 0.1, m.woodDark, 0, 2.7 + 0.8, fz + 0.03);
  for (const x of [-1.2, 1.2]) b.box(0.12, 2.3, 0.12, m.woodDark, x, 1.45, fz + 1.05);

  b.setPart('fence');
  b.box(2.6, 0.06, 0.06, m.woodDark, 0, 3.15, fz + 1.08);
  for (let i = -4; i <= 4; i++) b.box(0.05, 0.5, 0.05, m.woodDark, i * 0.3, 2.9, fz + 1.08);

  b.gable(W, D, 1.7, 0.4, m.roofBrown, m.woodLight, 4.62, cz);
  b.window(-1.3, 1.5, fz + 0.02, 0, m.woodLight, m.glass, 0.8, 0.8);
  b.window(1.3, 1.5, fz + 0.02, 0, m.woodLight, m.glass, 0.8, 0.8);
  b.window(-1.35, 3.6, fz + 0.02, 0, m.wood, m.glass, 0.8, 0.8);
  b.window(1.35, 3.6, fz + 0.02, 0, m.wood, m.glass, 0.8, 0.8);
  b.window(-W / 2 - 0.02, 3.6, cz, -Math.PI / 2, m.wood, m.glass);
  b.window(W / 2 + 0.02, 3.6, cz, Math.PI / 2, m.wood, m.glass);
  b.window(-W / 2 - 0.02, 1.5, cz, -Math.PI / 2, m.woodLight, m.glass);
  b.window(W / 2 + 0.02, 1.5, cz, Math.PI / 2, m.woodLight, m.glass);

  b.setPart('chimney');
  b.box(0.6, 1.8, 0.6, m.stone, 1.2, 5.3, cz - 0.8);
  b.box(0.72, 0.12, 0.72, m.stone, 1.2, 6.24, cz - 0.8);

  b.setPart(undefined);
  return fz + 0.7;
}

/** 3) กระท่อมทรงสามเหลี่ยม A-Frame */
export function buildAFrameHouse(b: HouseMeshBuilder, m: HouseMaterials): number {
  const cz = -0.8, W = 4.8, D = 4.0, H = 4.4;
  const fz = cz + D / 2;

  b.setPart('wall');
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, 0);
  sh.lineTo(W / 2, 0);
  sh.lineTo(0, H);
  sh.closePath();
  const body = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false });
  body.translate(0, 0.15, cz - D / 2);
  b.add(body, m.log);
  b.box(0.07, 2.9, 0.1, m.woodDark, 0, 2.55, fz + 0.04);
  b.box(2.2, 0.07, 0.1, m.woodDark, 0, 2.2, fz + 0.04);
  b.box(0.95, 1.5, 0.1, m.woodDark, 0, 0.9, fz + 0.04);

  // แผ่นหลังคาลาดสองด้านคลุม A-Frame เพื่อแยกส่วนหลังคากับผนังได้ชัดเจน
  b.setPart('roof');
  const slopeLen = Math.hypot(W / 2 + 0.25, H + 0.18);
  const slopeAng = Math.atan2(H, W / 2);
  b.box(slopeLen, 0.14, D + 0.45, m.roofBrown, -(W / 4) - 0.06, 0.15 + H / 2, cz, 0, 0, slopeAng);
  b.box(slopeLen, 0.14, D + 0.45, m.roofBrown, W / 4 + 0.06, 0.15 + H / 2, cz, 0, 0, -slopeAng);

  b.setPart('floor');
  b.box(W + 0.4, 0.15, D + 0.4, m.stone, 0, 0.075, cz);
  b.box(3.4, 0.2, 1.6, m.woodDark, 0, 0.2, fz + 0.8);
  b.box(1.6, 0.15, 0.5, m.woodDark, 0, 0.075, fz + 1.85);

  b.setPart('fence');
  b.box(3.4, 0.07, 0.07, m.woodDark, 0, 0.95, fz + 1.55);
  for (const x of [-1.65, 1.65]) b.box(0.1, 0.85, 0.1, m.woodDark, x, 0.65, fz + 1.55);

  b.setPart(undefined);
  const gs = new THREE.Shape();
  gs.moveTo(-1.5, 0);
  gs.lineTo(1.5, 0);
  gs.lineTo(0, 2.9);
  gs.closePath();
  const glassGeo = new THREE.ShapeGeometry(gs);
  b.add(glassGeo, m.glass, 0, 1.15, fz + 0.015);

  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4 - r; i++) {
      b.cyl(
        0.14,
        1.3,
        m.wood,
        W / 2 + 0.55,
        0.16 + r * 0.26,
        cz - 0.8 + i * 0.3 + r * 0.15,
        0,
        Math.PI / 2
      );
    }
  }

  b.setPart('chimney');
  b.cyl(0.18, 1.6, m.stone, -0.6, 4.35, cz - 1.2);
  b.cyl(0.24, 0.1, m.stone, -0.6, 5.18, cz - 1.2);

  b.setPart(undefined);
  return fz + 2.1;
}

export { STILT_DIMS, HOUSE_DOOR_PIVOT_NAME };

/**
 * 4) เรือนไม้ยกพื้น (ใต้ถุนสูง)
 * walkable = true → ผนังกลวง (เดินเข้าห้องได้) และประตูเป็นชิ้นแยกที่หมุนเปิดได้
 */
export function buildStiltHouse(
  b: HouseMeshBuilder,
  m: HouseMaterials,
  walkable = false
): number {
  const { cz, W, D, FY } = STILT_DIMS;
  const fz = cz + D / 2;

  b.setPart('floor');
  b.box(W + 1.2, 0.08, D + 1.0, m.stone, 0, 0.04, cz);
  for (const x of [-W / 2 - 0.4, 0, W / 2 + 0.4]) {
    for (const z of [cz - D / 2 - 0.2, cz + D / 2 + 0.2]) {
      b.cyl(0.13, FY, m.woodDark, x, FY / 2, z);
      b.box(0.34, 0.12, 0.34, m.stone, x, 0.06, z);
    }
  }
  b.box(W + 1.0, 0.2, D + 0.6, m.woodLight, 0, FY, cz);
  b.box(W + 1.0, 0.2, 1.4, m.woodLight, 0, FY, fz + 1.0);

  const stairZ0 = fz + 1.7;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    b.box(1.3, 0.14, 0.34, m.woodDark, 0, FY - 0.15 - i * 0.26, stairZ0 + 0.17 + i * 0.33);
  }

  b.setPart('wall');
  if (walkable) {
    const t = STILT_DIMS.wallT;
    const { doorW, doorH } = STILT_DIMS;
    const y0 = FY + 0.1;
    const wy = y0 + 1.0;
    b.box(W, 2.0, t, m.wood, 0, wy, cz - D / 2 + t / 2); // ผนังหลัง
    b.box(t, 2.0, D, m.wood, -W / 2 + t / 2, wy, cz); // ผนังซ้าย
    b.box(t, 2.0, D, m.wood, W / 2 - t / 2, wy, cz); // ผนังขวา
    const sideW = W / 2 - doorW / 2;
    const sideX = doorW / 2 + sideW / 2;
    b.box(sideW, 2.0, t, m.wood, -sideX, wy, fz - t / 2); // ผนังหน้าซ้ายของประตู
    b.box(sideW, 2.0, t, m.wood, sideX, wy, fz - t / 2); // ผนังหน้าขวาของประตู
    b.box(doorW, 2.0 - doorH, t, m.wood, 0, y0 + doorH + (2.0 - doorH) / 2, fz - t / 2); // คานเหนือประตู
  } else {
    b.box(W, 2.0, D, m.wood, 0, FY + 0.1 + 1.0, cz);
    b.box(0.95, 1.7, 0.1, m.woodDark, 0, FY + 0.1 + 0.85, fz + 0.03);
  }

  b.gable(W, D, 2.3, 0.55, m.roofRed, m.woodLight, FY + 2.1, cz);

  b.setPart('roof');
  for (const s of [1, -1]) {
    const zz = cz + s * (D / 2 + 0.55);
    b.box(0.08, 0.9, 0.06, m.woodDark, 0, FY + 2.1 + 2.3 + 0.3, zz, 0, 0, 0.45);
    b.box(0.08, 0.9, 0.06, m.woodDark, 0, FY + 2.1 + 2.3 + 0.3, zz, 0, 0, -0.45);
  }

  b.window(-1.2, FY + 1.3, fz + 0.02, 0, m.woodDark, m.glass, 0.75, 0.85);
  b.window(1.2, FY + 1.3, fz + 0.02, 0, m.woodDark, m.glass, 0.75, 0.85);
  b.window(-W / 2 - 0.02, FY + 1.3, cz, -Math.PI / 2, m.woodDark, m.glass);
  b.window(W / 2 + 0.02, FY + 1.3, cz, Math.PI / 2, m.woodDark, m.glass);

  b.setPart('fence');
  const rw = (W + 1.0) / 2 - 0.8;
  b.box(rw, 0.07, 0.07, m.woodDark, -(0.8 + (W + 1.0) / 2) / 2, FY + 0.95, fz + 1.65);
  b.box(rw, 0.07, 0.07, m.woodDark, (0.8 + (W + 1.0) / 2) / 2, FY + 0.95, fz + 1.65);
  for (const x of [-(W + 1.0) / 2 + 0.05, (W + 1.0) / 2 - 0.05, -0.8, 0.8]) {
    b.box(0.1, 0.85, 0.1, m.woodDark, x, FY + 0.55, fz + 1.65);
  }

  b.setPart('chimney');
  b.box(0.5, 1.7, 0.5, m.stone, -1.15, FY + 3.4, cz - 0.65);
  b.box(0.62, 0.1, 0.62, m.stone, -1.15, FY + 4.28, cz - 0.65);

  b.setPart(undefined);
  b.cyl(0.3, 0.7, m.roofRed, W / 2 + 0.2, 0.35, cz + 0.4);
  return stairZ0 + steps * 0.33;
}

/** สร้างบ้านพักอาศัยไม้ (ประเภท 0..4) พร้อมรั้วและทางเดินหน้าบ้าน */
export function buildResidentialHouseWithYard(
  type: number,
  m: HouseMaterials
): THREE.Group {
  const def = HOUSE_DEFS[type] ?? HOUSE_DEFS[0];
  const b = new HouseMeshBuilder();
  const yard = def.yard;

  let doorZ = 0;
  switch (type) {
    case 0:
      doorZ = buildCabinHouse(b, m);
      break;
    case 1:
      doorZ = buildPorchHouse(b, m);
      break;
    case 2:
      doorZ = buildTwoStoryHouse(b, m);
      break;
    case 3:
      doorZ = buildAFrameHouse(b, m);
      break;
    default:
      doorZ = buildStiltHouse(b, m, type === 4);
      break;
  }

  buildPicketYardFence(b, m, yard);

  const gateZ = yard / 2 - 0.2;
  const len = Math.max(0.5, gateZ - doorZ);
  b.setPart('floor');
  b.box(1.3, 0.05, len, m.stone, 0, 0.025, doorZ + len / 2);
  b.setPart(undefined);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.roofRed,
    m.stone,
    m.fence,
  ]);
  const g = b.build(cast, new Set([m.dirt]), m.fence);
  g.name = `House_${type}`;
  if (type === 4) g.add(createStiltDoorPivot(m));
  return g;
}

/** ประตูหน้าเรือนไม้ยกพื้น: pivot อยู่ที่บานพับ (ซ้ายของช่องประตู) หมุนรอบแกน Y เพื่อเปิด-ปิด */
function createStiltDoorPivot(m: HouseMaterials): THREE.Group {
  const { cz, D, FY, doorW, doorH } = STILT_DIMS;
  const fz = cz + D / 2;
  const pivot = new THREE.Group();
  pivot.name = HOUSE_DOOR_PIVOT_NAME;
  pivot.position.set(-doorW / 2, FY + 0.1 + doorH / 2, fz + 0.03);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.1), m.woodDark);
  leaf.position.x = doorW / 2;
  leaf.castShadow = true;
  leaf.receiveShadow = true;
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.16), m.glass);
  knob.position.set(doorW - 0.14, 0, 0);
  pivot.add(leaf, knob);
  return pivot;
}
