// src/components/3d/FarmNightSky.ts
import * as THREE from 'three';
import type { TimeOfDay } from '../../types/game';
import { POND } from '../../data/terrainFeatures';
import { exponentialDamp } from '../../utils/calculus';

interface SkyPalette {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  milkyWay: number;
  starOpacity: number;
  moonOpacity: number;
  moonElevationDeg: number;
  moonTint: THREE.Color;
}

const SKY_PALETTES: Record<TimeOfDay, SkyPalette> = {
  morning: {
    zenith: new THREE.Color(0x7db9e8),
    mid: new THREE.Color(0xc5dff0),
    horizon: new THREE.Color(0xfdecd2),
    milkyWay: 0.0,
    starOpacity: 0.0,
    moonOpacity: 0.0,
    moonElevationDeg: 6.0,
    moonTint: new THREE.Color(0xfff6e5),
  },
  day: {
    zenith: new THREE.Color(0x4a90d9),
    mid: new THREE.Color(0x93c6e7),
    horizon: new THREE.Color(0xcfe2ec),
    milkyWay: 0.0,
    starOpacity: 0.0,
    moonOpacity: 0.0,
    moonElevationDeg: 5.0,
    moonTint: new THREE.Color(0xffffff),
  },
  sunset: {
    zenith: new THREE.Color(0x1b214d),
    mid: new THREE.Color(0x6d426d),
    horizon: new THREE.Color(0xec9f74),
    milkyWay: 0.14,
    starOpacity: 0.42,
    moonOpacity: 0.62,
    moonElevationDeg: 8.5,
    moonTint: new THREE.Color(0xffe7ba),
  },
  night: {
    zenith: new THREE.Color(0x030716),
    mid: new THREE.Color(0x0a1738),
    horizon: new THREE.Color(0x0c1222),
    milkyWay: 0.58,
    starOpacity: 1.0,
    moonOpacity: 1.0,
    moonElevationDeg: 11.2,
    moonTint: new THREE.Color(0xfff9ea),
  },
};

function createProceduralMoonTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base warm-silver lunar albedo
  const baseGrad = ctx.createRadialGradient(
    size * 0.44,
    size * 0.42,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.72
  );
  baseGrad.addColorStop(0, '#fffdf5');
  baseGrad.addColorStop(0.55, '#f6efd9');
  baseGrad.addColorStop(1, '#dfd5be');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Subtle Lunar Maria (dark basaltic plains: Sea of Tranquility, Imbrium, Serenitatis)
  const mariaPatches = [
    { x: 0.36, y: 0.38, rx: 0.14, ry: 0.11, rot: 0.3, alpha: 0.16 },
    { x: 0.54, y: 0.34, rx: 0.11, ry: 0.09, rot: -0.2, alpha: 0.14 },
    { x: 0.62, y: 0.48, rx: 0.13, ry: 0.1, rot: 0.4, alpha: 0.15 },
    { x: 0.45, y: 0.55, rx: 0.16, ry: 0.11, rot: -0.35, alpha: 0.13 },
    { x: 0.27, y: 0.52, rx: 0.1, ry: 0.13, rot: 0.15, alpha: 0.12 },
    { x: 0.72, y: 0.39, rx: 0.08, ry: 0.09, rot: 0.1, alpha: 0.11 },
  ];

  for (const m of mariaPatches) {
    ctx.save();
    ctx.translate(m.x * size, m.y * size);
    ctx.rotate(m.rot);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, m.rx * size);
    g.addColorStop(0, `rgba(116, 126, 148, ${m.alpha})`);
    g.addColorStop(0.65, `rgba(128, 138, 158, ${m.alpha * 0.65})`);
    g.addColorStop(1, 'rgba(128, 138, 158, 0)');
    ctx.fillStyle = g;
    ctx.scale(1, m.ry / m.rx);
    ctx.beginPath();
    ctx.arc(0, 0, m.rx * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Soft highland craters & bright rims (deterministic pseudo-random so it looks crisp every load)
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 65; i++) {
    const cx = rand() * size;
    const cy = 40 + rand() * (size - 80);
    const r = 3 + rand() * 16;

    // Bright rim
    ctx.beginPath();
    ctx.arc(cx - r * 0.12, cy - r * 0.12, r * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 253, 244, ${0.12 + rand() * 0.12})`;
    ctx.fill();

    // Soft crater bowl
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(142, 148, 164, ${0.07 + rand() * 0.09})`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createMoonGlowTexture(innerHex: string, midHex: string, hasRing: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, innerHex);
  grad.addColorStop(0.24, midHex);
  if (hasRing) {
    grad.addColorStop(0.52, 'rgba(165, 200, 255, 0.08)');
    grad.addColorStop(0.68, 'rgba(195, 220, 255, 0.13)');
    grad.addColorStop(0.82, 'rgba(150, 185, 255, 0.04)');
  } else {
    grad.addColorStop(0.58, 'rgba(255, 246, 218, 0.11)');
  }
  grad.addColorStop(1.0, 'rgba(120, 160, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createShootingStarTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, h * 0.5, w, h * 0.5);
  grad.addColorStop(0.0, 'rgba(180, 215, 255, 0.0)');
  grad.addColorStop(0.55, 'rgba(215, 235, 255, 0.35)');
  grad.addColorStop(0.88, 'rgba(255, 252, 235, 0.92)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.quadraticCurveTo(w * 0.85, h * 0.12, w, h * 0.5);
  ctx.quadraticCurveTo(w * 0.85, h * 0.88, 0, h * 0.5);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * FarmNightSky3D — ระบบท้องฟ้ายามเย็นและยามค่ำคืน (พระจันทร์ 3D + ดวงดาวระยิบระยับ + ทางช้างเผือก + ดาวตก + เงาจันทร์สะท้อนบ่อน้ำ)
 * ออกแบบให้กินสเปคต่ำสุดบนมือถือ (Zero-GC ใน Render Loop, คำนวณการกะพริบของดาวบน GPU 100%)
 */
export class FarmNightSky3D {
  /** กลุ่มท้องฟ้าที่เคลื่อนตามแกน X/Z ของกล้องเสมอ (ไม่มีวันเดินชนขอบฟ้า) */
  public readonly skyGroup: THREE.Group = new THREE.Group();
  /** กลุ่มเอฟเฟกต์ผูกพิกัดโลก เช่น เงาพระจันทร์และดาวสะท้อนผิวน้ำในสระ */
  public readonly worldGroup: THREE.Group = new THREE.Group();

  private readonly skyDomeMesh: THREE.Mesh;
  private readonly skyUniforms: {
    uZenithColor: { value: THREE.Color };
    uMidColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uMilkyWay: { value: number };
    uTime: { value: number };
  };

  private readonly starPoints: THREE.Points;
  private readonly starUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
    uPixelRatio: { value: number };
  };

  private readonly moonGroup: THREE.Group = new THREE.Group();
  private readonly moonSphere: THREE.Mesh;
  private readonly moonSphereMat: THREE.MeshBasicMaterial;
  private readonly innerCorona: THREE.Sprite;
  private readonly outerHalo: THREE.Sprite;
  private readonly moonbeamsGroup: THREE.Group = new THREE.Group();
  private readonly moonbeamMat: THREE.MeshBasicMaterial;

  private readonly shootingStarMesh: THREE.Mesh;
  private readonly shootingStarMat: THREE.MeshBasicMaterial;
  private shootingStarTimer = 3.5;
  private shootingStarActive = false;
  private shootingStarElapsed = 0;
  private shootingStarDuration = 0.85;
  private readonly shootingStarStart = new THREE.Vector3();
  private readonly shootingStarEnd = new THREE.Vector3();
  private readonly _shootDir = new THREE.Vector3();
  private readonly _shootQuat = new THREE.Quaternion();
  private readonly _unitX = new THREE.Vector3(1, 0, 0);

  private readonly pondReflectionMesh: THREE.Mesh;
  private readonly pondReflectionUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
  };

  private targetTimeOfDay: TimeOfDay = 'morning';
  private curZenith = new THREE.Color(SKY_PALETTES.morning.zenith);
  private curMid = new THREE.Color(SKY_PALETTES.morning.mid);
  private curHorizon = new THREE.Color(SKY_PALETTES.morning.horizon);
  private curMilkyWay = 0;
  private curStarOpacity = 0;
  private curMoonOpacity = 0;
  private curMoonElevationDeg = 6.0;
  private curMoonTint = new THREE.Color(0xfff9ea);

  private readonly ownedTextures: THREE.Texture[] = [];

  // ทิศทางมุมราบของพระจันทร์ (อยู่ฝั่งตะวันออกเฉียงเหนือ ตรงแนวสายตากล้องหลักพอดี)
  private readonly moonAzimuthRad = Math.PI * 0.245;
  private readonly skyRadius = 420;
  private readonly moonOrbitRadius = 335;

  constructor(initialTime: TimeOfDay = 'morning') {
    this.skyGroup.name = 'FarmNightSkyDomeGroup';
    this.worldGroup.name = 'FarmNightSkyWorldGroup';

    // ──────────────────────── 1. 360° Procedural Sky Dome + Milky Way ────────────────────────
    this.skyUniforms = {
      uZenithColor: { value: this.curZenith.clone() },
      uMidColor: { value: this.curMid.clone() },
      uHorizonColor: { value: this.curHorizon.clone() },
      uMilkyWay: { value: 0 },
      uTime: { value: 0 },
    };

    const domeGeo = new THREE.SphereGeometry(this.skyRadius, 40, 28);
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform float uMilkyWay;
        uniform float uTime;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);

          vec3 lowerMix = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.26, h));
          vec3 col = mix(lowerMix, uZenithColor, smoothstep(0.18, 0.88, h));

          // Soft Milky Way stardust band arching diagonally across the night sky
          if (uMilkyWay > 0.01 && h > 0.02) {
            float bandPlane = d.x * 0.58 + d.z * 0.52 - d.y * 0.36;
            float bandMask = exp(-bandPlane * bandPlane * 11.5) * smoothstep(0.02, 0.28, h);
            vec2 uv = vec2(atan(d.z, d.x) * 3.2, d.y * 5.0);
            float n1 = valueNoise(uv * 2.1 + vec2(uTime * 0.004, 0.0));
            float n2 = valueNoise(uv * 4.7 - vec2(0.0, uTime * 0.003));
            float nebula = (n1 * 0.65 + n2 * 0.35);
            vec3 milkyCol = mix(vec3(0.16, 0.24, 0.48), vec3(0.36, 0.30, 0.56), n2);
            col += milkyCol * bandMask * nebula * uMilkyWay * 0.52;
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.skyDomeMesh = new THREE.Mesh(domeGeo, domeMat);
    this.skyDomeMesh.renderOrder = -1000;
    this.skyDomeMesh.frustumCulled = false;
    this.skyGroup.add(this.skyDomeMesh);

    // ──────────────────────── 2. GPU Twinkling Starfield (1,320 Stars) ────────────────────────
    const starCount = 1320;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);
    const starSpeeds = new Float32Array(starCount);
    const starBrightness = new Float32Array(starCount);

    const stellarTints = [
      new THREE.Color(0xffffff), // Diamond white
      new THREE.Color(0xcde2ff), // Sapphire blue-white
      new THREE.Color(0xffe7ba), // Warm golden-ivory
      new THREE.Color(0xe6d9ff), // Soft lavender-white
      new THREE.Color(0xffd6cc), // Gentle rose-gold star
    ];

    let sSeed = 9187;
    const sRand = () => {
      sSeed = (sSeed * 16807) % 2147483647;
      return (sSeed - 1) / 2147483646;
    };

    const starRadius = 385;
    for (let i = 0; i < starCount; i++) {
      // Bias ~40% of stars into the scenic lower-to-mid sky band (elevation 2.5°..32°)
      // so horizon views are richly studded with sparkling stars & constellations
      let sinElev: number;
      if (i < starCount * 0.42) {
        sinElev = 0.042 + sRand() * 0.46;
      } else {
        sinElev = 0.05 + Math.pow(sRand(), 0.78) * 0.95;
      }
      const cosElev = Math.sqrt(Math.max(0.0001, 1 - sinElev * sinElev));
      const az = sRand() * Math.PI * 2;

      const sx = Math.sin(az) * cosElev * starRadius;
      const sy = sinElev * starRadius;
      const sz = -Math.cos(az) * cosElev * starRadius;

      starPositions[i * 3] = sx;
      starPositions[i * 3 + 1] = sy;
      starPositions[i * 3 + 2] = sz;

      const tint = stellarTints[Math.floor(sRand() * stellarTints.length)];
      starColors[i * 3] = tint.r;
      starColors[i * 3 + 1] = tint.g;
      starColors[i * 3 + 2] = tint.b;

      const isHeroStar = i < 55 || sRand() > 0.94;
      starBrightness[i] = isHeroStar ? 0.85 + sRand() * 0.15 : 0.35 + sRand() * 0.48;
      starSizes[i] = isHeroStar ? 5.2 + sRand() * 4.4 : 1.7 + sRand() * 2.7;
      starPhases[i] = sRand() * Math.PI * 2;
      starSpeeds[i] = 1.1 + sRand() * 3.4;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
    starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeeds, 1));
    starGeo.setAttribute('aBrightness', new THREE.BufferAttribute(starBrightness, 1));

    this.starUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
    };

    const starMat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        attribute float aSpeed;
        attribute float aBrightness;

        uniform float uTime;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vTwinkle;
        varying float vBright;
        varying float vHorizonFade;

        void main() {
          vColor = aColor;
          vBright = aBrightness;
          float wave1 = sin(uTime * aSpeed + aPhase);
          float wave2 = cos(uTime * (aSpeed * 0.63) + aPhase * 1.7);
          vTwinkle = 0.58 + 0.42 * (wave1 * 0.7 + wave2 * 0.3);

          float elev = clamp(normalize(position).y, 0.0, 1.0);
          vHorizonFade = smoothstep(0.015, 0.12, elev);

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = aSize * uPixelRatio * (0.82 + 0.28 * vTwinkle);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vBright;
        varying float vHorizonFade;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          if (dist > 0.5) discard;

          // Soft circular star core
          float core = exp(-dist * dist * 26.0);

          // 4-point diffraction sparkle on bright hero stars
          float crossSpike = 0.0;
          if (vBright > 0.78) {
            float sx = exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 5.0);
            float sy = exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 5.0);
            crossSpike = (sx + sy) * 0.55;
          }

          float alpha = clamp((core + crossSpike) * vTwinkle * vBright * vHorizonFade * uOpacity, 0.0, 1.0);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });

    this.starPoints = new THREE.Points(starGeo, starMat);
    this.starPoints.renderOrder = -995;
    this.starPoints.frustumCulled = false;
    this.skyGroup.add(this.starPoints);

    // ──────────────────────── 3. Composite 3D Moon Rig (4 Parts) ────────────────────────
    const moonTex = createProceduralMoonTexture();
    const coronaTex = createMoonGlowTexture(
      'rgba(255, 252, 232, 0.92)',
      'rgba(255, 240, 198, 0.36)',
      false
    );
    const haloTex = createMoonGlowTexture(
      'rgba(235, 244, 255, 0.42)',
      'rgba(170, 204, 255, 0.18)',
      true
    );
    const shootTex = createShootingStarTexture();
    this.ownedTextures.push(moonTex, coronaTex, haloTex, shootTex);

    // Part 3a: 3D Lunar Globe with Maria & Craters
    const moonGeo = new THREE.SphereGeometry(14.5, 36, 36);
    this.moonSphereMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      color: 0xfff9ea,
      transparent: true,
      opacity: 0,
      fog: false,
      toneMapped: false,
    });
    this.moonSphere = new THREE.Mesh(moonGeo, this.moonSphereMat);
    this.moonSphere.rotation.y = -0.55;
    this.moonSphere.renderOrder = -990;
    this.moonGroup.add(this.moonSphere);

    // Part 3b: Inner Pearlescent Corona
    const coronaMat = new THREE.SpriteMaterial({
      map: coronaTex,
      color: 0xfff5d6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.innerCorona = new THREE.Sprite(coronaMat);
    this.innerCorona.scale.set(52, 52, 1);
    this.innerCorona.renderOrder = -991;
    this.moonGroup.add(this.innerCorona);

    // Part 3c: Wide Atmospheric Lunar Halo
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: 0xdbeafe,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.outerHalo = new THREE.Sprite(haloMat);
    this.outerHalo.scale.set(118, 118, 1);
    this.outerHalo.renderOrder = -992;
    this.moonGroup.add(this.outerHalo);

    // Part 3d: Delicate Slanting Moonbeams
    this.moonbeamMat = new THREE.MeshBasicMaterial({
      color: 0xcfe2ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const beamOffsets = [
      { dx: -8, dy: -26, rTop: 2.6, rBot: 9.5, len: 56, rotZ: -0.24 },
      { dx: 4, dy: -28, rTop: 3.2, rBot: 11.5, len: 62, rotZ: -0.18 },
      { dx: 15, dy: -25, rTop: 2.2, rBot: 8.2, len: 52, rotZ: -0.12 },
    ];
    for (const b of beamOffsets) {
      const bGeo = new THREE.CylinderGeometry(b.rTop, b.rBot, b.len, 10, 1, true);
      const bMesh = new THREE.Mesh(bGeo, this.moonbeamMat);
      bMesh.position.set(b.dx, b.dy, 0);
      bMesh.rotation.z = b.rotZ;
      bMesh.renderOrder = -993;
      this.moonbeamsGroup.add(bMesh);
    }
    this.moonGroup.add(this.moonbeamsGroup);
    this.moonGroup.frustumCulled = false;
    this.skyGroup.add(this.moonGroup);

    // ──────────────────────── 4. Shooting Star (ดาวตกยามค่ำ) ────────────────────────
    const shootGeo = new THREE.PlaneGeometry(26, 1.35);
    this.shootingStarMat = new THREE.MeshBasicMaterial({
      map: shootTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.shootingStarMesh = new THREE.Mesh(shootGeo, this.shootingStarMat);
    this.shootingStarMesh.visible = false;
    this.shootingStarMesh.renderOrder = -989;
    this.shootingStarMesh.frustumCulled = false;
    this.skyGroup.add(this.shootingStarMesh);

    // ──────────────────────── 5. Pond Moon & Starlight Shimmer Reflection ────────────────────────
    this.pondReflectionUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    const pondReflGeo = new THREE.CircleGeometry(POND.radius * 0.94, 32);
    pondReflGeo.rotateX(-Math.PI / 2);
    const pondReflMat = new THREE.ShaderMaterial({
      uniforms: this.pondReflectionUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          float r = length(vUv);
          if (r > 1.0) discard;
          float edgeFade = smoothstep(1.0, 0.62, r);

          // Rippling lunar reflection disc in the pond
          float rippleX = sin(vUv.y * 26.0 + uTime * 2.4) * 0.032 + cos(vUv.y * 14.0 - uTime * 1.7) * 0.018;
          vec2 moonCenter = vec2(0.22 + rippleX, -0.18);
          float moonDist = length((vUv - moonCenter) * vec2(1.0, 1.25));
          float moonDisc = smoothstep(0.22, 0.12, moonDist);
          float moonGlow = exp(-moonDist * moonDist * 14.0) * 0.55;

          // Reflected twinkling stars on water surface
          vec2 cell = floor((vUv + vec2(rippleX * 0.35, 0.0)) * 9.0);
          vec2 local = fract((vUv + vec2(rippleX * 0.35, 0.0)) * 9.0) - 0.5;
          float h = hash(cell);
          float starSpark = 0.0;
          if (h > 0.72) {
            float tw = 0.5 + 0.5 * sin(uTime * (2.0 + h * 3.0) + h * 25.0);
            starSpark = exp(-dot(local, local) * 38.0) * tw * 0.85;
          }

          vec3 col = mix(vec3(0.58, 0.76, 1.0), vec3(1.0, 0.97, 0.86), clamp(moonDisc + moonGlow, 0.0, 1.0));
          float alpha = clamp((moonDisc * 0.78 + moonGlow + starSpark) * edgeFade * uOpacity, 0.0, 0.88);
          if (alpha < 0.01) discard;

          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.pondReflectionMesh = new THREE.Mesh(pondReflGeo, pondReflMat);
    this.pondReflectionMesh.position.set(POND.x, 0.042, POND.z);
    this.pondReflectionMesh.visible = false;
    this.worldGroup.add(this.pondReflectionMesh);

    this.setTimeOfDay(initialTime, true);
  }

  public setTimeOfDay(timeOfDay: TimeOfDay, immediate = false): void {
    this.targetTimeOfDay = timeOfDay;
    if (immediate) {
      const p = SKY_PALETTES[timeOfDay];
      this.curZenith.copy(p.zenith);
      this.curMid.copy(p.mid);
      this.curHorizon.copy(p.horizon);
      this.curMilkyWay = p.milkyWay;
      this.curStarOpacity = p.starOpacity;
      this.curMoonOpacity = p.moonOpacity;
      this.curMoonElevationDeg = p.moonElevationDeg;
      this.curMoonTint.copy(p.moonTint);
      this.syncVisualUniforms(0);
    }
  }

  private updateMoonTransform(): void {
    const elevRad = THREE.MathUtils.degToRad(this.curMoonElevationDeg);
    const cosE = Math.cos(elevRad);
    const sinE = Math.sin(elevRad);
    const mx = Math.sin(this.moonAzimuthRad) * cosE * this.moonOrbitRadius;
    const my = sinE * this.moonOrbitRadius;
    const mz = -Math.cos(this.moonAzimuthRad) * cosE * this.moonOrbitRadius;
    this.moonGroup.position.set(mx, my, mz);
    this.moonSphere.lookAt(0, 0, 0);
  }

  private syncVisualUniforms(elapsed: number): void {
    this.skyUniforms.uZenithColor.value.copy(this.curZenith);
    this.skyUniforms.uMidColor.value.copy(this.curMid);
    this.skyUniforms.uHorizonColor.value.copy(this.curHorizon);
    this.skyUniforms.uMilkyWay.value = this.curMilkyWay;
    this.skyUniforms.uTime.value = elapsed;

    const showStars = this.curStarOpacity > 0.008;
    this.starPoints.visible = showStars;
    if (showStars) {
      this.starUniforms.uTime.value = elapsed;
      this.starUniforms.uOpacity.value = this.curStarOpacity;
    }

    const showMoon = this.curMoonOpacity > 0.008;
    this.moonGroup.visible = showMoon;
    if (showMoon) {
      this.updateMoonTransform();
      const pulse = 1 + Math.sin(elapsed * 1.1) * 0.035;
      this.moonSphereMat.color.copy(this.curMoonTint);
      this.moonSphereMat.opacity = this.curMoonOpacity;
      (this.innerCorona.material as THREE.SpriteMaterial).opacity =
        this.curMoonOpacity * 0.72 * pulse;
      (this.outerHalo.material as THREE.SpriteMaterial).opacity =
        this.curMoonOpacity * 0.48 * pulse;
      this.innerCorona.scale.setScalar(52 * pulse);
      this.outerHalo.scale.setScalar(118 * (0.98 + pulse * 0.02));
      this.moonbeamMat.opacity =
        this.targetTimeOfDay === 'night'
          ? this.curMoonOpacity * (0.065 + Math.sin(elapsed * 0.9) * 0.015)
          : 0;
      this.moonbeamsGroup.visible = this.moonbeamMat.opacity > 0.005;
    }

    const pondAlpha = Math.max(this.curMoonOpacity * 0.85, this.curStarOpacity * 0.7);
    this.pondReflectionMesh.visible = pondAlpha > 0.01;
    if (this.pondReflectionMesh.visible) {
      this.pondReflectionUniforms.uTime.value = elapsed;
      this.pondReflectionUniforms.uOpacity.value = pondAlpha;
    }
  }

  private spawnShootingStar(): void {
    const azStart = this.moonAzimuthRad + (Math.random() - 0.5) * 1.35;
    const elevStart = THREE.MathUtils.degToRad(14 + Math.random() * 20);
    const r = 345;

    this.shootingStarStart.set(
      Math.sin(azStart) * Math.cos(elevStart) * r,
      Math.sin(elevStart) * r,
      -Math.cos(azStart) * Math.cos(elevStart) * r
    );

    const azEnd = azStart + (Math.random() > 0.5 ? 0.34 : -0.34);
    const elevEnd = Math.max(THREE.MathUtils.degToRad(5.5), elevStart - THREE.MathUtils.degToRad(9 + Math.random() * 6));
    this.shootingStarEnd.set(
      Math.sin(azEnd) * Math.cos(elevEnd) * r,
      Math.sin(elevEnd) * r,
      -Math.cos(azEnd) * Math.cos(elevEnd) * r
    );

    this.shootingStarDuration = 0.7 + Math.random() * 0.35;
    this.shootingStarElapsed = 0;
    this.shootingStarActive = true;
    this.shootingStarMesh.visible = true;
  }

  public update(
    delta: number,
    elapsed: number,
    camera: THREE.Camera,
    pixelRatio = 1
  ): void {
    const dt = Math.min(0.1, Math.max(0.001, delta));

    // Keep sky dome & celestial bodies centered on camera X/Z so horizon stays at infinity
    this.skyGroup.position.set(camera.position.x, 0, camera.position.z);
    this.starUniforms.uPixelRatio.value = Math.min(2.5, Math.max(1, pixelRatio));

    const target = SKY_PALETTES[this.targetTimeOfDay];
    const rate = 2.8;
    const blend = 1 - Math.exp(-rate * dt);

    this.curZenith.lerp(target.zenith, blend);
    this.curMid.lerp(target.mid, blend);
    this.curHorizon.lerp(target.horizon, blend);
    this.curMoonTint.lerp(target.moonTint, blend);
    this.curMilkyWay = exponentialDamp(this.curMilkyWay, target.milkyWay, rate, dt);
    this.curStarOpacity = exponentialDamp(this.curStarOpacity, target.starOpacity, rate, dt);
    this.curMoonOpacity = exponentialDamp(this.curMoonOpacity, target.moonOpacity, rate, dt);
    this.curMoonElevationDeg = exponentialDamp(
      this.curMoonElevationDeg,
      target.moonElevationDeg,
      rate,
      dt
    );

    this.syncVisualUniforms(elapsed);

    // Periodic shooting stars at night
    if (this.curStarOpacity > 0.75) {
      if (!this.shootingStarActive) {
        this.shootingStarTimer -= dt;
        if (this.shootingStarTimer <= 0) {
          this.spawnShootingStar();
          this.shootingStarTimer = 6.5 + Math.random() * 6.0;
        }
      } else {
        this.shootingStarElapsed += dt;
        const t = this.shootingStarElapsed / this.shootingStarDuration;
        if (t >= 1) {
          this.shootingStarActive = false;
          this.shootingStarMesh.visible = false;
        } else {
          this.shootingStarMesh.position.lerpVectors(
            this.shootingStarStart,
            this.shootingStarEnd,
            t
          );
          this._shootDir.subVectors(this.shootingStarEnd, this.shootingStarStart).normalize();
          this._shootQuat.setFromUnitVectors(this._unitX, this._shootDir);
          this.shootingStarMesh.quaternion.copy(this._shootQuat);
          // Face camera along streak axis by gently billboard-tilting
          const envAlpha = Math.sin(t * Math.PI);
          this.shootingStarMat.opacity = envAlpha * this.curStarOpacity * 0.95;
        }
      }
    } else if (this.shootingStarActive) {
      this.shootingStarActive = false;
      this.shootingStarMesh.visible = false;
    }
  }

  public dispose(): void {
    const disposeGroup = (grp: THREE.Group) => {
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        } else if (obj instanceof THREE.Sprite) {
          obj.material?.dispose();
        }
      });
    };

    disposeGroup(this.skyGroup);
    disposeGroup(this.worldGroup);
    for (const tex of this.ownedTextures) {
      tex.dispose();
    }
    this.ownedTextures.length = 0;
  }
}
