//src/components/3d/FarmBuildings.ts 

import * as THREE from 'three';
import {
  createWoodPlankTexture,
  createBarnRedTexture,
  createCobblestoneTexture,
} from '../../utils/textures';

/**
 * FarmBuildings3D
 * Recreates all architectural landmarks matching the reference image:
 * 1. Farmhouse (Stone cottage with smoking chimney) -> Grid [-5.5, -4.5]
 * 2. Small cottage shed -> Grid [0, -5.5]
 * 3. Red Barn -> Grid [5.5, -4.5]
 * 4. Windmill -> Center Grid [0, 0]
 * 5. Campfire with glowing light and smoke -> Grid [5.5, 0]
 * 6. Firewood stacks, pumpkins, and benches
 */

export class FarmBuildings3D {
  public group: THREE.Group;
  public windmillBladesGroup: THREE.Group | null = null;
  public campfireLight: THREE.PointLight | null = null;
  public smokeParticlesGroup: THREE.Group = new THREE.Group();
  private smokeList: { mesh: THREE.Mesh; speedY: number; resetY: number; startX: number; startZ: number }[] = [];

  constructor(renderer?: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'FarmBuildings';

    this.createFarmhouse(renderer);
    this.createCottageShed(renderer);
    this.createBarn(renderer);
    this.createWindmill(renderer);
    this.createCampfire();
    this.createProps();

    this.group.add(this.smokeParticlesGroup);
  }

  // 1. STONE FARMHOUSE (Top-Left grid block: X: -5.5, Z: -4.5)
  private createFarmhouse(renderer?: THREE.WebGLRenderer) {
    const house = new THREE.Group();
    house.position.set(-5.5, 0, -4.5);

    const stoneTex = createCobblestoneTexture(renderer);
    const woodTex = createWoodPlankTexture('#8d6e63', renderer);

    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff59d, emissive: 0xffb74d, emissiveIntensity: 0.4 });

    // Main stone structure
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 4.0), stoneMat);
    body.position.set(0, 1.6, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    // Gabled roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.6, 0);
    roofShape.lineTo(0, 2.0);
    roofShape.lineTo(2.6, 0);
    roofShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.1 });
    roofGeo.center();
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 4.0, 0);
    roof.rotation.y = Math.PI / 2;
    roof.castShadow = true;
    house.add(roof);

    // Front porch
    const porch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 1.2), woodMat);
    porch.position.set(0, 0.15, 2.4);
    porch.castShadow = true;
    house.add(porch);

    // Windows
    [-1.2, 1.2].forEach((x) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.1), glassMat);
      win.position.set(x, 1.6, 2.02);
      house.add(win);
    });

    // Tall Stone Chimney with smoke
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), stoneMat);
    chimney.position.set(-1.8, 3.0, -1.0);
    chimney.castShadow = true;
    house.add(chimney);

    // Smoke rising from chimney
    this.createSmokeEmitter(-7.3, 5.2, -5.5, 6, 0.25);

    this.group.add(house);
  }

  // 2. SMALL COTTAGE SHED (Top-Center: X: 0, Z: -5.5)
  private createCottageShed(renderer?: THREE.WebGLRenderer) {
    const shed = new THREE.Group();
    shed.position.set(0, 0, -5.5);

    const woodTex = createWoodPlankTexture('#a1887f', renderer);
    const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), woodMat);
    body.position.set(0, 0.9, 0);
    body.castShadow = true;
    shed.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 4), roofMat);
    roof.position.set(0, 2.3, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    shed.add(roof);

    this.group.add(shed);
  }

  // 3. RED BARN (Top-Right: X: 5.5, Z: -4.5)
  private createBarn(renderer?: THREE.WebGLRenderer) {
    const barn = new THREE.Group();
    barn.position.set(5.5, 0, -4.5);

    const barnTex = createBarnRedTexture(renderer);
    const barnMat = new THREE.MeshStandardMaterial({ map: barnTex, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.5 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 4.2), barnMat);
    body.position.set(0, 1.6, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    barn.add(body);

    // Gambrel Barn Roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.4, 0);
    roofShape.lineTo(-1.8, 1.6);
    roofShape.lineTo(0, 2.4);
    roofShape.lineTo(1.8, 1.6);
    roofShape.lineTo(2.4, 0);
    roofShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.1 });
    roofGeo.center();
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 4.2, 0);
    roof.rotation.y = Math.PI / 2;
    roof.castShadow = true;
    barn.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), trimMat);
    door.position.set(0, 1.1, 2.12);
    barn.add(door);

    this.group.add(barn);
  }

  // 4. STONE WINDMILL (Center: X: 0, Z: 0)
  private createWindmill(renderer?: THREE.WebGLRenderer) {
    const mill = new THREE.Group();
    mill.position.set(0, 0, 0);

    const stoneTex = createCobblestoneTexture(renderer);
    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, color: 0xb0bec5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.9, side: THREE.DoubleSide });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 4.5, 12), stoneMat);
    tower.position.set(0, 2.25, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    mill.add(tower);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 12), roofMat);
    cap.position.set(0, 5.2, 0);
    cap.castShadow = true;
    mill.add(cap);

    this.windmillBladesGroup = new THREE.Group();
    this.windmillBladesGroup.position.set(0, 4.4, 1.35);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), woodMat);
    hub.rotation.x = Math.PI / 2;
    this.windmillBladesGroup.add(hub);

    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;

      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 0.08), woodMat);
      spar.position.set(0, 1.6, 0);
      spar.castShadow = true;
      arm.add(spar);

      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 2.4), sailMat);
      sail.position.set(0.35, 1.7, 0.04);
      sail.rotation.y = 0.15;
      arm.add(sail);

      this.windmillBladesGroup.add(arm);
    }
    mill.add(this.windmillBladesGroup);

    this.group.add(mill);
  }

  // 5. CAMPFIRE (Grid Center-Right: X: 5.5, Z: 0)
  private createCampfire() {
    const campfire = new THREE.Group();
    campfire.position.set(5.5, 0, 0);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xff6d00,
      emissive: 0xff3d00,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    // Circular stone ring
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stoneMat);
      rock.position.set(Math.cos(angle) * 0.8, 0.1, Math.sin(angle) * 0.8);
      campfire.add(rock);
    }

    // Tepee logs
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 6), logMat);
      log.position.set(Math.cos(angle) * 0.25, 0.35, Math.sin(angle) * 0.25);
      log.rotation.x = 0.45;
      log.rotation.y = angle;
      campfire.add(log);
    }

    // Glowing core flame
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), fireMat);
    flame.position.set(0, 0.45, 0);
    campfire.add(flame);

    // Warm Flickering Campfire Light
    this.campfireLight = new THREE.PointLight(0xff7043, 2.5, 9);
    this.campfireLight.position.set(0, 0.8, 0);
    this.campfireLight.castShadow = true;
    campfire.add(this.campfireLight);

    // Smoke rising from campfire
    this.createSmokeEmitter(5.5, 0.9, 0, 5, 0.2);

    this.group.add(campfire);
  }

  // 6. PROPS (Stacked logs, pumpkins, benches)
  private createProps() {
    const props = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xf57c00, roughness: 0.4 });

    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 3 - layer; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), woodMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(4.2 + (i - 1) * 0.24, 0.1 + layer * 0.18, -1.2);
        log.castShadow = true;
        props.add(log);
      }
    }

    const pumpkinCoords = [
      { x: 5.8, z: -1.4, s: 0.32 },
      { x: 6.3, z: -1.2, s: 0.26 },
      { x: 5.2, z: -1.6, s: 0.28 },
      { x: 3.8, z: -5.8, s: 0.35 },
    ];

    pumpkinCoords.forEach((p) => {
      const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(p.s, 8, 8), pumpkinMat);
      pumpkin.scale.set(1.2, 0.85, 1.2);
      pumpkin.position.set(p.x, p.s * 0.7, p.z);
      pumpkin.castShadow = true;
      props.add(pumpkin);
    });

    const benchGeo = new THREE.BoxGeometry(1.6, 0.1, 0.45);
    const bench = new THREE.Mesh(benchGeo, woodMat);
    bench.position.set(7.2, 0.3, 0);
    props.add(bench);

    this.group.add(props);
  }

  private createSmokeEmitter(x: number, startY: number, z: number, count: number, size: number) {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xededed,
      transparent: true,
      opacity: 0.35,
    });

    for (let i = 0; i < count; i++) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(size * (1 + i * 0.2), 6, 6), smokeMat);
      sphere.position.set(x, startY + i * 0.45, z);
      this.smokeParticlesGroup.add(sphere);
      this.smokeList.push({
        mesh: sphere,
        speedY: 0.6 + Math.random() * 0.3,
        resetY: startY,
        startX: x,
        startZ: z,
      });
    }
  }

  public update(delta: number, elapsed: number = 0) {
    if (this.windmillBladesGroup) {
      this.windmillBladesGroup.rotation.z -= delta * 0.8;
    }
    if (this.campfireLight) {
      this.campfireLight.intensity = 2.2 + Math.sin(elapsed * 12.0) * 0.4 + Math.cos(elapsed * 24.0) * 0.2;
    }
    this.smokeList.forEach((s) => {
      s.mesh.position.y += s.speedY * delta;
      s.mesh.position.x = s.startX + Math.sin(s.mesh.position.y * 1.5) * 0.25;

      if (s.mesh.position.y > s.resetY + 2.8) {
        s.mesh.position.y = s.resetY;
        s.mesh.position.x = s.startX;
      }
    });
  }
}
