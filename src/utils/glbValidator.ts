// src/utils/glbValidator.ts
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from './glbLoaderSetup';

export interface GLBInspectionResult {
  valid: boolean;
  reason?: string;
  version?: number;
  byteLength: number;
  meshCount: number;
  triangleCount: number;
  imageCount: number;
  animationCount: number;
  extensionsUsed: string[];
  extensionsRequired: string[];
}

const GLB_MAGIC = 0x46546c67; // 'glTF' in little-endian ASCII
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a; // 'JSON' in little-endian ASCII

/**
 * Extensions natively handled by standard Three.js GLTFLoader without external WASM decoders.
 */
const SUPPORTED_REQUIRED_EXTENSIONS = new Set<string>([
  'KHR_materials_unlit',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_clearcoat',
  'KHR_materials_sheen',
  'KHR_materials_iridescence',
  'KHR_materials_anisotropy',
  'KHR_materials_dispersion',
  'KHR_texture_transform',
  'KHR_mesh_quantization',
  'KHR_lights_punctual',
  'EXT_meshopt_compression',
  ]);

/**
 * Extensions that require a WASM decoder registered on the GLTFLoader instance
 * (setMeshoptDecoder / setDRACOLoader / setKTX2Loader). If a GLB uses any of these,
 * the loader will throw at parse() time unless the decoder was registered.
 */
const COMPRESSION_EXTENSIONS = new Set<string>([
  'EXT_meshopt_compression',
  'KHR_draco_mesh_compression',
  'KHR_texture_basisu',
  'EXT_texture_webp',
  'EXT_texture_avif',
]);

/**
 * Returns which compression extensions a validated GLB uses (used / required).
 * Empty array = no decoder needed.
 */
export function detectCompressionExtensions(inspection: GLBInspectionResult): string[] {
  return Array.from(
    new Set([...inspection.extensionsUsed, ...inspection.extensionsRequired])
  ).filter((e) => COMPRESSION_EXTENSIONS.has(e));
}

/**
 * Pre-flight binary inspection of a .glb ArrayBuffer BEFORE passing to Three.js GLTFLoader.
 * Prevents 0-byte files, HTML 404 fallbacks, corrupt headers, or unsupported required extensions
 * from throwing runtime parser crashes or leaking GPU buffers.
 */
export function inspectGLBBuffer(buffer: ArrayBuffer): GLBInspectionResult {
  const byteLength = buffer.byteLength;
  if (byteLength < 20) {
    return {
      valid: false,
      reason: `GLB file too small (${byteLength} bytes)`,
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    return {
      valid: false,
      reason: 'Invalid GLB magic header (not a binary glTF file)',
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  const version = view.getUint32(4, true);
  const declaredLength = view.getUint32(8, true);
  if (version !== 2) {
    return {
      valid: false,
      reason: `Unsupported glTF binary version: ${version} (expected 2)`,
      version,
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  if (declaredLength > byteLength) {
    return {
      valid: false,
      reason: `Truncated GLB buffer (declared ${declaredLength} bytes, got ${byteLength})`,
      version,
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== GLB_JSON_CHUNK_TYPE || 20 + jsonChunkLength > byteLength) {
    return {
      valid: false,
      reason: 'Malformed GLB JSON chunk header',
      version,
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  let gltfJson: {
    meshes?: Array<{ primitives?: Array<{ indices?: number; attributes?: Record<string, number> }> }>;
    accessors?: Array<{ count?: number }>;
    images?: unknown[];
    animations?: unknown[];
    extensionsUsed?: string[];
    extensionsRequired?: string[];
  };

  try {
    const jsonBytes = new Uint8Array(buffer, 20, jsonChunkLength);
    const jsonText = new TextDecoder('utf-8').decode(jsonBytes);
    gltfJson = JSON.parse(jsonText);
  } catch {
    return {
      valid: false,
      reason: 'Corrupt JSON chunk inside GLB',
      version,
      byteLength,
      meshCount: 0,
      triangleCount: 0,
      imageCount: 0,
      animationCount: 0,
      extensionsUsed: [],
      extensionsRequired: [],
    };
  }

  const extensionsUsed = Array.isArray(gltfJson.extensionsUsed) ? gltfJson.extensionsUsed : [];
  const extensionsRequired = Array.isArray(gltfJson.extensionsRequired)
    ? gltfJson.extensionsRequired
    : [];

  const unsupportedReq = extensionsRequired.filter((ext) => !SUPPORTED_REQUIRED_EXTENSIONS.has(ext));
  if (unsupportedReq.length > 0) {
    return {
      valid: false,
      reason: `Unsupported required glTF extension(s): ${unsupportedReq.join(', ')}`,
      version,
      byteLength,
      meshCount: gltfJson.meshes?.length ?? 0,
      triangleCount: 0,
      imageCount: gltfJson.images?.length ?? 0,
      animationCount: gltfJson.animations?.length ?? 0,
      extensionsUsed,
      extensionsRequired,
    };
  }

  let triangleCount = 0;
  const accessors = gltfJson.accessors ?? [];
  for (const mesh of gltfJson.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if (typeof prim.indices === 'number' && accessors[prim.indices]?.count) {
        triangleCount += Math.floor((accessors[prim.indices].count ?? 0) / 3);
      } else if (
        prim.attributes &&
        typeof prim.attributes.POSITION === 'number' &&
        accessors[prim.attributes.POSITION]?.count
      ) {
        triangleCount += Math.floor((accessors[prim.attributes.POSITION].count ?? 0) / 3);
      }
    }
  }

  return {
    valid: true,
    version,
    byteLength,
    meshCount: gltfJson.meshes?.length ?? 0,
    triangleCount,
    imageCount: gltfJson.images?.length ?? 0,
    animationCount: gltfJson.animations?.length ?? 0,
    extensionsUsed,
    extensionsRequired,
  };
}

export function isMobileViewportOrTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth <= 900 ||
    window.matchMedia?.('(pointer: coarse)').matches === true ||
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
  );
}

/**
 * Optimizes a parsed GLTF scene for GPU memory & mobile frame rate.
 */
export function optimizeGLTFSceneForDevice(
  root: THREE.Object3D,
  inspection: GLBInspectionResult,
  forceDisableShadows = false
): void {
  const isMobile = isMobileViewportOrTouch();
  const shadowTriLimit = isMobile ? 4500 : 38000;
  const allowShadows = !forceDisableShadows && inspection.triangleCount <= shadowTriLimit;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = allowShadows;
    mesh.receiveShadow = !isMobile && allowShadows;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if (std.map) {
        std.map.anisotropy = isMobile ? 1 : 4;
      }
      if (isMobile) {
        std.envMapIntensity = Math.min(std.envMapIntensity ?? 1, 0.75);
        if (typeof std.metalness === 'number' && std.metalness > 0.38) {
          std.metalness = 0.38;
        }
      }
    }
  });
}

export interface LoadValidatedGLTFOptions {
  bypassCache?: boolean;
}

const _inFlightBuffers = new Map<
  string,
  Promise<{ buffer: ArrayBuffer; inspection: GLBInspectionResult }>
>();
let _sharedLoader: GLTFLoader | null = null;

function getSharedGLTFLoader(): GLTFLoader {
  if (!_sharedLoader) {
    _sharedLoader = createGLTFLoader();
  }
  return _sharedLoader;
}

async function evictInvalidGlbCacheEntry(url: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await window.caches.open(name);
        await cache.delete(url);
        await cache.delete(encodeURI(url));
      })
    );
  } catch {
    // Ignore Cache Storage access errors
  }
}

function fetchValidatedGLBBuffer(
  url: string,
  bypassCache = false
): Promise<{ buffer: ArrayBuffer; inspection: GLBInspectionResult }> {
  const key = bypassCache ? `nocache:${url}` : url;
  const existing = _inFlightBuffers.get(key);
  if (existing) return existing;

  const task = (async () => {
    const fetchUrl = encodeURI(url);
    const response = await fetch(
      fetchUrl,
      bypassCache ? { cache: 'no-cache' } : undefined
    );
    if (!response.ok) {
      console.error(`[GLB] ✗ HTTP ${response.status} for ${url}`);
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      console.error(`[GLB] ✗ HTML fallback (file missing) for ${url}`);
      void evictInvalidGlbCacheEntry(url);
      throw new Error(`GLB file not found (SPA HTML fallback) for ${url}`);
    }

    const buffer = await response.arrayBuffer();
    const inspection = inspectGLBBuffer(buffer);

    if (!inspection.valid) {
      console.error(`[GLB] ✗ INVALID ${url}:`, {
        reason: inspection.reason,
        byteLength: inspection.byteLength,
        extensionsUsed: inspection.extensionsUsed,
        extensionsRequired: inspection.extensionsRequired,
      });
      void evictInvalidGlbCacheEntry(url);
      throw new Error(`GLB validation failed for ${url}: ${inspection.reason}`);
    }

    const comp = detectCompressionExtensions(inspection);
    console.info(`[GLB] ✓ valid ${url}`, {
      kb: (inspection.byteLength / 1024).toFixed(1),
      meshes: inspection.meshCount,
      tris: inspection.triangleCount,
      imgs: inspection.imageCount,
      anims: inspection.animationCount,
      extensionsUsed: inspection.extensionsUsed,
      extensionsRequired: inspection.extensionsRequired,
      ...(comp.length > 0
        ? { compressionRequiresDecoder: comp }
        : {}),
    });
    if (comp.length > 0) {
      console.warn(
        `[GLB] ⚠ ${url} uses compression [${comp.join(', ')}] — ` +
        `ensure the matching decoder is registered in glbLoaderSetup.ts`
      );
    }

    return { buffer, inspection };
  })().finally(() => {
    _inFlightBuffers.delete(key);
  });

  _inFlightBuffers.set(key, task);
  return task;
}

/**
 * Fetches, pre-validates binary GLB structure, deduplicates concurrent network downloads,
 * and parses an isolated Three.js GLTF scene per caller.
 */
export async function loadValidatedGLTF(
  url: string,
  options?: LoadValidatedGLTFOptions
): Promise<{ gltf: GLTF; inspection: GLBInspectionResult }> {
  const { buffer, inspection } = await fetchValidatedGLBBuffer(
    url,
    Boolean(options?.bypassCache)
  );

  const resourcePath = url.substring(0, url.lastIndexOf('/') + 1) || '/';
  const loader = getSharedGLTFLoader();

  const gltf = await new Promise<GLTF>((resolve, reject) => {
    try {
      loader.parse(buffer.slice(0), resourcePath, resolve, reject);
    } catch (parseErr) {
      console.error(`[GLB] ✗ parse() threw synchronously for ${url}`, parseErr);
      reject(parseErr);
    }
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);

    if (/setMeshoptDecoder|meshopt/i.test(msg)) {
      console.error(
        `[GLB] ✗ ${url} uses EXT_meshopt_compression but GLTFLoader has no MeshoptDecoder.\n` +
        `  → fix: in src/utils/glbLoaderSetup.ts add:\n` +
        `     import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';\n` +
        `     loader.setMeshoptDecoder(MeshoptDecoder);`
      );
    } else if (/DRACOLoader|draco/i.test(msg)) {
      console.error(
        `[GLB] ✗ ${url} uses KHR_draco_mesh_compression but GLTFLoader has no DRACOLoader.\n` +
        `  → fix: in src/utils/glbLoaderSetup.ts add:\n` +
        `     import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';\n` +
        `     const draco = new DRACOLoader();\n` +
        `     draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');\n` +
        `     loader.setDRACOLoader(draco);`
      );
    } else if (/KTX2Loader|ktx2|basisu/i.test(msg)) {
      console.error(
        `[GLB] ✗ ${url} uses KHR_texture_basisu but GLTFLoader has no KTX2Loader.\n` +
        `  → fix: in src/utils/glbLoaderSetup.ts add KTX2Loader registration.`
      );
    } else {
      console.error(`[GLB] ✗ parse failed for ${url}:`, msg, err);
    }

    throw err;
  });

  return { gltf, inspection };
}

/**
 * Safely disposes all geometries, materials, and textures owned by an Object3D hierarchy
 * while respecting optional shared sets that must remain alive.
 */
export function disposeHierarchySafely(
  root: THREE.Object3D,
  sharedGeometries?: ReadonlySet<THREE.BufferGeometry>,
  sharedMaterials?: ReadonlySet<THREE.Material>
): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();
  const disposedTexs = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    if (
      mesh.geometry &&
      !sharedGeometries?.has(mesh.geometry) &&
      !disposedGeos.has(mesh.geometry)
    ) {
      disposedGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat || sharedMaterials?.has(mat) || disposedMats.has(mat)) continue;
      disposedMats.add(mat);
      const std = mat as THREE.MeshStandardMaterial;
      const texSlots = [
        std.map,
        std.normalMap,
        std.roughnessMap,
        std.metalnessMap,
        std.aoMap,
        std.emissiveMap,
      ];
      for (const tex of texSlots) {
        if (tex && !disposedTexs.has(tex)) {
          disposedTexs.add(tex);
          tex.dispose();
        }
      }
      mat.dispose();
    }
  });
}