// src/utils/glbThumbnail.ts
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AnimalType, HouseDef, RockType, TreeType, ToolType } from '../types/game';
import { disposeHierarchySafely, loadValidatedGLTF } from './glbValidator';

const THUMB_SIZE = 128;
const NEGATIVE_RETRY_COOLDOWN_MS = 3500;

interface ThumbnailStudio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  envTexture: THREE.Texture;
}

const THUMB_STUDIO_IDLE_MS = 2500;
let _studio: ThumbnailStudio | null = null;
let _studioIdleTimer: number | null = null;
let _renderQueue: Promise<void> = Promise.resolve();

function disposeThumbnailStudio(): void {
  if (_studioIdleTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(_studioIdleTimer);
    _studioIdleTimer = null;
  }
  if (!_studio) return;
  const current = _studio;
  _studio = null;
  try {
    current.envTexture.dispose();
    current.scene.clear();
    current.renderer.dispose();
    current.renderer.forceContextLoss();
  } catch {
    // Ignore context loss cleanup errors
  }
}

function scheduleThumbnailStudioRelease(): void {
  if (typeof window === 'undefined') return;
  if (_studioIdleTimer !== null) {
    window.clearTimeout(_studioIdleTimer);
  }
  _studioIdleTimer = window.setTimeout(() => {
    _studioIdleTimer = null;
    if (_inFlightProbes.size === 0) {
      disposeThumbnailStudio();
    }
  }, THUMB_STUDIO_IDLE_MS);
}

/** Positive cache: normalized GLB URL -> rendered PNG data URL */
const _urlThumbCache = new Map<string, string>();
/** Timestamp of last failed probe per candidate key so we don't spam within the same second */
const _lastFailedAt = new Map<string, number>();
/** In-flight candidate probes */
const _inFlightProbes = new Map<string, Promise<string | null>>();

type GlbDiscoveryListener = (resolvedUrl: string, dataUrl: string) => void;
const _discoveryListeners = new Set<GlbDiscoveryListener>();

export function subscribeGlbDiscovery(listener: GlbDiscoveryListener): () => void {
  _discoveryListeners.add(listener);
  return () => {
    _discoveryListeners.delete(listener);
  };
}

function notifyGlbDiscovery(resolvedUrl: string, dataUrl: string): void {
  _discoveryListeners.forEach((fn) => {
    try {
      fn(resolvedUrl, dataUrl);
    } catch {
      // Ignore subscriber errors
    }
  });
}

function normalizeGlbPath(fileOrPath: string): string {
  const trimmed = fileOrPath.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function slugifyNameEn(nameEn?: string): string[] {
  if (!nameEn) return [];
  const kebab = nameEn
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!kebab) return [];
  const snake = kebab.replace(/-/g, '_');
  return kebab === snake ? [`/${kebab}.glb`] : [`/${kebab}.glb`, `/${snake}.glb`];
}

/**
 * Resolves ordered .glb candidate paths for a building/structure definition.
 * Uses `def.modelFile` first when specified, plus deterministic conventions so dropping
 * a new `.glb` file into `/public/` automatically activates its icon and 3D model.
 */
export function getHouseGlbCandidates(def: HouseDef): string[] {
  const list: string[] = [];
  const pushUnique = (p: string) => {
    const norm = normalizeGlbPath(p);
    if (norm && !list.includes(norm)) list.push(norm);
  };

  // Dedicated enclosure overrides first (if user adds horse-stable.glb / cow-barn.glb later)
  if (def.type === 15) {
    pushUnique('/horse-stable.glb');
    pushUnique('/horse_stable.glb');
  } else if (def.type === 16) {
    pushUnique('/cow-barn.glb');
    pushUnique('/cow_barn.glb');
  } else if (def.type === 5) {
    pushUnique('/chicken-coop.glb');
    pushUnique('/chicken_coop.glb');
    pushUnique('/chicken.glb');
  } else if (def.type === 24) {
    pushUnique('/duck-coop.glb');
    pushUnique('/duck_coop.glb');
    pushUnique('/duck_walk.glb');
  } else if (def.type === 25) {
    pushUnique('/beerproductionfactory.glb');
    pushUnique('/beer-production-factory.glb');
    pushUnique('/beer_production_factory.glb');
    pushUnique('/models/beerproductionfactory.glb');
  } else if (def.type === 26) {
    pushUnique('/Bakery.glb');
    pushUnique('/bakery.glb');
    pushUnique('/models/Bakery.glb');
  } else if (def.type === 27) {
    pushUnique('/PieOven.glb');
    pushUnique('/pie-oven.glb');
    pushUnique('/pie_oven.glb');
    pushUnique('/Pie_Oven.glb');
    pushUnique('/models/PieOven.glb');
  } else if (def.type === 28) {
    pushUnique('/Animal feed making machine.glb');
    pushUnique('/Animal%20feed%20making%20machine.glb');
    pushUnique('/animal-feed-making-machine.glb');
    pushUnique('/animal_feed_making_machine.glb');
    pushUnique('/models/Animal feed making machine.glb');
  } else if (def.type === 29) {
    pushUnique('/Fish-buying shop.glb');
    pushUnique('/Fish-buying%20shop.glb');
    pushUnique('/fish-buying-shop.glb');
    pushUnique('/fish_buying_shop.glb');
    pushUnique('/Fish_buying_shop.glb');
    pushUnique('/models/Fish-buying shop.glb');
  } else if (def.type === 30) {
    pushUnique('/2Vegetable _plot.glb');
    pushUnique('/2Vegetable%20_plot.glb');
    pushUnique('/2Vegetable_plot.glb');
    pushUnique('/2vegetable_plot.glb');
    pushUnique('/2vegetable _plot.glb');
    pushUnique('/Vegetable _plot.glb');
    pushUnique('/Vegetable_plot.glb');
    pushUnique('/models/2Vegetable _plot.glb');
    pushUnique('/assets/2Vegetable _plot.glb');
  }

  if (def.modelFile) {
    pushUnique(def.modelFile);
  } else {
    pushUnique(`/house-${def.type}.glb`);
    pushUnique(`/house_${def.type}.glb`);
    for (const slugPath of slugifyNameEn(def.nameEn)) {
      pushUnique(slugPath);
    }
  }

  return list;
}

/**
 * Resolves ordered .glb candidate paths for a farm animal species.
 */
export function getAnimalGlbCandidates(type: AnimalType): string[] {
  if (type === 'duck') {
    return ['/duck_walk.glb', '/duck.glb'];
  }
  if (type === 'chicken') {
    return ['/chicken.glb', '/Chicken.glb', '/models/chicken.glb'];
  }
  return [`/${type}.glb`];
}

/**
 * Resolves ordered .glb candidate paths for a decorative rock type.
 */
export function getRockGlbCandidates(type: RockType): string[] {
  if (type === 'grass_on_rock') {
    return [
      '/Grass on a rock.glb',
      '/grass on a rock.glb',
      '/grass_on_a_rock.glb',
      '/grass-on-a-rock.glb',
      '/models/Grass on a rock.glb',
    ];
  }
  const hyphen = type.replace(/_/g, '-');
  return hyphen === type ? [`/${type}.glb`] : [`/${type}.glb`, `/${hyphen}.glb`];
}

/**
 * Resolves ordered .glb candidate paths for tree species.
 * Automatically checks for /apple tree.glb, /orange_ tree.glb, /lemon_tree_.glb, /lcoconut tree.glb, /oak_trees.glb
 */
export function getTreeGlbCandidates(type: TreeType): string[] {
  if (type === 'apple') {
    return ['/apple tree.glb', '/apple_tree.glb', '/apple-tree.glb', '/appletree.glb'];
  }
  if (type === 'orange') {
    return ['/orange_ tree.glb', '/orange_tree.glb', '/orange-tree.glb', '/orange tree.glb', '/orangetree.glb'];
  }
  if (type === 'lemon') {
    return ['/lemon_tree_.glb', '/lemon_tree.glb', '/lemon tree.glb'];
  }
  if (type === 'coconut') {
    return ['/lcoconut tree.glb', '/coconut tree.glb', '/coconut_tree.glb'];
  }
  if (type === 'oak') {
    return ['/oak_trees.glb', '/oak_tree.glb', '/oak tree.glb'];
  }
  return [`/${type}_tree.glb`, `/${type} tree.glb`, `/${type}.glb`];
}

/**
 * Resolves ordered .glb candidate paths for farmer hand tools.
 * Automatically checks for /hoe.glb, /sickle.glb, /ax_.glb, /wateringcan.glb, /fishing_rod.glb
 */
export function getToolGlbCandidates(tool: ToolType | 'fishing_rod' | string): string[] {
  if (tool === 'hoe') {
    return ['/hoe.glb', '/Hoe.glb', '/hoe_tool.glb'];
  }
  if (tool === 'sickle') {
    return ['/sickle.glb', '/Sickle.glb'];
  }
  if (tool === 'axe') {
    return ['/ax_.glb', '/ax.glb', '/axe.glb', '/Ax_.glb', '/Axe.glb'];
  }
  if (tool === 'watering_can') {
    return ['/wateringcan.glb', '/watering_can.glb', '/watering can.glb'];
  }
  if (tool === 'fishing_rod') {
    return ['/fishing_rod.glb', '/fishing-rod.glb', '/fishing rod.glb'];
  }
  if (tool === 'drone') {
    return ['/buster_drone_compressed.glb', '/drone.glb'];
  }
  return [`/${tool}.glb`];
}

function getOrCreateStudio(): ThumbnailStudio | null {
  if (typeof document === 'undefined') return null;
  if (_studio) return _studio;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(1);
    renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
    renderer.setClearColor(0x000000, 0);

    canvas.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        _studio = null;
      },
      false
    );

    const scene = new THREE.Scene();

    // Generate neutral PBR studio environment reflections once
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    const envTexture = envRT.texture;
    scene.environment = envTexture;
    roomEnv.dispose();
    pmrem.dispose();

    // Three-point studio lighting rig
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x78716c, 1.15);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.9);
    fillLight.position.set(-5, 3, 4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef3c7, 1.0);
    rimLight.position.set(-3, 5, -6);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 25);

    _studio = { renderer, scene, camera, envTexture };
    return _studio;
  } catch {
    return null;
  }
}

function renderObjectToDataUrl(root: THREE.Object3D): string | null {
  const studio = getOrCreateStudio();
  if (!studio) return null;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  if (box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);

  const holder = new THREE.Group();
  root.position.sub(center);
  holder.add(root);
  holder.scale.setScalar(1 / maxDim);
  holder.updateMatrixWorld(true);

  const hx = size.x / (2 * maxDim);
  const hy = size.y / (2 * maxDim);
  const hz = size.z / (2 * maxDim);
  const radius = Math.max(0.25, Math.hypot(hx, hy, hz));

  const halfFovRad = THREE.MathUtils.degToRad(studio.camera.fov * 0.5);
  const dist = (radius / Math.sin(halfFovRad)) * 1.04;
  const azimuth = Math.PI * 0.22;
  const elevation = Math.PI * 0.16;

  studio.camera.position.set(
    Math.sin(azimuth) * Math.cos(elevation) * dist,
    Math.sin(elevation) * dist,
    Math.cos(azimuth) * Math.cos(elevation) * dist
  );
  studio.camera.lookAt(0, 0, 0);
  studio.camera.updateProjectionMatrix();

  studio.scene.add(holder);
  let dataUrl: string | null = null;
  try {
    studio.renderer.clear();
    studio.renderer.render(studio.scene, studio.camera);
    dataUrl = studio.renderer.domElement.toDataURL('image/png');
  } catch {
    dataUrl = null;
  } finally {
    studio.scene.remove(holder);
  }

  return dataUrl;
}

/**
 * Synchronously returns a cached thumbnail dataURL if any candidate has already rendered.
 */
export function getCachedGlbThumbnail(candidates: readonly string[]): string | null {
  for (const raw of candidates) {
    const url = normalizeGlbPath(raw);
    const hit = _urlThumbCache.get(url);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolves the first valid `.glb` among `candidates` and renders an offscreen 3D PNG thumbnail.
 * Returns `null` when no valid `.glb` exists yet (never permanently caches failure, so newly
 * added `.glb` files in `/public/` are picked up automatically).
 */
export function resolveGlbThumbnail(
  candidates: readonly string[],
  options?: { forceReprobe?: boolean }
): Promise<string | null> {
  const normalized = candidates.map(normalizeGlbPath).filter(Boolean);
  if (normalized.length === 0) return Promise.resolve(null);

  const cached = getCachedGlbThumbnail(normalized);
  if (cached) return Promise.resolve(cached);

  const key = normalized.join('|');
  const inFlight = _inFlightProbes.get(key);
  if (inFlight) return inFlight;

  const force = Boolean(options?.forceReprobe);
  const lastFail = _lastFailedAt.get(key) ?? 0;
  if (!force && Date.now() - lastFail < NEGATIVE_RETRY_COOLDOWN_MS) {
    return Promise.resolve(null);
  }

  const probePromise = (async (): Promise<string | null> => {
    for (const url of normalized) {
      const alreadyRendered = _urlThumbCache.get(url);
      if (alreadyRendered) return alreadyRendered;

      try {
        const { gltf } = await loadValidatedGLTF(url, {
          bypassCache: force || lastFail > 0,
        });
        if (!gltf?.scene || gltf.scene.children.length === 0) {
          if (gltf?.scene) disposeHierarchySafely(gltf.scene);
          continue;
        }

        let renderedUrl: string | null = null;
        await (_renderQueue = _renderQueue.then(async () => {
          renderedUrl = renderObjectToDataUrl(gltf.scene);
          disposeHierarchySafely(gltf.scene);
        }));

        if (renderedUrl) {
          _urlThumbCache.set(url, renderedUrl);
          _lastFailedAt.delete(key);
          notifyGlbDiscovery(url, renderedUrl);
          return renderedUrl;
        }
      } catch {
        // Candidate missing or 0-byte placeholder — try next candidate silently
      }
    }

    _lastFailedAt.set(key, Date.now());
    return null;
  })().finally(() => {
    _inFlightProbes.delete(key);
    scheduleThumbnailStudioRelease();
  });

  _inFlightProbes.set(key, probePromise);
  return probePromise;
}
