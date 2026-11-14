import * as THREE from 'three';
import { AnimalType, PlacedAnimal, PlacedHouse, ANIMAL_DEFS } from '../../types/game';
import {
  createCowTexture,
  createPigTexture,
  createChickenTexture,
  createGoatTexture,
} from '../../utils/textures';
import {
  getAnimalSpecies,
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
} from './animals';
import {
  exponentialDamp,
  centrifugalBankingAngle,
  shortestAngleDiff,
  clamp,
} from '../../utils/calculus';
import { isTerrainBlocked } from '../../data/terrainFeatures';

export interface AnimalGhostState {
  x: number;
  z: number;
  valid: boolean;
  reason?: string;
}

export function createAnimalRigMaterials(renderer?: THREE.WebGLRenderer): AnimalRigMaterials {
  const cowTex = createCowTexture(renderer);
  const pigTex = createPigTexture(renderer);
  const chickenTex = createChickenTexture(renderer);
  const goatTex = createGoatTexture(renderer);

  return {
    cowMat: new THREE.MeshStandardMaterial({ map: cowTex, roughness: 0.85, metalness: 0.05 }),
    pigMat: new THREE.MeshStandardMaterial({ map: pigTex, roughness: 0.7, metalness: 0.02 }),
    chickenMat: new THREE.MeshStandardMaterial({ map: chickenTex, roughness: 0.8, metalness: 0.02 }),
    goatMat: new THREE.MeshStandardMaterial({ map: goatTex, roughness: 0.85, metalness: 0.02 }),
    pinkMuzzleMat: new THREE.MeshStandardMaterial({ roughness: 0.6, color: 0xffb5b5 }),
    darkHoofMat: new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0x2b2b2b }),
    hornIvoryMat: new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xe0d6b5 }),
    chickenCombMat: new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xd32f2f }),
    chickenBeakMat: new THREE.MeshStandardMaterial({ roughness: 0.4, color: 0xffb300 }),
    darkEyeMat: new THREE.MeshStandardMaterial({ roughness: 0.3, color: 0x111111 }),
  };
}

export class FarmAnimals3D {
  public group: THREE.Group;
  public interactiveMeshes: THREE.Mesh[] = [];
  public map2Unlocked: boolean = false;
  private animals: Map<string, AnimalRuntime> = new Map();
  private houses: PlacedHouse[] = [];

  // Materials palette
  private rigMaterials: AnimalRigMaterials;

  // Placement ghost
  private ghostGroup: THREE.Group | null = null;
  private ghostAnimalType: AnimalType | null = null;
  private ghostRot: number = 0;
  private ghostPos: THREE.Vector3 = new THREE.Vector3();
  private ghostValid: boolean = true;
  private ghostMatValid: THREE.MeshBasicMaterial;
  private ghostMatInvalid: THREE.MeshBasicMaterial;
  private hiddenId: string | null = null;

  // Scratch vector for zero GC during updates
  private _scratchDir = new THREE.Vector3();

  constructor(renderer?: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'FarmAnimals';

    this.rigMaterials = createAnimalRigMaterials(renderer);

    this.ghostMatValid = new THREE.MeshBasicMaterial({
      color: 0x4caf50,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ghostMatInvalid = new THREE.MeshBasicMaterial({
      color: 0xf44336,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
  }

  /**
   * Delegates rig generation to the species controller (e.g. cow.glb for cow)
   */
  private buildRig(type: AnimalType): AnimalRigResult {
    return getAnimalSpecies(type).createRig(this.rigMaterials);
  }

  // ───────────────────────── State Management & Synchronization ─────────────────────────

  public setAnimals(placed: PlacedAnimal[]) {
    const nextIds = new Set(placed.map((p) => p.id));

    // Remove deleted animals and release non-shared procedural geometries
    for (const [id, runtime] of this.animals.entries()) {
      if (!nextIds.has(id)) {
        runtime.group.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.userData.isSharedGlbGeometry) {
            child.geometry?.dispose();
          }
        });
        this.group.remove(runtime.group);
        this.animals.delete(id);
      }
    }

    // Add or update
    for (const item of placed) {
      if (this.hiddenId && item.id === this.hiddenId) {
        const existing = this.animals.get(item.id);
        if (existing) existing.group.visible = false;
        continue;
      }

      let runtime = this.animals.get(item.id);
      if (!runtime) {
        runtime = this.instantiateAnimalRig(item);
        this.animals.set(item.id, runtime);
        this.group.add(runtime.group);
      } else {
        runtime.group.visible = true;
        runtime.data = item;
        runtime.currentPos.set(item.x, 0, item.z);
        runtime.targetPos.set(item.x, 0, item.z);
        runtime.group.position.set(item.x, 0, item.z);
        runtime.group.rotation.y = item.rot;
        runtime.currentHeading = item.rot;
      }
    }

    this.rebuildInteractiveList();
  }

  public setHouses(houses: PlacedHouse[]) {
    this.houses = houses;
  }

  private instantiateAnimalRig(item: PlacedAnimal): AnimalRuntime {
    const def = ANIMAL_DEFS[item.type];
    const container = new THREE.Group();
    container.name = `Animal_${item.type}_${item.id}`;
    container.position.set(item.x, 0, item.z);
    container.rotation.y = item.rot;
    container.scale.setScalar(def.scale);

    const rig = this.buildRig(item.type);
    container.add(rig.root);

    // Copy rig userData to container
    Object.assign(container.userData, rig.root.userData);

    // Tag body mesh and ALL children meshes for comprehensive raycasting (works with GLB models!)
    rig.bodyMesh.userData = { animalId: item.id, animalType: item.type };
    container.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.animalId = item.id;
        child.userData.animalType = item.type;
      }
    });

    return {
      data: item,
      group: container,
      bodyMesh: rig.bodyMesh,
      headGroup: rig.headGroup,
      tailGroup: rig.tailGroup,
      legs: rig.legs,
      wings: rig.wings,
      jawGroup: rig.jawGroup,

      currentPos: new THREE.Vector3(item.x, 0, item.z),
      targetPos: new THREE.Vector3(item.x, 0, item.z),
      velocity: new THREE.Vector3(),
      currentHeading: item.rot,
      angularVelocity: 0,
      state: 'idle',
      stateTimer: 2.0 + Math.random() * 3.0,
      walkCycle: Math.random() * 10,
      petBounce: 0,
    };
  }

  public rebuildInteractiveList() {
    this.interactiveMeshes = [];
    for (const runtime of this.animals.values()) {
      if (!runtime.group.visible) continue;
      runtime.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.animalId) {
          this.interactiveMeshes.push(child);
        }
      });
    }
  }

  public setHiddenId(id: string | null) {
    this.hiddenId = id;
    for (const [aid, runtime] of this.animals.entries()) {
      runtime.group.visible = aid !== id;
    }
    this.rebuildInteractiveList();
  }

  // ───────────────────────── Kinematic Motion & Animation Loop ─────────────────────────

  public update(delta: number, elapsed: number) {
    const dt = Math.min(delta, 0.1);

    for (const runtime of this.animals.values()) {
      if (!runtime.group.visible) continue;

      runtime.stateTimer -= dt;

      // Pet reaction damping
      if (runtime.petBounce > 0.001) {
        runtime.petBounce = exponentialDamp(runtime.petBounce, 0, 6.0, dt);
      } else {
        runtime.petBounce = 0;
      }

      // 1. Foraging state machine
      if (runtime.stateTimer <= 0) {
        if (runtime.state === 'idle' || runtime.state === 'grazing') {
          runtime.state = 'walking';
          runtime.stateTimer = 3.5 + Math.random() * 4.5;

          if (runtime.data.type === 'horse') {
            const stable = this.houses.find((h) => h.type === 15);
            if (stable) {
              // ม้าต้องเดินเล่นอยู่ภายในรั้วคอกม้าเท่านั้น (ห้ามออกนอกคอก)
              // ขนาดคอกม้า 7x7 เมตร: ขอบเขตเดินเล่นด้านในปลอดภัย [-2.0, 2.0] เมตร
              const lx = -2.0 + Math.random() * 4.0;
              const lz = -1.8 + Math.random() * 3.8;
              const cosR = Math.cos(stable.rot);
              const sinR = Math.sin(stable.rot);
              runtime.targetPos.x = stable.x + (lx * cosR - lz * sinR);
              runtime.targetPos.z = stable.z + (lx * sinR + lz * cosR);
            } else {
              const angle = Math.random() * Math.PI * 2;
              const dist = 0.5 + Math.random() * 1.5;
              runtime.targetPos.x = runtime.data.homeX + Math.cos(angle) * dist;
              runtime.targetPos.z = runtime.data.homeZ + Math.sin(angle) * dist;
            }
          } else if (runtime.data.type === 'cow') {
            const cowPen = this.houses.find((h) => h.type === 16);
            if (cowPen) {
              // วัวต้องเดินเล่นอยู่ภายในรั้วคอกวัวเท่านั้น (ห้ามออกนอกคอก)
              // ขนาดคอกวัว 7x7 เมตร: ขอบเขตเดินเล่นด้านในปลอดภัย [-2.1, 2.1] เมตร
              const lx = -2.1 + Math.random() * 4.2;
              const lz = -1.9 + Math.random() * 4.0;
              const cosR = Math.cos(cowPen.rot);
              const sinR = Math.sin(cowPen.rot);
              runtime.targetPos.x = cowPen.x + (lx * cosR - lz * sinR);
              runtime.targetPos.z = cowPen.z + (lx * sinR + lz * cosR);
            } else {
              const angle = Math.random() * Math.PI * 2;
              const dist = 0.5 + Math.random() * 1.5;
              runtime.targetPos.x = runtime.data.homeX + Math.cos(angle) * dist;
              runtime.targetPos.z = runtime.data.homeZ + Math.sin(angle) * dist;
            }
          } else if (runtime.data.type === 'duck') {
            const duckCoops = this.houses.filter((h) => h.type === 24);
            let nearestCoop: PlacedHouse | undefined;
            let bestDist = Infinity;
            for (const coop of duckCoops) {
              const d = Math.hypot(runtime.currentPos.x - coop.x, runtime.currentPos.z - coop.z);
              if (d < bestDist) {
                bestDist = d;
                nearestCoop = coop;
              }
            }
            if (nearestCoop) {
              // เป็ดเดินเล่นอยู่ภายในรั้วลานเล้าเป็ด (type 24)
              const lx = -2.0 + Math.random() * 4.0;
              const lz = -1.1 + Math.random() * 3.6;
              const cosR = Math.cos(nearestCoop.rot);
              const sinR = Math.sin(nearestCoop.rot);
              runtime.targetPos.x = nearestCoop.x + (lx * cosR - lz * sinR);
              runtime.targetPos.z = nearestCoop.z + (lx * sinR + lz * cosR);
            } else {
              const angle = Math.random() * Math.PI * 2;
              const dist = 0.5 + Math.random() * 1.8;
              runtime.targetPos.x = runtime.data.homeX + Math.cos(angle) * dist;
              runtime.targetPos.z = runtime.data.homeZ + Math.sin(angle) * dist;
            }
          } else {
            const angle = Math.random() * Math.PI * 2;
            const dist = 1.5 + Math.random() * 5.0;
            const nx = runtime.data.homeX + Math.cos(angle) * dist;
            const nz = runtime.data.homeZ + Math.sin(angle) * dist;

            runtime.targetPos.x = clamp(nx, -42, 42);
            runtime.targetPos.z = clamp(nz, -30, 30);
          }
        } else {
          runtime.state = Math.random() > 0.4 ? 'grazing' : 'idle';
          runtime.stateTimer = 2.5 + Math.random() * 5.0;
        }
      }

      // 2. Differential kinematics (Calculus: continuous acceleration, steering & arrive braking)
      if (runtime.state === 'walking') {
        this._scratchDir.subVectors(runtime.targetPos, runtime.currentPos);
        this._scratchDir.y = 0;
        const distToTarget = this._scratchDir.length();

        if (distToTarget < 0.25) {
          // Reached target: transition to grazing or idle smoothly
          runtime.state = Math.random() > 0.35 ? 'grazing' : 'idle';
          runtime.stateTimer = 3.0 + Math.random() * 3.5;
        } else {
          this._scratchDir.normalize();

          const targetHeading = Math.atan2(this._scratchDir.x, this._scratchDir.z);
          const headingError = shortestAngleDiff(runtime.currentHeading, targetHeading);

          // Analytical first-order turning differential: dθ/dt = -λ * headingError
          const turnRate = 5.2; // 1/s
          const turnK = 1 - Math.exp(-turnRate * dt);
          const dTheta = headingError * turnK;
          runtime.angularVelocity = dTheta / Math.max(dt, 0.001);
          runtime.currentHeading += dTheta;

          // Normalize heading to [-π, π]
          while (runtime.currentHeading > Math.PI) runtime.currentHeading -= Math.PI * 2;
          while (runtime.currentHeading < -Math.PI) runtime.currentHeading += Math.PI * 2;

          // Arrive deceleration: smooth linear braking within arriveRadius (1.2m)
          const arriveRadius = 1.2;
          const arriveFactor = Math.min(1.0, distToTarget / arriveRadius);

          const baseSpeed = ANIMAL_DEFS[runtime.data.type].walkSpeed;
          const alignmentFactor = Math.max(0.2, Math.cos(headingError));
          const targetSpeed = baseSpeed * alignmentFactor * arriveFactor;

          const curSpeed = runtime.velocity.length();
          const nextSpeed = exponentialDamp(curSpeed, targetSpeed, 6.0, dt);
          runtime.velocity.set(
            Math.sin(runtime.currentHeading) * nextSpeed,
            0,
            Math.cos(runtime.currentHeading) * nextSpeed
          );

          runtime.currentPos.addScaledVector(runtime.velocity, dt);
        }
      } else {
        // Idle / Grazing: exponentially damp residual velocity to zero (smooth deceleration)
        const curSpeed = runtime.velocity.length();
        if (curSpeed > 1e-4) {
          const dampedSpeed = exponentialDamp(curSpeed, 0, 8.0, dt);
          if (dampedSpeed > 0.001) {
            runtime.velocity.setLength(dampedSpeed);
            runtime.currentPos.addScaledVector(runtime.velocity, dt);
          } else {
            runtime.velocity.set(0, 0, 0);
          }
        }
        runtime.angularVelocity = exponentialDamp(runtime.angularVelocity, 0, 8.0, dt);
      }

      // 3. Strict Paddock & Fence Boundary Enclosure (ห้ามม้าและวัวออกจากคอกเด็ดขาด)
      if (runtime.data.type === 'horse') {
        const stable = this.houses.find((h) => h.type === 15);
        if (stable) {
          const dx = runtime.currentPos.x - stable.x;
          const dz = runtime.currentPos.z - stable.z;
          const distToStable = Math.hypot(dx, dz);

          // หากม้าหลุดออกนอกคอกหรือมาจากไฟล์เซฟเดิมที่อยู่นอกคอก/เสาไฟฟ้า ให้ดึงกลับเข้าคอกทันที
          if (distToStable > 4.5) {
            runtime.currentPos.set(stable.x, 0, stable.z + 0.4);
            runtime.targetPos.set(stable.x, 0, stable.z + 0.4);
            runtime.velocity.set(0, 0, 0);
            runtime.data.homeX = stable.x;
            runtime.data.homeZ = stable.z + 0.4;
          } else {
            // แปลงพิกัดตำแหน่งม้าเข้าสู่ระนาบหมุนของคอกม้า (Local paddock coordinates)
            const cosInv = Math.cos(-stable.rot);
            const sinInv = Math.sin(-stable.rot);
            const lx = dx * cosInv - dz * sinInv;
            const lz = dx * sinInv + dz * cosInv;

            // รั้วคอกม้าอยู่ที่ ±3.3 เมตร กำหนดโซนเดินปลอดภัยในคอก [-2.4, 2.4] X และ [-2.1, 2.4] Z
            const minLx = -2.4, maxLx = 2.4;
            const minLz = -2.1, maxLz = 2.4;

            const clampedLx = clamp(lx, minLx, maxLx);
            const clampedLz = clamp(lz, minLz, maxLz);

            if (clampedLx !== lx || clampedLz !== lz) {
              const cosR = Math.cos(stable.rot);
              const sinR = Math.sin(stable.rot);
              runtime.currentPos.x = stable.x + (clampedLx * cosR - clampedLz * sinR);
              runtime.currentPos.z = stable.z + (clampedLx * sinR + clampedLz * cosR);
              runtime.velocity.set(0, 0, 0);
              runtime.state = Math.random() > 0.4 ? 'grazing' : 'idle';
              runtime.stateTimer = 2.0 + Math.random() * 3.0;
            }
          }
        } else {
          // หากยังไม่พบคอกม้า ให้จำกัดรัศมีม้าอยู่ไม่เกิน 2.2 เมตรจากจุดกำเนิด
          const hx = runtime.data.homeX;
          const hz = runtime.data.homeZ;
          runtime.currentPos.x = clamp(runtime.currentPos.x, hx - 2.2, hx + 2.2);
          runtime.currentPos.z = clamp(runtime.currentPos.z, hz - 2.2, hz + 2.2);
        }
      } else if (runtime.data.type === 'cow') {
        const cowPen = this.houses.find((h) => h.type === 16);
        if (cowPen) {
          const dx = runtime.currentPos.x - cowPen.x;
          const dz = runtime.currentPos.z - cowPen.z;
          const distToPen = Math.hypot(dx, dz);

          // หากวัวหลุดออกนอกคอกหรือมาจากไฟล์เซฟเดิมที่อยู่นอกคอก ให้ดึงกลับเข้าคอกทันที
          if (distToPen > 4.5) {
            runtime.currentPos.set(cowPen.x, 0, cowPen.z + 0.4);
            runtime.targetPos.set(cowPen.x, 0, cowPen.z + 0.4);
            runtime.velocity.set(0, 0, 0);
            runtime.data.homeX = cowPen.x;
            runtime.data.homeZ = cowPen.z + 0.4;
          } else {
            // แปลงพิกัดตำแหน่งวัวเข้าสู่ระนาบหมุนของคอกวัว (Local corral coordinates)
            const cosInv = Math.cos(-cowPen.rot);
            const sinInv = Math.sin(-cowPen.rot);
            const lx = dx * cosInv - dz * sinInv;
            const lz = dx * sinInv + dz * cosInv;

            // รั้วคอกวัวอยู่ที่ ±3.3 เมตร กำหนดโซนเดินปลอดภัยในคอก [-2.4, 2.4] X และ [-2.2, 2.4] Z
            const minLx = -2.4, maxLx = 2.4;
            const minLz = -2.2, maxLz = 2.4;

            const clampedLx = clamp(lx, minLx, maxLx);
            const clampedLz = clamp(lz, minLz, maxLz);

            if (clampedLx !== lx || clampedLz !== lz) {
              const cosR = Math.cos(cowPen.rot);
              const sinR = Math.sin(cowPen.rot);
              runtime.currentPos.x = cowPen.x + (clampedLx * cosR - clampedLz * sinR);
              runtime.currentPos.z = cowPen.z + (clampedLx * sinR + clampedLz * cosR);
              runtime.velocity.set(0, 0, 0);
              runtime.state = Math.random() > 0.4 ? 'grazing' : 'idle';
              runtime.stateTimer = 2.0 + Math.random() * 3.0;
            }
          }
        } else {
          // หากยังไม่พบคอกวัว ให้จำกัดรัศมีวัวอยู่ไม่เกิน 2.2 เมตรจากจุดกำเนิด
          const hx = runtime.data.homeX;
          const hz = runtime.data.homeZ;
          runtime.currentPos.x = clamp(runtime.currentPos.x, hx - 2.2, hx + 2.2);
          runtime.currentPos.z = clamp(runtime.currentPos.z, hz - 2.2, hz + 2.2);
        }
      } else if (runtime.data.type === 'duck') {
        const duckCoops = this.houses.filter((h) => h.type === 24);
        let nearestCoop: PlacedHouse | undefined;
        let bestDist = Infinity;
        for (const coop of duckCoops) {
          const d = Math.hypot(runtime.currentPos.x - coop.x, runtime.currentPos.z - coop.z);
          if (d < bestDist) {
            bestDist = d;
            nearestCoop = coop;
          }
        }
        if (nearestCoop) {
          const dx = runtime.currentPos.x - nearestCoop.x;
          const dz = runtime.currentPos.z - nearestCoop.z;
          const distToCoop = Math.hypot(dx, dz);
          if (distToCoop > 3.8) {
            runtime.currentPos.set(nearestCoop.x, 0, nearestCoop.z + 0.6);
            runtime.targetPos.set(nearestCoop.x, 0, nearestCoop.z + 0.6);
            runtime.velocity.set(0, 0, 0);
            runtime.data.homeX = nearestCoop.x;
            runtime.data.homeZ = nearestCoop.z + 0.6;
          } else {
            const cosInv = Math.cos(-nearestCoop.rot);
            const sinInv = Math.sin(-nearestCoop.rot);
            const lx = dx * cosInv - dz * sinInv;
            const lz = dx * sinInv + dz * cosInv;

            const clampedLx = clamp(lx, -2.15, 2.15);
            const clampedLz = clamp(lz, -1.25, 2.45);
            if (clampedLx !== lx || clampedLz !== lz) {
              const cosR = Math.cos(nearestCoop.rot);
              const sinR = Math.sin(nearestCoop.rot);
              runtime.currentPos.x = nearestCoop.x + (clampedLx * cosR - clampedLz * sinR);
              runtime.currentPos.z = nearestCoop.z + (clampedLx * sinR + clampedLz * cosR);
              runtime.velocity.set(0, 0, 0);
              runtime.state = Math.random() > 0.4 ? 'grazing' : 'idle';
              runtime.stateTimer = 1.8 + Math.random() * 2.5;
            }
          }
        } else {
          const hx = runtime.data.homeX;
          const hz = runtime.data.homeZ;
          runtime.currentPos.x = clamp(runtime.currentPos.x, hx - 2.0, hx + 2.0);
          runtime.currentPos.z = clamp(runtime.currentPos.z, hz - 2.0, hz + 2.0);
        }
      }

      // Calculus: Gait walk cycle accumulates as integral of velocity over stride length: dφ/dt = (v / L) * 2π
      const currentSpeed = runtime.velocity.length();
      const strideLength =
        runtime.data.type === 'horse'
          ? 2.4
          : runtime.data.type === 'cow'
            ? 2.1
            : runtime.data.type === 'duck'
              ? 0.65
              : 1.4;
      if (currentSpeed > 0.01) {
        runtime.walkCycle += (currentSpeed / strideLength) * Math.PI * 2 * dt;
      }

      // Update position and rotation - Ground level strictly Y = 0
      runtime.group.position.x = runtime.currentPos.x;
      runtime.group.position.y = 0;
      runtime.group.position.z = runtime.currentPos.z;
      runtime.group.rotation.y = runtime.currentHeading;

      // 3. Centrifugal Banking
      const isWalking = runtime.state === 'walking' && currentSpeed > 0.08;

      runtime.group.rotation.z = centrifugalBankingAngle(currentSpeed, runtime.angularVelocity) * 0.45;

      // 4. Species Controller Animation (Handles GLB mixer or procedural articulators)
      const species = getAnimalSpecies(runtime.data.type);
      species.animate(runtime, dt, elapsed, isWalking, currentSpeed);
    }
  }

  // ───────────────────────── Petting & Raycast Picking ─────────────────────────

  public petAnimal(id: string): AnimalRuntime | null {
    const runtime = this.animals.get(id);
    if (!runtime) return null;
    runtime.petBounce = 0.8;
    runtime.state = 'idle';
    runtime.stateTimer = 3.0;
    return runtime;
  }

  public pickAnimal(raycaster: THREE.Raycaster): PlacedAnimal | null {
    const hits = raycaster.intersectObjects(this.interactiveMeshes, false);
    if (hits.length > 0) {
      const aid = hits[0].object.userData.animalId;
      if (aid) {
        const item = this.animals.get(aid)?.data;
        return item ?? null;
      }
    }
    return null;
  }

  // ───────────────────────── Ghost Placement Preview ─────────────────────────

  public startGhost(type: AnimalType, rot: number, x: number, z: number): AnimalGhostState {
    this.stopGhost();
    this.ghostAnimalType = type;
    this.ghostRot = rot;
    this.ghostPos.set(x, 0, z);

    const ghost = new THREE.Group();
    ghost.name = 'AnimalGhost';

    const rig = this.buildRig(type);
    const scale = ANIMAL_DEFS[type].scale;
    rig.root.scale.setScalar(scale);

    rig.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = this.ghostMatValid;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    ghost.add(rig.root);
    ghost.position.copy(this.ghostPos);
    ghost.rotation.y = this.ghostRot;

    this.ghostGroup = ghost;
    this.group.add(ghost);

    return this.validateGhost();
  }

  public moveGhost(x: number, z: number): AnimalGhostState {
    if (!this.ghostGroup) return { x, z, valid: false };
    const minX = this.map2Unlocked ? -86 : -44;
    this.ghostPos.x = clamp(x, minX, 44);
    this.ghostPos.z = clamp(z, -32, 32);
    this.ghostGroup.position.copy(this.ghostPos);
    return this.validateGhost();
  }

  public setGhostRotation(rot: number): AnimalGhostState {
    this.ghostRot = rot;
    if (this.ghostGroup) {
      this.ghostGroup.rotation.y = rot;
    }
    return this.validateGhost();
  }

  public stopGhost() {
    if (this.ghostGroup) {
      this.group.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
    this.ghostAnimalType = null;
  }

  public hasGhost(): boolean {
    return this.ghostGroup !== null;
  }

  private validateGhost(): AnimalGhostState {
    const x = this.ghostPos.x;
    const z = this.ghostPos.z;
    const minX = this.map2Unlocked ? -88 : -46;
    const inBounds = x > minX && x < 46 && Math.abs(z) < 34;
    const terrain = x > -43 ? isTerrainBlocked(x, z) : { blocked: false, reason: undefined };

    const valid = inBounds && !terrain.blocked;
    this.ghostValid = valid;
    const reason = !inBounds
      ? 'ชิดขอบเกาะเกินไป'
      : terrain.blocked
      ? (terrain.reason || 'อยู่บนพื้นที่ต้องห้าม')
      : 'ตำแหน่งนี้วางได้อิสระ';

    if (this.ghostGroup) {
      const mat = valid ? this.ghostMatValid : this.ghostMatInvalid;
      this.ghostGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = mat;
        }
      });
    }

    return { x, z, valid, reason };
  }

  public dispose() {
    this.stopGhost();
    for (const runtime of this.animals.values()) {
      runtime.group.traverse((child) => {
        if (child instanceof THREE.Mesh && !child.userData.isSharedGlbGeometry) {
          child.geometry?.dispose();
        }
      });
      this.group.remove(runtime.group);
    }
    this.animals.clear();
    this.interactiveMeshes = [];
    this.ghostMatValid.dispose();
    this.ghostMatInvalid.dispose();
    Object.values(this.rigMaterials).forEach((m) => m.dispose());
  }
}