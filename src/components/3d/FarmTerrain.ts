// src/components/3d/FarmTerrain.ts
import * as THREE from 'three';
import { createGrassTexture } from '../../utils/textures';
import { POND } from '../../data/terrainFeatures';
import { isMobileViewportOrTouch } from '../../utils/glbValidator';

export class FarmTerrain3D {
  public group: THREE.Group;
  public groundMesh: THREE.Mesh;
  public outerColor = new THREE.Color(0x4c6f2a);

  constructor(renderer?: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'FarmTerrain';
    const isMobile = isMobileViewportOrTouch();

    const mapWidth = 104;
    const mapDepth = 78;

    const fallbackTex = createGrassTexture(renderer);

    const groundGeo = new THREE.PlaneGeometry(mapWidth, mapDepth);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshStandardMaterial({
      map: fallbackTex,
      roughness: 0.85,
      metalness: 0.05,
      transparent: false,
    });

    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.position.set(0, 0, 0);
    this.groundMesh.receiveShadow = true;
    this.groundMesh.userData.outerColor = this.outerColor;
    this.group.add(this.groundMesh);

    // ✅ พื้นทุ่งหญ้ารอบนอกทรงโค้งธรรมชาติ ครอบคลุมทั้ง Map 1 และ Map 2 พร้อมเปิดเส้นขอบฟ้าให้เห็นพระจันทร์และดวงดาว
    const outerGeo = new THREE.CircleGeometry(142, 64);
    outerGeo.rotateX(-Math.PI / 2);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x4c6f2a,
      roughness: 0.95,
      metalness: 0.02,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.set(-16, -0.03, 0);
    outer.receiveShadow = false;
    this.group.add(outer);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/farm-map.jpg',
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        if (renderer) {
          texture.anisotropy = isMobile ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy());
        }
        groundMat.map = texture;
        groundMat.needsUpdate = true;

        try {
          const img = texture.image as HTMLImageElement;
          const w = 128, h = 96;
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, w, h);
          const px = ctx.getImageData(0, 0, w, h).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (x > 3 && x < w - 4 && y > 3 && y < h - 4) continue;
              const i = (y * w + x) * 4;
              if (px[i + 1] > px[i] && px[i + 1] > px[i + 2]) {
                r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
              }
            }
          }
          if (n > 20) {
            outerMat.color.setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
            this.outerColor.copy(outerMat.color);
          }
        } catch (e) {
          console.warn('อ่านสีขอบแผนที่ไม่ได้', e);
        }
      },
      undefined,
      (err) => {
        console.warn('ยังไม่พบไฟล์ public/farm-map.jpg ใช้ระบบพื้นผิวสำรองแทน', err);
      }
    );

    const waterGeo = new THREE.CircleGeometry(POND.radius, 24);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x29b6f6,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.45,
    });

    const pondWater = new THREE.Mesh(waterGeo, waterMat);
    pondWater.position.set(POND.x, 0.03, POND.z);
    this.group.add(pondWater);
  }

  public dispose() {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
  }
}