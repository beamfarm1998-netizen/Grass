// src/components/3d/structures/HouseMeshBuilder.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createWoodPlankTexture,
  createCobblestoneTexture,
  createDirtPathTexture,
} from '../../../utils/textures';

export interface HouseMaterials {
  wood: THREE.MeshStandardMaterial;
  woodLight: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  log: THREE.MeshStandardMaterial;
  roofBrown: THREE.MeshStandardMaterial;
  roofRed: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  fence: THREE.MeshStandardMaterial;
  dirt: THREE.MeshStandardMaterial;
}

export function createHouseMaterials(renderer?: THREE.WebGLRenderer): HouseMaterials {
  const tex = (c: string) => createWoodPlankTexture(c, renderer);
  const stoneTex = createCobblestoneTexture(renderer);
  stoneTex.repeat.set(2, 1);
  const dirtTex = createDirtPathTexture(renderer);
  dirtTex.repeat.set(1, 2);

  return {
    wood: new THREE.MeshStandardMaterial({ map: tex('#a67c52'), roughness: 0.85 }),
    woodLight: new THREE.MeshStandardMaterial({ map: tex('#d2ae7e'), roughness: 0.85 }),
    woodDark: new THREE.MeshStandardMaterial({ map: tex('#5d4037'), roughness: 0.85 }),
    log: new THREE.MeshStandardMaterial({ map: tex('#8d6240'), roughness: 0.9 }),
    roofBrown: new THREE.MeshStandardMaterial({ map: tex('#6d4c41'), roughness: 0.8 }),
    roofRed: new THREE.MeshStandardMaterial({ map: tex('#b5532e'), roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xfff1b8,
      emissive: 0xffb74d,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    }),
    fence: new THREE.MeshStandardMaterial({ map: tex('#e3c9a0'), roughness: 0.85 }),
    dirt: new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }),
  };
}

/**
 * ตัวช่วยรวมเรขาคณิตตามวัสดุและส่วนประกอบบ้าน (ลด Draw Calls พร้อมรองรับการเปลี่ยนสี/PNG แยกชิ้นส่วน)
 */
export class HouseMeshBuilder {
  private parts = new Map<
    string,
    { mat: THREE.Material; part?: 'roof' | 'wall' | 'fence' | 'floor' | 'chimney'; geos: THREE.BufferGeometry[] }
  >();
  private matIds = new Map<THREE.Material, number>();
  private nextMatId = 1;
  private activePart?: 'roof' | 'wall' | 'fence' | 'floor' | 'chimney';

  setPart(part?: 'roof' | 'wall' | 'fence' | 'floor' | 'chimney'): this {
    this.activePart = part;
    return this;
  }

  getPart(): 'roof' | 'wall' | 'fence' | 'floor' | 'chimney' | undefined {
    return this.activePart;
  }

  private getKey(
    mat: THREE.Material,
    part?: 'roof' | 'wall' | 'fence' | 'floor' | 'chimney'
  ): string {
    let id = this.matIds.get(mat);
    if (!id) {
      id = this.nextMatId++;
      this.matIds.set(mat, id);
    }
    return `${id}:${part ?? 'none'}`;
  }

  /** เพิ่มชิ้นส่วน: geo อยู่ที่จุดกำเนิด แล้วหมุน Y (ry) และย้ายไป x,y,z */
  add(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    ry = 0,
    rx = 0,
    rz = 0
  ) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('color');
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    const key = this.getKey(mat, this.activePart);
    let bucket = this.parts.get(key);
    if (!bucket) {
      bucket = { mat, part: this.activePart, geos: [] };
      this.parts.set(key, bucket);
    }
    bucket.geos.push(g);
  }

  box(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rx = 0,
    rz = 0
  ) {
    this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, rx, rz);
  }

  cyl(
    r: number,
    h: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    rz = 0,
    seg = 8
  ) {
    this.add(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z, 0, rx, rz);
  }

  /** หลังคาจั่ว: สันหลังคาขนานแกน Z, ฐานอยู่ที่ y */
  gable(
    w: number,
    d: number,
    h: number,
    oh: number,
    roof: THREE.Material,
    wall: THREE.Material,
    y: number,
    z = 0
  ) {
    const prevPart = this.activePart;
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2 - oh, 0);
    sh.lineTo(w / 2 + oh, 0);
    sh.lineTo(0, h);
    sh.closePath();
    const len = d + oh * 2;
    const roofGeo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
    roofGeo.translate(0, 0, -len / 2);
    this.activePart = 'roof';
    this.add(roofGeo, roof, 0, y, z);

    // หน้าจั่วเป็นผนังไม้ (ฝาปิดสามเหลี่ยม) ทั้งหน้าและหลัง
    this.activePart = 'wall';
    const cap = new THREE.Shape();
    cap.moveTo(-w / 2, 0);
    cap.lineTo(w / 2, 0);
    cap.lineTo(0, h * 0.995);
    cap.closePath();
    for (const s of [1, -1]) {
      const g = new THREE.ShapeGeometry(cap);
      if (s < 0) g.rotateY(Math.PI);
      this.add(g, wall, 0, y, z + s * (len / 2 + 0.012));
    }
    this.activePart = prevPart;
  }

  /** หน้าต่างมีกรอบและลูกกรง ติดผนัง (ry = ทิศหันหน้า) */
  window(
    x: number,
    y: number,
    z: number,
    ry: number,
    frame: THREE.Material,
    glass: THREE.Material,
    w = 0.95,
    h = 0.9
  ) {
    const prevPart = this.activePart;
    const frameParts: THREE.BufferGeometry[] = [
      new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.1),
      new THREE.BoxGeometry(0.06, h, 0.16).translate(0, 0, 0.03),
      new THREE.BoxGeometry(w, 0.06, 0.16).translate(0, 0, 0.03),
      new THREE.BoxGeometry(w + 0.3, 0.08, 0.2).translate(0, -(h + 0.14) / 2, 0.06),
    ];
    this.activePart = 'wall';
    for (const g of frameParts) this.add(g, frame, x, y, z, ry);
    this.activePart = undefined;
    this.add(new THREE.BoxGeometry(w, h, 0.12).translate(0, 0, 0.02), glass, x, y, z, ry);
    this.activePart = prevPart;
  }

  build(
    castMats: Set<THREE.Material>,
    noShadow: Set<THREE.Material>,
    fenceMat: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    this.parts.forEach(({ mat, part, geos }) => {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castMats.has(mat) && !noShadow.has(mat);
      mesh.receiveShadow = true;
      const resolvedPart = part ?? (mat === fenceMat ? 'fence' : undefined);
      if (resolvedPart) {
        mesh.userData.housePart = resolvedPart;
      }
      if (mat === fenceMat || resolvedPart === 'fence') {
        mesh.userData.isFence = true;
      }
      group.add(mesh);
    });
    return group;
  }
}

/** รั้วไม้ระแนงรอบลานบ้านพักอาศัย เว้นประตูไว้ด้านหน้า (+Z) */
export function buildPicketYardFence(
  b: HouseMeshBuilder,
  m: HouseMaterials,
  yard: number
): void {
  const prevPart = b.getPart();
  b.setPart('fence');

  const h = yard / 2 - 0.2;
  const gate = 0.95;
  const step = 0.42;

  const run = (alongX: boolean, fixed: number, from: number, to: number) => {
    const n = Math.max(1, Math.floor((to - from) / step));
    for (let i = 0; i <= n; i++) {
      const t = from + ((to - from) * i) / n;
      const tall = 0.92 + ((i * 7) % 3) * 0.04;
      if (alongX) b.box(0.22, tall, 0.05, m.fence, t, tall / 2, fixed);
      else b.box(0.22, tall, 0.05, m.fence, fixed, tall / 2, t, Math.PI / 2);
    }
    const inner = fixed - Math.sign(fixed) * 0.05;
    const len = to - from;
    const c = (from + to) / 2;
    for (const y of [0.3, 0.7]) {
      if (alongX) b.box(len, 0.07, 0.06, m.fence, c, y, inner);
      else b.box(0.06, 0.07, len, m.fence, inner, y, c);
    }
  };

  run(true, h, -h, -gate);
  run(true, h, gate, h);
  run(true, -h, -h, h);
  run(false, -h, -h, h);
  run(false, h, -h, h);

  const posts: [number, number, number][] = [
    [-h, h, 1.15],
    [h, h, 1.15],
    [-h, -h, 1.15],
    [h, -h, 1.15],
    [-gate - 0.08, h, 1.4],
    [gate + 0.08, h, 1.4],
  ];
  for (const [x, z, hh] of posts) {
    b.box(0.22, hh, 0.22, m.woodDark, x, hh / 2, z);
    b.box(0.3, 0.06, 0.3, m.woodDark, x, hh + 0.03, z);
  }

  b.setPart(prevPart);
}

/**
 * WalkingAgent — โมเดลการเคลื่อนที่แบบต่อเนื่องด้วยแคลคูลัส (semi-implicit Euler + Reynolds steering)
 */
export interface WalkingAgentOptions {
  maxSpeed?: number;
  maxAcceleration?: number;
  arriveRadius?: number;
  turnResponsiveness?: number;
  wanderRadius?: number;
  wanderInterval?: [number, number];
}

export class WalkingAgent {
  public readonly position = new THREE.Vector3();
  public readonly velocity = new THREE.Vector3();
  public heading = 0;
  public speed = 0;

  public maxSpeed: number;
  public maxAcceleration: number;
  public arriveRadius: number;
  public turnResponsiveness: number;
  public wanderRadius: number;
  public wanderInterval: [number, number];

  private readonly wanderCenter = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private hasExternalTarget = false;
  private wanderTimer = 0;

  private readonly _steer = new THREE.Vector3();
  private readonly _desired = new THREE.Vector3();
  private readonly _toTarget = new THREE.Vector3();
  private readonly _accel = new THREE.Vector3();

  constructor(opts: WalkingAgentOptions = {}) {
    this.maxSpeed = opts.maxSpeed ?? 0.55;
    this.maxAcceleration = opts.maxAcceleration ?? 1.6;
    this.arriveRadius = opts.arriveRadius ?? 0.6;
    this.turnResponsiveness = opts.turnResponsiveness ?? 8;
    this.wanderRadius = opts.wanderRadius ?? 3.5;
    this.wanderInterval = opts.wanderInterval ?? [2.5, 6];
  }

  spawn(x: number, z: number, heading = Math.random() * Math.PI * 2) {
    this.position.set(x, 0, z);
    this.wanderCenter.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.speed = 0;
    this.hasExternalTarget = false;
    this.wanderTimer = 0;
  }

  setTarget(x: number, z: number) {
    this.target.set(x, 0, z);
    this.hasExternalTarget = true;
  }

  clearTarget() {
    this.hasExternalTarget = false;
    this.wanderTimer = 0;
  }

  private computeSteer(target: THREE.Vector3): THREE.Vector3 {
    this._toTarget.subVectors(target, this.position);
    this._toTarget.y = 0;
    const dist = this._toTarget.length();
    if (dist < 1e-5) {
      this._steer.set(0, 0, 0);
      return this._steer;
    }
    let desiredSpeed = this.maxSpeed;
    if (dist < this.arriveRadius) {
      desiredSpeed = this.maxSpeed * (dist / this.arriveRadius);
    }
    this._desired.copy(this._toTarget).normalize().multiplyScalar(desiredSpeed);
    this._steer.subVectors(this._desired, this.velocity);
    return this._steer;
  }

  public update(dt: number): void {
    if (dt <= 0) return;

    if (!this.hasExternalTarget) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * this.wanderRadius;
        this.target.set(
          this.wanderCenter.x + Math.cos(a) * r,
          0,
          this.wanderCenter.z + Math.sin(a) * r
        );
        this.wanderTimer =
          this.wanderInterval[0] +
          Math.random() * (this.wanderInterval[1] - this.wanderInterval[0]);
      }
    }

    const steer = this.computeSteer(this.target);
    const len = steer.length();
    if (len > this.maxAcceleration && len > 1e-6) {
      this._accel.copy(steer).multiplyScalar(this.maxAcceleration / len);
    } else {
      this._accel.copy(steer);
    }

    this.velocity.addScaledVector(this._accel, dt);

    this.speed = this.velocity.length();
    if (this.speed > this.maxSpeed) {
      this.velocity.multiplyScalar(this.maxSpeed / this.speed);
      this.speed = this.maxSpeed;
    }

    this.position.addScaledVector(this.velocity, dt);

    if (this.speed > 0.02) {
      const targetHeading = Math.atan2(this.velocity.x, this.velocity.z);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const k = 1 - Math.exp(-this.turnResponsiveness * dt);
      this.heading += diff * k;
    }
  }
}
