// src/worlds/hua-hin-fish-bridge/environment/PierHarbor.ts
// ฉากไกล: ท้องฟ้าไล่สี + เมฆลอย + นกนางนวล + เรือประมงลอยในทะเล + เกาะเขียวมีบ้านเรือน (ตามภาพอ้างอิง)
import * as THREE from 'three';
import { LAYOUT } from './StoneBridge';
import { GeoBatch, mat4, screenX, seeded, stdMat } from './PierKit';

export interface HarborScenery {
  group: THREE.Group;
  update: (elapsed: number) => void;
}

export const HORIZON_COLOR = 0xaadcf2;

// ───────────── ท้องฟ้า ─────────────
function createSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(360, 24, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const horizon = new THREE.Color(HORIZON_COLOR);
  const mid = new THREE.Color(0x6fb8ee);
  const top = new THREE.Color(0x2b7fe0);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 360);
    if (t < 0.25) c.copy(horizon).lerp(mid, t / 0.25);
    else c.copy(mid).lerp(top, Math.min(1, (t - 0.25) / 0.6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SkyDome';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

function createClouds(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  group.name = 'Clouds';
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const shade = new THREE.MeshBasicMaterial({ color: 0xdcecf8, fog: false });
  const rnd = seeded(404);
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 10; i++) {
    const b = new GeoBatch();
    const puffs = 5 + Math.floor(rnd() * 3);
    for (let k = 0; k < puffs; k++) {
      const r = 7 + rnd() * 6;
      b.add(new THREE.IcosahedronGeometry(r, 1), k === 0 ? shade : mat, mat4([(k - puffs / 2) * 9 + rnd() * 3, rnd() * 4 + (k % 2) * 2, rnd() * 5], [0, 0, 0], [1.25, 0.65, 0.9]));
    }
    const cl = b.build('Cloud');
    const ang = (i / 10) * Math.PI * 2 + rnd() * 0.4;
    const dist = 180 + rnd() * 90;
    // เมฆส่วนใหญ่อยู่ฝั่งทะเล (+z) ที่กล้องมองเห็น
    cl.position.set(Math.sin(ang) * dist, 55 + rnd() * 45, Math.abs(Math.cos(ang)) * dist + 40);
    cl.scale.setScalar(0.9 + rnd() * 0.8);
    cl.lookAt(0, cl.position.y, 0);
    group.add(cl);
    clouds.push(cl);
  }
  return {
    group,
    update(t) {
      clouds.forEach((cl, i) => {
        cl.position.x += Math.sin(t * 0.02 + i) * 0.004 + 0.003;
        if (cl.position.x > 300) cl.position.x = -300;
      });
    },
  };
}

function createGulls(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  group.name = 'Seagulls';
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(1.5, 0.15); wingShape.lineTo(1.1, -0.3); wingShape.lineTo(0.2, -0.28); wingShape.closePath();
  const wingGeo = new THREE.ShapeGeometry(wingShape).rotateX(-Math.PI / 2);
  const bodyGeo = new THREE.SphereGeometry(0.22, 6, 5).scale(2.2, 0.8, 1);
  const gulls = [] as Array<{ g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; cx: number; cz: number; rad: number; spd: number; ph: number; y: number }>;
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, mat);
    const l = new THREE.Mesh(wingGeo, mat);
    const r = new THREE.Mesh(wingGeo, mat);
    r.scale.x = -1;
    g.add(body, l, r);
    g.scale.setScalar(1.1);
    group.add(g);
    gulls.push({ g, l, r, cx: (i - 2) * 10, cz: 24 + i * 6, rad: 9 + i * 3, spd: 0.25 + i * 0.04, ph: i * 1.3, y: 13 + (i % 3) * 3 });
  }
  return {
    group,
    update(t) {
      for (const o of gulls) {
        const a = t * o.spd + o.ph;
        const x = o.cx + Math.cos(a) * o.rad;
        const z = o.cz + Math.sin(a) * o.rad;
        o.g.position.set(x, o.y + Math.sin(a * 2) * 0.8, z);
        o.g.rotation.y = -a;
        const flap = Math.sin(t * 6 + o.ph) * 0.55;
        o.l.rotation.z = flap;
        o.r.rotation.z = -flap;
      }
    },
  };
}

// ───────────── เรือประมง ─────────────
interface BoatSpec {
  sx: number; z: number; rotY: number; scale: number;
  hull: number; stripe: number; cabin: number; roof: number; outriggers: boolean;
}

function buildBoat(spec: BoatSpec): THREE.Group {
  const L = 9, B = 3.2;
  const b = new GeoBatch();
  const hullMat = stdMat(spec.hull, 0.6);
  const stripeMat = stdMat(spec.stripe, 0.6);
  const white = stdMat(0xf4f4f0, 0.65);
  const cabinMat = stdMat(spec.cabin, 0.65);
  const roofMat = stdMat(spec.roof, 0.6);
  const glass = stdMat(0x1c3050, 0.2, { metalness: 0.4 });
  const dark = stdMat(0x2b2b30, 0.7);
  const deck = stdMat(0x9a7a55, 0.9);
  const flag = stdMat(0xf5c542, 0.8, { side: THREE.DoubleSide });

  const hullShape = (scale: number) => {
    const s = new THREE.Shape();
    const hl = (L / 2) * scale, hb = (B / 2) * scale;
    s.moveTo(hl, 0);
    s.quadraticCurveTo(hl * 0.55, hb * 1.0, hl * 0.05, hb);
    s.lineTo(-hl * 0.92, hb * 0.9);
    s.lineTo(-hl, hb * 0.7);
    s.lineTo(-hl, -hb * 0.7);
    s.lineTo(-hl * 0.92, -hb * 0.9);
    s.lineTo(hl * 0.05, -hb);
    s.quadraticCurveTo(hl * 0.55, -hb * 1.0, hl, 0);
    return s;
  };
  const ext = (shape: THREE.Shape, depth: number, y: number, mat: THREE.Material) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); // ความหนาขึ้นไปทาง +Y
    b.add(g, mat, mat4([0, y, 0]), false);
  };
  ext(hullShape(1.0), 0.75, 0, hullMat);
  ext(hullShape(1.012), 0.16, 0.75, stripeMat);
  ext(hullShape(1.0), 0.6, 0.91, white);
  ext(hullShape(0.9), 0.04, 1.5, deck);

  // ห้องเครื่อง/ห้องควบคุม
  const dy = 1.52;
  b.box(3.0, 1.35, B * 0.72, cabinMat, [-0.9, dy + 0.68, 0]);
  b.box(3.3, 0.14, B * 0.82, roofMat, [-0.9, dy + 1.42, 0]);
  b.box(1.5, 0.95, B * 0.55, cabinMat, [-1.2, dy + 1.95, 0]);
  b.box(1.75, 0.12, B * 0.65, roofMat, [-1.2, dy + 2.48, 0]);
  for (const s of [-1, 1]) {
    b.box(1.9, 0.42, 0.03, glass, [-0.9, dy + 0.85, s * (B * 0.36 + 0.01)]);
    b.box(0.03, 0.42, 1.8, glass, [0.62, dy + 0.85, 0]);
  }
  b.box(0.03, 0.4, B * 0.45, glass, [-0.44, dy + 2.0, 0]);

  // เสากระโดง + สายระย้า + ธง
  const mastX = 1.9;
  b.add(new THREE.CylinderGeometry(0.06, 0.09, 5.2, 6), dark, mat4([mastX, dy + 2.6, 0]));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), dark, mat4([mastX, dy + 4.2, 0], [Math.PI / 2, 0, 0]));
  b.add(new THREE.SphereGeometry(0.1, 6, 5), white, mat4([mastX, dy + 5.25, 0]));
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0); flagShape.lineTo(0.9, -0.2); flagShape.lineTo(0, -0.45); flagShape.closePath();
  b.add(new THREE.ShapeGeometry(flagShape), flag, mat4([mastX, dy + 5.0, 0]));
  // สายยึดเสาไปหัว/ท้ายเรือ
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 4.6, 4), dark, mat4([mastX + 1.7, dy + 2.2, 0], [0, 0, -1.07]));
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 6.6, 4), dark, mat4([mastX - 3.1, dy + 2.5, 0], [0, 0, 1.0]));

  if (spec.outriggers) {
    // เสากางอวนสองข้างแบบเรือประมงไทย
    for (const s of [-1, 1]) {
      b.add(new THREE.CylinderGeometry(0.04, 0.06, 6.4, 5), dark, mat4([mastX - 0.2, dy + 3.8, s * 2.7], [s * 0.62, 0, 0]));
      b.add(new THREE.CylinderGeometry(0.012, 0.012, 4.6, 4), dark, mat4([mastX - 0.2, dy + 2.8, s * 1.7], [s * -0.5, 0, 0]));
    }
    // ถังน้ำ/ทุ่นบนดาดฟ้า
    b.add(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8), stdMat(0x2d6fc4, 0.7), mat4([2.9, dy + 0.3, 0.8]));
    b.add(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8), stdMat(0xe8453c, 0.7), mat4([2.9, dy + 0.3, -0.8]));
  }

  const g = b.build('FishingBoat');
  g.scale.setScalar(spec.scale);
  g.rotation.y = spec.rotY;
  g.position.set(screenX(spec.sx), LAYOUT.seaY - 0.25, spec.z);
  g.userData = { baseY: g.position.y, ph: (spec.sx + spec.z) * 0.37 };
  return g;
}

function createBoats(): { group: THREE.Group; update: (t: number) => void } {
  const group = new THREE.Group();
  group.name = 'Boats';
  // sx = ซ้าย(-)/ขวา(+) ของจอ, rotY: 0 = หัวเรือชี้ +X โลก (ซ้ายจอ)
  const specs: BoatSpec[] = [
    { sx: -24, z: 18, rotY: -0.35, scale: 1.3, hull: 0xd3453c, stripe: 0x2b4aa8, cabin: 0xf1f1ee, roof: 0x2b4aa8, outriggers: true },
    { sx: -38, z: 34, rotY: 0.5, scale: 1.05, hull: 0x2f62b5, stripe: 0xf1f1ee, cabin: 0xf1f1ee, roof: 0xd3453c, outriggers: true },
    { sx: -19, z: 47, rotY: -0.15, scale: 0.9, hull: 0xf1f1ee, stripe: 0x2fa66a, cabin: 0xf5e3a0, roof: 0x2fa66a, outriggers: false },
    { sx: 23, z: 24, rotY: Math.PI + 0.4, scale: 1.25, hull: 0xf1f1ee, stripe: 0x2b4aa8, cabin: 0xf1f1ee, roof: 0xe05aa8, outriggers: true },
    { sx: 17, z: 46, rotY: Math.PI - 0.5, scale: 0.9, hull: 0x2fa6c8, stripe: 0xf1f1ee, cabin: 0xf1f1ee, roof: 0xd3453c, outriggers: false },
    { sx: 36, z: 12, rotY: Math.PI + 0.9, scale: 1.0, hull: 0xd3453c, stripe: 0xf1f1ee, cabin: 0xf1f1ee, roof: 0x2b4aa8, outriggers: true },
    { sx: -12, z: 78, rotY: 0.2, scale: 0.9, hull: 0x2f62b5, stripe: 0xf1f1ee, cabin: 0xf1f1ee, roof: 0xd3453c, outriggers: false },
    { sx: 28, z: 72, rotY: Math.PI - 0.2, scale: 0.9, hull: 0xf1f1ee, stripe: 0xd3453c, cabin: 0xf1f1ee, roof: 0x2b4aa8, outriggers: false },
  ];
  const boats = specs.map(buildBoat);
  boats.forEach((bt) => group.add(bt));
  return {
    group,
    update(t) {
      for (const bt of boats) {
        const { baseY, ph } = bt.userData as { baseY: number; ph: number };
        bt.position.y = baseY + Math.sin(t * 1.1 + ph) * 0.08;
        bt.rotation.z = Math.sin(t * 0.9 + ph) * 0.018;
      }
    },
  };
}

// ───────────── เกาะ ─────────────
function createIsland(): THREE.Group {
  const R = 22, Hh = 13;
  const cx = screenX(54), cz = 92;
  const b = new GeoBatch();
  const grass = stdMat(0x57a83c, 0.95, { flatShading: true });
  const grassDark = stdMat(0x3c8a34, 0.95, { flatShading: true });
  const sand = stdMat(0xe8d6a0, 1);
  const roofRed = stdMat(0xc9473a, 0.8);
  const wallA = stdMat(0xf6f1e4, 0.9);
  const wallB = stdMat(0xf3d6c0, 0.9);
  const wallC = stdMat(0xf6e7a8, 0.9);
  const treeMat = stdMat(0x2f7a31, 0.9, { flatShading: true });
  const trunk = stdMat(0x6b4a2b, 0.9);
  const rnd = seeded(808);

  const height = (x: number, z: number): number => {
    const d = Math.hypot(x, z) / R;
    return d >= 1 ? 0 : Hh * Math.pow(1 - d * d, 0.8);
  };

  b.add(new THREE.CylinderGeometry(R + 2.5, R + 4.5, 1.6, 20), sand, mat4([cx, LAYOUT.seaY - 0.1, cz]));
  b.add(new THREE.SphereGeometry(R, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), grass, mat4([cx, LAYOUT.seaY + 0.4, cz], [0, 0, 0], [1, Hh / R, 1]));
  b.add(new THREE.SphereGeometry(R * 0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), grassDark, mat4([cx - 6, LAYOUT.seaY + 1.4, cz - 4], [0, 0, 0], [1, 0.9, 1]));

  // บ้านเรือนบนไหล่เขาด้านที่หันมาทางสะพาน (-z)
  for (let i = 0; i < 12; i++) {
    const ang = Math.PI * (0.05 + (i / 11) * 0.9) + Math.PI; // ครึ่งวงกลมด้านหน้า
    const d = (0.62 + rnd() * 0.25) * R;
    const hx = Math.cos(ang) * d, hz = Math.sin(ang) * d * 0.9 - 2;
    const hy = LAYOUT.seaY + 0.4 + height(hx, hz) * 0.92;
    const wall = i % 3 === 0 ? wallA : i % 3 === 1 ? wallB : wallC;
    const s = 1.2 + rnd() * 0.5;
    b.box(2.4 * s, 1.5 * s, 2.0 * s, wall, [cx + hx, hy + 0.75 * s, cz + hz]);
    b.add(new THREE.ConeGeometry(1.9 * s, 1.1 * s, 4).rotateY(Math.PI / 4), roofRed, mat4([cx + hx, hy + 2.05 * s, cz + hz]));
  }
  // ต้นไม้
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.85;
    const tx = Math.cos(a) * d, tz = Math.sin(a) * d;
    const ty = LAYOUT.seaY + 0.4 + height(tx, tz) * 0.95;
    b.add(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 5), trunk, mat4([cx + tx, ty + 0.5, cz + tz]));
    b.add(new THREE.IcosahedronGeometry(1.3 + rnd() * 0.6, 0), treeMat, mat4([cx + tx, ty + 1.9, cz + tz], [0, 0, 0], [1, 1.2, 1]));
  }
  return b.build('Island');
}

export function createHarborScenery(): HarborScenery {
  const group = new THREE.Group();
  group.name = 'HarborScenery';
  group.add(createSkyDome());
  const clouds = createClouds();
  const gulls = createGulls();
  const boats = createBoats();
  group.add(clouds.group, gulls.group, boats.group, createIsland());
  return {
    group,
    update(t) {
      clouds.update(t);
      gulls.update(t);
      boats.update(t);
    },
  };
}
