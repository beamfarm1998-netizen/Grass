// src/utils/pngStructureSkin.ts

const MAX_SKIN_DIM = 192;

export interface ProcessedStructurePng {
  dataUrl: string;
}

export interface BuiltInPngPreset {
  id: string;
  nameTh: string;
  nameEn: string;
  defaultRepeat: number;
  dataUrl: string;
}

/**
 * Reads a user-selected .png (or image) file, normalizes it onto a 192x192
 * offscreen canvas (compositing transparent areas cleanly over soft white so transparent
 * PNG regions never render black on 3D buildings or outfits), and returns a compact data URL
 * (~10-25KB) suitable for Three.js `TextureLoader` and quota-safe persistence.
 */
export function processStructurePngFile(file: File): Promise<ProcessedStructurePng> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('INVALID_IMAGE_FILE'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = MAX_SKIN_DIM;
        canvas.height = MAX_SKIN_DIM;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('CANVAS_UNAVAILABLE'));
          return;
        }

        // Clean neutral white backing so transparent PNG stickers/logos look crisp on walls & shirts
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, MAX_SKIN_DIM, MAX_SKIN_DIM);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, MAX_SKIN_DIM, MAX_SKIN_DIM);

        // Prefer compact WebP (~10-22KB), fallback to JPEG (~14KB) since alpha was composited onto #ffffff
        let dataUrl = canvas.toDataURL('image/webp', 0.82);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        }
        resolve({ dataUrl });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_DECODE_FAILED'));
    };

    img.src = objectUrl;
  });
}

function makePatternDataUrl(draw: (ctx: CanvasRenderingContext2D, s: number) => void): string {
  if (typeof document === 'undefined') return '';
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  draw(ctx, s);
  return c.toDataURL('image/png');
}

let _cachedHousePresets: BuiltInPngPreset[] | null = null;
let _cachedOutfitPresets: BuiltInPngPreset[] | null = null;

export function getBuiltInHousePngPresets(): BuiltInPngPreset[] {
  if (_cachedHousePresets) return _cachedHousePresets;
  _cachedHousePresets = [
    {
      id: 'terracotta_shingle',
      nameTh: 'กระเบื้องดินเผา',
      nameEn: 'Roof Shingles',
      defaultRepeat: 3,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#b4532a';
        ctx.fillRect(0, 0, s, s);
        const rows = 4;
        const cols = 4;
        const rh = s / rows;
        const cw = s / cols;
        for (let r = 0; r < rows; r++) {
          const offset = (r % 2) * (cw * 0.5);
          for (let c = -1; c <= cols; c++) {
            const x = c * cw + offset;
            const y = r * rh;
            ctx.fillStyle = (r + c) % 2 === 0 ? '#c85d32' : '#9e4421';
            ctx.beginPath();
            ctx.roundRect(x + 2, y + 2, cw - 4, rh - 2, [0, 0, 10, 10]);
            ctx.fill();
            ctx.strokeStyle = '#6d2b13';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }),
    },
    {
      id: 'red_brick',
      nameTh: 'ลายอิฐแดง',
      nameEn: 'Red Brick',
      defaultRepeat: 3,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#dfd8ce';
        ctx.fillRect(0, 0, s, s);
        const rows = 6;
        const rh = s / rows;
        const bw = s / 3;
        for (let r = 0; r < rows; r++) {
          const off = (r % 2) * (bw * 0.5);
          for (let c = -1; c <= 3; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#b84233' : '#9f3528';
            ctx.fillRect(c * bw + off + 2, r * rh + 2, bw - 4, rh - 4);
          }
        }
      }),
    },
    {
      id: 'honey_plank',
      nameTh: 'ไม้ระแนงโอ๊ค',
      nameEn: 'Oak Planks',
      defaultRepeat: 2,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#c8965e';
        ctx.fillRect(0, 0, s, s);
        const planks = 4;
        const pw = s / planks;
        for (let i = 0; i < planks; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#cf9e66' : '#ba864e';
          ctx.fillRect(i * pw + 1, 0, pw - 2, s);
          ctx.fillStyle = '#7c5329';
          ctx.fillRect(i * pw, 0, 2, s);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(i * pw + 5, 0, 4, s);
        }
      }),
    },
    {
      id: 'cobble_slate',
      nameTh: 'หินกาบธรรมชาติ',
      nameEn: 'Stone Slate',
      defaultRepeat: 3,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#64748b';
        ctx.fillRect(0, 0, s, s);
        const blocks: [number, number, number, number, string][] = [
          [4, 4, 56, 36, '#94a3b8'],
          [64, 4, 60, 44, '#78879b'],
          [4, 44, 42, 40, '#8292a6'],
          [50, 52, 74, 34, '#9aa8ba'],
          [4, 88, 66, 36, '#7b8a9e'],
          [74, 90, 50, 34, '#94a3b8'],
        ];
        for (const [x, y, w, h, col] of blocks) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 7);
          ctx.fill();
        }
      }),
    },
    {
      id: 'woven_bamboo',
      nameTh: 'ไม้ไผ่สาน',
      nameEn: 'Woven Bamboo',
      defaultRepeat: 4,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#a3b86c';
        ctx.fillRect(0, 0, s, s);
        const step = 32;
        for (let y = 0; y < s; y += step) {
          for (let x = 0; x < s; x += step) {
            const even = ((x + y) / step) % 2 === 0;
            ctx.fillStyle = even ? '#bed084' : '#8da356';
            ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
            ctx.strokeStyle = '#617332';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
          }
        }
      }),
    },
    {
      id: 'patio_checker',
      nameTh: 'กระเบื้องวินเทจ',
      nameEn: 'Patio Tile',
      defaultRepeat: 4,
      dataUrl: makePatternDataUrl((ctx, s) => {
        const half = s / 2;
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 2; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#f5efe6' : '#475569';
            ctx.fillRect(c * half, r * half, half, half);
          }
        }
      }),
    },
  ];
  return _cachedHousePresets;
}

export function getBuiltInOutfitPngPresets(): BuiltInPngPreset[] {
  if (_cachedOutfitPresets) return _cachedOutfitPresets;
  _cachedOutfitPresets = [
    {
      id: 'farm_plaid',
      nameTh: 'ลายสก๊อตชาวไร่',
      nameEn: 'Red Flannel',
      defaultRepeat: 3,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fillRect(0, 0, s / 2, s);
        ctx.fillRect(0, 0, s, s / 2);
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(s * 0.25, 0);
        ctx.lineTo(s * 0.25, s);
        ctx.moveTo(0, s * 0.25);
        ctx.lineTo(s, s * 0.25);
        ctx.stroke();
      }),
    },
    {
      id: 'indigo_denim',
      nameTh: 'ผ้ายีนส์เดนิม',
      nameEn: 'Indigo Denim',
      defaultRepeat: 4,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.28)';
        ctx.lineWidth = 2;
        for (let i = -s; i < s * 2; i += 8) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + s, s);
          ctx.stroke();
        }
      }),
    },
    {
      id: 'sailor_stripes',
      nameTh: 'ลายทางกะลาสี',
      nameEn: 'Breton Stripes',
      defaultRepeat: 3,
      dataUrl: makePatternDataUrl((ctx, s) => {
        const bands = 6;
        const bh = s / bands;
        for (let i = 0; i < bands; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#f8fafc' : '#0284c7';
          ctx.fillRect(0, i * bh, s, bh);
        }
      }),
    },
    {
      id: 'sakura_floral',
      nameTh: 'ลายดอกซากุระ',
      nameEn: 'Sakura Print',
      defaultRepeat: 2,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(0, 0, s, s);
        const spots: [number, number][] = [
          [32, 32],
          [96, 36],
          [64, 72],
          [28, 102],
          [98, 100],
        ];
        for (const [cx, cy] of spots) {
          ctx.fillStyle = '#ec4899';
          for (let a = 0; a < 5; a++) {
            const ang = (a / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(ang) * 9, cy + Math.sin(ang) * 9, 6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    },
    {
      id: 'sunflower_farm',
      nameTh: 'ลายทานตะวัน',
      nameEn: 'Sunflower',
      defaultRepeat: 2,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(0, 0, s, s);
        const centers: [number, number][] = [
          [36, 36],
          [96, 96],
        ];
        for (const [cx, cy] of centers) {
          ctx.fillStyle = '#f59e0b';
          for (let a = 0; a < 10; a++) {
            const ang = (a / 10) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14, 6.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    },
    {
      id: 'cow_spots',
      nameTh: 'ลายวัวนมสุดคิวท์',
      nameEn: 'Cow Spots',
      defaultRepeat: 2,
      dataUrl: makePatternDataUrl((ctx, s) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#1e293b';
        const blobs: [number, number, number, number][] = [
          [28, 30, 22, 16],
          [92, 26, 18, 22],
          [62, 74, 26, 18],
          [22, 102, 18, 15],
          [104, 102, 20, 16],
        ];
        for (const [x, y, rx, ry] of blobs) {
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    },
  ];
  return _cachedOutfitPresets;
}
