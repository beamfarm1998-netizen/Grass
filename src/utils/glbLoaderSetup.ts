// src/utils/glbLoaderSetup.ts
// ตั้งค่า GLTFLoader ให้ถอดรหัสไฟล์ที่บีบด้วย Meshopt ได้ (ผลจาก scripts/optimize-glb.mjs)
// ทุกที่ที่เคย `new GLTFLoader()` ให้เปลี่ยนมาใช้ createGLTFLoader() แทน
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function setupGLTFLoader<T extends GLTFLoader>(loader: T): T {
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function createGLTFLoader(): GLTFLoader {
  return setupGLTFLoader(new GLTFLoader());
}
