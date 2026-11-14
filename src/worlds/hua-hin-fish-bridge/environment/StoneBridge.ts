// src/worlds/hua-hin-fish-bridge/environment/StoneBridge.ts
// สะพานปลาปูหินยื่นออกทะเล (เดินได้จริง) + ค่าคงที่เลย์เอาต์ที่ใช้ร่วมกับ Collision
// เลย์เอาต์ตามภาพอ้างอิง: ลานหิน → ซุ้มทางเข้า → ทางเดินกลาง มีแผงขายของสองข้าง → ศาลาแดง + ประภาคารปลายสะพาน
import * as THREE from 'three';
import { GeoBatch, makePavingTexture, stdMat } from './PierKit';

export const LAYOUT = {
  minX: -44,
  maxX: 44,
  minZ: -33,
  maxZ: 62,
  shoreZ: -4,
  seaY: -0.45,
  seabedY: -2.2,
} as const;

export const BRIDGE = {
  centerX: 0,
  /** ครึ่งความกว้างพื้นสะพานทั้งหมด (รวมแผงข้างทาง) */
  halfWidth: 6.5,
  /** ครึ่งความกว้างทางเดินกลางที่ผู้เล่นเดินได้ (แผงขายของอยู่นอกเลนนี้) */
  walkHalfWidth: 3.3,
  startZ: LAYOUT.shoreZ,
  endZ: 58,
  deckY: 0.4,
  rampLength: 2.4,
  fishingZoneMinZ: 50,
} as const;

export const STAND_MARGIN_X = 0.35;
export const STAND_MARGIN_Z = 0.3;

/** อยู่ในเลนทางเดินกลางตามแกน X ไหม (ใช้เกณฑ์เดียวกับ canStand) */
export function isInsideBridgeX(x: number): boolean {
  return Math.abs(x - BRIDGE.centerX) <= BRIDGE.walkHalfWidth - STAND_MARGIN_X;
}

/** ความสูงพื้น ณ (x,z): 0 บนบก → ลาดขึ้น → deckY บนสะพาน */
export function bridgeGroundHeight(x: number, z: number): number {
  if (z <= BRIDGE.startZ) return 0;
  if (!isInsideBridgeX(x)) return 0;
  if (z > BRIDGE.endZ - STAND_MARGIN_Z) return BRIDGE.deckY;
  const t = Math.min(1, (z - BRIDGE.startZ) / BRIDGE.rampLength);
  return BRIDGE.deckY * t;
}

export function createStoneBridge(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'StoneBridge';

  const width = BRIDGE.halfWidth * 2;
  const deckStart = BRIDGE.startZ + BRIDGE.rampLength;
  const deckLen = BRIDGE.endZ - deckStart;
  const deckMidZ = deckStart + deckLen / 2;

  const sideStone = stdMat(0x8b8272, 0.95, { flatShading: true });
  const darkStone = stdMat(0x6f6a61, 1, { flatShading: true });
  const wood = stdMat(0x9a7447, 0.9);
  const rope = stdMat(0xd9c9a3, 0.9);

  // พื้นปูหิน (Texture 1 ชิ้นต่อ ~4 ม.)
  const topTex = makePavingTexture(width / 4, deckLen / 4, 5);
  const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.92 });
  // BoxGeometry หน้า: +x, -x, +y, -y, +z, -z
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, deckLen), [sideStone, sideStone, topMat, darkStone, sideStone, sideStone]);
  deck.position.set(BRIDGE.centerX, BRIDGE.deckY - 0.25, deckMidZ);
  deck.receiveShadow = true;
  group.add(deck);

  // ทางลาดขึ้นสะพาน: แผ่นเอียงต่อเนื่องกับพื้น (ผิวบนผ่านจุด (startZ,0) → (deckStart,deckY))
  const slope = Math.atan2(BRIDGE.deckY, BRIDGE.rampLength);
  const slopeLen = Math.hypot(BRIDGE.rampLength, BRIDGE.deckY);
  const rampTex = makePavingTexture(width / 4, slopeLen / 4, 5);
  const rampTop = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.92 });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, slopeLen), [sideStone, sideStone, rampTop, darkStone, sideStone, sideStone]);
  ramp.rotation.x = -slope;
  // กึ่งกลางผิวบน แล้วลงไปตามแนวตั้งฉาก 0.25
  const cz = BRIDGE.startZ + BRIDGE.rampLength / 2;
  const cy = BRIDGE.deckY / 2;
  ramp.position.set(BRIDGE.centerX, cy - 0.25 * Math.cos(slope), cz + 0.25 * Math.sin(slope));
  ramp.receiveShadow = true;
  group.add(ramp);

  // ราวไม้สองข้าง + เชือก
  const batch = new GeoBatch();
  const railX = BRIDGE.halfWidth - 0.12;
  for (const side of [-1, 1]) {
    batch.box(0.16, 0.12, deckLen, wood, [side * railX, BRIDGE.deckY + 1.0, deckMidZ]);
    batch.box(0.1, 0.08, deckLen, wood, [side * railX, BRIDGE.deckY + 0.55, deckMidZ]);
    for (let z = deckStart + 0.5; z <= BRIDGE.endZ; z += 2) {
      batch.box(0.18, 1.05, 0.18, wood, [side * railX, BRIDGE.deckY + 0.52, z], undefined, true);
    }
  }
  // กันตกปลายสะพาน
  batch.box(width, 0.12, 0.16, wood, [BRIDGE.centerX, BRIDGE.deckY + 1.0, BRIDGE.endZ - 0.1]);
  batch.box(width, 0.08, 0.1, rope, [BRIDGE.centerX, BRIDGE.deckY + 0.55, BRIDGE.endZ - 0.1]);

  // เสาตอม่อใต้สะพาน
  const pillarH = LAYOUT.seaY - LAYOUT.seabedY + BRIDGE.deckY;
  const pillarGeo = new THREE.BoxGeometry(1.1, pillarH, 1.1);
  for (let z = deckStart + 2; z <= BRIDGE.endZ; z += 6) {
    for (const x of [-BRIDGE.halfWidth + 0.7, 0, BRIDGE.halfWidth - 0.7]) {
      batch.add(pillarGeo, darkStone, new THREE.Matrix4().makeTranslation(x, LAYOUT.seabedY + pillarH / 2, z), true);
    }
  }
  pillarGeo.dispose();
  group.add(batch.build('PierRailsAndPillars'));
  return group;
}
