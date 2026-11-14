// src/game/player/HeldToolRig.ts
// ทำให้ตัวละคร GLB (man.glb / woman.glb) "จับ" จอบ เคียว ขวาน บัวรดน้ำ จริง ๆ
//
// ปัญหาเดิม: โมเดลเครื่องมือจาก Sketchfab วางเอียง/นอนคนละแกน (จอบเฉียง 27° ในแกน XY, ขวานนอนตามแกน X,
// เคียวตั้งตามแกน Y ฯลฯ) และโค้ดเดิมย่อขนาดตาม maxDim แล้วเอา "ก้นโมเดล" ไปวางที่ข้อมือโดยไม่รู้ว่าด้ามอยู่ตรงไหน
// อีกทั้ง bone ของมือถูกขยายตาม scale ของตัวละคร ทำให้ของในมือใหญ่/เล็กผิดสัดส่วน
//
// วิธีแก้:
//  1) ระบุต่อเครื่องมือ: ทิศก้น→หัว (headDir), ทิศใบมีด/ปากกา (sideDir), จุดจับบนด้าม (grip), ความยาว
//     แล้วแปลงโมเดลให้อยู่ใน "เฟรมมาตรฐาน": ต้นทาง = จุดจับ, +Y = ก้น→หัว, +Z = ด้านใบมีด, หน่วย = เมตร
//  2) ตอนสร้างตัวละคร อ่านท่า idle ของโครงกระดูก แล้วคำนวณการหมุนให้เครื่องมือชี้ไปทาง carryDir ในพิกัดตัวละคร
//     (ไม่ต้องเดาแกนของ bone) และชดเชย scale ของ bone
//  3) ตอนเหวี่ยง หมุนรอบแกนขวาของตัวละคร (X) แทนการเขียนทับ rotation.x ของ holder
import * as THREE from 'three';

type V3 = [number, number, number];

export interface HeldToolSpec {
  /** ทิศจากก้นด้าม → หัวเครื่องมือ ในพิกัดโมเดลดิบ */
  headDir: V3;
  /** ทิศด้านที่ใบมีดคม/เส้นโค้งเคียว/ปากบัวชี้ ในพิกัดโมเดลดิบ (ตั้งฉากกับ headDir คร่าว ๆ ก็พอ) */
  sideDir: V3;
  /** จุดที่มือจับ ในพิกัดโมเดลดิบ */
  grip: V3;
  /** ความยาวก้น→หัว ในหน่วยโมเดลดิบ */
  modelLength: number;
  /** ความยาวที่ต้องการในเกม (เมตร) */
  length: number;
  /** ทิศก้น→หัวตอนถือเฉย ๆ ในพิกัดตัวละคร (+Y ขึ้น, +Z หน้า) */
  carryDir: V3;
  /** ทิศด้านใบมีดตอนถือเฉย ๆ */
  carrySide: V3;
  /** มุมเหวี่ยงสูงสุด (เรเดียน) รอบแกนขวาของตัวละคร */
  swing: number;
}

/**
 * ค่าที่คำนวณจากเรขาคณิตจริงของไฟล์ใน /public (hoe.glb, sickle.glb, ax_.glb, wateringcan.glb)
 * ถ้าเปลี่ยนไฟล์โมเดลใหม่ ต้องวัดค่าใหม่ หรือจูนด้วย window.__heldTools (โหมด dev)
 */
export const HELD_TOOL_SPECS: Record<string, HeldToolSpec> = {
  hoe: {
    headDir: [-0.893, 0.449, 0], sideDir: [-0.449, -0.893, 0], grip: [4.78, 3.32, 0], modelLength: 30.4,
    length: 1.1, carryDir: [0, 0.72, 0.69], carrySide: [0, -0.69, 0.72], swing: 1.5,
  },
  sickle: {
    headDir: [0, 1, 0], sideDir: [0, 0, -1], grip: [0, 150, -1.5], modelLength: 900,
    length: 0.55, carryDir: [0, 0.55, 0.83], carrySide: [0, -0.83, 0.55], swing: 1.0,
  },
  axe: {
    headDir: [-0.993, 0.119, 0], sideDir: [0, -1, 0], grip: [61, 207, -250.6], modelLength: 580,
    length: 0.85, carryDir: [0, 0.72, 0.69], carrySide: [0, -0.69, 0.72], swing: 1.5,
  },
  watering_can: {
    headDir: [0, 0, 1], sideDir: [0, 1, 0], grip: [0, 22, -26], modelLength: 76,
    length: 0.4, carryDir: [0, -0.2, 0.98], carrySide: [0, 0.98, 0.2], swing: 0.7,
  },
};

/** สร้าง quaternion ของเฟรมที่ +Y = a, +Z = b (orthonormalize แล้ว) */
function basisQuat(yDir: V3, zDir: V3): THREE.Quaternion {
  const y = new THREE.Vector3(...yDir).normalize();
  const z = new THREE.Vector3(...zDir);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * ห่อโมเดลดิบให้เป็นเฟรมมาตรฐาน: origin = จุดจับ, +Y = ก้น→หัว, +Z = ด้านใบมีด, หน่วยเมตร
 */
export function buildHeldToolNormalizer(scene: THREE.Object3D, spec: HeldToolSpec): THREE.Group {
  const s = spec.length / spec.modelLength;
  const qInv = basisQuat(spec.headDir, spec.sideDir).invert();
  const group = new THREE.Group();
  group.name = 'HeldToolNormalized';
  group.scale.setScalar(s);
  group.quaternion.copy(qInv);
  group.position.copy(new THREE.Vector3(...spec.grip).multiplyScalar(s).applyQuaternion(qInv).negate());
  group.add(scene);
  return group;
}

interface HeldEntry {
  group: THREE.Group;
  base: THREE.Quaternion;
  swing: number;
  offset: THREE.Vector3;
  rollDeg: number;
}
interface HeldRig {
  swingAxis: THREE.Vector3;
  entries: HeldEntry[];
}

const TOOL_KEY_ALIASES: Record<string, string> = { pickaxe: 'axe' };

function refresh(rig: HeldRig, stroke: number) {
  const swingQ = new THREE.Quaternion();
  const rollQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const e of rig.entries) {
    swingQ.setFromAxisAngle(rig.swingAxis, e.swing * stroke);
    rollQ.setFromAxisAngle(up, THREE.MathUtils.degToRad(e.rollDeg));
    e.group.quaternion.copy(swingQ).multiply(e.base).multiply(rollQ);
    e.group.position.copy(e.offset);
  }
}

/** เรียกทุกเฟรมระหว่างเหวี่ยง (stroke 0→1→0) คืน false ถ้า holder นี้ไม่ได้ใช้ระบบจับจริง */
export function applyHeldToolSwing(holder: THREE.Object3D, stroke: number): boolean {
  const rig = holder.userData.heldRig as HeldRig | undefined;
  if (!rig) return false;
  refresh(rig, stroke);
  return true;
}

/**
 * ผูกเครื่องมือทั้งหมดเข้ากับมือขวาตามท่า idle ปัจจุบัน
 * ต้องเรียกหลัง mixer.update(0) เพื่อให้โครงกระดูกอยู่ในท่า idle แล้ว
 */
export function attachHeldTools(
  wrapper: THREE.Object3D,
  handBone: THREE.Object3D,
  holder: THREE.Group,
  toolMeshes: Map<string, THREE.Group>,
): void {
  wrapper.updateMatrixWorld(true);

  const wq = wrapper.getWorldQuaternion(new THREE.Quaternion());
  const hq = handBone.getWorldQuaternion(new THREE.Quaternion());
  const qh = wq.clone().invert().multiply(hq);        // การหมุนของมือ เทียบกับตัวละคร
  const qhInv = qh.clone().invert();

  // ชดเชย scale: bone ถูกขยายตามตัวละคร ทำให้ 1 หน่วยในมือ ≠ 1 เมตร
  const bs = handBone.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, wrapper.getWorldScale(new THREE.Vector3()).x);
  holder.scale.setScalar(1 / Math.max(1e-6, bs));
  holder.rotation.set(0, 0, 0);

  // จุดกลางฝ่ามือ = ข้อมือ + ทิศแขน (ศอก→ข้อมือ) × 6 ซม.
  const handPos = handBone.getWorldPosition(new THREE.Vector3());
  const armFrom = (handBone.parent ?? handBone).getWorldPosition(new THREE.Vector3());
  const armDir = handPos.clone().sub(armFrom);
  if (armDir.lengthSq() < 1e-10) armDir.set(0, -1, 0);
  armDir.normalize();
  const palmWorld = handPos.addScaledVector(armDir, 0.06 * Math.max(1e-6, wrapper.getWorldScale(new THREE.Vector3()).x));
  holder.position.copy(handBone.worldToLocal(palmWorld));

  const rig: HeldRig = {
    swingAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(qhInv).normalize(), // แกน "ขวา" ของตัวละคร ในเฟรมของมือ
    entries: [],
  };

  const seen = new Set<THREE.Group>();
  toolMeshes.forEach((group, key) => {
    if (seen.has(group)) return;
    seen.add(group);
    const spec = HELD_TOOL_SPECS[TOOL_KEY_ALIASES[key] ?? key];
    // ไม่มี spec (ต้นกล้า/ถุงเมล็ด) → ถือตั้งตรง
    const qw = spec ? basisQuat(spec.carryDir, spec.carrySide) : new THREE.Quaternion();
    const base = qhInv.clone().multiply(qw);
    rig.entries.push({ group, base, swing: spec?.swing ?? 0.6, offset: new THREE.Vector3(), rollDeg: 0 });
  });

  holder.userData.heldRig = rig;
  refresh(rig, 0);

  // ── เครื่องมือจูนสด (เฉพาะ dev): เปิด Console แล้วพิมพ์
  //    __heldTools.tune('hoe', { x: 0, y: 0.05, z: 0, roll: 90 })   // x,y,z หน่วยเมตรในเฟรมมือ, roll องศารอบด้าม
  //    __heldTools.dump()                                            // ดูค่าทั้งหมดเพื่อนำไปใส่ spec
  if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
    const w = window as any;
    w.__heldTools = {
      tune(key: string, v: { x?: number; y?: number; z?: number; roll?: number }) {
        const g = toolMeshes.get(key as any);
        const e = rig.entries.find((en) => en.group === g);
        if (!e) return console.warn('ไม่พบเครื่องมือ', key);
        if (v.x !== undefined) e.offset.x = v.x;
        if (v.y !== undefined) e.offset.y = v.y;
        if (v.z !== undefined) e.offset.z = v.z;
        if (v.roll !== undefined) e.rollDeg = v.roll;
        refresh(rig, 0);
      },
      dump() {
        const out: Record<string, unknown> = {};
        toolMeshes.forEach((g, k) => {
          const e = rig.entries.find((en) => en.group === g);
          if (e) out[k] = { offset: e.offset.toArray(), rollDeg: e.rollDeg };
        });
        console.log(JSON.stringify(out, null, 2));
        return out;
      },
    };
  }
}
