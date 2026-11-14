import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Generates zero-dependency valid PNG icons (180, 192, 512, maskable 512)
 * and valid binary glTF 2.0 (.glb) 3D models in public/assets/models/
 * so GLTFLoader, PWA Manifest, and iOS Safari work offline with zero 404s.
 */

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createIconPng(size, maskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const pad = maskable ? 0.16 : 0.08;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0; // filter none
    const ny = y / size;

    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const px = rowOffset + 1 + x * 4;

      // Deep ocean slate gradient background
      let r = Math.round(7 + ny * 14);
      let g = Math.round(19 + ny * 32);
      let b = Math.round(31 + ny * 48);
      let a = 255;

      // Safe zone coordinates [-1, 1]
      const sx = (nx - 0.5) / (0.5 - pad);
      const sy = (ny - 0.5) / (0.5 - pad);
      const dist = Math.hypot(sx, sy);

      // Subtle compass ring
      if (Math.abs(dist - 0.86) < 0.025) {
        r = 56;
        g = 189;
        b = 248;
      }

      // Water wave band
      const waveY = 0.36 + 0.07 * Math.sin(sx * 4.5);
      if (dist < 0.84 && sy > waveY) {
        r = Math.round(14 + (sy - waveY) * 20);
        g = Math.round(116 + (1 - sy) * 50);
        b = Math.round(174 + (1 - sy) * 55);
      }

      // Stylized golden rod arc
      const rodY = -0.55 + 0.55 * (sx + 0.65) * (sx + 0.65);
      if (sx > -0.65 && sx < 0.45 && Math.abs(sy - rodY) < 0.045) {
        r = 245;
        g = 158;
        b = 11;
      }

      // Stylized fish silhouette in center
      const fx = sx + 0.05;
      const fy = sy - 0.02;
      const bodyRadius = 0.22 * (1 - 1.6 * fx * fx);
      if (fx > -0.45 && fx < 0.48 && bodyRadius > 0 && Math.abs(fy) < bodyRadius) {
        r = 56;
        g = 189;
        b = 248;
        if (fx > 0.24 && fx < 0.32 && Math.abs(fy + 0.03) < 0.04) {
          r = 7;
          g = 19;
          b = 31;
        }
      }
      // Tail fin
      if (fx <= -0.35 && fx > -0.62 && Math.abs(fy) < (-fx - 0.32) * 0.75) {
        r = 14;
        g = 165;
        b = 233;
      }

      raw[px] = Math.max(0, Math.min(255, r));
      raw[px + 1] = Math.max(0, Math.min(255, g));
      raw[px + 2] = Math.max(0, Math.min(255, b));
      raw[px + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildBinaryGlb({ name, positions, normals, indices, baseColorFactor, metallicFactor, roughnessFactor }) {
  const posArray = new Float32Array(positions);
  const normArray = new Float32Array(normals);
  const idxArray = new Uint16Array(indices);

  const posBytes = Buffer.from(posArray.buffer);
  const normBytes = Buffer.from(normArray.buffer);
  let idxBytes = Buffer.from(idxArray.buffer);
  while (idxBytes.length % 4 !== 0) {
    idxBytes = Buffer.concat([idxBytes, Buffer.from([0])]);
  }

  const binBuffer = Buffer.concat([posBytes, normBytes, idxBytes]);

  const minPos = [Infinity, Infinity, Infinity];
  const maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      minPos[k] = Math.min(minPos[k], positions[i + k]);
      maxPos[k] = Math.max(maxPos[k], positions[i + k]);
    }
  }

  const gltf = {
    asset: { version: '2.0', generator: 'RealisticFishing3D Asset Pipeline' },
    scene: 0,
    scenes: [{ name: `${name}_Scene`, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [
      {
        name: `${name}_Mesh`,
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: `${name}_Material`,
        pbrMetallicRoughness: {
          baseColorFactor,
          metallicFactor,
          roughnessFactor,
        },
      },
    ],
    buffers: [{ byteLength: binBuffer.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length, byteLength: normBytes.length, target: 34962 },
      { buffer: 0, byteOffset: posBytes.length + normBytes.length, byteLength: idxArray.byteLength, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min: minPos,
        max: maxPos,
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: normals.length / 3,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
      },
    ],
  };

  let jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  while (jsonBytes.length % 4 !== 0) {
    jsonBytes = Buffer.concat([jsonBytes, Buffer.from([0x20])]);
  }

  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, jsonBytes, binChunkHeader, binBuffer]);
}

function createLatheMesh(rings, segments, radiusFn) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const z = (t - 0.5) * 1.0;
    const { rx, ry } = radiusFn(t);
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const cx = Math.cos(theta);
      const sy = Math.sin(theta);
      positions.push(cx * rx, sy * ry, z);
      const len = Math.hypot(cx, sy, 0.15) || 1;
      normals.push(cx / len, sy / len, 0.15 / len);
    }
  }

  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * row + s;
      const b = a + row;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, b, c, c, b, d);
    }
  }

  return { positions, normals, indices };
}

const publicDir = path.resolve('public');
const fishDir = path.join(publicDir, 'assets/models/fish');
const equipDir = path.join(publicDir, 'assets/models/equipment');
const envDir = path.join(publicDir, 'assets/models/environments');

for (const dir of [fishDir, equipDir, envDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

// 1. Generate PWA & Apple Touch PNG icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createIconPng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createIconPng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createIconPng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createIconPng(180, false));

// 2. Generate valid binary GLB models
const fishGeo = createLatheMesh(18, 14, (t) => {
  // Fusiform fish profile from tail (t=0) to snout (t=1)
  const profile = Math.sin(Math.pow(t, 0.72) * Math.PI);
  const tailFlare = t < 0.12 ? (0.12 - t) * 1.1 : 0;
  return {
    rx: Math.max(0.008, profile * 0.11 + tailFlare * 0.02),
    ry: Math.max(0.012, profile * 0.21 + tailFlare * 0.18),
  };
});

fs.writeFileSync(
  path.join(fishDir, 'lake_fish.glb'),
  buildBinaryGlb({
    name: 'LakeFishBody',
    ...fishGeo,
    baseColorFactor: [0.32, 0.58, 0.48, 1.0],
    metallicFactor: 0.35,
    roughnessFactor: 0.28,
  })
);

const rodGeo = createLatheMesh(12, 10, (t) => {
  const radius = 0.018 * (1 - t * 0.78);
  return { rx: radius, ry: radius };
});

fs.writeFileSync(
  path.join(equipDir, 'fishing_rod.glb'),
  buildBinaryGlb({
    name: 'CarbonRodBlank',
    ...rodGeo,
    baseColorFactor: [0.12, 0.14, 0.18, 1.0],
    metallicFactor: 0.65,
    roughnessFactor: 0.25,
  })
);

const rockGeo = createLatheMesh(10, 10, (t) => {
  const dome = Math.sin(t * Math.PI);
  return { rx: Math.max(0.02, dome * 0.48), ry: Math.max(0.02, dome * 0.36) };
});

fs.writeFileSync(
  path.join(envDir, 'lake_rock.glb'),
  buildBinaryGlb({
    name: 'ShorelineRock',
    ...rockGeo,
    baseColorFactor: [0.36, 0.38, 0.4, 1.0],
    metallicFactor: 0.05,
    roughnessFactor: 0.88,
  })
);

console.log('Generated PNG icons and GLB models successfully.');
