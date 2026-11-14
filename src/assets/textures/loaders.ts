// src/assets/textures/loaders.ts
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  isMobileViewportOrTouch,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../utils/glbValidator';

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

export function loadTextureCached(
  url: string,
  onLoad?: (texture: THREE.Texture) => void,
  onError?: (err: unknown) => void
): THREE.Texture {
  if (textureCache.has(url)) {
    const tex = textureCache.get(url)!;
    onLoad?.(tex);
    return tex;
  }
  const tex = textureLoader.load(
    url,
    (loaded) => {
      loaded.anisotropy = isMobileViewportOrTouch() ? 1 : 4;
      textureCache.set(url, loaded);
      onLoad?.(loaded);
    },
    undefined,
    onError
  );
  return tex;
}

export function disposeCachedTextures(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}

export function loadGLTF(
  url: string,
  onLoad: (gltf: GLTF) => void,
  onError?: (err: unknown) => void
): void {
  loadValidatedGLTF(url)
    .then(({ gltf, inspection }) => {
      optimizeGLTFSceneForDevice(gltf.scene, inspection);
      onLoad(gltf);
    })
    .catch((err) => {
      onError?.(err);
    });
}
