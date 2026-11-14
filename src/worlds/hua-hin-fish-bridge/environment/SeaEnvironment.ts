// src/worlds/hua-hin-fish-bridge/environment/SeaEnvironment.ts
import * as THREE from 'three';
import { LAYOUT } from './StoneBridge';

export interface SeaEnvironment {
  group: THREE.Group;
  update: (elapsed: number) => void;
  dispose: () => void;
}

export function createSea(): SeaEnvironment {
  const group = new THREE.Group();
  group.name = 'Sea';

  const depth = 140;
  const geo = new THREE.PlaneGeometry(260, depth, 44, 28);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1fa3c9,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.set(0, LAYOUT.seaY, LAYOUT.shoreZ + depth / 2 - 1);
  sea.receiveShadow = true;
  group.add(sea);

  // ✅ FIX RISK-5: เก็บ reference ของ bedGeo/bedMat ไว้ dispose
  const bedGeo = new THREE.PlaneGeometry(260, depth).rotateX(-Math.PI / 2);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x3b4a4f, roughness: 1 });
  const bed = new THREE.Mesh(bedGeo, bedMat);
  bed.position.set(0, LAYOUT.seabedY, sea.position.z);
  group.add(bed);

  // ทะเลไกลแบบเรียบ (ไม่ขยับ) ให้ทะเลต่อไปจนถึงขอบฟ้า ไม่เห็นขอบระนาบ
  const farGeo = new THREE.PlaneGeometry(1600, 900).rotateX(-Math.PI / 2);
  const farMat = new THREE.MeshStandardMaterial({ color: 0x1fa3c9, roughness: 0.4, metalness: 0.1 });
  const far = new THREE.Mesh(farGeo, farMat);
  far.position.set(0, LAYOUT.seaY - 0.18, LAYOUT.shoreZ + 440);
  group.add(far);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const baseY = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) baseY[i] = pos.getY(i);

  return {
    group,
    update(elapsed: number) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, baseY[i] + Math.sin(x * 0.35 + elapsed * 1.4) * 0.07 + Math.cos(z * 0.3 + elapsed * 1.1) * 0.06);
      }
      pos.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      bedGeo.dispose();
      bedMat.dispose();
      farGeo.dispose();
      farMat.dispose();
      group.clear();
    },
  };
}