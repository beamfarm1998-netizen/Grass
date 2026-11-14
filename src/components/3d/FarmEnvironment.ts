//src/components/3d/FarmEnvironment.ts

import * as THREE from 'three';

/**
 * FarmEnvironment3D
 * Recreates the surrounding pine forest, river rocks, and the signature God Rays:
 * - Volumetric Sun Shafts (God Rays streaming down on the right forest)
 * - Dense layered Spruce & Pine trees matching the reference vista
 * - Scattered stones & moss boulders
 */

export class FarmEnvironment3D {
  public group: THREE.Group;
  public godRaysGroup: THREE.Group = new THREE.Group();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FarmEnvironment';

    this.createGodRays();
    this.createFramingPines();
    this.createFieldTreesAndRocks();

    this.group.add(this.godRaysGroup);
  }

  // 1. SIGNATURE GOD RAYS (Sun shafts cascading through the right-side forest)
  private createGodRays() {
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xfff3d0,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const rayPositions = [
      { x: 19, y: 14, z: -8, r: 2.2, len: 26 },
      { x: 22, y: 13, z: -3, r: 2.8, len: 28 },
      { x: 20, y: 12, z: 4, r: 2.5, len: 26 },
      { x: 24, y: 14, z: 9, r: 3.2, len: 30 },
      { x: 17, y: 12, z: 12, r: 2.0, len: 24 },
    ];

    rayPositions.forEach((p) => {
      const geo = new THREE.CylinderGeometry(p.r * 0.4, p.r * 1.4, p.len, 12, 1, true);
      const mesh = new THREE.Mesh(geo, rayMat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.z = 0.55;
      mesh.rotation.x = -0.2;
      this.godRaysGroup.add(mesh);
    });
  }

  // 2. LAYERED PINE TREES (Dense conifer clusters like in the reference image)
  private createFramingPines() {
    const pineGroup = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const crownMat1 = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.8 });
    const crownMat2 = new THREE.MeshStandardMaterial({ color: 0x274e29, roughness: 0.8 });

    const createPine = (x: number, y: number, z: number, s: number = 1.0) => {
      const tree = new THREE.Group();
      tree.position.set(x, y, z);
      tree.scale.setScalar(s);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 6), trunkMat);
      trunk.position.set(0, 1.1, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      const tiers = [
        { r: 1.8, h: 2.0, y: 2.4, mat: crownMat1 },
        { r: 1.4, h: 1.8, y: 3.5, mat: crownMat2 },
        { r: 1.0, h: 1.5, y: 4.5, mat: crownMat1 },
        { r: 0.6, h: 1.2, y: 5.3, mat: crownMat2 },
      ];

      tiers.forEach((t) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), t.mat);
        cone.position.set(0, t.y, 0);
        cone.castShadow = true;
        tree.add(cone);
      });

      return tree;
    };

    // Right-side Elevated Mossy Forest
    for (let i = 0; i < 28; i++) {
      const x = 17 + Math.random() * 8;
      const z = -22 + Math.random() * 44;
      const y = 0.5 + (x - 17) * 0.25;
      const s = 0.8 + Math.random() * 0.5;
      pineGroup.add(createPine(x, y, z, s));
    }

    // Left border pine wall
    for (let i = 0; i < 14; i++) {
      const x = -21 - Math.random() * 5;
      const z = -20 + Math.random() * 40;
      pineGroup.add(createPine(x, 0, z, 0.9 + Math.random() * 0.4));
    }

    // Top background pine wall
    for (let i = 0; i < 12; i++) {
      const x = -18 + i * 3.2;
      const z = -20 - Math.random() * 3;
      pineGroup.add(createPine(x, 0, z, 0.85 + Math.random() * 0.3));
    }

    this.group.add(pineGroup);
  }

  // 3. FIELD TREES & RIVER BOULDERS
  private createFieldTreesAndRocks() {
    const decGroup = new THREE.Group();

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.85 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });

    const createOak = (x: number, z: number, s: number = 1.0) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(s);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6), trunkMat);
      trunk.position.set(0, 0.9, 0);
      trunk.castShadow = true;
      tree.add(trunk);

      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), leafMat);
      crown.position.set(0, 2.4, 0);
      crown.castShadow = true;
      tree.add(crown);

      return tree;
    };

    decGroup.add(createOak(-14, -8, 0.85));
    decGroup.add(createOak(-6, 2, 0.75));
    decGroup.add(createOak(2, 6, 0.9));
    decGroup.add(createOak(11, 2, 0.8));

    const rockCoords = [
      { x: -9, z: -1.5, s: 0.5 },
      { x: -3, z: 6, s: 0.6 },
      { x: 3, z: 9, s: 0.4 },
      { x: 13, z: -1, s: 0.7 },
      { x: 10, z: 7, s: 0.5 },
      { x: -16, z: 12, s: 0.8 },
      { x: 1, z: 12, s: 0.55 },
    ];

    rockCoords.forEach((r) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r.s, 0), rockMat);
      rock.position.set(r.x, r.s * 0.4, r.z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      decGroup.add(rock);
    });

    this.group.add(decGroup);
  }

  public update(delta: number, elapsed: number = 0) {
    this.godRaysGroup.children.forEach((ray, i) => {
      const mat = (ray as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(elapsed * 1.5 + i) * 0.04;
    });
  }
}
