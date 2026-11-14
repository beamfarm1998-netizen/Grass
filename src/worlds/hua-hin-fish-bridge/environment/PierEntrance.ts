// src/worlds/hua-hin-fish-bridge/environment/PierEntrance.ts
// ฝั่งบก: ซุ้มทางเข้า "สะพานปลาหัวหิน" (พวงมาลัยเรือ + ปลามาร์ลิน/ปลาทูน่า + โคมไฟ) / ป้ายไม้ / กระถางดอกไม้ / รั้ว / ลานหิน / กำแพงริมทะเล
import * as THREE from 'three';
import { LAYOUT, BRIDGE } from './StoneBridge';
import {
  GeoBatch, archStrip, makeCanvasTexture, makePavingTexture, makeStoneBlockTexture, makeWoodTexture,
  mat4, placeFacingViewer, screenX, seeded, stdMat, thaiFont,
} from './PierKit';

export interface Collider {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

export const ARCH = { z: -5.4, postSx: 6.3 } as const;

const colliders: Collider[] = [];
export const getEntranceColliders = (): readonly Collider[] => colliders;

// ───────────────────────────── ซุ้มทางเข้า ─────────────────────────────

function drawArchSign(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // ขอบครีมอ่อนรอบแผ่นป้าย
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#f3d9a4';
  ctx.lineWidth = 26;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = '#6b3f1d';
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  const text = 'สะพานปลาหัวหิน';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = thaiFont(232, 900);
  ctx.lineWidth = 34;
  ctx.strokeStyle = '#1b2f8f';
  ctx.strokeText(text, w / 2, h / 2 + 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2 + 6);
}

/** ปลาตัวหนึ่ง (หัวหัน +X) — marlin: จมูกยาว+ครีบหลังใบเรือ / tuna: ลำตัวป้อม+เส้นเหลือง */
function buildFish(kind: 'marlin' | 'tuna'): THREE.Group {
  const b = new GeoBatch();
  const back = stdMat(kind === 'marlin' ? 0x2f6fd6 : 0x25508f, 0.45, { metalness: 0.2 });
  const belly = stdMat(kind === 'marlin' ? 0xe9f1f8 : 0xcfd9e0, 0.5, { metalness: 0.2 });
  const fin = stdMat(kind === 'marlin' ? 0x1f4fb0 : 0xe6c53a, 0.6, { side: THREE.DoubleSide });
  const dark = stdMat(0x101820, 0.4);
  const bill = stdMat(0x1c3f86, 0.5);

  const prof = [
    [0.04, -1.6], [0.26, -1.15], [0.5, -0.45], [0.58, 0.1], [0.5, 0.75], [0.28, 1.25], [0.03, 1.55],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(prof, 14);
  bodyGeo.rotateZ(-Math.PI / 2); // แกนยาวไปทาง +X
  const squash = kind === 'tuna' ? 1.15 : 1;
  b.add(bodyGeo, back, mat4([0, 0.0, 0], [0, 0, 0], [1, squash, 0.7]));
  b.add(bodyGeo, belly, mat4([0.05, -0.17, 0], [0, 0, 0], [0.97, 0.62 * squash, 0.66]));

  const tail = new THREE.Shape();
  tail.moveTo(0, 0); tail.lineTo(-0.55, 0.78); tail.lineTo(-0.38, 0); tail.lineTo(-0.55, -0.78); tail.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tail, { depth: 0.06, bevelEnabled: false });
  b.add(tailGeo, fin, mat4([-1.52, 0, -0.03]));

  const dorsal = new THREE.Shape();
  if (kind === 'marlin') {
    dorsal.moveTo(0.7, 0.45); dorsal.lineTo(-0.2, 1.15); dorsal.lineTo(-1.0, 0.25); dorsal.closePath();
  } else {
    dorsal.moveTo(0.35, 0.5); dorsal.lineTo(-0.1, 0.95); dorsal.lineTo(-0.55, 0.35); dorsal.closePath();
  }
  b.add(new THREE.ExtrudeGeometry(dorsal, { depth: 0.05, bevelEnabled: false }), fin, mat4([0, 0, -0.025]));

  const pect = new THREE.Shape();
  pect.moveTo(0, 0); pect.lineTo(-0.5, -0.45); pect.lineTo(-0.15, 0.02); pect.closePath();
  b.add(new THREE.ExtrudeGeometry(pect, { depth: 0.04, bevelEnabled: false }), fin, mat4([0.55, -0.2, 0.34], [0, 0.25, 0]));
  b.add(new THREE.ExtrudeGeometry(pect, { depth: 0.04, bevelEnabled: false }), fin, mat4([0.55, -0.2, -0.38], [0, -0.25, 0]));

  for (const s of [-1, 1]) b.add(new THREE.SphereGeometry(0.07, 8, 6), dark, mat4([1.12, 0.1, s * 0.3]));

  if (kind === 'marlin') {
    b.add(new THREE.ConeGeometry(0.06, 1.35, 8).rotateZ(-Math.PI / 2), bill, mat4([2.15, 0, 0]));
  }
  if (kind === 'tuna') {
    // ครีบเล็กสีเหลืองตามลำตัว
    for (let i = 0; i < 4; i++) {
      b.add(new THREE.ConeGeometry(0.05, 0.22, 4), fin, mat4([-0.55 - i * 0.2, 0.42 - i * 0.04, 0], [0, 0, Math.PI / 2]));
    }
  }
  return b.build(kind === 'marlin' ? 'Marlin' : 'Tuna');
}

function buildHelm(): THREE.Group {
  const b = new GeoBatch();
  const wood = stdMat(0x8a5524, 0.7);
  const brass = stdMat(0xc9953a, 0.4, { metalness: 0.5 });
  b.add(new THREE.TorusGeometry(0.78, 0.09, 8, 28), wood, mat4([0, 0, 0]));
  b.add(new THREE.TorusGeometry(0.28, 0.07, 8, 16), wood, mat4([0, 0, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(new THREE.BoxGeometry(0.09, 1.9, 0.09), wood, mat4([0, 0, 0], [0, 0, a]));
    b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 6), wood, mat4([Math.sin(a) * 0.98, Math.cos(a) * 0.98, 0], [0, 0, -a]));
  }
  b.add(new THREE.SphereGeometry(0.17, 10, 8), brass, mat4([0, 0, 0.04]));
  return b.build('HelmWheel');
}

function buildLantern(): THREE.Group {
  const b = new GeoBatch();
  const frame = stdMat(0x2f2318, 0.6);
  const glass = new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffb940, emissiveIntensity: 1.3, roughness: 0.3 });
  b.box(0.6, 0.08, 0.6, frame, [0, 0.36, 0]);
  b.box(0.6, 0.08, 0.6, frame, [0, -0.36, 0]);
  b.add(new THREE.ConeGeometry(0.46, 0.3, 4).rotateY(Math.PI / 4), frame, mat4([0, 0.55, 0]));
  b.box(0.46, 0.64, 0.46, glass, [0, 0, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.72, 0.06, frame, [sx * 0.27, 0, sz * 0.27]);
  return b.build('Lantern');
}

export function createEntranceArch(): THREE.Group {
  colliders.length = 0; // สร้างฉากใหม่ทุกครั้งที่เข้า World → ล้างของเก่า กันซ้ำสะสม
  const root = new THREE.Group();
  root.name = 'EntranceArch';
  const b = new GeoBatch();

  const stoneTex = makeStoneBlockTexture(1, 3);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
  const stoneCap = stdMat(0xb7ae9e, 0.9);
  const stoneBase = stdMat(0x8f877a, 0.95);
  const woodTex = makeWoodTexture('#a9763b', 'rgba(80,45,15,0.30)', 3, 1);
  const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });

  const postH = 4.5;
  for (const s of [-1, 1]) {
    const x = s * ARCH.postSx;
    b.box(1.8, 0.45, 1.8, stoneBase, [x, 0.22, 0], undefined, true);
    b.box(1.4, postH, 1.4, stone, [x, 0.45 + postH / 2, 0], undefined, true);
    b.box(1.75, 0.3, 1.75, stoneCap, [x, 0.45 + postH + 0.12, 0], undefined, true);
    b.box(1.1, 0.18, 1.1, stoneBase, [x, 0.45 + postH + 0.36, 0], undefined, true);
    // ขายึดโคมไฟด้านนอก
    b.box(0.5, 0.1, 0.1, stdMat(0x2f2318), [x + s * 0.95, 3.85, 0]);
  }

  // แผ่นป้ายโค้งจากไม้หนา (ขอบบน/ล่างโค้งแบบแบนเนอร์)
  const W = 14.0, H = 2.3, base = 3.75, rise = 0.85;
  const shape = new THREE.Shape();
  const N = 28;
  shape.moveTo(-W / 2, base);
  for (let i = 0; i <= N; i++) {
    const u = i / N, k = 1 - Math.pow(2 * u - 1, 2);
    shape.lineTo((u - 0.5) * W, base + rise * k);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N, k = 1 - Math.pow(2 * u - 1, 2);
    shape.lineTo((u - 0.5) * W, base + rise * k + H);
  }
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false, curveSegments: 1 });
  bodyGeo.translate(0, 0, -0.25);
  b.add(bodyGeo, wood, new THREE.Matrix4(), true);
  root.add(b.build('ArchStone'));

  // ลายตัวอักษร (หน้า + หลัง)
  const signTex = makeCanvasTexture(2048, 512, drawArchSign, { anisotropy: 8 });
  const decalMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const decalGeo = archStrip(W - 0.5, H - 0.3, base + 0.15, rise, 48);
  const front = new THREE.Mesh(decalGeo, decalMat);
  front.position.z = 0.27;
  const back = new THREE.Mesh(decalGeo, decalMat);
  back.position.z = -0.27;
  back.rotation.y = Math.PI;
  root.add(front, back);

  // พวงมาลัยเรือบนยอดซุ้ม
  const helm = buildHelm();
  helm.position.set(0, base + rise + H + 0.82, 0);
  root.add(helm);

  // ปลามาร์ลิน (ซ้ายจอ) / ทูน่า (ขวาจอ) หันเข้าหากลางซุ้ม
  const marlin = buildFish('marlin');
  marlin.scale.setScalar(1.05);
  marlin.position.set(-5.2, base + rise * 0.35 + H + 0.55, 0.05);
  marlin.rotation.z = 0.32;
  root.add(marlin);
  const tuna = buildFish('tuna');
  tuna.scale.setScalar(1.0);
  tuna.position.set(5.2, base + rise * 0.35 + H + 0.55, 0.05);
  tuna.rotation.y = Math.PI;
  tuna.rotation.z = 0.28;
  root.add(tuna);

  // โคมไฟข้างเสา (ด้านนอก)
  for (const s of [-1, 1]) {
    const l = buildLantern();
    l.position.set(s * (ARCH.postSx + 1.35), 3.95, 0);
    root.add(l);
  }

  // วางตำแหน่ง: สร้างใน local (หน้า=+Z, ขวาจอ=+X) แล้วหันหน้าเข้าหาผู้เล่น
  root.position.y = 0.0;
  placeFacingViewer(root, 0, ARCH.z, 0);

  // Collision: เสาซุ้มสองต้น
  for (const s of [-1, 1]) colliders.push({ x: screenX(s * ARCH.postSx), z: ARCH.z, hx: 0.95, hz: 0.95 });
  return root;
}

// ───────────────────────────── ป้ายไม้ / กระถาง / รั้ว / พื้น ─────────────────────────────

function woodBoard(w: number, h: number, thick: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick), mat);
  m.castShadow = true;
  return m;
}

function createFreshSign(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'FreshSeafoodSign';
  const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#9b6a36', 'rgba(70,40,15,0.3)', 1, 1), roughness: 0.85 });
  const dark = stdMat(0x5a3a1e, 0.9);
  for (const sx of [-1.9, 1.9]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.0, 0.28), dark);
    p.position.set(sx, 1.5, -0.05);
    p.castShadow = true;
    g.add(p);
  }
  const board = woodBoard(5.2, 2.6, 0.22, wood);
  board.position.set(0, 2.15, 0);
  g.add(board);

  const tex = makeCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f0d8a8';
    ctx.lineWidth = 22;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#4a2a10';
    ctx.lineWidth = 14;
    ctx.font = thaiFont(92, 800);
    ctx.strokeText('สด อร่อย จากทะเล', w * 0.54, 140);
    ctx.fillText('สด อร่อย จากทะเล', w * 0.54, 140);
    ctx.font = '84px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('🐟', 118, 140);
    ctx.font = thaiFont(112, 900);
    ctx.lineWidth = 16;
    ctx.strokeText('ราคาย่อมเยา', w / 2, 290);
    ctx.fillText('ราคาย่อมเยา', w / 2, 290);
    // แถบคลื่นสีฟ้า
    ctx.fillStyle = '#2f9fe0';
    ctx.beginPath();
    ctx.moveTo(60, 400);
    for (let x = 60; x <= w - 60; x += 8) ctx.lineTo(x, 400 + Math.sin(x / 38) * 14);
    ctx.lineTo(w - 60, 460); ctx.lineTo(60, 460); ctx.closePath();
    ctx.fill();
  });
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 2.45),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  decal.position.set(0, 2.15, 0.12);
  g.add(decal);
  return g;
}

function createArrowSign(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'DirectionSign';
  const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#9b6a36', 'rgba(70,40,15,0.3)', 1, 1), roughness: 0.85 });
  const dark = stdMat(0x5a3a1e, 0.9);
  for (const sx of [-1.5, 1.7]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.0, 0.26), dark);
    p.position.set(sx, 2.0, -0.08);
    p.castShadow = true;
    g.add(p);
  }
  const items: Array<{ icon: string; text: string }> = [
    { icon: '🐟', text: 'อาหารทะเลสด' },
    { icon: '🦐', text: 'กุ้ง ปู ปลา' },
    { icon: '🦑', text: 'ปลาหมึก' },
    { icon: '🐚', text: 'หอยทะเล' },
    { icon: '🛒', text: 'ของฝาก' },
  ];
  // ป้ายลูกศร: ปลายแหลมชี้ไปทางซ้ายจอ (เข้าหาสะพาน) → ใน local คือ -X
  const shape = new THREE.Shape();
  shape.moveTo(-2.15, 0); shape.lineTo(-1.7, 0.42); shape.lineTo(2.15, 0.42);
  shape.lineTo(2.15, -0.42); shape.lineTo(-1.7, -0.42); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.translate(0, 0, -0.08);
  items.forEach((it, i) => {
    const y = 3.55 - i * 0.78;
    const m = new THREE.Mesh(geo, wood);
    m.position.set(0.1, y, 0);
    m.castShadow = true;
    g.add(m);
    const tex = makeCanvasTexture(1024, 192, (ctx, w, h) => {
      ctx.textBaseline = 'middle';
      ctx.font = '104px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(it.icon, 150, h / 2 + 6);
      ctx.textAlign = 'left';
      ctx.font = thaiFont(112, 800);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#4a2a10';
      ctx.strokeText(it.text, 270, h / 2 + 4);
      ctx.fillStyle = '#fff6df';
      ctx.fillText(it.text, 270, h / 2 + 4);
    });
    const d = new THREE.Mesh(
      new THREE.PlaneGeometry(3.7, 0.69),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    d.position.set(0.28, y, 0.09);
    g.add(d);
  });
  return g;
}

export function createEntranceProps(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'EntranceProps';

  // ป้ายซ้ายจอ (สด อร่อย จากทะเล) / ป้ายลูกศรขวาจอ
  const fresh = createFreshSign();
  placeFacingViewer(fresh, -13.2, -7.2, 0.18);
  root.add(fresh);
  colliders.push({ x: screenX(-13.2), z: -7.2, hx: 2.7, hz: 0.5 });

  const arrows = createArrowSign();
  placeFacingViewer(arrows, 13.6, -7.4, -0.18);
  root.add(arrows);
  colliders.push({ x: screenX(13.6), z: -7.4, hx: 2.3, hz: 0.5 });

  // กระถางหินปลูกดอกไม้หน้าเสาซุ้มทั้งสองข้าง
  const b = new GeoBatch();
  const stoneTex = makeStoneBlockTexture(1, 1, 31);
  const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
  const soil = stdMat(0x4a3320, 1);
  const leaf = stdMat(0x3f9a3d, 0.9);
  const leaf2 = stdMat(0x57b04a, 0.9);
  const pink = stdMat(0xe76fb2, 0.7);
  const violet = stdMat(0xb26fe0, 0.7);
  const rnd = seeded(77);
  for (const s of [-1, 1]) {
    const cx = screenX(s * 4.9);
    const cz = ARCH.z - 2.1;
    b.box(2.3, 1.15, 1.5, stone, [cx, 0.58, cz], undefined, true);
    b.box(2.1, 0.12, 1.3, soil, [cx, 1.17, cz]);
    for (let i = 0; i < 7; i++) {
      const px = cx + (rnd() - 0.5) * 1.8, pz = cz + (rnd() - 0.5) * 1.0;
      b.add(new THREE.IcosahedronGeometry(0.34 + rnd() * 0.16, 1), i % 2 ? leaf : leaf2, mat4([px, 1.45, pz]));
    }
    for (let i = 0; i < 12; i++) {
      const px = cx + (rnd() - 0.5) * 2.0, pz = cz + (rnd() - 0.5) * 1.2;
      b.add(new THREE.IcosahedronGeometry(0.1, 0), i % 3 ? pink : violet, mat4([px, 1.78 + rnd() * 0.15, pz]));
    }
    colliders.push({ x: cx, z: cz, hx: 1.2, hz: 0.8 });
  }
  root.add(b.build('Planters'));
  return root;
}

/** รั้วไม้ริมฝั่ง + พุ่มไม้ดอก + กำแพงกันคลื่นหิน (เว้นช่องตรงสะพาน) */
export function createShoreline(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Shoreline';
  const b = new GeoBatch();
  const wood = stdMat(0x9a7447, 0.9);
  const wall = stdMat(0x9a9386, 0.95, { flatShading: true });
  const leaf = stdMat(0x3f9a3d, 0.9);
  const leaf2 = stdMat(0x5fb94f, 0.9);
  const flowerA = stdMat(0xe76fb2, 0.7);
  const flowerB = stdMat(0xffd24a, 0.7);
  const rnd = seeded(5);

  const fenceZ = LAYOUT.shoreZ - 0.35;
  const inner = BRIDGE.halfWidth + 1.2; // เริ่มรั้วหลังเสาซุ้ม
  const outer = 43;
  for (const s of [-1, 1]) {
    const mid = s * (inner + outer) / 2;
    const len = outer - inner;
    b.box(len, 0.14, 0.14, wood, [mid, 0.95, fenceZ]);
    b.box(len, 0.12, 0.12, wood, [mid, 0.55, fenceZ]);
    for (let x = inner; x <= outer; x += 2.2) b.box(0.2, 1.1, 0.2, wood, [s * x, 0.55, fenceZ], undefined, true);
    // กำแพงกันคลื่น (ขอบบก-ทะเล) ไม่ปิดช่องสะพาน
    b.box(len + 1, 0.9, 1.3, wall, [mid, -0.2, LAYOUT.shoreZ + 0.45]);
    // พุ่มไม้
    for (let x = inner + 1.5; x <= outer; x += 4.3) {
      const jitter = rnd() * 0.8;
      for (let i = 0; i < 3; i++) {
        b.add(new THREE.IcosahedronGeometry(0.55 + rnd() * 0.3, 1), i % 2 ? leaf : leaf2, mat4([s * x + (i - 1) * 0.55, 0.55, fenceZ - 0.9 - jitter]));
      }
      for (let i = 0; i < 5; i++) {
        b.add(new THREE.IcosahedronGeometry(0.12, 0), rnd() > 0.5 ? flowerA : flowerB, mat4([s * x + (rnd() - 0.5) * 1.6, 0.85 + rnd() * 0.4, fenceZ - 1.25 - jitter]));
      }
    }
  }
  root.add(b.build('ShoreFenceAndBushes'));
  return root;
}

/** ลานปูหินด้านหน้าซุ้ม (กว้าง ~26 ม.) */
export function createPlaza(): THREE.Mesh {
  const width = 26;
  const depth = LAYOUT.shoreZ - LAYOUT.minZ + 12;
  const tex = makePavingTexture(width / 4, depth / 4, 9);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })
  );
  mesh.position.set(0, 0.03, LAYOUT.shoreZ - depth / 2);
  mesh.receiveShadow = true;
  mesh.name = 'Plaza';
  return mesh;
}
