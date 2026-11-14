// src/worlds/hua-hin-fish-bridge/environment/FishBridgeEnvironment.ts
// ประกอบฉาก: พื้นชายฝั่ง + ชายหาด + ทะเล + สะพานหิน + Return Gateway + Collision
import * as THREE from 'three';
import { BRIDGE, LAYOUT, bridgeGroundHeight, isInsideBridgeX, createStoneBridge, STAND_MARGIN_Z } from './StoneBridge';
import { createSea } from './SeaEnvironment';
import { createEntranceArch, createEntranceProps, createPlaza, createShoreline, getEntranceColliders, type Collider } from './PierEntrance';
import { createMarketStalls, createPierEnd, createPierLamps, getMarketColliders } from './PierMarket';
import { createHarborScenery } from './PierHarbor';
import { disposeMaterialTextures } from './PierKit';

export const RETURN_GATEWAY = { x: -12, z: -27, radius: 2.4 } as const;

export interface FishBridgeEnvironment {
  group: THREE.Group;
  update: (elapsed: number) => void;
  groundHeightAt: (x: number, z: number) => number;
  // ✅ FIX RISK-3: ลบ y ออกจาก signature (ไม่เคยใช้ และทำให้ type ไม่ตรง)
  resolveMove: (ox: number, oz: number, nx: number, nz: number) => { x: number; z: number };
  isNearReturnGateway: (x: number, z: number) => boolean;
  dispose: () => void;
}

const PLAYER_RADIUS = 0.4;

/** ชนวัตถุ (เสาซุ้ม/ป้าย/กระถาง/แผงขาย/ประภาคาร) แบบกล่องแกนขนาน ขยายด้วยรัศมีผู้เล่น */
function hitsCollider(list: readonly Collider[], x: number, z: number): boolean {
  for (const c of list) {
    if (Math.abs(x - c.x) < c.hx + PLAYER_RADIUS && Math.abs(z - c.z) < c.hz + PLAYER_RADIUS) return true;
  }
  return false;
}

/** ยืนได้ไหม: บก (z<=shoreZ) หรืออยู่บนทางเดินกลางสะพาน และไม่ชนวัตถุ */
function canStand(x: number, z: number, colliders: readonly Collider[]): boolean {
  if (x < LAYOUT.minX || x > LAYOUT.maxX || z < LAYOUT.minZ) return false;
  if (hitsCollider(colliders, x, z)) return false;
  if (z <= LAYOUT.shoreZ) return true;
  // ✅ FIX Q-1/Q-2: ใช้ isInsideBridgeX + STAND_MARGIN_Z เดียวกับ groundHeight
  return isInsideBridgeX(x) && z <= BRIDGE.endZ - STAND_MARGIN_Z;
}

/** Dispose helper: dedupe geometry/material ที่แชร์กันหลาย mesh */
function disposeGroup(group: THREE.Group): void {
  const seenGeo = new Set<THREE.BufferGeometry>();
  const seenMat = new Set<THREE.Material>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.geometry && !seenGeo.has(m.geometry)) {
      seenGeo.add(m.geometry);
      m.geometry.dispose();
    }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (mat && !seenMat.has(mat)) {
        seenMat.add(mat);
        disposeMaterialTextures(mat);
        mat.dispose();
      }
    }
  });
  group.clear();
}

export function createFishBridgeEnvironment(): FishBridgeEnvironment {
  const group = new THREE.Group();
  group.name = 'HuaHinFishBridgeEnvironment';

  // พื้นหญ้ากว้างพอให้ขอบโลกไม่โผล่ (หมอกกลืนไกลๆ) + ลานปูหินด้านหน้าซุ้ม
  const grassDepth = 140;
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(320, grassDepth).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6fb04a, roughness: 1 })
  );
  land.position.set(0, 0, LAYOUT.shoreZ - grassDepth / 2);
  land.receiveShadow = true;
  group.add(land);
  group.add(createPlaza());

  const sea = createSea();
  group.add(sea.group);
  group.add(createStoneBridge());

  // ── ตามภาพอ้างอิง: ซุ้มทางเข้า / ป้าย / กระถาง / รั้ว / แผงขาย / โคมไฟ / ศาลา+ประภาคาร / เรือ+เกาะ+ท้องฟ้า ──
  const colliders: Collider[] = [];
  group.add(createEntranceArch());
  group.add(createEntranceProps());
  group.add(createShoreline());
  group.add(createMarketStalls());
  group.add(createPierLamps());
  group.add(createPierEnd());
  colliders.push(...getEntranceColliders(), ...getMarketColliders());
  const harbor = createHarborScenery();
  group.add(harbor.group);

  // Return Gateway: วงแหวนเรืองแสง
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(RETURN_GATEWAY.radius, 0.14, 12, 40).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffa800, emissiveIntensity: 0.9 })
  );
  // ✅ FIX BUG-4: ยกขึ้นเป็น 0.5 ให้เห็นชัดตอนกล้องก้ม
  ring.position.set(RETURN_GATEWAY.x, 0.5, RETURN_GATEWAY.z);
  group.add(ring);

  return {
    group,
    update(elapsed) {
      sea.update(elapsed);
      harbor.update(elapsed);
      ring.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.04);
    },
    groundHeightAt: bridgeGroundHeight,
    // ✅ FIX BUG-2: ถ้าตำแหน่งเดิมก็ผิดกฎ → ดึงกลับจุดปลอดภัย (ไม่ค้างกลางทะเล)
    resolveMove(ox, oz, nx, nz) {
      if (canStand(nx, nz, colliders)) return { x: nx, z: nz };
      if (canStand(nx, oz, colliders)) return { x: nx, z: oz };
      if (canStand(ox, nz, colliders)) return { x: ox, z: nz };
      if (!canStand(ox, oz, colliders)) return { x: RETURN_GATEWAY.x, z: RETURN_GATEWAY.z };
      return { x: ox, z: oz };
    },
    isNearReturnGateway(x, z) {
      return Math.hypot(x - RETURN_GATEWAY.x, z - RETURN_GATEWAY.z) < RETURN_GATEWAY.radius + 0.8;
    },
    // ✅ FIX RISK-4 + Q-7: dedupe + clear group
    dispose() {
      sea.dispose();
      disposeGroup(group);
    },
  };
}