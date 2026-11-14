// src/utils/offlineAssets.ts
import { inspectGLBBuffer } from './glbValidator';

export const GLB_CACHE_NAME = 'beam-farm-3d-glb-models';

/**
 * Complete list of prepared 3D GLB assets in /public, ordered from core gameplay essentials
 * to optional farm buildings so players can prepare offline assets progressively.
 */
export const PREPARED_GLB_ASSETS: readonly string[] = [
  '/man.glb',
  '/drone.glb',
  '/Wooden_ fence.glb',
  '/bakery-interior.glb',
  '/horse.glb',
  '/cow.glb',
  '/duck_walk.glb',
  '/water-tower.glb',
  '/windmill.glb',
  '/tractor.glb',
  '/spooky-lamp-post.glb',
  '/power-line.glb',
  '/utility-pole.glb',
  '/fire-escape.glb',
  '/village.glb',
  '/produce-storage-facility.glb',
  '/train-station.glb',
  '/baankhonsuan.glb',
  '/woman.glb',
  '/boy.glb',
  '/girl.glb',
  '/jungle_house_3d_model_free.glb',
  '/river_rock.glb',
  '/oak_trees.glb',
  '/mountain_hiking_trail.glb',
  '/two-story-timber-house.glb',
] as const;

export interface OfflineCacheStats {
  supported: boolean;
  cachedGlbCount: number;
  totalGlbCount: number;
  totalCacheEntries: number;
  estimatedBytes: number;
  formattedSize: string;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getOfflineCacheStats(): Promise<OfflineCacheStats> {
  const totalGlbCount = PREPARED_GLB_ASSETS.length;
  if (typeof window === 'undefined' || !('caches' in window)) {
    return {
      supported: false,
      cachedGlbCount: 0,
      totalGlbCount,
      totalCacheEntries: 0,
      estimatedBytes: 0,
      formattedSize: '0 B',
    };
  }

  try {
    const cacheNames = await window.caches.keys();
    let totalCacheEntries = 0;
    let cachedGlbCount = 0;
    const matchedGlbs = new Set<string>();

    for (const name of cacheNames) {
      const cache = await window.caches.open(name);
      const keys = await cache.keys();
      totalCacheEntries += keys.length;

      for (const req of keys) {
        try {
          const url = new URL(req.url);
          const decodedPath = decodeURIComponent(url.pathname);
          if (PREPARED_GLB_ASSETS.includes(decodedPath) || PREPARED_GLB_ASSETS.includes(url.pathname)) {
            matchedGlbs.add(decodedPath);
          }
        } catch {}
      }
    }
    cachedGlbCount = matchedGlbs.size;

    let estimatedBytes = 0;
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      estimatedBytes = est.usage ?? 0;
    }

    return {
      supported: true,
      cachedGlbCount,
      totalGlbCount,
      totalCacheEntries,
      estimatedBytes,
      formattedSize: formatBytes(estimatedBytes),
    };
  } catch {
    return {
      supported: true,
      cachedGlbCount: 0,
      totalGlbCount,
      totalCacheEntries: 0,
      estimatedBytes: 0,
      formattedSize: '0 B',
    };
  }
}

export interface OfflinePrepProgress {
  completed: number;
  total: number;
  currentAsset: string;
  cachedCount: number;
}

export async function prepareAllOfflineAssets(
  onProgress?: (progress: OfflinePrepProgress) => void
): Promise<{ cachedCount: number; total: number }> {
  const total = PREPARED_GLB_ASSETS.length;
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cachedCount: 0, total };
  }

  const cache = await window.caches.open(GLB_CACHE_NAME);
  let cachedCount = 0;

  for (let i = 0; i < PREPARED_GLB_ASSETS.length; i++) {
    const assetPath = PREPARED_GLB_ASSETS[i];
    const encodedUrl = encodeURI(assetPath);

    onProgress?.({
      completed: i,
      total,
      currentAsset: assetPath.replace(/^\//, ''),
      cachedCount,
    });

    try {
      const existing = await cache.match(encodedUrl);
      if (existing && existing.ok) {
        cachedCount++;
        continue;
      }

      const resp = await fetch(encodedUrl);
      if (!resp.ok) continue;

      const clone = resp.clone();
      const buffer = await resp.arrayBuffer();
      const check = inspectGLBBuffer(buffer);
      if (check.valid) {
        await cache.put(encodedUrl, clone);
        cachedCount++;
      }
    } catch {
      // Offline or transient error on individual model — skip gracefully
    }
  }

  onProgress?.({
    completed: total,
    total,
    currentAsset: '',
    cachedCount,
  });

  return { cachedCount, total };
}

export async function clearOfflineAssetCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((k) => window.caches.delete(k)));
  } catch {}
}