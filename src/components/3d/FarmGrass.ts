// src/components/3d/FarmGrass.ts
import * as THREE from 'three';
import { isTerrainBlocked } from '../../data/terrainFeatures';
import {
  disposeHierarchySafely,
  isMobileViewportOrTouch,
  loadValidatedGLTF,
} from '../../utils/glbValidator';
import { subscribeGlbDiscovery } from '../../utils/glbThumbnail';
import {
  type GraphicsQualityMode,
  loadSavedGraphicsQualityMode,
} from '../../utils/graphics4k';

import {
  GRID_CELL_SIZE,
  GRID_MAX_X,
  GRID_MAX_Z,
  GRID_MIN_X,
  GRID_MIN_Z,
} from '../../types/game';

const MAP_W = 104;
const MAP_D = 78;

const GRASS_GLB_CANDIDATES = ['/grass.glb', '/Grass.glb', '/models/grass.glb'];

export interface GrassOptions {
  bladeCount?: number;
  radius?: number;
  exclude?: (x: number, z: number) => boolean;
  proceduralRadius?: number;
  map2Unlocked?: boolean;
  qualityMode?: GraphicsQualityMode;
}

interface GrassInstancedLayer {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  ownsTextures: THREE.Texture[];
}

export class FarmGrass3D {
  public group = new THREE.Group();

  private layers: GrassInstancedLayer[] = [];
  private usingGlb = false;
  private isLoadingGlb = false;
  private isDisposed = false;
  private unsubscribeDiscovery: (() => void) | null = null;

  private glbTuftWidth = 1.0;
  private glbMaxCount = 12000;
  private glbSubGridPerCell = 2;
  private baseScatteredCount = 0;

  private uTime = { value: 0 };
  private uFocus = { value: new THREE.Vector2(0, 0) };
  private uMaxDistSq = { value: 999999.0 };
  private isMobileDevice: boolean;
  private qualityMode: GraphicsQualityMode;
  private opts: Required<Omit<GrassOptions, 'qualityMode'>>;
  private map2Unlocked: boolean;

  private mask: Uint8Array | null = null;
  private maskLoaded = false;
  private maskW = 0;
  private maskH = 0;

  private dummy = new THREE.Object3D();

  constructor(
    private ground: THREE.Mesh,
    renderer?: THREE.WebGLRenderer,
    options: GrassOptions = {}
  ) {
    this.group.name = 'FarmGrass';
    this.isMobileDevice = isMobileViewportOrTouch();
    this.qualityMode = options.qualityMode ?? loadSavedGraphicsQualityMode();
    this.map2Unlocked = Boolean(options.map2Unlocked);
    this.opts = {
      bladeCount: options.bladeCount ?? (this.isMobileDevice ? 2800 : 12000),
      radius: options.radius ?? 95,
      exclude: options.exclude ?? (() => false),
      proceduralRadius: options.proceduralRadius ?? 140,
      map2Unlocked: this.map2Unlocked,
    };

    this.syncDistanceUniforms();
    this.applyDetailLayer(renderer);
    this.buildProceduralTuftLayer();
    this.loadMask();
    this.ensureGrassGlbLoaded();

    this.unsubscribeDiscovery = subscribeGlbDiscovery((resolvedUrl) => {
      if (this.isDisposed || this.usingGlb) return;
      if (GRASS_GLB_CANDIDATES.includes(resolvedUrl)) {
        this.ensureGrassGlbLoaded(true);
      }
    });
  }

  private syncDistanceUniforms() {
    if (this.qualityMode === 'smooth') {
      const maxD = this.isMobileDevice ? 36 : 56;
      this.uMaxDistSq.value = maxD * maxD;
    } else if (this.qualityMode === 'standard' && this.isMobileDevice) {
      const maxD = 54;
      this.uMaxDistSq.value = maxD * maxD;
    } else {
      this.uMaxDistSq.value = 999999.0;
    }
  }

  private applyActiveInstanceBudget() {
    if (this.layers.length === 0) return;
    let cap = this.baseScatteredCount;
    if (this.qualityMode === 'smooth') {
      cap = Math.min(this.baseScatteredCount, this.isMobileDevice ? 1500 : 4200);
    } else if (this.qualityMode === 'standard' && this.isMobileDevice) {
      cap = Math.min(this.baseScatteredCount, 2800);
    }
    for (const layer of this.layers) {
      layer.mesh.count = cap;
    }
  }

  public setQualityMode(mode: GraphicsQualityMode) {
    if (this.qualityMode === mode) return;
    this.qualityMode = mode;
    this.syncDistanceUniforms();
    this.applyActiveInstanceBudget();
  }

  public setMap2Unlocked(unlocked: boolean) {
    if (this.map2Unlocked === unlocked) return;
    this.map2Unlocked = unlocked;
    this.scatterFullFarm();
  }

  private applyDetailLayer(_renderer?: THREE.WebGLRenderer) {
    const mat = this.ground.material as THREE.MeshStandardMaterial;
    const procRadius = this.opts.proceduralRadius;
    const outerColor =
      (this.ground.userData?.outerColor as THREE.Color | undefined) ??
      new THREE.Color(0x4c6f2a);
    const isMobile = this.isMobileDevice;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uOuterColor = { value: outerColor };
      if (isMobile) {
        // Mobile fast-path: keep terrain 100% opaque (Early-Z active) and feather 8m border RGB with zero per-pixel noise
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>\nuniform vec3 uOuterColor;`
          )
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            #ifdef USE_MAP
            {
              float edge = min(min(vMapUv.x, 1.0 - vMapUv.x) * 104.0, min(vMapUv.y, 1.0 - vMapUv.y) * 78.0);
              float edgeFade = smoothstep(0.0, 8.0, edge);
              diffuseColor.rgb = mix(uOuterColor, diffuseColor.rgb, edgeFade);
            }
            #endif`
          );
        return;
      }

      shader.uniforms.uProc = { value: new THREE.Vector2(procRadius, 18) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWPos;
          uniform vec2 uProc;
          uniform vec3 uOuterColor;
          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y);
          }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          #ifdef USE_MAP
          {
            float edge = min(min(vMapUv.x, 1.0 - vMapUv.x) * 104.0, min(vMapUv.y, 1.0 - vMapUv.y) * 78.0);
            float edgeFade = smoothstep(0.0, 8.0, edge);

            float gd = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
            float grassy = smoothstep(0.015, 0.06, gd);

            float d = length(vWPos.xz * vec2(1.0, 1.33));
            float proc = 1.0 - smoothstep(uProc.x, uProc.x + uProc.y, d);

            if (proc * grassy > 0.005) {
              vec2 p = vWPos.xz;
              float macro = vn(p * 0.07) * 0.65 + vn(p * 0.16) * 0.35;
              float pat = vn(p * 0.48 + 7.0);
              vec3 cDark  = vec3(0.050, 0.17, 0.022);
              vec3 cMid   = vec3(0.095, 0.27, 0.035);
              vec3 cLight = vec3(0.180, 0.37, 0.060);
              vec3 col = mix(cDark, cMid, smoothstep(0.25, 0.68, macro));
              col = mix(col, cLight, smoothstep(0.45, 0.85, pat) * 0.48);

              float st = sin(dot(p, vec2(0.9119, 0.4104)) * 1.9);
              col *= 1.0 + smoothstep(-0.25, 0.25, st) * 0.16 - 0.08;

              diffuseColor.rgb = mix(diffuseColor.rgb, col, proc * grassy);
            }
            diffuseColor.rgb = mix(uOuterColor, diffuseColor.rgb, edgeFade);
          }
          #endif`
        );
    };
    mat.needsUpdate = true;
  }

  private loadMask() {
    const img = new Image();
    img.onload = () => {
      if (this.isDisposed) return;
      const w = 520;
      const h = Math.max(1, Math.round((w * img.height) / img.width));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;

      // Step 1: Identify every road, curb, river, riverbank, bridge, and pond pixel
      const rawBlocked = new Uint8Array(w * h);
      for (let iy = 0; iy < h; iy++) {
        const v = (iy + 0.5) / h;
        for (let ix = 0; ix < w; ix++) {
          const u = (ix + 0.5) / w;
          const idx = iy * w + ix;
          const r = px[idx * 4];
          const g = px[idx * 4 + 1];
          const b = px[idx * 4 + 2];

          const isDistinctGrass = g > r + 9 && g > b + 24;

          // 1) River & Pond water (slate/sky blue or cyan-teal water pixels)
          const isWater =
            (b > r + 6 && b >= g - 14) ||
            (b > 100 && g > r && b > g - 6);

          // 2) Bottom-left River corridor (river water + muddy banks + stone bridge)
          const inRiverCorridor = u <= 0.52 && v >= 0.60;
          const isRiverBankOrBridge = inRiverCorridor && !isDistinctGrass;

          // 3) Top-left Pond shoreline & pebble ring
          const inPondCorridor = u <= 0.24 && v <= 0.30;
          const isPondShore = inPondCorridor && !isDistinctGrass;

          // 4) Diagonal Paved Road + Stone Curbs (top-center-left -> bottom-right)
          const maxCh = Math.max(r, g, b);
          const minCh = Math.min(r, g, b);
          const isAchromaticPavement = maxCh - minCh <= 22 && r >= 80 && r <= 192;
          const inRoadCorridor =
            (v < 0.20 && u >= 0.33 && u <= 0.52) ||
            (v >= 0.16 && v < 0.56 && u >= 0.40 && u <= 0.86) ||
            (v >= 0.48 && v <= 0.74 && u >= 0.70);
          const isRoadOrCurb =
            isAchromaticPavement || (inRoadCorridor && !isDistinctGrass);

          if (isWater || isRiverBankOrBridge || isPondShore || isRoadOrCurb) {
            rawBlocked[idx] = 1;
          }
        }
      }

      // Step 2: Dilate blocked road/river mask by ~0.6m (3px at 0.2m/px) so grass tufts never overhang onto roads or rivers
      const dilateRadius = 3;
      const m = new Uint8Array(w * h);
      for (let iy = 0; iy < h; iy++) {
        const y0 = Math.max(0, iy - dilateRadius);
        const y1 = Math.min(h - 1, iy + dilateRadius);
        for (let ix = 0; ix < w; ix++) {
          const x0 = Math.max(0, ix - dilateRadius);
          const x1 = Math.min(w - 1, ix + dilateRadius);
          let nearRoadOrWater = false;
          for (let ny = y0; ny <= y1 && !nearRoadOrWater; ny++) {
            const dy = ny - iy;
            for (let nx = x0; nx <= x1; nx++) {
              const dx = nx - ix;
              if (dx * dx + dy * dy <= dilateRadius * dilateRadius + 1) {
                if (rawBlocked[ny * w + nx] === 1) {
                  nearRoadOrWater = true;
                  break;
                }
              }
            }
          }
          m[iy * w + ix] = nearRoadOrWater ? 0 : 1;
        }
      }

      this.mask = m;
      this.maskW = w;
      this.maskH = h;
      this.maskLoaded = true;
      this.scatterFullFarm();
    };
    img.onerror = () => {
      if (this.isDisposed) return;
      this.maskLoaded = true;
      this.scatterFullFarm();
    };
    img.src = '/farm-map.jpg';
  }

  private clearLayers() {
    const disposedTex = new Set<THREE.Texture>();
    for (const layer of this.layers) {
      this.group.remove(layer.mesh);
      layer.geometry.dispose();
      for (const tex of layer.ownsTextures) {
        if (tex && !disposedTex.has(tex)) {
          disposedTex.add(tex);
          tex.dispose();
        }
      }
      layer.material.dispose();
    }
    this.layers = [];
  }

  private attachWindSwayShader(mat: THREE.Material, referenceHeight: number) {
    const safeH = Math.max(0.1, referenceHeight).toFixed(4);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uFocus = this.uFocus;
      shader.uniforms.uMaxDistSq = this.uMaxDistSq;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uTime;\nuniform vec2 uFocus;\nuniform float uMaxDistSq;\nvarying float vGrassH;\nvarying vec3 vGrassWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vGrassH = clamp(position.y / ${safeH}, 0.0, 1.0);
          #ifdef USE_INSTANCING
            vec4 gwp = instanceMatrix * vec4(transformed, 1.0);
          #else
            vec4 gwp = modelMatrix * vec4(transformed, 1.0);
          #endif
          vGrassWorldPos = gwp.xyz;
          vec2 dFocus = gwp.xz - uFocus;
          float gDistSq = dot(dFocus, dFocus);
          if (gDistSq > uMaxDistSq) {
            transformed = vec3(0.0);
          } else {
            float gFade = 1.0 - smoothstep(uMaxDistSq * 0.72, uMaxDistSq, gDistSq);
            transformed.y *= gFade;
            float gSway = sin(uTime * 1.55 + gwp.x * 0.35 + gwp.z * 0.25) * 0.42
                        + sin(uTime * 2.45 + gwp.x * 0.78) * 0.12;
            transformed.x += gSway * vGrassH * vGrassH * 0.16 * gFade;
            transformed.z += gSway * vGrassH * vGrassH * 0.07 * gFade;
          }`
        );
    };
  }

  /**
   * Builds a multi-blade crossed grass tuft fallback covering 100% of the farm
   * until `grass.glb` finishes loading (or if `grass.glb` is not yet placed in `/public`).
   */
  private buildProceduralTuftLayer() {
    this.clearLayers();
    this.usingGlb = false;

    const bladeCountPerTuft = this.isMobileDevice ? 4 : 6;
    const vertsPerBlade = 9;
    const positions = new Float32Array(bladeCountPerTuft * vertsPerBlade * 3);
    const w = 0.085;
    const h = 0.36;

    let ptr = 0;
    const pushVert = (vx: number, vy: number, vz: number) => {
      positions[ptr++] = vx;
      positions[ptr++] = vy;
      positions[ptr++] = vz;
    };

    for (let b = 0; b < bladeCountPerTuft; b++) {
      const ang = (b / bladeCountPerTuft) * Math.PI + (b % 2) * 0.28;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const lean = (b % 2 === 0 ? 1 : -1) * 0.055;
      const ox = Math.cos(b * 1.9) * 0.22;
      const oz = Math.sin(b * 1.9) * 0.22;
      const bh = h * (0.85 + (b % 3) * 0.1);

      const localPts: Array<[number, number, number]> = [
        [-w, 0, 0],
        [w, 0, 0],
        [-w * 0.62, bh * 0.52, lean * 0.45],
        [w, 0, 0],
        [w * 0.62, bh * 0.52, lean * 0.45],
        [-w * 0.62, bh * 0.52, lean * 0.45],
        [-w * 0.62, bh * 0.52, lean * 0.45],
        [w * 0.62, bh * 0.52, lean * 0.45],
        [0, bh, lean],
      ];

      for (const [lx, ly, lz] of localPts) {
        const rx = lx * cos - lz * sin + ox;
        const rz = lx * sin + lz * cos + oz;
        pushVert(rx, ly, rz);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uFocus = this.uFocus;
      shader.uniforms.uMaxDistSq = this.uMaxDistSq;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uTime;\nuniform vec2 uFocus;\nuniform float uMaxDistSq;\nvarying float vH;\nvarying vec3 vWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vH = clamp(position.y / 0.30, 0.0, 1.0);
          vec4 wp = instanceMatrix * vec4(transformed, 1.0);
          vWorldPos = wp.xyz;
          vec2 dFocus = wp.xz - uFocus;
          float pDistSq = dot(dFocus, dFocus);
          if (pDistSq > uMaxDistSq) {
            transformed = vec3(0.0);
          } else {
            float pFade = 1.0 - smoothstep(uMaxDistSq * 0.72, uMaxDistSq, pDistSq);
            transformed.y *= pFade;
            float sway = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.25) * 0.45
                       + sin(uTime * 2.5 + wp.x * 0.8) * 0.12;
            transformed.x += sway * vH * vH * 0.18 * pFade;
            transformed.z += sway * vH * vH * 0.07 * pFade;
          }`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying float vH;\nvarying vec3 vWorldPos;`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 baseCol = vec3(0.035, 0.088, 0.018);
          vec3 tipLight = vec3(0.19, 0.38, 0.068);
          vec3 tipDark  = vec3(0.11, 0.26, 0.042);
          float stripe = sin(dot(vWorldPos.xz, normalize(vec2(1.0, 0.45))) * 1.9);
          vec3 tipCol = mix(tipDark, tipLight, smoothstep(-0.35, 0.35, stripe));
          diffuseColor.rgb = mix(baseCol, tipCol, vH);`
        );
    };

    const instMesh = new THREE.InstancedMesh(geo, mat, this.opts.bladeCount);
    instMesh.frustumCulled = false;
    instMesh.receiveShadow = false;
    instMesh.castShadow = false;
    instMesh.count = 0;

    this.group.add(instMesh);
    this.layers.push({
      mesh: instMesh,
      geometry: geo,
      material: mat,
      ownsTextures: [],
    });
  }

  /**
   * Loads `/grass.glb` and converts all mesh primitives into wind-animated GPU InstancedMeshes
   * spanning 100% of the farm's grassy terrain.
   */
  private ensureGrassGlbLoaded(bypassCache = false) {
    if (this.isDisposed || this.usingGlb || this.isLoadingGlb) return;
    this.isLoadingGlb = true;

    void (async () => {
      for (const candidateUrl of GRASS_GLB_CANDIDATES) {
        if (this.isDisposed) break;
        try {
          const { gltf, inspection } = await loadValidatedGLTF(candidateUrl, {
            bypassCache,
          });
          if (!gltf?.scene || gltf.scene.children.length === 0) {
            if (gltf?.scene) disposeHierarchySafely(gltf.scene);
            continue;
          }

          const root = gltf.scene;
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root, true);
          if (box.isEmpty()) {
            disposeHierarchySafely(root);
            continue;
          }

          const rawSize = box.getSize(new THREE.Vector3());
          const rawCenter = box.getCenter(new THREE.Vector3());

          const isMobile = this.isMobileDevice;
          const tuftTris = Math.max(4, inspection.triangleCount);

          // On mobile use 1 full-cell patch per 2x2m grid cell (4x fewer instances & overdraw)
          const subGrid = isMobile ? 1 : tuftTris <= 220 ? 2 : 1;
          const targetSpan = subGrid === 2 ? 1.18 : 2.12;
          const targetH = subGrid === 2 ? 0.38 : 0.44;

          const rawHoriz = Math.max(rawSize.x, rawSize.z, 0.01);
          const scaleXZ = THREE.MathUtils.clamp(targetSpan / rawHoriz, 0.002, 80.0);
          const scaleY = THREE.MathUtils.clamp(targetH / Math.max(rawSize.y, 0.01), 0.002, 80.0);

          const normalizedHeight = Math.max(0.16, rawSize.y * scaleY);
          const normalizedWidth = Math.max(0.5, rawHoriz * scaleXZ);

          const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
          const shiftMat = new THREE.Matrix4().makeTranslation(
            -rawCenter.x,
            -box.min.y,
            -rawCenter.z
          );
          const scaleMat = new THREE.Matrix4().makeScale(scaleXZ, scaleY, scaleXZ);
          const normalizeTransform = new THREE.Matrix4().multiplyMatrices(
            scaleMat,
            shiftMat
          );

          const totalGridCellsEstimate = 2600;
          const desiredInstances = totalGridCellsEstimate * subGrid * subGrid;
          const triBudget = isMobile ? 68_000 : 420_000;
          const minInstances = isMobile ? 1400 : 2400;
          const maxCount = Math.max(
            minInstances,
            Math.min(
              desiredInstances,
              Math.max(minInstances, Math.floor(triBudget / tuftTris))
            )
          );

          const extractedParts: Array<{
            geometry: THREE.BufferGeometry;
            material: THREE.Material;
            textures: THREE.Texture[];
          }> = [];

          const partMatrix = new THREE.Matrix4();
          root.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;

            partMatrix.multiplyMatrices(rootInv, mesh.matrixWorld);
            partMatrix.premultiply(normalizeTransform);

            const bakedGeo = mesh.geometry.clone();
            bakedGeo.applyMatrix4(partMatrix);
            bakedGeo.computeVertexNormals();

            const rawMat = Array.isArray(mesh.material)
              ? mesh.material[0]
              : mesh.material;
            if (!rawMat) {
              bakedGeo.dispose();
              return;
            }

            const srcStd = rawMat as THREE.MeshStandardMaterial;
            const textures: THREE.Texture[] = [];
            let finalMat: THREE.Material;

            if (isMobile) {
              // Mobile GPU optimization: Lambert diffuse lighting avoids GGX PBR + envMap lookups per grass blade
              const lambert = new THREE.MeshLambertMaterial({
                color: srcStd.color ? srcStd.color.clone() : new THREE.Color(0xffffff),
                map: srcStd.map ?? null,
                alphaMap: srcStd.alphaMap ?? null,
                side: THREE.DoubleSide,
              });
              if (srcStd.transparent || srcStd.alphaMap || (srcStd.alphaTest ?? 0) > 0) {
                lambert.alphaTest = Math.max(srcStd.alphaTest || 0, 0.35);
                lambert.transparent = false;
                lambert.depthWrite = true;
              }
              for (const tex of [lambert.map, lambert.alphaMap]) {
                if (tex) {
                  tex.anisotropy = 1;
                  textures.push(tex);
                }
              }
              finalMat = lambert;
            } else {
              const clonedMat = srcStd.clone() as THREE.MeshStandardMaterial;
              clonedMat.side = THREE.DoubleSide;
              if (clonedMat.transparent || clonedMat.alphaMap) {
                clonedMat.alphaTest = Math.max(clonedMat.alphaTest || 0, 0.35);
                clonedMat.transparent = false;
                clonedMat.depthWrite = true;
              }
              const texCandidates = [
                clonedMat.map,
                clonedMat.alphaMap,
                clonedMat.normalMap,
                clonedMat.roughnessMap,
                clonedMat.metalnessMap,
                clonedMat.aoMap,
                clonedMat.emissiveMap,
              ];
              for (const tex of texCandidates) {
                if (tex) {
                  tex.anisotropy = 4;
                  textures.push(tex);
                }
              }
              finalMat = clonedMat;
            }

            this.attachWindSwayShader(finalMat, normalizedHeight);
            extractedParts.push({
              geometry: bakedGeo,
              material: finalMat,
              textures,
            });
          });

          // Dispose original GLTF geometries/materials while keeping textures alive for our InstancedMesh materials
          const keptTextures = new Set<THREE.Texture>();
          extractedParts.forEach((p) => p.textures.forEach((t) => keptTextures.add(t)));
          root.traverse((obj) => {
            const m = obj as THREE.Mesh;
            if (!m.isMesh) return;
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat) => mat?.dispose());
          });

          if (extractedParts.length === 0) {
            keptTextures.forEach((t) => t.dispose());
            continue;
          }

          if (this.isDisposed) {
            extractedParts.forEach((p) => {
              p.geometry.dispose();
              p.material.dispose();
            });
            keptTextures.forEach((t) => t.dispose());
            return;
          }

          this.clearLayers();
          this.usingGlb = true;
          this.glbTuftWidth = normalizedWidth;
          this.glbMaxCount = maxCount;
          this.glbSubGridPerCell = subGrid;

          for (const part of extractedParts) {
            const inst = new THREE.InstancedMesh(
              part.geometry,
              part.material,
              maxCount
            );
            inst.frustumCulled = false;
            inst.castShadow = false;
            inst.receiveShadow = !isMobile && tuftTris <= 120;
            inst.count = 0;
            this.group.add(inst);
            this.layers.push({
              mesh: inst,
              geometry: part.geometry,
              material: part.material,
              ownsTextures: part.textures,
            });
          }

          this.isLoadingGlb = false;
          if (this.maskLoaded) {
            this.scatterFullFarm();
          }
          return;
        } catch {
          // Candidate not available yet — try next or stay on full-farm procedural tufts
        }
      }
      this.isLoadingGlb = false;
    })();
  }

  private isOnAnalyticalRoadOrRiver(x: number, z: number): boolean {
    const distToSegSq = (
      px: number,
      pz: number,
      ax: number,
      az: number,
      bx: number,
      bz: number
    ): number => {
      const vx = bx - ax;
      const vz = bz - az;
      const lenSq = vx * vx + vz * vz;
      const t = lenSq > 1e-6 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq)) : 0;
      const dx = px - (ax + vx * t);
      const dz = pz - (az + vz * t);
      return dx * dx + dz * dz;
    };

    // Diagonal paved road + stone curbs from top-center-left to bottom-right
    const roadPts: readonly [number, number][] = [
      [-12.5, -39.0],
      [-5.2, -24.0],
      [11.5, -10.2],
      [26.5, 2.2],
      [52.0, 13.5],
    ];
    for (let i = 0; i < roadPts.length - 1; i++) {
      if (
        distToSegSq(x, z, roadPts[i][0], roadPts[i][1], roadPts[i + 1][0], roadPts[i + 1][1]) <=
        3.5 * 3.5
      ) {
        return true;
      }
    }

    // Bottom-left river + muddy banks + stone bridge
    const riverPts: readonly [number, number][] = [
      [-52.0, 13.2],
      [-31.0, 18.2],
      [-16.5, 28.0],
      [-4.0, 39.0],
    ];
    for (let i = 0; i < riverPts.length - 1; i++) {
      if (
        distToSegSq(
          x,
          z,
          riverPts[i][0],
          riverPts[i][1],
          riverPts[i + 1][0],
          riverPts[i + 1][1]
        ) <=
        4.6 * 4.6
      ) {
        return true;
      }
    }

    return false;
  }

  private isGrass(x: number, z: number): boolean {
    if (this.opts.exclude(x, z)) return false;

    // Exclude dirt connector road between Map 1 & Map 2 across both sides of the boundary
    if (this.map2Unlocked && x >= -53.5 && x <= -35.0 && z >= -6.8 && z <= -1.2) {
      return false;
    }

    // Map 2 (Golden Frontier, X: [-89, -49.5), Z: [-38, 38])
    if (x < -49.5) {
      if (!this.map2Unlocked) return false;
      if (x < -89.0 || Math.abs(z) > 38.0) return false;
      return true;
    }

    // Map 1 (Main Homestead Island, X: [-51, 51], Z: [-38, 38])
    if (Math.abs(x) > 51.0 || Math.abs(z) > 38.0) return false;
    if (isTerrainBlocked(x, z).blocked) return false;

    // Before farm-map.jpg pixel mask finishes loading, prevent grass from flashing on roads/rivers
    if (!this.mask) {
      return !this.isOnAnalyticalRoadOrRiver(x, z);
    }

    const u = x / MAP_W + 0.5;
    const v = z / MAP_D + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const ix = Math.min(this.maskW - 1, Math.floor(u * this.maskW));
    const iy = Math.min(this.maskH - 1, Math.floor(v * this.maskH));
    return this.mask[iy * this.maskW + ix] === 1;
  }

  private hash(ix: number, iz: number, k: number): number {
    let h = (ix * 374761393 + iz * 668265263 + k * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  /**
   * Populates every unobstructed 2x2m farm grid cell edge-to-edge with `grass.glb`
   * (plus surrounding meadow cells on Map 1 & Map 2) so no grid cell looks bare.
   */
  private scatterFullFarm() {
    if (this.layers.length === 0) return;

    const maxInstances = this.usingGlb ? this.glbMaxCount : this.opts.bladeCount;
    const sub = this.usingGlb ? this.glbSubGridPerCell : 2;
    const subStep = GRID_CELL_SIZE / sub;

    const minGx = this.map2Unlocked ? -44 : GRID_MIN_X;
    const maxGx = GRID_MAX_X;
    const minGz = GRID_MIN_Z;
    const maxGz = GRID_MAX_Z;

    const spots: Array<{ x: number; z: number; seedA: number; seedB: number }> = [];

    // 1. Primary pass: Fill every valid farm grid cell (gx, gz) systematically
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const cellCenterX = gx * GRID_CELL_SIZE;
        const cellCenterZ = gz * GRID_CELL_SIZE;

        for (let sz = 0; sz < sub; sz++) {
          for (let sx = 0; sx < sub; sx++) {
            const seedA = gx * 4 + sx;
            const seedB = gz * 4 + sz;
            const offsetX =
              sub === 1
                ? (this.hash(seedA, seedB, 1) - 0.5) * 0.14
                : (sx + 0.5 - sub * 0.5) * subStep +
                  (this.hash(seedA, seedB, 1) - 0.5) * (subStep * 0.28);
            const offsetZ =
              sub === 1
                ? (this.hash(seedA, seedB, 2) - 0.5) * 0.14
                : (sz + 0.5 - sub * 0.5) * subStep +
                  (this.hash(seedA, seedB, 2) - 0.5) * (subStep * 0.28);

            const wx = cellCenterX + offsetX;
            const wz = cellCenterZ + offsetZ;
            if (!this.isGrass(wx, wz)) continue;
            spots.push({ x: wx, z: wz, seedA, seedB });
          }
        }
      }
    }

    const totalSpots = spots.length;
    const count = Math.min(totalSpots, maxInstances);
    const step = totalSpots > maxInstances ? totalSpots / maxInstances : 1;

    for (let i = 0; i < count; i++) {
      const idx = totalSpots > maxInstances ? Math.floor(i * step) : i;
      const { x, z, seedA, seedB } = spots[idx];

      // If subsampling had to thin out instances, slightly widen horizontal scale so grid cells still stay full
      const densityCompensation = step > 1.15 ? Math.min(1.45, Math.sqrt(step)) : 1.0;
      const baseScale =
        (this.usingGlb
          ? 0.94 + this.hash(seedA, seedB, 3) * 0.22
          : 0.92 + this.hash(seedA, seedB, 3) * 0.28) * densityCompensation;
      const heightScale =
        (0.86 + this.hash(seedA, seedB, 6) * 0.32) * (this.usingGlb ? 1.0 : 1.05);
      const rotY =
        sub === 1
          ? Math.floor(this.hash(seedA, seedB, 4) * 4) * (Math.PI * 0.5) +
            (this.hash(seedA, seedB, 7) - 0.5) * 0.22
          : this.hash(seedA, seedB, 4) * Math.PI * 2;
      const tilt = (this.hash(seedA, seedB, 5) - 0.5) * 0.08;

      this.dummy.position.set(x, 0.008, z);
      this.dummy.rotation.set(tilt, rotY, -tilt * 0.8);
      this.dummy.scale.set(baseScale, heightScale, baseScale);
      this.dummy.updateMatrix();

      for (const layer of this.layers) {
        layer.mesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    this.baseScatteredCount = count;
    for (const layer of this.layers) {
      layer.mesh.instanceMatrix.needsUpdate = true;
    }
    this.applyActiveInstanceBudget();
  }

  public refresh() {
    if (this.maskLoaded) {
      this.scatterFullFarm();
    }
  }

  public update(elapsed: number, focus?: THREE.Vector3) {
    this.uTime.value = elapsed;
    if (focus) {
      this.uFocus.value.set(focus.x, focus.z);
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.unsubscribeDiscovery?.();
    this.unsubscribeDiscovery = null;
    this.clearLayers();
  }
}