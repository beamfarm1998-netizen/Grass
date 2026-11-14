// src/utils/farmAutoSave.ts
import type {
  CameraMode,
  CropType,
  FarmerGender,
  HousePartKey,
  OutfitPartKey,
  PartStyleConfig,
  PlacedHouse,
  PlayerOutfitConfig,
  TimeOfDay,
  ToolType,
  TreeType,
} from '../types/game';
import {
  FARM_AUTOSAVE_IDB_NAME,
  FARM_SAVE_KEYS,
  PRESERVED_PREF_KEYS,
  isSaveSuppressed,
  registerSaveResetListener,
} from './saveReset';

const IDB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const STORE_TEXTURES = 'textures';
const LATEST_SNAPSHOT_KEY = 'latest_v2';

const SAVED_AT_KEY = 'beam_farm_3d_save_map_v2_saved_at';
export const SESSION_STORAGE_KEY = 'beam_farm_3d_save_map_v2_session';
const LOCAL_TEX_PREFIX = 'beam_farm_tex_';
const TEX_TOKEN_PREFIX = '@tex:';

// In-memory fallback storage ONLY used when localStorage throws (QuotaExceededError / SecurityError)
const memoryFallbackStore = new Map<string, string>();
const quotaFallbackKeys = new Set<string>();
const memoryTextureCache = new Map<string, string>();
let resetEpoch = 0;

// Capture initial offline elapsed time once per boot so multiple hooks (plots & trees) read the same delta
let cachedInitialElapsedSec: number | null = null;
let lastBootSavedAtRaw: string | null = null;

export function getInitialOfflineElapsedSeconds(): number {
  const currentRaw = safeGetLocalStorageItem(SAVED_AT_KEY);
  if (cachedInitialElapsedSec !== null && currentRaw === lastBootSavedAtRaw) {
    return cachedInitialElapsedSec;
  }
  lastBootSavedAtRaw = currentRaw;
  if (!currentRaw) {
    cachedInitialElapsedSec = 0;
    return 0;
  }
  const ts = Number(currentRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    cachedInitialElapsedSec = 0;
    return 0;
  }
  // Cap offline catch-up to 24 hours max
  cachedInitialElapsedSec = Math.max(0, Math.min(86400, (Date.now() - ts) / 1000));
  return cachedInitialElapsedSec;
}

export function resetOfflineElapsedCache(): void {
  cachedInitialElapsedSec = 0;
  lastBootSavedAtRaw = safeGetLocalStorageItem(SAVED_AT_KEY);
}

export function touchFarmSavedAt(): void {
  if (isSaveSuppressed()) return;
  const nowStr = String(Date.now());
  safeSetLocalStorageItem(SAVED_AT_KEY, nowStr);
}

// ─────────────────────── Safe LocalStorage Read / Write (Quota-Resilient) ───────────────────────

export function safeGetLocalStorageItem(key: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
    // Key is genuinely absent in localStorage — only use RAM fallback if localStorage.setItem failed for this key
    if (quotaFallbackKeys.has(key)) {
      return memoryFallbackStore.get(key) ?? null;
    }
    return null;
  } catch {
    // Fallback to memory store if localStorage itself throws SecurityError
    return memoryFallbackStore.get(key) ?? null;
  }
}

function evictLocalTextureMirrors(keepCount = 0): boolean {
  try {
    const texKeys: { key: string; len: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_TEX_PREFIX)) {
        const v = localStorage.getItem(k);
        texKeys.push({ key: k, len: v ? v.length : 0 });
      }
    }
    if (texKeys.length <= keepCount) return false;
    texKeys.sort((a, b) => b.len - a.len);
    const toRemove = texKeys.slice(0, texKeys.length - keepCount);
    for (const item of toRemove) {
      localStorage.removeItem(item.key);
    }
    return toRemove.length > 0;
  } catch {
    return false;
  }
}

export function safeSetLocalStorageItem(key: string, value: string): boolean {
  memoryFallbackStore.set(key, value);
  try {
    localStorage.setItem(key, value);
    quotaFallbackKeys.delete(key);
    return true;
  } catch {
    // QuotaExceededError recovery: evict localStorage texture mirrors (they remain safe in IndexedDB + RAM)
    if (!key.startsWith(LOCAL_TEX_PREFIX)) {
      const freed = evictLocalTextureMirrors(0);
      if (freed) {
        try {
          localStorage.setItem(key, value);
          quotaFallbackKeys.delete(key);
          return true;
        } catch {
          // Still couldn't fit in localStorage; IndexedDB snapshot mirror + quotaFallbackKeys will persist it
        }
      }
    }
    quotaFallbackKeys.add(key);
    return false;
  }
}

// ─────────────────────── IndexedDB Backing Store (Serialized + Unlimited Quota) ───────────────────────

let idbPromise: Promise<IDBDatabase | null> | null = null;
let idbOpChain: Promise<unknown> = Promise.resolve();

function enqueueIdbOp<T>(task: () => Promise<T>): Promise<T> {
  const next = idbOpChain.then(task, task);
  idbOpChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function openFarmAutoSaveDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(FARM_AUTOSAVE_IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS);
        }
        if (!db.objectStoreNames.contains(STORE_TEXTURES)) {
          db.createObjectStore(STORE_TEXTURES);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          idbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        idbPromise = null;
        resolve(null);
      };
    } catch {
      idbPromise = null;
      resolve(null);
    }
  });
  return idbPromise;
}

function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const epochAtCall = resetEpoch;
  return enqueueIdbOp(async () => {
    if (epochAtCall !== resetEpoch) return;
    const db = await openFarmAutoSaveDb();
    if (!db || epochAtCall !== resetEpoch) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  return enqueueIdbOp(async () => {
    const db = await openFarmAutoSaveDb();
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

function idbClearAllStores(): Promise<void> {
  return enqueueIdbOp(async () => {
    const db = await openFarmAutoSaveDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([STORE_SNAPSHOTS, STORE_TEXTURES], 'readwrite');
        tx.objectStore(STORE_SNAPSHOTS).clear();
        tx.objectStore(STORE_TEXTURES).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  });
}

// ─────────────────────── Texture Deduplication Vault (Prevents 5MB Quota Overflow) ───────────────────────

function hashDataUrl(str: string): string {
  let h1 = 0x811c9dc5;
  const step = Math.max(1, Math.floor(str.length / 512));
  for (let i = 0; i < str.length; i += step) {
    h1 ^= str.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `${(h1 >>> 0).toString(36)}_${str.length.toString(36)}`;
}

function storeDataUrlInVault(dataUrl: string | undefined): string | undefined {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 512) {
    return dataUrl;
  }
  const id = hashDataUrl(dataUrl);
  memoryTextureCache.set(id, dataUrl);
  safeSetLocalStorageItem(LOCAL_TEX_PREFIX + id, dataUrl);
  if (!isSaveSuppressed()) {
    void idbPut(STORE_TEXTURES, id, dataUrl);
  }
  return `${TEX_TOKEN_PREFIX}${id}`;
}

function resolveDataUrlFromVaultSync(tokenOrUrl: string | undefined): string | undefined {
  if (!tokenOrUrl || !tokenOrUrl.startsWith(TEX_TOKEN_PREFIX)) {
    return tokenOrUrl;
  }
  const id = tokenOrUrl.slice(TEX_TOKEN_PREFIX.length);
  const mem = memoryTextureCache.get(id);
  if (mem) return mem;
  const local = safeGetLocalStorageItem(LOCAL_TEX_PREFIX + id);
  if (local) {
    memoryTextureCache.set(id, local);
    return local;
  }
  return tokenOrUrl;
}

async function resolveDataUrlFromVaultAsync(tokenOrUrl: string | undefined): Promise<string | undefined> {
  if (!tokenOrUrl || !tokenOrUrl.startsWith(TEX_TOKEN_PREFIX)) {
    return tokenOrUrl;
  }
  const syncVal = resolveDataUrlFromVaultSync(tokenOrUrl);
  if (syncVal && !syncVal.startsWith(TEX_TOKEN_PREFIX)) {
    return syncVal;
  }
  const id = tokenOrUrl.slice(TEX_TOKEN_PREFIX.length);
  const fromIdb = await idbGet<string>(STORE_TEXTURES, id);
  if (fromIdb) {
    memoryTextureCache.set(id, fromIdb);
    return fromIdb;
  }
  return undefined;
}

export function packHousesForStorage(houses: PlacedHouse[]): PlacedHouse[] {
  return houses.map((h) => {
    if (!h.customTexture && !h.partStyles) return h;
    const copy: PlacedHouse = { ...h };
    if (copy.customTexture) {
      copy.customTexture = storeDataUrlInVault(copy.customTexture);
    }
    if (copy.partStyles) {
      const nextParts: Partial<Record<HousePartKey, PartStyleConfig>> = {};
      for (const [k, cfg] of Object.entries(copy.partStyles) as [
        HousePartKey,
        PartStyleConfig | undefined,
      ][]) {
        if (!cfg) continue;
        nextParts[k] = cfg.textureDataUrl
          ? { ...cfg, textureDataUrl: storeDataUrlInVault(cfg.textureDataUrl) }
          : cfg;
      }
      copy.partStyles = nextParts;
    }
    return copy;
  });
}

export function unpackHousesFromStorageSync(houses: PlacedHouse[]): {
  houses: PlacedHouse[];
  needsAsyncHydration: boolean;
} {
  let needsAsyncHydration = false;
  const unpacked = houses.map((h) => {
    if (!h.customTexture && !h.partStyles) return h;
    const copy: PlacedHouse = { ...h };
    if (copy.customTexture) {
      const resolved = resolveDataUrlFromVaultSync(copy.customTexture);
      if (resolved?.startsWith(TEX_TOKEN_PREFIX)) {
        needsAsyncHydration = true;
        delete copy.customTexture;
      } else {
        copy.customTexture = resolved;
      }
    }
    if (copy.partStyles) {
      const nextParts: Partial<Record<HousePartKey, PartStyleConfig>> = {};
      for (const [k, cfg] of Object.entries(copy.partStyles) as [
        HousePartKey,
        PartStyleConfig | undefined,
      ][]) {
        if (!cfg) continue;
        if (cfg.textureDataUrl) {
          const resolved = resolveDataUrlFromVaultSync(cfg.textureDataUrl);
          if (resolved?.startsWith(TEX_TOKEN_PREFIX)) {
            needsAsyncHydration = true;
            const cleanCfg = { ...cfg };
            delete cleanCfg.textureDataUrl;
            nextParts[k] = cleanCfg;
          } else {
            nextParts[k] = { ...cfg, textureDataUrl: resolved };
          }
        } else {
          nextParts[k] = cfg;
        }
      }
      copy.partStyles = nextParts;
    }
    return copy;
  });
  return { houses: unpacked, needsAsyncHydration };
}

export async function hydrateHousesTexturesFromIdb(
  rawHouses: PlacedHouse[]
): Promise<PlacedHouse[]> {
  return Promise.all(
    rawHouses.map(async (h) => {
      if (!h.customTexture && !h.partStyles) return h;
      const copy: PlacedHouse = { ...h };
      if (copy.customTexture) {
        copy.customTexture = await resolveDataUrlFromVaultAsync(copy.customTexture);
      }
      if (copy.partStyles) {
        const nextParts: Partial<Record<HousePartKey, PartStyleConfig>> = {};
        for (const [k, cfg] of Object.entries(copy.partStyles) as [
          HousePartKey,
          PartStyleConfig | undefined,
        ][]) {
          if (!cfg) continue;
          if (cfg.textureDataUrl) {
            const tex = await resolveDataUrlFromVaultAsync(cfg.textureDataUrl);
            nextParts[k] = tex ? { ...cfg, textureDataUrl: tex } : { ...cfg, textureDataUrl: undefined };
          } else {
            nextParts[k] = cfg;
          }
        }
        copy.partStyles = nextParts;
      }
      return copy;
    })
  );
}

export function packOutfitForStorage(config: PlayerOutfitConfig): PlayerOutfitConfig {
  if (!config.parts) return config;
  const nextParts: Partial<Record<OutfitPartKey, PartStyleConfig>> = {};
  for (const [k, cfg] of Object.entries(config.parts) as [
    OutfitPartKey,
    PartStyleConfig | undefined,
  ][]) {
    if (!cfg) continue;
    nextParts[k] = cfg.textureDataUrl
      ? { ...cfg, textureDataUrl: storeDataUrlInVault(cfg.textureDataUrl) }
      : cfg;
  }
  return { ...config, parts: nextParts };
}

export function unpackOutfitFromStorageSync(config: PlayerOutfitConfig): {
  config: PlayerOutfitConfig;
  needsAsyncHydration: boolean;
} {
  let needsAsyncHydration = false;
  if (!config.parts) return { config, needsAsyncHydration: false };
  const nextParts: Partial<Record<OutfitPartKey, PartStyleConfig>> = {};
  for (const [k, cfg] of Object.entries(config.parts) as [
    OutfitPartKey,
    PartStyleConfig | undefined,
  ][]) {
    if (!cfg) continue;
    if (cfg.textureDataUrl) {
      const resolved = resolveDataUrlFromVaultSync(cfg.textureDataUrl);
      if (resolved?.startsWith(TEX_TOKEN_PREFIX)) {
        needsAsyncHydration = true;
        const cleanCfg = { ...cfg };
        delete cleanCfg.textureDataUrl;
        nextParts[k] = cleanCfg;
      } else {
        nextParts[k] = { ...cfg, textureDataUrl: resolved };
      }
    } else {
      nextParts[k] = cfg;
    }
  }
  return { config: { ...config, parts: nextParts }, needsAsyncHydration };
}

export async function hydrateOutfitTexturesFromIdb(
  rawConfig: PlayerOutfitConfig
): Promise<PlayerOutfitConfig> {
  if (!rawConfig.parts) return rawConfig;
  const nextParts: Partial<Record<OutfitPartKey, PartStyleConfig>> = {};
  for (const [k, cfg] of Object.entries(rawConfig.parts) as [
    OutfitPartKey,
    PartStyleConfig | undefined,
  ][]) {
    if (!cfg) continue;
    if (cfg.textureDataUrl) {
      const tex = await resolveDataUrlFromVaultAsync(cfg.textureDataUrl);
      nextParts[k] = tex ? { ...cfg, textureDataUrl: tex } : { ...cfg, textureDataUrl: undefined };
    } else {
      nextParts[k] = cfg;
    }
  }
  return { ...rawConfig, parts: nextParts };
}

// ─────────────────────── Global Auto-Save Scheduler & Lifecycle Flush ───────────────────────

type FlushFn = () => void;
const activeFlushers = new Set<FlushFn>();
const activeCancellers = new Set<() => void>();
let idbMirrorTimer: number | null = null;
let lifecycleListenersAttached = false;

function purgeFarmAutoSaveOnReset(): void {
  resetEpoch += 1;

  // 1. Cancel pending IndexedDB snapshot timer & all pending channel timers
  if (idbMirrorTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(idbMirrorTimer);
    idbMirrorTimer = null;
  }
  activeCancellers.forEach((cancelFn) => {
    try {
      cancelFn();
    } catch {
      // Ignore individual errors
    }
  });

  // 2. Purge all RAM caches except preserved user control/display preferences
  memoryTextureCache.clear();
  quotaFallbackKeys.clear();
  for (const key of Array.from(memoryFallbackStore.keys())) {
    if (!PRESERVED_PREF_KEYS.has(key)) {
      memoryFallbackStore.delete(key);
    }
  }

  // 3. Reset offline elapsed time cache
  cachedInitialElapsedSec = 0;
  lastBootSavedAtRaw = null;

  // 4. Clear IndexedDB object stores sequentially ahead of any future reads/writes
  void idbClearAllStores();
}

registerSaveResetListener(purgeFarmAutoSaveOnReset);

function scheduleIdbSnapshotMirror(): void {
  if (typeof window === 'undefined' || isSaveSuppressed()) return;
  if (idbMirrorTimer !== null) return;
  const scheduledEpoch = resetEpoch;
  idbMirrorTimer = window.setTimeout(() => {
    idbMirrorTimer = null;
    if (scheduledEpoch !== resetEpoch || isSaveSuppressed()) return;
    void writeFullSnapshotToIdb();
  }, 900);
}

export function hasValidLocalFarmStatsSync(): boolean {
  try {
    const raw = localStorage.getItem('beam_farm_3d_save_map_v2_stats');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { coins?: unknown; day?: unknown } | null;
    return Boolean(
      parsed &&
        typeof parsed === 'object' &&
        typeof parsed.coins === 'number' &&
        Number.isFinite(parsed.coins)
    );
  } catch {
    return false;
  }
}

let bootRecoveryCompleted = false;

export function markFarmBootCompleted(): void {
  bootRecoveryCompleted = true;
}

export async function writeFullSnapshotToIdb(): Promise<void> {
  if (isSaveSuppressed()) return;
  const startEpoch = resetEpoch;
  const snapshot: Record<string, string> = {};
  let hasCoreData = false;
  for (const key of FARM_SAVE_KEYS) {
    const val = safeGetLocalStorageItem(key);
    if (val !== null) {
      snapshot[key] = val;
      if (key === 'beam_farm_3d_save_map_v2_stats') {
        hasCoreData = true;
      }
    }
  }
  if (!hasCoreData || startEpoch !== resetEpoch || isSaveSuppressed()) return;
  // Stamp the exact same savedAt timestamp recorded in SAVED_AT_KEY so delayed IDB mirror timers
  // never appear artificially "newer" than localStorage on the next boot!
  const canonicalSavedAt = Number(safeGetLocalStorageItem(SAVED_AT_KEY) || '0') || Date.now();
  await idbPut(STORE_SNAPSHOTS, LATEST_SNAPSHOT_KEY, {
    savedAt: canonicalSavedAt,
    hadQuotaOverflow: quotaFallbackKeys.size > 0,
    entries: snapshot,
  });
}

export async function recoverFarmSaveFromIdbIfEmpty(): Promise<boolean> {
  if (isSaveSuppressed() || bootRecoveryCompleted) return false;
  const startEpoch = resetEpoch;

  const localHasValidStats = hasValidLocalFarmStatsSync();
  let localSavedAt = 0;
  try {
    localSavedAt = Number(localStorage.getItem(SAVED_AT_KEY) || '0') || 0;
  } catch {
    // Continue to check IDB if localStorage threw
  }

  const backup = await idbGet<{
    savedAt: number;
    hadQuotaOverflow?: boolean;
    entries: Record<string, string>;
  }>(STORE_SNAPSHOTS, LATEST_SNAPSHOT_KEY);

  if (startEpoch !== resetEpoch || isSaveSuppressed() || bootRecoveryCompleted) {
    return false;
  }
  if (!backup || !backup.entries || !backup.entries['beam_farm_3d_save_map_v2_stats']) {
    return false;
  }

  // Validate backup stats JSON before restoring
  try {
    const parsedBackupStats = JSON.parse(backup.entries['beam_farm_3d_save_map_v2_stats']) as {
      coins?: unknown;
    } | null;
    if (!parsedBackupStats || typeof parsedBackupStats.coins !== 'number') {
      return false;
    }
  } catch {
    return false;
  }

  const idbSavedAt = Number(backup.savedAt) || 0;
  const idbHasOverflowNewer =
    Boolean(backup.hadQuotaOverflow) && idbSavedAt > localSavedAt;

  if (localHasValidStats && !idbHasOverflowNewer) {
    return false;
  }

  for (const [k, v] of Object.entries(backup.entries)) {
    if (typeof v === 'string') {
      safeSetLocalStorageItem(k, v);
    }
  }
  cachedInitialElapsedSec = null;
  return true;
}

export function flushAllPendingFarmSaves(): void {
  if (isSaveSuppressed()) return;
  activeFlushers.forEach((fn) => {
    try {
      fn();
    } catch {
      // Isolate individual channel errors
    }
  });
  touchFarmSavedAt();
  void writeFullSnapshotToIdb();
}

function ensureLifecycleListeners(): void {
  if (lifecycleListenersAttached || typeof window === 'undefined') return;
  lifecycleListenersAttached = true;

  const onExitOrHide = () => {
    flushAllPendingFarmSaves();
  };

  window.addEventListener('pagehide', onExitOrHide);
  window.addEventListener('beforeunload', onExitOrHide);
  window.addEventListener('blur', onExitOrHide);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        onExitOrHide();
      }
    });
  }
}

export interface AutoSaveChannel {
  schedule: () => void;
  flush: () => void;
  dispose: () => void;
}

/**
 * Throttled + Debounced Auto-Save Channel:
 * - Saves quickly (`delayMs` = 250ms) after user actions.
 * - Guarantees execution at least every `maxWaitMs` (1200ms) even when 1-second crop/tree
 *   growth intervals update state continuously (eliminates infinite debounce starvation!).
 * - Automatically flushes on `beforeunload`, `pagehide`, `visibilitychange`, `blur`, and unmount.
 */
export function createAutoSaveChannel(
  writeFn: () => void,
  options: { delayMs?: number; maxWaitMs?: number } = {}
): AutoSaveChannel {
  const delayMs = options.delayMs ?? 250;
  const maxWaitMs = options.maxWaitMs ?? 1200;

  ensureLifecycleListeners();

  let debounceTimer: number | null = null;
  let maxWaitTimer: number | null = null;
  let dirty = false;

  const clearTimers = () => {
    if (debounceTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (maxWaitTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(maxWaitTimer);
      maxWaitTimer = null;
    }
  };

  const cancelPending = () => {
    clearTimers();
    dirty = false;
  };

  const flush = () => {
    clearTimers();
    if (!dirty || isSaveSuppressed()) {
      dirty = false;
      return;
    }
    dirty = false;
    writeFn();
    touchFarmSavedAt();
    scheduleIdbSnapshotMirror();
  };

  const schedule = () => {
    if (isSaveSuppressed()) return;
    dirty = true;
    if (typeof window === 'undefined') {
      flush();
      return;
    }
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(flush, delayMs);

    if (maxWaitTimer === null) {
      maxWaitTimer = window.setTimeout(flush, maxWaitMs);
    }
  };

  const forceFlush = () => {
    if (isSaveSuppressed()) {
      cancelPending();
      return;
    }
    clearTimers();
    dirty = false;
    writeFn();
  };

  activeFlushers.add(forceFlush);
  activeCancellers.add(cancelPending);

  const dispose = () => {
    activeFlushers.delete(forceFlush);
    activeCancellers.delete(cancelPending);
    flush();
  };

  return { schedule, flush, dispose };
}

// ─────────────────────── World & Player Session State Persistence ───────────────────────

export interface WorldSessionSaveState {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  playerGender: FarmerGender;
  timeOfDay: TimeOfDay;
  cameraMode: CameraMode;
  gridVisible: boolean;
  activeTool: ToolType;
  selectedSeed: CropType;
  selectedSapling: TreeType;
  isPlayerLocked: boolean;
  isPlayerHidden?: boolean;
}

export const DEFAULT_WORLD_SESSION: WorldSessionSaveState = {
  playerX: -1,
  playerZ: 3,
  playerHeading: 0,
  playerGender: 'male',
  timeOfDay: 'morning',
  cameraMode: 'isometric',
  gridVisible: true,
  activeTool: 'hoe',
  selectedSeed: 'wheat',
  selectedSapling: 'apple',
  isPlayerLocked: false,
  isPlayerHidden: false,
};

const VALID_GENDERS = new Set<FarmerGender>(['male', 'female', 'boy', 'girl']);
const VALID_TIMES = new Set<TimeOfDay>(['morning', 'day', 'sunset', 'night']);
const VALID_CAMERAS = new Set<CameraMode>(['isometric', 'follow', 'fpp', 'topdown']);
const VALID_TOOLS = new Set<ToolType>([
  'hand',
  'hoe',
  'watering_can',
  'sickle',
  'axe',
  'seed_bag',
  'tree_sapling',
  'drone',
]);

export function loadWorldSessionState(): WorldSessionSaveState {
  const prefHiddenRaw = safeGetLocalStorageItem('beam_farm_player_hidden');
  const prefHidden = prefHiddenRaw !== null ? prefHiddenRaw === 'true' : undefined;
  try {
    const raw = safeGetLocalStorageItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_WORLD_SESSION,
        isPlayerHidden: prefHidden ?? DEFAULT_WORLD_SESSION.isPlayerHidden,
      };
    }
    const parsed = JSON.parse(raw) as Partial<WorldSessionSaveState>;
    const px =
      typeof parsed.playerX === 'number' && Number.isFinite(parsed.playerX)
        ? Math.max(-88, Math.min(48, parsed.playerX))
        : DEFAULT_WORLD_SESSION.playerX;
    const pz =
      typeof parsed.playerZ === 'number' && Number.isFinite(parsed.playerZ)
        ? Math.max(-35, Math.min(35, parsed.playerZ))
        : DEFAULT_WORLD_SESSION.playerZ;
    const heading =
      typeof parsed.playerHeading === 'number' && Number.isFinite(parsed.playerHeading)
        ? parsed.playerHeading
        : 0;

    return {
      playerX: px,
      playerZ: pz,
      playerHeading: heading,
      playerGender: VALID_GENDERS.has(parsed.playerGender as FarmerGender)
        ? (parsed.playerGender as FarmerGender)
        : DEFAULT_WORLD_SESSION.playerGender,
      timeOfDay: VALID_TIMES.has(parsed.timeOfDay as TimeOfDay)
        ? (parsed.timeOfDay as TimeOfDay)
        : DEFAULT_WORLD_SESSION.timeOfDay,
      cameraMode: VALID_CAMERAS.has(parsed.cameraMode as CameraMode)
        ? (parsed.cameraMode as CameraMode)
        : DEFAULT_WORLD_SESSION.cameraMode,
      gridVisible:
        typeof parsed.gridVisible === 'boolean'
          ? parsed.gridVisible
          : DEFAULT_WORLD_SESSION.gridVisible,
      activeTool: VALID_TOOLS.has(parsed.activeTool as ToolType)
        ? (parsed.activeTool as ToolType)
        : DEFAULT_WORLD_SESSION.activeTool,
      selectedSeed:
        typeof parsed.selectedSeed === 'string'
          ? (parsed.selectedSeed as CropType)
          : DEFAULT_WORLD_SESSION.selectedSeed,
      selectedSapling:
        typeof parsed.selectedSapling === 'string'
          ? (parsed.selectedSapling as TreeType)
          : DEFAULT_WORLD_SESSION.selectedSapling,
      isPlayerLocked: Boolean(parsed.isPlayerLocked),
      isPlayerHidden:
        prefHidden !== undefined ? prefHidden : Boolean(parsed.isPlayerHidden),
    };
  } catch {
    return {
      ...DEFAULT_WORLD_SESSION,
      isPlayerHidden: prefHidden ?? DEFAULT_WORLD_SESSION.isPlayerHidden,
    };
  }
}

export function saveWorldSessionState(session: WorldSessionSaveState): void {
  if (isSaveSuppressed()) return;
  safeSetLocalStorageItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}
