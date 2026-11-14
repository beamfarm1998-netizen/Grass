// src/game/player/HouseWalk.ts
// ระบบเดินขึ้นบันได/ระเบียง ชนผนัง และเปิดประตูอัตโนมัติ สำหรับเรือนไม้ยกพื้น (type 4)
// คำนวณเป็นสี่เหลี่ยมในพิกัดของตัวบ้าน (local) ไม่พึ่ง mesh → เบาและใช้ซ้ำกับผู้เล่นออนไลน์ได้
import type * as THREE from 'three';
import type { PlacedHouse } from '../../types/buildings';
import { STILT_DIMS, HOUSE_DOOR_PIVOT_NAME } from '../../components/3d/structures/stiltDims';

// ── Tunables ──────────────────────────────────────────
const STEP_UP = 0.6;              // ต่างระดับสูงสุดที่ก้าวได้ในหนึ่งการเคลื่อนที่
const RADIUS = 0.18;              // รัศมีตัวละครสำหรับชนผนัง/รั้ว
const NEAR_RANGE = 8;             // ตรวจเฉพาะบ้านที่อยู่ใกล้ผู้เล่น
const DOOR_OPEN_DIST = 1.8;       // ระยะเริ่มเปิดประตู
const DOOR_KEEP_DIST = 2.6;       // ระยะปิดประตู (hysteresis กันกระพริบ)
const DOOR_PASSABLE = 0.6;        // เปิดเกิน 60% จึงเดินผ่านได้
const DOOR_MAX_ANGLE = Math.PI * 0.46; // ≈ 82.8° — เปิดสุดกี่องศา
const UPPER_LEVEL_Y = 1.2;        // สูงกว่านี้ = อยู่ชั้นระเบียง
const FENCE_GAP_HALF = 0.8;       // ช่องรั้วกลาง (x ∈ [-0.8, 0.8])

interface Box { x0: number; x1: number; z0: number; z1: number }
interface Surface { box: Box; height: (lx: number, lz: number) => number }
interface WalkDef {
  surfaces: Surface[];
  walls: Box[];
  fences: Box[];        // ← NEW: รั้วระเบียง
  doorBox: Box;
  doorZ: number;
  interior: Box;
}

const inBox = (b: Box, x: number, z: number, pad = 0) =>
  x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;

// ── สร้าง walk-def ของเรือนไม้ยกพื้น ───────────────────
function buildStiltDef(): WalkDef {
  const { cz, W, D, FY, doorW, wallT: t } = STILT_DIMS;
  const fz = cz + D / 2;
  const deckTop = FY + 0.1;
  const stairZ0 = fz + 1.7;
  const steps = 6;
  const depth = 0.33;
  const drop = 0.26;
  const hw = W / 2;

  // ระเบียง: ครอบทั้งตัวบ้าน + ส่วนยื่นหน้า
  const deck: Surface = {
    box: { x0: -(W + 1.0) / 2, x1: (W + 1.0) / 2, z0: cz - (D + 0.6) / 2, z1: stairZ0 },
    height: () => deckTop,
  };
  // บันได: 6 ขั้น
  const stairs: Surface = {
    box: { x0: -0.65, x1: 0.65, z0: stairZ0, z1: stairZ0 + steps * depth },
    height: (_lx, lz) => {
      const i = Math.max(0, Math.min(steps - 1, Math.floor((lz - stairZ0) / depth)));
      return FY - 0.08 - i * drop;
    },
  };

  // ผนังกลวง 4 ด้าน (เว้นช่องประตู)
  const sideW = hw - doorW / 2;
  const walls: Box[] = [
    { x0: -hw, x1: hw, z0: cz - D / 2, z1: cz - D / 2 + t }, // หลัง
    { x0: -hw, x1: -hw + t, z0: cz - D / 2, z1: fz },        // ซ้าย
    { x0: hw - t, x1: hw, z0: cz - D / 2, z1: fz },          // ขวา
    { x0: -hw, x1: -hw + sideW, z0: fz - t, z1: fz },        // หน้าซ้าย
    { x0: hw - sideW, x1: hw, z0: fz - t, z1: fz },          // หน้าขวา
  ];

  // ← NEW: รั้วระเบียงหน้า (เว้นช่องกลางให้เดินผ่านขึ้นบันได)
  const fenceZ = fz + 1.65;
  const fences: Box[] = [
    { x0: -hw, x1: -FENCE_GAP_HALF, z0: fenceZ - 0.06, z1: fenceZ + 0.06 },
    { x0: FENCE_GAP_HALF, x1: hw, z0: fenceZ - 0.06, z1: fenceZ + 0.06 },
  ];

  const doorBox: Box = { x0: -doorW / 2, x1: doorW / 2, z0: fz - t, z1: fz };
  const interior: Box = { x0: -hw, x1: hw, z0: cz - D / 2, z1: fz };
  return { surfaces: [deck, stairs], walls, fences, doorBox, doorZ: fz, interior };
}

const WALK_DEFS: Record<number, WalkDef> = { 4: buildStiltDef() };

export function houseHasWalkDef(type: number): boolean {
  return type in WALK_DEFS;
}

function toLocal(h: PlacedHouse, x: number, z: number) {
  const dx = x - h.x;
  const dz = z - h.z;
  const c = Math.cos(h.rot);
  const s = Math.sin(h.rot);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function surfaceHeight(def: WalkDef, lx: number, lz: number): number {
  let best = 0;
  for (const s of def.surfaces) {
    if (inBox(s.box, lx, lz)) best = Math.max(best, s.height(lx, lz));
  }
  return best;
}

// ── Per-house state (door progress + cached pivot) ─────
interface DoorState {
  progress: number;                 // 0 = ปิด, 1 = เปิดสุด
  pivot: THREE.Object3D | null;     // cache reference ไว้ ไม่ต้อง getObjectByName ทุกเฟรม
}

export class HouseWalkSystem {
  private doors = new Map<string, DoorState>();
  private roofHiddenId: string | null = null;

  constructor(
    private getHouses: () => PlacedHouse[],
    private getGroup: (id: string) => THREE.Object3D | undefined
  ) {}

  private nearWalkHouses(x: number, z: number): { h: PlacedHouse; def: WalkDef }[] {
    const out: { h: PlacedHouse; def: WalkDef }[] = [];
    for (const h of this.getHouses()) {
      const def = WALK_DEFS[h.type];
      if (!def) continue;
      if (Math.hypot(x - h.x, z - h.z) > NEAR_RANGE) continue;
      out.push({ h, def });
    }
    return out;
  }

  /** ความสูงพื้นที่ตำแหน่ง (x,z): ระเบียง/บันไดของบ้าน หรือ 0 ถ้าเป็นพื้นดิน */
  public groundHeightAt = (x: number, z: number): number => {
    let best = 0;
    for (const { h, def } of this.nearWalkHouses(x, z)) {
      const l = toLocal(h, x, z);
      best = Math.max(best, surfaceHeight(def, l.x, l.z));
    }
    return best;
  };

  private isBlocked(x: number, z: number, y: number): boolean {
    for (const { h, def } of this.nearWalkHouses(x, z)) {
      const l = toLocal(h, x, z);
      const sh = surfaceHeight(def, l.x, l.z);

      if (sh - y > STEP_UP) return true; // สูงเกินก้าว (เช่น เดินชนระเบียงจากพื้นดิน)
      if (y - sh > STEP_UP) return true; // ตกขอบระเบียง (ราวกั้นล่องหน)

      if (y > UPPER_LEVEL_Y) {
        for (const w of def.walls) if (inBox(w, l.x, l.z, RADIUS)) return true;
        for (const f of def.fences) if (inBox(f, l.x, l.z, RADIUS)) return true; // ← NEW
        const open = this.doors.get(h.id)?.progress ?? 0;
        if (open < DOOR_PASSABLE && inBox(def.doorBox, l.x, l.z, RADIUS)) return true;
      }
    }
    return false;
  }

  /** ตรวจการเคลื่อนที่ ox,oz → nx,nz คืนตำแหน่งที่ไปได้จริง (ไถลตามผนังได้) */
  public resolveMove = (
    ox: number,
    oz: number,
    nx: number,
    nz: number,
    y: number
  ): { x: number; z: number } => {
    if (!this.isBlocked(nx, nz, y)) return { x: nx, z: nz };
    // escape hatch: ติดอยู่ที่จุดเดิมอยู่แล้ว → ให้เดินออกไปได้ทุกทาง
    if (this.isBlocked(ox, oz, y)) return { x: nx, z: nz };
    if (!this.isBlocked(nx, oz, y)) return { x: nx, z: oz };
    if (!this.isBlocked(ox, nz, y)) return { x: ox, z: nz };
    return { x: ox, z: oz };
  };

  // ── Door state (lazy init + cache pivot) ─────────────
  private getDoor(h: PlacedHouse): DoorState {
    let state = this.doors.get(h.id);
    if (!state) {
      state = { progress: 0, pivot: null };
      this.doors.set(h.id, state);
    }
    if (!state.pivot) {
      const g = this.getGroup(h.id);
      const p = g?.getObjectByName(HOUSE_DOOR_PIVOT_NAME);
      if (p) state.pivot = p;
    }
    return state;
  }

  /** เรียกทุกเฟรมก่อน player.update: เปิด-ปิดประตู และซ่อนหลังคาเมื่อผู้เล่นอยู่ในห้อง */
  public update(delta: number, px: number, py: number, pz: number) {
    let insideId: string | null = null;
    const nearHouses = this.nearWalkHouses(px, pz);

    for (const { h, def } of nearHouses) {
      const l = toLocal(h, px, pz);
      const state = this.getDoor(h);
      const d = Math.hypot(l.x, l.z - def.doorZ);

      // Hysteresis: เปิดที่ 1.8, ปิดที่ 2.6 — ระหว่างกลางคงสถานะเดิม
      const openRadius = state.progress > 0.05 ? DOOR_KEEP_DIST : DOOR_OPEN_DIST;
      const wantOpen = py > UPPER_LEVEL_Y && d < openRadius;
      const next = Math.max(0, Math.min(1, state.progress + (wantOpen ? 1 : -1) * delta * 3));

      if (next !== state.progress) {
        state.progress = next;
        if (state.pivot) state.pivot.rotation.y = -next * DOOR_MAX_ANGLE;
      }

      if (py > UPPER_LEVEL_Y && inBox(def.interior, l.x, l.z)) insideId = h.id;
    }

    // ซ่อนหลังคาเมื่อผู้เล่นอยู่ในห้อง
    if (insideId !== this.roofHiddenId) {
      if (this.roofHiddenId) this.setRoofVisible(this.roofHiddenId, true);
      if (insideId) this.setRoofVisible(insideId, false);
      this.roofHiddenId = insideId;
    }
  }

  private setRoofVisible(id: string, visible: boolean) {
    const g = this.getGroup(id);
    if (!g) return;
    g.traverse((o) => {
      // ตรวจ userData.housePart ก่อน แล้ว fallback ไป name ของ group
      const part = o.userData?.housePart;
      if (part === 'roof' || (part === undefined && /roof/i.test(o.name))) {
        o.visible = visible;
      }
    });
  }

  /** คืนค่าทั้งหมด (เรียกตอน unmount scene) — คืนหลังคาที่ซ่อนอยู่ให้แสดงผลตามปกติ */
  public dispose(): void {
    if (this.roofHiddenId) {
      this.setRoofVisible(this.roofHiddenId, true);
      this.roofHiddenId = null;
    }
    this.doors.clear();
  }
}