// src/worlds/hua-hin-fish-bridge/environment/PierMarket.ts
// บนสะพาน: แผงขายอาหารทะเลสองข้างทาง (ร่มลายสลับสี/ถาดปลา/ปลาตากแห้ง) / เสาโคมไฟ / ศาลาแดงและประภาคารปลายสะพาน
import * as THREE from 'three';
import { BRIDGE } from './StoneBridge';
import type { Collider } from './PierEntrance';
import { GeoBatch, makeUmbrellaTexture, mat4, screenX, seeded, stdMat } from './PierKit';

/** ตำแหน่งแผงตามแนวสะพาน (ใช้ร่วมกับคนขายของใน PierVendors) แผงที่ i อยู่ที่ z = firstZ + i*step ทั้งสองข้างทาง */
export const STALL_LAYOUT = { firstZ: 1.2, step: 3.5 } as const;

const colliders: Collider[] = [];
export const getMarketColliders = (): readonly Collider[] => colliders;

const UMBRELLAS: Array<[string, string]> = [
  ['#e8453c', '#ffffff'], ['#2f62d4', '#ffffff'], ['#8a4fd0', '#ffffff'],
  ['#2fa66a', '#ffffff'], ['#f08a2a', '#ffffff'], ['#2fb2d4', '#ffffff'],
];

export function createMarketStalls(): THREE.Group {
  colliders.length = 0;
  const b = new GeoBatch();
  const dy = BRIDGE.deckY;
  const tableWood = stdMat(0xc98a3e, 0.85);
  const tableTop = stdMat(0xa56d2b, 0.9);
  const crateBlue = stdMat(0x2d6fc4, 0.7);
  const crateGreen = stdMat(0x2f9e6d, 0.7);
  const ice = stdMat(0xf4f9ff, 0.6);
  const poleMat = stdMat(0xd8d2c4, 0.6, { metalness: 0.3 });
  const dried = stdMat(0xe3c08d, 0.8);
  const goods = [0xb9c7d0, 0xe9863a, 0xe58b9a, 0xd2452f, 0xcaa66b].map((c) => stdMat(c, 0.55, { metalness: 0.15 }));
  const umbrellaMats = UMBRELLAS.map(([a, c]) => new THREE.MeshStandardMaterial({ map: makeUmbrellaTexture(a, c), roughness: 0.75, side: THREE.DoubleSide }));

  const rnd = seeded(2024);
  const umbrellaGeo = new THREE.ConeGeometry(2.05, 0.6, 8, 1, false);
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.05, 2.7, 6);
  const dryGeo = new THREE.CylinderGeometry(0.045, 0.07, 0.46, 6);

  const first = STALL_LAYOUT.firstZ;
  const step = STALL_LAYOUT.step;
  const last = BRIDGE.endZ - 9;
  let idx = 0;
  for (let z = first; z <= last; z += step, idx++) {
    for (const s of [-1, 1] as const) {
      const cx = s * 4.45; // กึ่งกลางโต๊ะ (ขอบในที่ ~3.75 → อยู่นอกเลนเดิน 3.3)
      const variant = (idx + (s > 0 ? 2 : 0)) % UMBRELLAS.length;

      // โต๊ะ + ฐาน
      b.box(1.5, 0.85, 2.7, tableWood, [cx, dy + 0.425, z]);
      b.box(1.6, 0.06, 2.8, tableTop, [cx, dy + 0.88, z]);
      // ถาดปลาสีฟ้า + น้ำแข็ง + ของขาย
      for (const dz of [-0.68, 0.68]) {
        b.box(1.15, 0.3, 0.95, crateBlue, [cx, dy + 1.05, z + dz]);
        b.box(1.05, 0.05, 0.85, ice, [cx, dy + 1.22, z + dz]);
        const g = goods[Math.floor(rnd() * goods.length)];
        b.box(0.95, 0.09, 0.72, g, [cx, dy + 1.29, z + dz]);
        // ตัวปลา/กุ้งนูนบนถาด
        for (let k = 0; k < 4; k++) {
          b.add(new THREE.SphereGeometry(0.1, 6, 5), g, mat4([cx + (rnd() - 0.5) * 0.7, dy + 1.36, z + dz + (rnd() - 0.5) * 0.55], [0, 0, 0], [1.6, 0.7, 0.8]));
        }
      }
      // ลังด้านหลัง
      b.box(0.8, 0.45, 0.8, crateGreen, [s * 5.55, dy + 0.23, z - 0.7]);
      b.box(0.8, 0.45, 0.8, crateBlue, [s * 5.55, dy + 0.68, z - 0.7]);
      b.box(0.8, 0.45, 0.8, crateBlue, [s * 5.55, dy + 0.23, z + 0.7]);

      // ร่มลายสลับสี
      b.add(poleGeo, poleMat, mat4([s * 5.0, dy + 1.35, z]));
      b.add(umbrellaGeo, umbrellaMats[variant], mat4([s * 4.65, dy + 2.9, z], [0, (idx * 0.4) % 1, 0]));
      b.add(new THREE.SphereGeometry(0.08, 6, 5), poleMat, mat4([s * 4.65, dy + 3.22, z]));

      // ปลาหมึก/ปลาตากแห้งแขวน (แผงสลับ)
      if ((idx + (s > 0 ? 1 : 0)) % 3 === 0) {
        b.box(0.05, 0.05, 2.3, poleMat, [s * 3.9, dy + 2.2, z]);
        for (let k = 0; k < 6; k++) {
          const hz = z - 1.0 + k * 0.4;
          b.box(0.012, 0.18, 0.012, poleMat, [s * 3.9, dy + 2.09, hz]);
          b.add(dryGeo, dried, mat4([s * 3.9, dy + 1.8, hz]));
        }
      }
      // Collision: ตัวแผงทั้งโต๊ะ (ไม่ให้เดินทะลุ)
      colliders.push({ x: screenX(s * 4.5), z, hx: 1.0, hz: 1.4 });
    }
  }
  umbrellaGeo.dispose(); poleGeo.dispose(); dryGeo.dispose();
  return b.build('MarketStalls');
}

/** เสาโคมไฟริมสะพาน: ไฟเรืองแสง (emissive) ไม่ใช้ PointLight เพื่อไม่ถ่วงเครื่อง */
export function createPierLamps(): THREE.Group {
  const b = new GeoBatch();
  const dark = stdMat(0x2c2c30, 0.5, { metalness: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffc861, emissiveIntensity: 1.4, roughness: 0.3 });
  const dy = BRIDGE.deckY;
  for (let z = 3.0; z <= BRIDGE.endZ - 2; z += 7) {
    for (const s of [-1, 1]) {
      const x = s * (BRIDGE.halfWidth - 0.35);
      b.add(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 6), dark, mat4([x, dy + 1.8, z]));
      b.box(0.34, 0.1, 0.34, dark, [x, dy + 3.62, z]);
      b.add(new THREE.SphereGeometry(0.24, 10, 8), glow, mat4([x, dy + 3.9, z]));
      b.add(new THREE.ConeGeometry(0.3, 0.2, 8), dark, mat4([x, dy + 4.15, z]));
    }
  }
  return b.build('PierLamps');
}

/** ปลายสะพาน: ศาลาหลังคาแดง + ประภาคารขาว-แดง */
export function createPierEnd(): THREE.Group {
  const b = new GeoBatch();
  const dy = BRIDGE.deckY;
  const white = stdMat(0xf3f0e8, 0.7);
  const red = stdMat(0xcf3a30, 0.7);
  const dark = stdMat(0x3a3a3f, 0.6);
  const glassOn = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffd36a, emissiveIntensity: 1.6, roughness: 0.3 });

  // ศาลา (กึ่งกลางเลนเดิน)
  const gz = BRIDGE.endZ - 6.5;
  const gx = [-2.2, 2.2];
  const gzs = [gz - 2.2, gz + 2.2];
  for (const x of gx) for (const z of gzs) {
    b.box(0.3, 3.4, 0.3, white, [x, dy + 1.7, z], undefined, true);
    colliders.push({ x, z, hx: 0.35, hz: 0.35 });
  }
  b.add(new THREE.CylinderGeometry(0.01, 3.9, 1.9, 4, 1).rotateY(Math.PI / 4), red, mat4([0, dy + 3.4 + 0.95, gz]), true);
  b.box(5.2, 0.18, 5.2, white, [0, dy + 3.42, gz]);
  b.add(new THREE.SphereGeometry(0.22, 8, 6), white, mat4([0, dy + 5.5, gz]));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4), dark, mat4([0, dy + 5.85, gz]));

  // ประภาคาร (ขวาจอ)
  const lx = screenX(4.7);
  const lz = BRIDGE.endZ - 2.2;
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const r0 = 1.15 - i * 0.1;
    const r1 = 1.05 - i * 0.1;
    b.add(new THREE.CylinderGeometry(r1, r0, 1.3, 14), i % 2 === 0 ? white : red, mat4([lx, dy + 0.65 + i * 1.3, lz]), true);
  }
  const topY = dy + bands * 1.3;
  b.add(new THREE.CylinderGeometry(0.95, 0.95, 0.16, 14), dark, mat4([lx, topY + 0.08, lz]));
  b.add(new THREE.CylinderGeometry(0.52, 0.52, 1.0, 12), glassOn, mat4([lx, topY + 0.66, lz]));
  b.add(new THREE.ConeGeometry(0.78, 0.7, 12), red, mat4([lx, topY + 1.5, lz]));
  b.add(new THREE.SphereGeometry(0.1, 6, 5), dark, mat4([lx, topY + 1.95, lz]));
  colliders.push({ x: lx, z: lz, hx: 1.3, hz: 1.3 });
  return b.build('PierEnd');
}
