// src/worlds/hua-hin-fish-bridge/environment/PierKit.ts
// เครื่องมือกลางสำหรับสร้างฉากสะพานปลา: Texture แบบ Procedural + GeoBatch (รวม geometry ตาม material ลด draw call)
//
// ระบบพิกัดที่ใช้ในไฟล์ฉากทั้งหมด (สำคัญ):
//   กล้องอยู่ฝั่งบก (z ติดลบ) มองไปทางทะเล (+z)  →  "ขวาของจอ" = x ติดลบ ของโลก
//   วัตถุที่ต้องหันหน้าเข้าหาผู้เล่น ให้สร้างใน local (หน้า = +Z, ขวาจอ = +X) แล้วใช้ placeFacingViewer()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** สุ่มแบบกำหนดผลได้ (ฉากเหมือนเดิมทุกครั้งที่โหลด) */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** x ฝั่งจอ (ขวาบวก) → x ของโลก */
export const screenX = (sx: number): number => -sx;

/** วางกลุ่มที่สร้างแบบ "หน้า=+Z" ให้หันหน้าเข้าหาผู้เล่น (มอง +Z) พร้อมเอียงเข้าหาแนวกลางเล็กน้อย */
export function placeFacingViewer(g: THREE.Object3D, sx: number, z: number, tilt = 0): void {
  g.position.set(screenX(sx), g.position.y, z);
  g.rotation.y = Math.PI + tilt;
}

const FONT_STACK = '"Prompt","Kanit","Noto Sans Thai","Sarabun",system-ui,sans-serif';
export const thaiFont = (px: number, weight = 800): string => `${weight} ${px}px ${FONT_STACK}`;

/** วาด canvas → texture (วาดซ้ำอัตโนมัติเมื่อฟอนต์โหลดเสร็จ ให้ตัวอักษรไทยไม่ค้างเป็นฟอนต์สำรอง) */
export function makeCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: boolean; anisotropy?: number } = {}
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const paint = () => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
  };
  paint();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    void fonts?.ready.then(() => {
      paint();
      tex.needsUpdate = true;
    });
  } catch {
    /* ไม่รองรับ document.fonts → ใช้ที่วาดครั้งแรก */
  }
  return tex;
}

/** พื้นปูหินแบบในภาพ: แผ่นหินสี่เหลี่ยมโทนทราย/ครีม มีร่องยาแนว */
export function makePavingTexture(repeatX: number, repeatY: number, seed = 7): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const tex = makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#a98a62';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rh = h / rows;
      const shades = ['#d6b98d', '#cfae80', '#dcc196', '#c8a678', '#d2b386', '#e0c89f'];
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * 90;
        while (x < w) {
          const tw = 84 + rnd() * 70;
          ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
          ctx.fillRect(x + 2, r * rh + 2, tw - 4, rh - 4);
          // ไล่เฉดเบาๆ ให้ดูเป็นแผ่นหิน
          const g = ctx.createLinearGradient(x, r * rh, x + tw, r * rh + rh);
          g.addColorStop(0, 'rgba(255,255,255,0.14)');
          g.addColorStop(1, 'rgba(90,60,30,0.14)');
          ctx.fillStyle = g;
          ctx.fillRect(x + 2, r * rh + 2, tw - 4, rh - 4);
          x += tw;
        }
      }
    },
    { repeat: true, anisotropy: 8 }
  );
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/** หินก่อสีเทาสำหรับเสาซุ้ม/กระถาง */
export function makeStoneBlockTexture(repeatX = 1, repeatY = 1, seed = 11): THREE.CanvasTexture {
  const rnd = seeded(seed);
  const tex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#7d7568';
      ctx.fillRect(0, 0, w, h);
      const rows = 4;
      const rh = h / rows;
      const shades = ['#b3ab9d', '#a9a091', '#bdb5a6', '#a39a8c'];
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * 60;
        while (x < w) {
          const bw = 70 + rnd() * 40;
          ctx.fillStyle = shades[Math.floor(rnd() * shades.length)];
          ctx.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6);
          x += bw;
        }
      }
    },
    { repeat: true }
  );
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/** ไม้ลายเส้น */
export function makeWoodTexture(base = '#a8743a', grain = 'rgba(70,40,15,0.28)', repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const rnd = seeded(23);
  const tex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = grain;
      for (let i = 0; i < 38; i++) {
        ctx.lineWidth = 1 + rnd() * 3;
        const y = rnd() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + rnd() * 8 - 4, w * 0.7, y + rnd() * 8 - 4, w, y);
        ctx.stroke();
      }
    },
    { repeat: true }
  );
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/** ลายร่มสลับสี 8 แฉก (ตรงกับ ConeGeometry 8 segments พอดี) */
export function makeUmbrellaTexture(a: string, b: string): THREE.CanvasTexture {
  const tex = makeCanvasTexture(256, 8, (ctx, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      ctx.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

const _o = new THREE.Object3D();
export function mat4(
  p: [number, number, number],
  r: [number, number, number] = [0, 0, 0],
  s: [number, number, number] = [1, 1, 1]
): THREE.Matrix4 {
  _o.position.set(p[0], p[1], p[2]);
  _o.rotation.set(r[0], r[1], r[2]);
  _o.scale.set(s[0], s[1], s[2]);
  _o.updateMatrix();
  return _o.matrix.clone();
}

/** รวม geometry ที่ใช้ material เดียวกันเป็น mesh เดียว (ฉากนิ่งทั้งหมดผ่านตัวนี้) */
export class GeoBatch {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private cast = new Set<THREE.Material>();

  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix: THREE.Matrix4, castShadow = false): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    // ให้ attribute ตรงกันทุกชิ้น (merge ต้องการชุดเดียวกัน)
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    const list = this.buckets.get(mat) ?? [];
    list.push(g);
    this.buckets.set(mat, list);
    if (castShadow) this.cast.add(mat);
    return this;
  }

  box(w: number, h: number, d: number, mat: THREE.Material, p: [number, number, number], r?: [number, number, number], cast = false): this {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, mat4(p, r), cast);
  }

  build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [mat, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = this.cast.has(mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

export function stdMat(color: number, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
}

/** พื้นผิวโค้งแบบแผ่นป้ายซุ้ม (แถบ UV 0..1) หน้า = +Z */
export function archStrip(width: number, height: number, baseY: number, rise: number, seg = 40): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const x = (u - 0.5) * width;
    const k = 1 - Math.pow(2 * u - 1, 2);
    const y0 = baseY + rise * k;
    pos.push(x, y0, 0, x, y0 + height, 0);
    uv.push(u, 0, u, 1);
    nor.push(0, 0, 1, 0, 0, 1);
    if (i < seg) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** ตัวช่วย dispose ที่รวม texture ด้วย (canvas texture ไม่ถูกเก็บกวาดเอง) */
export function disposeMaterialTextures(mat: THREE.Material): void {
  const m = mat as THREE.MeshStandardMaterial;
  m.map?.dispose();
  m.emissiveMap?.dispose();
}
