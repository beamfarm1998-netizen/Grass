import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../../../utils/glbLoaderSetup';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export interface AssetValidationReport {
  key: string;
  url: string;
  valid: boolean;
  meshCount: number;
  vertexCount: number;
  hasMaterial: boolean;
  hasValidBounds: boolean;
  animationCount: number;
  issues: string[];
}

export class AssetLoaderAndValidator {
  private readonly loader: GLTFLoader;
  private readonly loadedModels = new Map<string, GLTF>();
  private readonly skinnedModelKeys = new Set<string>();
  private readonly reports = new Map<string, AssetValidationReport>();

  constructor() {
    THREE.Cache.enabled = true;
    this.loader = createGLTFLoader();
  }

  static validateSceneRoot(
    key: string,
    url: string,
    root: THREE.Object3D,
    animations: THREE.AnimationClip[] = []
  ): AssetValidationReport {
    const issues: string[] = [];
    let meshCount = 0;
    let vertexCount = 0;
    let hasMaterial = false;

    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        meshCount++;
        const posAttr = mesh.geometry?.attributes?.position;
        if (posAttr && posAttr.count > 0) {
          vertexCount += posAttr.count;
        } else {
          issues.push(`Mesh "${mesh.name || 'unnamed'}" is missing position vertices`);
        }

        if (mesh.material) {
          hasMaterial = true;
        } else {
          issues.push(`Mesh "${mesh.name || 'unnamed'}" has no assigned material`);
        }
      }
    });

    if (meshCount === 0) {
      issues.push('Model contains zero meshes');
    }

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxExtent = Math.max(size.x, size.y, size.z);
    // Support both meter-scale and cm-scale Sketchfab/Blender GLBs up to 10,000 units
    const hasValidBounds =
      Number.isFinite(size.x) &&
      Number.isFinite(size.y) &&
      Number.isFinite(size.z) &&
      maxExtent > 0.0005 &&
      maxExtent < 10000;

    if (!hasValidBounds) {
      issues.push('Model bounding box is degenerate or out of expected scale');
    }

    return {
      key,
      url,
      valid: issues.length === 0 && meshCount > 0 && hasMaterial && hasValidBounds,
      meshCount,
      vertexCount,
      hasMaterial,
      hasValidBounds,
      animationCount: animations.length,
      issues,
    };
  }

  async loadAndValidateGlb(key: string, url: string): Promise<AssetValidationReport> {
    if (this.reports.has(key)) {
      return this.reports.get(key)!;
    }

    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.loader.load(url, resolve, undefined, reject);
      });

      const report = AssetLoaderAndValidator.validateSceneRoot(
        key,
        url,
        gltf.scene,
        gltf.animations ?? []
      );
      if (report.valid) {
        this.loadedModels.set(key, gltf);
        let containsSkinnedMesh = false;
        gltf.scene.traverse((obj) => {
          if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
            containsSkinnedMesh = true;
          }
        });
        if (containsSkinnedMesh) {
          this.skinnedModelKeys.add(key);
        }
      }
      this.reports.set(key, report);
      return report;
    } catch (err) {
      const failed: AssetValidationReport = {
        key,
        url,
        valid: false,
        meshCount: 0,
        vertexCount: 0,
        hasMaterial: false,
        hasValidBounds: false,
        animationCount: 0,
        issues: [err instanceof Error ? err.message : 'Failed to load GLB'],
      };
      this.reports.set(key, failed);
      return failed;
    }
  }

  async preloadCoreModels(): Promise<boolean> {
    const targets = [
      { key: 'fish_base', url: '/assets/models/fish/lake_fish.glb' },
      { key: 'rod_base', url: '/assets/models/equipment/fishing_rod.glb' },
      { key: 'rock_base', url: '/assets/models/environments/lake_rock.glb' },
      { key: 'uw_rock', url: '/assets/models/environments/rock.glb' },
      { key: 'uw_seaweed', url: '/assets/models/environments/seaweed.glb' },
      { key: 'uw_fallen_tree', url: '/assets/models/environments/fallen_tree.glb' },
      { key: 'real_forest', url: '/assets/models/environments/real_forest.glb' },
    ];
    const results = await Promise.all(
      targets.map((item) => this.loadAndValidateGlb(item.key, item.url))
    );
    return results.every((r) => r.valid);
  }

  getModelSceneRef(key: string): THREE.Group | null {
    return this.loadedModels.get(key)?.scene ?? null;
  }

  hasSkinnedMesh(key: string): boolean {
    return this.skinnedModelKeys.has(key);
  }

  getAnimations(key: string): THREE.AnimationClip[] {
    return this.loadedModels.get(key)?.animations ?? [];
  }

  cloneModelScene(key: string): THREE.Group | null {
    const gltf = this.loadedModels.get(key);
    if (!gltf) return null;
    if (this.skinnedModelKeys.has(key)) {
      const cloned = skeletonClone(gltf.scene) as THREE.Group;
      cloned.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
          obj.frustumCulled = false;
        }
      });
      return cloned;
    }
    return gltf.scene.clone(true);
  }

  getAllReports(): AssetValidationReport[] {
    return Array.from(this.reports.values());
  }

  dispose(): void {
    const visitedTextures = new Set<THREE.Texture>();
    for (const gltf of this.loadedModels.values()) {
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            for (const value of Object.values(mat)) {
              if (value && (value as THREE.Texture).isTexture) {
                const tex = value as THREE.Texture;
                if (!visitedTextures.has(tex)) {
                  visitedTextures.add(tex);
                  tex.dispose();
                }
              }
            }
            mat.dispose();
          }
        }
      });
    }
    this.loadedModels.clear();
    this.skinnedModelKeys.clear();
    this.reports.clear();
  }
}