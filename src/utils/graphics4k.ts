// src/utils/graphics4k.ts
import * as THREE from 'three';
import { isMobileViewportOrTouch } from './glbValidator';

export type GraphicsQualityMode = 'smooth' | 'standard' | 'ultra4k';

export const GRAPHICS_4K_STORAGE_KEY = 'beam_farm_graphics_4k_enabled';
export const GRAPHICS_QUALITY_STORAGE_KEY = 'beam_farm_graphics_quality_mode';
export const GRAPHICS_4K_CHANGE_EVENT = 'beam-farm-4k-change';

const TARGET_4K_LONG_EDGE = 3840;
const TARGET_4K_SHORT_EDGE = 2160;

export function loadSavedGraphicsQualityMode(): GraphicsQualityMode {
  try {
    const m = localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY);
    if (m === 'smooth' || m === 'standard' || m === 'ultra4k') return m;
    if (localStorage.getItem(GRAPHICS_4K_STORAGE_KEY) === 'true') return 'ultra4k';
    if (localStorage.getItem(GRAPHICS_4K_STORAGE_KEY) === 'false') return isMobileViewportOrTouch() ? 'smooth' : 'standard';
  } catch { /* ignore */ }
  return isMobileViewportOrTouch() ? 'smooth' : 'standard';
}

export function saveGraphicsQualityMode(mode: GraphicsQualityMode): void {
  const ultraEnabled = mode === 'ultra4k';
  try {
    localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, mode);
    localStorage.setItem(GRAPHICS_4K_STORAGE_KEY, String(ultraEnabled));
  } catch { /* ignore */ }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<{ enabled: boolean; mode: GraphicsQualityMode }>(GRAPHICS_4K_CHANGE_EVENT, { detail: { enabled: ultraEnabled, mode } }));
  }
}

export function loadSavedUltra4kEnabled(): boolean { return loadSavedGraphicsQualityMode() === 'ultra4k'; }

export function saveUltra4kEnabled(enabled: boolean): void {
  saveGraphicsQualityMode(enabled ? 'ultra4k' : isMobileViewportOrTouch() ? 'smooth' : 'standard');
}

export interface ComputePixelRatioOptions {
  renderer: THREE.WebGLRenderer;
  cssWidth: number;
  cssHeight: number;
  ultra4k: boolean;
  qualityMode?: GraphicsQualityMode;
  isSoftwareGl: boolean;
  isMobileGpu?: boolean;
}

export function computeRendererPixelRatio({
  renderer, cssWidth, cssHeight, ultra4k, qualityMode, isSoftwareGl, isMobileGpu = false,
}: ComputePixelRatioOptions): number {
  if (isSoftwareGl) return 1;
  const mode: GraphicsQualityMode = qualityMode ?? (ultra4k ? 'ultra4k' : isMobileGpu ? 'smooth' : 'standard');
  const safeW = Math.max(1, cssWidth);
  const safeH = Math.max(1, cssHeight);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  if (mode === 'smooth') return isMobileGpu ? Math.max(0.8, Math.min(dpr, 0.95)) : Math.min(dpr, 1.0);
  if (mode === 'standard') return Math.min(dpr, isMobileGpu ? 1.15 : 1.65);

  const longEdge = Math.max(safeW, safeH);
  const shortEdge = Math.max(1, Math.min(safeW, safeH));
  const scaleFor4k = Math.min(TARGET_4K_LONG_EDGE / longEdge, TARGET_4K_SHORT_EDGE / shortEdge);
  const desiredRatio = Math.max(dpr, scaleFor4k);
  const maxSafeDpr = isMobileGpu ? 2.25 : 4.0;
  let hwMaxRatio = maxSafeDpr;
  try {
    const gl = renderer.getContext();
    const maxRb = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 4096;
    const maxVp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | number[] | null;
    const maxBufferW = Math.min(maxRb, maxVp?.[0] || maxRb);
    const maxBufferH = Math.min(maxRb, maxVp?.[1] || maxRb);
    hwMaxRatio = Math.min(maxBufferW / safeW, maxBufferH / safeH);
  } catch { /* ignore */ }
  return Math.max(1, Math.min(desiredRatio, maxSafeDpr, hwMaxRatio));
}

export interface ApplyUltra4kOptions {
  renderer: THREE.WebGLRenderer;
  scene?: THREE.Scene | null;
  sunLight?: THREE.DirectionalLight | null;
  cssWidth: number;
  cssHeight: number;
  ultra4k: boolean;
  qualityMode?: GraphicsQualityMode;
  isSoftwareGl: boolean;
  isMobileGpu?: boolean;
  updateStyle?: boolean;
}

interface Cache { appliedCssSize?: { w: number; h: number }; appliedAniso?: number }
const rendererCache = new WeakMap<THREE.WebGLRenderer, Cache>();
function getCache(r: THREE.WebGLRenderer): Cache {
  let c = rendererCache.get(r);
  if (!c) { c = {}; rendererCache.set(r, c); }
  return c;
}

/** ล้างแคชขนาดที่เคยตั้งไว้ — เรียกหลังเปลี่ยนขนาด renderer เองนอก applySceneUltra4kQuality (เช่น หุบเป็น 1x1 ตอนพัก)
 *  ไม่งั้นตอนกลับมา applySceneUltra4kQuality จะคิดว่าขนาดเดิมยังใช้อยู่แล้วข้าม setSize → จอว่าง */
export function invalidateRendererSizeCache(renderer: THREE.WebGLRenderer): void {
  getCache(renderer).appliedCssSize = undefined;
}

export function applySceneUltra4kQuality({
  renderer, scene, sunLight, cssWidth, cssHeight, ultra4k, qualityMode, isSoftwareGl, isMobileGpu = false, updateStyle = true,
}: ApplyUltra4kOptions): { widthPx: number; heightPx: number; pixelRatio: number } {
  const mode: GraphicsQualityMode = qualityMode ?? (ultra4k ? 'ultra4k' : loadSavedGraphicsQualityMode());
  const safeW = Math.max(1, Math.floor(cssWidth));
  const safeH = Math.max(1, Math.floor(cssHeight));
  const pixelRatio = computeRendererPixelRatio({
    renderer, cssWidth: safeW, cssHeight: safeH, ultra4k: mode === 'ultra4k', qualityMode: mode, isSoftwareGl, isMobileGpu,
  });

  if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
  const cache = getCache(renderer);
  if (!cache.appliedCssSize || cache.appliedCssSize.w !== safeW || cache.appliedCssSize.h !== safeH) {
    renderer.setSize(safeW, safeH, updateStyle);
    cache.appliedCssSize = { w: safeW, h: safeH };
  }

  const enableShadows = !isSoftwareGl && mode !== 'smooth';
  // ✅ เปลี่ยนเป็น PCFShadowMap เพื่อไม่ให้เกิด Warning
  const targetShadowType = THREE.PCFShadowMap;

  if (renderer.shadowMap.enabled !== enableShadows || renderer.shadowMap.type !== targetShadowType) {
    renderer.shadowMap.enabled = enableShadows;
    renderer.shadowMap.type = targetShadowType;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    if (scene) scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => { if (m) m.needsUpdate = true; });
    });
  }

  if (sunLight) {
    sunLight.castShadow = enableShadows;
    if (enableShadows) {
      const maxTex = renderer.capabilities.maxTextureSize || 4096;
      const dim = Math.min(maxTex, mode === 'ultra4k' ? (isMobileGpu ? 2048 : 4096) : (isMobileGpu ? 512 : 1024));
      if (sunLight.shadow.mapSize.width !== dim || sunLight.shadow.mapSize.height !== dim) {
        sunLight.shadow.mapSize.set(dim, dim);
        if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
      }
      sunLight.shadow.radius = mode === 'ultra4k' ? (isMobileGpu ? 2.5 : 4) : (isMobileGpu ? 1.5 : 2.5);
      sunLight.shadow.bias = -0.0001;
      sunLight.shadow.normalBias = 0.02;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  if (!isSoftwareGl && scene) {
    const maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
    const targetAniso = mode === 'ultra4k' ? maxAniso : mode === 'smooth' ? 1 : Math.min(2, maxAniso);
    if (cache.appliedAniso !== targetAniso) {
      cache.appliedAniso = targetAniso;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
          const std = m as THREE.MeshStandardMaterial;
          [std.map, std.normalMap, std.roughnessMap, std.metalnessMap, std.emissiveMap, std.aoMap].forEach((t) => {
            if (t && t.anisotropy !== targetAniso) t.anisotropy = targetAniso;
          });
        });
      });
    }
  }

  return { widthPx: Math.round(safeW * pixelRatio), heightPx: Math.round(safeH * pixelRatio), pixelRatio };
}

export function estimateRenderResolutionLabel(modeOrUltra4k: boolean | GraphicsQualityMode): string {
  const mode: GraphicsQualityMode = typeof modeOrUltra4k === 'boolean'
    ? (modeOrUltra4k ? 'ultra4k' : loadSavedGraphicsQualityMode() === 'smooth' ? 'smooth' : 'standard')
    : modeOrUltra4k;
  if (typeof window === 'undefined') return mode === 'ultra4k' ? '3840 × 2160 px (4K UHD)' : mode === 'smooth' ? 'Smooth 60 FPS' : 'Standard HD';
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight), dpr = window.devicePixelRatio || 1;
  const isMobile = isMobileViewportOrTouch();
  if (mode === 'smooth') { const r = isMobile ? Math.max(0.8, Math.min(dpr, 0.95)) : Math.min(dpr, 1.0); return `${Math.round(w * r)} × ${Math.round(h * r)} px (60 FPS)`; }
  if (mode === 'standard') { const r = Math.min(dpr, isMobile ? 1.15 : 1.65); return `${Math.round(w * r)} × ${Math.round(h * r)} px`; }
  const longEdge = Math.max(w, h), shortEdge = Math.max(1, Math.min(w, h));
  const scale4k = Math.min(TARGET_4K_LONG_EDGE / longEdge, TARGET_4K_SHORT_EDGE / shortEdge);
  const ratio = Math.min(isMobile ? 2.25 : 4.0, Math.max(dpr, scale4k));
  return `${Math.round(w * ratio)} × ${Math.round(h * ratio)} px`;
}