import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class SceneManager {
  public readonly scene = new THREE.Scene();
  public readonly environmentGroup = new THREE.Group();
  public readonly waterGroup = new THREE.Group();
  public readonly fishGroup = new THREE.Group();
  public readonly rigGroup = new THREE.Group();
  public readonly effectsGroup = new THREE.Group();
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.scene.background = new THREE.Color(0x9bc5db);
    this.scene.fog = new THREE.FogExp2(0x9bc5db, 0.0115);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    pmremGenerator.dispose();

    this.scene.add(
      this.environmentGroup,
      this.waterGroup,
      this.fishGroup,
      this.rigGroup,
      this.effectsGroup
    );
  }

  static disposeObject3D(root: THREE.Object3D): void {
    const visitedTextures = new Set<THREE.Texture>();
    root.traverse((obj) => {
      const light = obj as THREE.Light & { shadow?: THREE.LightShadow };
      if (light.isLight && light.shadow?.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
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

  dispose(): void {
    this.scene.environment = null;
    SceneManager.disposeObject3D(this.scene);
    this.scene.clear();
    if (this.envRenderTarget) {
      this.envRenderTarget.dispose();
      this.envRenderTarget = null;
    }
  }
}
