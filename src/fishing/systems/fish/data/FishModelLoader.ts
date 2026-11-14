// src/fishing/systems/fish/data/FishModelLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../../../../utils/glbLoaderSetup';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

export interface InstantiatedFishModel {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  defaultAction: THREE.AnimationAction | null;
}

const GLB_MAGIC = 0x46546c67; // 'glTF' little-endian

export class FishModelLoader {
  private static cache = new Map<
    string,
    { scene: THREE.Group; animations: THREE.AnimationClip[] }
  >();
  private static failedUrls = new Set<string>();
  private static pendingLoads = new Map<string, Promise<boolean>>();
  private static loader = createGLTFLoader();

  /**
   * โหลดโมเดล GLB ล่วงหน้าอย่างปลอดภัย (เรียกซ้ำได้ ไม่โหลดใหม่)
   * หากไฟล์ยังไม่มีใน public/ หรือเซิร์ฟเวอร์คืนค่า HTML fallback จะคืน false โดยไม่แครชเกม
   */
  static async preload(url: string): Promise<boolean> {
    if (!url) return false;
    if (this.cache.has(url)) return true;
    if (this.failedUrls.has(url)) return false;

    const existing = this.pendingLoads.get(url);
    if (existing) return existing;

    const loadPromise = (async (): Promise<boolean> => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          this.failedUrls.add(url);
          return false;
        }
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('text/html')) {
          this.failedUrls.add(url);
          return false;
        }

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength < 12) {
          this.failedUrls.add(url);
          return false;
        }

        const view = new DataView(buffer);
        const magic = view.getUint32(0, true);
        const firstByte = view.getUint8(0);
        const isBinaryGlb = magic === GLB_MAGIC;
        const isJsonGltf = firstByte === 0x7b; // '{'
        if (!isBinaryGlb && !isJsonGltf) {
          this.failedUrls.add(url);
          return false;
        }

        const lastSlash = url.lastIndexOf('/');
        const resourcePath = lastSlash >= 0 ? url.slice(0, lastSlash + 1) : '/';

        const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
          (resolve, reject) => {
            this.loader.parse(
              buffer,
              resourcePath,
              (parsed) => {
                resolve({
                  scene: parsed.scene,
                  animations: parsed.animations ?? [],
                });
              },
              reject
            );
          }
        );

        this.cache.set(url, gltf);
        return true;
      } catch {
        this.failedUrls.add(url);
        return false;
      } finally {
        this.pendingLoads.delete(url);
      }
    })();

    this.pendingLoads.set(url, loadPromise);
    return loadPromise;
  }

  /** โหลดโมเดล GLB ของปลาทุกสายพันธุ์ที่มีการตั้งค่า modelUrl ล่วงหน้า */
  static async preloadSpeciesModels(
    speciesList: readonly { modelUrl?: string }[]
  ): Promise<void> {
    const urls = Array.from(
      new Set(
        speciesList
          .map((s) => s.modelUrl)
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      )
    );
    if (urls.length === 0) return;
    await Promise.all(urls.map((u) => this.preload(u)));
  }

  /** สร้าง Instance ใหม่ (ใช้ SkeletonUtils เพื่อไม่ให้ Animation ขยับพร้อมกันทั้งบ่อ) */
  static instantiate(url: string): InstantiatedFishModel | null {
    const asset = this.cache.get(url);
    if (!asset) return null;

    const root = skeletonClone(asset.scene) as THREE.Group;
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          mesh.frustumCulled = false;
        }
      }
    });

    const mixer = asset.animations.length > 0 ? new THREE.AnimationMixer(root) : null;
    const actions = new Map<string, THREE.AnimationAction>();
    let defaultAction: THREE.AnimationAction | null = null;

    if (mixer) {
      for (const clip of asset.animations) {
        const action = mixer.clipAction(clip);
        actions.set(clip.name, action);
        if (!defaultAction) {
          defaultAction = action;
        }
      }
    }

    return { root, mixer, actions, defaultAction };
  }
}