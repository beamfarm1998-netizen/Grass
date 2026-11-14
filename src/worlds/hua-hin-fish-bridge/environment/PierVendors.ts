// src/worlds/hua-hin-fish-bridge/environment/PierVendors.ts
// คนขายของประจำแผงตลาดอาหารทะเล ใช้ man.glb ตัวเดียวกับตัวละครผู้เล่น (โหลดครั้งเดียว ใช้แคชร่วม → ไม่เพิ่มขนาดดาวน์โหลด)
//  - ตัวที่มีบทบาท (5 หมวดตามป้ายลูกศร) ยืนหลังแผง มีป้ายชื่อหมวดแขวน โบกมือเมื่อผู้เล่นเดินเข้าใกล้ และหันมาหา
//  - ตัวประกอบ (เฉพาะเดสก์ท็อป) ยืนท่า idle เพิ่มบรรยากาศ
//  - LOD: ไกลเกิน 70 ม. ซ่อน / ไกลเกิน 32 ม. หยุดอัปเดต animation → คุม CPU ของ skinned mesh
// สำคัญ: Geometry/Texture ของ GLB เป็นแคชร่วมกับผู้เล่น ห้าม dispose ที่นี่ (dispose เฉพาะป้ายที่สร้างเอง)
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getLoadedWomanGlb, loadManGlb, loadWomanGlb, type CachedFarmerGltf } from '../../../game/player/PlayerMesh';
import { loadValidatedGLTF, optimizeGLTFSceneForDevice } from '../../../utils/glbValidator';
import { BRIDGE } from './StoneBridge';
import { STALL_LAYOUT } from './PierMarket';
import { makeCanvasTexture, stdMat, thaiFont } from './PierKit';

export type VendorRoleId = 'fresh-seafood' | 'shrimp-crab-fish' | 'squid' | 'shellfish' | 'souvenir';

export interface VendorRole {
  id: VendorRoleId;
  /** ข้อความบนป้าย (ตรงกับป้ายลูกศรหน้าซุ้ม) */
  label: string;
  icon: string;
  greeting: string;
}

export const VENDOR_ROLES: Readonly<Record<VendorRoleId, VendorRole>> = {
  'fresh-seafood': { id: 'fresh-seafood', label: 'อาหารทะเลสด', icon: '🐟', greeting: 'ปลาสดๆ เพิ่งขึ้นเรือเมื่อเช้า!' },
  'shrimp-crab-fish': { id: 'shrimp-crab-fish', label: 'กุ้ง ปู ปลา', icon: '🦐', greeting: 'กุ้งปูปลา ตัวโตๆ มาเลือกได้เลย' },
  squid: { id: 'squid', label: 'ปลาหมึก', icon: '🦑', greeting: 'หมึกกรอบ หมึกไข่ ของดีหัวหิน' },
  shellfish: { id: 'shellfish', label: 'หอยทะเล', icon: '🐚', greeting: 'หอยแครง หอยแมลงภู่ สดจากทะเล' },
  souvenir: { id: 'souvenir', label: 'ของฝาก', icon: '🛒', greeting: 'ปลาหมึกแห้ง กะปิหวาน น้ำปลาแท้ มีครบ' },
};

export interface VendorInfo {
  id: string;
  name: string;
  role: VendorRole | null;
  x: number;
  z: number;
}

export interface PierVendors {
  group: THREE.Group;
  /** เรียกทุกเฟรม (px,pz = ตำแหน่งผู้เล่น) */
  update: (delta: number, px: number, pz: number) => void;
  /** คนขายที่มีบทบาทใกล้ผู้เล่นที่สุดในระยะโต้ตอบ (ไม่มี → null) */
  nearest: (px: number, pz: number) => VendorInfo | null;
  dispose: () => void;
}

export const VENDOR_INTERACT_RADIUS = 4.4;
const LOD_HIDE = 70;
const LOD_ANIMATE = 32;
const VENDOR_HEIGHT = 1.72;
const FEMALE_FALLBACK_MS = 8000;

interface Slot {
  stall: number; // ลำดับแผงตามแนวสะพาน
  side: 1 | -1; // เครื่องหมาย x ของโลก
  name: string;
  role: VendorRoleId | null;
  /** true = ใช้ woman.glb (ถ้าโหลดไม่ได้ภายใน FEMALE_FALLBACK_MS จะใช้ man.glb แทน) */
  female?: boolean;
}

// 5 หมวดตามลำดับป้ายลูกศร สลับซ้าย/ขวาของทางเดินใกล้ซุ้มทางเข้า
const ROLE_SLOTS: Slot[] = [
  { stall: 1, side: 1, name: 'ลุงชม', role: 'fresh-seafood' },
  { stall: 1, side: -1, name: 'ป้าน้อย', role: 'shrimp-crab-fish', female: true },
  { stall: 3, side: 1, name: 'พี่ต้อม', role: 'squid' },
  { stall: 3, side: -1, name: 'น้าแดง', role: 'shellfish', female: true },
  { stall: 5, side: 1, name: 'ลุงเหลือง', role: 'souvenir' },
];
const AMBIENT_SLOTS: Slot[] = [
  { stall: 5, side: -1, name: 'แม่ค้า', role: null, female: true },
  { stall: 7, side: 1, name: 'พ่อค้า', role: null },
  { stall: 7, side: -1, name: 'พ่อค้า', role: null },
  { stall: 9, side: 1, name: 'พ่อค้า', role: null },
  { stall: 10, side: -1, name: 'พ่อค้า', role: null },
];

interface Runtime {
  info: VendorInfo;
  wrapper: THREE.Group;
  baseYaw: number;
  yaw: number;
  mixer: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  wave?: THREE.AnimationAction;
  speed: number;
  near: boolean;
}

function shortestAngle(a: number): number {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}


// ── โมเดลเฉพาะตัวพ่อค้า/แม่ค้า (วางไฟล์ไว้ใน public/ แล้วใช้ได้เลย; ไม่มีไฟล์/โหลดไม่ได้ → ใช้ man.glb / woman.glb แทนอัตโนมัติ) ──
/** พ่อค้าผู้ชายทุกคน */
export const MERCHANT_MODEL_URL = '/merchant_rigged.glb';
/** แม่ค้ารายคน (ชื่อ → ไฟล์) ชื่อไฟล์มีช่องว่างต้องเข้ารหัส %20 */
export const VENDOR_MODEL_BY_NAME: Readonly<Record<string, string>> = { 'ป้าน้อย': '/Aunt%20noi.glb' };

/** ชื่อไฟล์ที่ลองตามลำดับ (กันพิมพ์/เซฟชื่อมีจุดซ้อน เช่น merchant_rigged..glb) */
const URL_CANDIDATES: Readonly<Record<string, readonly string[]>> = {
  [MERCHANT_MODEL_URL]: [MERCHANT_MODEL_URL, '/merchant_rigged..glb', '/merchant_rigged.glb.glb'],
};

const customCache = new Map<string, Promise<CachedFarmerGltf | null>>();
function loadCustomVendorGlb(key: string): Promise<CachedFarmerGltf | null> {
  let p = customCache.get(key);
  if (!p) {
    p = (async () => {
      const reasons: string[] = [];
      for (const url of URL_CANDIDATES[key] ?? [key]) {
        try {
          const { gltf, inspection } = await loadValidatedGLTF(url);
          optimizeGLTFSceneForDevice(gltf.scene, inspection, true);
          console.info(`✅ โหลดโมเดลพ่อค้า ${url} สำเร็จ (animations: ${(gltf.animations || []).map((c) => c.name).join(', ') || 'ไม่มี'})`);
          return { scene: gltf.scene, animations: gltf.animations || [] } as CachedFarmerGltf;
        } catch (err) {
          reasons.push(`${url} → ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.warn(`⚠️ โหลดโมเดลพ่อค้าไม่สำเร็จ ใช้โมเดลมาตรฐานแทน:\n${reasons.join('\n')}`);
      return null;
    })();
    customCache.set(key, p);
  }
  return p;
}

export function createPierVendors(opts: { ambient: boolean }): PierVendors {
  const group = new THREE.Group();
  group.name = 'PierVendors';
  const runtimes: Runtime[] = [];
  const labelGeos: THREE.BufferGeometry[] = [];
  const labelMats: THREE.Material[] = [];
  let disposed = false;

  const slots = opts.ambient ? [...ROLE_SLOTS, ...AMBIENT_SLOTS] : ROLE_SLOTS;
  const dy = BRIDGE.deckY;
  const slotPos = (s: Slot) => ({
    x: s.side * 5.55,
    z: STALL_LAYOUT.firstZ + STALL_LAYOUT.step * s.stall,
    // หันหน้าเข้าทางเดินกลาง (heading 0 = +Z)
    yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2,
  });

  // ── ป้ายชื่อหมวดแขวนหน้าแผง (สร้างทันที ไม่รอ GLB) ──
  const woodMat = stdMat(0x8a5a2e, 0.85);
  labelMats.push(woodMat);
  for (const s of slots) {
    if (!s.role) continue;
    const role = VENDOR_ROLES[s.role];
    const p = slotPos(s);
    const tex = makeCanvasTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f2dcae';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#6b3f1d';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = '70px system-ui, sans-serif';
      ctx.fillText(role.icon, 80, h / 2 + 4);
      ctx.font = thaiFont(66, 800);
      ctx.fillStyle = '#3a210d';
      ctx.fillText(role.label, 300, h / 2 + 4);
    });
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const faceGeo = new THREE.PlaneGeometry(1.8, 0.45);
    const backGeo = new THREE.BoxGeometry(1.9, 0.55, 0.06);
    labelMats.push(faceMat, tex as unknown as THREE.Material);
    labelGeos.push(faceGeo, backGeo);
    const board = new THREE.Group();
    board.add(new THREE.Mesh(backGeo, woodMat));
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.035;
    board.add(face);
    board.position.set(s.side * 3.78, dy + 2.42, p.z);
    board.rotation.y = p.yaw; // หน้าป้ายหันเข้าทางเดิน
    group.add(board);
  }

  // ── ใส่คนขายเมื่อ man.glb โหลดเสร็จ (ใช้แคชร่วมกับผู้เล่น) ──
  const builtSlots = new Set<number>();
  const build = (gltf: CachedFarmerGltf, pick: (s: Slot) => boolean): void => {
    if (disposed) return;
    slots.forEach((s, i) => {
      if (!pick(s) || builtSlots.has(i)) return;
      builtSlots.add(i);
      const p = slotPos(s);
      const cloned = SkeletonUtils.clone(gltf.scene);
      cloned.name = `Vendor_${s.role ?? 'ambient'}_${i}`;
      cloned.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.userData.isSharedGlbGeometry = true;
          c.castShadow = false;
          c.receiveShadow = false;
        }
      });
      const box = new THREE.Box3().setFromObject(cloned);
      const size = new THREE.Vector3();
      box.getSize(size);
      const variation = 0.96 + ((i * 37) % 9) * 0.01; // ความสูงต่างกันเล็กน้อย
      cloned.scale.setScalar((VENDOR_HEIGHT * variation) / Math.max(size.y, 0.001));
      const sb = new THREE.Box3().setFromObject(cloned);
      cloned.position.set(-(sb.min.x + sb.max.x) / 2, -sb.min.y, -(sb.min.z + sb.max.z) / 2);

      const wrapper = new THREE.Group();
      wrapper.add(cloned);
      wrapper.position.set(p.x, dy, p.z);
      wrapper.rotation.y = p.yaw;
      group.add(wrapper);

      const mixer = new THREE.AnimationMixer(cloned);
      let idle: THREE.AnimationAction | undefined;
      let wave: THREE.AnimationAction | undefined;
      for (const clip of gltf.animations ?? []) {
        const n = clip.name.toLowerCase();
        if (n.includes('wave')) wave = mixer.clipAction(clip);
        else if (n.includes('idle')) idle = mixer.clipAction(clip);
      }
      if (!idle && gltf.animations?.[0]) idle = mixer.clipAction(gltf.animations[0]);
      if (idle) {
        idle.play();
        idle.time = (i * 0.37) % Math.max(0.1, idle.getClip().duration); // ไม่ขยับพร้อมกัน
      }
      runtimes.push({
        info: { id: `vendor-${i}`, name: s.name, role: s.role ? VENDOR_ROLES[s.role] : null, x: p.x, z: p.z },
        wrapper, baseYaw: p.yaw, yaw: p.yaw, mixer, idle, wave,
        speed: 0.9 + ((i * 13) % 5) * 0.05,
        near: false,
      });
    });
  };
  // ลำดับการโหลด: โมเดลเฉพาะตัว (merchant_rigged / Aunt noi) → ถ้าไม่มี/พัง ใช้ man.glb (ชาย) / woman.glb (หญิง) แผงจะไม่ว่าง
  const customUrlFor = (sl: Slot): string | null => (sl.female ? VENDOR_MODEL_BY_NAME[sl.name] ?? null : MERCHANT_MODEL_URL);
  const failedUrls = new Set<string>();
  const wantDefault = (sl: Slot): boolean => {
    const u = customUrlFor(sl);
    return u === null || failedUrls.has(u);
  };
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  const startDefaults = (): void => {
    if (disposed) return;
    const hasFemale = slots.some((sl) => sl.female && wantDefault(sl));
    loadManGlb((g) => {
      build(g, (sl) => !sl.female && wantDefault(sl));
      if (hasFemale && !getLoadedWomanGlb()) {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        fallbackTimer = setTimeout(() => {
          if (!disposed) build(g, (sl) => !!sl.female && wantDefault(sl));
        }, FEMALE_FALLBACK_MS);
      }
    });
    if (hasFemale) {
      loadWomanGlb((g) => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        build(g, (sl) => !!sl.female && wantDefault(sl));
      });
    }
  };
  const customUrls = [...new Set(slots.map(customUrlFor).filter((u): u is string => u !== null))];
  for (const url of customUrls) {
    void loadCustomVendorGlb(url).then((g) => {
      if (disposed) return;
      if (g) build(g, (sl) => customUrlFor(sl) === url);
      else { failedUrls.add(url); startDefaults(); }
    });
  }
  startDefaults(); // เฉพาะสล็อตที่ไม่มีโมเดลเฉพาะตัว (เช่น น้าแดง/แม่ค้าตัวประกอบ)

  return {
    group,
    update(delta, px, pz) {
      for (const v of runtimes) {
        const dx = px - v.info.x;
        const dz = pz - v.info.z;
        const d2 = dx * dx + dz * dz;
        const visible = d2 < LOD_HIDE * LOD_HIDE;
        v.wrapper.visible = visible;
        if (!visible) continue;

        const near = v.info.role !== null && d2 < VENDOR_INTERACT_RADIUS * VENDOR_INTERACT_RADIUS;
        if (near !== v.near) {
          v.near = near;
          if (v.wave && v.idle) {
            if (near) { v.wave.reset().play(); v.idle.crossFadeTo(v.wave, 0.25, false); }
            else { v.wave.crossFadeTo(v.idle.reset().play(), 0.25, false); }
          }
        }
        if (near || d2 < LOD_ANIMATE * LOD_ANIMATE) v.mixer.update(delta * v.speed);

        // หันหาผู้เล่นเมื่ออยู่ใกล้ (จำกัดไม่เกิน ~57° จากทิศหลัก ไม่หันหลังให้แผง)
        const target = near
          ? v.baseYaw + Math.max(-1, Math.min(1, shortestAngle(Math.atan2(dx, dz) - v.baseYaw)))
          : v.baseYaw;
        v.yaw += shortestAngle(target - v.yaw) * Math.min(1, delta * 5);
        v.wrapper.rotation.y = v.yaw;
      }
    },
    nearest(px, pz) {
      let best: VendorInfo | null = null;
      let bestD = VENDOR_INTERACT_RADIUS * VENDOR_INTERACT_RADIUS;
      for (const v of runtimes) {
        if (!v.info.role) continue;
        const d = (px - v.info.x) ** 2 + (pz - v.info.z) ** 2;
        if (d < bestD) { bestD = d; best = v.info; }
      }
      return best;
    },
    dispose() {
      disposed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      for (const v of runtimes) v.mixer.stopAllAction();
      group.removeFromParent();
      // ห้าม dispose geometry/texture ของ GLB (แคชร่วมกับผู้เล่น) — ล้างเฉพาะป้ายที่สร้างเอง
      labelGeos.forEach((g) => g.dispose());
      labelMats.forEach((m) => (m as THREE.Material & { dispose: () => void }).dispose());
      runtimes.length = 0;
      group.clear();
    },
  };
}
