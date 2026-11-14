// src/components/3d/structures/AnimalEnclosures.ts
import * as THREE from 'three';
import { HouseMaterials, HouseMeshBuilder } from './HouseMeshBuilder';

/** 15) คอกม้าชนบทพร้อมซุ้มหลังคา รางหญ้า และรั้วลานวิ่ง */
export function buildHorseStableProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    roughness: 0.1,
    metalness: 0.1,
  });

  const yard = 7.0;
  const h = yard / 2 - 0.2;
  const gateW = 1.4;

  const dirtPlane = new THREE.PlaneGeometry(yard - 0.2, yard - 0.2);
  dirtPlane.rotateX(-Math.PI / 2);
  b.add(dirtPlane, m.dirt, 0, 0.02, 0);

  const shedW = 3.6, shedD = 2.4, shedH = 2.4;
  const shedX = -0.8, shedZ = -h + shedD / 2 + 0.1;

  b.setPart('wall');
  for (const sx of [-shedW / 2, shedW / 2]) {
    for (const sz of [-shedD / 2, shedD / 2]) {
      b.box(0.24, shedH, 0.24, m.woodDark, shedX + sx, shedH / 2, shedZ + sz);
    }
  }

  b.box(shedW, shedH * 0.85, 0.12, m.wood, shedX, (shedH * 0.85) / 2, shedZ - shedD / 2);
  b.box(0.12, shedH * 0.85, shedD, m.wood, shedX - shedW / 2, (shedH * 0.85) / 2, shedZ);
  b.setPart('roof');
  b.box(shedW + 0.6, 0.12, shedD + 0.6, m.roofBrown, shedX, shedH + 0.1, shedZ, 0, 0, 0.08);
  b.setPart('floor');
  b.box(shedW - 0.4, 0.15, shedD - 0.4, strawMat, shedX, 0.08, shedZ);
  b.setPart(undefined);

  b.box(0.9, 0.45, 0.55, strawMat, shedX - 0.8, 0.25, shedZ - 0.5, 0.2);
  b.box(0.85, 0.42, 0.5, strawMat, shedX - 0.75, 0.65, shedZ - 0.45, -0.15);

  const mangerX = shedX + 0.9, mangerZ = shedZ - 0.5;
  b.box(1.2, 0.55, 0.55, m.woodDark, mangerX, 0.35, mangerZ);
  b.box(1.08, 0.25, 0.44, strawMat, mangerX, 0.55, mangerZ);

  const troughX = 1.6, troughZ = -1.8;
  b.box(1.3, 0.5, 0.65, m.stone, troughX, 0.25, troughZ);
  b.box(1.15, 0.08, 0.52, waterMat, troughX, 0.42, troughZ);

  const postDist = 1.6;
  const postH = 1.3;
  const fenceRails = (alongX: boolean, fixed: number, from: number, to: number) => {
    const len = to - from;
    const count = Math.max(1, Math.round(len / postDist));
    for (let i = 0; i <= count; i++) {
      const p = from + (len * i) / count;
      if (alongX) b.box(0.18, postH, 0.18, m.woodDark, p, postH / 2, fixed);
      else b.box(0.18, postH, 0.18, m.woodDark, fixed, postH / 2, p);
    }
    const mid = (from + to) / 2;
    for (const y of [0.4, 0.75, 1.1]) {
      if (alongX) b.box(len, 0.08, 0.06, m.fence, mid, y, fixed);
      else b.box(0.06, 0.08, len, m.fence, fixed, y, mid);
    }
  };

  b.setPart('fence');
  fenceRails(true, -h, -h, h);
  fenceRails(false, -h, -h, h);
  fenceRails(false, h, -h, h);
  fenceRails(true, h, -h, -gateW / 2);
  fenceRails(true, h, gateW / 2, h);

  const archH = 2.2;
  b.box(0.24, archH, 0.24, m.woodDark, -gateW / 2, archH / 2, h);
  b.box(0.24, archH, 0.24, m.woodDark, gateW / 2, archH / 2, h);
  b.box(gateW + 0.4, 0.25, 0.12, m.woodDark, 0, archH - 0.1, h);
  b.box(gateW + 0.2, 0.28, 0.16, m.woodLight, 0, archH + 0.14, h);
  b.setPart(undefined);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.stone,
    m.fence,
    strawMat,
  ]);
  const group = b.build(cast, new Set([m.dirt, waterMat]), m.fence);
  group.name = 'House_15_HorseStable';
  return group;
}

/** 16) คอกวัวชนบทพร้อมโรงนอน รางฟาง หญ้าแห้ง รางน้ำดื่ม และรั้วลานวิ่ง */
export function buildCowCorralProcedural(m: HouseMaterials): THREE.Group {
  const b = new HouseMeshBuilder();
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.95 });
  const freshHayMat = new THREE.MeshStandardMaterial({ color: 0xc8b858, roughness: 0.9 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    roughness: 0.1,
    metalness: 0.1,
  });
  const barnRedMat = new THREE.MeshStandardMaterial({ color: 0x8b251e, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    roughness: 0.3,
    metalness: 0.7,
  });
  const saltLickMat = new THREE.MeshStandardMaterial({ color: 0xf48fb1, roughness: 0.9 });

  const yard = 7.0;
  const h = yard / 2 - 0.2;
  const gateW = 1.4;

  const dirtPlane = new THREE.PlaneGeometry(yard - 0.2, yard - 0.2);
  dirtPlane.rotateX(-Math.PI / 2);
  b.add(dirtPlane, m.dirt, 0, 0.02, 0);

  const strawPatch = new THREE.PlaneGeometry(yard - 1.2, yard - 1.2);
  strawPatch.rotateX(-Math.PI / 2);
  b.add(strawPatch, strawMat, 0, 0.03, 0);

  const barnW = 3.8, barnD = 2.6, barnH = 2.6;
  const barnX = -0.6, barnZ = -h + barnD / 2 + 0.1;

  b.setPart('wall');
  for (const sx of [-barnW / 2, 0, barnW / 2]) {
    for (const sz of [-barnD / 2, barnD / 2]) {
      b.box(0.24, barnH, 0.24, barnRedMat, barnX + sx, barnH / 2, barnZ + sz);
    }
  }

  b.box(barnW, barnH * 0.88, 0.12, barnRedMat, barnX, (barnH * 0.88) / 2, barnZ - barnD / 2);
  b.box(0.12, barnH * 0.88, barnD, barnRedMat, barnX - barnW / 2, (barnH * 0.88) / 2, barnZ);
  b.box(1.8, 0.1, 0.14, m.woodLight, barnX, barnH * 0.45, barnZ - barnD / 2, 0, 0, 0.6);
  b.box(1.8, 0.1, 0.14, m.woodLight, barnX, barnH * 0.45, barnZ - barnD / 2, 0, 0, -0.6);

  b.setPart('roof');
  b.box(barnW + 0.5, 0.12, barnD + 0.5, m.roofBrown, barnX, barnH + 0.2, barnZ, 0, 0, 0.09);
  b.setPart('floor');
  b.box(barnW - 0.4, 0.18, barnD - 0.4, freshHayMat, barnX, 0.09, barnZ);
  b.setPart(undefined);

  b.box(0.9, 0.5, 0.6, strawMat, barnX - 1.0, 0.25, barnZ - 0.4, 0.15);
  b.box(0.85, 0.45, 0.55, strawMat, barnX - 0.95, 0.7, barnZ - 0.35, -0.1);
  b.box(0.9, 0.5, 0.6, strawMat, barnX - 0.1, 0.25, barnZ - 0.5, -0.2);

  const mangerX = barnX + 1.1, mangerZ = barnZ - 0.4;
  b.box(1.5, 0.6, 0.65, m.woodDark, mangerX, 0.3, mangerZ);
  b.box(1.36, 0.28, 0.52, freshHayMat, mangerX, 0.55, mangerZ);

  const waterTroughX = 1.7, waterTroughZ = -1.8;
  b.box(1.4, 0.52, 0.7, m.stone, waterTroughX, 0.26, waterTroughZ);
  b.box(1.24, 0.1, 0.56, waterMat, waterTroughX, 0.44, waterTroughZ);

  const stumpX = 1.8, stumpZ = 0.5;
  b.cyl(0.25, 0.45, m.log, stumpX, 0.22, stumpZ);
  b.box(0.3, 0.3, 0.3, saltLickMat, stumpX, 0.58, stumpZ, 0.2);

  b.cyl(0.18, 0.65, metalMat, -gateW / 2 - 0.4, 0.32, h - 0.3);
  b.cyl(0.16, 0.55, metalMat, -gateW / 2 - 0.7, 0.27, h - 0.4);

  const postDist = 1.6;
  const postH = 1.35;
  const fenceRails = (alongX: boolean, fixed: number, from: number, to: number) => {
    const len = to - from;
    const count = Math.max(1, Math.round(len / postDist));
    for (let i = 0; i <= count; i++) {
      const p = from + (len * i) / count;
      if (alongX) b.box(0.2, postH, 0.2, m.woodDark, p, postH / 2, fixed);
      else b.box(0.2, postH, 0.2, m.woodDark, fixed, postH / 2, p);
    }
    const mid = (from + to) / 2;
    for (const y of [0.42, 0.8, 1.18]) {
      if (alongX) b.box(len, 0.09, 0.07, m.fence, mid, y, fixed);
      else b.box(0.07, 0.09, len, m.fence, fixed, y, mid);
    }
  };

  b.setPart('fence');
  fenceRails(true, -h, -h, h);
  fenceRails(false, -h, -h, h);
  fenceRails(false, h, -h, h);
  fenceRails(true, h, -h, -gateW / 2);
  fenceRails(true, h, gateW / 2, h);

  const archH = 2.3;
  b.box(0.26, archH, 0.26, m.woodDark, -gateW / 2, archH / 2, h);
  b.box(0.26, archH, 0.26, m.woodDark, gateW / 2, archH / 2, h);
  b.box(gateW + 0.4, 0.26, 0.14, m.woodDark, 0, archH - 0.1, h);
  b.box(gateW + 0.2, 0.3, 0.16, m.woodLight, 0, archH + 0.15, h);
  b.setPart(undefined);

  const cast = new Set<THREE.Material>([
    m.wood,
    m.woodLight,
    m.woodDark,
    m.log,
    m.roofBrown,
    m.stone,
    m.fence,
    strawMat,
    freshHayMat,
    barnRedMat,
    metalMat,
    saltLickMat,
  ]);
  const group = b.build(cast, new Set([m.dirt, waterMat]), m.fence);
  group.name = 'House_16_CowCorral';
  return group;
}
