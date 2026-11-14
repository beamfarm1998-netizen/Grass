import * as THREE from 'three';
import { DEFAULT_PHYSICS_CONFIG, PhysicsConfig } from './PhysicsConfig';
import { WaterPhysics } from './water/WaterPhysics';

export interface CastProjectile {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

export class PhysicsWorld {
  public readonly config: PhysicsConfig;
  private windScale = 1.0;

  constructor(config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG) {
    this.config = { ...config };
  }

  setWindScale(scale: number): void {
    this.windScale = Math.max(0.3, Math.min(2.2, scale));
  }

  getWindScale(): number {
    return this.windScale;
  }

  /**
   * Advances airborne cast rig with gravity and aerodynamic drag; returns true on water impact.
   */
  stepCastProjectile(proj: CastProjectile, dt: number, elapsed: number): 'flying' | 'water_hit' | 'land_hit' {
    if (!proj.active) return 'flying';

    // Quadratic-lite air drag + gravity
    const speed = proj.velocity.length();
    const dragFactor = Math.max(0, 1 - this.config.airDragCoeff * speed * dt);
    proj.velocity.multiplyScalar(dragFactor);
    proj.velocity.y -= this.config.gravity * dt;

    proj.position.addScaledVector(proj.velocity, dt);

    const waterY = WaterPhysics.waveHeightAt(proj.position.x, proj.position.z, elapsed, this.windScale);
    const groundY = WaterPhysics.terrainHeightAt(proj.position.x, proj.position.z);

    if (proj.position.y <= Math.max(waterY, groundY)) {
      proj.active = false;
      if (groundY < -0.2) {
        proj.position.y = waterY;
        return 'water_hit';
      }
      proj.position.y = groundY + 0.05;
      return 'land_hit';
    }

    return 'flying';
  }

  /**
   * Keeps floating bobber riding surface waves and drifting gently with lake current.
   */
  stepFloatingBobber(
    bobberPos: THREE.Vector3,
    nibbleDipOffset: number,
    dt: number,
    elapsed: number
  ): void {
    const nextX = bobberPos.x + this.config.waterCurrentX * this.windScale * dt;
    const nextZ = bobberPos.z + this.config.waterCurrentZ * this.windScale * dt;
    if (WaterPhysics.waterDepthAt(nextX, nextZ) > 0.65) {
      bobberPos.x = nextX;
      bobberPos.z = nextZ;
    }
    const waveY = WaterPhysics.waveHeightAt(bobberPos.x, bobberPos.z, elapsed, this.windScale);
    bobberPos.y = waveY - nibbleDipOffset;
  }
}
