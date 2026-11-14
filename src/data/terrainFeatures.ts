// src/data/terrainFeatures.ts
// ─────────────────────────────────────────────────────────────
// Single Source of Truth ของภูมิประเทศ
// FarmTerrain.ts (แสดงผล) และ useFarmTrees.ts (collision) ต้อง import จากที่นี่เท่านั้น
// เพื่อไม่ให้ตำแหน่ง mesh กับตำแหน่งเช็คชนไม่ตรงกันอีก
// ─────────────────────────────────────────────────────────────

export type CircleFeature  = { x: number; z: number; radius: number };
export type SegmentFeature = { x1: number; z1: number; x2: number; z2: number; halfWidth: number };

// ✅ สระน้ำ — ผู้ใช้ยืนยันว่าอยู่มุมบนซ้ายของแผนที่
export const POND: CircleFeature = { x: -40, z: -28, radius: 5.2 };

// ⚠️ TODO: เติมพิกัดจริงจาก farm-map.jpg (ห้ามเดา)
// วิธีวัด: เปิดรูปใน Photoshop/GIMP → วัดพิกเซล → เทียบกับ world extent ของแผนที่
// mapWidth=104, mapDepth=78 → origin กลาง → worldX = (px/imgW - 0.5) * 104, worldZ = (px/imgH - 0.5) * 78
// เสร็จแล้วเรียก debugGrid() ในเกมเพื่อตรวจว่าตรง
export const RIVER_SEGMENTS: SegmentFeature[] = [
  // { x1: ..., z1: ..., x2: ..., z2: ..., halfWidth: ... },
];

export const ROAD_SEGMENTS: SegmentFeature[] = [
  // { x1: ..., z1: ..., x2: ..., z2: ..., halfWidth: ... },
];

export const SAND_PITS: CircleFeature[] = [
  // { x: ..., z: ..., radius: ... },
];

// ─── helper ───
export function pointToSegmentDistance(
  px: number, pz: number,
  x1: number, z1: number, x2: number, z2: number,
): number {
  const dx = x2 - x1, dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
  let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}

export function isTerrainBlocked(x: number, z: number): { blocked: boolean; reason?: string } {
  if (Math.hypot(x - POND.x, z - POND.z) < POND.radius) {
    return { blocked: true, reason: 'อยู่บนผิวน้ำในสระ' };
  }
  for (const s of RIVER_SEGMENTS) {
    if (pointToSegmentDistance(x, z, s.x1, s.z1, s.x2, s.z2) < s.halfWidth) {
      return { blocked: true, reason: 'อยู่บนผิวน้ำในแม่น้ำ' };
    }
  }
  for (const s of ROAD_SEGMENTS) {
    if (pointToSegmentDistance(x, z, s.x1, s.z1, s.x2, s.z2) < s.halfWidth) {
      return { blocked: true, reason: 'อยู่บนถนน' };
    }
  }
  for (const p of SAND_PITS) {
    if (Math.hypot(x - p.x, z - p.z) < p.radius) {
      return { blocked: true, reason: 'อยู่บนบ่อทราย' };
    }
  }
  return { blocked: false };
}

// ─── debug: log ตาราง grid ลง console ───
// × = บล็อกโดยภูมิประเทศ, o = มีของอยู่แล้ว (tree/house/plot), · = ว่าง
export function debugTerrainGrid(
  gridMinX: number, gridMaxX: number,
  gridMinZ: number, gridMaxZ: number,
  gridToWorld: (gx: number, gz: number) => { x: number; z: number },
  extraBlocked?: (gx: number, gz: number) => string | null,
): void {
  const rows: string[] = [];
  for (let gz = gridMinZ; gz <= gridMaxZ; gz++) {
    let row = '';
    for (let gx = gridMinX; gx <= gridMaxX; gx++) {
      const { x, z } = gridToWorld(gx, gz);
      const t = isTerrainBlocked(x, z);
      const extra = extraBlocked?.(gx, gz) ?? null;
      row += t.blocked ? '×' : extra ? 'o' : '·';
    }
    rows.push(row);
  }
  console.log('%c🎯 Terrain debug grid  (× = blocked, o = occupied, · = free)',
    'font-weight:bold;color:#7cf');
  console.log(rows.join('\n'));
}